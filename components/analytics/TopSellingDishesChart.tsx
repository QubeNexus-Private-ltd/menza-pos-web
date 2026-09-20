'use client';

import React from 'react';
import { Flame } from 'lucide-react';

export interface TopSellingItemData {
  itemId?: number;
  itemName: string;
  categoryName?: string;
  quantitySold: number;
  totalRevenue: number;
  contributionPercentage?: number;
}

interface TopSellingDishesChartProps {
  items: TopSellingItemData[];
}

export const TopSellingDishesChart: React.FC<TopSellingDishesChartProps> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] p-6 text-center">
        <Flame className="h-8 w-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">No dish sales recorded in this period</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...items.map((i) => i.totalRevenue || 0), 100);

  return (
    <div className="space-y-3">
      {items.slice(0, 7).map((item, idx) => {
        const pct = Math.min(Math.round(((item.totalRevenue || 0) / maxRevenue) * 100), 100);

        return (
          <div
            key={item.itemId || idx}
            className="group rounded-xl border border-[#E7E1DA]/60 dark:border-[#2B3540]/60 bg-[#FAF7F2]/40 dark:bg-[#151A20]/40 p-3 hover:border-[#DE8626] transition-all"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-[10px] font-bold text-[#DE8626]">
                  #{idx + 1}
                </span>
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] line-clamp-1">
                  {item.itemName}
                </span>
                {item.categoryName && (
                  <span className="rounded-md bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] text-[#667085] dark:text-[#94A3B8]">
                    {item.categoryName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-[#667085] dark:text-[#94A3B8]">
                  {item.quantitySold} sold
                </span>
                <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(item.totalRevenue || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Revenue Contribution Bar */}
            <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
              <div
                style={{ width: `${pct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-[#DE8626] transition-all duration-500"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
