'use client';

import { PageTransition3D } from '@/components/ui/page-transition-3d';
import { ParticleBackground } from '@/components/ui/particle-background';

export function UserLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <ParticleBackground className="fixed inset-0 z-0 opacity-30 dark:opacity-20" particleCount={45} />
      <PageTransition3D className="relative z-10">
        {children}
      </PageTransition3D>
    </div>
  );
}
