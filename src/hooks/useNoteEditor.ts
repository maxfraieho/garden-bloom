 import { useState, useEffect, useCallback, useMemo } from 'react';
 import { getNoteBySlug } from '@/lib/notes/noteLoader';
 import { useToast } from '@/hooks/use-toast';
 import { useLocale } from '@/hooks/useLocale';
 
 interface NoteEditorState {
   content: string;
   title: string;
   tags: string[];
   isDirty: boolean;
   isSaving: boolean;
   hasDraft: boolean;
 }
 
 interface UseNoteEditorOptions {
   slug?: string;
   folder?: string;
 }
 
 export function useNoteEditor({ slug, folder }: UseNoteEditorOptions = {}) {
   const { toast } = useToast();
   const { t } = useLocale();
   const isNewNote = !slug || slug === 'new';
   
   const [state, setState] = useState<NoteEditorState>({
     content: '',
     title: '',
     tags: [],
     isDirty: false,
     isSaving: false,
     hasDraft: false,
   });
 
   const draftKey = useMemo(
     () => `note-draft-${slug || 'new'}${folder ? `-${folder}` : ''}`,
     [slug, folder]
   );
 
   // Load existing note or check for draft
   useEffect(() => {
     if (!isNewNote && slug) {
       const note = getNoteBySlug(slug);
       if (note) {
         setState(prev => ({
           ...prev,
           content: note.content,
           title: note.title,
           tags: (note.frontmatter.tags as string[]) || [],
           isDirty: false,
         }));
         return;
       }
     }
 
     // Check for existing draft
     const savedDraft = localStorage.getItem(draftKey);
     if (savedDraft) {
       try {
         const parsed = JSON.parse(savedDraft);
         setState(prev => ({
           ...prev,
           hasDraft: true,
           // Don't auto-restore, let user decide
         }));
       } catch {
         localStorage.removeItem(draftKey);
       }
     }
   }, [slug, isNewNote, draftKey]);
 
   // Auto-save draft when content changes
   useEffect(() => {
     if (state.isDirty && (state.content || state.title)) {
       const draft = {
         content: state.content,
         title: state.title,
         tags: state.tags,
         savedAt: Date.now(),
       };
       localStorage.setItem(draftKey, JSON.stringify(draft));
     }
   }, [state.content, state.title, state.tags, state.isDirty, draftKey]);
 
   const setContent = useCallback((content: string) => {
     setState(prev => ({ ...prev, content, isDirty: true }));
   }, []);
 
   const setTitle = useCallback((title: string) => {
     setState(prev => ({ ...prev, title, isDirty: true }));
   }, []);
 
   const setTags = useCallback((tags: string[]) => {
     setState(prev => ({ ...prev, tags, isDirty: true }));
   }, []);
 
   const restoreDraft = useCallback(() => {
     const savedDraft = localStorage.getItem(draftKey);
     if (savedDraft) {
       try {
         const parsed = JSON.parse(savedDraft);
         setState(prev => ({
           ...prev,
           content: parsed.content || '',
           title: parsed.title || '',
           tags: parsed.tags || [],
           hasDraft: false,
           isDirty: true,
         }));
         toast({
           title: t.editor?.draftRestored || 'Draft restored',
         });
       } catch {
         localStorage.removeItem(draftKey);
       }
     }
   }, [draftKey, toast, t]);
 
   const discardDraft = useCallback(() => {
     localStorage.removeItem(draftKey);
     setState(prev => ({ ...prev, hasDraft: false }));
   }, [draftKey]);
 
   const save = useCallback(async (): Promise<string | null> => {
     if (!state.title.trim()) {
       toast({
         title: t.editor?.titleRequired || 'Title is required',
         variant: 'destructive',
       });
       return null;
     }
 
     setState(prev => ({ ...prev, isSaving: true }));
 
     try {
       // Serialize note to markdown with frontmatter
       const frontmatter = [
         '---',
         `title: "${state.title.replace(/"/g, '\\"')}"`,
         `tags: [${state.tags.map(t => `"${t}"`).join(', ')}]`,
         `created: "${new Date().toISOString()}"`,
         `updated: "${new Date().toISOString()}"`,
         `dg-publish: true`,
         '---',
         '',
       ].join('\n');
 
       const markdown = frontmatter + state.content;
 
       // For now, copy to clipboard (API integration TODO)
       await navigator.clipboard.writeText(markdown);
       
       // Clear draft on successful save
       localStorage.removeItem(draftKey);
       
       setState(prev => ({ ...prev, isDirty: false, isSaving: false }));
       
       toast({
         title: t.editor?.saved || 'Note saved',
         description: t.editor?.copiedToClipboard || 'Markdown copied to clipboard',
       });
 
       // Return generated slug
       const generatedSlug = encodeURIComponent(
         (folder ? `${folder}/` : '') + state.title.replace(/\s+/g, '-')
       );
       return generatedSlug;
     } catch (error) {
       setState(prev => ({ ...prev, isSaving: false }));
       toast({
         title: t.editor?.error || 'Failed to save',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive',
       });
       return null;
     }
   }, [state.title, state.content, state.tags, folder, draftKey, toast, t]);
 
   const insertAtCursor = useCallback((
     textareaRef: React.RefObject<HTMLTextAreaElement>,
     before: string,
     after: string = ''
   ) => {
     const textarea = textareaRef.current;
     if (!textarea) return;
 
     const start = textarea.selectionStart;
     const end = textarea.selectionEnd;
     const selectedText = state.content.substring(start, end);
 
     const newContent = 
       state.content.substring(0, start) + 
       before + selectedText + after + 
       state.content.substring(end);
 
     setContent(newContent);
 
     // Restore cursor position after React re-render
     requestAnimationFrame(() => {
       textarea.focus();
       const newPos = start + before.length + selectedText.length + after.length;
       textarea.setSelectionRange(
         start + before.length,
         start + before.length + selectedText.length
       );
     });
   }, [state.content, setContent]);
 
   return {
     ...state,
     isNewNote,
     setContent,
     setTitle,
     setTags,
     save,
     restoreDraft,
     discardDraft,
     insertAtCursor,
   };
 }