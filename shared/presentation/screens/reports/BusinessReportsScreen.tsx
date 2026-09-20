import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Clock,
  Award,
  ShoppingBag,
  Percent,
  RefreshCw,
  X,
  ChevronRight,
  Flame,
  ChefHat,
  ArrowUpRight,
  Receipt,
  Utensils,
  Layers,
  Sparkles,
  Store,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  FileText,
  Share2,
  BadgeCheck,
  Check,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { ReportRemoteDataSource } from '../../../data/datasources/ReportRemoteDataSource';
import {
  ExecutiveDashboard,
  DatewiseSalesSummary,
  TopSellingItemsReport,
  HourlySalesHeatmap,
} from '../../../domain/models/Report';
import { SalesBarChart } from './components/SalesBarChart';
import { HourlyHeatmapChart } from './components/HourlyHeatmapChart';
import { SubscriptionRemoteDataSource } from '../../../data/datasources/SubscriptionRemoteDataSource';
import { PdfReportGenerator } from '../../../core/utils/pdfReportGenerator';

interface BusinessReportsScreenProps {
  onClose?: () => void;
  restaurantId?: number;
  isKdsAllowed?: boolean;
}

type PeriodType = 'today' | '7days' | '30days' | 'month';
type SubTabType = 'executive' | 'trends' | 'dishes' | 'hourly';

const reportDataSource = new ReportRemoteDataSource();
const subscriptionDataSource = new SubscriptionRemoteDataSource();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const BusinessReportsScreen: React.FC<BusinessReportsScreenProps> = ({
  onClose,
  restaurantId: propRestId,
  isKdsAllowed,
}) => {
  const { activeRestaurant, user } = useAuthStore();
  const restId =
    propRestId ||
    activeRestaurant?.restaurantId ||
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
    0;

  const [period, setPeriod] = useState<PeriodType>('7days');
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('executive');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // KDS Entitlement State (Hidden if IsKdsEnabled is false)
  const [kdsEnabled, setKdsEnabled] = useState<boolean>(Boolean(isKdsAllowed));

  useEffect(() => {
    if (isKdsAllowed !== undefined) {
      setKdsEnabled(isKdsAllowed);
    }
  }, [isKdsAllowed]);

  useEffect(() => {
    const checkKdsEntitlement = async () => {
      if (restId > 0 && isKdsAllowed === undefined) {
        try {
          const sub = await subscriptionDataSource.getRestaurantSubscription(restId);
          if (sub && Array.isArray(sub.entitlements)) {
            const ent: any = sub.entitlements.find(
              (e: any) => (e.configKey || e.ConfigKey || '').toLowerCase() === 'iskdsenabled'
            );
            if (ent) {
              setKdsEnabled(Boolean(ent.isAllowed ?? ent.IsAllowed));
            }
          }
        } catch {}
      }
    };
    checkKdsEntitlement();
  }, [restId, isKdsAllowed]);

  // Report Data States
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboard | null>(null);
  const [salesSummary, setSalesSummary] = useState<DatewiseSalesSummary | null>(null);
  const [topItems, setTopItems] = useState<TopSellingItemsReport | null>(null);
  const [hourlyHeatmap, setHourlyHeatmap] = useState<HourlySalesHeatmap | null>(null);

  const calculateDateRange = (p: PeriodType) => {
    const now = new Date();
    const toDate = now.toISOString().split('T')[0];
    let fromDate = toDate;

    if (p === 'today') {
      fromDate = toDate;
    } else if (p === '7days') {
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      fromDate = past.toISOString().split('T')[0];
    } else if (p === '30days') {
      const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      fromDate = past.toISOString().split('T')[0];
    } else if (p === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      fromDate = firstDay.toISOString().split('T')[0];
    }

    return { fromDate, toDate };
  };

  const loadAllReports = useCallback(
    async (isSilent = false) => {
      if (restId <= 0) return;
      if (!isSilent) setLoading(true);

      try {
        const { fromDate, toDate } = calculateDateRange(period);

        const [execRes, salesRes, topRes, hourlyRes] = await Promise.allSettled([
          reportDataSource.getExecutiveDashboard(restId),
          reportDataSource.getDatewiseSalesSummary(restId, fromDate, toDate),
          reportDataSource.getTopSellingItems(restId, fromDate, toDate, 10),
          reportDataSource.getHourlySalesHeatmap(restId, toDate),
        ]);

        if (execRes.status === 'fulfilled') setExecutiveData(execRes.value);
        if (salesRes.status === 'fulfilled') setSalesSummary(salesRes.value);
        if (topRes.status === 'fulfilled') setTopItems(topRes.value);
        if (hourlyRes.status === 'fulfilled') setHourlyHeatmap(hourlyRes.value);
      } catch (err) {
        console.warn('Failed to load reports data:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [restId, period]
  );

  useEffect(() => {
    loadAllReports();
  }, [loadAllReports]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllReports(true);
  };

  // Safe Metric Computations
  const grossSales = salesSummary?.totalGrossSales ?? executiveData?.todayGrossSales ?? 0;
  const netSales = salesSummary?.totalNetSales ?? executiveData?.todayNetSales ?? 0;
  const totalOrders = salesSummary?.totalOrders ?? executiveData?.todayTotalOrders ?? 0;
  const completedOrders = salesSummary?.completedOrders ?? executiveData?.todayCompletedOrders ?? 0;
  const cancelledOrders = salesSummary?.cancelledOrders ?? executiveData?.todayCancelledOrders ?? 0;
  const aov = salesSummary?.overallAverageOrderValue ?? executiveData?.todayAverageOrderValue ?? 0;
  const tax = salesSummary?.totalTax ?? executiveData?.todayTax ?? 0;
  const commission =
    salesSummary?.totalCommissionDeducted ?? executiveData?.todayCommissionDeducted ?? 0;
  const growth = executiveData?.salesGrowthPercentage ?? 0;

  const fulfillmentRate =
    totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '100.0';

  const periodLabelMap: Record<PeriodType, string> = {
    today: "Today's Performance",
    '7days': 'Last 7 Days',
    '30days': 'Last 30 Days',
    month: 'This Month',
  };

  const handleExportPdf = async () => {
    if (!restId || restId <= 0) {
      Alert.alert('Selection Error', 'Please select a restaurant location first.');
      return;
    }

    try {
      setExportingPdf(true);
      const { fromDate, toDate } = calculateDateRange(period);
      await PdfReportGenerator.exportAndShareReportPdf({
        restaurantName: activeRestaurant?.restaurantName || `Outlet #${restId}`,
        restaurantId: restId,
        outletAddress: activeRestaurant?.address
          ? `${activeRestaurant.address}, ${activeRestaurant.city || ''}`
          : undefined,
        periodLabel: periodLabelMap[period],
        fromDate,
        toDate,
        executiveData,
        salesSummary,
        topItems,
        generatedBy: user?.name || activeRestaurant?.ownerName || 'Store Manager',
      });
    } catch (err: any) {
      Alert.alert('PDF Export Error', err?.message || 'Failed to export report into PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* 1. TOP STREAMLINED UNIFIED HEADER (Identical to HomePage & POS) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Image
            source={
              activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                ? { uri: activeRestaurant.logoUrl.trim() }
                : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                ? { uri: (activeRestaurant as any).logo.trim() }
                : require('../../../../assets/menza-logo.png')
            }
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerOutletTitle} numberOfLines={1}>
              {activeRestaurant?.restaurantName || `Outlet #${restId}`}
            </Text>
            <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
              Business Intelligence • {periodLabelMap[period]}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Export PDF Button */}
          <TouchableOpacity
            style={[styles.headerPdfBtn, exportingPdf && styles.headerBtnDisabled]}
            onPress={handleExportPdf}
            disabled={exportingPdf}
            activeOpacity={0.8}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color="#D96B14" />
            ) : (
              <>
                <FileText size={12} color="#D96B14" strokeWidth={2.4} />
                <Text style={styles.headerPdfBtnText}>Export PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerActionBtn} onPress={onRefresh} activeOpacity={0.7}>
            <RefreshCw size={14} color="#8C7A6B" />
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity style={styles.headerCloseBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={16} color="#8C7A6B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. TIMEFRAME SLIDER SELECTOR */}
      <View style={styles.timeframeSection}>
        <View style={styles.timeframeTrack}>
          {(
            [
              { key: 'today', label: 'Today' },
              { key: '7days', label: '7 Days' },
              { key: '30days', label: '30 Days' },
              { key: 'month', label: 'This Month' },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={`period-btn-${t.key}`}
              style={[
                styles.timeframeSegment,
                period === t.key && styles.timeframeSegmentActive,
              ]}
              onPress={() => setPeriod(t.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.timeframeText,
                  period === t.key && styles.timeframeTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3. SECTION NAVIGATION PILLS */}
      <View style={styles.subTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsRow}
        >
          <TouchableOpacity
            style={[styles.subTabPill, activeSubTab === 'executive' && styles.subTabPillActive]}
            onPress={() => setActiveSubTab('executive')}
            activeOpacity={0.8}
          >
            <TrendingUp size={13} color={activeSubTab === 'executive' ? '#FFFFFF' : '#78716C'} />
            <Text
              style={[
                styles.subTabPillText,
                activeSubTab === 'executive' && styles.subTabPillTextActive,
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabPill, activeSubTab === 'trends' && styles.subTabPillActive]}
            onPress={() => setActiveSubTab('trends')}
            activeOpacity={0.8}
          >
            <BarChart3 size={13} color={activeSubTab === 'trends' ? '#FFFFFF' : '#78716C'} />
            <Text
              style={[
                styles.subTabPillText,
                activeSubTab === 'trends' && styles.subTabPillTextActive,
              ]}
            >
              Sales Trends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabPill, activeSubTab === 'dishes' && styles.subTabPillActive]}
            onPress={() => setActiveSubTab('dishes')}
            activeOpacity={0.8}
          >
            <Award size={13} color={activeSubTab === 'dishes' ? '#FFFFFF' : '#78716C'} />
            <Text
              style={[
                styles.subTabPillText,
                activeSubTab === 'dishes' && styles.subTabPillTextActive,
              ]}
            >
              Top Dishes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabPill, activeSubTab === 'hourly' && styles.subTabPillActive]}
            onPress={() => setActiveSubTab('hourly')}
            activeOpacity={0.8}
          >
            <Clock size={13} color={activeSubTab === 'hourly' ? '#FFFFFF' : '#78716C'} />
            <Text
              style={[
                styles.subTabPillText,
                activeSubTab === 'hourly' && styles.subTabPillTextActive,
              ]}
            >
              Rush Heatmap
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 4. MAIN REPORTS SCROLL */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#DE8626" />
          <Text style={styles.loadingLabel}>Aggregating store telemetry...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DE8626"
              colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
            />
          }
        >
          {/* HERO BENTO SUMMARY CARD */}
          <View style={styles.heroCardContainer}>
            <LinearGradient
              colors={['#2D2319', '#3D2F20', '#1F1811']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardGradient}
            >
              {/* Header: Period & Growth */}
              <View style={styles.heroHeaderRow}>
                <View style={styles.heroPeriodPill}>
                  <Calendar size={10} color="#FEA619" />
                  <Text style={styles.heroPeriodText}>{periodLabelMap[period]}</Text>
                </View>

                {growth !== 0 && (
                  <View
                    style={[
                      styles.growthBadge,
                      {
                        backgroundColor: growth >= 0 ? 'rgba(52, 211, 153, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                        borderColor: growth >= 0 ? 'rgba(52, 211, 153, 0.35)' : 'rgba(239, 68, 68, 0.35)',
                      },
                    ]}
                  >
                    {growth >= 0 ? (
                      <TrendingUp size={11} color="#34D399" />
                    ) : (
                      <TrendingDown size={11} color="#EF4444" />
                    )}
                    <Text
                      style={[
                        styles.growthBadgeText,
                        { color: growth >= 0 ? '#34D399' : '#EF4444' },
                      ]}
                    >
                      {growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`} vs Prev
                    </Text>
                  </View>
                )}
              </View>

              {/* Total Revenue Big Metric */}
              <View style={styles.heroAmountBlock}>
                <Text style={styles.heroAmountLabel}>GROSS STORE REVENUE</Text>
                <View style={styles.heroAmountRow}>
                  <Text style={styles.heroCurrencySymbol}>₹</Text>
                  <Text style={styles.heroAmountNumber}>{grossSales.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              {/* Bento Grid: Net, Orders, Ticket, Tax */}
              <View style={styles.bentoGrid}>
                <View style={styles.bentoCell}>
                  <View style={styles.bentoCellHeader}>
                    <Text style={styles.bentoCellLabel}>NET SALES</Text>
                    <IndianRupee size={11} color="#34D399" />
                  </View>
                  <Text style={[styles.bentoCellValue, { color: '#34D399' }]}>
                    ₹{netSales.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.bentoCellSub}>Post-tax income</Text>
                </View>

                <View style={styles.bentoCell}>
                  <View style={styles.bentoCellHeader}>
                    <Text style={styles.bentoCellLabel}>TOTAL ORDERS</Text>
                    <ShoppingBag size={11} color="#60A5FA" />
                  </View>
                  <Text style={[styles.bentoCellValue, { color: '#FFFFFF' }]}>{totalOrders}</Text>
                  <Text style={styles.bentoCellSub}>{fulfillmentRate}% fulfilled</Text>
                </View>

                <View style={styles.bentoCell}>
                  <View style={styles.bentoCellHeader}>
                    <Text style={styles.bentoCellLabel}>AVG TICKET (AOV)</Text>
                    <Sparkles size={11} color="#FEA619" />
                  </View>
                  <Text style={[styles.bentoCellValue, { color: '#FEA619' }]}>
                    ₹{Math.round(aov)}
                  </Text>
                  <Text style={styles.bentoCellSub}>Per bill</Text>
                </View>

                <View style={styles.bentoCell}>
                  <View style={styles.bentoCellHeader}>
                    <Text style={styles.bentoCellLabel}>GST COLLECTED</Text>
                    <Receipt size={11} color="#D1D5DB" />
                  </View>
                  <Text style={[styles.bentoCellValue, { color: '#D1D5DB' }]}>
                    ₹{tax.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.bentoCellSub}>Tax sum</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* 2. SUB-TAB VIEWPORT CONTENTS */}
          {activeSubTab === 'executive' && (
            <View style={styles.tabContentBlock}>
              {/* Period Highlights Benchmarks */}
              <View style={styles.periodHighlightsRow}>
                <View style={styles.highlightCard}>
                  <View style={styles.highlightCardHeader}>
                    <Text style={styles.highlightCardLabel}>THIS WEEK REVENUE</Text>
                    <TrendingUp size={12} color="#17845A" />
                  </View>
                  <Text style={styles.highlightCardValue}>
                    ₹{(executiveData?.thisWeekGrossSales || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.highlightCard}>
                  <View style={styles.highlightCardHeader}>
                    <Text style={styles.highlightCardLabel}>THIS MONTH REVENUE</Text>
                    <Sparkles size={12} color="#DE8626" />
                  </View>
                  <Text style={styles.highlightCardValue}>
                    ₹{(executiveData?.thisMonthGrossSales || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {/* Kitchen Pipeline Funnel (Shown if KDS is enabled in subscription) */}
              {kdsEnabled && executiveData?.livePipeline && (
                <View style={styles.funnelCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ChefHat size={14} color="#DE8626" />
                      <Text style={styles.cardSectionTitle}>LIVE KITCHEN PIPELINE (KDS)</Text>
                    </View>
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>KDS LIVE</Text>
                    </View>
                  </View>

                  <View style={styles.funnelStagesRow}>
                    <View style={styles.funnelStage}>
                      <View style={[styles.funnelCircle, { backgroundColor: '#FFF0DE', borderColor: '#DE8626' }]}>
                        <Text style={[styles.funnelNumber, { color: '#DE8626' }]}>
                          {executiveData.livePipeline.pending}
                        </Text>
                      </View>
                      <Text style={styles.funnelStageName}>Received</Text>
                    </View>

                    <View style={styles.funnelConnector} />

                    <View style={styles.funnelStage}>
                      <View style={[styles.funnelCircle, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
                        <Text style={[styles.funnelNumber, { color: '#3B82F6' }]}>
                          {executiveData.livePipeline.inPreparation}
                        </Text>
                      </View>
                      <Text style={styles.funnelStageName}>In Kitchen</Text>
                    </View>

                    <View style={styles.funnelConnector} />

                    <View style={styles.funnelStage}>
                      <View style={[styles.funnelCircle, { backgroundColor: '#E4F5EC', borderColor: '#17845A' }]}>
                        <Text style={[styles.funnelNumber, { color: '#17845A' }]}>
                          {executiveData.livePipeline.ready}
                        </Text>
                      </View>
                      <Text style={styles.funnelStageName}>Ready</Text>
                    </View>

                    <View style={styles.funnelConnector} />

                    <View style={styles.funnelStage}>
                      <View style={[styles.funnelCircle, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                        <Text style={[styles.funnelNumber, { color: '#D97706' }]}>
                          {executiveData.livePipeline.served}
                        </Text>
                      </View>
                      <Text style={styles.funnelStageName}>Served</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Mini Trend Bar Chart Preview */}
              {salesSummary?.dailyBreakdown && salesSummary.dailyBreakdown.length > 0 && (
                <View style={styles.chartWrapper}>
                  <View style={styles.chartCardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BarChart3 size={14} color="#DE8626" />
                      <Text style={styles.cardSectionTitle}>SALES REVENUE TIMELINE</Text>
                    </View>
                    <TouchableOpacity onPress={() => setActiveSubTab('trends')}>
                      <Text style={styles.viewMoreLink}>Full Chart ➔</Text>
                    </TouchableOpacity>
                  </View>
                  <SalesBarChart data={salesSummary.dailyBreakdown} height={180} />
                </View>
              )}
            </View>
          )}

          {activeSubTab === 'trends' && (
            <View style={styles.tabContentBlock}>
              {/* Full Featured Sales Trend Chart */}
              {salesSummary?.dailyBreakdown && salesSummary.dailyBreakdown.length > 0 ? (
                <>
                  <View style={styles.chartWrapper}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <BarChart3 size={14} color="#DE8626" />
                      <Text style={styles.cardSectionTitle}>HISTORICAL SALES OSCILLATION</Text>
                    </View>
                    <SalesBarChart data={salesSummary.dailyBreakdown} height={230} />
                  </View>

                  {/* Daily Ledger Table */}
                  <View style={styles.tableWrapper}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <Receipt size={14} color="#DE8626" />
                      <Text style={styles.cardSectionTitle}>DAILY FINANCIAL BREAKDOWN</Text>
                    </View>
                    <View style={styles.dailyTable}>
                      {salesSummary.dailyBreakdown.map((day) => (
                        <View key={`day-row-${day.date}`} style={styles.dailyRow}>
                          <View>
                            <Text style={styles.dailyRowDate}>{day.date}</Text>
                            <Text style={styles.dailyRowSub}>
                              <Text style={{ color: '#17845A', fontWeight: '700' }}>{day.completedOrders} completed</Text>
                              {day.cancelledOrders > 0 && (
                                <Text style={{ color: '#DC2626' }}> • {day.cancelledOrders} cancelled</Text>
                              )}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.dailyRowGross}>₹{day.grossSales.toLocaleString('en-IN')}</Text>
                            <Text style={styles.dailyRowAov}>Avg ₹{Math.round(day.averageOrderValue)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyCard}>
                  <BarChart3 size={32} color="#9CA3AF" />
                  <Text style={styles.emptyCardText}>No datewise sales logs for this selected period.</Text>
                </View>
              )}
            </View>
          )}

          {activeSubTab === 'dishes' && (
            <View style={styles.tabContentBlock}>
              {/* Top Selling Items Report */}
              {topItems?.items && topItems.items.length > 0 ? (
                <View style={styles.dishesCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Award size={14} color="#DE8626" />
                    <Text style={styles.cardSectionTitle}>
                      POPULAR MENU ITEMS (BY VOLUME & REVENUE)
                    </Text>
                  </View>

                  {topItems.items.map((dish, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;
                    const medalColor = isTop1 ? '#DE8626' : isTop2 ? '#8C7A6B' : isTop3 ? '#B45309' : '#7C6F62';
                    const medalBg = isTop1 ? '#FFF0DE' : isTop2 ? '#F3F4F6' : isTop3 ? '#FEF3C7' : '#FAF7F2';

                    return (
                      <View key={`top-dish-${dish.itemId}-${idx}`} style={styles.dishRow}>
                        <View style={[styles.rankMedalCircle, { backgroundColor: medalBg, borderColor: isTop1 || isTop2 || isTop3 ? medalColor : '#E7E1DA' }]}>
                          <Text style={[styles.rankMedalText, { color: medalColor }]}>
                            {idx + 1}
                          </Text>
                        </View>

                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.dishName} numberOfLines={1}>
                            {dish.itemName}
                          </Text>
                          <View style={styles.dishMetaRow}>
                            {dish.categoryName && (
                              <View style={styles.dishCategoryPill}>
                                <Text style={styles.dishCategoryText}>{dish.categoryName}</Text>
                              </View>
                            )}
                            <Text style={styles.dishSoldQty}>{dish.quantitySold} Sold</Text>
                          </View>

                          {/* Contribution Progress Bar */}
                          <View style={styles.contributionTrack}>
                            <View
                              style={[
                                styles.contributionFill,
                                {
                                  width: `${Math.min(Math.max(dish.contributionPercentage, 2), 100)}%`,
                                  backgroundColor: isTop1 ? '#DE8626' : isTop2 ? '#F59E0B' : '#17845A',
                                },
                              ]}
                            />
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.dishRevenue}>₹{dish.totalRevenue.toLocaleString('en-IN')}</Text>
                          <Text style={styles.dishPercent}>{dish.contributionPercentage.toFixed(1)}% of total</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Utensils size={32} color="#9CA3AF" />
                  <Text style={styles.emptyCardText}>No item sales captured in this window.</Text>
                </View>
              )}
            </View>
          )}

          {activeSubTab === 'hourly' && (
            <View style={styles.tabContentBlock}>
              {/* Hourly Rush & Heatmap Chart */}
              {hourlyHeatmap?.hourlySlots && hourlyHeatmap.hourlySlots.length > 0 ? (
                <HourlyHeatmapChart
                  slots={hourlyHeatmap.hourlySlots}
                  peakHourLabel={hourlyHeatmap.peakHourLabel}
                  peakHourSales={hourlyHeatmap.peakHourSales}
                />
              ) : (
                <View style={styles.emptyCard}>
                  <Clock size={32} color="#9CA3AF" />
                  <Text style={styles.emptyCardText}>No hourly sales data recorded for this period.</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  /* 1. TOP HEADER */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  headerOutletTitle: {
    color: '#1C1917',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  headerPdfBtnText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
  },
  headerBtnDisabled: {
    opacity: 0.6,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 2. TIMEFRAME SELECTOR */
  timeframeSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#FAF7F2',
  },
  timeframeTrack: {
    flexDirection: 'row',
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
  timeframeSegment: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  timeframeSegmentActive: {
    backgroundColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  timeframeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#78716C',
  },
  timeframeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* 3. SUB-TABS */
  subTabsContainer: {
    paddingVertical: 6,
  },
  subTabsRow: {
    paddingHorizontal: 16,
    gap: 6,
  },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  subTabPillActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabPillText: {
    color: '#5C4E3D',
    fontSize: 11.5,
    fontWeight: '600',
  },
  subTabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* 4. MAIN SCROLL */
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 60,
  },
  loadingLabel: {
    color: '#8C7A6B',
    fontSize: 12,
    fontWeight: '600',
  },

  /* HERO BENTO CARD */
  heroCardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  heroCardGradient: {
    padding: 14,
    borderRadius: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroPeriodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroPeriodText: {
    color: '#FEA619',
    fontSize: 10,
    fontWeight: '700',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  growthBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heroAmountBlock: {
    marginBottom: 10,
  },
  heroAmountLabel: {
    color: '#D1D5DB',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  heroCurrencySymbol: {
    color: '#FEA619',
    fontSize: 20,
    fontWeight: '800',
  },
  heroAmountNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  /* Bento Grid */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bentoCell: {
    width: (SCREEN_WIDTH - 32 - 28 - 8) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 8,
  },
  bentoCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  bentoCellLabel: {
    color: '#9CA3AF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bentoCellValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  bentoCellSub: {
    color: '#9CA3AF',
    fontSize: 9.5,
    marginTop: 1,
  },

  /* TAB CONTENT BLOCKS */
  tabContentBlock: {
    gap: 12,
  },

  /* Period Highlights */
  periodHighlightsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  highlightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  highlightCardLabel: {
    color: '#8C7A6B',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  highlightCardValue: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
  },

  /* Kitchen Pipeline Funnel */
  funnelCard: {
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionTitle: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#17845A',
  },
  liveText: {
    color: '#17845A',
    fontSize: 9,
    fontWeight: '800',
  },
  funnelStagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  funnelStage: {
    alignItems: 'center',
    gap: 4,
  },
  funnelCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  funnelNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  funnelStageName: {
    color: '#78716C',
    fontSize: 10,
    fontWeight: '600',
  },
  funnelConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E7E1DA',
    marginHorizontal: 4,
    marginBottom: 16,
  },

  /* Chart Wrappers */
  chartWrapper: {
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
  chartCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  viewMoreLink: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Table Wrapper */
  tableWrapper: {
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
  dailyTable: {
    gap: 8,
  },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE4',
  },
  dailyRowDate: {
    color: '#1F2937',
    fontSize: 12.5,
    fontWeight: '700',
  },
  dailyRowSub: {
    fontSize: 10.5,
    color: '#8C7A6B',
    marginTop: 1,
  },
  dailyRowGross: {
    color: '#1F2937',
    fontSize: 13.5,
    fontWeight: '800',
  },
  dailyRowAov: {
    color: '#8C7A6B',
    fontSize: 10.5,
    fontWeight: '600',
  },

  /* Dishes List */
  dishesCard: {
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
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE4',
  },
  rankMedalCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankMedalText: {
    fontSize: 12,
    fontWeight: '900',
  },
  dishName: {
    color: '#1F2937',
    fontSize: 12.5,
    fontWeight: '700',
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  dishCategoryPill: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dishCategoryText: {
    color: '#D96B14',
    fontSize: 9.5,
    fontWeight: '700',
  },
  dishSoldQty: {
    color: '#8C7A6B',
    fontSize: 10.5,
  },
  contributionTrack: {
    height: 4,
    backgroundColor: '#F0EBE4',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  contributionFill: {
    height: '100%',
    borderRadius: 2,
  },
  dishRevenue: {
    color: '#17845A',
    fontSize: 13,
    fontWeight: '800',
  },
  dishPercent: {
    color: '#8C7A6B',
    fontSize: 10,
    marginTop: 1,
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyCardText: {
    color: '#8C7A6B',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
