/**
 * Secao de preview de documentos do Extrator de Autos.
 *
 * Tabela com checkbox para selecionar quais documentos baixar,
 * incluindo badges de resolucao especial (1o doc, codigo direto, BERT).
 */

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { C } from '@/lib/designTokens'
import type { PreviewDocumento } from '@/types/extrator-autos'
import { formatarData } from '../types'
import type { UseExtratorAutosReturn } from '../hooks/useExtratorAutos'

// ============================================================================
// Badge de resolucao especial
// ============================================================================

function ResolucaoBadge({ doc }: { doc: PreviewDocumento }) {
  if (!doc.resolucao_especial) return null
  const { metodo } = doc.resolucao_especial
  if (metodo === 'primeiro_cronologico') {
    return (
      <Badge style={{ background: C.navy100, color: C.navy700, border: 'none' }}>
        1o Doc
      </Badge>
    )
  }
  if (metodo === 'codigo') {
    return (
      <Badge style={{ background: C.successBgStrong, color: C.statusSuccess, border: 'none' }}>
        codigo direto
      </Badge>
    )
  }
  if (metodo === 'bert') {
    const status = doc.resolucao_especial.bert_status ?? 'Candidato'
    return (
      <Badge style={{ background: C.warningBg, color: C.warningText, border: 'none' }}>
        BERT: {status}
      </Badge>
    )
  }
  return null
}

// ============================================================================
// Props
// ============================================================================

interface PreviewSectionProps {
  h: UseExtratorAutosReturn
}

// ============================================================================
// Componente
// ============================================================================

export function PreviewSection({ h }: PreviewSectionProps) {
  const contadores = h.previewContadores()

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <div className="p-6">
        <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
          Preview de Documentos
        </h3>
        <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
          {contadores.selecionados} selecionados de {contadores.total} encontrados
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: C.gray200 }}>
          <Table>
            <TableHeader>
              <TableRow style={{ background: C.navy100 }}>
                <TableHead className="w-[50px]" style={{ color: C.text700 }}>
                  <input
                    type="checkbox"
                    checked={h.previewDocs.length > 0 && h.previewDocs.every((d) => d.selecionado)}
                    onChange={h.toggleTodosPreview}
                    className="h-4 w-4 rounded"
                    style={{ borderColor: C.gray300 }}
                  />
                </TableHead>
                <TableHead style={{ color: C.text700 }}>Codigo</TableHead>
                <TableHead style={{ color: C.text700 }}>Tipo</TableHead>
                <TableHead style={{ color: C.text700 }}>Descricao</TableHead>
                <TableHead style={{ color: C.text700 }}>Data</TableHead>
                <TableHead style={{ color: C.text700 }}>Resolucao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {h.previewDocs.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-gray-50">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={doc.selecionado}
                      onChange={() => h.toggleDocPreview(doc.id)}
                      className="h-4 w-4 rounded"
                      style={{ borderColor: C.gray300 }}
                    />
                  </TableCell>
                  <TableCell className="font-mono" style={{ fontSize: 12, color: C.text700 }}>
                    {doc.tipo_codigo}
                  </TableCell>
                  <TableCell style={{ fontSize: 14, color: C.text700 }}>{doc.tipo_descricao}</TableCell>
                  <TableCell className="max-w-[200px] truncate" style={{ fontSize: 14, color: C.text700 }}>
                    {doc.descricao}
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: C.text500 }}>
                    {formatarData(doc.data_juntada)}
                  </TableCell>
                  <TableCell><ResolucaoBadge doc={doc} /></TableCell>
                </TableRow>
              ))}
              {h.previewDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center" style={{ color: C.text400 }}>
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
