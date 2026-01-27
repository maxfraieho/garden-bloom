import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { NotebookLMChat } from '@/hooks/useNotebookLMChats';

export function NotebookLMChatsWall(props: {
  chats: NotebookLMChat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
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
        <div className="p-2 space-y-2 animate-fade-in">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No chats yet.</div>
          ) : (
            filtered.map((c) => {
              const active = c.id === props.activeChatId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    'group rounded-md border border-border p-2 flex items-start gap-2 cursor-pointer transition-colors',
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
            })
          )}
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
