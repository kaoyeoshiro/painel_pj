import { useCallback, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface UseFeedbackGateReturn {
  /** Whether this generation has already been rated */
  hasFeedback: boolean
  /** Whether the gate modal is currently open */
  gateOpen: boolean
  /** The action waiting to execute after feedback is provided */
  pendingAction: (() => void) | null
  /**
   * Guard an action behind the feedback gate.
   * If the user already rated this generation, `fn` executes immediately.
   * Otherwise the modal opens and `fn` is stored until feedback is provided.
   */
  guardAction: (fn: () => void) => void
  /**
   * Call this when the feedback submission succeeds.
   * Marks the generation as rated, executes the pending action, and closes the modal.
   */
  onFeedbackDone: () => void
  /**
   * Marks the generation as rated without triggering a pending action.
   * Use this when the user submits feedback via the inline card (no gate involved).
   */
  markAsRated: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the "feedback gate" state for a single generation.
 *
 * The gate ensures a user cannot perform certain actions (download, copy)
 * until they have provided a star rating for the generation.
 *
 * When `generationId` changes (new generation), the gate resets so the user
 * must rate again for the new generation.
 *
 * @param generationId - Unique identifier of the generation being rated.
 *                        Pass `null` to disable the gate entirely.
 */
export function useFeedbackGate(
  generationId: string | number | null,
): UseFeedbackGateReturn {
  // Track which generation IDs have been rated during this session
  const ratedIdsRef = useRef<Set<string | number>>(new Set())

  const [gateOpen, setGateOpen] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const [, forceUpdate] = useState(0)

  const hasFeedback =
    generationId != null && ratedIdsRef.current.has(generationId)

  const guardAction = useCallback(
    (fn: () => void) => {
      // No generation or already rated — execute immediately
      if (generationId == null || ratedIdsRef.current.has(generationId)) {
        fn()
        return
      }

      // Store the action and open the gate modal
      pendingActionRef.current = fn
      setGateOpen(true)
    },
    [generationId],
  )

  const markAsRated = useCallback(() => {
    if (generationId == null) return
    ratedIdsRef.current.add(generationId)
    forceUpdate((n) => n + 1)
  }, [generationId])

  const onFeedbackDone = useCallback(() => {
    if (generationId != null) {
      ratedIdsRef.current.add(generationId)
    }

    // Execute the pending action if one exists
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setGateOpen(false)
    forceUpdate((n) => n + 1)

    // Execute after state updates so the modal closes first
    if (action) {
      setTimeout(action, 0)
    }
  }, [generationId])

  return {
    hasFeedback,
    gateOpen,
    pendingAction: pendingActionRef.current,
    guardAction,
    onFeedbackDone,
    markAsRated,
  }
}
