import { apiClient } from '../../core/network/apiClient';
import { SubscriptionPlan, UserSubscriptionStatus } from '../../domain/models/Subscription';
import { useAuthStore } from '../../presentation/state/useAuthStore';

export class SubscriptionRemoteDataSource {
  async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await apiClient.get('/Subscription/Configuration?includeInactive=true');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list.map((item: any) => {
        const entitlements = item.entitlements || item.Entitlements || [];
        const checkEntitlement = (key: string) => {
          const e = entitlements.find((x: any) => (x.configKey || x.ConfigKey || '').toLowerCase() === key.toLowerCase());
          return e ? Boolean(e.isAllowed ?? e.IsAllowed) : true;
        };
        return {
          id: item.id || item.Id || 0,
          subscriptionCode: item.subscriptionCode || item.SubscriptionCode || '',
          subscriptionName: item.subscriptionName || item.SubscriptionName || item.planName || 'Plan',
          planName: item.subscriptionName || item.SubscriptionName || item.planName || 'Plan',
          price: Number(item.price ?? item.Price ?? 0),
          discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0),
          finalPrice: Number(item.finalPrice ?? item.FinalPrice ?? (Number(item.price ?? item.Price ?? 0) - Number(item.discountAmount ?? item.DiscountAmount ?? 0))),
          durationInDays: Number(item.durationInDays ?? item.DurationInDays ?? 30),
          durationDays: Number(item.durationInDays ?? item.DurationInDays ?? 30),
          billingCycle: item.billingCycle || item.BillingCycle || (item.durationInDays === 365 ? 'ANNUALLY' : item.durationInDays === 180 ? 'HALFYEARLY' : item.durationInDays === 90 ? 'QUARTERLY' : 'MONTHLY'),
          description: item.description || item.Description || '',
          commissionType: item.commissionType || item.CommissionType || 'PERCENTAGE',
          baseCommissionPercentage: Number(item.baseCommissionPercentage ?? item.BaseCommissionPercentage ?? 0),
          baseFlatCommissionPerOrder: Number(item.baseFlatCommissionPerOrder ?? item.BaseFlatCommissionPerOrder ?? 0),
          maxCommissionCapPerOrder: Number(item.maxCommissionCapPerOrder ?? item.MaxCommissionCapPerOrder ?? 0),
          includedWalletCredit: Number(item.includedWalletCredit ?? item.IncludedWalletCredit ?? 0),
          allowTableOrdering: checkEntitlement('IsTableOrderingEnabled'),
          allowCounterOrdering: checkEntitlement('IsCounterOrderingEnabled'),
          allowSelfPickup: checkEntitlement('IsSelfPickupEnabled'),
          allowDelivery: checkEntitlement('IsDeliveryEnabled'),
          allowKds: checkEntitlement('IsKdsEnabled'),
          allowOnlinePayment: checkEntitlement('AllowOnlinePayment'),
          isActive: Boolean(item.isActive ?? item.IsActive ?? true),
          entitlements: entitlements.map((e: any) => ({
            id: e.id || e.Id,
            subscriptionConfigurationId: e.subscriptionConfigurationId || e.SubscriptionConfigurationId,
            orderConfigId: e.orderConfigId || e.OrderConfigId,
            configKey: e.configKey || e.ConfigKey,
            isAllowed: Boolean(e.isAllowed ?? e.IsAllowed ?? true),
            featureCommissionPercentage: Number(e.featureCommissionPercentage ?? e.FeatureCommissionPercentage ?? 0),
            featureFlatFeePerOrder: Number(e.featureFlatFeePerOrder ?? e.FeatureFlatFeePerOrder ?? 0),
          })),
        };
      });
    } catch {
      return [];
    }
  }

  async createPlan(plan: Partial<SubscriptionPlan>): Promise<{ success: boolean; message?: string }> {
    try {
      const payload = {
        subscriptionCode: plan.subscriptionCode,
        subscriptionName: plan.subscriptionName || plan.planName,
        description: plan.description,
        durationInDays: plan.durationInDays || plan.durationDays || 30,
        billingCycle: plan.billingCycle || 'MONTHLY',
        price: plan.price,
        discountAmount: plan.discountAmount || 0,
        finalPrice: plan.finalPrice ?? Math.max(0, (plan.price || 0) - (plan.discountAmount || 0)),
        commissionType: plan.commissionType || 'PERCENTAGE',
        baseCommissionPercentage: plan.baseCommissionPercentage || 0,
        baseFlatCommissionPerOrder: plan.baseFlatCommissionPerOrder || 0,
        maxCommissionCapPerOrder: plan.maxCommissionCapPerOrder || 0,
        includedWalletCredit: plan.includedWalletCredit || 0,
        isActive: plan.isActive ?? true,
        entitlements: (plan.entitlements || []).map((e) => ({
          orderConfigId: e.orderConfigId,
          configKey: e.configKey,
          isAllowed: e.isAllowed,
          featureCommissionPercentage: e.featureCommissionPercentage || 0,
          featureFlatFeePerOrder: e.featureFlatFeePerOrder || 0,
        })),
      };
      const response = await apiClient.post('/Subscription/Configuration', payload);
      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: response.data?.message || 'Subscription configuration created successfully.',
        };
      }
      return {
        success: false,
        message: response.data?.message || 'Failed to create subscription configuration.',
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to create subscription configuration.');
      return { success: false, message };
    }
  }

  async togglePlanStatus(id: number, isActive: boolean): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.put(`/Subscription/Configuration/${id}/Status`, isActive, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.status === 200) {
        return {
          success: true,
          message: response.data?.message || `Plan ${isActive ? 'activated' : 'deactivated'} successfully.`,
        };
      }
      return { success: false, message: response.data?.message || 'Failed to update plan status.' };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to update plan status.');
      return { success: false, message };
    }
  }

  async updatePlan(id: number, plan: Partial<SubscriptionPlan>): Promise<boolean> {
    try {
      const payload = {
        subscriptionCode: plan.subscriptionCode,
        SubscriptionCode: plan.subscriptionCode,
        subscriptionName: plan.subscriptionName || plan.planName,
        SubscriptionName: plan.subscriptionName || plan.planName,
        description: plan.description,
        Description: plan.description,
        durationInDays: plan.durationInDays || plan.durationDays || 30,
        DurationInDays: plan.durationInDays || plan.durationDays || 30,
        billingCycle: plan.billingCycle || 'MONTHLY',
        BillingCycle: plan.billingCycle || 'MONTHLY',
        price: plan.price,
        Price: plan.price,
        discountAmount: plan.discountAmount || 0,
        DiscountAmount: plan.discountAmount || 0,
        finalPrice: plan.finalPrice ?? Math.max(0, (plan.price || 0) - (plan.discountAmount || 0)),
        FinalPrice: plan.finalPrice ?? Math.max(0, (plan.price || 0) - (plan.discountAmount || 0)),
        includedWalletCredit: plan.includedWalletCredit || 0,
        IncludedWalletCredit: plan.includedWalletCredit || 0,
        allowTableOrdering: plan.allowTableOrdering ?? true,
        AllowTableOrdering: plan.allowTableOrdering ?? true,
        allowSelfPickup: plan.allowSelfPickup ?? true,
        AllowSelfPickup: plan.allowSelfPickup ?? true,
        allowDelivery: plan.allowDelivery ?? true,
        AllowDelivery: plan.allowDelivery ?? true,
        allowKds: plan.allowKds ?? true,
        AllowKds: plan.allowKds ?? true,
        allowOnlinePayment: plan.allowOnlinePayment ?? true,
        AllowOnlinePayment: plan.allowOnlinePayment ?? true,
        isActive: plan.isActive ?? true,
        IsActive: plan.isActive ?? true,
      };
      const response = await apiClient.put(`/Subscription/Configuration/${id}`, payload);
      return response.status === 200 || response.status === 204;
    } catch {
      return false;
    }
  }

  async getMySubscription(): Promise<UserSubscriptionStatus | null> {
    const storeState = useAuthStore.getState();
    const activeRestId = storeState.activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
    if (!activeRestId || activeRestId <= 0) return null;
    return await this.getRestaurantSubscription(activeRestId);
  }

  async getRestaurantSubscription(restaurantId: number): Promise<UserSubscriptionStatus | null> {
    if (!restaurantId || restaurantId <= 0) return null;
    try {
      let activeItem: any = null;

      // 1. Primary: Try dedicated ActivePlan API endpoint by restaurantId
      try {
        const activeRes = await apiClient.get(`/Subscription/ActivePlan/Restaurant/${restaurantId}`);
        if (activeRes.status === 200 && activeRes.data) {
          activeItem = activeRes.data;
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          console.warn(`[SubscriptionRemoteDataSource] Access denied (403) for restaurant ${restaurantId}. User can only view their own restaurant.`);
          return null;
        }
        // ActivePlan returns 404 if no active subscription plan exists
      }

      // 2. Fallback: Query all restaurant subscriptions if ActivePlan endpoint returns 404
      if (!activeItem) {
        try {
          const response = await apiClient.get(`/Subscription/RestaurantSubscription/Restaurant/${restaurantId}`);
          const data = response.data;
          const list = Array.isArray(data) ? data : (data?.items || data?.data || (data && typeof data === 'object' ? [data] : []));
          if (Array.isArray(list) && list.length > 0) {
            activeItem = list.find((x: any) => (x.status || x.Status || '').toUpperCase() === 'ACTIVE');
          }
        } catch (err: any) {
          if (err.response?.status === 403) {
            return null;
          }
        }
      }

      if (activeItem) {
        const endDateStr = activeItem.endDate || activeItem.EndDate || activeItem.endDateUTC || activeItem.EndDateUTC || '';
        const endDate = endDateStr ? new Date(endDateStr) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const rawStatus = (activeItem.status || activeItem.Status || 'Active').toUpperCase();
        const isExpired = rawStatus === 'EXPIRED' || daysRemaining <= 0;

        return {
          subscriptionId: activeItem.id || activeItem.Id || activeItem.subscriptionConfigurationId || 1,
          subscriptionConfigurationId: activeItem.subscriptionConfigurationId || activeItem.SubscriptionConfigurationId || undefined,
          planName: activeItem.subscriptionName || activeItem.SubscriptionName || activeItem.planName || 'Active Subscription',
          startDate: activeItem.startDate || activeItem.StartDate || new Date().toISOString(),
          endDate: endDateStr || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isExpired: isExpired,
          daysRemaining: daysRemaining,
          status: isExpired ? 'Expired' : 'Active',
          entitlements: activeItem.entitlements || activeItem.Entitlements || [],
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async calculateOrderPlatformFee(restaurantId: number, orderAmount: number): Promise<{ platformFee: number; vendorPayout: number } | null> {
    if (!restaurantId || restaurantId <= 0 || orderAmount <= 0) return null;
    try {
      const response = await apiClient.get(`/Subscription/CalculateFee/Restaurant/${restaurantId}?orderAmount=${orderAmount}`);
      return {
        platformFee: Number(response.data?.platformFee ?? 0),
        vendorPayout: Number(response.data?.vendorPayout ?? orderAmount),
      };
    } catch {
      return null;
    }
  }

  private assigningLock = new Set<string>();
  private initiatingLock = new Set<string>();

  async assignSubscription(
    restaurantId: number,
    subscriptionConfigurationId: number,
    durationInDays: number = 30,
    amountPaid: number = 0
  ): Promise<{ success: boolean; message?: string }> {
    const lockKey = `${restaurantId}_${subscriptionConfigurationId}`;
    if (this.assigningLock.has(lockKey)) {
      return { success: true, message: 'Subscription activation already in progress.' };
    }
    this.assigningLock.add(lockKey);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + (durationInDays || 30));

      const payload = {
        restaurantId,
        subscriptionConfigurationId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        amountPaid,
        paymentReferenceNo: `SUB_PAY_${Date.now()}`,
        status: 'ACTIVE',
      };

      const response = await apiClient.post('/Subscription/RestaurantSubscription', payload);
      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: response.data?.message || 'Subscription plan activated successfully.',
        };
      }
      return { success: false, message: response.data?.message || 'Failed to activate subscription plan.' };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to activate subscription plan.');
      return { success: false, message };
    } finally {
      setTimeout(() => this.assigningLock.delete(lockKey), 2500);
    }
  }

  async createPaymentOrder(planId: number): Promise<{ cfOrderId: string; paymentSessionId: string }> {
    const response = await apiClient.post('/Subscription/CreatePaymentOrder', { planId });
    return response.data;
  }

  async verifyPayment(cfOrderId: string): Promise<boolean> {
    const response = await apiClient.post('/Subscription/VerifyPayment', { cfOrderId });
    return response.data?.success || false;
  }

  // CashFree Payment Gateway Integration Methods
  async initiateCashFreePayment(
    restaurantId: number,
    subscriptionConfigurationId: number,
    amount: number,
    mobileNumber?: string
  ): Promise<{ success: boolean; orderId: string; paymentSessionId?: string; instrumentResponseUrl?: string; message?: string }> {
    const lockKey = `${restaurantId}_${subscriptionConfigurationId}`;
    if (this.initiatingLock.has(lockKey)) {
      return { success: false, orderId: '', message: 'Payment initiation already in progress. Please wait.' };
    }
    this.initiatingLock.add(lockKey);
    try {
      const payload = {
        type: 1, // PaymentType.Subscription = 1
        Type: 1,
        restaurantId,
        RestaurantId: restaurantId,
        subscriptionConfigurationId,
        SubscriptionConfigurationId: subscriptionConfigurationId,
        amount,
        Amount: amount,
        ownerPhone: mobileNumber || '9999999999',
        OwnerPhone: mobileNumber || '9999999999',
        paymentPurpose: `Subscription Plan #${subscriptionConfigurationId} for Restaurant #${restaurantId}`,
        orderMeta: {
          returnUrl: 'https://admin.menza.com/payment-status?order_id={order_id}',
          notifyUrl: 'https://api.menza.com/api/CashFreepayment/webhook/cashfree',
          return_url: 'https://admin.menza.com/payment-status?order_id={order_id}',
          notify_url: 'https://api.menza.com/api/CashFreepayment/webhook/cashfree',
        },
      };

      const response = await apiClient.post('/CashFreepayment/create-order', payload);
      const data = response.data || {};
      const orderId = data.orderId || data.OrderId || data.order_id || data.cfOrderId || `ORD_SUB_${Date.now()}`;
      const paymentSessionId = data.paymentSessionId || data.PaymentSessionId || data.payment_session_id || '';
      const instrumentResponseUrl = data.paymentLink || data.PaymentLink || data.payment_link || data.instrumentResponseUrl || '';

      return {
        success: true,
        orderId,
        paymentSessionId,
        instrumentResponseUrl,
        message: data.message || 'Payment order created via CashFree',
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to initiate CashFree payment.');

      return {
        success: false,
        orderId: '',
        message,
      };
    } finally {
      setTimeout(() => this.initiatingLock.delete(lockKey), 2500);
    }
  }

  async verifyCashFreePayment(
    orderId: string,
    restaurantId: number,
    subscriptionConfigurationId: number,
    amountPaid: number
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/CashFreepayment/verify', {
        orderId,
        restaurantId,
        subscriptionConfigurationId,
        amountPaid,
      });
      const paymentStatus = (response.data?.paymentStatus || response.data?.status || '').toUpperCase();
      const isSuccess = paymentStatus === 'SUCCESS' || response.data?.success === true || response.data?.gatewayOrderStatus === 'PAID';

      return {
        success: isSuccess,
        message: isSuccess
          ? 'CashFree payment verified & subscription activated successfully.'
          : (response.data?.failureReason || 'CashFree verification pending or failed.'),
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'CashFree verification failed.');
      return { success: false, message };
    }
  }

  async getCashFreePaymentStatus(
    orderId: string
  ): Promise<{
    orderId: string;
    paymentStatus: string;
    gatewayOrderStatus?: string;
    transactionId?: string;
    amount?: number;
    failureReason?: string;
  }> {
    try {
      const response = await apiClient.get(`/CashFreepayment/status/${orderId}`);
      return {
        orderId: response.data?.orderId || orderId,
        paymentStatus: response.data?.paymentStatus || 'PENDING',
        gatewayOrderStatus: response.data?.gatewayOrderStatus || '',
        transactionId: response.data?.transactionId || '',
        amount: response.data?.amount || 0,
        failureReason: response.data?.failureReason || '',
      };
    } catch (error: any) {
      return {
        orderId,
        paymentStatus: 'ERROR',
        failureReason: error?.response?.data?.message || error.message || 'Status check failed',
      };
    }
  }

  async deletePlan(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.delete(`/Subscription/Configuration/${id}`);
      return {
        success: response.status === 200,
        message: response.data?.message || 'Subscription configuration deleted successfully.',
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      return { success: false, message: typeof serverMsg === 'string' ? serverMsg : 'Failed to delete plan.' };
    }
  }

  async getPlanById(id: number): Promise<SubscriptionPlan | null> {
    try {
      const response = await apiClient.get(`/Subscription/Configuration/${id}`);
      return response.data || null;
    } catch {
      return null;
    }
  }

  async getPlanByCode(code: string): Promise<SubscriptionPlan | null> {
    try {
      const response = await apiClient.get(`/Subscription/Configuration/Code/${code}`);
      return response.data || null;
    } catch {
      return null;
    }
  }

  async updateRestaurantSubscriptionStatus(id: number, status: string): Promise<boolean> {
    try {
      const response = await apiClient.put(`/Subscription/RestaurantSubscription/${id}/Status`, JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getAllRestaurantSubscriptions(): Promise<any[]> {
    try {
      const response = await apiClient.get('/Subscription/RestaurantSubscription');
      const data = response.data;
      return Array.isArray(data) ? data : (data?.items || data?.data || []);
    } catch {
      return [];
    }
  }

  async recordSubscriptionPayment(payment: {
    restaurantSubscriptionId: number;
    transactionId: string;
    amount: number;
    paymentMode?: string;
    paymentStatus?: string;
  }): Promise<boolean> {
    try {
      const response = await apiClient.post('/Subscription/Payment', {
        restaurantSubscriptionId: payment.restaurantSubscriptionId,
        transactionId: payment.transactionId,
        amount: payment.amount,
        paymentMode: payment.paymentMode || 'Cashfree',
        paymentStatus: payment.paymentStatus || 'SUCCESS',
      });
      return response.status === 200 || response.status === 201;
    } catch {
      return false;
    }
  }

  async getPaymentsBySubscriptionId(restaurantSubscriptionId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`/Subscription/Payment/Subscription/${restaurantSubscriptionId}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }

  async getAllPayments(): Promise<any[]> {
    try {
      const response = await apiClient.get('/Subscription/Payment');
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }
}
