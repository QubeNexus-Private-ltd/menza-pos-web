'use client';

import React, { useEffect } from 'react';
import LandingPage from '@/components/landing/LandingPage';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';

export default function HomePage() {
  const { hydrateSession } = useAuthStore();

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  return <LandingPage />;
}
