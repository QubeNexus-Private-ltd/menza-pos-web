import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import {
  ExecutiveDashboard,
  DatewiseSalesSummary,
  TopSellingItemsReport,
} from '../../domain/models/Report';

export interface GenerateBusinessReportPdfOptions {
  restaurantName: string;
  restaurantId: number;
  outletAddress?: string;
  periodLabel: string;
  fromDate?: string;
  toDate?: string;
  executiveData: ExecutiveDashboard | null;
  salesSummary: DatewiseSalesSummary | null;
  topItems: TopSellingItemsReport | null;
  generatedBy?: string;
}

export class PdfReportGenerator {
  /**
   * Generates a polished HTML report document for business analytics
   */
  static generateReportHtml(options: GenerateBusinessReportPdfOptions): string {
    const {
      restaurantName,
      restaurantId,
      outletAddress,
      periodLabel,
      fromDate,
      toDate,
      executiveData,
      salesSummary,
      topItems,
      generatedBy,
    } = options;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const grossSales = salesSummary?.totalGrossSales ?? executiveData?.todayGrossSales ?? 0;
    const netSales = salesSummary?.totalNetSales ?? executiveData?.todayNetSales ?? 0;
    const totalOrders = salesSummary?.totalOrders ?? executiveData?.todayTotalOrders ?? 0;
    const completedOrders = salesSummary?.completedOrders ?? executiveData?.todayCompletedOrders ?? 0;
    const cancelledOrders = salesSummary?.cancelledOrders ?? executiveData?.todayCancelledOrders ?? 0;
    const aov = salesSummary?.overallAverageOrderValue ?? executiveData?.todayAverageOrderValue ?? 0;
    const tax = salesSummary?.totalTax ?? executiveData?.todayTax ?? 0;
    const commission = salesSummary?.totalCommissionDeducted ?? executiveData?.todayCommissionDeducted ?? 0;
    const fulfillmentRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '100.0';

    const dailyRows = (salesSummary?.dailyBreakdown || [])
      .map((day, index) => {
        return `
          <tr style="border-bottom: 1px solid #E7E1DA;">
            <td style="padding: 9px 8px; font-size: 11px; text-align: center; color: #78716C;">${index + 1}</td>
            <td style="padding: 9px 8px; font-size: 11px; font-weight: 700; color: #1F2937;">${day.date}</td>
            <td style="padding: 9px 8px; font-size: 11px; text-align: center; color: #17845A; font-weight: 700;">${day.completedOrders}</td>
            <td style="padding: 9px 8px; font-size: 11px; text-align: center; color: ${day.cancelledOrders > 0 ? '#DC2626' : '#78716C'};">${day.cancelledOrders}</td>
            <td style="padding: 9px 8px; font-size: 11px; text-align: right; color: #1F2937; font-weight: 800;">₹${day.grossSales.toLocaleString('en-IN')}</td>
            <td style="padding: 9px 8px; font-size: 11px; text-align: right; color: #D96B14; font-weight: 700;">₹${Math.round(day.averageOrderValue)}</td>
          </tr>
        `;
      })
      .join('');

    const dishRows = (topItems?.items || [])
      .map((dish, index) => {
        const medalColor = index === 0 ? '#DE8626' : index === 1 ? '#8C7A6B' : index === 2 ? '#B45309' : '#1F2937';
        return `
          <tr style="border-bottom: 1px solid #E7E1DA;">
            <td style="padding: 8px; font-size: 11px; text-align: center; font-weight: 800; color: ${medalColor};">#${index + 1}</td>
            <td style="padding: 8px; font-size: 11px; font-weight: 700; color: #1F2937;">${dish.itemName}</td>
            <td style="padding: 8px; font-size: 10px; color: #78716C;">
              <span style="background: #FFF0DE; color: #D96B14; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${dish.categoryName || 'General'}</span>
            </td>
            <td style="padding: 8px; font-size: 11px; text-align: center; font-weight: 700; color: #1F2937;">${dish.quantitySold}</td>
            <td style="padding: 8px; font-size: 11px; text-align: right; font-weight: 800; color: #17845A;">₹${dish.totalRevenue.toLocaleString('en-IN')}</td>
            <td style="padding: 8px; font-size: 11px; text-align: right; font-weight: 700; color: #DE8626;">${dish.contributionPercentage.toFixed(1)}%</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Menza Business Analytics Report - ${restaurantName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FAF7F2;
            color: #1F2937;
            padding: 26px 20px;
            font-size: 12px;
            line-height: 1.4;
          }
          .report-container {
            max-width: 820px;
            margin: 0 auto;
            background: #FFFFFF;
            border-radius: 12px;
            border: 1.5px solid #E7E1DA;
            padding: 26px;
            box-shadow: 0 4px 16px rgba(60, 47, 0, 0.06);
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #DE8626;
            padding-bottom: 16px;
            margin-bottom: 18px;
          }
          .brand-logo-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-badge {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #DE8626, #CB741B);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            font-size: 20px;
            font-weight: 900;
          }
          .brand-title {
            font-size: 19px;
            font-weight: 800;
            color: #1F2937;
          }
          .brand-subtitle {
            font-size: 11px;
            color: #78716C;
            font-weight: 600;
          }
          .report-tag {
            text-align: right;
          }
          .report-badge {
            background-color: #FFF0DE;
            border: 1px solid rgba(222, 134, 38, 0.4);
            color: #D96B14;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            display: inline-block;
            margin-bottom: 4px;
          }
          .meta-text {
            font-size: 10px;
            color: #78716C;
          }
          .period-banner {
            background-color: #FAF7F2;
            border: 1px solid #E7E1DA;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .bento-metrics {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 22px;
          }
          .bento-card {
            background-color: #FAF7F2;
            border: 1px solid #E7E1DA;
            border-radius: 8px;
            padding: 12px 10px;
            text-align: center;
          }
          .bento-label {
            font-size: 9px;
            font-weight: 800;
            color: #78716C;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .bento-value {
            font-size: 16px;
            font-weight: 900;
            color: #1F2937;
          }
          .bento-value.highlight { color: #DE8626; }
          .bento-value.green { color: #17845A; }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            color: #1F2937;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #E7E1DA;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #FAF7F2;
            color: #5C4E3D;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 8px;
            border-bottom: 1.5px solid #E7E1DA;
            border-top: 1px solid #E7E1DA;
          }
          .footer-section {
            border-top: 1px solid #E7E1DA;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #78716C;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <!-- Header -->
          <div class="header-row">
            <div class="brand-logo-title">
              <div class="logo-badge">M</div>
              <div>
                <div class="brand-title">${restaurantName}</div>
                <div class="brand-subtitle">Executive Business Analytics Report • Outlet #${restaurantId}</div>
              </div>
            </div>
            <div class="report-tag">
              <div class="report-badge">Business Analytics</div>
              <div class="meta-text">Generated: ${formattedDate} at ${formattedTime}</div>
              ${generatedBy ? `<div class="meta-text">Generated By: ${generatedBy}</div>` : ''}
            </div>
          </div>

          <!-- Period Banner -->
          <div class="period-banner">
            <div>
              <strong>Reporting Timeframe:</strong> ${periodLabel}
              ${fromDate && toDate ? `<span style="color: #78716C;"> (${fromDate} to ${toDate})</span>` : ''}
            </div>
            <div>
              <strong>Order Fulfillment:</strong> <span style="color: #17845A; font-weight: 800;">${fulfillmentRate}%</span>
            </div>
          </div>

          <!-- Bento Grid -->
          <div class="bento-metrics">
            <div class="bento-card" style="background: #FFFDF9; border-color: rgba(222, 134, 38, 0.4);">
              <div class="bento-label">Gross Revenue</div>
              <div class="bento-value highlight">₹${grossSales.toLocaleString('en-IN')}</div>
            </div>
            <div class="bento-card">
              <div class="bento-label">Net Sales (Post-Tax)</div>
              <div class="bento-value green">₹${netSales.toLocaleString('en-IN')}</div>
            </div>
            <div class="bento-card">
              <div class="bento-label">Total Orders</div>
              <div class="bento-value">${totalOrders} (${completedOrders} settled)</div>
            </div>
            <div class="bento-card">
              <div class="bento-label">Average Ticket (AOV)</div>
              <div class="bento-value">₹${Math.round(aov)}</div>
            </div>
          </div>

          <!-- Daily Breakdown Table -->
          ${
            dailyRows
              ? `
              <div class="section-title">Daily Financial Timeline</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 30px; text-align: center;">#</th>
                    <th style="text-align: left;">Date</th>
                    <th style="width: 80px; text-align: center;">Completed</th>
                    <th style="width: 70px; text-align: center;">Cancelled</th>
                    <th style="width: 110px; text-align: right;">Gross Sales</th>
                    <th style="width: 90px; text-align: right;">Avg Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  ${dailyRows}
                </tbody>
              </table>
            `
              : ''
          }

          <!-- Top Selling Menu Items Table -->
          ${
            dishRows
              ? `
              <div class="section-title">Top Selling Menu Items</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 35px; text-align: center;">Rank</th>
                    <th style="text-align: left;">Dish Name</th>
                    <th style="width: 100px; text-align: left;">Category</th>
                    <th style="width: 80px; text-align: center;">Qty Sold</th>
                    <th style="width: 110px; text-align: right;">Revenue</th>
                    <th style="width: 80px; text-align: right;">Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${dishRows}
                </tbody>
              </table>
            `
              : ''
          }

          <!-- Footer -->
          <div class="footer-section">
            <div>
              <strong>Menza Hospitality SaaS</strong> • Multi-Outlet POS & Intelligence Platform<br />
              This is an official computer-generated business analytics document.
            </div>
            <div style="color: #17845A; font-weight: 700;">
              ✓ Verified Store Telemetry
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates and exports/shares the Business Report as a PDF
   */
  static async exportAndShareReportPdf(options: GenerateBusinessReportPdfOptions): Promise<{ success: boolean; uri?: string }> {
    try {
      const html = this.generateReportHtml(options);
      const fileName = `Menza_Business_Report_${options.restaurantId}_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return { success: true };
      }

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Export ${fileName}`,
        });
      } else {
        Alert.alert('Report PDF Generated', `Business report PDF saved at:\n${uri}`);
      }

      return { success: true, uri };
    } catch (error: any) {
      console.error('Failed to export business report PDF:', error);
      throw new Error(error?.message || 'Could not export report into PDF.');
    }
  }
}
