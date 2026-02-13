# Refatoração Admin Repositories

## Objetivo

Remover `db.query`, `db.execute`, `db.add`, `db.delete`, `db.commit`, `db.rollback` dos routers `admin/router.py` e `admin/router_prompts.py`, movendo a lógica de acesso a dados para repositories.

## Status Atual

### ✅ Completo

1. **Arquivo `admin/repositories.py` expandido** com 11 classes de repository:
   - `ConfiguracaoIARepository` - Configurações de IA
   - `PromptConfigRepository` - Configurações de prompts
   - `PromptModuloRepository` - Módulos de prompts
   - `PromptModuloHistoricoRepository` - Histórico de módulos
   - `PromptGroupRepository` - Grupos de prompts
   - `PromptSubgroupRepository` - Subgrupos de prompts
   - `PromptSubcategoriaRepository` - Subcategorias de prompts
   - `ModuloTipoPecaRepository` - Associações módulo-tipo-peça
   - `RegraDeterministicaTipoPecaRepository` - Regras determinísticas
   - `CategoriaOrdemRepository` - Ordem de categorias
   - `FeedbackRepository` - Queries consolidadas de feedbacks

2. **Factories de injeção de dependência** criadas para todos os repositories

3. **Arquivo de testes `tests/test_admin_repositories.py`** com cobertura dos métodos principais

### 🚧 Pendente

Refatoração dos routers para usar os repositories. Devido ao tamanho dos arquivos (2595 + 2808 linhas), a refatoração deve ser feita em etapas incrementais.

## Como Usar os Repositories

### Exemplo 1: Substituir query simples

**Antes (router.py:49-55)**
```python
@router.get("/api/prompts", response_model=PromptListResponse)
async def list_prompts(
    sistema: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(PromptConfig)

    if sistema:
        query = query.filter(PromptConfig.sistema == sistema)
    if tipo:
        query = query.filter(PromptConfig.tipo == tipo)

    prompts = query.order_by(PromptConfig.sistema, PromptConfig.tipo).all()

    return PromptListResponse(prompts=prompts, total=len(prompts))
```

**Depois**
```python
from admin.repositories import get_prompt_config_repo, PromptConfigRepository

@router.get("/api/prompts", response_model=PromptListResponse)
async def list_prompts(
    sistema: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo)
):
    prompts = repo.list_with_filters(sistema=sistema, tipo=tipo)
    return PromptListResponse(prompts=prompts, total=len(prompts))
```

### Exemplo 2: Substituir get by ID

**Antes (router.py:68)**
```python
prompt = db.query(PromptConfig).filter(PromptConfig.id == prompt_id).first()
```

**Depois**
```python
prompt = repo.get_by_id(prompt_id)
```

### Exemplo 3: Substituir verificação de existência

**Antes (router.py:84-86)**
```python
existing = db.query(PromptConfig).filter(
    PromptConfig.sistema == prompt_data.sistema,
    PromptConfig.tipo == prompt_data.tipo
).first()
```

**Depois**
```python
exists = repo.check_exists(prompt_data.sistema, prompt_data.tipo)
if exists:
    raise HTTPException(status_code=400, detail="...")
```

### Exemplo 4: Substituir create

**Antes (router.py:94-105)**
```python
prompt = PromptConfig(
    sistema=prompt_data.sistema,
    tipo=prompt_data.tipo,
    nome=prompt_data.nome,
    # ...
)
db.add(prompt)
db.commit()
```

**Depois**
```python
prompt = PromptConfig(
    sistema=prompt_data.sistema,
    tipo=prompt_data.tipo,
    nome=prompt_data.nome,
    # ...
)
repo.add(prompt)
repo.commit()
```

### Exemplo 5: Substituir queries de feedback (router.py:572-642)

**Antes**
```python
usuarios_excluir = db.query(User.id).filter(
    (User.role == 'admin') | (User.username.ilike('%teste%')) | (User.username.ilike('%test%'))
).all()
ids_excluir = [u.id for u in usuarios_excluir]

query_total_aj = db.query(ConsultaProcesso)
if ids_excluir:
    query_total_aj = query_total_aj.filter(~ConsultaProcesso.usuario_id.in_(ids_excluir))
if data_inicio and data_fim:
    query_total_aj = query_total_aj.filter(
        ConsultaProcesso.consultado_em >= data_inicio,
        ConsultaProcesso.consultado_em < data_fim
    )
total_consultas_aj = query_total_aj.count()
```

**Depois**
```python
from admin.repositories import get_feedback_repo, FeedbackRepository

feedback_repo: FeedbackRepository = Depends(get_feedback_repo)

ids_excluir = feedback_repo.get_excluded_user_ids()
total_consultas_aj = feedback_repo.count_consultas_aj(ids_excluir, data_inicio, data_fim)
total_feedbacks_aj = feedback_repo.count_feedbacks_aj(ids_excluir, data_inicio, data_fim)
# ... similar para outros sistemas
```

### Exemplo 6: Substituir queries complexas de módulos (router_prompts.py:181-217)

**Antes**
```python
query = db.query(PromptModulo)
# ... filtros

if subcategorias:
    subquery_ids = db.query(prompt_modulo_subcategorias.c.modulo_id).filter(
        prompt_modulo_subcategorias.c.subcategoria_id.in_(subcategorias)
    ).distinct()
    query = query.filter(PromptModulo.id.in_(subquery_ids))

# ... mais filtros
modulos = query.all()
```

**Depois**
```python
from admin.repositories import get_prompt_modulo_repo, PromptModuloRepository

repo: PromptModuloRepository = Depends(get_prompt_modulo_repo)

modulos = repo.list_with_filters(
    categoria=categoria,
    grupo_id=grupo_id,
    subcategorias=subcategorias,
    tipo_peca=tipo_peca,
    ativo=ativo,
    order_by_ordem=True
)
```

## Plano de Refatoração Incremental

### Fase 1: Endpoints Simples de CRUD (Baixo Risco)
- `GET /api/prompts` ✅ (exemplo acima)
- `GET /api/prompts/{id}`
- `POST /api/prompts`
- `PUT /api/prompts/{id}`
- `DELETE /api/prompts/{id}`
- `GET /api/configs`
- `PUT /api/configs/{id}`

**Impacto:** ~10 endpoints, ~200 linhas

### Fase 2: Endpoints de Listagem com Filtros
- `GET /prompts-modulos/listar`
- `GET /prompts-modulos/categorias`
- `GET /prompts-modulos/grupos`
- `GET /prompts-modulos/subgrupos`

**Impacto:** ~8 endpoints, ~300 linhas

### Fase 3: Endpoints de Dashboard de Feedbacks
- `GET /api/feedbacks/estatisticas`
- `GET /api/feedbacks/lista`
- `GET /api/feedbacks/detalhes/{id}`

**Impacto:** ~6 endpoints, ~800 linhas (maior complexidade)

### Fase 4: Endpoints de Importação/Exportação
- `POST /prompts-modulos/importar`
- `POST /prompts-modulos/exportar-selecionados`

**Impacto:** ~4 endpoints, ~400 linhas

### Fase 5: Endpoints de Módulos (CRUD Complexo)
- `POST /prompts-modulos/criar`
- `PUT /prompts-modulos/{id}`
- `DELETE /prompts-modulos/{id}`
- `POST /prompts-modulos/{id}/restaurar-versao`

**Impacto:** ~10 endpoints, ~500 linhas

### Fase 6: Endpoints de Regras Determinísticas
- `GET /prompts-modulos/{id}/regras`
- `POST /prompts-modulos/{id}/regras`
- `PUT /prompts-modulos/{id}/regras/{regra_id}`

**Impacto:** ~6 endpoints, ~300 linhas

## Ocorrências de `db.query` por Arquivo

### `admin/router.py`
- **Total:** 95 ocorrências
- **Linhas:** 49, 68, 84, 104-105, 119, 136, 149, 154-155, 185-243, 270, 286, 296, 309, 323-325, 418-499, 517, 572-2337

**Principais padrões:**
- CRUD de PromptConfig e ConfiguracaoIA
- Queries de feedbacks (6 sistemas × 5 tipos de query)
- Queries de métricas e estatísticas
- Queries de detalhamento de feedbacks

### `admin/router_prompts.py`
- **Total:** 127 ocorrências
- **Linhas:** 181-2789

**Principais padrões:**
- CRUD de PromptModulo
- CRUD de PromptGroup, PromptSubgroup, PromptSubcategoria
- Queries de histórico de módulos
- Queries de associações (ModuloTipoPeca, RegraDeterministicaTipoPeca)
- Import/export de módulos
- Reordenação de categorias

## Regras para Refatoração

### ✅ Fazer
1. Usar injeção de dependência via `Depends(get_*_repo)`
2. Preservar exatamente as mesmas respostas HTTP
3. Manter auth, rate limiting, quotas
4. Testar cada endpoint refatorado
5. Fazer commits atômicos por fase

### ❌ NÃO Fazer
1. Alterar contratos HTTP
2. Remover validações
3. Mudar comportamento de negócio
4. Refatorar múltiplas fases de uma vez
5. Criar novos endpoints

## TODOs para Endpoints Complexos

Alguns endpoints têm lógica muito complexa (ex: `/api/feedbacks/estatisticas` com 1000+ linhas). Para esses casos:

1. **Opção A (Recomendada):** Extrair queries para repository methods, mas manter lógica de agregação no router
2. **Opção B:** Criar service layer intermediária (ex: `admin/services.py`) para orquestrar múltiplos repositories
3. **Opção C:** Documentar com `TODO: Refatoração complexa - ver ADMIN_REPOSITORIES_REFACTOR.md` e pular por enquanto

## Próximos Passos

1. Escolher uma fase (recomendo Fase 1)
2. Identificar os endpoints da fase
3. Refatorar endpoint por endpoint
4. Testar cada endpoint (manual ou automatizado)
5. Commit com mensagem descritiva: `refactor(admin): move queries de prompts para repository (Fase 1)`
6. Repetir para próxima fase

## Métricas de Sucesso

- ✅ 0 ocorrências de `db.query` nos routers (ou documentadas com TODO)
- ✅ Todos os testes passando
- ✅ Comportamento HTTP idêntico
- ✅ Código mais legível (routers thin, repositories fat)
- ✅ Facilita criação de novos testes unitários

## Referências

- `admin/repositories.py` - Implementação dos repositories
- `tests/test_admin_repositories.py` - Exemplos de testes
- `database/repository_base.py` - Base repository pattern
