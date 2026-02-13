/**
 * Secao de selecao de documentos do Extrator de Autos.
 *
 * Exibe informacoes do processo/lote consultado e permite selecionar
 * documentos por categorias, codigos manuais ou modo hibrido.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { C } from '@/lib/designTokens'
import type { ModoSelecao } from '@/types/extrator-autos'
import type { UseExtratorAutosReturn } from '../hooks/useExtratorAutos'

// ============================================================================
// Props
// ============================================================================

interface SelectionSectionProps {
  h: UseExtratorAutosReturn
}

// ============================================================================
// Componente
// ============================================================================

export function SelectionSection({ h }: SelectionSectionProps) {
  return (
    <>
      {/* Info do processo (modo individual) */}
      {h.processoInfo && !h.modoLote && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Classe Processual</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                {h.processoInfo.classe_processual || '-'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Comarca</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                {h.processoInfo.comarca || '-'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Vara</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                {h.processoInfo.vara || '-'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Total de Documentos</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                {h.processoInfo.total_documentos}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resumo lote */}
      {h.modoLote && h.loteResultados && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
          <div className="grid grid-cols-3 gap-4 p-5">
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Total Processos</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                {h.loteResultados.total_processos}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Consultados</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                {h.loteResultados.consultados}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.text400 }}>Com Erro</span>
              <p className="font-medium" style={{ fontSize: 14, color: C.statusError }}>
                {h.loteResultados.com_erro}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs de selecao */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
        <div className="p-6">
          <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
            Selecao de Documentos
          </h3>
          <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
            Escolha as categorias ou codigos dos documentos que deseja extrair
          </p>

          <div className="mt-5">
            <Tabs
              value={h.modoSelecao}
              onValueChange={(v) => h.setModoSelecao(v as ModoSelecao)}
            >
              <TabsList className="rounded-lg p-1" style={{ background: C.gray100 }}>
                <TabsTrigger
                  value="categoria"
                  className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  style={{ color: h.modoSelecao === 'categoria' ? C.navy700 : C.text500 }}
                >
                  Categorias
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  style={{ color: h.modoSelecao === 'manual' ? C.navy700 : C.text500 }}
                >
                  Manual
                </TabsTrigger>
                <TabsTrigger
                  value="hibrido"
                  className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  style={{ color: h.modoSelecao === 'hibrido' ? C.navy700 : C.text500 }}
                >
                  Hibrido
                </TabsTrigger>
              </TabsList>

              {/* Tab Categorias */}
              <TabsContent value="categoria" className="mt-4">
                {h.categorias.length === 0 ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {h.categorias.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => h.toggleCategoria(cat.id)}
                        className="rounded-xl border-2 p-3 text-left transition-colors"
                        style={{
                          borderColor: h.categoriasSelec.has(cat.id) ? C.navy500 : C.gray200,
                          background: h.categoriasSelec.has(cat.id) ? C.navy50 : 'white',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                            {cat.nome}
                          </span>
                          {h.categoriasSelec.has(cat.id) && (
                            <Badge style={{ background: C.navy950, color: 'white', border: 'none', fontSize: 11 }}>
                              Selecionada
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1" style={{ fontSize: 12, color: C.text500 }}>{cat.descricao}</p>
                        <p className="mt-1" style={{ fontSize: 12, color: C.text400 }}>
                          {cat.codigos.length} codigo(s)
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab Manual */}
              <TabsContent value="manual" className="mt-4 space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={h.codigoInput}
                    onChange={(e) => h.setCodigoInput(e.target.value)}
                    placeholder="Codigo do tipo (ex: 60)"
                    className="w-48"
                    style={{ borderColor: C.gray200 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') h.adicionarCodigoManual()
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={h.adicionarCodigoManual}
                    style={{ borderColor: C.gray200, color: C.text500 }}
                  >
                    Adicionar
                  </Button>
                </div>
                {h.codigosManuais.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {h.codigosManuais.map((cod) => (
                      <Badge
                        key={cod}
                        className="cursor-pointer gap-1"
                        onClick={() => h.removerCodigoManual(cod)}
                        style={{ background: C.gray100, color: C.text700, border: 'none' }}
                      >
                        {cod} x
                      </Badge>
                    ))}
                  </div>
                )}
                {h.codigosManuais.length === 0 && (
                  <p style={{ fontSize: 14, color: C.text400 }}>
                    Nenhum codigo adicionado. Digite o codigo do tipo de documento acima.
                  </p>
                )}
              </TabsContent>

              {/* Tab Hibrido */}
              <TabsContent value="hibrido" className="mt-4 space-y-4">
                {/* Categorias como chips */}
                <div>
                  <Label className="mb-2 block text-sm" style={{ color: C.text700 }}>Categorias</Label>
                  <div className="flex flex-wrap gap-2">
                    {h.categorias.map((cat) => (
                      <Badge
                        key={cat.id}
                        className="cursor-pointer"
                        onClick={() => h.toggleCategoria(cat.id)}
                        style={h.categoriasSelec.has(cat.id)
                          ? { background: C.navy950, color: 'white', border: 'none' }
                          : { background: 'transparent', color: C.text500, border: `1px solid ${C.gray200}` }
                        }
                      >
                        {cat.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator style={{ background: C.gray200 }} />
                {/* Codigos manuais */}
                <div>
                  <Label className="mb-2 block text-sm" style={{ color: C.text700 }}>
                    Codigos adicionais
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={h.codigoInput}
                      onChange={(e) => h.setCodigoInput(e.target.value)}
                      placeholder="Codigo (ex: 60)"
                      className="w-48"
                      style={{ borderColor: C.gray200 }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') h.adicionarCodigoManual()
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={h.adicionarCodigoManual}
                      style={{ borderColor: C.gray200, color: C.text500 }}
                    >
                      Adicionar
                    </Button>
                  </div>
                  {h.codigosManuais.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {h.codigosManuais.map((cod) => (
                        <Badge
                          key={cod}
                          className="cursor-pointer gap-1"
                          onClick={() => h.removerCodigoManual(cod)}
                          style={{ background: C.gray100, color: C.text700, border: 'none' }}
                        >
                          {cod} x
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Separator className="my-4" style={{ background: C.gray200 }} />

            <div className="flex justify-end">
              {!h.modoLote ? (
                <Button
                  onClick={h.visualizarDocumentos}
                  style={{ background: C.navy950, color: 'white' }}
                >
                  Visualizar Documentos
                </Button>
              ) : (
                <Button
                  onClick={h.avancarLoteParaPreview}
                  style={{ background: C.navy950, color: 'white' }}
                >
                  Resumo do Lote
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
