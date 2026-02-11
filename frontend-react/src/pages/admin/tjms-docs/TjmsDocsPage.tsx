import { Link } from '@tanstack/react-router'
import { ExternalLink, AlertTriangle, CheckCircle, Network } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout'

export function TjmsDocsPage() {
  return (
    <PageContainer wide>
      <PageHeader
        title="Documentacao Integracao TJ-MS"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Atualizado: 24/01/2026</span>
            <Link to="/admin/tjms-docs/plano" className="text-primary-600 hover:underline text-sm flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver Plano Completo
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Network className="h-5 w-5 text-primary-600" />
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
      </div>
    </PageContainer>
  )
}
