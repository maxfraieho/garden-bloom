// Zone View Page
// Guest access page for viewing notes within an access zone

import { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useZoneValidation, type ZoneNote } from '@/hooks/useZoneValidation';
import { useLocale } from '@/hooks/useLocale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  FolderOpen,
  Lock,
  Home,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZoneNoteRenderer } from '@/components/garden/ZoneNoteRenderer';
import { ZoneCommentSection } from '@/components/garden/ZoneCommentSection';

export default function ZoneViewPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const [searchParams] = useSearchParams();
  const accessCode = searchParams.get('code');
  const { t } = useLocale();
  
  const { 
    isLoading, 
    isValid, 
    isExpired, 
    error, 
    zone,
    getTimeRemaining,
  } = useZoneValidation(zoneId, accessCode);

  const [selectedNote, setSelectedNote] = useState<ZoneNote | null>(null);

  // Calculate expiration progress
  const expirationProgress = useMemo(() => {
    if (!zone) return 0;
    const now = Date.now();
    const created = zone.expiresAt - (24 * 60 * 60 * 1000); // Assume 24h default if not known
    const total = zone.expiresAt - created;
    const elapsed = now - created;
    return Math.max(0, Math.min(100, (1 - elapsed / total) * 100));
  }, [zone]);

  const getExpirationColor = () => {
    if (!zone) return 'bg-muted';
    const remaining = zone.expiresAt - Date.now();
    const oneHour = 60 * 60 * 1000;
    const sixHours = 6 * oneHour;
    
    if (remaining < oneHour) return 'bg-destructive';
    if (remaining < sixHours) return 'bg-orange-500';
    return 'bg-green-500';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t.zoneView.loading}</p>
        </div>
      </div>
    );
  }

  // Expired state
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{t.zoneView.expired}</CardTitle>
            <CardDescription>{t.zoneView.expiredDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                {t.notFound.returnHome}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (!isValid || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{t.zoneView.accessDenied}</CardTitle>
            <CardDescription>
              {error || t.zoneView.invalidZone}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                {t.notFound.returnHome}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid zone - show content
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Badge variant="secondary" className="text-xs">
                  {t.zoneView.sharedAccess}
                </Badge>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {zone?.noteCount} {t.common.notes}
                </span>
              </div>
              <h1 className="text-xl font-semibold truncate">{zone?.name}</h1>
              {zone?.description && (
                <p className="text-sm text-muted-foreground truncate">{zone.description}</p>
              )}
            </div>
            
            {/* Expiration indicator */}
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  "font-medium",
                  getExpirationColor() === 'bg-destructive' && "text-destructive",
                  getExpirationColor() === 'bg-orange-500' && "text-orange-500"
                )}>
                  {getTimeRemaining()}
                </span>
              </div>
              <Progress 
                value={expirationProgress} 
                className="h-1.5 w-24 mt-1"
                indicatorClassName={getExpirationColor()}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Notes list sidebar */}
          <aside className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  {t.zoneView.availableNotes}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="px-4 pb-4 space-y-1">
                    {zone?.notes.map((note) => (
                      <button
                        key={note.slug}
                        onClick={() => setSelectedNote(note)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                          "hover:bg-muted",
                          selectedNote?.slug === note.slug && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{note.title}</span>
                        </div>
                        {note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 ml-5">
                            {note.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                            {note.tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{note.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          {/* Note content */}
          <main className="lg:col-span-3">
            {selectedNote ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                    <span>{selectedNote.title}</span>
                  </div>
                  <CardTitle>{selectedNote.title}</CardTitle>
                  {selectedNote.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedNote.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <ZoneNoteRenderer 
                    content={selectedNote.content}
                    allowedSlugs={zone?.notes.map(n => n.slug) || []}
                    onNavigate={(slug) => {
                      const note = zone?.notes.find(n => n.slug === slug);
                      if (note) setSelectedNote(note);
                    }}
                  />
                  
                  {/* Zone Comment Section */}
                  <Separator className="my-8" />
                  <ZoneCommentSection 
                    articleSlug={selectedNote.slug}
                    zoneId={zoneId!}
                    accessCode={accessCode!}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">{t.zoneView.selectNote}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.zoneView.selectNoteDescription}
                  </p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 inline-block mr-1" />
          {t.zoneView.readOnlyNotice}
        </div>
      </footer>
    </div>
  );
}
