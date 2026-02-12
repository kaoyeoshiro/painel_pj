/**
 * Badge visual de status para jobs de treinamento BERT.
 * Mapeia cada status a uma cor e icone correspondente.
 */

import { Loader2, CheckCircle2, XCircle, Clock, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TrainingJob } from '@/types/bert-training'

const STATUS_CONFIG: Record<
  TrainingJob['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  queued: {
    label: 'Na fila',
    variant: 'secondary',
    icon: <Clock className="mr-1 h-3 w-3" />,
  },
  running: {
    label: 'Executando',
    variant: 'default',
    icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
  },
  completed: {
    label: 'Concluido',
    variant: 'outline',
    icon: <CheckCircle2 className="mr-1 h-3 w-3 text-green-600" />,
  },
  failed: {
    label: 'Falhou',
    variant: 'destructive',
    icon: <XCircle className="mr-1 h-3 w-3" />,
  },
  stopping: {
    label: 'Parando',
    variant: 'secondary',
    icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
  },
  stopped: {
    label: 'Parado',
    variant: 'secondary',
    icon: <Square className="mr-1 h-3 w-3" />,
  },
}

interface StatusBadgeProps {
  status: TrainingJob['status']
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant={cfg.variant} className="gap-0">
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}
