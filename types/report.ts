export interface ExecutiveDashboardDTO {
  restaurantId: number;
  totalRevenue?: number;
  totalOrders?: number;
  averageOrderValue?: number;
  settledOrdersCount?: number;
  pendingOrdersCount?: number;
  dineInRevenue?: number;
  takeawayRevenue?: number;
  deliveryRevenue?: number;
  totalTax?: number;
  totalDiscounts?: number;
  todayGrossSales?: number;
  todayNetSales?: number;
  salesGrowthPercentage?: number;
  todayCompletedOrders?: number;
  todayTotalOrders?: number;
  todayActiveOrders?: number;
  todayCancelledOrders?: number;
  todayAverageOrderValue?: number;
  todayTax?: number;
  todayDiscounts?: number;
}

export interface DatewiseSalesSummaryItem {
  date: string;
  orderCount?: number;
  ordersCount?: number;
  grossSales?: number;
  netSales?: number;
  taxAmount?: number;
  totalTax?: number;
  discountAmount?: number;
  totalDiscount?: number;
}

export interface DatewiseSalesSummaryDTO {
  restaurantId: number;
  fromDate?: string;
  toDate?: string;
  totalSales?: number;
  totalGrossSales?: number;
  totalNetSales?: number;
  totalOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  overallAverageOrderValue?: number;
  totalTax?: number;
  totalDiscount?: number;
  records?: DatewiseSalesSummaryItem[];
  dailyBreakdown?: DatewiseSalesSummaryItem[];
}

export interface TopSellingItem {
  itemId: number;
  itemName: string;
  categoryName?: string;
  quantitySold: number;
  totalRevenue: number;
  contributionPercentage?: number;
}

export interface TopSellingItemsReportDTO {
  restaurantId: number;
  items: TopSellingItem[];
}

export interface HourlySalesBucket {
  hour?: number;
  hourSlot?: string;
  timeSlot?: string;
  orderCount?: number;
  ordersCount?: number;
  revenue?: number;
  totalSales?: number;
}

export interface HourlySalesHeatmapDTO {
  restaurantId: number;
  date?: string;
  buckets?: HourlySalesBucket[];
  hourlySlots?: HourlySalesBucket[];
  peakHourLabel?: string;
  peakHourOrdersCount?: number;
}

export type Report = ExecutiveDashboardDTO;
