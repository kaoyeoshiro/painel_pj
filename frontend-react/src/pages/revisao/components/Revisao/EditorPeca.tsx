/**
 * Editor rico de peças jurídicas baseado em TipTap.
 * Inclui toolbar de formatação e auto-save com debounce de 2 segundos.
 */

import { useRef, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { marked } from 'marked'
import { sanitizeHtml } from '@/hooks/useMarkdown'
import { C } from '@/lib/designTokens'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface EditorPecaProps {
  /** Conteúdo inicial em HTML ou markdown */
  conteudo: string
  /** Chamado a cada alteração (atualização imediata do estado do pai) */
  onContentChange: (html: string) => void
  /** Chamado após 2s de inatividade para salvar via API */
  onAutoSave: (html: string) => void
  /** Desabilita edição para itens aprovados/concluídos */
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Botão da toolbar
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}

function ToolbarButton({ onClick, isActive = false, title, children, disabled = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-sm border transition-colors ${
        isActive
          ? 'bg-blue-100 border-blue-300 text-blue-700'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Separador da toolbar
// ---------------------------------------------------------------------------

function ToolbarSeparator() {
  return <span className="w-px self-stretch mx-1" style={{ background: C.gray200 }} />
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Editor TipTap para peças jurídicas com toolbar e auto-save.
 *
 * @param conteudo - HTML inicial da peça
 * @param onContentChange - callback imediato a cada tecla
 * @param onAutoSave - callback debounced (2s) para persistência
 * @param readOnly - bloqueia edição quando true
 */
export function EditorPeca({ conteudo, onContentChange, onAutoSave, readOnly = false }: EditorPecaProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Converte markdown→HTML na inicializacao (TipTap espera HTML, nao markdown)
  const conteudoHtml = useMemo(() => {
    if (!conteudo) return ''
    // Detecta se ja e HTML (comeca com tag)
    if (conteudo.trimStart().startsWith('<')) return conteudo
    // Converte markdown para HTML sanitizado
    const rawHtml = marked.parse(conteudo, { async: false }) as string
    return sanitizeHtml(rawHtml)
  }, [conteudo])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Conteúdo da peça...' }),
    ],
    content: conteudoHtml,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      onContentChange(html)

      // Debounce do auto-save: cancela timer anterior e agenda novo
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        onAutoSave(html)
      }, 2000)
    },
  })

  if (!editor) return null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: FONT_DOC }}>
      {/* ------------------------------------------------------------------ */}
      {/* Toolbar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex flex-wrap items-center gap-1 px-3 py-2 flex-shrink-0 border-b rounded-t-lg"
        style={{
          background: C.gray50,
          borderColor: C.gray200,
        }}
      >
        {/* Formatação inline */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrito (Ctrl+B)"
          disabled={readOnly}
        >
          <strong>N</strong>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Itálico (Ctrl+I)"
          disabled={readOnly}
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Tachado"
          disabled={readOnly}
        >
          <s>S</s>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Títulos */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Título 1"
          disabled={readOnly}
        >
          H1
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Título 2"
          disabled={readOnly}
        >
          H2
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Bloco de citação */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Citação"
          disabled={readOnly}
        >
          "
        </ToolbarButton>

        {/* Listas */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista com marcadores"
          disabled={readOnly}
        >
          •
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerada"
          disabled={readOnly}
        >
          1.
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Histórico */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="Desfazer (Ctrl+Z)"
          disabled={readOnly || !editor.can().undo()}
        >
          ↩
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="Refazer (Ctrl+Y)"
          disabled={readOnly || !editor.can().redo()}
        >
          ↪
        </ToolbarButton>

        {/* Indicador de modo leitura */}
        {readOnly && (
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ color: C.text400, background: C.gray100 }}
          >
            Somente leitura
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Área do editor                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex-1 overflow-y-auto rounded-b-lg border-x border-b"
        style={{ borderColor: C.gray200, background: '#fff' }}
      >
        <EditorContent
          editor={editor}
          className="h-full custom-scroll"
        />
      </div>

      {/* Estilos do TipTap — reutiliza prose-legal do gerador de pecas */}
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: ${C.text400};
          pointer-events: none;
          height: 0;
        }
        .tiptap {
          outline: none;
          min-height: 100%;
          padding: 2.5rem 2.5rem 4rem;
          font-family: 'Lora', 'Georgia', serif;
          font-size: 1rem;
          line-height: 2;
          color: #475569;
          text-align: justify;
        }
        .tiptap h1, .tiptap h2, .tiptap h3, .tiptap h4 {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #1e293b;
          text-align: left;
        }
        .tiptap h2 {
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin-top: 2.5em;
          margin-bottom: 1em;
          padding-bottom: 0.6em;
          border-bottom: 1px solid #e2e8f0;
        }
        .tiptap h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1.75em;
          margin-bottom: 0.75em;
        }
        .tiptap p {
          margin-top: 0.75em;
          margin-bottom: 0.75em;
        }
        .tiptap strong {
          font-weight: 600;
          color: #1e293b;
        }
        .tiptap ul, .tiptap ol {
          padding-left: 1.5em;
          margin-top: 0.75em;
          margin-bottom: 0.75em;
        }
        .tiptap blockquote {
          border-left: 3px solid #0ea5e9;
          padding: 0.75em 1.25em;
          margin: 1.25em 0;
          background: #f8fafc;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .tiptap em {
          font-style: italic;
        }
        .tiptap s {
          text-decoration: line-through;
          color: ${C.text400};
        }
      `}</style>
    </div>
  )
}
