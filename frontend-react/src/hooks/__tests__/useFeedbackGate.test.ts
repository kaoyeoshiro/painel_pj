import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeedbackGate } from '../useFeedbackGate'

describe('useFeedbackGate', () => {
  it('starts with hasFeedback false', () => {
    const { result } = renderHook(() => useFeedbackGate(1))
    expect(result.current.hasFeedback).toBe(false)
  })

  it('starts with gateOpen false', () => {
    const { result } = renderHook(() => useFeedbackGate(1))
    expect(result.current.gateOpen).toBe(false)
  })

  it('guardAction opens modal when no feedback', () => {
    const { result } = renderHook(() => useFeedbackGate(1))
    const action = vi.fn()

    act(() => {
      result.current.guardAction(action)
    })

    expect(result.current.gateOpen).toBe(true)
    expect(action).not.toHaveBeenCalled()
  })

  it('guardAction executes immediately when already rated', () => {
    const { result } = renderHook(() => useFeedbackGate(1))
    const action = vi.fn()

    // First mark as rated
    act(() => {
      result.current.markAsRated()
    })

    // Now guard should execute immediately
    act(() => {
      result.current.guardAction(action)
    })

    expect(result.current.gateOpen).toBe(false)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('markAsRated sets hasFeedback true', () => {
    const { result } = renderHook(() => useFeedbackGate(1))

    act(() => {
      result.current.markAsRated()
    })

    expect(result.current.hasFeedback).toBe(true)
  })

  it('onFeedbackDone marks rated, closes modal, and executes pending action', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFeedbackGate(1))
    const action = vi.fn()

    // Guard opens modal
    act(() => {
      result.current.guardAction(action)
    })
    expect(result.current.gateOpen).toBe(true)

    // Feedback done
    act(() => {
      result.current.onFeedbackDone()
    })

    expect(result.current.hasFeedback).toBe(true)
    expect(result.current.gateOpen).toBe(false)

    // Action executed via setTimeout
    act(() => {
      vi.runAllTimers()
    })
    expect(action).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('guardAction executes when generationId is null (gate disabled)', () => {
    const { result } = renderHook(() => useFeedbackGate(null))
    const action = vi.fn()

    act(() => {
      result.current.guardAction(action)
    })

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.gateOpen).toBe(false)
  })

  it('hasFeedback resets for different generationId', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFeedbackGate(id),
      { initialProps: { id: 1 as number | null } },
    )

    // Rate generation 1
    act(() => {
      result.current.markAsRated()
    })
    expect(result.current.hasFeedback).toBe(true)

    // Switch to generation 2
    rerender({ id: 2 })
    expect(result.current.hasFeedback).toBe(false)
  })

  it('remembers previously rated generations', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFeedbackGate(id),
      { initialProps: { id: 1 as number | null } },
    )

    // Rate generation 1
    act(() => {
      result.current.markAsRated()
    })

    // Switch to gen 2
    rerender({ id: 2 })
    expect(result.current.hasFeedback).toBe(false)

    // Switch back to gen 1 — still rated
    rerender({ id: 1 })
    expect(result.current.hasFeedback).toBe(true)
  })
})
