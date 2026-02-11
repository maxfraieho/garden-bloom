import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFullGraph } from '@/lib/notes/linkGraph';
import { useLocale } from '@/hooks/useLocale';
import { useMemo, useState } from 'react';

export function KnowledgeMapPreview() {
  const { t } = useLocale();
  const graph = useMemo(() => getFullGraph(), []);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  // Take 5 sample nodes for the preview graph
  const previewNodes = graph.nodes.slice(0, 5);
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  // Calculate positions for the preview nodes (1 center + 4 around)
  const nodePositions = useMemo(() => {
    const cx = 200;
    const cy = 125;
    const radius = 75;

    if (previewNodes.length === 0) return [];

    const positions = [{ x: cx, y: cy, isCenter: true }];

    // Position other nodes around the center
    for (let i = 1; i < Math.min(previewNodes.length, 5); i++) {
      const angle = ((i - 1) * Math.PI * 2) / 4 - Math.PI / 4;
      positions.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        isCenter: false,
      });
    }

    return positions;
  }, [previewNodes.length]);

  return (
    <div className="border border-border rounded-lg p-4 bg-card transition-all duration-200">
      <div className="flex items-center gap-2 mb-4">
        <Network className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground font-sans">
          {t.index.knowledgeMap}
        </h2>
      </div>

      {/* Preview graph SVG - Larger size */}
      <div className="bg-gradient-to-b from-background to-background/50 rounded-lg border border-border/50 mb-4 overflow-hidden hover:border-border transition-colors duration-200">
        <svg 
          width="100%" 
          height="250" 
          viewBox="0 0 400 250" 
          className="block transition-all duration-200"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Draw edges from center to all other nodes with gradient */}
          {nodePositions.length > 1 &&
            nodePositions.slice(1).map((pos, i) => (
              <line
                key={`edge-${i}`}
                x1={nodePositions[0].x}
                y1={nodePositions[0].y}
                x2={pos.x}
                y2={pos.y}
                stroke="url(#edgeGradient)"
                strokeWidth="2"
                className="transition-all duration-200"
              />
            ))}

          {/* Draw nodes */}
          {nodePositions.map((pos, i) => (
            <g
              key={`node-${i}`}
              onMouseEnter={() => setHoveredNode(i)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer transition-all duration-200"
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={pos.isCenter ? 12 : 8}
                fill={pos.isCenter ? 'hsl(var(--primary))' : 'hsl(174 62% 45%)'}
                className={`transition-all duration-200 ${
                  hoveredNode === i ? 'brightness-150' : ''
                }`}
                style={{
                  transform: hoveredNode === i ? 'scale(1.3)' : 'scale(1)',
                  filter: hoveredNode === i ? 'drop-shadow(0 0 8px hsl(var(--primary)))' : '',
                }}
              />
              {hoveredNode === i && pos.isCenter && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={18}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  opacity="0.3"
                  className="animate-pulse"
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Explore button - Prominent */}
      <Button 
        asChild 
        variant="default" 
        className="w-full mb-4 font-semibold transition-all duration-200 hover:shadow-md"
      >
        <Link to="/graph">{t.index.exploreGraph}</Link>
      </Button>

      {/* Stats - Horizontal layout */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded-md bg-muted/50 transition-all duration-200 hover:bg-muted">
          <div className="text-sm font-semibold text-primary">
            {nodeCount}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.common.notes}
          </div>
        </div>
        <div className="p-2 rounded-md bg-muted/50 transition-all duration-200 hover:bg-muted">
          <div className="text-sm font-semibold text-primary">
            {edgeCount}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.index.connections}
          </div>
        </div>
      </div>
    </div>
  );
}
