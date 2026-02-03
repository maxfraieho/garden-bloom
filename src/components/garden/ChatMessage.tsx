import { ChatMessage as ChatMessageType } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
  showTimestamp?: boolean;
}

export function formatMessageDate(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMMM yyyy', { locale: uk });
}

export function shouldShowDateSeparator(
  currentMsg: ChatMessageType,
  prevMsg: ChatMessageType | undefined
): boolean {
  if (!prevMsg) return true;
  return !isSameDay(new Date(currentMsg.createdAt), new Date(prevMsg.createdAt));
}

export function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
        {formatMessageDate(date)}
      </div>
    </div>
  );
}

export function ChatMessage({ message, isOwn, showTimestamp = true }: ChatMessageProps) {
  const { participant, content, createdAt, status } = message;
  const messageDate = new Date(createdAt);

  return (
    <div
      className={cn(
        'flex gap-2 sm:gap-3 mb-3 sm:mb-4',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-lg',
          participant.isAI
            ? 'bg-primary/10 text-primary'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {participant.avatar || (participant.isAI ? <Bot className="h-4 w-4 sm:h-5 sm:w-5" /> : <User className="h-4 w-4 sm:h-5 sm:w-5" />)}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col max-w-[80%] sm:max-w-[75%]',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 sm:px-4 text-sm relative group',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted rounded-bl-sm',
            status === 'sending' && 'opacity-70'
          )}
        >
          {participant.isAI ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Footer: name + timestamp - always visible on mobile */}
        {showTimestamp && (
          <div
            className={cn(
              'flex items-center gap-1.5 mt-1 text-[10px] sm:text-xs text-muted-foreground',
              isOwn ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <span className="font-medium truncate max-w-[100px] sm:max-w-none">
              {participant.name}
              {participant.isAI && <span className="ml-0.5">🤖</span>}
            </span>
            <span className="opacity-70">·</span>
            <span className="tabular-nums">{format(messageDate, 'HH:mm')}</span>
          </div>
        )}

        {/* Status indicator */}
        {status === 'sending' && (
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Sending...</span>
          </div>
        )}
        {status === 'failed' && (
          <div className="mt-1 text-[10px] sm:text-xs text-destructive">
            Failed to send
          </div>
        )}
      </div>
    </div>
  );
}
