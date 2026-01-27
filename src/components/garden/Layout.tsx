import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      <main className="min-w-0">{children}</main>
    </div>
  );
}
