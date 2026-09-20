import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import {
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  PlusCircle,
  TrendingDown,
  Download,
  FileSpreadsheet,
  FileText,
  Share2,
} from 'lucide-react-native';
import { Colors } from '../../core/theme/colors';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { StatusBadge } from './StatusBadge';
import { RestaurantWallet, WalletTransaction } from '../../domain/models/Wallet';
import { WalletRemoteDataSource } from '../../data/datasources/WalletRemoteDataSource';
import { WalletRepositoryImpl } from '../../data/repositories/WalletRepositoryImpl';
import { CashfreeSdkService } from '../../data/datasources/CashfreeSdkService';
import { PdfLedgerGenerator } from '../../core/utils/pdfLedgerGenerator';
import { useAuthStore } from '../state/useAuthStore';

const walletRepository = new WalletRepositoryImpl(new WalletRemoteDataSource());

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

interface WalletRechargeModalProps {
  visible: boolean;
  onClose: () => void;
  onRechargeSuccess?: () => void;
  initialTab?: 'recharge' | 'history';
  restaurantId?: number;
}

export const WalletRechargeModal: React.FC<WalletRechargeModalProps> = ({
  visible,
  onClose,
  onRechargeSuccess,
  initialTab = 'recharge',
  restaurantId: propRestId,
}) => {
  const { activeRestaurant, user } = useAuthStore();
  const [wallet, setWallet] = useState<RestaurantWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmountText, setCustomAmountText] = useState<string>('1000');
  const [activeTab, setActiveTab] = useState<'recharge' | 'history'>(initialTab);
  const [recharging, setRecharging] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const restaurantId =
    propRestId ||
    activeRestaurant?.restaurantId ||
    (activeRestaurant as any)?.id ||
    (activeRestaurant as any)?.RestaurantId ||
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
    0;

  const handleExportPdf = async () => {
    if (!restaurantId || restaurantId <= 0) {
      Alert.alert('Selection Error', 'Please select a restaurant location first.');
      return;
    }

    try {
      setExportingPdf(true);
      await PdfLedgerGenerator.exportAndSharePdf({
        restaurantName: activeRestaurant?.restaurantName || 'Menza Bistro',
        restaurantId,
        outletAddress: activeRestaurant?.address
          ? `${activeRestaurant.address}, ${activeRestaurant.city || ''}`
          : undefined,
        contactNumber: activeRestaurant?.ownerMobile || user?.mobile,
        wallet,
        transactions,
        generatedBy: user?.name || activeRestaurant?.ownerName || 'Store Manager',
      });
    } catch (err: any) {
      Alert.alert('PDF Export Error', err?.message || 'Failed to export wallet statement into PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportStatement = async () => {
    if (!restaurantId || restaurantId <= 0) {
      Alert.alert('Selection Error', 'Please select a restaurant location first.');
      return;
    }

    try {
      setExportingCsv(true);
      const csvData = await walletRepository.exportStatement(restaurantId);
      if (!csvData) {
        Alert.alert('Export Notice', 'No wallet transactions found for this period to export.');
        return;
      }

      const fileName = `Wallet_Statement_Rest_${restaurantId}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: csvData,
          title: fileName,
        });
      }

      Alert.alert('Export Successful! 📄', `Wallet statement has been downloaded (${fileName}).`);
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to export wallet statement.');
    } finally {
      setExportingCsv(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (restaurantId > 0) {
        loadWalletData();
      }
    }
  }, [visible, restaurantId, initialTab]);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const data = await walletRepository.getWallet(restaurantId);
      setWallet(data);
      const txns = await walletRepository.getTransactions(restaurantId);
      setTransactions(txns);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmountText(amt.toString());
  };

  const handleCustomChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmountText(cleaned);
    const parsed = parseInt(cleaned, 10);
    setSelectedAmount(!isNaN(parsed) && parsed > 0 ? parsed : 0);
  };

  const handleInitiateRecharge = async () => {
    if (selectedAmount < 100) {
      Alert.alert('Minimum Amount', 'Please enter a minimum recharge amount of ₹100.');
      return;
    }

    if (restaurantId <= 0) {
      Alert.alert('No Restaurant', 'Please select a restaurant location first.');
      return;
    }

    try {
      setRecharging(true);
      const res = await walletRepository.initiateRecharge(
        restaurantId,
        selectedAmount,
        user?.mobile || '9999999999'
      );

      if (!res.success || !res.orderId) {
        Alert.alert('Error', res.message || 'Could not initiate recharge order.');
        setRecharging(false);
        return;
      }

      // If Cashfree PG SDK is available, launch PG checkout
      if (res.paymentSessionId || res.instrumentResponseUrl) {
        try {
          await CashfreeSdkService.getInstance().startPayment({
            orderId: res.orderId,
            paymentSessionId: res.paymentSessionId || '',
            paymentLink: res.instrumentResponseUrl || '',
            environment: 'SANDBOX',
          });
        } catch {
          // Native SDK fallback
        }
      }

      // Verify and credit wallet
      const verifyRes = await walletRepository.verifyRecharge(res.orderId, restaurantId, selectedAmount);
      if (verifyRes.success) {
        Alert.alert(
          'Recharge Successful! 🎉',
          `₹${selectedAmount.toLocaleString('en-IN')} has been added to your Commission Wallet.`
        );
        await loadWalletData();
        onRechargeSuccess?.();
      } else {
        Alert.alert('Payment Status', verifyRes.message || 'Recharge verification pending.');
      }
    } catch (err: any) {
      Alert.alert('Recharge Error', err?.message || 'Failed to complete wallet recharge.');
    } finally {
      setRecharging(false);
    }
  };

  if (!visible) return null;

  const currentBalance = wallet?.balance ?? 0;
  const projectedBalance = currentBalance + (selectedAmount > 0 ? selectedAmount : 0);
  const isLowBalance = currentBalance < (wallet?.lowBalanceThreshold ?? 200);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBox}>
              <Wallet size={22} color="#DE8626" />
              <Text style={styles.headerTitle}>Commission Wallet</Text>
            </View>
            <TouchableOpacity style={styles.closeIconBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color="#8C7A6B" />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'recharge' && styles.tabItemActive]}
              onPress={() => setActiveTab('recharge')}
              activeOpacity={0.8}
            >
              <PlusCircle size={16} color={activeTab === 'recharge' ? '#D96B14' : '#6B7280'} />
              <Text style={[styles.tabText, activeTab === 'recharge' && styles.tabTextActive]}>Top Up Credit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
              onPress={() => setActiveTab('history')}
              activeOpacity={0.8}
            >
              <History size={16} color={activeTab === 'history' ? '#D96B14' : '#6B7280'} />
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Transactions</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#DE8626" />
              <Text style={styles.loadingText}>Loading wallet details...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Balance Showcase Card */}
              <View style={[styles.balanceCard, isLowBalance && styles.balanceCardLow]}>
                <View style={styles.balanceHeaderRow}>
                  <Text style={styles.balanceLabel}>PREPAID BALANCE</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.cardPdfQuickBtn}
                      onPress={handleExportPdf}
                      disabled={exportingPdf}
                      activeOpacity={0.8}
                    >
                      {exportingPdf ? (
                        <ActivityIndicator size="small" color="#D96B14" />
                      ) : (
                        <>
                          <FileText size={12} color="#D96B14" strokeWidth={2.4} />
                          <Text style={styles.cardPdfQuickBtnText}>PDF Statement</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <StatusBadge
                      label={isLowBalance ? 'LOW BALANCE' : 'HEALTHY'}
                      variant={isLowBalance ? 'warning' : 'success'}
                    />
                  </View>
                </View>
                <Text style={styles.balanceValue}>₹{currentBalance.toLocaleString('en-IN')}</Text>
                <Text style={styles.balanceSubtext}>
                  Used for auto-deducting commission on POS Walk-in Cash orders
                </Text>
              </View>

              {isLowBalance && (
                <View style={styles.warningBanner}>
                  <AlertTriangle size={16} color="#A96300" />
                  <Text style={styles.warningText}>
                    Wallet balance is low. Recharge to ensure uninterrupted POS Walk-in order taking.
                  </Text>
                </View>
              )}

              {activeTab === 'recharge' ? (
                <>
                  {/* Preset Amount Chips */}
                  <Text style={styles.sectionHeading}>Select Recharge Amount</Text>
                  <View style={styles.presetGrid}>
                    {PRESET_AMOUNTS.map((amt) => {
                      const isSelected = selectedAmount === amt;
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                          onPress={() => handleSelectPreset(amt)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.presetText, isSelected && styles.presetTextSelected]}>
                            +₹{amt.toLocaleString('en-IN')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Custom Amount Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={customAmountText}
                      onChangeText={handleCustomChange}
                      placeholder="Enter custom amount"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {/* Projected Balance Breakdown */}
                  <View style={styles.breakdownBox}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Current Balance:</Text>
                      <Text style={styles.breakdownValue}>₹{currentBalance.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Top-up Amount:</Text>
                      <Text style={[styles.breakdownValue, { color: '#DE8626' }]}>
                        +₹{(selectedAmount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownTotalLabel}>Projected Balance:</Text>
                      <Text style={styles.breakdownTotalValue}>₹{projectedBalance.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>

                  {/* Pay via Cashfree Button */}
                  <TouchableOpacity
                    style={[styles.payButton, recharging && styles.payButtonDisabled]}
                    onPress={handleInitiateRecharge}
                    disabled={recharging}
                    activeOpacity={0.85}
                  >
                    {recharging ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CreditCard size={18} color="#FFFFFF" />
                        <Text style={styles.payButtonText}>
                          Pay ₹{(selectedAmount || 0).toLocaleString('en-IN')} via CashFree PG
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                /* Transaction History Tab */
                <View style={styles.historyContainer}>
                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.sectionHeading}>Recent Ledger Activity</Text>
                    {transactions.length > 0 && (
                      <View style={styles.exportBtnGroup}>
                        <TouchableOpacity
                          style={[styles.exportPdfBtn, exportingPdf && styles.exportBtnDisabled]}
                          onPress={handleExportPdf}
                          disabled={exportingPdf}
                          activeOpacity={0.85}
                        >
                          {exportingPdf ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <FileText size={12} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.exportPdfBtnText}>Export PDF</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.exportCsvBtn, exportingCsv && styles.exportBtnDisabled]}
                          onPress={handleExportStatement}
                          disabled={exportingCsv}
                          activeOpacity={0.8}
                        >
                          {exportingCsv ? (
                            <ActivityIndicator size="small" color="#D96B14" />
                          ) : (
                            <>
                              <Download size={12} color="#D96B14" strokeWidth={2.2} />
                              <Text style={styles.exportCsvBtnText}>CSV</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {transactions.length === 0 ? (
                    <Text style={styles.emptyText}>No recent wallet transactions found.</Text>
                  ) : (
                    transactions.map((txn) => {
                      const isCredit =
                        txn.direction?.toUpperCase() === 'CREDIT' ||
                        (txn.balanceAfter !== undefined && txn.balanceBefore !== undefined && txn.balanceAfter > txn.balanceBefore) ||
                        txn.transactionType === 'RECHARGE' ||
                        txn.transactionType === 'REFUND' ||
                        txn.transactionType === 'BONUS_CREDIT' ||
                        txn.transactionType === 'BONUS' ||
                        (txn.transactionType || '').toUpperCase().includes('CREDIT') ||
                        (txn.description || '').toLowerCase().includes('credit') ||
                        (txn.description || '').toLowerCase().includes('bonus') ||
                        (txn.description || '').toLowerCase().includes('complimentary') ||
                        (txn.description || '').toLowerCase().includes('recharge') ||
                        (txn.description || '').toLowerCase().includes('top-up') ||
                        (txn.description || '').toLowerCase().includes('refund');
                      return (
                        <View key={txn.id} style={styles.txnCard}>
                          <View style={styles.txnLeft}>
                            <View style={[styles.txnIconBox, isCredit ? styles.txnIconCredit : styles.txnIconDebit]}>
                              {isCredit ? (
                                <ArrowDownLeft size={16} color="#17845A" />
                              ) : (
                                <ArrowUpRight size={16} color="#DC2626" />
                              )}
                            </View>
                            <View style={styles.txnInfo}>
                              <Text style={styles.txnDesc} numberOfLines={1}>
                                {txn.description}
                              </Text>
                              <Text style={styles.txnDate}>
                                {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.txnRight}>
                            <Text style={[styles.txnAmount, isCredit ? styles.txnAmountCredit : styles.txnAmountDebit]}>
                              {isCredit ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                            </Text>
                            <Text style={styles.txnBalAfter}>Bal: ₹{txn.balanceAfter.toLocaleString('en-IN')}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.cardLarge,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
  },
  closeIconBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Spacing.borderRadius.sm,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  tabText: {
    color: '#6B7280',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  tabTextActive: {
    color: '#D96B14',
    fontWeight: Typography.fontWeight.bold,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  loadingBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.sm,
  },
  balanceCard: {
    backgroundColor: '#FAF7F2',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  balanceCardLow: {
    borderColor: 'rgba(254, 166, 25, 0.45)',
    backgroundColor: '#FFF3DC',
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#7C6F62',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
  },
  balanceValue: {
    color: '#1F2937',
    fontSize: 32,
    fontWeight: Typography.fontWeight.bold,
    marginVertical: 4,
  },
  balanceSubtext: {
    color: '#5C4E3D',
    fontSize: 11,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3DC',
    borderColor: 'rgba(254, 166, 25, 0.45)',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.sm,
    gap: 8,
    marginBottom: Spacing.md,
  },
  warningText: {
    flex: 1,
    color: '#A96300',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeading: {
    color: '#1F2937',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  presetChip: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipSelected: {
    borderColor: '#DE8626',
    backgroundColor: '#FFF0DE',
  },
  presetText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  presetTextSelected: {
    color: '#D96B14',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.md,
  },
  currencyPrefix: {
    color: '#DE8626',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
  },
  breakdownBox: {
    backgroundColor: '#FAF7F2',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  breakdownLabel: {
    color: '#7C6F62',
    fontSize: Typography.fontSize.xs,
  },
  breakdownValue: {
    color: '#1F2937',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: '#E7E1DA',
    marginVertical: 6,
  },
  breakdownTotalLabel: {
    color: '#1F2937',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  breakdownTotalValue: {
    color: '#17845A',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DE8626',
    height: 48,
    borderRadius: Spacing.borderRadius.md,
    gap: 8,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
  historyContainer: {
    gap: Spacing.sm,
  },
  emptyText: {
    color: '#7C6F62',
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  txnCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.sm,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txnIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconCredit: {
    backgroundColor: '#E4F5EC',
  },
  txnIconDebit: {
    backgroundColor: '#FEE2E2',
  },
  txnInfo: {
    flex: 1,
  },
  txnDesc: {
    color: '#1F2937',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  txnDate: {
    color: '#7C6F62',
    fontSize: 10,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  txnAmountCredit: {
    color: '#17845A',
  },
  txnAmountDebit: {
    color: '#DC2626',
  },
  txnBalAfter: {
    color: '#7C6F62',
    fontSize: 10,
    marginTop: 2,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardPdfQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  cardPdfQuickBtnText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
  },
  exportBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DE8626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  exportPdfBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
  exportCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 3,
  },
  exportCsvBtnText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
});
