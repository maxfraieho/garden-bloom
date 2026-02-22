// Global graph visualization — interactive force-directed layout
// Focus mode, expand levels, isolation, smooth animations

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Maximize2, Focus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
  fx: number | null;
  fy: number | null;
  connections: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;
const CANVAS_W = 900;
const CANVAS_H = 700;

const REPULSION = 3000;
const ATTRACTION = 0.008;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.01;
const MIN_DIST = 30;

// ── Helpers ──

function initSimulation(nodes: GraphNode[], edges: GraphEdge[]): SimNode[] {
  const connCount = new Map<string, number>();
  for (const e of edges) {
    connCount.set(e.source, (connCount.get(e.source) || 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) || 0) + 1);
  }
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const radius = Math.min(CANVAS_W, CANVAS_H) * 0.35;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    return {
      ...n,
      x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0, fx: null, fy: null,
      connections: connCount.get(n.slug) || 0,
    };
  });
}

function stepSimulation(simNodes: SimNode[], edges: GraphEdge[]): void {
  const n = simNodes.length;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  for (const node of simNodes) {
    if (node.fx !== null) { node.x = node.fx; node.y = node.fy!; node.vx = 0; node.vy = 0; continue; }
    node.vx *= DAMPING;
    node.vy *= DAMPING;
  }
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
      a.vx += fx; a.vy += fy;
      if (b.fx === null) { b.vx -= fx; b.vy -= fy; }
    }
  }
  const slugIdx = new Map(simNodes.map((sn, i) => [sn.slug, i]));
  for (const e of edges) {
    const ai = slugIdx.get(e.source);
    const bi = slugIdx.get(e.target);
    if (ai === undefined || bi === undefined) continue;
    const a = simNodes[ai]; const b = simNodes[bi];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = dist * ATTRACTION;
    const fx = (dx / dist) * force; const fy = (dy / dist) * force;
    if (a.fx === null) { a.vx += fx; a.vy += fy; }
    if (b.fx === null) { b.vx -= fx; b.vy -= fy; }
  }
  for (const node of simNodes) {
    if (node.fx !== null) continue;
    node.vx += (cx - node.x) * CENTER_GRAVITY;
    node.vy += (cy - node.y) * CENTER_GRAVITY;
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

function filterByDepth(nodes: GraphNode[], edges: GraphEdge[], depth: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (depth >= 10) return { nodes, edges };
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.slug, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }
  const connCount = new Map<string, number>();
  for (const e of edges) {
    connCount.set(e.source, (connCount.get(e.source) || 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) || 0) + 1);
  }
  const sorted = [...connCount.entries()].sort((a, b) => b[1] - a[1]);
  const roots = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.1))).map(e => e[0]);
  const visible = new Set<string>(roots);
  let frontier = new Set(roots);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const slug of frontier) {
      for (const neighbor of adj.get(slug) || []) {
        if (!visible.has(neighbor)) { visible.add(neighbor); next.add(neighbor); }
      }
    }
    frontier = next;
    if (next.size === 0) break;
  }
  return {
    nodes: nodes.filter(n => visible.has(n.slug)),
    edges: edges.filter(e => visible.has(e.source) && visible.has(e.target)),
  };
}

/** Get nodes within N hops of a center slug */
function getNeighborhood(centerSlug: string, edges: GraphEdge[], level: number): Set<string> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  const visited = new Set<string>([centerSlug]);
  let frontier = new Set([centerSlug]);
  for (let d = 0; d < level; d++) {
    const next = new Set<string>();
    for (const slug of frontier) {
      for (const nb of adj.get(slug) || []) {
        if (!visited.has(nb)) { visited.add(nb); next.add(nb); }
      }
    }
    frontier = next;
    if (next.size === 0) break;
  }
  return visited;
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
  const [depth, setDepth] = useState(10);

  // Focus state
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [expandLevel, setExpandLevel] = useState(1);
  const [isolated, setIsolated] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const { nodes: filteredNodes, edges: filteredEdges } = useMemo(
    () => filterByDepth(nodes, edges, depth),
    [nodes, edges, depth]
  );

  // Neighborhood for focus mode
  const focusNeighbors = useMemo(() => {
    if (!focusedNode) return null;
    return getNeighborhood(focusedNode, filteredEdges, expandLevel);
  }, [focusedNode, expandLevel, filteredEdges]);

  // Focus stats for debug
  const focusStats = useMemo(() => {
    if (!focusedNode) return null;
    let inbound = 0, outbound = 0;
    for (const e of filteredEdges) {
      if (e.target === focusedNode) inbound++;
      if (e.source === focusedNode) outbound++;
    }
    return { inbound, outbound, degree: inbound + outbound, neighbors: focusNeighbors ? focusNeighbors.size - 1 : 0 };
  }, [focusedNode, filteredEdges, focusNeighbors]);

  // Init simulation
  useEffect(() => {
    simRef.current = initSimulation(filteredNodes, filteredEdges);
    let running = true;
    let tick = 0;
    const loop = () => {
      if (!running) return;
      stepSimulation(simRef.current, filteredEdges);
      tick++;
      if (tick % 2 === 0) forceRender(v => v + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [filteredNodes, filteredEdges]);

  // SVG coordinate conversion
  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: clientX, y: clientY };
    const svgP = pt.matrixTransform(ctm);
    return { x: svgP.x, y: svgP.y };
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    setDragNode(slug);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const node = simRef.current.find(n => n.slug === slug);
    if (node) { node.fx = node.x; node.fy = node.y; }
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

  const handleBgClick = useCallback(() => {
    // Clear focus when clicking background
    if (focusedNode && !isolated) {
      setFocusedNode(null);
    }
  }, [focusedNode, isolated]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta)),
    }));
  }, []);

  useEffect(() => {
    const up = () => handleMouseUp();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [handleMouseUp]);

  const handleNodeClick = useCallback((node: SimNode, e: React.MouseEvent) => {
    e.stopPropagation();
    // Distinguish click from drag
    const start = dragStartPos.current;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > 5 || dy > 5) return; // was a drag
    }

    if (focusedNode === node.slug) {
      // Double-click on focused node → navigate
      if (node.exists) navigate(`/notes/${node.slug}`);
    } else {
      // First click → focus
      setFocusedNode(node.slug);
      setExpandLevel(1);
      setIsolated(false);
    }
  }, [focusedNode, navigate]);

  const handleIsolate = useCallback(() => {
    setIsolated(prev => !prev);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedNode(null);
    setIsolated(false);
  }, []);

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

  // Determine visibility for each node/edge based on focus + isolation
  const isNodeVisible = (slug: string): boolean => {
    if (!focusedNode || !focusNeighbors) return true;
    if (isolated) return focusNeighbors.has(slug);
    return true; // all visible, just dimmed
  };

  const isNodeHighlighted = (slug: string): boolean => {
    if (!focusedNode || !focusNeighbors) return false;
    return focusNeighbors.has(slug);
  };

  const isEdgeHighlighted = (source: string, target: string): boolean => {
    if (!focusedNode || !focusNeighbors) return false;
    return focusNeighbors.has(source) && focusNeighbors.has(target);
  };

  const isEdgeVisible = (source: string, target: string): boolean => {
    if (!focusedNode) return true;
    if (isolated) return focusNeighbors!.has(source) && focusNeighbors!.has(target);
    return true;
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 flex-wrap gap-2">
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Depth</span>
          <Slider value={[depth]} onValueChange={([v]) => setDepth(v)} min={1} max={10} step={1} className="w-24" />
          <span className="text-xs font-medium text-primary w-5 text-center">{depth >= 10 ? '∞' : depth}</span>
        </div>

        {/* Focus controls */}
        {focusedNode && (
          <div className="flex items-center gap-2 border-l border-border pl-3">
            <span className="text-xs text-muted-foreground">Level</span>
            {[0, 1, 2, 3].map(lvl => (
              <Button
                key={lvl}
                variant={expandLevel === lvl ? 'default' : 'ghost'}
                size="sm"
                className="h-6 w-6 p-0 text-xs"
                onClick={() => setExpandLevel(lvl)}
              >
                {lvl}
              </Button>
            ))}
            <Button
              variant={isolated ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={handleIsolate}
            >
              <Focus className="h-3 w-3" />
              Isolate
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearFocus} title="Clear focus">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
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
        onClick={handleBgClick}
      >
        {/* Glow filter for focused node */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        <g>
          {filteredEdges.map((edge, i) => {
            const s = slugMap.get(edge.source);
            const tg = slugMap.get(edge.target);
            if (!s || !tg) return null;
            if (!isEdgeVisible(edge.source, edge.target)) return null;

            const focused = focusedNode !== null;
            const highlighted = focused
              ? isEdgeHighlighted(edge.source, edge.target)
              : (hoveredNode === edge.source || hoveredNode === edge.target);

            // Direct connection to focused node gets extra emphasis
            const directToFocus = focused && (edge.source === focusedNode || edge.target === focusedNode);

            let strokeWidth = 0.7;
            let strokeOpacity = 0.25;

            if (focused) {
              if (directToFocus) {
                strokeWidth = 2.5;
                strokeOpacity = 0.9;
              } else if (highlighted) {
                strokeWidth = 1.5;
                strokeOpacity = 0.5;
              } else {
                strokeWidth = 0.4;
                strokeOpacity = 0.06;
              }
            } else if (highlighted) {
              strokeWidth = 1.8;
              strokeOpacity = 0.8;
            }

            return (
              <line
                key={`e-${i}`}
                x1={s.x} y1={s.y} x2={tg.x} y2={tg.y}
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                style={{ transition: 'stroke-opacity 0.3s ease, stroke-width 0.3s ease' }}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {simNodes.map(node => {
            if (!isNodeVisible(node.slug)) return null;

            const isFocused = focusedNode === node.slug;
            const isHovered = hoveredNode === node.slug;
            const hasFocus = focusedNode !== null;
            const highlighted = isNodeHighlighted(node.slug);
            const r = nodeRadius(node.connections);

            // Scale
            let scale = 1;
            if (isFocused) scale = 1.5;
            else if (hasFocus && highlighted) scale = 1.15;
            else if (isHovered) scale = 1.2;

            // Opacity
            let opacity = 0.85;
            if (hasFocus) {
              if (isFocused) opacity = 1;
              else if (highlighted) opacity = 0.9;
              else opacity = 0.12;
            } else if (isHovered) {
              opacity = 1;
            }

            // Label visibility
            const showLabel = isHovered || isFocused || (hasFocus && highlighted) || viewState.zoom >= 0.8;
            let labelOpacity = 0.7;
            if (isFocused || isHovered) labelOpacity = 1;
            else if (hasFocus && highlighted) labelOpacity = 0.85;
            else if (hasFocus && !highlighted) labelOpacity = 0.08;

            return (
              <g
                key={node.slug}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={e => handleNodeMouseDown(e, node.slug)}
                onMouseEnter={() => setHoveredNode(node.slug)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={e => handleNodeClick(node, e)}
                className="cursor-pointer"
                style={{ transition: 'opacity 0.3s ease' }}
                opacity={opacity}
              >
                {/* Glow ring for focused node */}
                {isFocused && (
                  <circle
                    r={r * scale + 6}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeOpacity={0.4}
                    filter="url(#glow)"
                    style={{ transition: 'r 0.3s ease' }}
                  />
                )}
                <circle
                  r={r * scale}
                  fill="hsl(var(--primary))"
                  fillOpacity={isFocused ? 1 : highlighted ? 0.9 : 0.85}
                  stroke={isFocused ? 'hsl(var(--accent))' : isHovered ? 'hsl(var(--primary-foreground))' : 'none'}
                  strokeWidth={isFocused ? 3 : isHovered ? 2 : 0}
                  style={{ transition: 'r 0.3s ease, fill-opacity 0.3s ease, stroke-width 0.3s ease' }}
                />
                {showLabel && (
                  <text
                    y={r * scale + 12}
                    textAnchor="middle"
                    className="text-[9px] font-sans fill-foreground"
                    style={{
                      pointerEvents: 'none',
                      opacity: labelOpacity,
                      fontWeight: isFocused ? 700 : 400,
                      fontSize: isFocused ? '11px' : '9px',
                      transition: 'opacity 0.3s ease',
                    }}
                  >
                    {truncateTitle(node.title, isFocused ? 40 : isHovered ? 30 : 16)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Stats + Focus info */}
      <div className="flex justify-between items-center px-4 py-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex gap-6">
          <span>{t.graph.notesCount.replace('{count}', String(filteredNodes.length))}</span>
          <span>{t.graph.connectionsCount.replace('{count}', String(filteredEdges.length))}</span>
        </div>

        {/* Focus debug info */}
        {focusedNode && focusStats && (
          <div className="flex gap-4 text-xs">
            <span className="text-foreground font-medium">
              {slugMap.get(focusedNode)?.title || focusedNode}
            </span>
            <span>in: {focusStats.inbound}</span>
            <span>out: {focusStats.outbound}</span>
            <span>degree: {focusStats.degree}</span>
            <span>visible: {focusStats.neighbors}</span>
            <span className="text-muted-foreground/60">
              click again to open · bg to unfocus
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
