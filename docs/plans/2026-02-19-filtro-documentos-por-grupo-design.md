# Design: Filtro de Documentos por Grupo

**Data**: 2026-02-19
**Status**: Aprovado
**Autor**: Kaoye + Claude

## Problema

1. **Tipos de peca fantasma**: A tabela `tipos_peca` (populada via seed) lista tipos como "Parecer Juridico" e "Contrarrazoes de Apelacao" que NAO tem template correspondente em `prompt_modulos` (tipo='peca'). Esses tipos aparecem em `/admin/filtro-documentos` mas nao funcionam na geracao.

2. **Categorias universais**: A tabela de juncao `tipo_peca_categorias` nao tem `group_id`. A mesma Contestacao no PS e no Detran usa as mesmas categorias de documento para o Agente 1, quando na pratica cada grupo precisa de categorias diferentes.

## Decisoes

- **Fonte de verdade para tipos de peca**: `prompt_modulos` (tipo='peca')
- **Abordagem**: Nova tabela de juncao com group_id (incremental)
- **CategoriaDocumento**: Mantida intacta (usada pelo Extrator de Autos)
- **tipos_peca e tipo_peca_categorias**: Deprecated (nao deletadas)

## Modelo de Dados

### Nova tabela: `tipo_peca_grupo_categorias`

```sql
CREATE TABLE tipo_peca_grupo_categorias (
    id SERIAL PRIMARY KEY,
    tipo_peca_nome VARCHAR(50) NOT NULL,       -- ex: 'contestacao'
    group_id INTEGER NOT NULL REFERENCES prompt_groups(id),
    categoria_documento_id INTEGER NOT NULL REFERENCES categorias_documento(id),
    UNIQUE(tipo_peca_nome, group_id, categoria_documento_id)
);
CREATE INDEX ix_tpgc_tipo_group ON tipo_peca_grupo_categorias(tipo_peca_nome, group_id);
```

**tipo_peca_nome (string)** em vez de FK para tipos_peca.id porque os tipos de peca agora sao derivados de `prompt_modulos.nome` (tipo='peca'). Nao ha mais tabela tipos_peca como fonte primaria.

### Tabelas impactadas

| Tabela | Acao |
|--------|------|
| `tipo_peca_grupo_categorias` | NOVA |
| `tipos_peca` | DEPRECATED (nao deletada) |
| `tipo_peca_categorias` | DEPRECATED (nao deletada) |
| `categorias_documento` | SEM ALTERACAO |
| `prompt_modulos` | SEM ALTERACAO (ja e a fonte) |

## Backend

### FiltroCategoriasDocumento atualizado

```python
def get_codigos_permitidos(self, tipo_peca: str, group_id: int | None = None) -> Set[int]:
    if group_id:
        # Busca na nova tabela tipo_peca_grupo_categorias
        # Retorna codigos das categorias associadas a (tipo_peca, group_id)
        ...
    else:
        # Fallback: comportamento atual (retrocompatibilidade)
        ...
```

### Endpoints alterados

| Endpoint | Antes | Depois |
|----------|-------|--------|
| `GET /admin/api/filtro-documentos/tipos-peca` | Consulta tabela `tipos_peca` | Consulta `prompt_modulos` (tipo='peca') filtrado por group_id |
| `PUT /admin/api/filtro-documentos/tipos-peca/{nome}/categorias` | Atualiza `tipo_peca_categorias` | Atualiza `tipo_peca_grupo_categorias` (requer group_id) |

### Endpoint novo

```
GET /admin/api/filtro-documentos/tipos-peca/{nome}/categorias?group_id=X
  -> Retorna categorias associadas a (nome, group_id)
```

## Frontend (Filtro Documentos)

1. **Seletor de grupo** no topo (PS, PP, Detran) — como ja existe em categorias-json
2. **Tipos de peca derivados de prompt_modulos** — so aparecem os que tem template no grupo selecionado
3. **Cards de tipo de peca** — cada um mostra as categorias associadas para aquele grupo
4. **Dialog de edicao** — checkboxes para selecionar categorias por (tipo_peca, grupo)
5. Se nao ha configuracao para um (tipo_peca, grupo), exibe aviso "sem filtro configurado"

## Pipeline do Gerador (Agente 1)

No `router.py`, onde `FiltroCategoriasDocumento` e instanciado (~L908, ~L3078, ~L3424):
- Passar `group_id` junto com `tipo_peca`
- O filtro usa a nova tabela quando group_id esta disponivel
- Fallback para CategoriaDocumento quando group_id nao esta disponivel

## Migracao

1. Alembic migration cria `tipo_peca_grupo_categorias`
2. Script de migracao copia dados de `tipo_peca_categorias` para a nova tabela (para todos os grupos existentes, replica configuracao atual)
3. Tabelas antigas permanecem (deprecated, nao deletadas)
