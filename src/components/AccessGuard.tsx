// Access Guard
// Protects all routes - requires owner authentication
// Zone routes (/zone/*) are exempt as they have their own code-based validation

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { AccessGateUI } from './AccessGateUI';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Loader2 } from 'lucide-react';

interface AccessGuardProps {
  children: ReactNode;
}

export function AccessGuard({ children }: AccessGuardProps) {
  const location = useLocation();
  const { isAuthenticated, gatewayAvailable, isLoading, isInitialized } = useOwnerAuth();

  // Allow zone access routes (validation happens in ZoneViewPage)
  if (location.pathname.startsWith('/zone/')) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Перевірка доступу...</p>
        </div>
      </div>
    );
  }

  // Gateway unavailable - show error
  if (!gatewayAvailable) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Сервер недоступний</CardTitle>
            <CardDescription>
              Не вдалося з'єднатися з сервером автентифікації. Спробуйте пізніше.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return <AccessGateUI />;
  }

  // Authenticated - show content
  return <>{children}</>;
}
