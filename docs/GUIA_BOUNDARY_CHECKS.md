# Guia Rápido: Architecture Boundary Checks

> Guia para desenvolvedores do Portal PGE sobre como usar e entender os checks de boundaries arquiteturais.

## O que são Boundary Checks?

São verificações automatizadas que garantem que as camadas da aplicação não se acoplam indevidamente. Por exemplo:
- Services não podem importar FastAPI (devem ser agnósticos ao framework)
- Routers não podem fazer queries diretas ao banco (devem usar repositories)
- Domain entities não podem ter dependências externas (devem ser puras)

## Como Usar

### Localmente (antes de commitar)

```bash
# Verificar boundaries
python scripts/check_boundaries.py

# Rodar testes de arquitetura
pytest tests/test_architecture_boundaries.py -v
```

**Output esperado sem violações:**
```
Verificando boundaries arquiteturais...

  > Services não importa FastAPI... OK
  > Nenhum torch.load() direto... OK
  > Routers novos sem db.query... OK
  > Domain sem dependências externas... OK
  > Endpoints de IA com rate limit... OK

OK - Nenhuma violação arquitetural encontrada.
```

### No CI (GitHub Actions)

O check roda automaticamente em:
- ✅ Todo PR que modifica `app/`, `services/`, `sistemas/`, `admin/`
- ✅ Todo push para `main`, `develop`, `refactor/**`

Se houver **erros** (não warnings), o PR será bloqueado até correção.

## Corrigindo Violações Comuns

### ❌ `SERVICES_NO_FASTAPI`

**Problema:**
```python
# app/services/documento_service.py
from fastapi import HTTPException  # ❌ ERRADO

class DocumentoService:
    def processar(self):
        raise HTTPException(status_code=400)
```

**Solução:**
```python
# app/services/documento_service.py
class DocumentoInvalido(Exception):  # ✅ CORRETO
    pass

class DocumentoService:
    def processar(self):
        raise DocumentoInvalido()
```

No router, converter para HTTPException:
```python
# app/api/documentos.py
from fastapi import HTTPException

try:
    service.processar()
except DocumentoInvalido as e:
    raise HTTPException(status_code=400, detail=str(e))
```

---

### ❌ `NO_RAW_TORCH_LOAD`

**Problema:**
```python
import torch
model = torch.load("model.pt")  # ❌ Vulnerável a RCE
```

**Solução:**
```python
from utils.safe_torch import safe_torch_load
model = safe_torch_load("model.pt")  # ✅ Seguro
```

---

### ❌ `NO_DB_IN_ROUTER`

**Problema:**
```python
# app/api/documentos.py
@router.get("/docs")
async def listar(db: Session = Depends(get_db)):
    return db.query(Documento).all()  # ❌ Query direta
```

**Solução 1: Criar Repository**
```python
# app/repositories/documento_repo.py
class DocumentoRepository:
    def __init__(self, db: Session):
        self.db = db

    async def listar_todos(self) -> list[Documento]:
        return self.db.query(Documento).all()

# app/api/documentos.py
@router.get("/docs")
async def listar(repo: DocumentoRepository = Depends()):
    return await repo.listar_todos()  # ✅ Usa repository
```

**Solução 2: Criar Service**
```python
# app/services/documento_service.py
class DocumentoService:
    def __init__(self, repo: DocumentoRepository):
        self.repo = repo

    async def listar(self) -> list[DocumentoDTO]:
        docs = await self.repo.listar_todos()
        return [DocumentoDTO.from_orm(d) for d in docs]

# app/api/documentos.py
@router.get("/docs")
async def listar(service: DocumentoService = Depends()):
    return await service.listar()  # ✅ Usa service
```

---

### ⚠️ `AI_ENDPOINT_NEEDS_RATE_LIMIT`

**Problema:**
```python
@router.post("/gerar")
async def gerar_texto(prompt: str):  # ❌ Sem rate limit
    return await gemini.generate(prompt)
```

**Solução:**
```python
from fastapi import Request
from utils.rate_limit import limiter, LIMITS, get_user_identifier

@router.post("/gerar")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def gerar_texto(
    prompt: str,
    request: Request  # ✅ Necessário para SlowAPI
):
    return await gemini.generate(prompt)
```

**IMPORTANTE:** Se endpoint já tem parâmetro `request`, renomear para evitar colisão:
```python
@router.post("/gerar")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def gerar_texto(
    payload: GerarRequest,  # ✅ Renomeado de 'request'
    request: Request  # Necessário para SlowAPI
):
    return await gemini.generate(payload.prompt)
```

---

### ⚠️ `DOMAIN_NO_EXTERNAL_DEPS`

**Problema:**
```python
# app/domain/documento.py
from sqlalchemy import Column, String  # ❌ Acoplamento com ORM
from pydantic import BaseModel

class Documento(Base):  # ❌ Herda de Base do SQLAlchemy
    __tablename__ = "documentos"
    id = Column(Integer, primary_key=True)
```

**Solução:**
```python
# app/domain/documento.py (entidade pura)
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Documento:  # ✅ Entidade pura de domínio
    id: int
    titulo: str
    conteudo: str
    criado_em: datetime

# database/models.py (ORM separado)
from sqlalchemy import Column, Integer, String, DateTime
from database.connection import Base

class DocumentoModel(Base):  # ✅ Model de ORM separado
    __tablename__ = "documentos"
    id = Column(Integer, primary_key=True)
    titulo = Column(String(255))
    conteudo = Column(Text)
    criado_em = Column(DateTime)

# app/repositories/documento_repo.py (adapter)
class DocumentoRepository:
    def to_domain(self, model: DocumentoModel) -> Documento:
        return Documento(
            id=model.id,
            titulo=model.titulo,
            conteudo=model.conteudo,
            criado_em=model.criado_em
        )
```

## Exclusões

Se um arquivo **legítimo** é marcado incorretamente, adicione-o à lista de exclusões:

```python
# scripts/check_boundaries.py

def check_no_raw_torch_load(root: Path) -> list[Violation]:
    excluded = {
        "utils/safe_torch.py",
        "tests/test_torch_load_safety.py",
        "meu_arquivo_especial.py",  # ✅ Adicionar aqui
    }
    # ...
```

**Importante:** Documente o motivo na [seção de exclusões](../scripts/README_BOUNDARIES.md#exclusões).

## FAQ

### Por que warnings não bloqueiam o merge?

Warnings indicam code smells no código legado. Corrigi-los é recomendado mas não obrigatório. Erros indicam violações sérias que **devem** ser corrigidas.

### Posso desabilitar um check temporariamente?

Não é recomendado, mas em casos excepcionais:

```python
# scripts/check_boundaries.py - main()
checks = [
    # ("Endpoints de IA com rate limit", check_ai_endpoints_have_rate_limit),  # ❌ Comentado
]
```

Documente o motivo em um TODO e crie um issue para reabilitar.

### Como adicionar uma nova regra?

1. Implemente a função `check_minha_regra()` em `scripts/check_boundaries.py`
2. Adicione no array `checks` em `main()`
3. Crie teste correspondente em `tests/test_architecture_boundaries.py`
4. Documente em `scripts/README_BOUNDARIES.md`
5. Atualize este guia com exemplos de correção

### O que fazer se o CI falhar mas local passa?

1. Verifique se está na branch correta
2. Execute `git pull` para garantir código atualizado
3. Rode localmente: `python scripts/check_boundaries.py`
4. Se ainda assim houver divergência, veja logs do CI para detalhes

### Pre-commit hooks são obrigatórios?

Não. Temos um exemplo em `.pre-commit-config.example.yaml` mas seu uso é opcional. O CI garantirá compliance de qualquer forma.

Para habilitar:
```bash
pip install pre-commit
mv .pre-commit-config.example.yaml .pre-commit-config.yaml
pre-commit install
```

## Recursos

- [README Boundaries](../scripts/README_BOUNDARIES.md) - Documentação completa
- [ADR-0014](./decisions/ADR-0014-architecture-boundary-checks.md) - Decisão arquitetural
- [SOLID Principles](../CLAUDE.md#princípios-solid) - Fundamentos
- [Plano de Melhorias Backend](./planejamento/PLANO_MELHORIAS_BACKEND.md) - Contexto da refatoração

## Suporte

Dúvidas sobre boundary checks?

1. Leia a [documentação completa](../scripts/README_BOUNDARIES.md)
2. Veja exemplos de correção neste guia
3. Consulte o time de arquitetura no Slack (#pge-dev)
4. Abra uma issue no GitHub com tag `architecture`
