import { Link } from 'react-router-dom';
import { Link as LinkIcon, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NoteCardProps {
  slug: string;
  title: string;
  date?: string;
  preview?: string;
  tags?: string[];
  connectionCount?: number;
}

export function NoteCard({
  slug,
  title,
  date,
  preview,
  tags = [],
  connectionCount = 0,
}: NoteCardProps) {
  return (
    <Link
      to={`/notes/${slug}`}
      className="block border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow duration-200"
    >
      {/* Title */}
      <h3 className="text-primary font-semibold text-base mb-1 font-sans">
        {title}
      </h3>

      {/* Date */}
      {date && (
        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
          <Calendar className="w-3 h-3" />
          <span>{date}</span>
        </div>
      )}

      {/* Preview text */}
      {preview && (
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {preview}...
        </p>
      )}

      {/* Tags and connection count */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs bg-primary/10 text-primary border-0 px-2 py-0.5"
            >
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge
              variant="secondary"
              className="text-xs bg-muted text-muted-foreground border-0 px-2 py-0.5"
            >
              +{tags.length - 2}
            </Badge>
          )}
        </div>

        {connectionCount > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <LinkIcon className="w-3 h-3" />
            <span>{connectionCount}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
