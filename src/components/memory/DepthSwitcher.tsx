import { cn } from '@/lib/utils';
import type { ContextDepth } from '@/types/agentMemory';

interface DepthSwitcherProps {
  value: ContextDepth;
  onChange: (depth: ContextDepth) => void;
  className?: string;
  disabled?: boolean;
}

const DEPTH_OPTIONS: { value: ContextDepth; label: string; description: string }[] = [
  { value: 'surface', label: 'Коротко', description: 'Скорочений огляд ключових сутностей' },
  { value: 'wide', label: 'Широко', description: 'Кілька релевантних сутностей з контекстом' },
  { value: 'deep', label: 'Детально', description: 'Повний зміст усіх знайдених сутностей' },
  { value: 'temporal', label: 'У часі', description: 'Еволюція змін + git-історія сутностей' },
];

export function DepthSwitcher({ value, onChange, className, disabled }: DepthSwitcherProps) {
  return (
    <div className={cn('flex gap-1 rounded-lg bg-muted p-1', className)}>
      {DEPTH_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          title={opt.description}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'opacity-50 cursor-not-allowed',
            opt.value === 'temporal' && value === opt.value && 'ring-1 ring-accent'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
