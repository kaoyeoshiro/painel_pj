/**
 * Aba "Prompts" do Classificador de Documentos.
 *
 * Permite criar, editar e excluir prompts de classificacao.
 */

import { useState, useCallback } from 'react'
import { classificadorApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Prompt, PromptPayload } from '@/types/classificador'
import { formatDate } from '../types'

// ============================================================================
// Props
// ============================================================================

interface PromptsTabProps {
  prompts: Prompt[]
  promptsLoading: boolean
  onPromptsChange: () => void
}

// ============================================================================
// Componente
// ============================================================================

export function PromptsTab({ prompts, promptsLoading, onPromptsChange }: PromptsTabProps) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formConteudo, setFormConteudo] = useState('')
  const [formCodigos, setFormCodigos] = useState('')
  const [saving, setSaving] = useState(false)

  const openNew = useCallback(() => {
    setEditingPrompt(null)
    setFormNome('')
    setFormDescricao('')
    setFormConteudo('')
    setFormCodigos('')
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormNome(prompt.nome)
    setFormDescricao(prompt.descricao ?? '')
    setFormConteudo(prompt.conteudo)
    setFormCodigos(prompt.codigos_documento ?? '')
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!formNome.trim() || !formConteudo.trim()) {
      toast({ title: 'Erro', description: 'Nome e conteudo sao obrigatorios', variant: 'destructive' })
      return
    }

    setSaving(true)
    const payload: PromptPayload = {
      nome: formNome.trim(),
      descricao: formDescricao.trim() || undefined,
      conteudo: formConteudo,
      codigos_documento: formCodigos.trim() || undefined,
    }

    try {
      if (editingPrompt) {
        await classificadorApi.put(`/prompts/${editingPrompt.id}`, payload)
        toast({ title: 'Prompt atualizado' })
      } else {
        await classificadorApi.post('/prompts', payload)
        toast({ title: 'Prompt criado' })
      }
      setDialogOpen(false)
      onPromptsChange()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [formNome, formDescricao, formConteudo, formCodigos, editingPrompt, toast, onPromptsChange])

  const handleDelete = useCallback(async (promptId: number) => {
    try {
      await classificadorApi.delete(`/prompts/${promptId}`)
      toast({ title: 'Prompt excluido' })
      onPromptsChange()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [toast, onPromptsChange])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Prompts de Classificacao</h3>
        <Button onClick={openNew}>Novo Prompt</Button>
      </div>

      {promptsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum prompt cadastrado. Crie um novo prompt para comecar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map(p => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{p.nome}</CardTitle>
                  <Badge variant={p.ativo ? 'default' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                {p.descricao && <CardDescription>{p.descricao}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Criado em {formatDate(p.criado_em)}</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>Excluir</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Prompt form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? 'Editar Prompt' : 'Novo Prompt'}</DialogTitle>
            <DialogDescription>
              {editingPrompt ? 'Altere os campos do prompt' : 'Preencha os campos para criar um novo prompt de classificacao'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-nome">Nome</Label>
              <Input
                id="prompt-nome"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Nome do prompt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-descricao">Descricao</Label>
              <Input
                id="prompt-descricao"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descricao (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-conteudo">Conteudo</Label>
              <Textarea
                id="prompt-conteudo"
                value={formConteudo}
                onChange={(e) => setFormConteudo(e.target.value)}
                placeholder="Conteudo do prompt de classificacao..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-codigos">Codigos de tipos de documento (opcional)</Label>
              <Input
                id="prompt-codigos"
                value={formCodigos}
                onChange={(e) => setFormCodigos(e.target.value)}
                placeholder="Ex: 001,002,003"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
