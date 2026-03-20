import { cn } from '@/lib/utils';
import { Clock, GitCommit, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { TemporalAttachment } from '@/types/agentMemory';

interface TemporalAttachmentsProps {
  attachments: TemporalAttachment[];
  onSelectRevision?: (entityId: string, sha: string) => void;
  onSelectDiff?: (entityId: string, fromSha: string, toSha: string) => void;
  className?: string;
}

export function TemporalAttachments({
  attachments,
  onSelectRevision,
  onSelectDiff,
  className,
}: TemporalAttachmentsProps) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  if (!attachments.length) return null;

  return (
    <div className={cn('border rounded-lg bg-card/50 overflow-hidden', className)}>
      <div className="px-3 py-2 bg-accent/20 border-b flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent-foreground/70" />
        <span className="text-xs font-medium text-accent-foreground">
          Temporal · Історичні джерела
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {attachments.length} {attachments.length === 1 ? 'сутність' : 'сутностей'}
        </span>
      </div>

      <div className="divide-y">
        {attachments.map((att) => {
          const isExpanded = expandedEntity === att.entityId;
          return (
            <div key={att.entityId}>
              <button
                type="button"
                onClick={() => setExpandedEntity(isExpanded ? null : att.entityId)}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="font-mono text-xs text-foreground">{att.entityId}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {att.history.length} ревізій
                </span>
              </button>

              {isExpanded && (
                <div className="pl-8 pr-3 pb-2 space-y-1">
                  {att.history.map((entry, i) => (
                    <div
                      key={entry.sha}
                      className="flex items-center gap-2 text-xs py-1"
                    >
                      <GitCommit className="w-3 h-3 text-muted-foreground shrink-0" />
                      <code className="font-mono text-muted-foreground">{entry.sha.slice(0, 7)}</code>
                      <span className="text-foreground truncate flex-1">{entry.message}</span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(entry.timestamp).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                      </span>
                      {onSelectRevision && (
                        <button
                          type="button"
                          onClick={() => onSelectRevision(att.entityId, entry.sha)}
                          className="text-primary hover:underline shrink-0"
                        >
                          відкрити
                        </button>
                      )}
                      {onSelectDiff && i < att.history.length - 1 && (
                        <button
                          type="button"
                          onClick={() => onSelectDiff(att.entityId, att.history[i + 1].sha, entry.sha)}
                          className="text-primary hover:underline shrink-0"
                        >
                          diff
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
