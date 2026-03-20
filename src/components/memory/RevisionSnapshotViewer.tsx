import { cn } from '@/lib/utils';
import { History, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RevisionSnapshotResponse } from '@/types/agentMemory';

interface RevisionSnapshotViewerProps {
  snapshot: RevisionSnapshotResponse | null;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function RevisionSnapshotViewer({ snapshot, isLoading, error, className }: RevisionSnapshotViewerProps) {
  if (isLoading) {
    return (
      <div className={cn('border rounded-lg bg-card p-4 text-center text-sm text-muted-foreground', className)}>
        Завантаження ревізії…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('border rounded-lg bg-card p-4 text-center text-sm text-destructive', className)}>
        {error}
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className={cn('border rounded-lg bg-card overflow-hidden', className)}>
      <div className="px-3 py-2 bg-amber-500/10 border-b flex items-center gap-2">
        <History className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-foreground">
          Історична ревізія · {snapshot.entityId}
        </span>
        <code className="text-xs font-mono text-muted-foreground ml-auto">
          {snapshot.sha.slice(0, 7)}
        </code>
      </div>

      <div className="px-3 py-1.5 bg-amber-500/5 border-b flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 text-amber-500" />
        <span className="text-xs text-amber-700">
          Це минулий стан сутності. Поточна версія може відрізнятися.
        </span>
      </div>

      <ScrollArea className="max-h-96">
        <div className="prose prose-sm dark:prose-invert max-w-none p-4 text-foreground leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{snapshot.content}</ReactMarkdown>
        </div>
      </ScrollArea>
    </div>
  );
}
