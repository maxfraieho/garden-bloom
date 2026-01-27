import { Link, useLocation } from 'react-router-dom';
import { Network, FolderTree, Home, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { OwnerModeIndicator } from './OwnerModeIndicator';
import { useLocale } from '@/hooks/useLocale';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function GardenHeader() {
  const { t } = useLocale();
  const location = useLocation();

  // Cycle between: Home -> Files -> Chat -> Home
  const cycle = (() => {
    switch (location.pathname) {
      case '/':
        return {
          to: '/files',
          icon: FolderTree,
          tooltip: t.sidebar.fileStructure || 'File Structure',
        };
      case '/files':
        return {
          to: '/chat',
          icon: MessageSquare,
          tooltip: t.sidebar.chat || 'Chat',
        };
      case '/chat':
        return {
          to: '/',
          icon: Home,
          tooltip: t.sidebar.home || 'Home',
        };
      default:
        return {
          to: '/files',
          icon: FolderTree,
          tooltip: t.sidebar.fileStructure || 'File Structure',
        };
    }
  })();
  const CycleIcon = cycle.icon;

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
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
