import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'

/**
 * Página de preview do Design System
 * Mostra todos os componentes shadcn/ui com o tema PGE
 */
export function DesignSystemPage() {
  const { toast } = useToast()
  const [inputValue, setInputValue] = useState('')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Design System</h1>
        <p className="mt-2 text-gray-600">
          Componentes shadcn/ui com tema PGE-MS
        </p>
      </div>

      {/* Botões */}
      <Card>
        <CardHeader>
          <CardTitle>Botões</CardTitle>
          <CardDescription>Todas as variantes de Button</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled>Disabled</Button>
            <Button>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Cards</CardTitle>
          <CardDescription>Exemplos de Card component</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card Simples</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Conteúdo do card sem descrição
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Card com Descrição</CardTitle>
                <CardDescription>
                  Uma breve descrição do conteúdo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Conteúdo do card</p>
              </CardContent>
            </Card>
            <Card className="border-primary-200">
              <CardHeader>
                <CardTitle>Card com Borda</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Card com borda customizada
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Inputs e Labels</CardTitle>
          <CardDescription>Campos de formulário</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="input-1">Input Normal</Label>
            <Input
              id="input-1"
              type="text"
              placeholder="Digite algo..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="input-2">Input Disabled</Label>
            <Input
              id="input-2"
              type="text"
              placeholder="Desabilitado"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="input-3">Input Password</Label>
            <Input
              id="input-3"
              type="password"
              placeholder="Digite sua senha"
            />
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Tags e marcadores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="bg-green-500">Success</Badge>
            <Badge className="bg-amber-500">Warning</Badge>
            <Badge className="bg-blue-500">Info</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
          <CardDescription>Navegação por abas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="mt-4">
              <p className="text-sm text-gray-600">Conteúdo da Tab 1</p>
            </TabsContent>
            <TabsContent value="tab2" className="mt-4">
              <p className="text-sm text-gray-600">Conteúdo da Tab 2</p>
            </TabsContent>
            <TabsContent value="tab3" className="mt-4">
              <p className="text-sm text-gray-600">Conteúdo da Tab 3</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>Mensagens de feedback</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              Esta é uma mensagem informativa
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao processar sua solicitação
            </AlertDescription>
          </Alert>
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">Sucesso</AlertTitle>
            <AlertDescription className="text-green-800">
              Operação realizada com sucesso
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>Tabela de dados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1</TableCell>
                <TableCell>Item 1</TableCell>
                <TableCell>
                  <Badge className="bg-green-500">Ativo</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost">
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2</TableCell>
                <TableCell>Item 2</TableCell>
                <TableCell>
                  <Badge variant="secondary">Inativo</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost">
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>3</TableCell>
                <TableCell>Item 3</TableCell>
                <TableCell>
                  <Badge className="bg-amber-500">Pendente</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost">
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog</CardTitle>
          <CardDescription>Modal de diálogo</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Abrir Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Título do Dialog</DialogTitle>
                <DialogDescription>
                  Esta é uma descrição do conteúdo do dialog.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-gray-600">
                  Conteúdo do dialog vai aqui...
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Cancelar</Button>
                  <Button>Confirmar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Toast */}
      <Card>
        <CardHeader>
          <CardTitle>Toast</CardTitle>
          <CardDescription>Notificações temporárias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={() => {
              toast({
                title: 'Toast de sucesso',
                description: 'Operação realizada com sucesso!',
              })
            }}
          >
            Mostrar Toast Default
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              toast({
                variant: 'destructive',
                title: 'Erro!',
                description: 'Algo deu errado.',
              })
            }}
          >
            Mostrar Toast de Erro
          </Button>
        </CardContent>
      </Card>

      {/* Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Skeleton</CardTitle>
          <CardDescription>Loading states</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-12 w-1/2" />
        </CardContent>
      </Card>
    </div>
  )
}
