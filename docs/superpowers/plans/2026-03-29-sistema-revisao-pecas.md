# Sistema de Revisao de Pecas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar sistema de fila de revisao no portal-pge para processos classificados e pecas geradas pelo automacao_total, com editor rico (TipTap), visualizador de autos (react-pdf), chatbot de edicao, e worker local para inserir observacoes no pge.net.

**Architecture:** Novo modulo `sistemas/revisao_pecas/` seguindo o padrao existente (models + schemas + router). Frontend React em `frontend-react/src/pages/revisao/` com TipTap para edicao direta e react-pdf para visualizacao de documentos. SSE streaming para chatbot. Worker local desacoplado para integracao com BD_PGE.NET via VPN.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, SSE, Gemini API, TipTap (ProseMirror), react-pdf, TanStack Router, shadcn/ui, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-03-29-sistema-revisao-pecas-design.md`

---

## File Structure

### Backend (criar)

```
sistemas/revisao_pecas/
├── __init__.py                    # Exports publicos
├── models.py                      # ItemRevisao, RevisaoChatHistorico, AssessorDisponivel
├── schemas.py                     # Pydantic request/response schemas
├── router.py                      # Endpoints de ingestao, listagem, revisao, assessores
├── router_chat.py                 # Endpoint de chat streaming SSE
├── router_documentos.py           # Proxy TJ-MS para documentos
├── services.py                    # Logica de negocio (transicoes, observacoes)
├── services_chat.py               # Logica do chatbot com contexto enriquecido
└── services_observacao.py         # Geracao de textos de observacao para pge.net

scripts/worker_revisao/
├── worker_observacoes.py          # Worker local que insere obs no pge.net
└── config.py                      # Config do worker (URL, intervalo, etc.)
```

### Backend (modificar)

```
main.py                            # Registrar router do novo sistema
frontend-react/src/router.tsx      # Adicionar rotas React
```

### Frontend (criar)

```
frontend-react/src/pages/revisao/
├── RevisaoPage.tsx                # Pagina da fila de revisao
├── RevisaoItemPage.tsx            # Tela de revisao individual (split-panel)
├── types.ts                       # Interfaces TypeScript
├── api.ts                         # Chamadas API
├── constants.ts                   # Status, cores, labels, opcoes
├── components/
│   ├── FilaRevisao/
│   │   ├── TabelaItens.tsx        # DataTable com filtros
│   │   ├── FiltrosRevisao.tsx     # Barra de filtros
│   │   ├── EstatisticasCards.tsx   # Cards com contadores
│   │   └── DistribuirDialog.tsx   # Modal distribuicao em lote
│   ├── Revisao/
│   │   ├── ResumoIA.tsx           # Banner resumo + badges
│   │   ├── BarraStatus.tsx        # Barra status + botoes acao
│   │   ├── EditorPeca.tsx         # TipTap editor
│   │   ├── ChatRevisao.tsx        # Chat colapsavel
│   │   ├── RejeicaoForm.tsx       # Form de rejeicao
│   │   └── EncaminharDialog.tsx   # Dialog para encaminhar
│   ├── Documentos/
│   │   ├── PainelDocumentos.tsx   # Painel direito completo
│   │   ├── ListaDocumentos.tsx    # Sidebar lista docs
│   │   └── VisualizadorPdf.tsx    # react-pdf wrapper
│   └── Assessores/
│       └── AssessoresConfig.tsx   # Config de assessores
└── hooks/
    ├── useRevisaoItem.ts          # Fetch + estado do item
    ├── useChatRevisao.ts          # SSE streaming do chatbot
    ├── useDocumentos.ts           # Fetch docs TJ-MS
    └── useFilaRevisao.ts          # Fetch da fila com filtros
```

### Frontend (modificar)

```
frontend-react/src/components/layout/Sidebar.tsx   # Adicionar item no menu
frontend-react/src/lib/api.ts                       # Adicionar revisaoApi client
```

---

## Task 1: Backend — Models

**Files:**
- Create: `sistemas/revisao_pecas/__init__.py`
- Create: `sistemas/revisao_pecas/models.py`

- [ ] **Step 1: Criar diretorio e __init__.py**

```bash
mkdir -p sistemas/revisao_pecas
```

```python
# sistemas/revisao_pecas/__init__.py
"""Sistema de Revisao de Pecas — fila de revisao para processos do automacao_total."""
```

- [ ] **Step 2: Criar models.py com as 3 tabelas**

```python
# sistemas/revisao_pecas/models.py
"""Modelos de dados do sistema de revisao de pecas."""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
    JSON, Boolean, Index
)
from sqlalchemy.orm import relationship
from database.connection import Base
from utils.timezone import get_utc_now


class ItemRevisao(Base):
    """Item na fila de revisao — processo classificado pelo automacao_total."""
    __tablename__ = "itens_revisao"

    id = Column(Integer, primary_key=True, index=True)
    numero_cnj = Column(String(25), nullable=False, index=True)
    source_session = Column(String(100), nullable=False)

    # Classificacao
    categoria = Column(String(50), nullable=False)
    resultado = Column(String(30), nullable=False)
    acao_sugerida = Column(String(50), nullable=False)
    tipo_peca = Column(String(50), nullable=True)
    conteudo_peca = Column(Text, nullable=True)
    resumo_revisor = Column(Text, nullable=False)
    classificacao_data = Column(JSON, nullable=True)

    # Status
    status = Column(String(20), nullable=False, default="pendente", index=True)
    obs_status = Column(String(30), nullable=False, default="nao_aplicavel")

    # Conteudo editado
    conteudo_editado = Column(Text, nullable=True)

    # Observacao pge.net
    observacao_pge = Column(Text, nullable=True)
    cdpendencia = Column(Integer, nullable=True)

    # Rejeicao
    motivo_rejeicao = Column(Text, nullable=True)
    acao_corrigida = Column(String(50), nullable=True)

    # Usuarios
    usuario_revisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    usuario_encaminhado_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    revisado_em = Column(DateTime(timezone=True), nullable=True)
    concluido_em = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    usuario_revisor = relationship("User", foreign_keys=[usuario_revisor_id])
    usuario_encaminhado = relationship("User", foreign_keys=[usuario_encaminhado_id])
    chat_historico = relationship(
        "RevisaoChatHistorico",
        back_populates="item_revisao",
        cascade="all, delete-orphan",
        order_by="RevisaoChatHistorico.criado_em"
    )

    __table_args__ = (
        Index("ix_itens_revisao_status_criado", "status", "criado_em"),
    )

    def __repr__(self):
        return f"<ItemRevisao(id={self.id}, cnj='{self.numero_cnj}', status='{self.status}')>"


class RevisaoChatHistorico(Base):
    """Historico de mensagens do chatbot de edicao."""
    __tablename__ = "revisao_chat_historico"

    id = Column(Integer, primary_key=True, index=True)
    item_revisao_id = Column(Integer, ForeignKey("itens_revisao.id"), nullable=False, index=True)
    role = Column(String(10), nullable=False)  # user / assistant
    conteudo = Column(Text, nullable=False)
    conteudo_peca_snapshot = Column(Text, nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    item_revisao = relationship("ItemRevisao", back_populates="chat_historico")

    def __repr__(self):
        return f"<RevisaoChatHistorico(id={self.id}, role='{self.role}')>"


class AssessorDisponivel(Base):
    """Usuario marcado como assessor disponivel para receber encaminhamentos."""
    __tablename__ = "assessores_disponiveis"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    usuario = relationship("User")

    def __repr__(self):
        return f"<AssessorDisponivel(id={self.id}, usuario_id={self.usuario_id}, ativo={self.ativo})>"
```

- [ ] **Step 3: Verificar que os models importam sem erro**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from sistemas.revisao_pecas.models import ItemRevisao, RevisaoChatHistorico, AssessorDisponivel; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Criar tabelas no banco local**

```bash
cd E:/Projetos/PGE/portal-pge && python -c "
from database.connection import engine
from sistemas.revisao_pecas.models import ItemRevisao, RevisaoChatHistorico, AssessorDisponivel
from auth.models import User  # FK dependency

ItemRevisao.__table__.create(engine, checkfirst=True)
RevisaoChatHistorico.__table__.create(engine, checkfirst=True)
AssessorDisponivel.__table__.create(engine, checkfirst=True)
print('Tabelas criadas com sucesso')
"
```
Expected: `Tabelas criadas com sucesso`

- [ ] **Step 5: Commit**

```bash
git add sistemas/revisao_pecas/__init__.py sistemas/revisao_pecas/models.py
git commit -m "feat(revisao): cria models — ItemRevisao, RevisaoChatHistorico, AssessorDisponivel"
```

---

## Task 2: Backend — Schemas

**Files:**
- Create: `sistemas/revisao_pecas/schemas.py`

- [ ] **Step 1: Criar schemas Pydantic**

```python
# sistemas/revisao_pecas/schemas.py
"""Schemas Pydantic para o sistema de revisao de pecas."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
from utils.sanitize import validate_no_html


# =====================================================
# INGESTAO (automacao_total → portal-pge)
# =====================================================

class ClassificacaoData(BaseModel):
    """Dados completos da classificacao do automacao_total."""
    acao_detalhada: str = ""
    fundamentacao: str = ""
    confianca: Literal["alta", "media", "baixa"] = "alta"
    urgencia: Literal["rotina", "prazo_correndo", "urgente"] = "rotina"
    documentos_necessarios: list[str] = Field(default_factory=list)


class IngerirItemRequest(BaseModel):
    """Payload para ingerir um item do automacao_total."""
    numero_cnj: str = Field(..., min_length=20, max_length=25)
    source_session: str = Field(..., max_length=100)
    categoria: str = Field(..., max_length=50)
    resultado: str = Field(..., max_length=30)
    acao_sugerida: str = Field(..., max_length=50)
    tipo_peca: str | None = None
    conteudo_peca: str | None = None
    resumo_revisor: str = Field(..., min_length=10)
    classificacao_data: ClassificacaoData = Field(default_factory=ClassificacaoData)
    cdpendencia: int | None = None
    usuario_revisor_id: int | None = None

    @field_validator("resumo_revisor")
    @classmethod
    def sanitizar_resumo(cls, v: str) -> str:
        return validate_no_html(v, "resumo_revisor")


class IngerirLoteRequest(BaseModel):
    """Payload para ingerir multiplos itens."""
    itens: list[IngerirItemRequest] = Field(..., min_length=1, max_length=500)


# =====================================================
# LISTAGEM E FILTROS
# =====================================================

class ItemRevisaoResponse(BaseModel):
    """Response com dados de um item da fila."""
    id: int
    numero_cnj: str
    source_session: str
    categoria: str
    resultado: str
    acao_sugerida: str
    tipo_peca: str | None = None
    resumo_revisor: str
    classificacao_data: dict | None = None
    status: str
    obs_status: str
    conteudo_peca: str | None = None
    conteudo_editado: str | None = None
    observacao_pge: str | None = None
    motivo_rejeicao: str | None = None
    acao_corrigida: str | None = None
    cdpendencia: int | None = None
    usuario_revisor_id: int | None = None
    usuario_encaminhado_id: int | None = None
    revisor_nome: str | None = None
    encaminhado_nome: str | None = None
    criado_em: datetime
    revisado_em: datetime | None = None
    concluido_em: datetime | None = None

    class Config:
        from_attributes = True


class ItemRevisaoListResponse(BaseModel):
    """Response paginada da listagem."""
    itens: list[ItemRevisaoResponse]
    total: int
    pagina: int
    por_pagina: int


class EstatisticasResponse(BaseModel):
    """Contadores para o dashboard da fila."""
    total: int = 0
    pendentes: int = 0
    em_revisao: int = 0
    aprovados: int = 0
    encaminhados: int = 0
    rejeitados: int = 0
    concluidos: int = 0
    aguardando_insercao: int = 0


# =====================================================
# ACOES DE REVISAO
# =====================================================

class AprovarRequest(BaseModel):
    """Payload para aprovar um item."""
    conteudo_final: str | None = None
    observacao_pge: str | None = None


class RejeitarRequest(BaseModel):
    """Payload para rejeitar a sugestao da IA."""
    motivo_rejeicao: str = Field(..., min_length=5)
    acao_corrigida: str = Field(..., max_length=50)

    @field_validator("motivo_rejeicao")
    @classmethod
    def sanitizar_motivo(cls, v: str) -> str:
        return validate_no_html(v, "motivo_rejeicao")


class EncaminharRequest(BaseModel):
    """Payload para encaminhar item a um assessor."""
    assessor_id: int


class EncaminharLoteRequest(BaseModel):
    """Payload para distribuir itens em lote."""
    item_ids: list[int] = Field(..., min_length=1)
    assessor_ids: list[int] = Field(..., min_length=1)
    modo: Literal["manual", "aleatorio"] = "aleatorio"


class SalvarConteudoRequest(BaseModel):
    """Payload para auto-save do TipTap."""
    conteudo: str


# =====================================================
# CHAT
# =====================================================

class ChatMensagemRequest(BaseModel):
    """Payload para mensagem do chatbot de edicao."""
    mensagem: str = Field(..., min_length=1, max_length=2000)
    conteudo_atual: str = Field(..., min_length=1)


class ChatHistoricoResponse(BaseModel):
    """Response com historico do chat."""
    id: int
    role: str
    conteudo: str
    conteudo_peca_snapshot: str | None = None
    criado_em: datetime

    class Config:
        from_attributes = True


# =====================================================
# ASSESSORES
# =====================================================

class AssessorResponse(BaseModel):
    """Response com dados de um assessor."""
    id: int
    usuario_id: int
    nome: str
    ativo: bool
    criado_em: datetime

    class Config:
        from_attributes = True


class AdicionarAssessorRequest(BaseModel):
    """Payload para adicionar assessor."""
    usuario_id: int


class AtivarDesativarRequest(BaseModel):
    """Payload para ativar/desativar assessor."""
    ativo: bool


# =====================================================
# WORKER / OBSERVACOES
# =====================================================

class ObservacaoPendenteResponse(BaseModel):
    """Response com observacao pendente para o worker."""
    item_id: int
    numero_cnj: str
    cdpendencia: int
    observacao_pge: str
    status: str

    class Config:
        from_attributes = True


class ConfirmarObservacaoRequest(BaseModel):
    """Payload do worker confirmando insercao."""
    sucesso: bool = True
    erro_mensagem: str | None = None
```

- [ ] **Step 2: Verificar que os schemas importam sem erro**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from sistemas.revisao_pecas.schemas import IngerirItemRequest, ItemRevisaoResponse, AprovarRequest; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sistemas/revisao_pecas/schemas.py
git commit -m "feat(revisao): cria schemas Pydantic para ingestao, listagem, revisao, chat e assessores"
```

---

## Task 3: Backend — Services (logica de negocio)

**Files:**
- Create: `sistemas/revisao_pecas/services.py`
- Create: `sistemas/revisao_pecas/services_observacao.py`

- [ ] **Step 1: Criar services.py com logica de transicoes**

```python
# sistemas/revisao_pecas/services.py
"""Logica de negocio do sistema de revisao de pecas."""

import logging
import random
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from auth.models import User
from sistemas.revisao_pecas.models import ItemRevisao, AssessorDisponivel
from sistemas.revisao_pecas.schemas import (
    IngerirItemRequest, AprovarRequest, RejeitarRequest,
    EncaminharLoteRequest, EstatisticasResponse
)
from sistemas.revisao_pecas.services_observacao import gerar_texto_observacao
from utils.timezone import get_utc_now

logger = logging.getLogger(__name__)

# Status validos
STATUS_PENDENTE = "pendente"
STATUS_EM_REVISAO = "em_revisao"
STATUS_APROVADO = "aprovado"
STATUS_ENCAMINHADO = "encaminhado"
STATUS_REJEITADO = "rejeitado"
STATUS_CONCLUIDO = "concluido"

OBS_NAO_APLICAVEL = "nao_aplicavel"
OBS_AGUARDANDO = "aguardando_insercao"
OBS_INSERIDA = "inserida"
OBS_ERRO = "erro_insercao"


def criar_item(db: Session, payload: IngerirItemRequest) -> ItemRevisao:
    """Cria um novo item na fila de revisao."""
    item = ItemRevisao(
        numero_cnj=payload.numero_cnj,
        source_session=payload.source_session,
        categoria=payload.categoria,
        resultado=payload.resultado,
        acao_sugerida=payload.acao_sugerida,
        tipo_peca=payload.tipo_peca,
        conteudo_peca=payload.conteudo_peca,
        resumo_revisor=payload.resumo_revisor,
        classificacao_data=payload.classificacao_data.model_dump() if payload.classificacao_data else None,
        cdpendencia=payload.cdpendencia,
        usuario_revisor_id=payload.usuario_revisor_id,
        status=STATUS_PENDENTE,
        obs_status=OBS_NAO_APLICAVEL,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info(f"Item de revisao criado: id={item.id}, cnj={item.numero_cnj}")
    return item


def iniciar_revisao(db: Session, item: ItemRevisao, usuario: User) -> ItemRevisao:
    """Marca item como em_revisao e atribui ao usuario."""
    if item.status not in (STATUS_PENDENTE, STATUS_EM_REVISAO):
        raise HTTPException(400, f"Item com status '{item.status}' nao pode ser iniciado para revisao")
    item.status = STATUS_EM_REVISAO
    item.usuario_revisor_id = usuario.id
    db.commit()
    db.refresh(item)
    logger.info(f"Revisao iniciada: item={item.id}, revisor={usuario.username}")
    return item


def aprovar_item(
    db: Session, item: ItemRevisao, usuario: User, payload: AprovarRequest
) -> ItemRevisao:
    """Aprova o item e gera observacao para pge.net."""
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(400, f"Item com status '{item.status}' nao pode ser aprovado")

    foi_editado = payload.conteudo_final and payload.conteudo_final != item.conteudo_peca
    item.conteudo_editado = payload.conteudo_final
    item.status = STATUS_APROVADO
    item.revisado_em = get_utc_now()

    # Gerar observacao para pge.net
    texto_obs = payload.observacao_pge or gerar_texto_observacao(
        cenario="aprovado_editado" if foi_editado else "aprovado_sem_alteracao",
        tipo_peca=item.tipo_peca,
        nome_revisor=usuario.full_name or usuario.username,
    )
    item.observacao_pge = texto_obs
    item.obs_status = OBS_AGUARDANDO if item.cdpendencia else OBS_NAO_APLICAVEL

    db.commit()
    db.refresh(item)
    logger.info(f"Item aprovado: id={item.id}, editado={foi_editado}")
    return item


def rejeitar_item(
    db: Session, item: ItemRevisao, usuario: User, payload: RejeitarRequest
) -> ItemRevisao:
    """Rejeita a sugestao da IA e define acao correta."""
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(400, f"Item com status '{item.status}' nao pode ser rejeitado")

    item.status = STATUS_REJEITADO
    item.motivo_rejeicao = payload.motivo_rejeicao
    item.acao_corrigida = payload.acao_corrigida
    item.revisado_em = get_utc_now()

    texto_obs = gerar_texto_observacao(
        cenario="rejeitado",
        nome_revisor=usuario.full_name or usuario.username,
        acao_corrigida=payload.acao_corrigida,
        motivo=payload.motivo_rejeicao,
    )
    item.observacao_pge = texto_obs
    item.obs_status = OBS_AGUARDANDO if item.cdpendencia else OBS_NAO_APLICAVEL

    db.commit()
    db.refresh(item)
    logger.info(f"Item rejeitado: id={item.id}, acao_corrigida={payload.acao_corrigida}")
    return item


def encaminhar_item(
    db: Session, item: ItemRevisao, usuario: User, assessor_id: int
) -> ItemRevisao:
    """Encaminha item aprovado para um assessor inserir."""
    if item.status not in (STATUS_APROVADO, STATUS_EM_REVISAO):
        raise HTTPException(400, f"Item com status '{item.status}' nao pode ser encaminhado")

    assessor = db.query(AssessorDisponivel).filter_by(usuario_id=assessor_id, ativo=True).first()
    if not assessor:
        raise HTTPException(404, "Assessor nao encontrado ou inativo")

    if item.status == STATUS_EM_REVISAO:
        item.revisado_em = get_utc_now()

    item.status = STATUS_ENCAMINHADO
    item.usuario_encaminhado_id = assessor_id

    assessor_user = db.query(User).filter_by(id=assessor_id).first()
    nome_assessor = assessor_user.full_name or assessor_user.username if assessor_user else "assessor"

    texto_obs = gerar_texto_observacao(
        cenario="encaminhado",
        tipo_peca=item.tipo_peca,
        nome_revisor=usuario.full_name or usuario.username,
        nome_assessor=nome_assessor,
    )
    item.observacao_pge = texto_obs
    item.obs_status = OBS_AGUARDANDO if item.cdpendencia else OBS_NAO_APLICAVEL

    db.commit()
    db.refresh(item)
    logger.info(f"Item encaminhado: id={item.id}, assessor={assessor_id}")
    return item


def distribuir_lote(
    db: Session, usuario: User, payload: EncaminharLoteRequest
) -> list[ItemRevisao]:
    """Distribui multiplos itens para assessores."""
    itens = db.query(ItemRevisao).filter(ItemRevisao.id.in_(payload.item_ids)).all()
    if not itens:
        raise HTTPException(404, "Nenhum item encontrado")

    assessores_ativos = (
        db.query(AssessorDisponivel)
        .filter(AssessorDisponivel.usuario_id.in_(payload.assessor_ids), AssessorDisponivel.ativo == True)
        .all()
    )
    if not assessores_ativos:
        raise HTTPException(404, "Nenhum assessor ativo encontrado")

    ids_ativos = [a.usuario_id for a in assessores_ativos]
    resultados = []

    for i, item in enumerate(itens):
        if item.status not in (STATUS_APROVADO, STATUS_EM_REVISAO, STATUS_PENDENTE):
            continue
        if payload.modo == "aleatorio":
            assessor_id = random.choice(ids_ativos)
        else:
            assessor_id = ids_ativos[i % len(ids_ativos)]
        item = encaminhar_item(db, item, usuario, assessor_id)
        resultados.append(item)

    return resultados


def marcar_inserido(db: Session, item: ItemRevisao) -> ItemRevisao:
    """Marca que o DOCX foi inserido no pge.net (acao manual do assessor/admin)."""
    if item.status not in (STATUS_APROVADO, STATUS_ENCAMINHADO):
        raise HTTPException(400, f"Item com status '{item.status}' nao pode ser marcado como inserido")
    item.status = STATUS_CONCLUIDO
    item.concluido_em = get_utc_now()
    db.commit()
    db.refresh(item)
    logger.info(f"Item marcado como inserido: id={item.id}")
    return item


def confirmar_observacao(db: Session, item: ItemRevisao, sucesso: bool, erro_msg: str | None = None) -> ItemRevisao:
    """Worker confirma que observacao foi inserida no pge.net."""
    if sucesso:
        item.obs_status = OBS_INSERIDA
        # Se rejeitado, auto-transicionar para concluido
        if item.status == STATUS_REJEITADO:
            item.status = STATUS_CONCLUIDO
            item.concluido_em = get_utc_now()
        # Se nada_a_fazer confirmado (aprovado sem peca), auto-concluir
        if item.status == STATUS_APROVADO and not item.conteudo_peca and not item.conteudo_editado:
            item.status = STATUS_CONCLUIDO
            item.concluido_em = get_utc_now()
    else:
        item.obs_status = OBS_ERRO
        logger.error(f"Erro ao inserir observacao: item={item.id}, erro={erro_msg}")

    db.commit()
    db.refresh(item)
    return item


def obter_estatisticas(db: Session, usuario: User) -> EstatisticasResponse:
    """Retorna contadores para o dashboard."""
    base_query = db.query(ItemRevisao)

    # Assessor so ve os seus
    if usuario.role != "admin":
        base_query = base_query.filter(
            (ItemRevisao.usuario_revisor_id == usuario.id) |
            (ItemRevisao.usuario_encaminhado_id == usuario.id)
        )

    total = base_query.count()
    stats = EstatisticasResponse(total=total)

    contagens = (
        base_query
        .with_entities(ItemRevisao.status, func.count(ItemRevisao.id))
        .group_by(ItemRevisao.status)
        .all()
    )
    for status, count in contagens:
        if status == STATUS_PENDENTE:
            stats.pendentes = count
        elif status == STATUS_EM_REVISAO:
            stats.em_revisao = count
        elif status == STATUS_APROVADO:
            stats.aprovados = count
        elif status == STATUS_ENCAMINHADO:
            stats.encaminhados = count
        elif status == STATUS_REJEITADO:
            stats.rejeitados = count
        elif status == STATUS_CONCLUIDO:
            stats.concluidos = count

    stats.aguardando_insercao = (
        base_query.filter(ItemRevisao.obs_status == OBS_AGUARDANDO).count()
    )

    return stats
```

- [ ] **Step 2: Criar services_observacao.py**

```python
# sistemas/revisao_pecas/services_observacao.py
"""Geracao de textos de observacao para lancamento no pge.net."""

MAX_OBS_CHARS = 3000


def gerar_texto_observacao(
    cenario: str,
    tipo_peca: str | None = None,
    nome_revisor: str = "",
    nome_assessor: str = "",
    acao_corrigida: str = "",
    motivo: str = "",
) -> str:
    """Gera o texto da observacao conforme o cenario de revisao."""

    if cenario == "aprovado_sem_alteracao":
        texto = (
            f"[REVISADO] Peca de {tipo_peca or 'tipo nao informado'} gerada por IA "
            f"revisada e aprovada sem alteracoes pelo(a) Proc. {nome_revisor}. "
            f"Peca disponivel para insercao."
        )
    elif cenario == "aprovado_editado":
        texto = (
            f"[REVISADO] Peca de {tipo_peca or 'tipo nao informado'} gerada por IA "
            f"revisada e editada pelo(a) Proc. {nome_revisor}. "
            f"Peca disponivel para insercao."
        )
    elif cenario == "nada_a_fazer_confirmado":
        texto = (
            f"[REVISADO] Orientacao da IA — Nada a Fazer — revisada e confirmada "
            f"pelo(a) Proc. {nome_revisor}. Sem providencias necessarias."
        )
    elif cenario == "rejeitado":
        texto = (
            f"[REJEITADO] Orientacao da IA — Nada a Fazer — REJEITADA "
            f"pelo(a) Proc. {nome_revisor}. "
            f"Acao correta: {acao_corrigida}. Motivo: {motivo}"
        )
    elif cenario == "encaminhado":
        texto = (
            f"[REVISADO] Peca de {tipo_peca or 'tipo nao informado'} revisada "
            f"pelo(a) Proc. {nome_revisor} e encaminhada ao(a) assessor(a) "
            f"{nome_assessor} para insercao no processo."
        )
    else:
        texto = f"[REVISADO] Acao revisada pelo(a) Proc. {nome_revisor}."

    return _truncar_observacao(texto)


def _truncar_observacao(texto: str) -> str:
    """Trunca em MAX_OBS_CHARS na ultima frase completa."""
    if len(texto) <= MAX_OBS_CHARS:
        return texto

    truncado = texto[:MAX_OBS_CHARS]
    ultimo_ponto = truncado.rfind(".")
    if ultimo_ponto > 0:
        return truncado[: ultimo_ponto + 1]
    return truncado
```

- [ ] **Step 3: Verificar imports**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from sistemas.revisao_pecas.services import criar_item, aprovar_item, obter_estatisticas; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add sistemas/revisao_pecas/services.py sistemas/revisao_pecas/services_observacao.py
git commit -m "feat(revisao): cria services com logica de transicoes e geracao de observacoes"
```

---

## Task 4: Backend — Router principal

**Files:**
- Create: `sistemas/revisao_pecas/router.py`

- [ ] **Step 1: Criar router.py com todos os endpoints exceto chat e documentos**

```python
# sistemas/revisao_pecas/router.py
"""Endpoints do sistema de revisao de pecas."""

import logging
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from utils.rate_limit import limiter, LIMITS, get_user_identifier
from sistemas.revisao_pecas.models import ItemRevisao, AssessorDisponivel, RevisaoChatHistorico
from sistemas.revisao_pecas.schemas import (
    IngerirItemRequest, IngerirLoteRequest,
    ItemRevisaoResponse, ItemRevisaoListResponse, EstatisticasResponse,
    AprovarRequest, RejeitarRequest, EncaminharRequest, EncaminharLoteRequest,
    SalvarConteudoRequest,
    AssessorResponse, AdicionarAssessorRequest, AtivarDesativarRequest,
    ObservacaoPendenteResponse, ConfirmarObservacaoRequest,
    ChatHistoricoResponse,
)
from sistemas.revisao_pecas.services import (
    criar_item, iniciar_revisao, aprovar_item, rejeitar_item,
    encaminhar_item, distribuir_lote, marcar_inserido,
    confirmar_observacao, obter_estatisticas,
    STATUS_PENDENTE, STATUS_EM_REVISAO, STATUS_APROVADO,
    STATUS_ENCAMINHADO, STATUS_REJEITADO, STATUS_CONCLUIDO,
    OBS_AGUARDANDO,
)
from utils.timezone import get_utc_now

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Revisao de Pecas"])


# =====================================================
# HELPERS
# =====================================================

def _require_admin(user: User):
    """Verifica se usuario eh admin."""
    if user.role != "admin":
        raise HTTPException(403, "Acesso restrito a administradores")


def _get_item_or_404(db: Session, item_id: int) -> ItemRevisao:
    """Busca item ou retorna 404."""
    item = db.query(ItemRevisao).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(404, f"Item {item_id} nao encontrado")
    return item


def _item_to_response(item: ItemRevisao) -> ItemRevisaoResponse:
    """Converte model para response, incluindo nomes dos usuarios."""
    revisor_nome = None
    encaminhado_nome = None
    if item.usuario_revisor:
        revisor_nome = item.usuario_revisor.full_name or item.usuario_revisor.username
    if item.usuario_encaminhado:
        encaminhado_nome = item.usuario_encaminhado.full_name or item.usuario_encaminhado.username

    return ItemRevisaoResponse(
        id=item.id,
        numero_cnj=item.numero_cnj,
        source_session=item.source_session,
        categoria=item.categoria,
        resultado=item.resultado,
        acao_sugerida=item.acao_sugerida,
        tipo_peca=item.tipo_peca,
        resumo_revisor=item.resumo_revisor,
        classificacao_data=item.classificacao_data,
        status=item.status,
        obs_status=item.obs_status,
        conteudo_peca=item.conteudo_peca,
        conteudo_editado=item.conteudo_editado,
        observacao_pge=item.observacao_pge,
        motivo_rejeicao=item.motivo_rejeicao,
        acao_corrigida=item.acao_corrigida,
        cdpendencia=item.cdpendencia,
        usuario_revisor_id=item.usuario_revisor_id,
        usuario_encaminhado_id=item.usuario_encaminhado_id,
        revisor_nome=revisor_nome,
        encaminhado_nome=encaminhado_nome,
        criado_em=item.criado_em,
        revisado_em=item.revisado_em,
        concluido_em=item.concluido_em,
    )


# =====================================================
# INGESTAO
# =====================================================

@router.post("/ingerir", response_model=ItemRevisaoResponse)
async def ingerir_item(
    payload: IngerirItemRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Recebe um item do automacao_total para a fila de revisao."""
    item = criar_item(db, payload)
    return _item_to_response(item)


@router.post("/ingerir-lote")
async def ingerir_lote(
    payload: IngerirLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Recebe multiplos itens de uma sessao do automacao_total."""
    resultados = []
    for item_req in payload.itens:
        item = criar_item(db, item_req)
        resultados.append({"id": item.id, "numero_cnj": item.numero_cnj})
    return {"total": len(resultados), "itens": resultados}


# =====================================================
# LISTAGEM
# =====================================================

@router.get("/itens", response_model=ItemRevisaoListResponse)
async def listar_itens(
    status: str | None = Query(None),
    urgencia: str | None = Query(None),
    acao: str | None = Query(None),
    assessor_id: int | None = Query(None),
    tab: str | None = Query(None),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista itens da fila com filtros e paginacao."""
    query = db.query(ItemRevisao)

    # Visao por papel
    if current_user.role != "admin":
        query = query.filter(
            (ItemRevisao.usuario_revisor_id == current_user.id) |
            (ItemRevisao.usuario_encaminhado_id == current_user.id)
        )

    # Tabs (atalhos de filtro)
    if tab == "meus":
        query = query.filter(ItemRevisao.usuario_revisor_id == current_user.id)
    elif tab == "pendentes":
        query = query.filter(ItemRevisao.status == STATUS_PENDENTE)
    elif tab == "concluidos":
        query = query.filter(ItemRevisao.status == STATUS_CONCLUIDO)
    elif tab == "para_revisar" and current_user.role != "admin":
        query = query.filter(
            ItemRevisao.usuario_revisor_id == current_user.id,
            ItemRevisao.status.in_([STATUS_PENDENTE, STATUS_EM_REVISAO])
        )
    elif tab == "para_inserir" and current_user.role != "admin":
        query = query.filter(
            ItemRevisao.usuario_encaminhado_id == current_user.id,
            ItemRevisao.status == STATUS_ENCAMINHADO
        )

    # Filtros individuais
    if status:
        query = query.filter(ItemRevisao.status == status)
    if acao:
        query = query.filter(ItemRevisao.acao_sugerida == acao)
    if assessor_id:
        query = query.filter(
            (ItemRevisao.usuario_revisor_id == assessor_id) |
            (ItemRevisao.usuario_encaminhado_id == assessor_id)
        )
    if urgencia:
        query = query.filter(
            ItemRevisao.classificacao_data["urgencia"].as_string() == urgencia
        )

    total = query.count()
    itens = (
        query.order_by(desc(ItemRevisao.criado_em))
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )

    return ItemRevisaoListResponse(
        itens=[_item_to_response(item) for item in itens],
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
    )


@router.get("/itens/{item_id}", response_model=ItemRevisaoResponse)
async def obter_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Obtem detalhes de um item."""
    item = _get_item_or_404(db, item_id)
    return _item_to_response(item)


@router.get("/estatisticas", response_model=EstatisticasResponse)
async def estatisticas(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna contadores para o dashboard."""
    return obter_estatisticas(db, current_user)


# =====================================================
# ACOES DE REVISAO
# =====================================================

@router.post("/itens/{item_id}/iniciar-revisao", response_model=ItemRevisaoResponse)
async def endpoint_iniciar_revisao(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Marca item como em_revisao e atribui ao usuario."""
    item = _get_item_or_404(db, item_id)
    item = iniciar_revisao(db, item, current_user)
    return _item_to_response(item)


@router.post("/itens/{item_id}/aprovar", response_model=ItemRevisaoResponse)
async def endpoint_aprovar(
    item_id: int,
    payload: AprovarRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Aprova o item com conteudo final."""
    item = _get_item_or_404(db, item_id)
    item = aprovar_item(db, item, current_user, payload)
    return _item_to_response(item)


@router.post("/itens/{item_id}/rejeitar", response_model=ItemRevisaoResponse)
async def endpoint_rejeitar(
    item_id: int,
    payload: RejeitarRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Rejeita a sugestao da IA e define acao correta."""
    item = _get_item_or_404(db, item_id)
    item = rejeitar_item(db, item, current_user, payload)
    return _item_to_response(item)


@router.post("/itens/{item_id}/encaminhar", response_model=ItemRevisaoResponse)
async def endpoint_encaminhar(
    item_id: int,
    payload: EncaminharRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Encaminha item para um assessor."""
    _require_admin(current_user)
    item = _get_item_or_404(db, item_id)
    item = encaminhar_item(db, item, current_user, payload.assessor_id)
    return _item_to_response(item)


@router.post("/itens/encaminhar-lote")
async def endpoint_encaminhar_lote(
    payload: EncaminharLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Distribui multiplos itens para assessores."""
    _require_admin(current_user)
    resultados = distribuir_lote(db, current_user, payload)
    return {"total": len(resultados), "itens": [{"id": i.id, "status": i.status} for i in resultados]}


@router.post("/itens/{item_id}/marcar-inserido", response_model=ItemRevisaoResponse)
async def endpoint_marcar_inserido(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Assessor/admin confirma que inseriu DOCX no pge.net."""
    item = _get_item_or_404(db, item_id)
    item = marcar_inserido(db, item)
    return _item_to_response(item)


# =====================================================
# EDICAO (AUTO-SAVE)
# =====================================================

@router.put("/itens/{item_id}/conteudo", response_model=ItemRevisaoResponse)
async def salvar_conteudo(
    item_id: int,
    payload: SalvarConteudoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Auto-save do conteudo editado no TipTap."""
    item = _get_item_or_404(db, item_id)
    if item.status not in (STATUS_EM_REVISAO, STATUS_PENDENTE):
        raise HTTPException(400, "Item nao esta em estado editavel")
    item.conteudo_editado = payload.conteudo
    db.commit()
    db.refresh(item)
    return _item_to_response(item)


# =====================================================
# CHAT HISTORICO (GET apenas — streaming em router_chat.py)
# =====================================================

@router.get("/itens/{item_id}/chat-historico", response_model=list[ChatHistoricoResponse])
async def obter_chat_historico(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna historico de mensagens do chatbot."""
    _get_item_or_404(db, item_id)
    mensagens = (
        db.query(RevisaoChatHistorico)
        .filter_by(item_revisao_id=item_id)
        .order_by(RevisaoChatHistorico.criado_em)
        .all()
    )
    return [ChatHistoricoResponse.model_validate(m) for m in mensagens]


# =====================================================
# ASSESSORES
# =====================================================

@router.get("/assessores", response_model=list[AssessorResponse])
async def listar_assessores(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista assessores disponiveis."""
    assessores = db.query(AssessorDisponivel).all()
    result = []
    for a in assessores:
        nome = a.usuario.full_name or a.usuario.username if a.usuario else "desconhecido"
        result.append(AssessorResponse(
            id=a.id, usuario_id=a.usuario_id, nome=nome,
            ativo=a.ativo, criado_em=a.criado_em,
        ))
    return result


@router.post("/assessores", response_model=AssessorResponse)
async def adicionar_assessor(
    payload: AdicionarAssessorRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Adiciona um usuario como assessor. Admin-only."""
    _require_admin(current_user)
    existente = db.query(AssessorDisponivel).filter_by(usuario_id=payload.usuario_id).first()
    if existente:
        raise HTTPException(400, "Usuario ja e assessor")
    usuario = db.query(User).filter_by(id=payload.usuario_id, is_active=True).first()
    if not usuario:
        raise HTTPException(404, "Usuario nao encontrado ou inativo")

    assessor = AssessorDisponivel(usuario_id=payload.usuario_id)
    db.add(assessor)
    db.commit()
    db.refresh(assessor)
    nome = usuario.full_name or usuario.username
    return AssessorResponse(
        id=assessor.id, usuario_id=assessor.usuario_id, nome=nome,
        ativo=assessor.ativo, criado_em=assessor.criado_em,
    )


@router.delete("/assessores/{assessor_id}")
async def remover_assessor(
    assessor_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Remove assessor da lista. Admin-only."""
    _require_admin(current_user)
    assessor = db.query(AssessorDisponivel).filter_by(id=assessor_id).first()
    if not assessor:
        raise HTTPException(404, "Assessor nao encontrado")
    db.delete(assessor)
    db.commit()
    return {"ok": True}


@router.patch("/assessores/{assessor_id}")
async def ativar_desativar_assessor(
    assessor_id: int,
    payload: AtivarDesativarRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Ativa/desativa assessor. Admin-only."""
    _require_admin(current_user)
    assessor = db.query(AssessorDisponivel).filter_by(id=assessor_id).first()
    if not assessor:
        raise HTTPException(404, "Assessor nao encontrado")
    assessor.ativo = payload.ativo
    db.commit()
    return {"ok": True, "ativo": assessor.ativo}


# =====================================================
# WORKER / OBSERVACOES
# =====================================================

@router.get("/observacoes-pendentes", response_model=list[ObservacaoPendenteResponse])
async def listar_observacoes_pendentes(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista observacoes aguardando insercao no pge.net (para o worker)."""
    itens = (
        db.query(ItemRevisao)
        .filter(
            ItemRevisao.obs_status == OBS_AGUARDANDO,
            ItemRevisao.cdpendencia.isnot(None),
            ItemRevisao.observacao_pge.isnot(None),
        )
        .all()
    )
    return [
        ObservacaoPendenteResponse(
            item_id=i.id, numero_cnj=i.numero_cnj,
            cdpendencia=i.cdpendencia, observacao_pge=i.observacao_pge,
            status=i.status,
        )
        for i in itens
    ]


@router.post("/observacoes/{item_id}/confirmar")
async def confirmar_observacao_endpoint(
    item_id: int,
    payload: ConfirmarObservacaoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Worker confirma insercao da observacao no pge.net."""
    item = _get_item_or_404(db, item_id)
    item = confirmar_observacao(db, item, payload.sucesso, payload.erro_mensagem)
    return {"ok": True, "obs_status": item.obs_status, "status": item.status}


# =====================================================
# EXPORT DOCX
# =====================================================

@router.post("/itens/{item_id}/exportar-docx")
async def exportar_docx(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Gera DOCX final reutilizando endpoint do gerador de pecas."""
    item = _get_item_or_404(db, item_id)
    conteudo = item.conteudo_editado or item.conteudo_peca
    if not conteudo:
        raise HTTPException(400, "Item nao possui conteudo para exportar")

    # Importar a funcao de export do gerador de pecas
    from sistemas.gerador_pecas.router import _exportar_markdown_para_docx
    try:
        resultado = await _exportar_markdown_para_docx(
            conteudo, item.numero_cnj, item.tipo_peca or "peca"
        )
        return resultado
    except Exception as e:
        logger.error(f"Erro ao exportar DOCX: {e}")
        raise HTTPException(500, f"Erro ao gerar DOCX: {str(e)}")
```

- [ ] **Step 2: Verificar import do router**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from sistemas.revisao_pecas.router import router; print(f'Rotas: {len(router.routes)}')"`
Expected: output showing number of routes

- [ ] **Step 3: Commit**

```bash
git add sistemas/revisao_pecas/router.py
git commit -m "feat(revisao): cria router com endpoints de ingestao, listagem, revisao, assessores e worker"
```

---

## Task 5: Backend — Chat streaming + Documentos

**Files:**
- Create: `sistemas/revisao_pecas/router_chat.py`
- Create: `sistemas/revisao_pecas/services_chat.py`
- Create: `sistemas/revisao_pecas/router_documentos.py`

- [ ] **Step 1: Criar services_chat.py com logica do chatbot**

```python
# sistemas/revisao_pecas/services_chat.py
"""Logica do chatbot de edicao com contexto enriquecido."""

import logging
from sqlalchemy.orm import Session

from sistemas.revisao_pecas.models import ItemRevisao, RevisaoChatHistorico
from utils.timezone import get_utc_now

logger = logging.getLogger(__name__)


def montar_contexto_chat(item: ItemRevisao, historico: list[RevisaoChatHistorico]) -> str:
    """Monta o contexto enriquecido para o chatbot de revisao."""
    partes = []

    partes.append("## CONTEXTO DA REVISAO")
    partes.append(f"Processo: {item.numero_cnj}")
    partes.append(f"Categoria: {item.categoria}")
    partes.append(f"Resultado: {item.resultado}")
    partes.append(f"Acao sugerida: {item.acao_sugerida}")
    if item.tipo_peca:
        partes.append(f"Tipo de peca: {item.tipo_peca}")

    partes.append(f"\n## RESUMO DO CASO (gerado pelo sistema de classificacao)")
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
    """Monta a lista de mensagens para enviar ao Gemini."""
    mensagens = []

    # System instruction via primeira mensagem
    instrucao = (
        "Voce e um assistente juridico especializado em editar pecas processuais. "
        "O usuario e um procurador do Estado revisando uma peca gerada por IA. "
        "Ele pode pedir alteracoes especificas no texto. "
        "Responda SEMPRE com o texto completo da peca atualizado, "
        "incorporando a alteracao solicitada. "
        "Mantenha a formatacao em Markdown. "
        "NAO adicione explicacoes — retorne apenas o texto da peca editado.\n\n"
        f"{contexto}\n\n"
        f"## CONTEUDO ATUAL DA PECA\n{conteudo_atual}"
    )

    mensagens.append({"role": "user", "parts": [instrucao]})
    mensagens.append({"role": "model", "parts": ["Entendi. Estou pronto para editar a peca conforme solicitado. Envie sua instrucao."]})

    # Historico anterior
    for msg in historico:
        role = "user" if msg.role == "user" else "model"
        mensagens.append({"role": role, "parts": [msg.conteudo]})

    # Mensagem atual
    mensagens.append({"role": "user", "parts": [mensagem_usuario]})

    return mensagens


def salvar_mensagem_chat(
    db: Session,
    item_id: int,
    role: str,
    conteudo: str,
    snapshot: str | None = None,
) -> RevisaoChatHistorico:
    """Salva uma mensagem no historico do chat."""
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
```

- [ ] **Step 2: Criar router_chat.py com endpoint SSE**

```python
# sistemas/revisao_pecas/router_chat.py
"""Endpoint de chat streaming SSE para edicao de pecas na revisao."""

import json
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from utils.rate_limit import limiter, LIMITS, get_user_identifier
from utils.quota_manager import check_ai_quota
from sistemas.revisao_pecas.models import ItemRevisao, RevisaoChatHistorico
from sistemas.revisao_pecas.schemas import ChatMensagemRequest
from sistemas.revisao_pecas.services_chat import (
    montar_contexto_chat, montar_mensagens_gemini, salvar_mensagem_chat,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Revisao Chat"])


def _sse_event(tipo: str, **dados) -> str:
    """Formata um evento SSE."""
    payload = {"tipo": tipo, **dados}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/itens/{item_id}/chat-stream")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def chat_stream(
    item_id: int,
    request: Request,
    payload: ChatMensagemRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Chat de edicao via SSE streaming. Envia mensagem e recebe resposta em chunks."""
    await check_ai_quota(current_user)

    item = db.query(ItemRevisao).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(404, f"Item {item_id} nao encontrado")

    # Salvar mensagem do usuario
    salvar_mensagem_chat(db, item_id, "user", payload.mensagem)

    # Buscar historico
    historico = (
        db.query(RevisaoChatHistorico)
        .filter_by(item_revisao_id=item_id)
        .order_by(RevisaoChatHistorico.criado_em)
        .all()
    )

    contexto = montar_contexto_chat(item, historico)
    mensagens = montar_mensagens_gemini(
        contexto, payload.conteudo_atual, payload.mensagem, historico[:-1]  # exclui a msg que acabamos de salvar
    )

    async def gerar_eventos():
        try:
            yield _sse_event("inicio", mensagem="Processando edicao...")

            # Importar servico Gemini
            from services.gemini_service import call_gemini_stream
            resposta_completa = ""

            async for chunk in call_gemini_stream(mensagens):
                resposta_completa += chunk
                yield _sse_event("chunk", texto=chunk)

            # Salvar resposta no historico
            salvar_mensagem_chat(db, item_id, "assistant", resposta_completa, snapshot=resposta_completa)

            # Atualizar conteudo editado do item
            item.conteudo_editado = resposta_completa
            db.commit()

            yield _sse_event("sucesso", conteudo=resposta_completa)

        except Exception as e:
            logger.error(f"Erro no chat de revisao: {e}", exc_info=True)
            yield _sse_event("erro", mensagem=str(e))

    return StreamingResponse(
        gerar_eventos(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 3: Criar router_documentos.py com proxy TJ-MS**

```python
# sistemas/revisao_pecas/router_documentos.py
"""Proxy para documentos do TJ-MS — lista e download de PDFs."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from sistemas.revisao_pecas.models import ItemRevisao

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Revisao Documentos"])


@router.get("/itens/{item_id}/documentos")
async def listar_documentos(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista documentos do processo via TJ-MS."""
    item = db.query(ItemRevisao).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(404, f"Item {item_id} nao encontrado")

    try:
        from services.tjms.client import TJMSClient
        client = TJMSClient()
        resultado = await client.consultar_processo(item.numero_cnj)
        documentos = resultado.get("documentos", [])
        return {"documentos": documentos, "total": len(documentos)}
    except Exception as e:
        logger.error(f"Erro ao listar documentos TJ-MS: {e}")
        raise HTTPException(502, f"Erro ao consultar TJ-MS: {str(e)}")


@router.get("/documentos/{processo}/{doc_id}")
async def download_documento(
    processo: str,
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Proxy para download de PDF do TJ-MS com cache."""
    try:
        from services.tjms.client import TJMSClient
        client = TJMSClient()
        conteudo = await client.baixar_documento(processo, doc_id)
        return Response(
            content=conteudo,
            media_type="application/pdf",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Content-Disposition": f"inline; filename=doc_{doc_id}.pdf",
            },
        )
    except Exception as e:
        logger.error(f"Erro ao baixar documento TJ-MS: {e}")
        raise HTTPException(502, f"Erro ao baixar documento: {str(e)}")
```

- [ ] **Step 4: Verificar imports**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from sistemas.revisao_pecas.router_chat import router as r1; from sistemas.revisao_pecas.router_documentos import router as r2; print(f'Chat: {len(r1.routes)}, Docs: {len(r2.routes)}')"`
Expected: Output with route counts

- [ ] **Step 5: Commit**

```bash
git add sistemas/revisao_pecas/services_chat.py sistemas/revisao_pecas/router_chat.py sistemas/revisao_pecas/router_documentos.py
git commit -m "feat(revisao): cria chat streaming SSE e proxy de documentos TJ-MS"
```

---

## Task 6: Backend — Registrar routers no main.py

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Ler main.py para encontrar onde registrar**

Ler o arquivo `main.py` e localizar o bloco de `app.include_router(...)` existente.

- [ ] **Step 2: Adicionar include_router para os 3 routers de revisao**

Adicionar ao bloco de include_router em `main.py`:

```python
# Sistema de Revisao de Pecas
from sistemas.revisao_pecas.router import router as revisao_router
from sistemas.revisao_pecas.router_chat import router as revisao_chat_router
from sistemas.revisao_pecas.router_documentos import router as revisao_docs_router

app.include_router(revisao_router, prefix="/revisao/api")
app.include_router(revisao_chat_router, prefix="/revisao/api")
app.include_router(revisao_docs_router, prefix="/revisao/api")
```

- [ ] **Step 3: Testar que o servidor inicia sem erro**

Run: `cd E:/Projetos/PGE/portal-pge && timeout 5 python -c "from main import app; print(f'Rotas totais: {len(app.routes)}')" || true`
Expected: No import errors

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat(revisao): registra routers de revisao no main.py"
```

---

## Task 7: Frontend — Instalar dependencias e setup base

**Files:**
- Modify: `frontend-react/package.json` (via npm install)
- Create: `frontend-react/src/pages/revisao/types.ts`
- Create: `frontend-react/src/pages/revisao/api.ts`
- Create: `frontend-react/src/pages/revisao/constants.ts`
- Modify: `frontend-react/src/lib/api.ts`

- [ ] **Step 1: Instalar dependencias TipTap e react-pdf**

```bash
cd frontend-react && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder react-pdf pdfjs-dist
```

- [ ] **Step 2: Criar types.ts**

```typescript
// frontend-react/src/pages/revisao/types.ts

export interface ClassificacaoData {
  acao_detalhada: string
  fundamentacao: string
  confianca: 'alta' | 'media' | 'baixa'
  urgencia: 'rotina' | 'prazo_correndo' | 'urgente'
  documentos_necessarios: string[]
}

export interface ItemRevisao {
  id: number
  numero_cnj: string
  source_session: string
  categoria: string
  resultado: string
  acao_sugerida: string
  tipo_peca: string | null
  resumo_revisor: string
  classificacao_data: ClassificacaoData | null
  status: string
  obs_status: string
  conteudo_peca: string | null
  conteudo_editado: string | null
  observacao_pge: string | null
  motivo_rejeicao: string | null
  acao_corrigida: string | null
  cdpendencia: number | null
  usuario_revisor_id: number | null
  usuario_encaminhado_id: number | null
  revisor_nome: string | null
  encaminhado_nome: string | null
  criado_em: string
  revisado_em: string | null
  concluido_em: string | null
}

export interface ItemRevisaoListResponse {
  itens: ItemRevisao[]
  total: number
  pagina: number
  por_pagina: number
}

export interface Estatisticas {
  total: number
  pendentes: number
  em_revisao: number
  aprovados: number
  encaminhados: number
  rejeitados: number
  concluidos: number
  aguardando_insercao: number
}

export interface Assessor {
  id: number
  usuario_id: number
  nome: string
  ativo: boolean
  criado_em: string
}

export interface ChatMensagem {
  id: number
  role: 'user' | 'assistant'
  conteudo: string
  conteudo_peca_snapshot: string | null
  criado_em: string
}

export interface DocumentoTJMS {
  id: string
  tipo: string
  descricao: string
  data: string
  codigo: number
}

export interface SSERevisaoEvent {
  tipo: 'inicio' | 'chunk' | 'sucesso' | 'erro'
  mensagem?: string
  texto?: string
  conteudo?: string
}
```

- [ ] **Step 3: Criar api.ts**

```typescript
// frontend-react/src/pages/revisao/api.ts

import { createApiClient } from '@/lib/api'
import type {
  ItemRevisao, ItemRevisaoListResponse, Estatisticas,
  Assessor, ChatMensagem,
} from './types'

const revisaoApi = createApiClient('/revisao/api')

// Listagem
interface FiltrosItens {
  status?: string
  urgencia?: string
  acao?: string
  assessor_id?: number
  tab?: string
  pagina?: number
  por_pagina?: number
}

export async function fetchItens(filtros: FiltrosItens): Promise<ItemRevisaoListResponse> {
  const qs = new URLSearchParams()
  if (filtros.status) qs.append('status', filtros.status)
  if (filtros.urgencia) qs.append('urgencia', filtros.urgencia)
  if (filtros.acao) qs.append('acao', filtros.acao)
  if (filtros.assessor_id) qs.append('assessor_id', String(filtros.assessor_id))
  if (filtros.tab) qs.append('tab', filtros.tab)
  if (filtros.pagina) qs.append('pagina', String(filtros.pagina))
  if (filtros.por_pagina) qs.append('por_pagina', String(filtros.por_pagina))
  return revisaoApi.get<ItemRevisaoListResponse>(`/itens?${qs.toString()}`)
}

export async function fetchItem(id: number): Promise<ItemRevisao> {
  return revisaoApi.get<ItemRevisao>(`/itens/${id}`)
}

export async function fetchEstatisticas(): Promise<Estatisticas> {
  return revisaoApi.get<Estatisticas>('/estatisticas')
}

// Acoes
export async function iniciarRevisao(id: number): Promise<ItemRevisao> {
  return revisaoApi.post<ItemRevisao>(`/itens/${id}/iniciar-revisao`)
}

export async function aprovarItem(id: number, conteudoFinal: string | null): Promise<ItemRevisao> {
  return revisaoApi.post<ItemRevisao>(`/itens/${id}/aprovar`, { conteudo_final: conteudoFinal })
}

export async function rejeitarItem(id: number, motivo: string, acaoCorrigida: string): Promise<ItemRevisao> {
  return revisaoApi.post<ItemRevisao>(`/itens/${id}/rejeitar`, {
    motivo_rejeicao: motivo,
    acao_corrigida: acaoCorrigida,
  })
}

export async function encaminharItem(id: number, assessorId: number): Promise<ItemRevisao> {
  return revisaoApi.post<ItemRevisao>(`/itens/${id}/encaminhar`, { assessor_id: assessorId })
}

export async function encaminharLote(
  itemIds: number[], assessorIds: number[], modo: 'manual' | 'aleatorio'
): Promise<{ total: number }> {
  return revisaoApi.post('/itens/encaminhar-lote', { item_ids: itemIds, assessor_ids: assessorIds, modo })
}

export async function marcarInserido(id: number): Promise<ItemRevisao> {
  return revisaoApi.post<ItemRevisao>(`/itens/${id}/marcar-inserido`)
}

export async function salvarConteudo(id: number, conteudo: string): Promise<ItemRevisao> {
  return revisaoApi.put<ItemRevisao>(`/itens/${id}/conteudo`, { conteudo })
}

// Chat
export async function fetchChatHistorico(itemId: number): Promise<ChatMensagem[]> {
  return revisaoApi.get<ChatMensagem[]>(`/itens/${itemId}/chat-historico`)
}

// Documentos
export async function fetchDocumentos(itemId: number): Promise<{ documentos: DocumentoTJMS[]; total: number }> {
  return revisaoApi.get(`/itens/${itemId}/documentos`)
}

// Assessores
export async function fetchAssessores(): Promise<Assessor[]> {
  return revisaoApi.get<Assessor[]>('/assessores')
}

export async function adicionarAssessor(usuarioId: number): Promise<Assessor> {
  return revisaoApi.post<Assessor>('/assessores', { usuario_id: usuarioId })
}

export async function removerAssessor(id: number): Promise<void> {
  return revisaoApi.delete(`/assessores/${id}`)
}

export async function toggleAssessor(id: number, ativo: boolean): Promise<void> {
  return revisaoApi.patch(`/assessores/${id}`, { ativo })
}

// Export DOCX
export async function exportarDocx(id: number): Promise<Blob> {
  return revisaoApi.post<Blob>(`/itens/${id}/exportar-docx`, undefined, { responseType: 'blob' } as any)
}

import type { DocumentoTJMS } from './types'
```

- [ ] **Step 4: Criar constants.ts**

```typescript
// frontend-react/src/pages/revisao/constants.ts

import { C } from '@/lib/designTokens'

export const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pendente: { label: 'Pendente', color: '#6b7280', bgColor: 'bg-gray-100' },
  em_revisao: { label: 'Em Revisao', color: '#3b82f6', bgColor: 'bg-blue-100' },
  aprovado: { label: 'Aprovado', color: '#10b981', bgColor: 'bg-green-100' },
  encaminhado: { label: 'Encaminhado', color: '#f59e0b', bgColor: 'bg-amber-100' },
  rejeitado: { label: 'Rejeitado', color: '#ef4444', bgColor: 'bg-red-100' },
  concluido: { label: 'Concluido', color: '#6366f1', bgColor: 'bg-indigo-100' },
}

export const OBS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  nao_aplicavel: { label: '', color: '' },
  aguardando_insercao: { label: 'Aguardando insercao local', color: '#f59e0b' },
  inserida: { label: 'Observacao inserida', color: '#10b981' },
  erro_insercao: { label: 'Erro na insercao', color: '#ef4444' },
}

export const RESULTADO_CONFIG: Record<string, { label: string; color: string }> = {
  favoravel: { label: 'Favoravel', color: '#10b981' },
  desfavoravel: { label: 'Desfavoravel', color: '#ef4444' },
  parcial: { label: 'Parcial', color: '#f59e0b' },
  neutro: { label: 'Neutro', color: '#6b7280' },
  indefinido: { label: 'Indefinido', color: '#9ca3af' },
}

export const URGENCIA_CONFIG: Record<string, { label: string; color: string }> = {
  rotina: { label: 'Rotina', color: '#10b981' },
  prazo_correndo: { label: 'Prazo correndo', color: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444' },
}

export const CONFIANCA_CONFIG: Record<string, { label: string; color: string }> = {
  alta: { label: 'Alta', color: '#10b981' },
  media: { label: 'Media', color: '#f59e0b' },
  baixa: { label: 'Baixa', color: '#ef4444' },
}

export const ACOES_SUGERIDAS = [
  { value: '', label: 'Todas as acoes' },
  { value: 'peca_complexa', label: 'Peca Complexa' },
  { value: 'peticao_ciencia', label: 'Peticao de Ciencia' },
  { value: 'anotacao_dispensa', label: 'Anotacao de Dispensa' },
  { value: 'peca_simples', label: 'Peca Simples' },
  { value: 'nada_a_fazer', label: 'Nada a Fazer' },
  { value: 'analise_humana', label: 'Analise Humana' },
]

export const ACOES_REJEICAO = [
  { value: 'peca_complexa', label: 'Gerar Contestacao/Recurso' },
  { value: 'peticao_ciencia', label: 'Gerar Peticao de Ciencia' },
  { value: 'peca_simples', label: 'Gerar Manifestacao Simples' },
  { value: 'analise_humana', label: 'Analise Humana Necessaria' },
  { value: 'outra', label: 'Outra Acao' },
]

export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return '-'
  return new Date(dataISO).toLocaleDateString('pt-BR', {
    timeZone: 'America/Campo_Grande',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 5: Adicionar revisaoApi ao api.ts global**

Adicionar em `frontend-react/src/lib/api.ts`:

```typescript
export const revisaoApi = createApiClient('/revisao/api')
```

- [ ] **Step 6: Commit**

```bash
cd frontend-react && git add package.json package-lock.json
cd .. && git add frontend-react/src/pages/revisao/types.ts frontend-react/src/pages/revisao/api.ts frontend-react/src/pages/revisao/constants.ts frontend-react/src/lib/api.ts
git commit -m "feat(revisao): setup frontend — deps TipTap/react-pdf, types, api, constants"
```

---

## Task 8: Frontend — Router + Sidebar

**Files:**
- Modify: `frontend-react/src/router.tsx`
- Modify: `frontend-react/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Adicionar rotas em router.tsx**

Ler `frontend-react/src/router.tsx` e adicionar:

```typescript
// Lazy imports (adicionar junto com os outros)
const RevisaoPage = lazyWithRetry(() =>
  import('@/pages/revisao/RevisaoPage').then(m => ({ default: m.RevisaoPage as ComponentType<unknown> }))
)
const RevisaoItemPage = lazyWithRetry(() =>
  import('@/pages/revisao/RevisaoItemPage').then(m => ({ default: m.RevisaoItemPage as ComponentType<unknown> }))
)
const AssessoresConfigPage = lazyWithRetry(() =>
  import('@/pages/revisao/components/Assessores/AssessoresConfig').then(m => ({ default: m.AssessoresConfig as ComponentType<unknown> }))
)

// Rotas (adicionar no addChildren do layoutRoute)
const revisaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/revisao',
  component: RevisaoPage,
})
const revisaoItemRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/revisao/$itemId',
  component: RevisaoItemPage,
})
const assessoresRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/revisao/assessores',
  component: AssessoresConfigPage,
})
```

Adicionar `revisaoRoute`, `revisaoItemRoute` e `assessoresRoute` ao array de `layoutRoute.addChildren([...])`.

- [ ] **Step 2: Adicionar item no Sidebar**

Ler `frontend-react/src/components/layout/Sidebar.tsx` e adicionar ao array `systemItems`:

```typescript
{ to: '/revisao', icon: ClipboardCheck, label: 'Revisao de Pecas' },
```

Importar `ClipboardCheck` de `lucide-react`.

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/router.tsx frontend-react/src/components/layout/Sidebar.tsx
git commit -m "feat(revisao): registra rotas React e adiciona item no sidebar"
```

---

## Task 9: Frontend — RevisaoPage (fila de revisao)

**Files:**
- Create: `frontend-react/src/pages/revisao/RevisaoPage.tsx`
- Create: `frontend-react/src/pages/revisao/hooks/useFilaRevisao.ts`
- Create: `frontend-react/src/pages/revisao/components/FilaRevisao/EstatisticasCards.tsx`
- Create: `frontend-react/src/pages/revisao/components/FilaRevisao/FiltrosRevisao.tsx`
- Create: `frontend-react/src/pages/revisao/components/FilaRevisao/TabelaItens.tsx`

Este task cria a pagina principal da fila de revisao com cards de estatisticas, filtros e tabela de itens. Implementar seguindo os patterns de FeedbacksPage (BreadcrumbBar + ContentArea + DataTable). A tabela deve ser clicavel, navegando para `/revisao/{id}`.

- [ ] **Step 1: Criar hook useFilaRevisao**
- [ ] **Step 2: Criar EstatisticasCards**
- [ ] **Step 3: Criar FiltrosRevisao**
- [ ] **Step 4: Criar TabelaItens**
- [ ] **Step 5: Criar RevisaoPage (compoe tudo)**
- [ ] **Step 6: Testar no navegador — acessar `/revisao` e verificar que carrega**
- [ ] **Step 7: Commit**

```bash
git add frontend-react/src/pages/revisao/
git commit -m "feat(revisao): cria pagina de fila de revisao com estatisticas, filtros e tabela"
```

---

## Task 10: Frontend — RevisaoItemPage (tela split-panel)

**Files:**
- Create: `frontend-react/src/pages/revisao/RevisaoItemPage.tsx`
- Create: `frontend-react/src/pages/revisao/hooks/useRevisaoItem.ts`
- Create: `frontend-react/src/pages/revisao/components/Revisao/ResumoIA.tsx`
- Create: `frontend-react/src/pages/revisao/components/Revisao/BarraStatus.tsx`
- Create: `frontend-react/src/pages/revisao/components/Revisao/EncaminharDialog.tsx`
- Create: `frontend-react/src/pages/revisao/components/Revisao/RejeicaoForm.tsx`

Este task cria o shell da pagina de revisao individual com layout split-panel conforme mockup aprovado: resumo IA no topo, barra de status com botoes, e duas colunas (esquerda: conteudo, direita: documentos).

- [ ] **Step 1: Criar hook useRevisaoItem**
- [ ] **Step 2: Criar ResumoIA (banner azul com badges)**
- [ ] **Step 3: Criar BarraStatus (status + botoes aprovar/encaminhar/rejeitar)**
- [ ] **Step 4: Criar EncaminharDialog (selecao de assessor)**
- [ ] **Step 5: Criar RejeicaoForm (acao corrigida + motivo)**
- [ ] **Step 6: Criar RevisaoItemPage (layout split-panel)**
- [ ] **Step 7: Testar — navegar para `/revisao/1` e verificar layout**
- [ ] **Step 8: Commit**

```bash
git add frontend-react/src/pages/revisao/
git commit -m "feat(revisao): cria tela de revisao individual com layout split-panel"
```

---

## Task 11: Frontend — EditorPeca (TipTap)

**Files:**
- Create: `frontend-react/src/pages/revisao/components/Revisao/EditorPeca.tsx`

Este task integra o TipTap como editor rico para a peca, com toolbar (bold, italic, headings, quote, undo/redo) e auto-save via debounce.

- [ ] **Step 1: Criar EditorPeca com TipTap**

Componente com:
- `useEditor` do `@tiptap/react` com `StarterKit` + `Placeholder`
- Toolbar com botoes: Bold, Italic, Heading 1/2, Blockquote, BulletList, Undo, Redo
- `EditorContent` renderizando o conteudo
- Auto-save via `useEffect` com debounce de 2s no `editor.getHTML()` chamando `salvarConteudo()`
- Prop `initialContent: string` (markdown) e `onContentChange: (html: string) => void`
- Converter markdown → HTML na inicializacao (TipTap aceita HTML)

- [ ] **Step 2: Integrar EditorPeca no RevisaoItemPage**
- [ ] **Step 3: Testar — editar texto e verificar auto-save**
- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/revisao/components/Revisao/EditorPeca.tsx
git commit -m "feat(revisao): integra editor TipTap com toolbar e auto-save"
```

---

## Task 12: Frontend — ChatRevisao (colapsavel)

**Files:**
- Create: `frontend-react/src/pages/revisao/components/Revisao/ChatRevisao.tsx`
- Create: `frontend-react/src/pages/revisao/hooks/useChatRevisao.ts`

Este task cria o chatbot colapsavel no rodape do painel esquerdo, usando SSE streaming.

- [ ] **Step 1: Criar hook useChatRevisao com useStreamingFetch**

Hook que:
- Usa `useStreamingFetch<SSERevisaoEvent>` para streaming
- Gerencia `mensagens: ChatMensagem[]` e `isStreaming: boolean`
- Metodo `enviarMensagem(texto, conteudoAtual)` que chama `/itens/{id}/chat-stream`
- Acumula chunks em `respostaAtual` durante streaming
- Ao receber `sucesso`, chama callback `onConteudoAtualizado(conteudo)`

- [ ] **Step 2: Criar ChatRevisao (componente colapsavel)**

Componente com:
- Estado `expandido: boolean` (default false)
- Colapsado: barra com input + botao enviar
- Expandido: historico de mensagens + input
- Ao enviar, expande automaticamente
- Mensagens do usuario (azul claro, esquerda) e da IA (verde claro, direita)
- Loading indicator durante streaming

- [ ] **Step 3: Integrar ChatRevisao no RevisaoItemPage**
- [ ] **Step 4: Testar — enviar mensagem e verificar streaming**
- [ ] **Step 5: Commit**

```bash
git add frontend-react/src/pages/revisao/components/Revisao/ChatRevisao.tsx frontend-react/src/pages/revisao/hooks/useChatRevisao.ts
git commit -m "feat(revisao): cria chatbot colapsavel com streaming SSE"
```

---

## Task 13: Frontend — PainelDocumentos (react-pdf)

**Files:**
- Create: `frontend-react/src/pages/revisao/components/Documentos/PainelDocumentos.tsx`
- Create: `frontend-react/src/pages/revisao/components/Documentos/ListaDocumentos.tsx`
- Create: `frontend-react/src/pages/revisao/components/Documentos/VisualizadorPdf.tsx`
- Create: `frontend-react/src/pages/revisao/hooks/useDocumentos.ts`

Este task cria o painel direito com lista de documentos e visualizador PDF inline.

- [ ] **Step 1: Criar hook useDocumentos**

Hook que busca lista de documentos via `fetchDocumentos(itemId)` e gerencia estado de `docSelecionado`.

- [ ] **Step 2: Criar ListaDocumentos (sidebar com lista clicavel)**

Sidebar (w-44) com:
- Header "Documentos (N)"
- Lista de documentos clicaveis
- Doc selecionado highlighted (bg-blue-50, border-left azul)

- [ ] **Step 3: Criar VisualizadorPdf (react-pdf wrapper)**

Componente com:
- `Document` e `Page` do `react-pdf`
- Controles de zoom (-, %, +)
- Scroll area para paginas
- Loading state
- Busca PDF via `/revisao/api/documentos/{processo}/{doc_id}`

- [ ] **Step 4: Criar PainelDocumentos (compoe ListaDocumentos + VisualizadorPdf)**
- [ ] **Step 5: Integrar PainelDocumentos no RevisaoItemPage (coluna direita)**
- [ ] **Step 6: Testar — selecionar documento e visualizar PDF**
- [ ] **Step 7: Commit**

```bash
git add frontend-react/src/pages/revisao/components/Documentos/ frontend-react/src/pages/revisao/hooks/useDocumentos.ts
git commit -m "feat(revisao): cria painel de documentos com react-pdf e lista clicavel"
```

---

## Task 14: Frontend — DistribuirDialog + AssessoresConfig

**Files:**
- Create: `frontend-react/src/pages/revisao/components/FilaRevisao/DistribuirDialog.tsx`
- Create: `frontend-react/src/pages/revisao/components/Assessores/AssessoresConfig.tsx`

- [ ] **Step 1: Criar DistribuirDialog**

Dialog com:
- Lista de assessores ativos (checkboxes)
- Opcao "Manual" vs "Aleatorio"
- Lista de itens selecionados
- Botao "Distribuir"
- Chama `encaminharLote()`

- [ ] **Step 2: Criar AssessoresConfig**

Pagina com:
- BreadcrumbBar "Configuracao de Assessores"
- Tabela de assessores com toggle ativo/inativo
- Botao "Adicionar Assessor" com select de usuarios
- Botao "Remover" por assessor

- [ ] **Step 3: Testar — acessar `/revisao/assessores`**
- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/revisao/components/FilaRevisao/DistribuirDialog.tsx frontend-react/src/pages/revisao/components/Assessores/AssessoresConfig.tsx
git commit -m "feat(revisao): cria distribuicao em lote e configuracao de assessores"
```

---

## Task 15: Frontend — Build e teste final

**Files:**
- Modify: `frontend-react/dist/` (build output)

- [ ] **Step 1: Build do frontend**

```bash
cd frontend-react && node node_modules/vite/bin/vite.js build
```
Expected: Build sem erros

- [ ] **Step 2: Testar todos os fluxos**

1. Acessar `/revisao` — fila deve carregar
2. Clicar em item — tela split-panel deve abrir
3. Editar texto no TipTap — auto-save
4. Enviar mensagem no chat — streaming
5. Visualizar documento PDF
6. Aprovar/rejeitar/encaminhar
7. Acessar `/revisao/assessores` — config deve funcionar

- [ ] **Step 3: Commit source + dist**

```bash
git add frontend-react/src/pages/revisao/
git add -f frontend-react/dist/
git commit -m "feat(revisao): build frontend completo do sistema de revisao de pecas"
```

---

## Task 16: Worker Local — Script de insercao de observacoes

**Files:**
- Create: `scripts/worker_revisao/config.py`
- Create: `scripts/worker_revisao/worker_observacoes.py`

- [ ] **Step 1: Criar config.py**

```python
# scripts/worker_revisao/config.py
"""Configuracao do worker local de insercao de observacoes."""

import os

# URL do portal-pge (local ou Railway)
PORTAL_URL = os.getenv("PORTAL_PGE_URL", "http://localhost:8000")

# Credenciais para autenticacao JWT
PORTAL_USER = os.getenv("PORTAL_PGE_USER", "admin")
PORTAL_PASS = os.getenv("PORTAL_PGE_PASS", "")

# Intervalo entre execucoes (segundos)
INTERVALO = int(os.getenv("WORKER_INTERVALO", "300"))  # 5 minutos

# Caminho do script de insercao do BD_PGE.NET
BD_PGE_SCRIPT = os.getenv(
    "BD_PGE_SCRIPT",
    r"E:\Projetos\Automacao_Total\BD_PGE.NET\scripts\inserir_observacao.py"
)
```

- [ ] **Step 2: Criar worker_observacoes.py**

```python
# scripts/worker_revisao/worker_observacoes.py
"""Worker local que consulta observacoes pendentes no portal-pge
e insere no BD_PGE.NET via VPN."""

import sys
import time
import logging
import subprocess
import requests
from config import PORTAL_URL, PORTAL_USER, PORTAL_PASS, INTERVALO, BD_PGE_SCRIPT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("worker_revisao.log")],
)
logger = logging.getLogger(__name__)


def autenticar() -> str:
    """Autentica no portal-pge e retorna o token JWT."""
    resp = requests.post(
        f"{PORTAL_URL}/auth/login",
        data={"username": PORTAL_USER, "password": PORTAL_PASS},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise ValueError("Token nao retornado pelo portal-pge")
    return token


def buscar_pendentes(token: str) -> list[dict]:
    """Busca observacoes pendentes de insercao."""
    resp = requests.get(
        f"{PORTAL_URL}/revisao/api/observacoes-pendentes",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def inserir_observacao(cdpendencia: int, texto: str) -> bool:
    """Insere observacao no BD_PGE.NET via script externo."""
    try:
        resultado = subprocess.run(
            [
                sys.executable, BD_PGE_SCRIPT,
                "--cdpendencia", str(cdpendencia),
                "--texto", texto,
                "--sem-confirmacao",
            ],
            capture_output=True, text=True, timeout=60,
        )
        if resultado.returncode == 0:
            logger.info(f"Observacao inserida: cdpendencia={cdpendencia}")
            return True
        else:
            logger.error(f"Erro ao inserir: {resultado.stderr}")
            return False
    except Exception as e:
        logger.error(f"Excecao ao inserir observacao: {e}")
        return False


def confirmar_no_portal(token: str, item_id: int, sucesso: bool, erro_msg: str | None = None):
    """Confirma no portal-pge que a observacao foi inserida (ou falhou)."""
    resp = requests.post(
        f"{PORTAL_URL}/revisao/api/observacoes/{item_id}/confirmar",
        headers={"Authorization": f"Bearer {token}"},
        json={"sucesso": sucesso, "erro_mensagem": erro_msg},
        timeout=10,
    )
    resp.raise_for_status()
    logger.info(f"Confirmacao enviada: item={item_id}, sucesso={sucesso}")


def executar_ciclo(token: str):
    """Executa um ciclo completo: buscar pendentes → inserir → confirmar."""
    pendentes = buscar_pendentes(token)
    if not pendentes:
        logger.info("Nenhuma observacao pendente")
        return

    logger.info(f"Encontradas {len(pendentes)} observacoes pendentes")

    for obs in pendentes:
        item_id = obs["item_id"]
        cdpendencia = obs["cdpendencia"]
        texto = obs["observacao_pge"]

        logger.info(f"Inserindo: item={item_id}, cdpendencia={cdpendencia}")
        sucesso = inserir_observacao(cdpendencia, texto)
        erro_msg = None if sucesso else "Falha na execucao do script de insercao"

        try:
            confirmar_no_portal(token, item_id, sucesso, erro_msg)
        except Exception as e:
            logger.error(f"Erro ao confirmar no portal: {e}")


def main():
    """Loop principal do worker."""
    logger.info(f"Worker de revisao iniciado. Intervalo: {INTERVALO}s")
    logger.info(f"Portal URL: {PORTAL_URL}")

    while True:
        try:
            token = autenticar()
            executar_ciclo(token)
        except KeyboardInterrupt:
            logger.info("Worker encerrado pelo usuario")
            break
        except Exception as e:
            logger.error(f"Erro no ciclo: {e}")

        logger.info(f"Aguardando {INTERVALO}s...")
        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add scripts/worker_revisao/
git commit -m "feat(revisao): cria worker local para insercao de observacoes no pge.net"
```

---

## Resumo de Tasks

| # | Task | Tipo | Estimativa |
|---|------|------|------------|
| 1 | Models (3 tabelas) | Backend | Pequeno |
| 2 | Schemas Pydantic | Backend | Pequeno |
| 3 | Services (logica de negocio) | Backend | Medio |
| 4 | Router principal (ingestao, listagem, revisao, assessores, worker) | Backend | Grande |
| 5 | Chat streaming + Documentos TJ-MS | Backend | Medio |
| 6 | Registrar routers no main.py | Backend | Pequeno |
| 7 | Frontend setup (deps, types, api, constants) | Frontend | Medio |
| 8 | Router + Sidebar | Frontend | Pequeno |
| 9 | RevisaoPage (fila) | Frontend | Grande |
| 10 | RevisaoItemPage (split-panel) | Frontend | Grande |
| 11 | EditorPeca (TipTap) | Frontend | Medio |
| 12 | ChatRevisao (colapsavel) | Frontend | Medio |
| 13 | PainelDocumentos (react-pdf) | Frontend | Medio |
| 14 | DistribuirDialog + AssessoresConfig | Frontend | Medio |
| 15 | Build + teste final | Frontend | Pequeno |
| 16 | Worker local | Script | Medio |
