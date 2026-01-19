import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAllTags } from '@/hooks/useTags';
import { useLocale } from '@/hooks/useLocale';

interface TagCloudProps {
  maxTags?: number;
}

export function TagCloud({ maxTags = 15 }: TagCloudProps) {
  const allTags = useAllTags();
  const { t } = useLocale();
  
  // Sort by count descending, then take top N
  const topTags = [...allTags]
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, maxTags);

  if (topTags.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground font-sans">
            {t.index.browseTags}
          </h2>
        </div>
        <p className="text-muted-foreground text-sm">{t.tags.noTagsYet}</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground font-sans">
          {t.index.browseTags}
        </h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {topTags.map((tag) => (
          <Link key={tag.tag} to={`/tags/${encodeURIComponent(tag.tag)}`}>
            <Badge
              variant="secondary"
              className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0 px-2.5 py-1 cursor-pointer transition-colors"
            >
              {tag.tag}
              <span className="ml-1.5 text-muted-foreground">({tag.noteCount})</span>
            </Badge>
          </Link>
        ))}
      </div>

      <Link
        to="/tags"
        className="inline-block mt-4 text-sm text-primary hover:underline"
      >
        {t.tags.viewAllTags}
      </Link>
    </div>
  );
}
