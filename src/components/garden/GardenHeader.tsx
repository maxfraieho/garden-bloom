import { Link, useLocation } from 'react-router-dom';
import { Network, FolderTree, Home, MessageSquare, PenSquare, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { OwnerModeIndicator } from './OwnerModeIndicator';
import { useLocale } from '@/hooks/useLocale';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function GardenHeader() {
  const { t } = useLocale();
  const location = useLocation();
  const { isAuthenticated } = useOwnerAuth();

  // Cycle between: Home -> Files -> Chat -> Graph -> Home
  // Cycle: Home -> Files -> Chat -> Graph -> Editor -> Home
  const isEditorPage = location.pathname === '/notes/new' || location.pathname.endsWith('/edit');
  
  const cycle = (() => {
    if (location.pathname === '/') {
      return { to: '/files', icon: FolderTree, tooltip: t.sidebar.fileStructure || 'File Structure' };
    }
    if (location.pathname === '/files') {
      return { to: '/chat', icon: MessageSquare, tooltip: t.sidebar.chat || 'Chat' };
    }
    if (location.pathname === '/chat') {
      return { to: '/graph', icon: Network, tooltip: t.index.viewGraph || 'Graph' };
    }
    if (location.pathname === '/graph') {
      return { to: '/notes/new', icon: Edit3, tooltip: t.editor?.newNote || 'Editor' };
    }
    if (isEditorPage) {
      return { to: '/', icon: Home, tooltip: t.sidebar.home || 'Home' };
    }
    // Default - for note pages and others
    return { to: '/files', icon: FolderTree, tooltip: t.sidebar.fileStructure || 'File Structure' };
  })();
  const CycleIcon = cycle.icon;

  return (
    <header className="sticky top-0 z-[60] bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* File structure / Home toggle button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link to={cycle.to} aria-label={cycle.tooltip}>
                <CycleIcon className="w-5 h-5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {cycle.tooltip}
          </TooltipContent>
        </Tooltip>

        {/* Search bar */}
        <div className="flex-1 max-w-md">
          <SearchBar />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <OwnerModeIndicator />
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon">
                  <Link to="/notes/new" aria-label={t.editor?.newNote || 'New Note'}>
                    <PenSquare className="w-5 h-5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t.editor?.newNote || 'New Note'}
              </TooltipContent>
            </Tooltip>
          )}
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/chat">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </Link>
          </Button>
          <Button asChild variant="default" size="sm" className="gap-2">
            <Link to="/graph">
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">{t.index.viewGraph}</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
