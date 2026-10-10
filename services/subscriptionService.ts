import { apiClient } from '@/lib/api/client';
import { SubscriptionPlan, UserSubscriptionStatus, RestaurantSubscriptionHistory } from '@/types/subscription';

export class SubscriptionService {
  static async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await apiClient.get('/Subscription/Configuration?includeInactive=true');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list.map((item: any) => {
        const entitlements = item.entitlements || item.Entitlements || [];
        const checkEntitlement = (key: string) => {
          const e = entitlements.find(
            (x: any) => (x.configKey || x.ConfigKey || '').toLowerCase() === key.toLowerCase()
          );
          return e ? Boolean(e.isAllowed ?? e.IsAllowed) : true;
        };
        const price = Number(item.price ?? item.Price ?? 0);
        const discountAmount = Number(item.discountAmount ?? item.DiscountAmount ?? 0);

        return {
          id: item.id || item.Id || 0,
          planId: item.id || item.Id || 0,
          subscriptionCode: item.subscriptionCode || item.SubscriptionCode || '',
          subscriptionName: item.subscriptionName || item.SubscriptionName || item.planName || 'Plan',
          planName: item.subscriptionName || item.SubscriptionName || item.planName || 'Plan',
          price,
          discountAmount,
          finalPrice: Number(item.finalPrice ?? item.FinalPrice ?? Math.max(0, price - discountAmount)),
          durationInDays: Number(item.durationInDays ?? item.DurationInDays ?? 30),
          durationDays: Number(item.durationInDays ?? item.DurationInDays ?? 30),
          billingCycle:
            item.billingCycle ||
            item.BillingCycle ||
            (item.durationInDays === 365
              ? 'ANNUALLY'
              : item.durationInDays === 180
              ? 'HALFYEARLY'
              : item.durationInDays === 90
              ? 'QUARTERLY'
              : 'MONTHLY'),
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

  static async getRestaurantSubscription(restaurantId: number): Promise<UserSubscriptionStatus | null> {
    if (!restaurantId || restaurantId <= 0) return null;
    try {
      let activeItem: any = null;

      try {
        const activeRes = await apiClient.get(`/Subscription/ActivePlan/Restaurant/${restaurantId}`);
        if (activeRes.status === 200 && activeRes.data) {
          activeItem = activeRes.data;
        }
      } catch (err: any) {
        if (err.response?.status === 403) return null;
      }

      if (!activeItem) {
        try {
          const response = await apiClient.get(`/Subscription/RestaurantSubscription/Restaurant/${restaurantId}`);
          const data = response.data;
          const list = Array.isArray(data) ? data : (data?.items || data?.data || (data && typeof data === 'object' ? [data] : []));
          if (Array.isArray(list) && list.length > 0) {
            const sortedList = [...list].sort((a: any, b: any) => {
              const startA = new Date(a.startDate || a.StartDate || 0).getTime();
              const startB = new Date(b.startDate || b.StartDate || 0).getTime();
              if (startB !== startA) return startB - startA;
              const idA = Number(a.id || a.Id || 0);
              const idB = Number(b.id || b.Id || 0);
              return idB - idA;
            });
            activeItem = sortedList.find((x: any) => {
              const st = (x.status || x.Status || '').toUpperCase();
              return st === 'ACTIVE' || st === 'GRACE_PERIOD';
            }) || sortedList[0];
          }
        } catch (err: any) {
          if (err.response?.status === 403) return null;
        }
      }

      if (activeItem) {
        const endDateStr = activeItem.endDate || activeItem.EndDate || activeItem.endDateUTC || activeItem.EndDateUTC || '';
        const endDate = endDateStr ? new Date(endDateStr) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rawStatus = (activeItem.status || activeItem.Status || 'Active').toUpperCase();

        const graceEnd = new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isInGracePeriod =
          activeItem.isInGracePeriod ??
          (rawStatus === 'GRACE_PERIOD' || (now > endDate && now <= graceEnd));

        const graceDaysRemaining =
          activeItem.graceDaysRemaining ??
          (isInGracePeriod ? Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0);

        const isExpired =
          activeItem.isSubscriptionExpired ??
          (rawStatus === 'EXPIRED' || (!isInGracePeriod && now > graceEnd && daysRemaining <= 0));

        let lifecycleState: any = activeItem.lifecycleState || activeItem.LifecycleState;
        if (!lifecycleState) {
          if (rawStatus === 'PENDING') lifecycleState = 'PENDING';
          else if (rawStatus === 'UPGRADED') lifecycleState = 'UPGRADED';
          else if (rawStatus === 'CANCELLED') lifecycleState = 'CANCELLED';
          else if (isExpired) lifecycleState = 'EXPIRED';
          else if (isInGracePeriod) lifecycleState = 'GRACE_PERIOD';
          else lifecycleState = 'ACTIVE';
        }

        const hasQueuedRenewal = Boolean(activeItem.hasQueuedRenewal ?? activeItem.HasQueuedRenewal);
        const effectiveCoverageEndDate = activeItem.effectiveCoverageEndDate || activeItem.EffectiveCoverageEndDate || endDateStr;
        const totalDaysRemaining = Number(activeItem.totalDaysRemaining ?? activeItem.TotalDaysRemaining ?? daysRemaining);
        const currentCycleDaysRemaining = Number(activeItem.currentCycleDaysRemaining ?? activeItem.CurrentCycleDaysRemaining ?? daysRemaining);
        const queuedRenewalDays = Number(activeItem.queuedRenewalDays ?? activeItem.QueuedRenewalDays ?? 0);

        return {
          subscriptionId: activeItem.id || activeItem.Id || activeItem.subscriptionConfigurationId || 1,
          subscriptionConfigurationId: activeItem.subscriptionConfigurationId || activeItem.SubscriptionConfigurationId || undefined,
          planName: activeItem.subscriptionName || activeItem.SubscriptionName || activeItem.planName || 'Active Subscription',
          startDate: activeItem.startDate || activeItem.StartDate || new Date().toISOString(),
          endDate: endDateStr || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isExpired,
          daysRemaining: hasQueuedRenewal ? totalDaysRemaining : daysRemaining,
          isInGracePeriod,
          graceDaysRemaining,
          lifecycleState,
          status: isExpired ? 'Expired' : isInGracePeriod ? 'Grace Period' : rawStatus === 'PENDING' ? 'Pending' : 'Active',
          amountPaid: Number(activeItem.amountPaid ?? activeItem.AmountPaid ?? 0),
          paymentReferenceNo: activeItem.paymentReferenceNo || activeItem.PaymentReferenceNo,
          entitlements: activeItem.entitlements || activeItem.Entitlements || [],
          hasQueuedRenewal,
          effectiveCoverageEndDate,
          totalDaysRemaining: hasQueuedRenewal ? totalDaysRemaining : daysRemaining,
          currentCycleDaysRemaining: hasQueuedRenewal ? currentCycleDaysRemaining : daysRemaining,
          queuedRenewalDays,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  static async getActivePlan(restaurantId: number): Promise<UserSubscriptionStatus | null> {
    return this.getRestaurantSubscription(restaurantId);
  }

  static async createPlan(plan: Partial<SubscriptionPlan>): Promise<{ success: boolean; message?: string }> {
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

  static async togglePlanStatus(id: number, isActive: boolean): Promise<{ success: boolean; message?: string }> {
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

  static async updatePlan(id: number, plan: Partial<SubscriptionPlan>): Promise<boolean> {
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
        includedWalletCredit: plan.includedWalletCredit || 0,
        allowTableOrdering: plan.allowTableOrdering ?? true,
        allowSelfPickup: plan.allowSelfPickup ?? true,
        allowDelivery: plan.allowDelivery ?? true,
        allowKds: plan.allowKds ?? true,
        allowOnlinePayment: plan.allowOnlinePayment ?? true,
        isActive: plan.isActive ?? true,
      };
      const response = await apiClient.put(`/Subscription/Configuration/${id}`, payload);
      return response.status === 200 || response.status === 204;
    } catch {
      return false;
    }
  }

  static async deletePlan(id: number): Promise<{ success: boolean; message?: string }> {
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

  static async assignSubscription(
    restaurantId: number,
    subscriptionConfigurationId: number,
    durationInDays: number = 30,
    amountPaid: number = 0
  ): Promise<{ success: boolean; message?: string }> {
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
        paymentReferenceNo: `SUB_WEB_${Date.now()}`,
        status: 'ACTIVE',
      };

      const response = await apiClient.post('/Subscription/RestaurantSubscription', payload);
      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: response.data?.message || 'Subscription activated successfully.',
        };
      }
      return { success: false, message: response.data?.message || 'Failed to activate subscription.' };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to activate subscription.');
      return { success: false, message };
    }
  }

  static async getSubscriptionHistory(restaurantId: number): Promise<RestaurantSubscriptionHistory[]> {
    try {
      const response = await apiClient.get(`/Subscription/History/Restaurant/${restaurantId}`);
      const data = response.data;
      return Array.isArray(data) ? data : (data?.items || data?.data || []);
    } catch {
      return [];
    }
  }

  static async initiateCashFreePayment(
    restaurantId: number,
    subscriptionConfigurationId: number,
    amount: number,
    mobileNumber?: string
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
          returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/settings/billing` : 'https://menza-web.vercel.app/settings/billing',
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
      const orderId = data.orderId || data.OrderId || data.order_id || data.cfOrderId || `ORD_SUB_${Date.now()}`;
      const paymentSessionId = data.paymentSessionId || data.PaymentSessionId || data.payment_session_id || '';
      const paymentLink = data.paymentLink || data.PaymentLink || data.payment_link || data.instrumentResponseUrl || '';
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
        message: data.message || `Payment order created via ${gateway}`,
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to initiate payment.');
      return { success: false, message };
    }
  }

  static async verifyCashFreePayment(
    orderId: string,
    restaurantId?: number,
    subscriptionConfigurationId?: number,
    amountPaid?: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<{ success: boolean; isPaid: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/CashFreepayment/verify', {
        orderId,
        cfOrderId: orderId,
        restaurantId,
        subscriptionConfigurationId,
        amountPaid,
        razorpayPaymentId,
        razorpaySignature,
      });
      const paymentStatus = (response.data?.paymentStatus || response.data?.status || '').toUpperCase();
      const isPaid = paymentStatus === 'SUCCESS' || response.data?.success === true || response.data?.gatewayOrderStatus === 'PAID';
      return {
        success: isPaid,
        isPaid,
        message: response.data?.message || (isPaid ? 'Payment verified successfully.' : 'Payment pending or incomplete.'),
      };
    } catch (error: any) {
      return { success: false, isPaid: false, message: error.response?.data?.message || error.message || 'Payment verification failed.' };
    }
  }

  static async activateSubscription(
    restaurantId: number,
    subscriptionConfigurationId: number,
    orderId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/Subscription/Activate', {
        restaurantId,
        subscriptionConfigurationId,
        orderId: orderId || `AUTO_${Date.now()}`,
        status: 'ACTIVE',
      });
      return {
        success: response.status === 200 || response.data?.success === true,
        message: response.data?.message || 'Subscription activated successfully.',
      };
    } catch {
      // Fallback to assignSubscription
      return await this.assignSubscription(restaurantId, subscriptionConfigurationId, 30, 0);
    }
  }
}
