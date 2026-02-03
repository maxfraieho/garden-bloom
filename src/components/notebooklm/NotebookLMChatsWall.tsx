import { useMemo, useState } from 'react';
import { Plus, Trash2, MessageSquare, Archive, Clock, Globe, Laptop, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { NotebookLMChat, NotebookLMChatStatus } from '@/hooks/useNotebookLMChats';

type TabFilter = 'active' | 'archived' | 'all';

function ChatSkeleton() {
  return (
    <div className="rounded-md border border-border p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md shrink-0" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

function EmptyChatsState({ onNew, tab }: { onNew: () => void; tab: TabFilter }) {
  const messages: Record<TabFilter, { title: string; desc: string }> = {
    active: { title: 'No active chats', desc: 'Start a conversation with your notebook' },
    archived: { title: 'No archived chats', desc: 'Archived chats will appear here' },
    all: { title: 'No chats yet', desc: 'Start a conversation with your notebook' },
  };

  const { title, desc } = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {tab === 'archived' ? (
          <Archive className="h-6 w-6 text-muted-foreground" />
        ) : (
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {tab !== 'archived' && (
        <Button size="sm" variant="outline" className="gap-2" onClick={onNew}>
          <Plus className="h-4 w-4" />
          Start chat
        </Button>
      )}
    </div>
  );
}

function AccessTypeBadge({ type }: { type?: 'web' | 'mcp' | 'both' }) {
  if (!type) return null;

  const config = {
    web: { icon: Globe, label: 'Web' },
    mcp: { icon: Laptop, label: 'MCP' },
    both: { icon: Globe, label: 'Both' },
  };

  const { icon: Icon, label } = config[type];

  return (
    <Badge variant="outline" className="gap-1 text-[10px] h-5 px-1.5">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function ZoneTTLBadge({ expiresAt }: { expiresAt?: number }) {
  if (!expiresAt) return null;

  const now = Date.now();
  const isExpired = expiresAt < now;
  const remaining = expiresAt - now;
  const isUrgent = remaining < 6 * 60 * 60 * 1000; // < 6 hours

  return (
    <Badge
      variant={isExpired ? 'destructive' : isUrgent ? 'secondary' : 'outline'}
      className={cn(
        'gap-1 text-[10px] h-5 px-1.5',
        isUrgent && !isExpired && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
      )}
    >
      <Clock className="h-3 w-3" />
      {isExpired ? 'Expired' : formatDistanceToNow(expiresAt, { addSuffix: false, locale: uk })}
    </Badge>
  );
}

function ChatCard({
  chat,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  chat: NotebookLMChat;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const lastActivity = formatDistanceToNow(chat.updatedAt, { addSuffix: true, locale: uk });

  return (
    <div
      className={cn(
        'group rounded-md border border-border p-2.5 cursor-pointer transition-colors animate-fade-in',
        isActive ? 'bg-muted border-primary/50' : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            className="w-full bg-transparent text-sm font-medium outline-none truncate"
            value={chat.title}
            onChange={(e) => onRename(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
            {chat.notebookUrl}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {chat.zoneName && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 max-w-[100px] truncate">
            {chat.zoneName}
          </Badge>
        )}
        <AccessTypeBadge type={chat.accessType} />
        <ZoneTTLBadge expiresAt={chat.zoneExpiresAt} />

        {/* Last activity - push to end */}
        <span className="text-[10px] text-muted-foreground ml-auto">{lastActivity}</span>
      </div>
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
  onArchive?: (id: string) => void;
  isLoading?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabFilter>('active');
  const [toDelete, setToDelete] = useState<NotebookLMChat | null>(null);

  // Count by status
  const counts = useMemo(() => {
    const active = props.chats.filter((c) => c.status !== 'archived').length;
    const archived = props.chats.filter((c) => c.status === 'archived').length;
    return { active, archived, all: props.chats.length };
  }, [props.chats]);

  // Filter by tab and search
  const filtered = useMemo(() => {
    let list = props.chats;

    // Filter by tab
    if (tab === 'active') {
      list = list.filter((c) => c.status !== 'archived');
    } else if (tab === 'archived') {
      list = list.filter((c) => c.status === 'archived');
    }

    // Filter by search
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const hay = `${c.title} ${c.zoneName || ''} ${c.notebookUrl}`.toLowerCase();
        return hay.includes(q);
      });
    }

    return list;
  }, [props.chats, tab, query]);

  return (
    <Card className={cn('flex flex-col overflow-hidden', props.className)}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">Notebook chats</p>
          <p className="text-xs text-muted-foreground truncate">Saved locally</p>
        </div>
        <Button size="sm" onClick={props.onNew} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2 border-b">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
          <TabsList className="h-8 w-full grid grid-cols-3">
            <TabsTrigger value="active" className="text-xs h-7 gap-1">
              Active
              {counts.active > 0 && (
                <span className="text-[10px] text-muted-foreground">({counts.active})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs h-7 gap-1">
              Archived
              {counts.archived > 0 && (
                <span className="text-[10px] text-muted-foreground">({counts.archived})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs h-7 gap-1">
              All
              {counts.all > 0 && (
                <span className="text-[10px] text-muted-foreground">({counts.all})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Chat list */}
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
            <EmptyChatsState onNew={props.onNew} tab={tab} />
          )}

          {!props.isLoading && filtered.length === 0 && query && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No matching chats.
            </div>
          )}

          {!props.isLoading &&
            filtered.map((c) => (
              <ChatCard
                key={c.id}
                chat={c}
                isActive={c.id === props.activeChatId}
                onSelect={() => props.onSelect(c.id)}
                onDelete={() => setToDelete(c)}
                onRename={(title) => props.onRename(c.id, title)}
              />
            ))}
        </div>
      </ScrollArea>

      {/* Delete confirmation */}
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
