import { useState, useEffect, useCallback } from 'react';
import type { AgentDefinition } from '@/types/agentRegistry';

const STORAGE_KEY = 'agent-registry';

function loadAgents(): AgentDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAgents(agents: AgentDefinition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export function useAgentRegistry() {
  const [agents, setAgents] = useState<AgentDefinition[]>(loadAgents);

  useEffect(() => {
    saveAgents(agents);
  }, [agents]);

  const sorted = [...agents].sort((a, b) => a.order - b.order);

  const addAgent = useCallback((agent: AgentDefinition) => {
    setAgents(prev => [...prev, agent]);
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<AgentDefinition>) => {
    setAgents(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates, updated: new Date().toISOString().slice(0, 10) } : a)
    );
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  const reorder = useCallback((id: string, direction: 'up' | 'down') => {
    setAgents(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(a => a.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;

      const tempOrder = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
      sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };
      return sorted;
    });
  }, []);

  const nextOrder = agents.length > 0 ? Math.max(...agents.map(a => a.order)) + 1 : 1;

  return { agents: sorted, addAgent, updateAgent, deleteAgent, reorder, nextOrder };
}
