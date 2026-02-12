// ============================================================
// PGE Design System — Tokens de cor e tipografia
// Fonte unica de verdade para cores, fontes e estilos visuais.
// ============================================================

export const C = {
  // Navy (principal)
  navy950: '#22314B',
  navy900: '#253D52',
  navy800: '#284656',
  navy700: '#2B5376',
  navy600: '#356A8E',
  navy500: '#4A98A0',
  navy400: '#4EA0A9',
  navy300: '#73B9C0',
  navy200: '#A3D1D5',
  navy100: '#D5ECEF',
  navy50: '#EFF8F9',

  // Orange (acento)
  orange600: '#e07520',
  orange500: '#F58634',
  orange400: '#F79A54',
  orange200: '#fcd4b0',
  orange100: '#fef0e4',
  orange50: '#fff8f1',

  // Gray (neutro)
  gray700: '#3C4858',
  gray600: '#5A6578',
  gray500: '#8D8F92',
  gray400: '#B3B5B7',
  gray300: '#CDCED0',
  gray200: '#E2E3E5',
  gray100: '#F0F1F2',
  gray50: '#F7F8F9',

  // Text
  text900: '#1A2332',
  text700: '#2D3B4E',
  text500: '#5A6578',
  text400: '#8D95A0',

  // Status
  statusSuccess: '#10b981',
  statusWarning: '#f59e0b',
  statusError: '#ef4444',
  statusInfo: '#4A98A0',

  // Status — fundos e bordas semanticos
  successBg: '#f0fdf4',
  successBgStrong: '#dcfce7',
  successBorder: '#bbf7d0',
  successText: '#166534',
  successTextLight: '#15803d',

  errorBg: '#fef2f2',
  errorBgStrong: '#fee2e2',
  errorBorder: '#fecaca',
  errorText: '#991b1b',
  errorTextLight: '#b91c1c',

  warningBg: '#fef3c7',
  warningBgAlt: '#fffbeb',
  warningBgStrong: '#fde68a',
  warningBorder: '#fcd34d',
  warningText: '#92400e',
  warningTextStrong: '#d97706',

  // Rose (erros leves / inativos)
  errorBgLight: '#fff1f2',
  errorBorderLight: '#fecdd3',

  // Greens extras (sucesso em gradientes e indicadores)
  successAccent: '#16a34a',
  successAccentLight: '#22c55e',
  successAccentMuted: '#34d399',

  // Acentos para graficos e visualizacoes
  chartAmber: '#f59e0b',
  chartStarYellow: '#facc15',
  chartPurple: '#a855f7',
  chartBlue: '#3b82f6',
  chartYellow: '#eab308',
  chartIndigo: '#6366f1',
  chartTeal: '#14b8a6',
  chartRed: '#dc2626',

  // Utilitarios
  terminalBg: '#0f172a',
} as const

export const FONT_UI = "var(--font-ui, 'Plus Jakarta Sans', system-ui, sans-serif)"
export const FONT_DOC = "'Lora', Georgia, serif"
