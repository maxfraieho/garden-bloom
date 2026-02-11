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
 * Simple force-directed layout algorithm
 * Positions nodes using basic physics simulation
 */
function computeForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): PositionedNode[] {
  if (nodes.length === 0) return [];

  // Initialize positions in a circle
  const centerX = width / 2;
  const centerY = height / 2;
  const initialRadius = Math.min(width, height) * 0.35;

  let positions = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    return {
      ...node,
      x: centerX + initialRadius * Math.cos(angle),
      y: centerY + initialRadius * Math.sin(angle),
    };
  });

  // Build adjacency for quick lookup
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(n => adjacency.set(n.slug, new Set()));
  edges.forEach(e => {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  });

  // Simple force simulation (reduced iterations for performance)
  const iterations = 50;
  const repulsion = 2000;
  const attraction = 0.05;
  const damping = 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));

    // Repulsion between all nodes
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces[i].fx -= fx;
        forces[i].fy -= fy;
        forces[j].fx += fx;
        forces[j].fy += fy;
      }
    }

    // Attraction along edges
    const slugToIndex = new Map(positions.map((n, i) => [n.slug, i]));
    edges.forEach(edge => {
      const i = slugToIndex.get(edge.source);
      const j = slugToIndex.get(edge.target);
      if (i === undefined || j === undefined) return;

      const dx = positions[j].x - positions[i].x;
      const dy = positions[j].y - positions[i].y;
      const fx = dx * attraction;
      const fy = dy * attraction;

      forces[i].fx += fx;
      forces[i].fy += fy;
      forces[j].fx -= fx;
      forces[j].fy -= fy;
    });

    // Center gravity
    positions.forEach((pos, i) => {
      forces[i].fx += (centerX - pos.x) * 0.01;
      forces[i].fy += (centerY - pos.y) * 0.01;
    });

    // Apply forces with damping
    positions = positions.map((pos, i) => ({
      ...pos,
      x: Math.max(40, Math.min(width - 40, pos.x + forces[i].fx * damping)),
      y: Math.max(40, Math.min(height - 40, pos.y + forces[i].fy * damping)),
    }));
  }

  return positions;
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

  const width = 800;
  const height = 600;

  const positionedNodes = useMemo(
    () => computeForceLayout(nodes, edges, width, height),
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
