import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  FileText,
  Check,
  ArrowRight,
  LogOut,
  UtensilsCrossed,
  CreditCard,
  Lock,
  Building2,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { logger } from '../../../core/logging';

export function TermsAndConditionsScreen() {
  const { user, acceptTerms, logout } = useAuthStore();
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!isChecked) {
      Alert.alert('Agreement Required', 'Please tick the agreement checkbox to accept the Terms of Service.');
      return;
    }

    try {
      setIsSubmitting(true);
      logger.auth('TERMS_ACCEPTED', 'User accepted Terms & Conditions', { userId: user?.id });
      await acceptTerms();
    } catch (err: any) {
      Alert.alert(
        'Submission Error',
        err?.message || 'Unable to record your acceptance. Please check your internet connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? You will need to accept the Terms of Service to access the Menza suite.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <ShieldCheck size={16} color="#DE8626" />
          <Text style={styles.badgeText}>MERCHANT COMPLIANCE & TERMS</Text>
        </View>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>
          Welcome to Menza, {user?.name || 'Partner'}. Please review and accept our Merchant Terms and Operating
          Policies to proceed into the suite.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Section 1 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Building2 size={20} color="#DE8626" />
            <Text style={styles.cardTitle}>1. Merchant Licensing & Representation</Text>
          </View>
          <Text style={styles.cardBody}>
            By operating on the Menza platform, you confirm that your restaurant entity holds all mandatory and valid
            licenses required by law, including FSSAI food safety registration, local municipal trade permits, and GST
            registrations. You maintain sole responsibility for kitchen hygiene, food quality, accurate menu pricing,
            and preparation standards.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <UtensilsCrossed size={20} color="#DE8626" />
            <Text style={styles.cardTitle}>2. POS, KOT & Billing Operations</Text>
          </View>
          <Text style={styles.cardBody}>
            Menza provides cloud point-of-sale (POS), table management, and kitchen order ticket (KOT) automation. You
            agree that all invoices, itemized tax computations (SGST/CGST), and discounts generated through this terminal
            reflect legitimate store operations. Printed and digital receipts are binding operational records.
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CreditCard size={20} color="#DE8626" />
            <Text style={styles.cardTitle}>3. Payment Processing & Settlements</Text>
          </View>
          <Text style={styles.cardBody}>
            Payment processing via dynamic QR codes, UPI, card terminals, and Cashfree gateway integrations are subject
            to banking partner rules. Settlement timelines, transaction fee deductions, dispute resolution, and
            customer chargebacks remain governed by the respective payment partner agreements.
          </Text>
        </View>

        {/* Section 4 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Lock size={20} color="#DE8626" />
            <Text style={styles.cardTitle}>4. Data Privacy & Customer Protection</Text>
          </View>
          <Text style={styles.cardBody}>
            In compliance with Indian Digital Personal Data Protection (DPDP) regulations, customer contact numbers and
            dining profiles gathered during billing or digital ordering must be treated with strict confidentiality.
            Unauthorized marketing, third-party distribution, or misuse of customer data is strictly prohibited.
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FileText size={20} color="#DE8626" />
            <Text style={styles.cardTitle}>5. Continuous Service & Cloud Sync</Text>
          </View>
          <Text style={styles.cardBody}>
            Menza operates a real-time synchronized cloud network. While offline resilience is provided for POS
            operations, regular internet connectivity is required for multi-station KOT routing, analytics backup,
            and menu sync across devices.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Acceptance Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setIsChecked(!isChecked)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
            {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read, understood, and accept the Menza Merchant Terms of Service, Privacy Policy, and Operational
            Guidelines.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, (!isChecked || isSubmitting) && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={!isChecked || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.acceptButtonText}>Accept & Continue</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={14} color="#667085" />
          <Text style={styles.logoutText}>Log Out from Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
    backgroundColor: '#FFFFFF',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DE8626',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E2930',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
    lineHeight: 18,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2930',
  },
  cardBody: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 19,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#344054',
    lineHeight: 18,
    fontWeight: '500',
  },
  acceptButton: {
    backgroundColor: '#DE8626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptButtonDisabled: {
    backgroundColor: '#D0D5DD',
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
  },
});
