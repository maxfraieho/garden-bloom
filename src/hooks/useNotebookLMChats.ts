import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

export type NotebookLMChatStatus = 'active' | 'archived';

export type NotebookLMChat = {
  id: string;
  title: string;
  notebookUrl: string;
  createdAt: number;
  updatedAt: number;
  status?: NotebookLMChatStatus;
  // Optional zone context (may be set when creating from a zone)
  zoneId?: string;
  zoneName?: string;
  zoneExpiresAt?: number;
  accessType?: 'web' | 'mcp' | 'both';
};

export type NotebookLMMessage = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

const chatSchema = z.object({
  title: z.string().trim().min(1).max(80),
  notebookUrl: z.string().trim().url(),
});

const STORAGE_CHATS = 'notebooklm:chats:v1';
const STORAGE_MSG_PREFIX = 'notebooklm:messages:v1:';

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useNotebookLMChats() {
  const [chats, setChats] = useState<NotebookLMChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NotebookLMMessage[]>([]);

  // Load chats list once
  useEffect(() => {
    const stored = readJson<NotebookLMChat[]>(STORAGE_CHATS);
    if (Array.isArray(stored)) {
      const sorted = [...stored].sort((a, b) => b.updatedAt - a.updatedAt);
      setChats(sorted);
      setActiveChatId(sorted[0]?.id ?? null);
    }
  }, []);

  // Load messages for active chat
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const stored = readJson<NotebookLMMessage[]>(`${STORAGE_MSG_PREFIX}${activeChatId}`);
    setMessages(Array.isArray(stored) ? stored : []);
  }, [activeChatId]);

  const persistChats = useCallback((next: NotebookLMChat[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    setChats(sorted);
    writeJson(STORAGE_CHATS, sorted);
  }, []);

  const persistMessages = useCallback((chatId: string, next: NotebookLMMessage[]) => {
    setMessages(next);
    writeJson(`${STORAGE_MSG_PREFIX}${chatId}`, next);
  }, []);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const createChat = useCallback((input: { title: string; notebookUrl: string }) => {
    const parsed = chatSchema.parse(input);
    const now = Date.now();
    const chat: NotebookLMChat = {
      id: genId('nlmchat'),
      title: parsed.title,
      notebookUrl: parsed.notebookUrl,
      createdAt: now,
      updatedAt: now,
    };
    persistChats([chat, ...chats]);
    setActiveChatId(chat.id);
    persistMessages(chat.id, []);
    return chat;
  }, [chats, persistChats, persistMessages]);

  const deleteChat = useCallback((chatId: string) => {
    const next = chats.filter((c) => c.id !== chatId);
    persistChats(next);
    try {
      localStorage.removeItem(`${STORAGE_MSG_PREFIX}${chatId}`);
    } catch {
      // ignore
    }
    if (activeChatId === chatId) {
      setActiveChatId(next[0]?.id ?? null);
    }
  }, [chats, persistChats, activeChatId]);

  const renameChat = useCallback((chatId: string, title: string) => {
    const nextTitle = z.string().trim().min(1).max(80).parse(title);
    const now = Date.now();
    persistChats(
      chats.map((c) => (c.id === chatId ? { ...c, title: nextTitle, updatedAt: now } : c))
    );
  }, [chats, persistChats]);

  const ensureChatForNotebook = useCallback((opts: { notebookUrl: string; suggestedTitle?: string }) => {
    const notebookUrl = z.string().trim().url().parse(opts.notebookUrl);
    const existing = chats.find((c) => c.notebookUrl === notebookUrl);
    if (existing) {
      setActiveChatId(existing.id);
      return existing;
    }
    const title = (opts.suggestedTitle ?? 'Notebook chat').trim() || 'Notebook chat';
    return createChat({ title, notebookUrl });
  }, [chats, createChat]);

  const appendMessage = useCallback((msg: Omit<NotebookLMMessage, 'id' | 'createdAt'>) => {
    const now = Date.now();
    const message: NotebookLMMessage = {
      id: genId('nlmmsg'),
      createdAt: now,
      ...msg,
    };
    const chatId = msg.chatId;
    const nextMsgs = [...messages, message];
    persistMessages(chatId, nextMsgs);
    // bump chat updatedAt
    persistChats(
      chats.map((c) => (c.id === chatId ? { ...c, updatedAt: now } : c))
    );
    return message;
  }, [messages, persistMessages, chats, persistChats]);

  const clearMessages = useCallback((chatId: string) => {
    persistMessages(chatId, []);
    const now = Date.now();
    persistChats(chats.map((c) => (c.id === chatId ? { ...c, updatedAt: now } : c)));
  }, [persistMessages, chats, persistChats]);

  return {
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
  };
}
