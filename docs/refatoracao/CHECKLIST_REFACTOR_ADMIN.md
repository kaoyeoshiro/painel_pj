# ✅ Checklist - Refatoração Admin Repositories

**Como usar:** Copie este checklist para cada fase da refatoração.

---

## 🎯 Fase Atual: ___________

**Endpoints Alvo:**
- [ ] Endpoint 1
- [ ] Endpoint 2
- [ ] Endpoint 3
- [ ] ...

---

## 📋 Checklist por Endpoint

### 1️⃣ Preparação
- [ ] Identificar arquivo do endpoint (`admin/router.py` ou `admin/router_prompts.py`)
- [ ] Identificar linha do endpoint
- [ ] Ler código do endpoint completamente
- [ ] Identificar todos os `db.query`, `db.add`, `db.commit`, `db.delete` no endpoint
- [ ] Verificar se repository adequado existe em `admin/repositories.py`
- [ ] Se repository não existe, criá-lo primeiro (e testar)

### 2️⃣ Refatoração
- [ ] Adicionar import do repository e factory (se necessário)
- [ ] Substituir `db: Session = Depends(get_db)` por `repo: *Repository = Depends(get_*_repo)`
- [ ] Substituir `db.query(Model)...` por `repo.method(...)`
- [ ] Substituir `db.add(entity)` por `repo.add(entity)`
- [ ] Substituir `db.commit()` por `repo.commit()`
- [ ] Substituir `db.delete(entity)` por `repo.delete(entity)`
- [ ] Substituir `db.refresh(entity)` por `repo.refresh(entity)`
- [ ] Substituir `db.rollback()` por `repo.rollback()` (se houver)
- [ ] Verificar se lógica de negócio foi preservada

### 3️⃣ Validação de Contrato
- [ ] Verificar que parâmetros HTTP não mudaram
- [ ] Verificar que response model não mudou
- [ ] Verificar que status codes não mudaram
- [ ] Verificar que exceptions levantadas são as mesmas
- [ ] Verificar que auth/rate-limiting/quota foram preservados

### 4️⃣ Teste Manual
- [ ] Iniciar servidor local: `uvicorn main:app --reload`
- [ ] Testar endpoint via navegador, Postman ou curl
- [ ] Testar caso de sucesso
- [ ] Testar caso de erro (404, 400, etc)
- [ ] Testar com filtros (se aplicável)
- [ ] Testar com paginação (se aplicável)

### 5️⃣ Teste Automatizado (Opcional)
- [ ] Criar ou adaptar teste em `tests/test_admin_router.py`
- [ ] Executar teste: `pytest tests/test_admin_router.py::test_endpoint_name -v`
- [ ] Verificar que teste passa

### 6️⃣ Code Review
- [ ] Revisar diff: `git diff admin/router*.py`
- [ ] Verificar que não há `db.query` restante no endpoint refatorado
- [ ] Verificar indentação e formatação
- [ ] Verificar que imports estão organizados
- [ ] Verificar que docstring foi preservada

### 7️⃣ Commit
- [ ] Stage mudanças: `git add admin/router*.py admin/repositories.py`
- [ ] Commit com mensagem descritiva:
  ```
  refactor(admin): move queries de [FUNCIONALIDADE] para repository (Fase X/6)

  - Endpoint: [METODO] [PATH]
  - Repository usado: [NomeRepository]
  - Queries substituídas: [N]
  ```
- [ ] Push para branch: `git push origin refactor/backend-cleanup`

---

## 📊 Checklist por Fase Completa

### Após Completar Todos os Endpoints da Fase
- [ ] Executar todos os testes do módulo: `pytest tests/test_admin_*.py -v`
- [ ] Verificar cobertura (opcional): `pytest --cov=admin --cov-report=html`
- [ ] Testar funcionalidades principais via UI (se aplicável)
- [ ] Atualizar documentação (se necessário)
- [ ] Marcar fase como completa em `SUMARIO_T6_ADMIN_REPOS.md`
- [ ] Comunicar progresso no Slack/canal da equipe

---

## 🚨 Regras INEGOCIÁVEIS

### ✅ SEMPRE Fazer
- ✅ Ler código antes de refatorar
- ✅ Testar após refatorar
- ✅ Preservar contratos HTTP
- ✅ Preservar auth/rate-limiting/quota
- ✅ Fazer commits atômicos (1 endpoint ou 1 funcionalidade por commit)

### ❌ NUNCA Fazer
- ❌ Refatorar múltiplos endpoints sem testar
- ❌ Alterar comportamento de negócio
- ❌ Remover validações
- ❌ Commitar código com `db.query` ainda presente (a menos que documentado com TODO)
- ❌ Commitar código sem testar

---

## 🔧 Comandos Úteis

### Buscar `db.query` Restantes
```bash
# Em admin/router.py
grep -n "db.query\|db.add\|db.commit\|db.delete" admin/router.py

# Em admin/router_prompts.py
grep -n "db.query\|db.add\|db.commit\|db.delete" admin/router_prompts.py

# Contar ocorrências
grep -c "db.query" admin/router*.py
```

### Rodar Testes
```bash
# Todos os testes de admin
pytest tests/test_admin_*.py -v

# Teste específico
pytest tests/test_admin_repositories.py::TestPromptConfigRepository -v

# Com cobertura
pytest tests/test_admin_*.py --cov=admin --cov-report=term-missing
```

### Iniciar Servidor
```bash
uvicorn main:app --reload --port 8000
```

### Testar Endpoint com curl
```bash
# GET
curl -X GET "http://localhost:8000/admin/api/prompts" \
  -H "Authorization: Bearer YOUR_TOKEN"

# POST
curl -X POST "http://localhost:8000/admin/api/prompts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sistema": "test", "tipo": "test", "nome": "Test", "conteudo": "..."}'
```

---

## 📖 Referências Rápidas

| Documento | Link | Conteúdo |
|-----------|------|----------|
| **Sumário Completo** | `docs/refatoracao/SUMARIO_T6_ADMIN_REPOS.md` | Status, entregas, métricas |
| **Documentação Técnica** | `docs/refatoracao/ADMIN_REPOSITORIES_REFACTOR.md` | Exemplos, plano, regras |
| **Repositories** | `admin/repositories.py` | Implementação dos repositories |
| **Testes** | `tests/test_admin_repositories.py` | Testes unitários dos repositories |

---

## 🎯 Fases Disponíveis

| Fase | Funcionalidade | Complexidade | Endpoints | Linhas |
|------|----------------|--------------|-----------|--------|
| **1** | CRUD Simples | ⭐ Baixa | ~10 | 200 |
| **2** | Listagem com Filtros | ⭐⭐ Média | ~8 | 300 |
| **3** | Dashboard Feedbacks | ⭐⭐⭐⭐ Alta | ~6 | 800 |
| **4** | Import/Export | ⭐⭐ Média | ~4 | 400 |
| **5** | CRUD Módulos | ⭐⭐⭐ Média-Alta | ~10 | 500 |
| **6** | Regras Determinísticas | ⭐⭐ Média | ~6 | 300 |

**Recomendação:** Começar pela Fase 1 (mais simples) e ir progredindo.

---

## 💡 Dicas

### Para Endpoints Simples (Fase 1-2)
- Use pattern de substituição direto
- Teste rápido via navegador
- Commit por endpoint ou grupo pequeno

### Para Endpoints Complexos (Fase 3-6)
- Leia todo o código antes de começar
- Identifique dependências entre queries
- Considere extrair para service layer se muito complexo
- Teste com múltiplos cenários
- Commit por funcionalidade completa

### Se Tiver Dúvidas
1. Consultar exemplos em `ADMIN_REPOSITORIES_REFACTOR.md`
2. Ver testes em `test_admin_repositories.py`
3. Ver implementação em `admin/repositories.py`
4. Perguntar no Slack #pge-dev

---

## ✅ Exemplo de Workflow Completo

```bash
# 1. Escolher endpoint
# Endpoint: GET /api/prompts

# 2. Abrir arquivo
code admin/router.py

# 3. Refatorar código
# (Substituir db por repo)

# 4. Testar
uvicorn main:app --reload
# Abrir http://localhost:8000/admin/api/prompts

# 5. Verificar diff
git diff admin/router.py

# 6. Commit
git add admin/router.py
git commit -m "refactor(admin): move queries de list_prompts para repository (Fase 1/6)"

# 7. Push
git push origin refactor/backend-cleanup

# 8. Repetir para próximo endpoint
```

---

**Última atualização:** 2026-02-12
**Responsável:** T6-AdminRepos (Claude)
**Status:** ✅ Infraestrutura completa, refatoração dos routers pendente
