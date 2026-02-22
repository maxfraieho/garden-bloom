// Proposals Inbox Component
// Owner view for pending edit proposals + audit history in Chat page

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileEdit, 
  Check, 
  X, 
  Clock,
  User,
  FileText,
  Inbox,
  Loader2,
  Copy,
  CheckCircle2,
  History,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPendingProposals, acceptProposal, rejectProposal, getProposalHistory } from '@/lib/api/mcpGatewayClient';
import { ProposalDiffView } from './ProposalDiffView';
import type { EditProposal, AcceptProposalResponse } from '@/types/mcpGateway';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ProposalsInboxProps {
  className?: string;
}

const MIN_DECISION_NOTE_LENGTH = 10;

type HistoryFilter = 'all' | 'approved' | 'rejected';

const STATUS_BADGE_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  approved: { variant: 'default', label: 'Approved' },
  applied: { variant: 'default', label: 'Applied' },
  auto_approved: { variant: 'default', label: 'Auto-approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  expired: { variant: 'secondary', label: 'Expired' },
  failed: { variant: 'destructive', label: 'Failed' },
};

export function ProposalsInbox({ className }: ProposalsInboxProps) {
  const { t } = useLocale();
  const [proposals, setProposals] = useState<EditProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<EditProposal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [acceptedProposal, setAcceptedProposal] = useState<EditProposal | null>(null);
  const [copied, setCopied] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  // History state
  const [historyItems, setHistoryItems] = useState<EditProposal[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const isDecisionNoteValid = decisionNote.trim().length >= MIN_DECISION_NOTE_LENGTH;

  const fetchProposals = async () => {
    try {
      const res = await getPendingProposals(20);
      setProposals(res.proposals);
    } catch (err) {
      console.error('[ProposalsInbox] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const statusParam = historyFilter === 'all' ? 'applied,rejected,auto_approved,expired' 
        : historyFilter === 'approved' ? 'applied,approved,auto_approved'
        : 'rejected';
      const res = await getProposalHistory({ status: statusParam, limit: 50 });
      setHistoryItems(res.proposals);
      setHistoryLoaded(true);
    } catch (err: any) {
      const code = err?.code || '';
      const status = err?.httpStatus;
      if (status === 404 || status === 502 || code === 'NOT_FOUND' || code === 'SERVER_ERROR') {
        setHistoryError('endpoint_unavailable');
      } else if (code === 'NETWORK_OFFLINE' || code === 'TIMEOUT') {
        setHistoryError('network');
      } else {
        setHistoryError('unknown');
      }
      console.error('[ProposalsInbox] History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleTabChange = (tab: string) => {
    if (tab === 'history' && !historyLoaded) {
      fetchHistory();
    }
  };

  // Re-fetch when filter changes (only if already loaded)
  useEffect(() => {
    if (historyLoaded) {
      fetchHistory();
    }
  }, [historyFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = async () => {
    if (!selectedProposal) return;
    
    setIsProcessing(true);
    try {
      const response: AcceptProposalResponse = await acceptProposal(selectedProposal.proposalId);
      setProposals(prev => prev.filter(p => p.proposalId !== selectedProposal.proposalId));
      setSelectedProposal(null);

      if (response.gitCommitResult?.success) {
        toast.success(
          t.proposals?.acceptedAutoCommit ||
            'Proposal approved and committed. Note pages update after the repo sync/rebuild — refresh once the changes land in this app.'
        );
      } else {
        const errorMsg = response.gitCommitResult?.error;
        console.error('[ProposalsInbox] Git commit response:', JSON.stringify(response.gitCommitResult));
        if (errorMsg) {
          console.warn('[ProposalsInbox] Git commit failed:', errorMsg);
          toast.error(`Git commit failed: ${errorMsg}`);
        }
        toast.success(t.proposals?.accepted || 'Proposal approved');
        setAcceptedProposal(selectedProposal);
      }
    } catch (err) {
      toast.error(t.proposals?.acceptFailed || 'Failed to accept proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartReject = () => {
    setDecisionNote('');
    setShowRejectConfirm(true);
  };

  const handleReject = async () => {
    if (!selectedProposal || !isDecisionNoteValid) return;
    
    setIsProcessing(true);
    try {
      await rejectProposal(selectedProposal.proposalId, decisionNote.trim());
      toast.success(t.proposals?.rejected || 'Proposal rejected');
      setProposals(prev => prev.filter(p => p.proposalId !== selectedProposal.proposalId));
      setSelectedProposal(null);
      setShowRejectConfirm(false);
      setDecisionNote('');
    } catch (err) {
      toast.error(t.proposals?.rejectFailed || 'Failed to reject proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyContent = async () => {
    if (!acceptedProposal) return;
    try {
      await navigator.clipboard.writeText(acceptedProposal.proposedContent);
      setCopied(true);
      toast.success(t.proposals?.contentCopied || 'Content copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy content');
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileEdit className="h-4 w-4" />
            {t.proposals?.title || 'Edit Proposals'}
            {proposals.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {proposals.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {t.proposals?.description || 'Review changes suggested by guests'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="inbox" onValueChange={handleTabChange}>
            <TabsList className="w-full grid grid-cols-2 mx-4 mb-2" style={{ width: 'calc(100% - 2rem)' }}>
              <TabsTrigger value="inbox" className="text-xs gap-1.5">
                <Inbox className="h-3.5 w-3.5" />
                Inbox
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Inbox Tab */}
            <TabsContent value="inbox" className="mt-0">
              {proposals.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t.proposals?.empty || 'No pending proposals'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="px-4 pb-4 space-y-2">
                    {proposals.map((proposal) => (
                      <button
                        key={proposal.proposalId}
                        onClick={() => setSelectedProposal(proposal)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-sm truncate">
                                {proposal.noteTitle}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{proposal.guestName}</span>
                              <span>•</span>
                              <span>{proposal.zoneName}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">
                            <Clock className="h-2.5 w-2.5 mr-1" />
                            {formatDistanceToNow(proposal.createdAt, { addSuffix: true })}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              {/* Filter bar */}
              <div className="flex items-center gap-1 px-4 pb-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {(['all', 'approved', 'rejected'] as HistoryFilter[]).map(f => (
                  <Button
                    key={f}
                    variant={historyFilter === f ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-[11px] capitalize"
                    onClick={() => setHistoryFilter(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>

              {historyLoading ? (
                <div className="px-4 pb-4 space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : historyError ? (
                <div className="py-8 px-4 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  {historyError === 'endpoint_unavailable' ? (
                    <>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Audit history not available
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        The <code className="bg-muted px-1 rounded">GET /proposals/history</code> endpoint 
                        is not yet deployed. See API contract §3.4.
                      </p>
                      <Button variant="outline" size="sm" onClick={fetchHistory} className="text-xs">
                        Retry
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-2">
                        {historyError === 'network' 
                          ? 'Network error. Check your connection.'
                          : 'Failed to load history.'}
                      </p>
                      <Button variant="outline" size="sm" onClick={fetchHistory} className="text-xs">
                        Retry
                      </Button>
                    </>
                  )}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No {historyFilter !== 'all' ? historyFilter : ''} proposals in history
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="px-4 pb-4 space-y-2">
                    {historyItems.map((item) => {
                      const badgeInfo = STATUS_BADGE_MAP[item.status] || { variant: 'outline' as const, label: item.status };
                      return (
                        <div
                          key={item.proposalId}
                          className="w-full text-left p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium text-sm truncate">
                                  {item.noteTitle}
                                </span>
                                <Badge variant={badgeInfo.variant} className="text-[10px]">
                                  {badgeInfo.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span>{item.guestName}</span>
                                <span>•</span>
                                <span>{item.zoneName}</span>
                                <span>•</span>
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(item.updatedAt || item.createdAt, { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedProposal} onOpenChange={(open) => !open && setSelectedProposal(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              {t.proposals?.reviewTitle || 'Review Edit Proposal'}
            </DialogTitle>
            {selectedProposal && (
              <DialogDescription>
                <span className="font-medium">{selectedProposal.noteTitle}</span>
                <span className="mx-2">•</span>
                <span>{t.proposals?.submittedBy || 'Submitted by'} {selectedProposal.guestName}</span>
                <span className="mx-2">•</span>
                <span>{selectedProposal.zoneName}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4">
            {selectedProposal && (
              <ProposalDiffView
                originalContent={selectedProposal.originalContent}
                proposedContent={selectedProposal.proposedContent}
              />
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleStartReject}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              {t.proposals?.reject || 'Reject'}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t.proposals?.accept || 'Accept Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectConfirm} onOpenChange={(open) => {
        if (!open) {
          setShowRejectConfirm(false);
          setDecisionNote('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              {t.proposals?.rejectTitle || 'Reject Proposal'}
            </DialogTitle>
            <DialogDescription>
              {t.proposals?.rejectDescription || 'Please provide a reason for rejecting this proposal (minimum 10 characters).'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder={t.proposals?.rejectPlaceholder || 'Explain why this proposal is being rejected...'}
              className="min-h-[100px]"
            />
            <p className={cn(
              "text-xs mt-1",
              isDecisionNoteValid ? "text-muted-foreground" : "text-destructive"
            )}>
              {decisionNote.trim().length}/{MIN_DECISION_NOTE_LENGTH} {t.proposals?.minChars || 'minimum characters'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectConfirm(false);
              setDecisionNote('');
            }}>
              {t.common?.cancel || 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!isDecisionNoteValid || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              {t.proposals?.confirmReject || 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!acceptedProposal} onOpenChange={(open) => !open && setAcceptedProposal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              {t.proposals?.acceptedTitle || 'Proposal Accepted'}
            </DialogTitle>
            <DialogDescription>
              {t.proposals?.copyInstructions || 'Copy the updated content below and paste it into your local note file to apply the changes.'}
            </DialogDescription>
          </DialogHeader>
          
          {acceptedProposal && (
            <div className="flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{acceptedProposal.noteTitle}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContent}
                  className="gap-2"
                >
                {copied ? (
                    <>
                      <Check className="h-4 w-4 text-primary" />
                      {t.common?.copied || 'Copied!'}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {t.proposals?.copyContent || 'Copy Content'}
                    </>
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg">
                <pre className="p-4 text-sm whitespace-pre-wrap font-mono bg-muted/30">
                  {acceptedProposal.proposedContent}
                </pre>
              </ScrollArea>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptedProposal(null)}>
              {t.common?.close || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
