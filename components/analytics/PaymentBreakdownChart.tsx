'use client';

import React from 'react';
import { CreditCard, Wallet, Banknote, QrCode, Info } from 'lucide-react';

export interface PaymentModeMetric {
  mode: string;
  total: number;
  count: number;
  percentage: number;
}

interface PaymentBreakdownChartProps {
  data: PaymentModeMetric[];
  totalCollected: number;
}

const getModeIcon = (mode: string) => {
  switch (mode.toUpperCase()) {
    case 'CASH':
      return <Banknote className="h-4 w-4 text-emerald-600" />;
    case 'UPI':
      return <QrCode className="h-4 w-4 text-blue-600" />;
    case 'CARD':
      return <CreditCard className="h-4 w-4 text-purple-600" />;
    default:
      return <Wallet className="h-4 w-4 text-amber-600" />;
  }
};

const getModeColor = (mode: string) => {
  switch (mode.toUpperCase()) {
    case 'CASH':
      return 'bg-emerald-500';
    case 'UPI':
      return 'bg-blue-500';
    case 'CARD':
      return 'bg-purple-500';
    default:
      return 'bg-amber-500';
  }
};

export const PaymentBreakdownChart: React.FC<PaymentBreakdownChartProps> = ({
  data,
  totalCollected,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] p-6 text-center">
        <CreditCard className="h-8 w-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">No settled payment transactions found for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual Stacked Bar */}
      <div className="h-3 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex shadow-xs">
        {data.map((item) => (
          <div
            key={item.mode}
            style={{ width: `${Math.max(item.percentage, 3)}%` }}
            title={`${item.mode}: ${item.percentage}% (₹${item.total.toLocaleString('en-IN')})`}
            className={`h-full ${getModeColor(item.mode)} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
          />
        ))}
      </div>

      {/* Mode Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.map((item) => (
          <div
            key={item.mode}
            className="flex items-center justify-between rounded-xl border border-[#E7E1DA]/60 dark:border-[#2B3540]/60 bg-[#FAF7F2]/40 dark:bg-[#151A20]/40 p-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-[#1B2127] shadow-xs">
                {getModeIcon(item.mode)}
              </div>
              <div>
                <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6] block">
                  {item.mode}
                </span>
                <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                  {item.count} tickets ({item.percentage}%)
                </span>
              </div>
            </div>
            <div className="text-right font-extrabold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
              ₹{item.total.toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>

      {/* Transparency Note */}
      <div className="flex items-start gap-1.5 text-[10px] text-[#667085] dark:text-[#94A3B8] pt-1">
        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
        <span>
          Payment mode distribution is computed from settled POS order tickets. The backend executive report aggregates net sales and GST reconciliation; tender mode reconciliation is mapped directly from confirmed orders.
        </span>
      </div>
    </div>
  );
};
