import { useState, useCallback, useEffect, useRef } from 'react';
import type { WriterStageStatus } from '@/types/agentMemory';
import { useAgentMemory } from '@/hooks/useAgentMemory';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { getMemoryEntity } from '@/lib/api/mcpGatewayClient';
import type { ContextDepth, OrchestratedSearchResponse, ContextGraph, MemoryProcessResponse, MemoryEntity, MemorySearchResult, EntityHistoryResponse, EntityDiffResponse, RevisionSnapshotResponse } from '@/types/agentMemory';
import ReactMarkdown from 'react-markdown';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Search, Layers, PlusCircle, ExternalLink, Loader2, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { DepthSwitcher } from '@/components/memory/DepthSwitcher';
import { HistoryPanel } from '@/components/memory/HistoryPanel';
import { DiffViewer } from '@/components/memory/DiffViewer';
import { RevisionSnapshotViewer } from '@/components/memory/RevisionSnapshotViewer';
import { TemporalAttachments } from '@/components/memory/TemporalAttachments';
import { WriterStatusBanner } from '@/components/memory/WriterStatusBanner';

interface MemoryPanelProps {
  initialQuery?: string;
  trigger?: React.ReactNode;
}

export function MemoryPanel({ initialQuery, trigger }: MemoryPanelProps) {
  const { isAuthenticated } = useOwnerAuth();
  const userId = isAuthenticated ? 'garden-owner' : null;
  const {
    search, getContext, processText,
    fetchHistory, fetchDiff, fetchRevision,
    status, isLoading, error,
  } = useAgentMemory(userId || 'garden-owner');

  const [activeTab, setActiveTab] = useState('search');
  // Pending history request triggered from SearchTab
  const [pendingHistoryEntityId, setPendingHistoryEntityId] = useState<string | null>(null);

  const handleViewHistory = useCallback((entityId: string) => {
    setPendingHistoryEntityId(entityId);
    setActiveTab('context');
  }, []);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Brain className="w-4 h-4" />
            <span>Memory</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Agent Memory
          </SheetTitle>
          <SheetDescription>
            Пошук, контекст і додавання до пам'яті агента
          </SheetDescription>
        </SheetHeader>

        {!userId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Sign in to use agent memory</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-4 overflow-hidden">
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Пошук
              </TabsTrigger>
              <TabsTrigger value="context" className="flex-1 gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Контекст
              </TabsTrigger>
              <TabsTrigger value="add" className="flex-1 gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Додати
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-2">
              <TabsContent value="search" className="m-0">
                <SearchTab search={search} isLoading={isLoading} error={error} initialQuery={initialQuery} userId={userId} onViewHistory={handleViewHistory} />
              </TabsContent>
              <TabsContent value="context" className="m-0">
                <ContextTab
                  getContext={getContext}
                  isLoading={isLoading}
                  error={error}
                  fetchHistory={fetchHistory}
                  fetchDiff={fetchDiff}
                  fetchRevision={fetchRevision}
                  pendingHistoryEntityId={pendingHistoryEntityId}
                  onPendingHistoryConsumed={() => setPendingHistoryEntityId(null)}
                />
              </TabsContent>
              <TabsContent value="add" className="m-0">
                <AddMemoryTab processText={processText} isLoading={isLoading} error={error} />
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Status footer */}
        <div className="border-t border-border pt-3 mt-2 text-xs text-muted-foreground font-sans flex items-center justify-between">
          <span>
            {status ? (
              <>
                {status.entityCount} сутностей · {status.initialized ? 'готово' : 'ініціалізація…'}
              </>
            ) : (
              'Завантаження…'
            )}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Entity Viewer
// ============================================

function EntityViewer({ userId, entityId }: { userId: string; entityId: string }) {
  const [entity, setEntity] = useState<MemoryEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!entity) {
      setLoading(true);
      try {
        const data = await getMemoryEntity(userId, entityId);
        // Backend returns entity directly (not wrapped)
        setEntity(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, entity, userId, entityId]);

  return (
    <div>
      <button
        onClick={handleToggle}
        className="ml-auto shrink-0 p-1 rounded hover:bg-muted transition-colors"
        aria-label={expanded ? 'Collapse entity' : 'Expand entity'}
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="mt-1.5 p-3 rounded-lg border border-border bg-card text-sm">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ) : entity ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{entity.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Failed to load entity</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Search Tab (present-state only)
// ============================================

function SearchTab({
  search,
  isLoading,
  error,
  initialQuery,
  userId,
  onViewHistory,
}: {
  search: (q: string) => Promise<OrchestratedSearchResponse>;
  isLoading: boolean;
  error: string | null;
  initialQuery?: string;
  userId: string;
  onViewHistory?: (entityId: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [result, setResult] = useState<OrchestratedSearchResponse | null>(null);
  const autoSearchedRef = useRef(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    try {
      const res = await search(query.trim());
      setResult(res);
    } catch {
      // error is handled by hook
    }
  }, [query, search]);

  useEffect(() => {
    if (initialQuery && initialQuery.trim() && !autoSearchedRef.current) {
      autoSearchedRef.current = true;
      handleSearch();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Запитай щось про збережене…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={handleSearch} disabled={isLoading || !query.trim()} size="sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Empty state */}
      {!result && !isLoading && !error && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
          <p>Введіть запит, щоб знайти інформацію</p>
          <p className="text-xs mt-1">Пошук працює по поточному стану пам'яті</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading && !result && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{result.answer}</ReactMarkdown>
            </div>
          </div>

          {/* Sources — present-state only, no history entries */}
          {result.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Джерела ({result.sources.length})
              </h4>
              <div className="space-y-1.5">
                {result.sources.map((src: MemorySearchResult, i: number) => (
                  <div key={`${src.id}-${i}`} className="rounded-md bg-muted/50">
                    <div className="flex items-center gap-2 text-sm p-2 hover:bg-muted transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{src.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {(src.score * 100).toFixed(0)}%
                      </span>
                      {onViewHistory && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onViewHistory(src.id); }}
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          Історія
                        </button>
                      )}
                      <EntityViewer userId={userId} entityId={src.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.subQueries.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Під-запити
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.subQueries.map((sq: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(sq); }}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Context Tab — with depth switcher and temporal support
// ============================================

function ContextTab({
  getContext,
  isLoading,
  error,
  fetchHistory,
  fetchDiff,
  fetchRevision,
  pendingHistoryEntityId,
  onPendingHistoryConsumed,
}: {
  getContext: (depth: ContextDepth, query?: string) => Promise<ContextGraph>;
  isLoading: boolean;
  error: string | null;
  fetchHistory: (entityId: string, options?: { limit?: number }) => Promise<EntityHistoryResponse>;
  fetchDiff: (entityId: string, toSha: string, fromSha?: string) => Promise<EntityDiffResponse>;
  fetchRevision: (entityId: string, sha: string) => Promise<RevisionSnapshotResponse>;
  pendingHistoryEntityId?: string | null;
  onPendingHistoryConsumed?: () => void;
}) {
  const [depth, setDepth] = useState<ContextDepth>('wide');
  const [contextQuery, setContextQuery] = useState('');
  const [result, setResult] = useState<ContextGraph | null>(null);

  // Temporal sub-views
  const [historyData, setHistoryData] = useState<EntityHistoryResponse | null>(null);
  const [diffData, setDiffData] = useState<EntityDiffResponse | null>(null);
  const [snapshotData, setSnapshotData] = useState<RevisionSnapshotResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    if (!contextQuery.trim()) return;
    try {
      const res = await getContext(depth, contextQuery.trim());
      setResult(res);
      // Clear temporal sub-views when loading new context
      setHistoryData(null);
      setDiffData(null);
      setSnapshotData(null);
    } catch {
      // handled by hook
    }
  }, [depth, contextQuery, getContext]);

  const handleLoadHistory = useCallback(async (entityId: string) => {
    setSubLoading(true);
    setSubError(null);
    try {
      const data = await fetchHistory(entityId, { limit: 20 });
      setHistoryData(data);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'History load failed');
    } finally {
      setSubLoading(false);
    }
  }, [fetchHistory]);

  // Handle pending history request from SearchTab
  useEffect(() => {
    if (pendingHistoryEntityId) {
      handleLoadHistory(pendingHistoryEntityId);
      onPendingHistoryConsumed?.();
    }
  }, [pendingHistoryEntityId, handleLoadHistory, onPendingHistoryConsumed]);

  const handleSelectDiff = useCallback(async (entityId: string, fromSha: string, toSha: string) => {
    setSubLoading(true);
    setSubError(null);
    try {
      const data = await fetchDiff(entityId, toSha, fromSha);
      setDiffData(data);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Diff load failed');
    } finally {
      setSubLoading(false);
    }
  }, [fetchDiff]);

  const handleSelectRevision = useCallback(async (entityId: string, sha: string) => {
    setSubLoading(true);
    setSubError(null);
    try {
      const data = await fetchRevision(entityId, sha);
      setSnapshotData(data);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Revision load failed');
    } finally {
      setSubLoading(false);
    }
  }, [fetchRevision]);

  return (
    <div className="space-y-4">
      {/* Depth switcher */}
      <DepthSwitcher value={depth} onChange={setDepth} disabled={isLoading} />

      {/* Query input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={contextQuery}
          onChange={(e) => setContextQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          placeholder="Запит для збирання контексту…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={handleLoad} disabled={isLoading || !contextQuery.trim()} size="sm" variant="outline">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state — only when no context loaded AND no history from Search */}
      {!result && !historyData && !isLoading && !error && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
          <p>Введіть запит, щоб зібрати контекст</p>
          <p className="text-xs mt-1">Оберіть глибину зверху для різного рівня деталізації</p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{result.nodes.length} сутностей</span>
            <span>~{result.totalTokens} токенів</span>
          </div>

          {/* Context nodes — current state */}
          <div className="space-y-1.5">
            {result.nodes.map((node) => (
              <div
                key={node.entity.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
              >
                <span className="font-medium text-foreground truncate">{node.entity.title}</span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground">
                    d{node.depth} · {(node.relevance * 100).toFixed(0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadHistory(node.entity.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    історія
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Temporal attachments — only for depth=temporal */}
          {depth === 'temporal' && result.temporalAttachments && result.temporalAttachments.length > 0 && (
            <TemporalAttachments
              attachments={result.temporalAttachments}
              onSelectRevision={handleSelectRevision}
              onSelectDiff={(entityId, fromSha, toSha) => handleSelectDiff(entityId, fromSha, toSha)}
            />
          )}

          {/* Empty state for temporal when no attachments */}
          {depth === 'temporal' && result.temporalAttachments !== undefined && result.temporalAttachments.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              <Clock className="w-5 h-5 mx-auto mb-2 text-muted-foreground/50" />
              Немає історичних даних для цих сутностей.
              <br />
              <span className="text-xs">Спробуйте інший запит або перевірте, чи є у сутностей git-історія.</span>
            </div>
          )}
        </div>
      )}

      {/* === Temporal sub-views — rendered OUTSIDE result block === */}
      {/* These must be outside {result && ...} so Search→History works without context loaded */}

      {/* History panel */}
      {historyData && (
        <div className="space-y-3">
          {!result && (
            <div className="rounded-md bg-accent/10 border border-accent/20 px-3 py-2 text-xs text-accent-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Історія сутності, відкрита з пошуку
            </div>
          )}
          <HistoryPanel
            entityId={historyData.entityId}
            history={historyData.history}
            isLoading={subLoading}
            error={subError}
            onLoadHistory={() => handleLoadHistory(historyData.entityId)}
            onSelectRevision={(sha) => handleSelectRevision(historyData.entityId, sha)}
            onSelectDiff={(fromSha, toSha) => handleSelectDiff(historyData.entityId, fromSha, toSha)}
          />
        </div>
      )}

      {/* Diff viewer */}
      {diffData && (
        <DiffViewer diff={diffData} isLoading={subLoading} error={subError} />
      )}

      {/* Revision snapshot */}
      {snapshotData && (
        <RevisionSnapshotViewer snapshot={snapshotData} isLoading={subLoading} error={subError} />
      )}
    </div>
  );
}

// ============================================
// Add Memory Tab
// ============================================

function AddMemoryTab({
  processText,
  isLoading,
  error,
}: {
  processText: (text: string) => Promise<MemoryProcessResponse>;
  isLoading: boolean;
  error: string | null;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<MemoryProcessResponse | null>(null);
  const [writerStatus, setWriterStatus] = useState<WriterStageStatus>('idle');
  const [writerError, setWriterError] = useState<string | undefined>();

  const handleProcess = useCallback(async () => {
    if (!text.trim()) return;
    setWriterStatus('committing');
    setWriterError(undefined);
    setResult(null);
    try {
      const res = await processText(text.trim());
      setResult(res);
      setWriterStatus('committed');
      setText('');
    } catch (err) {
      setWriterStatus('error');
      setWriterError(err instanceof Error ? err.message : 'Processing failed');
    }
  }, [text, processText]);

  return (
    <div className="space-y-4">
      <WriterStatusBanner
        status={writerStatus}
        sessionId={result?.sessionId}
        entitiesCount={result?.entitiesAffected.length}
        commitSha={result?.commitSha}
        error={writerError}
      />
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (writerStatus !== 'idle' && writerStatus !== 'committing') {
            setWriterStatus('idle');
            setWriterError(undefined);
          }
        }}
        placeholder="Вставте розмову, нотатки або будь-який текст для збереження в пам'яті…"
        rows={6}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      />

      <Button onClick={handleProcess} disabled={isLoading || !text.trim()} className="w-full">
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Обробка…</>
        ) : (
          <><PlusCircle className="w-4 h-4 mr-2" /> Обробити й зберегти</>
        )}
      </Button>


      {result && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">
            ✅ {result.entitiesAffected.length} сутностей оброблено
          </div>
          {result.commitSha && (
            <div className="text-xs text-muted-foreground font-mono">
              Commit: {result.commitSha.slice(0, 8)}
            </div>
          )}
          <div className="space-y-1">
            {result.entitiesAffected.map((ent) => (
              <div
                key={ent.entityId}
                className="flex items-center gap-2 text-sm"
              >
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  ent.action === 'created'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-accent/30 text-accent-foreground'
                }`}>
                  {ent.action === 'created' ? 'створено' : 'оновлено'}
                </span>
                <span className="text-foreground">{ent.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
