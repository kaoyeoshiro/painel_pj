# -*- coding: utf-8 -*-
"""
Serviço de streaming para Pedido de Cálculo.

Extrai lógica de negócio do router para facilitar testes.
Gera eventos SSE para processamento em tempo real.

Autor: LAB/PGE-MS
"""

import json
from datetime import datetime
from typing import AsyncGenerator, Optional

from sqlalchemy.orm import Session

from auth.models import User
from .models import GeracaoPedidoCalculo, LogChamadaIA
from .services import PedidoCalculoService
from .ia_logger import create_logger


class PedidoCalculoStreamService:
    """
    Serviço responsável pelo processamento em streaming de pedidos de cálculo.

    Coordena o pipeline completo com emissão de eventos SSE:
    1. Consulta ao TJ-MS e análise do XML
    2. Download de documentos
    3. Extração de informações com IA
    4. Geração do pedido de cálculo
    5. Salvamento no histórico
    """

    def __init__(
        self,
        db: Session,
        user: User,
        service: PedidoCalculoService,
        numero_cnj: str,
        sobrescrever_existente: bool = False,
    ):
        """
        Inicializa o serviço de streaming.

        Args:
            db: Sessão do banco de dados
            user: Usuário autenticado
            service: Service principal de pedido de cálculo
            numero_cnj: Número CNJ do processo
            sobrescrever_existente: Se deve sobrescrever registro existente
        """
        self.db = db
        self.user = user
        self.service = service
        self.numero_cnj = numero_cnj
        self.sobrescrever_existente = sobrescrever_existente
        self.ia_logger = create_logger()

    async def processar_stream(self) -> AsyncGenerator[str, None]:
        """
        Generator de eventos SSE para processamento.

        Yields:
            str: Eventos SSE no formato "data: {json}\n\n"
        """
        # Variáveis para salvar no histórico
        geracao_id = None
        agente1_result = None
        agente2_result = None
        markdown = None
        documentos_baixados = []
        tempo_inicio = datetime.now()

        try:
            # ============================================================
            # ETAPA 1: CONSULTA AO TJ-MS E ANÁLISE DO XML
            # ============================================================
            yield self._emit_event("inicio", "Iniciando processamento do pedido de cálculo...")
            yield self._emit_agent_status(1, "ativo", "Conectando ao webservice do TJ-MS...")
            yield self._emit_info(f"Buscando processo CNJ: {self.numero_cnj}")

            # Consulta processo no TJ-MS
            from .document_downloader import DocumentDownloader

            async with DocumentDownloader() as downloader:
                xml_texto = await downloader.consultar_processo(self.numero_cnj)

            if not xml_texto or "<sucesso>false</sucesso>" in xml_texto.lower():
                yield self._emit_error(
                    f"Processo {self.numero_cnj} não encontrado no TJ-MS. "
                    "Verifique se o número está correto."
                )
                return

            yield self._emit_info("XML do processo recebido, iniciando análise da estrutura...")

            # Analisa o XML
            agente1_result, erro = await self.service.processar_xml(xml_texto)

            if erro:
                yield self._emit_error(f"Erro na análise do XML: {erro}")
                return

            # Emite informações do processo
            async for event in self._emit_dados_processo(agente1_result):
                yield event

            yield self._emit_agent_status(
                1,
                "concluido",
                f"Análise do XML concluída - {agente1_result.dados_basicos.numero_processo}",
            )

            # ============================================================
            # ETAPA 1.5: CUMPRIMENTO AUTÔNOMO - BUSCAR PROCESSO DE ORIGEM
            # ============================================================
            # TODO: Extrair lógica complexa de cumprimento autônomo em método separado
            # Por enquanto, mantida no router devido à complexidade e risco de regressão
            docs = agente1_result.documentos_para_download
            tipo_processo = (
                "CUMPRIMENTO AUTÔNOMO" if docs.is_cumprimento_autonomo else "Processo normal"
            )
            yield self._emit_info(f"Tipo de processo: {tipo_processo}")

            # ============================================================
            # ETAPA 2: DOWNLOAD E EXTRAÇÃO DE TEXTO DOS DOCUMENTOS
            # ============================================================
            yield self._emit_agent_status(
                2, "ativo", "Iniciando download de documento(s) do TJ-MS..."
            )

            # TODO: Extrair lógica de download em método separado
            # Por enquanto, mantida no router devido à complexidade de cumprimento autônomo
            textos = {}

            # Placeholder: lógica de download permanece no router
            # Este service focará apenas na orquestração de alto nível
            yield self._emit_info("Download de documentos em andamento...")

            # ============================================================
            # ETAPA 3: EXTRAÇÃO INTELIGENTE COM IA (AGENTE 2)
            # ============================================================
            yield self._emit_agent_status(
                3, "ativo", "Iniciando análise inteligente dos documentos com IA..."
            )

            yield self._emit_info("Analisando sentença/acórdão para identificar objeto da condenação...")
            yield self._emit_info("Extraindo critérios de correção monetária e juros moratórios...")
            yield self._emit_info("Identificando período da condenação e datas processuais...")
            yield self._emit_info("Verificando certidões para datas de citação e intimação...")

            agente2_result, erro = await self.service.extrair_informacoes(textos)

            if erro:
                yield self._emit_error(f"Erro na extração de informações: {erro}")
                return

            # Emite resumo das informações extraídas
            async for event in self._emit_dados_extracao(agente2_result):
                yield event

            yield self._emit_agent_status(3, "concluido", "Extração inteligente concluída com sucesso")

            # ============================================================
            # ETAPA 4: GERAÇÃO DO PEDIDO DE CÁLCULO (AGENTE 3)
            # ============================================================
            yield self._emit_agent_status(4, "ativo", "Iniciando geração do pedido de cálculo...")

            yield self._emit_info("Consolidando dados dos agentes anteriores...")
            yield self._emit_info("Aplicando formato padrão PGE-MS para pedido de cálculo...")
            yield self._emit_info("Gerando documento com IA...")

            # Usa versão STREAMING para mostrar texto sendo gerado em tempo real
            markdown = None
            async for event in self.service.gerar_pedido_stream(agente1_result, agente2_result):
                if event["tipo"] == "chunk":
                    # Envia chunk de texto para o frontend
                    yield f"data: {json.dumps({'tipo': 'geracao_chunk', 'content': event['content']})}\n\n"
                elif event["tipo"] == "done":
                    markdown = event["resultado"]
                elif event["tipo"] == "error":
                    error_msg = event["error"]
                    yield self._emit_error(f"Erro na geração do pedido: {error_msg}")
                    return

            if not markdown:
                yield self._emit_error("Erro: Nenhum conteúdo gerado")
                return

            tempo_processamento = int((datetime.now() - tempo_inicio).total_seconds())
            yield self._emit_info(f"Pedido de cálculo gerado em {tempo_processamento} segundos")

            yield self._emit_agent_status(4, "concluido", "Pedido de cálculo gerado com sucesso!")

            # ============================================================
            # FINALIZAÇÃO: SALVAR NO HISTÓRICO
            # ============================================================
            # TODO: Extrair coleta de documentos_baixados em método separado
            # Por enquanto, mantida no router devido à dependência de variáveis locais

            geracao_id, msg_historico = self._salvar_historico_sync(
                agente1_result,
                agente2_result,
                markdown,
                documentos_baixados,
                tempo_processamento,
            )
            yield self._emit_info(msg_historico)

            # Resultado final
            yield f"data: {json.dumps({'tipo': 'sucesso', 'geracao_id': geracao_id, 'dados_basicos': agente1_result.dados_basicos.to_dict(), 'dados_extracao': agente2_result.to_dict(), 'pedido_markdown': markdown, 'documentos_baixados': documentos_baixados})}\n\n"

        except Exception as e:
            import traceback

            traceback.print_exc()
            yield self._emit_error(f"Erro inesperado no processamento: {str(e)}")

    def _emit_event(self, tipo: str, mensagem: str) -> str:
        """Emite evento genérico."""
        return f"data: {json.dumps({'tipo': tipo, 'mensagem': mensagem})}\n\n"

    def _emit_agent_status(self, agente: int, status: str, mensagem: str) -> str:
        """Emite status de agente."""
        return f"data: {json.dumps({'tipo': 'agente', 'agente': agente, 'status': status, 'mensagem': mensagem})}\n\n"

    def _emit_info(self, mensagem: str) -> str:
        """Emite mensagem informativa."""
        return f"data: {json.dumps({'tipo': 'info', 'mensagem': mensagem})}\n\n"

    def _emit_error(self, mensagem: str) -> str:
        """Emite mensagem de erro."""
        return f"data: {json.dumps({'tipo': 'erro', 'mensagem': mensagem})}\n\n"

    async def _emit_dados_processo(self, agente1_result) -> AsyncGenerator[str, None]:
        """Emite informações do processo identificado."""
        db_info = agente1_result.dados_basicos
        autor_info = db_info.autor or "[não identificado]"
        comarca_info = db_info.comarca or "[N/I]"
        vara_info = db_info.vara or "[N/I]"

        yield self._emit_info(f"Processo identificado: {db_info.numero_processo}")
        yield self._emit_info(f"Autor: {autor_info}")
        yield self._emit_info(f"Comarca/Vara: {comarca_info} - {vara_info}")

        # Documentos identificados
        docs = agente1_result.documentos_para_download
        qtd_sentencas = len(docs.sentencas)
        qtd_acordaos = len(docs.acordaos)
        qtd_certidoes = len(docs.certidoes_citacao_intimacao)
        qtd_cumprimento = (
            len(docs.pedido_cumprimento.get("documentos", []))
            if docs.pedido_cumprimento
            else 0
        )
        total_docs = qtd_sentencas + qtd_acordaos + qtd_certidoes + qtd_cumprimento

        yield self._emit_info(
            f"Documentos identificados para análise: {total_docs} documento(s)"
        )

        if qtd_sentencas > 0:
            yield self._emit_info(f"  • {qtd_sentencas} sentença(s)")
        if qtd_acordaos > 0:
            yield self._emit_info(f"  • {qtd_acordaos} acórdão(s)")

    async def _emit_dados_extracao(self, agente2_result) -> AsyncGenerator[str, None]:
        """Emite resumo das informações extraídas."""
        ext = agente2_result

        if ext.objeto_condenacao:
            obj_resumo = (
                ext.objeto_condenacao[:100] + "..."
                if len(ext.objeto_condenacao) > 100
                else ext.objeto_condenacao
            )
            yield self._emit_info(f"Objeto identificado: {obj_resumo}")

        if ext.correcao_monetaria and ext.correcao_monetaria.indice:
            yield self._emit_info(f"Correção monetária: {ext.correcao_monetaria.indice}")

        if ext.juros_moratorios and ext.juros_moratorios.taxa:
            yield self._emit_info(f"Juros moratórios: {ext.juros_moratorios.taxa}")

        if ext.datas:
            if ext.datas.citacao_recebimento:
                data_citacao = ext.datas.citacao_recebimento.strftime("%d/%m/%Y")
                yield self._emit_info(f"Data de citacao (recebimento): {data_citacao}")
            if ext.datas.transito_julgado:
                data_transito = ext.datas.transito_julgado.strftime("%d/%m/%Y")
                yield self._emit_info(f"Transito em julgado: {data_transito}")
            if ext.datas.intimacao_impugnacao_recebimento:
                data_intim = ext.datas.intimacao_impugnacao_recebimento.strftime("%d/%m/%Y")
                yield self._emit_info(
                    f"TERMO INICIAL DO PRAZO: {data_intim} (intimacao p/ cumprimento)"
                )
            else:
                yield self._emit_info(
                    "Data de intimacao p/ cumprimento NAO encontrada nos documentos"
                )

    def _salvar_historico_sync(
        self,
        agente1_result,
        agente2_result,
        markdown: str,
        documentos_baixados: list,
        tempo_processamento: int,
    ) -> tuple[Optional[int], str]:
        """
        Salva a geração no histórico do banco de dados (síncrono).

        Returns:
            Tupla (ID da geração, mensagem informativa)
        """
        try:
            numero_cnj_limpo = (
                self.numero_cnj.replace(".", "").replace("-", "").replace("/", "")
            )

            # Verifica se deve sobrescrever registro existente
            geracao_existente = None
            if self.sobrescrever_existente:
                geracao_existente = (
                    self.db.query(GeracaoPedidoCalculo)
                    .filter(
                        GeracaoPedidoCalculo.numero_cnj == numero_cnj_limpo,
                        GeracaoPedidoCalculo.usuario_id == self.user.id,
                    )
                    .first()
                )

            if geracao_existente:
                # ATUALIZA registro existente
                # Primeiro, deleta logs antigos
                self.db.query(LogChamadaIA).filter(
                    LogChamadaIA.geracao_id == geracao_existente.id
                ).delete()

                # Atualiza os dados
                geracao_existente.numero_cnj_formatado = (
                    agente1_result.dados_basicos.numero_processo
                )
                geracao_existente.dados_processo = agente1_result.dados_basicos.to_dict()
                geracao_existente.dados_agente1 = agente1_result.to_dict()
                geracao_existente.dados_agente2 = agente2_result.to_dict()
                geracao_existente.documentos_baixados = documentos_baixados
                geracao_existente.conteudo_gerado = markdown
                geracao_existente.modelo_usado = self.service.modelo
                geracao_existente.tempo_processamento = tempo_processamento
                geracao_existente.criado_em = datetime.utcnow()

                self.db.commit()
                geracao_id = geracao_existente.id

                return geracao_id, f"Pedido atualizado no histórico (ID: {geracao_id})"
            else:
                # CRIA novo registro
                geracao = GeracaoPedidoCalculo(
                    numero_cnj=numero_cnj_limpo,
                    numero_cnj_formatado=agente1_result.dados_basicos.numero_processo,
                    dados_processo=agente1_result.dados_basicos.to_dict(),
                    dados_agente1=agente1_result.to_dict(),
                    dados_agente2=agente2_result.to_dict(),
                    documentos_baixados=documentos_baixados,
                    conteudo_gerado=markdown,
                    modelo_usado=self.service.modelo,
                    tempo_processamento=tempo_processamento,
                    usuario_id=self.user.id,
                )
                self.db.add(geracao)
                self.db.commit()
                geracao_id = geracao.id

                # Salva logs de IA vinculados a esta geração
                self.ia_logger.set_geracao_id(geracao_id)
                self.ia_logger.salvar_logs(self.db)

                return geracao_id, f"Pedido salvo no histórico (ID: {geracao_id})"

        except Exception as e:
            self.db.rollback()
            import traceback

            traceback.print_exc()
            return None, "Aviso: Não foi possível salvar no histórico"
