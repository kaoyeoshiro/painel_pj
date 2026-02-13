# services/shared - Módulos Compartilhados

> **Autor**: LAB/PGE-MS
> **Data**: 2026-02-12

## Visão Geral

Este diretório contém módulos e utilitários reutilizáveis compartilhados entre múltiplos sistemas do Portal PGE.

**Princípio**: Código DRY (Don't Repeat Yourself) sem forçar acoplamento.

## Módulos Disponíveis

### 1. SSE (Server-Sent Events)

**Arquivo**: `sse.py`

**Propósito**: Padronização de eventos SSE em streaming endpoints.

**Classes**:
- `SSEEventFormatter` - Formatador de eventos SSE
- `SSEHeartbeat` - Gerenciador de heartbeat

**Uso**:
```python
from services.shared import SSEEventFormatter

yield SSEEventFormatter.info("Processando...")
yield SSEEventFormatter.agent_status(1, "ativo", "Baixando...")
yield SSEEventFormatter.success({"id": 123})
```

**Documentação**:
- [SSE_USAGE_EXAMPLES.md](./SSE_USAGE_EXAMPLES.md) - Exemplos práticos
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Guia de migração

**Testes**: `tests/test_sse_common.py` (33 testes)

---

## Filosofia do Módulo Shared

### Quando Adicionar Código Aqui

✅ **SIM** - Adicione quando:
- Código é usado (ou será usado) por 2+ sistemas
- Funcionalidade é genérica e sem lógica de negócio
- Melhora legibilidade e manutenibilidade
- Reduz duplicação significativa

❌ **NÃO** - Não adicione se:
- Código é específico de um único sistema
- Contém lógica de negócio do domínio
- Cria dependência circular
- É uma abstração prematura (usado em 1 lugar apenas)

### Regras

1. **Sem dependências internas**: Módulos compartilhados NÃO devem importar de `sistemas/`, `auth/`, etc.
   - ✅ OK: `import json`, `from typing import ...`, `import asyncio`
   - ❌ Errado: `from sistemas.gerador_pecas import ...`

2. **Sem lógica de negócio**: Apenas utilitários e abstrações técnicas.
   - ✅ OK: Formatação de eventos, parsing genérico, validação básica
   - ❌ Errado: Regras de classificação de documentos, cálculo de prazos

3. **Documentação obrigatória**: Todo módulo deve ter:
   - Docstrings detalhadas
   - Exemplos de uso
   - Testes (mínimo 80% cobertura)

4. **Versionamento semântico**: Se alterar API pública, incrementar versão em `__init__.py`

5. **Compatibilidade**: Mudanças devem ser retrocompatíveis ou com deprecation warnings.

---

## Estrutura Recomendada

Ao adicionar novo módulo:

```
services/shared/
├── __init__.py              # Re-exports públicos
├── README.md                # Este arquivo
├── meu_modulo.py            # Código do módulo
├── MEU_MODULO_EXAMPLES.md   # Exemplos de uso (opcional)
└── MEU_MODULO_GUIDE.md      # Guia detalhado (opcional)
```

Com testes correspondentes:

```
tests/
└── test_meu_modulo.py       # Testes unitários
```

---

## Processo de Adição de Novo Módulo

1. **Propor**: Abrir issue/discussão justificando necessidade
2. **Implementar**: Criar módulo com docstrings completas
3. **Testar**: Cobertura mínima 80%
4. **Documentar**: Criar arquivo de exemplos
5. **Revisar**: Code review obrigatório
6. **Atualizar `__init__.py`**: Adicionar exports

---

## Contribuindo

### Checklist para Novo Módulo

- [ ] Código é reutilizável por 2+ sistemas
- [ ] Sem dependências de `sistemas/`, `auth/`, etc.
- [ ] Docstrings completas (módulo, classes, métodos)
- [ ] Testes unitários (cobertura ≥80%)
- [ ] Type hints em todos os parâmetros e retornos
- [ ] Exemplos de uso documentados
- [ ] Atualizado `__init__.py` com exports
- [ ] Atualizado este README.md

---

## Histórico

| Data | Módulo | Descrição |
|------|--------|-----------|
| 2026-02-12 | `sse.py` | Módulo SSE comum criado (SSEEventFormatter, SSEHeartbeat) |

---

## Roadmap

Módulos planejados/sugeridos:

- [ ] `validation.py` - Validações comuns (CPF, CNPJ, CNJ, etc.)
- [ ] `formatting.py` - Formatadores de texto (currency, date, etc.)
- [ ] `retry.py` - Decorators de retry genéricos
- [ ] `cache.py` - Abstrações de cache simples

**Nota**: Estes são apenas sugestões. Adicione apenas quando houver necessidade real (YAGNI - You Aren't Gonna Need It).

---

## Contato

- **Equipe**: LAB/PGE-MS
- **Slack**: #pge-dev
- **Issues**: GitHub Issues
