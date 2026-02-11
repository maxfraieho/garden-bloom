// Annotations Hook for fetching and managing article annotations
// Architecture: React → Cloudflare Worker → MinIO + KV

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getOwnerToken, useOwnerAuth } from './useOwnerAuth';
import type { 
  Annotation,
  Comment,
  CreateAnnotationResponse, 
  FetchAnnotationsResponse 
} from '@/lib/comments/types';

const GATEWAY_URL = import.meta.env.VITE_MCP_GATEWAY_URL || 'https://garden-mcp-server.maxfraieho.workers.dev';

interface UseAnnotationsOptions {
  autoFetch?: boolean;
}

export function useAnnotations(articleSlug: string, options: UseAnnotationsOptions = {}) {
  const { autoFetch = true } = options;
  const { isAuthenticated: isOwner } = useOwnerAuth();
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationComments, setAnnotationComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch annotations for article
  const fetchAnnotations = useCallback(async () => {
    if (!articleSlug) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      const token = getOwnerToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(
        `${GATEWAY_URL}/annotations/${encodeURIComponent(articleSlug)}`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch annotations: ${response.status}`);
      }
      
      const data: FetchAnnotationsResponse = await response.json();
      
      if (data.success) {
        setAnnotations(data.annotations);
        setAnnotationComments(data.comments);
      } else {
        throw new Error(data.error || 'Failed to fetch annotations');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[Annotations] Fetch error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [articleSlug]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && articleSlug) {
      fetchAnnotations();
    }
  }, [autoFetch, articleSlug, fetchAnnotations]);

  // Create new annotation with linked comment
  const createAnnotation = useCallback(async (
    highlightedText: string,
    startOffset: number,
    endOffset: number,
    paragraphIndex: number,
    commentContent: string,
    authorName?: string
  ): Promise<{ annotation: Annotation; comment: Comment } | null> => {
    const token = getOwnerToken();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${GATEWAY_URL}/annotations/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          articleSlug,
          highlightedText,
          startOffset,
          endOffset,
          paragraphIndex,
          comment: {
            content: commentContent,
            authorName: authorName || (isOwner ? 'Owner' : 'Guest'),
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: CreateAnnotationResponse = await response.json();
      
      if (data.success && data.annotation && data.comment) {
        setAnnotations(prev => [...prev, data.annotation!]);
        setAnnotationComments(prev => [...prev, data.comment!]);
        toast.success('📝 Анотацію додано');
        return { annotation: data.annotation, comment: data.comment };
      } else {
        throw new Error(data.error || 'Failed to create annotation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Помилка створення анотації', { description: message });
      return null;
    }
  }, [articleSlug, isOwner]);

  // Delete annotation
  const deleteAnnotation = useCallback(async (annotationId: string): Promise<boolean> => {
    const token = getOwnerToken();
    if (!token) {
      toast.error('Потрібна авторизація власника');
      return false;
    }
    
    try {
      const response = await fetch(`${GATEWAY_URL}/annotations/${annotationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const annotation = annotations.find(a => a.id === annotationId);
      if (annotation) {
        setAnnotations(prev => prev.filter(a => a.id !== annotationId));
        setAnnotationComments(prev => prev.filter(c => c.id !== annotation.commentId));
      }
      
      toast.success('🗑️ Анотацію видалено');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Помилка видалення', { description: message });
      return false;
    }
  }, [annotations]);

  // Get comment for specific annotation
  const getAnnotationComment = useCallback((annotationId: string): Comment | undefined => {
    const annotation = annotations.find(a => a.id === annotationId);
    if (!annotation) return undefined;
    return annotationComments.find(c => c.id === annotation.commentId);
  }, [annotations, annotationComments]);

  return {
    annotations,
    annotationComments,
    isLoading,
    error,
    fetchAnnotations,
    createAnnotation,
    deleteAnnotation,
    getAnnotationComment,
  };
}
