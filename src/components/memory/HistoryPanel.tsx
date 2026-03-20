import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, GitCommit, ChevronDown, ChevronUp, Diff, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HistoryEntry } from '@/types/agentMemory';

interface HistoryPanelProps {
  entityId: string;
  history: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  onLoadHistory: (options?: { limit?: number; since?: string; until?: string }) => void;
  onSelectRevision?: (sha: string) => void;
  onSelectDiff?: (fromSha: string, toSha: string) => void;
  className?: string;
}

export function HistoryPanel({
  entityId,
  history,
  isLoading,
  error,
  onLoadHistory,
  onSelectRevision,
  onSelectDiff,
  className,
}: HistoryPanelProps) {
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sinceDate, setSinceDate] = useState('');
  const [untilDate, setUntilDate] = useState('');

  const toggleSha = useCallback((sha: string) => {
    setSelectedShas((prev) => {
      if (prev.includes(sha)) return prev.filter((s) => s !== sha);
      if (prev.length >= 2) return [prev[1], sha];
      return [...prev, sha];
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedShas.length === 2 && onSelectDiff) {
      onSelectDiff(selectedShas[0], selectedShas[1]);
    }
  }, [selectedShas, onSelectDiff]);

  const handleFilteredLoad = useCallback(() => {
    const opts: { limit?: number; since?: string; until?: string } = { limit: 20 };
    if (sinceDate) opts.since = new Date(sinceDate).toISOString();
    if (untilDate) opts.until = new Date(untilDate).toISOString();
    onLoadHistory(opts);
  }, [sinceDate, untilDate, onLoadHistory]);

  return (
    <div className={cn('border rounded-lg bg-card', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Історія · {entityId}
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="border-t">
          {history.length === 0 && !isLoading && !error && (
            <div className="p-4 text-center space-y-2">
              <Button size="sm" variant="outline" onClick={() => onLoadHistory()}>
                Завантажити історію
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-2"
                onClick={() => setShowDateFilter(!showDateFilter)}
              >
                <Filter className="w-3.5 h-3.5 mr-1" />
                Фільтр
              </Button>
            </div>
          )}

          {/* Date filter controls */}
          {showDateFilter && (
            <div className="px-3 py-2 bg-muted/30 border-b space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <label className="text-muted-foreground shrink-0">Від:</label>
                <input
                  type="date"
                  value={sinceDate}
                  onChange={(e) => setSinceDate(e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                />
                <label className="text-muted-foreground shrink-0">До:</label>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={handleFilteredLoad}>
                Завантажити з фільтром
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Завантаження історії…
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {history.length > 0 && (
            <>
              <div className="px-3 py-1.5 border-b flex items-center gap-2">
                {selectedShas.length === 2 && onSelectDiff && (
                  <>
                    <Diff className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      Обрано {selectedShas.length}/2 для порівняння
                    </span>
                    <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={handleCompare}>
                      Порівняти
                    </Button>
                  </>
                )}
                {!showDateFilter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn('h-7 text-xs', selectedShas.length < 2 ? '' : 'ml-2')}
                    onClick={() => setShowDateFilter(true)}
                  >
                    <Filter className="w-3 h-3 mr-1" />
                    Фільтр
                  </Button>
                )}
              </div>

              <ScrollArea className="max-h-80">
                <div className="divide-y">
                  {history.map((entry) => (
                    <div
                      key={entry.sha}
                      className={cn(
                        'px-3 py-2 text-sm hover:bg-muted/30 transition-colors cursor-pointer',
                        selectedShas.includes(entry.sha) && 'bg-primary/5 border-l-2 border-primary'
                      )}
                      onClick={() => toggleSha(entry.sha)}
                    >
                      <div className="flex items-center gap-2">
                        <GitCommit className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <code className="text-xs font-mono text-muted-foreground">{entry.sha.slice(0, 7)}</code>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(entry.timestamp).toLocaleDateString('uk-UA', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground mt-1 truncate">{entry.message}</p>
                      {entry.author && (
                        <span className="text-xs text-muted-foreground">{entry.author}</span>
                      )}
                      {onSelectRevision && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs mt-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRevision(entry.sha);
                          }}
                        >
                          Відкрити ревізію
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </div>
  );
}
