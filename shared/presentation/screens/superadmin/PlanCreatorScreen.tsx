import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  CreditCard,
  ChefHat,
  UtensilsCrossed,
  Plus,
  RefreshCw,
  X,
  Zap,
  Percent,
  IndianRupee,
  ShieldCheck,
  Check,
  Tag,
  Sliders,
  AlertCircle,
  Gift,
  Wallet,
  Search,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Eye,
  Settings2,
  CheckCheck,
  HelpCircle,
  ShoppingBag,
  Store,
  Receipt,
  Smartphone,
  Truck,
  TrendingUp,
} from 'lucide-react-native';
import { SubscriptionPlan } from '../../../domain/models/Subscription';
import { SubscriptionRemoteDataSource } from '../../../data/datasources/SubscriptionRemoteDataSource';
import { MasterDataRemoteDataSource } from '../../../data/datasources/MasterDataRemoteDataSource';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { useAuthStore } from '../../state/useAuthStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const subscriptionDataSource = new SubscriptionRemoteDataSource();
const masterDataDataSource = new MasterDataRemoteDataSource();

type MainTab = 'create' | 'catalog';
type WizardStep = 1 | 2 | 3 | 4;
type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'HALFYEARLY' | 'ANNUALLY';
type CommissionType = 'PERCENTAGE' | 'FLAT_PER_ORDER' | 'FEATURE_DRIVEN';

const DURATION_MAP: Record<
  BillingCycle,
  { days: number; label: string; tag: string; discountHint?: string }
> = {
  MONTHLY: { days: 30, label: 'Monthly', tag: '30 Days' },
  QUARTERLY: { days: 90, label: 'Quarterly', tag: '3 Months', discountHint: '5% Off' },
  HALFYEARLY: { days: 180, label: 'Half-Yearly', tag: '6 Months', discountHint: '10% Off' },
  ANNUALLY: { days: 365, label: 'Annual', tag: '12 Months', discountHint: 'Best Value ⭐️' },
};

const COMMISSION_TYPE_CONFIG: Record<
  CommissionType,
  { label: string; desc: string; icon: any; example: string }
> = {
  PERCENTAGE: {
    label: 'Percentage (%)',
    desc: 'Fixed percentage deduction on gross settled bills',
    icon: Percent,
    example: 'e.g. 2.5% on ₹1,000 order = ₹25.00',
  },
  FLAT_PER_ORDER: {
    label: 'Flat Fee / Order',
    desc: 'Fixed ₹ fee charged per successful order',
    icon: Tag,
    example: 'e.g. ₹5.00 flat fee per order ticket',
  },
  FEATURE_DRIVEN: {
    label: 'Add-on Driven Only',
    desc: 'Zero base commission; only active add-ons apply',
    icon: Sliders,
    example: 'e.g. Only delivery/online order fees apply',
  },
};

const getCategoryIcon = (categoryName: string) => {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('channel') || cat.includes('order') || cat.includes('qr')) return Smartphone;
  if (cat.includes('delivery') || cat.includes('shipping')) return Truck;
  if (cat.includes('kitchen') || cat.includes('kds') || cat.includes('chef')) return ChefHat;
  if (cat.includes('report') || cat.includes('analytics') || cat.includes('financial')) return TrendingUp;
  if (cat.includes('pos') || cat.includes('billing') || cat.includes('cashier')) return Receipt;
  return Layers;
};

export interface DynamicEntitlementState {
  orderConfigId: number;
  configKey: string;
  configName: string;
  category?: string;
  isAllowed: boolean;
  featureCommissionPercentage: string;
  featureFlatFeePerOrder: string;
}

interface PlanCreatorScreenProps {
  onClose?: () => void;
}

export const PlanCreatorScreen: React.FC<PlanCreatorScreenProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.roles?.some((r) =>
    ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY', 'OWNER'].includes(r.toUpperCase())
  ) ?? true;

  const [activeMainTab, setActiveMainTab] = useState<MainTab>('create');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [dynamicEntitlements, setDynamicEntitlements] = useState<DynamicEntitlementState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Catalog search & filter
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Step 1: Basic & Pricing
  const [subscriptionCode, setSubscriptionCode] = useState('');
  const [subscriptionName, setSubscriptionName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('MONTHLY');
  const [price, setPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [includedWalletCredit, setIncludedWalletCredit] = useState('0');

  // Step 2: Commission & Splits
  const [commissionType, setCommissionType] = useState<CommissionType>('PERCENTAGE');
  const [baseCommissionPercentage, setBaseCommissionPercentage] = useState('0');
  const [baseFlatCommissionPerOrder, setBaseFlatCommissionPerOrder] = useState('0');
  const [maxCommissionCapPerOrder, setMaxCommissionCapPerOrder] = useState('0');

  // Alert State
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'danger' | 'warning' | 'info' = 'success',
    confirmText = 'OK',
    cancelText?: string,
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const sanitized = val.toString().replace(/[^0-9.]/g, '');
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : num;
  };

  const parsedPrice = parseNumber(price);
  const parsedDiscount = parseNumber(discountAmount);
  const netPayablePrice = Math.max(0, parsedPrice - parsedDiscount);

  const parsedBaseCommissionPct = parseNumber(baseCommissionPercentage);
  const parsedBaseFlatFee = parseNumber(baseFlatCommissionPerOrder);
  const parsedMaxCap = parseNumber(maxCommissionCapPerOrder);
  const parsedWalletCredit = parseNumber(includedWalletCredit);

  // Compute Aggregated Effective Commission
  const aggregatedCommissionPct = dynamicEntitlements.reduce((acc, item) => {
    return item.isAllowed ? acc + parseNumber(item.featureCommissionPercentage) : acc;
  }, parsedBaseCommissionPct);

  const aggregatedFlatFee = dynamicEntitlements.reduce((acc, item) => {
    return item.isAllowed ? acc + parseNumber(item.featureFlatFeePerOrder) : acc;
  }, parsedBaseFlatFee);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [planList, masterList] = await Promise.all([
        subscriptionDataSource.getPlans(),
        masterDataDataSource.getMasterOrderConfigs(),
      ]);
      setPlans(planList || []);

      const features: DynamicEntitlementState[] = [];
      if (Array.isArray(masterList) && masterList.length > 0) {
        masterList.forEach((master: any) => {
          const detailsList = master.details || master.Details || [];
          if (Array.isArray(detailsList) && detailsList.length > 0) {
            detailsList.forEach((detail: any) => {
              features.push({
                orderConfigId: detail.id || detail.Id || 0,
                configKey: detail.configKey || detail.ConfigKey || '',
                configName: detail.description || detail.Description || detail.configKey || detail.ConfigKey || 'Feature',
                category: detail.category || detail.Category || master.configName || master.ConfigName || 'Ordering Channels',
                isAllowed: true,
                featureCommissionPercentage: '0',
                featureFlatFeePerOrder: '0',
              });
            });
          } else if (master.configCode || master.ConfigCode) {
            features.push({
              orderConfigId: master.id || master.Id || 0,
              configKey: master.configCode || master.ConfigCode || '',
              configName: master.configName || master.ConfigName || master.configCode || 'Feature',
              category: 'Master Features',
              isAllowed: true,
              featureCommissionPercentage: '0',
              featureFlatFeePerOrder: '0',
            });
          }
        });
      }
      setDynamicEntitlements(features);
    } catch {
      setPlans([]);
      setDynamicEntitlements([]);
      showAlert('Network Notice', 'Failed to connect to API to fetch master feature configurations.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleTogglePlanStatus = async (plan: SubscriptionPlan) => {
    if (!isSuperAdmin) {
      showAlert('Access Denied 🔒', 'Only SuperAdmins are authorized to activate or deactivate subscription plans.', 'warning');
      return;
    }

    const newStatus = !plan.isActive;
    showAlert(
      newStatus ? 'Activate Subscription Plan?' : 'Deactivate Subscription Plan?',
      `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} "${plan.subscriptionName || plan.planName}"? This will update availability across the platform via API.`,
      'info',
      newStatus ? 'ACTIVATE PLAN' : 'DEACTIVATE PLAN',
      'CANCEL',
      async () => {
        try {
          setTogglingId(plan.id);
          const res = await subscriptionDataSource.togglePlanStatus(plan.id, newStatus);
          if (res.success) {
            showAlert(
              'Status Updated 🎉',
              res.message || `Subscription Plan "${plan.subscriptionName || plan.planName}" is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`,
              'success',
              'OK',
              undefined,
              () => fetchInitialData()
            );
          } else {
            showAlert('Update Failed', res.message || 'Failed to update subscription plan status via API.', 'danger');
          }
        } catch (err: any) {
          showAlert('Error', err?.message || 'Network error updating subscription plan status.', 'danger');
        } finally {
          setTogglingId(null);
        }
      }
    );
  };

  const handleCreatePlan = async () => {
    if (!subscriptionCode.trim() || !subscriptionName.trim() || !price.trim()) {
      showAlert('Required Fields Missing', 'Please complete Plan Code, Plan Name, and Base Price in Step 1.', 'danger');
      setCurrentStep(1);
      return;
    }

    const durationDays = DURATION_MAP[selectedCycle].days;

    const payload: Partial<SubscriptionPlan> = {
      subscriptionCode: subscriptionCode.trim().toUpperCase(),
      subscriptionName: subscriptionName.trim(),
      description: description.trim(),
      billingCycle: selectedCycle,
      durationInDays: durationDays,
      price: parsedPrice,
      discountAmount: parsedDiscount,
      finalPrice: netPayablePrice,
      commissionType: commissionType,
      baseCommissionPercentage: parsedBaseCommissionPct,
      baseFlatCommissionPerOrder: parsedBaseFlatFee,
      maxCommissionCapPerOrder: parsedMaxCap,
      includedWalletCredit: parsedWalletCredit,
      isActive: true,
      entitlements: dynamicEntitlements.map((e) => ({
        orderConfigId: e.orderConfigId,
        configKey: e.configKey,
        isAllowed: e.isAllowed,
        featureCommissionPercentage: parseNumber(e.featureCommissionPercentage),
        featureFlatFeePerOrder: parseNumber(e.featureFlatFeePerOrder),
      })),
    };

    try {
      setSubmitting(true);
      const res = await subscriptionDataSource.createPlan(payload);
      if (res.success) {
        showAlert(
          'Plan Published 🎉',
          `Subscription Tier "${subscriptionName}" is now live and available for restaurant subscriptions!`,
          'success',
          'VIEW IN CATALOG',
          undefined,
          () => {
            setSubscriptionCode('');
            setSubscriptionName('');
            setDescription('');
            setPrice('');
            setDiscountAmount('0');
            setBaseCommissionPercentage('0');
            setBaseFlatCommissionPerOrder('0');
            setMaxCommissionCapPerOrder('0');
            setIncludedWalletCredit('0');
            setCurrentStep(1);
            setActiveMainTab('catalog');
            fetchInitialData();
          }
        );
      } else {
        showAlert('Failed to Publish', res.message || 'Error creating subscription plan.', 'danger');
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Unexpected network error.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const updateEntitlementState = (
    index: number,
    field: 'isAllowed' | 'featureCommissionPercentage' | 'featureFlatFeePerOrder',
    value: any
  ) => {
    setDynamicEntitlements((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleToggleAllEntitlements = (allowed: boolean) => {
    setDynamicEntitlements((prev) =>
      prev.map((e) => ({ ...e, isAllowed: allowed }))
    );
  };

  // Group entitlements by Category
  const groupedEntitlements = useMemo(() => {
    const map = new Map<string, { item: DynamicEntitlementState; index: number }[]>();
    dynamicEntitlements.forEach((item, index) => {
      const cat = item.category || 'General Features';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ item, index });
    });
    return Array.from(map.entries());
  }, [dynamicEntitlements]);

  // Filtered Catalog Plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const matchesFilter =
        catalogFilter === 'all' ||
        (catalogFilter === 'active' && p.isActive) ||
        (catalogFilter === 'inactive' && !p.isActive);

      const q = catalogSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.subscriptionName && p.subscriptionName.toLowerCase().includes(q)) ||
        (p.planName && p.planName.toLowerCase().includes(q)) ||
        (p.subscriptionCode && p.subscriptionCode.toLowerCase().includes(q)) ||
        (p.billingCycle && p.billingCycle.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [plans, catalogSearch, catalogFilter]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.container}>
          {/* TOP STREAMLINED UNIFIED HEADER */}
          <View style={styles.topHeader}>
            <View style={styles.headerLeftCol}>
              <Image
                source={require('../../../../assets/menza-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerOutletTitle} numberOfLines={1}>
                  Menza SaaS Engine
                </Text>
                <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
                  Tier Builder • {plans.length} Live Plans
                </Text>
              </View>
            </View>

            <View style={styles.headerRightCol}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={fetchInitialData}
                activeOpacity={0.7}
              >
                <RefreshCw size={14} color="#8C7A6B" />
              </TouchableOpacity>

              {onClose && (
                <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn} activeOpacity={0.7}>
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* MAIN TAB SELECTOR (Plan Builder vs Plan Catalog) */}
          <View style={styles.mainTabTrack}>
            <TouchableOpacity
              style={[styles.mainTabSegment, activeMainTab === 'create' && styles.mainTabSegmentActive]}
              onPress={() => setActiveMainTab('create')}
              activeOpacity={0.8}
            >
              <Plus size={13} color={activeMainTab === 'create' ? '#FFFFFF' : '#7C6F62'} strokeWidth={2.8} />
              <Text
                style={[styles.mainTabText, activeMainTab === 'create' && styles.mainTabTextActive]}
              >
                Plan Builder
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainTabSegment, activeMainTab === 'catalog' && styles.mainTabSegmentActive]}
              onPress={() => setActiveMainTab('catalog')}
              activeOpacity={0.8}
            >
              <Layers size={13} color={activeMainTab === 'catalog' ? '#FFFFFF' : '#7C6F62'} strokeWidth={2.4} />
              <Text
                style={[styles.mainTabText, activeMainTab === 'catalog' && styles.mainTabTextActive]}
              >
                Catalog ({plans.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* TAB 1: 4-STEP PLAN BUILDER WIZARD */}
          {/* ========================================================================= */}
          {activeMainTab === 'create' ? (
            <View style={{ flex: 1 }}>
              {/* Luxury Interconnected Step Tracker */}
              <View style={styles.wizardTrackerContainer}>
                <View style={styles.trackerTrack}>
                  {[
                    { step: 1, label: 'Identity & Price' },
                    { step: 2, label: 'Commission' },
                    { step: 3, label: 'Features' },
                    { step: 4, label: 'Preview' },
                  ].map((s, idx, arr) => {
                    const isActive = currentStep === s.step;
                    const isDone = currentStep > s.step;

                    return (
                      <React.Fragment key={`step-track-${s.step}`}>
                        <TouchableOpacity
                          style={styles.stepBubbleCol}
                          onPress={() => setCurrentStep(s.step as WizardStep)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.stepBubbleCircle,
                              isActive && styles.stepBubbleCircleActive,
                              isDone && styles.stepBubbleCircleDone,
                            ]}
                          >
                            {isDone ? (
                              <Check size={12} color="#FFFFFF" strokeWidth={3} />
                            ) : (
                              <Text
                                style={[
                                  styles.stepBubbleNumber,
                                  isActive && styles.stepBubbleNumberActive,
                                ]}
                              >
                                {s.step}
                              </Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.stepBubbleLabel,
                              isActive && styles.stepBubbleLabelActive,
                              isDone && styles.stepBubbleLabelDone,
                            ]}
                            numberOfLines={1}
                          >
                            {s.label}
                          </Text>
                        </TouchableOpacity>

                        {idx < arr.length - 1 && (
                          <View
                            style={[
                              styles.stepConnectingLine,
                              isDone && styles.stepConnectingLineDone,
                            ]}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.wizardScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* ------------------------------------------------------------- */}
                {/* STEP 1: IDENTITY & PRICING */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 1 && (
                  <View style={styles.wizardCard}>
                    {/* Header Banner */}
                    <View style={styles.stepBanner}>
                      <View style={styles.stepBannerIconCircle}>
                        <CreditCard size={16} color="#DE8626" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepBannerTitle}>Tier Identity & Base Pricing</Text>
                        <Text style={styles.stepBannerSubtitle}>
                          Set plan nomenclature, duration interval, and recurring fee
                        </Text>
                      </View>
                    </View>

                    {/* Inputs */}
                    <View style={styles.formFieldsStack}>
                      <View style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>PLAN CODE *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          placeholder="e.g. PRO_ANNUAL"
                          placeholderTextColor="#9CA3AF"
                          value={subscriptionCode}
                          onChangeText={setSubscriptionCode}
                          autoCapitalize="characters"
                        />
                      </View>

                      <View style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>PLAN NAME *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          placeholder="e.g. Pro Enterprise Restaurant Tier"
                          placeholderTextColor="#9CA3AF"
                          value={subscriptionName}
                          onChangeText={setSubscriptionName}
                        />
                      </View>

                      <View style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>TAGLINE / SUMMARY</Text>
                        <TextInput
                          style={styles.fieldInput}
                          placeholder="e.g. POS Billing, Live KDS, Table QR & Auto Settlements"
                          placeholderTextColor="#9CA3AF"
                          value={description}
                          onChangeText={setDescription}
                        />
                      </View>

                      {/* Luxury Billing Interval 2x2 Bento Grid */}
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.fieldLabel}>BILLING INTERVAL *</Text>
                          <Text style={styles.intervalHeaderHelper}>Select subscription duration</Text>
                        </View>

                        <View style={styles.bentoIntervalGrid}>
                          {(
                            [
                              { key: 'MONTHLY', icon: Calendar, tag: 'Standard Flex', badgeType: 'neutral' },
                              { key: 'QUARTERLY', icon: Layers, tag: '5% Saver', badgeType: 'green' },
                              { key: 'HALFYEARLY', icon: TrendingUp, tag: '10% Popular', badgeType: 'amber' },
                              { key: 'ANNUALLY', icon: Sparkles, tag: 'Best Value ⭐️', badgeType: 'gold' },
                            ] as const
                          ).map((item) => {
                            const cycleKey = item.key;
                            const isSel = cycleKey === selectedCycle;
                            const info = DURATION_MAP[cycleKey];
                            const IconComp = item.icon;

                            return (
                              <TouchableOpacity
                                key={`interval-btn-${cycleKey}`}
                                style={[styles.intervalCard, isSel && styles.intervalCardSelected]}
                                onPress={() => setSelectedCycle(cycleKey)}
                                activeOpacity={0.85}
                              >
                                {/* Top Row: Icon + Radio Badge */}
                                <View style={styles.intervalCardTopRow}>
                                  <View style={[styles.intervalIconSquircle, isSel && styles.intervalIconSquircleActive]}>
                                    <IconComp size={13} color={isSel ? '#FFFFFF' : '#8C7A6B'} />
                                  </View>

                                  {isSel ? (
                                    <View style={styles.intervalSelectedBeacon}>
                                      <Check size={9} color="#FFFFFF" strokeWidth={3.2} />
                                    </View>
                                  ) : (
                                    <View style={styles.intervalUnselectedBeacon} />
                                  )}
                                </View>

                                {/* Center: Title & Days */}
                                <Text style={[styles.intervalTitleText, isSel && styles.intervalTitleTextActive]}>
                                  {info.label}
                                </Text>
                                <Text style={styles.intervalDurationDaysText}>{info.days} Days Lifecycle</Text>

                                {/* Bottom Tag Badge */}
                                <View
                                  style={[
                                    styles.intervalTagBadge,
                                    item.badgeType === 'green' && styles.intervalTagGreen,
                                    item.badgeType === 'amber' && styles.intervalTagAmber,
                                    item.badgeType === 'gold' && styles.intervalTagGold,
                                    isSel && styles.intervalTagActiveGlow,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.intervalTagBadgeText,
                                      item.badgeType === 'green' && styles.intervalTagTextGreen,
                                      item.badgeType === 'amber' && styles.intervalTagTextAmber,
                                      item.badgeType === 'gold' && styles.intervalTagTextGold,
                                    ]}
                                  >
                                    {item.tag}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Active Selection Feedback Ribbon */}
                        <View style={styles.intervalFeedbackRibbon}>
                          <Calendar size={11} color="#DE8626" />
                          <Text style={styles.intervalFeedbackText}>
                            Selected:{' '}
                            <Text style={{ color: '#1F2937', fontWeight: '800' }}>
                              {DURATION_MAP[selectedCycle].label} ({DURATION_MAP[selectedCycle].days} Days)
                            </Text>
                            {' '}• Amortized across {Math.round(DURATION_MAP[selectedCycle].days / 30)} monthly cycles
                          </Text>
                        </View>
                      </View>

                      {/* Pricing 2-Col */}
                      <View style={styles.twoColRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>BASE PRICE (₹) *</Text>
                          <TextInput
                            style={styles.fieldInput}
                            placeholder="2499"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={price}
                            onChangeText={setPrice}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>DISCOUNT OFFSET (₹)</Text>
                          <TextInput
                            style={styles.fieldInput}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={discountAmount}
                            onChangeText={setDiscountAmount}
                          />
                        </View>
                      </View>

                      {/* Financial Calculation Receipt */}
                      <View style={styles.pricingReceiptCard}>
                        <View style={styles.receiptLine}>
                          <Text style={styles.receiptLabel}>Rack Rate Base Price:</Text>
                          <Text style={styles.receiptVal}>₹{parsedPrice.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={styles.receiptLine}>
                          <Text style={styles.receiptLabel}>Discount Offset:</Text>
                          <Text style={[styles.receiptVal, { color: '#17845A' }]}>
                            - ₹{parsedDiscount.toLocaleString('en-IN')}
                          </Text>
                        </View>
                        <View style={styles.receiptDashedDivider} />
                        <View style={styles.receiptGrandRow}>
                          <View>
                            <Text style={styles.receiptGrandLabel}>FINAL TENANT PRICE</Text>
                            <Text style={styles.receiptMonthlySub}>
                              ≈ ₹{Math.round(netPayablePrice / (DURATION_MAP[selectedCycle].days / 30))} / month
                            </Text>
                          </View>
                          <Text style={styles.receiptGrandNumber}>₹{netPayablePrice.toLocaleString('en-IN')}</Text>
                        </View>
                      </View>

                      {/* Bonus Wallet Credit Card */}
                      <View style={styles.walletBonusCard}>
                        <View style={styles.walletBonusTop}>
                          <Gift size={16} color="#17845A" />
                          <Text style={styles.walletBonusTitle}>Complimentary Commission Wallet Credits</Text>
                        </View>
                        <Text style={styles.walletBonusDesc}>
                          Automatically loaded to the outlet's commission ledger to pay for POS cash bills.
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { backgroundColor: '#FFFFFF', marginTop: 8 }]}
                          placeholder="e.g. 500.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          value={includedWalletCredit}
                          onChangeText={setIncludedWalletCredit}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 2: COMMISSION & REVENUE SPLIT */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 2 && (
                  <View style={styles.wizardCard}>
                    {/* Header Banner */}
                    <View style={styles.stepBanner}>
                      <View style={styles.stepBannerIconCircle}>
                        <Percent size={16} color="#DE8626" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepBannerTitle}>Commission & Order Splits</Text>
                        <Text style={styles.stepBannerSubtitle}>
                          Configure take-rate rules and order commission deductions
                        </Text>
                      </View>
                    </View>

                    <View style={styles.formFieldsStack}>
                      <Text style={styles.fieldLabel}>COMMISSION MODEL *</Text>
                      <View style={{ gap: 8 }}>
                        {(['PERCENTAGE', 'FLAT_PER_ORDER', 'FEATURE_DRIVEN'] as CommissionType[]).map((typeKey) => {
                          const isSel = typeKey === commissionType;
                          const conf = COMMISSION_TYPE_CONFIG[typeKey];
                          const IconComp = conf.icon;
                          return (
                            <TouchableOpacity
                              key={`comm-card-${typeKey}`}
                              style={[styles.commOptionCard, isSel && styles.commOptionCardActive]}
                              onPress={() => setCommissionType(typeKey)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.commOptionTop}>
                                <View style={[styles.commIconBox, isSel && styles.commIconBoxActive]}>
                                  <IconComp size={15} color={isSel ? '#D96B14' : '#7C6F62'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.commOptionTitle, isSel && styles.commOptionTitleActive]}>
                                    {conf.label}
                                  </Text>
                                  <Text style={styles.commOptionDesc}>{conf.desc}</Text>
                                </View>
                                {isSel && <CheckCircle2 size={16} color="#D96B14" />}
                              </View>
                              <View style={styles.commExampleBox}>
                                <Text style={styles.commExampleText}>{conf.example}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.twoColRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>BASE RATE (%)</Text>
                          <TextInput
                            style={styles.fieldInput}
                            placeholder="2.5"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={baseCommissionPercentage}
                            onChangeText={setBaseCommissionPercentage}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>FLAT FEE / ORDER (₹)</Text>
                          <TextInput
                            style={styles.fieldInput}
                            placeholder="5.00"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={baseFlatCommissionPerOrder}
                            onChangeText={setBaseFlatCommissionPerOrder}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>MAX COMMISSION CAP / ORDER (₹) (0 = Unlimited)</Text>
                        <TextInput
                          style={styles.fieldInput}
                          placeholder="50.00 (0 for no cap)"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          value={maxCommissionCapPerOrder}
                          onChangeText={setMaxCommissionCapPerOrder}
                        />
                      </View>

                      {/* Effective Simulation Telemetry */}
                      <View style={[styles.pricingReceiptCard, { backgroundColor: '#E4F5EC', borderColor: 'rgba(23, 132, 90, 0.3)' }]}>
                        <View style={styles.receiptLine}>
                          <Text style={[styles.receiptLabel, { color: '#0E6240' }]}>Effective Rate per Order:</Text>
                          <Text style={[styles.receiptVal, { color: '#17845A', fontWeight: '800' }]}>
                            {aggregatedCommissionPct.toFixed(2)}% + ₹{aggregatedFlatFee.toFixed(2)}
                          </Text>
                        </View>
                        {parsedMaxCap > 0 && (
                          <View style={styles.receiptLine}>
                            <Text style={[styles.receiptLabel, { color: '#0E6240' }]}>Maximum Take Ceiling:</Text>
                            <Text style={[styles.receiptVal, { color: '#17845A', fontWeight: '800' }]}>
                              Capped at ₹{parsedMaxCap.toFixed(2)} / order
                            </Text>
                          </View>
                        )}
                        <View style={styles.receiptDashedDivider} />
                        <Text style={{ fontSize: 10, color: '#0E6240', fontStyle: 'italic' }}>
                          💡 Simulation: On a ₹1,000 dine-in order, commission deducted = ₹{Math.min(parsedMaxCap > 0 ? parsedMaxCap : Infinity, 1000 * (aggregatedCommissionPct / 100) + aggregatedFlatFee).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 3: FEATURE ENTITLEMENTS */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 3 && (
                  <View style={styles.wizardCard}>
                    {/* Header Banner */}
                    <View style={styles.stepBanner}>
                      <View style={styles.stepBannerIconCircle}>
                        <Sliders size={16} color="#DE8626" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepBannerTitle}>Platform Feature Entitlements</Text>
                        <Text style={styles.stepBannerSubtitle}>
                          Toggle channel accessibility and assign optional feature surcharges
                        </Text>
                      </View>
                    </View>

                    {/* Quick Preset Buttons */}
                    <View style={styles.presetButtonsRow}>
                      <TouchableOpacity
                        style={styles.presetBtn}
                        onPress={() => handleToggleAllEntitlements(true)}
                        activeOpacity={0.8}
                      >
                        <CheckCheck size={12} color="#17845A" />
                        <Text style={styles.presetBtnText}>Enable All Modules</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetBtn}
                        onPress={() => handleToggleAllEntitlements(false)}
                        activeOpacity={0.8}
                      >
                        <X size={12} color="#DC2626" />
                        <Text style={[styles.presetBtnText, { color: '#DC2626' }]}>Disable All</Text>
                      </TouchableOpacity>
                    </View>

                    {groupedEntitlements.length === 0 ? (
                      <View style={styles.emptyNoticeBox}>
                        <AlertCircle size={18} color="#DE8626" />
                        <Text style={styles.emptyNoticeText}>
                          No master feature configs returned from backend API.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 14 }}>
                        {groupedEntitlements.map(([categoryName, items]) => {
                          const CatIcon = getCategoryIcon(categoryName);
                          return (
                            <View key={`group-${categoryName}`} style={styles.categoryCard}>
                              <View style={styles.categoryTitleRow}>
                                <View style={styles.catIconCircle}>
                                  <CatIcon size={12} color="#DE8626" />
                                </View>
                                <Text style={styles.categoryHeadingText}>{categoryName}</Text>
                                <View style={styles.catCountBadge}>
                                  <Text style={styles.catCountBadgeText}>{items.length}</Text>
                                </View>
                              </View>

                              <View style={{ gap: 6, marginTop: 8 }}>
                                {items.map(({ item, index }) => (
                                  <View
                                    key={`ent-box-${item.configKey}-${index}`}
                                    style={[
                                      styles.featureRowCard,
                                      item.isAllowed && styles.featureRowCardActive,
                                    ]}
                                  >
                                    <View style={styles.featureRowTop}>
                                      <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={styles.featureNameText}>{item.configName}</Text>
                                        <Text style={styles.featureKeyText}>KEY: {item.configKey}</Text>
                                      </View>
                                      <Switch
                                        trackColor={{ false: '#E7E1DA', true: '#DE8626' }}
                                        thumbColor="#FFFFFF"
                                        value={item.isAllowed}
                                        onValueChange={(val) => updateEntitlementState(index, 'isAllowed', val)}
                                      />
                                    </View>

                                    {item.isAllowed && (
                                      <View style={styles.featureAddonInputs}>
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.addonMicroLabel}>Channel Add-on %</Text>
                                          <TextInput
                                            style={styles.addonMicroInput}
                                            placeholder="0.0"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="numeric"
                                            value={item.featureCommissionPercentage}
                                            onChangeText={(val) => updateEntitlementState(index, 'featureCommissionPercentage', val)}
                                          />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.addonMicroLabel}>Flat Fee (₹)</Text>
                                          <TextInput
                                            style={styles.addonMicroInput}
                                            placeholder="0.0"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="numeric"
                                            value={item.featureFlatFeePerOrder}
                                            onChangeText={(val) => updateEntitlementState(index, 'featureFlatFeePerOrder', val)}
                                          />
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 4: LIVE PREVIEW & PUBLISH */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 4 && (
                  <View style={styles.wizardCard}>
                    {/* Header Banner */}
                    <View style={styles.stepBanner}>
                      <View style={styles.stepBannerIconCircle}>
                        <Sparkles size={16} color="#DE8626" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepBannerTitle}>Live Storefront Tier Preview</Text>
                        <Text style={styles.stepBannerSubtitle}>
                          Review how restaurants will see this tier on their subscription page
                        </Text>
                      </View>
                    </View>

                    {/* Grand Obsidian Live Card */}
                    <View style={styles.previewCardWrapper}>
                      <LinearGradient
                        colors={['#2D2319', '#3D2F20', '#1F1811']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.previewCardGradient}
                      >
                        <View style={styles.previewHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.previewCyclePill}>
                              <Text style={styles.previewCyclePillText}>
                                {DURATION_MAP[selectedCycle].label.toUpperCase()} TIER
                              </Text>
                            </View>
                            <Text style={styles.previewTierTitle}>
                              {subscriptionName || 'Untitled Subscription Plan'}
                            </Text>
                            <Text style={styles.previewTierCode}>
                              CODE: {subscriptionCode.toUpperCase() || 'CODE_PLACEHOLDER'}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end' }}>
                            {parsedDiscount > 0 && (
                              <Text style={styles.previewStrikethrough}>
                                ₹{parsedPrice.toLocaleString('en-IN')}
                              </Text>
                            )}
                            <Text style={styles.previewGrandPrice}>
                              ₹{netPayablePrice.toLocaleString('en-IN')}
                            </Text>
                            <Text style={styles.previewDurationSub}>
                              / {DURATION_MAP[selectedCycle].days} Days
                            </Text>
                          </View>
                        </View>

                        {description ? (
                          <Text style={styles.previewDescText}>{description}</Text>
                        ) : null}

                        {parsedWalletCredit > 0 && (
                          <View style={styles.previewGiftChip}>
                            <Gift size={12} color="#34D399" />
                            <Text style={styles.previewGiftChipText}>
                              Includes ₹{parsedWalletCredit.toLocaleString('en-IN')} Free Wallet Credit
                            </Text>
                          </View>
                        )}

                        <View style={styles.previewDividerLine} />

                        <View style={styles.previewCommissionTelemetryBox}>
                          <Text style={styles.previewCommissionLabelText}>
                            Commission Rule:{' '}
                            <Text style={{ color: '#FEA619', fontWeight: '800' }}>
                              {aggregatedCommissionPct.toFixed(2)}% + ₹{aggregatedFlatFee.toFixed(2)} / order
                            </Text>
                            {parsedMaxCap > 0 ? ` (Cap ₹${parsedMaxCap})` : ''}
                          </Text>
                        </View>

                        {/* Enabled Feature Badges */}
                        <View style={styles.previewModulesGrid}>
                          {dynamicEntitlements
                            .filter((e) => e.isAllowed)
                            .map((e, idx) => (
                              <View key={`prev-mod-${idx}`} style={styles.previewModuleChip}>
                                <Check size={10} color="#34D399" strokeWidth={3} />
                                <Text style={styles.previewModuleChipText}>{e.configName}</Text>
                              </View>
                            ))}
                        </View>
                      </LinearGradient>
                    </View>

                    {/* Publish Action Button */}
                    <TouchableOpacity
                      style={styles.publishActionBtn}
                      onPress={handleCreatePlan}
                      disabled={submitting}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.publishActionBtnGradient}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Zap size={18} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.publishActionBtnText}>PUBLISH SUBSCRIPTION TIER</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Wizard Footer Navigation Controls */}
                <View style={styles.wizardFooterControls}>
                  {currentStep > 1 ? (
                    <TouchableOpacity
                      style={styles.footerBackBtn}
                      onPress={() => setCurrentStep((prev) => (prev - 1) as WizardStep)}
                      activeOpacity={0.8}
                    >
                      <ArrowLeft size={14} color="#5C4E3D" />
                      <Text style={styles.footerBackBtnText}>Back</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  {currentStep < 4 ? (
                    <TouchableOpacity
                      style={styles.footerNextBtn}
                      onPress={() => {
                        if (currentStep === 1 && (!subscriptionCode.trim() || !subscriptionName.trim() || !price.trim())) {
                          showAlert('Missing Fields', 'Please complete Plan Code, Plan Name, and Base Price to proceed.', 'warning');
                          return;
                        }
                        setCurrentStep((prev) => (prev + 1) as WizardStep);
                      }}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.footerNextBtnText}>Continue</Text>
                      <ArrowRight size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          ) : (
            /* ========================================================================= */
            /* TAB 2: PUBLISHED SUBSCRIPTION CATALOG */
            /* ========================================================================= */
            <View style={{ flex: 1 }}>
              {/* Search & Filter Bar */}
              <View style={styles.catalogControlsContainer}>
                <View style={styles.searchBar}>
                  <Search size={14} color="#DE8626" />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search published plans..."
                    placeholderTextColor="#9CA3AF"
                    value={catalogSearch}
                    onChangeText={setCatalogSearch}
                  />
                  {catalogSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCatalogSearch('')}>
                      <X size={13} color="#8C7A6B" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.catalogFilterPillsRow}>
                  {(['all', 'active', 'inactive'] as const).map((f) => {
                    const isSel = catalogFilter === f;
                    const count =
                      f === 'all'
                        ? plans.length
                        : f === 'active'
                        ? plans.filter((p) => p.isActive).length
                        : plans.filter((p) => !p.isActive).length;

                    return (
                      <TouchableOpacity
                        key={`filter-pill-${f}`}
                        style={[styles.catalogFilterPill, isSel && styles.catalogFilterPillActive]}
                        onPress={() => setCatalogFilter(f)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.catalogFilterPillText, isSel && styles.catalogFilterPillTextActive]}>
                          {f.toUpperCase()} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#DE8626" />
                  <Text style={styles.loadingText}>Fetching published plans...</Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.catalogCardsScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredPlans.length === 0 ? (
                    <View style={styles.emptyCatalogBox}>
                      <Layers size={32} color="#9CA3AF" />
                      <Text style={styles.emptyCatalogHeading}>No Plans Found</Text>
                      <Text style={styles.emptyCatalogSubText}>
                        {catalogSearch || catalogFilter !== 'all'
                          ? 'No plans match the search query or status filter.'
                          : 'Click on Plan Builder to create your first SaaS subscription tier.'}
                      </Text>
                    </View>
                  ) : (
                    filteredPlans.map((p) => {
                      const basePrice = p.price || 0;
                      const discount = p.discountAmount || 0;
                      const offerPrice = p.finalPrice ?? Math.max(0, basePrice - discount);
                      const hasDiscount = discount > 0 && offerPrice < basePrice;

                      return (
                        <View key={`plan-card-${p.id}`} style={styles.publishedPlanCard}>
                          <View style={styles.publishedPlanTop}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={styles.publishedPlanTitleRow}>
                                <Text style={styles.publishedPlanTitle}>{p.subscriptionName || p.planName}</Text>
                                <View
                                  style={[
                                    styles.planStatusPill,
                                    {
                                      backgroundColor: p.isActive ? '#E4F5EC' : '#FEE2E2',
                                      borderColor: p.isActive ? 'rgba(23, 132, 90, 0.3)' : 'rgba(220, 38, 38, 0.3)',
                                    },
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.planStatusDot,
                                      { backgroundColor: p.isActive ? '#17845A' : '#DC2626' },
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.planStatusText,
                                      { color: p.isActive ? '#17845A' : '#DC2626' },
                                    ]}
                                  >
                                    {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.publishedPlanCodeMeta}>
                                CODE: {p.subscriptionCode || 'BASIC'} • {p.billingCycle || 'MONTHLY'} ({p.durationInDays || 30} Days)
                              </Text>
                            </View>

                            {/* Price */}
                            <View style={styles.publishedPlanPriceBlock}>
                              {hasDiscount ? (
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.publishedPlanStrikethrough}>
                                    ₹{basePrice.toLocaleString('en-IN')}
                                  </Text>
                                  <Text style={styles.publishedPlanOfferPrice}>
                                    ₹{offerPrice.toLocaleString('en-IN')}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={styles.publishedPlanOfferPrice}>
                                  ₹{basePrice.toLocaleString('en-IN')}
                                </Text>
                              )}
                            </View>
                          </View>

                          {p.description ? (
                            <Text style={styles.publishedPlanDescription}>{p.description}</Text>
                          ) : null}

                          {p.includedWalletCredit && p.includedWalletCredit > 0 ? (
                            <View style={styles.publishedPlanWalletChip}>
                              <Gift size={11} color="#17845A" />
                              <Text style={styles.publishedPlanWalletText}>
                                Includes ₹{p.includedWalletCredit.toLocaleString('en-IN')} Free Wallet Credit
                              </Text>
                            </View>
                          ) : null}

                          {/* Commission Row */}
                          <View style={styles.publishedPlanCommissionRow}>
                            <Text style={styles.publishedPlanCommissionText}>
                              Commission: <Text style={{ color: '#DE8626', fontWeight: '800' }}>{p.baseCommissionPercentage || 0}% + ₹{p.baseFlatCommissionPerOrder || 0}/order</Text>
                              {p.maxCommissionCapPerOrder && p.maxCommissionCapPerOrder > 0
                                ? ` (Cap ₹${p.maxCommissionCapPerOrder})`
                                : ''}
                            </Text>
                          </View>

                          {/* Entitlements Badges */}
                          {p.entitlements && p.entitlements.length > 0 ? (
                            <View style={styles.publishedPlanEntitlementsRow}>
                              {p.entitlements.map((ent, eIdx) => (
                                <View
                                  key={`cat-ent-${eIdx}`}
                                  style={[
                                    styles.entitlementBadgeItem,
                                    ent.isAllowed ? styles.entBadgeActive : styles.entBadgeInactive,
                                  ]}
                                >
                                  {ent.isAllowed ? (
                                    <CheckCircle2 size={10} color="#17845A" />
                                  ) : (
                                    <X size={10} color="#9CA3AF" />
                                  )}
                                  <Text
                                    style={[
                                      styles.entBadgeItemText,
                                      ent.isAllowed ? styles.entBadgeItemTextActive : styles.entBadgeItemTextInactive,
                                    ]}
                                  >
                                    {ent.configKey}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}

                          {/* Status Control Switch */}
                          <View style={styles.publishedPlanFooter}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <ShieldCheck size={13} color="#8C7A6B" />
                              <Text style={styles.planFooterLabel}>SuperAdmin Status Control</Text>
                            </View>

                            {isSuperAdmin ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {togglingId === p.id ? (
                                  <ActivityIndicator size="small" color="#DE8626" />
                                ) : (
                                  <Switch
                                    trackColor={{ false: '#E7E1DA', true: '#17845A' }}
                                    thumbColor="#FFFFFF"
                                    value={Boolean(p.isActive)}
                                    onValueChange={() => handleTogglePlanStatus(p)}
                                  />
                                )}
                              </View>
                            ) : (
                              <Text style={styles.readOnlyText}>READ-ONLY</Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* GILDED ALERT MODAL */}
      <GildedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  /* TOP HEADER */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1.2,
    borderBottomColor: '#E7E1DA',
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(224, 135, 38, 0.3)',
  },
  headerOutletTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerOutletSubtitle: {
    color: '#8C7A6B',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* MAIN TAB TRACK */
  mainTabTrack: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  mainTabSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 7,
  },
  mainTabSegmentActive: {
    backgroundColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  mainTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C6F62',
  },
  mainTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* WIZARD TRACKER */
  wizardTrackerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  trackerTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stepBubbleCol: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  stepBubbleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FAF7F2',
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBubbleCircleActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  stepBubbleCircleDone: {
    backgroundColor: '#17845A',
    borderColor: '#17845A',
  },
  stepBubbleNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C6F62',
  },
  stepBubbleNumberActive: {
    color: '#FFFFFF',
  },
  stepBubbleLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#7C6F62',
    textAlign: 'center',
  },
  stepBubbleLabelActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  stepBubbleLabelDone: {
    color: '#17845A',
    fontWeight: '700',
  },
  stepConnectingLine: {
    width: 14,
    height: 2,
    backgroundColor: '#E7E1DA',
    marginBottom: 14,
  },
  stepConnectingLineDone: {
    backgroundColor: '#17845A',
  },

  /* WIZARD SCROLL CONTENT */
  wizardScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10,
  },
  wizardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE4',
    marginBottom: 12,
  },
  stepBannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1F2937',
  },
  stepBannerSubtitle: {
    fontSize: 10.5,
    color: '#8C7A6B',
    marginTop: 1,
  },

  /* FORM STACK */
  formFieldsStack: {
    gap: 10,
  },
  fieldBox: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5C4E3D',
    letterSpacing: 0.4,
  },
  fieldInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7.5,
    fontSize: 12.5,
    color: '#1F2937',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },

  /* BENTO INTERVAL GRID & CARDS */
  intervalHeaderHelper: {
    fontSize: 10,
    color: '#8C7A6B',
    fontStyle: 'italic',
  },
  bentoIntervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intervalCard: {
    width: (SCREEN_WIDTH - 32 - 28 - 8) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.2,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  intervalCardSelected: {
    backgroundColor: '#FFFDF9',
    borderColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  intervalCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  intervalIconSquircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalIconSquircleActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  intervalSelectedBeacon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalUnselectedBeacon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FAF7F2',
  },
  intervalTitleText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1F2937',
  },
  intervalTitleTextActive: {
    color: '#D96B14',
  },
  intervalDurationDaysText: {
    fontSize: 10,
    color: '#7C6F62',
    fontWeight: '500',
    marginTop: 1,
    marginBottom: 6,
  },
  intervalTagBadge: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  intervalTagGreen: {
    backgroundColor: '#E4F5EC',
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  intervalTagAmber: {
    backgroundColor: '#FFF0DE',
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  intervalTagGold: {
    backgroundColor: '#DE8626',
    borderColor: '#CB741B',
  },
  intervalTagActiveGlow: {
    borderColor: '#DE8626',
  },
  intervalTagBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C6F62',
  },
  intervalTagTextGreen: {
    color: '#17845A',
  },
  intervalTagTextAmber: {
    color: '#D96B14',
  },
  intervalTagTextGold: {
    color: '#FFFFFF',
  },
  intervalFeedbackRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  intervalFeedbackText: {
    fontSize: 10.5,
    color: '#7C6F62',
    flex: 1,
  },

  /* PRICING RECEIPT */
  pricingReceiptCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 4,
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 11,
    color: '#7C6F62',
  },
  receiptVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  receiptDashedDivider: {
    height: 1,
    backgroundColor: '#E7E1DA',
    marginVertical: 4,
  },
  receiptGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptGrandLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1F2937',
  },
  receiptMonthlySub: {
    fontSize: 9.5,
    color: '#8C7A6B',
    marginTop: 1,
  },
  receiptGrandNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#DE8626',
  },

  /* BONUS WALLET */
  walletBonusCard: {
    backgroundColor: '#E4F5EC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  walletBonusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBonusTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#17845A',
  },
  walletBonusDesc: {
    fontSize: 10,
    color: '#0E6240',
    marginTop: 2,
  },

  /* COMMISSION MODEL CARDS */
  commOptionCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  commOptionCardActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
  },
  commOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commIconBoxActive: {
    backgroundColor: '#FFF0DE',
    borderColor: 'rgba(222, 134, 38, 0.4)',
  },
  commOptionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
  },
  commOptionTitleActive: {
    color: '#D96B14',
  },
  commOptionDesc: {
    fontSize: 10,
    color: '#7C6F62',
    marginTop: 1,
  },
  commExampleBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  commExampleText: {
    fontSize: 9.5,
    color: '#8C7A6B',
    fontStyle: 'italic',
  },

  /* PRESETS ROW */
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  presetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#17845A',
  },
  categoryCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
    paddingBottom: 4,
  },
  catIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeadingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },
  catCountBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  catCountBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8C7A6B',
  },
  featureRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  featureRowCardActive: {
    borderColor: 'rgba(222, 134, 38, 0.4)',
  },
  featureRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureNameText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  featureKeyText: {
    fontSize: 9,
    color: '#8C7A6B',
    marginTop: 1,
  },
  featureAddonInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE4',
  },
  addonMicroLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#7C6F62',
    marginBottom: 2,
  },
  addonMicroInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10.5,
    color: '#1F2937',
  },

  /* LIVE PREVIEW */
  previewCardWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  previewCardGradient: {
    padding: 14,
    borderRadius: 14,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewCyclePill: {
    backgroundColor: 'rgba(254, 166, 25, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  previewCyclePillText: {
    color: '#FEA619',
    fontSize: 9,
    fontWeight: '800',
  },
  previewTierTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  previewTierCode: {
    color: '#D1D5DB',
    fontSize: 9.5,
    marginTop: 1,
  },
  previewStrikethrough: {
    color: '#9CA3AF',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  previewGrandPrice: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  previewDurationSub: {
    color: '#FEA619',
    fontSize: 9.5,
    fontWeight: '700',
  },
  previewDescText: {
    color: '#E5E7EB',
    fontSize: 10.5,
    marginTop: 6,
  },
  previewGiftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  previewGiftChipText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  previewDividerLine: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  previewCommissionTelemetryBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  previewCommissionLabelText: {
    color: '#E5E7EB',
    fontSize: 10.5,
  },
  previewModulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewModuleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  previewModuleChipText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '600',
  },

  /* PUBLISH BTN */
  publishActionBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  publishActionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  publishActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* WIZARD FOOTER */
  wizardFooterControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  footerBackBtnText: {
    color: '#5C4E3D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  footerNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DE8626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  footerNextBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* CATALOG VIEW */
  catalogControlsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    paddingVertical: 0,
  },
  catalogFilterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  catalogFilterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  catalogFilterPillActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  catalogFilterPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#7C6F62',
  },
  catalogFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  catalogCardsScroll: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 32,
    gap: 10,
  },
  publishedPlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  publishedPlanTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  publishedPlanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publishedPlanTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1F2937',
  },
  planStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  planStatusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  planStatusText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  publishedPlanCodeMeta: {
    fontSize: 10.5,
    color: '#7C6F62',
    marginTop: 2,
  },
  publishedPlanPriceBlock: {
    alignItems: 'flex-end',
  },
  publishedPlanStrikethrough: {
    fontSize: 10.5,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  publishedPlanOfferPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#DE8626',
  },
  publishedPlanDescription: {
    fontSize: 11,
    color: '#5C4E3D',
    marginTop: 4,
  },
  publishedPlanWalletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  publishedPlanWalletText: {
    color: '#17845A',
    fontSize: 10,
    fontWeight: '700',
  },
  publishedPlanCommissionRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE4',
  },
  publishedPlanCommissionText: {
    fontSize: 10.5,
    color: '#5C4E3D',
  },
  publishedPlanEntitlementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  entitlementBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  entBadgeActive: {
    backgroundColor: '#E4F5EC',
  },
  entBadgeInactive: {
    backgroundColor: '#FAF7F2',
  },
  entBadgeItemText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  entBadgeItemTextActive: {
    color: '#17845A',
  },
  entBadgeItemTextInactive: {
    color: '#9CA3AF',
  },
  publishedPlanFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE4',
  },
  planFooterLabel: {
    fontSize: 10.5,
    color: '#7C6F62',
  },
  readOnlyText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8C7A6B',
  },

  /* EMPTY & LOADING */
  emptyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0DE',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  emptyNoticeText: {
    fontSize: 11,
    color: '#D96B14',
    flex: 1,
  },
  emptyCatalogBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyCatalogHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  emptyCatalogSubText: {
    fontSize: 11,
    color: '#8C7A6B',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7A6B',
  },
});
