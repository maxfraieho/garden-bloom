import type { AgentDefinition } from '@/types/agentRegistry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ZONE_DESCRIPTIONS: Record<string, string> = {
  mcp: 'MCP Gateway — handles external API calls and tool integrations',
  planning: 'Planning — analyzes tasks and creates execution plans',
  memory: 'Memory — manages agent knowledge and context retrieval',
  execution: 'Execution — runs tasks and produces artifacts',
  governance: 'Governance — enforces rules, validates outputs, audits',
};

interface AgentCardProps {
  agent: AgentDefinition;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const statusColor: Record<string, string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  inactive: 'bg-muted text-muted-foreground border-muted-foreground/30',
  draft: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
};

export function AgentCard({
  agent, isFirst, isLast, isExpanded,
  onToggleExpand, onEdit, onDelete, onMoveUp, onMoveDown
}: AgentCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
        {/* Main row */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
            <span className="text-sm font-mono text-muted-foreground w-8">#{agent.order}</span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-foreground">{agent.name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-3 text-sm text-muted-foreground truncate cursor-help border-b border-dotted border-muted-foreground/40">{agent.zone}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {ZONE_DESCRIPTIONS[agent.zone] || `Zone: ${agent.zone}`}
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="outline" className={`text-xs ${statusColor[agent.status]}`}>
              {agent.status}
            </Badge>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isFirst} onClick={onMoveUp}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isLast} onClick={onMoveDown}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded details */}
        <CollapsibleContent>
          <div className="border-t border-border px-4 py-4 space-y-3">
            {agent.description && (
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            )}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Behavior</h4>
              <pre className="text-sm font-mono bg-muted/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{agent.behavior}</pre>
            </div>
            {agent.triggers && agent.triggers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Triggers</h4>
                <ul className="list-disc list-inside text-sm text-foreground space-y-0.5">
                  {agent.triggers.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              <span>Created: {agent.created}</span>
              <span>Updated: {agent.updated}</span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
