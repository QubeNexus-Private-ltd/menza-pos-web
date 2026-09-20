'use client';

import React from 'react';
import { Layers } from 'lucide-react';

interface CategoryMetric {
  name: string;
  revenue: number;
  quantity: number;
  percentage: number;
}

interface CategoryBreakdownChartProps {
  items: Array<{
    categoryName?: string;
    totalRevenue: number;
    quantitySold: number;
  }>;
}

const CATEGORY_COLORS = [
  'bg-amber-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
];

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] p-6 text-center">
        <Layers className="h-8 w-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">No category data available</p>
      </div>
    );
  }

  // Aggregate by category
  const map: Record<string, { revenue: number; quantity: number }> = {};
  let totalRev = 0;

  items.forEach((it) => {
    const cat = it.categoryName || 'General';
    if (!map[cat]) {
      map[cat] = { revenue: 0, quantity: 0 };
    }
    map[cat].revenue += Number(it.totalRevenue || 0);
    map[cat].quantity += Number(it.quantitySold || 0);
    totalRev += Number(it.totalRevenue || 0);
  });

  const categories: CategoryMetric[] = Object.entries(map)
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      quantity: data.quantity,
      percentage: totalRev > 0 ? Math.round((data.revenue / totalRev) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      {/* Segmented Progress Bar */}
      <div className="h-3 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex shadow-xs">
        {categories.map((cat, idx) => {
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          return (
            <div
              key={cat.name}
              style={{ width: `${Math.max(cat.percentage, 2)}%` }}
              title={`${cat.name}: ${cat.percentage}% (₹${cat.revenue.toLocaleString('en-IN')})`}
              className={`h-full ${color} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
            />
          );
        })}
      </div>

      {/* Category List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
        {categories.map((cat, idx) => {
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          return (
            <div
              key={cat.name}
              className="flex items-center justify-between rounded-xl border border-[#E7E1DA]/60 dark:border-[#2B3540]/60 bg-[#FAF7F2]/40 dark:bg-[#151A20]/40 p-2.5"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                  {cat.name}
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] block">
                  ₹{cat.revenue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                  {cat.percentage}% • {cat.quantity} sold
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
