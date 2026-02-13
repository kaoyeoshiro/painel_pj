# Architecture Boundary Checks

Sistema automatizado de verificação de boundaries arquiteturais do Portal PGE.

## Visão Geral

Este sistema garante que as camadas da aplicação respeitem os contratos arquiteturais estabelecidos, evitando acoplamento indevido e mantendo a separação de responsabilidades.

## Componentes

### 1. Script de Verificação (`check_boundaries.py`)

Script standalone que verifica violações arquiteturais.

**Uso:**
```bash
python scripts/check_boundaries.py
```

**Regras verificadas:**

| Regra | Descrição | Severidade |
|-------|-----------|------------|
| `SERVICES_NO_FASTAPI` | `app/services/` não deve importar FastAPI/Starlette | Error |
| `NO_RAW_TORCH_LOAD` | Nenhum arquivo deve usar `torch.load()` diretamente | Error |
| `NO_DB_IN_ROUTER` | `app/api/` não deve fazer queries diretas ao banco | Error |
| `DOMAIN_NO_EXTERNAL_DEPS` | `app/domain/` não deve importar libs externas | Warning |
| `AI_ENDPOINT_NEEDS_RATE_LIMIT` | Endpoints de IA devem ter `@limiter.limit` | Warning |

**Exit codes:**
- `0`: Nenhum erro encontrado (warnings são permitidos)
- `1`: Erros encontrados

**Características:**
- ✅ Funciona standalone (apenas stdlib)
- ✅ Output colorido no terminal (ANSI codes)
- ✅ Compatível com Windows (encoding UTF-8)
- ✅ Agrupa violações por regra
- ✅ Distingue erros de warnings

### 2. Testes Pytest (`test_architecture_boundaries.py`)

Testes automatizados que verificam as mesmas regras.

**Uso:**
```bash
pytest tests/test_architecture_boundaries.py -v
```

**Classes de teste:**
- `TestArchitectureBoundaries`: Verificações obrigatórias (boundaries)
- `TestArchitecturePatterns`: Padrões recomendados (boas práticas)

### 3. CI Pipeline (`.github/workflows/architecture.yml`)

Workflow do GitHub Actions que executa os checks em PRs.

**Triggers:**
- Pull requests que modificam `app/`, `services/`, `sistemas/`, `admin/`, `utils/`
- Push para `main`, `develop`, `refactor/**`

**Jobs:**
- `boundaries`: Executa `check_boundaries.py`
- `architecture-tests`: Executa testes pytest

## Regras Detalhadas

### SERVICES_NO_FASTAPI

**Problema:**
Services que importam FastAPI ficam acoplados ao framework web, dificultando testes e reutilização.

**Exemplo incorreto:**
```python
# app/services/documento_service.py
from fastapi import HTTPException  # ❌ ERRADO

class DocumentoService:
    def processar(self, doc: str):
        if not doc:
            raise HTTPException(status_code=400)  # ❌ Acoplamento com FastAPI
```

**Exemplo correto:**
```python
# app/services/documento_service.py
class DocumentoNaoEncontrado(Exception):  # ✅ Exception customizada
    pass

class DocumentoService:
    def processar(self, doc: str):
        if not doc:
            raise DocumentoNaoEncontrado()  # ✅ Sem acoplamento
```

### NO_RAW_TORCH_LOAD

**Problema:**
`torch.load()` permite execução arbitrária de código (RCE), sendo um risco de segurança.

**Exemplo incorreto:**
```python
import torch

model = torch.load("model.pt")  # ❌ Vulnerável a RCE
```

**Exemplo correto:**
```python
from utils.safe_torch import safe_torch_load

model = safe_torch_load("model.pt")  # ✅ Carregamento seguro
```

### NO_DB_IN_ROUTER

**Problema:**
Routers que fazem queries diretas violam a separação de responsabilidades e dificultam testes.

**Exemplo incorreto:**
```python
# app/api/documentos.py
@router.get("/documentos")
async def listar(db: Session = Depends(get_db)):
    docs = db.query(Documento).all()  # ❌ Query direta
    return docs
```

**Exemplo correto:**
```python
# app/api/documentos.py
@router.get("/documentos")
async def listar(service: DocumentoService = Depends()):
    docs = await service.listar()  # ✅ Usa service
    return docs
```

### DOMAIN_NO_EXTERNAL_DEPS

**Problema:**
Entidades de domínio com dependências externas dificultam testes e violam DIP.

**Exemplo incorreto:**
```python
# app/domain/documento.py
from sqlalchemy import Column, String  # ❌ Acoplamento com ORM
from pydantic import BaseModel  # ❌ Dependência externa

class Documento(BaseModel):  # ❌ Não é entidade pura
    titulo: str
```

**Exemplo correto:**
```python
# app/domain/documento.py
from dataclasses import dataclass  # ✅ Stdlib apenas

@dataclass
class Documento:  # ✅ Entidade pura
    titulo: str
    conteudo: str
```

### AI_ENDPOINT_NEEDS_RATE_LIMIT

**Problema:**
Endpoints de IA sem rate limiting podem causar:
- Estouro de quota da API
- Custos não controlados
- Ataques de denial-of-service

**Exemplo incorreto:**
```python
@router.post("/gerar")
async def gerar_texto(prompt: str):  # ❌ Sem rate limit
    return await gemini_service.generate(prompt)
```

**Exemplo correto:**
```python
from utils.rate_limit import limiter, LIMITS, get_user_identifier

@router.post("/gerar")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)  # ✅ Com rate limit
async def gerar_texto(prompt: str, request: Request):
    return await gemini_service.generate(prompt)
```

## Exclusões

### Arquivos Excluídos do Check `NO_RAW_TORCH_LOAD`

- `utils/safe_torch.py` - Implementação do wrapper seguro
- `tests/test_torch_load_safety.py` - Testes do wrapper
- `tests/test_architecture_boundaries.py` - Próprio arquivo de teste
- `scripts/check_boundaries.py` - Próprio script de verificação

### Arquivos Excluídos do Check `NO_DB_IN_ROUTER`

- `app/api/bootstrap.py` - Inicialização do app
- `app/api/__init__.py` - Imports públicos

## Integrando Novos Checks

Para adicionar uma nova regra de verificação:

1. **Adicionar função de check no script:**

```python
def check_minha_nova_regra(root: Path) -> list[Violation]:
    """Descrição da regra."""
    violations = []

    for py_file in root.rglob("*.py"):
        # Lógica de verificação
        violations.append(Violation(
            normalize_path(py_file, root),
            line_number,
            "MINHA_REGRA",
            "Mensagem descritiva",
            "error"  # ou "warning"
        ))

    return violations
```

2. **Adicionar no `main()`:**

```python
checks = [
    # ... checks existentes
    ("Minha nova regra", check_minha_nova_regra),
]
```

3. **Adicionar teste correspondente:**

```python
def test_minha_nova_regra(self, project_root):
    """Descrição do teste."""
    # Implementar teste
```

## Troubleshooting

### Script falha com UnicodeEncodeError no Windows

O script já configura encoding UTF-8 automaticamente. Se ainda assim falhar:

```bash
# PowerShell
$env:PYTHONIOENCODING="utf-8"
python scripts/check_boundaries.py

# CMD
set PYTHONIOENCODING=utf-8
python scripts\check_boundaries.py
```

### Muitos warnings de rate limiting

Os warnings de rate limiting são esperados em código legado. Para desabilitá-los temporariamente:

```python
# Em check_boundaries.py, comente a linha:
# all_violations.extend(check_ai_endpoints_have_rate_limit(root))
```

### False positives

Se um arquivo legítimo está sendo marcado incorretamente:

1. Adicione-o à lista `excluded` na função do check correspondente
2. Documente o motivo na seção "Exclusões" deste README

## Roadmap

- [ ] Check: `app/repositories/` implementam interfaces/protocolos
- [ ] Check: Services têm testes unitários correspondentes
- [ ] Check: Domain entities usam `@dataclass` ou `BaseModel`
- [ ] Check: Endpoints de upload validam magic bytes
- [ ] Check: Nenhum secret hardcoded no código
- [ ] Integração com pre-commit hooks
- [ ] Métricas de cobertura de boundaries no dashboard

## Referências

- [ADR-0013: Refatoração Backend](../docs/decisions/ADR-0013-refactor-backend.md)
- [SOLID Principles](../CLAUDE.md#princípios-solid)
- [Segurança - Regras Obrigatórias](../CLAUDE.md#regras-de-segurança)
