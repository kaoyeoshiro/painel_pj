import { Activity, Bot, Code, HardDrive, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'

import { usePerformance } from './hooks/usePerformance'
import { TabSistema, TabGemini, TabAvancado } from './components/PerformanceTabs'
import { RouteMapDialog } from './components/PerformanceDialogs'

import type { TabValue } from './types'

// ============================================================
// Componente principal — composicao fina usando hook e subcomponentes
// ============================================================

export function PerformancePage() {
  const vm = usePerformance()

  return (
    <>
      <BreadcrumbBar
        title="Performance & Logs"
        icon={<Activity className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-3">
            <Button onClick={vm.handleCacheInvalidate} variant="ghost" size="sm" className="text-xs" style={{ color: C.navy700 }}>
              <HardDrive className="h-3 w-3 mr-1" />Limpar Cache
            </Button>
            <span className="text-xs flex items-center gap-1" style={{ color: C.statusSuccess }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.statusSuccess }} />
              Sempre ativo
            </span>
          </div>
        }
      />
      <ContentArea>

      {/* ========== Tabs ========== */}
      <nav className="flex gap-8 overflow-x-auto border-b mb-6" style={{ borderColor: C.gray200 }}>
        {([
          { key: 'sistema' as TabValue, label: 'Performance Sistema', Icon: Server },
          { key: 'gemini' as TabValue, label: 'Logs Gemini API', Icon: Bot },
          { key: 'avancado' as TabValue, label: 'Logs Avancados', Icon: Code },
        ]).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => vm.setTab(key)} className="py-4 px-1 font-medium whitespace-nowrap"
            style={vm.tab === key ? { borderBottom: `3px solid ${C.navy700}`, color: C.navy700 } : { color: C.text500 }}
            data-testid={`tab-${key}`}>
            <Icon className="h-4 w-4 inline mr-2" />{label}
          </button>
        ))}
      </nav>

      {/* Conteudo da tab ativa */}
      {vm.tab === 'sistema' && <TabSistema vm={vm} />}
      {vm.tab === 'gemini' && <TabGemini vm={vm} />}
      {vm.tab === 'avancado' && <TabAvancado vm={vm} />}

      </ContentArea>

      {/* Dialog de CRUD para route map */}
      <RouteMapDialog vm={vm} />
    </>
  )
}
