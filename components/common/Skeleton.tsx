'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/** Primitive Skeleton box with soft pulse */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse rounded-lg bg-black/10 dark:bg-white/10 ${className}`}
      {...props}
    />
  );
};

/** Dashboard & Reports: 4 KPI Summary Cards Skeleton */
export const DashboardMetricsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 sm:p-5 animate-pulse space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-16 rounded" />
              <Skeleton className="h-3.5 w-20 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Dashboard: Analytics Charts Shimmer */
export const DashboardChartsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 animate-pulse space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
};

/** Orders Page & Dashboard: Data Table Rows Skeleton */
export const OrdersTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1B2127]"
        >
          {/* Order ID & Token */}
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton className="h-8 w-18 rounded-xl bg-[#DE8626]/20 shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          </div>

          {/* Table / Channel & Status */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-24 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Amount & Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <Skeleton className="h-5 w-20 rounded-lg" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Tables Page: Floor Tables Grid Skeleton */
export const TablesFloorSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-38 sm:h-44 rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3.5 flex flex-col justify-between animate-pulse shadow-xs"
        >
          {/* Top row */}
          <div className="flex items-center justify-between gap-1.5">
            <Skeleton className="h-6 w-16 rounded-lg bg-[#DE8626]/20" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>

          {/* Center Table Icon */}
          <div className="my-auto flex flex-col items-center justify-center gap-1.5">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
            <Skeleton className="h-3.5 w-12 rounded" />
            <Skeleton className="h-3.5 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Menu Catalog Page: Dish Grid Skeleton */
export const MenuGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden flex flex-col justify-between animate-pulse shadow-xs"
        >
          {/* Image Shimmer */}
          <div className="relative h-44 w-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
            <div className="absolute top-3 left-3">
              <Skeleton className="h-5 w-5 rounded-md" />
            </div>
            <div className="absolute top-3 right-3">
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 flex-1">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-4/5 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
              <Skeleton className="h-6 w-20 rounded-lg bg-[#DE8626]/20" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3 border-t border-[#E7E1DA]/80 dark:border-[#2B3540]/80 bg-[#FAF7F2] dark:bg-[#151A20] flex items-center justify-between">
            <Skeleton className="h-7 w-20 rounded-xl" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** POS Billing Page: Dish Tile Skeleton */
export const PosGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden flex flex-col justify-between animate-pulse shadow-xs"
        >
          {/* Image Placeholder */}
          <div className="relative h-28 w-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
            <div className="absolute top-2 left-2">
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          </div>

          {/* Details */}
          <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
            <Skeleton className="h-3.5 w-4/5 rounded" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-5 w-14 rounded-md bg-[#DE8626]/20" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Staff Management: Staff Directory Rows Skeleton */
export const StaffListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1B2127]"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Wallet Page: Balance Card & Ledger Rows Skeleton */
export const WalletSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Wallet Balance Hero Card */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-baseline gap-3">
          <Skeleton className="h-12 w-44 rounded-xl bg-[#DE8626]/20" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Ledger Table Shimmer */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-7 w-24 rounded-xl" />
        </div>
        <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Reservations Page: Reservations List Skeleton */
export const ReservationListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 space-y-3.5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-lg bg-[#DE8626]/20" />
            <Skeleton className="h-5 w-18 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3.5 w-1/2 rounded" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Generic Data Table Shimmer */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => {
  return (
    <div className="w-full divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-4 flex items-center justify-between gap-4 bg-white dark:bg-[#1B2127]">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 rounded ${
                c === 0 ? 'w-1/4' : c === cols - 1 ? 'w-20' : 'w-1/6'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/** Form Fields & Configuration Shimmer */
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 5 }) => {
  return (
    <div className="space-y-5 rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 animate-pulse">
      <Skeleton className="h-5 w-40 rounded-lg" />
      <div className="space-y-4 pt-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-3">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl bg-[#DE8626]/20" />
      </div>
    </div>
  );
};

/** Store / Outlets / Partner Directory Card Grid Shimmer */
export const DirectoryGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Subscription Plans Tier Cards Shimmer */
export const PlanCardsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 space-y-5 shadow-xs flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-24 rounded-lg bg-[#DE8626]/20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-32 rounded-xl" />
            <Skeleton className="h-3.5 w-full rounded" />
            <div className="space-y-2 pt-4 border-t border-black/5 dark:border-white/5">
              {Array.from({ length: 4 }).map((_, f) => (
                <div key={f} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
};

/** Live Customer Order Tracker Shimmer */
export const OrderTrackerSkeleton: React.FC = () => {
  return (
    <div className="max-w-xl mx-auto space-y-5 animate-pulse p-4">
      {/* Outlet Header Card */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 space-y-3 text-center shadow-xs">
        <Skeleton className="h-16 w-16 rounded-2xl mx-auto" />
        <Skeleton className="h-5 w-44 rounded-lg mx-auto" />
        <Skeleton className="h-3.5 w-60 rounded mx-auto" />
      </div>

      {/* Status Stepper Card */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 space-y-6 shadow-xs">
        <div className="flex justify-between items-center">
          <Skeleton className="h-7 w-28 rounded-xl bg-[#DE8626]/20" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex justify-between items-center px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Bill & Items Card */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 space-y-3 shadow-xs">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="divide-y divide-black/5 dark:divide-white/5 space-y-2 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pt-2 flex justify-between">
              <Skeleton className="h-3.5 w-36 rounded" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Inventory Raw Ingredients / Recipes / Waste / Archive Table Shimmer */
export const InventoryTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-700 animate-pulse bg-white dark:bg-neutral-800">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-2.5 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-2 w-32 rounded-full hidden sm:block" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      ))}
    </div>
  );
};

/** Settings: Billing & Subscription Skeleton */
export const BillingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Active Sub Hero */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-44 rounded-lg" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-60 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5 p-3 rounded-2xl bg-black/5 dark:bg-white/5">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Feature Entitlements Card Shimmer */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-xs space-y-4">
        <Skeleton className="h-5 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
              <div className="space-y-1.5 flex-1 pr-3">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Tier Plans Grid Shimmer */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-40 rounded-lg" />
        <PlanCardsSkeleton count={3} />
      </div>
    </div>
  );
};

/** Settings: Restaurant Profile & Media Configuration Skeleton */
export const RestaurantConfigSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. Brand Images (Logo & Banner) */}
      <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-4 w-44 rounded-md" />
            <Skeleton className="h-3 w-64 rounded" />
          </div>
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-black/5 dark:border-white/5">
            <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-8 w-28 rounded-xl" />
            </div>
          </div>
          <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-8 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. Basic Details Card */}
      <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs space-y-4">
        <Skeleton className="h-4 w-36 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* 3. Tax & GST Registration Card */}
      <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs space-y-4">
        <Skeleton className="h-4 w-40 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* 4. Action Save Button */}
      <div className="flex justify-end gap-3 pt-2">
        <Skeleton className="h-11 w-44 rounded-2xl bg-[#DE8626]/20" />
      </div>
    </div>
  );
};

/** Settings: Bank Account & UPI Settlement Skeleton */
export const BankConfigSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Active Account Banner Shimmer */}
      <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-52 rounded-md" />
        <Skeleton className="h-3.5 w-64 rounded" />
      </div>

      {/* Bank Form Card Shimmer */}
      <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="pt-3 flex justify-end gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl bg-[#DE8626]/20" />
        </div>
      </div>
    </div>
  );
};
