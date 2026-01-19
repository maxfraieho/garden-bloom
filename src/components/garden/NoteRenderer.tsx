import { useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WikiLink } from './WikiLink';
import { noteExists } from '@/lib/notes/noteLoader';
import { useScrollToMatch } from '@/hooks/useSearchHighlight';
import type { Note } from '@/lib/notes/types';
import type { Components } from 'react-markdown';

interface NoteRendererProps {
  note: Note;
}

// Regex to find our wikilink markers in the transformed content
const WIKILINK_MARKER_REGEX = /%%WIKILINK:([^:]+):([^:]+):(true|false)%%/g;

/**
 * Transform markdown content to replace wikilinks with markers,
 * then use custom rendering for those markers
 */
function transformContent(content: string): string {
  // Replace [[target|alias]] or [[target]] with markers
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  
  return content.replace(wikilinkRegex, (match, target, alias) => {
    const slug = target
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
    
    const displayText = alias?.trim() || target.trim();
    const exists = noteExists(slug);
    
    // Return marker that we'll parse in the text renderer
    return `%%WIKILINK:${slug}:${encodeURIComponent(displayText)}:${exists}%%`;
  });
}

/**
 * Highlight search query in text
 */
function highlightText(text: string, query: string | null): (string | JSX.Element)[] {
  if (!query) return [text];
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let searchIndex = 0;
  
  while ((searchIndex = lowerText.indexOf(lowerQuery, lastIndex)) !== -1) {
    // Add text before match
    if (searchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, searchIndex));
    }
    
    // Add highlighted match
    const matchedText = text.slice(searchIndex, searchIndex + query.length);
    parts.push(
      <mark
        key={`highlight-${searchIndex}`}
        className="bg-primary/30 text-foreground rounded px-0.5 search-highlight"
      >
        {matchedText}
      </mark>
    );
    
    lastIndex = searchIndex + query.length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

/**
 * Parse text content and replace wikilink markers with React components
 */
function parseTextWithWikilinks(text: string, query: string | null): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex
  WIKILINK_MARKER_REGEX.lastIndex = 0;
  
  while ((match = WIKILINK_MARKER_REGEX.exec(text)) !== null) {
    // Add text before the match (with highlighting)
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      parts.push(...highlightText(textBefore, query));
    }
    
    // Add the WikiLink component
    const slug = match[1];
    const displayText = decodeURIComponent(match[2]);
    const exists = match[3] === 'true';
    
    parts.push(
      <WikiLink
        key={`${slug}-${match.index}`}
        slug={slug}
        displayText={displayText}
        exists={exists}
      />
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text (with highlighting)
  if (lastIndex < text.length) {
    parts.push(...highlightText(text.slice(lastIndex), query));
  }
  
  return parts;
}

export function NoteRenderer({ note }: NoteRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { query } = useScrollToMatch(contentRef);
  const transformedContent = useMemo(() => transformContent(note.content), [note.content]);

  /**
   * Process children recursively to handle wikilinks and highlighting in any text node
   */
  function processChildren(children: React.ReactNode): React.ReactNode {
    if (!children) return children;
    
    if (typeof children === 'string') {
      const parts = parseTextWithWikilinks(children, query);
      return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
    }
    
    if (Array.isArray(children)) {
      return children.map((child, index) => {
        if (typeof child === 'string') {
          const parts = parseTextWithWikilinks(child, query);
          return parts.length === 1 && typeof parts[0] === 'string' 
            ? parts[0] 
            : <span key={index}>{parts}</span>;
        }
        return child;
      });
    }
    
    return children;
  }

  // Custom components for react-markdown
  const components: Components = useMemo(() => ({
    // Override text rendering to handle wikilinks and highlighting
    p: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <p {...props}>{processedChildren}</p>;
    },
    li: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <li {...props}>{processedChildren}</li>;
    },
    strong: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <strong {...props}>{processedChildren}</strong>;
    },
    em: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <em {...props}>{processedChildren}</em>;
    },
    h1: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <h1 {...props}>{processedChildren}</h1>;
    },
    h2: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <h2 {...props}>{processedChildren}</h2>;
    },
    h3: ({ children, ...props }) => {
      const processedChildren = processChildren(children);
      return <h3 {...props}>{processedChildren}</h3>;
    },
  }), [query]);

  return (
    <article ref={contentRef} className="prose-garden animate-fade-in">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {transformedContent}
      </ReactMarkdown>
    </article>
  );
}
