import { useEffect, useMemo, useState } from 'react';
import { Search, MessageSquarePlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAccessZones } from '@/hooks/useAccessZones';
import { NotebookLMStatusBadge } from '@/components/zones/NotebookLMStatusBadge';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';

export function NotebookLMZonesWall(props: {
  onChatForNotebook: (notebookUrl: string, suggestedTitle: string) => void;
  className?: string;
}) {
  const { isAuthenticated } = useOwnerAuth();
  const { zones, isLoading, error, fetchZones, isExpired } = useAccessZones();
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);

  useEffect(() => {
    // owner-only list endpoint
    if (!isAuthenticated) return;
    fetchZones();
  }, [fetchZones, isAuthenticated]);

  const activeZones = useMemo(() => zones.filter((z) => !isExpired(z.expiresAt)), [zones, isExpired]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeZones.filter((z) => {
      if (q) {
        const hay = `${z.name} ${z.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!readyOnly) return true;
      // best-effort: only show zones that already have notebooklm mapping with completed status
      return z.notebooklm?.status === 'completed' && !!z.notebooklm?.notebookUrl;
    });
  }, [activeZones, query, readyOnly]);

  return (
    <Card className={cn('flex flex-col overflow-hidden', props.className)}>
      <div className="p-3 border-b">
        <p className="text-sm font-medium">Access Zones</p>
        <p className="text-xs text-muted-foreground">Pick a ready NotebookLM zone</p>
      </div>

      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search zones…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="nlm-ready" className="text-xs text-muted-foreground">
            Ready only
          </Label>
          <Switch id="nlm-ready" checked={readyOnly} onCheckedChange={setReadyOnly} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2 animate-fade-in">
          {!isAuthenticated && (
            <div className="p-4 text-sm text-muted-foreground">
              Owner mode required to list zones.
            </div>
          )}

          {isAuthenticated && error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}

          {isAuthenticated && isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          )}

          {isAuthenticated && !isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No matching zones.</div>
          )}

          {isAuthenticated && filtered.map((z) => {
            const notebookUrl = z.notebooklm?.notebookUrl ?? null;
            const canChat = !!notebookUrl;
            return (
              <div key={z.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{z.name}</p>
                    {z.description && (
                      <p className="text-xs text-muted-foreground truncate">{z.description}</p>
                    )}
                  </div>
                  <NotebookLMStatusBadge zoneId={z.id} />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate">📝 {z.noteCount}</p>
                  <Button
                    size="sm"
                    variant={canChat ? 'default' : 'outline'}
                    className="gap-2"
                    disabled={!canChat}
                    onClick={() => {
                      if (!notebookUrl) return;
                      props.onChatForNotebook(notebookUrl, z.name);
                    }}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Chat
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
