import { useParams, Link } from 'react-router-dom';
import { getNoteBySlug } from '@/lib/notes/noteLoader';
import { NoteLayout } from '@/components/garden/NoteLayout';
import { GardenHeader } from '@/components/garden/GardenHeader';
import { GardenFooter } from '@/components/garden/GardenFooter';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotePage() {
  const { slug } = useParams<{ slug: string }>();
  const note = slug ? getNoteBySlug(slug) : null;

  if (!note) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <GardenHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-6 animate-fade-in">
            <FileQuestion className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-foreground mb-2 font-sans">
              Note not found
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              The note "{slug ? decodeURIComponent(slug) : ''}" doesn't exist yet. In a digital garden, missing notes 
              are seeds waiting to be planted.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-sans"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to the garden
            </Link>
          </div>
        </main>
        <GardenFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GardenHeader />
      <main className="flex-1">
        <NoteLayout note={note} />
      </main>
      <GardenFooter />
    </div>
  );
}
