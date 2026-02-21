import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFullGraph } from '@/lib/notes/linkGraph';
import { useLocale } from '@/hooks/useLocale';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';

const W = 400;
const H = 250;
const REPULSION = 2000;
const ATTRACTION = 0.012;
const DAMPING = 0.82;
const CENTER_GRAVITY = 0.015;
const MIN_DIST = 20;

interface MiniNode {
  slug: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

export function KnowledgeMapPreview() {
  const { t } = useLocale();
  const graph = useMemo(() => getFullGraph(), []);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  // Init mini simulation nodes
  const simRef = useRef<MiniNode[]>([]);
  const rafRef = useRef<number>(0);
  const [, tick] = useState(0);

  useEffect(() => {
    const nodes = graph.nodes;
    const edges = graph.edges;

    const connCount = new Map<string, number>();
    for (const e of edges) {
      connCount.set(e.source, (connCount.get(e.source) || 0) + 1);
      connCount.set(e.target, (connCount.get(e.target) || 0) + 1);
    }

    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.35;

    simRef.current = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      return {
        slug: n.slug,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 15,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 15,
        vx: 0,
        vy: 0,
        connections: connCount.get(n.slug) || 0,
      };
    });

    let running = true;
    let frame = 0;

    const step = () => {
      if (!running) return;
      const sn = simRef.current;
      const n = sn.length;

      // Damping
      for (const nd of sn) { nd.vx *= DAMPING; nd.vy *= DAMPING; }

      // Repulsion
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = sn[i].x - sn[j].x;
          let dy = sn[i].y - sn[j].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < MIN_DIST) dist = MIN_DIST;
          const f = REPULSION / (dist * dist);
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          sn[i].vx += fx; sn[i].vy += fy;
          sn[j].vx -= fx; sn[j].vy -= fy;
        }
      }

      // Attraction
      const idx = new Map(sn.map((nd, i) => [nd.slug, i]));
      for (const e of edges) {
        const ai = idx.get(e.source);
        const bi = idx.get(e.target);
        if (ai === undefined || bi === undefined) continue;
        const a = sn[ai], b = sn[bi];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = dist * ATTRACTION;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center gravity
      const cxc = W / 2, cyc = H / 2;
      for (const nd of sn) {
        nd.vx += (cxc - nd.x) * CENTER_GRAVITY;
        nd.vy += (cyc - nd.y) * CENTER_GRAVITY;
        nd.x += nd.vx;
        nd.y += nd.vy;
      }

      frame++;
      if (frame % 2 === 0) tick(v => v + 1);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [graph]);

  const nodeR = useCallback((connections: number) => Math.max(3, Math.min(10, 3 + connections * 1.2)), []);

  const simNodes = simRef.current;
  const slugMap = new Map(simNodes.map(n => [n.slug, n]));

  return (
    <div className="border border-border rounded-lg p-4 bg-card transition-all duration-200">
      <div className="flex items-center gap-2 mb-4">
        <Network className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground font-sans">
          {t.index.knowledgeMap}
        </h2>
      </div>

      {/* Live mini graph */}
      <div className="bg-gradient-to-b from-background to-background/50 rounded-lg border border-border/50 mb-4 overflow-hidden hover:border-border transition-colors duration-200">
        <svg
          width="100%"
          height="250"
          viewBox={`0 0 ${W} ${H}`}
          className="block"
        >
          {/* Edges */}
          {graph.edges.map((edge, i) => {
            const s = slugMap.get(edge.source);
            const tgt = slugMap.get(edge.target);
            if (!s || !tgt) return null;
            const highlighted = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <line
                key={`e-${i}`}
                x1={s.x} y1={s.y} x2={tgt.x} y2={tgt.y}
                stroke="hsl(var(--primary))"
                strokeWidth={highlighted ? 1.5 : 0.6}
                strokeOpacity={highlighted ? 0.7 : 0.2}
              />
            );
          })}

          {/* Nodes */}
          {simNodes.map(node => {
            const isHovered = hoveredNode === node.slug;
            const r = nodeR(node.connections);
            return (
              <circle
                key={node.slug}
                cx={node.x}
                cy={node.y}
                r={isHovered ? r + 2 : r}
                fill="hsl(var(--primary))"
                fillOpacity={isHovered ? 1 : 0.85}
                stroke={isHovered ? 'hsl(var(--primary-foreground))' : 'none'}
                strokeWidth={isHovered ? 1.5 : 0}
                onMouseEnter={() => setHoveredNode(node.slug)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              />
            );
          })}
        </svg>
      </div>

      {/* Explore button */}
      <Button
        asChild
        variant="default"
        className="w-full mb-4 font-semibold transition-all duration-200 hover:shadow-md"
      >
        <Link to="/graph">{t.index.exploreGraph}</Link>
      </Button>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded-md bg-muted/50 transition-all duration-200 hover:bg-muted">
          <div className="text-sm font-semibold text-primary">{nodeCount}</div>
          <div className="text-xs text-muted-foreground">{t.common.notes}</div>
        </div>
        <div className="p-2 rounded-md bg-muted/50 transition-all duration-200 hover:bg-muted">
          <div className="text-sm font-semibold text-primary">{edgeCount}</div>
          <div className="text-xs text-muted-foreground">{t.index.connections}</div>
        </div>
      </div>
    </div>
  );
}
