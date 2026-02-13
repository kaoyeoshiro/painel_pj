import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { C } from '@/lib/designTokens'
import { Loader2 } from 'lucide-react'
import type { UsePerformanceReturn } from '../hooks/usePerformance'

// ============================================================
// Dialog de CRUD para Route Map
// ============================================================

interface RouteMapDialogProps {
  vm: UsePerformanceReturn
}

export function RouteMapDialog({ vm }: RouteMapDialogProps) {
  return (
    <Dialog open={vm.mapDialogOpen} onOpenChange={vm.setMapDialogOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{vm.editingMap ? 'Editar Mapeamento' : 'Novo Mapeamento Rota → Sistema'}</DialogTitle>
          <DialogDescription>
            {vm.editingMap ? 'Edite os campos do mapeamento' : 'Defina o padrao de rota e o sistema associado'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Padrao da Rota</label>
            <Input value={vm.mapForm.route_pattern} onChange={e => vm.setMapForm(f => ({ ...f, route_pattern: e.target.value }))} placeholder="/api/gerador-pecas/" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Nome do Sistema</label>
            <Input value={vm.mapForm.system_name} onChange={e => vm.setMapForm(f => ({ ...f, system_name: e.target.value }))} placeholder="Gerador de Pecas" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Tipo de Match</label>
              <Select value={vm.mapForm.match_type} onValueChange={v => vm.setMapForm(f => ({ ...f, match_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exato</SelectItem>
                  <SelectItem value="prefix">Prefixo</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Prioridade</label>
              <Input type="number" value={vm.mapForm.priority} onChange={e => vm.setMapForm(f => ({ ...f, priority: Number(e.target.value) || 0 }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => vm.setMapDialogOpen(false)} variant="outline">Cancelar</Button>
          <Button onClick={() => void vm.saveMap()} disabled={vm.savingMap || !vm.mapForm.route_pattern.trim() || !vm.mapForm.system_name.trim()} style={{ background: C.navy950, color: 'white' }}>
            {vm.savingMap ? <Loader2 className="h-4 w-4 animate-spin" /> : vm.editingMap ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
