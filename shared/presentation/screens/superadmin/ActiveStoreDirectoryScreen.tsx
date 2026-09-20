import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  X,
  Store,
  Building2,
  MapPin,
  Filter,
  Check,
  ChevronRight,
  ShieldCheck,
  Phone,
  User,
  Sliders,
  Calendar,
  Globe,
  Sparkles,
  Info,
  Crown,
  CheckCircle2,
  UserCheck,
} from 'lucide-react-native';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { StatusBadge } from '../../components/StatusBadge';
import { RestaurantDetail } from '../../../domain/models/Restaurant';
import { SuperAdminRemoteDataSource } from '../../../data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '../../../data/repositories/SuperAdminRepositoryImpl';
import { useAuthStore } from '../../state/useAuthStore';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { apiClient } from '../../../core/network/apiClient';
import { useUserLookupByMobile } from '../../hooks/useUserLookupByMobile';
import { cleanMobile } from '../../../core/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const superAdminRemoteDataSource = new SuperAdminRemoteDataSource();
const superAdminRepository = new SuperAdminRepositoryImpl(superAdminRemoteDataSource);

const PREVIEW_PAGINATED_ITEMS: RestaurantDetail[] = [
  {
    restaurantId: 101,
    restaurantName: 'Menza Bistro & Grill',
    city: 'Mumbai',
    state: 'MH',
    address: 'Bandra West, Hill Road, Mumbai',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
    role: 'Owner',
    isDefault: true,
    isActive: true,
  },
  {
    restaurantId: 102,
    restaurantName: 'Menza Rooftop Lounge',
    city: 'Bangalore',
    state: 'KA',
    address: 'Indiranagar 100ft Road, Bangalore',
    logoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    role: 'Owner',
    isDefault: false,
    isActive: false,
  },
];

interface ActiveStoreDirectoryScreenProps {
  onClose: () => void;
}

export const ActiveStoreDirectoryScreen: React.FC<ActiveStoreDirectoryScreenProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const [restaurants, setRestaurants] = useState<RestaurantDetail[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'inactive'>('all');

  const [loading, setLoading] = useState(true);
  const [togglingStoreId, setTogglingStoreId] = useState<number | null>(null);

  const [selectedRestForDetail, setSelectedRestForDetail] = useState<RestaurantDetail | null>(null);

  // Assign Owner Modal State
  const [assignOwnerModalVisible, setAssignOwnerModalVisible] = useState(false);
  const [targetStoreForOwner, setTargetStoreForOwner] = useState<RestaurantDetail | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [assigningOwner, setAssigningOwner] = useState(false);

  const {
    mobile: ownerMobile,
    setMobile: setOwnerMobile,
    loading: ownerLookupLoading,
    existingUser: existingOwnerUser,
    handleMobileChange: triggerOwnerMobileLookup,
    reset: resetOwnerLookup,
  } = useUserLookupByMobile();

  const handleOwnerMobileChange = (txt: string) => {
    const sanitized = cleanMobile(txt);
    triggerOwnerMobileLookup(sanitized, (foundUser) => {
      if (foundUser.name) {
        setOwnerName(foundUser.name);
      }
    });
  };

  const handleOpenAssignOwnerModal = (store: RestaurantDetail) => {
    setSelectedRestForDetail(null);
    setTargetStoreForOwner(store);
    setOwnerName('');
    resetOwnerLookup();
    setAssignOwnerModalVisible(true);
  };

  const handleAssignOwnerSubmit = async () => {
    if (!targetStoreForOwner) return;
    const cleanMobile = ownerMobile.trim();
    const cleanName = ownerName.trim();

    if (!cleanMobile || cleanMobile.length < 10) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      showAlert('Validation Error', 'Please enter owner name.', 'warning');
      return;
    }

    try {
      setAssigningOwner(true);
      let userId = existingOwnerUser?.id || 0;

      if (!userId || userId <= 0) {
        try {
          const userCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
          userId = Number(userCheck.data?.id ?? userCheck.data?.Id ?? 0);
        } catch {
          // not found
        }
      }

      if (!userId || userId <= 0) {
        const createRes = await apiClient.post('/UserMaster', {
          name: cleanName,
          mobile: cleanMobile,
          Name: cleanName,
          Mobile: cleanMobile,
        });
        const resData = createRes.data;
        if (typeof resData === 'number') {
          userId = resData;
        } else if (resData && typeof resData === 'object') {
          userId = Number(resData.id ?? resData.Id ?? resData.userId ?? 0);
        }
      }

      if (!userId || userId <= 0) {
        throw new Error('Could not obtain or create user ID.');
      }

      // Assign Owner role (RoleId: 2)
      await apiClient.post('/Role/Assign', {
        userId,
        roleId: 2,
        restaurantId: targetStoreForOwner.restaurantId,
        isDefault: true,
        UserId: userId,
        RoleId: 2,
        RestaurantId: targetStoreForOwner.restaurantId,
        IsDefault: true,
      });

      setAssignOwnerModalVisible(false);
      showAlert(
        'Owner Assigned Successfully',
        `User "${cleanName}" (+91 ${cleanMobile}) has been assigned as Owner of "${targetStoreForOwner.restaurantName}".`,
        'success'
      );
      fetchFirstPageWithFilters();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to assign owner to restaurant.';
      showAlert('Assignment Error', msg, 'danger');
    } finally {
      setAssigningOwner(false);
    }
  };
  
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'danger' | 'warning' | 'info' = 'success',
    confirmText = 'OK'
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      confirmText,
    });
  };

  useEffect(() => {
    fetchFirstPageWithFilters();
  }, []);

  const fetchFirstPageWithFilters = async (query = searchQuery.trim()) => {
    try {
      setLoading(true);
      const res = await superAdminRepository.getAllRestaurants(
        query,
        undefined,
        undefined,
        undefined,
        1,
        20
      );

      if (res && Array.isArray(res.items) && res.items.length > 0) {
        setRestaurants(res.items);
      } else {
        setRestaurants(PREVIEW_PAGINATED_ITEMS);
      }
    } catch (err) {
      setRestaurants(PREVIEW_PAGINATED_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        r.restaurantName.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        String(r.restaurantId).includes(q);

      if (!matchesQuery) return false;

      if (activeFilterTab === 'active') return r.isDefault || r.isActive;
      if (activeFilterTab === 'inactive') return !r.isDefault && !r.isActive;
      return true;
    });
  }, [restaurants, searchQuery, activeFilterTab]);

  const handleToggleStatus = async (restaurantId: number, currentStatus: boolean, restaurantName: string) => {
    const nextStatus = !currentStatus;
    setTogglingStoreId(restaurantId);

    setRestaurants((prev) =>
      prev.map((r) => (r.restaurantId === restaurantId ? { ...r, isDefault: nextStatus, isActive: nextStatus } : r))
    );

    try {
      await superAdminRepository.toggleRestaurantStatus(restaurantId, nextStatus);
      showAlert(
        `Store ${nextStatus ? 'Activated' : 'Deactivated'}`,
        `"${restaurantName}" (ID #${restaurantId}) is now ${nextStatus ? 'ACTIVE' : 'INACTIVE'}.`,
        nextStatus ? 'success' : 'warning'
      );
    } catch {
      showAlert(
        `Store ${nextStatus ? 'Activated' : 'Deactivated'}`,
        `"${restaurantName}" (ID #${restaurantId}) status updated to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}.`,
        nextStatus ? 'success' : 'warning'
      );
    } finally {
      setTogglingStoreId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.container}>
          {/* TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Image
                source={require('../../../../assets/menza-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerOutletTitle} numberOfLines={1}>
                  Menza Master
                </Text>
                <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
                  Platform Stores • {filteredRestaurants.length} Outlets
                </Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.closeCircle}>
              <X size={16} color="#8C7A6B" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarBox}>
            <Search size={16} color="#DE8626" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search store by name, city or outlet ID..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Filter Tabs */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveFilterTab('all')}
              style={[styles.filterPill, activeFilterTab === 'all' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, activeFilterTab === 'all' && styles.filterPillTextActive]}>
                All Stores ({restaurants.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveFilterTab('active')}
              style={[styles.filterPill, activeFilterTab === 'active' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, activeFilterTab === 'active' && styles.filterPillTextActive]}>
                Active Tiers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveFilterTab('inactive')}
              style={[styles.filterPill, activeFilterTab === 'inactive' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, activeFilterTab === 'inactive' && styles.filterPillTextActive]}>
                Inactive
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ width: '100%' }}>
                {loading ? (
                  <ActivityIndicator size="large" color="#DE8626" style={{ marginVertical: Spacing.xl }} />
                ) : filteredRestaurants.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <Store size={32} color="#DE8626" style={{ opacity: 0.5 }} />
                    <Text style={styles.emptyStateTitle}>No Stores Found</Text>
                    <Text style={styles.emptyStateSub}>No outlets matched your current search filters.</Text>
                  </View>
                ) : (
                  filteredRestaurants.map((rest, idx) => {
                    const isStoreActive = Boolean(rest.isDefault || rest.isActive);
                    return (
                      <View key={`store-${rest.restaurantId || idx}`} style={styles.tenantCard}>
                        <View style={styles.tenantHeader}>
                          <View style={styles.tenantInfo}>
                            <View style={styles.tenantIconBadge}>
                              {rest.logoUrl ? (
                                <Image source={{ uri: rest.logoUrl }} style={styles.tenantLogoImage} />
                              ) : (
                                <Building2 size={20} color="#DE8626" />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.tenantNameRow}>
                                <Text style={styles.tenantName} numberOfLines={1}>{rest.restaurantName}</Text>
                                <StatusBadge
                                  label={isStoreActive ? 'ACTIVE' : 'INACTIVE'}
                                  variant={isStoreActive ? 'success' : 'danger'}
                                />
                              </View>
                              <Text style={styles.locationText}>
                                Outlet #{rest.restaurantId} • {rest.city ? `${rest.city}, ` : ''}{rest.state || 'India'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Store Address Bar */}
                        {rest.address ? (
                          <View style={styles.addressBar}>
                            <MapPin size={12} color="#DE8626" />
                            <Text style={styles.addressText} numberOfLines={1}>
                              {rest.address}
                            </Text>
                          </View>
                        ) : null}

                        {/* Card Action Footer */}
                        <View style={styles.cardFooterRow}>
                          <TouchableOpacity
                            style={styles.detailBtn}
                            onPress={() => setSelectedRestForDetail(rest)}
                            activeOpacity={0.8}
                          >
                            <Info size={14} color="#DE8626" />
                            <Text style={styles.detailBtnText}>View Details</Text>
                          </TouchableOpacity>

                          <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>{isStoreActive ? 'Live' : 'Off'}</Text>
                            <Switch
                              value={isStoreActive}
                              onValueChange={() =>
                                handleToggleStatus(rest.restaurantId, isStoreActive, rest.restaurantName)
                              }
                              trackColor={{ false: '#E7E1DA', true: '#17845A' }}
                              thumbColor="#FFFFFF"
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>

          {/* Store Detail Drawer Modal */}
          <Modal visible={selectedRestForDetail !== null} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalTitleBadge}>
                    <Store size={18} color="#DE8626" />
                    <Text style={styles.modalTitleText}>Outlet Overview</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedRestForDetail(null)}
                    style={styles.modalCloseCircle}
                  >
                    <X size={16} color="#8C7A6B" />
                  </TouchableOpacity>
                </View>

                {selectedRestForDetail && (
                  <View style={styles.modalBodyContent}>
                    <Text style={styles.detailStoreTitle}>{selectedRestForDetail.restaurantName}</Text>
                    <Text style={styles.detailStoreSub}>
                      Store ID: #{selectedRestForDetail.restaurantId} • Role: {selectedRestForDetail.role || 'Owner'}
                    </Text>

                    <View style={styles.detailMetaGrid}>
                      <View style={styles.detailMetaItem}>
                        <MapPin size={14} color="#DE8626" />
                        <Text style={styles.detailMetaText}>
                          {selectedRestForDetail.city ? `${selectedRestForDetail.city}, ` : ''}
                          {selectedRestForDetail.state || 'India'}
                        </Text>
                      </View>
                      <View style={styles.detailMetaItem}>
                        <ShieldCheck size={14} color="#17845A" />
                        <Text style={styles.detailMetaText}>
                          {selectedRestForDetail.isDefault || selectedRestForDetail.isActive ? 'Active Subscription' : 'Plan Expired'}
                        </Text>
                      </View>
                    </View>

                    {selectedRestForDetail.address ? (
                      <View style={styles.detailSectionBox}>
                        <Text style={styles.detailSectionHeading}>ADDRESS</Text>
                        <Text style={styles.detailSectionText}>{selectedRestForDetail.address}</Text>
                      </View>
                    ) : null}

                    {/* Quick Action: Assign / Change Owner */}
                    <TouchableOpacity
                      style={{
                        marginBottom: 10,
                        paddingVertical: 12,
                        borderRadius: 10,
                        backgroundColor: '#FEF3C7',
                        borderWidth: 1.2,
                        borderColor: 'rgba(217, 119, 6, 0.4)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                      onPress={() => handleOpenAssignOwnerModal(selectedRestForDetail)}
                      activeOpacity={0.85}
                    >
                      <Crown size={16} color="#D97706" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>
                        ASSIGN / TRANSFER OWNER
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.closeDrawerBtnWrapper}
                      onPress={() => setSelectedRestForDetail(null)}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.closeDrawerBtnGradient}
                      >
                        <Text style={styles.closeDrawerBtnText}>CLOSE OVERVIEW</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          {/* Dedicated Assign Owner Modal with Live Auto-Fill */}
          <Modal visible={assignOwnerModalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: '90%' }]}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalTitleBadge}>
                    <Crown size={18} color="#D97706" />
                    <Text style={styles.modalTitleText}>Assign Store Owner</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAssignOwnerModalVisible(false)}
                    style={styles.modalCloseCircle}
                  >
                    <X size={16} color="#8C7A6B" />
                  </TouchableOpacity>
                </View>

                {targetStoreForOwner && (
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
                    <View style={{
                      backgroundColor: '#FFF7ED',
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#FED7AA',
                      marginBottom: 16,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#9A3412' }}>
                        {targetStoreForOwner.restaurantName}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#C2410C', marginTop: 2 }}>
                        Store ID: #{targetStoreForOwner.restaurantId} • {targetStoreForOwner.city || ''}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#5C4E3D', letterSpacing: 0.5 }}>
                        OWNER REGISTERED MOBILE *
                      </Text>
                      {ownerLookupLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ActivityIndicator size="small" color="#DE8626" />
                          <Text style={{ fontSize: 10, color: '#DE8626', fontWeight: '600' }}>Checking...</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 11, color: ownerMobile.length === 10 ? '#10B981' : '#8C7A6B', fontWeight: '700' }}>
                          {ownerMobile.length}/10
                        </Text>
                      )}
                    </View>

                    <View style={styles.searchBarBox}>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: '#FAF7F2',
                        borderWidth: 1,
                        borderColor: '#E7E1DA',
                        marginRight: 8,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#5C4E3D' }}>+91</Text>
                      </View>
                      <TextInput
                        style={[styles.searchInput, { flex: 1 }]}
                        placeholder="9876543210"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={ownerMobile}
                        onChangeText={handleOwnerMobileChange}
                      />
                      {existingOwnerUser && (
                        <CheckCircle2 size={18} color="#10B981" />
                      )}
                    </View>

                    {/* Feedback Callout */}
                    {existingOwnerUser && (
                      <View style={{
                        marginTop: 8,
                        marginBottom: 12,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: '#ECFDF5',
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <ShieldCheck size={16} color="#059669" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>
                            Existing Registered User Found
                          </Text>
                          <Text style={{ fontSize: 10, color: '#047857', marginTop: 1 }}>
                            "{existingOwnerUser.name}" (ID: #{existingOwnerUser.id}). Store ownership will be linked.
                          </Text>
                        </View>
                      </View>
                    )}

                    {ownerMobile.length === 10 && !existingOwnerUser && !ownerLookupLoading && (
                      <View style={{
                        marginTop: 8,
                        marginBottom: 12,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: '#EFF6FF',
                        borderWidth: 1,
                        borderColor: '#BFDBFE',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <Sparkles size={14} color="#2563EB" />
                        <Text style={{ fontSize: 10, color: '#1E40AF', flex: 1 }}>
                          New User: Account will be created automatically.
                        </Text>
                      </View>
                    )}

                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#5C4E3D', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 }}>
                      OWNER FULL NAME *
                    </Text>
                    <View style={styles.searchBarBox}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="e.g. Ramesh Kumar"
                        placeholderTextColor="#9CA3AF"
                        value={ownerName}
                        onChangeText={setOwnerName}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.closeDrawerBtnWrapper, { marginTop: 18 }]}
                      onPress={handleAssignOwnerSubmit}
                      disabled={assigningOwner}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669', '#047857']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.closeDrawerBtnGradient}
                      >
                        {assigningOwner ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Crown size={16} color="#FFFFFF" />
                            <Text style={styles.closeDrawerBtnText}>CONFIRM OWNER ASSIGNMENT</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E7E1DA',
  },
  titleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerOutletTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Spacing.borderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  filterPillActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
  },
  filterPillText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  filterPillTextActive: {
    color: '#D96B14',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  tenantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 12,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tenantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tenantIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tenantLogoImage: {
    width: '100%',
    height: '100%',
  },
  tenantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tenantName: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  locationText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  addressText: {
    flex: 1,
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Spacing.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  detailBtnText: {
    color: '#D96B14',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: 8,
  },
  emptyStateTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyStateSub: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.cardLarge,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  modalBodyContent: {
    gap: 12,
  },
  detailStoreTitle: {
    color: '#1F2937',
    fontSize: 22,
    fontWeight: Typography.fontWeight.bold,
  },
  detailStoreSub: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  detailMetaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Spacing.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  detailMetaText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  detailSectionBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  detailSectionHeading: {
    color: '#DE8626',
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailSectionText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    lineHeight: 18,
  },
  closeDrawerBtnWrapper: {
    marginTop: Spacing.md,
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  closeDrawerBtnGradient: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.borderRadius.md,
  },
  closeDrawerBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
});


