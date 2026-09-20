import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { RestaurantWallet, WalletTransaction } from '../../domain/models/Wallet';

export interface GenerateLedgerPdfOptions {
  restaurantName: string;
  restaurantId: number;
  outletAddress?: string;
  contactNumber?: string;
  wallet: RestaurantWallet | null;
  transactions: WalletTransaction[];
  generatedBy?: string;
}

export class PdfLedgerGenerator {
  /**
   * Generates a polished HTML statement for the commission wallet ledger
   */
  static generateLedgerHtml(options: GenerateLedgerPdfOptions): string {
    const {
      restaurantName,
      restaurantId,
      outletAddress,
      contactNumber,
      wallet,
      transactions,
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
      second: '2-digit',
    });

    const currentBalance = wallet?.balance ?? 0;
    const threshold = wallet?.lowBalanceThreshold ?? 200;
    const totalRecharged = wallet?.totalRecharged ?? 0;
    const totalCommissionPaid = wallet?.totalCommissionPaid ?? 0;

    let totalCredits = 0;
    let totalDebits = 0;

    transactions.forEach((t) => {
      const isCredit =
        t.direction?.toUpperCase() === 'CREDIT' ||
        t.transactionType === 'RECHARGE' ||
        t.transactionType === 'REFUND' ||
        t.transactionType === 'BONUS_CREDIT' ||
        t.transactionType === 'BONUS' ||
        (t.transactionType || '').toUpperCase().includes('CREDIT') ||
        (t.description || '').toLowerCase().includes('credit') ||
        (t.description || '').toLowerCase().includes('bonus') ||
        (t.description || '').toLowerCase().includes('complimentary');
      if (isCredit) {
        totalCredits += t.amount;
      } else {
        totalDebits += t.amount;
      }
    });

    const isLowBalance = currentBalance <= threshold;
    const statusText = currentBalance <= 0 ? 'EXHAUSTED' : isLowBalance ? 'LOW BALANCE' : 'HEALTHY';
    const statusColor = currentBalance <= 0 ? '#DC2626' : isLowBalance ? '#DE8626' : '#17845A';
    const statusBg = currentBalance <= 0 ? '#FEE2E2' : isLowBalance ? '#FFF0DE' : '#E4F5EC';

    const transactionRows = transactions.length === 0
      ? `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #78716C; font-style: italic;">No ledger transactions recorded for this period.</td></tr>`
      : transactions
          .map((txn, index) => {
            const isCredit =
              txn.direction?.toUpperCase() === 'CREDIT' ||
              txn.transactionType === 'RECHARGE' ||
              txn.transactionType === 'REFUND' ||
              txn.transactionType === 'BONUS_CREDIT' ||
              txn.transactionType === 'BONUS' ||
              (txn.transactionType || '').toUpperCase().includes('CREDIT') ||
              (txn.description || '').toLowerCase().includes('credit') ||
              (txn.description || '').toLowerCase().includes('bonus') ||
              (txn.description || '').toLowerCase().includes('complimentary');
            const txnDate = new Date(txn.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const txnTime = new Date(txn.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const typeBadgeColor = isCredit ? '#17845A' : '#DC2626';
            const typeBadgeBg = isCredit ? '#E4F5EC' : '#FEE2E2';

            return `
              <tr style="border-bottom: 1px solid #E7E1DA;">
                <td style="padding: 10px 8px; font-size: 11px; color: #78716C; text-align: center;">${index + 1}</td>
                <td style="padding: 10px 8px; font-size: 11px; color: #1F2937;">
                  <div style="font-weight: 700;">${txnDate}</div>
                  <div style="font-size: 10px; color: #78716C;">${txnTime}</div>
                </td>
                <td style="padding: 10px 8px;">
                  <span style="background-color: ${typeBadgeBg}; color: ${typeBadgeColor}; font-size: 9px; font-weight: 800; padding: 3px 7px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
                    ${txn.transactionType}
                  </span>
                </td>
                <td style="padding: 10px 8px; font-size: 11px; color: #1F2937;">
                  <div style="font-weight: 600;">${txn.description || 'Wallet Transaction'}</div>
                  ${txn.paymentReference ? `<div style="font-size: 9px; color: #8C7A6B; font-family: monospace;">Ref: ${txn.paymentReference}</div>` : ''}
                </td>
                <td style="padding: 10px 8px; font-size: 12px; font-weight: 800; text-align: right; color: ${isCredit ? '#17845A' : '#DC2626'};">
                  ${isCredit ? '+' : '-'}₹${txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style="padding: 10px 8px; font-size: 12px; font-weight: 700; text-align: right; color: #1F2937;">
                  ₹${txn.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `;
          })
          .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Menza Wallet Statement - ${restaurantName}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FAF7F2;
            color: #1F2937;
            padding: 30px 24px;
            font-size: 12px;
            line-height: 1.4;
          }
          .statement-container {
            max-width: 800px;
            margin: 0 auto;
            background: #FFFFFF;
            border-radius: 12px;
            border: 1.5px solid #E7E1DA;
            padding: 28px;
            box-shadow: 0 4px 16px rgba(60, 47, 0, 0.06);
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #DE8626;
            padding-bottom: 18px;
            margin-bottom: 20px;
          }
          .brand-logo-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-badge {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #DE8626, #CB741B);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: -1px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            color: #1F2937;
            letter-spacing: -0.3px;
          }
          .brand-subtitle {
            font-size: 11px;
            color: #78716C;
            font-weight: 600;
          }
          .statement-tag {
            text-align: right;
          }
          .statement-badge {
            background-color: #FFF0DE;
            border: 1px solid rgba(222, 134, 38, 0.4);
            color: #D96B14;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            display: inline-block;
            margin-bottom: 4px;
          }
          .meta-text {
            font-size: 10px;
            color: #78716C;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
            background-color: #FAF7F2;
            border-radius: 8px;
            border: 1px solid #E7E1DA;
            padding: 14px;
          }
          .info-col h4 {
            font-size: 10px;
            color: #78716C;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .info-col p {
            font-size: 12px;
            font-weight: 700;
            color: #1F2937;
          }
          .info-col span {
            font-size: 11px;
            color: #5C4E3D;
          }
          .bento-metrics {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 24px;
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
          .bento-value.highlight {
            color: #DE8626;
          }
          .bento-value.green {
            color: #17845A;
          }
          .bento-value.red {
            color: #DC2626;
          }
          .table-title {
            font-size: 13px;
            font-weight: 800;
            color: #1F2937;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .table-title span {
            font-size: 10px;
            font-weight: 600;
            color: #78716C;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          th {
            background-color: #FAF7F2;
            color: #5C4E3D;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 10px 8px;
            border-bottom: 1.5px solid #E7E1DA;
            border-top: 1px solid #E7E1DA;
          }
          .footer-section {
            border-top: 1px solid #E7E1DA;
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #78716C;
          }
          .security-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #17845A;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="statement-container">
          <!-- Header Row -->
          <div class="header-row">
            <div class="brand-logo-title">
              <div class="logo-badge">M</div>
              <div>
                <div class="brand-title">${restaurantName}</div>
                <div class="brand-subtitle">Commission Wallet Ledger & Statement</div>
              </div>
            </div>
            <div class="statement-tag">
              <div class="statement-badge">Official Statement</div>
              <div class="meta-text">Generated: ${formattedDate} at ${formattedTime}</div>
              ${generatedBy ? `<div class="meta-text">Account: ${generatedBy}</div>` : ''}
            </div>
          </div>

          <!-- Outlet & Account Information -->
          <div class="info-grid">
            <div class="info-col">
              <h4>Store Location</h4>
              <p>${restaurantName}</p>
              <span>Outlet ID: #${restaurantId}</span><br />
              ${outletAddress ? `<span>${outletAddress}</span>` : ''}
            </div>
            <div class="info-col">
              <h4>Wallet Account Status</h4>
              <p style="color: ${statusColor}; font-weight: 800;">● ${statusText}</p>
              <span>Low Balance Alert Threshold: ₹${threshold.toLocaleString('en-IN')}</span><br />
              ${contactNumber ? `<span>Contact: +91 ${contactNumber}</span>` : ''}
            </div>
          </div>

          <!-- Bento Metric Cards -->
          <div class="bento-metrics">
            <div class="bento-card" style="border-color: rgba(222, 134, 38, 0.4); background: #FFFDF9;">
              <div class="bento-label">Current Balance</div>
              <div class="bento-value highlight">₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="bento-card">
              <div class="bento-label">Total Recharged</div>
              <div class="bento-value green">+₹${(totalRecharged || totalCredits).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="bento-card">
              <div class="bento-label">Commission Paid</div>
              <div class="bento-value red">-₹${(totalCommissionPaid || totalDebits).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="bento-card">
              <div class="bento-label">Ledger Entries</div>
              <div class="bento-value">${transactions.length}</div>
            </div>
          </div>

          <!-- Transactions Table -->
          <div class="table-title">
            <span>TRANSACTION HISTORY</span>
            <span>Showing ${transactions.length} Entries</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="width: 105px; text-align: left;">Date & Time</th>
                <th style="width: 90px; text-align: left;">Type</th>
                <th style="text-align: left;">Description / Reference</th>
                <th style="width: 100px; text-align: right;">Amount</th>
                <th style="width: 105px; text-align: right;">Bal. After</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
            </tbody>
          </table>

          <!-- Footer -->
          <div class="footer-section">
            <div>
              <strong>Menza Hospitality SaaS POS</strong> • Multi-Store POS & Commission Engine<br />
              This is a digitally generated financial statement and does not require a physical signature.
            </div>
            <div class="security-badge">
              ✓ Verified Ledger
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates and exports/shares the PDF statement
   */
  static async exportAndSharePdf(options: GenerateLedgerPdfOptions): Promise<{ success: boolean; uri?: string }> {
    try {
      const html = this.generateLedgerHtml(options);
      const fileName = `Menza_Wallet_Ledger_Rest_${options.restaurantId}_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return { success: true };
      }

      // Generate local PDF file
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
        Alert.alert('PDF Created', `Wallet statement PDF saved at:\n${uri}`);
      }

      return { success: true, uri };
    } catch (error: any) {
      console.error('Failed to export PDF statement:', error);
      throw new Error(error?.message || 'Could not generate PDF statement.');
    }
  }
}
