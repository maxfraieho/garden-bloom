import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFullGraph } from '@/lib/notes/linkGraph';
import { useLocale } from '@/hooks/useLocale';
import { useMemo } from 'react';

export function KnowledgeMapPreview() {
  const { t } = useLocale();
  const graph = useMemo(() => getFullGraph(), []);

  // Take 5 sample nodes for the preview graph
  const previewNodes = graph.nodes.slice(0, 5);
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  // Calculate positions for the preview nodes (1 center + 4 around)
  const nodePositions = useMemo(() => {
    const cx = 150;
    const cy = 100;
    const radius = 60;

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
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Network className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground font-sans">
          {t.index.knowledgeMap}
        </h2>
      </div>

      {/* Preview graph SVG */}
      <div className="bg-background rounded-lg border border-border mb-4 overflow-hidden">
        <svg width="100%" height="200" viewBox="0 0 300 200" className="block">
          {/* Draw edges from center to all other nodes */}
          {nodePositions.length > 1 &&
            nodePositions.slice(1).map((pos, i) => (
              <line
                key={i}
                x1={nodePositions[0].x}
                y1={nodePositions[0].y}
                x2={pos.x}
                y2={pos.y}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                strokeOpacity="0.3"
              />
            ))}

          {/* Draw nodes */}
          {nodePositions.map((pos, i) => (
            <circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={pos.isCenter ? 12 : 8}
              fill={pos.isCenter ? 'hsl(var(--primary))' : 'hsl(174 62% 45%)'}
              className="transition-all duration-200"
            />
          ))}
        </svg>
      </div>

      {/* Explore button */}
      <Button asChild variant="outline" className="w-full">
        <Link to="/graph">{t.index.exploreGraph}</Link>
      </Button>

      {/* Stats */}
      <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
        <span>{nodeCount} {t.common.notes}</span>
        <span>•</span>
        <span>{edgeCount} {t.index.connections}</span>
      </div>
    </div>
  );
}
