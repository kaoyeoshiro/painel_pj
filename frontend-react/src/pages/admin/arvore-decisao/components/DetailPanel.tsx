/**
 * Painel lateral slide-in com detalhes do nó selecionado.
 * Mostra informações diferentes para módulos e variáveis.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useArvoreStore } from '../store/useArvoreStore'
import { C } from '@/lib/designTokens'
import type { ASTRule } from '../types'

/** Renderiza regra AST em notação legível */
function RuleTree({ rule, depth = 0 }: { rule: ASTRule; depth?: number }) {
  const indent = '  '.repeat(depth)

  if (rule.type === 'condition') {
    const val = typeof rule.value === 'boolean' ? String(rule.value) :
      Array.isArray(rule.value) ? JSON.stringify(rule.value) :
      String(rule.value ?? '')
    return <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{indent}({rule.operator.toUpperCase()} {rule.variable} {val})</div>
  }

  if (rule.type === 'and' || rule.type === 'or') {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <div>{indent}({rule.type.toUpperCase()}</div>
        {rule.conditions.map((c, i) => <RuleTree key={i} rule={c} depth={depth + 1} />)}
        <div>{indent})</div>
      </div>
    )
  }

  if (rule.type === 'not') {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <div>{indent}(NOT</div>
        <RuleTree rule={rule.condition} depth={depth + 1} />
        <div>{indent})</div>
      </div>
    )
  }

  return null
}

export function DetailPanel() {
  const { detailPanel, closeDetailPanel, data } = useArvoreStore()

  if (!detailPanel) return null

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 380, background: '#fff', borderLeft: `1px solid ${C.gray200}`,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        zIndex: 50, overflowY: 'auto', padding: 20,
      }}
    >
      <Button variant="ghost" size="sm" onClick={closeDetailPanel} style={{ position: 'absolute', right: 8, top: 8 }}>
        <X className="h-4 w-4" />
      </Button>

      {detailPanel.type === 'module' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text700, marginBottom: 4, paddingRight: 32 }}>
            {detailPanel.data.titulo}
          </h3>
          <div style={{ fontSize: 12, color: C.text400, marginBottom: 16 }}>
            ID: #{detailPanel.data.id} · {detailPanel.data.categoria}
          </div>

          {/* Modo ativação */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Ativação</SectionLabel>
            <Badge variant={detailPanel.data.modo_ativacao === 'deterministic' ? 'default' : 'secondary'}>
              {detailPanel.data.modo_ativacao}
            </Badge>
            {detailPanel.data.fallback_habilitado && (
              <Badge variant="outline" className="ml-2">fallback ativo</Badge>
            )}
          </div>

          {/* Regra primária visual */}
          {detailPanel.data.regra && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Regra Primária</SectionLabel>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: `1px solid ${C.gray200}` }}>
                <RuleTree rule={detailPanel.data.regra} />
              </div>
            </div>
          )}

          {/* Regra primária JSON (colapsável) */}
          {detailPanel.data.regra && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, color: C.text400, cursor: 'pointer' }}>JSON da regra</summary>
              <pre style={{ fontSize: 11, background: '#f1f5f9', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                {JSON.stringify(detailPanel.data.regra, null, 2)}
              </pre>
            </details>
          )}

          {/* Regra secundária (fallback) */}
          {detailPanel.data.fallback_habilitado && detailPanel.data.regra_secundaria && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Regra Secundária (Fallback)</SectionLabel>
              <div style={{ background: '#fffbeb', borderRadius: 8, padding: 12, border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                <RuleTree rule={detailPanel.data.regra_secundaria} />
              </div>
            </div>
          )}

          {/* Regras por tipo de peça */}
          {Object.keys(detailPanel.data.regras_tipo_peca).length > 0 && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: C.text700, cursor: 'pointer' }}>
                Regras por Tipo de Peça ({Object.keys(detailPanel.data.regras_tipo_peca).length})
              </summary>
              {Object.entries(detailPanel.data.regras_tipo_peca).map(([tipo, regra]) => (
                <div key={tipo} style={{ marginTop: 8 }}>
                  <Badge variant="outline">{tipo}</Badge>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: 8, marginTop: 4 }}>
                    <RuleTree rule={regra as ASTRule} />
                  </div>
                </div>
              ))}
            </details>
          )}

          {/* Variáveis usadas */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Variáveis usadas ({detailPanel.data.variaveis_usadas.length})</SectionLabel>
            {detailPanel.data.variaveis_usadas.map((slug) => (
              <div key={slug} style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', padding: '2px 0' }}>
                {slug}
              </div>
            ))}
          </div>

          {/* Tipos de peça */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Tipos de peça</SectionLabel>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {detailPanel.data.tipos_peca.map((tp) => (
                <Badge key={tp} variant="outline">{tp}</Badge>
              ))}
            </div>
          </div>

          {/* Link externo */}
          <a href="/admin/prompts-modulos" style={{ fontSize: 12, color: '#3b82f6' }}>
            Abrir no Editor de Prompts →
          </a>
        </div>
      )}

      {detailPanel.type === 'variable' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text700, marginBottom: 4, paddingRight: 32, wordBreak: 'break-all' }}>
            {detailPanel.data.slug}
          </h3>
          <div style={{ fontSize: 12, color: C.text400, marginBottom: 16 }}>
            {detailPanel.data.tipo} · {detailPanel.data.fonte}
            {detailPanel.data.is_orfa && <Badge variant="destructive" className="ml-2">sem vínculo</Badge>}
          </div>

          {/* Pergunta */}
          {detailPanel.data.pergunta && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Pergunta vinculada</SectionLabel>
              <div style={{ fontSize: 13, color: C.text700, background: '#f8fafc', padding: 12, borderRadius: 8, fontStyle: 'italic' }}>
                "{detailPanel.data.pergunta}"
              </div>
            </div>
          )}

          {/* Dependência */}
          {detailPanel.data.depends_on && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Dependência</SectionLabel>
              <div style={{ fontSize: 12, color: C.text700 }}>
                Depende de <strong>{detailPanel.data.depends_on}</strong>
                {detailPanel.data.dependency_operator && ` (${detailPanel.data.dependency_operator} ${detailPanel.data.dependency_value})`}
              </div>
            </div>
          )}

          {/* Módulos que usam */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Módulos que usam ({detailPanel.data.modulos_ids.length})</SectionLabel>
            {detailPanel.data.modulos_ids.length === 0 ? (
              <div style={{ fontSize: 12, color: C.text400, fontStyle: 'italic' }}>Nenhum módulo usa esta variável</div>
            ) : (
              detailPanel.data.modulos_ids.map((id) => {
                const modulo = data?.modulos.find((m) => m.id === id)
                return (
                  <div key={id} style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', padding: '2px 0' }}>
                    #{id} {modulo?.titulo ?? ''}
                  </div>
                )
              })
            )}
          </div>

          {/* Sugestão para órfãs */}
          {detailPanel.data.is_orfa && (
            <div style={{ background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 4 }}>Sugestão</div>
              <div style={{ fontSize: 12, color: C.text700 }}>
                Esta variável existe mas não é usada em nenhuma regra determinística. Considere criar uma regra ou removê-la.
              </div>
            </div>
          )}

          {/* Link externo */}
          <a href="/admin/variaveis" style={{ fontSize: 12, color: '#3b82f6' }}>
            Abrir no Editor de Variáveis →
          </a>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.text400, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{children}</div>
}
