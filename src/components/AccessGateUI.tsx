// Access Gate UI — BLOOM branded entry point
// "Вхід у сад логіки"

import { useState, useEffect, useRef } from 'react';
import { useOwnerAuth } from '@/hooks/useOwnerAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { LanguageSwitcher } from '@/components/garden/LanguageSwitcher';
import { ThemeToggle } from '@/components/garden/ThemeToggle';

/** Animated node-network background */
function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number; r: number; opacity: number }[] = [];
    const NODE_COUNT = 40;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init nodes
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(45, 212, 168, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 168, ${n.opacity})`;
        ctx.fill();

        // Move
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
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

/** BLOOM symbol inline SVG */
function BloomSymbol({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(32, 32)">
        <circle cx="0" cy="0" r="5" fill="currentColor" opacity="0.95" />
        <line x1="0" y1="0" x2="-14" y2="-20" stroke="currentColor" strokeWidth="2" opacity="0.7" />
        <line x1="0" y1="0" x2="14" y2="-20" stroke="currentColor" strokeWidth="2" opacity="0.7" />
        <line x1="0" y1="0" x2="-22" y2="-4" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="0" y1="0" x2="22" y2="-4" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="0" y1="0" x2="-10" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        <line x1="0" y1="0" x2="10" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        <circle cx="-14" cy="-20" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="-20" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="-22" cy="-4" r="2.5" fill="currentColor" opacity="0.4" />
        <circle cx="22" cy="-4" r="2.5" fill="currentColor" opacity="0.4" />
        <circle cx="-10" cy="20" r="2.5" fill="currentColor" opacity="0.3" />
        <circle cx="10" cy="20" r="2.5" fill="currentColor" opacity="0.3" />
        <circle cx="0" cy="0" r="27" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.15" strokeDasharray="4 4" />
      </g>
    </svg>
  );
}

export function AccessGateUI() {
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useOwnerAuth();
  const { t, locale } = useLocale();

  const isUk = locale === 'uk';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await login(password);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated network background */}
      <NetworkBackground />

      {/* Subtle radial gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.06) 0%, transparent 70%)',
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
        {/* BLOOM Logo */}
        <div className="flex flex-col items-center gap-3">
          <BloomSymbol className="w-16 h-16 text-primary animate-fade-in" />
          <h1
            className="text-2xl font-sans font-semibold tracking-[0.25em] text-foreground"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            BLOOM
          </h1>
        </div>

        {/* Runtime identity */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-foreground/60 tracking-wide">
            {isUk ? 'Індивідуальне середовище виконання' : 'Individual Execution Environment'}
          </p>
        </div>

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input
            type="password"
            placeholder={isUk ? 'Введіть ключ доступу' : 'Enter access key'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoFocus
            className="h-12 bg-card/50 backdrop-blur-sm border-border/50 text-center text-base placeholder:text-muted-foreground/50"
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
              isUk ? 'Активувати середовище' : 'Activate Environment'
            )}
          </Button>
        </form>

        {/* Branding footer */}
        <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase mt-4">
          Garden Bloom Runtime
        </p>
      </div>
    </div>
  );
}
