import { ChatMessage as ChatMessageType, ChatParticipant } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
  const { participant, content, createdAt, status } = message;

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg',
          participant.isAI
            ? 'bg-primary/10 text-primary'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {participant.avatar || (participant.isAI ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />)}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col max-w-[75%]',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-2 mb-1 text-xs text-muted-foreground',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}>
          <span className="font-medium">
            {participant.name}
            {participant.isAI && (
              <span className="ml-1 text-primary">🤖</span>
            )}
          </span>
          <span>{format(new Date(createdAt), 'HH:mm')}</span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm',
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

        {/* Status indicator */}
        {status === 'sending' && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Sending...</span>
          </div>
        )}
        {status === 'failed' && (
          <div className="mt-1 text-xs text-destructive">
            Failed to send
          </div>
        )}
      </div>
    </div>
  );
}
