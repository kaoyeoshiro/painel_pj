/**
 * Pagina principal do Classificador de Documentos.
 *
 * Camada de composicao que organiza as 4 abas (Novo Lote, Meus Lotes,
 * Prompts, Teste Rapido) e fornece os dados compartilhados (prompts).
 */

import { useState, useCallback } from 'react'
import { classificadorApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { CircleDot, FileSearch, FolderOpen, MessageCircleMore, Zap } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Prompt, PageTab } from '@/types/classificador'

import { NovoLoteTab } from './components/NovoLoteTab'
import { MeusLotesTab } from './components/MeusLotesTab'
import { PromptsTab } from './components/PromptsTab'
import { TesteRapidoTab } from './components/TesteRapidoTab'

// ============================================================================
// Componente principal
// ============================================================================

export function ClassificadorPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('novo-lote')

  const { data: prompts, isLoading: promptsLoading, refetch: refetchPrompts } = useQuery<Prompt[]>({
    queryKey: queryKeys.classificador.prompts(),
    queryFn: () => classificadorApi.get<Prompt[]>('/prompts'),
  })

  const handleSwitchTab = useCallback((tab: PageTab) => {
    setActiveTab(tab)
  }, [])

  const promptsList = prompts ?? []

  return (
    <>
      <BreadcrumbBar
        title="Classificador de Documentos"
        icon={<FileSearch style={{ width: 14, height: 14 }} />}
      />

      <ContentArea>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PageTab)}>
          <TabsList
            className="grid w-full grid-cols-4 h-auto rounded-none bg-transparent p-0"
            style={{ borderBottom: `1px solid ${C.gray200}` }}
          >
            <TabsTrigger value="novo-lote" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <CircleDot className="mr-2 h-4 w-4" />
              Novo Lote
            </TabsTrigger>
            <TabsTrigger value="meus-lotes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <FolderOpen className="mr-2 h-4 w-4" />
              Meus Lotes
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <MessageCircleMore className="mr-2 h-4 w-4" />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="teste-rapido" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Zap className="mr-2 h-4 w-4" />
              Teste Rapido
            </TabsTrigger>
          </TabsList>

          <TabsContent value="novo-lote">
            <NovoLoteTab
              prompts={promptsList}
              promptsLoading={promptsLoading}
              onProjetoCreated={refetchPrompts}
              onSwitchTab={handleSwitchTab}
            />
          </TabsContent>

          <TabsContent value="meus-lotes">
            <MeusLotesTab onSwitchTab={handleSwitchTab} />
          </TabsContent>

          <TabsContent value="prompts">
            <PromptsTab
              prompts={promptsList}
              promptsLoading={promptsLoading}
              onPromptsChange={refetchPrompts}
            />
          </TabsContent>

          <TabsContent value="teste-rapido">
            <TesteRapidoTab
              prompts={promptsList}
              promptsLoading={promptsLoading}
            />
          </TabsContent>
        </Tabs>
      </ContentArea>
    </>
  )
}
