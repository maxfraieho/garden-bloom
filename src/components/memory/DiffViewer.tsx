import { cn } from '@/lib/utils';
import { Diff, Plus, Minus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EntityDiffResponse } from '@/types/agentMemory';

interface DiffViewerProps {
  diff: EntityDiffResponse | null;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function DiffViewer({ diff, isLoading, error, className }: DiffViewerProps) {
  if (isLoading) {
    return (
      <div className={cn('border rounded-lg bg-card p-4 text-center text-sm text-muted-foreground', className)}>
        Завантаження diff…
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

  if (!diff) return null;

  const lines = diff.diff.patch.split('\n');

  return (
    <div className={cn('border rounded-lg bg-card overflow-hidden', className)}>
      <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2">
        <Diff className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          Diff · {diff.entityId}
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <Plus className="w-3 h-3" /> {diff.diff.additions}
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <Minus className="w-3 h-3" /> {diff.diff.deletions}
          </span>
        </div>
      </div>

      <div className="px-3 py-1 text-xs text-muted-foreground flex gap-4 border-b">
        <span>from: <code>{diff.from ? diff.from.slice(0, 7) : '(initial)'}</code></span>
        <span>to: <code>{diff.to.slice(0, 7)}</code></span>
      </div>

      <ScrollArea className="max-h-96">
        <pre className="text-xs font-mono p-3 leading-relaxed">
          {lines.map((line, i) => {
            let lineClass = 'text-foreground';
            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-green-600 bg-green-500/10';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-red-500 bg-red-500/10';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-primary/70';
            }
            return (
              <div key={i} className={cn('px-1 -mx-1', lineClass)}>
                {line}
              </div>
            );
          })}
        </pre>
      </ScrollArea>
    </div>
  );
}
