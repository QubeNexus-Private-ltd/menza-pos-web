'use client';

import React, { useState } from 'react';
import { IndianRupee, TrendingUp } from 'lucide-react';

export interface DailySalesData {
  date: string;
  grossSales: number;
  netSales: number;
  taxAmount?: number;
  discountAmount?: number;
}

interface RevenueTrendChartProps {
  data: DailySalesData[];
  height?: number;
}

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  data,
  height = 240,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] p-6 text-center">
        <TrendingUp className="h-8 w-8 opacity-40 mb-2" />
        <p className="text-xs font-semibold">No revenue data available for this date range</p>
        <p className="text-[11px] opacity-75 mt-0.5">Bills settled at POS will populate daily trends here</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.grossSales, d.netSales)), 100);
  const roundedMax = Math.ceil(maxVal / 1000) * 1000 || 1000;

  const formatDateLabel = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return dStr;
    }
  };

  const totalGross = data.reduce((sum, d) => sum + (d.grossSales || 0), 0);
  const totalNet = data.reduce((sum, d) => sum + (d.netSales || 0), 0);
  const avgDaily = totalGross / data.length;

  return (
    <div className="space-y-4">
      {/* Chart Header Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[#667085] dark:text-[#94A3B8] text-[11px] block">Period Total</span>
            <span className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
              ₹{totalGross.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="border-l border-[#E7E1DA] dark:border-[#2B3540] pl-4">
            <span className="text-[#667085] dark:text-[#94A3B8] text-[11px] block">Daily Average</span>
            <span className="font-extrabold text-sm text-[#DE8626]">
              ₹{Math.round(avgDaily).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#DE8626]" />
            <span className="text-[#667085] dark:text-[#94A3B8]">Gross Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 dark:bg-amber-600" />
            <span className="text-[#667085] dark:text-[#94A3B8]">Net Sales</span>
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
                    x1="45"
                    y1={y}
                    x2="100%"
                    y2={y}
                    stroke="currentColor"
                    className="text-[#E7E1DA] dark:text-[#2B3540]"
                    strokeDasharray="3 3"
                  />
                  <text
                    x="40"
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[#667085] dark:fill-[#94A3B8] text-[10px]"
                  >
                    ₹{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {data.map((item, idx) => {
              const totalBars = data.length;
              const chartW = Math.max(totalBars * 60, 360);
              const usableW = chartW - 60;
              const slotW = usableW / totalBars;
              const barX = 55 + idx * slotW;
              const barWidth = Math.min(Math.max(slotW * 0.38, 12), 24);

              const grossH = Math.max(((item.grossSales || 0) / roundedMax) * (height - 50), 2);
              const netH = Math.max(((item.netSales || 0) / roundedMax) * (height - 50), 2);
              const grossY = height - 30 - grossH;
              const netY = height - 30 - netH;

              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-opacity"
                >
                  {/* Subtle hover background column */}
                  {isHovered && (
                    <rect
                      x={barX - 8}
                      y="5"
                      width={barWidth * 2 + 20}
                      height={height - 35}
                      className="fill-amber-500/10"
                      rx="6"
                    />
                  )}

                  {/* Gross Sales Bar */}
                  <rect
                    x={barX}
                    y={grossY}
                    width={barWidth}
                    height={grossH}
                    rx="3"
                    className={`transition-all duration-300 ${
                      isHovered ? 'fill-[#C4721C]' : 'fill-[#DE8626]'
                    }`}
                  />

                  {/* Net Sales Bar */}
                  <rect
                    x={barX + barWidth + 3}
                    y={netY}
                    width={barWidth}
                    height={netH}
                    rx="3"
                    className={`transition-all duration-300 ${
                      isHovered ? 'fill-amber-500' : 'fill-amber-400 dark:fill-amber-600'
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

        {/* Floating tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="mt-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 shadow-md text-xs flex items-center justify-between">
            <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              {formatDateLabel(data[hoveredIdx].date)}
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <div>
                <span className="text-[#667085]">Gross: </span>
                <span className="font-extrabold text-[#DE8626]">
                  ₹{Number(data[hoveredIdx].grossSales || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[#667085]">Net: </span>
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(data[hoveredIdx].netSales || 0).toLocaleString('en-IN')}
                </span>
              </div>
              {data[hoveredIdx].taxAmount !== undefined && (
                <div>
                  <span className="text-[#667085]">Tax: </span>
                  <span className="font-medium text-emerald-600">
                    ₹{Number(data[hoveredIdx].taxAmount || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
