import { useMemo, useState } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { NotebookLMChat } from '@/hooks/useNotebookLMChats';

function ChatSkeleton() {
  return (
    <div className="rounded-md border border-border p-2 flex items-start gap-2">
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="h-8 w-8 rounded-md shrink-0" />
    </div>
  );
}

function EmptyChatsState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No chats yet</p>
        <p className="text-xs text-muted-foreground">Start a conversation with your notebook</p>
      </div>
      <Button size="sm" variant="outline" className="gap-2" onClick={onNew}>
        <Plus className="h-4 w-4" />
        Start chat
      </Button>
    </div>
  );
}

export function NotebookLMChatsWall(props: {
  chats: NotebookLMChat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isLoading?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<NotebookLMChat | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.chats;
    return props.chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [props.chats, query]);

  return (
    <Card className={cn('flex flex-col overflow-hidden', props.className)}>
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">Notebook chats</p>
          <p className="text-xs text-muted-foreground truncate">Saved locally</p>
        </div>
        <Button size="sm" onClick={props.onNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <div className="p-3 border-b">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {props.isLoading && (
            <>
              <ChatSkeleton />
              <ChatSkeleton />
              <ChatSkeleton />
            </>
          )}

          {!props.isLoading && filtered.length === 0 && !query && (
            <EmptyChatsState onNew={props.onNew} />
          )}

          {!props.isLoading && filtered.length === 0 && query && (
            <div className="p-4 text-sm text-muted-foreground text-center">No matching chats.</div>
          )}

          {!props.isLoading &&
            filtered.map((c) => {
              const active = c.id === props.activeChatId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    'group rounded-md border border-border p-2 flex items-start gap-2 cursor-pointer transition-colors animate-fade-in',
                    active ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                  onClick={() => props.onSelect(c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <input
                      className={cn(
                        'w-full bg-transparent text-sm font-medium outline-none',
                        active ? 'text-foreground' : 'text-foreground'
                      )}
                      value={c.title}
                      onChange={(e) => props.onRename(c.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-xs text-muted-foreground truncate">{c.notebookUrl}</p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(c);
                    }}
                    title="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the chat and its messages from this browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) props.onDelete(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
