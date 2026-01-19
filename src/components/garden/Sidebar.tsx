import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronDown, FileText, Folder, Home, Menu, X, Network, MessageSquare } from 'lucide-react';
import { getFolderStructure, getHomeNote } from '@/lib/notes/noteLoader';
import { SearchBar } from './SearchBar';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/utils';

interface FolderInfo {
  name: string;
  path: string;
  notes: { slug: string; title: string; isHome: boolean }[];
  subfolders: FolderInfo[];
}

interface FolderItemProps {
  folder: FolderInfo;
  level?: number;
}

function FolderItem({ folder, level = 0 }: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  
  const hasContent = folder.notes.length > 0 || folder.subfolders.length > 0;
  
  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors",
          "font-medium"
        )}
        style={{ paddingLeft: `${12 + level * 12}px` }}
      >
        {hasContent ? (
          isOpen ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{folder.name}</span>
      </button>
      
      {isOpen && hasContent && (
        <div className="mt-1">
          {/* Subfolders */}
          {folder.subfolders.map((subfolder) => (
            <FolderItem key={subfolder.path} folder={subfolder} level={level + 1} />
          ))}
          
          {/* Notes */}
          {folder.notes.map((note) => {
            const isActive = location.pathname === `/notes/${note.slug}`;
            
            return (
              <Link
                key={note.slug}
                to={note.isHome ? '/' : `/notes/${note.slug}`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  isActive 
                    ? "bg-accent text-accent-foreground font-medium" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                style={{ paddingLeft: `${24 + level * 12}px` }}
              >
                {note.isHome ? (
                  <Home className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="truncate">{note.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const folders = getFolderStructure();
  const homeNote = getHomeNote();
  const { t } = useLocale();
  
  const sidebarContent = (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="text-lg font-semibold text-sidebar-foreground hover:text-sidebar-primary transition-colors"
            onClick={() => setIsOpen(false)}
          >
            {t.sidebar.digitalGarden}
          </Link>
          <ThemeToggle />
        </div>
        <SearchBar onNavigate={() => setIsOpen(false)} />
        <LanguageSwitcher />
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Home link */}
        {homeNote && (
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-md mx-2 transition-colors",
              location.pathname === '/'
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            onClick={() => setIsOpen(false)}
          >
            <Home className="w-4 h-4" />
            <span>{t.sidebar.home}</span>
          </Link>
        )}

        {/* Graph link */}
        <Link
          to="/graph"
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm rounded-md mx-2 transition-colors",
            location.pathname === '/graph'
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          onClick={() => setIsOpen(false)}
        >
          <Network className="w-4 h-4" />
          <span>{t.sidebar.graph}</span>
        </Link>

        {/* Chat link */}
        <Link
          to="/chat"
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm rounded-md mx-2 transition-colors",
            location.pathname === '/chat'
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          onClick={() => setIsOpen(false)}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t.sidebar.chat}</span>
        </Link>
        
        {/* Folder structure */}
        <div className="mt-4 px-2">
          {folders.map((folder) => (
            <FolderItem key={folder.path} folder={folder} />
          ))}
        </div>
      </nav>
    </div>
  );
  
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-background border border-border rounded-md shadow-sm lg:hidden"
        aria-label={t.sidebar.toggleNavigation}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 w-64 h-full transform transition-transform duration-200 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
      
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
