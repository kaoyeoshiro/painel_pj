# -*- coding: utf-8 -*-
"""
Serviço de streaming para Pedido de Cálculo.

Extrai lógica de negócio do router para facilitar testes.
Gera eventos SSE para processamento em tempo real.

Pipeline completo:
1. Consulta ao TJ-MS e análise do XML
2. Cumprimento autônomo - busca processo de origem (recursivo)
3. Download e extração de texto dos documentos
4. Análise de certidões com IA
5. Extração inteligente com IA (Agente 2)
6. Geração do pedido de cálculo (Agente 3)
7. Salvamento no histórico

Autor: LAB/PGE-MS
"""

import traceback
from datetime import datetime
from typing import AsyncGenerator, Optional

from sqlalchemy.orm import Session

from auth.models import User
from services.shared.sse import SSEEventFormatter
from .models import GeracaoPedidoCalculo, LogChamadaIA
from .services import PedidoCalculoService
from .ia_logger import create_logger


class PedidoCalculoStreamService:
    """
    Serviço responsável pelo processamento em streaming de pedidos de cálculo.

    Coordena o pipeline completo com emissão de eventos SSE:
    1. Consulta ao TJ-MS e análise do XML
    2. Cumprimento autônomo - busca recursiva do processo de origem
    3. Download de documentos (cumprimento + origem)
    4. Análise de certidões com IA
    5. Extração de informações com IA
    6. Geração do pedido de cálculo
    7. Salvamento no histórico

    Usa SSEEventFormatter para formatação padronizada de eventos.
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
            service: Service principal de pedido de cálculo (já com logger configurado)
            numero_cnj: Número CNJ do processo
            sobrescrever_existente: Se deve sobrescrever registro existente
        """
        self.db = db
        self.user = user
        self.service = service
        self.numero_cnj = numero_cnj
        self.sobrescrever_existente = sobrescrever_existente
        self.ia_logger = getattr(service, "logger", None) or create_logger()
        self._sse = SSEEventFormatter

    async def processar_stream(self) -> AsyncGenerator[str, None]:
        """
        Generator de eventos SSE para processamento completo.

        Pipeline:
        - Etapa 1: Consulta TJ-MS + análise XML
        - Etapa 1.5: Cumprimento autônomo (busca recursiva da origem)
        - Etapa 2: Download e extração de texto
        - Etapa 2.5: Análise de certidões com IA
        - Etapa 3: Extração inteligente com IA (Agente 2)
        - Etapa 4: Geração do pedido de cálculo (Agente 3)
        - Finalização: Salvamento no histórico

        Yields:
            str: Eventos SSE no formato "data: {json}\\n\\n"
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

            from .document_downloader import DocumentDownloader

            async with DocumentDownloader() as downloader:
                xml_texto = await downloader.consultar_processo(self.numero_cnj)

            if not xml_texto or '<sucesso>false</sucesso>' in xml_texto.lower():
                yield self._emit_error(
                    f"Processo {self.numero_cnj} não encontrado no TJ-MS. "
                    "Verifique se o número está correto."
                )
                return

            yield self._emit_info("XML do processo recebido, iniciando análise da estrutura...")

            # Analisa o XML (passa o logger para as chamadas de IA)
            agente1_result, erro = await self.service.processar_xml(xml_texto)

            if erro:
                yield self._emit_error(f"Erro na análise do XML: {erro}")
                return

            # Dados básicos extraídos
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
            qtd_cumprimento = len(docs.pedido_cumprimento.get("documentos", [])) if docs.pedido_cumprimento else 0
            total_docs = qtd_sentencas + qtd_acordaos + qtd_certidoes + qtd_cumprimento

            yield self._emit_info(f"Documentos identificados para análise: {total_docs} documento(s)")

            if qtd_sentencas > 0:
                yield self._emit_info(f"  • {qtd_sentencas} sentença(s)")
            if qtd_acordaos > 0:
                yield self._emit_info(f"  • {qtd_acordaos} acórdão(s)")
            if qtd_certidoes > 0:
                # Mostra detalhes de cada certidão identificada
                for cert in docs.certidoes_citacao_intimacao:
                    tipo_intim = "Intimacao p/ Cumprimento" if cert.tipo.value == "intimacao_impugnacao" else cert.tipo.value.replace("_", " ").title()
                    tipo_cert = "Sistema" if cert.tipo_certidao == "sistema" else "Cartorio (decurso)"
                    data_receb = cert.data_recebimento.strftime("%d/%m/%Y") if cert.data_recebimento else "N/A"
                    termo_ini = cert.termo_inicial_prazo.strftime("%d/%m/%Y") if cert.termo_inicial_prazo else "N/A"
                    yield self._emit_info(f"  - {tipo_intim} (Cert. {tipo_cert})")
                    yield self._emit_info(f"    Recebimento: {data_receb} | Termo inicial (art. 224 CPC): {termo_ini}")
            if qtd_cumprimento > 0:
                yield self._emit_info(f"  • {qtd_cumprimento} documento(s) do pedido de cumprimento")
                # Debug detalhado: mostra TODOS os detalhes dos documentos
                for doc in docs.pedido_cumprimento.get("documentos", []):
                    tipo_cod = doc.get("tipo", "")
                    # Identifica planilha por código OU descrição
                    is_planilha = tipo_cod in ["9553", "61", "9535"]
                    doc_descr = doc.get("descricao", "")
                    if not is_planilha and doc_descr:
                        descr_lower = doc_descr.lower()
                        is_planilha = any(t in descr_lower for t in ['planilha', 'cálculo', 'calculo', 'demonstrativo'])
                    tipo_doc = "PLANILHA" if is_planilha else "Petição"
                    doc_id = doc.get("id", "")
                    doc_data = doc.get("data", "")
                    yield self._emit_info(f"    - {tipo_doc} (código {tipo_cod}): {doc_descr}")
                    yield self._emit_info(f"      ID: {doc_id} | Data: {doc_data}")
            else:
                # Debug: Se não encontrou documentos do cumprimento, mostrar aviso
                yield self._emit_info("  [AVISO] Nenhum documento do pedido de cumprimento identificado!")
                if docs.pedido_cumprimento:
                    data_ref = docs.pedido_cumprimento.get("data_referencia", "N/A")
                    yield self._emit_info(f"  [DEBUG] Data referência (intimação): {data_ref}")

            # Mostra certidões candidatas para análise com IA
            if docs.certidoes_candidatas:
                yield self._emit_info(f"  • {len(docs.certidoes_candidatas)} certidão(ões) candidata(s) para análise com IA")
                if docs.certidao_heuristica:
                    # Mostra sugestão da heurística (será validada pela IA)
                    tipo_cert_str = "Sistema" if docs.certidao_heuristica.tipo_certidao == "sistema" else "Cartório (decurso)"
                    yield self._emit_info(f"    Sugestão heurística: Cert. {tipo_cert_str} (será validada pela IA)")
            else:
                yield self._emit_info("Nenhuma certidão candidata identificada no XML")

            yield self._emit_agent_status(1, "concluido", f"Análise do XML concluída - {db_info.numero_processo}")

            # ============================================================
            # ETAPA 1.5: CUMPRIMENTO AUTÔNOMO - BUSCAR PROCESSO DE ORIGEM
            # ============================================================
            # Variáveis para guardar documentos da origem (baixar separadamente)
            docs_origem_para_baixar = None
            movimentos_origem = None
            dados_basicos_origem = None

            # Debug: mostra se é cumprimento autônomo
            tipo_processo = "CUMPRIMENTO AUTÔNOMO" if docs.is_cumprimento_autonomo else "Processo normal"
            yield self._emit_info(f"Tipo de processo: {tipo_processo}")

            if docs.is_cumprimento_autonomo:
                yield self._emit_info("Buscando documentos do processo de ORIGEM (sentença, acórdão)...")

                numero_origem = docs.numero_processo_origem
                origem_info = numero_origem if numero_origem else "NÃO ENCONTRADO"
                yield self._emit_info(f"Número da origem no XML: {origem_info}")

                # Se não encontrou número no XML, extrai da petição inicial com IA
                if not numero_origem and docs.id_peticao_inicial:
                    yield self._emit_info("Número do processo de origem não encontrado no XML - analisando petição inicial...")

                    # Baixa e extrai texto da petição inicial
                    async with DocumentDownloader() as downloader_pet:
                        textos_peticao = await downloader_pet.baixar_e_extrair_textos(
                            db_info.numero_processo,
                            [docs.id_peticao_inicial]
                        )

                    if textos_peticao and docs.id_peticao_inicial in textos_peticao:
                        texto_peticao = textos_peticao[docs.id_peticao_inicial]
                        yield self._emit_info("Extraindo número do processo de origem com IA...")

                        from .agentes import ExtratorProcessoOrigem
                        extrator = ExtratorProcessoOrigem()
                        numero_origem = await extrator.extrair_numero_origem(texto_peticao)

                        if numero_origem:
                            docs.numero_processo_origem = numero_origem
                            yield self._emit_info(f"Processo de origem identificado pela IA: {numero_origem}")
                        else:
                            yield self._emit_error("Não foi possível identificar o processo de origem")
                    else:
                        yield self._emit_error("Não foi possível baixar a petição inicial")

                # Se temos o número do processo de origem, consulta e extrai documentos
                # IMPORTANTE: Busca RECURSIVA até encontrar processo de CONHECIMENTO (não cumprimento)
                if numero_origem:
                    # Limite de recursão para evitar loops infinitos
                    MAX_RECURSAO = 5
                    processos_visitados = set()
                    processo_atual = numero_origem
                    encontrou_conhecimento = False

                    for nivel in range(MAX_RECURSAO):
                        if processo_atual in processos_visitados:
                            yield self._emit_error("Loop detectado na cadeia de processos!")
                            break

                        processos_visitados.add(processo_atual)
                        yield self._emit_info(f"Consultando processo: {processo_atual} (nível {nivel + 1})...")

                        try:
                            async with DocumentDownloader() as downloader_origem:
                                xml_origem = await downloader_origem.consultar_processo(processo_atual)

                            if not xml_origem:
                                yield self._emit_error(f"Falha ao consultar {processo_atual}")
                                break

                            from .xml_parser import XMLParser
                            parser_origem = XMLParser(xml_origem)
                            docs_temp = parser_origem.identificar_documentos_para_download()
                            movimentos_temp = parser_origem.extrair_movimentos_relevantes()
                            dados_basicos_temp = parser_origem.extrair_dados_basicos()

                            # Verifica se é cumprimento autônomo
                            if docs_temp.is_cumprimento_autonomo:
                                yield self._emit_info(f"  {processo_atual} é CUMPRIMENTO AUTÔNOMO")

                                # Busca próximo processo na cadeia
                                proximo = docs_temp.numero_processo_origem
                                if proximo and proximo not in processos_visitados:
                                    yield self._emit_info(f"  Seguindo para origem: {proximo}")
                                    processo_atual = proximo
                                    continue
                                else:
                                    yield self._emit_info("  Sem mais processos na cadeia")
                                    break
                            else:
                                # ENCONTROU processo de CONHECIMENTO!
                                yield self._emit_info(f"  {processo_atual} é PROCESSO DE CONHECIMENTO (origem real)")
                                encontrou_conhecimento = True

                                # Usa os documentos e dados deste processo
                                docs_origem_para_baixar = docs_temp
                                movimentos_origem = movimentos_temp
                                dados_basicos_origem = dados_basicos_temp

                                # Atualiza o número da origem para o processo de conhecimento
                                docs.numero_processo_origem = processo_atual

                                # Log da data de ajuizamento do processo de origem
                                if dados_basicos_origem.data_ajuizamento:
                                    data_aj = dados_basicos_origem.data_ajuizamento.strftime("%d/%m/%Y")
                                    yield self._emit_info(f"  • Data de ajuizamento (origem): {data_aj}")

                                # Log dos documentos encontrados
                                if docs_origem_para_baixar.sentencas:
                                    ids_sent = str(docs_origem_para_baixar.sentencas)
                                    yield self._emit_info(f"  • {len(docs_origem_para_baixar.sentencas)} sentença(s)")
                                    yield self._emit_info(f"    IDs: {ids_sent}")

                                if docs_origem_para_baixar.acordaos:
                                    ids_acord = str(docs_origem_para_baixar.acordaos)
                                    yield self._emit_info(f"  • {len(docs_origem_para_baixar.acordaos)} acórdão(s)")
                                    yield self._emit_info(f"    IDs: {ids_acord}")

                                # Certidão de citação
                                cert_citacao_origem = next((c for c in docs_origem_para_baixar.certidoes_citacao_intimacao if c.tipo.value == "citacao"), None)
                                if cert_citacao_origem:
                                    data_cit = cert_citacao_origem.data_recebimento.strftime("%d/%m/%Y") if cert_citacao_origem.data_recebimento else "N/A"
                                    yield self._emit_info(f"  • Citação: {data_cit}")

                                # Trânsito em julgado
                                if movimentos_origem and movimentos_origem.transito_julgado:
                                    data_transito = movimentos_origem.transito_julgado.strftime("%d/%m/%Y")
                                    yield self._emit_info(f"  • Trânsito em julgado: {data_transito}")

                                break

                        except Exception as e:
                            traceback.print_exc()
                            yield self._emit_error(f"Erro ao consultar {processo_atual}: {str(e)}")
                            break

                    if not encontrou_conhecimento:
                        yield self._emit_error("Não foi possível encontrar o processo de conhecimento original")
                        docs_origem_para_baixar = None
                else:
                    yield self._emit_error("Processo de origem não identificado - continuando apenas com documentos do cumprimento")

            # ============================================================
            # ETAPA 2: DOWNLOAD E EXTRAÇÃO DE TEXTO DOS DOCUMENTOS
            # ============================================================
            yield self._emit_agent_status(2, "ativo", "Iniciando download de documento(s) do TJ-MS...")

            textos = {}

            # 2.1: Baixa documentos do CUMPRIMENTO (certidão intimação, pedido cumprimento)
            if qtd_certidoes > 0 or qtd_cumprimento > 0:
                yield self._emit_info("Baixando documentos do processo de cumprimento...")

                try:
                    textos_cumprimento, erro = await self.service.baixar_documentos(
                        agente1_result.dados_basicos.numero_processo,
                        agente1_result.documentos_para_download
                    )

                    if erro:
                        if '502' in str(erro) or 'Proxy' in str(erro):
                            yield self._emit_error("Erro de conexão com o TJ-MS (502). Tente novamente em alguns minutos.")
                            return
                        yield self._emit_error(f"Erro no download (cumprimento): {erro}")
                    else:
                        textos.update(textos_cumprimento)
                        yield self._emit_info(f"  • {len(textos_cumprimento)} documento(s) do cumprimento")
                except Exception as e_dl:
                    erro_str = str(e_dl)
                    if '502' in erro_str or 'Proxy' in erro_str:
                        yield self._emit_error("Erro de conexão com o TJ-MS (502). O servidor pode estar temporariamente indisponível. Tente novamente em alguns minutos.")
                    else:
                        yield self._emit_error(f"Erro ao baixar documentos do cumprimento: {erro_str}")
                    return

            # 2.2: Baixa documentos do PROCESSO DE ORIGEM (sentenças, acórdãos, citação)
            # IMPORTANTE: NÃO baixar pedido_cumprimento da origem (tem planilha antiga!)
            if docs_origem_para_baixar and docs.numero_processo_origem:
                yield self._emit_info(f"Baixando documentos do processo de origem ({docs.numero_processo_origem})...")

                # Debug detalhado: mostra EXATAMENTE o que será baixado da origem
                qtd_sent_origem = len(docs_origem_para_baixar.sentencas)
                ids_sent_origem = str(docs_origem_para_baixar.sentencas)
                qtd_acord_origem = len(docs_origem_para_baixar.acordaos)
                ids_acord_origem = str(docs_origem_para_baixar.acordaos)

                yield self._emit_info(f"  [DEBUG] Sentenças da origem: {qtd_sent_origem} - IDs: {ids_sent_origem}")
                yield self._emit_info(f"  [DEBUG] Acórdãos da origem: {qtd_acord_origem} - IDs: {ids_acord_origem}")

                # Limpa pedido_cumprimento da origem para não baixar planilha antiga
                docs_origem_para_baixar.pedido_cumprimento = None

                # Filtra certidões: apenas CITAÇÃO da origem, não intimação para cumprimento
                # (intimação para cumprimento da origem é do cumprimento antigo, não queremos)
                docs_origem_para_baixar.certidoes_citacao_intimacao = [
                    c for c in docs_origem_para_baixar.certidoes_citacao_intimacao
                    if c.tipo.value == "citacao"
                ]

                qtd_cert_origem = len(docs_origem_para_baixar.certidoes_citacao_intimacao)
                yield self._emit_info(f"  [DEBUG] Certidões citação origem: {qtd_cert_origem}")

                # Download usando o número do processo de ORIGEM (não do cumprimento!)
                yield self._emit_info(f"  [DEBUG] Chamando baixar_documentos com processo: {docs.numero_processo_origem}")

                try:
                    textos_origem, erro = await self.service.baixar_documentos(
                        docs.numero_processo_origem,
                        docs_origem_para_baixar
                    )

                    if erro:
                        if '502' in str(erro) or 'Proxy' in str(erro):
                            yield self._emit_error("Erro de conexão com o TJ-MS (502). Tente novamente em alguns minutos.")
                            return
                        yield self._emit_error(f"Erro no download (origem): {erro}")
                except Exception as e_origem:
                    erro_str = str(e_origem)
                    if '502' in erro_str or 'Proxy' in erro_str:
                        yield self._emit_error("Erro de conexão com o TJ-MS (502). O servidor pode estar temporariamente indisponível. Tente novamente em alguns minutos.")
                    else:
                        yield self._emit_error(f"Erro ao baixar documentos da origem: {erro_str}")
                    return

                if not erro:
                    # Debug: mostra o que foi baixado
                    chaves_origem = list(textos_origem.keys())
                    yield self._emit_info(f"  [DEBUG] Documentos baixados da origem: {chaves_origem}")

                    textos.update(textos_origem)
                    yield self._emit_info(f"  • {len(textos_origem)} documento(s) do processo de origem baixado(s)")

                    # Adiciona informações da origem aos dados do agente1 para uso posterior
                    # Isso permite que o Agente 2 e 3 tenham acesso às datas corretas
                    # IMPORTANTE: Em cumprimentos autônomos, as datas processuais são do processo de ORIGEM
                    if movimentos_origem:
                        if movimentos_origem.transito_julgado:
                            agente1_result.movimentos_relevantes.transito_julgado = movimentos_origem.transito_julgado
                        if movimentos_origem.citacao_expedida:
                            agente1_result.movimentos_relevantes.citacao_expedida = movimentos_origem.citacao_expedida

                    # Atualiza data de ajuizamento do processo de ORIGEM
                    if dados_basicos_origem and dados_basicos_origem.data_ajuizamento:
                        agente1_result.dados_basicos.data_ajuizamento = dados_basicos_origem.data_ajuizamento
                        data_aj_str = dados_basicos_origem.data_ajuizamento.strftime("%d/%m/%Y")
                        yield self._emit_info(f"  Data de ajuizamento atualizada para: {data_aj_str}")

                    # Guarda referência aos dados do processo de origem
                    agente1_result.dados_processo_origem = {
                        "numero_processo": docs.numero_processo_origem,
                        "data_ajuizamento": dados_basicos_origem.data_ajuizamento.strftime("%d/%m/%Y") if dados_basicos_origem and dados_basicos_origem.data_ajuizamento else None,
                        "data_transito_julgado": movimentos_origem.transito_julgado.strftime("%d/%m/%Y") if movimentos_origem and movimentos_origem.transito_julgado else None,
                    }

                    # Adiciona certidão de citação da origem para extração de data
                    cert_citacao_origem = next((c for c in docs_origem_para_baixar.certidoes_citacao_intimacao if c.tipo.value == "citacao"), None)
                    if cert_citacao_origem:
                        agente1_result.documentos_para_download.certidoes_citacao_intimacao.append(cert_citacao_origem)

            if not textos:
                yield self._emit_error("Nenhum documento foi baixado com sucesso")
                return

            # Estatísticas de extração
            total_chars = sum(len(t) for t in textos.values())
            yield self._emit_info(f"Texto extraído: {total_chars:,} caracteres de {len(textos)} documento(s)")

            for tipo_doc, texto in textos.items():
                nome_doc = tipo_doc.replace("_", " ").title()
                yield self._emit_info(f"  • {nome_doc}: {len(texto):,} caracteres")

            yield self._emit_agent_status(2, "concluido", f"Download concluído - {len(textos)} documento(s) processado(s)")

            # ============================================================
            # ETAPA 2.5: ANÁLISE DE CERTIDÕES COM IA (SEMPRE)
            # ============================================================
            # A IA SEMPRE analisa as certidões para extrair a data real de intimação
            # lendo o conteúdo do documento (não apenas metadados do XML)
            if docs.certidoes_candidatas:
                qtd_candidatas = len(docs.certidoes_candidatas)
                yield self._emit_info(f"Analisando {qtd_candidatas} certidão(ões) com IA para extrair data de intimação...")

                # Baixa e extrai texto das certidões candidatas
                ids_candidatas = [c.id_documento for c in docs.certidoes_candidatas]

                yield self._emit_info("Baixando certidões para análise...")

                try:
                    async with DocumentDownloader() as downloader_cert:
                        textos_candidatas = await downloader_cert.baixar_e_extrair_textos(
                            agente1_result.dados_basicos.numero_processo,
                            ids_candidatas
                        )
                except Exception as e_cert:
                    erro_str = str(e_cert)
                    if '502' in erro_str or 'Proxy' in erro_str:
                        yield self._emit_error("Erro de conexão com o TJ-MS (502). O servidor pode estar temporariamente indisponível. Tente novamente em alguns minutos.")
                    else:
                        yield self._emit_error(f"Erro ao baixar certidões: {erro_str}")
                    return

                if textos_candidatas:
                    yield self._emit_info(f"Texto extraído de {len(textos_candidatas)} certidão(ões), analisando com IA...")

                    # Prepara dict para análise: id -> (texto, tipo_documento)
                    certidoes_para_analise = {}
                    for cert in docs.certidoes_candidatas:
                        if cert.id_documento in textos_candidatas:
                            certidoes_para_analise[cert.id_documento] = (
                                textos_candidatas[cert.id_documento],
                                cert.tipo_documento
                            )

                    # Análise paralela com IA (passa o logger para debug)
                    from .agentes import AnalisadorCertidoesCumprimento
                    analisador = AnalisadorCertidoesCumprimento(logger=self.ia_logger)
                    resultados_analise = await analisador.analisar_certidoes_paralelo(certidoes_para_analise)

                    # Identifica a certidão correta
                    certidao_encontrada = analisador.identificar_certidao_cumprimento(resultados_analise)

                    if certidao_encontrada:
                        # Busca data do documento da certidão candidata
                        data_doc = None
                        for cert in docs.certidoes_candidatas:
                            if cert.id_documento == certidao_encontrada.get("id_certidao"):
                                data_doc = cert.data_documento
                                break

                        # Cria objeto CertidaoCitacaoIntimacao com dados da IA
                        cert_cumprimento = analisador.criar_certidao_intimacao(certidao_encontrada, data_doc)

                        # Adiciona à lista de certidões (substitui qualquer sugestão da heurística)
                        # Remove certidões de intimação_impugnacao anteriores (da heurística)
                        docs.certidoes_citacao_intimacao = [
                            c for c in docs.certidoes_citacao_intimacao
                            if c.tipo.value != "intimacao_impugnacao"
                        ]
                        docs.certidoes_citacao_intimacao.append(cert_cumprimento)

                        # Log detalhado
                        data_receb = cert_cumprimento.data_recebimento.strftime("%d/%m/%Y") if cert_cumprimento.data_recebimento else "N/A"
                        termo_ini = cert_cumprimento.termo_inicial_prazo.strftime("%d/%m/%Y") if cert_cumprimento.termo_inicial_prazo else "N/A"
                        tipo_cert = "Sistema" if cert_cumprimento.tipo_certidao == "sistema" else "Cartório (decurso)"
                        confianca = certidao_encontrada.get("confianca", "N/A")

                        yield self._emit_info(f"Certidão de INTIMAÇÃO P/ CUMPRIMENTO identificada pela IA (confiança: {confianca})")
                        yield self._emit_info(f"  - Tipo: Cert. {tipo_cert}")
                        yield self._emit_info(f"  - Data intimação (lida do documento): {data_receb}")
                        yield self._emit_info(f"  - TERMO INICIAL (art. 224 CPC): {termo_ini}")
                    else:
                        # IA não encontrou - usa fallback da heurística se disponível
                        if docs.certidao_heuristica:
                            docs.certidoes_citacao_intimacao.append(docs.certidao_heuristica)
                            data_receb = docs.certidao_heuristica.data_recebimento.strftime("%d/%m/%Y") if docs.certidao_heuristica.data_recebimento else "N/A"
                            termo_ini = docs.certidao_heuristica.termo_inicial_prazo.strftime("%d/%m/%Y") if docs.certidao_heuristica.termo_inicial_prazo else "N/A"
                            yield self._emit_info("IA não identificou certidão - usando fallback da heurística")
                            yield self._emit_info(f"  - TERMO INICIAL (heurística): {termo_ini}")
                        else:
                            yield self._emit_info("IA não conseguiu identificar certidão de intimação p/ cumprimento")
                else:
                    # Não conseguiu baixar - usa heurística como fallback
                    yield self._emit_info("Não foi possível extrair texto das certidões")
                    if docs.certidao_heuristica:
                        docs.certidoes_citacao_intimacao.append(docs.certidao_heuristica)
                        yield self._emit_info("Usando dados da heurística como fallback")
            else:
                # Sem candidatas - usa heurística se disponível
                if docs.certidao_heuristica:
                    docs.certidoes_citacao_intimacao.append(docs.certidao_heuristica)
                    data_receb = docs.certidao_heuristica.data_recebimento.strftime("%d/%m/%Y") if docs.certidao_heuristica.data_recebimento else "N/A"
                    termo_ini = docs.certidao_heuristica.termo_inicial_prazo.strftime("%d/%m/%Y") if docs.certidao_heuristica.termo_inicial_prazo else "N/A"
                    yield self._emit_info("Nenhuma certidão candidata para IA - usando heurística")
                    yield self._emit_info(f"  - TERMO INICIAL (heurística): {termo_ini}")
                else:
                    yield self._emit_info("Certidão de intimação p/ cumprimento não identificada")

            # ============================================================
            # ETAPA 3: EXTRAÇÃO INTELIGENTE COM IA (AGENTE 2)
            # ============================================================
            yield self._emit_agent_status(3, "ativo", "Iniciando análise inteligente dos documentos com IA...")

            yield self._emit_info("Analisando sentença/acórdão para identificar objeto da condenação...")
            yield self._emit_info("Extraindo critérios de correção monetária e juros moratórios...")
            yield self._emit_info("Identificando período da condenação e datas processuais...")
            yield self._emit_info("Verificando certidões para datas de citação e intimação...")

            agente2_result, erro = await self.service.extrair_informacoes(textos)

            if erro:
                yield self._emit_error(f"Erro na extração de informações: {erro}")
                return

            # Resumo das informações extraídas
            ext = agente2_result
            if ext.objeto_condenacao:
                obj_resumo = ext.objeto_condenacao[:100] + "..." if len(ext.objeto_condenacao) > 100 else ext.objeto_condenacao
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
                # DESTAQUE: Data de intimação para cumprimento/impugnação (TERMO INICIAL)
                if ext.datas.intimacao_impugnacao_recebimento:
                    data_intim = ext.datas.intimacao_impugnacao_recebimento.strftime("%d/%m/%Y")
                    yield self._emit_info(f"TERMO INICIAL DO PRAZO: {data_intim} (intimacao p/ cumprimento)")
                else:
                    yield self._emit_info("Data de intimacao p/ cumprimento NAO encontrada nos documentos")

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
                    yield self._sse.format("geracao_chunk", {"content": event["content"]})
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
            # Coleta todos os IDs de documentos baixados
            numero_cumprimento = agente1_result.dados_basicos.numero_processo
            documentos_baixados = self._coletar_documentos_baixados(
                docs, docs_origem_para_baixar, textos, numero_cumprimento
            )

            # Salva no histórico
            geracao_id, msg_historico = self._salvar_historico_sync(
                agente1_result,
                agente2_result,
                markdown,
                documentos_baixados,
                tempo_processamento,
            )
            yield self._emit_info(msg_historico)

            # Resultado final com documentos baixados e ID do histórico
            yield self._sse.format("sucesso", {
                "geracao_id": geracao_id,
                "dados_basicos": agente1_result.dados_basicos.to_dict(),
                "dados_extracao": agente2_result.to_dict(),
                "pedido_markdown": markdown,
                "documentos_baixados": documentos_baixados,
            })

        except Exception as e:
            traceback.print_exc()
            yield self._emit_error(f"Erro inesperado no processamento: {str(e)}")

    # ============================================================
    # Métodos auxiliares de SSE
    # ============================================================

    def _emit_event(self, tipo: str, mensagem: str) -> str:
        """Emite evento genérico via SSEEventFormatter."""
        return self._sse.format(tipo, {"mensagem": mensagem})

    def _emit_agent_status(self, agente: int, status: str, mensagem: str) -> str:
        """Emite status de agente via SSEEventFormatter."""
        return self._sse.agent_status(agente, status, mensagem)

    def _emit_info(self, mensagem: str) -> str:
        """Emite mensagem informativa via SSEEventFormatter."""
        return self._sse.info(mensagem)

    def _emit_error(self, mensagem: str) -> str:
        """
        Emite mensagem de erro via SSEEventFormatter.

        Nota: Usa format() direto para manter compatibilidade com o formato
        original do router (sem campo 'code' adicional).
        """
        return self._sse.format("erro", {"mensagem": mensagem})

    # ============================================================
    # Coleta de documentos baixados para o histórico
    # ============================================================

    def _coletar_documentos_baixados(
        self,
        docs,
        docs_origem_para_baixar,
        textos: dict,
        numero_cumprimento: str,
    ) -> list:
        """
        Coleta todos os IDs de documentos baixados para salvar no histórico.

        Args:
            docs: DocumentosParaDownload do processo principal
            docs_origem_para_baixar: DocumentosParaDownload do processo de origem (se houver)
            textos: Dict de textos extraídos (contém metadados de classificação IA)
            numero_cumprimento: Número do processo principal (cumprimento)

        Returns:
            Lista de dicts com informações dos documentos baixados
        """
        documentos_baixados = []

        # Número do processo de origem (se cumprimento autônomo)
        numero_origem = docs.numero_processo_origem

        # 1. Documentos do PROCESSO PRINCIPAL
        # Sentenças
        for id_doc in docs.sentencas:
            documentos_baixados.append({
                "id": id_doc,
                "tipo": "Sentença",
                "processo": "principal",
                "numero_processo": numero_cumprimento
            })

        # Acórdãos
        for id_doc in docs.acordaos:
            documentos_baixados.append({
                "id": id_doc,
                "tipo": "Acórdão",
                "processo": "principal",
                "numero_processo": numero_cumprimento
            })

        # Certidões (citação e intimação)
        for cert in docs.certidoes_citacao_intimacao:
            if cert.id_certidao_9508:
                documentos_baixados.append({
                    "id": cert.id_certidao_9508,
                    "tipo": f"Certidão ({cert.tipo.value})",
                    "processo": "principal",
                    "numero_processo": numero_cumprimento
                })

        # Certidão de trânsito em julgado
        if docs.certidao_transito:
            documentos_baixados.append({
                "id": docs.certidao_transito,
                "tipo": "Certidão de Trânsito em Julgado",
                "processo": "principal",
                "numero_processo": numero_cumprimento
            })

        # Pedido de cumprimento e planilha de cálculo
        # IMPORTANTE: Usa metadados da IA para classificar corretamente os documentos
        # Só mostra os documentos que foram efetivamente selecionados pela IA
        if docs.pedido_cumprimento and "documentos" in docs.pedido_cumprimento:
            # Obtém IDs dos documentos selecionados pela IA
            planilha_id = textos.get("_planilha_id")
            peticao_id = textos.get("_peticao_id")
            planilha_info = textos.get("_planilha_info", {})

            # Log para debug
            print(f"[DOCUMENTOS] Planilha ID selecionada: {planilha_id}")
            print(f"[DOCUMENTOS] Petição ID selecionada: {peticao_id}")

            for doc in docs.pedido_cumprimento["documentos"]:
                doc_id = doc.get("id", "")
                descricao = doc.get("descricao", "Documento")

                # Só inclui documentos que foram selecionados pela IA
                if doc_id == planilha_id:
                    # Este é o documento identificado como planilha de cálculo
                    tipo_display = "Planilha de Cálculo"
                    if planilha_info.get("valor_total"):
                        tipo_display += f" ({planilha_info['valor_total']})"

                    documentos_baixados.append({
                        "id": doc_id,
                        "tipo": tipo_display,
                        "descricao": descricao,
                        "processo": "principal",
                        "numero_processo": numero_cumprimento,
                        "classificacao_ia": "planilha_calculo",
                        "confianca_ia": planilha_info.get("confianca")
                    })

                elif doc_id == peticao_id:
                    # Este é o documento identificado como petição de cumprimento
                    documentos_baixados.append({
                        "id": doc_id,
                        "tipo": "Petição de Cumprimento",
                        "descricao": descricao,
                        "processo": "principal",
                        "numero_processo": numero_cumprimento,
                        "classificacao_ia": "peticao"
                    })

                elif not planilha_id and not peticao_id:
                    # Fallback: se IA não classificou nada, usa lógica antiga
                    tipo_doc = doc.get("tipo", "")
                    descr_lower = descricao.lower() if descricao else ""

                    if tipo_doc in ["9500", "9501"]:
                        tipo_display = "Petição de Cumprimento"
                    elif tipo_doc in ["9553", "61", "9535"] or any(t in descr_lower for t in ['planilha', 'cálculo', 'calculo']):
                        tipo_display = "Planilha de Cálculo"
                    else:
                        tipo_display = descricao

                    documentos_baixados.append({
                        "id": doc_id,
                        "tipo": tipo_display,
                        "descricao": descricao,
                        "processo": "principal",
                        "numero_processo": numero_cumprimento
                    })

        # 2. Documentos do PROCESSO DE ORIGEM (se cumprimento autônomo)
        if docs_origem_para_baixar and numero_origem:
            # Sentenças da origem
            for id_doc in docs_origem_para_baixar.sentencas:
                documentos_baixados.append({
                    "id": id_doc,
                    "tipo": "Sentença",
                    "processo": "origem",
                    "numero_processo": numero_origem
                })

            # Acórdãos da origem
            for id_doc in docs_origem_para_baixar.acordaos:
                documentos_baixados.append({
                    "id": id_doc,
                    "tipo": "Acórdão",
                    "processo": "origem",
                    "numero_processo": numero_origem
                })

            # Certidão de citação da origem
            for cert in docs_origem_para_baixar.certidoes_citacao_intimacao:
                if cert.id_certidao_9508 and cert.tipo.value == "citacao":
                    documentos_baixados.append({
                        "id": cert.id_certidao_9508,
                        "tipo": "Certidão (citação)",
                        "processo": "origem",
                        "numero_processo": numero_origem
                    })

            # Certidão de trânsito em julgado da origem
            if docs_origem_para_baixar.certidao_transito:
                documentos_baixados.append({
                    "id": docs_origem_para_baixar.certidao_transito,
                    "tipo": "Certidão de Trânsito em Julgado",
                    "processo": "origem",
                    "numero_processo": numero_origem
                })

        return documentos_baixados

    # ============================================================
    # Salvamento no histórico
    # ============================================================

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
                geracao_existente.criado_em = datetime.utcnow()  # Atualiza timestamp

                self.db.commit()
                geracao_id = geracao_existente.id

                # Salva logs de IA vinculados a esta geração
                self.ia_logger.set_geracao_id(geracao_id)
                self.ia_logger.salvar_logs(self.db)

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
            traceback.print_exc()
            return None, "Aviso: Não foi possível salvar no histórico"
