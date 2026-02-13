# ADR-0012: Comparar BERT vs LLM por CNJ no BERT Training

**Data**: 2026-02-04
**Status**: Aceito
**Autores**: LAB/PGE-MS

## Contexto

O modulo BERT Training permite treinar modelos de classificacao de documentos juridicos. Porem, nao havia forma de avaliar a qualidade do modelo BERT comparando-o com um LLM (Large Language Model) usando documentos reais de processos.

**Problema identificado**:
- Usuarios querem validar se o modelo BERT esta classificando documentos corretamente
- Nao havia benchmark automatizado contra uma IA de referencia
- Era necessario testar documento por documento manualmente

**Requisitos do usuario**:
- Comparar classificacoes BERT vs Gemini usando documentos reais de um CNJ
- Filtrar documentos por categoria (Peticao, Decisao, etc.)
- Ver accuracy e detalhamento por documento
- LLM atua como "ground truth" para calcular acertos do BERT

## Decisao

Implementar nova aba "Comparar com IA (CNJ)" no modulo BERT Training.

### 1. Arquitetura do Fluxo

```
┌────────────┐    ┌────────────┐    ┌────────────────────┐    ┌──────────────┐
│  Usuario   │ →  │   TJ-MS    │ →  │ Para cada doc:     │ →  │  Resultado   │
│  (CNJ +    │    │ (Download  │    │ BERT + LLM         │    │  Accuracy +  │
│  Categoria)│    │  paralelo) │    │ em paralelo        │    │  Tabela      │
└────────────┘    └────────────┘    └────────────────────┘    └──────────────┘
```

### 2. Decisoes Tecnicas

| Decisao | Justificativa |
|---------|---------------|
| LLM como ground truth | Gemini e mais preciso para classificacao zero-shot |
| Modelo fixo: `gemini-3-flash-preview` | Requisito do usuario para consistencia |
| Thinking level: `minimal` | Maxima velocidade, classificacao simples |
| Token window: `fim` default | Documentos juridicos tem conclusoes no final |
| Semaphore(3) concorrencia | Mesmo limite do classificador_documentos |
| Comparacao case-insensitive | Evita falsos negativos por capitalizacao |

### 3. Reutilizacao de Componentes

- `_limpar_cnj()`: Funcao do gerador de pecas (remove formatacao)
- `TextExtractor.extrair_chunk()`: Recorte de tokens do classificador
- `GeminiService.generate()`: Cliente Gemini centralizado
- `TJMSClient`: Download de documentos via SOAP
- `CategoriaDocumento`: Filtro por codigos de documento

### 4. Arquivos Criados/Modificados

| Arquivo | Acao |
|---------|------|
| `sistemas/bert_training/schemas.py` | Adicionados: `CompareCNJRequest`, `CompareCNJResponse`, `DocumentComparisonItem` |
| `sistemas/bert_training/router.py` | Adicionado: endpoint POST `/api/comparar-cnj` |
| `sistemas/bert_training/templates/index.html` | Adicionados: aba "Comparar com IA", painel de formulario, card de resultados |
| `tests/test_bert_compare_cnj.py` | Criado: 29 testes unitarios e de integracao |

### 5. Schema da API

**Request:**
```json
{
  "cnj": "0804330-09.2024.8.12.0017",
  "categoria_id": 1,
  "bert_model_id": 5,
  "llm_temperature": 0.1,
  "llm_token_limit": 8000,
  "llm_token_window": "fim"
}
```

**Response:**
```json
{
  "cnj": "0804330-09.2024.8.12.0017",
  "categoria": {"id": 1, "nome": "peticao", "titulo": "Peticao"},
  "bert_model": {"id": 5, "name": "Classificador Docs"},
  "llm": {"model": "gemini-3-flash-preview", "thinking": "minimal", ...},
  "summary": {"total": 10, "matches": 7, "accuracy": 0.7, "llm_failed": 0},
  "items": [...]
}
```

## Consequencias

### Positivas
- Usuarios podem validar modelos BERT com documentos reais
- Benchmark automatizado contra LLM de referencia
- Interface visual com resumo e detalhamento

### Negativas
- Depende do worker BERT local rodando (http://127.0.0.1:8765)
- Custo de API Gemini para cada comparacao
- Pode demorar varios minutos para processos com muitos documentos

### Riscos
- TJ-MS pode estar indisponivel → Tratado com erro amigavel
- Worker BERT offline → Verificado antes de iniciar
- Gemini timeout → Documento marcado como llm_failed

## Testes

29 testes implementados em `tests/test_bert_compare_cnj.py`:
- Recorte de tokens (first/last, maior que texto, vazio)
- Sanitizacao JSON (NaN, Infinity)
- Validacao de schemas Pydantic
- Calculo de accuracy
- Comparacao case-insensitive
- Contagem de tokens
