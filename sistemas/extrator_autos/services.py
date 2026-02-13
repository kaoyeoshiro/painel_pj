# sistemas/extrator_autos/services.py
"""
Orquestrador principal do Extrator de Autos.

Coordena consultas ao TJ-MS, resolucao de categorias, classificacao BERT
e download/empacotamento de documentos processuais.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Coroutine, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from services.tjms.client import TJMSClient, TJMSError
from services.tjms.models import (
    ConsultaOptions,
    DocumentoMetadata,
    DocumentoTJMS,
    DownloadOptions,
    ProcessoTJMS,
    TipoConsulta,
)
from sistemas.extrator_autos.models import ExtracaoAutos
from sistemas.extrator_autos.services_bert_client import BertClassifierClient
from sistemas.extrator_autos.services_category_resolver import (
    DocumentoCandidate,
    ResolutionResult,
    _normalizar_label,
    resolve_all_categories,
)
from sistemas.extrator_autos.services_download import (
    criar_zip_resultado,
    detectar_rtf,
    filtrar_por_periodo,
    gerar_nome_arquivo,
    mesclar_pdfs,
    ordenar_documentos,
    pdf_to_text,
)
from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento
from utils.timezone import now_utc

logger = logging.getLogger(__name__)

# Tipo para callbacks de progresso (percent: int, mensagem: str)
ProgressCallback = Callable[[int, str], Coroutine[Any, Any, None]]


@dataclass
class LoteResult:
    """Resultado do processamento em lote v2 com pipeline completo."""
    zip_bytes: bytes
    total_processos: int
    total_processados: int
    total_erros: int
    total_docs_baixados: int
    total_docs_filtrados_bert: int = 0
    detalhes_por_processo: List[Dict[str, Any]] = field(default_factory=list)


# =============================================================================
# Mapa de codigos de documentos TJ-MS -> descricao
# =============================================================================

CATEGORIAS_MAP: Dict[int, str] = {
    # --- Peticoes ---
    500: "Peticao Inicial",
    510: "Peticao Intermediaria",
    9500: "Peticao",
    8320: "Contestacao",
    8305: "Contrarrazoes de Apelacao",
    8326: "Emenda a Inicial",
    239: "Emenda a Inicial - Faz. Publica",
    357: "Manifestacao (Outras)",
    306: "Manifestacao da Recuperanda/Falida",
    8323: "Manifestacao do Autor",
    8327: "Manifestacao do Curador",
    8333: "Manifestacao do Ministerio Publico",
    215: "Manifestacao do Perito",
    8338: "Manifestacao do Procurador da Fazenda Publica Estadual",
    8426: "Manifestacao do Procurador da Fazenda Publica Municipal",
    579: "Manifestacao do Procurador da Fazenda Publica Nacional",
    9875: "Manifestacao do Requerido",
    8350: "Manifestacao do Reu",
    225: "Manifestacao do Terceiro Interessado",
    8361: "Manifestacao Sobre Calculo",
    8365: "Manifestacao Sobre Impugnacao",
    8368: "Manifestacao Sobre Laudo Pericial",
    8373: "Memoriais",
    8388: "Pedido de Abertura de Conta",
    8330: "Pedido de Arquivamento",
    286: "Pedido de Cumprimento de Sentenca contra a Fazenda Publica",
    238: "Pedido de Desistencia da Acao - Faz. Publica",
    8356: "Pedido de Desarquivamento",
    8367: "Pedido de Desistencia da Acao",
    8428: "Pedido de Desistencia do Prazo Recursal",
    8423: "Pedido de Dilacao de Prazo",
    8380: "Pedido de Expedicao de Alvara",
    8387: "Pedido de Expedicao de Oficio",
    8390: "Pedido de Extincao de Feito",
    270: "Pedido de Informacoes",
    8392: "Pedido de Intimacao de Partes",
    8393: "Pedido de Julgamento Antecipado da Lide",
    8395: "Pedido de Penhora",
    8315: "Pedido de Providencias",
    8397: "Pedido de Reconsideracao de Despacho",
    8399: "Pedido de Requisicao",
    333: "Pedido de Substabelecimento",
    240: "Pedido de Suspensao pelo Parcelamento - Faz. Publica",
    8438: "Pedido de Utilizacao do SISBAJUD",
    9615: "Quesitos Parte Autora",
    8331: "Impugnacao a Contestacao",
    8334: "Impugnacao a Defesa",
    256: "Impugnacao ao Cumprimento de Decisao",
    273: "Impugnacao ao Cumprimento de Sentenca",
    8336: "Impugnacao de Embargos",
    8425: "Informacoes",
    9511: "Cumprimento de Sentenca",
    277: "Alegacao de Incompetencia",
    8303: "Alegacoes Finais",
    25: "Execucao de Sentenca Contra Fazenda Publica",
    9635: "Liquidacao de Sentenca",
    93: "Oposicao",
    330: "Oposicao ao Julgamento Virtual",
    21: "Pecas da Defensoria",
    209: "Pecas da Defensoria Publica",
    30: "Pecas do MP",

    # --- Despachos ---
    6: "Despacho",
    27: "Despacho",
    141: "Despacho",

    # --- Decisoes ---
    15: "Decisoes Interlocutorias",
    44: "Decisoes Monocraticas",
    45: "Decisoes Monocraticas",
    137: "Decisao Interlocutoria",
    517: "Decisao da Turma Recursal",
    8506: "Decisao",
    9653: "Decisao Monocratica Segundo Grau",
    9654: "Decisao Terminativa",
    9817: "Declinio de Competencia",

    # --- Sentencas ---
    8: "Sentenca",
    54: "Sentenca do Juiz Leigo",
    9626: "Sentenca do Juiz Leigo",

    # --- Acordaos ---
    34: "Acordaos",
    35: "Acordaos - Turma Recursais",
    37: "Acordao",
    202: "Acordaos",

    # --- Recursos ---
    17: "Agravo",
    62: "Embargos de Declaracao",
    264: "Recurso Inominado",
    272: "Recurso Adesivo",
    576: "Agravo Interno",
    8335: "Recurso de Apelacao",
    8435: "Agravo de Instrumento",
    9628: "Agravo Regimental",
    9629: "Recurso Especial",
    9630: "Recurso Extraordinario",

    # --- Pareceres ---
    59: "Nota Tecnica NATJus",
    207: "Parecer do CATES - Camara Tecnica em Saude",
    8451: "Parecer do NAT - Nucleo de Apoio Tecnico",
    8490: "Nota Tecnica NATJus",
    9636: "Parecer NAT",

    # --- Documentos ---
    3: "Alvara",
    10: "Termo",
    14: "Audiencia",
    71: "Extrato da Conta Unica",
    99010: "Calculo de Atualizacao Monetaria",
    99012: "Calculo Processual",
    99058: "Calculo Judicial",
    140: "Alvara",
    310: "Pedidos de Exames/Exames Medicos",
    571: "Alvara de Levantamento com Recibo",
    8369: "Laudo Pericial",
    9501: "Procuracao",
    9509: "Outros Documentos",
    9522: "Certidao de Casamento",
    9523: "Certidao de Nascimento",
    9524: "Certidao de Obito",
    9534: "Receita/Laudo Medico",
    9539: "Titulo Executivo Extrajudicial",
    9540: "Titulo Executivo Judicial",
    9553: "Planilha de Calculo",
    9603: "Laudo Pericial",
    9623: "Extrato Bancario",
    9639: "Pedidos de Exames/Exames Medicos",
    9870: "Nota Fiscal",

    # --- Outros codigos comuns (sem classificacao especifica no JSON) ---
    1: "Auto de Infracao",
    2: "Ata de Audiencia",
    4: "Certidao",
    5: "Copia de Sentenca",
    7: "Documentos Pessoais",
    9: "Guia de Recolhimento",
    11: "Mandado",
    12: "Notificacao",
    13: "Oficio",
    16: "Relatorio",
    18: "Auto de Penhora",
    19: "Carta Precatoria",
    20: "Comprovante de Deposito",
    22: "Comprovante de Pagamento",
    23: "Contrato",
    24: "Declaracao",
    26: "Edital",
    28: "Guia de Custas",
    29: "Informacao",
    31: "Laudo",
    32: "Memorial Descritivo",
    33: "Oficio Requisitorio",
    36: "Voto",
    38: "Precatorio",
    39: "Relatorio de Gestao",
    40: "RPV - Requisicao de Pequeno Valor",
    41: "Substabelecimento",
    42: "Termo de Audiencia",
    43: "Termo de Penhora",
    46: "Auto de Arrematacao",
    47: "Carta de Adjudicacao",
    48: "Carta de Arrematacao",
    49: "Carta de Sentenca",
    50: "Certidao de Intimacao",
    51: "Certidao de Publicacao",
    52: "Certidao Negativa",
    53: "Comunicacao Eletronica",
    55: "Embargos a Execucao",
    56: "Ficha de Composicao",
    57: "Guia de Deposito Judicial",
    58: "Informacoes Complementares",
    60: "Oficio Circular",
    61: "Parecer",
    63: "Embargos Infringentes",
    64: "Execucao Fiscal",
    65: "Execucao Provisoria",
    66: "Habilitacao",
    67: "Incidente de Falsidade",
    68: "Incidente de Impedimento",
    69: "Incidente de Suspeicao",
    70: "Medida Cautelar",
    72: "Pedido de Reconsideracao",
    73: "Protocolo",
    74: "Recurso Ordinario",
    75: "Regulamento",
    76: "Relatorio Final",
    77: "Representacao",
    78: "Resolucao",
    79: "Revisao Criminal",
    80: "Sentenca Arbitral",
    81: "Sentenca Estrangeira",
    82: "Termo de Acordo",
    83: "Termo de Conciliacao",
    84: "Termo de Compromisso",
    85: "Termo de Deposito",
    86: "Termo de Encerramento",
    87: "Termo de Inventario",
    88: "Termo de Posse",
    89: "Termo de Responsabilidade",
    90: "Titulo de Credito",
    91: "Tutela Antecipada",
    92: "Tutela de Urgencia",
}


# =============================================================================
# Servico orquestrador
# =============================================================================

class ExtratorAutosService:
    """
    Orquestra o pipeline completo de extracao de documentos processuais.

    Coordena consulta ao TJ-MS, resolucao de categorias, classificacao BERT
    e download/empacotamento de documentos.
    """

    def __init__(self, db: Session):
        self.db = db
        self.tjms_client = TJMSClient()
        self.bert_client = BertClassifierClient()

    # ------------------------------------------------------------------
    # Consulta de processo
    # ------------------------------------------------------------------

    async def consultar_processo(
        self,
        numero_cnj: str,
        buscar_instancias: bool = False,
    ) -> Dict[str, Any]:
        """
        Consulta processo no TJ-MS e retorna dados estruturados.

        Args:
            numero_cnj: Numero CNJ do processo.
            buscar_instancias: Se True, busca dados completos incluindo movimentos.

        Returns:
            Dict com chaves: processo, documentos, total_documentos, erro.
        """
        # Extrator de Autos SEMPRE precisa dos documentos.
        # buscar_instancias controla apenas se movimentos são incluídos.
        if buscar_instancias:
            options = ConsultaOptions(tipo=TipoConsulta.COMPLETA)
        else:
            options = ConsultaOptions(
                tipo=TipoConsulta.COMPLETA,
                incluir_movimentos=False,
                incluir_documentos=True,
            )

        try:
            processo = await self.tjms_client.consultar_processo(numero_cnj, options)
        except TJMSError as e:
            logger.error("Erro ao consultar processo %s: %s", numero_cnj, e)
            return {
                "processo": None,
                "documentos": [],
                "total_documentos": 0,
                "erro": str(e),
            }

        documentos_ordenados = ordenar_documentos(processo.documentos)

        # Enriquece documentos com descricao do CATEGORIAS_MAP
        documentos_info = []
        for doc in documentos_ordenados:
            descricao_map = CATEGORIAS_MAP.get(doc.tipo_codigo, "")
            documentos_info.append({
                "id": doc.id,
                "tipo_codigo": doc.tipo_codigo,
                "tipo_descricao": doc.tipo_descricao or descricao_map,
                "descricao_mapa": descricao_map,
                "descricao": doc.descricao,
                "data_juntada": doc.data_juntada.isoformat() if doc.data_juntada else None,
                "mimetype": doc.mimetype,
                "ordem": doc.ordem,
            })

        return {
            "processo": processo.to_dict(),
            "documentos": documentos_info,
            "total_documentos": len(documentos_info),
            "xml_disponivel": processo.xml_raw is not None,
            "erro": None,
        }

    # ------------------------------------------------------------------
    # Resolucao de categorias
    # ------------------------------------------------------------------

    async def resolver_categorias(
        self,
        categorias_ids: List[int],
        codigos_add: Optional[List[int]] = None,
        codigos_remove: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Resolve categorias em lista final de codigos de documentos.

        Carrega categorias do banco, extrai codigos e aplica ajustes manuais.

        Args:
            categorias_ids: IDs das CategoriaDocumento a resolver.
            codigos_add: Codigos a adicionar manualmente.
            codigos_remove: Codigos a remover manualmente.

        Returns:
            Dict com: codigos_finais, categorias_resolvidas, regras_especiais.
        """
        categorias = (
            self.db.query(CategoriaDocumento)
            .filter(
                CategoriaDocumento.id.in_(categorias_ids),
                CategoriaDocumento.ativo == True,
            )
            .all()
        )

        if not categorias:
            return {
                "codigos_finais": list(codigos_add or []),
                "categorias_resolvidas": [],
                "regras_especiais": [],
                "total_codigos": len(codigos_add or []),
            }

        codigos_finais: Set[int] = set()
        categorias_resolvidas = []
        regras_especiais = []

        for cat in categorias:
            codigos_cat = cat.get_codigos()
            codigos_finais.update(codigos_cat)

            cat_info = {
                "id": cat.id,
                "nome": cat.nome,
                "titulo": cat.titulo,
                "codigos": codigos_cat,
                "total_codigos": len(codigos_cat),
                "is_primeiro_documento": cat.is_primeiro_documento,
                "tem_resolver_especial": cat.resolver_config is not None,
            }
            categorias_resolvidas.append(cat_info)

            if cat.is_primeiro_documento or cat.resolver_config:
                regras_especiais.append({
                    "categoria_id": cat.id,
                    "categoria_nome": cat.nome,
                    "tipo": cat.resolver_config.get("type", "primeiro_cronologico") if cat.resolver_config else "primeiro_cronologico",
                    "config": cat.resolver_config,
                })

        # Aplica ajustes manuais
        if codigos_add:
            codigos_finais.update(codigos_add)
        if codigos_remove:
            codigos_finais -= set(codigos_remove)

        return {
            "codigos_finais": sorted(codigos_finais),
            "categorias_resolvidas": categorias_resolvidas,
            "regras_especiais": regras_especiais,
            "total_codigos": len(codigos_finais),
        }

    # ------------------------------------------------------------------
    # Preview de documentos
    # ------------------------------------------------------------------

    async def preview_documentos(
        self,
        numero_cnj: str,
        codigos: Optional[List[int]] = None,
        doc_ids: Optional[List[str]] = None,
        categorias_ids: Optional[List[int]] = None,
        filtro_anos: Optional[List[int]] = None,
        filtro_mes: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Preview dos documentos que serao baixados, sem efetuar download.

        Aplica resolucao de categorias (incluindo BERT quando configurado)
        e retorna lista detalhada dos documentos selecionados.

        Args:
            numero_cnj: Numero CNJ do processo.
            codigos: Codigos de tipo de documento para filtrar.
            doc_ids: IDs especificos de documentos para incluir.
            categorias_ids: IDs de CategoriaDocumento para resolver.
            filtro_anos: Filtrar por anos (ex: [2024, 2025]).
            filtro_mes: Filtrar por mes (1-12).

        Returns:
            Dict com: documentos, resolucoes, total_selecionados, erro.
        """
        # Consulta o processo
        resultado_consulta = await self.consultar_processo(numero_cnj)
        if resultado_consulta["erro"]:
            return {
                "documentos": [],
                "resolucoes": [],
                "total_selecionados": 0,
                "total_processo": 0,
                "erro": resultado_consulta["erro"],
            }

        processo_data = resultado_consulta["processo"]
        todos_docs_info = resultado_consulta["documentos"]

        # Reconstroi lista de DocumentoMetadata para filtragem
        todos_docs = self._reconstruir_metadatas(todos_docs_info)

        # Aplica filtro de periodo
        if filtro_anos:
            todos_docs = filtrar_por_periodo(todos_docs, anos=filtro_anos, mes=filtro_mes)

        # Determina IDs selecionados
        ids_selecionados: Set[str] = set()
        resolucoes: List[Dict[str, Any]] = []

        # Caminho 1: IDs explicitos
        if doc_ids:
            ids_selecionados.update(doc_ids)

        # Caminho 2: codigos de tipo
        if codigos:
            codigos_set = set(codigos)
            for doc in todos_docs:
                if doc.tipo_codigo in codigos_set:
                    ids_selecionados.add(doc.id)

        # Caminho 3: resolucao de categorias (pode incluir BERT)
        # Mapa doc_id -> info de resolucao especial para enriquecimento
        resolucao_por_doc: Dict[str, Dict[str, Any]] = {}

        if categorias_ids:
            cat_ids, cat_resolucoes = await self._resolver_categorias_completa(
                todos_docs, categorias_ids
            )
            ids_selecionados.update(cat_ids)
            resolucoes = [self._resolution_to_dict(r) for r in cat_resolucoes]

            # Mapeia cada doc selecionado -> sua resolucao (com detalhe BERT)
            # Prioridade: primeiro_cronologico > codigo > bert
            # Se um doc ja tem resolucao nao-BERT, NAO sobrescrever com BERT
            _PRIORIDADE_METODO = {"primeiro_cronologico": 0, "codigo": 1, "bert": 2}

            for reso in cat_resolucoes:
                metodo = reso.metodo
                # Para BERT, mapear predictions por doc_id
                pred_map = {}
                if reso.bert_predictions:
                    for p in reso.bert_predictions:
                        pred_map[p["doc_id"]] = p

                for did in reso.documento_ids:
                    info: Dict[str, Any] = {
                        "metodo": metodo,
                        "categoria": reso.categoria_id,
                    }
                    if metodo == "bert":
                        if did in pred_map:
                            info["bert_status"] = pred_map[did].get("motivo", "classificado")
                        else:
                            # Doc que entrou via codigos_diretos (ex: 8320)
                            info["bert_status"] = "codigo_direto"

                    if did not in resolucao_por_doc:
                        info["resolucoes_todas"] = [info.copy()]
                        resolucao_por_doc[did] = info
                    else:
                        existing = resolucao_por_doc[did]
                        if "resolucoes_todas" not in existing:
                            existing["resolucoes_todas"] = [
                                {k: v for k, v in existing.items() if k != "resolucoes_todas"}
                            ]
                        existing["resolucoes_todas"].append(info.copy())
                        # Sobrescreve somente se nova resolucao tem maior prioridade
                        if _PRIORIDADE_METODO.get(info["metodo"], 99) < _PRIORIDADE_METODO.get(existing["metodo"], 99):
                            for k, v in info.items():
                                if k != "resolucoes_todas":
                                    existing[k] = v

        # Monta resultado enriquecido
        documentos_preview = []
        for doc_info in todos_docs_info:
            doc_id = doc_info["id"]
            selecionado = doc_id in ids_selecionados
            doc_entry = {
                **doc_info,
                "selecionado": selecionado,
            }
            if doc_id in resolucao_por_doc:
                doc_entry["resolucao_especial"] = resolucao_por_doc[doc_id]
            documentos_preview.append(doc_entry)

        return {
            "documentos": documentos_preview,
            "resolucoes": resolucoes,
            "total_selecionados": len(ids_selecionados),
            "total_processo": len(todos_docs_info),
            "processo": {
                "numero": processo_data.get("numero"),
                "numero_formatado": processo_data.get("numero_formatado"),
                "classe_processual": processo_data.get("classe_processual"),
                "comarca": processo_data.get("comarca"),
                "vara": processo_data.get("vara"),
            },
            "erro": None,
        }

    # ------------------------------------------------------------------
    # Download de documentos
    # ------------------------------------------------------------------

    async def baixar_documentos(
        self,
        numero_cnj: str,
        documento_ids: List[str],
        modo_saida: str = "pdf_txt",
        mesclar: bool = False,
        salvar_xml: bool = False,
        callback: Optional[ProgressCallback] = None,
        resolucoes_especiais: Optional[List[Dict[str, Any]]] = None,
    ) -> bytes:
        """
        Baixa documentos e retorna ZIP com o resultado.

        Args:
            numero_cnj: Numero CNJ do processo.
            documento_ids: IDs dos documentos a baixar.
            modo_saida: Formato de saida (pdf, pdf_txt, txt, xml_only).
            mesclar: Se True, mescla todos os PDFs em um unico arquivo.
            salvar_xml: Se True, inclui o XML completo do processo no ZIP.
            callback: Funcao async para reportar progresso (percent, mensagem).
            resolucoes_especiais: Config BERT para classificacao pos-download.

        Returns:
            Bytes do arquivo ZIP.
        """
        if not documento_ids:
            return await criar_zip_resultado([], numero_cnj=numero_cnj)

        total = len(documento_ids)
        await self._report_progress(callback, 5, f"Baixando {total} documento(s)...")

        # Baixa documentos via TJ-MS
        download_opts = DownloadOptions(extrair_texto=False)
        docs_baixados = await self.tjms_client.baixar_documentos(
            numero_cnj, documento_ids, download_opts
        )

        sucesso = sum(1 for d in docs_baixados.values() if d.sucesso)
        logger.info("TJ-MS: %d/%d documentos baixados com sucesso", sucesso, total)

        # Classificacao BERT pos-download (se houver categorias BERT)
        total_antes_bert = len(docs_baixados)
        if resolucoes_especiais:
            docs_baixados = await self._aplicar_bert_pos_download(
                docs_baixados, resolucoes_especiais, callback
            )
            filtrados = total_antes_bert - len(docs_baixados)
            if filtrados > 0:
                logger.info("BERT: %d filtrados de %d", filtrados, total_antes_bert)

        await self._report_progress(callback, 40, "Processando documentos...")

        # Obtem XML se necessario
        xml_completo = None
        if salvar_xml:
            xml_completo = await self._obter_xml_processo(numero_cnj)

        # Monta lista de arquivos para o ZIP
        arquivos = await self._processar_documentos_para_zip(
            numero_cnj, docs_baixados, modo_saida, callback
        )

        if not arquivos:
            logger.warning("Nenhum documento valido para empacotar no ZIP")

        await self._report_progress(callback, 85, "Empacotando resultado...")

        # Mescla PDFs se solicitado (ordena por data_juntada ASC)
        if mesclar and modo_saida in ("pdf", "pdf_txt"):
            # Consulta metadatas para ordenar cronologicamente
            metadatas_para_merge = await self._obter_metadatas_para_merge(
                numero_cnj, list(docs_baixados.keys())
            )
            resultado_merge = await self._mesclar_pdfs_baixados(
                numero_cnj, docs_baixados, docs_metadatas=metadatas_para_merge
            )
            if resultado_merge is not None:
                arquivos = [
                    a for a in arquivos if not a["nome"].endswith(".pdf")
                ]
                nome_mesclado = f"{numero_cnj}_documentos_mesclados.pdf"
                arquivos.insert(0, {
                    "nome": nome_mesclado,
                    "conteudo": resultado_merge,
                    "tipo": "pdf",
                })

        # Cria ZIP
        zip_bytes = await criar_zip_resultado(
            arquivos, xml_completo=xml_completo, numero_cnj=numero_cnj
        )

        sucesso = sum(1 for d in docs_baixados.values() if d.sucesso)
        erros = total - sucesso
        await self._report_progress(
            callback, 100,
            f"Concluido: {sucesso} baixado(s), {erros} erro(s)"
        )

        return zip_bytes

    # ------------------------------------------------------------------
    # Processamento em lote
    # ------------------------------------------------------------------

    async def processar_lote(
        self,
        numeros_cnj: List[str],
        codigos: List[int],
        modo_saida: str = "pdf_txt",
        mesclar: bool = False,
        salvar_xml: bool = False,
        agrupar_subpastas: bool = True,
        pausa: float = 2.0,
        callback: Optional[ProgressCallback] = None,
    ) -> bytes:
        """
        Processa multiplos processos em lote e retorna ZIP unificado.

        Para cada processo, consulta, filtra documentos pelos codigos fornecidos,
        baixa e adiciona ao resultado. Insere pausa entre processos para evitar
        sobrecarga no TJ-MS.

        Args:
            numeros_cnj: Lista de numeros CNJ.
            codigos: Codigos de tipo de documento a baixar.
            modo_saida: Formato de saida.
            mesclar: Se True, mescla PDFs de cada processo.
            salvar_xml: Se True, inclui XML de cada processo.
            pausa: Segundos de espera entre processos.
            callback: Funcao async para reportar progresso.

        Returns:
            Bytes do arquivo ZIP contendo todos os processos.
        """
        total_processos = len(numeros_cnj)
        todos_arquivos: List[Dict[str, Any]] = []
        codigos_set = set(codigos)

        for idx, cnj in enumerate(numeros_cnj):
            progresso_base = int((idx / total_processos) * 100)
            await self._report_progress(
                callback, progresso_base,
                f"Processo {idx + 1}/{total_processos}: {cnj}"
            )

            # Consulta processo
            resultado = await self.consultar_processo(cnj)
            if resultado["erro"]:
                logger.warning(
                    "Erro ao consultar processo %s no lote: %s",
                    cnj, resultado["erro"]
                )
                continue

            # Filtra documentos pelos codigos
            docs_info = resultado["documentos"]
            todos_docs_meta = self._reconstruir_metadatas(docs_info)
            doc_ids = [
                d["id"] for d in docs_info
                if d.get("tipo_codigo") in codigos_set
            ]

            if not doc_ids:
                logger.info("Processo %s: nenhum documento com codigos solicitados", cnj)
                continue

            # Baixa documentos
            download_opts = DownloadOptions()
            docs_baixados = await self.tjms_client.baixar_documentos(
                cnj, doc_ids, download_opts
            )

            # Processa arquivos com prefixo do processo
            arquivos_processo = await self._processar_documentos_para_zip(
                cnj, docs_baixados, modo_saida, callback=None
            )

            # Mescla PDFs do processo se solicitado (ordena cronologicamente)
            if mesclar and modo_saida in ("pdf", "pdf_txt"):
                resultado_merge = await self._mesclar_pdfs_baixados(
                    cnj, docs_baixados, docs_metadatas=todos_docs_meta
                )
                if resultado_merge is not None:
                    arquivos_processo = [
                        a for a in arquivos_processo
                        if not a["nome"].endswith(".pdf")
                    ]
                    nome_mesclado = f"{cnj}_documentos_mesclados.pdf"
                    arquivos_processo.insert(0, {
                        "nome": nome_mesclado,
                        "conteudo": resultado_merge,
                        "tipo": "pdf",
                    })

            # Adiciona pasta virtual por processo (se agrupar_subpastas=True)
            if agrupar_subpastas:
                cnj_limpo = "".join(c for c in cnj if c.isdigit() or c in "-.")
                for arq in arquivos_processo:
                    arq["nome"] = f"{cnj_limpo}/{arq['nome']}"
            todos_arquivos.extend(arquivos_processo)

            # XML do processo
            if salvar_xml:
                xml_proc = await self._obter_xml_processo(cnj)
                if xml_proc:
                    todos_arquivos.append({
                        "nome": f"{cnj_limpo}/processo_completo.xml",
                        "conteudo": xml_proc.encode("utf-8"),
                        "tipo": "xml",
                    })

            # Pausa entre processos
            if idx < total_processos - 1:
                await asyncio.sleep(pausa)

        await self._report_progress(callback, 95, "Empacotando resultado do lote...")

        zip_bytes = await criar_zip_resultado(todos_arquivos, numero_cnj="lote")

        await self._report_progress(
            callback, 100,
            f"Lote concluido: {total_processos} processo(s)"
        )

        return zip_bytes

    # ------------------------------------------------------------------
    # Processamento em lote v2 (com CategoryResolver completo)
    # ------------------------------------------------------------------

    async def processar_lote_v2(
        self,
        numeros_cnj: List[str],
        categorias_ids: List[int],
        codigos_fallback: Optional[List[int]] = None,
        modo_saida: str = "pdf_txt",
        mesclar: bool = False,
        salvar_xml: bool = False,
        agrupar_subpastas: bool = True,
        pausa: float = 2.0,
        filtro_anos: Optional[List[int]] = None,
        filtro_mes: Optional[int] = None,
        max_processos_paralelos: int = 3,
        callback: Optional[ProgressCallback] = None,
    ) -> LoteResult:
        """
        Processa multiplos processos em lote com pipeline completo de CategoryResolver.

        Diferente de processar_lote(), aplica resolucao de categorias incluindo
        BERT e PrimeiroDocumento por processo, e retorna LoteResult com metricas.

        Processos sao executados em paralelo ate o limite de max_processos_paralelos.
        Dentro de cada processo, batches de download tambem sao paralelos.
        """
        total_processos = len(numeros_cnj)
        todos_arquivos: List[Dict[str, Any]] = []
        detalhes: List[Dict[str, Any]] = []
        total_docs_baixados = 0
        total_docs_filtrados_bert = 0
        total_erros = 0
        processos_concluidos = 0

        # Lock para atualizacao thread-safe de estado compartilhado
        lock = asyncio.Lock()

        # Carrega categorias 1x fora do loop
        categorias: List[CategoriaDocumento] = []
        if categorias_ids:
            categorias = (
                self.db.query(CategoriaDocumento)
                .filter(
                    CategoriaDocumento.id.in_(categorias_ids),
                    CategoriaDocumento.ativo == True,
                )
                .all()
            )

        codigos_fallback_set = set(codigos_fallback) if codigos_fallback else set()

        # Verifica BERT 1x fora do loop
        bert_health = await self.bert_client.check_health()
        bert_service = self.bert_client if bert_health.get("available") else None
        if categorias and not bert_service:
            tem_bert = any(
                (c.resolver_config or {}).get("type") == "bert"
                for c in categorias
            )
            if tem_bert:
                logger.warning("BERT indisponivel para lote - categorias BERT usarao apenas matches diretos")

        # Semaforo para limitar processos simultaneos
        proc_semaphore = asyncio.Semaphore(max_processos_paralelos)

        async def _processar_um(idx: int, cnj: str) -> None:
            nonlocal total_docs_baixados, total_docs_filtrados_bert, total_erros, processos_concluidos

            async with proc_semaphore:
                t0 = time.monotonic()

                async with lock:
                    await self._report_progress(
                        callback, int((processos_concluidos / total_processos) * 90),
                        f"Processo {processos_concluidos + 1}/{total_processos}: {cnj}"
                    )

                detalhe: Dict[str, Any] = {
                    "cnj": cnj,
                    "status": "ok",
                    "docs_baixados": 0,
                    "docs_filtrados_bert": 0,
                    "tempo_s": 0.0,
                }

                try:
                    # 1. Consulta processo
                    resultado = await self.consultar_processo(cnj)
                    if resultado["erro"]:
                        detalhe["status"] = f"erro_consulta: {resultado['erro']}"
                        async with lock:
                            total_erros += 1
                            processos_concluidos += 1
                            detalhes.append(detalhe)
                        return

                    docs_info = resultado["documentos"]
                    todos_docs = self._reconstruir_metadatas(docs_info)

                    # 2. Filtro de periodo
                    if filtro_anos:
                        todos_docs = filtrar_por_periodo(todos_docs, anos=filtro_anos, mes=filtro_mes)

                    # 3. Resolve documentos
                    ids_selecionados: Set[str] = set()
                    resolucoes_bert: List[Dict[str, Any]] = []

                    if categorias:
                        candidatos = [
                            DocumentoCandidate(
                                id=doc.id,
                                tipo_codigo=doc.tipo_codigo or 0,
                                data_juntada=doc.data_juntada,
                                ordem=doc.ordem,
                                descricao=doc.descricao,
                                texto=None,
                            )
                            for doc in todos_docs
                        ]
                        cat_ids, cat_resolucoes = await resolve_all_categories(
                            candidatos, categorias, bert_service=bert_service
                        )
                        ids_selecionados.update(cat_ids)

                        for r in cat_resolucoes:
                            if r.metodo == "bert" and r.bert_predictions:
                                bert_candidatos = [
                                    p["doc_id"] for p in r.bert_predictions
                                    if p.get("motivo") == "candidato_pendente_bert"
                                ]
                                if bert_candidatos:
                                    resolucoes_bert.append({
                                        "tipo": "bert",
                                        "label_match": r.detalhes.get("label_match", ""),
                                        "model_run_id": r.detalhes.get("model_run_id"),
                                        "doc_ids_bert_candidatos": bert_candidatos,
                                    })

                    if codigos_fallback_set:
                        for doc in todos_docs:
                            if doc.tipo_codigo in codigos_fallback_set:
                                ids_selecionados.add(doc.id)

                    if not ids_selecionados:
                        detalhe["status"] = "sem_documentos"
                        async with lock:
                            processos_concluidos += 1
                            detalhes.append(detalhe)
                        return

                    # 4. Deduplica
                    doc_ids_unicos = sorted(ids_selecionados)

                    # 5. Download (batches paralelos via DownloadOptions defaults)
                    docs_baixados = await self.tjms_client.baixar_documentos(
                        cnj, doc_ids_unicos, DownloadOptions()
                    )

                    # 6. BERT pos-download (classifica e filtra)
                    docs_antes_bert = len(docs_baixados)
                    if resolucoes_bert and bert_service:
                        docs_baixados = await self._aplicar_bert_pos_download(
                            docs_baixados, resolucoes_bert, callback=None
                        )
                    docs_filtrados = docs_antes_bert - len(docs_baixados)
                    detalhe["docs_filtrados_bert"] = docs_filtrados

                    # 7. Processa para ZIP
                    arquivos_processo = await self._processar_documentos_para_zip(
                        cnj, docs_baixados, modo_saida, callback=None
                    )

                    # 8. Merge se solicitado (ordena cronologicamente)
                    if mesclar and modo_saida in ("pdf", "pdf_txt"):
                        resultado_merge = await self._mesclar_pdfs_baixados(
                            cnj, docs_baixados, docs_metadatas=todos_docs
                        )
                        if resultado_merge is not None:
                            arquivos_processo = [
                                a for a in arquivos_processo if not a["nome"].endswith(".pdf")
                            ]
                            nome_mesclado = f"{cnj}_documentos_mesclados.pdf"
                            arquivos_processo.insert(0, {
                                "nome": nome_mesclado,
                                "conteudo": resultado_merge,
                                "tipo": "pdf",
                            })

                    # 9. Subpasta por processo (se agrupar_subpastas=True)
                    cnj_limpo = "".join(c for c in cnj if c.isdigit() or c in "-.")
                    if agrupar_subpastas:
                        for arq in arquivos_processo:
                            arq["nome"] = f"{cnj_limpo}/{arq['nome']}"

                    docs_ok = sum(1 for d in docs_baixados.values() if d.sucesso)
                    detalhe["docs_baixados"] = docs_ok

                    # 10. XML
                    xml_arqs: List[Dict[str, Any]] = []
                    if salvar_xml:
                        xml_proc = await self._obter_xml_processo(cnj)
                        if xml_proc:
                            xml_nome = f"{cnj_limpo}/processo_completo.xml" if agrupar_subpastas else f"{cnj_limpo}_processo_completo.xml"
                            xml_arqs.append({
                                "nome": xml_nome,
                                "conteudo": xml_proc.encode("utf-8"),
                                "tipo": "xml",
                            })

                    # Atualiza estado compartilhado sob lock
                    async with lock:
                        todos_arquivos.extend(arquivos_processo)
                        todos_arquivos.extend(xml_arqs)
                        total_docs_baixados += docs_ok
                        total_docs_filtrados_bert += docs_filtrados
                        processos_concluidos += 1

                        await self._report_progress(
                            callback,
                            int((processos_concluidos / total_processos) * 90),
                            f"Concluido {processos_concluidos}/{total_processos}: "
                            f"{cnj} ({docs_ok} doc(s))"
                        )

                except Exception as e:
                    logger.exception("Erro ao processar processo %s no lote: %s", cnj, e)
                    detalhe["status"] = f"erro: {str(e)}"
                    async with lock:
                        total_erros += 1
                        processos_concluidos += 1

                detalhe["tempo_s"] = round(time.monotonic() - t0, 1)
                async with lock:
                    detalhes.append(detalhe)

        # Lanca todos os processos em paralelo (limitados pelo semaforo)
        await asyncio.gather(
            *[_processar_um(idx, cnj) for idx, cnj in enumerate(numeros_cnj)]
        )

        await self._report_progress(callback, 95, "Empacotando resultado do lote...")

        zip_bytes = await criar_zip_resultado(todos_arquivos, numero_cnj="lote")

        total_processados = sum(1 for d in detalhes if d["status"] == "ok")
        await self._report_progress(
            callback, 100,
            f"Lote concluido: {total_processados}/{total_processos} processo(s), "
            f"{total_docs_baixados} doc(s)"
        )

        return LoteResult(
            zip_bytes=zip_bytes,
            total_processos=total_processos,
            total_processados=total_processados,
            total_erros=total_erros,
            total_docs_baixados=total_docs_baixados,
            total_docs_filtrados_bert=total_docs_filtrados_bert,
            detalhes_por_processo=detalhes,
        )

    # ------------------------------------------------------------------
    # Resumo do lote (sem consultar TJ-MS)
    # ------------------------------------------------------------------

    async def resumo_lote(
        self,
        categorias_ids: List[int],
        codigos_add: Optional[List[int]] = None,
        codigos_remove: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Resolve categorias e retorna metadados do lote sem consultar TJ-MS.

        Util para mostrar resumo ao usuario antes de iniciar download.
        """
        categorias_info: List[Dict[str, Any]] = []
        codigos_totais: Set[int] = set()
        tem_bert = False
        tem_primeiro_doc = False

        if categorias_ids:
            categorias = (
                self.db.query(CategoriaDocumento)
                .filter(
                    CategoriaDocumento.id.in_(categorias_ids),
                    CategoriaDocumento.ativo == True,
                )
                .all()
            )

            for cat in categorias:
                codigos_cat = cat.get_codigos()
                codigos_totais.update(codigos_cat)

                resolver_tipo = "codigo"
                if cat.resolver_config and isinstance(cat.resolver_config, dict):
                    resolver_tipo = cat.resolver_config.get("type", "codigo")
                elif cat.is_primeiro_documento:
                    resolver_tipo = "primeiro_cronologico"

                if resolver_tipo == "bert":
                    tem_bert = True
                if resolver_tipo == "primeiro_cronologico":
                    tem_primeiro_doc = True

                categorias_info.append({
                    "id": cat.id,
                    "nome": cat.nome,
                    "titulo": cat.titulo,
                    "resolver_tipo": resolver_tipo,
                    "total_codigos": len(codigos_cat),
                })

        if codigos_add:
            codigos_totais.update(codigos_add)
        if codigos_remove:
            codigos_totais -= set(codigos_remove)

        aviso = None
        if tem_bert:
            bert_health = await self.bert_client.check_health()
            if not bert_health.get("available"):
                aviso = (
                    "O classificador BERT esta indisponivel. Categorias BERT "
                    "usarao apenas matches diretos por codigo."
                )

        return {
            "categorias_selecionadas": categorias_info,
            "total_codigos_unicos": len(codigos_totais),
            "tem_categorias_bert": tem_bert,
            "tem_categorias_primeiro_doc": tem_primeiro_doc,
            "aviso": aviso,
        }

    # ------------------------------------------------------------------
    # BERT
    # ------------------------------------------------------------------

    async def classificar_bert(self, texto: str) -> Dict[str, Any]:
        """
        Classifica texto arbitrario usando o modelo BERT.

        Args:
            texto: Texto a classificar.

        Returns:
            Dict com predicted_label, confidence, source.
        """
        return await self.bert_client.classify(texto)

    async def verificar_bert_health(self) -> Dict[str, Any]:
        """
        Verifica disponibilidade do servico BERT.

        Returns:
            Dict com available, mode, error.
        """
        return await self.bert_client.check_health()

    # ------------------------------------------------------------------
    # Categorias e codigos
    # ------------------------------------------------------------------

    async def obter_categorias_disponiveis(self) -> List[Dict[str, Any]]:
        """
        Retorna todas as categorias de documento ativas com informacoes
        de resolver.

        Returns:
            Lista de dicts com id, nome, titulo, codigos, resolver info.
        """
        categorias = (
            self.db.query(CategoriaDocumento)
            .filter(CategoriaDocumento.ativo == True)
            .order_by(CategoriaDocumento.ordem)
            .all()
        )

        resultado = []
        for cat in categorias:
            resolver_tipo = "codigo"
            if cat.resolver_config and isinstance(cat.resolver_config, dict):
                resolver_tipo = cat.resolver_config.get("type", "codigo")
            elif cat.is_primeiro_documento:
                resolver_tipo = "primeiro_cronologico"

            resultado.append({
                "id": cat.id,
                "nome": cat.nome,
                "titulo": cat.titulo,
                "descricao": cat.descricao,
                "codigos": cat.get_codigos(),
                "total_codigos": len(cat.get_codigos()),
                "cor": cat.cor,
                "is_primeiro_documento": cat.is_primeiro_documento,
                "resolver_tipo": resolver_tipo,
                "resolver_config": cat.resolver_config,
                "ordem": cat.ordem,
            })

        return resultado

    async def obter_codigos_map(self) -> Dict[int, str]:
        """
        Retorna o mapa completo de codigo de documento -> descricao.

        Returns:
            Dict[int, str] com todos os codigos conhecidos.
        """
        return dict(CATEGORIAS_MAP)

    # ------------------------------------------------------------------
    # Metodos auxiliares (privados)
    # ------------------------------------------------------------------

    def _reconstruir_metadatas(
        self, docs_info: List[Dict[str, Any]]
    ) -> List[DocumentoMetadata]:
        """Reconstroi objetos DocumentoMetadata a partir de dicts serializados."""
        resultado = []
        for d in docs_info:
            data_juntada = None
            if d.get("data_juntada"):
                try:
                    data_juntada = datetime.fromisoformat(d["data_juntada"])
                except (ValueError, TypeError):
                    pass

            resultado.append(DocumentoMetadata(
                id=d["id"],
                tipo_codigo=d.get("tipo_codigo"),
                tipo_descricao=d.get("tipo_descricao"),
                descricao=d.get("descricao"),
                data_juntada=data_juntada,
                mimetype=d.get("mimetype"),
                ordem=d.get("ordem", 0),
            ))

        return resultado

    async def _resolver_categorias_completa(
        self,
        todos_docs: List[DocumentoMetadata],
        categorias_ids: List[int],
    ) -> Tuple[Set[str], List[ResolutionResult]]:
        """
        Executa resolucao completa de categorias incluindo BERT.

        Converte DocumentoMetadata para DocumentoCandidate e delega
        para resolve_all_categories.
        """
        categorias = (
            self.db.query(CategoriaDocumento)
            .filter(
                CategoriaDocumento.id.in_(categorias_ids),
                CategoriaDocumento.ativo == True,
            )
            .all()
        )

        if not categorias:
            return set(), []

        # Converte para DocumentoCandidate
        candidatos = [
            DocumentoCandidate(
                id=doc.id,
                tipo_codigo=doc.tipo_codigo or 0,
                data_juntada=doc.data_juntada,
                ordem=doc.ordem,
                descricao=doc.descricao,
                texto=None,
            )
            for doc in todos_docs
        ]

        # Verifica se BERT esta disponivel
        bert_health = await self.bert_client.check_health()
        bert_service = self.bert_client if bert_health.get("available") else None

        return await resolve_all_categories(
            candidatos, categorias, bert_service=bert_service
        )

    async def _aplicar_bert_pos_download(
        self,
        docs_baixados: Dict[str, DocumentoTJMS],
        resolucoes: List[Dict[str, Any]],
        callback: Optional[ProgressCallback] = None,
    ) -> Dict[str, DocumentoTJMS]:
        """
        Classifica documentos via BERT apos download dos PDFs.

        Para cada resolucao BERT, extrai texto dos candidatos, classifica
        via BERT e remove os que nao correspondem ao label esperado.
        Documentos com codigos diretos (ex: 8320) sao mantidos sem BERT.

        Args:
            docs_baixados: Dict doc_id -> DocumentoTJMS baixado.
            resolucoes: Lista de configs BERT do frontend (tipo, label_match, doc_ids_bert_candidatos).
            callback: Callback de progresso.

        Returns:
            Dict filtrado (sem os docs que BERT rejeitou).
        """
        bert_configs = [r for r in resolucoes if r.get("tipo") == "bert"]
        if not bert_configs:
            return docs_baixados

        # Safety net: docs que NAO sao candidatos BERT nao devem ser removidos,
        # mesmo que aparecam em docs_baixados (protegidos por resolver nao-BERT)
        all_bert_candidate_ids: Set[str] = set()
        for config in bert_configs:
            all_bert_candidate_ids.update(config.get("doc_ids_bert_candidatos", []))
        protected_ids = set(docs_baixados.keys()) - all_bert_candidate_ids

        # Verifica BERT
        bert_health = await self.bert_client.check_health()
        if not bert_health.get("available"):
            logger.warning(
                "BERT indisponivel para classificacao pos-download. "
                "Mantendo apenas matches diretos."
            )
            # Remove BERT candidates (keep only direct matches), exceto protegidos
            for config in bert_configs:
                for doc_id in config.get("doc_ids_bert_candidatos", []):
                    if doc_id in protected_ids:
                        logger.warning(
                            "BERT indisponivel: doc %s protegido por resolver nao-BERT - mantido",
                            doc_id,
                        )
                        continue
                    docs_baixados.pop(doc_id, None)
            return docs_baixados

        docs_para_remover: Set[str] = set()
        total_candidatos = sum(
            len(c.get("doc_ids_bert_candidatos", [])) for c in bert_configs
        )
        classificados = 0

        for config in bert_configs:
            label_match = config.get("label_match", "")
            label_norm = _normalizar_label(label_match)
            candidatos_ids = config.get("doc_ids_bert_candidatos", [])
            # Modelo BERT associado a esta categoria
            model_run_id = config.get("model_run_id")
            model_name = f"model_run_{model_run_id}" if model_run_id else None

            for doc_id in candidatos_ids:
                if doc_id not in docs_baixados:
                    continue
                doc = docs_baixados[doc_id]
                classificados += 1

                await self._report_progress(
                    callback, 25 + int((classificados / max(total_candidatos, 1)) * 15),
                    f"Classificando BERT {classificados}/{total_candidatos}..."
                )

                if not doc.sucesso or not doc.conteudo_bytes:
                    logger.info("BERT: doc %s sem conteudo - excluido", doc_id)
                    docs_para_remover.add(doc_id)
                    continue

                # Extrai texto do PDF
                texto = await pdf_to_text(doc.conteudo_bytes)
                if not texto or len(texto.strip()) < 50:
                    logger.info("BERT: doc %s sem texto extraivel - excluido", doc_id)
                    docs_para_remover.add(doc_id)
                    continue

                # Classifica via BERT
                try:
                    resultado = await self.bert_client.classify(texto, model_name=model_name)
                    pred_label = resultado.get("predicted_label", "")
                    pred_norm = _normalizar_label(pred_label)
                    confidence = resultado.get("confidence", 0.0)

                    if pred_norm == label_norm:
                        logger.info(
                            "BERT: doc %s => '%s' (%.1f%%) - INCLUIDO",
                            doc_id, pred_label, confidence * 100,
                        )
                    else:
                        logger.info(
                            "BERT: doc %s => '%s' (%.1f%%, esperado: '%s') - EXCLUIDO",
                            doc_id, pred_label, confidence * 100, label_match,
                        )
                        docs_para_remover.add(doc_id)
                except Exception as e:
                    logger.error("BERT: erro ao classificar doc %s: %s", doc_id, e)
                    docs_para_remover.add(doc_id)

        # Remove docs que BERT rejeitou, exceto protegidos por resolver nao-BERT
        for doc_id in docs_para_remover:
            if doc_id in protected_ids:
                logger.warning(
                    "BERT rejeitou doc %s mas protegido por resolver nao-BERT - mantido",
                    doc_id,
                )
                continue
            docs_baixados.pop(doc_id, None)

        mantidos = total_candidatos - len(docs_para_remover)
        logger.info(
            "BERT pos-download: %d/%d candidato(s) confirmado(s) como '%s'",
            mantidos, total_candidatos, label_match,
        )
        await self._report_progress(
            callback, 40,
            f"BERT: {mantidos}/{total_candidatos} confirmado(s) como {label_match}"
        )

        return docs_baixados

    async def _processar_documentos_para_zip(
        self,
        numero_cnj: str,
        docs_baixados: Dict[str, DocumentoTJMS],
        modo_saida: str,
        callback: Optional[ProgressCallback] = None,
    ) -> List[Dict[str, Any]]:
        """
        Processa documentos baixados e converte para o formato de saida.

        Gera lista de dicts com nome, conteudo e tipo prontos para o ZIP.
        """
        arquivos: List[Dict[str, Any]] = []
        total = len(docs_baixados)
        cnj_limpo = "".join(c for c in numero_cnj if c.isdigit())

        for idx, (doc_id, doc) in enumerate(docs_baixados.items()):
            if not doc.sucesso:
                logger.warning("Doc %s falhou: %s", doc_id, doc.erro)
                continue

            indice = idx + 1
            tipo_codigo = 0
            descricao = f"doc_{doc_id}"
            data_juntada = None

            # Detecta formato real
            is_rtf = detectar_rtf(doc.conteudo_bytes) if doc.conteudo_bytes else False
            extensao_real = "rtf" if is_rtf else "pdf"

            # PDF/arquivo original
            if modo_saida in ("pdf", "pdf_txt"):
                nome = gerar_nome_arquivo(
                    cnj_limpo, tipo_codigo, descricao,
                    data_juntada, indice, extensao_real
                )
                arquivos.append({
                    "nome": nome,
                    "conteudo": doc.conteudo_bytes,
                    "tipo": extensao_real,
                })

            # Texto extraido
            if modo_saida in ("txt", "pdf_txt"):
                texto = await pdf_to_text(doc.conteudo_bytes)
                if texto:
                    nome_txt = gerar_nome_arquivo(
                        cnj_limpo, tipo_codigo, descricao,
                        data_juntada, indice, "txt"
                    )
                    arquivos.append({
                        "nome": nome_txt,
                        "conteudo": texto,
                        "tipo": "txt",
                    })

            # Reporta progresso parcial
            if callback and total > 0:
                percent = 40 + int((idx / total) * 45)
                await self._report_progress(
                    callback, percent,
                    f"Processando documento {indice}/{total}"
                )

        logger.info("ZIP: %d arquivo(s) gerados para processo %s", len(arquivos), numero_cnj)
        return arquivos

    async def _mesclar_pdfs_baixados(
        self,
        numero_cnj: str,
        docs_baixados: Dict[str, DocumentoTJMS],
        docs_metadatas: Optional[List[DocumentoMetadata]] = None,
    ) -> Optional[bytes]:
        """Mescla todos os PDFs baixados com sucesso em um unico arquivo.

        Se docs_metadatas for fornecido, ordena por data_juntada ASC (mais antigo primeiro).
        Caso contrario, usa a ordem de iteracao do dict.
        """
        if docs_metadatas:
            # Ordena metadatas cronologicamente (mais antigo primeiro)
            ordenados = ordenar_documentos(docs_metadatas)
            pdf_items: List[Tuple[str, bytes]] = []
            for meta in ordenados:
                doc = docs_baixados.get(meta.id)
                if doc and doc.sucesso and doc.conteudo_bytes:
                    pdf_items.append((meta.id, doc.conteudo_bytes))
        else:
            pdf_items = [
                (doc_id, doc.conteudo_bytes)
                for doc_id, doc in docs_baixados.items()
                if doc.sucesso and doc.conteudo_bytes
            ]

        if not pdf_items:
            return None

        return await mesclar_pdfs(pdf_items)

    async def _obter_metadatas_para_merge(
        self,
        numero_cnj: str,
        doc_ids: List[str],
    ) -> Optional[List[DocumentoMetadata]]:
        """Obtem metadatas dos documentos para ordenar a mesclagem cronologicamente."""
        try:
            resultado = await self.consultar_processo(numero_cnj)
            if resultado["erro"]:
                return None
            todos = self._reconstruir_metadatas(resultado["documentos"])
            ids_set = set(doc_ids)
            return [m for m in todos if m.id in ids_set]
        except Exception as e:
            logger.debug("Falha ao obter metadatas para merge: %s", e)
            return None

    async def _obter_xml_processo(self, numero_cnj: str) -> Optional[str]:
        """Obtem o XML bruto do processo consultando TJ-MS."""
        try:
            processo = await self.tjms_client.consultar_processo(
                numero_cnj, ConsultaOptions(tipo=TipoConsulta.COMPLETA)
            )
            return processo.xml_raw
        except TJMSError as e:
            logger.warning("Falha ao obter XML do processo %s: %s", numero_cnj, e)
            return None

    @staticmethod
    def _resolution_to_dict(result: ResolutionResult) -> Dict[str, Any]:
        """Converte ResolutionResult para dict serializavel."""
        return {
            "categoria_id": result.categoria_id,
            "categoria_nome": result.categoria_nome,
            "documento_ids": result.documento_ids,
            "metodo": result.metodo,
            "detalhes": result.detalhes,
            "bert_predictions": result.bert_predictions,
            "total_documentos": len(result.documento_ids),
        }

    @staticmethod
    async def _report_progress(
        callback: Optional[ProgressCallback],
        percent: int,
        mensagem: str,
    ) -> None:
        """Reporta progresso via callback se disponivel."""
        if callback is None:
            return
        try:
            await callback(percent, mensagem)
        except Exception as e:
            logger.debug("Erro ao reportar progresso: %s", e)
