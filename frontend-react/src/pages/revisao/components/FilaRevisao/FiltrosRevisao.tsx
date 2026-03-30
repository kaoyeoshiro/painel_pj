/**
 * Barra de filtros da fila de revisão.
 * Exibe abas de navegação e seletores de status, urgência e ação.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { C } from '@/lib/designTokens'
import { ACOES_SUGERIDAS, STATUS_CONFIG, URGENCIA_CONFIG } from '../../constants'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface FiltrosProps {
  tab: string
  setTab: (v: string) => void
  status: string
  setStatus: (v: string) => void
  urgencia: string
  setUrgencia: (v: string) => void
  acao: string
  setAcao: (v: string) => void
  periodo: string
  setPeriodo: (v: string) => void
  isAdmin: boolean
}

interface TabConfig {
  value: string
  label: string
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TABS_ADMIN: TabConfig[] = [
  { value: 'minha_fila', label: 'Minha Fila' },
  { value: 'assessores', label: 'Assessores' },
  { value: 'concluidos', label: 'Concluídos' },
]

const TABS_ASSESSOR: TabConfig[] = [
  { value: 'para_revisar', label: 'Para Revisar' },
  { value: 'para_inserir', label: 'Para Inserir' },
]

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function FiltrosRevisao({
  tab,
  setTab,
  status,
  setStatus,
  urgencia,
  setUrgencia,
  acao,
  setAcao,
  periodo,
  setPeriodo,
  isAdmin,
}: FiltrosProps) {
  const tabs = isAdmin ? TABS_ADMIN : TABS_ASSESSOR

  return (
    <div
      className="bg-white rounded-2xl shadow-sm p-4 border flex flex-wrap items-center gap-3"
      style={{ borderColor: C.gray200 }}
    >
      {/* Abas */}
      <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: C.gray100 }}>
        {tabs.map((t) => {
          const isActive = tab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-all"
              style={{
                background: isActive ? 'white' : 'transparent',
                color: isActive ? C.navy700 : C.text500,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* Filtro de período (apenas na aba Concluídos) */}
      {tab === 'concluidos' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text700 }}>
            Período:
          </label>
          <Select
            value={periodo || '__all__'}
            onValueChange={(v) => setPeriodo(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filtro de status (oculto nas abas Assessores e Concluídos) */}
      {isAdmin && tab !== 'assessores' && tab !== 'concluidos' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text700 }}>
            Status:
          </label>
          <Select
            value={status || '__all__'}
            onValueChange={(v) => setStatus(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {Object.entries(STATUS_CONFIG)
                .filter(([key]) => key !== 'concluido' && key !== 'encaminhado')
                .map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filtro de urgência */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text700 }}>
          Urgência:
        </label>
        <Select
          value={urgencia || '__all__'}
          onValueChange={(v) => setUrgencia(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {Object.entries(URGENCIA_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro de ação */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text700 }}>
          Ação:
        </label>
        <Select
          value={acao || '__all__'}
          onValueChange={(v) => setAcao(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {ACOES_SUGERIDAS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
