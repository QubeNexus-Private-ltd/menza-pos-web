import { OrderMaster } from '@/types/order';

/**
 * Robustly checks if an order has already been settled / paid.
 * Handles case-insensitivity, multiple backend status variations ('Settled', 'Completed', 'Paid', 'Success'),
 * paymentStatus ('PAID', 'SUCCESS', 'Settled'), and settled date timestamps. yes
 */
export function isOrderSettled(order?: OrderMaster | null): boolean {
  if (!order) return false;

  const status = String(order.status || '').toUpperCase().trim();
  const paymentStatus = String(order.paymentStatus || '').toUpperCase().trim();

  // Explicit settled / completed / paid statuses
  if (status === 'SETTLED' || status === 'COMPLETED' || status === 'PAID') {
    return true;
  }

  // Payment status indicating full settlement
  if (paymentStatus === 'PAID' || paymentStatus === 'SUCCESS' || paymentStatus === 'SETTLED') {
    return true;
  }

  // Settled date timestamp set by backend
  if (order.settledDateUtc) {
    return true;
  }

  // Tendered / paid amount equals or exceeds total
  if (
    typeof order.paidAmount === 'number' &&
    typeof order.totalAmount === 'number' &&
    order.totalAmount > 0 &&
    order.paidAmount >= order.totalAmount
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if an order was cancelled.
 */
export function isOrderCancelled(order?: OrderMaster | null): boolean {
  if (!order) return false;
  const status = String(order.status || '').toUpperCase().trim();
  return status === 'CANCELLED' || status === 'CANCELED';
}

/**
 * Checks if an order is currently active and eligible for bill settlement.
 */
export function isOrderAwaitingSettlement(order?: OrderMaster | null): boolean {
  if (!order) return false;
  return !isOrderSettled(order) && !isOrderCancelled(order);
}
