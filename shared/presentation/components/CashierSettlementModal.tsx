import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Dimensions,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  Receipt,
  Check,
  CreditCard,
  IndianRupee,
  Smartphone,
  Globe,
  Sparkles,
  Percent,
  Calculator,
  Printer,
  ChevronRight,
  Utensils,
  User,
  Clock,
} from 'lucide-react-native';
import { Colors } from '../../core/theme/colors';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { OrderMaster, SettleOrderRequest, SettleOrderResponse } from '../../domain/models/Order';
import { OrderRemoteDataSource } from '../../data/datasources/OrderRemoteDataSource';
import { RestaurantConfigRemoteDataSource } from '../../data/datasources/RestaurantConfigRemoteDataSource';
import { usePrinterStore } from '../state/usePrinterStore';
import { ReceiptData } from '../../core/printer/EscPosBuilder';
import { getSanitizedErrorMessage } from '../../core/utils/errorSanitizer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const orderDataSource = new OrderRemoteDataSource();
const configDataSource = new RestaurantConfigRemoteDataSource();

interface CashierSettlementModalProps {
  visible: boolean;
  order: OrderMaster | null;
  restaurantId: number;
  restaurantName?: string;
  onClose: () => void;
  onSettlementSuccess: (result: SettleOrderResponse) => void;
}

export const CashierSettlementModal: React.FC<CashierSettlementModalProps> = ({
  visible,
  order,
  restaurantId,
  restaurantName = 'Menza Bistro',
  onClose,
  onSettlementSuccess,
}) => {
  const { connectedDevice, printReceipt, isPrinting } = usePrinterStore();
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [discountText, setDiscountText] = useState<string>('');
  const [tenderedText, setTenderedText] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState<boolean>(true);
  const [settling, setSettling] = useState<boolean>(false);
  const [storeGst, setStoreGst] = useState<{ gstNumber?: string; cgstRate: number; sgstRate: number } | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e?.endCoordinates?.height || 280;
      setKeyboardHeight(height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const dynamicScrollMaxHeight = useMemo(() => {
    if (keyboardHeight > 0) {
      const availableSpace = SCREEN_HEIGHT - keyboardHeight - 160;
      return Math.max(140, Math.min(availableSpace, 240));
    }
    return Math.min(SCREEN_HEIGHT * 0.65, 520);
  }, [keyboardHeight]);

  useEffect(() => {
    if (visible && order) {
      const initialMode = (order.paymentMode || 'CASH').toUpperCase();
      setPaymentMode(['CASH', 'CARD', 'UPI', 'ONLINE'].includes(initialMode) ? initialMode : 'CASH');
      setDiscountText('');
      setRemarks('');
      setTenderedText('');

      const targetRestId = order.restaurantId || restaurantId;
      if (targetRestId && targetRestId > 0) {
        configDataSource
          .getConfig(targetRestId)
          .then((cfg) => {
            setStoreGst({
              gstNumber: cfg.gstNumber?.trim() || undefined,
              cgstRate: cfg.cgstPercentage ?? 2.5,
              sgstRate: cfg.sgstPercentage ?? 2.5,
            });
          })
          .catch(() => {
            setStoreGst(null);
          });
      }
    }
  }, [visible, order, restaurantId]);

  // Calculations
  const calculations = useMemo(() => {
    if (!order) {
      return {
        baseSubtotal: 0,
        discountVal: 0,
        taxableAmount: 0,
        hasGst: false,
        cgst: 0,
        sgst: 0,
        totalTax: 0,
        netTotal: 0,
        tenderedVal: 0,
        changeToReturn: 0,
      };
    }

    const items = order.items && order.items.length > 0 ? order.items : [];
    const itemsTotal = items.reduce((acc, it) => acc + (it.totalPrice || it.quantity * it.unitPrice), 0);
    const baseSubtotal = order.subtotal && order.subtotal > 0 ? order.subtotal : (itemsTotal > 0 ? itemsTotal : order.totalAmount);

    const discountVal = Math.min(Math.max(0, parseFloat(discountText) || 0), baseSubtotal);
    const taxableAmount = Math.max(0, baseSubtotal - discountVal);

    const effectiveGstNum = storeGst?.gstNumber || order.gstNumber;
    const hasGst = Boolean(effectiveGstNum && effectiveGstNum.trim().length > 0);

    const cgstRate = storeGst?.cgstRate ?? 2.5;
    const sgstRate = storeGst?.sgstRate ?? 2.5;

    let cgst = 0;
    let sgst = 0;
    if (hasGst) {
      cgst = Number(((taxableAmount * cgstRate) / 100).toFixed(2));
      sgst = Number(((taxableAmount * sgstRate) / 100).toFixed(2));
    }
    const totalTax = cgst + sgst;
    const netTotal = Math.round((taxableAmount + totalTax) * 100) / 100;

    const tenderedVal = parseFloat(tenderedText) || 0;
    const changeToReturn = Math.max(0, tenderedVal - netTotal);

    return {
      baseSubtotal,
      discountVal,
      taxableAmount,
      hasGst,
      effectiveGstNum,
      cgstRate,
      sgstRate,
      cgst,
      sgst,
      totalTax,
      netTotal,
      tenderedVal,
      changeToReturn,
    };
  }, [order, discountText, tenderedText, storeGst]);

  const handleQuickTender = (amt: number) => {
    setTenderedText(amt.toString());
  };

  const handleConfirmSettlement = async () => {
    if (!order) return;

    try {
      setSettling(true);

      const targetOrderId = (() => {
        if (typeof order.id === 'number' && !isNaN(order.id) && order.id > 0) return order.id;
        if (typeof (order as any).orderId === 'number' && (order as any).orderId > 0) return (order as any).orderId;
        if (typeof order.id === 'string') {
          const match = (order.id as string).match(/^notif_(\d+)_/);
          if (match && match[1]) return parseInt(match[1], 10);
          const parsed = parseInt(order.id, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        return 0;
      })();

      if (!targetOrderId || targetOrderId <= 0) {
        Alert.alert('Invalid Order', 'Cannot settle order: Invalid order ID.');
        return;
      }

      const requestPayload: SettleOrderRequest = {
        orderId: targetOrderId,
        paymentMode,
        discountAmount: calculations.discountVal > 0 ? calculations.discountVal : 0,
        tenderedAmount: paymentMode === 'CASH' && calculations.tenderedVal > 0 ? calculations.tenderedVal : undefined,
        changeAmount: paymentMode === 'CASH' && calculations.changeToReturn > 0 ? calculations.changeToReturn : undefined,
        billingMode: 'POST_PAID',
        remarks: remarks.trim() || undefined,
        orderStatus: 'Settled',
      };

      const result = await orderDataSource.settleOrder(targetOrderId, requestPayload);

      if (result.success || result.isAlreadySettled) {
        // Auto-print thermal receipt if requested and printer connected
        if (autoPrint && connectedDevice) {
          try {
            const itemsList = order.items && order.items.length > 0
              ? order.items
              : [{ itemId: 0, itemName: 'Settled Order Total', quantity: 1, unitPrice: calculations.netTotal, totalPrice: calculations.netTotal }];

            const effectiveAddress = (() => {
              const addr = order.address?.trim() || '';
              const city = order.city?.trim() || '';
              const state = order.state?.trim() || '';

              const parts: string[] = [];
              if (addr) parts.push(addr);
              if (city && !addr.toLowerCase().includes(city.toLowerCase())) parts.push(city);
              if (state && !addr.toLowerCase().includes(state.toLowerCase())) parts.push(state);

              return parts.join(', ');
            })();

            const receiptData: ReceiptData = {
              orderId: String(order.orderNumber || order.id),
              orderNumber: String(order.orderNumber || order.id),
              pickupToken: order.pickupToken,
              restaurantName: order.restaurantName || restaurantName || 'Menza Bistro',
              address: effectiveAddress || undefined,
              contactPhone: order.contactNumber || order.contactPhone || undefined,
              logoUrl: order.logoUrl || undefined,
              gstNumber: calculations.hasGst ? calculations.effectiveGstNum : undefined,
              customerName: order.customerName || 'Walk-in Customer',
              customerPhone: order.mobileNumber || undefined,
              source: order.source || order.tableName || undefined,
              tableName: order.source || order.tableName || undefined,
              orderType: order.orderTypeName || 'Dine-In',
              items: itemsList.map((it) => ({
                itemName: it.itemName,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice || it.quantity * it.unitPrice,
                cookingInstruction: it.cookingInstruction,
              })),
              subtotal: calculations.taxableAmount,
              cgstAmount: calculations.hasGst ? calculations.cgst : undefined,
              sgstAmount: calculations.hasGst ? calculations.sgst : undefined,
              cgstPercentage: calculations.hasGst ? calculations.cgstRate : undefined,
              sgstPercentage: calculations.hasGst ? calculations.sgstRate : undefined,
              taxAmount: calculations.totalTax,
              grandTotal: calculations.netTotal,
              date: new Date(),
            };

            await printReceipt(receiptData);
          } catch (err: any) {
            console.warn('Auto print receipt error:', err?.message);
          }
        }

        Alert.alert(
          'Order Settled! 💵',
          `Order #${order.orderNumber || order.id} has been settled successfully for ₹${calculations.netTotal.toLocaleString('en-IN')}.`,
          [{ text: 'OK', onPress: () => onSettlementSuccess(result) }]
        );
      } else {
        Alert.alert('Settlement Failed', result.message || 'Unable to settle order at this time.');
      }
    } catch (err: any) {
      Alert.alert('Settlement Error', getSanitizedErrorMessage(err, 'Failed to settle order. Please try again.'));
    } finally {
      setSettling(false);
    }
  };

  if (!order) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.modalOverlay,
          keyboardHeight > 0 && Platform.OS === 'android' && {
            justifyContent: 'center',
            paddingBottom: Math.min(keyboardHeight, 280),
          },
        ]}
      >
        <View style={styles.modalContent}>
          {/* 1. Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconCircle}>
                  <Receipt size={18} color="#DE8626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    Settle Order #{order.orderNumber || order.id}
                  </Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {order.tableName ? `Table ${order.tableName}` : order.orderTypeName || 'Counter'} • {order.customerName || 'Walk-in Guest'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.75}>
                <X size={18} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={[styles.scrollBody, { maxHeight: dynamicScrollMaxHeight }]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
            {/* 2. Items Preview */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Utensils size={13} color="#DE8626" />
                <Text style={styles.sectionLabel}>ORDER BREAKDOWN</Text>
              </View>

              <View style={styles.itemsCard}>
                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => (
                    <View key={`settle-item-${idx}`} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{it.quantity}×</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {it.itemName}
                      </Text>
                      <Text style={styles.itemTotal}>
                        ₹{(it.totalPrice || it.quantity * it.unitPrice).toFixed(2)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName}>Order Balance</Text>
                    <Text style={styles.itemTotal}>₹{(order.totalAmount && order.totalAmount > 0 ? order.totalAmount : calculations.baseSubtotal).toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* 3. Discount Input Card */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Percent size={13} color="#DE8626" />
                <Text style={styles.sectionLabel}>CASHIER DISCOUNT (OPTIONAL)</Text>
              </View>
              <View style={styles.discountInputBox}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.discountInput}
                  placeholder="0.00 (Flat discount in rupees)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={discountText}
                  onChangeText={setDiscountText}
                />
                {discountText.length > 0 && (
                  <TouchableOpacity onPress={() => setDiscountText('')} style={styles.clearBtn}>
                    <X size={14} color="#8C7A6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 4. Tax & Grand Total Summary Box */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>Subtotal</Text>
                <Text style={styles.totalRowVal}>₹{calculations.baseSubtotal.toFixed(2)}</Text>
              </View>

              {calculations.discountVal > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalRowLabel, { color: '#17845A' }]}>Cashier Discount</Text>
                  <Text style={[styles.totalRowVal, { color: '#17845A', fontWeight: '700' }]}>
                    - ₹{calculations.discountVal.toFixed(2)}
                  </Text>
                </View>
              )}

              {calculations.hasGst && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalRowLabel}>CGST @ {calculations.cgstRate}%</Text>
                    <Text style={styles.totalRowVal}>₹{calculations.cgst.toFixed(2)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalRowLabel}>SGST @ {calculations.sgstRate}%</Text>
                    <Text style={styles.totalRowVal}>₹{calculations.sgst.toFixed(2)}</Text>
                  </View>
                </>
              )}

              <View style={styles.grandDivider} />

              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>NET PAYABLE</Text>
                <Text style={styles.grandValue}>₹{calculations.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {/* 5. Payment Mode Switcher */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <CreditCard size={13} color="#DE8626" />
                <Text style={styles.sectionLabel}>PAYMENT MODE</Text>
              </View>

              <View style={styles.paymentModesGrid}>
                {[
                  { key: 'CASH', label: 'Cash', icon: IndianRupee },
                  { key: 'UPI', label: 'UPI / QR', icon: Smartphone },
                  { key: 'CARD', label: 'Card / POS', icon: CreditCard },
                  { key: 'ONLINE', label: 'Online', icon: Globe },
                ].map((mode) => {
                  const isSelected = paymentMode === mode.key;
                  const IconComponent = mode.icon;
                  return (
                    <TouchableOpacity
                      key={`mode-${mode.key}`}
                      style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                      onPress={() => setPaymentMode(mode.key)}
                      activeOpacity={0.8}
                    >
                      <IconComponent size={16} color={isSelected ? '#FFFFFF' : '#8C7A6B'} />
                      <Text style={[styles.modeCardText, isSelected && styles.modeCardTextSelected]}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 6. Cash Calculator (Visible only when CASH is selected) */}
            {paymentMode === 'CASH' && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Calculator size={13} color="#DE8626" />
                  <Text style={styles.sectionLabel}>CASH TENDERED & CHANGE</Text>
                </View>

                <View style={styles.cashCalculatorBox}>
                  <View style={styles.tenderedInputRow}>
                    <Text style={styles.tenderedLabel}>Tendered Cash:</Text>
                    <View style={styles.tenderedInputWrap}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.tenderedInput}
                        placeholder={calculations.netTotal.toFixed(0)}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={tenderedText}
                        onChangeText={setTenderedText}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                          }, 150);
                        }}
                      />
                    </View>
                  </View>

                  {/* Quick Shortcut Pills */}
                  <View style={styles.quickPillsRow}>
                    <TouchableOpacity
                      style={styles.quickPill}
                      onPress={() => handleQuickTender(calculations.netTotal)}
                    >
                      <Text style={styles.quickPillText}>Exact ₹{calculations.netTotal.toFixed(0)}</Text>
                    </TouchableOpacity>
                    {[100, 500, 2000].map((amt) => {
                      const roundedTarget = Math.ceil(calculations.netTotal / amt) * amt;
                      if (roundedTarget <= calculations.netTotal && amt < calculations.netTotal) return null;
                      return (
                        <TouchableOpacity
                          key={`pill-${amt}`}
                          style={styles.quickPill}
                          onPress={() => handleQuickTender(roundedTarget || amt)}
                        >
                          <Text style={styles.quickPillText}>₹{roundedTarget || amt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Change to return banner */}
                  <View style={styles.changeReturnRow}>
                    <Text style={styles.changeReturnLabel}>Change to Return:</Text>
                    <Text style={[styles.changeReturnValue, calculations.changeToReturn > 0 && { color: '#17845A' }]}>
                      ₹{calculations.changeToReturn.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 7. Settlement Remarks */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>REMARKS / NOTES</Text>
              <TextInput
                style={styles.remarksInput}
                placeholder="Optional settlement remarks..."
                placeholderTextColor="#9CA3AF"
                value={remarks}
                onChangeText={setRemarks}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />
            </View>

            {/* 8. Auto Print Toggle */}
            <TouchableOpacity
              style={styles.autoPrintToggleRow}
              onPress={() => setAutoPrint(!autoPrint)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxBox, autoPrint && styles.checkboxBoxActive]}>
                {autoPrint && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Printer size={15} color="#DE8626" />
              <Text style={styles.autoPrintText}>Print Tax Invoice Receipt on Settle</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* 9. Bottom Action Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={settling}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, settling && styles.confirmBtnDisabled]}
              onPress={handleConfirmSettlement}
              disabled={settling}
              activeOpacity={0.85}
            >
              {settling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.confirmBtnText} numberOfLines={1}>
                    Confirm & Settle ₹{calculations.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0DE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.semiBold,
    fontWeight: '700',
    color: '#2D2319',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: '#8C7A6B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F5F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    maxHeight: Math.min(SCREEN_HEIGHT * 0.65, 520),
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    fontWeight: '700',
    color: '#8C7A6B',
    letterSpacing: 0.5,
  },
  itemsCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DE8626',
    width: 24,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: '#2D2319',
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2319',
  },
  discountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    paddingHorizontal: 12,
    height: 44,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DE8626',
    marginRight: 6,
  },
  discountInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D2319',
  },
  clearBtn: {
    padding: 4,
  },
  totalsCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE4C8',
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  totalRowLabel: {
    fontSize: 12,
    color: '#8C7A6B',
  },
  totalRowVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2319',
  },
  grandDivider: {
    height: 1,
    backgroundColor: '#F5D7B5',
    marginVertical: 8,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2319',
  },
  grandValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DE8626',
  },
  paymentModesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  modeCardSelected: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  modeCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  modeCardTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cashCalculatorBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  tenderedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tenderedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2319',
  },
  tenderedInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    height: 36,
    width: 120,
  },
  tenderedInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2319',
  },
  quickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  changeReturnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  changeReturnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2319',
  },
  changeReturnValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2319',
  },
  remarksInput: {
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: '#2D2319',
    marginTop: 4,
  },
  autoPrintToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  autoPrintText: {
    fontSize: 13,
    color: '#2D2319',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3EFEA',
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#17845A',
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
