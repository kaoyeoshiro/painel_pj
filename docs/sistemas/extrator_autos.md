# Extrator de Autos

## Visao Geral

Sistema para download de documentos processuais do TJ-MS (XML, PDF, TXT). Integrado ao Portal PGE com suporte a:

- Download de documentos individuais ou em lote
- Selecao por categorias do admin ou manual
- Categorias especiais: Peticao Inicial (regra cronologica) e Contestacao (BERT)
- Merge de PDFs, filtros por periodo, busca multi-instancia
- Exportacao em ZIP

**Rota**: `/extrator-autos/`
**API**: `/extrator-autos/api/`

## Arquitetura

```
sistemas/extrator_autos/
    __init__.py
    models.py                          # SQLAlchemy: ExtracaoAutos
    schemas.py                         # Pydantic: requests/responses
    router.py                          # FastAPI endpoints
    services.py                        # Orquestrador + CATEGORIAS_MAP
    services_download.py               # PDF/TXT/merge/ZIP
    services_category_resolver.py      # Resolvers extensiveis
    services_bert_client.py            # Cliente BERT (HTTP + local)
    templates/
        index.html                     # Frontend SPA
```

## Configuracao (.env)

```env
# BERT - para categoria especial Contestacao
BERT_ENDPOINT=http://127.0.0.1:8765    # Inference server (padrao)
BERT_MODEL_PATH=./bert_models/model_contestacao  # Modelo local (fallback)
BERT_MODEL_NAME=model_contestacao       # Nome do modelo no inference server

# TJ-MS - ja configurado no PGE
# TJMS_PROXY_URL, TJ_WS_USER, TJ_WS_PASS (services/tjms/config.py)
```

### Ativando o BERT

1. Acessar `/bert-training/` no portal
2. Verificar se o worker esta ativo (indicador no topo)
3. Se nao estiver, clicar em "Iniciar Worker"
4. O modelo treinado deve estar em `bert_models/`
5. O frontend do Extrator mostra o status do BERT (dot verde/vermelho)

## Selecao de Documentos

### Modo Manual
Selecao individual de codigos de documento TJ-MS (300+ tipos disponiveis).

### Modo por Categorias
Usa as categorias configuradas no admin (`/admin/config/pecas`):
- Peticao, Decisao, Sentenca, Acordao, Recurso, Parecer, etc.
- Cada categoria agrupa codigos de documento TJ-MS

### Modo Hibrido
Seleciona categorias e depois adiciona/remove codigos individuais.

## Categorias Especiais

### Peticao Inicial

**Regra**: O primeiro documento cronologico do processo que tenha codigo 9500, 500 ou 10.

- NAO e simplesmente "todos os documentos com codigo 9500"
- Verifica qual e o PRIMEIRO documento do processo (por data_juntada + ordem)
- Se esse primeiro documento tem codigo 9500, 500 ou 10 -> e Peticao Inicial
- Se o primeiro documento tem outro codigo -> nao ha Peticao Inicial

**Configuracao admin**: Categoria com `is_primeiro_documento = True`

### Contestacao

**Regra em duas fases**:

1. **Match direto**: Codigo 8320 -> sempre Contestacao (sem BERT)
2. **BERT**: Codigos 500, 510, 9500, 8326 -> texto submetido ao classificador BERT
   - Se BERT classifica como "contestacao" -> incluido
   - Se BERT classifica diferente -> excluido

**Audit trail**: Cada documento traz metodo de classificacao:
- "Contestacao por codigo 8320"
- "Contestacao por BERT (confianca: 95%)"

**Configuracao admin**: Categoria com `resolver_config`:
```json
{
    "type": "bert",
    "codigos_diretos": [8320],
    "codigos_bert": [500, 510, 9500, 8326],
    "label_match": "contestacao"
}
```

**BERT offline**: Se o worker BERT nao estiver ativo, o sistema mostra um popup perguntando se o usuario quer continuar sem BERT. Se sim, apenas matches diretos (8320) sao incluidos.

## Como Adicionar Nova Categoria Especial

Exemplo: adicionar "Replica" via BERT.

### 1. Criar categoria no admin

No admin (`/admin/config/pecas`), criar nova CategoriaDocumento:
- Nome: `replica_doc`
- Titulo: Replica
- Codigos: [500, 510, 9500, 8326, ...]
- resolver_config:
```json
{
    "type": "bert",
    "codigos_diretos": [],
    "codigos_bert": [500, 510, 9500, 8326],
    "label_match": "replica"
}
```

### 2. Treinar modelo BERT

1. Preparar dataset Excel (coluna texto + coluna label)
2. Upload no sistema BERT Training (`/bert-training/`)
3. Treinar modelo com preset adequado
4. Exportar modelo para `bert_models/`

### 3. Configurar .env

```env
BERT_MODEL_NAME=model_replica
```

### 4. (Opcional) Criar resolver customizado

Se a regra nao for BERT simples, criar novo resolver em `services_category_resolver.py`:

```python
class ReplicaResolver(BaseCategoryResolver):
    @property
    def resolver_type(self) -> str:
        return "replica_custom"

    async def resolve(self, documentos, codigos, **kwargs):
        # Logica customizada
        ...
```

Registrar no `_RESOLVER_REGISTRY` do factory.

## Endpoints da API

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/consultar` | POST | Consultar processo no TJ-MS |
| `/consultar-lote` | POST | Consultar multiplos processos |
| `/categorias` | GET | Listar categorias disponiveis |
| `/resolver-categorias` | POST | Resolver categorias em codigos |
| `/preview` | POST | Preview de documentos |
| `/baixar` | POST | Download direto (ZIP) |
| `/baixar-stream` | POST | Download com progresso SSE |
| `/baixar-lote` | POST | Download em lote com SSE |
| `/download/{job_id}` | GET | Baixar ZIP pronto |
| `/codigos-map` | GET | Mapa codigo->descricao |
| `/bert/health` | GET | Status do BERT |
| `/bert/classificar` | POST | Testar classificacao BERT |
| `/historico` | GET | Historico do usuario |

## Testes

```bash
# Testes de resolvers (25+ testes)
pytest tests/test_category_resolver.py -v

# Testes de download (15+ testes)
pytest tests/test_download_services.py -v

# Testes de BERT client (8+ testes)
pytest tests/test_bert_client.py -v

# Todos
pytest tests/test_category_resolver.py tests/test_download_services.py tests/test_bert_client.py -v
```

## Dependencias

- `services/tjms/` - Cliente TJ-MS unificado (SOAP, retry, circuit breaker)
- `sistemas/gerador_pecas/models_config_pecas.py` - CategoriaDocumento
- `sistemas/bert_training/` - Infraestrutura BERT (inference server)
- `PyMuPDF (fitz)` - Processamento de PDF
- `pymupdf4llm` - Conversao PDF para Markdown/texto
- `httpx` - Cliente HTTP async

## Origem

Migrado do app desktop API-TJ (E:\Projetos\API-TJ), originalmente um app Tkinter. Funcionalidades preservadas e adaptadas para web.
