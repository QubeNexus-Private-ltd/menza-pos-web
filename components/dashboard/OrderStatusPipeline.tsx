'use client';

import React, { useMemo } from 'react';
import {
  Layers,
  Sparkles,
  ChefHat,
  CheckCircle2,
  UtensilsCrossed,
  Receipt,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { OrderMaster } from '@shared/domain/models/Order';
import {
  DashboardPipelineStages,
  PipelineStageKey,
  normalizeOrderStatus,
  OrderStatuses,
  isOrderSettled,
} from '@/lib/utils/orderStatusEngine';

interface OrderStatusPipelineProps {
  orders: OrderMaster[];
  activeStage: PipelineStageKey;
  onSelectStage: (stage: PipelineStageKey) => void;
  className?: string;
}

export const OrderStatusPipeline: React.FC<OrderStatusPipelineProps> = ({
  orders,
  activeStage,
  onSelectStage,
  className = '',
}) => {
  // Compute counts and total amounts for each pipeline stage
  const stageMetrics = useMemo(() => {
    const metrics: Record<PipelineStageKey, { count: number; amount: number }> = {
      ALL: { count: 0, amount: 0 },
      NEW: { count: 0, amount: 0 },
      COOKING: { count: 0, amount: 0 },
      READY: { count: 0, amount: 0 },
      SERVED: { count: 0, amount: 0 },
      SETTLED: { count: 0, amount: 0 },
      CANCELLED: { count: 0, amount: 0 },
    };

    orders.forEach((order) => {
      const norm = normalizeOrderStatus(order.status);
      const isSettled = isOrderSettled(order);
      const isCancelled = norm === OrderStatuses.Cancelled;
      const amt = Number(order.totalAmount || 0);

      if (isCancelled) {
        metrics.CANCELLED.count += 1;
        metrics.CANCELLED.amount += amt;
        return;
      }

      if (isSettled) {
        metrics.SETTLED.count += 1;
        metrics.SETTLED.amount += amt;
        return;
      }

      // Active Orders count towards ALL
      metrics.ALL.count += 1;
      metrics.ALL.amount += amt;

      if (norm === OrderStatuses.PendingPayment || norm === OrderStatuses.Placed || norm === OrderStatuses.Confirmed) {
        metrics.NEW.count += 1;
        metrics.NEW.amount += amt;
      } else if (norm === OrderStatuses.Preparing) {
        metrics.COOKING.count += 1;
        metrics.COOKING.amount += amt;
      } else if (norm === OrderStatuses.Ready) {
        metrics.READY.count += 1;
        metrics.READY.amount += amt;
      } else if (norm === OrderStatuses.Served || norm === OrderStatuses.Delivered) {
        metrics.SERVED.count += 1;
        metrics.SERVED.amount += amt;
      }
    });

    return metrics;
  }, [orders]);

  const renderIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'ChefHat':
        return <ChefHat className={className} />;
      case 'CheckCircle2':
        return <CheckCircle2 className={className} />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className={className} />;
      case 'Receipt':
        return <Receipt className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Pipeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DE8626]/10 text-[#DE8626]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wider">
              Live Order Status Funnel
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#667085] dark:text-[#94A3B8]">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time kitchen & floor lifecycle</span>
          {activeStage !== 'ALL' && (
            <button
              onClick={() => onSelectStage('ALL')}
              className="ml-2 font-bold text-[#DE8626] hover:underline"
            >
              Reset to All ({stageMetrics.ALL.count})
            </button>
          )}
        </div>
      </div>

      {/* Visual Pipeline Funnel Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DashboardPipelineStages.map((stage, idx) => {
          const isSelected = activeStage === stage.key;
          const data = stageMetrics[stage.key] || { count: 0, amount: 0 };
          const hasItems = data.count > 0;

          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onSelectStage(stage.key)}
              className={`relative flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all group ${
                isSelected
                  ? `${stage.borderActive} ${stage.bgActive} shadow-md ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#1B2127] ring-current`
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] hover:border-[#DE8626]/50 hover:shadow-xs'
              }`}
            >
              {/* Top row: Stage Icon & Step indicator */}
              <div className="flex items-center justify-between w-full mb-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-current text-white shadow-xs'
                      : hasItems
                      ? 'bg-black/5 dark:bg-white/5 text-[#1E2930] dark:text-[#F3F4F6]'
                      : 'bg-black/5 dark:bg-white/5 text-[#667085] dark:text-[#94A3B8]'
                  }`}
                  style={{ color: isSelected ? '#FFFFFF' : undefined }}
                >
                  {renderIcon(stage.icon, 'h-4 w-4')}
                </div>

                {/* Counter Badge */}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black transition-colors ${
                    isSelected
                      ? 'bg-white/90 text-[#1E2930] shadow-xs'
                      : hasItems
                      ? 'bg-[#1E2930] dark:bg-[#F3F4F6] text-white dark:text-[#1E2930]'
                      : 'bg-black/5 dark:bg-white/5 text-[#667085] dark:text-[#94A3B8]'
                  }`}
                >
                  {data.count}
                </span>
              </div>

              {/* Stage Title */}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold truncate text-[#1E2930] dark:text-[#F3F4F6]">
                    {stage.shortLabel}
                  </span>
                </div>
                <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] truncate mt-0.5">
                  {stage.label}
                </p>
              </div>

              {/* Amount Sum */}
              <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-[#667085] dark:text-[#94A3B8] font-medium">Vol</span>
                <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{data.amount.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Visual arrow connector on right for desktop */}
              {idx < DashboardPipelineStages.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-[#667085]/30">
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
