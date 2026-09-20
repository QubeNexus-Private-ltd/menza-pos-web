'use client';

import React, { useState } from 'react';
import { ShoppingBag, CheckCircle2 } from 'lucide-react';

export interface DailyOrdersData {
  date: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders?: number;
  averageOrderValue?: number;
}

interface OrdersTrendChartProps {
  data: DailyOrdersData[];
  height?: number;
}

export const OrdersTrendChart: React.FC<OrdersTrendChartProps> = ({
  data,
  height = 240,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] p-6 text-center">
        <ShoppingBag className="h-8 w-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">No order data available for this date range</p>
        <p className="text-[11px] opacity-75 mt-0.5">Punched orders will display volume trends here</p>
      </div>
    );
  }

  const maxOrders = Math.max(...data.map((d) => d.totalOrders || 0), 5);
  const roundedMax = Math.ceil(maxOrders / 5) * 5 || 5;

  const formatDateLabel = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return dStr;
    }
  };

  const totalOrders = data.reduce((sum, d) => sum + (d.totalOrders || 0), 0);
  const totalCompleted = data.reduce((sum, d) => sum + (d.completedOrders || 0), 0);
  const completionRate = totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Chart Header Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[#667085] dark:text-[#94A3B8] text-[11px] block">Total Orders</span>
            <span className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
              {totalOrders} tickets
            </span>
          </div>
          <div className="border-l border-[#E7E1DA] dark:border-[#2B3540] pl-4">
            <span className="text-[#667085] dark:text-[#94A3B8] text-[11px] block">Settlement Rate</span>
            <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
              {completionRate}%
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
            <span className="text-[#667085] dark:text-[#94A3B8]">Total Orders</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            <span className="text-[#667085] dark:text-[#94A3B8]">Completed</span>
          </div>
        </div>
      </div>

      {/* SVG Bar Chart Area */}
      <div className="relative w-full overflow-x-auto select-none pt-4">
        <div className="min-w-[320px]">
          <svg
            className="w-full overflow-visible"
            height={height}
            viewBox={`0 0 ${Math.max(data.length * 60, 360)} ${height}`}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = height - 30 - ratio * (height - 50);
              const val = Math.round(roundedMax * ratio);
              return (
                <g key={i}>
                  <line
                    x1="35"
                    y1={y}
                    x2="100%"
                    y2={y}
                    stroke="currentColor"
                    className="text-[#E7E1DA] dark:text-[#2B3540]"
                    strokeDasharray="3 3"
                  />
                  <text
                    x="30"
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[#667085] dark:fill-[#94A3B8] text-[10px]"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {data.map((item, idx) => {
              const totalBars = data.length;
              const chartW = Math.max(totalBars * 60, 360);
              const usableW = chartW - 50;
              const slotW = usableW / totalBars;
              const barX = 45 + idx * slotW;
              const barWidth = Math.min(Math.max(slotW * 0.38, 12), 24);

              const totalH = Math.max(((item.totalOrders || 0) / roundedMax) * (height - 50), 2);
              const compH = Math.max(((item.completedOrders || 0) / roundedMax) * (height - 50), 2);
              const totalY = height - 30 - totalH;
              const compY = height - 30 - compH;

              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-opacity"
                >
                  {/* Hover highlight */}
                  {isHovered && (
                    <rect
                      x={barX - 6}
                      y="5"
                      width={barWidth * 2 + 16}
                      height={height - 35}
                      className="fill-blue-500/10"
                      rx="6"
                    />
                  )}

                  {/* Total Orders Bar */}
                  <rect
                    x={barX}
                    y={totalY}
                    width={barWidth}
                    height={totalH}
                    rx="3"
                    className={`transition-all duration-300 ${
                      isHovered ? 'fill-blue-600' : 'fill-blue-500'
                    }`}
                  />

                  {/* Completed Orders Bar */}
                  <rect
                    x={barX + barWidth + 3}
                    y={compY}
                    width={barWidth}
                    height={compH}
                    rx="3"
                    className={`transition-all duration-300 ${
                      isHovered ? 'fill-emerald-600' : 'fill-emerald-500'
                    }`}
                  />

                  {/* Date label */}
                  <text
                    x={barX + barWidth + 1}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#667085] dark:fill-[#94A3B8] text-[10px] font-medium"
                  >
                    {formatDateLabel(item.date)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="mt-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 shadow-md text-xs flex items-center justify-between">
            <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              {formatDateLabel(data[hoveredIdx].date)}
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <div>
                <span className="text-[#667085]">Total: </span>
                <span className="font-extrabold text-blue-600">
                  {data[hoveredIdx].totalOrders} orders
                </span>
              </div>
              <div>
                <span className="text-[#667085]">Completed: </span>
                <span className="font-bold text-emerald-600">
                  {data[hoveredIdx].completedOrders}
                </span>
              </div>
              {data[hoveredIdx].averageOrderValue ? (
                <div>
                  <span className="text-[#667085]">AOV: </span>
                  <span className="font-medium text-[#1E2930] dark:text-[#F3F4F6]">
                    ₹{Math.round(data[hoveredIdx].averageOrderValue!)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
