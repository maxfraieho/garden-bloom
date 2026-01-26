import { useMemo, useState } from 'react';
import { GardenHeader } from '@/components/garden/GardenHeader';
import { GardenFooter } from '@/components/garden/GardenFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { getApiErrors } from '@/lib/api/apiErrorStore';
import { getGatewayBaseUrl, pingHealth } from '@/lib/api/mcpGatewayClient';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

export default function AdminDiagnosticsPage() {
  const { isAuthenticated, gatewayAvailable } = useOwnerAuth();
  const [health, setHealth] = useState<any>(null);
  const baseUrl = getGatewayBaseUrl();

  const errors = useMemo(() => getApiErrors(), [health]);

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GardenHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground font-serif">Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Quick checks for the MCP gateway + NotebookLM flows.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={gatewayAvailable ? 'default' : 'destructive'}>
                gateway {gatewayAvailable ? 'reachable' : 'unreachable'}
              </Badge>
              <Badge variant={isAuthenticated ? 'default' : 'secondary'}>
                owner {isAuthenticated ? 'authenticated' : 'not authenticated'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Gateway base URL</p>
                <p className="text-sm text-muted-foreground truncate">{baseUrl}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(baseUrl)}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await pingHealth();
                    setHealth(res);
                    toast.success('Health OK');
                  } catch {
                    toast.error('Health check failed');
                  }
                }}
              >
                Ping /health
              </Button>
            </div>

            {health && (
              <pre className="text-xs bg-muted/50 border border-border rounded-md p-3 overflow-auto">
                {JSON.stringify(health, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last API errors (client)</CardTitle>
          </CardHeader>
          <CardContent>
            {errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors recorded.</p>
            ) : (
              <ScrollArea className="h-56">
                <div className="space-y-3 pr-3">
                  {errors.map((e, idx) => (
                    <div key={idx} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{e.message}</p>
                        {e.httpStatus ? (
                          <Badge variant="outline">{e.httpStatus}</Badge>
                        ) : null}
                      </div>
                      {(e.code || e.details) && (
                        <pre className="text-xs text-muted-foreground mt-2 overflow-auto">
                          {JSON.stringify({ code: e.code, details: e.details }, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
      <GardenFooter />
    </div>
  );
}
