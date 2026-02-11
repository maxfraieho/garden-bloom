// Zone Validation Hook
// Validates zone access and fetches zone data for guest view

import { useState, useEffect, useCallback } from 'react';
import type { NotebookLMMapping } from '@/types/mcpGateway';

export interface ZoneNote {
  slug: string;
  title: string;
  content: string;
  tags: string[];
}

export interface ZoneData {
  id: string;
  name: string;
  description?: string;
  folders: string[];
  noteCount: number;
  notes: ZoneNote[];
  expiresAt: number;
  accessType: 'web' | 'mcp' | 'both';
  notebooklm?: NotebookLMMapping | null;
  consentRequired?: boolean; // Default true if not specified
}

interface ZoneValidationState {
  isLoading: boolean;
  isValid: boolean;
  isExpired: boolean;
  error: string | null;
  zone: ZoneData | null;
}

const MCP_GATEWAY_URL = import.meta.env.VITE_MCP_GATEWAY_URL || 'https://garden-mcp-server.maxfraieho.workers.dev';

export function useZoneValidation(zoneId: string | undefined, accessCode: string | null) {
  const [state, setState] = useState<ZoneValidationState>({
    isLoading: true,
    isValid: false,
    isExpired: false,
    error: null,
    zone: null,
  });

  const validateZone = useCallback(async () => {
    if (!zoneId) {
      setState({
        isLoading: false,
        isValid: false,
        isExpired: false,
        error: 'Zone ID is required',
        zone: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const url = new URL(`${MCP_GATEWAY_URL}/zones/validate/${zoneId}`);
      if (accessCode) {
        url.searchParams.set('code', accessCode);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        
        if (response.status === 410 || data.expired) {
          setState({
            isLoading: false,
            isValid: false,
            isExpired: true,
            error: 'This access zone has expired',
            zone: null,
          });
          return;
        }
        
        throw new Error(data.error || 'Zone validation failed');
      }

      const data = await response.json();
      
      // Backend now returns complete zone data directly (not nested in .zone)
      let notebooklmData: NotebookLMMapping | null = data.notebooklm ?? null;
      
      // If notebooklm not in response, fetch it separately (guest access doesn't include it by default)
      if (!notebooklmData) {
        try {
          const nlmResponse = await fetch(`${MCP_GATEWAY_URL}/zones/${zoneId}/notebooklm`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (nlmResponse.ok) {
            const nlmData = await nlmResponse.json();
            if (nlmData.success && nlmData.notebooklm) {
              notebooklmData = nlmData.notebooklm;
            }
          }
        } catch (nlmErr) {
          // NotebookLM fetch failed - continue without it
          console.warn('Failed to fetch NotebookLM status:', nlmErr);
        }
      }
      
      const zoneData: ZoneData = {
        id: data.id || data.zoneId,
        name: data.name || 'Access Zone',
        description: data.description,
        folders: data.folders || data.allowedPaths || [],
        noteCount: data.noteCount || 0,
        notes: data.notes || [],
        expiresAt: data.expiresAt,
        accessType: data.accessType || 'both',
        notebooklm: notebooklmData,
        // Default to true if not specified (backward compatibility)
        consentRequired: data.consentRequired ?? true,
      };
      
      // Check if expired based on expiresAt
      const isExpired = Date.now() > zoneData.expiresAt;
      
      if (isExpired) {
        setState({
          isLoading: false,
          isValid: false,
          isExpired: true,
          error: 'This access zone has expired',
          zone: null,
        });
        return;
      }

      setState({
        isLoading: false,
        isValid: true,
        isExpired: false,
        error: null,
        zone: zoneData,
      });
    } catch (err) {
      setState({
        isLoading: false,
        isValid: false,
        isExpired: false,
        error: err instanceof Error ? err.message : 'Failed to validate zone',
        zone: null,
      });
    }
  }, [zoneId, accessCode]);

  useEffect(() => {
    validateZone();
  }, [validateZone]);

  // Check expiration periodically
  useEffect(() => {
    if (!state.zone) return;

    const checkExpiration = () => {
      if (Date.now() > state.zone!.expiresAt) {
        setState(prev => ({
          ...prev,
          isValid: false,
          isExpired: true,
          error: 'This access zone has expired',
        }));
      }
    };

    const interval = setInterval(checkExpiration, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [state.zone]);

  const getTimeRemaining = useCallback((): string => {
    if (!state.zone) return '';
    
    const remaining = state.zone.expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, [state.zone]);

  return {
    ...state,
    validateZone,
    getTimeRemaining,
  };
}
