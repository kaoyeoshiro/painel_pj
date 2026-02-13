# ADR-0014: Architecture Boundary Checks

**Status:** Aceito
**Data:** 2026-02-12
**Autores:** T13-BoundaryEnforce (Claude Agent)
**Contexto:** Refatoração do backend para estrutura em camadas (app/domain, app/services, app/api)

## Contexto

Durante a refatoração do backend do Portal PGE para uma arquitetura em camadas, identificamos a necessidade de garantir automaticamente que os boundaries arquiteturais sejam respeitados. Sem verificações automatizadas, é fácil introduzir acoplamento indevido entre camadas, violando princípios SOLID e dificultando manutenção futura.

**Problemas identificados:**
1. Services importando FastAPI (acoplamento com framework web)
2. Routers fazendo queries diretas ao banco (violação de SRP)
3. Domain entities com dependências externas (violação de DIP)
4. Uso de `torch.load()` direto (risco de RCE)
5. Endpoints de IA sem rate limiting (risco de custo/DoS)

## Decisão

Implementamos um sistema automatizado de verificação de boundaries arquiteturais composto por:

### 1. Script de Verificação (`scripts/check_boundaries.py`)

Script standalone que verifica 5 regras arquiteturais:

| Regra | Severidade | Descrição |
|-------|------------|-----------|
| `SERVICES_NO_FASTAPI` | Error | `app/services/` não importa FastAPI/Starlette |
| `NO_RAW_TORCH_LOAD` | Error | Nenhum `torch.load()` direto (usar `safe_torch_load`) |
| `NO_DB_IN_ROUTER` | Error | `app/api/` não faz queries diretas |
| `DOMAIN_NO_EXTERNAL_DEPS` | Warning | `app/domain/` sem deps externas |
| `AI_ENDPOINT_NEEDS_RATE_LIMIT` | Warning | Endpoints de IA com `@limiter.limit` |

**Características:**
- ✅ Standalone (apenas stdlib)
- ✅ Output colorido (ANSI codes)
- ✅ Compatível Windows (UTF-8)
- ✅ Exit code 1 em erros, 0 em warnings

### 2. Testes Pytest (`tests/test_architecture_boundaries.py`)

Testes automatizados que verificam as mesmas regras + padrões recomendados:
- `TestArchitectureBoundaries`: Verificações obrigatórias
- `TestArchitecturePatterns`: Padrões recomendados (boas práticas)

### 3. CI Pipeline (`.github/workflows/architecture.yml`)

Workflow que executa os checks em:
- Pull requests que modificam `app/`, `services/`, `sistemas/`, `admin/`
- Push para `main`, `develop`, `refactor/**`

**Jobs:**
- `boundaries`: Executa `check_boundaries.py` (bloqueia merge em erros)
- `architecture-tests`: Executa testes pytest (informativo)

## Consequências

### Positivas

1. **Enforcement Automático**: Impossível mergear código que viola boundaries
2. **Feedback Rápido**: Desenvolvedores veem violações antes do PR
3. **Documentação Viva**: Regras codificadas em vez de apenas documentadas
4. **Segurança**: Bloqueia padrões inseguros (`torch.load()`, sem rate limit)
5. **Manutenibilidade**: Facilita refatorações futuras (confiança nos boundaries)

### Negativas

1. **Overhead Inicial**: Código legado pode ter muitas violações (warnings)
2. **Falsos Positivos**: Alguns casos legítimos podem ser bloqueados (requer exclusão manual)
3. **Manutenção**: Regras precisam evoluir com a arquitetura

### Mitigações

1. **Warnings vs Errors**: Regras para código legado são warnings (não bloqueiam)
2. **Lista de Exclusão**: Arquivos legítimos podem ser excluídos
3. **Documentação**: README detalhado explica cada regra e como corrigir
4. **Gradual**: Novas regras começam como warnings, viram errors quando código estiver conforme

## Alternativas Consideradas

### 1. Apenas Documentação (Rejected)

**Pros:**
- Sem overhead de CI
- Flexibilidade total

**Cons:**
- ❌ Não há garantia de compliance
- ❌ Depende de code review humano
- ❌ Violações descobertas tarde no processo

### 2. Linters Genéricos (pylint, mypy) (Partial)

**Pros:**
- Ferramentas maduras
- Suporte a IDE

**Cons:**
- ❌ Não verificam regras arquiteturais específicas
- ❌ Difícil expressar "app/services/ não importa FastAPI"
- ✅ **Solução:** Usar ambos (linters + boundary checks)

### 3. Pre-commit Hooks (Future)

**Pros:**
- Feedback antes do commit
- Mais rápido que CI

**Cons:**
- Pode ser bypassado (`--no-verify`)
- Requer setup local de cada dev

**Status:** Criado `.pre-commit-config.example.yaml` para uso opcional

## Implementação

### Arquivos Criados

```
scripts/
  check_boundaries.py          # Script principal
  README_BOUNDARIES.md         # Documentação detalhada

tests/
  test_architecture_boundaries.py  # Testes pytest

.github/workflows/
  architecture.yml             # CI pipeline

.pre-commit-config.example.yaml  # Opcional (renomear para uso)

docs/decisions/
  ADR-0014-architecture-boundary-checks.md  # Este documento
```

### Exemplo de Output

```bash
$ python scripts/check_boundaries.py

Verificando boundaries arquiteturais...

  > Services não importa FastAPI... OK
  > Nenhum torch.load() direto... OK
  > Routers novos sem db.query... OK
  > Domain sem dependências externas... OK
  > Endpoints de IA com rate limit... ! 28 aviso(s)

ERRO - 0 erro(s) encontrado(s)
AVISO - 28 aviso(s) encontrado(s)

[!] AI_ENDPOINT_NEEDS_RATE_LIMIT (28)
  sistemas/gerador_pecas/router.py:882 - Endpoint de IA 'gerar_peca' deve ter @limiter.limit
  ...
```

## Evolução Futura

### Próximas Regras (Roadmap)

1. `REPOSITORIES_IMPLEMENT_PROTOCOL`: Repositories devem implementar interfaces
2. `SERVICES_HAVE_TESTS`: Cada service deve ter test correspondente
3. `DOMAIN_USE_DATACLASS`: Entities usam `@dataclass` ou `BaseModel`
4. `NO_HARDCODED_SECRETS`: Sem secrets no código
5. `UPLOAD_VALIDATE_MAGIC_BYTES`: Uploads validam magic bytes

### Integração com Ferramentas

- [ ] Pre-commit hooks (opcional)
- [ ] VS Code extension (sugestões inline)
- [ ] Dashboard de métricas (% compliance por módulo)
- [ ] Relatório de tendência (compliance over time)

## Referências

- [SOLID Principles](../../CLAUDE.md#princípios-solid)
- [Segurança - Regras Obrigatórias](../../CLAUDE.md#regras-de-segurança)
- [Plano de Melhorias Backend](../planejamento/PLANO_MELHORIAS_BACKEND.md)
- [Architecture Boundaries README](../../scripts/README_BOUNDARIES.md)

## Histórico de Revisões

| Data | Autor | Mudanças |
|------|-------|----------|
| 2026-02-12 | T13-BoundaryEnforce | Versão inicial |
