# Relatorio de Security Hotspots - SonarQube

**Projeto**: portal-pge
**Data**: 2026-02-12
**Total de Hotspots**: 69
**Status**: Todos em TO_REVIEW

---

## Resumo Executivo

| Probabilidade | Quantidade | Acao Recomendada |
|---------------|-----------|------------------|
| HIGH          | 3         | Revisar e resolver ou marcar como Safe |
| LOW           | 66        | Maioria sao falsos positivos ou risco aceitavel |

| Categoria SonarQube     | Quantidade | Regra          |
|--------------------------|-----------|----------------|
| others (SRI)             | 49        | Web:S5725      |
| others (hashing)         | 3         | python:S4790   |
| others (signals)         | 2         | python:S4828   |
| encrypt-data             | 8         | python:S5332   |
| log-injection            | 3         | python:S4792   |
| auth (credenciais)       | 2         | python:S2068   |
| csrf                     | 1         | python:S4502   |
| insecure-conf (CORS)     | 1         | python:S5122   |

### Classificacao Geral

- **Falso Positivo / Risco Aceitavel**: 62 hotspots (90%)
- **Melhoria Recomendada (baixa prioridade)**: 4 hotspots (6%)
- **Requer Atencao (media prioridade)**: 3 hotspots (4%)
- **Critico**: 0 hotspots

---

## Analise Detalhada por Regra

### 1. Web:S5725 - Subresource Integrity (SRI) ausente (49 hotspots)

**Probabilidade**: LOW
**Categoria**: others
**Arquivos afetados**: 29 templates HTML em `frontend/templates/` e `sistemas/*/templates/`

**O que o SonarQube detectou**:
Tags `<script>` e `<link>` carregando recursos de CDNs externas (Tailwind CSS, Font Awesome, Chart.js, etc.) sem atributo `integrity` (Subresource Integrity).

**Exemplo** (`login.html:8`):
```html
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
```

**Avaliacao**: MELHORIA RECOMENDADA (baixa prioridade)

**Justificativa**:
- O portal ja possui CSP headers configurados (`config.py` / middleware) que restringem origens permitidas
- Em producao, `unsafe-eval` e localhost sao bloqueados no CSP
- O risco real e baixo: seria necessario comprometer a CDN para explorar
- Porem, adicionar SRI e uma boa pratica de defesa em profundidade
- **Nota**: `cdn.tailwindcss.com` (usado em modo dev) NAO suporta SRI pois gera CSS dinamicamente. Para producao, o Tailwind deveria ser compilado localmente

**Recomendacao**:
1. Para producao: compilar Tailwind CSS localmente (ja existe `frontend-react/` com build)
2. Para CDNs com versao fixa (Font Awesome, Chart.js): adicionar atributos `integrity` e `crossorigin="anonymous"`
3. Prioridade: BAIXA - nao ha risco imediato

**Templates afetados** (29 arquivos, 49 ocorrencias):

| Arquivo | Ocorrencias |
|---------|-------------|
| `frontend/templates/admin_feedbacks.html` | 3 |
| `frontend/templates/admin_gerador_historico.html` | 3 |
| `frontend/templates/admin_pedido_calculo_historico.html` | 3 |
| `frontend/templates/admin_prestacao_contas_historico.html` | 3 |
| `frontend/templates/admin_categorias_json.html` | 2 |
| `frontend/templates/admin_performance.html` | 2 |
| `frontend/templates/admin_prompts_modulos.html` | 2 |
| `sistemas/assistencia_judiciaria/templates/index.html` | 2 |
| `sistemas/bert_training/templates/index.html` | 2 |
| `sistemas/classificador_documentos/templates/index.html` | 2 |
| `sistemas/cumprimento_beta/templates/index.html` | 2 |
| `sistemas/gerador_pecas/templates/autos.html` | 2 |
| `sistemas/gerador_pecas/templates/index.html` | 2 |
| `sistemas/pedido_calculo/templates/index.html` | 2 |
| `sistemas/prestacao_contas/templates/index.html` | 2 |
| `sistemas/relatorio_cumprimento/templates/index.html` | 2 |
| `frontend/templates/admin_config_pecas.html` | 1 |
| `frontend/templates/admin_modulos_tipo_peca.html` | 1 |
| `frontend/templates/admin_prompts.html` | 1 |
| `frontend/templates/admin_teste_ativacao_modulos.html` | 1 |
| `frontend/templates/admin_teste_categorias_json.html` | 1 |
| `frontend/templates/admin_tjms_docs.html` | 1 |
| `frontend/templates/admin_users.html` | 1 |
| `frontend/templates/admin_variaveis.html` | 1 |
| `frontend/templates/change_password.html` | 1 |
| `frontend/templates/dashboard.html` | 1 |
| `frontend/templates/login.html` | 1 |
| `sistemas/extrator_autos/templates/index.html` | 1 |
| `sistemas/matriculas_confrontantes/templates/index.html` | 1 |

---

### 2. python:S2068 - Credenciais hard-coded (2 hotspots) - HIGH

**Probabilidade**: HIGH
**Categoria**: auth

#### Hotspot 2a: `auth/schemas.py:84`

```python
"password": "MinhaSenh@123"  # dentro de json_schema_extra / example
```

**Avaliacao**: FALSO POSITIVO
**Justificativa**: Este e um exemplo na documentacao do schema Pydantic (`json_schema_extra`). Nao e uma credencial real, e sim um placeholder para a documentacao OpenAPI/Swagger. O valor nunca e usado para autenticacao.

#### Hotspot 2b: `config.py:79`

```python
ADMIN_PASSWORD = "admin"  # fallback para desenvolvimento local
```

**Avaliacao**: RISCO ACEITAVEL (com ressalva)
**Justificativa**:
- O codigo ja tem protecao: em producao (`IS_PRODUCTION=True`), o sistema levanta `RuntimeError` se `ADMIN_PASSWORD` nao estiver definida como variavel de ambiente (linhas 68-73)
- A senha "admin" so e usada em desenvolvimento local
- O `warnings.warn()` emite alerta quando o fallback e usado
- **Porem**: `DEFAULT_USER_PASSWORD = "mudar123"` (linha 82) tambem merece atencao - embora seja uma senha temporaria para novos usuarios, poderia ser mais robusta

**Recomendacao**: Marcar como Safe no SonarQube. O padrao de fallback seguro ja esta implementado.

---

### 3. python:S5332 - Protocolos clear-text / HTTP (8 hotspots) - LOW

**Probabilidade**: LOW
**Categoria**: encrypt-data

| Linha | Arquivo | Contexto |
|-------|---------|----------|
| 150-151 | `config.py` | Namespaces XML SOAP: `http://schemas.xmlsoap.org/soap/envelope/` |
| 22-26 | `services/tjms/parsers.py` | Namespaces XML CNJ: `http://www.cnj.jus.br/intercomunicacao-2.2.2` |
| 67 | `sistemas/assistencia_judiciaria/core/logic.py` | `s.mount("http://", HTTPAdapter(...))` |
| 36 | `sistemas/bert_training/worker/worker_manager.py` | `http://127.0.0.1:8765` (servidor local de inferencia) |

**Avaliacao**: FALSO POSITIVO (todos)

**Justificativa**:
- **config.py e parsers.py** (6 de 8): Sao **namespaces XML**, nao URLs de comunicacao. Namespaces XML sao identificadores, nao endpoints de rede. `http://schemas.xmlsoap.org/soap/envelope/` e o namespace padrao SOAP definido pelo W3C - nao ha como muda-lo
- **logic.py**: `s.mount("http://", HTTPAdapter(...))` e a configuracao de retry para o adapter HTTP do `requests.Session`. O mount point `"http://"` e necessario para que o retry funcione em qualquer protocolo. A sessao tambem monta `"https://"`
- **worker_manager.py**: `http://127.0.0.1:8765` e comunicacao localhost interna entre o backend e o servidor de inferencia BERT. HTTPS em localhost nao agrega seguranca (o trafego nao sai da maquina)

**Recomendacao**: Marcar todos como Safe no SonarQube.

---

### 4. python:S4792 - Configuracao de loggers (3 hotspots) - LOW

**Probabilidade**: LOW
**Categoria**: log-injection

| Linha | Arquivo | Contexto |
|-------|---------|----------|
| 34 | `main.py` | `StatusPollingFilter` - filtro customizado para logging |
| 33 | `bert_training/worker/bert_worker.py` | Configuracao de logging do worker |
| 21 | `bert_training/worker/inference_server.py` | Configuracao de logging do servidor |

**Avaliacao**: FALSO POSITIVO

**Justificativa**:
- O `main.py` usa `utils/logging_config.py` com `setup_logging()` que configura logging estruturado via `structlog`
- O filtro `StatusPollingFilter` apenas silencia logs de polling repetitivo (GET .../status) - nao expoe dados sensiveis
- Os workers BERT configuram logging padrao para seus processos isolados
- O projeto ja usa logging estruturado JSON, o que dificulta log injection

**Recomendacao**: Marcar como Safe no SonarQube.

---

### 5. python:S4790 - Hashing fraco / MD5 (3 hotspots) - LOW

**Probabilidade**: LOW
**Categoria**: others

| Linha | Arquivo | Contexto |
|-------|---------|----------|
| 76 | `services/config_cache.py` | `hashlib.md5(key_str.encode(), usedforsecurity=False).hexdigest()[:16]` |
| 840 | `sistemas/gerador_pecas/detector_modulos.py` | `hashlib.md5(documentos.encode(), usedforsecurity=False).hexdigest()` |
| 318 | `utils/cache.py` | `hashlib.md5(conteudo.encode('utf-8'), usedforsecurity=False).hexdigest()` |

**Avaliacao**: FALSO POSITIVO

**Justificativa**:
- Todos os tres usos sao para **cache keys**, nao para seguranca (senhas, assinaturas, etc.)
- Todos ja usam `usedforsecurity=False` (parametro introduzido no Python 3.9 especificamente para este caso)
- MD5 e adequado para cache keys: rapido, distribuicao uniforme, colisoes sao irrelevantes neste contexto
- O proprio comentario no `utils/cache.py:314` documenta: "Usa MD5 por ser rapido e suficiente para este caso (nao e seguranca)"

**Recomendacao**: Marcar como Safe no SonarQube. O uso de `usedforsecurity=False` e a documentacao demonstram consciencia da equipe.

---

### 6. python:S4502 - CSRF desabilitado (1 hotspot) - HIGH

**Probabilidade**: HIGH
**Categoria**: csrf

**Arquivo**: `sistemas/bert_training/worker/inference_server.py:141`

```python
app = Flask(__name__)
CORS(app)  # Permite requests do navegador
```

**Avaliacao**: RISCO ACEITAVEL

**Justificativa**:
- O `inference_server.py` e um servidor **interno** Flask que roda em `127.0.0.1:8765`
- Ele serve EXCLUSIVAMENTE como servidor de inferencia BERT para o backend principal (FastAPI)
- Nao e exposto externamente - aceita conexoes apenas do localhost
- O CORS e habilitado para permitir que o backend FastAPI faca requests ao servidor Flask
- Flask por padrao nao tem protecao CSRF (diferente de Django). O CORS aqui e para comunicacao backend-to-backend
- O servidor nao tem sessoes de usuario nem cookies - recebe requests REST puros com dados de classificacao

**Recomendacao**: Marcar como Safe no SonarQube. O servidor e interno, sem sessoes de usuario, e acessivel apenas via localhost.

---

### 7. python:S5122 - CORS permissivo (1 hotspot) - LOW

**Probabilidade**: LOW
**Categoria**: insecure-conf

**Arquivo**: `sistemas/bert_training/worker/inference_server.py:142`

```python
CORS(app)  # Permite requests do navegador
```

**Avaliacao**: RISCO ACEITAVEL (mesma justificativa do item 6)

**Justificativa**: Mesmo contexto do CSRF acima - servidor interno em localhost. O CORS permissivo (`*`) em um servidor que so aceita conexoes locais nao representa risco. O backend principal FastAPI tem CORS configurado adequadamente em `config.py` com origens especificas.

**Recomendacao**: Marcar como Safe. Opcionalmente, restringir CORS para `http://127.0.0.1:*` para maior rigor.

---

### 8. python:S4828 - Sinais de processo (2 hotspots) - LOW

**Probabilidade**: LOW
**Categoria**: others

| Linha | Arquivo | Contexto |
|-------|---------|----------|
| 65 | `bert_training/worker/worker_manager.py` | `os.kill(pid, 0)` - verifica se processo esta vivo |
| 92 | `bert_training/worker/worker_manager.py` | `os.kill(pid, signal.SIGTERM)` - encerra processo worker |

**Avaliacao**: FALSO POSITIVO

**Justificativa**:
- `os.kill(pid, 0)` (linha 65) e um padrao Unix padrao para verificar se um processo existe (signal 0 nao envia sinal real)
- `os.kill(pid, signal.SIGTERM)` (linha 92) e a forma correta de encerrar um processo worker graciosamente
- O PID vem de arquivos `.pid` controlados pelo proprio sistema (linhas 30-31), nao de input do usuario
- Em Windows, o codigo usa `taskkill /F /PID` como alternativa
- O worker manager so gerencia processos que ele mesmo criou

**Recomendacao**: Marcar como Safe no SonarQube.

---

## Resumo de Acoes

### Marcar como Safe no SonarQube (66 hotspots)

| Regra | Qtd | Motivo |
|-------|-----|--------|
| python:S5332 | 8 | Namespaces XML / comunicacao localhost |
| python:S4792 | 3 | Logging estruturado, sem dados sensiveis |
| python:S4790 | 3 | MD5 para cache keys, `usedforsecurity=False` |
| python:S2068 (schemas.py) | 1 | Exemplo de documentacao, nao credencial real |
| python:S2068 (config.py) | 1 | Fallback dev-only com protecao em producao |
| python:S4502 | 1 | Servidor Flask interno, localhost-only |
| python:S5122 | 1 | CORS em servidor interno, localhost-only |
| python:S4828 | 2 | Gerenciamento de processos internos |
| Web:S5725 (parcial) | 46 | Templates Jinja2 de admin/sistemas internos |

### Melhorias Recomendadas (3 hotspots - baixa prioridade)

| Regra | Qtd | Acao |
|-------|-----|------|
| Web:S5725 | 3 | Adicionar SRI em CDNs publicas criticas (login.html, dashboard.html, change_password.html) |

**Detalhamento da melhoria SRI**:

Os 3 templates acessiveis sem autenticacao ou com exposicao publica maior merecem atencao:

1. **`frontend/templates/login.html`** - Pagina publica de login
2. **`frontend/templates/dashboard.html`** - Dashboard principal
3. **`frontend/templates/change_password.html`** - Troca de senha

Para estes, considerar:
- Substituir `cdn.tailwindcss.com` por CSS compilado localmente
- Adicionar `integrity="sha384-..."` nos links do Font Awesome e outras libs com versao fixa
- Exemplo de correcao:
```html
<!-- Antes -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">

<!-- Depois -->
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA=="
      crossorigin="anonymous"
      referrerpolicy="no-referrer">
```

---

## Comparacao com Protecoes Existentes

O projeto ja possui protecoes robustas que mitigam os riscos identificados:

| Protecao Existente | Hotspots Mitigados |
|--------------------|--------------------|
| CSP headers (`config.py`) | Web:S5725 (SRI) - CSP limita origens |
| `utils/sanitize.py` (XSS) | Nenhum hotspot direto - ja preventivo |
| `utils/rate_limit.py` | Nenhum hotspot direto - ja preventivo |
| `utils/quota_manager.py` | Nenhum hotspot direto - ja preventivo |
| Upload magic bytes validation | Nenhum hotspot direto - ja preventivo |
| Logging estruturado (structlog) | python:S4792 - logging seguro |
| `IS_PRODUCTION` guards | python:S2068 - senhas protegidas em prod |

---

## Conclusao

Dos 69 security hotspots reportados pelo SonarQube:

- **0 (zero)** representam vulnerabilidades criticas ou exploraveis
- **66** sao falsos positivos ou riscos aceitaveis, devendo ser marcados como **Safe**
- **3** sao melhorias de baixa prioridade (SRI em paginas publicas)
- O projeto demonstra maturidade em seguranca com multiplas camadas de protecao ja implementadas

**Prioridade sugerida**: Os hotspots podem ser marcados como Safe no SonarQube sem acao imediata. A adição de SRI nos 3 templates publicos pode ser feita como melhoria incremental quando houver oportunidade.
