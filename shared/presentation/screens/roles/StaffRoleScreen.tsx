import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  X,
  Check,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Clock,
  Briefcase,
  IdCard,
  ChefHat,
  BadgePercent,
  Sparkles,
  CheckCircle2,
  Lock,
  Crown,
} from 'lucide-react-native';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { RoleMaster } from '../../../domain/models/Role';
import { StaffMember } from '../../../domain/models/StaffMember';
import { RoleRemoteDataSource } from '../../../data/datasources/RoleRemoteDataSource';
import { RoleRepositoryImpl } from '../../../data/repositories/RoleRepositoryImpl';
import { isCashierOnly, canManageStaff } from '../../../core/auth/rolePermissions';
import { useAuthStore } from '../../state/useAuthStore';
import { apiClient } from '../../../core/network/apiClient';
import { useUserLookupByMobile } from '../../hooks/useUserLookupByMobile';
import { cleanMobile } from '../../../core/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const roleRepository = new RoleRepositoryImpl(new RoleRemoteDataSource());

const getRoleVisualConfig = (roleName: string) => {
  const name = (roleName || '').toLowerCase();
  if (name.includes('owner') || name.includes('admin')) {
    return { icon: Crown, color: '#D97706', bg: '#FEF3C7', border: 'rgba(217, 119, 6, 0.3)' };
  }
  if (name.includes('manager')) {
    return { icon: Briefcase, color: '#3B82F6', bg: '#EFF6FF', border: 'rgba(59, 130, 246, 0.3)' };
  }
  if (name.includes('cashier')) {
    return { icon: BadgePercent, color: '#10B981', bg: '#ECFDF5', border: 'rgba(16, 185, 129, 0.3)' };
  }
  if (name.includes('waiter') || name.includes('captain') || name.includes('server')) {
    return { icon: Users, color: '#DE8626', bg: '#FFF0DE', border: 'rgba(222, 134, 38, 0.3)' };
  }
  if (name.includes('chef') || name.includes('cook') || name.includes('kitchen')) {
    return { icon: ChefHat, color: '#EF4444', bg: '#FEE2E2', border: 'rgba(239, 68, 68, 0.3)' };
  }
  return { icon: ShieldCheck, color: '#8C7A6B', bg: '#F3F4F6', border: '#E7E1DA' };
};

interface StaffRoleScreenProps {
  onClose?: () => void;
}

const StaffCardSkeleton: React.FC = () => (
  <View style={styles.staffCardSkeleton}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <SkeletonLoader width={40} height={40} borderRadius={20} style={styles.skeletonBg} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonLoader width="60%" height={14} borderRadius={4} style={styles.skeletonBg} />
        <SkeletonLoader width="40%" height={12} borderRadius={4} style={styles.skeletonBg} />
      </View>
    </View>
    <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <SkeletonLoader width={70} height={20} borderRadius={6} style={styles.skeletonBg} />
      <SkeletonLoader width={50} height={20} borderRadius={6} style={styles.skeletonBg} />
    </View>
  </View>
);

export const StaffRoleScreen: React.FC<StaffRoleScreenProps> = ({ onClose }) => {
  const { activeRestaurant, user } = useAuthStore();
  const activeRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
  const cashierRestricted = isCashierOnly(user, activeRestaurant) || !canManageStaff(user, activeRestaurant);

  const [activeTab, setActiveTab] = useState<'directory' | 'roles'>('directory');
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State for Staff Registration / Editing
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoleId, setFormRoleId] = useState<number>(4);
  const [formEmployeeCode, setFormEmployeeCode] = useState('');
  const [formShift, setFormShift] = useState('');
  const {
    loading: staffLookupLoading,
    existingUser: existingStaffUser,
    handleMobileChange: triggerStaffMobileLookup,
    reset: resetStaffLookup,
  } = useUserLookupByMobile();

  const handleStaffMobileChange = (txt: string) => {
    const sanitized = cleanMobile(txt);
    setFormMobile(sanitized);
    triggerStaffMobileLookup(sanitized, (foundUser) => {
      if (foundUser.name && !isEditing) {
        setFormName(foundUser.name);
      }
    });
  };

  // Gilded Alert Modal State
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'danger' | 'warning' | 'info' = 'success',
    confirmText = 'OK',
    cancelText?: string,
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  useEffect(() => {
    loadData();
  }, [activeRestId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedRoles, fetchedStaff] = await Promise.all([
        roleRepository.getAllRoles(),
        roleRepository.getStaffMembers(activeRestId),
      ]);
      setRoles(fetchedRoles || []);
      setStaffMembers(fetchedStaff || []);
    } catch (err) {
      console.warn('Failed to load staff & role data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegisterModal = (preselectedRoleId?: number) => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers do not have permission to register new staff members.', 'warning');
      return;
    }
    const defaultRoleId = preselectedRoleId || roles[0]?.id || 4;
    setIsEditing(false);
    setEditingStaffId(null);
    setFormName('');
    setFormMobile('');
    setFormEmail('');
    setFormRoleId(defaultRoleId);
    setFormEmployeeCode('');
    setFormShift('');
    resetStaffLookup();
    setModalVisible(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers do not have permission to edit staff details.', 'warning');
      return;
    }
    setIsEditing(true);
    setEditingStaffId(staff.id);
    setFormName(staff.name || '');
    setFormMobile(staff.mobile || '');
    setFormEmail(staff.email || '');
    setFormRoleId(staff.roleId);
    setFormEmployeeCode(staff.employeeCode || '');
    setFormShift(staff.shift || '');
    setModalVisible(true);
  };

  const handleSaveStaff = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers cannot modify staff members or role permissions.', 'danger');
      return;
    }
    if (!formName.trim()) {
      showAlert('Validation Error', 'Please enter staff full name.', 'warning');
      return;
    }
    if (!formMobile.trim() || formMobile.trim().length < 10) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const cleanEmployeeCode = formEmployeeCode.trim() || undefined;
      const cleanShift = formShift.trim() || undefined;
      const cleanEmail = formEmail.trim() || undefined;

      if (isEditing && editingStaffId) {
        await roleRepository.updateStaffMember(editingStaffId, {
          name: formName.trim(),
          mobile: formMobile.trim(),
          email: cleanEmail,
          roleId: formRoleId,
          employeeCode: cleanEmployeeCode,
          shift: cleanShift,
        });

        const selectedRoleObj = roles.find((r) => r.id === formRoleId);
        setStaffMembers((prev) =>
          prev.map((s) =>
            s.id === editingStaffId
              ? {
                  ...s,
                  name: formName.trim(),
                  mobile: formMobile.trim(),
                  email: cleanEmail,
                  roleId: formRoleId,
                  roleName: selectedRoleObj?.roleName || s.roleName,
                  employeeCode: cleanEmployeeCode,
                  shift: cleanShift,
                }
              : s
          )
        );
        showAlert('Staff Updated', `Staff details for ${formName} updated successfully.`, 'success');
      } else {
        const selectedRoleObj = roles.find((r) => r.id === formRoleId);
        const newStaff = await roleRepository.registerStaffMember({
          restaurantId: activeRestId,
          name: formName.trim(),
          mobile: formMobile.trim(),
          email: cleanEmail,
          roleId: formRoleId,
          employeeCode: cleanEmployeeCode,
          shift: cleanShift,
        });

        const createdRecord: StaffMember = {
          id: newStaff?.id || Date.now(),
          restaurantId: activeRestId,
          name: formName.trim(),
          mobile: formMobile.trim(),
          email: cleanEmail,
          roleId: formRoleId,
          roleName: selectedRoleObj?.roleName || 'Staff',
          employeeCode: cleanEmployeeCode,
          shift: cleanShift,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        setStaffMembers((prev) => {
          const combined = [createdRecord, ...prev];
          const map = new Map<string, StaffMember>();
          for (const item of combined) {
            const cleanM = (item.mobile || '').replace(/\D/g, '').slice(-10);
            const key = cleanM ? `mobile-${cleanM}` : (item.userId && item.userId > 0 ? `user-${item.userId}` : `id-${item.id}`);
            if (!map.has(key)) map.set(key, item);
          }
          return Array.from(map.values());
        });
        showAlert('Staff Registered', `New staff member ${formName} registered with PIN access.`, 'success');
      }

      setModalVisible(false);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to save staff record.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStaffStatus = async (staff: StaffMember) => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers cannot modify staff active status.', 'warning');
      return;
    }
    const newStatus = !staff.isActive;
    setStaffMembers((prev) => prev.map((s) => (s.id === staff.id ? { ...s, isActive: newStatus } : s)));
    try {
      await roleRepository.toggleRoleStatus(staff.id, newStatus);
    } catch (err) {
      console.warn('Could not sync status toggle with API');
    }
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers cannot delete staff members.', 'danger');
      return;
    }
    showAlert(
      'Remove Staff Member?',
      `Are you sure you want to remove ${staff.name}? This will revoke their POS and KDS access.`,
      'danger',
      'Yes, Remove',
      'Cancel',
      async () => {
        try {
          await roleRepository.deleteStaffMember(staff.id);
          setStaffMembers((prev) => prev.filter((s) => s.id !== staff.id));
          showAlert('Staff Removed', `${staff.name} has been removed from this outlet.`, 'success');
        } catch (err: any) {
          showAlert('Delete Failed', err?.message || 'Could not remove staff member.', 'danger');
        }
      }
    );
  };

  const dynamicRoleFilterOptions = useMemo(() => {
    const roleNames = Array.from(
      new Set(
        [
          ...roles.map((r) => r.roleName),
          ...staffMembers.map((s) => s.roleName),
        ].filter(Boolean)
      )
    );
    return ['all', ...roleNames];
  }, [roles, staffMembers]);

  const filteredStaff = useMemo(() => {
    return staffMembers.filter((s) => {
      const matchRole =
        roleFilter === 'all' || s.roleName?.toLowerCase() === roleFilter.toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        (s.employeeCode && s.employeeCode.toLowerCase().includes(q));
      return matchRole && matchQuery;
    });
  }, [staffMembers, searchQuery, roleFilter]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent={false} />
      <View style={styles.container}>
        {/* TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeftCol}>
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
                {activeRestaurant?.restaurantName || 'Menza Bistro'}
              </Text>
              <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
                Staff & Roles • {staffMembers.length} Team Members
              </Text>
            </View>
          </View>
          <View style={styles.headerRightCol}>
            {!cashierRestricted ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.addStaffBtn, { minWidth: 68 }]}
                  activeOpacity={0.88}
                  onPress={() => {
                    const ownerRole = roles.find((r) => r.roleName.toLowerCase().includes('owner'));
                    handleOpenRegisterModal(ownerRole?.id || 2);
                  }}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669', '#047857']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addStaffBtnGradient}
                  >
                    <Crown size={13} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.addStaffBtnText}>+ Owner</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addStaffBtn}
                  activeOpacity={0.88}
                  onPress={() => handleOpenRegisterModal()}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addStaffBtnGradient}
                  >
                    <UserPlus size={14} color="#FFFFFF" strokeWidth={2.8} />
                    <Text style={styles.addStaffBtnText}>+ Staff</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.viewOnlyBadge}>
                <Lock size={12} color="#DE8626" />
                <Text style={styles.viewOnlyBadgeText}>VIEW ONLY</Text>
              </View>
            )}

            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtnCircle} activeOpacity={0.7}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TOP TAB SWITCHER: DIRECTORY VS ROLES */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'directory' && styles.tabButtonActive]}
            onPress={() => setActiveTab('directory')}
            activeOpacity={0.8}
          >
            <Users size={14} color={activeTab === 'directory' ? '#D96B14' : '#7C6F62'} />
            <Text style={[styles.tabText, activeTab === 'directory' && styles.tabTextActive]}>
              Staff Directory
            </Text>
            <View style={[styles.tabBadge, activeTab === 'directory' ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'directory' && styles.tabBadgeTextActive]}>
                {staffMembers.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'roles' && styles.tabButtonActive]}
            onPress={() => setActiveTab('roles')}
            activeOpacity={0.8}
          >
            <ShieldCheck size={14} color={activeTab === 'roles' ? '#D96B14' : '#7C6F62'} />
            <Text style={[styles.tabText, activeTab === 'roles' && styles.tabTextActive]}>
              Roles & Permissions
            </Text>
            <View style={[styles.tabBadge, activeTab === 'roles' ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'roles' && styles.tabBadgeTextActive]}>
                {roles.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            <StaffCardSkeleton />
            <StaffCardSkeleton />
            <StaffCardSkeleton />
            <StaffCardSkeleton />
          </ScrollView>
        ) : activeTab === 'directory' ? (
          <View style={{ flex: 1 }}>
            {/* CASHIER READ-ONLY NOTICE BANNER */}
            {cashierRestricted && (
              <View style={styles.permissionBanner}>
                <View style={styles.permissionIconBadge}>
                  <Lock size={15} color="#DE8626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionBannerTitle}>Cashier Access (Read-Only Directory)</Text>
                  <Text style={styles.permissionBannerDesc}>
                    You can view team members and assignments. Adding, editing, and deleting staff is restricted to Store Owners & Admins.
                  </Text>
                </View>
              </View>
            )}

            {/* METRICS ROW */}
            <View style={styles.bentoStatsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{staffMembers.length}</Text>
                <Text style={styles.statLabel}>Total Staff</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#17845A' }]}>
                  {staffMembers.filter((s) => s.isActive).length}
                </Text>
                <Text style={styles.statLabel}>Active Staff</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#DE8626' }]}>
                  {roles.length}
                </Text>
                <Text style={styles.statLabel}>Role Types</Text>
              </View>
            </View>

            {/* SEARCH BOX */}
            <View style={styles.searchBox}>
              <Search size={14} color="#DE8626" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search staff by name, mobile, code..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <X size={13} color="#8C7A6B" />
                </TouchableOpacity>
              )}
            </View>

            {/* ROLE FILTER PILLS */}
            {dynamicRoleFilterOptions.length > 1 && (
              <View style={styles.filterPillsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {dynamicRoleFilterOptions.map((rf) => {
                    const isSel = roleFilter.toLowerCase() === rf.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={`rf-pill-${rf}`}
                        style={[styles.filterPill, isSel && styles.filterPillSelected]}
                        onPress={() => setRoleFilter(rf)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.filterPillText, isSel && styles.filterPillTextSelected]}>
                          {rf === 'all' ? 'All Roles' : rf}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* STAFF LIST */}
            <FlatList
              data={filteredStaff}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Users size={32} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>No Staff Members Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery || roleFilter !== 'all'
                      ? 'No staff match the applied search query or role filter.'
                      : 'Register team members to grant POS, KDS & Manager access credentials.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const visual = getRoleVisualConfig(item.roleName);
                return (
                  <View style={styles.staffCard}>
                    <View style={styles.staffCardContent}>
                      <View style={[styles.avatarCircle, { backgroundColor: visual.bg, borderColor: visual.border }]}>
                        <Text style={[styles.avatarText, { color: visual.color }]}>
                          {item.name ? item.name.substring(0, 2).toUpperCase() : 'ST'}
                        </Text>
                      </View>

                      <View style={styles.staffInfo}>
                        <View style={styles.staffMainHeader}>
                          <Text style={styles.staffName} numberOfLines={1}>{item.name}</Text>
                          {Boolean(item.employeeCode) && (
                            <View style={styles.codeBadge}>
                              <IdCard size={9} color="#7C6F62" />
                              <Text style={styles.codeText}>{item.employeeCode}</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.detailRow}>
                          <Phone size={11} color="#7C6F62" />
                          <Text style={styles.detailText}>{item.mobile}</Text>
                        </View>

                        {Boolean(item.email) && (
                          <View style={styles.detailRow}>
                            <Mail size={11} color="#7C6F62" />
                            <Text style={styles.detailText}>{item.email}</Text>
                          </View>
                        )}

                        <View style={styles.roleShiftRow}>
                          <View style={[styles.roleTag, { backgroundColor: visual.bg, borderColor: visual.border }]}>
                            <Text style={[styles.roleTagText, { color: visual.color }]}>{item.roleName}</Text>
                          </View>
                          {Boolean(item.shift) && (
                            <View style={styles.shiftBadge}>
                              <Clock size={9} color="#7C6F62" />
                              <Text style={styles.shiftText}>{item.shift}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.staffActionsContainer}>
                        <Switch
                          value={item.isActive}
                          onValueChange={() => handleToggleStaffStatus(item)}
                          trackColor={{ false: '#E7E1DA', true: '#DE8626' }}
                          thumbColor={item.isActive ? '#FFFFFF' : '#FAF7F2'}
                          disabled={cashierRestricted}
                        />

                        {!cashierRestricted && (
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <TouchableOpacity
                              onPress={() => handleOpenEditModal(item)}
                              style={styles.iconActionBtn}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Edit2 size={13} color="#DE8626" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteStaff(item)}
                              style={styles.iconActionBtn}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Trash2 size={13} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        ) : (
          /* ROLES & PERMISSIONS TAB */
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.roleMasterHeaderTitle}>Access Roles & Permissions Hierarchy</Text>
            {roles.map((r) => {
              const activeCount = staffMembers.filter((s) => s.roleId === r.id).length;
              const visual = getRoleVisualConfig(r.roleName);
              const IconComp = visual.icon;

              return (
                <View key={`role-master-${r.id}`} style={styles.roleCard}>
                  <View style={styles.roleCardHeader}>
                    <View style={[styles.roleIconCircle, { backgroundColor: visual.bg, borderColor: visual.border }]}>
                      <IconComp size={18} color={visual.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleTitle}>{r.roleName}</Text>
                      {Boolean(r.description) && (
                        <Text style={styles.roleDesc}>{r.description}</Text>
                      )}
                    </View>
                    <View style={styles.roleCountBadge}>
                      <Text style={styles.roleCountText}>{activeCount} Assigned</Text>
                    </View>
                  </View>

                  {!cashierRestricted && (
                    <TouchableOpacity
                      style={styles.roleAddBtn}
                      onPress={() => handleOpenRegisterModal(r.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.roleAddBtnText}>+ Register New {r.roleName}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* REGISTER / EDIT STAFF MODAL */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{isEditing ? 'Edit Staff Details' : 'Register New Staff'}</Text>
                  <Text style={styles.modalSubtitle}>Manage role assignment and login credentials</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseCircle} activeOpacity={0.7}>
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.labelWithCounterRow}>
                  <Text style={styles.inputLabel}>MOBILE NUMBER (SIGN-IN CREDENTIALS) *</Text>
                  {staffLookupLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ActivityIndicator size="small" color="#DE8626" />
                      <Text style={{ fontSize: 10, color: '#DE8626', fontWeight: '600' }}>Checking...</Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.digitCounter,
                        formMobile.length === 10 ? { color: '#17845A', fontWeight: '800' } : { color: '#7C6F62' },
                      ]}
                    >
                      {formMobile.length}/10
                    </Text>
                  )}
                </View>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneTextInput}
                    placeholder="9876543210"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={formMobile}
                    onChangeText={handleStaffMobileChange}
                  />
                  {existingStaffUser && (
                    <View style={{ paddingRight: 10, justifyContent: 'center' }}>
                      <CheckCircle2 size={18} color="#10B981" />
                    </View>
                  )}
                </View>

                {/* Auto-Fill Feedback Banner */}
                {existingStaffUser && (
                  <View style={{
                    marginTop: 6,
                    marginBottom: 10,
                    padding: 8,
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
                        "{existingStaffUser.name}" (ID: #{existingStaffUser.id}). Role will be assigned to this user.
                      </Text>
                    </View>
                  </View>
                )}

                {formMobile.length === 10 && !existingStaffUser && !staffLookupLoading && (
                  <View style={{
                    marginTop: 6,
                    marginBottom: 10,
                    padding: 8,
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
                      New User: Account will be created automatically upon saving.
                    </Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>FULL NAME *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#9CA3AF"
                  value={formName}
                  onChangeText={setFormName}
                />

                <Text style={styles.inputLabel}>EMAIL (OPTIONAL)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. staff@menza.in"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formEmail}
                  onChangeText={setFormEmail}
                />

                <Text style={styles.inputLabel}>EMPLOYEE CODE (OPTIONAL)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. EMP-101"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  value={formEmployeeCode}
                  onChangeText={setFormEmployeeCode}
                />

                <Text style={styles.inputLabel}>ASSIGNED ROLE *</Text>
                <View style={styles.roleSelectionGrid}>
                  {roles.map((r) => {
                    const isSel = formRoleId === r.id;
                    const visual = getRoleVisualConfig(r.roleName);
                    const IconComp = visual.icon;
                    return (
                      <TouchableOpacity
                        key={`role-opt-${r.id}`}
                        style={[styles.roleSelectCard, isSel && styles.roleSelectCardActive]}
                        onPress={() => setFormRoleId(r.id)}
                        activeOpacity={0.8}
                      >
                        <IconComp size={16} color={isSel ? '#D96B14' : '#7C6F62'} />
                        <Text style={[styles.roleSelectName, isSel && styles.roleSelectNameActive]}>{r.roleName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>WORKING SHIFT (OPTIONAL)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Morning Shift, Full Day, Night"
                  placeholderTextColor="#9CA3AF"
                  value={formShift}
                  onChangeText={setFormShift}
                />

                <TouchableOpacity
                  style={styles.saveStaffCta}
                  onPress={handleSaveStaff}
                  disabled={saving}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveStaffCtaGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.saveStaffCtaText}>
                          {isEditing ? 'SAVE CHANGES' : 'REGISTER STAFF'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>

      {/* GILDED ALERT MODAL */}
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
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: Spacing.md,
  },

  /* TOP HEADER */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
    marginBottom: 8,
  },
  headerLeftCol: {
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
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addStaffBtn: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addStaffBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addStaffBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewOnlyBadgeText: {
    color: '#D96B14',
    fontSize: 9.5,
    fontWeight: '800',
  },

  /* TAB BAR */
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 10,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 7,
  },
  tabButtonActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C6F62',
  },
  tabTextActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#DE8626',
  },
  tabBadgeInactive: {
    backgroundColor: '#E7E1DA',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  /* CASHIER READ-ONLY BANNER */
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  permissionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  permissionBannerTitle: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  permissionBannerDesc: {
    color: '#7C6F62',
    fontSize: 10.5,
    lineHeight: 14,
  },

  /* BENTO STATS */
  bentoStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#8C7A6B',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* SEARCH BOX */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    paddingVertical: 0,
  },

  /* FILTER PILLS */
  filterPillsRow: {
    marginBottom: 10,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
  },
  filterPillSelected: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C6F62',
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* LIST CONTENT */
  listContent: {
    paddingBottom: 24,
    gap: 8,
  },

  /* STAFF CARD */
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  staffCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
  },
  staffInfo: {
    flex: 1,
  },
  staffMainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C6F62',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  detailText: {
    fontSize: 11,
    color: '#7C6F62',
  },
  roleShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  roleTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  shiftText: {
    fontSize: 9,
    color: '#7C6F62',
    fontWeight: '600',
  },
  staffActionsContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* SKELETON */
  staffCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 8,
  },
  skeletonBg: {
    backgroundColor: '#E7E1DA',
  },

  /* EMPTY CARD */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#8C7A6B',
    textAlign: 'center',
    lineHeight: 16,
  },

  /* ROLES TAB */
  roleMasterHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 8,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },
  roleDesc: {
    fontSize: 10.5,
    color: '#7C6F62',
    marginTop: 1,
  },
  roleCountBadge: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1F2937',
  },
  roleAddBtn: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE4',
    alignItems: 'center',
  },
  roleAddBtnText: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '700',
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: 10.5,
    color: '#8C7A6B',
    marginTop: 1,
  },
  modalCloseCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5C4E3D',
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 8,
  },
  labelWithCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  digitCounter: {
    fontSize: 10,
  },
  modalInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#1F2937',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  countryCodeBadge: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    color: '#D96B14',
    fontSize: 12,
    fontWeight: '800',
  },
  phoneTextInput: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#1F2937',
  },
  roleSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  roleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleSelectCardActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
  },
  roleSelectName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4E3D',
  },
  roleSelectNameActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  saveStaffCta: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveStaffCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  saveStaffCtaText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
