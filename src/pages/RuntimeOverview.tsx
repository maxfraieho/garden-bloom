import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bot, Play, Clock, Network, FileText, Tag, Layers, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BloomRuntimeHeader } from '@/components/runtime/BloomRuntimeHeader';
import { BloomRuntimeFooter } from '@/components/runtime/BloomRuntimeFooter';
import { KnowledgeMapPreview } from '@/components/garden/KnowledgeMapPreview';
import { NoteCard } from '@/components/garden/NoteCard';
import { getAllNotes } from '@/lib/notes/noteLoader';
import { getOutboundLinks, getFullGraph } from '@/lib/notes/linkGraph';
import { getAllTags } from '@/lib/notes/tagResolver';

export default function RuntimeOverview() {
  const notes = getAllNotes();
  const graph = useMemo(() => getFullGraph(), []);
  const tags = useMemo(() => getAllTags(), []);

  const recentDefinitions = useMemo(() => {
    return notes.slice(0, 4).map((note) => {
      const outbound = getOutboundLinks(note.slug);
      const preview = note.content
        .replace(/^#.*$/gm, '')
        .replace(/\[\[.*?\]\]/g, '')
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, 80);
      return {
        slug: note.slug,
        title: note.title,
        date: note.frontmatter.updated || note.frontmatter.created,
        preview,
        tags: note.frontmatter.tags || [],
        connectionCount: outbound.length,
      };
    });
  }, [notes]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BloomRuntimeHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Runtime Status Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-sans">Runtime Status</div>
                <div className="text-sm font-semibold text-foreground font-sans flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-sans">Connected Agents</div>
                <div className="text-sm font-semibold text-foreground font-sans">0</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-sans">Active Runs</div>
                <div className="text-sm font-semibold text-foreground font-sans">0</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-sans">Last Execution</div>
                <div className="text-sm font-semibold text-foreground font-sans">—</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Execution Graph + Behavioral Domains */}
          <div className="lg:col-span-5 space-y-6">
            {/* Execution Graph Preview */}
            <KnowledgeMapPreview />

            {/* Behavioral Domains (Tags) */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Behavioral Domains
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tags.slice(0, 12).map((tag) => (
                    <Link
                      key={tag.tag}
                      to={`/tags/${encodeURIComponent(tag.tag)}`}
                      className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-transparent hover:border-primary/30 transition-all font-sans"
                    >
                      {tag.tag}
                      <span className="ml-1 text-primary/60">({tag.noteCount})</span>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/tags"
                  className="text-xs text-primary hover:underline font-sans flex items-center gap-1"
                >
                  All domains <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>

            {/* System Stats */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-semibold text-primary font-sans">{notes.length}</div>
                    <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Definitions</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-primary font-sans">{graph.edges.length}</div>
                    <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Exec Paths</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-primary font-sans">{tags.length}</div>
                    <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Domains</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Recent Definitions + Runtime sections */}
          <div className="lg:col-span-7 space-y-6">
            {/* Recent Behavioral Definitions */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold font-sans flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Recent Definitions
                  </CardTitle>
                  <Link to="/files" className="text-xs text-primary hover:underline font-sans flex items-center gap-1">
                    All definitions <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recentDefinitions.map((note) => (
                    <NoteCard
                      key={note.slug}
                      slug={note.slug}
                      title={note.title}
                      date={note.date}
                      preview={note.preview}
                      tags={note.tags}
                      connectionCount={note.connectionCount}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Runtime Quick Access */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/agents">
                <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Bot className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <div className="text-sm font-semibold text-foreground font-sans">Agents</div>
                      <div className="text-xs text-muted-foreground font-sans">Manage runtime agents</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/runtime/execution">
                <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Play className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <div className="text-sm font-semibold text-foreground font-sans">Execution</div>
                      <div className="text-xs text-muted-foreground font-sans">Active flows & runs</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/runtime/history">
                <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <div className="text-sm font-semibold text-foreground font-sans">History</div>
                      <div className="text-xs text-muted-foreground font-sans">Execution history</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/runtime/artifacts">
                <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Layers className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <div className="text-sm font-semibold text-foreground font-sans">Artifacts</div>
                      <div className="text-xs text-muted-foreground font-sans">Generated outputs</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <BloomRuntimeFooter />
    </div>
  );
}
