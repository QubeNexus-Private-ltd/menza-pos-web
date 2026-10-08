import { apiClient } from '@/lib/api/client';
import {
  ExecutiveDashboardDTO,
  DatewiseSalesSummaryDTO,
  TopSellingItemsReportDTO,
  HourlySalesHeatmapDTO,
} from '@/types/report';

export class ReportService {
  static async getExecutiveDashboard(restaurantId: number): Promise<ExecutiveDashboardDTO | null> {
    try {
      const res = await apiClient.get<ExecutiveDashboardDTO>('/Reports/Dashboard/Executive', {
        params: { restaurantId },
      });
      return res.data;
    } catch {
      return null;
    }
  }

  static async getDatewiseSales(
    restaurantId: number,
    fromDate?: string,
    toDate?: string
  ): Promise<DatewiseSalesSummaryDTO | null> {
    try {
      const res = await apiClient.get<DatewiseSalesSummaryDTO>('/Reports/Sales/Datewise', {
        params: { restaurantId, fromDate, toDate },
      });
      return res.data;
    } catch {
      return null;
    }
  }

  static async getTopSellingItems(
    restaurantId: number,
    fromDate?: string,
    toDate?: string,
    top: number = 10
  ): Promise<TopSellingItemsReportDTO | null> {
    try {
      const res = await apiClient.get<TopSellingItemsReportDTO>('/Reports/Menu/TopSellingItems', {
        params: { restaurantId, fromDate, toDate, top },
      });
      return res.data;
    } catch {
      return null;
    }
  }

  static async getHourlySalesHeatmap(
    restaurantId: number,
    date?: string
  ): Promise<HourlySalesHeatmapDTO | null> {
    try {
      const res = await apiClient.get<HourlySalesHeatmapDTO>('/Reports/Sales/HourlyHeatmap', {
        params: { restaurantId, date },
      });
      return res.data;
    } catch {
      return null;
    }
  }
}
