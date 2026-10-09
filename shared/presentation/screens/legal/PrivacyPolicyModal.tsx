import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShieldCheck,
  Scale,
  FileText,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  CheckCircle2,
  Lock,
  Database,
  Cpu,
  Share2,
  Clock,
  UserCheck,
  Cookie,
  Headphones,
  Info,
  ChevronRight,
  Shield,
  FileCheck,
} from 'lucide-react-native';
import {
  MENZA_PRIVACY_METADATA,
  MENZA_PRIVACY_SECTIONS,
  MENZA_PRIVACY_CATEGORIES,
  PrivacySection,
} from '../../../core/constants/privacyPolicyData';

export interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  visible,
  onClose,
  onOpenTerms,
  onAccept,
  showAcceptButton = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<number[]>([1, 2, 3, 4, 8, 10]);
  const [hasAgreed, setHasAgreed] = useState(false);

  const toggleSection = (id: number) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setExpandedIds(MENZA_PRIVACY_SECTIONS.map((s) => s.id));
  };

  const collapseAll = () => {
    setExpandedIds([]);
  };

  const filteredSections = useMemo(() => {
    return MENZA_PRIVACY_SECTIONS.filter((section) => {
      const matchesCategory =
        selectedCategory === 'all' || section.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const titleMatch = section.title.toLowerCase().includes(q);
      const summaryMatch = section.summary.toLowerCase().includes(q);
      const contentMatch = section.content.some((c) => c.toLowerCase().includes(q));

      return titleMatch || summaryMatch || contentMatch;
    });
  }, [selectedCategory, searchQuery]);

  const renderSectionIcon = (iconName: string) => {
    const iconProps = { size: 18, color: '#10B981' };
    switch (iconName) {
      case 'Shield':
      case 'ShieldCheck':
        return <ShieldCheck {...iconProps} />;
      case 'Database':
        return <Database {...iconProps} />;
      case 'Cpu':
        return <Cpu {...iconProps} />;
      case 'Scale':
        return <Scale {...iconProps} />;
      case 'Share2':
        return <Share2 {...iconProps} />;
      case 'Lock':
        return <Lock {...iconProps} />;
      case 'Clock':
        return <Clock {...iconProps} />;
      case 'UserCheck':
        return <UserCheck {...iconProps} />;
      case 'Cookie':
        return <Cookie {...iconProps} />;
      case 'Headphones':
        return <Headphones {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  const handleOpenWebsite = () => {
    const websiteUrl = `https://${MENZA_PRIVACY_METADATA.website}`;
    Linking.openURL(websiteUrl).catch(() => {
      Alert.alert('Website', `Please visit ${websiteUrl} in your browser.`);
    });
  };

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${MENZA_PRIVACY_METADATA.supportEmail}`).catch(() => {
      Alert.alert('Email Support', `Please write to ${MENZA_PRIVACY_METADATA.supportEmail}`);
    });
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:${MENZA_PRIVACY_METADATA.supportPhone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Phone Support', `Please call ${MENZA_PRIVACY_METADATA.supportPhone}`);
    });
  };

  const handleEmailGrievance = () => {
    Linking.openURL(`mailto:${MENZA_PRIVACY_METADATA.grievanceOfficer.email}?subject=DPDP%20Data%20Privacy%20Inquiry`).catch(() => {
      Alert.alert('Grievance Redressal', `Please email ${MENZA_PRIVACY_METADATA.grievanceOfficer.email}`);
    });
  };

  const handleAgreeAndClose = () => {
    if (onAccept) {
      onAccept();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#141E1A" />

        {/* 1. Header with Dark Emerald-Charcoal Gradient */}
        <LinearGradient colors={['#16241F', '#0E1714']} style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.shieldBadge}>
                <ShieldCheck size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.headerBrand}>MENZA • PRIVACY & DPDP</Text>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.8}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#E7E5E4" />
            </TouchableOpacity>
          </View>

          {/* Quick Legal Subtitle & Badges */}
          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, styles.dpdpBadge]}>
              <Shield size={11} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={styles.dpdpBadgeText}>DPDP Act, 2023 Compliant</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>Updated: {MENZA_PRIVACY_METADATA.lastUpdated}</Text>
            </View>
            <View style={[styles.metaBadge, styles.jurisdictionBadge]}>
              <MapPin size={11} color="#A8A29E" style={{ marginRight: 4 }} />
              <Text style={styles.metaBadgeText}>Bhopal, MP</Text>
            </View>
          </View>

          {/* Cross-Link Banner to Terms if Available */}
          {onOpenTerms && (
            <TouchableOpacity
              onPress={() => {
                onClose();
                onOpenTerms();
              }}
              style={styles.crossNavBanner}
              activeOpacity={0.75}
            >
              <FileCheck size={13} color="#D96B14" style={{ marginRight: 6 }} />
              <Text style={styles.crossNavText}>
                Need to view Menza's <Text style={styles.crossNavHighlight}>Terms & Regulations</Text>? Tap here
              </Text>
              <ChevronRight size={13} color="#D96B14" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {/* 2. Interactive Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search data collection, storage, sub-processors, DPDP..."
              placeholderTextColor="#78716C"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* 3. Category Filter Chips */}
        <View style={styles.categoryBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {MENZA_PRIVACY_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isActive && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 4. Controls Bar (Expand / Collapse Count) */}
        <View style={styles.controlsBar}>
          <Text style={styles.articlesCount}>
            Showing {filteredSections.length} of {MENZA_PRIVACY_SECTIONS.length} sections
          </Text>
          <View style={styles.toggleButtonsGroup}>
            <TouchableOpacity onPress={expandAll} style={styles.toggleTextBtn}>
              <Text style={styles.toggleBtnText}>Expand All</Text>
            </TouchableOpacity>
            <Text style={styles.toggleDot}>•</Text>
            <TouchableOpacity onPress={collapseAll} style={styles.toggleTextBtn}>
              <Text style={styles.toggleBtnText}>Collapse All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Main Scrollable Articles Body */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          {filteredSections.length === 0 ? (
            <View style={styles.emptySearchContainer}>
              <FileText size={48} color="#D1D5DB" />
              <Text style={styles.emptySearchTitle}>No matching clauses found</Text>
              <Text style={styles.emptySearchSubtitle}>
                Try adjusting your search query or reset the category filter.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                style={styles.resetSearchBtn}
              >
                <Text style={styles.resetSearchBtnText}>Reset Filter</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredSections.map((section) => {
              const isExpanded = expandedIds.includes(section.id);
              return (
                <View key={section.id} style={styles.sectionCard}>
                  {/* Section Accordion Header */}
                  <TouchableOpacity
                    onPress={() => toggleSection(section.id)}
                    style={styles.sectionHeader}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.iconCircle}>
                        {renderSectionIcon(section.icon)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionSummary} numberOfLines={isExpanded ? undefined : 1}>
                          {section.summary}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chevronWrapper}>
                      {isExpanded ? (
                        <ChevronUp size={18} color="#10B981" />
                      ) : (
                        <ChevronDown size={18} color="#9CA3AF" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Section Expanded Content */}
                  {isExpanded && (
                    <View style={styles.sectionBody}>
                      <View style={styles.sectionDivider} />
                      {section.content.map((paragraph, pIdx) => {
                        const isBullet = paragraph.startsWith('•') || paragraph.startsWith('-');
                        const isNumbered = /^[0-9]+\./.test(paragraph);

                        return (
                          <View
                            key={pIdx}
                            style={[
                              styles.paragraphRow,
                              isBullet && styles.bulletParagraphRow,
                              isNumbered && styles.numberedParagraphRow,
                            ]}
                          >
                            <Text
                              style={[
                                styles.paragraphText,
                                isNumbered && styles.numberedParagraphText,
                              ]}
                            >
                              {paragraph}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* 6. DPDP Act Grievance Redressal Officer Card */}
          <View style={styles.grievanceCard}>
            <LinearGradient
              colors={['#F0FDF4', '#DCFCE7']}
              style={styles.grievanceCardGradient}
            >
              <View style={styles.grievanceHeader}>
                <View style={styles.grievanceIconBox}>
                  <Headphones size={20} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.grievanceBadgeText}>STATUTORY GRIEVANCE REDRESSAL</Text>
                  <Text style={styles.grievanceTitle}>DPDP Grievance Officer</Text>
                  <Text style={styles.grievanceSubtitle}>
                    Section 8(10) of Digital Personal Data Protection Act, 2023
                  </Text>
                </View>
              </View>

              <View style={styles.grievanceDivider} />

              <Text style={styles.grievanceOfficerName}>
                {MENZA_PRIVACY_METADATA.grievanceOfficer.name}
              </Text>
              <Text style={styles.grievanceOfficerRole}>
                {MENZA_PRIVACY_METADATA.grievanceOfficer.designation}
              </Text>

              <View style={styles.grievanceNoticeBox}>
                <Info size={14} color="#047857" style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.grievanceNoticeText}>
                  Complaints acknowledged within 48 hours and resolved within 30 days as mandated by Indian statute.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleEmailGrievance}
                style={styles.grievanceActionBtn}
                activeOpacity={0.8}
              >
                <Mail size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.grievanceActionBtnText}>Contact Grievance Officer</Text>
                <ChevronRight size={14} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* 7. Company Legal Entity & Corporate Info */}
          <View style={styles.entityCard}>
            <LinearGradient
              colors={['#FFFDF9', '#FAF5EC']}
              style={styles.entityCardGradient}
            >
              <View style={styles.entityHeader}>
                <Building2 size={20} color="#D96B14" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.entityTitle}>{MENZA_PRIVACY_METADATA.operatedBy}</Text>
                  <Text style={styles.entitySubtitle}>Operating Company of Menza Platform</Text>
                </View>
              </View>

              <View style={styles.entityDivider} />

              <View style={styles.entityInfoRow}>
                <MapPin size={15} color="#78716C" style={styles.entityIcon} />
                <Text style={styles.entityText}>{MENZA_PRIVACY_METADATA.address}</Text>
              </View>

              <TouchableOpacity
                onPress={handleEmailSupport}
                style={styles.entityActionRow}
                activeOpacity={0.7}
              >
                <Mail size={15} color="#D96B14" style={styles.entityIcon} />
                <Text style={styles.entityLinkText}>{MENZA_PRIVACY_METADATA.supportEmail}</Text>
                <ChevronRight size={14} color="#D96B14" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCallSupport}
                style={styles.entityActionRow}
                activeOpacity={0.7}
              >
                <Phone size={15} color="#D96B14" style={styles.entityIcon} />
                <Text style={styles.entityLinkText}>{MENZA_PRIVACY_METADATA.supportPhone}</Text>
                <ChevronRight size={14} color="#D96B14" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenWebsite}
                style={styles.entityActionRow}
                activeOpacity={0.7}
              >
                <Globe size={15} color="#D96B14" style={styles.entityIcon} />
                <Text style={styles.entityLinkText}>{MENZA_PRIVACY_METADATA.website}</Text>
                <ChevronRight size={14} color="#D96B14" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              {onOpenTerms && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onOpenTerms();
                  }}
                  style={styles.entityActionRow}
                  activeOpacity={0.7}
                >
                  <Scale size={15} color="#D96B14" style={styles.entityIcon} />
                  <Text style={styles.entityLinkText}>Terms & Regulations (20 Articles)</Text>
                  <ChevronRight size={14} color="#D96B14" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              <View style={styles.sloganContainer}>
                <Text style={styles.sloganText}>{MENZA_PRIVACY_METADATA.appName} — {MENZA_PRIVACY_METADATA.tagline}</Text>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>

        {/* 8. Bottom Sticky Action Bar */}
        <View style={styles.footerBar}>
          {showAcceptButton ? (
            <View style={styles.acceptRow}>
              <TouchableOpacity
                onPress={() => setHasAgreed(!hasAgreed)}
                style={styles.checkboxRow}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, hasAgreed && styles.checkboxChecked]}>
                  {hasAgreed && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and understand how Menza collects, processes, and protects data under DPDP Act 2023.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAgreeAndClose}
                style={[styles.primaryActionBtn, !hasAgreed && styles.primaryActionBtnDisabled]}
                disabled={!hasAgreed}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>Accept & Continue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onClose}
              style={styles.primaryActionBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionBtnText}>Close & Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E1714',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF7F2',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dpdpBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  dpdpBadgeText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
  },
  jurisdictionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaBadgeText: {
    fontSize: 11,
    color: '#D6D3D1',
    fontWeight: '500',
  },
  crossNavBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 107, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 107, 20, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  crossNavText: {
    fontSize: 11,
    color: '#D6D3D1',
  },
  crossNavHighlight: {
    color: '#FB923C',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FAF7F2',
    paddingVertical: 0,
  },
  categoryBarContainer: {
    backgroundColor: '#131F1B',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2F29',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A8A29E',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DC',
  },
  articlesCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716C',
  },
  toggleButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleTextBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  toggleDot: {
    fontSize: 12,
    color: '#A8A29E',
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySearchSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetSearchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  resetSearchBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE7DE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  sectionSummary: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  chevronWrapper: {
    marginLeft: 8,
    padding: 4,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  paragraphRow: {
    marginBottom: 8,
  },
  bulletParagraphRow: {
    paddingLeft: 4,
  },
  numberedParagraphRow: {
    paddingLeft: 2,
  },
  paragraphText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  numberedParagraphText: {
    fontWeight: '400',
  },
  grievanceCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  grievanceCardGradient: {
    padding: 18,
  },
  grievanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  grievanceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grievanceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
  },
  grievanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#064E3B',
    marginTop: 2,
  },
  grievanceSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  grievanceDivider: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginVertical: 12,
  },
  grievanceOfficerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  grievanceOfficerRole: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 8,
  },
  grievanceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 12,
  },
  grievanceNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
  },
  grievanceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  grievanceActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  entityCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  entityCardGradient: {
    padding: 18,
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: 0.3,
  },
  entitySubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#78716C',
    marginTop: 2,
  },
  entityDivider: {
    height: 1,
    backgroundColor: '#E7DCCF',
    marginVertical: 12,
  },
  entityInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  entityActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  entityIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  entityText: {
    flex: 1,
    fontSize: 12,
    color: '#44403C',
    lineHeight: 18,
  },
  entityLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D96B14',
  },
  sloganContainer: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7DCCF',
    alignItems: 'center',
  },
  sloganText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A8A29E',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footerBar: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  acceptRow: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  primaryActionBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryActionBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
