import { Link } from '@tanstack/react-router'
import { ExternalLink, AlertTriangle, CheckCircle, Network, BookOpen } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'

export function TjmsDocsPage() {
  return (
    <>
      <BreadcrumbBar
        title="Documentacao Integracao TJ-MS"
        icon={<BookOpen className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: C.text500 }}>Atualizado: 24/01/2026</span>
            <Link to="/admin/tjms-docs/plano" className="hover:underline text-sm flex items-center gap-1" style={{ color: C.navy600 }}>
              <ExternalLink className="h-3.5 w-3.5" />
              Ver Plano Completo
            </Link>
          </div>
        }
      />

      <ContentArea className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800">Importante: Sincronizacao Backend/Frontend</h3>
                <p className="text-amber-700 text-sm mt-1">
                  Quando alterar qualquer arquivo listado abaixo no backend, verifique se ha impacto no frontend correspondente.
                  Mudancas na estrutura de dados SOAP ou nos parsers XML podem quebrar a UI.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-800">Migracao Concluida (24/01/2026)</h3>
                <p className="text-green-700 text-sm mt-1">
                  Todos os sistemas foram migrados para usar o cliente TJMS unificado em <code className="bg-green-100 px-1 rounded">services/tjms/</code>.
                  A configuracao de credenciais e URLs esta centralizada em um unico local.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: `1px solid ${C.gray200}` }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: C.text900 }}>
              <Network className="h-5 w-5" style={{ color: C.navy600 }} />
              Arquitetura Unificada de Integracao
            </h2>

            <div className="bg-slate-800 text-slate-200 rounded-lg p-4 overflow-x-auto font-mono text-[13px] leading-relaxed">
              <pre>{`CLIENTE UNIFICADO (services/tjms/):

services/tjms/
  __init__.py         --> Exports publicos (todos os modulos)
  config.py           --> TJMSConfig, get_config(), reload_config()
  models.py           --> ProcessoTJMS, DocumentoTJMS, Parte, Movimento, etc
  client.py           --> TJMSClient (async context manager principal)
  parsers.py          --> XMLParserTJMS para respostas SOAP
  adapters.py         --> Wrappers de compatibilidade (DocumentDownloader, etc)
  constants.py        --> TipoDocumentoTJMS, CodigoMovimento, helpers

TODOS OS SISTEMAS USAM services/tjms:
- Assistencia Judiciaria --> TJMSClient (async)
- Classificador Docs     --> TJMSClient via services_tjms.py
- Relatorio Cumprimento  --> DocumentDownloader adapter
- Prestacao de Contas    --> consultar_processo_async, baixar_documentos_async
- Pedido de Calculo      --> DocumentDownloader adapter
- Gerador de Pecas       --> get_config (configuracao centralizada)

PROXIES:
- Fly.io (SOAP): tjms-proxy.fly.dev
- Local (Playwright/Subconta): ngrok`}</pre>
            </div>
          </div>
      </ContentArea>
    </>
  )
}
