"""Logica do chatbot de edicao com contexto enriquecido."""
import logging
from sqlalchemy.orm import Session
from sistemas.revisao_pecas.models import ItemRevisao, RevisaoChatHistorico

logger = logging.getLogger(__name__)


def montar_contexto_chat(item: ItemRevisao, historico: list[RevisaoChatHistorico]) -> str:
    """Monta contexto enriquecido para o chatbot.

    Args:
        item: Item de revisao com dados do processo
        historico: Lista de mensagens anteriores do chat

    Returns:
        String com contexto formatado para envio ao modelo
    """
    partes = []
    partes.append("## CONTEXTO DA REVISAO")
    partes.append(f"Processo: {item.numero_cnj}")
    partes.append(f"Categoria: {item.categoria}")
    partes.append(f"Resultado: {item.resultado}")
    partes.append(f"Acao sugerida: {item.acao_sugerida}")
    if item.tipo_peca:
        partes.append(f"Tipo de peca: {item.tipo_peca}")
    partes.append(f"\n## RESUMO DO CASO")
    partes.append(item.resumo_revisor)
    if item.classificacao_data:
        dados = item.classificacao_data
        if dados.get("fundamentacao"):
            partes.append(f"\n## FUNDAMENTACAO")
            partes.append(dados["fundamentacao"])
        if dados.get("acao_detalhada"):
            partes.append(f"\n## ANALISE DETALHADA")
            partes.append(dados["acao_detalhada"])
    return "\n".join(partes)


def montar_mensagens_gemini(
    contexto: str,
    conteudo_atual: str,
    mensagem_usuario: str,
    historico: list[RevisaoChatHistorico],
) -> list[dict]:
    """Monta lista de mensagens para enviar ao Gemini.

    Args:
        contexto: Contexto do caso montado por montar_contexto_chat
        conteudo_atual: Texto atual da peca (pode ja ter sido editado)
        mensagem_usuario: Nova mensagem do usuario
        historico: Historico de mensagens anteriores do chat

    Returns:
        Lista de dicts no formato esperado pelo Gemini (role/parts)
    """
    mensagens = []
    instrucao = (
        "Voce e um assistente juridico especializado em editar pecas processuais. "
        "O usuario e um procurador do Estado revisando uma peca gerada por IA. "
        "Responda SEMPRE com o texto completo da peca atualizado, "
        "incorporando a alteracao solicitada. Mantenha a formatacao em Markdown. "
        "NAO adicione explicacoes — retorne apenas o texto da peca editado.\n\n"
        f"{contexto}\n\n## CONTEUDO ATUAL DA PECA\n{conteudo_atual}"
    )
    mensagens.append({"role": "user", "parts": [instrucao]})
    mensagens.append({
        "role": "model",
        "parts": ["Entendi. Estou pronto para editar a peca conforme solicitado."],
    })
    for msg in historico:
        role = "user" if msg.role == "user" else "model"
        mensagens.append({"role": role, "parts": [msg.conteudo]})
    mensagens.append({"role": "user", "parts": [mensagem_usuario]})
    return mensagens


def salvar_mensagem_chat(
    db: Session,
    item_id: int,
    role: str,
    conteudo: str,
    snapshot: str | None = None,
) -> RevisaoChatHistorico:
    """Salva mensagem no historico do chat.

    Args:
        db: Sessao do banco de dados
        item_id: ID do item de revisao
        role: Papel do autor ("user" ou "assistant")
        conteudo: Texto da mensagem
        snapshot: Snapshot do conteudo da peca no momento da mensagem (opcional)

    Returns:
        Instancia salva de RevisaoChatHistorico
    """
    msg = RevisaoChatHistorico(
        item_revisao_id=item_id,
        role=role,
        conteudo=conteudo,
        conteudo_peca_snapshot=snapshot,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
