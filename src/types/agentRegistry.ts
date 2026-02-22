export type AgentStatus = 'active' | 'inactive' | 'draft';

export interface AgentDefinition {
  id: string;
  name: string;
  zone: string;           // folder path, e.g. "exodus.pp.ua/architecture"
  order: number;          // execution sequence (1 = first)
  status: AgentStatus;
  behavior: string;       // pseudocode / behavior description (markdown)
  description?: string;   // short one-liner
  triggers?: string[];    // what activates this agent
  created: string;        // ISO date
  updated: string;        // ISO date
}

export const ZONE_OPTIONS = [
  'exodus.pp.ua/architecture',
  'exodus.pp.ua/architecture/core',
  'exodus.pp.ua/architecture/features',
  'exodus.pp.ua/architecture/governance',
  'exodus.pp.ua/backend',
  'exodus.pp.ua/drakon',
  'exodus.pp.ua/frontend',
  'exodus.pp.ua/manifesto',
  'exodus.pp.ua/operations',
  'exodus.pp.ua/product',
] as const;
