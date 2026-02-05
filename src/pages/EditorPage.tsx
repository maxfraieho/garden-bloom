 import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
 import { NoteEditor } from '@/components/garden/NoteEditor';
 import { GardenHeader } from '@/components/garden/GardenHeader';
 import { GardenFooter } from '@/components/garden/GardenFooter';
 import { useNoteEditor } from '@/hooks/useNoteEditor';
 import { useOwnerAuth } from '@/hooks/useOwnerAuth';
 import { useLocale } from '@/hooks/useLocale';
 import { Card } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Lock, ArrowLeft } from 'lucide-react';
 import { Link } from 'react-router-dom';
 
 export default function EditorPage() {
   const { slug } = useParams<{ slug: string }>();
   const [searchParams] = useSearchParams();
   const navigate = useNavigate();
   const { t } = useLocale();
  const { isAuthenticated } = useOwnerAuth();
 
   // Get folder from query params (for creating notes in specific folder)
   const folder = searchParams.get('folder') || undefined;
 
   const editor = useNoteEditor({ 
     slug: slug === 'new' ? undefined : slug,
     folder 
   });
 
   // Redirect non-owners
  if (!isAuthenticated) {
     return (
       <div className="min-h-screen bg-background flex flex-col">
         <GardenHeader />
         <main className="flex-1 flex items-center justify-center p-4">
           <Card className="max-w-md w-full p-8 text-center">
             <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
             <h1 className="text-xl font-semibold mb-2">
               Access Denied
             </h1>
             <p className="text-muted-foreground mb-6">
               Only the garden owner can create or edit notes.
             </p>
             <Button asChild>
               <Link to="/">
                 <ArrowLeft className="mr-2 h-4 w-4" />
                 Return to Garden
               </Link>
             </Button>
           </Card>
         </main>
         <GardenFooter />
       </div>
     );
   }
 
   const handleSave = async () => {
     const savedSlug = await editor.save();
     if (savedSlug) {
       navigate(`/notes/${savedSlug}`);
     }
   };
 
   const handleCancel = () => {
     if (editor.isDirty) {
       // TODO: Show confirmation dialog
       if (window.confirm('Discard unsaved changes?')) {
         navigate(-1);
       }
     } else {
       navigate(-1);
     }
   };
 
   return (
     <div className="min-h-screen bg-background flex flex-col">
       <GardenHeader />
       
       <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
         {/* Back navigation */}
         <nav className="mb-4">
           <Link 
             to="/" 
             className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
           >
             <ArrowLeft className="w-4 h-4" />
             <span>Back to garden</span>
           </Link>
         </nav>
 
         {/* Page title */}
         <h1 className="text-2xl font-semibold mb-6">
           {editor.isNewNote ? t.editor.newNote : t.editor.editNote}
         </h1>
 
         {/* Editor */}
         <NoteEditor
           title={editor.title}
           content={editor.content}
           tags={editor.tags}
           isDirty={editor.isDirty}
           isSaving={editor.isSaving}
           hasDraft={editor.hasDraft}
           onTitleChange={editor.setTitle}
           onContentChange={editor.setContent}
           onTagsChange={editor.setTags}
           onSave={handleSave}
           onCancel={handleCancel}
           onRestoreDraft={editor.restoreDraft}
           onDiscardDraft={editor.discardDraft}
           insertAtCursor={editor.insertAtCursor}
         />
       </main>
       
       <GardenFooter />
     </div>
   );
 }