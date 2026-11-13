'use client';

import React, { useState, useMemo } from 'react';
import { Clock, Zap, Utensils, Flame, Sparkles } from 'lucide-react';

export interface HourlySlot {
  hour: number;
  hourLabel: string;
  ordersCount: number;
  totalSales: number;
  completedOrders?: number;
}

export interface HourlyRushChartProps {
  slots: HourlySlot[];
  peakHourLabel?: string;
  peakHourOrders?: number;
  peakHourSales?: number;
  height?: number;
  dateLabel?: string;
}

export const HourlyRushChart: React.FC<HourlyRushChartProps> = ({
  slots,
  peakHourLabel,
  peakHourOrders,
  peakHourSales,
  dateLabel,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Normalize 24-hour slots
  const normalizedSlots = useMemo(() => {
    if (!slots || slots.length === 0) return [];

    // Ensure 24 slots indexed 0..23
    const map = new Map<number, HourlySlot>();
    slots.forEach((s) => map.set(s.hour, s));

    const result: HourlySlot[] = [];
    for (let h = 0; h < 24; h++) {
      const existing = map.get(h);
      if (existing) {
        result.push(existing);
      } else {
        const nextH = (h + 1) % 24;
        result.push({
          hour: h,
          hourLabel: `${String(h).padStart(2, '0')}:00 - ${String(nextH).padStart(2, '0')}:00`,
          ordersCount: 0,
          totalSales: 0,
          completedOrders: 0,
        });
      }
    }
    return result;
  }, [slots]);

  // Aggregate metrics
  const { totalOrders, totalSales, maxSlotOrders, maxSlotSales, lunch, dinner, peakSlot } = useMemo<{
    totalOrders: number;
    totalSales: number;
    maxSlotOrders: number;
    maxSlotSales: number;
    lunch: { orders: number; sales: number; completed: number };
    dinner: { orders: number; sales: number; completed: number };
    peakSlot: HourlySlot | null;
  }>(() => {
    let ordersSum = 0;
    let salesSum = 0;
    let maxO = 0;
    let maxS = 0;

    let lunchOrders = 0;
    let lunchSales = 0;
    let lunchCompleted = 0;

    let dinnerOrders = 0;
    let dinnerSales = 0;
    let dinnerCompleted = 0;

    let peak: HourlySlot | null = null;

    normalizedSlots.forEach((s) => {
      ordersSum += s.ordersCount || 0;
      salesSum += s.totalSales || 0;
      if ((s.ordersCount || 0) > maxO) maxO = s.ordersCount;
      if ((s.totalSales || 0) > maxS) maxS = s.totalSales;

      // Lunch window: 12:00 to 15:59 (hours 12, 13, 14, 15)
      if (s.hour >= 12 && s.hour <= 15) {
        lunchOrders += s.ordersCount || 0;
        lunchSales += s.totalSales || 0;
        lunchCompleted += s.completedOrders || 0;
      }

      // Dinner window: 19:00 to 22:59 (hours 19, 20, 21, 22)
      if (s.hour >= 19 && s.hour <= 22) {
        dinnerOrders += s.ordersCount || 0;
        dinnerSales += s.totalSales || 0;
        dinnerCompleted += s.completedOrders || 0;
      }

      if ((s.ordersCount || 0) > 0) {
        if (!peak || (s.totalSales || 0) > (peak.totalSales || 0) || (s.ordersCount || 0) > (peak.ordersCount || 0)) {
          peak = s;
        }
      }
    });

    return {
      totalOrders: ordersSum,
      totalSales: salesSum,
      maxSlotOrders: Math.max(maxO, 1),
      maxSlotSales: Math.max(maxS, 1),
      lunch: { orders: lunchOrders, sales: lunchSales, completed: lunchCompleted },
      dinner: { orders: dinnerOrders, sales: dinnerSales, completed: dinnerCompleted },
      peakSlot: peak,
    };
  }, [normalizedSlots]);

  const hasAnyOrders = totalOrders > 0;
  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedIdx;
  const activeSlot = activeIdx !== null && normalizedSlots[activeIdx] ? normalizedSlots[activeIdx] : null;

  // Format 12-hour display label for an hour slot
  const formatHourDisplay = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const nextHour = (hour + 1) % 12 === 0 ? 12 : (hour + 1) % 12;
    const nextPeriod = (hour + 1) >= 12 && (hour + 1) < 24 ? 'PM' : 'AM';
    return `${displayHour}:00 ${period} – ${nextHour}:00 ${nextPeriod}`;
  };

  // Format short axis tick: 12 AM, 3 AM, 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM
  const formatShortTick = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    const period = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12} ${period}`;
  };

  if (!slots || slots.length === 0 || !hasAnyOrders) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF8F5]/60 dark:bg-[#171D22]/60 p-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center text-[#DE8626]">
          <Clock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
            No Order Activity Recorded
          </p>
          <p className="text-xs text-[#667085] dark:text-[#94A3B8] max-w-sm">
            {dateLabel
              ? `No customer tickets were punched for ${dateLabel}.`
              : "No customer orders have been placed during this operating window."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#EFE9DF] dark:bg-[#252E38] px-3 py-1 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
          <Sparkles className="h-3.5 w-3.5 text-[#DE8626]" />
          <span>Telemetry updates automatically as tickets are settled</span>
        </div>
      </div>
    );
  }

  const effectivePeakLabel = peakHourLabel || (peakSlot ? formatHourDisplay(peakSlot.hour) : '');
  const effectivePeakOrders = peakHourOrders !== undefined && peakHourOrders > 0
    ? peakHourOrders
    : peakSlot?.ordersCount || 0;
  const effectivePeakSales = peakHourSales !== undefined && peakHourSales > 0
    ? peakHourSales
    : peakSlot?.totalSales || 0;

  return (
    <div className="space-y-4">
      {/* 1. Peak Hour Callout Banner */}
      {effectivePeakOrders > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-900/40 px-4 py-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#DE8626] text-white flex items-center justify-center shadow-xs">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-black text-[#DE8626] text-xs uppercase tracking-wide">
                <span>PEAK RUSH HOUR</span>
              </div>
              <p className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6] mt-0.5">
                {effectivePeakLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <span className="text-[11px] font-medium text-[#667085] dark:text-[#94A3B8] block">Peak Sales</span>
              <span className="font-black text-sm text-[#DE8626]">
                ₹{effectivePeakSales.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="h-7 w-[1px] bg-amber-300/50 dark:bg-amber-900/40" />
            <div>
              <span className="text-[11px] font-medium text-[#667085] dark:text-[#94A3B8] block">Tickets</span>
              <span className="font-black text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                {effectivePeakOrders}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Interactive Slot Inspector Box */}
      {activeSlot ? (
        <div className="rounded-2xl border border-[#DE8626]/40 bg-amber-500/5 dark:bg-[#20272E] p-3.5 transition-all shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#DE8626] animate-pulse" />
              <span className="font-extrabold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                {formatHourDisplay(activeSlot.hour)}
              </span>
              <span className="text-[10px] font-bold text-[#667085] dark:text-[#94A3B8] bg-white dark:bg-[#1B2127] px-2 py-0.5 rounded-md border border-[#E7E1DA] dark:border-[#2B3540]">
                Hour {activeSlot.hour}:00
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-[#DE8626]">
                ₹{activeSlot.totalSales.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] ml-1">revenue</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white/80 dark:bg-[#1B2127]/80 rounded-xl p-2 border border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] block">Tickets Punched</span>
              <span className="font-extrabold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                {activeSlot.ordersCount}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-[#1B2127]/80 rounded-xl p-2 border border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] block">Completed</span>
              <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                {activeSlot.completedOrders ?? activeSlot.ordersCount}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-[#1B2127]/80 rounded-xl p-2 border border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] block">Day's Volume</span>
              <span className="font-extrabold text-xs text-[#DE8626]">
                {totalOrders > 0 ? ((activeSlot.ordersCount / totalOrders) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-[#FAF8F5] dark:bg-[#1C2329] border border-[#E7E1DA] dark:border-[#2B3540] px-3.5 py-2 text-[11px] text-[#667085] dark:text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-[#DE8626]" />
            <span>Hover or click any hourly bar to inspect volume, shift share & revenue</span>
          </div>
          <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
            24-Hour Timeline
          </span>
        </div>
      )}

      {/* 3. 24-Hour Column Chart with Capsule Tracks */}
      <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 sm:p-5">
        <div className="h-40 flex items-end gap-1 sm:gap-1.5 w-full pt-2">
          {normalizedSlots.map((slot, idx) => {
            const hasOrders = (slot.ordersCount || 0) > 0;
            const isSelected = activeIdx === idx;
            const isPeak = hasOrders && peakSlot?.hour === slot.hour;
            const isLunch = slot.hour >= 12 && slot.hour <= 15;
            const isDinner = slot.hour >= 19 && slot.hour <= 22;

            // Height percentage based on max orders in any slot
            const heightPercent = hasOrders
              ? Math.max(Math.round(((slot.ordersCount || 0) / maxSlotOrders) * 92), 12)
              : 0;

            // Semantic bar color
            let barBg = 'bg-[#EDE8E1] dark:bg-[#252E38]';
            if (isSelected) {
              barBg = 'bg-[#DE8626] ring-2 ring-[#DE8626]/30 shadow-md';
            } else if (isPeak) {
              barBg = 'bg-amber-500 shadow-xs';
            } else if (isDinner && hasOrders) {
              barBg = 'bg-[#17845A]';
            } else if (isLunch && hasOrders) {
              barBg = 'bg-[#346CB0]';
            } else if (hasOrders) {
              barBg = 'bg-[#DE8626]/70';
            }

            return (
              <div
                key={`slot-${slot.hour}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                className="group flex-1 flex flex-col items-center justify-end h-full cursor-pointer relative"
                title={`${formatHourDisplay(slot.hour)}: ${slot.ordersCount} orders, ₹${slot.totalSales}`}
              >
                {/* Column full track */}
                <div className="w-full max-w-[14px] h-full bg-[#F5F2EB] dark:bg-[#20272E] rounded-full flex flex-col justify-end overflow-hidden p-0.5 group-hover:bg-[#EFE9DF] dark:group-hover:bg-[#28313A] transition-colors">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-full transition-all duration-300 ${barBg}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* X-Axis Ticks (clean 3-hour intervals: 12 AM, 3 AM, 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM) */}
        <div className="flex items-center justify-between text-[10px] font-bold text-[#667085] dark:text-[#94A3B8] pt-3 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 select-none">
          {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
            <span
              key={`tick-${hour}`}
              className={
                hour === 12
                  ? 'text-[#346CB0] font-black'
                  : hour === 18 || hour === 21
                  ? 'text-[#17845A] font-black'
                  : ''
              }
            >
              {formatShortTick(hour)}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Operational Shift Rush Cards (Lunch vs Dinner) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Lunch Shift Card */}
        <div className="rounded-2xl border border-[#346CB0]/25 bg-[#346CB0]/5 dark:bg-[#1A2530] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-[#346CB0] text-white flex items-center justify-center">
                <Utensils className="h-3.5 w-3.5" />
              </div>
              <span className="font-extrabold text-xs text-[#346CB0]">
                Lunch Service
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8]">
              12:00 PM – 4:00 PM
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6]">
                {lunch.orders} <span className="text-xs font-semibold text-[#667085]">tickets</span>
              </span>
              <span className="text-[11px] text-[#667085] dark:text-[#94A3B8] block">
                {lunch.completed} served
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-[#346CB0]">
                ₹{lunch.sales.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] block">
                {totalOrders > 0 ? ((lunch.orders / totalOrders) * 100).toFixed(0) : 0}% of volume
              </span>
            </div>
          </div>
        </div>

        {/* Dinner Rush Card */}
        <div className="rounded-2xl border border-[#17845A]/25 bg-[#17845A]/5 dark:bg-[#162923] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-[#17845A] text-white flex items-center justify-center">
                <Flame className="h-3.5 w-3.5" />
              </div>
              <span className="font-extrabold text-xs text-[#17845A]">
                Dinner Rush
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8]">
              7:00 PM – 11:00 PM
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6]">
                {dinner.orders} <span className="text-xs font-semibold text-[#667085]">tickets</span>
              </span>
              <span className="text-[11px] text-[#667085] dark:text-[#94A3B8] block">
                {dinner.completed} served
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-[#17845A]">
                ₹{dinner.sales.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] block">
                {totalOrders > 0 ? ((dinner.orders / totalOrders) * 100).toFixed(0) : 0}% of volume
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Color Legend Bar */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] font-semibold text-[#667085] dark:text-[#94A3B8] pt-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#346CB0]" />
          <span>Lunch (12–4 PM)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#17845A]" />
          <span>Dinner (7–11 PM)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Peak Hour</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#DE8626]" />
          <span>Active Selection</span>
        </span>
      </div>
    </div>
  );
};
