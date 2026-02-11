// Wikilink parsing utilities for Obsidian-style [[links]]

import type { NoteLink } from './types';
import { noteExists } from './noteLoader';

// Regex to match [[target]] or [[target|alias]]
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface ParsedWikilink {
  fullMatch: string;
  target: string;
  alias: string | null;
  exists: boolean;
}

/**
 * Parse all wikilinks from a markdown string
 */
export function parseWikilinks(content: string): ParsedWikilink[] {
  const links: ParsedWikilink[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKILINK_REGEX.lastIndex = 0;

  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    const target = match[1].trim();
    const alias = match[2]?.trim() || null;
    const slug = slugify(target);

    links.push({
      fullMatch: match[0],
      target: slug,
      alias,
      exists: noteExists(slug),
    });
  }

  return links;
}

/**
 * Convert a note title to a URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Transform markdown content, replacing wikilinks with placeholder tokens
 * that will be handled by the React component
 */
export function transformWikilinks(content: string): string {
  return content.replace(WIKILINK_REGEX, (match, target, alias) => {
    const slug = slugify(target.trim());
    const displayText = alias?.trim() || target.trim();
    const exists = noteExists(slug);
    
    // Use a special marker format that we can parse in React
    // Format: %%WIKILINK:slug:displayText:exists%%
    return `%%WIKILINK:${slug}:${displayText}:${exists}%%`;
  });
}

/**
 * Parse a wikilink marker back to its components
 */
export function parseWikilinkMarker(marker: string): ParsedWikilink | null {
  const regex = /%%WIKILINK:([^:]+):([^:]+):(true|false)%%/;
  const match = marker.match(regex);
  
  if (!match) return null;
  
  return {
    fullMatch: marker,
    target: match[1],
    alias: match[2],
    exists: match[3] === 'true',
  };
}
