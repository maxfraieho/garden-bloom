import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NewNotebookLMChatDialog } from '@/components/notebooklm/NewNotebookLMChatDialog';
import { NotebookLMChatsWall } from '@/components/notebooklm/NotebookLMChatsWall';
import { NotebookLMZonesWall } from '@/components/notebooklm/NotebookLMZonesWall';
import { NotebookLMChatPanel } from '@/components/notebooklm/NotebookLMChatPanel';
import { useNotebookLMChats } from '@/hooks/useNotebookLMChats';

function notImplementedMessage(kind: 'answer' | 'summary' | 'study_guide' | 'flashcards') {
  switch (kind) {
    case 'summary':
      return '🧾 **Підсумок**\n\n(Поки що чат із NotebookLM у цьому інтерфейсі не підключено. Можна відкривати сам NotebookLM за посиланням зони.)';
    case 'study_guide':
      return '📘 **Навчальний план**\n\n(Поки що чат із NotebookLM у цьому інтерфейсі не підключено. Можна відкривати сам NotebookLM за посиланням зони.)';
    case 'flashcards':
      return '🃏 **Флешкарти**\n\n(Поки що чат із NotebookLM у цьому інтерфейсі не підключено. Можна відкривати сам NotebookLM за посиланням зони.)';
    default:
      return '⚠️ Поки що чат із NotebookLM у цьому інтерфейсі не підключено (лише список зон + локальна історія).';
  }
}

export function NotebookLMChatTab({ className }: { className?: string }) {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    activeChat,
    messages,
    createChat,
    deleteChat,
    renameChat,
    ensureChatForNotebook,
    appendMessage,
    clearMessages,
  } = useNotebookLMChats();

  const [newOpen, setNewOpen] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined);

  const canClear = !!activeChat && messages.length > 0;

  const titleForNew = useMemo(() => {
    const n = chats.length + 1;
    return `Notebook chat ${n}`;
  }, [chats.length]);

  return (
    <div className={cn('h-full grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-4', className)}>
      <NotebookLMChatsWall
        chats={chats}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
        onNew={() => {
          setInitialUrl(undefined);
          setNewOpen(true);
        }}
        onDelete={(id) => {
          deleteChat(id);
          toast.success('Chat deleted');
        }}
        onRename={(id, title) => {
          try {
            renameChat(id, title);
          } catch {
            // ignore until valid
          }
        }}
        className="h-full"
      />

      <NotebookLMChatPanel
        chat={activeChat}
        messages={messages}
        onSend={(content) => {
          if (!activeChat) return;
          const trimmed = content.trim();
          if (!trimmed) return;
          appendMessage({ chatId: activeChat.id, role: 'user', content: trimmed });
          appendMessage({ chatId: activeChat.id, role: 'assistant', content: notImplementedMessage('answer') });
        }}
        onQuickAction={(kind) => {
          if (!activeChat) return;
          appendMessage({ chatId: activeChat.id, role: 'assistant', content: notImplementedMessage(kind) });
        }}
        onClear={() => {
          if (!activeChat || !canClear) return;
          clearMessages(activeChat.id);
          toast.success('Cleared');
        }}
        className="h-full"
      />

      <NotebookLMZonesWall
        onChatForNotebook={(notebookUrl, suggestedTitle) => {
          const chat = ensureChatForNotebook({ notebookUrl, suggestedTitle });
          setActiveChatId(chat.id);
          toast.success('Chat opened');
        }}
        className="h-full"
      />

      <NewNotebookLMChatDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        initialNotebookUrl={initialUrl}
        onCreate={({ title, notebookUrl }) => {
          try {
            createChat({ title: title || titleForNew, notebookUrl });
            toast.success('Chat created');
          } catch (e) {
            toast.error('Invalid input');
          }
        }}
      />
    </div>
  );
}
