/**
 * Zona de drag-and-drop para upload de arquivos.
 *
 * Suporta modo singular ou multiplo, com lista de arquivos selecionados.
 */

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatFileSize } from '../types'

// ============================================================================
// Props
// ============================================================================

export interface FileDropZoneProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  multiple?: boolean
  accept?: string
}

// ============================================================================
// Componente
// ============================================================================

export function FileDropZone({ files, onFilesChange, multiple = true, accept = '.pdf,.txt,.zip' }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (!multiple && droppedFiles.length > 1) {
      onFilesChange([droppedFiles[0]])
    } else {
      onFilesChange(multiple ? [...files, ...droppedFiles] : droppedFiles.slice(0, 1))
    }
  }, [files, multiple, onFilesChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!multiple && selected.length > 1) {
      onFilesChange([selected[0]])
    } else {
      onFilesChange(multiple ? [...files, ...selected] : selected.slice(0, 1))
    }
    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = ''
  }, [files, multiple, onFilesChange])

  const removeFile = useCallback((index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }, [files, onFilesChange])

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          data-testid="file-input"
        />
        <p className="text-sm text-muted-foreground">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Formatos aceitos: PDF, TXT, ZIP (max. 50MB cada)
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">{files.length} arquivo(s) selecionado(s)</p>
          <ScrollArea className="max-h-40">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center justify-between py-1 px-2 text-sm rounded hover:bg-muted/50">
                <span className="truncate mr-2">{file.name} ({formatFileSize(file.size)})</span>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeFile(idx) }}>
                  Remover
                </Button>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
