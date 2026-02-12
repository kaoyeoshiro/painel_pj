/**
 * Aba "Teste Rapido" do Classificador de Documentos.
 *
 * Permite classificar um unico arquivo PDF de forma avulsa,
 * exibindo o resultado (categoria, subcategoria, confianca, justificativa).
 */

import { useState, useCallback } from 'react'
import { classificadorApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Prompt, ClassificacaoAvulsa } from '@/types/classificador'
import { confiancaBadgeVariant } from '../types'
import { FileDropZone } from './FileDropZone'

// ============================================================================
// Props
// ============================================================================

interface TesteRapidoTabProps {
  prompts: Prompt[]
  promptsLoading: boolean
}

// ============================================================================
// Componente
// ============================================================================

export function TesteRapidoTab({ prompts, promptsLoading }: TesteRapidoTabProps) {
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [promptId, setPromptId] = useState<string>('')
  const [modelo, setModelo] = useState('google/gemini-2.5-flash-lite')
  const [modoProcessamento, setModoProcessamento] = useState<'chunk' | 'completo'>('chunk')
  const [posicaoChunk, setPosicaoChunk] = useState<'inicio' | 'fim'>('inicio')
  const [tamanhoChunk, setTamanhoChunk] = useState(1000)
  const [classificando, setClassificando] = useState(false)
  const [resultado, setResultado] = useState<ClassificacaoAvulsa | null>(null)

  const handleClassificar = useCallback(async () => {
    if (files.length === 0) return

    setClassificando(true)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('arquivo', files[0])
      if (promptId) formData.append('prompt_id', promptId)
      formData.append('modelo', modelo)
      formData.append('modo_processamento', modoProcessamento)
      formData.append('posicao_chunk', posicaoChunk)
      formData.append('tamanho_chunk', String(tamanhoChunk))

      const result = await classificadorApi.post<ClassificacaoAvulsa>('/classificar-avulso', formData)
      setResultado(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao classificar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
      setResultado({ sucesso: false, erro: msg })
    } finally {
      setClassificando(false)
    }
  }, [files, promptId, modelo, modoProcessamento, posicaoChunk, tamanhoChunk, toast])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Coluna esquerda - entrada */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Arquivo</CardTitle>
            <CardDescription>Envie um unico PDF para classificacao rapida</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropZone
              files={files}
              onFilesChange={setFiles}
              multiple={false}
              accept=".pdf"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuracao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prompt</Label>
              {promptsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={promptId} onValueChange={setPromptId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um prompt (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts.filter(p => p.ativo).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="teste-modelo">Modelo</Label>
              <Input
                id="teste-modelo"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Modo</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="teste-modo"
                    value="chunk"
                    checked={modoProcessamento === 'chunk'}
                    onChange={() => setModoProcessamento('chunk')}
                  />
                  <span className="text-sm">Chunk</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="teste-modo"
                    value="completo"
                    checked={modoProcessamento === 'completo'}
                    onChange={() => setModoProcessamento('completo')}
                  />
                  <span className="text-sm">Completo</span>
                </label>
              </div>
            </div>

            {modoProcessamento === 'chunk' && (
              <>
                <div className="space-y-2">
                  <Label>Posicao</Label>
                  <Select value={posicaoChunk} onValueChange={(v) => setPosicaoChunk(v as 'inicio' | 'fim')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inicio">Inicio</SelectItem>
                      <SelectItem value="fim">Fim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tamanho do Chunk ({tamanhoChunk})</Label>
                  <input
                    type="range"
                    min={100}
                    max={4000}
                    step={100}
                    value={tamanhoChunk}
                    onChange={(e) => setTamanhoChunk(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleClassificar}
              disabled={files.length === 0 || classificando}
            >
              {classificando ? 'Classificando...' : 'Classificar'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Coluna direita - resultado */}
      <div>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg">Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {classificando ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : resultado ? (
              resultado.sucesso ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Categoria</Label>
                    <p className="text-lg font-medium">{resultado.categoria}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Subcategoria</Label>
                    <p className="text-lg font-medium">{resultado.subcategoria}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Confianca</Label>
                    <div>
                      <Badge variant={confiancaBadgeVariant(resultado.confianca ?? 'baixa')}>
                        {resultado.confianca}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Justificativa</Label>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {resultado.justificativa}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Erro na classificacao</AlertTitle>
                  <AlertDescription>{resultado.erro}</AlertDescription>
                </Alert>
              )
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Envie um arquivo e clique em "Classificar" para ver o resultado
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
