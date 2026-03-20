// Access Gate UI — BLOOM canonical execution activation screen
// "Активація середовища виконання"

import { useState, useEffect, useRef } from 'react';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { LanguageSwitcher } from '@/components/garden/LanguageSwitcher';
import { ThemeToggle } from '@/components/garden/ThemeToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/** Animated knowledge-graph background — pushes nodes away from center */
function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const NODE_COUNT = 100;
    const CONNECT_DIST = 220;
    const EXCLUSION_RADIUS = 180; // pixels from center — keep clear for UI

    interface Node {
      x: number; y: number; vx: number; vy: number;
      r: number; opacity: number; hub: boolean;
    }
    const nodes: Node[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn nodes outside exclusion zone
    const spawnNode = (): Node => {
      const isHub = Math.random() < 0.15;
      let x: number, y: number;
      do {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
      } while (
        Math.sqrt((x - canvas.width / 2) ** 2 + (y - canvas.height / 2) ** 2) < EXCLUSION_RADIUS
      );
      return {
        x, y,
        vx: (Math.random() - 0.5) * (isHub ? 0.12 : 0.35),
        vy: (Math.random() - 0.5) * (isHub ? 0.12 : 0.35),
        r: isHub ? Math.random() * 3.5 + 3.5 : Math.random() * 2 + 1,
        opacity: isHub ? Math.random() * 0.3 + 0.5 : Math.random() * 0.25 + 0.2,
        hub: isHub,
      };
    };

    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push(spawnNode());
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const bothHub = nodes[i].hub && nodes[j].hub;
            const anyHub = nodes[i].hub || nodes[j].hub;
            const alpha = (1 - dist / CONNECT_DIST) * (bothHub ? 0.4 : anyHub ? 0.25 : 0.12);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(45, 212, 168, ${alpha})`;
            ctx.lineWidth = bothHub ? 1.5 : anyHub ? 0.8 : 0.4;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        // Hub glow
        if (n.hub) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(45, 212, 168, ${n.opacity * 0.15})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 168, ${n.opacity})`;
        ctx.fill();

        // Movement
        n.x += n.vx;
        n.y += n.vy;

        // Bounce off walls
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        // Repel from center exclusion zone
        const distToCenter = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
        if (distToCenter < EXCLUSION_RADIUS) {
          const angle = Math.atan2(n.y - cy, n.x - cx);
          n.x = cx + Math.cos(angle) * EXCLUSION_RADIUS;
          n.y = cy + Math.sin(angle) * EXCLUSION_RADIUS;
          n.vx = Math.cos(angle) * Math.abs(n.vx) * 1.2;
          n.vy = Math.sin(angle) * Math.abs(n.vy) * 1.2;
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

export function AccessGateUI() {
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useOwnerAuth();
  const { t } = useLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await login(password);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <NetworkBackground />

      {/* Subtle radial overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.05) 0%, transparent 70%)',
          zIndex: 1,
        }}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 10 }}>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-8 w-full max-w-sm" style={{ zIndex: 2 }}>
        {/* BLOOM Logo with canonical tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-5 cursor-default">
              <div className="w-16 h-16 flex items-center justify-center">
                <img
                  src="/brand/bloom-symbol.svg"
                  alt="BLOOM"
                  className="w-14 h-14 dark:invert-0 animate-fade-in"
                  style={{ filter: 'var(--bloom-symbol-filter, none)' }}
                />
              </div>
              <div className="flex flex-col items-center gap-3">
                {/* BLOOM title — primary */}
                <h1 className="text-[42px] font-sans font-medium tracking-[0.25em] text-foreground leading-none">
                  BLOOM
                </h1>
                {/* Expansion — identity layer (muted) */}
                <p className="text-[13px] text-foreground/55 tracking-[0.08em] font-sans font-normal text-center leading-snug">
                  {t.accessGate.bloomExpansion}
                </p>
                {/* Descriptor — runtime meaning (prominent) */}
                <p className="text-base text-foreground/90 tracking-[0.04em] font-sans font-medium text-center">
                  {t.accessGate.runtimeSubtitle}
                </p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-xs text-center bg-card/80 backdrop-blur-md border-border/50 shadow-none"
          >
            <div className="flex flex-col gap-1 py-1">
              <span className="text-xs font-semibold tracking-wide text-foreground">BLOOM Runtime</span>
              <span className="text-[11px] text-muted-foreground/70">{t.accessGate.bloomExpansion}</span>
              <span className="text-[11px] text-foreground/80">{t.accessGate.runtimeSubtitle}</span>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input
            type="password"
            placeholder={t.accessGate.placeholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoFocus
            className="h-12 bg-card/50 backdrop-blur-sm border-border/50 text-center text-base placeholder:text-muted-foreground/40"
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full h-12 text-base font-sans tracking-wide"
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.ownerAuth.verifying}
              </>
            ) : (
              t.accessGate.unlock
            )}
          </Button>
        </form>

        {/* Canonical runtime attribution footer */}
        <div className="flex flex-col items-center gap-0.5 mt-6">
          <span className="text-[11px] text-muted-foreground/50 tracking-wider uppercase font-sans">
            BLOOM Runtime
          </span>
          <span className="text-[11px] text-muted-foreground/40 tracking-wide font-sans">
            {t.accessGate.runtimeSubtitle}
          </span>
        </div>
      </div>
    </div>
  );
}
