import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { UtensilsCrossed, ShoppingBag, TrendingUp, Sparkles, ArrowRight, Scale } from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';
import { PrivacyPolicyModal } from '../legal/PrivacyPolicyModal';
import { logger } from '../../../core/logging';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STITCH_ONBOARDING_SLIDES = [
  {
    id: 1,
    badge: 'POS & KOT',
    title: 'POS & KOT System',
    description: 'Lightning-fast order punching and instant kitchen communication. Built for the pressure of peak dining hours.',
    iconName: 'pos',
    image: require('../../../../assets/POS_KOT.jpg'),
  },
  {
    id: 2,
    badge: 'CATALOG & STOCK',
    title: 'Digital Menu & Stock',
    description: 'Update menus in real-time across all devices. Track inventory down to the ingredient level with precision.',
    iconName: 'menu',
    image: require('../../../../assets/Digital_Menu.jpg'),
  },
  {
    id: 3,
    badge: 'REVENUE & PAYOUTS',
    title: 'Revenue & Settlements',
    description: 'Clear insights into daily store operations. Reconcile GST tax and automated payment gateway settlements.',
    iconName: 'analytics',
    image: require('../../../../assets/Revenue_Settlements.jpg'),
  },
];

export const OnboardingScreen: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const setCompletedOnboarding = useAuthStore((state) => state.setCompletedOnboarding);

  const currentSlide = STITCH_ONBOARDING_SLIDES[activeIndex];

  const handleNext = () => {
    if (activeIndex < STITCH_ONBOARDING_SLIDES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      logger.auth('ONBOARDING_COMPLETED', 'User reached final slide and pressed Get Started');
      setCompletedOnboarding(true);
    }
  };

  const handleSkip = () => {
    logger.auth('ONBOARDING_COMPLETED', 'User pressed skip onboarding');
    setCompletedOnboarding(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      <View style={styles.container}>
        {/* Top Header: Menu Icon + MENZA Title + Skip */}
        <View style={styles.topHeader}>
          <UtensilsCrossed size={22} color="#DE8626" />

          <Text style={styles.headerMenzaTitle}>MENZA</Text>

          <TouchableOpacity activeOpacity={0.8} onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>SKIP</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Visual Card + Content Section */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Image Card with Subtle Glow & Inner Border */}
          <View style={styles.heroCardContainer}>
            <View style={styles.heroCard}>
              <Image source={currentSlide.image} style={styles.heroImage} resizeMode="cover" />

              {/* Gradient Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(250, 247, 242, 0.25)', '#FAF7F2']}
                style={styles.heroGradientOverlay}
              />

              {/* Inner subtle border */}
              <View style={styles.heroInnerBorder} pointerEvents="none" />

              {/* Floating Badge Pill */}
              <View style={styles.floatingBadgePill}>
                <Sparkles size={12} color="#DE8626" />
                <Text style={styles.floatingBadgeText}>{currentSlide.badge}</Text>
              </View>
            </View>
          </View>

          {/* Typography Content Container */}
          <View style={styles.contentContainer}>
            <Text style={styles.slideTitle}>{currentSlide.title}</Text>
            <Text style={styles.slideDescription}>{currentSlide.description}</Text>
          </View>
        </ScrollView>

        {/* Footer Bar: Fixed Overlay with Gradient, Pagination Dots, Primary Action Button */}
        <View style={styles.bottomBar} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(250, 247, 242, 0)', 'rgba(250, 247, 242, 0.95)', '#FAF7F2']}
            style={styles.footerGradient}
            pointerEvents="none"
          />

          <View style={styles.footerContentContainer}>
            {/* Pagination Dots */}
            <View style={styles.progressRow}>
              {STITCH_ONBOARDING_SLIDES.map((_, index) => {
                const isActive = index === activeIndex;
                return (
                  <TouchableOpacity
                    key={`dot-${index}`}
                    onPress={() => setActiveIndex(index)}
                    activeOpacity={0.7}
                    style={[
                      styles.progressDot,
                      isActive ? styles.progressDotActive : styles.progressDotInactive,
                    ]}
                  />
                );
              })}
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleNext}
              style={styles.nextButtonWrapper}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>
                  {activeIndex === STITCH_ONBOARDING_SLIDES.length - 1 ? 'GET STARTED' : 'NEXT'}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Legal Terms & Privacy Links */}
            <View style={styles.onboardingTermsLink}>
              <Scale size={12} color="#8C7A6B" style={{ marginRight: 4 }} />
              <Text style={styles.onboardingTermsText}>
                Review Menza{' '}
                <Text
                  onPress={() => setTermsModalVisible(true)}
                  style={{ textDecorationLine: 'underline', color: '#D96B14', fontWeight: '600' }}
                >
                  Terms
                </Text>
                {' & '}
                <Text
                  onPress={() => setPrivacyModalVisible(true)}
                  style={{ textDecorationLine: 'underline', color: '#059669', fontWeight: '600' }}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Terms & Conditions Modal */}
      <TermsAndConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
        onOpenPrivacyPolicy={() => setPrivacyModalVisible(true)}
      />

      {/* Privacy Policy & DPDP Modal */}
      <PrivacyPolicyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
        onOpenTerms={() => setTermsModalVisible(true)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#FAF7F2',
    zIndex: 50,
  },
  headerMenzaTitle: {
    color: '#DE8626',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: -1,
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skipText: {
    color: '#5C4E3D',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 150,
    alignItems: 'center',
  },
  heroCardContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 360),
    aspectRatio: 4 / 5,
    maxHeight: 380,
    marginBottom: 24,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  heroCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  heroInnerBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    zIndex: 20,
  },
  floatingBadgePill: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    gap: 6,
  },
  floatingBadgeText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  slideTitle: {
    color: '#1F2937',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDescription: {
    color: '#5C4E3D',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  footerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -40,
    bottom: 0,
  },
  footerContentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 32,
    backgroundColor: '#DE8626',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  progressDotInactive: {
    width: 8,
    backgroundColor: '#E7E1DA',
  },
  nextButtonWrapper: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  nextButtonGradient: {
    height: 54,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  onboardingTermsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  onboardingTermsText: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '500',
  },
});

