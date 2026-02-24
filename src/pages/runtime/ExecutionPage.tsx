import { Play, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BloomRuntimeHeader } from '@/components/runtime/BloomRuntimeHeader';
import { BloomRuntimeFooter } from '@/components/runtime/BloomRuntimeFooter';

export default function ExecutionPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BloomRuntimeHeader />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground font-sans flex items-center gap-2">
            <Play className="w-6 h-6 text-primary" />
            Execution
          </h1>
          <p className="text-sm text-muted-foreground font-sans mt-1">
            Active behavioral flows and runtime execution state.
          </p>
        </header>

        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-sans">No active executions.</p>
            <p className="text-xs text-muted-foreground/60 font-sans mt-1">
              Execution state will appear here when agents run behavioral flows via membridge.
            </p>
          </CardContent>
        </Card>
      </main>
      <BloomRuntimeFooter />
    </div>
  );
}
