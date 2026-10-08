'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { isOwnerUser } from '@shared/core/auth/rolePermissions';
import { Loader2 } from 'lucide-react';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isHydrating, isAuthenticated, hasCompletedOnboarding, hasAcceptedTerms, hydrateSession, user, activeRestaurant } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      hydrateSession();
    }
  }, [isAuthenticated, hydrateSession]);

  useEffect(() => {
    if (isHydrating) return;

    if (!hasCompletedOnboarding && pathname !== '/onboarding') {
      router.replace('/onboarding');
      return;
    }

    if (!isAuthenticated && pathname !== '/login' && pathname !== '/onboarding') {
      router.replace('/login');
      return;
    }

    // Unconsented owners cannot access any page other than /dashboard where the consent card is presented
    const isOwner = isOwnerUser(user, activeRestaurant);
    if (isAuthenticated && isOwner && !hasAcceptedTerms && pathname !== '/dashboard' && pathname !== '/login') {
      router.replace('/dashboard');
      return;
    }
  }, [isHydrating, isAuthenticated, hasCompletedOnboarding, hasAcceptedTerms, user, activeRestaurant, pathname, router]);

  if (isHydrating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#DE8626]" />
          <p className="text-sm font-medium text-[#667085] dark:text-[#94A3B8]">Validating session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== '/login' && pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
};
