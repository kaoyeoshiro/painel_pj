# sistemas/prestacao_contas/services.py
"""
Orquestrador do Pipeline de Análise de Prestação de Contas

Coordena as 5 etapas do pipeline:
1. Extração do extrato da subconta (Playwright scrapper)
2. Consulta XML do processo (SOAP TJ-MS)
3. Identificação da petição de prestação de contas
4. Download de documentos anexos
5. Análise por IA

Autor: LAB/PGE-MS
"""

import asyncio
import logging
import os
import aiohttp
from datetime import datetime, timedelta
from typing import Optional, AsyncGenerator, Dict, Any, List

from sqlalchemy.orm import Session

from sistemas.prestacao_contas.models import GeracaoAnalise, FeedbackPrestacao
from sistemas.prestacao_contas.schemas import EventoSSE, ResultadoAnalise as ResultadoAnaliseSchema
from sistemas.prestacao_contas.scrapper_subconta import extrair_extrato_subconta, StatusProcessamento
from sistemas.prestacao_contas.xml_parser import (
    XMLParserPrestacao,
    parse_xml_processo,
    DocumentoProcesso,
    CODIGOS_NOTA_FISCAL,
    CODIGOS_DOCUMENTOS_ANEXOS,
)
from sistemas.prestacao_contas.extrato_paralelo import (
    ExtratorParalelo,
    ConfigExtratoParalelo,
    ExtratoSource,
    ResultadoExtratoParalelo,
    is_valid_extrato,
)
from sistemas.prestacao_contas.identificador_peticoes import (
    IdentificadorPeticoes,
    TipoDocumento,
    ResultadoIdentificacao,
)
from sistemas.prestacao_contas.agente_analise import AgenteAnalise, DadosAnalise, ResultadoAnalise
from sistemas.prestacao_contas.ia_logger import IALogger, create_logger
from sistemas.prestacao_contas.services_stream import (
    evento_inicio,
    evento_etapa,
    evento_progresso,
    evento_info,
    evento_aviso,
    evento_erro,
    evento_resultado,
    evento_solicitar_documentos,
    evento_erro_com_fim,
)

# Cliente TJMS unificado (funcoes de compatibilidade)
from services.tjms import (
    consultar_processo_async,
    baixar_documentos_async,
    extrair_texto_pdf,
)

logger = logging.getLogger(__name__)


# =====================================================
# FUNÇÕES DE LOG FORMATADO
# =====================================================

def log_etapa(etapa: int, nome: str):
    """Log de início de etapa"""
    logger.info(f"\n{'='*60}")
    logger.info(f"📌 ETAPA {etapa}: {nome}")
    logger.info(f"{'='*60}")

def log_info(msg: str):
    """Log informativo"""
    logger.info(f"   ℹ️  {msg}")

def log_sucesso(msg: str):
    """Log de sucesso"""
    logger.info(f"   ✅ {msg}")

def log_aviso(msg: str):
    """Log de aviso"""
    logger.warning(f"   ⚠️  {msg}")

def log_erro(msg: str):
    """Log de erro"""
    logger.error(f"   ❌ {msg}")

def log_ia(msg: str):
    """Log específico de IA"""
    logger.info(f"   🤖 {msg}")


# =====================================================
# HELPER: DEFINIR ESTADO AGUARDANDO DOCUMENTOS
# =====================================================

ESTADO_EXPIRACAO_HORAS = 24  # Tempo de expiração do estado salvo

def definir_aguardando_documentos(
    geracao: GeracaoAnalise,
    documentos_faltantes: List[str],
    mensagem_usuario: str,
    documentos_ja_baixados: Optional[List[Dict]] = None,
):
    """
    Define o estado de aguardando documentos com todos os dados necessários.

    Args:
        geracao: Objeto GeracaoAnalise a ser atualizado
        documentos_faltantes: Lista de documentos faltantes ['extrato_subconta', 'notas_fiscais']
        mensagem_usuario: Mensagem amigável para exibir ao usuário
        documentos_ja_baixados: Documentos já baixados para salvar (extratos, anexos, etc.)
    """
    geracao.status = "aguardando_documentos"
    geracao.documentos_faltantes = documentos_faltantes
    geracao.mensagem_erro_usuario = mensagem_usuario
    geracao.estado_expira_em = datetime.utcnow() + timedelta(hours=ESTADO_EXPIRACAO_HORAS)

    # Salva documentos já baixados para não perder
    if documentos_ja_baixados:
        geracao.documentos_anexos = documentos_ja_baixados

    log_info(f"Estado salvo: aguardando {documentos_faltantes}, expira em {ESTADO_EXPIRACAO_HORAS}h")


def definir_aguardando_nota_fiscal(
    geracao: GeracaoAnalise,
    mensagem_usuario: str,
    documentos_ja_baixados: Optional[List[Dict]] = None,
):
    """
    Define o estado de aguardando nota fiscal especificamente.

    Args:
        geracao: Objeto GeracaoAnalise a ser atualizado
        mensagem_usuario: Mensagem amigável para exibir ao usuário
        documentos_ja_baixados: Documentos já baixados para salvar
    """
    geracao.status = "aguardando_nota_fiscal"
    geracao.documentos_faltantes = ["notas_fiscais"]
    geracao.mensagem_erro_usuario = mensagem_usuario
    geracao.estado_expira_em = datetime.utcnow() + timedelta(hours=ESTADO_EXPIRACAO_HORAS)

    # Salva documentos já baixados para não perder
    if documentos_ja_baixados:
        geracao.documentos_anexos = documentos_ja_baixados

    log_info(f"Estado salvo: aguardando nota fiscal, expira em {ESTADO_EXPIRACAO_HORAS}h")


def verificar_estado_expirado(geracao: GeracaoAnalise) -> bool:
    """
    Verifica se o estado salvo expirou.

    Returns:
        True se expirou ou não tem data de expiração
    """
    if not geracao.estado_expira_em:
        return True
    return datetime.utcnow() > geracao.estado_expira_em


def converter_pdf_para_imagens(pdf_bytes: bytes, max_paginas: int = 10) -> List[str]:
    """
    Converte páginas de um PDF em imagens base64.

    Args:
        pdf_bytes: Bytes do PDF
        max_paginas: Máximo de páginas a converter

    Returns:
        Lista de imagens em base64 (formato data:image/jpeg;base64,...)
    """
    import base64
    import fitz  # PyMuPDF

    imagens = []
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            num_paginas = min(len(doc), max_paginas)

            for i in range(num_paginas):
                page = doc[i]
                # Renderiza página como imagem (zoom 2x para melhor qualidade)
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat)

                # Converte para JPEG base64
                img_bytes = pix.tobytes("jpeg", 85)
                img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                imagens.append(f"data:image/jpeg;base64,{img_base64}")

    except Exception as e:
        logger.error(f"Erro ao converter PDF para imagens: {e}")

    return imagens


# =====================================================
# CONFIGURAÇÕES
# =====================================================

def _get_config(db: Session, chave: str, default: str) -> str:
    """Obtém configuração do banco de dados"""
    try:
        from admin.models import ConfiguracaoIA
        config = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "prestacao_contas",
            ConfiguracaoIA.chave == chave
        ).first()
        return config.valor if config else default
    except:
        return default


def _get_config_float(db: Session, chave: str, default: float) -> float:
    """Obtém configuração numérica do banco de dados"""
    valor = _get_config(db, chave, str(default))
    try:
        return float(valor)
    except:
        return default


# =====================================================
# ORQUESTRADOR PRINCIPAL
# =====================================================

class OrquestradorPrestacaoContas:
    """
    Orquestra o pipeline completo de análise de prestação de contas.
    """

    def __init__(self, db: Session, usuario_id: Optional[int] = None):
        self.db = db
        self.usuario_id = usuario_id
        self.ia_logger = create_logger()

        # Configurações
        self.modelo_identificacao = _get_config(db, "modelo_identificacao", "gemini-2.0-flash-lite")
        self.modelo_analise = _get_config(db, "modelo_analise", "gemini-3-flash-preview")
        self.temperatura_identificacao = _get_config_float(db, "temperatura_identificacao", 0.1)
        self.temperatura_analise = _get_config_float(db, "temperatura_analise", 0.3)

    async def processar_completo(
        self,
        numero_cnj: str,
        sobrescrever: bool = False,
        documentos_manuais: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[EventoSSE, None]:
        """
        Executa o pipeline completo com streaming de eventos.

        Args:
            numero_cnj: Número CNJ do processo
            sobrescrever: Se True, refaz análise mesmo se já existir
            documentos_manuais: Dict com documentos pré-anexados (para reprocessamento após expiração)
                - extrato_pdf_bytes: bytes do PDF do extrato
                - notas_fiscais: List[{bytes, filename}] das notas fiscais

        Yields:
            EventoSSE com progresso do processamento
        """
        inicio = datetime.utcnow()

        # Normaliza o número CNJ (remove formatação para consistência)
        numero_cnj_limpo = numero_cnj.replace(".", "").replace("-", "").replace("/", "").strip()

        # Se sobrescrever, deleta registros anteriores do mesmo processo
        if sobrescrever:
            registros_antigos = self.db.query(GeracaoAnalise).filter(
                GeracaoAnalise.numero_cnj == numero_cnj_limpo,
                GeracaoAnalise.usuario_id == self.usuario_id
            ).all()
            for registro in registros_antigos:
                # Deleta feedbacks associados
                self.db.query(FeedbackPrestacao).filter(
                    FeedbackPrestacao.geracao_id == registro.id
                ).delete()
                self.db.delete(registro)
            self.db.commit()
            log_info(f"Deletados {len(registros_antigos)} registros anteriores do processo")

        # Cria registro de geração
        geracao = GeracaoAnalise(
            numero_cnj=numero_cnj_limpo,
            usuario_id=self.usuario_id,
            status="processando",
        )
        self.db.add(geracao)
        self.db.commit()
        self.db.refresh(geracao)

        # Se há documentos manuais (reprocessamento após expiração), processa-os primeiro
        documentos_manuais_processados = []
        if documentos_manuais:
            import base64
            log_info("Processando documentos manuais pré-anexados...")

            # Processa extrato manual
            if documentos_manuais.get("extrato_pdf_bytes"):
                pdf_bytes = documentos_manuais["extrato_pdf_bytes"]
                texto_extrato = extrair_texto_pdf(pdf_bytes)

                if len(texto_extrato) < 500:
                    imagens = converter_pdf_para_imagens(pdf_bytes)
                    documentos_manuais_processados.append({
                        "id": "extrato_manual",
                        "tipo": "Extrato da Subconta (enviado manualmente)",
                        "imagens": imagens
                    })
                    geracao.extrato_subconta_texto = f"[EXTRATO ENVIADO MANUALMENTE - {len(imagens)} páginas como imagem]"
                else:
                    geracao.extrato_subconta_texto = f"## EXTRATO DA SUBCONTA (ENVIADO MANUALMENTE)\n\n{texto_extrato}"

                geracao.extrato_subconta_pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                log_sucesso(f"Extrato manual processado ({len(texto_extrato)} chars)")

            # Processa notas fiscais manuais
            if documentos_manuais.get("notas_fiscais"):
                for i, nota_data in enumerate(documentos_manuais["notas_fiscais"]):
                    pdf_bytes = nota_data["bytes"]
                    filename = nota_data.get("filename", f"nota_{i+1}.pdf")
                    imagens = converter_pdf_para_imagens(pdf_bytes)
                    if imagens:
                        documentos_manuais_processados.append({
                            "id": f"nota_manual_{i+1}",
                            "tipo": f"Nota Fiscal (enviada manualmente) - {filename}",
                            "imagens": imagens
                        })
                log_sucesso(f"{len(documentos_manuais['notas_fiscais'])} notas fiscais manuais processadas")

            if documentos_manuais_processados:
                geracao.documentos_anexos = documentos_manuais_processados
                self.db.commit()

        try:
            logger.info(f"\n{'#'*60}")
            logger.info(f"# PRESTAÇÃO DE CONTAS - {numero_cnj}")
            logger.info(f"{'#'*60}")
            yield evento_inicio("Iniciando análise de prestação de contas")

            # Gera correlation_id para rastrear métricas
            import uuid
            correlation_id = str(uuid.uuid4())[:8]
            logger.info(f"[{correlation_id}] Iniciando pipeline paralelo")

            # =====================================================
            # ETAPAS 1+2 PARALELAS: XML + EXTRATO
            # =====================================================
            # Executa em paralelo:
            # - Task C: Consulta XML do processo (necessário para fallback e demais etapas)
            # - Task A+B: Extração paralela de extrato (scrapper + fallback)
            log_etapa(1, "CONSULTA XML + EXTRATO (PARALELO)")
            yield evento_etapa(
                etapa=1,
                etapa_nome="XML + Extrato (Paralelo)",
                mensagem="Consultando processo e baixando extrato em paralelo...",
                progresso=10,
            )

            # TASK C: Consulta XML do processo
            async def task_c_xml():
                """Task C: Consulta XML do processo."""
                async with aiohttp.ClientSession() as session:
                    return await consultar_processo_async(session, numero_cnj)

            # Executa XML primeiro (necessário para o fallback)
            xml_response = await task_c_xml()
            resultado_xml = parse_xml_processo(xml_response)

            if resultado_xml.erro:
                log_erro(f"Erro ao consultar processo: {resultado_xml.erro}")
                geracao.status = "erro"
                geracao.erro = resultado_xml.erro
                self.db.commit()

                evt_erro, evt_fim = evento_erro_com_fim(
                    f"Erro ao consultar processo: {resultado_xml.erro}", etapa=1
                )
                yield evt_erro
                yield evt_fim
                return

            geracao.numero_cnj_formatado = resultado_xml.dados_basicos.numero_formatado
            geracao.dados_processo_xml = resultado_xml.to_dict()
            log_sucesso(f"Processo encontrado: {resultado_xml.dados_basicos.autor}")
            log_info(f"Total de documentos no processo: {len(resultado_xml.peticoes_candidatas)} petições candidatas")

            yield evento_progresso(
                etapa=1,
                mensagem=f"Processo encontrado: {resultado_xml.dados_basicos.autor}",
                progresso=20,
                dados={"autor": resultado_xml.dados_basicos.autor},
            )

            # DEBUG: Mostra as primeiras 15 petições candidatas
            logger.warning(f"{'='*60}")
            logger.warning(f"PETICOES CANDIDATAS (primeiras 15 de {len(resultado_xml.peticoes_candidatas)}):")
            for i, pet in enumerate(resultado_xml.peticoes_candidatas[:15]):
                logger.warning(f"  {i+1}. ID={pet.id} | Codigo={pet.tipo_codigo} | {pet.tipo_descricao[:50] if pet.tipo_descricao else 'Sem desc'}")
            logger.warning(f"{'='*60}")

            # =====================================================
            # EXTRAÇÃO PARALELA DE EXTRATO (Task A + Task B)
            # =====================================================
            yield evento_etapa(
                etapa=2,
                etapa_nome="Extrato da Subconta (Paralelo)",
                mensagem="Executando scrapper e fallback em paralelo...",
                progresso=25,
            )

            # Carrega configuração de timeouts do banco
            config_extrato = ConfigExtratoParalelo.from_db(self.db)

            # Executa extração paralela (Task A: scrapper + Task B: fallback)
            extrator = ExtratorParalelo(config=config_extrato, correlation_id=correlation_id)
            resultado_extrato = await extrator.extrair_paralelo(
                numero_cnj=numero_cnj,
                documentos=resultado_xml.documentos,
            )

            # Processa resultado da extração paralela
            extratos_imagens_fallback = resultado_extrato.imagens_fallback

            if resultado_extrato.valido:
                geracao.extrato_subconta_texto = resultado_extrato.texto
                geracao.extrato_subconta_pdf_base64 = resultado_extrato.pdf_base64

                # Salva métricas de extração
                geracao.extrato_source = resultado_extrato.source.value
                geracao.extrato_metricas = resultado_extrato.metricas.to_dict()

                log_sucesso(f"Extrato obtido via {resultado_extrato.source.value}")
                log_info(f"  t_scrapper: {resultado_extrato.metricas.t_scrapper:.2f}s" if resultado_extrato.metricas.t_scrapper else "  t_scrapper: N/A")
                log_info(f"  t_fallback: {resultado_extrato.metricas.t_fallback:.2f}s" if resultado_extrato.metricas.t_fallback else "  t_fallback: N/A")
                log_info(f"  t_total: {resultado_extrato.metricas.t_total:.2f}s")

                yield evento_progresso(
                    etapa=2,
                    mensagem=f"Extrato obtido via {resultado_extrato.source.value} ({len(resultado_extrato.texto or '')} chars)",
                    progresso=35,
                    dados={
                        "extrato_source": resultado_extrato.source.value,
                        "t_scrapper": resultado_extrato.metricas.t_scrapper,
                        "t_fallback": resultado_extrato.metricas.t_fallback,
                        "t_total": resultado_extrato.metricas.t_total,
                    },
                )
            else:
                # Extrato não encontrado - NÃO interrompe o pipeline
                geracao.extrato_subconta_texto = None
                geracao.extrato_source = ExtratoSource.NONE.value
                geracao.extrato_metricas = resultado_extrato.metricas.to_dict()
                geracao.extrato_observacao = resultado_extrato.observacao

                log_aviso(f"Extrato não localizado - pipeline continuará sem extrato")
                log_info(f"  Observação: {resultado_extrato.observacao}")

                yield evento_aviso(
                    "Extrato não localizado - análise continuará sem extrato da subconta",
                    etapa=2,
                    dados={
                        "extrato_source": "none",
                        "observacao": resultado_extrato.observacao,
                        "t_scrapper": resultado_extrato.metricas.t_scrapper,
                        "t_fallback": resultado_extrato.metricas.t_fallback,
                        "t_total": resultado_extrato.metricas.t_total,
                    },
                )

            # =====================================================
            # FALLBACK ADICIONAL: BUSCAR ALVARÁS (CÓDIGO 3)
            # =====================================================
            # Só busca alvarás se não encontrou extrato válido
            if not resultado_extrato.valido:
                log_info("Buscando 'Alvará' (código 3) nos últimos 30 documentos...")
                yield evento_info("Buscando Alvarás nos documentos recentes...", etapa=2)

                CODIGO_ALVARA = "3"
                MAX_DOCS_ALVARA = 30

                # Ordena documentos por data (mais recente primeiro) e pega os últimos 30
                docs_ordenados = sorted(
                    resultado_xml.documentos,
                    key=lambda d: d.data_juntada or datetime.min,
                    reverse=True
                )[:MAX_DOCS_ALVARA]

                alvaras = [
                    d for d in docs_ordenados
                    if str(d.tipo_codigo) == CODIGO_ALVARA
                ]

                if alvaras:
                    log_info(f"Encontrados {len(alvaras)} Alvarás nos últimos {MAX_DOCS_ALVARA} documentos")
                    yield evento_info(f"Encontrados {len(alvaras)} Alvarás", etapa=2)

                    async with aiohttp.ClientSession() as session:
                        for i, alvara in enumerate(alvaras):
                            try:
                                yield evento_info(f"Baixando Alvará {i+1}/{len(alvaras)}...", etapa=2)

                                xml_docs = await baixar_documentos_async(session, numero_cnj, [alvara.id])

                                import base64
                                import xml.etree.ElementTree as ET
                                root = ET.fromstring(xml_docs)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)
                                conteudo_bytes = None
                                for elem in root.iter():
                                    if 'conteudo' in elem.tag.lower() and elem.text:
                                        conteudo_bytes = base64.b64decode(elem.text)
                                        break

                                if conteudo_bytes:
                                    data_alvara = alvara.data_juntada.strftime('%d/%m/%Y') if alvara.data_juntada else 'Data desconhecida'

                                    # Converte para imagem (alvarás geralmente são documentos escaneados)
                                    imagens = converter_pdf_para_imagens(conteudo_bytes)
                                    if imagens:
                                        extratos_imagens_fallback.append({
                                            "id": alvara.id,
                                            "tipo": f"Alvará - {data_alvara}",
                                            "imagens": imagens
                                        })
                                        log_sucesso(f"Alvará {alvara.id} convertido para imagem ({len(imagens)} páginas)")

                            except Exception as e:
                                log_erro(f"Erro ao baixar Alvará {alvara.id}: {e}")
                                continue

                    if any(d.get("tipo", "").startswith("Alvará") for d in extratos_imagens_fallback):
                        total_alvaras = sum(1 for d in extratos_imagens_fallback if d.get("tipo", "").startswith("Alvará"))
                        log_sucesso(f"Fallback: {total_alvaras} Alvarás obtidos como imagem")
                        yield evento_progresso(
                            etapa=2,
                            mensagem=f"{total_alvaras} Alvarás obtidos como imagem",
                            progresso=39,
                        )
                else:
                    log_info("Nenhum Alvará encontrado nos últimos 30 documentos")

            # =====================================================
            # ETAPA 3: CLASSIFICAR DOCUMENTOS DO PROCESSO
            # =====================================================
            log_etapa(3, "CLASSIFICAÇÃO DE DOCUMENTOS (LLM)")
            log_ia(f"Modelo: {self.modelo_identificacao} | Temperatura: {self.temperatura_identificacao}")

            # Pega as últimas 10 petições para análise
            MAX_PETICOES = 10
            peticoes_para_analisar = resultado_xml.peticoes_candidatas[:MAX_PETICOES]
            log_info(f"Serão analisadas as últimas {len(peticoes_para_analisar)} petições")

            yield evento_etapa(
                etapa=3,
                etapa_nome="Classificar Documentos",
                mensagem=f"Analisando {len(peticoes_para_analisar)} petições...",
                progresso=40,
            )

            identificador = IdentificadorPeticoes(
                modelo_llm=self.modelo_identificacao,
                temperatura_llm=self.temperatura_identificacao,
                db=self.db
            )

            # Estruturas para armazenar documentos classificados
            documentos_classificados = []  # Lista de {doc, resultado_id, texto, bytes}
            peticao_prestacao = None
            peticao_prestacao_doc = None
            peticoes_relevantes = []  # Petições que irão como texto
            docs_para_baixar_anexos = []  # Documentos que mencionam anexos

            # FASE 1: Baixar documentos sequencialmente
            log_info("Baixando documentos...")
            documentos_baixados = []  # Lista de {doc, bytes, texto}

            # DEBUG: Log dos documentos que serão baixados
            logger.warning(f"DOCUMENTOS A BAIXAR ({len(peticoes_para_analisar)}):")
            for i, p in enumerate(peticoes_para_analisar):
                logger.warning(f"  {i+1}. ID={p.id} | Codigo={p.tipo_codigo} | {p.tipo_descricao[:40] if p.tipo_descricao else 'Sem desc'}")

            async with aiohttp.ClientSession() as session:
                for i, peticao in enumerate(peticoes_para_analisar):
                    yield evento_info(f"Baixando documento {i+1}/{len(peticoes_para_analisar)}...", etapa=3)

                    try:
                        xml_docs = await baixar_documentos_async(session, numero_cnj, [peticao.id])

                        import base64
                        import xml.etree.ElementTree as ET
                        root = ET.fromstring(xml_docs)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)
                        conteudo_bytes = None
                        for elem in root.iter():
                            if 'conteudo' in elem.tag.lower() and elem.text:
                                conteudo_bytes = base64.b64decode(elem.text)
                                break

                        if conteudo_bytes:
                            texto = extrair_texto_pdf(conteudo_bytes)
                            documentos_baixados.append({
                                "doc": peticao,
                                "bytes": conteudo_bytes,
                                "texto": texto
                            })
                            log_info(f"Documento {peticao.id} baixado ({len(texto)} caracteres)")
                    except Exception as e:
                        log_erro(f"Erro ao baixar documento {peticao.id}: {e}")
                        continue

            log_sucesso(f"{len(documentos_baixados)} documentos baixados com sucesso")

            if not documentos_baixados:
                log_erro("Nenhum documento pôde ser baixado")
                geracao.status = "erro"
                geracao.erro = "Nenhum documento pôde ser baixado do processo"
                self.db.commit()

                evt_erro, evt_fim = evento_erro_com_fim(
                    "Nenhum documento pôde ser baixado do processo", etapa=3
                )
                yield evt_erro
                yield evt_fim
                return

            # FASE 2: Classificar todos via LLM (PARALELIZADO)
            log_info(f"Classificando {len(documentos_baixados)} documentos via IA em paralelo...")
            yield evento_info(f"Classificando {len(documentos_baixados)} documentos via IA em paralelo...", etapa=3)

            async def classificar_documento(doc_info):
                """Classifica um documento via LLM"""
                try:
                    resultado_id = await identificador.identificar_async(doc_info["texto"])
                    return {
                        "doc": doc_info["doc"],
                        "resultado": resultado_id,
                        "texto": doc_info["texto"],
                        "bytes": doc_info["bytes"],
                    }
                except Exception as e:
                    log_erro(f"Erro ao classificar documento {doc_info['doc'].id}: {e}")
                    return None

            # Classifica todos os documentos em paralelo
            tarefas_classificacao = [classificar_documento(d) for d in documentos_baixados]
            resultados_classificacao = await asyncio.gather(*tarefas_classificacao)
            documentos_classificados = [r for r in resultados_classificacao if r is not None]

            # Processa resultados da classificação
            log_info(f"Processando {len(documentos_classificados)} documentos classificados...")
            print(f"[DEBUG] PROCESSANDO {len(documentos_classificados)} DOCS CLASSIFICADOS", flush=True)

            for doc_class in documentos_classificados:
                resultado_id = doc_class["resultado"]
                peticao = doc_class["doc"]

                print(f"[DEBUG] Doc {peticao.id}: {resultado_id.tipo_documento.value}", flush=True)
                log_ia(f"Doc {peticao.id}: {resultado_id.tipo_documento.value} | Confiança: {resultado_id.confianca:.0%}")
                if resultado_id.resumo:
                    log_ia(f"  Resumo: {resultado_id.resumo}")
                if resultado_id.menciona_anexos:
                    log_ia(f"  📎 Menciona anexos: {resultado_id.descricao_anexos}")

                # Processa conforme tipo
                if resultado_id.tipo_documento == TipoDocumento.PETICAO_PRESTACAO:
                    if not peticao_prestacao:  # Pega a primeira
                        peticao_prestacao = doc_class["texto"]
                        peticao_prestacao_doc = peticao
                        log_sucesso(f"✨ PETIÇÃO DE PRESTAÇÃO ENCONTRADA! (ID: {peticao.id})")
                        yield evento_info(f"Petição de prestação encontrada! (confiança: {resultado_id.confianca:.0%})", etapa=3)
                        # SEMPRE busca anexos de petição de prestação (notas fiscais, comprovantes)
                        # independente do LLM detectar menciona_anexos - prestações sempre têm anexos
                        if peticao.data_juntada:
                            docs_para_baixar_anexos.append(peticao)
                            log_info(f"📎 Marcada para buscar anexos (prestação de contas sempre tem anexos)")
                    else:
                        # Se já tem uma prestação, adiciona como relevante para não perder
                        peticoes_relevantes.append(doc_class)
                        logger.warning(f">>> ADICIONANDO peticoes_relevantes: PETICAO_PRESTACAO adicional (ID: {peticao.id})")
                        log_info(f"Petição de prestação adicional -> adicionada como relevante")

                elif resultado_id.tipo_documento == TipoDocumento.PETICAO_RELEVANTE:
                    peticoes_relevantes.append(doc_class)
                    logger.warning(f">>> ADICIONANDO peticoes_relevantes: PETICAO_RELEVANTE (ID: {peticao.id}, {resultado_id.resumo})")
                    log_sucesso(f"✅ Petição RELEVANTE: {resultado_id.resumo}")

                elif resultado_id.tipo_documento in [TipoDocumento.NOTA_FISCAL, TipoDocumento.COMPROVANTE]:
                    # Notas fiscais e comprovantes encontrados nas petições (raro, mas possível)
                    log_info(f"Documento fiscal/comprovante identificado: {resultado_id.resumo}")

                elif resultado_id.tipo_documento == TipoDocumento.IRRELEVANTE:
                    log_info(f"❌ Documento IRRELEVANTE: {resultado_id.resumo}")

                # Se menciona anexos, marca para baixar docs do mesmo dia
                if resultado_id.menciona_anexos and peticao.data_juntada:
                    docs_para_baixar_anexos.append(peticao)

            # Verifica se encontrou prestação de contas
            if not peticao_prestacao:
                log_aviso("Petição de prestação de contas não encontrada - buscando notas fiscais como fallback")

                yield evento_info("Petição de prestação não encontrada. Buscando notas fiscais...", etapa=3)

                # FALLBACK: Buscar notas fiscais (códigos 9870 e 386) nos ÚLTIMOS 50 documentos do processo
                # NOTA: Usa CODIGOS_NOTA_FISCAL importado de xml_parser.py para consistência
                MAX_DOCS_FALLBACK = 50  # Aumentado de 30 para 50 para melhor cobertura

                # Pega os últimos 50 documentos (mais recentes)
                todos_documentos = resultado_xml.documentos
                ultimos_docs = todos_documentos[-MAX_DOCS_FALLBACK:] if len(todos_documentos) > MAX_DOCS_FALLBACK else todos_documentos

                # Busca notas fiscais usando TODOS os códigos de nota fiscal (9870, 386)
                notas_fiscais = [p for p in ultimos_docs if str(p.tipo_codigo) in CODIGOS_NOTA_FISCAL]
                log_info(f"Busca nos últimos {len(ultimos_docs)} documentos - encontradas {len(notas_fiscais)} notas fiscais (códigos: {CODIGOS_NOTA_FISCAL})")

                # Limpa listas para usar APENAS as notas fiscais (evita pegar docs não relacionados)
                docs_para_baixar_anexos.clear()
                documentos_classificados.clear()
                peticoes_relevantes.clear()

                if notas_fiscais:
                    log_info(f"Encontradas {len(notas_fiscais)} notas fiscais para análise")

                    # Baixar notas fiscais - extrai texto quando possível, senão serão convertidas para imagem depois
                    textos_notas = []
                    pdfs_escaneados = 0  # Contador de PDFs de imagem (serão convertidos em ETAPA 4)
                    async with aiohttp.ClientSession() as session:
                        for i, nf in enumerate(notas_fiscais):
                            try:
                                yield evento_info(f"Baixando nota fiscal {i+1}/{len(notas_fiscais)}...", etapa=3)

                                xml_docs = await baixar_documentos_async(session, numero_cnj, [nf.id])
                                import base64
                                import xml.etree.ElementTree as ET
                                root = ET.fromstring(xml_docs)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)
                                conteudo_bytes = None
                                for elem in root.iter():
                                    if 'conteudo' in elem.tag.lower() and elem.text:
                                        conteudo_bytes = base64.b64decode(elem.text)
                                        break

                                if conteudo_bytes:
                                    texto_nf = extrair_texto_pdf(conteudo_bytes)

                                    # Se texto muito curto (< 100 chars), provavelmente é PDF de imagem escaneada
                                    if len(texto_nf) < 100:
                                        log_info(f"Nota fiscal {nf.id}: PDF escaneado ({len(texto_nf)} chars) - sera convertido para imagem")
                                        pdfs_escaneados += 1
                                    else:
                                        textos_notas.append(f"### Nota Fiscal {i+1} (ID: {nf.id})\n{texto_nf}")
                                        log_info(f"Nota fiscal {nf.id} baixada ({len(texto_nf)} caracteres)")

                                    # Adiciona aos documentos classificados para contexto
                                    # A conversao para imagem acontece na ETAPA 4 (linhas 1113-1126)
                                    documentos_classificados.append({
                                        "doc": nf,
                                        "texto": texto_nf,
                                        "bytes": conteudo_bytes,
                                        "resultado": ResultadoIdentificacao(
                                            tipo_documento=TipoDocumento.NOTA_FISCAL,
                                            metodo="fallback",
                                            confianca=1.0,
                                            resumo=f"Nota fiscal - {nf.tipo_descricao or 'Comprovante'}",
                                            menciona_anexos=False
                                        ),
                                        "fallback_nf": True  # Marca como nota fiscal do fallback
                                    })
                            except Exception as e:
                                log_erro(f"Erro ao baixar nota fiscal {nf.id}: {e}")
                                continue

                    # Considera sucesso se baixou pelo menos uma NF (texto ou escaneada)
                    total_nfs_baixadas = len(textos_notas) + pdfs_escaneados
                    if total_nfs_baixadas > 0:
                        peticao_prestacao = "## NOTAS FISCAIS ENCONTRADAS (FALLBACK)\n\n" + "\n\n---\n\n".join(textos_notas)
                        peticao_prestacao_doc = notas_fiscais[0]  # Usa a primeira NF como referência
                        log_sucesso(f"Fallback: {len(textos_notas)} NFs com texto + {pdfs_escaneados} PDFs escaneados (serao convertidos para imagem)")
                    else:
                        # SOLICITA UPLOAD: Notas fiscais não puderam ser processadas
                        log_aviso("Solicitando upload manual de documentos ao usuário")

                        # Verifica se também falta extrato
                        docs_faltantes = ["notas_fiscais"]
                        if not geracao.extrato_subconta_texto or len(geracao.extrato_subconta_texto or '') < 100:
                            docs_faltantes.append("extrato_subconta")

                        mensagem = "O sistema não encontrou as notas fiscais e comprovantes de pagamento no processo. Por favor, anexe os documentos manualmente para continuar a análise."
                        definir_aguardando_documentos(
                            geracao=geracao,
                            documentos_faltantes=docs_faltantes,
                            mensagem_usuario=mensagem,
                            documentos_ja_baixados=extratos_imagens_fallback if extratos_imagens_fallback else None,
                        )

                        self.db.commit()

                        yield evento_solicitar_documentos(
                            "Documentos não encontrados. Por favor, anexe manualmente.",
                            dados={
                                "geracao_id": geracao.id,
                                "numero_cnj": numero_cnj,
                                "documentos_faltantes": docs_faltantes,
                                "mensagem": mensagem,
                                "expira_em": geracao.estado_expira_em.isoformat() if geracao.estado_expira_em else None,
                            },
                        )
                        return
                else:
                    # SOLICITA UPLOAD: Nenhuma nota fiscal encontrada
                    log_aviso("Solicitando upload manual de documentos ao usuário")

                    # Verifica se também falta extrato
                    docs_faltantes = ["notas_fiscais"]
                    if not geracao.extrato_subconta_texto or len(geracao.extrato_subconta_texto or '') < 100:
                        docs_faltantes.append("extrato_subconta")

                    mensagem = "O sistema não encontrou a petição de prestação de contas nem as notas fiscais no processo. Por favor, anexe os documentos manualmente para continuar a análise."
                    definir_aguardando_documentos(
                        geracao=geracao,
                        documentos_faltantes=docs_faltantes,
                        mensagem_usuario=mensagem,
                        documentos_ja_baixados=extratos_imagens_fallback if extratos_imagens_fallback else None,
                    )

                    self.db.commit()

                    yield evento_solicitar_documentos(
                        "Documentos não encontrados. Por favor, anexe manualmente.",
                        dados={
                            "geracao_id": geracao.id,
                            "numero_cnj": numero_cnj,
                            "documentos_faltantes": docs_faltantes,
                            "mensagem": mensagem,
                            "expira_em": geracao.estado_expira_em.isoformat() if geracao.estado_expira_em else None,
                        },
                    )
                    return

            # Salva dados da prestação encontrada (ou fallback)
            geracao.peticao_prestacao_id = peticao_prestacao_doc.id if peticao_prestacao_doc else None
            geracao.peticao_prestacao_data = peticao_prestacao_doc.data_juntada if peticao_prestacao_doc else None
            geracao.peticao_prestacao_texto = peticao_prestacao

            # Log resumo da classificação
            total_relevantes = sum(1 for d in documentos_classificados if d["resultado"].e_relevante)
            total_irrelevantes = sum(1 for d in documentos_classificados if not d["resultado"].e_relevante)
            log_sucesso(f"Classificação concluída: {total_relevantes} relevantes, {total_irrelevantes} descartados")
            log_info(f"  -> Petição de prestação: {'SIM' if peticao_prestacao else 'NÃO'}")

            # DEBUG: Mostrar petições relevantes encontradas
            logger.warning(f"{'='*60}")
            logger.warning(f"DEBUG ETAPA 3: peticoes_relevantes tem {len(peticoes_relevantes)} itens")
            for i, pr in enumerate(peticoes_relevantes, 1):
                logger.warning(f"  {i}. {pr['resultado'].tipo_documento.value}: {pr['resultado'].resumo}")
            logger.warning(f"{'='*60}")

            log_info(f"  -> Petições relevantes para contexto: {len(peticoes_relevantes)}")
            if peticoes_relevantes:
                for i, pr in enumerate(peticoes_relevantes, 1):
                    log_info(f"     {i}. {pr['resultado'].resumo or pr['doc'].id}")

            yield evento_progresso(
                etapa=3,
                mensagem=f"Classificação: {total_relevantes} relevantes, {total_irrelevantes} descartados",
                progresso=55,
            )

            # =====================================================
            # ETAPA 4: BAIXAR DOCUMENTOS ANEXOS
            # =====================================================
            log_etapa(4, "DOWNLOAD DE DOCUMENTOS ANEXOS")
            yield evento_etapa(
                etapa=4,
                etapa_nome="Baixar Documentos",
                mensagem="Baixando documentos anexos...",
                progresso=60,
            )

            documentos_anexos = []  # Imagens (notas fiscais, comprovantes)
            peticoes_contexto = []  # Textos de petições relevantes para contexto

            # Adiciona extratos da conta única (fallback) como imagens para análise da IA
            if extratos_imagens_fallback:
                log_info(f"Adicionando {len(extratos_imagens_fallback)} extratos da conta única como imagens")
                documentos_anexos.extend(extratos_imagens_fallback)

            # Baixa petição inicial
            if resultado_xml.peticao_inicial:
                log_info(f"Baixando petição inicial (ID: {resultado_xml.peticao_inicial.id})...")
                yield evento_info("Baixando petição inicial...", etapa=4)
                try:
                    async with aiohttp.ClientSession() as session:
                        xml_docs = await baixar_documentos_async(
                            session, numero_cnj, [resultado_xml.peticao_inicial.id]
                        )
                        import base64
                        import xml.etree.ElementTree as ET
                        root = ET.fromstring(xml_docs)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)
                        for elem in root.iter():
                            if 'conteudo' in elem.tag.lower() and elem.text:
                                conteudo = base64.b64decode(elem.text)
                                geracao.peticao_inicial_id = resultado_xml.peticao_inicial.id
                                geracao.peticao_inicial_texto = extrair_texto_pdf(conteudo)
                                log_sucesso(f"Petição inicial baixada ({len(geracao.peticao_inicial_texto)} caracteres)")
                                break
                except Exception as e:
                    log_erro(f"Erro ao baixar petição inicial: {e}")

            # Adiciona petições relevantes como contexto em texto
            logger.warning(f"{'='*60}")
            logger.warning(f"DEBUG ETAPA 4: peticoes_relevantes = {len(peticoes_relevantes)} itens")
            logger.warning(f"{'='*60}")

            logger.warning(f"Adicionando {len(peticoes_relevantes)} petições relevantes ao contexto...")
            for doc_class in peticoes_relevantes:
                peticoes_contexto.append({
                    "id": doc_class["doc"].id,
                    "tipo": doc_class["resultado"].resumo or "Petição relevante",
                    "texto": doc_class["texto"]
                })
                logger.warning(f"  📄 Contexto adicionado: {doc_class['resultado'].resumo} (ID: {doc_class['doc'].id}, {len(doc_class['texto'])} chars)")

            logger.warning(f"{'='*60}")
            logger.warning(f"TOTAL peticoes_contexto: {len(peticoes_contexto)} itens")
            logger.warning(f"{'='*60}")

            if peticoes_contexto:
                yield evento_info(f"{len(peticoes_contexto)} petições relevantes adicionadas ao contexto", etapa=4)

            # Prepara parser para buscar documentos anexos
            parser = XMLParserPrestacao(xml_response)
            parser._parse_estrutura()
            parser._extrair_documentos()

            # Coleta IDs de documentos já processados (para não duplicar)
            ids_ja_processados = {d["doc"].id for d in documentos_classificados}

            # DEBUG: Log do estado inicial da busca de anexos
            logger.warning(f"{'='*60}")
            logger.warning(f"DEBUG ETAPA 4: BUSCA DE ANEXOS")
            logger.warning(f"  docs_para_baixar_anexos: {len(docs_para_baixar_anexos)} itens")
            for idx, p in enumerate(docs_para_baixar_anexos):
                logger.warning(f"    {idx+1}. ID={p.id} | Data={p.data_juntada}")
            logger.warning(f"  ids_ja_processados: {len(ids_ja_processados)} IDs")
            logger.warning(f"{'='*60}")

            # Baixa documentos anexos das petições que mencionam anexos
            # Usa intervalo de 15 minutos (aumentado de 2) para encontrar anexos juntados junto com a petição
            # NOTA: Muitos anexos são juntados com diferença maior que 2 minutos da petição principal
            for peticao_com_anexos in docs_para_baixar_anexos:
                if peticao_com_anexos.data_juntada:
                    # Primeiro tenta intervalo curto (5 min)
                    docs_proximos = parser.get_documentos_proximos(
                        peticao_com_anexos.data_juntada,
                        excluir_id=peticao_com_anexos.id,
                        intervalo_minutos=5
                    )

                    # Se não encontrou anexos, tenta intervalo maior (15 min)
                    if not docs_proximos:
                        docs_proximos = parser.get_documentos_proximos(
                            peticao_com_anexos.data_juntada,
                            excluir_id=peticao_com_anexos.id,
                            intervalo_minutos=15
                        )

                    # Se ainda não encontrou, busca no mesmo dia (último recurso)
                    if not docs_proximos:
                        docs_proximos = parser.get_documentos_mesmo_dia(
                            peticao_com_anexos.data_juntada,
                            excluir_id=peticao_com_anexos.id
                        )
                        # Filtra apenas tipos de anexo relevantes (notas fiscais, comprovantes, etc)
                        docs_proximos = [
                            d for d in docs_proximos
                            if str(d.tipo_codigo) in CODIGOS_DOCUMENTOS_ANEXOS
                        ]

                    # DEBUG: Log dos documentos encontrados próximos
                    logger.warning(f"DEBUG: Petição {peticao_com_anexos.id} @ {peticao_com_anexos.data_juntada}")
                    logger.warning(f"  docs_proximos encontrados: {len(docs_proximos)}")
                    for dp in docs_proximos:
                        logger.warning(f"    -> ID={dp.id} | Tipo={dp.tipo_descricao} | Data={dp.data_juntada}")

                    # Filtra apenas documentos não processados
                    docs_novos = [d for d in docs_proximos if d.id not in ids_ja_processados]
                    logger.warning(f"  docs_novos (após filtro): {len(docs_novos)}")

                    if docs_novos:
                        hora_ref = peticao_com_anexos.data_juntada.strftime('%d/%m/%Y %H:%M')
                        log_info(f"Encontrados {len(docs_novos)} anexos próximos a {hora_ref}")
                        yield evento_info(f"Baixando {len(docs_novos)} documentos anexos...", etapa=4)

                        ids_docs = [d.id for d in docs_novos]
                        try:
                            async with aiohttp.ClientSession() as session:
                                xml_docs = await baixar_documentos_async(session, numero_cnj, ids_docs)

                                import base64
                                import xml.etree.ElementTree as ET
                                root = ET.fromstring(xml_docs)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)

                                # Extrai bytes de cada documento
                                doc_bytes_map = {}
                                for elem in root.iter():
                                    if 'documento' in elem.tag.lower():
                                        doc_id = elem.attrib.get('idDocumento', '')
                                        for child in elem:
                                            if 'conteudo' in child.tag.lower() and child.text:
                                                try:
                                                    doc_bytes_map[doc_id] = base64.b64decode(child.text)
                                                except:
                                                    pass

                                # DEBUG: Log do mapeamento de documentos baixados
                                logger.warning(f"DEBUG: doc_bytes_map keys: {list(doc_bytes_map.keys())}")
                                logger.warning(f"DEBUG: docs_novos IDs: {[d.id for d in docs_novos]}")

                                # Todos os anexos são enviados como imagem (sem classificação)
                                for doc in docs_novos:
                                    logger.warning(f"DEBUG: Verificando doc.id='{doc.id}' in doc_bytes_map: {doc.id in doc_bytes_map}")
                                    if doc.id in doc_bytes_map:
                                        doc_bytes = doc_bytes_map[doc.id]
                                        ids_ja_processados.add(doc.id)

                                        # Converte para imagem
                                        imagens = converter_pdf_para_imagens(doc_bytes)
                                        if imagens:
                                            documentos_anexos.append({
                                                "id": doc.id,
                                                "tipo": doc.tipo_descricao or doc.tipo_codigo or "Anexo",
                                                "imagens": imagens
                                            })
                                            log_sucesso(f"Anexo convertido para imagem: {doc.tipo_descricao or doc.tipo_codigo} ({len(imagens)} páginas)")
                                            yield evento_info(f"Anexo '{doc.tipo_descricao or doc.tipo_codigo}' ({len(imagens)} páginas)", etapa=4)

                        except Exception as e:
                            log_erro(f"Erro ao baixar documentos anexos: {e}")

            # Converte notas fiscais do fallback para imagens (se houver)
            for doc_class in documentos_classificados:
                if doc_class.get("fallback_nf") and doc_class.get("bytes"):
                    try:
                        imagens = converter_pdf_para_imagens(doc_class["bytes"])
                        if imagens:
                            documentos_anexos.append({
                                "id": doc_class["doc"].id,
                                "tipo": f"Nota Fiscal - {doc_class['doc'].tipo_descricao or 'Comprovante'}",
                                "imagens": imagens
                            })
                            log_info(f"Nota fiscal {doc_class['doc'].id} convertida para imagem ({len(imagens)} páginas)")
                    except Exception as e:
                        log_erro(f"Erro ao converter nota fiscal para imagem: {e}")

            # DEBUG: Log final do estado de documentos_anexos
            logger.warning(f"DEBUG: SALVANDO documentos_anexos - {len(documentos_anexos)} itens")
            for da in documentos_anexos:
                logger.warning(f"  -> ID={da.get('id')} | Tipo={da.get('tipo')} | Imagens={len(da.get('imagens', []))}")

            geracao.documentos_anexos = documentos_anexos

            # Salva petições relevantes para visualização posterior
            geracao.peticoes_relevantes = [
                {
                    "id": pr["doc"].id,
                    "tipo": pr["resultado"].resumo or "Petição relevante",
                    "data": pr["doc"].data_juntada.isoformat() if pr["doc"].data_juntada else None
                }
                for pr in peticoes_relevantes
            ]

            geracao.prompt_identificacao = f"Documentos classificados: {len(documentos_classificados)}, Relevantes: {total_relevantes}"

            # Conta totais
            total_imagens = sum(len(d.get('imagens', [])) for d in documentos_anexos)
            log_sucesso(f"Total: {len(documentos_anexos)} docs como imagem ({total_imagens} páginas), {len(peticoes_contexto)} docs como texto")

            yield evento_progresso(
                etapa=4,
                mensagem=f"{len(documentos_anexos)} documentos como imagem, {len(peticoes_contexto)} como texto",
                progresso=75,
            )

            # =====================================================
            # VERIFICAÇÃO: Documentos suficientes para análise?
            # =====================================================
            tem_extrato = bool(geracao.extrato_subconta_texto and len(geracao.extrato_subconta_texto) > 100)
            tem_documentos = len(documentos_anexos) > 0

            # Verifica se encontrou NOTA FISCAL especificamente (códigos 9870, 386)
            # Busca nos documentos do XML que foram baixados como anexos
            tem_nota_fiscal = False
            for doc in resultado_xml.documentos:
                if str(doc.tipo_codigo) in CODIGOS_NOTA_FISCAL:
                    # Verifica se esse documento está nos anexos baixados
                    for anexo in documentos_anexos:
                        if anexo.get("id") == doc.id:
                            tem_nota_fiscal = True
                            break
                if tem_nota_fiscal:
                    break

            # Também verifica se algum anexo é do tipo "Nota Fiscal" pelo nome
            if not tem_nota_fiscal:
                for anexo in documentos_anexos:
                    tipo_anexo = anexo.get("tipo", "").lower()
                    if "nota fiscal" in tipo_anexo or "nf" in tipo_anexo:
                        tem_nota_fiscal = True
                        break

            # Se não tem extrato E não tem documentos, solicita upload obrigatório
            if not tem_extrato and not tem_documentos:
                log_aviso("Documentos insuficientes para análise - solicitando upload manual")

                docs_faltantes = ["extrato_subconta", "notas_fiscais"]
                mensagem = "O sistema não encontrou o extrato da subconta nem as notas fiscais/comprovantes necessários para a análise. Por favor, anexe os documentos manualmente."
                definir_aguardando_documentos(
                    geracao=geracao,
                    documentos_faltantes=docs_faltantes,
                    mensagem_usuario=mensagem,
                    documentos_ja_baixados=documentos_anexos if documentos_anexos else None,
                )

                self.db.commit()

                yield evento_solicitar_documentos(
                    "Documentos insuficientes. Por favor, anexe manualmente.",
                    dados={
                        "geracao_id": geracao.id,
                        "numero_cnj": numero_cnj,
                        "documentos_faltantes": docs_faltantes,
                        "mensagem": mensagem,
                        "expira_em": geracao.estado_expira_em.isoformat() if geracao.estado_expira_em else None,
                    },
                )
                return

            # Se não encontrou NOTA FISCAL, solicita ao usuário (com opção de continuar sem)
            if not tem_nota_fiscal:
                log_aviso("Nota fiscal não encontrada - solicitando ao usuário")

                mensagem = "O sistema não encontrou a nota fiscal da prestação de contas no processo. Você pode anexar a nota fiscal manualmente ou continuar a análise sem ela."

                # Salva petições relevantes antes de definir aguardando
                geracao.peticoes_relevantes = [
                    {
                        "id": pr["doc"].id,
                        "tipo": pr["resultado"].resumo or "Petição relevante",
                        "data": pr["doc"].data_juntada.isoformat() if pr["doc"].data_juntada else None
                    }
                    for pr in peticoes_relevantes
                ]

                definir_aguardando_nota_fiscal(
                    geracao=geracao,
                    mensagem_usuario=mensagem,
                    documentos_ja_baixados=documentos_anexos,
                )

                self.db.commit()

                yield EventoSSE(
                    tipo="solicitar_nota_fiscal",
                    etapa=4,
                    mensagem="Nota fiscal não encontrada no processo.",
                    dados={
                        "geracao_id": geracao.id,
                        "numero_cnj": numero_cnj,
                        "documentos_encontrados": len(documentos_anexos),
                        "permite_continuar_sem": True,
                        "mensagem": mensagem,
                        "expira_em": geracao.estado_expira_em.isoformat() if geracao.estado_expira_em else None,
                    }
                )
                return

            # Se não tem extrato mas tem documentos, avisa mas continua
            if not tem_extrato and tem_documentos:
                log_aviso("Extrato da subconta não encontrado - análise continuará apenas com notas fiscais")

            # =====================================================
            # ETAPA 5: ANÁLISE POR IA
            # =====================================================
            log_etapa(5, "ANÁLISE FINAL (LLM)")
            log_ia(f"Modelo: {self.modelo_analise} | Temperatura: {self.temperatura_analise}")
            yield evento_etapa(
                etapa=5,
                etapa_nome="Análise IA",
                mensagem="Analisando prestação de contas com IA...",
                progresso=80,
            )

            dados_analise = DadosAnalise(
                extrato_subconta=geracao.extrato_subconta_texto or "",
                peticao_inicial=geracao.peticao_inicial_texto or "",
                peticao_prestacao=geracao.peticao_prestacao_texto or "",
                documentos_anexos=documentos_anexos,
                peticoes_contexto=peticoes_contexto,
                extrato_observacao=getattr(geracao, 'extrato_observacao', None),
            )

            # Log dos dados enviados
            log_ia(f"Dados para análise:")
            log_ia(f"  - Extrato subconta: {len(geracao.extrato_subconta_texto or '')} caracteres")
            log_ia(f"  - Petição inicial: {len(geracao.peticao_inicial_texto or '')} caracteres")
            log_ia(f"  - Petição prestação: {len(geracao.peticao_prestacao_texto or '')} caracteres")
            log_ia(f"  - Petições de contexto: {len(peticoes_contexto)} documentos")
            log_ia(f"  - Documentos anexos: {len(documentos_anexos)} docs, {total_imagens} imagens")

            agente = AgenteAnalise(
                modelo=self.modelo_analise,
                temperatura=self.temperatura_analise,
                ia_logger=self.ia_logger,
                db=self.db,
            )

            log_ia("Enviando para análise...")
            resultado = await agente.analisar(dados_analise)

            # Log do resultado
            log_sucesso(f"Análise concluída!")
            log_ia(f"  📋 PARECER: {resultado.parecer.upper()}")

            def formatar_valor(v):
                """Formata valor para exibição, tratando diferentes tipos"""
                if v is None:
                    return None
                if isinstance(v, (int, float)):
                    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                if isinstance(v, str):
                    return f"R$ {v}"
                return str(v)

            if resultado.valor_bloqueado:
                log_ia(f"  💰 Valor bloqueado: {formatar_valor(resultado.valor_bloqueado)}")
            if resultado.valor_utilizado:
                log_ia(f"  💸 Valor utilizado: {formatar_valor(resultado.valor_utilizado)}")
            if resultado.valor_devolvido:
                log_ia(f"  🔄 Valor devolvido: {formatar_valor(resultado.valor_devolvido)}")
            if resultado.medicamento_pedido:
                log_ia(f"  💊 Medicamento pedido: {resultado.medicamento_pedido}")
            if resultado.medicamento_comprado:
                log_ia(f"  💊 Medicamento comprado: {resultado.medicamento_comprado}")
            if resultado.irregularidades:
                log_ia(f"  ⚠️  Irregularidades: {len(resultado.irregularidades)}")
            if resultado.perguntas:
                log_ia(f"  ❓ Perguntas ao usuário: {len(resultado.perguntas)}")

            # Salva resultado
            geracao.parecer = resultado.parecer
            geracao.fundamentacao = resultado.fundamentacao
            geracao.irregularidades = resultado.irregularidades
            geracao.perguntas_usuario = resultado.perguntas
            geracao.valor_bloqueado = resultado.valor_bloqueado
            geracao.valor_utilizado = resultado.valor_utilizado
            geracao.valor_devolvido = resultado.valor_devolvido
            geracao.medicamento_pedido = resultado.medicamento_pedido
            geracao.medicamento_comprado = resultado.medicamento_comprado
            geracao.modelo_usado = resultado.modelo_usado
            geracao.prompt_analise = self.ia_logger.logs[-1].prompt_enviado if self.ia_logger.logs else None
            geracao.resposta_ia_bruta = self.ia_logger.logs[-1].resposta_ia if self.ia_logger.logs else None

            # Calcula tempo de processamento
            fim = datetime.utcnow()
            geracao.tempo_processamento_ms = int((fim - inicio).total_seconds() * 1000)
            geracao.status = "concluido"

            self.db.commit()

            # Salva logs de IA
            self.ia_logger.salvar_logs(self.db, geracao.id)

            log_info(f"Tempo total de processamento: {geracao.tempo_processamento_ms/1000:.1f}s")
            logger.info(f"\n{'#'*60}")
            logger.info(f"# FIM - PARECER: {resultado.parecer.upper()}")
            logger.info(f"{'#'*60}\n")

            yield EventoSSE(
                tipo="sucesso",
                etapa=5,
                mensagem="Análise concluída!",
                progresso=100,
            )

            yield evento_resultado(
                "Processamento finalizado",
                dados={
                    "geracao_id": geracao.id,
                    "parecer": resultado.parecer,
                    "fundamentacao": resultado.fundamentacao,
                    "valor_bloqueado": resultado.valor_bloqueado,
                    "valor_utilizado": resultado.valor_utilizado,
                    "valor_devolvido": resultado.valor_devolvido,
                    "medicamento_pedido": resultado.medicamento_pedido,
                    "medicamento_comprado": resultado.medicamento_comprado,
                    "irregularidades": resultado.irregularidades,
                    "perguntas": resultado.perguntas,
                },
            )

        except Exception as e:
            logger.exception(f"Erro no processamento: {e}")
            # NÃO sobrescreve status se já está aguardando documentos (foi interrompido propositalmente)
            if geracao.status not in ("aguardando_documentos", "aguardando_nota_fiscal"):
                geracao.status = "erro"
                geracao.erro = str(e)
                self.db.commit()

                evt_erro, evt_fim = evento_erro_com_fim(f"Erro no processamento: {str(e)}")
                yield evt_erro
                yield evt_fim

    async def responder_duvida(
        self,
        geracao_id: int,
        respostas: Dict[str, str]
    ) -> ResultadoAnalise:
        """
        Processa respostas do usuário às perguntas de dúvida e reavalia.

        Args:
            geracao_id: ID da geração
            respostas: Dict com pergunta -> resposta

        Returns:
            ResultadoAnalise atualizado
        """
        geracao = self.db.query(GeracaoAnalise).filter(
            GeracaoAnalise.id == geracao_id
        ).first()

        if not geracao:
            raise ValueError("Geração não encontrada")

        # Monta dados originais
        dados = DadosAnalise(
            extrato_subconta=geracao.extrato_subconta_texto or "",
            peticao_inicial=geracao.peticao_inicial_texto or "",
            peticao_prestacao=geracao.peticao_prestacao_texto or "",
            documentos_anexos=geracao.documentos_anexos or [],
        )

        # Reavalia
        agente = AgenteAnalise(
            modelo=self.modelo_analise,
            temperatura=self.temperatura_analise,
            ia_logger=self.ia_logger,
            db=self.db,
        )

        resultado = await agente.reanalisar_com_respostas(dados, respostas)

        # Atualiza geração
        geracao.parecer = resultado.parecer
        geracao.fundamentacao = resultado.fundamentacao
        geracao.irregularidades = resultado.irregularidades
        geracao.perguntas_usuario = resultado.perguntas
        geracao.respostas_usuario = respostas
        geracao.valor_bloqueado = resultado.valor_bloqueado
        geracao.valor_utilizado = resultado.valor_utilizado
        geracao.valor_devolvido = resultado.valor_devolvido

        self.db.commit()

        # Salva logs
        self.ia_logger.salvar_logs(self.db, geracao.id)

        return resultado

    async def continuar_com_documentos_manuais(
        self,
        geracao_id: int
    ) -> AsyncGenerator[EventoSSE, None]:
        """
        Continua a análise após o usuário enviar documentos manualmente.

        Args:
            geracao_id: ID da geração com documentos recebidos

        Yields:
            EventoSSE com progresso do processamento
        """
        from datetime import datetime

        geracao = self.db.query(GeracaoAnalise).filter(
            GeracaoAnalise.id == geracao_id
        ).first()

        if not geracao:
            yield evento_erro("Análise não encontrada")
            return

        inicio = datetime.utcnow()

        try:
            logger.info(f"\n{'#'*60}")
            logger.info(f"# CONTINUANDO ANÁLISE COM DOCUMENTOS MANUAIS - {geracao.numero_cnj}")
            logger.info(f"{'#'*60}")

            # =====================================================
            # BUSCA PETIÇÃO INICIAL (se não estiver salva)
            # =====================================================
            if not geracao.peticao_inicial_texto and geracao.dados_processo_xml:
                peticao_inicial_id = geracao.dados_processo_xml.get("peticao_inicial_id")
                if peticao_inicial_id:
                    yield evento_etapa(
                        etapa=4,
                        etapa_nome="Buscar Petições",
                        mensagem="Baixando petição inicial do ESAJ...",
                        progresso=60,
                    )
                    log_info(f"Buscando petição inicial (ID: {peticao_inicial_id})...")
                    try:
                        async with aiohttp.ClientSession() as session:
                            xml_docs = await baixar_documentos_async(
                                session, geracao.numero_cnj, [peticao_inicial_id]
                            )
                            import base64
                            import xml.etree.ElementTree as ET
                            root = ET.fromstring(xml_docs)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)
                            for elem in root.iter():
                                if 'conteudo' in elem.tag.lower() and elem.text:
                                    conteudo = base64.b64decode(elem.text)
                                    geracao.peticao_inicial_texto = extrair_texto_pdf(conteudo)
                                    self.db.commit()
                                    log_sucesso(f"Petição inicial baixada ({len(geracao.peticao_inicial_texto)} caracteres)")
                                    break
                    except Exception as e:
                        log_erro(f"Erro ao baixar petição inicial: {e}")

            yield evento_etapa(
                etapa=5,
                etapa_nome="Análise IA",
                mensagem="Analisando documentos enviados...",
                progresso=80,
            )

            # Prepara dados para análise
            dados_analise = DadosAnalise(
                extrato_subconta=geracao.extrato_subconta_texto or "",
                peticao_inicial=geracao.peticao_inicial_texto or "",
                peticao_prestacao=geracao.peticao_prestacao_texto or "",
                documentos_anexos=geracao.documentos_anexos or [],
                peticoes_contexto=[],
            )

            # Log dos dados
            log_ia(f"Dados para análise (documentos manuais):")
            log_ia(f"  - Extrato subconta: {len(geracao.extrato_subconta_texto or '')} caracteres")
            log_ia(f"  - Petição inicial: {len(geracao.peticao_inicial_texto or '')} caracteres")
            log_ia(f"  - Documentos anexos: {len(geracao.documentos_anexos or [])} docs")

            agente = AgenteAnalise(
                modelo=self.modelo_analise,
                temperatura=self.temperatura_analise,
                ia_logger=self.ia_logger,
                db=self.db,
            )

            log_ia("Enviando para análise...")
            resultado = await agente.analisar(dados_analise)

            # Log do resultado com detalhes para debug
            log_sucesso(f"Análise concluída!")
            log_ia(f"  📋 PARECER: {resultado.parecer.upper()}")
            log_ia(f"  📝 FUNDAMENTACAO: {len(resultado.fundamentacao or '')} caracteres")
            if resultado.fundamentacao and len(resultado.fundamentacao) < 100:
                log_ia(f"  ⚠️ Fundamentação curta: {resultado.fundamentacao[:200]}")

            # Salva resultado
            geracao.parecer = resultado.parecer
            geracao.fundamentacao = resultado.fundamentacao
            geracao.irregularidades = resultado.irregularidades
            geracao.perguntas_usuario = resultado.perguntas
            geracao.valor_bloqueado = resultado.valor_bloqueado
            geracao.valor_utilizado = resultado.valor_utilizado
            geracao.valor_devolvido = resultado.valor_devolvido
            geracao.medicamento_pedido = resultado.medicamento_pedido
            geracao.medicamento_comprado = resultado.medicamento_comprado
            geracao.modelo_usado = resultado.modelo_usado
            geracao.prompt_analise = self.ia_logger.logs[-1].prompt_enviado if self.ia_logger.logs else None
            geracao.resposta_ia_bruta = self.ia_logger.logs[-1].resposta_ia if self.ia_logger.logs else None

            # Calcula tempo de processamento
            fim = datetime.utcnow()
            geracao.tempo_processamento_ms = int((fim - inicio).total_seconds() * 1000)
            geracao.status = "concluido"

            self.db.commit()

            # Salva logs de IA
            self.ia_logger.salvar_logs(self.db, geracao.id)

            log_info(f"Tempo de análise: {geracao.tempo_processamento_ms/1000:.1f}s")
            logger.info(f"\n{'#'*60}")
            logger.info(f"# FIM - PARECER: {resultado.parecer.upper()}")
            logger.info(f"{'#'*60}\n")

            yield EventoSSE(
                tipo="sucesso",
                etapa=5,
                mensagem="Análise concluída!",
                progresso=100,
            )

            yield evento_resultado(
                "Processamento finalizado",
                dados={
                    "geracao_id": geracao.id,
                    "parecer": resultado.parecer,
                    "fundamentacao": resultado.fundamentacao,
                    "valor_bloqueado": resultado.valor_bloqueado,
                    "valor_utilizado": resultado.valor_utilizado,
                    "valor_devolvido": resultado.valor_devolvido,
                    "medicamento_pedido": resultado.medicamento_pedido,
                    "medicamento_comprado": resultado.medicamento_comprado,
                    "irregularidades": resultado.irregularidades,
                    "perguntas": resultado.perguntas,
                },
            )

        except Exception as e:
            logger.exception(f"Erro ao continuar análise: {e}")
            # NÃO sobrescreve status se já está aguardando documentos
            if geracao.status not in ("aguardando_documentos", "aguardando_nota_fiscal"):
                geracao.status = "erro"
                geracao.erro = str(e)
                self.db.commit()

                evt_erro, evt_fim = evento_erro_com_fim(f"Erro ao processar: {str(e)}")
                yield evt_erro
                yield evt_fim
