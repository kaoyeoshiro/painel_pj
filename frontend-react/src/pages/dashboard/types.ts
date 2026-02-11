import type { LucideIcon } from 'lucide-react'

/** Configuração de um card de sistema no dashboard */
export interface SystemCardConfig {
  to: string
  icon: LucideIcon
  title: string
  description: string
  /** Classe Tailwind da cor do card (ex: "primary", "purple", "amber") */
  color: string
}

/** Configuração de um card admin no dashboard */
export interface AdminCardConfig {
  to: string
  icon: LucideIcon
  title: string
  subtitle: string
  /** Classe Tailwind da cor do ícone (ex: "gray", "purple", "amber") */
  color: string
}
