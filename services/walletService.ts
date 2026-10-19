import { apiClient } from '@shared/core/network/apiClient';
import { WalletRemoteDataSource } from '@shared/data/datasources/WalletRemoteDataSource';
import { WalletRepositoryImpl } from '@shared/data/repositories/WalletRepositoryImpl';
import { IWalletRepository } from '@shared/domain/repositories/IWalletRepository';
import { PlatformGstInfo } from '@/types/wallet';

export const walletRemoteDataSource = new WalletRemoteDataSource();
export const walletRepository: IWalletRepository = new WalletRepositoryImpl(walletRemoteDataSource);

export interface WalletTransactionDTO {
  id: string;
  transactionType: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  orderId?: string;
  paymentReference?: string;
  invoiceNumber?: string;
  baseAmount?: number;
  taxAmount?: number;
  taxPercentage?: number;
  createdAt: string;
}

export interface RestaurantWalletDTO {
  restaurantId: number;
  balance: number;
  lowBalanceThreshold: number;
  totalRecharged: number;
  totalCommissionPaid: number;
  totalRefunded?: number;
  status: 'HEALTHY' | 'LOW_BALANCE' | 'EXHAUSTED' | string;
  currency: string;
  lastUpdated: string;
  restaurantName?: string;
  restaurantGstNumber?: string;
  platformGst?: PlatformGstInfo;
  recentTransactions?: WalletTransactionDTO[];
}

export interface WalletStatementResponseDTO {
  totalCount: number;
  items: WalletTransactionDTO[];
}

export class WebWalletService {
  private static mapTransactionDto(t: any): WalletTransactionDTO {
    const rawType = String(t.transactionType || t.TransactionType || '').trim();
    const rawDir = String(t.direction || t.Direction || '').trim().toUpperCase();
    const balanceBefore = Number(t.balanceBefore ?? t.BalanceBefore ?? 0);
    const balanceAfter = Number(t.balanceAfter ?? t.BalanceAfter ?? 0);
    const rawDesc = String(t.description || t.Description || t.reason || t.Reason || 'Wallet Ledger Entry');
    const desc = rawDesc.replace(/\bCommission\b/gi, 'Platform Fee');

    const upperType = rawType.toUpperCase();
    const lowerDesc = desc.toLowerCase();

    const isCredit =
      rawDir === 'CREDIT' ||
      (rawDir !== 'DEBIT' &&
        (upperType.includes('CREDIT') ||
          upperType.includes('RECHARGE') ||
          upperType.includes('REFUND') ||
          upperType.includes('BONUS') ||
          lowerDesc.includes('top-up') ||
          lowerDesc.includes('recharge') ||
          lowerDesc.includes('refund') ||
          lowerDesc.includes('bonus') ||
          (balanceAfter > balanceBefore && balanceBefore >= 0)));

    const direction: 'CREDIT' | 'DEBIT' =
      rawDir === 'CREDIT' || rawDir === 'DEBIT' ? rawDir : isCredit ? 'CREDIT' : 'DEBIT';

    const orderIdRaw = t.orderId ?? t.OrderId;
    const orderId = orderIdRaw !== undefined && orderIdRaw !== null && String(orderIdRaw).trim() !== ''
      ? String(orderIdRaw).trim()
      : undefined;

    const paymentRefRaw =
      t.paymentReference ||
      t.PaymentReference ||
      t.paymentGatewayRef ||
      t.PaymentGatewayRef ||
      (orderId ? `ORD-${orderId}` : undefined);

    const amount = Number(t.amount ?? t.Amount ?? 0);
    const rawInvoiceNo = t.invoiceNumber || t.InvoiceNumber || undefined;
    let invoiceNumber = rawInvoiceNo ? String(rawInvoiceNo).trim() : undefined;
    let cleanDesc = desc;

    // Fallback extraction if embedded in description: [INV:MZ/26-27/W00001]
    if (!invoiceNumber && desc.includes('[INV:')) {
      const match = desc.match(/\[INV:([^\]]+)\]/i);
      if (match && match[1]) {
        invoiceNumber = match[1].trim();
        cleanDesc = desc.replace(/\[INV:[^\]]+\]/i, '').trim();
      }
    }

    let baseAmount = t.baseAmount !== undefined && t.baseAmount !== null
      ? Number(t.baseAmount)
      : t.BaseAmount !== undefined && t.BaseAmount !== null
      ? Number(t.BaseAmount)
      : undefined;

    let taxAmount = t.taxAmount !== undefined && t.taxAmount !== null
      ? Number(t.taxAmount)
      : t.TaxAmount !== undefined && t.TaxAmount !== null
      ? Number(t.TaxAmount)
      : undefined;

    let taxPercentage = t.taxPercentage !== undefined && t.taxPercentage !== null
      ? Number(t.taxPercentage)
      : t.TaxPercentage !== undefined && t.TaxPercentage !== null
      ? Number(t.TaxPercentage)
      : undefined;

    if (isCredit && amount > 0) {
      if (baseAmount === undefined) {
        baseAmount = Math.round((amount / 1.18) * 100) / 100;
      }
      if (taxAmount === undefined) {
        taxAmount = Math.round((amount - baseAmount) * 100) / 100;
      }
      if (taxPercentage === undefined) {
        taxPercentage = 18;
      }
    }

    return {
      id: String(t.id || t.Id || t.transactionId || `WTX_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      transactionType: rawType || (direction === 'CREDIT' ? 'RECHARGE' : 'PLATFORM_FEE'),
      direction,
      amount,
      balanceBefore,
      balanceAfter,
      description: cleanDesc,
      orderId,
      paymentReference: paymentRefRaw ? String(paymentRefRaw) : undefined,
      invoiceNumber,
      baseAmount,
      taxAmount,
      taxPercentage,
      createdAt: t.createdAt || t.CreatedAt || t.transactionDate || t.TransactionDate || new Date().toISOString(),
    };
  }

  static async getWallet(restaurantId: number): Promise<RestaurantWalletDTO> {
    if (!restaurantId || restaurantId <= 0) {
      return {
        restaurantId: 0,
        balance: 0,
        lowBalanceThreshold: 200,
        totalRecharged: 0,
        totalCommissionPaid: 0,
        totalRefunded: 0,
        status: 'EXHAUSTED',
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        recentTransactions: [],
      };
    }

    try {
      const response = await apiClient.get(`/Restaurant/${restaurantId}/Wallet`, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const data = response.data?.data || response.data || {};
      const balance = Number(data.balance ?? data.Balance ?? 0);
      const threshold = Number(data.lowBalanceThreshold ?? data.LowBalanceThreshold ?? 200);
      const rawRecent = data.recentTransactions || data.RecentTransactions || [];
      const recentTransactions = Array.isArray(rawRecent)
        ? rawRecent.map((t: any) => this.mapTransactionDto(t))
        : [];

      return {
        restaurantId,
        balance,
        lowBalanceThreshold: threshold,
        totalRecharged: Number(data.totalRecharged ?? data.TotalRecharged ?? 0),
        totalCommissionPaid: Number(data.totalCommissionPaid ?? data.TotalCommissionPaid ?? 0),
        totalRefunded: Number(data.totalRefunded ?? data.TotalRefunded ?? 0),
        status: balance <= 0 ? 'EXHAUSTED' : balance < threshold ? 'LOW_BALANCE' : 'HEALTHY',
        currency: data.currency || data.Currency || 'INR',
        lastUpdated: data.lastUpdated || data.LastUpdated || new Date().toISOString(),
        restaurantName: data.restaurantName || data.RestaurantName || undefined,
        restaurantGstNumber: data.restaurantGstNumber || data.RestaurantGstNumber || undefined,
        platformGst: data.platformGst || data.PlatformGst || undefined,
        recentTransactions,
      };
    } catch {
      return {
        restaurantId,
        balance: 0,
        lowBalanceThreshold: 200,
        totalRecharged: 0,
        totalCommissionPaid: 0,
        totalRefunded: 0,
        status: 'EXHAUSTED',
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
        recentTransactions: [],
      };
    }
  }

  private static parseFilterDateBounds(fromDate?: string, toDate?: string): {
    fromMs?: number;
    toMs?: number;
    fromIso?: string;
    toIso?: string;
  } {
    let fromMs: number | undefined;
    let toMs: number | undefined;

    if (fromDate && fromDate.trim()) {
      const s = fromDate.trim();
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const d = ymd
        ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0)
        : new Date(s);
      if (!isNaN(d.getTime())) {
        fromMs = d.getTime();
      }
    }

    if (toDate && toDate.trim()) {
      const s = toDate.trim();
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const d = ymd
        ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 23, 59, 59, 999)
        : new Date(s);
      if (!isNaN(d.getTime())) {
        toMs = d.getTime();
      }
    }

    if (fromMs !== undefined && toMs !== undefined && fromMs > toMs) {
      const tmp = fromMs;
      fromMs = new Date(toMs).setHours(0, 0, 0, 0);
      toMs = new Date(tmp).setHours(23, 59, 59, 999);
    }

    return {
      fromMs,
      toMs,
      fromIso: fromMs !== undefined ? new Date(fromMs).toISOString() : undefined,
      toIso: toMs !== undefined ? new Date(toMs).toISOString() : undefined,
    };
  }

  private static filterTransactionsList(
    items: WalletTransactionDTO[],
    fromMs?: number,
    toMs?: number,
    direction?: string,
    transactionType?: string
  ): WalletTransactionDTO[] {
    return items.filter((tx) => {
      if (fromMs !== undefined || toMs !== undefined) {
        const txTime = new Date(tx.createdAt).getTime();
        if (!isNaN(txTime)) {
          if (fromMs !== undefined && txTime < fromMs) return false;
          if (toMs !== undefined && txTime > toMs) return false;
        }
      }
      if (direction && direction.trim()) {
        if (tx.direction.toUpperCase() !== direction.trim().toUpperCase()) return false;
      }
      if (transactionType && transactionType.trim()) {
        const want = transactionType.trim().toUpperCase();
        const actual = (tx.transactionType || '').toUpperCase();
        if (!actual.includes(want)) return false;
      }
      return true;
    });
  }

  static async getStatement(
    restaurantId: number,
    fromDate?: string,
    toDate?: string,
    pageNumber: number = 1,
    pageSize: number = 100,
    direction?: string,
    transactionType?: string
  ): Promise<WalletTransactionDTO[]> {
    if (!restaurantId || restaurantId <= 0) return [];

    const { fromMs, toMs, fromIso, toIso } = this.parseFilterDateBounds(fromDate, toDate);

    try {
      const params: Record<string, any> = { pageNumber, pageSize };
      if (fromIso) params.fromDate = fromIso;
      if (toIso) params.toDate = toIso;
      if (direction) params.direction = direction;
      if (transactionType) params.transactionType = transactionType;

      const response = await apiClient.get(`/Restaurant/${restaurantId}/Wallet/Statement`, {
        params,
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });

      const payload = response.data?.data || response.data;
      const rawItems =
        payload?.transactions ||
        payload?.Transactions ||
        payload?.items ||
        payload?.Items ||
        (Array.isArray(payload) ? payload : null);

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const mapped = rawItems.map((t: any) => this.mapTransactionDto(t));
        return this.filterTransactionsList(mapped, fromMs, toMs, direction, transactionType);
      }
    } catch {
      // Fall through to getWallet recentTransactions fallback
    }

    // Fallback to recentTransactions from main Wallet endpoint, filtered by the requested criteria
    try {
      const wallet = await this.getWallet(restaurantId);
      if (wallet.recentTransactions && wallet.recentTransactions.length > 0) {
        return this.filterTransactionsList(
          wallet.recentTransactions,
          fromMs,
          toMs,
          direction,
          transactionType
        );
      }
    } catch {}

    return [];
  }

  static async exportStatementCsv(
    restaurantId: number,
    fromDate?: string,
    toDate?: string
  ): Promise<string> {
    if (!restaurantId || restaurantId <= 0) return '';
    const { fromIso, toIso } = this.parseFilterDateBounds(fromDate, toDate);
    return await walletRepository.exportStatement(restaurantId, fromIso || fromDate, toIso || toDate);
  }

  static async initiateRecharge(
    restaurantId: number,
    amount: number,
    ownerPhone: string = '9999999999'
  ): Promise<{
    success: boolean;
    orderId?: string;
    paymentSessionId?: string;
    paymentLink?: string;
    gateway?: string;
    keyId?: string;
    amount?: number;
    currency?: string;
    message?: string;
  }> {
    try {
      const payload = {
        type: 4, // PaymentType.Wallet = 4
        Type: 4,
        restaurantId,
        RestaurantId: restaurantId,
        amount,
        Amount: amount,
        ownerPhone,
        OwnerPhone: ownerPhone,
        paymentPurpose: `Platform Fee Wallet Top-up (₹${amount}) for Restaurant #${restaurantId}`,
        orderMeta: {
          returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/wallet` : 'https://menza-web.vercel.app/wallet',
          notifyUrl: 'https://api.menza.com/api/CashFreepayment/webhook/cashfree',
        },
      };

      const response = await apiClient.post('/CashFreepayment/create-order', payload, {
        headers: {
          'X-Restaurant-Id': restaurantId.toString(),
          'X-Payment-Gateway': 'Razorpay',
        },
      });

      const data = response.data || {};
      const orderId = data.orderId || data.OrderId || data.cfOrderId || `ORD_WAL_${restaurantId}_${Date.now()}`;
      const paymentSessionId = data.paymentSessionId || data.PaymentSessionId || '';
      const paymentLink = data.paymentLink || data.PaymentLink || data.instrumentResponseUrl || '';
      const gateway = data.gateway || data.Gateway || (data.keyId ? 'Razorpay' : 'Cashfree');
      const keyId = data.keyId || data.KeyId;

      return {
        success: true,
        orderId,
        paymentSessionId,
        paymentLink,
        gateway,
        keyId,
        amount,
        currency: data.currency || 'INR',
        message: data.message || 'Wallet recharge order created',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to initiate wallet recharge',
      };
    }
  }

  static async verifyRecharge(
    orderId: string,
    restaurantId: number,
    amountPaid: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/CashFreepayment/verify', {
        orderId,
        restaurantId,
        amountPaid,
        type: 4,
        razorpayPaymentId,
        razorpaySignature,
      });

      const paymentStatus = (response.data?.paymentStatus || response.data?.status || '').toUpperCase();
      const isSuccess = paymentStatus === 'SUCCESS' || response.data?.success === true || response.data?.gatewayOrderStatus === 'PAID';

      return {
        success: isSuccess,
        message: isSuccess ? 'Wallet recharged successfully!' : (response.data?.failureReason || 'Recharge verification pending.'),
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Wallet recharge verification failed.',
      };
    }
  }
}
