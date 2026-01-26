import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, RotateCcw, TriangleAlert } from 'lucide-react';
import type { NotebookLMJobStatus, NotebookLMMapping } from '@/types/mcpGateway';
import {
  getNotebookLMJobStatus,
  getZoneNotebookLMStatus,
  retryNotebookLMImport,
} from '@/lib/api/mcpGatewayClient';
import { cn } from '@/lib/utils';

type Props = {
  zoneId: string;
  initialNotebooklm?: NotebookLMMapping | null;
  isOwner: boolean;
};

const HARD_TIMEOUT_MS = 15 * 60 * 1000;

function computeProgress(job: NotebookLMJobStatus | undefined): number {
  if (!job) return 0;
  if (typeof job.progress === 'number') return Math.max(0, Math.min(100, job.progress));
  if (job.current_step && job.total_steps) {
    return Math.max(0, Math.min(100, Math.round((job.current_step / job.total_steps) * 100)));
  }
  return 12;
}

function stopPollingFor(job: NotebookLMJobStatus | undefined): boolean {
  if (!job) return false;
  return job.status === 'completed' || job.status === 'failed';
}

export function NotebookLMSetupPanel({ zoneId, initialNotebooklm, isOwner }: Props) {
  const [mapping, setMapping] = useState<NotebookLMMapping | null>(initialNotebooklm ?? null);
  const [backoffMs, setBackoffMs] = useState(2500);
  const [timedOut, setTimedOut] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  // Source of truth: zone notebooklm mapping
  const mappingQuery = useQuery({
    queryKey: ['notebooklm-mapping', zoneId],
    queryFn: () => getZoneNotebookLMStatus(zoneId),
    enabled: !mapping,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (mappingQuery.data?.notebooklm !== undefined) {
      setMapping(mappingQuery.data.notebooklm);
    }
  }, [mappingQuery.data]);

  const jobId = mapping?.importJobId ?? null;

  const jobQuery = useQuery({
    queryKey: ['notebooklm-job', zoneId, jobId],
    queryFn: () => getNotebookLMJobStatus(zoneId, jobId as string),
    enabled: !!jobId && !timedOut,
    refetchInterval: (query) => {
      if (!jobId) return false;
      const data = query.state.data as NotebookLMJobStatus | undefined;
      if (stopPollingFor(data)) return false;
      return backoffMs;
    },
    retry: (failureCount, error) => {
      // Only keep retrying a bit; backoff will slow polling.
      if (failureCount >= 3) return false;
      return true;
    },
  });

  // Backoff on network-ish errors
  useEffect(() => {
    if (!jobQuery.isError) return;
    setBackoffMs((prev) => Math.min(30_000, prev * 2));
  }, [jobQuery.isError]);

  // Hard timeout
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - startedAtRef.current > HARD_TIMEOUT_MS) {
        setTimedOut(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // When job ends, refresh mapping once
  useEffect(() => {
    const status = jobQuery.data?.status;
    if (!status) return;
    if (status === 'completed' || status === 'failed') {
      getZoneNotebookLMStatus(zoneId)
        .then((d) => setMapping(d.notebooklm))
        .catch(() => {
          // ignore: UI can still show job result
        });
    }
  }, [jobQuery.data?.status, zoneId]);

  const derived = useMemo(() => {
    const job = jobQuery.data;
    const progress = computeProgress(job);
    const done = stopPollingFor(job);

    const notebookUrl = job?.notebook_url ?? mapping?.notebookUrl ?? null;

    const stepText =
      job?.current_step && job?.total_steps
        ? `Step ${job.current_step}/${job.total_steps}`
        : job?.status
          ? `Status: ${job.status}`
          : null;

    const errorText = job?.error || mapping?.lastError || null;
    return { job, progress, done, notebookUrl, stepText, errorText };
  }, [jobQuery.data, mapping?.notebookUrl, mapping?.lastError]);

  if (mapping === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">NotebookLM setup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">NotebookLM is not enabled for this zone.</p>
        </CardContent>
      </Card>
    );
  }

  const isReady = derived.job?.status === 'completed' || mapping.status === 'completed';
  const isFailed = derived.job?.status === 'failed' || mapping.status === 'failed';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">NotebookLM setup</CardTitle>
        <Badge
          variant={
            isReady ? 'default' : isFailed ? 'destructive' : timedOut ? 'outline' : 'secondary'
          }
        >
          {timedOut ? 'taking too long' : isReady ? 'ready' : isFailed ? 'failed' : 'in progress'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {timedOut && (
          <Alert>
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Taking longer than expected</AlertTitle>
            <AlertDescription>
              Import is still running or the gateway is slow. You can keep this page open or retry (owner only).
            </AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        {!isReady && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{derived.stepText || 'Importing…'}</span>
              <span className={cn('tabular-nums', isFailed && 'text-destructive')}>{derived.progress}%</span>
            </div>
            <Progress value={derived.progress} />
          </div>
        )}

        {/* Error */}
        {isFailed && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>
              {derived.errorText || 'NotebookLM import failed. Please retry.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {derived.notebookUrl && (
            <Button asChild variant="default" size="sm" className="gap-2">
              <a href={derived.notebookUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open NotebookLM
              </a>
            </Button>
          )}

          {isOwner && (isFailed || timedOut) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                setTimedOut(false);
                setBackoffMs(2500);
                startedAtRef.current = Date.now();
                const resp = await retryNotebookLMImport(zoneId);
                setMapping(resp.notebooklm);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Retry import
            </Button>
          )}
        </div>

        {/* External service note */}
        <p className="text-xs text-muted-foreground">
          NotebookLM opens in an external Google service in a new tab.
        </p>
      </CardContent>
    </Card>
  );
}
