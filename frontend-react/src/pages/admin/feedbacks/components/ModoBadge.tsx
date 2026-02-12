import type { ModoAtivacao } from '../types'

interface ModoBadgeProps {
  modo: ModoAtivacao | null | undefined
  sistema: string
}

export function ModoBadge({ modo, sistema }: ModoBadgeProps) {
  if (sistema !== 'gerador_pecas') {
    return <span className="text-gray-300">-</span>
  }

  if (!modo) {
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs" title="Modo não registrado (geração anterior)">
        N/R
      </span>
    )
  }

  if (modo.modo === 'semi_automatico') {
    const manuais = modo.total_manuais ?? 0
    const confirmados = (modo.total_curados ?? 0) - manuais
    const excluidos = modo.total_excluidos ?? 0
    const totalIncluidos = modo.total_curados ?? 0
    const tooltip = [
      'Curadoria Humana [HUMAN_VALIDATED]',
      `${confirmados} confirmado(s) pelo usuário`,
      `${manuais} adicionado(s) manualmente`,
      `${excluidos} removido(s) da sugestão`,
    ].join('\n')

    return (
      <span
        className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs inline-flex items-center gap-1 cursor-help"
        title={tooltip}
      >
        Curadoria
        <span className="bg-amber-500 text-white px-1 rounded text-[10px]">{totalIncluidos}</span>
      </span>
    )
  }

  if (modo.modo === 'fast_path') {
    return (
      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs" title="100% determinístico">
        Fast
      </span>
    )
  }

  if (modo.modo === 'misto') {
    return (
      <span
        className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs"
        title={`Det: ${modo.modulos_det ?? 0}, LLM: ${modo.modulos_llm ?? 0}`}
      >
        Misto
      </span>
    )
  }

  if (modo.modo === 'llm') {
    return (
      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs" title="100% LLM">
        LLM
      </span>
    )
  }

  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
      {modo.modo ?? 'Desconhecido'}
    </span>
  )
}
