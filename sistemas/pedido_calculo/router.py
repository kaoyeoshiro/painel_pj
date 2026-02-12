# sistemas/pedido_calculo/router.py
"""
Router do sistema de Pedido de Cálculo

Endpoints:
- POST /processar-xml: Processa XML do processo (Agente 1)
- POST /baixar-documentos: Baixa documentos identificados
- POST /extrair-informacoes: Extrai informações dos PDFs (Agente 2)
- POST /gerar-pedido: Gera pedido de cálculo (Agente 3)
- POST /processar-stream: Pipeline completo com SSE
- POST /exportar-docx: Exporta para DOCX

Autor: LAB/PGE-MS
"""

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user, get_current_user_from_token_or_query
from auth.models import User
from database.connection import get_db
from .schemas import (
    ProcessarXMLRequest,
    BaixarDocumentosRequest,
    ExtrairInformacoesRequest,
    GerarPedidoRequest,
    ProcessarStreamRequest,
    ExportarDocxRequest,
    FeedbackRequest,
    EditarPedidoRequest,
    PromptConfigRequest,
    ConfiguracaoRequest,
)
from utils.timezone import to_iso_utc
from admin.models import ConfiguracaoIA, PromptConfig
from services.ia_params_resolver import get_ia_params
from .models import GeracaoPedidoCalculo, FeedbackPedidoCalculo
from .repositories import (
    GeracaoPedidoCalculoRepository, FeedbackPedidoCalculoRepository,
    get_geracao_pedido_repo, get_feedback_pedido_repo,
)

from .services import PedidoCalculoService
from .models import ResultadoAgente1, ResultadoAgente2
from .ia_logger import create_logger

# SECURITY: Rate Limiting para endpoints de IA
from utils.rate_limit import limiter, LIMITS, get_user_identifier
from utils.quota_manager import check_ai_quota


def _converter_rtf_para_pdf(rtf_bytes: bytes) -> bytes:
    """
    Converte documento RTF para PDF.

    Usa striprtf para extrair texto e PyMuPDF para gerar PDF.
    """
    import io
    import re

    try:
        # Tenta usar striprtf se disponível
        try:
            from striprtf.striprtf import rtf_to_text
            texto = rtf_to_text(rtf_bytes.decode('latin-1', errors='ignore'))
        except ImportError:
            # Fallback: extrai texto manualmente removendo comandos RTF
            texto = rtf_bytes.decode('latin-1', errors='ignore')
            # Remove comandos RTF básicos
            texto = re.sub(r'\\[a-z]+\d*\s?', '', texto)
            texto = re.sub(r'[{}]', '', texto)
            texto = texto.replace('\\par', '\n')
            texto = texto.replace('\r\n', '\n')

        # Gera PDF usando PyMuPDF
        import fitz

        # Cria novo documento PDF
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)  # A4

        # Configurações de texto
        font_size = 10
        margin = 50
        max_width = 595 - (2 * margin)
        y_position = margin

        # Divide texto em linhas
        linhas = texto.split('\n')

        for linha in linhas:
            if not linha.strip():
                y_position += font_size
                continue

            # Quebra linha se muito longa
            while linha:
                # Calcula quantos caracteres cabem na linha
                chars_por_linha = int(max_width / (font_size * 0.5))
                parte = linha[:chars_por_linha]
                linha = linha[chars_por_linha:]

                # Nova página se necessário
                if y_position > 842 - margin:
                    page = doc.new_page(width=595, height=842)
                    y_position = margin

                # Insere texto
                page.insert_text(
                    (margin, y_position),
                    parte,
                    fontsize=font_size,
                    fontname="helv"
                )
                y_position += font_size * 1.2

        # Salva em bytes
        pdf_bytes = doc.tobytes()
        doc.close()

        return pdf_bytes

    except Exception as e:
        print(f"[ERRO] Falha ao converter RTF para PDF: {e}")
        # Retorna um PDF de erro
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), f"Erro ao converter documento RTF: {str(e)}", fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes


router = APIRouter(tags=["Pedido de Cálculo"])

# Nome do sistema para configurações
SISTEMA = "pedido_calculo"

# Diretório temporário para arquivos DOCX
TEMP_DIR = os.path.join(os.path.dirname(__file__), 'temp_docs')
os.makedirs(TEMP_DIR, exist_ok=True)


# ============================================
# Endpoints
# ============================================

@router.post("/processar-xml")
async def processar_xml(
    req: ProcessarXMLRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Processa XML do processo (Agente 1).
    
    Extrai dados básicos, identifica documentos para download
    e movimentos relevantes.
    """
    try:
        service = PedidoCalculoService()
        resultado, erro = await service.processar_xml(req.xml_texto)
        
        if erro:
            raise HTTPException(status_code=400, detail=erro)
        
        return {
            "status": "sucesso",
            "dados": resultado.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/baixar-documentos")
async def baixar_documentos(
    req: BaixarDocumentosRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Baixa documentos identificados do TJ-MS.
    
    Retorna textos extraídos dos PDFs.
    """
    try:
        from .document_downloader import DocumentDownloader
        
        async with DocumentDownloader() as downloader:
            textos = await downloader.baixar_todos_relevantes(
                req.numero_processo,
                ids_sentencas=req.ids_sentencas,
                ids_acordaos=req.ids_acordaos,
                ids_certidoes=req.ids_certidoes,
                ids_cumprimento=req.ids_cumprimento
            )
        
        return {
            "status": "sucesso",
            "documentos_baixados": len(textos),
            "textos": textos
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extrair-informacoes")
async def extrair_informacoes(
    req: ExtrairInformacoesRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Extrai informações dos documentos (Agente 2).
    
    Analisa textos e extrai dados estruturados.
    """
    try:
        service = PedidoCalculoService()
        resultado, erro = await service.extrair_informacoes(req.textos_documentos)
        
        if erro:
            raise HTTPException(status_code=400, detail=erro)
        
        return {
            "status": "sucesso",
            "dados": resultado.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gerar-pedido")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def gerar_pedido(
    request: Request,
    req: GerarPedidoRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Gera pedido de cálculo (Agente 3).

    Retorna documento em formato Markdown.
    """
    await check_ai_quota(current_user)
    try:
        from .agentes import Agente3GeracaoPedido
        from .models import (
            ResultadoAgente1, ResultadoAgente2,
            DadosBasicos, DocumentosParaDownload, MovimentosRelevantes,
            PeriodoCondenacao, CorrecaoMonetaria, JurosMoratorios,
            DatasProcessuais, CalculoExequente
        )
        
        # Reconstrói objetos a partir dos dicts
        db = req.dados_agente1.get("dados_basicos", {})
        dados_basicos = DadosBasicos(
            numero_processo=db.get("numero_processo", ""),
            autor=db.get("autor", ""),
            cpf_autor=db.get("cpf_autor"),
            reu=db.get("reu", "Estado de Mato Grosso do Sul"),
            comarca=db.get("comarca"),
            vara=db.get("vara")
        )
        
        agente1 = ResultadoAgente1(
            dados_basicos=dados_basicos,
            documentos_para_download=DocumentosParaDownload(),
            movimentos_relevantes=MovimentosRelevantes()
        )
        
        # Reconstrói Agente 2
        ext = req.dados_agente2
        agente2 = ResultadoAgente2(
            objeto_condenacao=ext.get("objeto_condenacao"),
            valor_solicitado_parte=ext.get("valor_solicitado_parte"),
            criterios_calculo=ext.get("criterios_calculo", [])
        )
        
        # Período
        periodo = ext.get("periodo_condenacao", {})
        if periodo:
            agente2.periodo_condenacao = PeriodoCondenacao(
                inicio=periodo.get("inicio"),
                fim=periodo.get("fim")
            )
        
        # Correção
        cm = ext.get("correcao_monetaria", {})
        if cm:
            agente2.correcao_monetaria = CorrecaoMonetaria(
                indice=cm.get("indice"),
                termo_inicial=cm.get("termo_inicial"),
                termo_final=cm.get("termo_final"),
                observacao=cm.get("observacao")
            )
        
        # Juros
        juros = ext.get("juros_moratorios", {})
        if juros:
            agente2.juros_moratorios = JurosMoratorios(
                taxa=juros.get("taxa"),
                termo_inicial=juros.get("termo_inicial"),
                termo_final=juros.get("termo_final"),
                observacao=juros.get("observacao")
            )
        
        # Datas
        datas = ext.get("datas", {})
        if datas:
            from datetime import datetime
            def parse_date(s):
                if not s:
                    return None
                try:
                    return datetime.strptime(s[:10], "%d/%m/%Y").date()
                except:
                    return None
            
            agente2.datas = DatasProcessuais(
                citacao_recebimento=parse_date(datas.get("citacao_recebimento")),
                transito_julgado=parse_date(datas.get("transito_julgado")),
                intimacao_impugnacao_recebimento=parse_date(datas.get("intimacao_impugnacao_recebimento"))
            )
        
        # Cálculo exequente
        calc = ext.get("calculo_exequente", {})
        if calc:
            agente2.calculo_exequente = CalculoExequente(
                valor_total=calc.get("valor_total"),
                data_base=calc.get("data_base")
            )
        
        # Gera pedido
        agente3 = Agente3GeracaoPedido()
        markdown = await agente3.gerar(agente1, agente2)
        
        return {
            "status": "sucesso",
            "pedido_markdown": markdown
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/processar-stream")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def processar_stream(
    request: Request,
    req: ProcessarStreamRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Processa processo via número CNJ com streaming SSE.

    Pipeline completo: Consulta TJ-MS → XML → Documentos → Extração → Geração.
    Lógica delegada ao PedidoCalculoStreamService.
    """
    await check_ai_quota(current_user)

    from database.connection import SessionLocal
    from .services_stream import PedidoCalculoStreamService

    ia_logger = create_logger()
    db_session = SessionLocal()
    service = PedidoCalculoService(logger=ia_logger)

    stream_service = PedidoCalculoStreamService(
        db=db_session,
        user=current_user,
        service=service,
        numero_cnj=req.numero_cnj,
        sobrescrever_existente=req.sobrescrever_existente,
    )

    async def event_generator():
        try:
            async for event in stream_service.processar_stream():
                yield event
        finally:
            db_session.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/exportar-docx")
async def exportar_docx(
    req: ExportarDocxRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Exporta pedido de cálculo para DOCX.
    Usa conversor específico SEM recuos.
    """
    try:
        from .docx_converter import pedido_calculo_to_docx
        
        # Gera nome do arquivo
        file_id = str(uuid.uuid4())[:8]
        if req.numero_processo:
            numero_limpo = ''.join(c for c in req.numero_processo if c.isdigit())[-8:]
            filename = f"pedido_calculo_{numero_limpo}_{file_id}.docx"
        else:
            filename = f"pedido_calculo_{file_id}.docx"
        
        filepath = os.path.join(TEMP_DIR, filename)
        
        # Converte usando o conversor específico para pedido de cálculo (sem recuos)
        success = pedido_calculo_to_docx(req.markdown, filepath)
        
        if not success:
            raise HTTPException(status_code=500, detail="Erro ao gerar DOCX")
        
        return {
            "status": "sucesso",
            "url_download": f"/pedido-calculo/api/download/{filename}",
            "filename": filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
async def download_documento(
    filename: str,
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_from_token_or_query)
):
    """Download do documento gerado"""
    filepath = os.path.join(TEMP_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename
    )


@router.get("/documento/{numero_processo}/{id_documento}")
async def obter_documento(
    numero_processo: str,
    id_documento: str,
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_from_token_or_query)
):
    """
    Obtém um documento específico do TJ-MS.

    Retorna o PDF em base64 para visualização no frontend.
    Converte RTF para PDF se necessário.
    """
    try:
        from .document_downloader import DocumentDownloader
        import base64

        async with DocumentDownloader() as downloader:
            docs = await downloader.baixar_documentos(numero_processo, [id_documento])

        if not docs or id_documento not in docs:
            raise HTTPException(status_code=404, detail="Documento não encontrado")

        doc_bytes = docs[id_documento]

        # Verifica se é RTF e converte para PDF
        if doc_bytes.startswith(b'{\\rtf'):
            pdf_bytes = _converter_rtf_para_pdf(doc_bytes)
        else:
            pdf_bytes = doc_bytes

        # Valida PDF para evitar documentos corrompidos
        try:
            import fitz
            with fitz.open(stream=pdf_bytes, filetype="pdf") as _doc:
                pass
        except Exception:
            raise HTTPException(status_code=422, detail="Documento invalido ou corrompido")

        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

        return {
            "id": id_documento,
            "conteudo_base64": pdf_base64,
            "tipo": "application/pdf"
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verificar-existente")
async def verificar_processo_existente(
    numero_cnj: str,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPedidoCalculoRepository = Depends(get_geracao_pedido_repo),
):
    """
    Verifica se um processo já existe no histórico do usuário.
    Retorna informações sobre o registro existente se encontrado.
    """
    from datetime import timezone, timedelta

    # Normaliza o número CNJ (remove formatação)
    numero_cnj_limpo = numero_cnj.replace(".", "").replace("-", "").replace("/", "").strip()

    # Busca registro existente
    geracao_existente = repo.find_latest_by_cnj_and_user(numero_cnj_limpo, current_user.id)

    if not geracao_existente:
        return {"existe": False}

    # Timezone de Brasília (UTC-3)
    tz_brasilia = timezone(timedelta(hours=-3))

    def converter_para_brasilia(dt):
        if not dt:
            return None
        dt_utc = dt.replace(tzinfo=timezone.utc)
        dt_brasilia = dt_utc.astimezone(tz_brasilia)
        return dt_brasilia.strftime("%d/%m/%Y às %H:%M")

    return {
        "existe": True,
        "geracao_id": geracao_existente.id,
        "numero_cnj_formatado": geracao_existente.numero_cnj_formatado,
        "criado_em": converter_para_brasilia(geracao_existente.criado_em),
        "autor": geracao_existente.dados_processo.get("autor") if geracao_existente.dados_processo else None
    }


@router.get("/historico")
async def listar_historico(
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPedidoCalculoRepository = Depends(get_geracao_pedido_repo),
):
    """
    Lista histórico de pedidos de cálculo gerados pelo usuário.
    Ordenado por data de criação (mais recentes primeiro).
    """

    historico = repo.find_by_user(current_user.id)

    return [
        {
            "id": h.id,
            "numero_cnj": h.numero_cnj,
            "numero_cnj_formatado": h.numero_cnj_formatado,
            "dados_processo": h.dados_processo,
            "conteudo_gerado": h.conteudo_gerado,
            "documentos_baixados": h.documentos_baixados,
            "criado_em": to_iso_utc(h.criado_em),
            "tempo_processamento": h.tempo_processamento
        }
        for h in historico
    ]


@router.get("/historico/{id}")
async def obter_historico(
    id: int,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPedidoCalculoRepository = Depends(get_geracao_pedido_repo),
):
    """
    Obtém um pedido específico do histórico.
    """

    geracao = repo.find_by_id_and_user(id, current_user.id)

    if not geracao:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    return {
        "id": geracao.id,
        "numero_cnj": geracao.numero_cnj,
        "numero_cnj_formatado": geracao.numero_cnj_formatado,
        "dados_processo": geracao.dados_processo,
        "dados_agente1": geracao.dados_agente1,
        "dados_agente2": geracao.dados_agente2,
        "documentos_baixados": geracao.documentos_baixados,
        "conteudo_gerado": geracao.conteudo_gerado,
        "historico_chat": geracao.historico_chat,
        "criado_em": to_iso_utc(geracao.criado_em),
        "tempo_processamento": geracao.tempo_processamento
    }


@router.post("/editar-pedido")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def editar_pedido(
    request: Request,
    req: EditarPedidoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Edita pedido de cálculo via chat com IA.
    """
    await check_ai_quota(current_user)
    try:
        # Busca prompt do banco de dados
        prompt_db = db.query(PromptConfig).filter(
            PromptConfig.sistema == SISTEMA,
            PromptConfig.tipo == "edicao_pedido",
            PromptConfig.is_active == True
        ).first()
        
        # Busca parametros de IA via resolver (hierarquia: agente → sistema → global → default)
        ia_params = get_ia_params(db, "pedido_calculo", "edicao")
        
        # Monta prompt de edição
        if prompt_db:
            prompt_edicao = prompt_db.conteudo.format(
                mensagem_usuario=req.mensagem_usuario,
                pedido_markdown=req.pedido_markdown,
                autor=req.dados_basicos.get('autor', 'N/A'),
                numero_processo=req.dados_basicos.get('numero_processo', 'N/A'),
                objeto_condenacao=req.dados_extracao.get('objeto_condenacao', 'N/A')
            )
        else:
            # Fallback para prompt padrão
            prompt_edicao = f"""Você é um assistente especializado em editar pedidos de cálculo judicial.

O usuário solicitou a seguinte alteração no pedido de cálculo:

"{req.mensagem_usuario}"

## Pedido Atual (Markdown):
{req.pedido_markdown}

## Dados do Processo:
- Autor: {req.dados_basicos.get('autor', 'N/A')}
- Processo: {req.dados_basicos.get('numero_processo', 'N/A')}
- Objeto: {req.dados_extracao.get('objeto_condenacao', 'N/A')}

## Instruções:
1. Aplique APENAS a alteração solicitada pelo usuário
2. Mantenha toda a estrutura e formatação do pedido
3. Retorne o pedido completo atualizado em Markdown
4. NÃO adicione comentários ou explicações, apenas o pedido atualizado

Pedido atualizado:"""

        # Chama a IA via Gemini Service
        from services.gemini_service import gemini_service

        response = await gemini_service.generate(
            prompt=prompt_edicao,
            model=ia_params.modelo,
            temperature=ia_params.temperatura,
            max_tokens=ia_params.max_tokens,
            thinking_level=ia_params.thinking_level,
        )
        
        if not response.success or not response.content:
            return {
                "status": "erro",
                "mensagem": response.error or "Não foi possível processar a edição"
            }
        
        return {
            "status": "sucesso",
            "pedido_markdown": response.content.strip()
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "erro",
            "mensagem": str(e)
        }


# ============================================
# Endpoints de Configuração (Admin)
# ============================================

@router.get("/config/prompts")
async def listar_prompts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista todos os prompts configurados para o sistema pedido_calculo"""
    prompts = db.query(PromptConfig).filter(
        PromptConfig.sistema == SISTEMA,
        PromptConfig.is_active == True
    ).all()
    
    return [
        {
            "id": p.id,
            "tipo": p.tipo,
            "nome": p.nome,
            "descricao": p.descricao,
            "conteudo": p.conteudo,
            "updated_at": to_iso_utc(p.updated_at),
            "updated_by": p.updated_by
        }
        for p in prompts
    ]


@router.get("/config/prompts/{tipo}")
async def obter_prompt(
    tipo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém um prompt específico pelo tipo"""
    prompt = db.query(PromptConfig).filter(
        PromptConfig.sistema == SISTEMA,
        PromptConfig.tipo == tipo,
        PromptConfig.is_active == True
    ).first()
    
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt '{tipo}' não encontrado")
    
    return {
        "id": prompt.id,
        "tipo": prompt.tipo,
        "nome": prompt.nome,
        "descricao": prompt.descricao,
        "conteudo": prompt.conteudo,
        "updated_at": to_iso_utc(prompt.updated_at),
        "updated_by": prompt.updated_by
    }


@router.put("/config/prompts/{tipo}")
async def atualizar_prompt(
    tipo: str,
    req: PromptConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza um prompt existente"""
    prompt = db.query(PromptConfig).filter(
        PromptConfig.sistema == SISTEMA,
        PromptConfig.tipo == tipo,
        PromptConfig.is_active == True
    ).first()
    
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt '{tipo}' não encontrado")
    
    prompt.conteudo = req.conteudo
    if req.descricao:
        prompt.descricao = req.descricao
    prompt.updated_by = current_user.username
    
    db.commit()
    
    return {"status": "sucesso", "mensagem": f"Prompt '{tipo}' atualizado com sucesso"}


@router.get("/config/modelos")
async def listar_modelos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista configurações de modelos de IA"""
    configs = db.query(ConfiguracaoIA).filter(
        ConfiguracaoIA.sistema == SISTEMA
    ).all()
    
    return [
        {
            "id": c.id,
            "chave": c.chave,
            "valor": c.valor,
            "tipo_valor": c.tipo_valor,
            "descricao": c.descricao
        }
        for c in configs
    ]


@router.get("/config/modelos/{chave}")
async def obter_modelo(
    chave: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém uma configuração de modelo específica"""
    config = db.query(ConfiguracaoIA).filter(
        ConfiguracaoIA.sistema == SISTEMA,
        ConfiguracaoIA.chave == chave
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Configuração '{chave}' não encontrada")
    
    return {
        "id": config.id,
        "chave": config.chave,
        "valor": config.valor,
        "tipo_valor": config.tipo_valor,
        "descricao": config.descricao
    }


@router.put("/config/modelos/{chave}")
async def atualizar_modelo(
    chave: str,
    req: ConfiguracaoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza uma configuração de modelo"""
    config = db.query(ConfiguracaoIA).filter(
        ConfiguracaoIA.sistema == SISTEMA,
        ConfiguracaoIA.chave == chave
    ).first()
    
    if not config:
        # Cria nova configuração
        config = ConfiguracaoIA(
            sistema=SISTEMA,
            chave=chave,
            valor=req.valor,
            descricao=req.descricao
        )
        db.add(config)
    else:
        config.valor = req.valor
        if req.descricao:
            config.descricao = req.descricao
    
    db.commit()

    return {"status": "sucesso", "mensagem": f"Configuração '{chave}' atualizada com sucesso"}


# ============================================
# Endpoints de Feedback
# ============================================

@router.post("/feedback")
async def enviar_feedback(
    req: FeedbackRequest,
    current_user: User = Depends(get_current_active_user),
    geracao_repo: GeracaoPedidoCalculoRepository = Depends(get_geracao_pedido_repo),
    feedback_repo: FeedbackPedidoCalculoRepository = Depends(get_feedback_pedido_repo),
):
    """Envia feedback sobre o pedido de cálculo gerado."""
    try:
        geracao = geracao_repo.get_by_id(req.geracao_id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        feedback_existente = feedback_repo.find_by_geracao(req.geracao_id)

        if feedback_existente:
            raise HTTPException(
                status_code=400,
                detail="Feedback já foi enviado para esta geração"
            )

        feedback = FeedbackPedidoCalculo(
            geracao_id=req.geracao_id,
            usuario_id=current_user.id,
            avaliacao=req.avaliacao,
            nota=req.nota,
            comentario=req.comentario,
            campos_incorretos=req.campos_incorretos
        )
        feedback_repo.add(feedback)
        feedback_repo.commit()

        return {"success": True, "message": "Feedback registrado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feedback/{geracao_id}")
async def obter_feedback(
    geracao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: FeedbackPedidoCalculoRepository = Depends(get_feedback_pedido_repo),
):
    """Obtém o feedback de uma geração específica."""
    try:
        feedback = repo.find_by_geracao(geracao_id)

        if not feedback:
            return {"has_feedback": False}

        return {
            "has_feedback": True,
            "avaliacao": feedback.avaliacao,
            "nota": feedback.nota,
            "comentario": feedback.comentario,
            "campos_incorretos": feedback.campos_incorretos,
            "criado_em": to_iso_utc(feedback.criado_em)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
