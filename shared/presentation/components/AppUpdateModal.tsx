import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpCircle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useAppVersionStore } from '../state/useAppVersionStore';
import { APP_CONSTANTS } from '../../core/constants/appConstants';

export const AppUpdateModal: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isModalVisible, updateInfo, dismissSoftUpdate, openStoreUrl } =
    useAppVersionStore();

  const isForceUpdate = Boolean(updateInfo?.isForceUpdateRequired);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // Intercept Android Back Button: Strictly prevent back-press dismissal during Hard Update
  useEffect(() => {
    if (!isModalVisible) return;

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isForceUpdate) {
          // Block navigation / dismissal on hard update
          return true;
        }
        dismissSoftUpdate();
        return true;
      }
    );

    return () => backSubscription.remove();
  }, [isModalVisible, isForceUpdate, dismissSoftUpdate]);

  // Entrance animation when modal opens
  useEffect(() => {
    if (isModalVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [isModalVisible, fadeAnim, slideAnim]);

  if (!isModalVisible || !updateInfo) {
    return null;
  }

  const isTablet = Math.min(windowWidth, windowHeight) >= 600;
  const cardMaxWidth = isTablet ? 520 : Math.min(windowWidth - 36, 420);

  const releaseNotes = Array.isArray(updateInfo.releaseNotes)
    ? updateInfo.releaseNotes
    : [];

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isForceUpdate) {
          dismissSoftUpdate();
        }
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (!isForceUpdate) {
            dismissSoftUpdate();
          }
        }}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.modalCard,
                { width: cardMaxWidth },
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                },
              ]}
            >
              {/* Header Decorative Banner */}
              <View
                style={[
                  styles.headerBanner,
                  isForceUpdate ? styles.headerBannerForce : styles.headerBannerSoft,
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    isForceUpdate ? styles.iconCircleForce : styles.iconCircleSoft,
                  ]}
                >
                  {isForceUpdate ? (
                    <ShieldAlert size={32} color="#DC2626" />
                  ) : (
                    <Sparkles size={32} color="#D97706" />
                  )}
                </View>

                {/* Dismiss X button (Soft Update only) */}
                {!isForceUpdate && (
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={dismissSoftUpdate}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                  >
                    <X size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.contentBody}>
                {/* Status Pill Badge */}
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      isForceUpdate ? styles.statusBadgeForce : styles.statusBadgeSoft,
                    ]}
                  >
                    {isForceUpdate ? (
                      <AlertTriangle size={13} color="#B91C1C" />
                    ) : (
                      <ArrowUpCircle size={13} color="#B45309" />
                    )}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isForceUpdate
                          ? styles.statusBadgeTextForce
                          : styles.statusBadgeTextSoft,
                      ]}
                    >
                      {isForceUpdate ? 'CRITICAL UPDATE REQUIRED' : 'NEW VERSION AVAILABLE'}
                    </Text>
                  </View>
                </View>

                {/* Title & Message */}
                <Text style={styles.titleText}>
                  {updateInfo.title ||
                    (isForceUpdate ? 'Critical Update Required' : 'Update Available')}
                </Text>

                <Text style={styles.messageText}>
                  {updateInfo.message ||
                    (isForceUpdate
                      ? 'Your current app version is deprecated and no longer supported. Please update to continue running Menza POS.'
                      : 'A new version with performance improvements and new features is ready for download.')}
                </Text>

                {/* Version Comparison Card */}
                <View style={styles.versionCompareCard}>
                  <View style={styles.versionCol}>
                    <Text style={styles.versionColLabel}>Installed Version</Text>
                    <Text style={styles.versionColValue}>
                      v{APP_CONSTANTS.APP_VERSION}
                    </Text>
                    <Text style={styles.buildSubText}>
                      Build {APP_CONSTANTS.APP_BUILD_NUMBER}
                    </Text>
                  </View>

                  <View style={styles.versionArrowCol}>
                    <ArrowRight size={18} color="#9CA3AF" />
                  </View>

                  <View style={styles.versionCol}>
                    <Text style={styles.versionColLabel}>Latest Release</Text>
                    <Text
                      style={[
                        styles.versionColValue,
                        isForceUpdate ? styles.versionValueForce : styles.versionValueSoft,
                      ]}
                    >
                      v{updateInfo.latestVersion}
                    </Text>
                    <Text style={styles.buildSubText}>
                      Build {updateInfo.latestBuildNumber}
                    </Text>
                  </View>
                </View>

                {/* Release Notes Highlights (if provided by backend) */}
                {releaseNotes.length > 0 && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesHeading}>What's New in This Update:</Text>
                    <ScrollView
                      style={styles.notesScrollView}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {releaseNotes.map((note, index) => (
                        <View key={`note_${index}`} style={styles.noteRow}>
                          <CheckCircle2
                            size={14}
                            color={isForceUpdate ? '#DC2626' : '#10B981'}
                            style={styles.noteIcon}
                          />
                          <Text style={styles.noteText}>{note}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      isForceUpdate ? styles.primaryBtnForce : styles.primaryBtnSoft,
                    ]}
                    onPress={openStoreUrl}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isForceUpdate ? 'Update Now to Continue' : 'Update Now'}
                    </Text>
                    <ExternalLink size={17} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Secondary Dismiss Button (Soft Update Only) */}
                  {!isForceUpdate && (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={dismissSoftUpdate}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.secondaryBtnText}>Remind Me Later</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 24,
  },
  headerBanner: {
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBannerForce: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  headerBannerSoft: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleForce: {
    backgroundColor: '#FEE2E2',
  },
  iconCircleSoft: {
    backgroundColor: '#FEF3C7',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBody: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeForce: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeSoft: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusBadgeTextForce: {
    color: '#991B1B',
  },
  statusBadgeTextSoft: {
    color: '#92400E',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  messageText: {
    fontSize: 13.5,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  versionCompareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  versionCol: {
    flex: 1,
    alignItems: 'center',
  },
  versionArrowCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionColLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  versionColValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  versionValueForce: {
    color: '#DC2626',
  },
  versionValueSoft: {
    color: '#D97706',
  },
  buildSubText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  notesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notesHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  notesScrollView: {
    maxHeight: 110,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  noteIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  noteText: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
    flex: 1,
  },
  actionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnForce: {
    backgroundColor: '#DC2626',
  },
  primaryBtnSoft: {
    backgroundColor: '#D97706',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  secondaryBtnText: {
    color: '#6B7280',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
