import { apiClient } from '@shared/core/network/apiClient';

export interface RestaurantWalletDTO {
  restaurantId: number;
  balance: number;
  lowBalanceThreshold: number;
  totalRecharged: number;
  totalCommissionPaid: number;
  status: 'HEALTHY' | 'LOW_BALANCE' | 'EXHAUSTED' | string;
  currency: string;
  lastUpdated: string;
}

export interface WalletTransactionDTO {
  id: string;
  transactionType: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  paymentReference?: string;
  createdAt: string;
}

export interface WalletStatementResponseDTO {
  totalCount: number;
  items: WalletTransactionDTO[];
}

export class WebWalletService {
  static async getWallet(restaurantId: number): Promise<RestaurantWalletDTO> {
    if (!restaurantId || restaurantId <= 0) {
      return {
        restaurantId: 0,
        balance: 0,
        lowBalanceThreshold: 200,
        totalRecharged: 0,
        totalCommissionPaid: 0,
        status: 'EXHAUSTED',
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
      };
    }

    try {
      const response = await apiClient.get(`/Restaurant/${restaurantId}/Wallet`, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const data = response.data || {};
      const balance = Number(data.balance ?? data.Balance ?? 0);
      const threshold = Number(data.lowBalanceThreshold ?? data.LowBalanceThreshold ?? 200);

      return {
        restaurantId,
        balance,
        lowBalanceThreshold: threshold,
        totalRecharged: Number(data.totalRecharged ?? data.TotalRecharged ?? 0),
        totalCommissionPaid: Number(data.totalCommissionPaid ?? data.TotalCommissionPaid ?? 0),
        status: balance <= 0 ? 'EXHAUSTED' : balance < threshold ? 'LOW_BALANCE' : 'HEALTHY',
        currency: data.currency || 'INR',
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    } catch {
      return {
        restaurantId,
        balance: 0,
        lowBalanceThreshold: 200,
        totalRecharged: 0,
        totalCommissionPaid: 0,
        status: 'EXHAUSTED',
        currency: 'INR',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  static async getStatement(
    restaurantId: number,
    fromDate?: string,
    toDate?: string,
    pageNumber: number = 1,
    pageSize: number = 30
  ): Promise<WalletTransactionDTO[]> {
    if (!restaurantId || restaurantId <= 0) return [];
    try {
      const params: Record<string, any> = { pageNumber, pageSize };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const response = await apiClient.get(`/Restaurant/${restaurantId}/Wallet/Statement`, {
        params,
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });

      const rawItems = response.data?.items || response.data?.Items || (Array.isArray(response.data) ? response.data : []);
      return rawItems.map((t: any) => ({
        id: String(t.id || t.Id || t.transactionId || `WTX_${Math.random()}`),
        transactionType: t.transactionType || t.TransactionType || (t.direction === 'CREDIT' ? 'RECHARGE' : 'ORDER_COMMISSION'),
        direction: (t.direction || t.Direction || 'DEBIT').toUpperCase(),
        amount: Number(t.amount ?? t.Amount ?? 0),
        balanceBefore: Number(t.balanceBefore ?? t.BalanceBefore ?? 0),
        balanceAfter: Number(t.balanceAfter ?? t.BalanceAfter ?? 0),
        description: t.description || t.Description || 'Wallet Ledger',
        paymentReference: t.paymentReference || t.PaymentReference || t.orderId || t.OrderId,
        createdAt: t.createdAt || t.CreatedAt || t.transactionDate || t.TransactionDate || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
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
