/**
 * Centralized Visual and Styling Configuration for Order Statuses across Menza.
 */

export interface OrderStatusVisual {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const ORDER_STATUS_CONFIG: Record<string, OrderStatusVisual> = {
  PENDING: {
    label: 'Pending',
    color: '#D97706',
    bg: '#FEF3C7',
    border: 'rgba(217, 119, 6, 0.3)',
  },
  PLACED: {
    label: 'Placed',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: 'rgba(37, 99, 235, 0.3)',
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: 'rgba(37, 99, 235, 0.3)',
  },
  PREPARING: {
    label: 'Preparing',
    color: '#DE8626',
    bg: '#FFF0DE',
    border: 'rgba(222, 134, 38, 0.3)',
  },
  IN_KITCHEN: {
    label: 'In Kitchen',
    color: '#DE8626',
    bg: '#FFF0DE',
    border: 'rgba(222, 134, 38, 0.3)',
  },
  READY: {
    label: 'Ready to Serve',
    color: '#10B981',
    bg: '#ECFDF5',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  SERVED: {
    label: 'Served',
    color: '#059669',
    bg: '#ECFDF5',
    border: 'rgba(5, 150, 105, 0.3)',
  },
  SETTLED: {
    label: 'Settled',
    color: '#047857',
    bg: '#D1FAE5',
    border: 'rgba(4, 120, 87, 0.3)',
  },
  COMPLETED: {
    label: 'Completed',
    color: '#047857',
    bg: '#D1FAE5',
    border: 'rgba(4, 120, 87, 0.3)',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#EF4444',
    bg: '#FEE2E2',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  REJECTED: {
    label: 'Rejected',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: 'rgba(220, 38, 38, 0.3)',
  },
};

export const DEFAULT_ORDER_STATUS_VISUAL: OrderStatusVisual = {
  label: 'Unknown',
  color: '#8C7A6B',
  bg: '#F3F4F6',
  border: '#E7E1DA',
};

export function getOrderStatusVisual(status: string | null | undefined): OrderStatusVisual {
  if (!status) return DEFAULT_ORDER_STATUS_VISUAL;
  const key = status.trim().toUpperCase();
  return ORDER_STATUS_CONFIG[key] || {
    label: status,
    color: '#8C7A6B',
    bg: '#F3F4F6',
    border: '#E7E1DA',
  };
}
