'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  ShieldAlert,
  Check,
  Zap,
  ArrowRight,
  Loader2,
  X,
  Lock,
  Sparkles,
  AlertCircle,
  CreditCard,
  LogOut,
  Clock,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Layers,
  Calendar,
  Hash,
  History,
  Percent,
  Wallet,
  ExternalLink,
  FileText,
  Download,
} from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SubscriptionPlan } from '@/types/subscription';
import { PaymentGatewayService } from '@/payments/paymentGatewayService.web';
import { WalletEvents } from '@shared/core/utils/walletEvents';
import { TaxInvoiceModal, TaxInvoiceItem } from '@/components/invoice/TaxInvoiceModal';

export const SubscriptionBlockerModal: React.FC = () => {
  const router = useRouter();
  const { user, activeRestaurant, restaurants, setActiveRestaurant, logout } = useAuthStore();
  const {
    subscription,
    isExpired,
    isNoSubscription,
    lifecycleState,
    daysRemaining,
    isInGracePeriod,
    graceDaysRemaining,
    isRenewalModalOpen,
    activeModalTab,
    plans,
    history,
    isPlansLoading,
    isHistoryLoading,
    fetchPlans,
    fetchSubscriptionStatus,
    fetchSubscriptionHistory,
    closeRenewalModal,
    assignPlan,
    initiateCashFreePayment,
    verifyPayment,
    hasLoaded,
  } = useSubscriptionStore();

  const [modalTab, setModalTab] = useState<'renew' | 'explore' | 'history'>(activeModalTab || 'renew');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoiceItem | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const recipientGst =
    subscription?.restaurantGstNumber ||
    (activeRestaurant as any)?.gstNumber ||
    (activeRestaurant as any)?.gstin ||
    undefined;

  const platformGstInfo = subscription?.platformGst;
  const gstRate = platformGstInfo?.defaultGstPercentage ?? 18;
  const platformGstin = platformGstInfo?.platformGstin || '27AABCM8821F1ZX';
  const platformLegalName = platformGstInfo?.platformLegalName || 'Menza Technologies Private Limited';

  const handleOpenHistoryInvoice = (item: any) => {
    const rawId = String(item.id || item.restaurantSubscriptionRelationshipId || 1);
    const seqStr = rawId.replace(/[^0-9]/g, '').slice(-5).padStart(5, '0');
    const invNumber = item.invoiceNumber || `MZ/26-27/S${seqStr}`;

    const itemRecipientGst =
      item.restaurantGstNumber ||
      recipientGst ||
      undefined;

    const pGst = item.platformGst || platformGstInfo;

    const invoiceItem: TaxInvoiceItem = {
      type: 'SUBSCRIPTION',
      invoiceNumber: invNumber,
      invoiceDate: item.createdDateUtc || item.startDate,
      paymentReference: item.paymentReferenceNo || item.walletTransactionRef,

      supplierLegalName: pGst?.platformLegalName,
      supplierTradeName: pGst?.platformTradeName,
      supplierGstin: pGst?.platformGstin,
      supplierPan: pGst?.platformPan,
      supplierStateCode: pGst?.platformStateCode,
      supplierStateName: pGst?.platformStateName,
      supplierAddress: pGst?.platformAddress,
      supplierEmail: pGst?.supportEmail,
      supplierWebsite: pGst?.websiteUrl,

      restaurantName: item.restaurantName || subscription?.restaurantName || activeRestaurant?.restaurantName || 'Restaurant Partner',
      restaurantId: currentRestId,
      outletAddress: (activeRestaurant as any)?.address || (activeRestaurant as any)?.outletAddress || (activeRestaurant as any)?.restaurantAddress,
      ownerName: (activeRestaurant as any)?.ownerName,
      contactPhone: (activeRestaurant as any)?.ownerMobile || (activeRestaurant as any)?.phone,
      customerGstin: itemRecipientGst,

      itemTitle: `Menza POS Software Subscription - ${item.subscriptionName || item.subscriptionCode || 'Plan'}`,
      itemDescription: 'Software as a Service (SaaS) Cloud POS, QR Table Ordering, KDS & Operating System Licensing',
      sacCode: pGst?.subscriptionSacCode || '997331',
      coverageStart: item.startDate,
      coverageEnd: item.endDate,
      totalAmount: item.amountPaid,
      baseAmount: item.baseAmount,
      taxAmount: item.taxAmount,
      taxPercentage: item.taxPercentage || pGst?.defaultGstPercentage || 18,
      cgstPercentage: pGst?.cgstPercentage || (item.taxPercentage ? item.taxPercentage / 2 : 9),
      sgstPercentage: pGst?.sgstPercentage || (item.taxPercentage ? item.taxPercentage / 2 : 9),
    };
    setSelectedInvoice(invoiceItem);
    setInvoiceModalOpen(true);
  };

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);
  const isSuperAdmin = Boolean(
    user?.roles?.some((r) =>
      ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))
    )
  );
  const isOwner =
    user?.roles?.some((r) => ['OWNER', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))) ||
    !user?.roles ||
    user.roles.length === 0;

  // Sync tab from store when opened
  useEffect(() => {
    if (!subscription || isNoSubscription) {
      setModalTab('explore');
    } else if (activeModalTab) {
      setModalTab(activeModalTab);
    } else {
      setModalTab('renew');
    }
  }, [activeModalTab, subscription, isNoSubscription, isRenewalModalOpen]);

  // Ensure subscription status is fetched when restaurant is set
  useEffect(() => {
    if (!hasLoaded && currentRestId > 0) {
      fetchSubscriptionStatus(currentRestId);
    }
  }, [hasLoaded, currentRestId, fetchSubscriptionStatus]);

  // Strictly locked when no active subscription or expired beyond grace period (SuperAdmin exempt)
  const isStrictlyLocked =
    !isSuperAdmin &&
    (isNoSubscription || !subscription || isExpired || lifecycleState === 'EXPIRED' || lifecycleState === 'NONE');
  const isVisible = hasLoaded && (isStrictlyLocked || isRenewalModalOpen);

  // Auto-fetch plans and history when modal opens or locked
  useEffect(() => {
    if (isStrictlyLocked || isRenewalModalOpen) {
      if (plans.length === 0) {
        fetchPlans();
      }
      if (currentRestId > 0) {
        fetchSubscriptionHistory(currentRestId);
      }
    }
  }, [isStrictlyLocked, isRenewalModalOpen, plans.length, currentRestId, fetchPlans, fetchSubscriptionHistory]);

  // Helper to match subscription to plan
  const isMatchingPlan = (p: SubscriptionPlan, sub = subscription) => {
    if (!sub) return false;
    const subConfigId = sub.subscriptionConfigurationId || sub.planId || (sub as any)?.subscriptionPlanId;
    if (subConfigId && (p.id === subConfigId || p.planId === subConfigId)) {
      return true;
    }
    const planLabel = (p.subscriptionName || p.planName || '').trim().toLowerCase();
    const subLabel = (sub.planName || '').trim().toLowerCase();
    return Boolean(planLabel && subLabel && planLabel === subLabel);
  };

  // Set default plan selection
  useEffect(() => {
    if (plans.length > 0 && (selectedPlanId === null || !plans.some((p) => p.id === selectedPlanId))) {
      const currentPlanMatch = plans.find((p) => isMatchingPlan(p));
      setSelectedPlanId(currentPlanMatch ? currentPlanMatch.id : plans[0].id);
    }
  }, [plans, selectedPlanId, subscription]);

  const handleSelectOutlet = async (restId: number) => {
    const target = restaurants.find((r) => r.restaurantId === restId);
    if (target) {
      setActiveRestaurant(target);
      setStatusMessage(null);
      await Promise.all([
        fetchSubscriptionStatus(target.restaurantId),
        fetchSubscriptionHistory(target.restaurantId),
      ]);
    }
  };

  if (!isVisible) {
    return null;
  }

  // Find the user's active current plan in plans list
  const matchedPlan = plans.find((p) => isMatchingPlan(p)) || null;
  const currentPlan = matchedPlan || (plans.length > 0 ? plans[0] : null);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || currentPlan || plans[0];

  const formatDate = (dateStr?: string, includeTime = false) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    if (includeTime) {
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const startFormatted = formatDate(subscription?.startDate);
  const expiryFormatted = formatDate(subscription?.endDate || subscription?.expiryDate);
  const effectiveEndFormatted = formatDate(
    subscription?.effectiveCoverageEndDate || subscription?.endDate || subscription?.expiryDate
  );

  const planDurationDays = Number(matchedPlan?.durationInDays || matchedPlan?.durationDays || 30);
  const totalDaysLeft = Number(subscription?.totalDaysRemaining ?? daysRemaining ?? 0);
  const currentCycleDaysLeft = Number(subscription?.currentCycleDaysRemaining ?? daysRemaining ?? 0);
  const queuedRenewalDays = Number(subscription?.queuedRenewalDays ?? 0);
  const hasQueuedRenewal = Boolean(subscription?.hasQueuedRenewal && queuedRenewalDays > 0);
  const progressPercent = Math.min(100, Math.max(0, Math.round((Math.max(0, currentCycleDaysLeft) / Math.max(1, planDurationDays)) * 100)));

  // Determine feature entitlements from subscription.entitlements or matchedPlan
  const checkEntitlementAllowed = (configKey: string, planFlag?: boolean): boolean => {
    const ents = subscription?.entitlements || matchedPlan?.entitlements || [];
    const found = ents.find(
      (e: any) => String(e.configKey || e.ConfigKey || '').toLowerCase() === configKey.toLowerCase()
    );
    if (found !== undefined) {
      return Boolean(found.isAllowed ?? (found as any).IsAllowed);
    }
    if (planFlag !== undefined) {
      return Boolean(planFlag);
    }
    return true;
  };

  const entitlementItems = [
    {
      label: 'Counter POS & Instant Billing',
      enabled: checkEntitlementAllowed('IsCounterOrderingEnabled', matchedPlan?.allowCounterOrdering),
    },
    {
      label: 'Table QR & Dine-In Ordering',
      enabled: checkEntitlementAllowed('IsTableOrderingEnabled', matchedPlan?.allowTableOrdering),
    },
    {
      label: 'Kitchen Display System (KDS & KOT)',
      enabled: checkEntitlementAllowed('IsKdsEnabled', matchedPlan?.allowKds),
    },
    {
      label: 'Self-Pickup & Takeaway Orders',
      enabled: checkEntitlementAllowed('IsSelfPickupEnabled', matchedPlan?.allowSelfPickup),
    },
    {
      label: 'Delivery Channel Management',
      enabled: checkEntitlementAllowed('IsDeliveryEnabled', matchedPlan?.allowDelivery),
    },
    {
      label: 'Online Gateway Payments (UPI/Cards)',
      enabled: checkEntitlementAllowed('AllowOnlinePayment', matchedPlan?.allowOnlinePayment),
    },
  ];

  const handlePayAndActivate = async (plan: SubscriptionPlan, isRenewAction: boolean = false) => {
    if (!currentRestId) {
      setStatusMessage({ type: 'error', text: 'No active restaurant selected.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const price = Number(plan.finalPrice ?? plan.price ?? 0);
      const duration = Number(plan.durationInDays || plan.durationDays || 30);

      // Free / Trial direct assignment
      if (price <= 0) {
        const res = await assignPlan(currentRestId, plan.id, duration, 0);
        if (res.success) {
          try {
            WalletEvents.emit();
          } catch (e) {
            console.warn('Error emitting WalletEvents on free plan activate:', e);
          }
          setStatusMessage({
            type: 'success',
            text: isRenewAction
              ? 'Plan renewed successfully!'
              : 'Free Plan activated successfully! POS unlocked.',
          });
          setTimeout(async () => {
            await fetchSubscriptionStatus(currentRestId);
            await fetchSubscriptionHistory(currentRestId);
            closeRenewalModal();
            setSubmitting(false);
          }, 1200);
          return;
        }
      }

      // 1. Initiate Payment Order (checks Razorpay vs Cashfree)
      const initRes = await initiateCashFreePayment(
        currentRestId,
        plan.id,
        price,
        user?.mobile || '9999999999'
      );

      if (!initRes.success || (!initRes.paymentSessionId && !initRes.paymentLink && !initRes.orderId)) {
        setStatusMessage({
          type: 'error',
          text: initRes.message || 'Payment gateway is not configured. Please contact administrator to set up payment credentials.',
        });
        setSubmitting(false);
        return;
      }

      // 2. Open Unified Payment Gateway Checkout (Razorpay if isRazorpay=true, else Cashfree)
      const paymentResult = await PaymentGatewayService.startPayment({
        orderId: initRes.orderId || `SUB_${Date.now()}`,
        amount: initRes.amount || price,
        currency: initRes.currency || 'INR',
        gateway: initRes.gateway,
        keyId: initRes.keyId,
        paymentSessionId: initRes.paymentSessionId,
        paymentLink: initRes.paymentLink,
        customerName: activeRestaurant?.restaurantName || user?.name || 'Restaurant Owner',
        customerPhone: user?.mobile || activeRestaurant?.ownerMobile || '9999999999',
        customerEmail: (user as any)?.email || 'billing@menza.com',
        orderNotes: `${isRenewAction ? 'Renewal' : 'Plan Upgrade'} - ${plan.subscriptionName || plan.planName} (₹${price})`,
      });

      if (!paymentResult.success) {
        setStatusMessage({
          type: 'error',
          text: paymentResult.error || 'Payment checkout was cancelled or failed.',
        });
        setSubmitting(false);
        return;
      }

      // 3. Verify Payment
      const verifyRes = await verifyPayment(
        initRes.orderId || '',
        currentRestId,
        plan.id,
        price,
        paymentResult.razorpayPaymentId,
        paymentResult.razorpaySignature
      );

      if (verifyRes?.success) {
        try {
          WalletEvents.emit();
        } catch (e) {
          console.warn('Error emitting WalletEvents on verifyPayment:', e);
        }
        setStatusMessage({
          type: 'success',
          text: isRenewAction
            ? 'Plan renewed successfully! Your coverage has been extended.'
            : 'Subscription activated successfully! POS unlocked.',
        });
        await fetchSubscriptionStatus(currentRestId);
        await fetchSubscriptionHistory(currentRestId);
        setTimeout(() => {
          closeRenewalModal();
          setSubmitting(false);
        }, 1500);
      } else {
        await fetchSubscriptionStatus(currentRestId);
        await fetchSubscriptionHistory(currentRestId);
        const latestSub = useSubscriptionStore.getState().subscription;
        if (latestSub && !useSubscriptionStore.getState().isExpired) {
          try {
            WalletEvents.emit();
          } catch (e) {
            console.warn('Error emitting WalletEvents on sub activate:', e);
          }
          setStatusMessage({
            type: 'success',
            text: 'Subscription activated successfully! POS unlocked.',
          });
          setTimeout(() => {
            closeRenewalModal();
            setSubmitting(false);
          }, 1200);
        } else {
          setStatusMessage({
            type: 'error',
            text: verifyRes?.message || 'Payment verification pending. Please contact support if your account was debited.',
          });
          setSubmitting(false);
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to complete subscription payment.',
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="border-b border-[#E7E1DA] dark:border-[#2B3540] px-6 py-5 bg-[#FAF7F2] dark:bg-[#151A20]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  isStrictlyLocked ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-[#DE8626]'
                }`}
              >
                {isStrictlyLocked ? <ShieldAlert className="h-6 w-6" /> : <Crown className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                    {isNoSubscription || !subscription
                      ? 'Subscription Plan Required'
                      : isStrictlyLocked
                      ? 'Subscription Expired'
                      : 'Subscription Details & Licensing'}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      isStrictlyLocked
                        ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                        : isInGracePeriod
                        ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                    }`}
                  >
                    {isStrictlyLocked ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                    {isStrictlyLocked
                      ? 'Locked'
                      : isInGracePeriod
                      ? 'Grace Period'
                      : hasQueuedRenewal
                      ? 'Active • Renewed'
                      : subscription
                      ? subscription.status || 'Active'
                      : 'Plan Required'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  {isNoSubscription || !subscription
                    ? `No active subscription found for ${activeRestaurant?.restaurantName || 'this store'}. Please purchase a plan below to unlock POS.`
                    : isStrictlyLocked
                    ? `Subscription for ${activeRestaurant?.restaurantName || 'this store'} has expired. Please renew or select a plan to resume operations.`
                    : `${activeRestaurant?.restaurantName || 'Active Store'} • View your current subscription details, validity dates, entitlements, and billing history.`}
                </p>
              </div>
            </div>

            {/* Header Right Actions: Outlet Switcher + Full Billing Page + Logout + Close */}
            <div className="flex items-center gap-2 shrink-0">
              {restaurants.length > 1 && (
                <select
                  value={activeRestaurant?.restaurantId || currentRestId}
                  onChange={(e) => handleSelectOutlet(Number(e.target.value))}
                  className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] focus:outline-none focus:ring-2 focus:ring-[#DE8626]"
                  title="Switch Restaurant Outlet"
                >
                  {restaurants.map((r) => (
                    <option key={r.restaurantId} value={r.restaurantId}>
                      {r.restaurantName}
                    </option>
                  ))}
                </select>
              )}

              {!isStrictlyLocked && (
                <button
                  type="button"
                  onClick={() => {
                    closeRenewalModal();
                    router.push('/settings/billing');
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:text-[#DE8626] transition-colors"
                  title="Open Full Subscription & Billing Page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Billing Page</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-bold text-[#667085] hover:text-red-600 hover:border-red-500/30 transition-colors"
                title="Log Out of Menza POS"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>

              {!isStrictlyLocked && (
                <button
                  onClick={closeRenewalModal}
                  className="rounded-full p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex overflow-x-auto border-b border-[#E7E1DA] dark:border-[#2B3540] px-6 bg-white dark:bg-[#1B2127]">
          {subscription && !isNoSubscription && (
            <button
              onClick={() => {
                setModalTab('renew');
                setStatusMessage(null);
              }}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold whitespace-nowrap transition-all ${
                modalTab === 'renew'
                  ? 'border-[#DE8626] text-[#DE8626]'
                  : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <Crown className="h-4 w-4" />
              <span>Current Plan & Details</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  isExpired
                    ? 'bg-red-500/10 text-red-600'
                    : 'bg-amber-500/10 text-[#DE8626]'
                }`}
              >
                {isExpired ? 'Expired' : `${totalDaysLeft}d left`}
              </span>
            </button>
          )}

          <button
            onClick={() => {
              setModalTab('explore');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold whitespace-nowrap transition-all ${
              modalTab === 'explore'
                ? 'border-[#DE8626] text-[#DE8626]'
                : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>
              {subscription && !isNoSubscription
                ? `Explore Other Plans (${plans.length})`
                : `Choose Subscription Plan (${plans.length})`}
            </span>
          </button>

          {subscription && !isNoSubscription && (
            <button
              onClick={() => {
                setModalTab('history');
                setStatusMessage(null);
                if (currentRestId > 0 && history.length === 0) {
                  fetchSubscriptionHistory(currentRestId);
                }
              }}
              className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold whitespace-nowrap transition-all ${
                modalTab === 'history'
                  ? 'border-[#DE8626] text-[#DE8626]'
                  : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Billing History</span>
              {history.length > 0 && (
                <span className="rounded-full bg-stone-500/10 px-2 py-0.5 text-[10px] text-[#667085] dark:text-[#94A3B8]">
                  {history.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Staff Warning if non-owner */}
          {!isOwner && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertCircle className="h-4 w-4 text-[#DE8626]" />
                <span>Staff Notice</span>
              </div>
              <p>
                You are logged in as a staff member. An active subscription is required to use Menza POS. Only the <strong>Restaurant Owner</strong> can purchase or renew subscription plans.
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace('/login');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out & Switch Account</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`rounded-xl p-3.5 text-xs font-medium flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: CURRENT PLAN & SUBSCRIPTION DETAILS */}
          {modalTab === 'renew' && subscription && !isNoSubscription && (
            <div className="space-y-5">
              {/* Active Plan Hero Card */}
              <div className="rounded-3xl border-2 border-[#DE8626] bg-amber-500/5 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white ${
                          isExpired
                            ? 'bg-red-600'
                            : isInGracePeriod
                            ? 'bg-amber-600'
                            : 'bg-[#DE8626]'
                        }`}
                      >
                        {isExpired
                          ? 'Subscription Expired'
                          : isInGracePeriod
                          ? `Grace Period (${graceDaysRemaining}d left)`
                          : hasQueuedRenewal
                          ? 'Active • Queued Renewal'
                          : 'Active Subscription'}
                      </span>
                      {matchedPlan?.subscriptionCode && (
                        <span className="rounded-md border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2 py-0.5 text-[10px] font-bold text-[#667085] dark:text-[#94A3B8]">
                          Code: {matchedPlan.subscriptionCode}
                        </span>
                      )}
                      {matchedPlan?.billingCycle && (
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-[#DE8626] uppercase">
                          {matchedPlan.billingCycle}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                      {subscription.planName || matchedPlan?.subscriptionName || matchedPlan?.planName || 'Store Subscription Plan'}
                    </h3>
                    <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                      {matchedPlan?.description || 'Full POS billing, station KOT routing, live floor table status, and analytics.'}
                    </p>
                  </div>

                  {currentPlan && (
                    <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 text-left sm:text-right shrink-0">
                      <span className="text-[11px] font-semibold text-[#667085]">Renewal Price</span>
                      <p className="text-2xl font-black text-[#DE8626]">
                        ₹{ Number(currentPlan.finalPrice ?? currentPlan.price ?? subscription.amountPaid ?? 0).toLocaleString('en-IN') }
                      </p>
                      <span className="text-[10px] text-[#667085]">
                        for {currentPlan.durationInDays || currentPlan.durationDays || 30} days
                      </span>
                    </div>
                  )}
                </div>

                {/* Cycle Validity Progress Bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#DE8626]" />
                      {isExpired
                        ? 'Plan validity has ended'
                        : `${currentCycleDaysLeft} days remaining in current cycle`}
                    </span>
                    <span className="text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      {startFormatted} → {expiryFormatted}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExpired || currentCycleDaysLeft <= 3
                          ? 'bg-red-500'
                          : currentCycleDaysLeft <= 7
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${isExpired ? 100 : Math.max(6, progressPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Queued Renewal Coverage Banner */}
                {hasQueuedRenewal && (
                  <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <strong className="font-extrabold">Queued Renewal Active (+{queuedRenewalDays} Days)</strong>
                        <p className="text-[11px] opacity-90">
                          Current Cycle: {currentCycleDaysLeft}d left • Queued Extension: +{queuedRenewalDays}d
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 dark:bg-black/20 px-3 py-1.5 text-right">
                      <span className="block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">
                        Effective Coverage Until
                      </span>
                      <strong className="text-xs font-black text-emerald-950 dark:text-white">
                        {effectiveEndFormatted} ({totalDaysLeft}d total)
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Subscription Details Grid (6 Metadata Cards) */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8] mb-2.5">
                  Subscription & Billing Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* 1. Start Date */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      <Calendar className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>Start / Activated Date</span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      {startFormatted}
                    </p>
                    <span className="text-[10px] text-[#667085]">
                      Status: {subscription.status || 'Active'}
                    </span>
                  </div>

                  {/* 2. Expiry Date */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      <Clock className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>Current Cycle Expiry</span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      {expiryFormatted}
                    </p>
                    <span className="text-[10px] text-[#667085]">
                      {hasQueuedRenewal
                        ? `Extended to ${effectiveEndFormatted}`
                        : `${Math.max(0, currentCycleDaysLeft)} days remaining`}
                    </span>
                  </div>

                  {/* 3. Amount Paid */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Amount Paid</span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      ₹{Number(subscription.amountPaid ?? matchedPlan?.finalPrice ?? matchedPlan?.price ?? 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-[#667085] block">
                      Cycle: {matchedPlan?.billingCycle || `${planDurationDays} Days`} • Incl. {subscription.taxPercentage || gstRate}% GST
                    </span>
                  </div>

                  {/* 4. Payment Reference */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      <Hash className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>Payment Reference</span>
                    </div>
                    <p className="mt-1 text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6] truncate" title={subscription.paymentReferenceNo || 'N/A'}>
                      {subscription.paymentReferenceNo || 'Direct / Admin Assigned'}
                    </p>
                    <span className="text-[10px] text-[#667085]">
                      Sub ID: #{subscription.subscriptionId || subscription.subscriptionConfigurationId || 'Active'}
                    </span>
                  </div>

                  {/* 5. Platform Commission Terms */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      <Percent className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>Platform Fee Structure</span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      {matchedPlan?.baseCommissionPercentage !== undefined && matchedPlan.baseCommissionPercentage > 0
                        ? `${matchedPlan.baseCommissionPercentage}% per order`
                        : matchedPlan?.baseFlatCommissionPerOrder
                        ? `₹${matchedPlan.baseFlatCommissionPerOrder} flat / order`
                        : '0% Platform Fee Plan'}
                    </p>
                    <span className="text-[10px] text-[#667085]">
                      {matchedPlan?.maxCommissionCapPerOrder
                        ? `Max cap: ₹${matchedPlan.maxCommissionCapPerOrder}/order`
                        : matchedPlan?.commissionType || 'Standard SaaS License'}
                    </span>
                  </div>

                  {/* 6. Included Wallet Credit & Outlet Info */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                      <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Included Wallet Credit</span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      ₹{Number(matchedPlan?.includedWalletCredit || 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-[#667085]">
                      Outlet: {activeRestaurant?.restaurantName || `Store #${currentRestId}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Feature Entitlements Checklist */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#667085] uppercase tracking-wider">
                    Plan Feature Entitlements
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600">
                    {entitlementItems.filter((i) => i.enabled).length} of {entitlementItems.length} Enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {entitlementItems.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                        item.enabled
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-[#1E2930] dark:text-[#F3F4F6]'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-black/5 dark:bg-white/5 text-[#667085] line-through opacity-70'
                      }`}
                    >
                      {item.enabled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Lock className="h-4 w-4 text-[#667085] shrink-0" />
                      )}
                      <span className="font-semibold">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Continuous Date Extension Explainer & Instant Renew Action */}
              {currentPlan && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                    <RotateCcw className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Continuous Seamless Extension:</strong>
                      <span>
                        Renewing now appends {currentPlan.durationInDays || currentPlan.durationDays || 30} full days directly to your existing coverage date ({hasQueuedRenewal ? effectiveEndFormatted : expiryFormatted}). You lose zero days and experience no disruption.
                      </span>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handlePayAndActivate(currentPlan, true)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] py-4 px-5 text-sm font-extrabold text-white shadow-xl shadow-[#DE8626]/25 hover:from-[#C4721C] hover:to-[#B66415] disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Processing Renewal...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            <span>
                              Renew {subscription.planName || currentPlan.subscriptionName || currentPlan.planName} Now (₹{Number(currentPlan.finalPrice ?? currentPlan.price ?? 0).toLocaleString('en-IN')})
                            </span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalTab('explore')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#DE8626] bg-amber-500/10 py-4 px-5 text-xs font-extrabold text-[#DE8626] hover:bg-[#DE8626] hover:text-white transition-all"
                      >
                        <Layers className="h-4 w-4" />
                        <span>Compare Plans</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPLORE OTHER PLANS */}
          {modalTab === 'explore' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wide">
                    Choose a Subscription Tier
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Compare features, validity duration, and platform fee structure across available plans
                  </p>
                </div>
                {isPlansLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-[#DE8626]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading plans...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const price = Number(plan.finalPrice ?? plan.price ?? 0);
                  const originalPrice = Number(plan.price ?? price);
                  const duration = plan.durationInDays || plan.durationDays || 30;
                  const isCurrent = isMatchingPlan(plan);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#DE8626] bg-amber-500/5 shadow-md shadow-amber-500/10 ring-2 ring-[#DE8626]'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/50 dark:bg-[#151A20] hover:border-[#DE8626]/50'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute top-3 right-3 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 uppercase">
                          Current Tier
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Crown className="h-4 w-4 text-[#DE8626]" />
                          <h4 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] pr-16">
                            {plan.subscriptionName || plan.planName}
                          </h4>
                        </div>
                        <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-2">
                          {plan.description || 'Full POS, KOT printing, and multi-outlet table sync.'}
                        </p>

                        <div className="mt-4 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{price.toLocaleString('en-IN')}
                          </span>
                          {originalPrice > price && (
                            <span className="text-xs text-[#667085] line-through">
                              ₹{originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                          <span className="text-[11px] text-[#667085]">/ {duration} days</span>
                        </div>
                        <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] mt-1">
                          Includes {gstRate}% GST • Menza GSTIN: <span className="font-mono font-semibold text-[#DE8626]">{platformGstin}</span>
                        </p>

                        {/* Commercial Highlights */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {plan.billingCycle && (
                            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-[#DE8626] uppercase">
                              {plan.billingCycle}
                            </span>
                          )}
                          {plan.includedWalletCredit ? (
                            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              +₹{plan.includedWalletCredit} Wallet Credit
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-1.5 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pt-3 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Counter POS & Billing</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Kitchen KOT Routing & Print</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Live Floor Table Status</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>
                              {plan.baseCommissionPercentage !== undefined && plan.baseCommissionPercentage > 0
                                ? `${plan.baseCommissionPercentage}% Platform Fee`
                                : 'Daily Revenue & GST Analytics'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                        <span
                          className={`block w-full text-center text-xs font-bold py-2 rounded-xl transition-colors ${
                            isSelected
                              ? 'bg-[#DE8626] text-white shadow-sm'
                              : 'bg-black/5 dark:bg-white/5 text-[#667085] hover:text-[#1E2930]'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select Plan'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary Action Button for Selected Plan */}
              {isOwner && selectedPlan && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#E7E1DA] dark:border-[#2B3540] pt-4">
                  <div className="text-xs text-[#667085]">
                    <div>
                      <span>Selected Tier: </span>
                      <strong className="text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        {selectedPlan.subscriptionName || selectedPlan.planName} (₹{Number(selectedPlan.finalPrice ?? selectedPlan.price ?? 0).toLocaleString('en-IN')})
                      </strong>
                    </div>
                    <div className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                      <span>Billed to: <strong>{subscription?.restaurantName || activeRestaurant?.restaurantName || 'Active Store'}</strong> </span>
                      {recipientGst ? (
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">• GSTIN: {recipientGst}</span>
                      ) : null}
                      <span> • Supplier GSTIN: <strong className="font-mono text-[#DE8626]">{platformGstin}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePayAndActivate(selectedPlan, isMatchingPlan(selectedPlan))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        <span>
                          {isMatchingPlan(selectedPlan) ? 'Renew' : 'Activate'} {selectedPlan.subscriptionName || selectedPlan.planName} (₹{Number(selectedPlan.finalPrice ?? selectedPlan.price ?? 0).toLocaleString('en-IN')})
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUBSCRIPTION & BILLING HISTORY */}
          {modalTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wide">
                    Subscription & Billing Ledger
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Chronological audit trail of plan activations, renewals, upgrades, and payment references
                  </p>
                </div>
                {isHistoryLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-[#DE8626]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading history...</span>
                  </span>
                )}
              </div>

              {history.length === 0 && !isHistoryLoading ? (
                <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-8 text-center space-y-2">
                  <FileText className="h-8 w-8 text-[#667085] mx-auto opacity-60" />
                  <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    No Subscription History Records Found
                  </p>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Your current active plan is {subscription?.planName || 'Active'} ({startFormatted} – {expiryFormatted}). Future renewals and upgrades will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => {
                    const evt = (item.eventType || item.newStatus || 'ACTIVATED').toUpperCase();
                    const isUpgradeOrRenew = evt.includes('RENEW') || evt.includes('UPGRADE') || evt.includes('ACTIVATE');
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                                isUpgradeOrRenew
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-[#DE8626] border border-amber-500/30'
                              }`}
                            >
                              {evt}
                            </span>
                            <h4 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                              {item.subscriptionName || item.subscriptionCode || subscription?.planName || 'Subscription Plan'}
                            </h4>
                            <span className="text-[11px] text-[#667085]">
                              • {formatDate(item.createdDateUtc, true)}
                            </span>
                          </div>

                          <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                            Coverage: <strong>{formatDate(item.startDate)}</strong> → <strong>{formatDate(item.endDate)}</strong>
                            {item.paymentReferenceNo ? ` • Ref: ${item.paymentReferenceNo}` : ''}
                          </p>
                          {item.baseAmount && item.taxAmount ? (
                            <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                              Taxable Value: ₹{Number(item.baseAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} + GST ({item.taxPercentage || 18}%): ₹{Number(item.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                          ) : null}
                          {item.remarks && (
                            <p className="text-[11px] text-[#667085] italic">{item.remarks}</p>
                          )}
                        </div>

                        <div className="text-left sm:text-right shrink-0 space-y-1">
                          <span className="text-[10px] font-semibold uppercase text-[#667085] block">
                            Amount Paid
                          </span>
                          <span className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6] block">
                            ₹{Number(item.amountPaid || 0).toLocaleString('en-IN')}
                          </span>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <span className="text-[10px] text-emerald-600 font-bold uppercase">
                              {item.newStatus || 'ACTIVE'}
                            </span>
                            {item.amountPaid > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenHistoryInvoice(item)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-xs"
                                title="Download / View GST Tax Invoice"
                              >
                                <FileText className="h-3 w-3 text-emerald-600" />
                                <span>{item.invoiceNumber || 'Tax Invoice'}</span>
                                <Download className="h-2.5 w-2.5 opacity-80" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* GST Tax Invoice Modal */}
        <TaxInvoiceModal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoice={selectedInvoice}
        />
      </div>
    </div>
  );
};
