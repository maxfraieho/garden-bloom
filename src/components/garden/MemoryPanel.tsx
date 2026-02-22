import { useState, useCallback, useEffect, useRef } from 'react';
import { useAgentMemory } from '@/hooks/useAgentMemory';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { getMemoryEntity } from '@/lib/api/mcpGatewayClient';
import type { ContextDepth, OrchestratedSearchResponse, ContextResponse, MemoryProcessResponse, MemoryEntity } from '@/types/agentMemory';
import ReactMarkdown from 'react-markdown';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Search, Layers, PlusCircle, ExternalLink, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface MemoryPanelProps {
  /** Initial search query (e.g. note title) */
  initialQuery?: string;
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

export function MemoryPanel({ initialQuery, trigger }: MemoryPanelProps) {
  const { isAuthenticated } = useOwnerAuth();

  // Task 1: derive userId from auth; show sign-in message if not authenticated
  const userId = isAuthenticated ? 'garden-owner' : null;

  const { search, getContext, processText, status, isLoading, error } = useAgentMemory(userId || 'garden-owner');

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
            Search, explore context, and add to agent memory
          </SheetDescription>
        </SheetHeader>

        {!userId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Sign in to use agent memory</p>
          </div>
        ) : (
          <Tabs defaultValue="search" className="flex-1 flex flex-col mt-4 overflow-hidden">
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Search
              </TabsTrigger>
              <TabsTrigger value="context" className="flex-1 gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Context
              </TabsTrigger>
              <TabsTrigger value="add" className="flex-1 gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Add
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-2">
              <TabsContent value="search" className="m-0">
                <SearchTab search={search} isLoading={isLoading} error={error} initialQuery={initialQuery} userId={userId} />
              </TabsContent>
              <TabsContent value="context" className="m-0">
                <ContextTab getContext={getContext} isLoading={isLoading} error={error} />
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
                {status.entityCount} entities · index: {status.indexStatus}
              </>
            ) : (
              'Loading status...'
            )}
          </span>
          {status?.lastCommitAt && (
            <span>
              Last sync: {new Date(status.lastCommitAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Entity Viewer (Task 4)
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
        setEntity(data.entity);
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
// Search Tab
// ============================================

function SearchTab({
  search,
  isLoading,
  error,
  initialQuery,
  userId,
}: {
  search: (q: string) => Promise<OrchestratedSearchResponse>;
  isLoading: boolean;
  error: string | null;
  initialQuery?: string;
  userId: string;
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

  // Task 2: auto-execute search when initialQuery is provided
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
          placeholder="Ask about memories..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={handleSearch} disabled={isLoading || !query.trim()} size="sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

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
          {/* Task 3: Markdown rendering for answer */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{result.answer}</ReactMarkdown>
            </div>
          </div>

          {/* Sources with Task 4: entity viewer */}
          {result.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Sources ({result.sources.length})
              </h4>
              <div className="space-y-1.5">
                {result.sources.map((src, i) => (
                  <div key={`${src.entityId}-${i}`} className="rounded-md bg-muted/50">
                    <div className="flex items-center gap-2 text-sm p-2 hover:bg-muted transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{src.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {src.entityType} · {(src.score * 100).toFixed(0)}%
                      </span>
                      <EntityViewer userId={userId} entityId={src.entityId} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-queries */}
          {result.subQueries.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Sub-queries
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.subQueries.map((sq, i) => (
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
// Context Tab
// ============================================

const DEPTH_OPTIONS: { value: ContextDepth; label: string; desc: string }[] = [
  { value: 'basic', label: 'Basic', desc: 'Key facts only (fastest)' },
  { value: 'wide', label: 'Wide', desc: 'Search results + key facts' },
  { value: 'deep', label: 'Deep', desc: 'Full entity files' },
  { value: 'temporal', label: 'Temporal', desc: 'Files + git history diffs' },
];

function ContextTab({
  getContext,
  isLoading,
  error,
}: {
  getContext: (depth: ContextDepth, query?: string) => Promise<ContextResponse>;
  isLoading: boolean;
  error: string | null;
}) {
  const [depth, setDepth] = useState<ContextDepth>('basic');
  const [result, setResult] = useState<ContextResponse | null>(null);

  const handleLoad = useCallback(async () => {
    try {
      const res = await getContext(depth);
      setResult(res);
    } catch {
      // handled by hook
    }
  }, [depth, getContext]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {DEPTH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDepth(opt.value)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              depth === opt.value
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
            }`}
          >
            <div className="text-sm font-medium">{opt.label}</div>
            <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
          </button>
        ))}
      </div>

      <Button onClick={handleLoad} disabled={isLoading} className="w-full" variant="outline">
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</>
        ) : (
          <><Layers className="w-4 h-4 mr-2" /> Load {depth} context</>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{result.entities.length} entities</span>
            <span>~{result.tokenCount} tokens</span>
          </div>

          {/* Entities list */}
          <div className="space-y-1.5">
            {result.entities.map((ent) => (
              <div
                key={ent.entityId}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
              >
                <span className="font-medium text-foreground truncate">{ent.name}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {ent.entityType} · {(ent.relevance * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          {/* Task 3: Markdown rendering for context */}
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Context preview
            </summary>
            <div className="mt-2 p-3 rounded-lg bg-muted max-h-64 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                <ReactMarkdown>{result.context.slice(0, 2000) + (result.context.length > 2000 ? '\n\n... (truncated)' : '')}</ReactMarkdown>
              </div>
            </div>
          </details>
        </div>
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

  const handleProcess = useCallback(async () => {
    if (!text.trim()) return;
    try {
      const res = await processText(text.trim());
      setResult(res);
      setText('');
    } catch {
      // handled by hook
    }
  }, [text, processText]);

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a conversation, notes, or any text to extract into memory entities..."
        rows={6}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      />

      <Button onClick={handleProcess} disabled={isLoading || !text.trim()} className="w-full">
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
        ) : (
          <><PlusCircle className="w-4 h-4 mr-2" /> Process & Commit</>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">
            ✅ {result.entitiesAffected.length} entities affected
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
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                }`}>
                  {ent.action}
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
