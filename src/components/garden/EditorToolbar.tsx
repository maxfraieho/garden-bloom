 import { 
   Bold, 
   Italic, 
   Heading1, 
   Heading2, 
   Link, 
   Code, 
   List, 
   ListOrdered, 
   Quote, 
   Table,
   Link2
 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
 } from '@/components/ui/tooltip';
 import { useLocale } from '@/hooks/useLocale';
 
 interface EditorToolbarProps {
   onFormat: (before: string, after?: string) => void;
   onInsertWikilink: () => void;
   disabled?: boolean;
 }
 
 export function EditorToolbar({ 
   onFormat, 
   onInsertWikilink,
   disabled = false 
 }: EditorToolbarProps) {
   const { t } = useLocale();
 
   const tools = [
     {
       icon: Bold,
       label: t.editor?.toolbar?.bold || 'Bold',
       shortcut: 'Ctrl+B',
       action: () => onFormat('**', '**'),
     },
     {
       icon: Italic,
       label: t.editor?.toolbar?.italic || 'Italic',
       shortcut: 'Ctrl+I',
       action: () => onFormat('*', '*'),
     },
     { type: 'separator' as const },
     {
       icon: Heading1,
       label: t.editor?.toolbar?.heading1 || 'Heading 1',
       action: () => onFormat('# ', ''),
     },
     {
       icon: Heading2,
       label: t.editor?.toolbar?.heading2 || 'Heading 2',
       action: () => onFormat('## ', ''),
     },
     { type: 'separator' as const },
     {
       icon: Link,
       label: t.editor?.toolbar?.link || 'Link',
       action: () => onFormat('[', '](url)'),
     },
     {
       icon: Link2,
       label: t.editor?.toolbar?.wikilink || 'Wikilink [[]]',
       action: onInsertWikilink,
     },
     { type: 'separator' as const },
     {
       icon: Code,
       label: t.editor?.toolbar?.code || 'Code',
       action: () => onFormat('`', '`'),
     },
     {
       icon: Quote,
       label: t.editor?.toolbar?.quote || 'Quote',
       action: () => onFormat('> ', ''),
     },
     { type: 'separator' as const },
     {
       icon: List,
       label: t.editor?.toolbar?.bulletList || 'Bullet List',
       action: () => onFormat('- ', ''),
     },
     {
       icon: ListOrdered,
       label: t.editor?.toolbar?.numberedList || 'Numbered List',
       action: () => onFormat('1. ', ''),
     },
     { type: 'separator' as const },
     {
       icon: Table,
       label: t.editor?.toolbar?.table || 'Table',
       action: () => onFormat(
         '\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell     | Cell     | Cell     |\n',
         ''
       ),
     },
   ];
 
   return (
     <div className="flex items-center gap-0.5 p-2 border-b border-border bg-muted/30 rounded-t-lg flex-wrap">
       {tools.map((tool, index) => {
         if ('type' in tool && tool.type === 'separator') {
           return (
             <div 
               key={`sep-${index}`} 
               className="w-px h-6 bg-border mx-1" 
             />
           );
         }
 
         const ToolIcon = tool.icon;
         
         return (
           <Tooltip key={tool.label}>
             <TooltipTrigger asChild>
               <Button
                 type="button"
                 variant="ghost"
                 size="icon"
                 className="h-8 w-8"
                 onClick={tool.action}
                 disabled={disabled}
               >
                 <ToolIcon className="h-4 w-4" />
                 <span className="sr-only">{tool.label}</span>
               </Button>
             </TooltipTrigger>
             <TooltipContent>
               <p>
                 {tool.label}
                 {'shortcut' in tool && tool.shortcut && (
                   <span className="ml-2 text-muted-foreground text-xs">
                     {tool.shortcut}
                   </span>
                 )}
               </p>
             </TooltipContent>
           </Tooltip>
         );
       })}
     </div>
   );
 }