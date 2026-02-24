import { FileText, Tag, Network, Clock } from 'lucide-react';
import { getAllNotes } from '@/lib/notes/noteLoader';
import { getAllTags } from '@/lib/notes/tagResolver';
import { getFullGraph } from '@/lib/notes/linkGraph';
import { useMemo } from 'react';

export function BloomRuntimeFooter() {
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
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-3">
        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground font-sans">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>{stats.notesCount} definitions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            <span>{stats.tagsCount} domains</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5" />
            <span>{stats.connectionsCount} execution paths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{lastUpdated}</span>
          </div>
        </div>

        {/* BLOOM branding */}
        <div className="text-[10px] text-muted-foreground/60 font-sans tracking-wider uppercase">
          Powered by BLOOM Runtime — Behavioral Logic Orchestration for Order-Made Systems
        </div>
      </div>
    </footer>
  );
}
