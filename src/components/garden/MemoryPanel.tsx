import { useState, useCallback } from 'react';
import { useAgentMemory } from '@/hooks/useAgentMemory';
import type { ContextDepth, OrchestratedSearchResponse, ContextResponse, MemoryProcessResponse } from '@/types/agentMemory';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Search, Layers, PlusCircle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

const MEMORY_USER_ID = 'garden-owner';

interface MemoryPanelProps {
  /** Initial search query (e.g. note title) */
  initialQuery?: string;
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

export function MemoryPanel({ initialQuery, trigger }: MemoryPanelProps) {
  const { search, getContext, processText, status, isLoading, error } = useAgentMemory(MEMORY_USER_ID);

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
              <SearchTab search={search} isLoading={isLoading} error={error} initialQuery={initialQuery} />
            </TabsContent>
            <TabsContent value="context" className="m-0">
              <ContextTab getContext={getContext} isLoading={isLoading} error={error} />
            </TabsContent>
            <TabsContent value="add" className="m-0">
              <AddMemoryTab processText={processText} isLoading={isLoading} error={error} />
            </TabsContent>
          </div>
        </Tabs>

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
// Search Tab
// ============================================

function SearchTab({
  search,
  isLoading,
  error,
  initialQuery,
}: {
  search: (q: string) => Promise<OrchestratedSearchResponse>;
  isLoading: boolean;
  error: string | null;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [result, setResult] = useState<OrchestratedSearchResponse | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    try {
      const res = await search(query.trim());
      setResult(res);
    } catch {
      // error is handled by hook
    }
  }, [query, search]);

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
          {/* Answer */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {result.answer}
            </p>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Sources ({result.sources.length})
              </h4>
              <div className="space-y-1.5">
                {result.sources.map((src, i) => (
                  <div
                    key={`${src.entityId}-${i}`}
                    className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground truncate">{src.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {src.entityType} · {(src.score * 100).toFixed(0)}%
                    </span>
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

          {/* Raw context preview */}
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Raw context preview
            </summary>
            <pre className="mt-2 p-3 rounded-lg bg-muted text-xs text-foreground overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
              {result.context.slice(0, 2000)}
              {result.context.length > 2000 && '\n\n... (truncated)'}
            </pre>
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
