import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Utilidade para mesclar classes CSS com Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
