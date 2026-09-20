/**
 * Standardized 5-Stage Kitchen Progress Status Lifecycle
 * Mastered in SQL Server & Cached in Redis
 */
export type KitchenProgressStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'Served';

export interface KitchenProgressStatusModel {
  id: number;
  statusCode: KitchenProgressStatus;
  displayName: string;
  displayOrder: number;
  badgeColor: string;
  iconName: string;
  description: string;
}

export const KITCHEN_PROGRESS_STATUSES: Record<KitchenProgressStatus, KitchenProgressStatusModel> = {
  Pending: {
    id: 1,
    statusCode: 'Pending',
    displayName: 'Pending Confirmation',
    displayOrder: 1,
    badgeColor: '#F59E0B',
    iconName: 'clock',
    description: 'Order placed by diner, pending cashier confirmation or online payment',
  },
  Confirmed: {
    id: 2,
    statusCode: 'Confirmed',
    displayName: 'Order Confirmed',
    displayOrder: 2,
    badgeColor: '#3B82F6',
    iconName: 'check-circle',
    description: 'Order accepted and queued on the Kitchen Display System (KDS)',
  },
  Preparing: {
    id: 3,
    statusCode: 'Preparing',
    displayName: 'In Preparation',
    displayOrder: 3,
    badgeColor: '#F97316',
    iconName: 'flame',
    description: 'Kitchen chef has started preparing the food',
  },
  Ready: {
    id: 4,
    statusCode: 'Ready',
    displayName: 'Ready to Serve',
    displayOrder: 4,
    badgeColor: '#10B981',
    iconName: 'bell',
    description: 'Cooking complete; plated and ready on pass counter for waiter pickup',
  },
  Served: {
    id: 5,
    statusCode: 'Served',
    displayName: 'Served to Table',
    displayOrder: 5,
    badgeColor: '#8B5CF6',
    iconName: 'utensils',
    description: 'Delivered and served to table/customer',
  },
};

export const KITCHEN_PROGRESS_STEPS: KitchenProgressStatus[] = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Served',
];
