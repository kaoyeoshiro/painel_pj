import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/toast'
import { adminApi } from '@/lib/api'
import { PageContainer } from '@/components/layout'

// Backup simplificado de exemplo - em produção seria carregado de configuração
const JSON_BACKUP = {
  "nome_assistido": {
    "slug": "nome_assistido",
    "tipo": "texto",
    "obrigatorio": true,
    "placeholder": "Nome completo do assistido"
  },
  "cpf_assistido": {
    "slug": "cpf_assistido",
    "tipo": "texto",
    "obrigatorio": true,
    "placeholder": "CPF do assistido"
  },
  "numero_processo": {
    "slug": "numero_processo",
    "tipo": "texto",
    "obrigatorio": false,
    "placeholder": "Número do processo (opcional)"
  }
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
          json_backup: JSON_BACKUP
        }
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
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      toast({
        title: 'Erro',
        description: `Falha na requisição: ${errorMessage}`,
        variant: 'destructive',
      })
      setResultado({
        success: false,
        variaveis_atualizadas: 0,
        variaveis_removidas: 0,
        perguntas_sincronizadas: 0,
        erro: errorMessage
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageContainer className="max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Restaurar Slugs</CardTitle>
          <CardDescription>
            Ferramenta de recuperação para restaurar slugs de variáveis a partir de backup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              ⚠️ Esta é uma ferramenta de recuperação. Use apenas se houver perda de dados
              ou inconsistências nos slugs das variáveis. A operação irá sobrescrever
              os slugs existentes com os valores do backup.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="categoria-id">ID da Categoria</Label>
            <Input
              id="categoria-id"
              type="number"
              value={categoriaId}
              onChange={(e) => setCategoriaId(Number(e.target.value))}
              min={1}
              placeholder="ID da categoria"
            />
          </div>

          <Button
            onClick={handleRestaurar}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Restaurando...' : 'Restaurar Slugs'}
          </Button>

          {resultado && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Resultado:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
