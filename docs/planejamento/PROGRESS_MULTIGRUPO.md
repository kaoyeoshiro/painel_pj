# PROGRESS — Generalizacao Multi-Grupo (4 Rotas Admin)

**Branch**: `refactor/generalize-groups`
**Data**: 2026-02-18
**Status**: COMPLETO

---

## Resumo

Generalizacao das 4 rotas admin para suportar multiplos grupos (PS, PP, DETRAN).
Antes, os dados eram tratados como globais. Agora cada grupo tem seus proprios dados isolados.

### Rotas afetadas
| Rota | Status |
|------|--------|
| `/admin/categorias-json` | OK — filtrado por grupo |
| `/admin/variaveis` | OK — filtrado por grupo (via JOIN com categoria) |
| `/admin/teste-categorias` | OK — filtrado por grupo |
| `/admin/teste-ativacao` | OK — filtrado por grupo |

### O que NAO mudou
- **Codigos Ignorados** (`/config/codigos-ignorados`) — permanece GLOBAL
- **Tipos de Peca** (`/tipos-peca`) — permanece global
- **Modo de funcionamento do PS** — identico ao anterior

---

## Checklist de Tarefas

- [x] Diagnostico completo (hardcodes, models, routers, frontend)
- [x] Desenho da solucao (plan mode aprovado)
- [x] **Model**: `group_id` FK em `categorias_resumo_json`
- [x] **Migration Alembic**: adiciona coluna, migra dados para PS, cria unique constraint
- [x] **Seed**: `init_db.py` atualizado para atribuir `group_id` do PS
- [x] **Backend**: `router_categorias_json.py` — CRUD filtrado por grupo
- [x] **Backend**: `router_ext_variables.py` — listagem/resumo filtrado via JOIN
- [x] **Backend**: `router_teste_categorias.py` — categorias ativas por grupo
- [x] **Backend**: `router_teste_ativacao.py` — simulacao, categorias, modulos por grupo
- [x] **Frontend**: `GroupSelector.tsx` — componente reutilizavel
- [x] **Frontend**: `CategoriasJsonPage.tsx` — seletor + API com group_id
- [x] **Frontend**: `VariaveisPage.tsx` — seletor + API com group_id
- [x] **Frontend**: `TesteCategoriasPage.tsx` — seletor + API com group_id
- [x] **Frontend**: `TesteAtivacaoPage.tsx` — seletor + API com group_id
- [x] **Testes**: 4 test files corrigidos (35 testes passando)
- [x] **Build**: `frontend-react/dist/` reconstruido
- [x] **Documentacao**: PROGRESS.md criado

---

## Decisoes Arquiteturais

### 1. group_id APENAS em categorias_resumo_json
- Variables herdam grupo **transitivamente** via `categoria_id` FK
- Variables sem categoria (`categoria_id IS NULL`) sao tratadas como globais
- NAO adicionamos `group_id` a `extraction_variables` nem `extraction_questions`
- Resultado: 1 unica alteracao de schema, zero redundancia

### 2. UniqueConstraint composta
- **Antes**: `nome` era unique globalmente
- **Depois**: `UniqueConstraint('nome', 'group_id')` — mesmo nome pode existir em grupos diferentes

### 3. Migration idempotente
- Usa helpers `_column_exists()` e `_constraint_exists()` para evitar erros em re-run
- Migra dados existentes para PS automaticamente
- Torna `group_id` NOT NULL apos data fix

### 4. GroupSelector auto-hide
- O componente retorna `null` quando so existe 1 grupo
- Quando ha multiplos grupos, exibe dropdown com `default_group_id` pre-selecionado
- Usa hook `useGruposDisponiveis()` ja existente na codebase

### 5. Codigos Ignorados permanecem globais
- Endpoints `GET/PUT /config/codigos-ignorados` NAO recebem group_id
- Eles usam `ConfiguracaoIA` (tabela de config global), sem relacao com categorias

### 6. Filtragem de variaveis por grupo (JOIN transitivo)
```python
query = session_query(db, ExtractionVariable).outerjoin(
    CategoriaResumoJSON,
    ExtractionVariable.categoria_id == CategoriaResumoJSON.id
).filter(
    or_(
        CategoriaResumoJSON.group_id == group_id,
        ExtractionVariable.categoria_id.is_(None)  # globais
    )
)
```

---

## Comandos

### Backend
```bash
# Servidor local
uvicorn main:app --reload

# Rodar migration
alembic upgrade head
```

### Frontend
```bash
# Build (WSL)
cd frontend-react && node node_modules/vite/bin/vite.js build

# Testes das 4 paginas afetadas
cd frontend-react && node node_modules/vitest/vitest.mjs run \
  src/pages/admin/categorias-json/__tests__/CategoriasJsonPage.test.tsx \
  src/pages/admin/variaveis/__tests__/VariaveisPage.test.tsx \
  src/pages/admin/teste-categorias/__tests__/TesteCategoriasPage.test.tsx \
  src/pages/admin/teste-ativacao/__tests__/TesteAtivacaoPage.test.tsx
```

### Testes
```bash
# Backend (pytest)
pytest tests/ -v

# Frontend (vitest)
cd frontend-react && node node_modules/vitest/vitest.mjs run
```

---

## Instrucoes de Migracao

### Aplicar migration
```bash
alembic upgrade head
```

A migration:
1. Adiciona coluna `group_id` (nullable) em `categorias_resumo_json`
2. Atualiza todos os registros existentes para `group_id = PS`
3. Torna `group_id` NOT NULL
4. Remove unique constraint antigo em `nome`
5. Cria novo unique constraint `(nome, group_id)`

### Rollback
```bash
alembic downgrade -1
```

---

## Arquivos Modificados

### Backend (5 arquivos)
| Arquivo | Tipo |
|---------|------|
| `sistemas/gerador_pecas/models_resumo_json.py` | Model — adiciona `group_id` FK |
| `sistemas/gerador_pecas/router_categorias_json.py` | Router — filtro por grupo |
| `sistemas/gerador_pecas/router_ext_variables.py` | Router — filtro por grupo via JOIN |
| `sistemas/gerador_pecas/router_teste_categorias.py` | Router — filtro por grupo |
| `sistemas/gerador_pecas/router_teste_ativacao.py` | Router — filtro por grupo |

### Infra (2 arquivos)
| Arquivo | Tipo |
|---------|------|
| `database/init_db.py` | Seed — atribui `group_id` do PS |
| `migrations/versions/20260218_...` | Migration Alembic |

### Frontend (9 arquivos)
| Arquivo | Tipo |
|---------|------|
| `components/ui/GroupSelector.tsx` | NOVO — componente reutilizavel |
| `pages/admin/categorias-json/CategoriasJsonPage.tsx` | Seletor + API |
| `pages/admin/categorias-json/api.ts` | Param group_id |
| `pages/admin/variaveis/VariaveisPage.tsx` | Seletor + API |
| `pages/admin/teste-categorias/TesteCategoriasPage.tsx` | Seletor + API |
| `pages/admin/teste-ativacao/TesteAtivacaoPage.tsx` | Seletor + API |
| `*/__tests__/*.test.tsx` (4 arquivos) | Mocks atualizados |

---

## Pendencias Futuras

- [ ] Criar categorias default para PP e DETRAN (seeds ou via admin UI)
- [ ] Testes de integracao backend (multi-grupo com DB real)
- [ ] Considerar permissao por grupo no frontend (ocultar grupos nao-permitidos)
- [ ] Dashboard admin: metricas por grupo
