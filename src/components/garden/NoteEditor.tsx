 import { useState, useRef, useCallback, useEffect } from 'react';
 import { NoteRenderer } from './NoteRenderer';
 import { EditorToolbar } from './EditorToolbar';
 import { TagEditor } from './TagEditor';
 import { WikilinkAutocomplete } from './WikilinkAutocomplete';
 import { useWikilinkDetection } from '@/hooks/useWikilinkSuggestions';
 import type { WikilinkSuggestion } from '@/hooks/useWikilinkSuggestions';
 import { useLocale } from '@/hooks/useLocale';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Button } from '@/components/ui/button';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Card } from '@/components/ui/card';
 import { Alert, AlertDescription } from '@/components/ui/alert';
 import { Save, X, FileText, Eye, AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface NoteEditorProps {
   title: string;
   content: string;
   tags: string[];
   isDirty: boolean;
   isSaving: boolean;
   hasDraft: boolean;
   onTitleChange: (title: string) => void;
   onContentChange: (content: string) => void;
   onTagsChange: (tags: string[]) => void;
   onSave: () => void;
   onCancel?: () => void;
   onRestoreDraft?: () => void;
   onDiscardDraft?: () => void;
   insertAtCursor: (
     ref: React.RefObject<HTMLTextAreaElement>,
     before: string,
     after?: string
   ) => void;
 }
 
 export function NoteEditor({
   title,
   content,
   tags,
   isDirty,
   isSaving,
   hasDraft,
   onTitleChange,
   onContentChange,
   onTagsChange,
   onSave,
   onCancel,
   onRestoreDraft,
   onDiscardDraft,
   insertAtCursor,
 }: NoteEditorProps) {
   const { t } = useLocale();
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const [cursorPosition, setCursorPosition] = useState(0);
   const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
 
   // Wikilink autocomplete detection
   const wikilinkState = useWikilinkDetection(content, cursorPosition);
 
   // Handle textarea cursor changes
   const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
     onContentChange(e.target.value);
     setCursorPosition(e.target.selectionStart);
   }, [onContentChange]);
 
   const handleTextareaSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
     const target = e.target as HTMLTextAreaElement;
     setCursorPosition(target.selectionStart);
   }, []);
 
   // Handle wikilink selection
   const handleWikilinkSelect = useCallback((suggestion: WikilinkSuggestion) => {
     if (!wikilinkState.isActive) return;
 
     const beforeWikilink = content.substring(0, wikilinkState.startIndex);
     const afterCursor = content.substring(cursorPosition);
     
     // Insert [[title]] format
     const newContent = `${beforeWikilink}[[${suggestion.title}]]${afterCursor}`;
     onContentChange(newContent);
     
     // Move cursor after the inserted wikilink
     const newCursorPos = wikilinkState.startIndex + suggestion.title.length + 4;
     requestAnimationFrame(() => {
       if (textareaRef.current) {
         textareaRef.current.focus();
         textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
         setCursorPosition(newCursorPos);
       }
     });
   }, [content, cursorPosition, wikilinkState, onContentChange]);
 
   // Toolbar formatting
   const handleFormat = useCallback((before: string, after: string = '') => {
     insertAtCursor(textareaRef, before, after);
   }, [insertAtCursor]);
 
   // Insert wikilink placeholder
   const handleInsertWikilink = useCallback(() => {
     insertAtCursor(textareaRef, '[[', ']]');
   }, [insertAtCursor]);
 
   // Keyboard shortcuts
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if ((e.ctrlKey || e.metaKey) && e.key === 's') {
         e.preventDefault();
         if (!isSaving) onSave();
       }
       if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
         e.preventDefault();
         handleFormat('**', '**');
       }
       if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
         e.preventDefault();
         handleFormat('*', '*');
       }
     };
 
     document.addEventListener('keydown', handleKeyDown);
     return () => document.removeEventListener('keydown', handleKeyDown);
   }, [isSaving, onSave, handleFormat]);
 
   // Create a mock note object for preview
   const previewNote = {
     slug: 'preview',
     title,
     content,
     frontmatter: { tags },
     rawContent: content,
   };
 
   return (
     <div className="flex flex-col h-full">
       {/* Draft restoration alert */}
       {hasDraft && (
        <Alert className="mb-4 border-primary/50 bg-primary/10">
          <AlertCircle className="h-4 w-4 text-primary" />
           <AlertDescription className="flex items-center justify-between">
             <span>{t.editor.draftFound}</span>
             <div className="flex gap-2 ml-4">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={onRestoreDraft}
                 className="gap-1"
               >
                 <RotateCcw className="h-3 w-3" />
                 {t.editor.restoreDraft}
               </Button>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={onDiscardDraft}
                 className="gap-1 text-muted-foreground"
               >
                 <Trash2 className="h-3 w-3" />
                 {t.editor.discardDraft}
               </Button>
             </div>
           </AlertDescription>
         </Alert>
       )}
 
       {/* Title input */}
       <div className="mb-4">
         <Input
           value={title}
           onChange={(e) => onTitleChange(e.target.value)}
           placeholder={t.editor.newNote}
           className="text-xl font-semibold h-12"
           disabled={isSaving}
         />
       </div>
 
       {/* Mobile: Tabs for edit/preview */}
       <div className="md:hidden flex-1 min-h-0">
         <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="h-full flex flex-col">
           <TabsList className="grid w-full grid-cols-2 mb-2">
             <TabsTrigger value="edit" className="gap-2">
               <FileText className="h-4 w-4" />
               {t.editor.edit}
             </TabsTrigger>
             <TabsTrigger value="preview" className="gap-2">
               <Eye className="h-4 w-4" />
               {t.editor.preview}
             </TabsTrigger>
           </TabsList>
           
           <TabsContent value="edit" className="flex-1 min-h-0 mt-0">
             <Card className="h-full flex flex-col">
               <EditorToolbar
                 onFormat={handleFormat}
                 onInsertWikilink={handleInsertWikilink}
                 disabled={isSaving}
               />
               <div className="relative flex-1">
                 <Textarea
                   ref={textareaRef}
                   value={content}
                   onChange={handleTextareaChange}
                   onSelect={handleTextareaSelect}
                   onClick={handleTextareaSelect}
                   placeholder={t.editor.placeholder}
                   className="h-full min-h-[200px] font-mono text-sm resize-none rounded-t-none border-t-0"
                   disabled={isSaving}
                 />
                 <WikilinkAutocomplete
                   query={wikilinkState.query}
                   isOpen={wikilinkState.isActive}
                   onSelect={handleWikilinkSelect}
                   onClose={() => setCursorPosition(0)}
                 />
               </div>
             </Card>
           </TabsContent>
           
           <TabsContent value="preview" className="flex-1 min-h-0 mt-0">
             <Card className="h-full overflow-hidden">
               <ScrollArea className="h-full p-4">
                 <article className="prose prose-slate dark:prose-invert max-w-none">
                   <NoteRenderer note={previewNote} />
                 </article>
               </ScrollArea>
             </Card>
           </TabsContent>
         </Tabs>
       </div>
 
       {/* Desktop: Split view */}
       <div className="hidden md:flex flex-1 min-h-0 gap-4">
         {/* Editor panel */}
         <Card className="flex-1 flex flex-col overflow-hidden">
           <EditorToolbar
             onFormat={handleFormat}
             onInsertWikilink={handleInsertWikilink}
             disabled={isSaving}
           />
           <div className="relative flex-1">
             <Textarea
               ref={textareaRef}
               value={content}
               onChange={handleTextareaChange}
               onSelect={handleTextareaSelect}
               onClick={handleTextareaSelect}
               placeholder={t.editor.placeholder}
               className="h-full font-mono text-sm resize-none rounded-t-none border-t-0"
               disabled={isSaving}
             />
             <WikilinkAutocomplete
               query={wikilinkState.query}
               isOpen={wikilinkState.isActive}
               onSelect={handleWikilinkSelect}
               onClose={() => setCursorPosition(0)}
             />
           </div>
         </Card>
 
         {/* Preview panel */}
         <Card className="flex-1 overflow-hidden">
           <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
             <Eye className="h-4 w-4 text-muted-foreground" />
             <span className="text-sm font-medium">{t.editor.preview}</span>
           </div>
           <ScrollArea className="h-[calc(100%-41px)] p-4">
             <article className="prose prose-slate dark:prose-invert max-w-none">
               <NoteRenderer note={previewNote} />
             </article>
           </ScrollArea>
         </Card>
       </div>
 
       {/* Tags editor */}
       <div className="mt-4 pt-4 border-t border-border">
         <label className="text-sm font-medium text-muted-foreground mb-2 block">
           {t.common.tags}
         </label>
         <TagEditor
           tags={tags}
           onChange={onTagsChange}
           placeholder={t.editor.addTag}
           disabled={isSaving}
         />
       </div>
 
       {/* Action buttons */}
       <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
         <div className="text-sm text-muted-foreground">
           {isDirty && <span>• Unsaved changes</span>}
         </div>
         <div className="flex gap-2">
           {onCancel && (
             <Button
               variant="outline"
               onClick={onCancel}
               disabled={isSaving}
               className="gap-2"
             >
               <X className="h-4 w-4" />
               {t.editor.cancel}
             </Button>
           )}
           <Button
             onClick={onSave}
             disabled={isSaving || !title.trim()}
             className="gap-2"
           >
             <Save className="h-4 w-4" />
             {isSaving ? t.editor.saving : t.editor.save}
           </Button>
         </div>
       </div>
     </div>
   );
 }