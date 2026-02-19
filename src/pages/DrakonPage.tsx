import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { GardenHeader } from '@/components/garden/GardenHeader';
import { GardenFooter } from '@/components/garden/GardenFooter';
import { DrakonEditor } from '@/components/garden/DrakonEditor';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { useLocale } from '@/hooks/useLocale';
import { getFolderStructure } from '@/lib/notes/noteLoader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, ArrowLeft, GitBranch, Plus } from 'lucide-react';
import { slugify } from '@/lib/utils';

export default function DrakonPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { isAuthenticated } = useOwnerAuth();

  // Get params from URL
  const diagramIdFromUrl = searchParams.get('id');
  const folderSlug = searchParams.get('folder') || undefined;
  const isNew = searchParams.get('new') === 'true';

  // State for new diagram creation
  const [diagramName, setDiagramName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(folderSlug || '');
  const [step, setStep] = useState<'select' | 'edit'>(diagramIdFromUrl ? 'edit' : 'select');

  // Auto-generate slug from name
  const autoSlug = useMemo(() => slugify(diagramName), [diagramName]);

  // Get available folders
  const folders = useMemo(() => {
    const structure = getFolderStructure();
    const paths: { value: string; label: string }[] = [];
    function collectPaths(items: typeof structure, depth = 0) {
      for (const f of items) {
        paths.push({ value: f.path, label: '  '.repeat(depth) + f.name });
        collectPaths(f.subfolders, depth + 1);
      }
    }
    collectPaths(structure);
    return paths;
  }, []);

  // Redirect non-owners
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <GardenHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">
              {t.drakonEditor.accessDenied}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t.drakonEditor.ownerOnly}
            </p>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.drakonEditor.returnToGarden}
              </Link>
            </Button>
          </Card>
        </main>
        <GardenFooter />
      </div>
    );
  }

  const handleStartEdit = () => {
    if (!autoSlug) return;
    const params = new URLSearchParams();
    params.set('id', autoSlug);
    params.set('new', 'true');
    if (selectedFolder) params.set('folder', selectedFolder);
    navigate(`/drakon?${params.toString()}`, { replace: true });
    setStep('edit');
  };

  const handleSaved = (_id: string) => {
    if (folderSlug || selectedFolder) {
      navigate(`/notes/${folderSlug || selectedFolder}`);
    }
  };

  const currentDiagramId = diagramIdFromUrl || autoSlug;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GardenHeader />
      
      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col px-4 py-4 max-w-6xl mx-auto w-full">
          {/* Page header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Link 
                to={folderSlug ? `/notes/${folderSlug}` : '/files'}
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t.drakonEditor.back}</span>
              </Link>
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">
                  {step === 'select' ? t.drakonEditor.createNewDiagram : `DRAKON: ${currentDiagramId}`}
                </h1>
              </div>
            </div>
          </div>

          {step === 'select' ? (
            /* Step 1: Enter diagram name + pick folder */
            <Card className="max-w-lg mx-auto w-full p-6">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <GitBranch className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h2 className="text-lg font-semibold">{t.drakonEditor.createNewDiagram}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.drakonEditor.enterDiagramName || 'Enter a name for your diagram'}
                  </p>
                </div>

                {/* Diagram name */}
                <div className="space-y-2">
                  <Label htmlFor="diagram-name">{t.drakonEditor.diagramName}</Label>
                  <Input
                    id="diagram-name"
                    value={diagramName}
                    onChange={(e) => setDiagramName(e.target.value)}
                    placeholder={t.drakonEditor.diagramNamePlaceholder || 'User Registration Flow'}
                    autoFocus
                  />
                  {autoSlug && (
                    <p className="text-xs text-muted-foreground">
                      ID: <code className="text-foreground">{autoSlug}</code>
                    </p>
                  )}
                </div>

                {/* Folder picker */}
                <div className="space-y-2">
                  <Label>{t.drakonEditor.selectFolder || 'Save to folder'}</Label>
                  <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.drakonEditor.selectFolderPlaceholder || 'Choose folder...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedFolder && autoSlug && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {t.drakonEditor.savedIn} <code className="text-foreground">{selectedFolder}/diagrams/{autoSlug}.drakon.json</code>
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleStartEdit} 
                  disabled={!autoSlug || !selectedFolder}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t.drakonEditor.createAndEdit}
                </Button>
              </div>
            </Card>
          ) : (
            /* Step 2: Editor */
            <div className="flex-1 min-h-0">
              <DrakonEditor
                diagramId={currentDiagramId}
                folderSlug={folderSlug || selectedFolder}
                height={600}
                isNew={isNew}
                onSaved={handleSaved}
                className="h-full"
              />
            </div>
          )}
        </div>
      </main>
      
      <GardenFooter />
    </div>
  );
}
