 // Proposals Inbox Component
 // Owner view for pending edit proposals in Chat page
 
 import { useState, useEffect } from 'react';
 import { useLocale } from '@/hooks/useLocale';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
 import { 
   FileEdit, 
   Check, 
   X, 
   Clock,
   User,
   FileText,
   Inbox,
   Loader2,
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { getPendingProposals, acceptProposal, rejectProposal } from '@/lib/api/mcpGatewayClient';
 import { ProposalDiffView } from './ProposalDiffView';
 import type { EditProposal } from '@/types/mcpGateway';
 import { toast } from 'sonner';
 import { formatDistanceToNow } from 'date-fns';
 
 interface ProposalsInboxProps {
   className?: string;
 }
 
 export function ProposalsInbox({ className }: ProposalsInboxProps) {
   const { t } = useLocale();
   const [proposals, setProposals] = useState<EditProposal[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [selectedProposal, setSelectedProposal] = useState<EditProposal | null>(null);
   const [isProcessing, setIsProcessing] = useState(false);
 
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
 
   useEffect(() => {
     fetchProposals();
   }, []);
 
   const handleAccept = async () => {
     if (!selectedProposal) return;
     
     setIsProcessing(true);
     try {
       await acceptProposal(selectedProposal.proposalId);
       toast.success(t.proposals?.accepted || 'Proposal accepted');
       setProposals(prev => prev.filter(p => p.proposalId !== selectedProposal.proposalId));
       setSelectedProposal(null);
     } catch (err) {
       toast.error(t.proposals?.acceptFailed || 'Failed to accept proposal');
     } finally {
       setIsProcessing(false);
     }
   };
 
   const handleReject = async () => {
     if (!selectedProposal) return;
     
     setIsProcessing(true);
     try {
       await rejectProposal(selectedProposal.proposalId);
       toast.success(t.proposals?.rejected || 'Proposal rejected');
       setProposals(prev => prev.filter(p => p.proposalId !== selectedProposal.proposalId));
       setSelectedProposal(null);
     } catch (err) {
       toast.error(t.proposals?.rejectFailed || 'Failed to reject proposal');
     } finally {
       setIsProcessing(false);
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
               onClick={handleReject}
               disabled={isProcessing}
             >
               {isProcessing ? (
                 <Loader2 className="h-4 w-4 animate-spin mr-2" />
               ) : (
                 <X className="h-4 w-4 mr-2" />
               )}
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
     </>
   );
 }