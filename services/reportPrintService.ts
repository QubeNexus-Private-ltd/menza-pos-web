/**
 * Report Print Service
 * Provides isolated, print-optimized document generators and dispatchers
 * for Consolidated Business Ledgers, Daily Sales Statements, Cashier Payment
 * Settlements, Hourly Shift Operations, and Menu Item Dish Performance.
 */

import {
  ExecutiveDashboard,
  DatewiseSalesSummary,
  TopSellingItemsReport,
  HourlySalesHeatmap,
} from '@shared/domain/models/Report';
import { PaymentModeMetric } from '@/components/analytics/PaymentBreakdownChart';

export interface ReportRestaurantMetadata {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  gstin?: string;
  logoUrl?: string;
}

export interface ConsolidatedReportData {
  restaurant: ReportRestaurantMetadata;
  periodLabel: string;
  fromDate?: string;
  toDate?: string;
  generatedBy?: string;
  dashboard: ExecutiveDashboard | null;
  salesSummary: DatewiseSalesSummary | null;
  topItems: TopSellingItemsReport | null;
  heatmap: HourlySalesHeatmap | null;
  paymentBreakdown: {
    metrics: PaymentModeMetric[];
    grandTotal: number;
    totalCount: number;
  };
}

export interface DailySalesLedgerData {
  restaurant: ReportRestaurantMetadata;
  periodLabel: string;
  fromDate?: string;
  toDate?: string;
  generatedBy?: string;
  salesSummary: DatewiseSalesSummary | null;
  dashboard: ExecutiveDashboard | null;
}

export interface HourlyRushReportData {
  restaurant: ReportRestaurantMetadata;
  dateLabel: string;
  generatedBy?: string;
  heatmap: HourlySalesHeatmap | null;
}

export interface PaymentSettlementData {
  restaurant: ReportRestaurantMetadata;
  dateLabel: string;
  generatedBy?: string;
  metrics: PaymentModeMetric[];
  grandTotal: number;
  totalCount: number;
  isThermal?: boolean;
}

export interface MenuItemLedgerData {
  restaurant: ReportRestaurantMetadata;
  periodLabel: string;
  fromDate?: string;
  toDate?: string;
  generatedBy?: string;
  topItems: TopSellingItemsReport | null;
}

/**
 * Dispatches an HTML document to an isolated invisible iframe for printing.
 * Keeps the main React web app completely untouched.
 */
export function dispatchHtmlPrint(html: string, title: string = 'Report'): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    try {
      const iframeId = '__menza_report_print_frame__';
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      iframe.setAttribute('aria-hidden', 'true');

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        throw new Error('Could not access print frame document');
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      let printed = false;
      const doPrint = () => {
        if (printed) return;
        printed = true;
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
          resolve(true);
        } catch (e) {
          console.warn('Report print iframe error:', e);
          resolve(false);
        } finally {
          setTimeout(() => {
            if (iframe && iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 2000);
        }
      };

      if (iframe.contentWindow?.document.readyState === 'complete') {
        setTimeout(doPrint, 300);
      } else {
        iframe.onload = () => setTimeout(doPrint, 300);
      }
    } catch (err) {
      console.error('Failed to dispatch report print:', err);
      resolve(false);
    }
  });
}

/**
 * Shared CSS rules for formal A4 report documents
 */
const BASE_A4_STYLES = `
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 12mm 14mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1E2930;
    background: #FFFFFF;
    font-size: 11px;
    line-height: 1.4;
    padding: 0;
  }
  .report-wrap {
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
  }
  .header-box {
    border-bottom: 2.5px solid #DE8626;
    padding-bottom: 12px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .restaurant-title {
    font-size: 18px;
    font-weight: 900;
    color: #1E2930;
    letter-spacing: -0.3px;
  }
  .restaurant-meta {
    font-size: 10px;
    color: #5C4E3D;
    margin-top: 3px;
    line-height: 1.35;
  }
  .badge-doc {
    background: #FFF4E5;
    border: 1px solid #DE8626;
    color: #C4721C;
    font-size: 10px;
    font-weight: 800;
    padding: 4px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
  }
  .doc-title {
    font-size: 14px;
    font-weight: 800;
    color: #1E2930;
    margin-top: 4px;
  }
  .period-bar {
    background: #FAF7F2;
    border: 1px solid #E7E1DA;
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    font-weight: 600;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .kpi-card {
    background: #FAF7F2;
    border: 1px solid #E7E1DA;
    border-radius: 8px;
    padding: 8px;
    text-align: center;
  }
  .kpi-label {
    font-size: 8.5px;
    font-weight: 800;
    color: #78716C;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 2px;
  }
  .kpi-value {
    font-size: 15px;
    font-weight: 900;
    color: #1E2930;
  }
  .kpi-value.brand { color: #DE8626; }
  .kpi-value.green { color: #17845A; }
  .section-heading {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #1E2930;
    margin-bottom: 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid #E7E1DA;
    page-break-after: avoid;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
  }
  th {
    background: #FAF7F2;
    color: #5C4E3D;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 6px 8px;
    border-top: 1px solid #E7E1DA;
    border-bottom: 1.5px solid #E7E1DA;
    text-align: left;
  }
  td {
    padding: 6px 8px;
    font-size: 10px;
    border-bottom: 1px solid #EFEAE4;
    color: #1E2930;
  }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .font-black { font-weight: 900; }
  .footer-signatures {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px dashed #D5CEC4;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 10px;
    color: #78716C;
    page-break-inside: avoid;
  }
  .sig-line {
    border-top: 1px solid #78716C;
    width: 140px;
    padding-top: 4px;
    text-align: center;
    font-weight: 600;
  }
`;

/**
 * 1. Print Consolidated Executive Business Ledger (Overall Print)
 */
export async function printConsolidatedLedger(data: ConsolidatedReportData): Promise<boolean> {
  const { restaurant, periodLabel, fromDate, toDate, generatedBy, dashboard, salesSummary, topItems, paymentBreakdown } = data;

  const grossSales = salesSummary?.totalGrossSales ?? dashboard?.todayGrossSales ?? 0;
  const netSales = salesSummary?.totalNetSales ?? dashboard?.todayNetSales ?? 0;
  const totalOrders = salesSummary?.totalOrders ?? dashboard?.todayTotalOrders ?? 0;
  const completedOrders = salesSummary?.completedOrders ?? dashboard?.todayCompletedOrders ?? 0;
  const cancelledOrders = salesSummary?.cancelledOrders ?? dashboard?.todayCancelledOrders ?? 0;
  const aov = salesSummary?.overallAverageOrderValue ?? dashboard?.todayAverageOrderValue ?? 0;
  const tax = salesSummary?.totalTax ?? dashboard?.todayTax ?? 0;
  const discounts = salesSummary?.totalDiscount ?? dashboard?.todayDiscounts ?? 0;

  const dailyRows = (salesSummary?.dailyBreakdown || [])
    .map(
      (day, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="font-bold">${day.date}</td>
        <td class="text-center font-bold" style="color: #17845A;">${day.completedOrders}</td>
        <td class="text-center" style="color: ${day.cancelledOrders > 0 ? '#DC2626' : '#78716C'};">${day.cancelledOrders}</td>
        <td class="text-right font-black">₹${day.grossSales.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${day.netSales.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${day.taxAmount.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">₹${Math.round(day.averageOrderValue)}</td>
      </tr>
    `
    )
    .join('');

  const paymentRows = (paymentBreakdown.metrics || [])
    .map(
      (p) => `
      <tr>
        <td class="font-bold">${p.mode}</td>
        <td class="text-center font-bold">${p.count}</td>
        <td class="text-right font-black">₹${p.total.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">${p.percentage}%</td>
      </tr>
    `
    )
    .join('');

  const itemRows = (topItems?.items || []).slice(0, 15)
    .map(
      (dish, idx) => `
      <tr>
        <td class="text-center font-bold">#${idx + 1}</td>
        <td class="font-bold">${dish.itemName}</td>
        <td><span style="background: #F5F2EB; padding: 2px 5px; border-radius: 4px; font-size: 9px;">${dish.categoryName || 'General'}</span></td>
        <td class="text-center font-bold">${dish.quantitySold}</td>
        <td class="text-right font-black" style="color: #17845A;">₹${dish.totalRevenue.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">${dish.contributionPercentage.toFixed(1)}%</td>
      </tr>
    `
    )
    .join('');

  const nowStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Menza Ledger - ${restaurant.name}</title>
        <style>${BASE_A4_STYLES}</style>
      </head>
      <body>
        <div class="report-wrap">
          <div class="header-box">
            <div>
              <h1 class="restaurant-title">${restaurant.name}</h1>
              <p class="restaurant-meta">
                ${restaurant.address ? `${restaurant.address}, ` : ''}${restaurant.city || ''} ${restaurant.state || ''}
                ${restaurant.phone ? `<br/>Phone: ${restaurant.phone}` : ''}
                ${restaurant.gstin ? `<br/><strong>GSTIN:</strong> ${restaurant.gstin}` : ''}
              </p>
            </div>
            <div style="text-align: right;">
              <span class="badge-doc">AUDIT REPORT</span>
              <h2 class="doc-title">Executive Business Ledger</h2>
              <p style="font-size: 9.5px; color: #78716C; margin-top: 2px;">Generated: ${nowStr}</p>
            </div>
          </div>

          <div class="period-bar">
            <span>Operating Period: <strong>${periodLabel.toUpperCase()}</strong> ${fromDate ? `(${fromDate} to ${toDate || fromDate})` : ''}</span>
            <span>Generated By: <strong>${generatedBy || 'Store Administrator'}</strong></span>
          </div>

          <!-- KPI Summary -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <p class="kpi-label">Gross Revenue</p>
              <p class="kpi-value brand">₹${grossSales.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Net Sales</p>
              <p class="kpi-value">₹${netSales.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Total Tickets</p>
              <p class="kpi-value green">${totalOrders} <span style="font-size: 10px; color: #78716C;">(${completedOrders} served)</span></p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Average Ticket (AOV)</p>
              <p class="kpi-value">₹${Math.round(aov).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <!-- Section: Daily Sales Breakdown -->
          ${
            dailyRows
              ? `
            <h3 class="section-heading">1. Daily Revenue & Order Settlement Ledger</h3>
            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width: 30px;">#</th>
                  <th>Date</th>
                  <th class="text-center">Served</th>
                  <th class="text-center">Void/Cancel</th>
                  <th class="text-right">Gross Sales</th>
                  <th class="text-right">Net Sales</th>
                  <th class="text-right">GST Tax</th>
                  <th class="text-right">AOV</th>
                </tr>
              </thead>
              <tbody>
                ${dailyRows}
              </tbody>
              <tfoot>
                <tr style="background: #FAF7F2; font-weight: 800;">
                  <td colspan="2">TOTALS</td>
                  <td class="text-center" style="color: #17845A;">${completedOrders}</td>
                  <td class="text-center" style="color: ${cancelledOrders > 0 ? '#DC2626' : '#78716C'};">${cancelledOrders}</td>
                  <td class="text-right" style="color: #DE8626;">₹${grossSales.toLocaleString('en-IN')}</td>
                  <td class="text-right">₹${netSales.toLocaleString('en-IN')}</td>
                  <td class="text-right">₹${tax.toLocaleString('en-IN')}</td>
                  <td class="text-right">₹${Math.round(aov).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          `
              : ''
          }

          <!-- Section: Payment Mode Breakdown -->
          ${
            paymentRows
              ? `
            <h3 class="section-heading">2. Payment Collection & Register Settlement</h3>
            <table>
              <thead>
                <tr>
                  <th>Payment Tender Mode</th>
                  <th class="text-center">Tickets Punched</th>
                  <th class="text-right">Total Collected</th>
                  <th class="text-right">Collection Share</th>
                </tr>
              </thead>
              <tbody>
                ${paymentRows}
              </tbody>
              <tfoot>
                <tr style="background: #FAF7F2; font-weight: 800;">
                  <td>TOTAL SETTLED RECEIPTS</td>
                  <td class="text-center">${paymentBreakdown.totalCount}</td>
                  <td class="text-right" style="color: #17845A;">₹${paymentBreakdown.grandTotal.toLocaleString('en-IN')}</td>
                  <td class="text-right">100.0%</td>
                </tr>
              </tfoot>
            </table>
          `
              : ''
          }

          <!-- Section: Top Selling Dishes -->
          ${
            itemRows
              ? `
            <h3 class="section-heading">3. Top Menu Dishes & Revenue Contribution</h3>
            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width: 35px;">Rank</th>
                  <th>Menu Item</th>
                  <th>Category</th>
                  <th class="text-center">Qty Sold</th>
                  <th class="text-right">Total Revenue</th>
                  <th class="text-right">Contribution %</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
          `
              : ''
          }

          <!-- Sign-off Block -->
          <div class="footer-signatures">
            <div>
              <p>Menza POS System Automated Ledger Verification</p>
              <p style="font-size: 9px; color: #A8A29E; margin-top: 2px;">This is a system-generated audit report valid for restaurant book-keeping.</p>
            </div>
            <div style="display: flex; gap: 32px;">
              <div class="sig-line">Cashier Signature</div>
              <div class="sig-line">Store Manager Signature</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return dispatchHtmlPrint(html, `Menza-Consolidated-Ledger-${fromDate || 'period'}`);
}

/**
 * 2. Print Section: Daily Sales & Revenue Ledger (A4 Statement)
 */
export async function printDailySalesLedger(data: DailySalesLedgerData): Promise<boolean> {
  const { restaurant, periodLabel, fromDate, toDate, generatedBy, salesSummary } = data;

  const grossSales = salesSummary?.totalGrossSales || 0;
  const netSales = salesSummary?.totalNetSales || 0;
  const tax = salesSummary?.totalTax || 0;
  const discounts = salesSummary?.totalDiscount || 0;
  const completedOrders = salesSummary?.completedOrders || 0;
  const cancelledOrders = salesSummary?.cancelledOrders || 0;
  const aov = salesSummary?.overallAverageOrderValue || 0;

  const dailyRows = (salesSummary?.dailyBreakdown || [])
    .map(
      (day, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="font-bold">${day.date}</td>
        <td class="text-center font-bold" style="color: #17845A;">${day.completedOrders}</td>
        <td class="text-center" style="color: ${day.cancelledOrders > 0 ? '#DC2626' : '#78716C'};">${day.cancelledOrders}</td>
        <td class="text-right font-black">₹${day.grossSales.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${day.netSales.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${day.taxAmount.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${day.discountAmount.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">₹${Math.round(day.averageOrderValue)}</td>
      </tr>
    `
    )
    .join('');

  const nowStr = new Date().toLocaleString('en-IN');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Daily Sales Ledger - ${restaurant.name}</title>
        <style>${BASE_A4_STYLES}</style>
      </head>
      <body>
        <div class="report-wrap">
          <div class="header-box">
            <div>
              <h1 class="restaurant-title">${restaurant.name}</h1>
              <p class="restaurant-meta">
                ${restaurant.address ? `${restaurant.address}, ` : ''}${restaurant.city || ''}
                ${restaurant.gstin ? `<br/><strong>GSTIN:</strong> ${restaurant.gstin}` : ''}
              </p>
            </div>
            <div style="text-align: right;">
              <span class="badge-doc">SALES AUDIT</span>
              <h2 class="doc-title">Datewise Sales & Tax Ledger</h2>
              <p style="font-size: 9.5px; color: #78716C; margin-top: 2px;">Generated: ${nowStr}</p>
            </div>
          </div>

          <div class="period-bar">
            <span>Period: <strong>${periodLabel.toUpperCase()}</strong> (${fromDate || ''} to ${toDate || fromDate || ''})</span>
            <span>Generated By: <strong>${generatedBy || 'Cashier / Admin'}</strong></span>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <p class="kpi-label">Gross Sales</p>
              <p class="kpi-value brand">₹${grossSales.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Net Sales</p>
              <p class="kpi-value">₹${netSales.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Total Tax Collected</p>
              <p class="kpi-value green">₹${tax.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Discounts Conceded</p>
              <p class="kpi-value" style="color: #DC2626;">₹${discounts.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 30px;">#</th>
                <th>Date</th>
                <th class="text-center">Served</th>
                <th class="text-center">Void</th>
                <th class="text-right">Gross Sales</th>
                <th class="text-right">Net Sales</th>
                <th class="text-right">GST</th>
                <th class="text-right">Discount</th>
                <th class="text-right">AOV</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows || '<tr><td colspan="9" class="text-center" style="padding: 16px;">No sales data available for this range</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background: #FAF7F2; font-weight: 800;">
                <td colspan="2">TOTALS</td>
                <td class="text-center" style="color: #17845A;">${completedOrders}</td>
                <td class="text-center" style="color: ${cancelledOrders > 0 ? '#DC2626' : '#78716C'};">${cancelledOrders}</td>
                <td class="text-right" style="color: #DE8626;">₹${grossSales.toLocaleString('en-IN')}</td>
                <td class="text-right">₹${netSales.toLocaleString('en-IN')}</td>
                <td class="text-right">₹${tax.toLocaleString('en-IN')}</td>
                <td class="text-right">₹${discounts.toLocaleString('en-IN')}</td>
                <td class="text-right">₹${Math.round(aov).toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-signatures">
            <p>Menza POS Ledger Statement</p>
            <div class="sig-line">Manager Signature</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return dispatchHtmlPrint(html, `Daily-Sales-Ledger-${fromDate || 'period'}`);
}

/**
 * 3. Print Section: Hourly Rush & Shift Operations Report
 */
export async function printHourlyRushReport(data: HourlyRushReportData): Promise<boolean> {
  const { restaurant, dateLabel, generatedBy, heatmap } = data;

  const totalOrders = heatmap?.totalDayOrders || 0;
  const totalSales = heatmap?.totalDaySales || 0;
  const peakLabel = heatmap?.peakHourLabel || 'N/A';
  const peakOrders = heatmap?.peakHourOrdersCount || 0;
  const peakSales = heatmap?.peakHourSales || 0;

  const slots = heatmap?.hourlySlots || [];

  // Lunch & Dinner aggregates
  const lunchOrders = slots.filter((s) => s.hour >= 12 && s.hour <= 15).reduce((acc, s) => acc + s.ordersCount, 0);
  const lunchSales = slots.filter((s) => s.hour >= 12 && s.hour <= 15).reduce((acc, s) => acc + s.totalSales, 0);
  const dinnerOrders = slots.filter((s) => s.hour >= 19 && s.hour <= 22).reduce((acc, s) => acc + s.ordersCount, 0);
  const dinnerSales = slots.filter((s) => s.hour >= 19 && s.hour <= 22).reduce((acc, s) => acc + s.totalSales, 0);

  const slotRows = slots
    .filter((s) => s.ordersCount > 0 || (s.hour >= 10 && s.hour <= 23)) // Focus on operational hours
    .map((s) => {
      const isPeak = s.hourLabel === peakLabel && peakOrders > 0;
      const share = totalOrders > 0 ? ((s.ordersCount / totalOrders) * 100).toFixed(1) : '0';
      return `
      <tr style="${isPeak ? 'background: #FFF9F2;' : ''}">
        <td class="font-bold">${s.hourLabel || `${s.hour}:00 - ${s.hour + 1}:00`} ${isPeak ? '<span style="color:#DE8626; font-size:8px;">★ PEAK</span>' : ''}</td>
        <td class="text-center font-bold">${s.ordersCount}</td>
        <td class="text-center">${s.completedOrders ?? s.ordersCount}</td>
        <td class="text-right font-black">₹${s.totalSales.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">${share}%</td>
      </tr>
    `;
    })
    .join('');

  const nowStr = new Date().toLocaleString('en-IN');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Hourly Rush Telemetry - ${restaurant.name}</title>
        <style>${BASE_A4_STYLES}</style>
      </head>
      <body>
        <div class="report-wrap">
          <div class="header-box">
            <div>
              <h1 class="restaurant-title">${restaurant.name}</h1>
              <p class="restaurant-meta">${restaurant.address || ''} ${restaurant.city || ''}</p>
            </div>
            <div style="text-align: right;">
              <span class="badge-doc">OPERATIONS REPORT</span>
              <h2 class="doc-title">Hourly Rush & Shift Telemetry</h2>
              <p style="font-size: 9.5px; color: #78716C; margin-top: 2px;">Generated: ${nowStr}</p>
            </div>
          </div>

          <div class="period-bar">
            <span>Operating Date: <strong>${dateLabel.toUpperCase()}</strong></span>
            <span>Generated By: <strong>${generatedBy || 'Floor Manager'}</strong></span>
          </div>

          <!-- Shift & Peak Highlight -->
          <div class="kpi-grid">
            <div class="kpi-card" style="border-color: #DE8626;">
              <p class="kpi-label">Peak Rush Slot</p>
              <p class="kpi-value brand" style="font-size: 13px;">${peakLabel}</p>
              <p style="font-size: 9px; color: #78716C;">${peakOrders} tickets (₹${peakSales.toLocaleString('en-IN')})</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Lunch Shift (12-4 PM)</p>
              <p class="kpi-value" style="color: #346CB0;">${lunchOrders} tickets</p>
              <p style="font-size: 9px; color: #78716C;">₹${lunchSales.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Dinner Rush (7-11 PM)</p>
              <p class="kpi-value green">${dinnerOrders} tickets</p>
              <p style="font-size: 9px; color: #78716C;">₹${dinnerSales.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Total Day Volume</p>
              <p class="kpi-value">${totalOrders} tickets</p>
              <p style="font-size: 9px; color: #78716C;">₹${totalSales.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <h3 class="section-heading">Hourly Traffic Breakdown (24-Hour Timeline)</h3>
          <table>
            <thead>
              <tr>
                <th>Time Slot</th>
                <th class="text-center">Tickets Punched</th>
                <th class="text-center">Served</th>
                <th class="text-right">Revenue</th>
                <th class="text-right">Volume Share</th>
              </tr>
            </thead>
            <tbody>
              ${slotRows || '<tr><td colspan="5" class="text-center" style="padding: 16px;">No hourly orders recorded</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background: #FAF7F2; font-weight: 800;">
                <td>TOTALS</td>
                <td class="text-center">${totalOrders}</td>
                <td class="text-center">-</td>
                <td class="text-right" style="color: #DE8626;">₹${totalSales.toLocaleString('en-IN')}</td>
                <td class="text-right">100%</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-signatures">
            <p>Menza Operations Scheduling Telemetry</p>
            <div class="sig-line">Shift Supervisor Signature</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return dispatchHtmlPrint(html, `Hourly-Rush-${dateLabel}`);
}

/**
 * 4. Print Section: Cashier Payment Settlement Slip
 * Supports both standard A4 Statement and 80mm POS Thermal Slip.
 */
export async function printPaymentSettlementSlip(data: PaymentSettlementData): Promise<boolean> {
  const { restaurant, dateLabel, generatedBy, metrics, grandTotal, totalCount, isThermal = false } = data;
  const nowStr = new Date().toLocaleString('en-IN');

  if (isThermal) {
    // 80mm Thermal Receipt Slip
    const thermalRows = metrics
      .map(
        (m) => `
        <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
          <span>${m.mode.padEnd(10, ' ')} (${m.count})</span>
          <strong>₹${m.total.toLocaleString('en-IN')}</strong>
        </div>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page {
              size: 80mm auto;
              margin: 2mm 3mm;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: monospace, Courier, sans-serif;
              width: 72mm;
              margin: 0 auto;
              font-size: 11px;
              line-height: 1.3;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-bottom: 2px solid #000; margin: 6px 0; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 4px;">
            <strong style="font-size: 13px;">${restaurant.name}</strong>
            ${restaurant.address ? `<div>${restaurant.address}</div>` : ''}
            ${restaurant.gstin ? `<div>GSTIN: ${restaurant.gstin}</div>` : ''}
          </div>
          <div class="divider"></div>
          <div class="center">
            <strong>*** CASHIER SETTLEMENT SLIP ***</strong>
            <div>Date: ${dateLabel}</div>
            <div>Printed: ${nowStr}</div>
            <div>Cashier: ${generatedBy || 'Staff'}</div>
          </div>
          <div class="divider"></div>
          <div><strong>COLLECTION BREAKDOWN:</strong></div>
          <div style="margin-top: 4px;">
            ${thermalRows || '<div>No payments recorded</div>'}
          </div>
          <div class="double-divider"></div>
          <div style="display:flex; justify-content:space-between; font-size: 13px; font-weight: bold;">
            <span>TOTAL COLLECTED:</span>
            <span>₹${grandTotal.toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size: 10px; margin-top: 2px;">
            <span>TOTAL TICKETS:</span>
            <span>${totalCount}</span>
          </div>
          <div class="divider"></div>
          <div style="margin-top: 20px; display:flex; justify-content:space-between; font-size: 10px;">
            <div>Cashier Sign: _________</div>
            <div>Manager: _________</div>
          </div>
          <div style="text-align:center; font-size: 9px; margin-top: 15px;">
            --- END OF RECONCILIATION SLIP ---
          </div>
        </body>
      </html>
    `;
    return dispatchHtmlPrint(html, `Cashier-Settlement-${dateLabel}`);
  }

  // Standard A4 Statement
  const rows = metrics
    .map(
      (m) => `
      <tr>
        <td class="font-bold" style="font-size: 11px;">${m.mode}</td>
        <td class="text-center font-bold">${m.count}</td>
        <td class="text-right font-black" style="font-size: 12px;">₹${m.total.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">${m.percentage}%</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Cashier Settlement Slip - ${restaurant.name}</title>
        <style>${BASE_A4_STYLES}</style>
      </head>
      <body>
        <div class="report-wrap">
          <div class="header-box">
            <div>
              <h1 class="restaurant-title">${restaurant.name}</h1>
              <p class="restaurant-meta">
                ${restaurant.address || ''} ${restaurant.city || ''}
                ${restaurant.gstin ? `<br/>GSTIN: ${restaurant.gstin}` : ''}
              </p>
            </div>
            <div style="text-align: right;">
              <span class="badge-doc" style="background:#EBF7EE; border-color:#17845A; color:#17845A;">CASHIER CLOSING</span>
              <h2 class="doc-title">Payment Settlement & Drawer Reconciliation</h2>
              <p style="font-size: 9.5px; color: #78716C; margin-top: 2px;">Generated: ${nowStr}</p>
            </div>
          </div>

          <div class="period-bar">
            <span>Settlement Date: <strong>${dateLabel.toUpperCase()}</strong></span>
            <span>Reconciled By: <strong>${generatedBy || 'Cashier / Admin'}</strong></span>
          </div>

          <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr);">
            <div class="kpi-card">
              <p class="kpi-label">Total Receipts Collected</p>
              <p class="kpi-value green" style="font-size: 20px;">₹${grandTotal.toLocaleString('en-IN')}</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Settled Orders Count</p>
              <p class="kpi-value" style="font-size: 20px;">${totalCount} <span style="font-size: 11px; color:#78716C;">tickets</span></p>
            </div>
          </div>

          <h3 class="section-heading">Tender / Collection Modes Ledger</h3>
          <table>
            <thead>
              <tr>
                <th>Payment Tender Mode</th>
                <th class="text-center">Transactions</th>
                <th class="text-right">Amount Collected</th>
                <th class="text-right">Collection Share</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" class="text-center" style="padding: 16px;">No payments recorded for this period</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background: #FAF7F2; font-weight: 800; font-size: 11px;">
                <td>TOTAL SETTLED RECEIPTS</td>
                <td class="text-center">${totalCount}</td>
                <td class="text-right" style="color: #17845A;">₹${grandTotal.toLocaleString('en-IN')}</td>
                <td class="text-right">100.0%</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 14px; padding: 10px; background: #FAF7F2; border-radius: 8px; border: 1px solid #E7E1DA; font-size: 10px;">
            <strong>Cash Drawer Verification Note:</strong> Ensure physical cash tally matches the CASH row above before closing the counter shift. Any discrepancies must be recorded in the shift handover register.
          </div>

          <div class="footer-signatures">
            <div class="sig-line">Cashier Signature</div>
            <div class="sig-line">Store Manager Signature</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return dispatchHtmlPrint(html, `Cashier-Settlement-${dateLabel}`);
}

/**
 * 5. Print Section: Menu Item & Dish Performance Ledger
 */
export async function printMenuItemLedger(data: MenuItemLedgerData): Promise<boolean> {
  const { restaurant, periodLabel, fromDate, toDate, generatedBy, topItems } = data;

  const totalMenuRevenue = topItems?.totalMenuRevenue || 0;
  const totalItemsSold = topItems?.totalItemsSold || 0;

  const rows = (topItems?.items || [])
    .map(
      (dish, idx) => `
      <tr>
        <td class="text-center font-bold">#${idx + 1}</td>
        <td class="font-bold">${dish.itemName}</td>
        <td><span style="background: #F5F2EB; padding: 2px 5px; border-radius: 4px; font-size: 9px;">${dish.categoryName || 'General'}</span></td>
        <td class="text-center font-bold">${dish.quantitySold}</td>
        <td class="text-right font-black" style="color: #17845A;">₹${dish.totalRevenue.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #DE8626;">${dish.contributionPercentage.toFixed(1)}%</td>
      </tr>
    `
    )
    .join('');

  const nowStr = new Date().toLocaleString('en-IN');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Menu Item Ledger - ${restaurant.name}</title>
        <style>${BASE_A4_STYLES}</style>
      </head>
      <body>
        <div class="report-wrap">
          <div class="header-box">
            <div>
              <h1 class="restaurant-title">${restaurant.name}</h1>
              <p class="restaurant-meta">${restaurant.address || ''} ${restaurant.city || ''}</p>
            </div>
            <div style="text-align: right;">
              <span class="badge-doc">KITCHEN REPORT</span>
              <h2 class="doc-title">Menu Item Sales & Dish Performance</h2>
              <p style="font-size: 9.5px; color: #78716C; margin-top: 2px;">Generated: ${nowStr}</p>
            </div>
          </div>

          <div class="period-bar">
            <span>Period: <strong>${periodLabel.toUpperCase()}</strong> (${fromDate || ''} to ${toDate || fromDate || ''})</span>
            <span>Generated By: <strong>${generatedBy || 'Kitchen In-Charge'}</strong></span>
          </div>

          <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr);">
            <div class="kpi-card">
              <p class="kpi-label">Total Menu Dishes Sold</p>
              <p class="kpi-value brand" style="font-size: 20px;">${totalItemsSold} <span style="font-size: 11px; color:#78716C;">portions</span></p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">Total Menu Revenue</p>
              <p class="kpi-value green" style="font-size: 20px;">₹${totalMenuRevenue.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <h3 class="section-heading">Dish Sales & Volume Ledger</h3>
          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 35px;">Rank</th>
                <th>Menu Dish Name</th>
                <th>Category</th>
                <th class="text-center">Portions Sold</th>
                <th class="text-right">Total Revenue</th>
                <th class="text-right">Menu Share %</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="6" class="text-center" style="padding: 16px;">No menu dish sales recorded</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background: #FAF7F2; font-weight: 800;">
                <td colspan="3">TOTALS</td>
                <td class="text-center">${totalItemsSold}</td>
                <td class="text-right" style="color: #17845A;">₹${totalMenuRevenue.toLocaleString('en-IN')}</td>
                <td class="text-right">100.0%</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-signatures">
            <p>Menza Kitchen Management Ledger</p>
            <div class="sig-line">Head Chef / Kitchen In-Charge</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return dispatchHtmlPrint(html, `Menu-Item-Ledger-${fromDate || 'period'}`);
}
