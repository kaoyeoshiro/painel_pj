import { useState } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { AlertTriangle, Wand2 } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout'

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
    <PageContainer>
      <PageHeader
        title="Restaurar Slugs"
        description="Utilitario de restauracao de slugs de variaveis"
      />

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">

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
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria ID:</label>
            <input
              type="number"
              value={categoriaId}
              onChange={(e) => setCategoriaId(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={handleRestaurar}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {isLoading ? 'Processando...' : 'Restaurar Slugs'}
            </button>
          </div>

          {resultado && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Resultado:</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
