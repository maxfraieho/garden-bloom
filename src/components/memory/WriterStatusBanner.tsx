import { cn } from '@/lib/utils';
import { Loader2, Check, AlertCircle, GitCommit, Clock } from 'lucide-react';
import type { WriterStageStatus } from '@/types/agentMemory';

interface WriterStatusBannerProps {
  status: WriterStageStatus;
  sessionId?: string;
  entitiesCount?: number;
  commitSha?: string;
  error?: string;
  className?: string;
}

const STATUS_CONFIG: Record<WriterStageStatus, {
  label: string;
  icon: typeof Clock;
  color: string;
  bg: string;
}> = {
  idle: { label: 'Очікування', icon: Clock, color: 'text-muted-foreground', bg: '' },
  staged: { label: 'Підготовлено', icon: GitCommit, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  committing: { label: 'Фіксація…', icon: Loader2, color: 'text-primary', bg: 'bg-primary/10' },
  committed: { label: 'Зафіксовано', icon: Check, color: 'text-green-600', bg: 'bg-green-500/10' },
  error: { label: 'Помилка', icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

export function WriterStatusBanner({
  status,
  sessionId,
  entitiesCount,
  commitSha,
  error,
  className,
}: WriterStatusBannerProps) {
  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg border px-3 py-2 flex items-center gap-2 text-sm', config.bg, className)}>
      <Icon className={cn('w-4 h-4 shrink-0', config.color, status === 'committing' && 'animate-spin')} />
      <span className={cn('font-medium', config.color)}>{config.label}</span>

      {entitiesCount !== undefined && entitiesCount > 0 && (
        <span className="text-xs text-muted-foreground">
          · {entitiesCount} сутностей
        </span>
      )}

      {commitSha && (
        <code className="text-xs font-mono text-muted-foreground ml-auto">
          {commitSha.slice(0, 7)}
        </code>
      )}

      {error && status === 'error' && (
        <span className="text-xs text-destructive ml-2 truncate">{error}</span>
      )}
    </div>
  );
}
