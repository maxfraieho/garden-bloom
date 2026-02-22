import { useState } from 'react';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { useAgentRegistry } from '@/hooks/useAgentRegistry';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Bot, Info } from 'lucide-react';
import { AgentCard } from '@/components/garden/AgentCard';
import { AgentForm } from '@/components/garden/AgentForm';
import type { AgentDefinition } from '@/types/agentRegistry';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AgentsPage() {
  const { isAuthenticated } = useOwnerAuth();
  const { agents, addAgent, updateAgent, deleteAgent, reorder, nextOrder } = useAgentRegistry();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!isAuthenticated) return <Navigate to="/" replace />;

  const handleSave = (agent: AgentDefinition) => {
    if (editingAgent) {
      updateAgent(agent.id, agent);
    } else {
      addAgent(agent);
    }
    setEditingAgent(null);
    setFormOpen(false);
  };

  const handleEdit = (agent: AgentDefinition) => {
    setEditingAgent(agent);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingAgent(null);
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteAgent(deleteId);
      setDeleteId(null);
      if (expandedId === deleteId) setExpandedId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <nav className="text-sm text-muted-foreground mb-1">
              <a href="/" className="hover:text-foreground">Home</a>
              <span className="mx-1">/</span>
              <span className="text-foreground">Agents</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground">Agent Registry</h1>
            <p className="text-muted-foreground mt-1">
              Declare and manage AI agents — each with a zone, behavior, and execution order
            </p>
          </div>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </div>

        {/* Agent List */}
        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-12 text-center space-y-4">
            <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">No agents yet</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                An <strong>agent</strong> is an AI worker that reads knowledge, executes tasks, and proposes changes.
                Each agent belongs to a <strong>zone</strong> (planning, execution, memory, governance, mcp) that defines its authority scope.
              </p>
            </div>
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first agent
            </Button>
            <p className="text-xs text-muted-foreground/60">
              Example: a "summarizer" agent in the execution zone that generates note summaries
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent, idx) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isFirst={idx === 0}
                isLast={idx === agents.length - 1}
                isExpanded={expandedId === agent.id}
                onToggleExpand={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
                onEdit={() => handleEdit(agent)}
                onDelete={() => setDeleteId(agent.id)}
                onMoveUp={() => reorder(agent.id, 'up')}
                onMoveDown={() => reorder(agent.id, 'down')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Sheet */}
      <AgentForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingAgent(null); }}
        agent={editingAgent}
        existingIds={agents.map(a => a.id)}
        nextOrder={nextOrder}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the agent definition. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
