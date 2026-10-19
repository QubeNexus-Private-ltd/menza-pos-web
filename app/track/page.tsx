'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, UtensilsCrossed, Sparkles, ArrowRight } from 'lucide-react';

function TrackSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderIdInput, setOrderIdInput] = useState('');

  useEffect(() => {
    const qOrderId = searchParams.get('orderId') || searchParams.get('id');
    if (qOrderId && qOrderId.trim()) {
      router.replace(`/track/${encodeURIComponent(qOrderId.trim())}`);
    }
  }, [searchParams, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = orderIdInput.trim();
    if (cleanId) {
      router.push(`/track/${encodeURIComponent(cleanId)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#1A1F26] rounded-3xl shadow-xl border border-[#E7E1DA] dark:border-[#2A313C] p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-[#FFF0DE] dark:bg-[#342416] text-[#DE8626] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <UtensilsCrossed className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase font-extrabold tracking-wider text-[#DE8626] flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Live Kitchen Tracking
          </span>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Track Your Order
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter your Order ID (from SMS, WhatsApp, or printed bill) to check real-time kitchen progress.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="e.g. 10452"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#E7E1DA] dark:border-[#2A313C] bg-white dark:bg-[#111418] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DE8626] transition font-mono font-medium text-center text-lg"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!orderIdInput.trim()}
            className="w-full py-3.5 bg-[#DE8626] hover:bg-[#B84D00] disabled:opacity-50 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2"
          >
            Track Status <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Powered by Menza Real-Time Restaurant Intelligence
        </p>
      </div>
    </div>
  );
}

export default function TrackOrderLandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#111418] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#DE8626] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrackSearchContent />
    </Suspense>
  );
}
