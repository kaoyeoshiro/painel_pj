# 📚 Documentação de Refatoração - Portal PGE

Este diretório contém a documentação de refatorações técnicas do Portal PGE.

---

## 🗂️ Índice de Documentos

### 🔥 Admin Repositories Refactor (T6-AdminRepos)

**Objetivo:** Remover `db.query` dos routers de admin, movendo lógica de acesso a dados para repositories.

| Documento | Tipo | Descrição | Para quem? |
|-----------|------|-----------|------------|
| **[SUMARIO_T6_ADMIN_REPOS.md](./SUMARIO_T6_ADMIN_REPOS.md)** | 📋 Sumário Executivo | Visão geral do trabalho realizado, entregas, métricas e próximos passos | Todos |
| **[ADMIN_REPOSITORIES_REFACTOR.md](./ADMIN_REPOSITORIES_REFACTOR.md)** | 📖 Documentação Técnica | Exemplos práticos, plano em 6 fases, regras e padrões | Desenvolvedores |
| **[CHECKLIST_REFACTOR_ADMIN.md](./CHECKLIST_REFACTOR_ADMIN.md)** | ✅ Checklist Operacional | Passo a passo para refatorar cada endpoint | Desenvolvedores |

**Status:** ✅ Infraestrutura completa (repositories + testes), ⏳ Refatoração dos routers pendente

**Quick Links:**
- Código: [`admin/repositories.py`](../../admin/repositories.py)
- Testes: [`tests/test_admin_repositories.py`](../../tests/test_admin_repositories.py)
- Script: [`scripts/refactor_admin_router_fase1.py`](../../scripts/refactor_admin_router_fase1.py)

---

## 📊 Estatísticas Atuais

### Admin Repositories Refactor
- **Repositories criados:** 11 classes (940 linhas)
- **Testes escritos:** 18 testes unitários (378 linhas)
- **Ocorrências de `db.query`:** 222 (95 em `router.py`, 127 em `router_prompts.py`)
- **Linhas de código afetadas:** ~5400 linhas em 2 arquivos
- **Fases planejadas:** 6 fases incrementais

---

## 🎯 Roadmap de Refatoração

### Fase 1: CRUD Simples ⏳
- **Endpoints:** 10
- **Complexidade:** ⭐ Baixa
- **Status:** Infraestrutura pronta, aplicação pendente

### Fase 2: Listagem com Filtros ⏳
- **Endpoints:** 8
- **Complexidade:** ⭐⭐ Média
- **Status:** Métodos de repository prontos, aplicação pendente

### Fase 3: Dashboard Feedbacks ⏳
- **Endpoints:** 6
- **Complexidade:** ⭐⭐⭐⭐ Alta
- **Status:** FeedbackRepository pronto, aplicação pendente

### Fase 4: Import/Export ⏳
- **Endpoints:** 4
- **Complexidade:** ⭐⭐ Média
- **Status:** Infraestrutura pronta, aplicação pendente

### Fase 5: CRUD Módulos ⏳
- **Endpoints:** 10
- **Complexidade:** ⭐⭐⭐ Média-Alta
- **Status:** Repositories prontos, aplicação pendente

### Fase 6: Regras Determinísticas ⏳
- **Endpoints:** 6
- **Complexidade:** ⭐⭐ Média
- **Status:** Repository pronto, aplicação pendente

---

## 🚀 Como Começar

### Para Continuar a Refatoração

1. **Ler documentação:**
   ```bash
   # Sumário executivo
   cat docs/refatoracao/SUMARIO_T6_ADMIN_REPOS.md

   # Documentação técnica
   cat docs/refatoracao/ADMIN_REPOSITORIES_REFACTOR.md

   # Checklist
   cat docs/refatoracao/CHECKLIST_REFACTOR_ADMIN.md
   ```

2. **Escolher uma fase:** Recomendamos começar pela Fase 1 (CRUD Simples)

3. **Seguir checklist:** Use `CHECKLIST_REFACTOR_ADMIN.md` como guia

4. **Testar e commitar:** Teste cada endpoint refatorado antes de commitar

### Para Criar Novos Endpoints

**Já pode usar os repositories diretamente!** Não precisa esperar a refatoração dos endpoints existentes.

```python
from admin.repositories import get_prompt_config_repo, PromptConfigRepository

@router.get("/novo-endpoint")
async def novo_endpoint(
    repo: PromptConfigRepository = Depends(get_prompt_config_repo)
):
    prompts = repo.list_with_filters(sistema="meu_sistema")
    return prompts
```

---

## 🔗 Links Úteis

### Código
- [`admin/repositories.py`](../../admin/repositories.py) - Implementação dos repositories
- [`admin/router.py`](../../admin/router.py) - Router a ser refatorado (2595 linhas)
- [`admin/router_prompts.py`](../../admin/router_prompts.py) - Router a ser refatorado (2808 linhas)
- [`database/repository_base.py`](../../database/repository_base.py) - Base repository pattern

### Testes
- [`tests/test_admin_repositories.py`](../../tests/test_admin_repositories.py) - Testes unitários

### Scripts
- [`scripts/refactor_admin_router_fase1.py`](../../scripts/refactor_admin_router_fase1.py) - Script de refatoração exemplo

### Documentação Geral
- [`docs/README.md`](../README.md) - Índice central de documentação
- [`docs/arquitetura/ARQUITETURA_GERAL.md`](../arquitetura/ARQUITETURA_GERAL.md) - Arquitetura geral do sistema

---

## 📝 Convenções

### Nomenclatura de Arquivos
- `SUMARIO_*.md` - Sumários executivos (para todos)
- `*_REFACTOR.md` - Documentação técnica detalhada (para desenvolvedores)
- `CHECKLIST_*.md` - Checklists operacionais (para execução)

### Tags de Status
- ✅ - Completo
- ⏳ - Em andamento / Pendente
- 🚧 - Bloqueado / Aguardando algo
- ❌ - Cancelado / Descartado

### Níveis de Complexidade
- ⭐ - Baixa (refatoração simples, poucos riscos)
- ⭐⭐ - Média (requer atenção, alguns testes)
- ⭐⭐⭐ - Média-Alta (requer testes completos)
- ⭐⭐⭐⭐ - Alta (muita lógica, muitos testes)
- ⭐⭐⭐⭐⭐ - Muito Alta (considerar service layer ou refactor maior)

---

## 🤝 Contribuindo

### Ao Adicionar Nova Documentação de Refatoração

1. Criar pasta específica (se necessário): `docs/refatoracao/[nome-refactor]/`
2. Criar pelo menos 3 documentos:
   - `SUMARIO_*.md` - Visão geral
   - `*_REFACTOR.md` - Documentação técnica
   - `CHECKLIST_*.md` - Checklist operacional
3. Atualizar este `README.md` com links e estatísticas
4. Adicionar ao `docs/README.md` principal

### Ao Completar uma Fase de Refatoração

1. Atualizar status no `SUMARIO_*.md`
2. Marcar fase como ✅ Completa neste `README.md`
3. Commitar: `docs: atualiza status de refatoracao - Fase X completa`

---

## 📞 Contato

- **Equipe:** LAB/PGE-MS
- **Slack:** #pge-dev
- **Issues:** GitHub Issues do projeto

---

**Última atualização:** 2026-02-12
