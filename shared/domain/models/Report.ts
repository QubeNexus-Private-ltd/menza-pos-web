export interface LivePipelineStatus {
  pending: number;
  confirmed: number;
  inPreparation: number;
  ready: number;
  served: number;
}

export interface ExecutiveDashboard {
  restaurantId: number;
  date: string;

  // Today's Sales Metrics
  todayGrossSales: number;
  todayNetSales: number;
  todayTax: number;
  todayDiscounts: number;
  todayCommissionDeducted: number;

  // Today's Order Counts
  todayTotalOrders: number;
  todayCompletedOrders: number;
  todayActiveOrders: number;
  todayCancelledOrders: number;
  todayAverageOrderValue: number;

  // Yesterday's Comparison
  yesterdayGrossSales: number;
  yesterdayTotalOrders: number;
  yesterdayCompletedOrders: number;
  salesGrowthPercentage: number;

  // Period Totals
  thisWeekGrossSales: number;
  thisMonthGrossSales: number;

  // Live Pipeline
  livePipeline: LivePipelineStatus;
}

export interface DailySalesMetric {
  date: string;
  grossSales: number;
  netSales: number;
  taxAmount: number;
  discountAmount: number;
  commissionDeducted: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

export interface DatewiseSalesSummary {
  restaurantId: number;
  fromDate: string;
  toDate: string;
  totalGrossSales: number;
  totalNetSales: number;
  totalTax: number;
  totalDiscount: number;
  totalCommissionDeducted: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  overallAverageOrderValue: number;
  dailyBreakdown: DailySalesMetric[];
}

export interface TopSellingItem {
  itemId: number;
  itemName: string;
  categoryName: string;
  quantitySold: number;
  totalRevenue: number;
  contributionPercentage: number;
}

export interface TopSellingItemsReport {
  restaurantId: number;
  fromDate: string;
  toDate: string;
  totalMenuRevenue: number;
  totalItemsSold: number;
  items: TopSellingItem[];
}

export interface HourlySalesSlot {
  hour: number;
  hourLabel: string;
  ordersCount: number;
  totalSales: number;
  completedOrders: number;
}

export interface HourlySalesHeatmap {
  restaurantId: number;
  date: string;
  totalDaySales: number;
  totalDayOrders: number;
  peakHourLabel: string;
  peakHourOrdersCount: number;
  peakHourSales: number;
  hourlySlots: HourlySalesSlot[];
}
