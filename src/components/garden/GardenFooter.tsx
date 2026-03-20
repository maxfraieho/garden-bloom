import { FileText, Tag, Link as LinkIcon, Clock } from 'lucide-react';
import { getAllNotes } from '@/lib/notes/noteLoader';
import { getAllTags } from '@/lib/notes/tagResolver';
import { getFullGraph } from '@/lib/notes/linkGraph';
import { useMemo } from 'react';
import { useLocale } from '@/hooks/useLocale';

export function GardenFooter() {
  const { t } = useLocale();

  const stats = useMemo(() => {
    const notes = getAllNotes();
    const tags = getAllTags();
    const graph = getFullGraph();

    return {
      notesCount: notes.length,
      tagsCount: tags.length,
      connectionsCount: graph.edges.length,
    };
  }, []);

  const lastUpdated = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <footer className="border-t border-border bg-card py-4 mt-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>{stats.notesCount} definitions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            <span>{stats.tagsCount} domains</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{stats.connectionsCount} execution paths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{lastUpdated}</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground/60 font-sans tracking-wider uppercase">
          Powered by BLOOM Runtime — Bespoke Logic Orchestration & Operational Machines
        </div>
      </div>
    </footer>
  );
}
