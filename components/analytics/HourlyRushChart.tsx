'use client';

import React, { useState } from 'react';
import { Clock, Zap } from 'lucide-react';

interface HourlySlot {
  hour: number;
  hourLabel: string;
  ordersCount: number;
  totalSales: number;
  completedOrders?: number;
}

interface HourlyRushChartProps {
  slots: HourlySlot[];
  peakHourLabel?: string;
  peakHourOrders?: number;
  height?: number;
}

export const HourlyRushChart: React.FC<HourlyRushChartProps> = ({
  slots,
  peakHourLabel,
  peakHourOrders,
  height = 200,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!slots || slots.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] p-6 text-center">
        <Clock className="h-8 w-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">No hourly order telemetry available for today</p>
      </div>
    );
  }

  const maxOrders = Math.max(...slots.map((s) => s.ordersCount || 0), 2);

  return (
    <div className="space-y-3">
      {/* Peak hour callout badge */}
      {peakHourLabel && (
        <div className="flex items-center justify-between rounded-xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-300 dark:border-amber-900/40 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 text-[#DE8626] font-bold">
            <Zap className="h-4 w-4" />
            <span>Peak Rush Hour: {peakHourLabel}</span>
          </div>
          {peakHourOrders !== undefined && (
            <span className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
              {peakHourOrders} tickets punched
            </span>
          )}
        </div>
      )}

      {/* SVG 24-Hour Column Chart */}
      <div className="relative w-full overflow-x-auto select-none pt-2">
        <div className="min-w-[480px]">
          <svg
            className="w-full overflow-visible"
            height={height}
            viewBox={`0 0 540 ${height}`}
          >
            {/* Grid baseline */}
            <line
              x1="20"
              y1={height - 24}
              x2="530"
              y2={height - 24}
              stroke="currentColor"
              className="text-[#E7E1DA] dark:text-[#2B3540]"
            />

            {slots.map((slot, idx) => {
              const slotWidth = 490 / Math.max(slots.length, 1);
              const barW = Math.max(slotWidth * 0.55, 10);
              const x = 30 + idx * slotWidth;

              const barH = Math.max(((slot.ordersCount || 0) / maxOrders) * (height - 50), 2);
              const y = height - 24 - barH;

              const isHovered = hoveredIdx === idx;
              const hasOrders = slot.ordersCount > 0;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  {/* Hover column backdrop */}
                  {isHovered && (
                    <rect
                      x={x - 4}
                      y="5"
                      width={barW + 8}
                      height={height - 30}
                      className="fill-amber-500/10"
                      rx="4"
                    />
                  )}

                  {/* Hourly Bar */}
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx="3"
                    className={`transition-all duration-300 ${
                      hasOrders
                        ? isHovered
                          ? 'fill-[#DE8626]'
                          : 'fill-amber-500'
                        : 'fill-black/5 dark:fill-white/5'
                    }`}
                  />

                  {/* Hour label on X-axis */}
                  {(idx % 2 === 0 || slots.length <= 12) && (
                    <text
                      x={x + barW / 2}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-[#667085] dark:fill-[#94A3B8] text-[9px] font-medium"
                    >
                      {slot.hourLabel || `${slot.hour}:00`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && slots[hoveredIdx] && (
          <div className="mt-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-2.5 shadow-md text-xs flex items-center justify-between">
            <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              Time Slot: {slots[hoveredIdx].hourLabel || `${slots[hoveredIdx].hour}:00`}
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-[#667085]">Orders: <strong>{slots[hoveredIdx].ordersCount}</strong></span>
              <span className="font-bold text-[#DE8626]">Sales: ₹{slots[hoveredIdx].totalSales.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
