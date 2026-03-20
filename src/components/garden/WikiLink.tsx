import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getNoteBySlug } from '@/lib/notes/noteLoader';

interface WikiLinkProps {
  slug: string;
  displayText: string;
  exists: boolean;
  className?: string;
}

export function WikiLink({ slug, displayText, exists, className }: WikiLinkProps) {
  if (exists) {
    // Resolve the actual note slug for navigation
    const note = getNoteBySlug(slug);
    const navSlug = note ? note.slug : slug;
    // Decode slug for URL path (avoid double-encoding)
    const decodedSlug = decodeURIComponent(navSlug);

    return (
      <Link
        to={`/notes/${decodedSlug}`}
        className={cn('wiki-link', className)}
        title={`Navigate to: ${displayText}`}
      >
        {displayText}
      </Link>
    );
  }

  // Broken/missing link styling
  return (
    <span
      className={cn('wiki-link-broken', className)}
      title={`Note not found: ${decodeURIComponent(slug)}`}
    >
      {displayText}
    </span>
  );
}
