import { useEffect, useMemo, useState } from 'react'

interface LegacyAdminFramePageProps {
  legacyPath: string
}

type FrameLoadState = 'loading' | 'loaded' | 'error'
type FrameLoadError = 'network' | 'timeout' | null

const DEFAULT_FRAME_TIMEOUT_MS = 15_000

function normalizeLegacyPath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function getFrameTimeoutMs(): number {
  const parsed = Number(import.meta.env.VITE_LEGACY_FRAME_TIMEOUT_MS)
  if (Number.isFinite(parsed) && parsed >= 3_000) {
    return parsed
  }
  return DEFAULT_FRAME_TIMEOUT_MS
}

function getLegacyOrigin(): string {
  const configured = import.meta.env.VITE_LEGACY_ADMIN_ORIGIN?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  // Em desenvolvimento, o legado roda no backend local.
  if (import.meta.env.DEV) return 'http://127.0.0.1:8000'

  // Em produção, assume mesmo domínio/origem da aplicação.
  return ''
}

export function LegacyAdminFramePage({ legacyPath }: LegacyAdminFramePageProps) {
  const [reloadNonce, setReloadNonce] = useState(0)
  const [loadState, setLoadState] = useState<FrameLoadState>('loading')
  const [loadError, setLoadError] = useState<FrameLoadError>(null)

  const timeoutMs = getFrameTimeoutMs()

  const src = useMemo(() => {
    const origin = getLegacyOrigin()
    const normalizedPath = normalizeLegacyPath(legacyPath)

    // Em dev, React e backend costumam rodar em origens diferentes.
    // Usa bridge para sincronizar token no localStorage da origem legada.
    if (import.meta.env.DEV && origin) {
      const token =
        localStorage.getItem('access_token') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token') ||
        ''
      const params = new URLSearchParams({ target: normalizedPath })
      if (token) params.set('token', token)
      return `${origin}/admin/_frame-bridge?${params.toString()}`
    }

    return `${origin}${normalizedPath}`
  }, [legacyPath])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset de estado ao mudar src do iframe
    setLoadState('loading')
    setLoadError(null)

    const timeoutId = window.setTimeout(() => {
      setLoadState((current) => {
        if (current === 'loaded') return current
        setLoadError('timeout')
        return 'error'
      })
    }, timeoutMs)

    return () => window.clearTimeout(timeoutId)
  }, [src, reloadNonce, timeoutMs])

  const isLoading = loadState === 'loading'
  const hasError = loadState === 'error'
  const errorMessage =
    loadError === 'timeout'
      ? `A tela legado nao respondeu em ${Math.round(timeoutMs / 1000)}s.`
      : 'Nao foi possivel carregar a tela administrativa legada.'

  if (hasError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-xl rounded-xl border border-red-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-red-700">Falha ao carregar tela legada</p>
          <p className="mb-4 text-sm text-red-700">{errorMessage}</p>
          <p className="mb-4 break-all rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
            {src}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadNonce((value) => value + 1)}
              className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Recarregar
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Abrir em nova aba
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/95 text-gray-600">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
          <p className="text-sm">Carregando tela legada...</p>
        </div>
      )}

      <iframe
        key={`${src}-${reloadNonce}`}
        title="Tela administrativa legada"
        src={src}
        className="block h-full w-full border-0"
        onLoad={() => setLoadState('loaded')}
        onError={() => {
          setLoadError('network')
          setLoadState('error')
        }}
      />
    </div>
  )
}
