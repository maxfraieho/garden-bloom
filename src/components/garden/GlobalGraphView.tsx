// Global graph visualization — interactive force-directed layout
// Nodes are draggable, the graph uses physics simulation (repulsion + attraction)

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/hooks/useLocale';
import type { GraphNode, GraphEdge } from '@/lib/notes/linkGraph';

interface GlobalGraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null; // fixed x (when dragging)
  fy: number | null;
  connections: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;
const CANVAS_W = 900;
const CANVAS_H = 700;

// Force simulation parameters
const REPULSION = 3000;
const ATTRACTION = 0.008;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.01;
const MIN_DIST = 30;

function initSimulation(nodes: GraphNode[], edges: GraphEdge[]): SimNode[] {
  const connCount = new Map<string, number>();
  for (const e of edges) {
    connCount.set(e.source, (connCount.get(e.source) || 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) || 0) + 1);
  }

  // Place nodes in a circle initially
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const radius = Math.min(CANVAS_W, CANVAS_H) * 0.35;

  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    return {
      ...n,
      x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      connections: connCount.get(n.slug) || 0,
    };
  });
}

function stepSimulation(simNodes: SimNode[], edges: GraphEdge[]): void {
  const n = simNodes.length;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  // Reset forces
  for (const node of simNodes) {
    if (node.fx !== null) { node.x = node.fx; node.y = node.fy!; node.vx = 0; node.vy = 0; continue; }
    node.vx *= DAMPING;
    node.vy *= DAMPING;
  }

  // Repulsion (all pairs)
  for (let i = 0; i < n; i++) {
    const a = simNodes[i];
    if (a.fx !== null) continue;
    for (let j = i + 1; j < n; j++) {
      const b = simNodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < MIN_DIST) dist = MIN_DIST;
      const force = REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      if (b.fx === null) { b.vx -= fx; b.vy -= fy; }
    }
  }

  // Attraction along edges
  const slugIdx = new Map(simNodes.map((n, i) => [n.slug, i]));
  for (const e of edges) {
    const ai = slugIdx.get(e.source);
    const bi = slugIdx.get(e.target);
    if (ai === undefined || bi === undefined) continue;
    const a = simNodes[ai];
    const b = simNodes[bi];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = dist * ATTRACTION;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (a.fx === null) { a.vx += fx; a.vy += fy; }
    if (b.fx === null) { b.vx -= fx; b.vy -= fy; }
  }

  // Center gravity
  for (const node of simNodes) {
    if (node.fx !== null) continue;
    node.vx += (cx - node.x) * CENTER_GRAVITY;
    node.vy += (cy - node.y) * CENTER_GRAVITY;
  }

  // Apply velocities
  for (const node of simNodes) {
    if (node.fx !== null) continue;
    node.x += node.vx;
    node.y += node.vy;
  }
}

function truncateTitle(title: string, max = 18): string {
  return title.length <= max ? title : title.slice(0, max - 1) + '…';
}

function nodeRadius(connections: number): number {
  return Math.max(4, Math.min(16, 4 + connections * 1.5));
}

export function GlobalGraphView({ nodes, edges }: GlobalGraphViewProps) {
  const navigate = useNavigate();
  const { t } = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const rafRef = useRef<number>(0);
  const [, forceRender] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [viewState, setViewState] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Init simulation
  useEffect(() => {
    simRef.current = initSimulation(nodes, edges);
    let running = true;
    let tick = 0;

    const loop = () => {
      if (!running) return;
      stepSimulation(simRef.current, edges);
      tick++;
      // Render every 2nd frame for perf
      if (tick % 2 === 0) forceRender(v => v + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [nodes, edges]);

  // Drag handlers
  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: clientX, y: clientY };
    const svgP = pt.matrixTransform(ctm);
    return { x: svgP.x, y: svgP.y };
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    setDragNode(slug);
    const node = simRef.current.find(n => n.slug === slug);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragNode) {
      const p = svgPoint(e.clientX, e.clientY);
      const node = simRef.current.find(n => n.slug === dragNode);
      if (node) { node.fx = p.x; node.fy = p.y; }
    } else if (isPanning) {
      setViewState(prev => ({
        ...prev,
        panX: e.clientX - panStartRef.current.x,
        panY: e.clientY - panStartRef.current.y,
      }));
    }
  }, [dragNode, isPanning, svgPoint]);

  const handleMouseUp = useCallback(() => {
    if (dragNode) {
      const node = simRef.current.find(n => n.slug === dragNode);
      if (node) { node.fx = null; node.fy = null; }
      setDragNode(null);
    }
    setIsPanning(false);
  }, [dragNode]);

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - viewState.panX, y: e.clientY - viewState.panY };
  }, [viewState.panX, viewState.panY]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta)),
    }));
  }, []);

  useEffect(() => {
    const up = () => { handleMouseUp(); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [handleMouseUp]);

  const handleNodeClick = useCallback((node: SimNode) => {
    if (!node.exists) return;
    navigate(`/notes/${node.slug}`);
  }, [navigate]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        {t.graph.empty}
      </div>
    );
  }

  const vbW = CANVAS_W / viewState.zoom;
  const vbH = CANVAS_H / viewState.zoom;
  const vbX = (CANVAS_W - vbW) / 2 - viewState.panX / viewState.zoom;
  const vbY = (CANVAS_H - vbH) / 2 - viewState.panY / viewState.zoom;

  const simNodes = simRef.current;
  const slugMap = new Map(simNodes.map(n => [n.slug, n]));

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewState(p => ({ ...p, zoom: Math.max(MIN_ZOOM, p.zoom - ZOOM_STEP) }))} disabled={viewState.zoom <= MIN_ZOOM} title={t.graph.zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(viewState.zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewState(p => ({ ...p, zoom: Math.min(MAX_ZOOM, p.zoom + ZOOM_STEP) }))} disabled={viewState.zoom >= MAX_ZOOM} title={t.graph.zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={() => setViewState({ zoom: 1, panX: 0, panY: 0 })} title={t.graph.reset}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">{t.graph.dragToPan}</span>
      </div>

      {/* Graph */}
      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full select-none"
        style={{ height: '70vh', cursor: dragNode ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Edges */}
        <g>
          {edges.map((edge, i) => {
            const s = slugMap.get(edge.source);
            const tg = slugMap.get(edge.target);
            if (!s || !tg) return null;
            const highlighted = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <line
                key={`e-${i}`}
                x1={s.x} y1={s.y} x2={tg.x} y2={tg.y}
                stroke="hsl(var(--primary))"
                strokeWidth={highlighted ? 1.8 : 0.7}
                strokeOpacity={highlighted ? 0.8 : 0.25}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {simNodes.map(node => {
            const isHovered = hoveredNode === node.slug;
            const r = nodeRadius(node.connections);
            return (
              <g
                key={node.slug}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => handleNodeMouseDown(e, node.slug)}
                onMouseEnter={() => setHoveredNode(node.slug)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={e => { e.stopPropagation(); handleNodeClick(node); }}
                className="cursor-pointer"
              >
                <circle
                  r={isHovered ? r + 2 : r}
                  fill="hsl(var(--primary))"
                  fillOpacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? 'hsl(var(--primary-foreground))' : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                />
                {(isHovered || viewState.zoom >= 0.8) && (
                  <text
                    y={r + 12}
                    textAnchor="middle"
                    className="text-[9px] font-sans fill-foreground"
                    style={{ pointerEvents: 'none', opacity: isHovered ? 1 : 0.7 }}
                  >
                    {truncateTitle(node.title, isHovered ? 30 : 16)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Stats */}
      <div className="flex justify-center gap-6 px-4 py-3 border-t border-border text-xs text-muted-foreground">
        <span>{t.graph.notesCount.replace('{count}', String(nodes.length))}</span>
        <span>{t.graph.connectionsCount.replace('{count}', String(edges.length))}</span>
      </div>
    </div>
  );
}
