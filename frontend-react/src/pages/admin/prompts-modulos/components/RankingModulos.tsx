import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import { useRankingModulos } from '../hooks/useRankingModulos'

// Cores por categoria (mesmo padrão visual das badges do TipoSection)
const CATEGORIA_COLORS: Record<string, { bg: string; text: string }> = {
  'Merito': { bg: '#2d4a3e', text: '#6ee7b7' },
  'Mérito': { bg: '#2d4a3e', text: '#6ee7b7' },
  'Forma': { bg: '#3b2d4a', text: '#c4b5fd' },
  'Responsabilidade': { bg: '#4a3b2d', text: '#fcd34d' },
  'Sancoes': { bg: '#4a2d2d', text: '#fca5a5' },
  'Sanções': { bg: '#4a2d2d', text: '#fca5a5' },
}
const DEFAULT_COLOR = { bg: '#374151', text: '#9ca3af' }

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

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'white', border: `1px solid ${C.gray200}` }}
        >
          <div className="text-3xl font-bold" style={{ color: C.chartBlue }}>
            {metadata.total_modulos_ativos}
          </div>
          <div className="text-xs mt-1" style={{ color: C.text400 }}>
            Módulos Ativos
          </div>
        </div>
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'white', border: `1px solid ${C.gray200}` }}
        >
          <div className="text-3xl font-bold" style={{ color: C.successAccent }}>
            {metadata.total_geracoes_analisadas}
          </div>
          <div className="text-xs mt-1" style={{ color: C.text400 }}>
            Gerações Analisadas
          </div>
        </div>
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'white', border: `1px solid ${C.gray200}` }}
        >
          <div className="text-3xl font-bold" style={{ color: C.statusError }}>
            {metadata.modulos_nunca_ativados}
          </div>
          <div className="text-xs mt-1" style={{ color: C.text400 }}>
            Nunca Ativados
          </div>
        </div>
      </div>

      {/* Botão de atualizar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Tabela de ranking */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: `1px solid ${C.gray200}` }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.gray50 }}>
              <th className="px-4 py-3 text-left font-medium w-12" style={{ color: C.text500 }}>
                #
              </th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: C.text500 }}>
                Módulo
              </th>
              <th className="px-4 py-3 text-left font-medium w-36" style={{ color: C.text500 }}>
                Categoria
              </th>
              <th className="px-4 py-3 text-right font-medium w-28" style={{ color: C.text500 }}>
                Ativações
              </th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: C.text400 }}>
                  Nenhum módulo de conteúdo ativo neste grupo
                </td>
              </tr>
            ) : (
              ranking.map((item) => {
                const catColor = getCategoriaColor(item.categoria)
                return (
                  <tr
                    key={item.modulo_id}
                    className="border-t"
                    style={{
                      borderColor: C.gray200,
                      background: item.nunca_ativado ? 'rgba(239,68,68,0.03)' : undefined,
                    }}
                  >
                    <td className="px-4 py-3" style={{ color: C.text400 }}>
                      {item.posicao}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: C.text700 }}>
                      {item.titulo}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: catColor.bg, color: catColor.text }}
                      >
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.nunca_ativado ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: '#7f1d1d', color: '#fca5a5' }}
                        >
                          Nunca ativado
                        </span>
                      ) : (
                        <span className="font-semibold" style={{ color: C.chartBlue }}>
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
