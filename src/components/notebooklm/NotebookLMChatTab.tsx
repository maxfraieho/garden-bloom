import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NewNotebookLMChatDialog } from '@/components/notebooklm/NewNotebookLMChatDialog';
import { NotebookLMChatsWall } from '@/components/notebooklm/NotebookLMChatsWall';
import { NotebookLMZonesWall } from '@/components/notebooklm/NotebookLMZonesWall';
import { NotebookLMChatPanel } from '@/components/notebooklm/NotebookLMChatPanel';
import { useNotebookLMChats } from '@/hooks/useNotebookLMChats';

function stubAssistant(kind: 'answer' | 'summary' | 'study_guide' | 'flashcards') {
  switch (kind) {
    case 'summary':
      return '🧾 **Summary (stub)**\n\n(Поки що це UI-заготовка. Далі підключимо реальний чат до NotebookLM через gateway.)';
    case 'study_guide':
      return '📘 **Study guide (stub)**\n\n- Key concepts…\n- Questions…\n\n(Далі буде реальна генерація.)';
    case 'flashcards':
      return '🃏 **Flashcards (stub)**\n\n1. Q: …\n   A: …\n\n(Далі буде реальна генерація.)';
    default:
      return '🤖 (stub) NotebookLM chat backend is not connected yet. UI is ready; next step is wiring the gateway endpoint.';
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
          // MVP: local stub assistant reply
          appendMessage({ chatId: activeChat.id, role: 'assistant', content: stubAssistant('answer') });
        }}
        onQuickAction={(kind) => {
          if (!activeChat) return;
          appendMessage({ chatId: activeChat.id, role: 'assistant', content: stubAssistant(kind) });
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
