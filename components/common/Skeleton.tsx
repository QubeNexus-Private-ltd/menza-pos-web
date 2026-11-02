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
