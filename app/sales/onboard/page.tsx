'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SalesOnboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/superadmin/onboard');
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#DE8626]" />
        <p className="text-sm font-medium text-[#667085] dark:text-[#94A3B8]">
          Redirecting to Store Onboarding...
        </p>
      </div>
    </div>
  );
}
