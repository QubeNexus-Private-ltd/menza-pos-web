'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function GlobalRouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Structured error dispatch to runtime logs
    console.error('[UNCAUGHT_REACT_ROUTE_ERROR]', error.message, {
      digest: error.digest,
      errorName: error.name,
      errorStack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#FAF7F2] dark:bg-[#111418] text-[#1E2930] dark:text-[#F3F4F6]">
      <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 mx-auto">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="text-xs text-[#667085] dark:text-[#94A3B8] leading-relaxed">
            An unexpected error occurred in this view. This event has been logged for engineering review.
          </p>
        </div>

        {error.digest && (
          <div className="rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 border border-[#E7E1DA] dark:border-[#2B3540] text-[11px] font-mono text-[#667085]">
            Incident Ref: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-[#DE8626] hover:bg-[#C9751D] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border border-[#E7E1DA] dark:border-[#2B3540] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
