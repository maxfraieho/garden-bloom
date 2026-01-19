// Access Zones Hook
// Manages delegated access zones with TTL, folder restrictions, and access types

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getOwnerToken } from './useOwnerAuth';

export type AccessType = 'web' | 'mcp' | 'both';

export interface AccessZone {
  id: string;
  name: string;
  description?: string;
  folders: string[];
  noteCount: number;
  accessType: AccessType;
  createdAt: number;
  expiresAt: number;
  accessCode?: string;
  webUrl?: string;
  mcpUrl?: string;
}

export interface CreateZoneParams {
  name: string;
  description?: string;
  folders: string[];
  noteCount: number;
  accessType: AccessType;
  ttlMinutes: number;
  notes?: { slug: string; title: string; content: string; tags: string[] }[];
}

const MCP_GATEWAY_URL = import.meta.env.VITE_MCP_GATEWAY_URL || 'https://garden-mcp-server.maxfraieho.workers.dev';
const APP_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Generate URLs for a zone based on its accessCode and accessType
 */
function generateZoneUrls(zone: any): AccessZone {
  return {
    ...zone,
    webUrl: zone.accessType !== 'mcp' && zone.accessCode
      ? `${APP_BASE_URL}/zone/${zone.id}?code=${zone.accessCode}`
      : undefined,
    mcpUrl: zone.accessType !== 'web' && zone.id
      ? `${MCP_GATEWAY_URL}/mcp/${zone.id}`
      : undefined,
  };
}

export function useAccessZones() {
  const [zones, setZones] = useState<AccessZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    const token = getOwnerToken();
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${MCP_GATEWAY_URL}/zones/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch zones');
      }

      const data = await response.json();
      // Generate URLs on frontend from accessCode
      const zonesWithUrls = (data.zones || []).map(generateZoneUrls);
      setZones(zonesWithUrls);
    } catch (err) {
      console.error('[AccessZones] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch zones');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createZone = useCallback(async (params: CreateZoneParams): Promise<AccessZone | null> => {
    const token = getOwnerToken();
    if (!token) {
      toast.error('Authentication required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${MCP_GATEWAY_URL}/zones/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: params.name,
          description: params.description,
          allowedPaths: params.folders,
          accessType: params.accessType,
          ttlMinutes: params.ttlMinutes,
          notes: params.notes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create zone');
      }

      const data = await response.json();
      
      const newZone: AccessZone = {
        id: data.zoneId,
        name: params.name,
        description: params.description,
        folders: params.folders,
        noteCount: params.noteCount,
        accessType: params.accessType,
        createdAt: Date.now(),
        expiresAt: Date.now() + params.ttlMinutes * 60 * 1000,
        accessCode: data.accessCode,
        webUrl: params.accessType !== 'mcp' 
          ? `${APP_BASE_URL}/zone/${data.zoneId}?code=${data.accessCode}`
          : undefined,
        mcpUrl: params.accessType !== 'web'
          ? `${MCP_GATEWAY_URL}/mcp/${data.zoneId}`
          : undefined,
      };

      setZones(prev => [newZone, ...prev]);
      toast.success('Access zone created');
      return newZone;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create zone';
      setError(message);
      toast.error('Failed to create zone', { description: message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeZone = useCallback(async (zoneId: string): Promise<boolean> => {
    const token = getOwnerToken();
    if (!token) {
      toast.error('Authentication required');
      return false;
    }

    setIsLoading(true);

    try {
      // 🔐 Protected endpoint - uses DELETE method per Worker v3.0
      const response = await fetch(`${MCP_GATEWAY_URL}/zones/${zoneId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revoke zone');
      }

      setZones(prev => prev.filter(z => z.id !== zoneId));
      toast.success('Access zone revoked');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke zone';
      toast.error('Failed to revoke zone', { description: message });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTimeRemaining = useCallback((expiresAt: number): string => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, []);

  const isExpired = useCallback((expiresAt: number): boolean => {
    return Date.now() > expiresAt;
  }, []);

  return {
    zones,
    isLoading,
    error,
    fetchZones,
    createZone,
    revokeZone,
    getTimeRemaining,
    isExpired,
  };
}
