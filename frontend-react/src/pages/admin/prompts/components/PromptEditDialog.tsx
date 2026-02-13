import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { C } from '@/lib/designTokens'
import type { Prompt } from '../types'

interface PromptEditDialogProps {
  prompt: Prompt | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPromptChange: (prompt: Prompt) => void
  onSave: () => void
  isSaving: boolean
}

/**
 * Dialog de edição de prompt, extraído do PromptsPage original.
 */
export function PromptEditDialog({
  prompt,
  open,
  onOpenChange,
  onPromptChange,
  onSave,
  isSaving,
}: PromptEditDialogProps) {
  if (!prompt) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Prompt</DialogTitle>
          <DialogDescription>Altere as informações do prompt. As mudanças serão aplicadas imediatamente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-nome">Nome</Label>
            <Input
              id="edit-nome"
              value={prompt.nome}
              onChange={(e) => onPromptChange({ ...prompt, nome: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-descricao">Descrição</Label>
            <Input
              id="edit-descricao"
              value={prompt.descricao || ''}
              onChange={(e) => onPromptChange({ ...prompt, descricao: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-conteudo">Conteúdo</Label>
            <Textarea
              id="edit-conteudo"
              value={prompt.conteudo}
              onChange={(e) => onPromptChange({ ...prompt, conteudo: e.target.value })}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-ativo"
              checked={prompt.is_active}
              onChange={(e) => onPromptChange({ ...prompt, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="edit-ativo">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={onSave} disabled={isSaving} style={{ background: C.navy950, color: 'white' }}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
