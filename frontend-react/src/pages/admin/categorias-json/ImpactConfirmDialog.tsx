/**
 * Dialog de confirmacao com analise de impacto.
 * Mostra quais modulos, regras e dependencias serao afetados
 * antes de alterar ou excluir uma variavel/pergunta.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Loader2,
  FileJson,
  Puzzle,
  GitBranch,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { C } from '@/lib/designTokens'

interface ImpactItem {
  tipo: 'json' | 'modulo' | 'regra_tipo_peca' | 'variavel_dependente' | 'pergunta_dependente'
  descricao: string
}

interface ImpactResponse {
  slug: string
  tem_impacto: boolean
  total_impactos: number
  impactos: ImpactItem[]
}

interface ImpactConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Slug da variavel a ser analisada */
  slug: string
  /** Acao que sera executada (exibida no titulo) */
  acao: 'alterar' | 'excluir'
  /** Label amigavel (ex: nome da pergunta) */
  label?: string
  /** Chamado quando usuario confirma */
  onConfirm: () => void
}

const ICON_MAP: Record<string, typeof FileJson> = {
  json: FileJson,
  modulo: Puzzle,
  regra_tipo_peca: Puzzle,
  variavel_dependente: GitBranch,
  pergunta_dependente: HelpCircle,
}

const TIPO_LABEL: Record<string, string> = {
  json: 'JSON de extracao',
  modulo: 'Modulo de prompt',
  regra_tipo_peca: 'Regra por tipo de peca',
  variavel_dependente: 'Variavel dependente',
  pergunta_dependente: 'Pergunta dependente',
}

const TIPO_COLOR: Record<string, string> = {
  json: 'text-blue-600 bg-blue-50',
  modulo: 'text-purple-600 bg-purple-50',
  regra_tipo_peca: 'text-indigo-600 bg-indigo-50',
  variavel_dependente: 'text-amber-600 bg-amber-50',
  pergunta_dependente: 'text-teal-600 bg-teal-50',
}

export function ImpactConfirmDialog({
  open,
  onOpenChange,
  slug,
  acao,
  label,
  onConfirm,
}: ImpactConfirmDialogProps) {
  const [loading, setLoading] = useState(false)
  const [impacto, setImpacto] = useState<ImpactResponse | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open || !slug) return

    setLoading(true)
    setErro('')
    setImpacto(null)

    adminApi
      .get<ImpactResponse>(`/admin/api/extraction/variaveis/impacto?slug=${encodeURIComponent(slug)}`)
      .then(setImpacto)
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : 'Erro ao analisar impacto')
      })
      .finally(() => setLoading(false))
  }, [open, slug])

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const tituloAcao = acao === 'excluir' ? 'Excluir' : 'Alterar'

  // Agrupa impactos por tipo
  const grupos = (impacto?.impactos ?? []).reduce<Record<string, ImpactItem[]>>((acc, item) => {
    const key = item.tipo
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {tituloAcao} variavel
          </DialogTitle>
          <DialogDescription>
            {label
              ? `Variavel "${slug}" (${label})`
              : `Variavel "${slug}"`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin mr-2" style={{ color: C.text400 }} />
              <span className="text-sm" style={{ color: C.text400 }}>Analisando impacto...</span>
            </div>
          )}

          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {erro}
            </div>
          )}

          {impacto && !loading && (
            <>
              {impacto.tem_impacto ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800">
                      Esta acao vai impactar {impacto.total_impactos} local(is):
                    </p>
                  </div>

                  {Object.entries(grupos).map(([tipo, items]) => {
                    const Icon = ICON_MAP[tipo] ?? HelpCircle
                    const colorClass = TIPO_COLOR[tipo] ?? 'text-gray-600 bg-gray-50'

                    return (
                      <div key={tipo}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                            <Icon className="h-3 w-3" />
                            {TIPO_LABEL[tipo] ?? tipo}
                          </span>
                          <span className="text-xs" style={{ color: C.text400 }}>
                            ({items.length})
                          </span>
                        </div>
                        <ul className="space-y-1 ml-2">
                          {items.map((item, i) => (
                            <li key={i} className="text-sm flex items-start gap-1.5" style={{ color: C.text500 }}>
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
                              {item.descricao}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <p className="text-sm text-green-700">
                    Nenhuma referencia encontrada. Esta variavel pode ser {acao === 'excluir' ? 'excluida' : 'alterada'} com seguranca.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !!erro}
            className={acao === 'excluir'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : ''}
            style={acao === 'alterar' ? { background: C.navy950, color: 'white' } : undefined}
          >
            {tituloAcao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
