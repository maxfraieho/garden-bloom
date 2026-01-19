// Access Guard
// Protects all routes except /zone/* which have their own validation

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { AccessGateUI } from './AccessGateUI';

interface AccessGuardProps {
  children: ReactNode;
}

export function AccessGuard({ children }: AccessGuardProps) {
  const location = useLocation();
  const { isAuthenticated, gatewayAvailable } = useOwnerAuth();

  // Allow zone access routes (validation happens in ZoneViewPage)
  if (location.pathname.startsWith('/zone/')) {
    return <>{children}</>;
  }

  // If MCP gateway is unavailable, show content in public/read-only mode
  if (!gatewayAvailable) {
    return <>{children}</>;
  }

  // Require owner authentication for all other routes
  if (!isAuthenticated) {
    return <AccessGateUI />;
  }

  return <>{children}</>;
}
