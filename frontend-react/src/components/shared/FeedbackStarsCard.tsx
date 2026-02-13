import { useState } from 'react'
import { Star, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface FeedbackStarsCardProps {
  onSubmit: (data: { nota: number; comentario: string | null }) => void
  isSubmitting: boolean
  isSubmitted: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Componente auxiliar: seletor de estrelas acessivel
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  const [hovered, setHovered] = useState(0)

  return (
    <div
      role="radiogroup"
      aria-label="Nota de 1 a 5 estrelas"
      className="flex items-center justify-center gap-1.5"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
            disabled={disabled}
            className={cn(
              'rounded-full p-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
              !disabled && 'hover:scale-110',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-gray-300/70',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card de avaliacao com estrelas (1-5) + comentario opcional/obrigatorio.
 *
 * - Nota >= 4: comentario opcional
 * - Nota <= 3: comentario obrigatorio (borda vermelha quando vazio)
 * - Botao desabilitado ate que os campos obrigatorios sejam preenchidos
 * - Exibe estado de sucesso apos envio
 */
export function FeedbackStarsCard({
  onSubmit,
  isSubmitting,
  isSubmitted,
  className,
}: FeedbackStarsCardProps) {
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState('')

  // Comentario e obrigatorio para notas baixas (1-3)
  const comentarioObrigatorio = nota >= 1 && nota <= 3
  const comentarioValido = !comentarioObrigatorio || comentario.trim().length > 0
  const formularioValido = nota >= 1 && comentarioValido

  function handleSubmit() {
    if (!formularioValido || isSubmitting) return
    onSubmit({
      nota,
      comentario: comentario.trim() || null,
    })
  }

  // ------ Estado de sucesso ------
  if (isSubmitted) {
    return (
      <div
        className={cn(
          'mx-auto max-w-sm rounded-lg border border-green-200 bg-green-50/40 px-4 py-3 text-center',
          className,
        )}
      >
        <div className="flex items-center justify-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Avaliacao enviada com sucesso!
          </span>
        </div>
      </div>
    )
  }

  // ------ Formulario ------
  return (
    <div
      className={cn(
        'mx-auto max-w-sm rounded-lg border border-orange-200/80 bg-orange-50/30 px-4 py-3 space-y-3',
        className,
      )}
    >
      {/* Cabecalho */}
      <p className="text-center text-xs font-medium tracking-wide text-gray-500 uppercase">
        Avalie esta geracao
      </p>

      {/* Estrelas */}
      <StarRating
        value={nota}
        onChange={setNota}
        disabled={isSubmitting}
      />

      {/* Textarea - visivel apenas apos selecionar nota */}
      {nota >= 1 && (
        <div className="space-y-1.5">
          <Label
            htmlFor="feedback-comentario"
            className={cn(
              'text-xs text-gray-500',
              comentarioObrigatorio && !comentarioValido && 'text-red-600',
            )}
          >
            {comentarioObrigatorio
              ? 'Comentario obrigatorio'
              : 'Comentario (opcional)'}
          </Label>
          <Textarea
            id="feedback-comentario"
            placeholder={
              comentarioObrigatorio
                ? 'Descreva o que pode ser melhorado...'
                : 'Deixe um comentario sobre a geracao...'
            }
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            disabled={isSubmitting}
            className={cn(
              'resize-none text-sm',
              comentarioObrigatorio &&
                !comentarioValido &&
                'border-red-400 focus-visible:ring-red-400',
            )}
            rows={2}
          />
        </div>
      )}

      {/* Botao de envio */}
      <div className="flex justify-center">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!formularioValido || isSubmitting}
          className="bg-[#0c1b33] text-xs text-white hover:bg-[#162d52]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar avaliacao'
          )}
        </Button>
      </div>
    </div>
  )
}
