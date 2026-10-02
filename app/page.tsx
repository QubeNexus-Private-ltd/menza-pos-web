'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isHydrating, isAuthenticated, hasCompletedOnboarding, hasAcceptedTerms, hydrateSession } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (!mounted || isHydrating) return;

    if (!hasCompletedOnboarding) {
      router.replace('/onboarding');
    } else if (!isAuthenticated) {
      router.replace('/login');
    } else {
      router.replace('/dashboard');
    }
  }, [mounted, isHydrating, isAuthenticated, hasCompletedOnboarding, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">Menza</h1>
          <p className="text-xs text-[#667085] dark:text-[#94A3B8]">Loading smart restaurant suite...</p>
        </div>
      </div>
    </div>
  );
}
