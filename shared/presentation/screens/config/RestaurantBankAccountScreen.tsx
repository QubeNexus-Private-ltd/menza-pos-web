import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Edit3,
  HelpCircle,
  Info,
  Lock,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { isCashierOnly, canEditStoreConfig } from '../../../core/auth/rolePermissions';
import {
  RestaurantBankRemoteDataSource,
  RestaurantBankAccountResponse,
  VerifyBankAccountResponse,
} from '../../../data/datasources/RestaurantBankRemoteDataSource';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const bankRemoteDataSource = new RestaurantBankRemoteDataSource();

interface RestaurantBankAccountScreenProps {
  onClose: () => void;
}

export const RestaurantBankAccountScreen: React.FC<RestaurantBankAccountScreenProps> = ({ onClose }) => {
  const { activeRestaurant, user } = useAuthStore();
  const currentRestId =
    activeRestaurant?.restaurantId ||
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
    1;

  const cashierRestricted = isCashierOnly(user, activeRestaurant) || !canEditStoreConfig(user, activeRestaurant);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [bankData, setBankData] = useState<RestaurantBankAccountResponse | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form Fields
  const [accountHolder, setAccountHolder] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>('');
  const [ifsc, setIfsc] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Cashfree Penny Drop Verification State
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerifyBankAccountResponse | null>(null);

  // Alert Modal Config
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'danger' | 'warning' | 'info' = 'success',
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      onConfirm,
    });
  };

  useEffect(() => {
    loadBankAccount();
  }, [currentRestId]);

  const loadBankAccount = async () => {
    try {
      setLoading(true);
      const data = await bankRemoteDataSource.getBankAccount(currentRestId);
      setBankData(data);

      if (data) {
        setAccountHolder(data.accountHolder || '');
        setIfsc(data.ifsc || '');
        setBankName(data.bankName || '');
        setIsEditing(false);
      } else {
        // Pre-fill email and phone from store profile if first time
        setEmail((user as any)?.email || '');
        setPhoneNumber(activeRestaurant?.ownerMobile || '');
        setIsEditing(true);
      }
    } catch (error: any) {
      showAlert(
        'Connection Issue',
        error?.response?.data?.message || 'Could not load bank details. Please check your network.',
        'danger'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBankAccount = async (): Promise<boolean> => {
    if (cashierRestricted) {
      showAlert('Access Restricted', 'Only Store Owners and Administrators can verify bank details.', 'warning');
      return false;
    }

    const cleanAcct = accountNumber.trim();
    const cleanConfirm = confirmAccountNumber.trim();
    const cleanIfsc = ifsc.trim().toUpperCase();
    const cleanHolder = accountHolder.trim();
    const cleanPhone = phoneNumber.trim().replace(/[^0-9]/g, '');

    if (!cleanAcct) {
      showAlert('Account Number Required', 'Please enter the bank account number first.', 'warning');
      return false;
    }

    if (cleanAcct.length < 9 || cleanAcct.length > 20) {
      showAlert('Invalid Account Number', 'Bank account numbers must typically be between 9 and 20 digits.', 'warning');
      return false;
    }

    if (cleanConfirm && cleanAcct !== cleanConfirm) {
      showAlert('Account Mismatch', 'The confirmed account number does not match. Please recheck.', 'warning');
      return false;
    }

    if (!cleanIfsc || cleanIfsc.length !== 11) {
      showAlert('Invalid IFSC Code', 'Please enter a valid 11-character IFSC code (e.g. HDFC0000001).', 'warning');
      return false;
    }

    try {
      setVerifying(true);
      const res = await bankRemoteDataSource.verifyBankAccount({
        accountNumber: cleanAcct,
        ifsc: cleanIfsc,
        accountHolder: cleanHolder || undefined,
        phoneNumber: cleanPhone.slice(-10) || undefined,
      });

      setVerificationResult(res);

      if (res.isValid) {
        setVerified(true);
        if (res.registeredName && (!cleanHolder || cleanHolder.length < 3)) {
          setAccountHolder(res.registeredName);
        }
        if (res.bankName && !bankName.trim()) {
          setBankName(res.bankName);
        }
        showAlert(
          'Bank Account Verified',
          `✓ Bank account confirmed active via Cashfree Penny Drop.\n\n` +
            `• Registered Beneficiary: ${res.registeredName || cleanHolder || 'Active'}\n` +
            `• Bank: ${res.bankName || 'Verified'}\n` +
            (res.utr ? `• IMPS UTR: ${res.utr}\n\n` : '\n') +
            `Ready for 100% direct payouts.`,
          'success'
        );
        return true;
      } else {
        setVerified(false);
        showAlert(
          'Verification Failed',
          res.message || 'The bank could not verify this account and IFSC combination. Please check your bank passbook/statement.',
          'danger'
        );
        return false;
      }
    } catch (error: any) {
      setVerified(false);
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to verify bank account with Cashfree. Please check your network connection.';
      showAlert('Verification Error', errMsg, 'danger');
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const executeSave = async () => {
    const cleanHolder = accountHolder.trim();
    const cleanAcct = accountNumber.trim();
    const cleanConfirm = confirmAccountNumber.trim();
    const cleanIfsc = ifsc.trim().toUpperCase();
    const cleanPan = pan.trim().toUpperCase();
    const cleanPhone = phoneNumber.trim().replace(/[^0-9]/g, '');

    // 1. Validations
    if (!cleanHolder) {
      showAlert('Required Field', 'Please enter the official Account Holder Name.', 'warning');
      return;
    }

    if (!cleanAcct) {
      showAlert('Required Field', 'Please enter your Bank Account Number.', 'warning');
      return;
    }

    if (cleanAcct.length < 9 || cleanAcct.length > 20) {
      showAlert('Invalid Account Number', 'Bank account numbers must typically be between 9 and 20 digits.', 'warning');
      return;
    }

    if (cleanAcct !== cleanConfirm) {
      showAlert('Account Number Mismatch', 'The confirmed account number does not match. Please recheck.', 'warning');
      return;
    }

    if (!cleanIfsc || cleanIfsc.length !== 11) {
      showAlert('Invalid IFSC Code', 'Please enter a valid 11-character IFSC code (e.g. HDFC0000123).', 'warning');
      return;
    }

    if (cleanPan && cleanPan.length !== 10) {
      showAlert('Invalid PAN', 'PAN must be exactly 10 alphanumeric characters (e.g. ABCDE1234F).', 'warning');
      return;
    }

    try {
      setSaving(true);
      const res = await bankRemoteDataSource.registerBankAccount(currentRestId, {
        accountHolder: cleanHolder,
        accountNumber: cleanAcct,
        ifsc: cleanIfsc,
        bankName: bankName.trim() || undefined,
        pan: cleanPan || undefined,
        email: email.trim() || undefined,
        phoneNumber: cleanPhone.slice(-10) || undefined,
      });

      showAlert(
        'Bank Account Saved',
        res.message || 'Your bank account has been successfully linked for 100% direct Menza QR settlements.',
        'success',
        () => {
          setAccountNumber('');
          setConfirmAccountNumber('');
          loadBankAccount();
        }
      );
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to register bank account with payment gateway.';
      showAlert('Registration Failed', errMsg, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (cashierRestricted) {
      showAlert('Access Restricted', 'Only Store Owners and Administrators can update bank details.', 'warning');
      return;
    }

    // If not yet verified with Penny Drop, attempt verification first
    if (!verified) {
      const verifyPassed = await handleVerifyBankAccount();
      if (!verifyPassed) {
        showAlert(
          'Verification Unsuccessful',
          'Cashfree Penny Drop could not verify this account with the bank.\n\nIn Sandbox/Test mode, real bank accounts cannot be routed over live IMPS.\n\nWould you like to save this account anyway for test purposes?',
          'warning',
          () => {
            executeSave();
          }
        );
        return;
      }
    }

    executeSave();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* 1. TOP NAVIGATION HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.8}>
          <ChevronLeft size={22} color="#1F2937" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText}>Bank Account & Payouts</Text>
          <Text style={styles.headerSubtitleText}>Menza QR • 100% Direct Bank Settlements</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadBankAccount}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#DE8626" />
          ) : (
            <RefreshCw size={17} color="#7C6F62" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#DE8626" />
          <Text style={styles.loadingText}>Loading bank account configuration...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. VALUE PROPOSITION: 100% DIRECT SETTLEMENT HIGHLIGHT BANNER */}
          <LinearGradient
            colors={['#FFFDF8', '#FAF2E6', '#F5E6CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBannerCard}
          >
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Sparkles size={11} color="#B45309" />
                <Text style={styles.heroBadgeText}>OPTION 1: 100% DIRECT PAYOUT</Text>
              </View>
              <View style={styles.rbiBadge}>
                <ShieldCheck size={11} color="#17845A" />
                <Text style={styles.rbiBadgeText}>CASHFREE EASY SPLIT</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Customer Bill Hits Your Bank Account Directly</Text>
            <Text style={styles.heroDescription}>
              When customers scan Menza QR codes and pay online, Cashfree automatically transfers{' '}
              <Text style={{ fontWeight: '800', color: '#1F2937' }}>100% of the bill amount</Text> directly
              into this registered bank account on T+1.
            </Text>

            <View style={styles.heroPillarsRow}>
              <View style={styles.pillarItem}>
                <View style={[styles.pillarIconCircle, { backgroundColor: '#E4F5EC' }]}>
                  <Zap size={14} color="#17845A" />
                </View>
                <Text style={styles.pillarHeading}>100% Settle</Text>
                <Text style={styles.pillarSub}>Zero gateway cut on bank payout</Text>
              </View>

              <View style={styles.pillarDivider} />

              <View style={styles.pillarItem}>
                <View style={[styles.pillarIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Wallet size={14} color="#D97706" />
                </View>
                <Text style={styles.pillarHeading}>Wallet Fee</Text>
                <Text style={styles.pillarSub}>Commission debited from Menza wallet</Text>
              </View>

              <View style={styles.pillarDivider} />

              <View style={styles.pillarItem}>
                <View style={[styles.pillarIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <CreditCard size={14} color="#7C3AED" />
                </View>
                <Text style={styles.pillarHeading}>Auto T+1</Text>
                <Text style={styles.pillarSub}>Direct bank credit next morning</Text>
              </View>
            </View>
          </LinearGradient>

          {/* 3. CASHIER RESTRICTION NOTICE */}
          {cashierRestricted && (
            <View style={styles.permissionBanner}>
              <View style={styles.permissionIconBadge}>
                <Lock size={16} color="#DE8626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionBannerTitle}>Cashier View-Only Mode</Text>
                <Text style={styles.permissionBannerDesc}>
                  Bank settlement accounts can only be modified by the Store Owner or SuperAdmin.
                </Text>
              </View>
            </View>
          )}

          {/* 4. CURRENT ACTIVE BANK ACCOUNT SUMMARY (IF REGISTERED) */}
          {bankData && !isEditing && (
            <View style={styles.activeAccountCard}>
              <View style={styles.activeCardHeaderRow}>
                <View style={styles.activeHeaderLeft}>
                  <Building2 size={16} color="#17845A" />
                  <Text style={styles.activeCardHeading}>ACTIVE SETTLEMENT ACCOUNT</Text>
                </View>
                <View style={styles.activeStatusPill}>
                  <CheckCircle2 size={12} color="#17845A" />
                  <Text style={styles.activeStatusText}>
                    {bankData.status?.toUpperCase() || 'ACTIVE'}
                  </Text>
                </View>
              </View>

              {/* Bank Account Details Grid */}
              <View style={styles.accountDataRow}>
                <Text style={styles.accountDataLabel}>Account Holder</Text>
                <Text style={styles.accountDataValue} numberOfLines={1}>
                  {bankData.accountHolder || 'Registered Business'}
                </Text>
              </View>

              <View style={styles.accountDataRow}>
                <Text style={styles.accountDataLabel}>Account Number</Text>
                <Text style={[styles.accountDataValue, styles.accountNumberMonospace]}>
                  {bankData.accountNumberMasked || '•••• •••• ••••'}
                </Text>
              </View>

              <View style={styles.accountDataRow}>
                <Text style={styles.accountDataLabel}>IFSC Code</Text>
                <Text style={[styles.accountDataValue, styles.accountNumberMonospace]}>
                  {bankData.ifsc || 'N/A'}
                </Text>
              </View>

              <View style={styles.accountDataRow}>
                <Text style={styles.accountDataLabel}>Vendor Settlement ID</Text>
                <Text style={styles.accountDataValue}>
                  {bankData.vendorCode || `REST_${currentRestId}`}
                </Text>
              </View>

              <View style={styles.accountDataRow}>
                <Text style={styles.accountDataLabel}>Settlement Schedule</Text>
                <Text style={[styles.accountDataValue, { color: '#17845A', fontWeight: '700' }]}>
                  T+1 Next-Day Direct Transfer
                </Text>
              </View>

              {/* Edit Account Trigger Button */}
              {!cashierRestricted && (
                <TouchableOpacity
                  style={styles.editAccountTriggerBtn}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.8}
                >
                  <Edit3 size={14} color="#DE8626" />
                  <Text style={styles.editAccountTriggerText}>Update Bank Account Details</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 5. REGISTRATION / UPDATE FORM */}
          {(isEditing || !bankData) && (
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <CreditCard size={15} color="#DE8626" />
                <Text style={styles.cardHeading}>
                  {bankData ? 'UPDATE SETTLEMENT BANK ACCOUNT' : 'LINK SETTLEMENT BANK ACCOUNT'}
                </Text>
              </View>

              {/* Account Holder Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ACCOUNT HOLDER NAME *</Text>
                <Text style={styles.fieldHint}>Must match the name registered with your bank / PAN</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                  placeholder="e.g. Royal Spice Hospitality Pvt Ltd"
                  placeholderTextColor="#9CA3AF"
                  editable={!cashierRestricted}
                  autoCapitalize="words"
                />
              </View>

              {/* Bank Account Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>BANK ACCOUNT NUMBER *</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                  value={accountNumber}
                  onChangeText={(t) => {
                    setAccountNumber(t.replace(/[^0-9]/g, ''));
                    setVerified(false);
                    setVerificationResult(null);
                  }}
                  placeholder="Enter 9 to 18 digit bank account number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  editable={!cashierRestricted}
                  secureTextEntry={false}
                />
              </View>

              {/* Confirm Bank Account Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CONFIRM ACCOUNT NUMBER *</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                  value={confirmAccountNumber}
                  onChangeText={(t) => {
                    setConfirmAccountNumber(t.replace(/[^0-9]/g, ''));
                    setVerified(false);
                    setVerificationResult(null);
                  }}
                  placeholder="Re-enter bank account number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  editable={!cashierRestricted}
                />
              </View>

              {/* IFSC Code */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>IFSC CODE *</Text>
                <Text style={styles.fieldHint}>11 characters alphanumeric (e.g. HDFC0000123)</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled, { textTransform: 'uppercase' }]}
                  value={ifsc}
                  onChangeText={(t) => {
                    setIfsc(t.toUpperCase().slice(0, 11));
                    setVerified(false);
                    setVerificationResult(null);
                  }}
                  placeholder="HDFC0000123"
                  placeholderTextColor="#9CA3AF"
                  editable={!cashierRestricted}
                  autoCapitalize="characters"
                  maxLength={11}
                />
              </View>

              {/* CASHFREE PENNY DROP VERIFICATION CARD */}
              <View style={styles.verificationCard}>
                <View style={styles.verificationTopRow}>
                  <View style={styles.verificationTitleCol}>
                    <Text style={styles.verificationTitle}>Cashfree Penny Drop Verification</Text>
                    <Text style={styles.verificationSub}>
                      Deposits ₹1 to instantly confirm account validity, IFSC routing, and official bank beneficiary name before saving.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.verifyActionButton,
                    verified && styles.verifyActionSuccess,
                    verifying && { opacity: 0.7 },
                  ]}
                  onPress={handleVerifyBankAccount}
                  disabled={verifying || cashierRestricted}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : verified ? (
                    <>
                      <CheckCircle2 size={16} color="#17845A" strokeWidth={2.5} />
                      <Text style={styles.verifyActionSuccessText}>Verified Active via Cashfree</Text>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.verifyActionButtonText}>Verify Bank Account</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Verification result details display */}
                {verificationResult && (
                  <View
                    style={[
                      styles.verifyResultBox,
                      verificationResult.isValid ? styles.verifyResultSuccess : styles.verifyResultError,
                    ]}
                  >
                    <View style={styles.verifyResultHeaderRow}>
                      {verificationResult.isValid ? (
                        <CheckCircle2 size={15} color="#17845A" />
                      ) : (
                        <ShieldAlert size={15} color="#DC2626" />
                      )}
                      <Text
                        style={[
                          styles.verifyResultStatusText,
                          verificationResult.isValid ? { color: '#17845A' } : { color: '#DC2626' },
                        ]}
                      >
                        {verificationResult.isValid ? 'ACCOUNT ACTIVE & CONFIRMED' : 'VERIFICATION FAILED'}
                      </Text>
                    </View>

                    {verificationResult.registeredName ? (
                      <View style={styles.verifyResultRow}>
                        <Text style={styles.verifyResultKey}>Registered Name:</Text>
                        <Text style={styles.verifyResultVal}>{verificationResult.registeredName}</Text>
                      </View>
                    ) : null}

                    {verificationResult.bankName ? (
                      <View style={styles.verifyResultRow}>
                        <Text style={styles.verifyResultKey}>Bank:</Text>
                        <Text style={styles.verifyResultVal}>{verificationResult.bankName}</Text>
                      </View>
                    ) : null}

                    {verificationResult.utr ? (
                      <View style={styles.verifyResultRow}>
                        <Text style={styles.verifyResultKey}>IMPS UTR / Ref:</Text>
                        <Text style={styles.verifyResultVal}>{verificationResult.utr}</Text>
                      </View>
                    ) : null}

                    <Text style={styles.verifyResultMsg}>{verificationResult.message}</Text>
                  </View>
                )}
              </View>

              {/* Bank & Branch Name (Optional) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>BANK & BRANCH NAME (OPTIONAL)</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g. HDFC Bank, Indiranagar"
                  placeholderTextColor="#9CA3AF"
                  editable={!cashierRestricted}
                />
              </View>

              {/* PAN Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>OWNER / BUSINESS PAN NUMBER (OPTIONAL)</Text>
                <Text style={styles.fieldHint}>Recommended for high transaction volume compliance</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled, { textTransform: 'uppercase' }]}
                  value={pan}
                  onChangeText={(t) => setPan(t.toUpperCase().slice(0, 10))}
                  placeholder="ABCDE1234F"
                  placeholderTextColor="#9CA3AF"
                  editable={!cashierRestricted}
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </View>

              {/* Settlement Email & Phone */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>SETTLEMENT NOTIFICATION EMAIL</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="accounts@yourstore.in"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!cashierRestricted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>SETTLEMENT NOTIFICATION PHONE</Text>
                <TextInput
                  style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                  value={phoneNumber}
                  onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!cashierRestricted}
                />
              </View>

              {/* Cancel Edit button if account already exists */}
              {bankData && (
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => {
                    setIsEditing(false);
                    setAccountNumber('');
                    setConfirmAccountNumber('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelEditText}>Cancel Editing</Text>
                </TouchableOpacity>
              )}

              {/* Submit / Save Button */}
              {!cashierRestricted && (
                <TouchableOpacity
                  style={[styles.saveButton, saving && { opacity: 0.7 }]}
                  onPress={handleSaveBankAccount}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={16} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.saveButtonText}>
                          {bankData ? 'Update & Verify Bank Account' : 'Link & Activate QR Settlements'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 6. SECURITY & LEGAL COMPLIANCE FOOTER */}
          <View style={styles.securityFooterCard}>
            <View style={styles.securityIconBox}>
              <ShieldCheck size={20} color="#17845A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityFooterTitle}>Bank-Grade Payout Security</Text>
              <Text style={styles.securityFooterDesc}>
                Payouts and vendor accounts are securely managed through Cashfree Payments, an RBI-regulated
                Payment Aggregator. Sensitive bank details are encrypted and tokenized.
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Gilded Alert Modal */}
      <GildedAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onConfirm={alertConfig.onConfirm}
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEAE2',
    backgroundColor: '#FAF7F2',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerSubtitleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8C7A6B',
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#8C7A6B',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroBannerCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0DEC4',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.4,
  },
  rbiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rbiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17845A',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  heroPillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#EFE8DE',
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pillarIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pillarHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  pillarSub: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },
  pillarDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  permissionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  permissionBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },
  permissionBannerDesc: {
    fontSize: 11,
    color: '#9A3412',
    lineHeight: 16,
    marginTop: 2,
  },
  activeAccountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  activeCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 12,
  },
  activeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeCardHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17845A',
    letterSpacing: 0.5,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17845A',
  },
  accountDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  accountDataLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  accountDataValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  accountNumberMonospace: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  editAccountTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  editAccountTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D96B14',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DE8626',
    letterSpacing: 0.5,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  fieldHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1F2937',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  cancelEditBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  cancelEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  securityFooterCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  securityIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  securityFooterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  securityFooterDesc: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 16,
    marginTop: 2,
  },
  verificationCard: {
    backgroundColor: '#FBF8F4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFE7DC',
    marginBottom: 16,
  },
  verificationTopRow: {
    marginBottom: 10,
  },
  verificationTitleCol: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 2,
  },
  verificationSub: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 14,
  },
  verifyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  verifyActionSuccess: {
    backgroundColor: '#E4F5EC',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifyActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifyActionSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17845A',
  },
  verifyResultBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  verifyResultSuccess: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BBF7D0',
  },
  verifyResultError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  verifyResultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  verifyResultStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  verifyResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  verifyResultKey: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  verifyResultVal: {
    fontSize: 11,
    color: '#1F2937',
    fontWeight: '700',
  },
  verifyResultMsg: {
    fontSize: 10,
    color: '#4B5563',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
