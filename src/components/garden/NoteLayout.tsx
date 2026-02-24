import type { Note } from '@/lib/notes/types';
import { NoteRenderer } from './NoteRenderer';
import { BacklinksSection } from './BacklinksSection';
import { TagLink } from './TagLink';
import { LocalGraphView } from './LocalGraphView';
import { CommentSection } from './CommentSection';
import { AnnotationLayer } from './AnnotationLayer';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { MemoryPanel } from './MemoryPanel';
import { useLocalGraph } from '@/hooks/useBacklinks';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Pencil, ChevronRight, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoteLayoutProps {
  note: Note;
}

export function NoteLayout({ note }: NoteLayoutProps) {
  const { frontmatter } = note;
  const created = frontmatter.created ? new Date(frontmatter.created as string) : null;
  const updated = frontmatter.updated ? new Date(frontmatter.updated as string) : null;
  const tags = (frontmatter.tags as string[]) || [];
  const localGraph = useLocalGraph(note.slug);
  const { isAuthenticated } = useOwnerAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* Breadcrumb navigation */}
      <nav className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground font-sans flex-wrap min-w-0">
          {(() => {
            const decodedSlug = decodeURIComponent(note.slug);
            const segments = decodedSlug.split('/');
            const folderSegments = segments.slice(0, -1);
            const crumbs: { label: string; path: string }[] = [];

            // Root crumb always links to /files
            crumbs.push({ label: '📁 Files', path: '/files' });

            // Folder crumbs link to /files?folder=<encoded path>
            let accumulated = '';
            for (const seg of folderSegments) {
              accumulated = accumulated ? `${accumulated}/${seg}` : seg;
              crumbs.push({ label: seg, path: `/files?folder=${encodeURIComponent(accumulated)}` });
            }

            return crumbs.map((crumb, i) => (
              <span key={crumb.path} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                <Link
                  to={crumb.path}
                  className="hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-none"
                  title={crumb.label}
                >
                  {crumb.label}
                </Link>
              </span>
            ));
          })()}
          <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <span className="text-foreground font-medium truncate">{note.title}</span>
        </div>
        
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <MemoryPanel initialQuery={note.title} />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to={`/notes/${note.slug}/edit`}>
                <Pencil className="w-4 h-4" />
                <span>Edit</span>
              </Link>
            </Button>
            <DeleteNoteDialog noteSlug={note.slug} noteTitle={note.title} />
          </div>
        )}
      </nav>

      {/* Note header */}
      <header className="mb-8 pb-6 border-b border-border">
        <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-4 tracking-tight">
          {note.title}
        </h1>
        
        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-sans">
          {created && (
            <span>
              Planted: {format(created, 'MMM d, yyyy')}
            </span>
          )}
          {updated && updated.getTime() !== created?.getTime() && (
            <span>
              Tended: {format(updated, 'MMM d, yyyy')}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {tags.map((tag) => (
              <TagLink key={tag} tag={tag} />
            ))}
          </div>
        )}
      </header>

      {/* Note content with annotation layer */}
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <AnnotationLayer articleSlug={note.slug}>
          <NoteRenderer note={note} />
        </AnnotationLayer>
      </article>
      
      {/* Backlinks */}
      <BacklinksSection noteSlug={note.slug} />
      
      {/* Local Graph */}
      {localGraph && (localGraph.inbound.length > 0 || localGraph.outbound.length > 0) && (
        <section className="mt-12 p-6 bg-card rounded-lg border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4 font-sans">
            Execution Paths
          </h2>
          <LocalGraphView graph={localGraph} />
        </section>
      )}

      {/* Comments Section */}
      <CommentSection articleSlug={note.slug} />
    </div>
  );
}
