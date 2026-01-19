// Comments Hook for fetching and managing article comments
// Architecture: React → Cloudflare Worker → MinIO + KV

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getOwnerToken, useOwnerAuth } from './useOwnerAuth';
import type { 
  Comment, 
  CommentStatus,
  CreateCommentResponse, 
  FetchCommentsResponse,
  UpdateCommentResponse 
} from '@/lib/comments/types';

const GATEWAY_URL = import.meta.env.VITE_MCP_GATEWAY_URL || 'https://garden-mcp-server.maxfraieho.workers.dev';

interface UseCommentsOptions {
  autoFetch?: boolean;
}

export function useComments(articleSlug: string, options: UseCommentsOptions = {}) {
  const { autoFetch = true } = options;
  const { isAuthenticated: isOwner } = useOwnerAuth();
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch comments for article
  const fetchComments = useCallback(async () => {
    if (!articleSlug) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add owner token if available for seeing pending comments
      const token = getOwnerToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(
        `${GATEWAY_URL}/comments/${encodeURIComponent(articleSlug)}`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }
      
      const data: FetchCommentsResponse = await response.json();
      
      if (data.success) {
        setComments(data.comments);
      } else {
        throw new Error(data.error || 'Failed to fetch comments');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[Comments] Fetch error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [articleSlug]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && articleSlug) {
      fetchComments();
    }
  }, [autoFetch, articleSlug, fetchComments]);

  // Create new comment
  const createComment = useCallback(async (
    content: string,
    parentId?: string | null,
    authorName?: string
  ): Promise<Comment | null> => {
    const token = getOwnerToken();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${GATEWAY_URL}/comments/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          articleSlug,
          content,
          parentId: parentId || null,
          authorName: authorName || (isOwner ? 'Owner' : 'Guest'),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: CreateCommentResponse = await response.json();
      
      if (data.success && data.comment) {
        setComments(prev => [...prev, data.comment!]);
        toast.success('💬 Коментар додано');
        return data.comment;
      } else {
        throw new Error(data.error || 'Failed to create comment');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Помилка створення коментаря', { description: message });
      return null;
    }
  }, [articleSlug, isOwner]);

  // Update comment (owner only - for moderation)
  const updateComment = useCallback(async (
    commentId: string,
    updates: { status?: CommentStatus; content?: string }
  ): Promise<Comment | null> => {
    const token = getOwnerToken();
    if (!token) {
      toast.error('Потрібна авторизація власника');
      return null;
    }
    
    try {
      const response = await fetch(`${GATEWAY_URL}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: UpdateCommentResponse = await response.json();
      
      if (data.success && data.comment) {
        setComments(prev => 
          prev.map(c => c.id === commentId ? data.comment! : c)
        );
        
        if (updates.status === 'approved') {
          toast.success('✅ Коментар схвалено');
        } else if (updates.status === 'rejected') {
          toast.success('🚫 Коментар відхилено');
        }
        
        return data.comment;
      } else {
        throw new Error(data.error || 'Failed to update comment');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Помилка оновлення', { description: message });
      return null;
    }
  }, []);

  // Delete comment (owner only)
  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    const token = getOwnerToken();
    if (!token) {
      toast.error('Потрібна авторизація власника');
      return false;
    }
    
    try {
      const response = await fetch(`${GATEWAY_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('🗑️ Коментар видалено');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Помилка видалення', { description: message });
      return false;
    }
  }, []);

  // Filter helpers
  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);
  const approvedComments = comments.filter(c => c.status === 'approved');
  const pendingComments = comments.filter(c => c.status === 'pending');

  return {
    comments,
    rootComments,
    approvedComments,
    pendingComments,
    getReplies,
    isLoading,
    error,
    fetchComments,
    createComment,
    updateComment,
    deleteComment,
  };
}
