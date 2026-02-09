import { useMemo, useState } from 'react'

interface LegacyAdminFramePageProps {
  legacyPath: string
}

function normalizeLegacyPath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
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
  const [loadError, setLoadError] = useState(false)

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

  if (loadError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Nao foi possivel carregar a tela administrativa legada em {src}.
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-white">
      <iframe
        title="Tela administrativa legada"
        src={src}
        className="block h-full w-full border-0"
        onError={() => setLoadError(true)}
      />
    </div>
  )
}
