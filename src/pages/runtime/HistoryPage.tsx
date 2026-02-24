import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BloomRuntimeHeader } from '@/components/runtime/BloomRuntimeHeader';
import { BloomRuntimeFooter } from '@/components/runtime/BloomRuntimeFooter';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BloomRuntimeHeader />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground font-sans flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Execution History
          </h1>
          <p className="text-sm text-muted-foreground font-sans mt-1">
            Past runtime executions and their results.
          </p>
        </header>

        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-sans">No execution history yet.</p>
          </CardContent>
        </Card>
      </main>
      <BloomRuntimeFooter />
    </div>
  );
}
