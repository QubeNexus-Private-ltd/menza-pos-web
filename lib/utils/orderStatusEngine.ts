/**
 * Canonical Order Status Engine for Menza POS Web
 * Authoritative alignment with F:\MenzaPos (Domain.OrderDomain.OrderStatus)
 * and F:\Menza (TodayOrdersModal).
 */

export const OrderStatuses = {
  PendingPayment: 'PendingPayment',
  Placed: 'Placed',
  Confirmed: 'Confirmed',
  Preparing: 'Preparing',
  Ready: 'Ready',
  Served: 'Served',
  Delivered: 'Delivered',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Settled: 'Settled',
} as const;

export type OrderStatusKey = (typeof OrderStatuses)[keyof typeof OrderStatuses];

export const ActiveOrderStatuses: readonly string[] = [
  OrderStatuses.PendingPayment,
  OrderStatuses.Placed,
  OrderStatuses.Confirmed,
  OrderStatuses.Preparing,
  OrderStatuses.Ready,
  OrderStatuses.Served,
  OrderStatuses.Delivered,
];

export const TerminalOrderStatuses: readonly string[] = [
  OrderStatuses.Completed,
  OrderStatuses.Cancelled,
  OrderStatuses.Settled,
];

/**
 * Normalizes any external or legacy status string into canonical PascalCase key
 */
export function normalizeOrderStatus(rawStatus?: string | null): OrderStatusKey {
  if (!rawStatus || !rawStatus.trim()) return OrderStatuses.Placed;
  const clean = rawStatus.trim().toUpperCase();

  switch (clean) {
    case 'PENDINGPAYMENT':
    case 'PENDING_PAYMENT':
      return OrderStatuses.PendingPayment;
    case 'PLACED':
      return OrderStatuses.Placed;
    case 'CONFIRMED':
    case 'NEW':
      return OrderStatuses.Confirmed;
    case 'PREPARING':
    case 'COOKING':
    case 'IN_PROGRESS':
      return OrderStatuses.Preparing;
    case 'READY':
      return OrderStatuses.Ready;
    case 'SERVED':
      return OrderStatuses.Served;
    case 'DELIVERED':
    case 'PICKED_UP':
      return OrderStatuses.Delivered;
    case 'COMPLETED':
      return OrderStatuses.Completed;
    case 'CANCELLED':
    case 'VOID':
    case 'VOIDED':
      return OrderStatuses.Cancelled;
    case 'SETTLED':
    case 'PAID':
      return OrderStatuses.Settled;
    default:
      return OrderStatuses.Placed;
  }
}

export function isStatusActive(status?: string | null): boolean {
  const norm = normalizeOrderStatus(status);
  return ActiveOrderStatuses.includes(norm);
}

export function isStatusTerminal(status?: string | null): boolean {
  const norm = normalizeOrderStatus(status);
  return TerminalOrderStatuses.includes(norm);
}

/**
 * Authoritative settlement check matching F:\MenzaPos OrderDTO.IsSettled
 * Returns true if the order is settled or paid by any financial or lifecycle signal.
 */
export function isOrderSettled(order?: Partial<any> | null): boolean {
  if (!order) return false;

  const rawStatus =
    order.status ??
    order.orderStatus ??
    order.OrderStatus ??
    order.Status;

  const norm = normalizeOrderStatus(rawStatus);
  if (norm === OrderStatuses.Cancelled) return false;

  // 1. Explicit Settled or Completed status
  if (norm === OrderStatuses.Settled || norm === OrderStatuses.Completed) return true;

  // 2. Check Payment Status (PAID or SUCCESS)
  const pay = String(
    order.paymentStatus ??
    order.PaymentStatus ??
    order.payment_status ??
    ''
  ).trim().toUpperCase();

  if (pay === 'PAID' || pay === 'SUCCESS') return true;

  // 3. Check SettledDateUtc
  const settledDate =
    order.settledDateUtc ??
    order.SettledDateUtc ??
    order.settled_date_utc;
  if (Boolean(settledDate)) return true;

  // 4. Check SettledBy
  const settledBy =
    order.settledBy ??
    order.SettledBy ??
    order.settled_by;
  if (Boolean(settledBy) && Number(settledBy) > 0) return true;

  // 5. Check Paid Amount >= Total Amount
  const total = Number(order.totalAmount ?? order.TotalAmount ?? 0);
  const paid = Number(order.paidAmount ?? order.PaidAmount ?? 0);
  if (total > 0 && paid >= total) return true;

  return false;
}

/**
 * Validates transition from current status to target status
 * Enforces MenzaPOS.Domain.OrderStatuses.CanTransition state machine
 */
export function canTransitionOrderStatus(current?: string | null, target?: string | null): boolean {
  if (!current || !target) return false;
  const cur = normalizeOrderStatus(current);
  const tgt = normalizeOrderStatus(target);

  if (cur === tgt) return true;

  // Terminal states cannot be transitioned further
  if (TerminalOrderStatuses.includes(cur)) return false;

  // Any active order can be cancelled
  if (tgt === OrderStatuses.Cancelled) return true;

  switch (cur) {
    case OrderStatuses.PendingPayment:
      return tgt === OrderStatuses.Placed || tgt === OrderStatuses.Confirmed;

    case OrderStatuses.Placed:
      return tgt === OrderStatuses.Confirmed || tgt === OrderStatuses.Preparing;

    case OrderStatuses.Confirmed:
      return tgt === OrderStatuses.Preparing || tgt === OrderStatuses.Ready;

    case OrderStatuses.Preparing:
      return tgt === OrderStatuses.Ready;

    case OrderStatuses.Ready:
      return (
        tgt === OrderStatuses.Served ||
        tgt === OrderStatuses.Delivered ||
        tgt === OrderStatuses.Completed ||
        tgt === OrderStatuses.Settled
      );

    case OrderStatuses.Served:
    case OrderStatuses.Delivered:
      return tgt === OrderStatuses.Completed || tgt === OrderStatuses.Settled;

    default:
      return false;
  }
}

/**
 * Calculates the next logical progression status based on order type
 */
export function getNextRecommendedStatus(
  currentStatus?: string | null,
  orderTypeName?: string | null,
  tableId?: number | null
): { nextStatus: OrderStatusKey; actionLabel: string; buttonColor: string } | null {
  const cur = normalizeOrderStatus(currentStatus);
  const isDineIn =
    Boolean(tableId) ||
    (orderTypeName && ['DINE-IN', 'DINE_IN', 'TABLE'].includes(orderTypeName.toUpperCase()));

  switch (cur) {
    case OrderStatuses.PendingPayment:
      return {
        nextStatus: OrderStatuses.Placed,
        actionLabel: 'Accept & Place',
        buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
      };

    case OrderStatuses.Placed:
      return {
        nextStatus: OrderStatuses.Preparing,
        actionLabel: 'Send to Kitchen (Cook)',
        buttonColor: 'bg-amber-600 hover:bg-amber-700 text-white',
      };

    case OrderStatuses.Confirmed:
      return {
        nextStatus: OrderStatuses.Preparing,
        actionLabel: 'Start Cooking',
        buttonColor: 'bg-amber-600 hover:bg-amber-700 text-white',
      };

    case OrderStatuses.Preparing:
      return {
        nextStatus: OrderStatuses.Ready,
        actionLabel: 'Mark Dishes Ready',
        buttonColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      };

    case OrderStatuses.Ready:
      if (isDineIn) {
        return {
          nextStatus: OrderStatuses.Served,
          actionLabel: 'Mark Served to Table',
          buttonColor: 'bg-teal-600 hover:bg-teal-700 text-white',
        };
      } else {
        return {
          nextStatus: OrderStatuses.Delivered,
          actionLabel: 'Handover / Delivered',
          buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
      }

    case OrderStatuses.Served:
    case OrderStatuses.Delivered:
      return {
        nextStatus: OrderStatuses.Settled,
        actionLabel: 'Collect & Settle Bill',
        buttonColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      };

    default:
      return null;
  }
}

export interface StatusBadgeConfig {
  key: OrderStatusKey;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

export function getOrderStatusBadge(status?: string | null): StatusBadgeConfig {
  const norm = normalizeOrderStatus(status);

  switch (norm) {
    case OrderStatuses.PendingPayment:
      return {
        key: norm,
        label: 'Pending Payment',
        bgClass: 'bg-yellow-500/10 dark:bg-yellow-500/20',
        textClass: 'text-yellow-700 dark:text-yellow-400',
        borderClass: 'border-yellow-500/30',
        dotClass: 'bg-yellow-500',
      };
    case OrderStatuses.Placed:
      return {
        key: norm,
        label: 'Placed (New)',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
        textClass: 'text-[#DE8626] dark:text-amber-400',
        borderClass: 'border-[#DE8626]/30',
        dotClass: 'bg-[#DE8626]',
      };
    case OrderStatuses.Confirmed:
      return {
        key: norm,
        label: 'Confirmed',
        bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
        textClass: 'text-blue-700 dark:text-blue-400',
        borderClass: 'border-blue-500/30',
        dotClass: 'bg-blue-500',
      };
    case OrderStatuses.Preparing:
      return {
        key: norm,
        label: 'Cooking (Kitchen)',
        bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
        textClass: 'text-orange-700 dark:text-orange-400',
        borderClass: 'border-orange-500/30',
        dotClass: 'bg-orange-500 animate-pulse',
      };
    case OrderStatuses.Ready:
      return {
        key: norm,
        label: 'Ready on Pass',
        bgClass: 'bg-emerald-500/15 dark:bg-emerald-500/25',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        borderClass: 'border-emerald-500/40',
        dotClass: 'bg-emerald-500 animate-ping',
      };
    case OrderStatuses.Served:
      return {
        key: norm,
        label: 'Served (Needs Bill)',
        bgClass: 'bg-teal-500/10 dark:bg-teal-500/20',
        textClass: 'text-teal-700 dark:text-teal-400',
        borderClass: 'border-teal-500/30',
        dotClass: 'bg-teal-500',
      };
    case OrderStatuses.Delivered:
      return {
        key: norm,
        label: 'Delivered',
        bgClass: 'bg-cyan-500/10 dark:bg-cyan-500/20',
        textClass: 'text-cyan-700 dark:text-cyan-400',
        borderClass: 'border-cyan-500/30',
        dotClass: 'bg-cyan-500',
      };
    case OrderStatuses.Completed:
      return {
        key: norm,
        label: 'Completed',
        bgClass: 'bg-gray-500/10 dark:bg-gray-500/20',
        textClass: 'text-gray-700 dark:text-gray-300',
        borderClass: 'border-gray-500/30',
        dotClass: 'bg-gray-500',
      };
    case OrderStatuses.Settled:
      return {
        key: norm,
        label: 'Settled (Paid)',
        bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        borderClass: 'border-emerald-500/30',
        dotClass: 'bg-emerald-500',
      };
    case OrderStatuses.Cancelled:
      return {
        key: norm,
        label: 'Cancelled (Void)',
        bgClass: 'bg-red-500/10 dark:bg-red-500/20',
        textClass: 'text-red-700 dark:text-red-400',
        borderClass: 'border-red-500/30',
        dotClass: 'bg-red-500',
      };
    default:
      return {
        key: OrderStatuses.Placed,
        label: norm,
        bgClass: 'bg-gray-500/10 dark:bg-gray-500/20',
        textClass: 'text-gray-700 dark:text-gray-400',
        borderClass: 'border-gray-500/30',
        dotClass: 'bg-gray-500',
      };
  }
}

/**
 * High-level Funnel Stages for Overview Dashboard Pipeline
 */
export type PipelineStageKey = 'ALL' | 'NEW' | 'COOKING' | 'READY' | 'SERVED' | 'SETTLED' | 'CANCELLED';

export interface PipelineStageConfig {
  key: PipelineStageKey;
  label: string;
  shortLabel: string;
  icon: string;
  accentColor: string;
  borderActive: string;
  bgActive: string;
  matchingStatuses: readonly string[];
}

export const DashboardPipelineStages: readonly PipelineStageConfig[] = [
  {
    key: 'ALL',
    label: 'All Active Queue',
    shortLabel: 'All Active',
    icon: 'Layers',
    accentColor: '#DE8626',
    borderActive: 'border-[#DE8626]',
    bgActive: 'bg-[#DE8626]/10 text-[#DE8626]',
    matchingStatuses: ActiveOrderStatuses,
  },
  {
    key: 'NEW',
    label: 'New Orders',
    shortLabel: 'Placed',
    icon: 'Sparkles',
    accentColor: '#3B82F6',
    borderActive: 'border-blue-500',
    bgActive: 'bg-blue-500/10 text-blue-600',
    matchingStatuses: [OrderStatuses.PendingPayment, OrderStatuses.Placed, OrderStatuses.Confirmed],
  },
  {
    key: 'COOKING',
    label: 'In Kitchen',
    shortLabel: 'Cooking',
    icon: 'ChefHat',
    accentColor: '#F97316',
    borderActive: 'border-orange-500',
    bgActive: 'bg-orange-500/10 text-orange-600',
    matchingStatuses: [OrderStatuses.Preparing],
  },
  {
    key: 'READY',
    label: 'Ready on Pass',
    shortLabel: 'Ready',
    icon: 'CheckCircle2',
    accentColor: '#10B981',
    borderActive: 'border-emerald-500',
    bgActive: 'bg-emerald-500/10 text-emerald-600',
    matchingStatuses: [OrderStatuses.Ready],
  },
  {
    key: 'SERVED',
    label: 'Served / Delivered',
    shortLabel: 'Served',
    icon: 'UtensilsCrossed',
    accentColor: '#0D9488',
    borderActive: 'border-teal-500',
    bgActive: 'bg-teal-500/10 text-teal-600',
    matchingStatuses: [OrderStatuses.Served, OrderStatuses.Delivered],
  },
  {
    key: 'SETTLED',
    label: 'Settled & Paid',
    shortLabel: 'Settled',
    icon: 'Receipt',
    accentColor: '#059669',
    borderActive: 'border-emerald-600',
    bgActive: 'bg-emerald-600/10 text-emerald-700',
    matchingStatuses: [OrderStatuses.Settled, OrderStatuses.Completed],
  },
];
