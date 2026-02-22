/**
 * Graph Parser Contract v1
 * 
 * This module implements the SAME graph-building contract as scripts/check-graph.py.
 * It is the single source-of-truth for how the frontend constructs the knowledge graph.
 * 
 * Contract summary (matching check-graph.py):
 * 
 * 1. NODES: All .md files in src/site/notes/** with dg-publish !== false
 * 2. WIKILINK EXTRACTION: Regex [^\]|#\\] — excludes \, /, # from targets
 * 3. RESOLUTION: stem-based, case-insensitive (filename without extension)
 *    - Exact stem match (case-insensitive)
 *    - If target contains /, extract last segment as stem
 * 4. EDGES: directed (source slug → target slug), deduplicated per source
 * 5. EXCLUSIONS: links with \| (backslash-pipe) are invalid/skipped
 * 6. CODE BLOCKS: fenced (```) and inline (`) code is stripped before parsing
 */

import type { Note } from './types';
import { getAllNotes } from './noteLoader';

// ── Contract version ──
export const GRAPH_CONTRACT_VERSION = 'v1';

// ── Types ──

export interface GraphSnapshot {
  contractVersion: string;
  source: 'snapshot' | 'client-parse';
  generatedAt: string;
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
  diagnostics: GraphDiagnostics;
}

export interface SnapshotNode {
  slug: string;
  title: string;
  stem: string; // lowercase filename without extension
  exists: boolean;
}

export interface SnapshotEdge {
  source: string; // slug
  target: string; // slug
}

export interface GraphDiagnostics {
  totalNodes: number;
  totalEdges: number;
  unresolvedLinks: UnresolvedLink[];
  malformedLinks: MalformedLink[];
}

export interface UnresolvedLink {
  sourceSlug: string;
  sourceTitle: string;
  targetText: string; // raw wikilink text
}

export interface MalformedLink {
  sourceSlug: string;
  sourceTitle: string;
  raw: string;
  reason: 'backslash-pipe' | 'backslash-in-target';
}

// ── Code block stripping (matches check-graph.py: strip_code_blocks) ──

function stripCodeBlocks(text: string): string {
  // Remove fenced code blocks (``` ... ```)
  let result = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code (`...`)
  result = result.replace(/`[^`\n]+`/g, '');
  return result;
}

// ── Wikilink extraction (matches check-graph.py: LINK_RE) ──

/**
 * Canonical link regex — matches [[target]] or [[target|alias]]
 * Key: [^\]|#\\] excludes ], |, #, and \ from targets.
 * This is identical to check-graph.py's LINK_RE pattern.
 */
const CANONICAL_LINK_RE = /\[\[([^\]|#\\]+?)(?:\|[^\]]+)?\]\]/g;

/**
 * Detect malformed backslash-pipe links [[target\|alias]]
 */
const BACKSLASH_PIPE_RE = /\[\[([^\]]+\\[|][^\]]*)\]\]/g;

export interface ExtractedLink {
  target: string; // raw target text, trimmed
}

/**
 * Extract wikilinks from markdown content, stripping code blocks first.
 * Matches check-graph.py's extraction logic exactly.
 */
export function extractWikilinks(content: string): ExtractedLink[] {
  const body = stripCodeBlocks(content);
  const links: ExtractedLink[] = [];
  
  CANONICAL_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  
  while ((match = CANONICAL_LINK_RE.exec(body)) !== null) {
    const target = match[1].trim();
    if (target.length > 0) {
      links.push({ target });
    }
  }
  
  return links;
}

/**
 * Detect malformed links (backslash-pipe format) for diagnostics
 */
export function detectMalformedLinks(content: string): string[] {
  const body = stripCodeBlocks(content);
  const results: string[] = [];
  
  BACKSLASH_PIPE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  
  while ((match = BACKSLASH_PIPE_RE.exec(body)) !== null) {
    results.push(match[1]);
  }
  
  return results;
}

// ── Stem resolution (matches check-graph.py: stem_map logic) ──

/**
 * Extract stem from a wikilink target.
 * If target contains /, take the last segment (matching JS fallback in check-graph.py).
 * Always lowercase for comparison.
 */
export function extractStem(target: string): string {
  let stem = target.trim();
  // If path, take last segment (matches check-graph.py line 121)
  if (stem.includes('/')) {
    stem = stem.split('/').pop() || stem;
  }
  return stem.toLowerCase();
}

/**
 * Build a stem→slug map from all notes (matches check-graph.py: stem_map).
 * First note wins for duplicate stems (same as check-graph.py).
 */
export function buildStemMap(notes: Note[]): Map<string, string> {
  const stemMap = new Map<string, string>();
  
  for (const note of notes) {
    const decoded = decodeURIComponent(note.slug);
    // Extract filename from path
    const filename = decoded.split('/').pop() || decoded;
    // Remove .md if present (shouldn't be, but safety)
    const stem = filename.replace(/\.md$/i, '').toLowerCase();
    
    if (!stemMap.has(stem)) {
      stemMap.set(stem, note.slug);
    }
  }
  
  return stemMap;
}

// ── Full graph builder (client-parse mode) ──

/**
 * Build the complete graph snapshot from loaded notes.
 * This implements the same logic as check-graph.py's run_smoke_test().
 */
export function buildGraphFromNotes(): GraphSnapshot {
  const allNotes = getAllNotes();
  
  // Filter visible notes (dg_publish !== false)
  const visibleNotes = allNotes.filter(n => n.frontmatter.dg_publish !== false);
  
  // Build stem map for resolution
  const stemMap = buildStemMap(visibleNotes);
  
  const nodes: SnapshotNode[] = visibleNotes.map(note => {
    const decoded = decodeURIComponent(note.slug);
    const filename = decoded.split('/').pop() || decoded;
    return {
      slug: note.slug,
      title: note.title,
      stem: filename.replace(/\.md$/i, '').toLowerCase(),
      exists: true,
    };
  });
  
  const edges: SnapshotEdge[] = [];
  const unresolvedLinks: UnresolvedLink[] = [];
  const malformedLinks: MalformedLink[] = [];
  
  // Strip frontmatter before parsing (matches check-graph.py)
  const FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*\n/;
  
  for (const note of visibleNotes) {
    const fmMatch = note.rawContent.match(FRONTMATTER_RE);
    const body = fmMatch ? note.rawContent.slice(fmMatch[0].length) : note.content;
    
    // Extract canonical links
    const links = extractWikilinks(body);
    const seenTargets = new Set<string>();
    
    for (const link of links) {
      const stem = extractStem(link.target);
      const targetSlug = stemMap.get(stem);
      
      if (targetSlug && targetSlug !== note.slug && !seenTargets.has(targetSlug)) {
        seenTargets.add(targetSlug);
        edges.push({ source: note.slug, target: targetSlug });
      } else if (!targetSlug) {
        unresolvedLinks.push({
          sourceSlug: note.slug,
          sourceTitle: note.title,
          targetText: link.target,
        });
      }
    }
    
    // Detect malformed links
    const malformed = detectMalformedLinks(body);
    for (const raw of malformed) {
      malformedLinks.push({
        sourceSlug: note.slug,
        sourceTitle: note.title,
        raw,
        reason: raw.includes('\\|') ? 'backslash-pipe' : 'backslash-in-target',
      });
    }
  }
  
  return {
    contractVersion: GRAPH_CONTRACT_VERSION,
    source: 'client-parse',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    diagnostics: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      unresolvedLinks,
      malformedLinks,
    },
  };
}
