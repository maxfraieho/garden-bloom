import { Link, useLocation } from 'react-router-dom';
import { Network, MessageSquare, Edit3, GitBranch, Bot, Play, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/garden/SearchBar';
import { ThemeToggle } from '@/components/garden/ThemeToggle';
import { LanguageSwitcher } from '@/components/garden/LanguageSwitcher';
import { OwnerMenu } from '@/components/garden/OwnerMenu';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function BloomRuntimeHeader() {
  const { isAuthenticated } = useOwnerAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-[60] bg-card/95 backdrop-blur-sm border-b border-border shadow-sm transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: BLOOM Brand */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/"
              className="flex items-center gap-2.5 flex-shrink-0 group hover:opacity-80 transition-opacity duration-200"
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <img
                  src="/brand/bloom-symbol.svg"
                  alt="BLOOM"
                  className="w-7 h-7 dark:invert-0"
                  style={{ filter: 'var(--bloom-symbol-filter, none)' }}
                />
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-semibold text-foreground tracking-tight font-sans">
                  BLOOM Runtime
                </div>
                <div className="text-[10px] text-muted-foreground font-sans">
                  Garden: Exodus
                </div>
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            BLOOM — Bespoke Logic Orchestration & Operational Machines · Execution Environment for Behavioral Logic
          </TooltipContent>
        </Tooltip>

        {/* Center: Runtime Status */}
        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Runtime: Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bot className="w-3 h-3" />
            <span>Agents: 0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Play className="w-3 h-3" />
            <span>Runs: 0</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-muted-foreground/50">
            <span>Context: —</span>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <SearchBar />
        </div>

        {/* Right: Navigation + Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1">
            {/* Overview */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant={location.pathname === '/' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                >
                  <Link to="/" aria-label="Overview">
                    <LayoutDashboard className="w-4 h-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Overview</TooltipContent>
            </Tooltip>

            {/* Execution Graph */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant={location.pathname === '/graph' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                >
                  <Link to="/graph" aria-label="Execution Graph">
                    <Network className="w-4 h-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Execution Graph</TooltipContent>
            </Tooltip>

            {/* Chat */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant={location.pathname === '/chat' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                >
                  <Link to="/chat" aria-label="Chat">
                    <MessageSquare className="w-4 h-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat</TooltipContent>
            </Tooltip>

            {/* New Definition */}
            {isAuthenticated && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Link to="/notes/new" aria-label="New Definition">
                      <Edit3 className="w-4 h-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Definition</TooltipContent>
              </Tooltip>
            )}

            {/* DRAKON */}
            {isAuthenticated && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant={location.pathname === '/drakon' ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Link to="/drakon" aria-label="DRAKON Editor">
                      <GitBranch className="w-4 h-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>DRAKON Editor</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="hidden sm:block w-px h-6 bg-border mx-1" />

          <ThemeToggle />
          <LanguageSwitcher />
          {isAuthenticated && <OwnerMenu />}
        </div>
      </div>
    </header>
  );
}
