import { RefreshCw, Layers, BarChart3, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { C } from '@/lib/designTokens'
import { useRankingModulos } from '../hooks/useRankingModulos'

// Cores por categoria — usando tokens do design system (fundo claro + texto escuro)
const CATEGORIA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Merito':            { bg: C.successBg,  text: C.successText,  border: C.successBorder },
  'Mérito':            { bg: C.successBg,  text: C.successText,  border: C.successBorder },
  'Preliminar':        { bg: C.navy50,     text: C.navy700,      border: C.navy200 },
  'Eventualidade':     { bg: C.warningBgAlt, text: C.warningText, border: C.warningBorder },
  'honorarios':        { bg: '#f5f3ff',    text: '#5b21b6',      border: '#ddd6fe' },
  'Forma':             { bg: '#f5f3ff',    text: '#5b21b6',      border: '#ddd6fe' },
  'Responsabilidade':  { bg: C.orange50,   text: C.orange600,    border: C.orange200 },
  'Sancoes':           { bg: C.errorBg,    text: C.errorText,    border: C.errorBorder },
  'Sanções':           { bg: C.errorBg,    text: C.errorText,    border: C.errorBorder },
}
const DEFAULT_COLOR = { bg: C.gray50, text: C.text700, border: C.gray200 }

function getCategoriaColor(categoria: string) {
  return CATEGORIA_COLORS[categoria] || DEFAULT_COLOR
}

interface RankingModulosProps {
  groupId: number
}

export function RankingModulos({ groupId }: RankingModulosProps) {
  const { ranking, metadata, loading, refetch } = useRankingModulos(groupId)

  if (loading) {
    return (
      <div className="text-center py-12" style={{ color: C.text400 }}>
        Carregando ranking...
      </div>
    )
  }

  const taxaAtivacao = metadata.total_modulos_ativos > 0
    ? Math.round(((metadata.total_modulos_ativos - metadata.modulos_nunca_ativados) / metadata.total_modulos_ativos) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Cards de resumo — mesmo padrao do FeedbacksPage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: C.text500 }}>Módulos Ativos</p>
              <p className="text-4xl leading-none mt-1 font-bold" style={{ color: C.text900 }}>
                {metadata.total_modulos_ativos}
              </p>
              <p className="text-xs mt-2" style={{ color: C.text400 }}>
                Taxa de ativação: {taxaAtivacao}%
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.navy100 }}>
              <Layers className="h-6 w-6" style={{ color: C.navy600 }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: C.text500 }}>Gerações Analisadas</p>
              <p className="text-4xl leading-none mt-1 font-bold" style={{ color: C.text900 }}>
                {metadata.total_geracoes_analisadas}
              </p>
              <p className="text-xs mt-2" style={{ color: C.text400 }}>
                Peças com activation_trace
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.successBg }}>
              <BarChart3 className="h-6 w-6" style={{ color: C.successAccent }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: C.text500 }}>Nunca Ativados</p>
              <p className="text-4xl leading-none mt-1 font-bold" style={{ color: metadata.modulos_nunca_ativados > 0 ? C.orange600 : C.text900 }}>
                {metadata.modulos_nunca_ativados}
              </p>
              <p className="text-xs mt-2" style={{ color: C.text400 }}>
                Módulos sem nenhuma ativação
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.orange100 }}>
              <AlertTriangle className="h-6 w-6" style={{ color: C.orange600 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de ranking */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border" style={{ borderColor: C.gray200 }}>
        {/* Header da tabela */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${C.gray200}` }}
        >
          <div className="flex items-center gap-3">
            <h3 className="font-semibold" style={{ color: C.text900 }}>
              Ranking de Ativações
            </h3>
            <Badge variant="secondary" className="text-xs">
              {ranking.length} módulo{ranking.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>

        {/* Tabela */}
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
              <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider w-14" style={{ color: C.text400 }}>
                #
              </th>
              <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: C.text400 }}>
                Módulo
              </th>
              <th className="px-5 py-3 text-left font-medium text-xs uppercase tracking-wider w-40" style={{ color: C.text400 }}>
                Categoria
              </th>
              <th className="px-5 py-3 text-right font-medium text-xs uppercase tracking-wider w-40" style={{ color: C.text400 }}>
                Ativações
              </th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center" style={{ color: C.text400 }}>
                  Nenhum módulo de conteúdo ativo neste grupo
                </td>
              </tr>
            ) : (
              ranking.map((item, idx) => {
                const catColor = getCategoriaColor(item.categoria)
                const isLast = idx === ranking.length - 1
                return (
                  <tr
                    key={item.modulo_id}
                    style={{
                      borderBottom: isLast ? undefined : `1px solid ${C.gray100}`,
                      background: item.nunca_ativado ? C.errorBgLight : undefined,
                    }}
                  >
                    <td className="px-5 py-3.5" style={{ color: C.text400 }}>
                      <span className="font-mono text-xs">{item.posicao}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium" style={{ color: C.text700 }}>
                        {item.titulo}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: catColor.bg,
                          color: catColor.text,
                          border: `1px solid ${catColor.border}`,
                        }}
                      >
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {item.nunca_ativado ? (
                        <span
                          className="inline-block whitespace-nowrap text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: C.errorBg,
                            color: C.errorText,
                            border: `1px solid ${C.errorBorder}`,
                          }}
                        >
                          Nunca ativado
                        </span>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: C.navy700 }}>
                          {item.total_ativacoes}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
