import { useState } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { AlertTriangle, RotateCcw, Wand2 } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'

const JSON_BACKUP = {
  nome_assistido: {
    slug: 'nome_assistido',
    tipo: 'texto',
    obrigatorio: true,
    placeholder: 'Nome completo do assistido',
  },
  cpf_assistido: {
    slug: 'cpf_assistido',
    tipo: 'texto',
    obrigatorio: true,
    placeholder: 'CPF do assistido',
  },
  numero_processo: {
    slug: 'numero_processo',
    tipo: 'texto',
    obrigatorio: false,
    placeholder: 'Número do processo (opcional)',
  },
}

interface RestaurarSlugsResponse {
  success: boolean
  variaveis_atualizadas: number
  variaveis_removidas: number
  perguntas_sincronizadas: number
  erro?: string
}

export function RestaurarSlugsPage() {
  const [categoriaId, setCategoriaId] = useState<number>(5)
  const [isLoading, setIsLoading] = useState(false)
  const [resultado, setResultado] = useState<RestaurarSlugsResponse | null>(null)
  const { toast } = useToast()

  const handleRestaurar = async () => {
    setIsLoading(true)
    setResultado(null)

    try {
      const response = await adminApi.post<RestaurarSlugsResponse>(
        '/admin/api/extraction/restaurar-slugs',
        {
          categoria_id: categoriaId,
          json_backup: JSON_BACKUP,
        },
      )

      setResultado(response)

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: `Slugs restaurados: ${response.variaveis_atualizadas} atualizadas, ${response.variaveis_removidas} removidas`,
        })
      } else {
        toast({
          title: 'Erro',
          description: response.erro || 'Falha ao restaurar slugs',
          variant: 'destructive',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
      setResultado({
        success: false,
        variaveis_atualizadas: 0,
        variaveis_removidas: 0,
        perguntas_sincronizadas: 0,
        erro: message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <BreadcrumbBar
        title="Restaurar Slugs"
        icon={<RotateCcw style={{ width: 14, height: 14 }} />}
      />

      <ContentArea>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: `1px solid ${C.gray200}` }}>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <span>
                  <strong>Atenção:</strong> Esta ferramenta restaura os slugs das variáveis da categoria "Pareceres"
                  para os valores originais do JSON de backup.
                </span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: C.text700 }}>Categoria ID:</label>
              <input
                type="number"
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
                className="w-32 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                style={{ border: `1px solid ${C.gray300}` }}
              />
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={handleRestaurar}
                disabled={isLoading}
                className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ background: C.navy950, color: 'white' }}
              >
                <Wand2 className="h-4 w-4" />
                {isLoading ? 'Processando...' : 'Restaurar Slugs'}
              </button>
            </div>

            {resultado && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2" style={{ color: C.text700 }}>Resultado:</h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                  {JSON.stringify(resultado, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </ContentArea>
    </>
  )
}
