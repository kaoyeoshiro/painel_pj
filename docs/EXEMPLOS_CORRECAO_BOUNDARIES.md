# Exemplos de Correção: Violações de Boundaries

> Exemplos práticos e comentados de como corrigir violações de boundaries arquiteturais.

## Índice

1. [Services importando FastAPI](#1-services-importando-fastapi)
2. [Routers fazendo queries diretas](#2-routers-fazendo-queries-diretas)
3. [Domain com dependências externas](#3-domain-com-dependências-externas)
4. [torch.load() direto](#4-torchload-direto)
5. [Endpoints de IA sem rate limit](#5-endpoints-de-ia-sem-rate-limit)
6. [Padrões avançados](#6-padrões-avançados)

---

## 1. Services importando FastAPI

### ❌ Problema: Service acoplado ao framework

```python
# app/services/documento_service.py
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

class DocumentoService:
    """Service para processar documentos."""

    def __init__(self, db: Session):
        self.db = db

    def processar(self, doc_id: int) -> dict:
        documento = self.db.query(Documento).get(doc_id)

        if not documento:
            # ❌ PROBLEMA: Service conhece HTTPException (acoplamento com FastAPI)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento não encontrado"
            )

        # Processa documento
        return {"resultado": "OK"}
```

**Violação:** `SERVICES_NO_FASTAPI`

### ✅ Solução: Exceptions de domínio

```python
# app/domain/exceptions.py
"""Exceptions de domínio do sistema."""

class DomainException(Exception):
    """Exception base para erros de domínio."""
    pass

class DocumentoNaoEncontrado(DomainException):
    """Documento não foi encontrado."""
    def __init__(self, doc_id: int):
        self.doc_id = doc_id
        super().__init__(f"Documento {doc_id} não encontrado")

class DocumentoInvalido(DomainException):
    """Documento possui dados inválidos."""
    pass


# app/services/documento_service.py
from sqlalchemy.orm import Session
from app.domain.exceptions import DocumentoNaoEncontrado, DocumentoInvalido

class DocumentoService:
    """Service para processar documentos."""

    def __init__(self, db: Session):
        self.db = db

    def processar(self, doc_id: int) -> dict:
        documento = self.db.query(Documento).get(doc_id)

        if not documento:
            # ✅ CORRETO: Usa exception de domínio
            raise DocumentoNaoEncontrado(doc_id)

        if not documento.conteudo:
            raise DocumentoInvalido("Documento sem conteúdo")

        # Processa documento
        return {"resultado": "OK"}


# app/api/documentos.py
from fastapi import APIRouter, HTTPException, status, Depends
from app.services.documento_service import DocumentoService
from app.domain.exceptions import DocumentoNaoEncontrado, DocumentoInvalido

router = APIRouter()

@router.post("/processar/{doc_id}")
async def processar_documento(
    doc_id: int,
    service: DocumentoService = Depends()
):
    """
    Processa um documento.

    A conversão de exceptions de domínio para HTTPException
    acontece APENAS na camada de API.
    """
    try:
        resultado = service.processar(doc_id)
        return resultado

    except DocumentoNaoEncontrado as e:
        # ✅ CORRETO: API converte exception de domínio para HTTP
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

    except DocumentoInvalido as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
```

**Benefícios:**
- ✅ Service testável sem mock de FastAPI
- ✅ Service reutilizável em CLI, workers, etc
- ✅ Separação clara de responsabilidades
- ✅ Domain-driven exceptions

---

## 2. Routers fazendo queries diretas

### ❌ Problema: Lógica de acesso a dados no router

```python
# app/api/usuarios.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User

router = APIRouter()

@router.get("/usuarios")
async def listar_usuarios(
    db: Session = Depends(get_db),
    ativo: bool = True
):
    # ❌ PROBLEMA: Query direta no router (violação de SRP)
    usuarios = db.query(User).filter(User.ativo == ativo).all()

    # ❌ PROBLEMA: Lógica de transformação no router
    return [
        {
            "id": u.id,
            "nome": u.full_name,
            "email": u.email
        }
        for u in usuarios
    ]
```

**Violação:** `NO_DB_IN_ROUTER`

### ✅ Solução 1: Repository + DTO

```python
# app/repositories/user_repository.py
from typing import Protocol
from sqlalchemy.orm import Session
from database.models import User

class UserRepository(Protocol):
    """Interface do repository de usuários."""

    def listar_ativos(self) -> list[User]:
        """Lista todos os usuários ativos."""
        ...

class SQLAlchemyUserRepository:
    """Implementação SQLAlchemy do repository de usuários."""

    def __init__(self, db: Session):
        self.db = db

    def listar_ativos(self) -> list[User]:
        return self.db.query(User).filter(User.ativo == True).all()

    def listar_inativos(self) -> list[User]:
        return self.db.query(User).filter(User.ativo == False).all()

    def buscar_por_id(self, user_id: int) -> User | None:
        return self.db.query(User).get(user_id)


# app/schemas/user_schema.py
from pydantic import BaseModel

class UserDTO(BaseModel):
    """DTO para retorno de usuário."""
    id: int
    nome: str
    email: str

    class Config:
        from_attributes = True  # Permite .from_orm()


# app/api/usuarios.py
from fastapi import APIRouter, Depends
from app.repositories.user_repository import SQLAlchemyUserRepository
from app.schemas.user_schema import UserDTO

router = APIRouter()

@router.get("/usuarios", response_model=list[UserDTO])
async def listar_usuarios(
    ativo: bool = True,
    repo: SQLAlchemyUserRepository = Depends()
):
    """
    Lista usuários.

    ✅ Router não conhece banco de dados.
    ✅ Repository encapsula queries.
    ✅ DTO garante contrato de resposta.
    """
    if ativo:
        usuarios = repo.listar_ativos()
    else:
        usuarios = repo.listar_inativos()

    return [UserDTO.from_orm(u) for u in usuarios]
```

### ✅ Solução 2: Service Layer (recomendado)

```python
# app/services/user_service.py
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserDTO

class UserService:
    """Service para operações com usuários."""

    def __init__(self, repo: UserRepository):
        self.repo = repo

    def listar_usuarios(self, ativo: bool = True) -> list[UserDTO]:
        """Lista usuários ativos ou inativos."""
        if ativo:
            usuarios = self.repo.listar_ativos()
        else:
            usuarios = self.repo.listar_inativos()

        # ✅ Transformação acontece no service
        return [UserDTO.from_orm(u) for u in usuarios]


# app/api/usuarios.py
from fastapi import APIRouter, Depends
from app.services.user_service import UserService
from app.schemas.user_schema import UserDTO

router = APIRouter()

@router.get("/usuarios", response_model=list[UserDTO])
async def listar_usuarios(
    ativo: bool = True,
    service: UserService = Depends()
):
    """
    Lista usuários.

    ✅ Router delega para service.
    ✅ Service orquestra repository + lógica de negócio.
    ✅ Testável com mock de repository.
    """
    return service.listar_usuarios(ativo)
```

---

## 3. Domain com dependências externas

### ❌ Problema: Entidade acoplada ao ORM

```python
# app/domain/documento.py
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

# ❌ PROBLEMA: Entidade de domínio é também model de ORM
class Documento(Base):
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True)
    titulo = Column(String(255), nullable=False)
    conteudo = Column(Text, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)

    # ❌ PROBLEMA: Lógica de negócio misturada com ORM
    def validar(self):
        if not self.titulo or len(self.titulo) < 3:
            raise ValueError("Título inválido")
```

**Violação:** `DOMAIN_NO_EXTERNAL_DEPS`

### ✅ Solução: Separar Domain de ORM

```python
# app/domain/documento.py
"""Entidades puras de domínio."""
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Documento:
    """
    Entidade de domínio: Documento.

    ✅ Sem dependências externas.
    ✅ Testável sem banco de dados.
    ✅ Reutilizável em qualquer contexto.
    """
    id: int
    titulo: str
    conteudo: str
    criado_em: datetime

    def validar(self):
        """Valida regras de negócio."""
        if not self.titulo or len(self.titulo) < 3:
            raise ValueError("Título deve ter pelo menos 3 caracteres")

        if not self.conteudo:
            raise ValueError("Conteúdo não pode ser vazio")

    def resumo(self, max_chars: int = 100) -> str:
        """Retorna resumo do conteúdo."""
        if len(self.conteudo) <= max_chars:
            return self.conteudo
        return self.conteudo[:max_chars] + "..."


# database/models.py
"""Models de ORM (infraestrutura)."""
from sqlalchemy import Column, Integer, String, Text, DateTime
from database.connection import Base
from datetime import datetime

class DocumentoModel(Base):
    """
    Model de ORM para tabela documentos.

    ✅ Separado da entidade de domínio.
    ✅ Concerns de persistência isolados.
    """
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True)
    titulo = Column(String(255), nullable=False)
    conteudo = Column(Text, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)


# app/repositories/documento_repository.py
"""Repository: adapter entre domain e ORM."""
from sqlalchemy.orm import Session
from app.domain.documento import Documento
from database.models import DocumentoModel

class DocumentoRepository:
    """Repository para documentos."""

    def __init__(self, db: Session):
        self.db = db

    def to_domain(self, model: DocumentoModel) -> Documento:
        """Converte model de ORM para entidade de domínio."""
        return Documento(
            id=model.id,
            titulo=model.titulo,
            conteudo=model.conteudo,
            criado_em=model.criado_em
        )

    def to_model(self, documento: Documento) -> DocumentoModel:
        """Converte entidade de domínio para model de ORM."""
        return DocumentoModel(
            id=documento.id,
            titulo=documento.titulo,
            conteudo=documento.conteudo,
            criado_em=documento.criado_em
        )

    def buscar(self, doc_id: int) -> Documento | None:
        """Busca documento por ID."""
        model = self.db.query(DocumentoModel).get(doc_id)
        return self.to_domain(model) if model else None

    def salvar(self, documento: Documento) -> Documento:
        """Salva documento."""
        # ✅ Valida regras de negócio antes de salvar
        documento.validar()

        model = self.to_model(documento)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)

        return self.to_domain(model)
```

**Benefícios:**
- ✅ Domain entities testáveis sem banco
- ✅ Fácil trocar ORM (SQLAlchemy → outro)
- ✅ Regras de negócio centralizadas no domain
- ✅ Repositório como adapter (Hexagonal Architecture)

---

## 4. torch.load() direto

### ❌ Problema: Vulnerabilidade de RCE

```python
# sistemas/bert_training/services.py
import torch

class BertModelLoader:
    def carregar_modelo(self, path: str):
        # ❌ PROBLEMA: torch.load() permite execução arbitrária de código
        model = torch.load(path)
        return model
```

**Violação:** `NO_RAW_TORCH_LOAD`

### ✅ Solução: Usar safe_torch_load

```python
# sistemas/bert_training/services.py
from utils.safe_torch import safe_torch_load

class BertModelLoader:
    def carregar_modelo(self, path: str):
        # ✅ CORRETO: safe_torch_load valida pickle antes de carregar
        model = safe_torch_load(
            path,
            allowed_classes=['torch.nn.modules.*', 'collections.OrderedDict']
        )
        return model
```

---

## 5. Endpoints de IA sem rate limit

### ❌ Problema: Sem controle de uso

```python
# sistemas/gerador_pecas/router.py
from fastapi import APIRouter
from services.gemini_service import GeminiService

router = APIRouter()

@router.post("/gerar-peca")
async def gerar_peca(prompt: str):
    # ❌ PROBLEMA: Sem rate limiting
    # - Usuário pode estourar quota da API
    # - Custos não controlados
    # - Vulnerável a DoS
    return await GeminiService.generate(prompt)
```

**Violação:** `AI_ENDPOINT_NEEDS_RATE_LIMIT`

### ✅ Solução: Rate limit + quota

```python
# sistemas/gerador_pecas/router.py
from fastapi import APIRouter, Request, Depends
from services.gemini_service import GeminiService
from utils.rate_limit import limiter, LIMITS, get_user_identifier
from utils.quota_manager import check_ai_quota
from auth.dependencies import get_current_user

router = APIRouter()

@router.post("/gerar-peca")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)  # ✅ Rate limit
async def gerar_peca(
    payload: GerarPecaRequest,  # Renomeado de 'request'
    request: Request,  # ✅ Necessário para SlowAPI
    current_user = Depends(get_current_user)
):
    """
    Gera peça jurídica usando IA.

    ✅ Rate limit: 10 req/min (usuário comum), 30 req/min (admin)
    ✅ Quota: 100 req/dia (usuário comum), 500 req/dia (admin)
    """
    # ✅ Verifica quota diária
    await check_ai_quota(current_user)

    # Processa request
    return await GeminiService.generate(payload.prompt)
```

---

## 6. Padrões avançados

### Injeção de Dependências

```python
# app/dependencies.py
from sqlalchemy.orm import Session
from database.connection import get_db
from app.repositories.user_repository import SQLAlchemyUserRepository
from app.services.user_service import UserService

def get_user_repository(db: Session = Depends(get_db)) -> SQLAlchemyUserRepository:
    """Factory para repository de usuários."""
    return SQLAlchemyUserRepository(db)

def get_user_service(
    repo: SQLAlchemyUserRepository = Depends(get_user_repository)
) -> UserService:
    """Factory para service de usuários."""
    return UserService(repo)


# app/api/usuarios.py
from fastapi import APIRouter, Depends
from app.dependencies import get_user_service
from app.services.user_service import UserService

router = APIRouter()

@router.get("/usuarios")
async def listar(service: UserService = Depends(get_user_service)):
    """
    ✅ Injeção de dependências em cadeia:
    DB → Repository → Service → API
    """
    return service.listar_usuarios()
```

### Repository com Protocol (typing)

```python
# app/repositories/base.py
from typing import Protocol, TypeVar, Generic

T = TypeVar("T")

class Repository(Protocol, Generic[T]):
    """Interface base para repositories."""

    def buscar(self, id: int) -> T | None:
        """Busca entidade por ID."""
        ...

    def listar(self) -> list[T]:
        """Lista todas as entidades."""
        ...

    def salvar(self, entidade: T) -> T:
        """Salva entidade."""
        ...


# app/repositories/user_repository.py
from app.domain.user import User
from database.models import UserModel

class SQLAlchemyUserRepository:
    """Implementa Repository[User]."""

    def buscar(self, id: int) -> User | None:
        model = self.db.query(UserModel).get(id)
        return self.to_domain(model) if model else None

    # ... outros métodos
```

### Service com múltiplos repositories

```python
# app/services/relatorio_service.py
from app.repositories.user_repository import UserRepository
from app.repositories.documento_repository import DocumentoRepository

class RelatorioService:
    """Service que agrega dados de múltiplos repositories."""

    def __init__(
        self,
        user_repo: UserRepository,
        doc_repo: DocumentoRepository
    ):
        self.user_repo = user_repo
        self.doc_repo = doc_repo

    def gerar_relatorio_usuario(self, user_id: int) -> dict:
        """Gera relatório agregando dados de usuário + documentos."""
        user = self.user_repo.buscar(user_id)
        documentos = self.doc_repo.listar_por_autor(user_id)

        return {
            "usuario": user,
            "total_documentos": len(documentos),
            "documentos_recentes": documentos[:5]
        }
```

---

## Checklist de Revisão

Antes de commitar, verifique:

- [ ] Services não importam FastAPI/Starlette
- [ ] Routers não fazem queries diretas (usam repository/service)
- [ ] Domain entities não têm dependências externas
- [ ] Nenhum `torch.load()` direto (usar `safe_torch_load`)
- [ ] Endpoints de IA têm `@limiter.limit` + `check_ai_quota`
- [ ] Injeção de dependências usada corretamente
- [ ] DTOs/schemas para contratos de API
- [ ] Exceptions de domínio (não HTTPException em services)

Execute localmente:
```bash
python scripts/check_boundaries.py
pytest tests/test_architecture_boundaries.py -v
```

---

## Referências

- [Guia de Boundary Checks](./GUIA_BOUNDARY_CHECKS.md)
- [README Boundaries](../scripts/README_BOUNDARIES.md)
- [SOLID Principles](../CLAUDE.md#princípios-solid)
