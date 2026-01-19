// Link relationship resolver and local graph data model
// Computes outbound links, inbound links (backlinks), and local graph structure

import type { Note, NoteLink } from './types';
import { getAllNotes, noteExists } from './noteLoader';
import { parseWikilinks, slugify } from './wikilinkParser';

/**
 * Represents a node in the local graph
 */
export interface GraphNode {
  slug: string;
  title: string;
  exists: boolean;
}

/**
 * Represents an edge in the local graph
 */
export interface GraphEdge {
  source: string;
  target: string;
}

/**
 * Local graph data structure for a single note
 * Contains the current note and its immediate neighbors (1-hop)
 */
export interface LocalGraph {
  center: GraphNode;
  outbound: GraphNode[];  // Notes this note links to
  inbound: GraphNode[];   // Notes that link to this note (backlinks)
  edges: GraphEdge[];
}

/**
 * Backlink information with context
 */
export interface Backlink {
  slug: string;
  title: string;
  // Could extend with excerpt/context in future iterations
}

/**
 * Cache for link relationships to avoid recomputation
 */
interface LinkCache {
  outboundMap: Map<string, string[]>;  // slug -> array of target slugs
  inboundMap: Map<string, string[]>;   // slug -> array of source slugs
  lastComputed: number;
}

let linkCache: LinkCache | null = null;

/**
 * Check if a note should be visible (published)
 * Hidden or unpublished notes are excluded from backlinks
 */
function isNoteVisible(note: Note): boolean {
  // dg_publish must be explicitly true, or undefined (defaults to visible)
  // If explicitly false, the note is hidden
  const dgPublish = note.frontmatter.dg_publish;
  return dgPublish !== false;
}

/**
 * Build the complete link graph from all notes
 * This scans all notes and extracts their wikilinks
 */
function buildLinkGraph(): LinkCache {
  const outboundMap = new Map<string, string[]>();
  const inboundMap = new Map<string, string[]>();
  
  const allNotes = getAllNotes();
  const visibleNotes = allNotes.filter(isNoteVisible);
  const visibleSlugs = new Set(visibleNotes.map(n => n.slug));
  
  // Process each visible note
  for (const note of visibleNotes) {
    const links = parseWikilinks(note.content);
    
    // Extract unique target slugs
    const targetSlugs = [...new Set(links.map(l => l.target))];
    outboundMap.set(note.slug, targetSlugs);
    
    // Build inbound map (reverse lookup)
    for (const targetSlug of targetSlugs) {
      // Only include links to visible notes
      if (!inboundMap.has(targetSlug)) {
        inboundMap.set(targetSlug, []);
      }
      inboundMap.get(targetSlug)!.push(note.slug);
    }
  }
  
  return {
    outboundMap,
    inboundMap,
    lastComputed: Date.now(),
  };
}

/**
 * Get or refresh the link cache
 */
function getLinkCache(): LinkCache {
  // For now, always rebuild - in production this could be optimized
  // with cache invalidation when notes change
  if (!linkCache) {
    linkCache = buildLinkGraph();
  }
  return linkCache;
}

/**
 * Invalidate the link cache (call when notes change)
 */
export function invalidateLinkCache(): void {
  linkCache = null;
}

/**
 * Get outbound links for a note
 * Returns slugs of notes that this note links to
 */
export function getOutboundLinks(noteSlug: string): string[] {
  const cache = getLinkCache();
  return cache.outboundMap.get(noteSlug) || [];
}

/**
 * Get backlinks (inbound links) for a note
 * Returns notes that link TO this note, excluding hidden/unpublished notes
 */
export function getBacklinks(noteSlug: string): Backlink[] {
  const cache = getLinkCache();
  const inboundSlugs = cache.inboundMap.get(noteSlug) || [];
  
  const allNotes = getAllNotes();
  const noteMap = new Map(allNotes.map(n => [n.slug, n]));
  
  return inboundSlugs
    .map(slug => {
      const note = noteMap.get(slug);
      if (!note || !isNoteVisible(note)) return null;
      
      return {
        slug: note.slug,
        title: note.title,
      };
    })
    .filter((b): b is Backlink => b !== null);
}

/**
 * Get the local graph data for a note
 * Includes the center node, outbound links, and inbound links (backlinks)
 */
export function getLocalGraph(noteSlug: string): LocalGraph | null {
  const allNotes = getAllNotes();
  const noteMap = new Map(allNotes.map(n => [n.slug, n]));
  const centerNote = noteMap.get(noteSlug);
  
  if (!centerNote) return null;
  
  const cache = getLinkCache();
  
  // Build center node
  const center: GraphNode = {
    slug: centerNote.slug,
    title: centerNote.title,
    exists: true,
  };
  
  // Build outbound nodes
  const outboundSlugs = cache.outboundMap.get(noteSlug) || [];
  const outbound: GraphNode[] = outboundSlugs.map(slug => {
    const note = noteMap.get(slug);
    return {
      slug,
      title: note?.title || slug,
      exists: noteExists(slug),
    };
  });
  
  // Build inbound nodes (backlinks)
  const inboundSlugs = cache.inboundMap.get(noteSlug) || [];
  const inbound: GraphNode[] = inboundSlugs
    .map(slug => {
      const note = noteMap.get(slug);
      if (!note || !isNoteVisible(note)) return null;
      return {
        slug,
        title: note.title,
        exists: true,
      };
    })
    .filter((n): n is GraphNode => n !== null);
  
  // Build edges
  const edges: GraphEdge[] = [
    // Outbound edges (from center to targets)
    ...outboundSlugs.map(target => ({
      source: noteSlug,
      target,
    })),
    // Inbound edges (from sources to center)
    ...inbound.map(node => ({
      source: node.slug,
      target: noteSlug,
    })),
  ];
  
  return {
    center,
    outbound,
    inbound,
    edges,
  };
}

/**
 * Get all notes that form the complete graph
 * Useful for building a full knowledge graph view
 */
export function getFullGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const allNotes = getAllNotes().filter(isNoteVisible);
  const cache = getLinkCache();
  
  const nodes: GraphNode[] = allNotes.map(note => ({
    slug: note.slug,
    title: note.title,
    exists: true,
  }));
  
  const edges: GraphEdge[] = [];
  for (const note of allNotes) {
    const outbound = cache.outboundMap.get(note.slug) || [];
    for (const target of outbound) {
      edges.push({
        source: note.slug,
        target,
      });
    }
  }
  
  return { nodes, edges };
}
