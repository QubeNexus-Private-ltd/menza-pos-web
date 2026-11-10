import { apiClient, apiCacheManager } from '../../core/network/apiClient';
import {
  RestaurantSubscriptionHistory,
  SubscriptionPlan,
  UserSubscriptionStatus,
  extractTableOrderFlag,
} from '../../domain/models/Subscription';
import { useAuthStore } from '../../presentation/state/useAuthStore';
import { SubscriptionEvents } from '../../core/utils/subscriptionEvents';

export class SubscriptionRemoteDataSource {
  async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await apiClient.get('/Subscription/Configuration?includeInactive=true');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list.map((item: any) => {
        const entitlements = item.entitlements || item.Entitlements || [];
        const checkEntitlement = (key: string, defaultIfMissing: boolean = false) => {
          if (!Array.isArray(entitlements) || entitlements.length === 0) return defaultIfMissing;
          const e = entitlements.find((x: any) => (x.configKey || x.ConfigKey || '').toLowerCase() === key.toLowerCase());
          return e ? Boolean(e.isAllowed ?? e.IsAllowed) : defaultIfMissing;
        };
        const tableOrderFlag =
          extractTableOrderFlag(item) ??
          extractTableOrderFlag({ entitlements }) ??
          checkEntitlement('IsTableOrderingEnabled', false);
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
          minCommissionFloorPerOrder: Number(item.minCommissionFloorPerOrder ?? item.MinCommissionFloorPerOrder ?? 0),
          maxCommissionCapPerOrder: Number(item.maxCommissionCapPerOrder ?? item.MaxCommissionCapPerOrder ?? 0),
          includedWalletCredit: Number(item.includedWalletCredit ?? item.IncludedWalletCredit ?? 0),
          allowTableOrdering: tableOrderFlag,
          isTableOrder: tableOrderFlag,
          allowCounterOrdering: checkEntitlement('IsCounterOrderingEnabled', true),
          allowSelfPickup: checkEntitlement('IsSelfPickupEnabled', false),
          allowDelivery: checkEntitlement('IsDeliveryEnabled', false),
          allowKds: checkEntitlement('IsKdsEnabled', false),
          allowOnlinePayment: checkEntitlement('AllowOnlinePayment', true),
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
      const mappedEntitlements = (plan.entitlements || []).map((e) => ({
        orderConfigId: e.orderConfigId,
        OrderConfigId: e.orderConfigId,
        configKey: e.configKey,
        ConfigKey: e.configKey,
        isAllowed: e.isAllowed,
        IsAllowed: e.isAllowed,
        featureCommissionPercentage: e.featureCommissionPercentage || 0,
        FeatureCommissionPercentage: e.featureCommissionPercentage || 0,
        featureFlatFeePerOrder: e.featureFlatFeePerOrder || 0,
        FeatureFlatFeePerOrder: e.featureFlatFeePerOrder || 0,
      }));

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
        commissionType: plan.commissionType || 'PERCENTAGE',
        CommissionType: plan.commissionType || 'PERCENTAGE',
        baseCommissionPercentage: plan.baseCommissionPercentage || 0,
        BaseCommissionPercentage: plan.baseCommissionPercentage || 0,
        baseFlatCommissionPerOrder: plan.baseFlatCommissionPerOrder || 0,
        BaseFlatCommissionPerOrder: plan.baseFlatCommissionPerOrder || 0,
        minCommissionFloorPerOrder: plan.minCommissionFloorPerOrder || 0,
        MinCommissionFloorPerOrder: plan.minCommissionFloorPerOrder || 0,
        maxCommissionCapPerOrder: plan.maxCommissionCapPerOrder || 0,
        MaxCommissionCapPerOrder: plan.maxCommissionCapPerOrder || 0,
        includedWalletCredit: plan.includedWalletCredit || 0,
        IncludedWalletCredit: plan.includedWalletCredit || 0,
        isActive: plan.isActive ?? true,
        IsActive: plan.isActive ?? true,
        entitlements: mappedEntitlements,
        Entitlements: mappedEntitlements,
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
        commissionType: plan.commissionType || 'PERCENTAGE',
        CommissionType: plan.commissionType || 'PERCENTAGE',
        baseCommissionPercentage: plan.baseCommissionPercentage || 0,
        BaseCommissionPercentage: plan.baseCommissionPercentage || 0,
        baseFlatCommissionPerOrder: plan.baseFlatCommissionPerOrder || 0,
        BaseFlatCommissionPerOrder: plan.baseFlatCommissionPerOrder || 0,
        minCommissionFloorPerOrder: plan.minCommissionFloorPerOrder || 0,
        MinCommissionFloorPerOrder: plan.minCommissionFloorPerOrder || 0,
        maxCommissionCapPerOrder: plan.maxCommissionCapPerOrder || 0,
        MaxCommissionCapPerOrder: plan.maxCommissionCapPerOrder || 0,
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

  async getRestaurantSubscription(restaurantId: number, bypassCache: boolean = true): Promise<UserSubscriptionStatus | null> {
    if (!restaurantId || restaurantId <= 0) return null;
    if (bypassCache) {
      apiCacheManager.invalidate('/Subscription');
    }
    const reqConfig: any = bypassCache
      ? { headers: { 'Cache-Control': 'no-cache' }, skipCache: true }
      : {};
    try {
      let activeItem: any = null;

      // 0. Fetch available plans first for accurate configuration mapping
      let availablePlans: SubscriptionPlan[] = [];
      try {
        availablePlans = await this.getPlans();
      } catch {
        // fallback
      }

      // Helper to unwrap server envelope
      const unwrapItem = (raw: any): any => {
        if (!raw || typeof raw !== 'object') return null;
        if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data;
        if (raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) return raw.result;
        if (raw.item && typeof raw.item === 'object' && !Array.isArray(raw.item)) return raw.item;
        return raw;
      };

      // Helper to extract primary key ID from any subscription object across backend naming conventions
      const getRecordId = (x: any): number => {
        if (!x || typeof x !== 'object') return 0;
        return Number(
          x.restaurantSubscriptionRelationshipId ??
          x.RestaurantSubscriptionRelationshipId ??
          x.restaurantSubscriptionId ??
          x.RestaurantSubscriptionId ??
          x.subscriptionRelationshipId ??
          x.SubscriptionRelationshipId ??
          x.subscriptionId ??
          x.SubscriptionId ??
          x.id ??
          x.Id ??
          0
        );
      };

      // Helper to extract timestamp (created, updated, payment, or start)
      const getRecordTimestamp = (x: any): number => {
        if (!x || typeof x !== 'object') return 0;
        const rawDate =
          x.createdDateUtc ||
          x.CreatedDateUtc ||
          x.createdDate ||
          x.CreatedDate ||
          x.createdAt ||
          x.CreatedAt ||
          x.updatedDateUtc ||
          x.UpdatedDateUtc ||
          x.paymentDate ||
          x.PaymentDate ||
          x.startDate ||
          x.StartDate ||
          0;
        return rawDate ? new Date(rawDate).getTime() : 0;
      };

      // Helper to extract plan / subscriptionConfigurationId
      const getConfigId = (x: any): number => {
        if (!x || typeof x !== 'object') return 0;
        const direct = Number(
          x.subscriptionConfigurationId ??
          x.SubscriptionConfigurationId ??
          x.subscriptionConfigId ??
          x.SubscriptionConfigId ??
          x.planId ??
          x.PlanId ??
          x.configurationId ??
          x.ConfigurationId ??
          x.plan?.id ??
          x.Plan?.id ??
          x.subscriptionConfiguration?.id ??
          x.SubscriptionConfiguration?.id ??
          0
        );
        if (direct > 0) return direct;

        // If x is a SubscriptionConfiguration object itself (e.g. from ActivePlan endpoint)
        const idVal = Number(x.id ?? x.Id ?? 0);
        if (idVal > 0 && Array.isArray(availablePlans) && availablePlans.some((p) => p.id === idVal)) {
          return idVal;
        }

        // Match by subscriptionCode or planName/subscriptionName in availablePlans
        if (Array.isArray(availablePlans) && availablePlans.length > 0) {
          const code = String(x.subscriptionCode || x.SubscriptionCode || '').toLowerCase().trim();
          const name = String(x.subscriptionName || x.SubscriptionName || x.planName || x.PlanName || '').toLowerCase().trim();
          if (code || name) {
            const matched = availablePlans.find(
              (p) =>
                (code && p.subscriptionCode && p.subscriptionCode.toLowerCase().trim() === code) ||
                (name && p.subscriptionName && p.subscriptionName.toLowerCase().trim() === name) ||
                (name && p.planName && p.planName.toLowerCase().trim() === name)
            );
            if (matched && matched.id > 0) return matched.id;
          }
        }

        return 0;
      };

      // Check whether a candidate has an active or non-terminal status
      const isCandidateActive = (x: any): boolean => {
        if (!x || typeof x !== 'object') return false;
        if (x.isActive === false || x.IsActive === false) {
          return false;
        }
        const st = String(
          x.status ??
          x.Status ??
          x.newStatus ??
          x.NewStatus ??
          x.paymentStatus ??
          x.PaymentStatus ??
          ''
        ).toUpperCase().trim();
        if (
          st === 'EXPIRED' ||
          st === 'CANCELLED' ||
          st === 'FAILED' ||
          st === 'SUPERSEDED' ||
          st === 'TERMINATED' ||
          st === 'UPGRADED' ||
          st === 'REPLACED' ||
          st === 'INACTIVE'
        ) {
          return false;
        }
        return true;
      };

      // 1. Fetch ActivePlan and RestaurantSubscription in parallel
      let apItem: any = null;
      let listItems: any[] = [];

      const [activePlanRes, listRes] = await Promise.allSettled([
        apiClient.get(`/Subscription/ActivePlan/Restaurant/${restaurantId}`, reqConfig),
        apiClient.get(`/Subscription/RestaurantSubscription/Restaurant/${restaurantId}`, reqConfig),
      ]);

      if (activePlanRes.status === 'fulfilled' && activePlanRes.value?.data) {
        const unwrapped = unwrapItem(activePlanRes.value.data);
        if (unwrapped && typeof unwrapped === 'object') {
          const hasId = getRecordId(unwrapped) > 0 || getConfigId(unwrapped) > 0;
          const hasName = unwrapped.subscriptionName || unwrapped.SubscriptionName || unwrapped.planName;
          if (hasId || hasName) {
            apItem = unwrapped;
          }
        }
      }

      if (listRes.status === 'fulfilled' && listRes.value?.data) {
        const rawData = listRes.value.data;
        const list = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.items)
          ? rawData.items
          : Array.isArray(rawData?.data)
          ? rawData.data
          : rawData && typeof rawData === 'object'
          ? [rawData]
          : [];
        listItems = list.filter((item: any) => {
          if (!item || typeof item !== 'object') return false;
          const rId = Number(
            item.restaurantId ??
            item.RestaurantId ??
            item.restaurantID ??
            item.RestaurantID ??
            0
          );
          return rId === 0 || rId === restaurantId;
        });
      }

      // Fallback: If listRes was empty or failed, fetch all restaurant subscriptions and filter by restaurantId
      if (listItems.length === 0) {
        try {
          const allSubs = await this.getAllRestaurantSubscriptions();
          if (Array.isArray(allSubs) && allSubs.length > 0) {
            listItems = allSubs.filter((item: any) => {
              const rId = Number(
                item.restaurantId ??
                item.RestaurantId ??
                item.restaurantID ??
                item.RestaurantID ??
                item.restaurant_id ??
                item.Restaurant_Id ??
                0
              );
              return rId === restaurantId;
            });
          }
        } catch {
          // ignore
        }
      }

      // Collect real subscription candidates (actual subscriptions, NOT audit log history)
      const candidates: any[] = [];
      if (apItem && typeof apItem === 'object') {
        candidates.push({ ...apItem, _source: 'activePlan' });
      }
      for (const item of listItems) {
        if (item && typeof item === 'object') {
          candidates.push({ ...item, _source: 'restaurantSubscription' });
        }
      }

      // Sort candidate subscriptions so the newest, currently active plan is ALWAYS first:
      // 1. Valid/Active status prioritized over expired/superseded/upgraded
      // 2. Primary key ID descending (highest auto-increment ID is the newest database record)
      // 3. Start date descending (latest start date first)
      // 4. Created / payment timestamp descending
      candidates.sort((a, b) => {
        const activeA = isCandidateActive(a) ? 1 : 0;
        const activeB = isCandidateActive(b) ? 1 : 0;
        if (activeB !== activeA) return activeB - activeA;

        const idA = getRecordId(a);
        const idB = getRecordId(b);
        if (idB !== idA) return idB - idA;

        const startA = new Date(a.startDate || a.StartDate || 0).getTime();
        const startB = new Date(b.startDate || b.StartDate || 0).getTime();
        if (startB !== startA) return startB - startA;

        const timeA = getRecordTimestamp(a);
        const timeB = getRecordTimestamp(b);
        if (timeB !== timeA) return timeB - timeA;

        return 0;
      });

      // Find the winning primary candidate that has a valid configId
      const primaryCandidate =
        candidates.find((c) => isCandidateActive(c) && getConfigId(c) > 0) ||
        candidates.find((c) => getConfigId(c) > 0) ||
        candidates.find((c) => isCandidateActive(c)) ||
        candidates[0] ||
        null;

      if (primaryCandidate) {
        const primaryConfig = getConfigId(primaryCandidate);
        const apConfig = apItem ? getConfigId(apItem) : 0;

        if (apItem && (primaryConfig === apConfig || apConfig === 0)) {
          activeItem = {
            ...apItem,
            ...primaryCandidate,
            subscriptionConfigurationId: primaryConfig || apConfig,
          };
        } else {
          // The winning candidate represents the newer plan: merge with matched plan attributes
          activeItem = {
            ...(apItem && apConfig === primaryConfig ? apItem : {}),
            ...primaryCandidate,
            subscriptionConfigurationId: primaryConfig,
          };
        }
      } else {
        activeItem = null;
      }

      if (activeItem) {
        const endDateStr = activeItem.endDate || activeItem.EndDate || activeItem.endDateUTC || activeItem.EndDateUTC || '';
        const endDate = endDateStr ? new Date(endDateStr) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rawStatus = (activeItem.status || activeItem.Status || 'Active').toUpperCase();
        const isExplicitlyInactive =
          activeItem.isActive === false ||
          activeItem.IsActive === false ||
          rawStatus === 'INACTIVE';

        const graceEnd = new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isInGracePeriod =
          !isExplicitlyInactive &&
          (activeItem.isInGracePeriod ??
          (rawStatus === 'GRACE_PERIOD' || (now > endDate && now <= graceEnd)));

        const graceDaysRemaining =
          activeItem.graceDaysRemaining ??
          (isInGracePeriod ? Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0);

        const isExpired =
          isExplicitlyInactive ||
          (activeItem.isSubscriptionExpired ??
            (rawStatus === 'EXPIRED' || (!isInGracePeriod && now > graceEnd && daysRemaining <= 0)));

        let lifecycleState: any = activeItem.lifecycleState || activeItem.LifecycleState;
        if (!lifecycleState) {
          if (isExplicitlyInactive) lifecycleState = 'INACTIVE';
          else if (rawStatus === 'PENDING') lifecycleState = 'PENDING';
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

        let configId = getConfigId(activeItem) || undefined;

        let matchedPlan: SubscriptionPlan | undefined;
        if (configId && Array.isArray(availablePlans)) {
          matchedPlan = availablePlans.find((p) => p.id === configId);
        }
        if (!matchedPlan && Array.isArray(availablePlans)) {
          const code = String(activeItem.subscriptionCode || activeItem.SubscriptionCode || '').toLowerCase().trim();
          const name = String(activeItem.subscriptionName || activeItem.SubscriptionName || activeItem.planName || activeItem.PlanName || '').toLowerCase().trim();
          matchedPlan = availablePlans.find(
            (p) =>
              (code && p.subscriptionCode && p.subscriptionCode.toLowerCase().trim() === code) ||
              (name && p.subscriptionName && p.subscriptionName.toLowerCase().trim() === name) ||
              (name && p.planName && p.planName.toLowerCase().trim() === name)
          );
          if (matchedPlan) {
            configId = matchedPlan.id;
          }
        }

        let resolvedPlanName = matchedPlan?.subscriptionName || matchedPlan?.planName;
        if (!resolvedPlanName) {
          resolvedPlanName =
            activeItem.subscriptionName ||
            activeItem.SubscriptionName ||
            activeItem.planName ||
            activeItem.PlanName ||
            activeItem.name ||
            activeItem.Name ||
            activeItem.plan?.subscriptionName ||
            activeItem.plan?.planName ||
            activeItem.plan?.name ||
            activeItem.configuration?.subscriptionName ||
            activeItem.subscriptionConfiguration?.subscriptionName ||
            'Active Subscription';
        }

        const planTableOrder = matchedPlan ? extractTableOrderFlag(matchedPlan) : undefined;
        const itemTableOrder = extractTableOrderFlag(activeItem);
        const tableOrderFlag =
          planTableOrder !== undefined
            ? planTableOrder
            : (itemTableOrder ?? Boolean(activeItem.allowTableOrdering ?? activeItem.AllowTableOrdering));

        const resolvedEntitlements =
          (matchedPlan?.entitlements && matchedPlan.entitlements.length > 0)
            ? matchedPlan.entitlements
            : (activeItem.entitlements && activeItem.entitlements.length > 0)
            ? activeItem.entitlements
            : [];

        return {
          subscriptionId: getRecordId(activeItem) || configId || 1,
          subscriptionConfigurationId: configId,
          planName: resolvedPlanName || 'Active Subscription',
          startDate: activeItem.startDate || activeItem.StartDate || new Date().toISOString(),
          endDate: endDateStr || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isExpired: isExpired,
          isActive: !isExplicitlyInactive && !isExpired,
          daysRemaining: hasQueuedRenewal ? totalDaysRemaining : daysRemaining,
          isInGracePeriod: isInGracePeriod,
          graceDaysRemaining: graceDaysRemaining,
          lifecycleState: lifecycleState,
          status: isExplicitlyInactive ? 'Inactive' : isExpired ? 'Expired' : isInGracePeriod ? 'Grace Period' : rawStatus === 'PENDING' ? 'Pending' : 'Active',
          amountPaid: Number(activeItem.amountPaid ?? activeItem.AmountPaid ?? matchedPlan?.price ?? 0),
          paymentReferenceNo: activeItem.paymentReferenceNo || activeItem.PaymentReferenceNo,
          effectiveCommissionPercentage: Number(activeItem.effectiveCommissionPercentage ?? activeItem.EffectiveCommissionPercentage ?? matchedPlan?.baseCommissionPercentage ?? 0),
          effectiveFlatCommissionPerOrder: Number(activeItem.effectiveFlatCommissionPerOrder ?? activeItem.EffectiveFlatCommissionPerOrder ?? matchedPlan?.baseFlatCommissionPerOrder ?? 0),
          effectiveMinCommissionFloor: Number(activeItem.effectiveMinCommissionFloor ?? activeItem.EffectiveMinCommissionFloor ?? matchedPlan?.minCommissionFloorPerOrder ?? 0),
          effectiveMaxCommissionCap: Number(activeItem.effectiveMaxCommissionCap ?? activeItem.EffectiveMaxCommissionCap ?? matchedPlan?.maxCommissionCapPerOrder ?? 0),
          entitlements: resolvedEntitlements,
          hasQueuedRenewal,
          effectiveCoverageEndDate,
          totalDaysRemaining: hasQueuedRenewal ? totalDaysRemaining : daysRemaining,
          currentCycleDaysRemaining: hasQueuedRenewal ? currentCycleDaysRemaining : daysRemaining,
          queuedRenewalDays,
          isTableOrder: tableOrderFlag,
          allowTableOrdering: tableOrderFlag,
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
        apiCacheManager.invalidate('/Subscription');
        SubscriptionEvents.emitUpdated();
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
  ): Promise<{
    success: boolean;
    orderId: string;
    paymentSessionId?: string;
    instrumentResponseUrl?: string;
    message?: string;
    gateway?: string;
    keyId?: string;
    amount?: number;
    currency?: string;
  }> {
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
      const gateway = data.gateway || data.Gateway || (data.keyId ? 'Razorpay' : 'Cashfree');
      const keyId = data.keyId || data.KeyId;

      return {
        success: true,
        orderId,
        paymentSessionId,
        instrumentResponseUrl,
        gateway,
        keyId,
        amount,
        currency: data.currency || 'INR',
        message: data.message || `Payment order created via ${gateway}`,
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Failed to initiate payment.');

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
    amountPaid: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/CashFreepayment/verify', {
        orderId,
        restaurantId,
        subscriptionConfigurationId,
        amountPaid,
        type: 1,
        paymentType: 1,
        Type: 1,
        PaymentType: 1,
        razorpayPaymentId,
        razorpaySignature,
      });
      const paymentStatus = (response.data?.paymentStatus || response.data?.status || '').toUpperCase();
      const gatewayStatus = (response.data?.gatewayOrderStatus || response.data?.orderStatus || '').toUpperCase();
      const isSuccess =
        response.data?.success === true ||
        response.data?.isSuccess === true ||
        paymentStatus === 'SUCCESS' ||
        paymentStatus === 'PAID' ||
        paymentStatus === 'COMPLETED' ||
        gatewayStatus === 'PAID' ||
        gatewayStatus === 'SUCCESS' ||
        gatewayStatus === 'COMPLETED';

      if (isSuccess) {
        apiCacheManager.invalidate('/Subscription');
        apiCacheManager.invalidate('/CashFreepayment');
        SubscriptionEvents.emitUpdated();
      }

      return {
        success: isSuccess,
        message: isSuccess
          ? 'Payment verified & subscription activated successfully.'
          : (response.data?.failureReason || response.data?.message || 'Payment verification pending or failed.'),
      };
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data;
      const message = typeof serverMsg === 'string' ? serverMsg : (error.message || 'Payment verification failed.');
      return { success: false, message };
    }
  }

  async checkCashFreePaymentStatus(orderId: string) {
    return this.getCashFreePaymentStatus(orderId);
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
      const data = response.data;
      const rawStatus = (data?.paymentStatus || data?.status || (data?.success ? 'SUCCESS' : 'PENDING')).toUpperCase();
      const rawGateway = (data?.gatewayOrderStatus || data?.orderStatus || '').toUpperCase();

      return {
        orderId: data?.orderId || orderId,
        paymentStatus: rawStatus,
        gatewayOrderStatus: rawGateway,
        transactionId: data?.transactionId || data?.paymentId || '',
        amount: Number(data?.amount || 0),
        failureReason: data?.failureReason || data?.message || '',
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

  async getSubscriptionHistory(restaurantId: number): Promise<RestaurantSubscriptionHistory[]> {
    try {
      const response = await apiClient.get(`/Subscription/History/Restaurant/${restaurantId}`);
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list.map((item: any) => ({
        id: item.id || item.Id || 0,
        restaurantSubscriptionRelationshipId: item.restaurantSubscriptionRelationshipId || item.RestaurantSubscriptionRelationshipId || 0,
        restaurantId: item.restaurantId || item.RestaurantId || 0,
        subscriptionConfigurationId: item.subscriptionConfigurationId || item.SubscriptionConfigurationId || 0,
        subscriptionCode: item.subscriptionCode || item.SubscriptionCode || '',
        subscriptionName: item.subscriptionName || item.SubscriptionName || '',
        eventType: item.eventType || item.EventType || 'STATUS_CHANGED',
        previousStatus: item.previousStatus || item.PreviousStatus,
        newStatus: item.newStatus || item.NewStatus || '',
        startDate: item.startDate || item.StartDate || '',
        endDate: item.endDate || item.EndDate || '',
        previousEndDate: item.previousEndDate || item.PreviousEndDate,
        amountPaid: Number(item.amountPaid ?? item.AmountPaid ?? 0),
        paymentReferenceNo: item.paymentReferenceNo || item.PaymentReferenceNo,
        effectiveCommissionPercentage: Number(item.effectiveCommissionPercentage ?? item.EffectiveCommissionPercentage ?? 0),
        effectiveFlatCommissionPerOrder: Number(item.effectiveFlatCommissionPerOrder ?? item.EffectiveFlatCommissionPerOrder ?? 0),
        effectiveMinCommissionFloor: Number(item.effectiveMinCommissionFloor ?? item.EffectiveMinCommissionFloor ?? 0),
        effectiveMaxCommissionCap: Number(item.effectiveMaxCommissionCap ?? item.EffectiveMaxCommissionCap ?? 0),
        supersededBySubscriptionId: item.supersededBySubscriptionId || item.SupersededBySubscriptionId,
        proratedRefundAmount: item.proratedRefundAmount != null ? Number(item.proratedRefundAmount) : (item.ProratedRefundAmount != null ? Number(item.ProratedRefundAmount) : undefined),
        walletTransactionRef: item.walletTransactionRef || item.WalletTransactionRef,
        actionSource: item.actionSource || item.ActionSource || 'SYSTEM',
        actorUserId: item.actorUserId || item.ActorUserId,
        remarks: item.remarks || item.Remarks,
        createdDateUtc: item.createdDateUtc || item.CreatedDateUtc || '',
      }));
    } catch {
      return [];
    }
  }
}
