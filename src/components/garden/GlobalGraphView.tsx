// Global graph visualization component
// Renders a visual representation of the entire knowledge graph

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/hooks/useLocale';
import type { GraphNode, GraphEdge } from '@/lib/notes/linkGraph';

interface GlobalGraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/**
 * Hierarchical tree layout algorithm
 * Uses BFS from root nodes to assign levels, then spaces nodes within each level
 * Falls back to force-nudging for disconnected components
 */
function computeTreeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const slugSet = new Set(nodes.map(n => n.slug));

  // Build directed adjacency (source -> targets) and inbound count
  const children = new Map<string, string[]>();
  const inboundCount = new Map<string, number>();
  nodes.forEach(n => {
    children.set(n.slug, []);
    inboundCount.set(n.slug, 0);
  });

  // Only count edges where both endpoints exist in the node set
  const validEdges = edges.filter(e => slugSet.has(e.source) && slugSet.has(e.target));
  for (const e of validEdges) {
    children.get(e.source)!.push(e.target);
    inboundCount.set(e.target, (inboundCount.get(e.target) || 0) + 1);
  }

  // Find root nodes (no inbound edges). If none, pick the most-connected node.
  let roots = nodes.filter(n => (inboundCount.get(n.slug) || 0) === 0).map(n => n.slug);
  if (roots.length === 0) {
    // Pick node with most outbound connections as root
    const sorted = [...nodes].sort((a, b) => 
      (children.get(b.slug)?.length || 0) - (children.get(a.slug)?.length || 0)
    );
    roots = [sorted[0].slug];
  }

  // BFS to assign levels
  const level = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) {
    if (!level.has(r)) {
      level.set(r, 0);
      queue.push(r);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentLevel = level.get(current)!;
    for (const child of children.get(current) || []) {
      if (!level.has(child)) {
        level.set(child, currentLevel + 1);
        queue.push(child);
      }
    }
  }

  // Handle disconnected nodes — assign them to level 0 and BFS from them
  for (const n of nodes) {
    if (!level.has(n.slug)) {
      level.set(n.slug, 0);
      queue.push(n.slug);
      // BFS for this component
      let compHead = queue.length - 1;
      while (compHead < queue.length) {
        const current = queue[compHead++];
        const currentLevel = level.get(current)!;
        for (const child of children.get(current) || []) {
          if (!level.has(child)) {
            level.set(child, currentLevel + 1);
            queue.push(child);
          }
        }
      }
    }
  }

  // Group nodes by level
  const levels = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const l = level.get(n.slug) || 0;
    if (!levels.has(l)) levels.set(l, []);
    levels.get(l)!.push(n);
  }

  const maxLevel = Math.max(...levels.keys());
  const levelCount = maxLevel + 1;
  const padding = 60;

  // Position nodes: Y by level (top-to-bottom), X spread within level
  const positions: PositionedNode[] = [];
  for (const [l, levelNodes] of levels.entries()) {
    const y = levelCount <= 1 
      ? height / 2 
      : padding + (l / (levelCount - 1)) * (height - padding * 2);

    const count = levelNodes.length;
    const spacing = Math.min(
      (width - padding * 2) / Math.max(count, 1),
      80
    );
    const totalWidth = spacing * (count - 1);
    const startX = (width - totalWidth) / 2;

    for (let i = 0; i < count; i++) {
      positions.push({
        ...levelNodes[i],
        x: count === 1 ? width / 2 : startX + i * spacing,
        y,
      });
    }
  }

  // Light force simulation to reduce overlaps while preserving hierarchy
  const iterations = 30;
  let posArr = [...positions];
  const slugToIdx = new Map(posArr.map((n, i) => [n.slug, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const forces = posArr.map(() => ({ fx: 0, fy: 0 }));

    // Horizontal repulsion between same-level nodes
    for (let i = 0; i < posArr.length; i++) {
      for (let j = i + 1; j < posArr.length; j++) {
        if (level.get(posArr[i].slug) !== level.get(posArr[j].slug)) continue;
        const dx = posArr[j].x - posArr[i].x;
        const dist = Math.abs(dx) || 1;
        if (dist < 60) {
          const force = (60 - dist) * 0.3;
          const dir = dx > 0 ? 1 : -1;
          forces[i].fx -= dir * force;
          forces[j].fx += dir * force;
        }
      }
    }

    // Gentle attraction along edges (X only, to align parent-child)
    for (const edge of validEdges) {
      const i = slugToIdx.get(edge.source);
      const j = slugToIdx.get(edge.target);
      if (i === undefined || j === undefined) continue;
      const dx = posArr[j].x - posArr[i].x;
      forces[i].fx += dx * 0.02;
      forces[j].fx -= dx * 0.02;
    }

    posArr = posArr.map((pos, i) => ({
      ...pos,
      x: Math.max(padding, Math.min(width - padding, pos.x + forces[i].fx * 0.5)),
      // Keep Y fixed to preserve tree structure
    }));
  }

  return posArr;
}

/**
 * Truncate text for display
 */
function truncateTitle(title: string, maxLength: number = 16): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 1) + '…';
}

export function GlobalGraphView({ nodes, edges }: GlobalGraphViewProps) {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 1200;
  const height = Math.max(800, nodes.length * 12);

  const positionedNodes = useMemo(
    () => computeTreeLayout(nodes, edges, width, height),
    [nodes, edges]
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    positionedNodes.forEach(n => map.set(n.slug, n));
    return map;
  }, [positionedNodes]);

  const handleNodeClick = useCallback(
    (node: PositionedNode) => {
      if (!node.exists) return;
      navigate(`/notes/${node.slug}`);
    },
    [navigate]
  );

  const handleZoomIn = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, prev.zoom + ZOOM_STEP),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, prev.zoom - ZOOM_STEP),
    }));
  }, []);

  const handleReset = useCallback(() => {
    setViewState({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - viewState.panX, y: e.clientY - viewState.panY });
  }, [viewState.panX, viewState.panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setViewState(prev => ({
      ...prev,
      panX: e.clientX - panStart.x,
      panY: e.clientY - panStart.y,
    }));
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leaving the SVG area
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        {t.graph.empty}
      </div>
    );
  }

  // Calculate viewBox based on zoom and pan
  const viewBoxWidth = width / viewState.zoom;
  const viewBoxHeight = height / viewState.zoom;
  const viewBoxX = (width - viewBoxWidth) / 2 - viewState.panX / viewState.zoom;
  const viewBoxY = (height - viewBoxHeight) / 2 - viewState.panY / viewState.zoom;

  // Labels should be visible by default (requested). Keep them subtle on low zoom.
  const showLabels = viewState.zoom >= 0.75;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Zoom controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={viewState.zoom <= MIN_ZOOM}
            title={t.graph.zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(viewState.zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={viewState.zoom >= MAX_ZOOM}
            title={t.graph.zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-1"
            onClick={handleReset}
            title={t.graph.reset}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {t.graph.dragToPan}
        </span>
      </div>

      {/* Graph SVG */}
      <svg
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto min-h-[400px] select-none"
        style={{ 
          maxHeight: '70vh',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Edges */}
        <g className="edges">
          {edges.map((edge, i) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const isHighlighted =
              hoveredNode === edge.source || hoveredNode === edge.target;

            return (
              <line
                key={`edge-${i}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="hsl(var(--border))"
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isHighlighted ? 0.9 : 0.4}
                className="transition-all duration-150"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {positionedNodes.map(node => {
            const isHovered = hoveredNode === node.slug;
            const nodeRadius = isHovered ? 8 : 6;

            return (
              <g
                key={node.slug}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node);
                }}
                onMouseEnter={() => setHoveredNode(node.slug)}
                onMouseLeave={() => setHoveredNode(null)}
                className={node.exists ? 'cursor-pointer' : 'opacity-50'}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (node.exists && (e.key === 'Enter' || e.key === ' ')) {
                    handleNodeClick(node);
                  }
                }}
              >
                {/* Node circle */}
                <circle
                  r={nodeRadius}
                  fill={node.exists ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                  className="transition-all duration-150"
                />

                {/* Node label */}
                {(isHovered || showLabels) && (
                  <text
                    y={nodeRadius + 14}
                    textAnchor="middle"
                    className="text-[10px] font-sans fill-foreground"
                    style={{
                      pointerEvents: 'none',
                      opacity: isHovered ? 1 : viewState.zoom < 1 ? 0.6 : 0.85,
                    }}
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
