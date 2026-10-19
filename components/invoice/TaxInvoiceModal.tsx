'use client';

import React, { useRef } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Receipt,
  Calendar,
  CreditCard,
} from 'lucide-react';

export interface TaxInvoiceItem {
  type: 'WALLET_RECHARGE' | 'SUBSCRIPTION';
  invoiceNumber: string;
  invoiceDate: string;
  paymentReference?: string;
  orderId?: string;

  // Supplier (Platform Provider - Configurable)
  supplierLegalName?: string;
  supplierTradeName?: string;
  supplierGstin?: string;
  supplierPan?: string;
  supplierStateCode?: string;
  supplierStateName?: string;
  supplierAddress?: string;
  supplierEmail?: string;
  supplierWebsite?: string;

  // Restaurant (Recipient)
  restaurantName: string;
  restaurantId: number;
  outletAddress?: string;
  ownerName?: string;
  contactPhone?: string;
  customerEmail?: string;
  customerGstin?: string;

  // Line Item
  itemTitle: string;
  itemDescription?: string;
  sacCode?: string; // 998599 (Platform Support / Wallet) or 997331 (SaaS License)
  coverageStart?: string;
  coverageEnd?: string;

  // Financials
  totalAmount: number;
  baseAmount?: number;
  taxAmount?: number;
  taxPercentage?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
}

interface TaxInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: TaxInvoiceItem | null;
}

function formatInr(val: number | undefined | null): string {
  const num = Number(val ?? 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function numberToWords(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded <= 0) return 'Zero Rupees Only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (num: number): string => {
    if (num < 10) return single[num];
    if (num >= 10 && num < 20) return double[num - 10];
    const t = Math.floor(num / 10);
    const r = num % 10;
    return `${tens[t]}${r > 0 ? ` ${single[r]}` : ''}`;
  };

  const convertThreeDigits = (num: number): string => {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    const hStr = h > 0 ? `${single[h]} Hundred` : '';
    const rStr = rest > 0 ? convertTwoDigits(rest) : '';
    return [hStr, rStr].filter(Boolean).join(' and ');
  };

  let n = rounded;
  const parts: string[] = [];

  const crores = Math.floor(n / 10000000);
  n %= 10000000;
  if (crores > 0) parts.push(`${convertThreeDigits(crores)} Crore`);

  const lakhs = Math.floor(n / 100000);
  n %= 100000;
  if (lakhs > 0) parts.push(`${convertThreeDigits(lakhs)} Lakh`);

  const thousands = Math.floor(n / 1000);
  n %= 1000;
  if (thousands > 0) parts.push(`${convertThreeDigits(thousands)} Thousand`);

  if (n > 0) parts.push(convertThreeDigits(n));

  return `INR ${parts.join(' ')} Only`;
}

export function generateInvoiceHtml(invoice: TaxInvoiceItem): string {
  const total = Number(invoice.totalAmount || 0);
  const taxPct = Number(invoice.taxPercentage || 18);
  const base =
    invoice.baseAmount !== undefined && invoice.baseAmount !== null
      ? Number(invoice.baseAmount)
      : Math.round((total / (1 + taxPct / 100)) * 100) / 100;
  const totalTax =
    invoice.taxAmount !== undefined && invoice.taxAmount !== null
      ? Number(invoice.taxAmount)
      : Math.round((total - base) * 100) / 100;

  const cgstRate = invoice.cgstPercentage !== undefined ? Number(invoice.cgstPercentage) : taxPct / 2;
  const sgstRate = invoice.sgstPercentage !== undefined ? Number(invoice.sgstPercentage) : taxPct / 2;
  const cgstAmount = Math.round((base * (cgstRate / 100)) * 100) / 100;
  const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

  const supplierLegalName = invoice.supplierLegalName || 'Qubenexus Technologies Private Limited';
  const supplierTradeName = invoice.supplierTradeName || 'Menza';
  const supplierGstin = invoice.supplierGstin || '23AABCQ2654A1Z1';
  const supplierStateCode = invoice.supplierStateCode || '23';
  const supplierStateName = invoice.supplierStateName || 'Madhya Pradesh';
  const supplierAddress = invoice.supplierAddress || 'Plot No 31 Sage Sun City Phase-2, Katara Extension, Bhopal';
  const supplierEmail = (invoice.supplierEmail || 'admin@qubenexus.co.in').toLowerCase();
  const supplierWebsite = invoice.supplierWebsite || 'qubenexus.co.in';

  const hasCustomerGstin = Boolean(invoice.customerGstin && invoice.customerGstin.trim().length > 0);
  const invoiceNumberClean = String(invoice.invoiceNumber || 'MZ').replace(/[\/\\]/g, '_');
  const title = `Tax_Invoice_${invoiceNumberClean}`;

  const defaultDescription =
    invoice.type === 'WALLET_RECHARGE'
      ? 'Prepaid Platform Fee & SMS Top-Up Wallet Recharge'
      : 'Software as a Service (SaaS) Cloud POS Subscription & Licensing';

  const coverageHtml =
    invoice.coverageStart && invoice.coverageEnd
      ? `<div style="font-size: 10px; color: #C2410C; font-weight: 700; margin-top: 4px; display: inline-block; background: #FFF7ED; border: 1px solid #FFEDD5; padding: 2px 8px; border-radius: 4px;">Coverage: ${formatDisplayDate(invoice.coverageStart)} &rarr; ${formatDisplayDate(invoice.coverageEnd)}</div>`
      : '';

  const customerGstinHtml = hasCustomerGstin
    ? `<div style="margin-top: 8px;">
        <span class="customer-gstin-pill">
          <span style="font-size: 10px; font-weight: 600; color: #78350F;">GSTIN:</span> ${invoice.customerGstin}
        </span>
      </div>`
    : '';

  const contactHtml = invoice.contactPhone
    ? `<div style="margin-top: 6px; font-size: 11px; color: #64748B;">Contact: <strong style="color: #334155;">${invoice.contactPhone}</strong>${invoice.customerEmail ? ' &bull; ' + invoice.customerEmail : ''}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #1E293B;
      background: #FFFFFF;
      line-height: 1.5;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-card {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 32px 36px;
      background: #FFFFFF;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #F1F5F9;
      padding-bottom: 20px;
      margin-bottom: 22px;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #DE8626 0%, #C4721C 100%);
      color: #FFFFFF;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 22px;
    }
    .brand-text h1 {
      font-size: 18px;
      font-weight: 900;
      color: #0F172A;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .brand-text p {
      font-size: 11px;
      color: #64748B;
      font-weight: 600;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
    }
    .invoice-title-badge {
      display: inline-block;
      background: #ECFDF5;
      color: #047857;
      border: 1px solid #A7F3D0;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 6px;
    }
    .invoice-meta-grid {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .invoice-meta-item {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      font-size: 11px;
    }
    .invoice-meta-item .meta-label {
      color: #64748B;
      font-weight: 500;
    }
    .invoice-meta-item .meta-value {
      color: #0F172A;
      font-weight: 700;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 22px;
    }
    .party-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px 18px;
    }
    .party-header {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748B;
      margin-bottom: 6px;
    }
    .party-name {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
    }
    .party-detail {
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }
    .supplier-gstin-pill,
    .customer-gstin-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 3px 8px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      color: #B45309;
    }
    .table-container {
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 22px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    thead th {
      background: #F8FAFC;
      padding: 11px 14px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #475569;
      border-bottom: 1px solid #E2E8F0;
    }
    tbody td {
      padding: 14px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 11px;
      vertical-align: top;
    }
    .item-title {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 2px;
    }
    .item-desc {
      font-size: 11px;
      color: #64748B;
      line-height: 1.4;
    }
    .totals-grid {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 20px;
      margin-bottom: 22px;
      page-break-inside: avoid;
    }
    .words-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
    }
    .words-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748B;
    }
    .words-text {
      font-size: 12px;
      font-weight: 800;
      font-style: italic;
      color: #0F172A;
      line-height: 1.4;
    }
    .rcm-box {
      border-top: 1px solid #E2E8F0;
      padding-top: 8px;
      font-size: 10px;
      color: #64748B;
    }
    .calculation-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .calc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #475569;
    }
    .calc-row.tax-sub {
      color: #64748B;
      padding-left: 10px;
      border-left: 2px solid #E2E8F0;
      font-size: 10.5px;
    }
    .calc-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #0F172A;
    }
    .grand-total-row {
      border-top: 2px solid #E2E8F0;
      padding-top: 9px;
      margin-top: 3px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .grand-total-label {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0F172A;
    }
    .grand-total-val {
      font-size: 17px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #DE8626;
    }
    .footer-section {
      border-top: 2px solid #F1F5F9;
      padding-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      page-break-inside: avoid;
    }
    .footer-terms {
      font-size: 10px;
      color: #64748B;
      line-height: 1.5;
      max-width: 460px;
    }
    .footer-terms strong {
      color: #0F172A;
      display: block;
      margin-bottom: 2px;
    }
    .footer-sign {
      text-align: right;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      color: #047857;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .sign-for {
      font-size: 11px;
      font-weight: 800;
      color: #0F172A;
    }
    .sign-title {
      font-size: 9px;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @media print {
      body {
        padding: 0;
        background: #FFFFFF;
      }
      .invoice-card {
        border: none;
        padding: 0;
        max-width: 100%;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header-bar">
      <div class="brand-section">
        <div class="brand-logo">M</div>
        <div class="brand-text">
          <h1>${supplierTradeName}</h1>
          <p>${supplierLegalName}</p>
        </div>
      </div>
      <div class="header-meta">
        <div class="invoice-title-badge">TAX INVOICE</div>
        <div class="invoice-meta-grid">
          <div class="invoice-meta-item">
            <span class="meta-label">Invoice No:</span>
            <span class="meta-value" style="font-family: ui-monospace, monospace; color: #DE8626;">${invoice.invoiceNumber}</span>
          </div>
          <div class="invoice-meta-item">
            <span class="meta-label">Invoice Date:</span>
            <span class="meta-value">${formatDisplayDate(invoice.invoiceDate)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="parties-grid">
      <!-- Supplier Platform -->
      <div class="party-card">
        <div class="party-name">${supplierLegalName}</div>
        <div class="party-detail">
          ${supplierAddress}<br />
          State: <strong>${supplierStateCode} - ${supplierStateName}</strong><br />
          Support: ${supplierEmail}
        </div>
        <div>
          <span class="supplier-gstin-pill">
            <span style="font-size: 10px; font-weight: 600;">GSTIN:</span> ${supplierGstin}
          </span>
        </div>
      </div>

      <!-- Billed To (Customer / Restaurant) -->
      <div class="party-card">
        <div class="party-header">Billed To</div>
        <div class="party-name">${invoice.restaurantName}</div>
        <div class="party-detail">
          Store ID: <strong>#${invoice.restaurantId}</strong>${invoice.ownerName ? ' &bull; Owner: ' + invoice.ownerName : ''}<br />
          ${invoice.outletAddress ? invoice.outletAddress + '<br />' : ''}
          ${contactHtml}
        </div>
        ${customerGstinHtml}
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 36px; text-align: center;">#</th>
            <th>Description of Services</th>
            <th style="text-align: right; width: 110px;">Taxable Base</th>
            <th style="text-align: right; width: 90px;">CGST (${cgstRate}%)</th>
            <th style="text-align: right; width: 90px;">SGST (${sgstRate}%)</th>
            <th style="text-align: right; width: 120px;">Total (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; color: #64748B; font-weight: 700;">1</td>
            <td>
              <div class="item-title">${invoice.itemTitle}</div>
              <div class="item-desc">${invoice.itemDescription || defaultDescription}</div>
              ${coverageHtml}
            </td>
            <td style="text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">₹${formatInr(base)}</td>
            <td style="text-align: right; font-family: ui-monospace, monospace; color: #475569;">₹${formatInr(cgstAmount)}</td>
            <td style="text-align: right; font-family: ui-monospace, monospace; color: #475569;">₹${formatInr(sgstAmount)}</td>
            <td style="text-align: right; font-family: ui-monospace, monospace; font-weight: 900; color: #0F172A;">₹${formatInr(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="totals-grid">
      <div class="words-card">
        <div>
          <div class="words-label">Invoice Amount in Words</div>
          <div class="words-text">${numberToWords(total)}</div>
        </div>
        <div class="rcm-box">
          <strong>Taxation Category:</strong> Standard GST (${taxPct}%) &bull; <strong>Reverse Charge (RCM):</strong> No
        </div>
      </div>

      <div class="calculation-card">
        <div class="calc-row">
          <span>Taxable Value (Base)</span>
          <span class="calc-val">₹${formatInr(base)}</span>
        </div>
        <div class="calc-row tax-sub">
          <span>Central GST (CGST @ ${cgstRate}%)</span>
          <span class="calc-val">₹${formatInr(cgstAmount)}</span>
        </div>
        <div class="calc-row tax-sub">
          <span>State GST (SGST @ ${sgstRate}%)</span>
          <span class="calc-val">₹${formatInr(sgstAmount)}</span>
        </div>
        <div class="calc-row">
          <span style="font-weight: 700; color: #0F172A;">Total GST Amount (${taxPct}%)</span>
          <span class="calc-val" style="font-weight: 700;">₹${formatInr(totalTax)}</span>
        </div>
        <div class="grand-total-row">
          <span class="grand-total-label">Total Payable</span>
          <span class="grand-total-val">₹${formatInr(total)}</span>
        </div>
      </div>
    </div>

    <div class="footer-section">
      <div class="footer-terms">
        <strong>Terms & Conditions:</strong>
        <p>1. This is a computer-generated tax invoice issued in accordance with Section 31 of the CGST Act, 2017. No physical signature is required.</p>
        <p>2. Fees paid for platform wallet top-up & SaaS subscriptions are non-refundable once credited or activated.</p>
      </div>
      <div class="footer-sign">
        <div class="verified-badge">&#10003; Digitally Signed & Verified</div>
        <div class="sign-for">For ${supplierLegalName}</div>
        <div class="sign-title">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printInvoiceDocument(invoice: TaxInvoiceItem) {
  if (typeof window === 'undefined') return;

  const html = generateInvoiceHtml(invoice);
  const invoiceNumberClean = String(invoice.invoiceNumber || 'MZ').replace(/[\/\\]/g, '_');
  const title = `Tax_Invoice_${invoiceNumberClean}`;

  try {
    const existing = document.getElementById('__menza_invoice_iframe__');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const iframe = document.createElement('iframe');
    iframe.id = '__menza_invoice_iframe__';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1000px';
    iframe.style.height = '1000px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      const doPrint = () => {
        try {
          const originalTitle = document.title;
          document.title = title;
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.title = originalTitle;
            try {
              if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            } catch {}
          }, 3500);
        } catch {
          fallbackPopup(html, title);
        }
      };

      if (iframe.contentWindow?.document.readyState === 'complete') {
        setTimeout(doPrint, 250);
      } else {
        iframe.onload = () => setTimeout(doPrint, 250);
        setTimeout(doPrint, 600);
      }
      return;
    }
  } catch {
    fallbackPopup(html, title);
  }
}

function fallbackPopup(html: string, title: string) {
  try {
    const w = window.open('', '_blank', 'width=900,height=800');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
      }, 400);
    }
  } catch (e) {
    console.error('Failed to print invoice', e);
  }
}

export function TaxInvoiceModal({ isOpen, onClose, invoice }: TaxInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const total = Number(invoice.totalAmount || 0);
  const taxPct = Number(invoice.taxPercentage || 18);
  const base =
    invoice.baseAmount !== undefined && invoice.baseAmount !== null
      ? Number(invoice.baseAmount)
      : Math.round((total / (1 + taxPct / 100)) * 100) / 100;
  const totalTax =
    invoice.taxAmount !== undefined && invoice.taxAmount !== null
      ? Number(invoice.taxAmount)
      : Math.round((total - base) * 100) / 100;

  // Central & State GST Split (Configurable from backend)
  const cgstRate = invoice.cgstPercentage !== undefined ? Number(invoice.cgstPercentage) : taxPct / 2;
  const sgstRate = invoice.sgstPercentage !== undefined ? Number(invoice.sgstPercentage) : taxPct / 2;
  const cgstAmount = Math.round((base * (cgstRate / 100)) * 100) / 100;
  const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

  // Dynamic Supplier (Platform) Information
  const supplierLegalName = invoice.supplierLegalName || 'Qubenexus Technologies Private Limited';
  const supplierTradeName = invoice.supplierTradeName || 'Menza';
  const supplierGstin = invoice.supplierGstin || '23AABCQ2654A1Z1';
  const supplierStateCode = invoice.supplierStateCode || '23';
  const supplierStateName = invoice.supplierStateName || 'Madhya Pradesh';
  const supplierAddress = invoice.supplierAddress || 'Plot No 31 Sage Sun City Phase-2, Katara Extension, Bhopal';
  const supplierEmail = (invoice.supplierEmail || 'admin@qubenexus.co.in').toLowerCase();
  const supplierWebsite = invoice.supplierWebsite || 'qubenexus.co.in';

  const hasCustomerGstin = Boolean(invoice.customerGstin && invoice.customerGstin.trim().length > 0);

  const defaultDescription =
    invoice.type === 'WALLET_RECHARGE'
      ? 'Prepaid Platform Fee & SMS Top-Up Wallet Recharge'
      : 'Software as a Service (SaaS) Cloud POS Subscription & Licensing';

  const handlePrintOrDownload = () => {
    printInvoiceDocument(invoice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] shadow-2xl overflow-hidden my-auto">
        {/* Action Header */}
        <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                GST Tax Invoice Preview
              </h2>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Invoice #{invoice.invoiceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintOrDownload}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all cursor-pointer"
              title="Download GST Tax Invoice as PDF (Select 'Save as PDF' in the destination)"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintOrDownload}
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] transition-all cursor-pointer"
              title="Print Tax Invoice"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div
          ref={printRef}
          id="tax-invoice-printable"
          className="p-6 sm:p-8 space-y-6 text-[#1E2930] dark:text-[#F3F4F6] bg-white dark:bg-[#1B2127] print:text-black print:bg-white text-xs"
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE8626] to-[#C4721C] text-white font-black text-xl shadow-xs">
                M
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                  {supplierTradeName}
                </h1>
                <p className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  {supplierLegalName}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1.5">
              <div className="inline-block rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                TAX INVOICE
              </div>
              <div className="pt-0.5 space-y-0.5 text-xs">
                <div className="flex items-center sm:justify-end gap-2">
                  <span className="text-[#64748B] dark:text-[#94A3B8] text-[11px] font-medium">Invoice No:</span>
                  <span className="font-mono font-bold text-[#DE8626] tracking-tight">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-2">
                  <span className="text-[#64748B] dark:text-[#94A3B8] text-[11px] font-medium">Invoice Date:</span>
                  <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{formatDisplayDate(invoice.invoiceDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Parties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supplier Platform */}
            <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/70 dark:bg-[#151A20]/70 p-4 space-y-2">
              <div>
                <div className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                  {supplierLegalName}
                </div>
                <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed mt-1">
                  {supplierAddress}<br />
                  State: <strong className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{supplierStateCode} - {supplierStateName}</strong><br />
                  Support: {supplierEmail}
                </div>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFBEB] dark:bg-amber-950/40 border border-[#FDE68A] dark:border-amber-800/50 text-[#B45309] dark:text-amber-400 font-mono text-[11px] font-bold">
                  <span className="text-[10px] font-semibold text-[#78350F] dark:text-amber-500">GSTIN:</span>
                  {supplierGstin}
                </span>
              </div>
            </div>

            {/* Billed To */}
            <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/70 dark:bg-[#151A20]/70 p-4 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Billed To
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                  {invoice.restaurantName}
                </div>
                <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed mt-1">
                  Store ID: <strong className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">#{invoice.restaurantId}</strong>
                  {invoice.ownerName ? ` • Owner: ${invoice.ownerName}` : ''}
                  {invoice.outletAddress && (
                    <><br />{invoice.outletAddress}</>
                  )}
                  {(invoice.contactPhone || invoice.customerEmail) && (
                    <><br />Contact: {invoice.contactPhone || ''}{invoice.contactPhone && invoice.customerEmail ? ' • ' : ''}{invoice.customerEmail || ''}</>
                  )}
                </div>
              </div>
              {hasCustomerGstin && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFBEB] dark:bg-amber-950/40 border border-[#FDE68A] dark:border-amber-800/50 text-[#B45309] dark:text-amber-400 font-mono text-[11px] font-bold">
                    <span className="text-[10px] font-semibold text-[#78350F] dark:text-amber-500">GSTIN:</span>
                    {invoice.customerGstin}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E7E1DA] dark:border-[#2B3540]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#FAF7F2] dark:bg-[#151A20] text-[10px] font-extrabold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] border-b border-[#E7E1DA] dark:border-[#2B3540]">
                <tr>
                  <th className="py-3 px-3.5 w-10 text-center">#</th>
                  <th className="py-3 px-3.5">Description of Services</th>
                  <th className="py-3 px-3.5 text-right w-28">Taxable Base</th>
                  <th className="py-3 px-3.5 text-right w-24">CGST ({cgstRate}%)</th>
                  <th className="py-3 px-3.5 text-right w-24">SGST ({sgstRate}%)</th>
                  <th className="py-3 px-3.5 text-right w-32">Total (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 text-[11px]">
                <tr>
                  <td className="py-3.5 px-3.5 text-center text-[#64748B] font-bold">1</td>
                  <td className="py-3.5 px-3.5">
                    <div className="font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                      {invoice.itemTitle}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                      {invoice.itemDescription || defaultDescription}
                    </div>
                    {invoice.coverageStart && invoice.coverageEnd && (
                      <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-[#DE8626] font-semibold text-[10px]">
                        Coverage: {formatDisplayDate(invoice.coverageStart)} → {formatDisplayDate(invoice.coverageEnd)}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    ₹{formatInr(base)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono text-[#475569] dark:text-[#94A3B8]">
                    ₹{formatInr(cgstAmount)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono text-[#475569] dark:text-[#94A3B8]">
                    ₹{formatInr(sgstAmount)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono font-black text-[#0F172A] dark:text-[#F8FAFC]">
                    ₹{formatInr(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Words & Reverse charge info */}
            <div className="sm:col-span-7 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 p-4 flex flex-col justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] block">
                  Invoice Amount in Words
                </span>
                <p className="text-xs font-extrabold italic text-[#0F172A] dark:text-[#F8FAFC] mt-1 leading-snug">
                  {numberToWords(total)}
                </p>
              </div>
              <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] pt-2.5 text-[10.5px] text-[#64748B] dark:text-[#94A3B8]">
                <strong>Taxation Category:</strong> Standard GST ({taxPct}%) • <strong>Reverse Charge (RCM):</strong> No
              </div>
            </div>

            {/* Calculation Card */}
            <div className="sm:col-span-5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/80 dark:bg-[#151A20]/80 p-4 space-y-2">
              <div className="flex justify-between items-center text-[11px] text-[#475569] dark:text-[#94A3B8]">
                <span>Taxable Value (Base)</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">₹{formatInr(base)}</span>
              </div>
              <div className="flex justify-between items-center text-[10.5px] text-[#64748B] dark:text-[#94A3B8] pl-2 border-l-2 border-[#E7E1DA] dark:border-[#2B3540]">
                <span>Central GST (CGST @ {cgstRate}%)</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">₹{formatInr(cgstAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-[10.5px] text-[#64748B] dark:text-[#94A3B8] pl-2 border-l-2 border-[#E7E1DA] dark:border-[#2B3540]">
                <span>State GST (SGST @ {sgstRate}%)</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">₹{formatInr(sgstAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-[#0F172A] dark:text-[#F8FAFC] pt-0.5">
                <span>Total GST Amount ({taxPct}%)</span>
                <span className="font-mono font-bold">₹{formatInr(totalTax)}</span>
              </div>
              <div className="border-t-2 border-[#E7E1DA] dark:border-[#2B3540] pt-2 mt-1 flex justify-between items-baseline">
                <span className="text-xs font-black uppercase tracking-wide text-[#0F172A] dark:text-[#F8FAFC]">
                  Total Payable
                </span>
                <span className="text-base font-black font-mono text-[#DE8626]">
                  ₹{formatInr(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Legal Declaration & Authorized Signature */}
          <div className="border-t-2 border-[#F1F5F9] dark:border-[#2B3540] pt-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="space-y-1 text-[10px] text-[#64748B] dark:text-[#94A3B8] max-w-md leading-relaxed">
              <strong className="text-[#0F172A] dark:text-[#F8FAFC] block">
                Terms & Conditions:
              </strong>
              <p>
                1. This is a computer-generated tax invoice issued in accordance with Section 31 of the CGST Act, 2017. No physical signature is required.
              </p>
              <p>
                2. Fees paid for platform wallet top-up & SaaS subscriptions are non-refundable once credited or activated.
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1 shrink-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Digitally Signed & Verified</span>
              </div>
              <p className="text-[11px] font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                For {supplierLegalName}
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-[#94A3B8]">
                Authorised Signatory
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
