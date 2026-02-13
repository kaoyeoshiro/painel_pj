// Hooks centralizados do Portal PGE-MS
// Re-exporta todos os hooks disponíveis para facilitar imports

// TanStack Query hooks (estado do servidor)
export * from './useQueries'

// UI hooks (estado local)
export { useToast } from './use-toast'
export { useMarkdown } from './useMarkdown'
export { usePagination } from './usePagination'
export { useSSE } from './useSSE'
export { useFeedbackGate } from './useFeedbackGate'
