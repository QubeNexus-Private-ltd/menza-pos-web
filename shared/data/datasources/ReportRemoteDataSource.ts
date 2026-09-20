import { apiClient } from '../../core/network/apiClient';
import {
  ExecutiveDashboard,
  DatewiseSalesSummary,
  TopSellingItemsReport,
  HourlySalesHeatmap,
} from '../../domain/models/Report';

export class ReportRemoteDataSource {
  /**
   * GET /api/Reports/Dashboard/Executive?restaurantId={id}
   */
  async getExecutiveDashboard(restaurantId: number): Promise<ExecutiveDashboard> {
    const response = await apiClient.get('/Reports/Dashboard/Executive', {
      params: { restaurantId },
      headers: { 'X-Restaurant-Id': restaurantId.toString() },
    });
    const d = response.data;
    return {
      restaurantId: Number(d?.restaurantId ?? d?.RestaurantId ?? restaurantId),
      date: String(d?.date ?? d?.Date ?? ''),
      todayGrossSales: Number(d?.todayGrossSales ?? d?.TodayGrossSales ?? 0),
      todayNetSales: Number(d?.todayNetSales ?? d?.TodayNetSales ?? 0),
      todayTax: Number(d?.todayTax ?? d?.TodayTax ?? 0),
      todayDiscounts: Number(d?.todayDiscounts ?? d?.TodayDiscounts ?? 0),
      todayCommissionDeducted: Number(d?.todayCommissionDeducted ?? d?.TodayCommissionDeducted ?? 0),
      todayTotalOrders: Number(d?.todayTotalOrders ?? d?.TodayTotalOrders ?? 0),
      todayCompletedOrders: Number(d?.todayCompletedOrders ?? d?.TodayCompletedOrders ?? 0),
      todayActiveOrders: Number(d?.todayActiveOrders ?? d?.TodayActiveOrders ?? 0),
      todayCancelledOrders: Number(d?.todayCancelledOrders ?? d?.TodayCancelledOrders ?? 0),
      todayAverageOrderValue: Number(d?.todayAverageOrderValue ?? d?.TodayAverageOrderValue ?? 0),
      yesterdayGrossSales: Number(d?.yesterdayGrossSales ?? d?.YesterdayGrossSales ?? 0),
      yesterdayTotalOrders: Number(d?.yesterdayTotalOrders ?? d?.YesterdayTotalOrders ?? 0),
      yesterdayCompletedOrders: Number(d?.yesterdayCompletedOrders ?? d?.YesterdayCompletedOrders ?? 0),
      salesGrowthPercentage: Number(d?.salesGrowthPercentage ?? d?.SalesGrowthPercentage ?? 0),
      thisWeekGrossSales: Number(d?.thisWeekGrossSales ?? d?.ThisWeekGrossSales ?? 0),
      thisMonthGrossSales: Number(d?.thisMonthGrossSales ?? d?.ThisMonthGrossSales ?? 0),
      livePipeline: {
        pending: Number(d?.livePipeline?.pending ?? d?.LivePipeline?.Pending ?? 0),
        confirmed: Number(d?.livePipeline?.confirmed ?? d?.LivePipeline?.Confirmed ?? 0),
        inPreparation: Number(d?.livePipeline?.inPreparation ?? d?.LivePipeline?.InPreparation ?? 0),
        ready: Number(d?.livePipeline?.ready ?? d?.LivePipeline?.Ready ?? 0),
        served: Number(d?.livePipeline?.served ?? d?.LivePipeline?.Served ?? 0),
      },
    };
  }

  /**
   * GET /api/Reports/Sales/Datewise?restaurantId={id}&fromDate={}&toDate={}
   */
  async getDatewiseSalesSummary(
    restaurantId: number,
    fromDate?: string,
    toDate?: string
  ): Promise<DatewiseSalesSummary> {
    const params: Record<string, any> = { restaurantId };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;

    const response = await apiClient.get('/Reports/Sales/Datewise', {
      params,
      headers: { 'X-Restaurant-Id': restaurantId.toString() },
    });
    const d = response.data;
    const dailyRaw = d?.dailyBreakdown || d?.DailyBreakdown || [];

    return {
      restaurantId: Number(d?.restaurantId ?? d?.RestaurantId ?? restaurantId),
      fromDate: String(d?.fromDate ?? d?.FromDate ?? ''),
      toDate: String(d?.toDate ?? d?.ToDate ?? ''),
      totalGrossSales: Number(d?.totalGrossSales ?? d?.TotalGrossSales ?? 0),
      totalNetSales: Number(d?.totalNetSales ?? d?.TotalNetSales ?? 0),
      totalTax: Number(d?.totalTax ?? d?.TotalTax ?? 0),
      totalDiscount: Number(d?.totalDiscount ?? d?.TotalDiscount ?? 0),
      totalCommissionDeducted: Number(d?.totalCommissionDeducted ?? d?.TotalCommissionDeducted ?? 0),
      totalOrders: Number(d?.totalOrders ?? d?.TotalOrders ?? 0),
      completedOrders: Number(d?.completedOrders ?? d?.CompletedOrders ?? 0),
      cancelledOrders: Number(d?.cancelledOrders ?? d?.CancelledOrders ?? 0),
      overallAverageOrderValue: Number(d?.overallAverageOrderValue ?? d?.OverallAverageOrderValue ?? 0),
      dailyBreakdown: dailyRaw.map((day: any) => ({
        date: String(day?.date ?? day?.Date ?? ''),
        grossSales: Number(day?.grossSales ?? day?.GrossSales ?? 0),
        netSales: Number(day?.netSales ?? day?.NetSales ?? 0),
        taxAmount: Number(day?.taxAmount ?? day?.TaxAmount ?? 0),
        discountAmount: Number(day?.discountAmount ?? day?.DiscountAmount ?? 0),
        commissionDeducted: Number(day?.commissionDeducted ?? day?.CommissionDeducted ?? 0),
        totalOrders: Number(day?.totalOrders ?? day?.TotalOrders ?? 0),
        completedOrders: Number(day?.completedOrders ?? day?.CompletedOrders ?? 0),
        cancelledOrders: Number(day?.cancelledOrders ?? day?.CancelledOrders ?? 0),
        averageOrderValue: Number(day?.averageOrderValue ?? day?.AverageOrderValue ?? 0),
      })),
    };
  }

  /**
   * GET /api/Reports/Menu/TopSellingItems?restaurantId={id}&fromDate={}&toDate={}&top={top}
   */
  async getTopSellingItems(
    restaurantId: number,
    fromDate?: string,
    toDate?: string,
    top: number = 10
  ): Promise<TopSellingItemsReport> {
    const params: Record<string, any> = { restaurantId, top };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;

    const response = await apiClient.get('/Reports/Menu/TopSellingItems', {
      params,
      headers: { 'X-Restaurant-Id': restaurantId.toString() },
    });
    const d = response.data;
    const itemsRaw = d?.items || d?.Items || [];

    return {
      restaurantId: Number(d?.restaurantId ?? d?.RestaurantId ?? restaurantId),
      fromDate: String(d?.fromDate ?? d?.FromDate ?? ''),
      toDate: String(d?.toDate ?? d?.ToDate ?? ''),
      totalMenuRevenue: Number(d?.totalMenuRevenue ?? d?.TotalMenuRevenue ?? 0),
      totalItemsSold: Number(d?.totalItemsSold ?? d?.TotalItemsSold ?? 0),
      items: itemsRaw.map((it: any) => ({
        itemId: Number(it?.itemId ?? it?.ItemId ?? 0),
        itemName: String(it?.itemName ?? it?.ItemName ?? 'Dish Item'),
        categoryName: String(it?.categoryName ?? it?.CategoryName ?? 'General'),
        quantitySold: Number(it?.quantitySold ?? it?.QuantitySold ?? 0),
        totalRevenue: Number(it?.totalRevenue ?? it?.TotalRevenue ?? 0),
        contributionPercentage: Number(it?.contributionPercentage ?? it?.ContributionPercentage ?? 0),
      })),
    };
  }

  /**
   * GET /api/Reports/Sales/HourlyHeatmap?restaurantId={id}&date={}
   */
  async getHourlySalesHeatmap(
    restaurantId: number,
    date?: string
  ): Promise<HourlySalesHeatmap> {
    const params: Record<string, any> = { restaurantId };
    if (date) params.date = date;

    const response = await apiClient.get('/Reports/Sales/HourlyHeatmap', {
      params,
      headers: { 'X-Restaurant-Id': restaurantId.toString() },
    });
    const d = response.data;
    const slotsRaw = d?.hourlySlots || d?.HourlySlots || [];

    return {
      restaurantId: Number(d?.restaurantId ?? d?.RestaurantId ?? restaurantId),
      date: String(d?.date ?? d?.Date ?? ''),
      totalDaySales: Number(d?.totalDaySales ?? d?.TotalDaySales ?? 0),
      totalDayOrders: Number(d?.totalDayOrders ?? d?.TotalDayOrders ?? 0),
      peakHourLabel: String(d?.peakHourLabel ?? d?.PeakHourLabel ?? ''),
      peakHourOrdersCount: Number(d?.peakHourOrdersCount ?? d?.PeakHourOrdersCount ?? 0),
      peakHourSales: Number(d?.peakHourSales ?? d?.PeakHourSales ?? 0),
      hourlySlots: slotsRaw.map((slot: any) => ({
        hour: Number(slot?.hour ?? slot?.Hour ?? 0),
        hourLabel: String(slot?.hourLabel ?? slot?.HourLabel ?? `${slot?.hour ?? 0}:00`),
        ordersCount: Number(slot?.ordersCount ?? slot?.OrdersCount ?? 0),
        totalSales: Number(slot?.totalSales ?? slot?.TotalSales ?? 0),
        completedOrders: Number(slot?.completedOrders ?? slot?.CompletedOrders ?? 0),
      })),
    };
  }
}
