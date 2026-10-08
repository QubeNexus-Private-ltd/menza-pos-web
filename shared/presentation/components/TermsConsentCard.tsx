import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ShieldCheck,
  Check,
  Building2,
  UtensilsCrossed,
  CreditCard,
  Lock,
  LogOut,
  ArrowRight,
} from 'lucide-react-native';
import { useAuthStore } from '../state/useAuthStore';
import { isOwnerUser } from '../../core/auth/rolePermissions';
import { logger } from '../../core/logging';

export function TermsConsentCard() {
  const { user, activeRestaurant, hasAcceptedTerms, acceptTerms, logout } = useAuthStore();
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Consent is strictly required ONLY for the Owner role
  const isOwner = isOwnerUser(user, activeRestaurant);

  // If user is not an owner or already accepted, do not show card
  if (!isOwner || hasAcceptedTerms) {
    return null;
  }

  const handleAccept = async () => {
    if (!isChecked || isSubmitting) return;

    try {
      setIsSubmitting(true);
      logger.auth('TERMS_ACCEPTED', 'Owner accepted Terms & Conditions consent', { userId: user?.id });
      await acceptTerms();
    } catch (err: any) {
      Alert.alert(
        'Submission Failed',
        err?.message || 'Could not record your agreement. Please check your internet connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Accepting the Terms & Conditions is required to operate Menza as an owner.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <Modal visible={true} transparent={true} animationType="fade" statusBarTranslucent={true}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={26} color="#DE8626" />
            </View>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeText}>OWNER TERMS & CONSENT</Text>
            </View>
            <Text style={styles.title}>Terms & Conditions</Text>
            <Text style={styles.subtitle}>
              Welcome, <Text style={styles.boldText}>{user?.name || 'Partner'}</Text>. Please review and accept the
              operating conditions to activate and use the application.
            </Text>
          </View>

          {/* Scrollable Summary */}
          <ScrollView style={styles.summaryContainer} contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={true}>
            <View style={styles.bulletItem}>
              <Building2 size={16} color="#DE8626" style={styles.bulletIcon} />
              <View style={styles.bulletTextContainer}>
                <Text style={styles.bulletTitle}>Licensing & Compliance</Text>
                <Text style={styles.bulletDesc}>
                  You confirm your restaurant holds valid statutory licenses, including FSSAI food safety and GST
                  registrations where applicable.
                </Text>
              </View>
            </View>

            <View style={styles.bulletItem}>
              <UtensilsCrossed size={16} color="#DE8626" style={styles.bulletIcon} />
              <View style={styles.bulletTextContainer}>
                <Text style={styles.bulletTitle}>POS & Operational Accuracy</Text>
                <Text style={styles.bulletDesc}>
                  Invoices, tax computations, and kitchen order tickets (KOT) generated from this terminal represent
                  accurate store transactions.
                </Text>
              </View>
            </View>

            <View style={styles.bulletItem}>
              <CreditCard size={16} color="#DE8626" style={styles.bulletIcon} />
              <View style={styles.bulletTextContainer}>
                <Text style={styles.bulletTitle}>Payment Processing</Text>
                <Text style={styles.bulletDesc}>
                  Digital payments and QR settlements facilitated through Cashfree and partners are governed by
                  standard banking settlement terms.
                </Text>
              </View>
            </View>

            <View style={styles.bulletItem}>
              <Lock size={16} color="#DE8626" style={styles.bulletIcon} />
              <View style={styles.bulletTextContainer}>
                <Text style={styles.bulletTitle}>Customer Data Privacy</Text>
                <Text style={styles.bulletDesc}>
                  Customer contact and billing details must be kept confidential pursuant to Indian DPDP regulations.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Interactive Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsChecked(!isChecked)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
              {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxLabel}>
              I accept this condition and agree to the Menza Merchant Terms & Operating Policies.
            </Text>
          </TouchableOpacity>

          {/* Primary Action Button */}
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

          {/* Logout Option (no disagree) */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={13} color="#667085" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    gap: 14,
  },
  header: {
    alignItems: 'center',
    textAlign: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(222, 134, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  badgeRow: {
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DE8626',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E2930',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: '#1E2930',
  },
  summaryContainer: {
    maxHeight: 180,
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  summaryContent: {
    padding: 12,
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletIcon: {
    marginTop: 2,
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2930',
    marginBottom: 1,
  },
  bulletDesc: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 15,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#1E2930',
    fontWeight: '600',
    lineHeight: 17,
  },
  acceptButton: {
    backgroundColor: '#DE8626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
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
    fontSize: 11,
    color: '#667085',
    fontWeight: '600',
  },
});
