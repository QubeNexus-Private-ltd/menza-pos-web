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
  Alert,
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
  ChevronDown,
  Check,
  MapPin,
  Search,
  Globe,
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  UserCheck,
  Building,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Shield,
  CheckCircle2,
  Phone,
  FileText,
} from 'lucide-react-native';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { StatusBadge } from '../../components/StatusBadge';
import { OnboardRestaurantRequest } from '../../../domain/models/OnboardRestaurantRequest';
import { StateMaster } from '../../../domain/models/MasterData';
import { RoleMaster } from '../../../domain/models/Role';
import { SuperAdminRemoteDataSource } from '../../../data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '../../../data/repositories/SuperAdminRepositoryImpl';
import { MasterDataRemoteDataSource } from '../../../data/datasources/MasterDataRemoteDataSource';
import { MasterDataRepositoryImpl } from '../../../data/repositories/MasterDataRepositoryImpl';
import { RoleRemoteDataSource } from '../../../data/datasources/RoleRemoteDataSource';
import { RoleRepositoryImpl } from '../../../data/repositories/RoleRepositoryImpl';
import { apiClient } from '../../../core/network/apiClient';
import { useUserLookupByMobile } from '../../hooks/useUserLookupByMobile';
import { cleanMobile } from '../../../core/utils/formatters';

// Dynamically load expo-image-picker safely if native binary is linked
let ImagePickerModule: typeof import('expo-image-picker') | null = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch (e) {
  // Ignored in Expo Go
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const superAdminRepository = new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource());
const masterDataRepository = new MasterDataRepositoryImpl(new MasterDataRemoteDataSource());
const roleRepository = new RoleRepositoryImpl(new RoleRemoteDataSource());

const FULL_STATE_MASTER_LIST: StateMaster[] = [
  { stateCode: 'AP', stateDesc: 'Andhra Pradesh' },
  { stateCode: 'KA', stateDesc: 'Karnataka' },
  { stateCode: 'KL', stateDesc: 'Kerala' },
  { stateCode: 'MH', stateDesc: 'Maharashtra' },
  { stateCode: 'TN', stateDesc: 'Tamil Nadu' },
  { stateCode: 'TG', stateDesc: 'Telangana' },
  { stateCode: 'DL', stateDesc: 'Delhi' },
];

const SAMPLE_BANNERS = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
];

const SAMPLE_LOGOS = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
];

interface SuperAdminOnboardingScreenProps {
  onClose: () => void;
}

export const SuperAdminOnboardingScreen: React.FC<SuperAdminOnboardingScreenProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [form, setForm] = useState<OnboardRestaurantRequest>({
    restaurantName: '',
    address: '',
    city: '',
    state: '',
    contactNumber: '',
    gstNumber: '',
    imageUrl: '',
    logoUrl: '',
    ownerName: '',
    ownerMobile: '',
  });

  const [createdRestaurantId, setCreatedRestaurantId] = useState<number | null>(null);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(2);
  const [isDefaultRole, setIsDefaultRole] = useState<boolean>(true);

  const [states, setStates] = useState<StateMaster[]>(FULL_STATE_MASTER_LIST);
  const [availableRoles, setAvailableRoles] = useState<RoleMaster[]>([]);

  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [stateModalVisible, setStateModalVisible] = useState(false);

  // Store Onboarded Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [onboardedSummary, setOnboardedSummary] = useState<{
    storeName: string;
    storeId: number;
    ownerName: string;
    roleName: string;
  } | null>(null);

  const filteredStates = useMemo(() => {
    if (!stateSearchQuery || stateSearchQuery.trim() === '') return states;
    const q = stateSearchQuery.toLowerCase().trim();
    return states.filter(
      (st) =>
        st.stateCode.toLowerCase().includes(q) ||
        st.stateDesc.toLowerCase().includes(q)
    );
  }, [states, stateSearchQuery]);

  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [activeUploadTarget, setActiveUploadTarget] = useState<'imageUrl' | 'logoUrl'>('imageUrl');
  const [submitting, setSubmitting] = useState(false);

  const {
    loading: ownerLookupLoading,
    existingUser: existingOwner,
    handleMobileChange: triggerOwnerMobileLookup,
  } = useUserLookupByMobile();

  const handleOwnerMobileChange = (txt: string) => {
    const sanitized = cleanMobile(txt);
    setForm((prev) => ({ ...prev, ownerMobile: sanitized }));
    triggerOwnerMobileLookup(sanitized, (foundUser) => {
      if (foundUser.name) {
        setForm((prev) => ({ ...prev, ownerName: foundUser.name }));
      }
    });
  };

  const handleOpenImagePicker = (target: 'imageUrl' | 'logoUrl') => {
    setActiveUploadTarget(target);
    setImageModalVisible(true);
  };

  const handleSelectPresetImage = (url: string) => {
    setForm((prev) => ({ ...prev, [activeUploadTarget]: url }));
    setImageModalVisible(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getSelectedStateFullName = (val?: string) => {
    if (!val) return 'Select State';
    const matched = states.find(
      (s) => s.stateCode.toLowerCase() === val.toLowerCase() || s.stateDesc.toLowerCase() === val.toLowerCase()
    );
    return matched ? matched.stateDesc : val;
  };

  const loadData = async () => {
    try {
      try {
        const stateList = await masterDataRepository.getStates();
        if (stateList && stateList.length > 0) {
          setStates(stateList);
          setForm((prev) => ({ ...prev, state: prev.state ? getSelectedStateFullName(prev.state) : stateList[0].stateDesc }));
        } else {
          setStates(FULL_STATE_MASTER_LIST);
          setForm((prev) => ({ ...prev, state: prev.state ? getSelectedStateFullName(prev.state) : FULL_STATE_MASTER_LIST[0].stateDesc }));
        }
      } catch (err) {
        setStates(FULL_STATE_MASTER_LIST);
        setForm((prev) => ({ ...prev, state: prev.state ? getSelectedStateFullName(prev.state) : FULL_STATE_MASTER_LIST[0].stateDesc }));
      }

      try {
        const roleList = await roleRepository.getAllRoles();
        if (roleList && roleList.length > 0) {
          setAvailableRoles(roleList);
        } else {
          setAvailableRoles([
            { id: 2, roleName: 'Owner', description: 'Full Restaurant Access & Store Control' },
            { id: 1, roleName: 'SuperAdmin', description: 'Global Multi-Tenant Platform Controller' },
            { id: 3, roleName: 'Admin', description: 'Store Manager & Menu Operations' },
            { id: 4, roleName: 'Cashier', description: 'Billing & POS Settlement' },
          ]);
        }
      } catch (err) {
        setAvailableRoles([
          { id: 2, roleName: 'Owner', description: 'Full Restaurant Access & Store Control' },
          { id: 1, roleName: 'SuperAdmin', description: 'Global Multi-Tenant Platform Controller' },
          { id: 3, roleName: 'Admin', description: 'Store Manager & Menu Operations' },
          { id: 4, roleName: 'Cashier', description: 'Billing & POS Settlement' },
        ]);
      }
    } catch (err) {
      console.warn('Failed to load onboarding master data');
    }
  };

  const handleLaunchNativePicker = async () => {
    if (!ImagePickerModule || !ImagePickerModule.launchImageLibraryAsync) {
      Alert.alert(
        'Notice',
        'Select a high-resolution preset below or paste any custom Image URL directly.'
      );
      return;
    }

    try {
      const permissionResult = await ImagePickerModule.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required.');
        return;
      }

      const result = await ImagePickerModule.launchImageLibraryAsync({
        mediaTypes: ImagePickerModule.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setForm((prev) => ({ ...prev, [activeUploadTarget]: result.assets[0].uri }));
        setImageModalVisible(false);
      }
    } catch (err) {
      Alert.alert('Notice', 'Please select a sample image preset below.');
    }
  };

  const handleProceedToStep2 = async () => {
    const resName = form.restaurantName.trim();
    if (!resName) {
      Alert.alert('Validation Error', 'Please enter Restaurant Name.');
      return;
    }
    try {
      setSubmitting(true);
      const result = await superAdminRepository.onboardRestaurant(form);
      const restId = result.restaurantId;

      if (restId && restId > 0) {
        setCreatedRestaurantId(restId);
        setCurrentStep(2);
      } else {
        Alert.alert('Store Creation Error', 'Could not save restaurant configuration.');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data || err.message || 'Failed to create restaurant configuration.';
      Alert.alert('Store Creation Error', typeof errorMsg === 'string' ? errorMsg : 'Failed to save store.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToStep3 = async () => {
    const ownerName = form.ownerName.trim();
    const ownerMobile = form.ownerMobile.trim();

    if (!ownerName || !ownerMobile) {
      Alert.alert('Validation Error', 'Please enter Owner Full Name and Owner Mobile Number.');
      return;
    }

    try {
      setSubmitting(true);
      let userId = 0;
      const cleanMobile = (ownerMobile || '').replace(/\D/g, '').slice(-10);
      const cleanName = (ownerName || '').trim();

      if (!cleanMobile || cleanMobile.length < 10) {
        Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number.');
        return;
      }
      if (!cleanName || cleanName.length < 2) {
        Alert.alert('Validation Error', 'Please enter a valid owner name (at least 2 characters).');
        return;
      }

      try {
        const userCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
        const data = userCheck.data;
        if (data) {
          userId = Number(data.id ?? data.Id ?? data.userId ?? 0);
        }
      } catch {
        // User not found by mobile
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

        if (!userId || userId <= 0) {
          try {
            const createdCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanMobile}`);
            userId = Number(createdCheck.data?.id ?? createdCheck.data?.Id ?? 0);
          } catch {
            // Fallback
          }
        }
      }

      if (userId && userId > 0) {
        setCreatedUserId(userId);
        setCurrentStep(3);
      } else {
        Alert.alert('User Creation Error', 'Could not obtain created User ID.');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data || err.message || 'Could not create user profile.';
      Alert.alert('User Creation Error', typeof errorMsg === 'string' ? errorMsg : 'Failed to save owner.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAssignRole = async () => {
    if (!createdRestaurantId || createdRestaurantId <= 0) {
      Alert.alert('Onboarding Error', 'Invalid Restaurant ID. Please complete Step 1 first.');
      return;
    }

    try {
      setSubmitting(true);
      const restId = createdRestaurantId;
      const userId = createdUserId!;

      await roleRepository.assignRole({
        userId,
        roleId: selectedRoleId,
        restId: restId,
        restaurantId: restId,
        isDefault: isDefaultRole,
      });

      const selectedRoleObj = availableRoles.find((r) => r.id === selectedRoleId);
      setOnboardedSummary({
        storeName: form.restaurantName,
        storeId: restId,
        ownerName: form.ownerName,
        roleName: selectedRoleObj?.roleName || 'Owner',
      });
      setSuccessModalVisible(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data || err.message || 'Failed to assign role.';
      Alert.alert('Role Assignment Error', typeof errorMsg === 'string' ? errorMsg : 'Could not complete role assignment.');
    } finally {
      setSubmitting(false);
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
                  Super Admin • Onboard New Store
                </Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.closeCircle}>
              <X size={16} color="#8C7A6B" />
            </TouchableOpacity>
          </View>

          {/* 3-Stage Stepper Progress Bar */}
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCurrentStep(1)}
              style={[styles.stepPill, currentStep === 1 && styles.stepPillActive]}
            >
              <Building size={14} color={currentStep === 1 ? '#D96B14' : '#5C4E3D'} />
              <Text style={[styles.stepTitleText, currentStep === 1 && styles.stepTitleTextActive]}>
                1. Store
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => createdRestaurantId && setCurrentStep(2)}
              style={[styles.stepPill, currentStep === 2 && styles.stepPillActive]}
            >
              <UserCheck size={14} color={currentStep === 2 ? '#D96B14' : '#5C4E3D'} />
              <Text style={[styles.stepTitleText, currentStep === 2 && styles.stepTitleTextActive]}>
                2. Owner
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => createdUserId && setCurrentStep(3)}
              style={[styles.stepPill, currentStep === 3 && styles.stepPillActive]}
            >
              <Shield size={14} color={currentStep === 3 ? '#D96B14' : '#5C4E3D'} />
              <Text style={[styles.stepTitleText, currentStep === 3 && styles.stepTitleTextActive]}>
                3. Role
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.innerFormWrapper}>
                {/* STEP 1: Restaurant Onboarding Screen */}
                {currentStep === 1 && (
                  <View style={styles.formCard}>
                    <Text style={styles.sectionHeader}>Step 1: Restaurant Store Details</Text>

                    <Text style={styles.label}>RESTAURANT NAME *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Menza Bistro & Grill"
                      placeholderTextColor="#9CA3AF"
                      value={form.restaurantName}
                      onChangeText={(txt) => setForm({ ...form, restaurantName: txt })}
                    />

                    <View style={styles.rowGrid}>
                      <View style={styles.cityCol}>
                        <Text style={styles.label}>CITY</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Mumbai"
                          placeholderTextColor="#9CA3AF"
                          value={form.city}
                          onChangeText={(txt) => setForm({ ...form, city: txt })}
                        />
                      </View>

                      <View style={styles.stateCol}>
                        <Text style={styles.label}>STATE *</Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={styles.dropdownSelector}
                          onPress={() => {
                            setStateSearchQuery('');
                            setStateModalVisible(true);
                          }}
                        >
                          <Text style={styles.dropdownValueText} numberOfLines={1}>
                            {getSelectedStateFullName(form.state)}
                          </Text>
                          <ChevronDown size={16} color="#DE8626" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.label}>FULL ADDRESS</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Street Address, Area"
                      placeholderTextColor="#9CA3AF"
                      value={form.address}
                      onChangeText={(txt) => setForm({ ...form, address: txt })}
                    />

                    <Text style={styles.label}>GSTIN NUMBER</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="22AAAAA0000A1Z5"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      value={form.gstNumber}
                      onChangeText={(txt) => setForm({ ...form, gstNumber: txt })}
                    />

                    {/* Banner Image Uploader */}
                    <Text style={styles.label}>BANNER IMAGE</Text>
                    {form.imageUrl ? (
                      <View style={styles.imagePreviewBox}>
                        <Image source={{ uri: form.imageUrl }} style={styles.bannerPreviewImage} />
                        <View style={styles.imageOverlayRow}>
                          <TouchableOpacity
                            style={styles.changeImageBtn}
                            onPress={() => handleOpenImagePicker('imageUrl')}
                          >
                            <Upload size={14} color="#DE8626" />
                            <Text style={styles.changeImageText}>Change Banner</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.removeImageBtn}
                            onPress={() => setForm({ ...form, imageUrl: '' })}
                          >
                            <X size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.uploadPlaceholderBox}
                        onPress={() => handleOpenImagePicker('imageUrl')}
                      >
                        <Upload size={18} color="#DE8626" />
                        <Text style={styles.uploadPlaceholderText}>Upload Store Banner</Text>
                      </TouchableOpacity>
                    )}

                    {/* Logo Image Uploader */}
                    <Text style={[styles.label, { marginTop: Spacing.md }]}>STORE LOGO</Text>
                    {form.logoUrl ? (
                      <View style={styles.logoPreviewBox}>
                        <Image source={{ uri: form.logoUrl }} style={styles.logoPreviewImage} />
                        <TouchableOpacity
                          style={styles.changeImageBtn}
                          onPress={() => handleOpenImagePicker('logoUrl')}
                        >
                          <ImageIcon size={14} color="#DE8626" />
                          <Text style={styles.changeImageText}>Change Logo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeImageBtn}
                          onPress={() => setForm({ ...form, logoUrl: '' })}
                        >
                          <X size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.uploadPlaceholderBox}
                        onPress={() => handleOpenImagePicker('logoUrl')}
                      >
                        <ImageIcon size={18} color="#DE8626" />
                        <Text style={styles.uploadPlaceholderText}>Upload Store Logo</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.nextStepBtnWrapper}
                      onPress={handleProceedToStep2}
                      disabled={submitting}
                    >
                      <LinearGradient
                        colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.nextStepBtnGradient}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.nextStepBtnText}>CONTINUE TO OWNER DETAILS</Text>
                            <ArrowRight size={18} color="#FFFFFF" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 2: Owner Details Screen */}
                {currentStep === 2 && (
                  <View style={styles.formCard}>
                    <View style={styles.stepHeaderRow}>
                      <UserCheck size={20} color="#DE8626" />
                      <Text style={styles.sectionHeader}>Step 2: Owner User Details</Text>
                    </View>

                    {/* Store Summary Banner */}
                    <View style={styles.storeSummaryBanner}>
                      <ShieldCheck size={20} color="#17845A" />
                      <View style={styles.storeSummaryText}>
                        <Text style={styles.storeSummaryTitle}>{form.restaurantName || 'New Restaurant'}</Text>
                        <Text style={styles.storeSummarySub}>
                          Store ID: #{createdRestaurantId || 101} • {form.city ? `${form.city}, ` : ''}{getSelectedStateFullName(form.state)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.label}>OWNER REGISTERED MOBILE *</Text>
                      {ownerLookupLoading && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ActivityIndicator size="small" color="#DE8626" />
                          <Text style={{ fontSize: 11, color: '#DE8626', fontWeight: '600' }}>Checking user...</Text>
                        </View>
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
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={form.ownerMobile}
                        onChangeText={handleOwnerMobileChange}
                      />
                      {existingOwner && (
                        <View style={{ paddingRight: 10, justifyContent: 'center' }}>
                          <CheckCircle2 size={18} color="#10B981" />
                        </View>
                      )}
                    </View>

                    {/* Auto-Fill Status Banner */}
                    {existingOwner && (
                      <View style={{
                        marginTop: 6,
                        marginBottom: 10,
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
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#065F46' }}>
                            Existing Registered User Found
                          </Text>
                          <Text style={{ fontSize: 11, color: '#047857', marginTop: 1 }}>
                            Name: "{existingOwner.name}" (ID: #{existingOwner.id}). Ownership will be linked to this account.
                          </Text>
                        </View>
                      </View>
                    )}

                    {form.ownerMobile.length === 10 && !existingOwner && !ownerLookupLoading && (
                      <View style={{
                        marginTop: 6,
                        marginBottom: 10,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: '#EFF6FF',
                        borderWidth: 1,
                        borderColor: '#BFDBFE',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <Sparkles size={16} color="#2563EB" />
                        <Text style={{ fontSize: 11, color: '#1E40AF', flex: 1 }}>
                          New User: Account will be created automatically upon store completion.
                        </Text>
                      </View>
                    )}

                    <Text style={styles.label}>OWNER FULL NAME *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Ramesh Kumar"
                      placeholderTextColor="#9CA3AF"
                      value={form.ownerName}
                      onChangeText={(txt) => setForm({ ...form, ownerName: txt })}
                    />

                    <View style={styles.workflowNavRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.backStepBtn}
                        onPress={() => setCurrentStep(1)}
                      >
                        <ArrowLeft size={16} color="#5C4E3D" />
                        <Text style={styles.backStepBtnText}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.nextStepBtnWrapper}
                        onPress={handleProceedToStep3}
                        disabled={submitting}
                      >
                        <LinearGradient
                          colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.nextStepBtnGradient}
                        >
                          {submitting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Text style={styles.nextStepBtnText}>CONTINUE TO ASSIGN ROLE</Text>
                              <ArrowRight size={18} color="#FFFFFF" />
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* STEP 3: Assign Role Workflow Screen */}
                {currentStep === 3 && (
                  <View style={styles.formCard}>
                    <View style={styles.stepHeaderRow}>
                      <Shield size={20} color="#DE8626" />
                      <Text style={styles.sectionHeader}>Step 3: Assign Role to Owner</Text>
                    </View>

                    {/* Summary Overview Banner */}
                    <View style={styles.workflowSummaryBox}>
                      <View style={styles.summaryItemRow}>
                        <Building size={16} color="#DE8626" />
                        <Text style={styles.summaryItemText}>
                          <Text style={styles.boldText}>Store:</Text> {form.restaurantName} (ID: #{createdRestaurantId || 101})
                        </Text>
                      </View>
                      <View style={styles.summaryItemRow}>
                        <UserCheck size={16} color="#DE8626" />
                        <Text style={styles.summaryItemText}>
                          <Text style={styles.boldText}>Owner:</Text> {form.ownerName} (+91 {form.ownerMobile})
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.label}>SELECT ROLE TO ASSIGN *</Text>
                    {availableRoles.map((roleObj) => {
                      const isSelected = roleObj.id === selectedRoleId;
                      return (
                        <TouchableOpacity
                          key={`role-${roleObj.id}`}
                          activeOpacity={0.8}
                          style={[styles.roleSelectCard, isSelected && styles.roleSelectCardSelected]}
                          onPress={() => setSelectedRoleId(roleObj.id)}
                        >
                          <View style={styles.roleCardLeft}>
                            <View style={[styles.roleBadgeIcon, isSelected && styles.roleBadgeIconSelected]}>
                              <Shield size={16} color={isSelected ? '#FFFFFF' : '#DE8626'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.roleCardTitle, isSelected && styles.roleCardTitleSelected]}>
                                {roleObj.roleName}
                              </Text>
                              {roleObj.description ? (
                                <Text style={styles.roleCardDesc}>{roleObj.description}</Text>
                              ) : null}
                            </View>
                          </View>

                          {isSelected && (
                            <View style={styles.checkCircle}>
                              <Check size={14} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    {/* Default Access Switch */}
                    <View style={styles.defaultAccessRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.defaultAccessTitle}>Set as Default Active Role</Text>
                        <Text style={styles.defaultAccessSub}>Injects role header into active REST sessions</Text>
                      </View>
                      <Switch
                        value={isDefaultRole}
                        onValueChange={setIsDefaultRole}
                        trackColor={{ false: '#E7E1DA', true: '#DE8626' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    {/* High Impact Complete & Assign Role Button */}
                    <View style={styles.workflowNavRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.backStepBtn}
                        onPress={() => setCurrentStep(2)}
                      >
                        <ArrowLeft size={16} color="#5C4E3D" />
                        <Text style={styles.backStepBtnText}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.completeWorkflowBtnWrapper}
                        onPress={handleCompleteAssignRole}
                        disabled={submitting}
                      >
                        <LinearGradient
                          colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.completeWorkflowGradient}
                        >
                          {submitting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <CheckCircle2 size={18} color="#FFFFFF" />
                              <Text style={styles.completeWorkflowBtnText}>COMPLETE & LAUNCH</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>

          {/* Dynamic Image Picker & Presets Modal */}
          <Modal visible={imageModalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalTitleBadge}>
                    <Sparkles size={18} color="#DE8626" />
                    <Text style={styles.modalTitleText}>
                      Select {activeUploadTarget === 'imageUrl' ? 'Banner' : 'Logo'} Image
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setImageModalVisible(false)} style={styles.modalCloseCircle}>
                    <X size={16} color="#8C7A6B" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.galleryPickBtn} onPress={handleLaunchNativePicker}>
                  <Upload size={16} color="#FFFFFF" />
                  <Text style={styles.galleryPickText}>Pick from Device Gallery</Text>
                </TouchableOpacity>

                <Text style={styles.presetHeading}>Or Select Sample Preset:</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                  {(activeUploadTarget === 'imageUrl' ? SAMPLE_BANNERS : SAMPLE_LOGOS).map((url, idx) => (
                    <TouchableOpacity
                      key={`preset-${idx}`}
                      style={styles.presetCard}
                      onPress={() => handleSelectPresetImage(url)}
                    >
                      <Image source={{ uri: url }} style={styles.presetImage} />
                      <Text style={styles.presetSelectLabel}>Tap to Select</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity onPress={() => setImageModalVisible(false)} style={styles.modalFooterCloseBtn}>
                  <Text style={styles.modalFooterCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Dynamic Searchable State Selection Modal */}
          <Modal visible={stateModalVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalTitleBadge}>
                    <Globe size={18} color="#DE8626" />
                    <Text style={styles.modalTitleText}>Select State</Text>
                  </View>
                  <TouchableOpacity onPress={() => setStateModalVisible(false)} style={styles.modalCloseCircle}>
                    <X size={16} color="#8C7A6B" />
                  </TouchableOpacity>
                </View>

                {/* Search Input inside Modal */}
                <View style={styles.searchBox}>
                  <Search size={16} color="#DE8626" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search state by name..."
                    placeholderTextColor="#9CA3AF"
                    value={stateSearchQuery}
                    onChangeText={setStateSearchQuery}
                    autoFocus
                  />
                </View>

                {/* States List */}
                <ScrollView style={styles.statesListScroll} showsVerticalScrollIndicator={false}>
                  {filteredStates.map((st, idx) => {
                    const isSelected =
                      st.stateCode.toLowerCase() === (form.state || '').toLowerCase() ||
                      st.stateDesc.toLowerCase() === (form.state || '').toLowerCase();
                    return (
                      <TouchableOpacity
                        key={`state-${st.stateCode || idx}-${idx}`}
                        activeOpacity={0.7}
                        style={[styles.stateOptionCard, isSelected && styles.stateOptionCardSelected]}
                        onPress={() => {
                          setForm({ ...form, state: st.stateDesc });
                          setStateModalVisible(false);
                        }}
                      >
                        <View style={styles.stateOptionLeft}>
                          <View style={[styles.statePinBadge, isSelected && styles.statePinBadgeSelected]}>
                            <MapPin size={16} color={isSelected ? '#FFFFFF' : '#DE8626'} />
                          </View>
                          <View style={styles.stateTextCol}>
                            <Text style={[styles.stateOptionTitle, isSelected && styles.stateOptionTitleSelected]}>
                              {st.stateDesc}
                            </Text>
                          </View>
                        </View>

                        {isSelected && (
                          <View style={styles.checkCircle}>
                            <Check size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {filteredStates.length === 0 && (
                    <View style={styles.emptyStateContainer}>
                      <Text style={styles.emptyStateText}>No states found matching "{stateSearchQuery}"</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Store Onboarded Success Modal */}
          <Modal visible={successModalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.successModalCard}>
                <View style={styles.successBadgeCircle}>
                  <Sparkles size={32} color="#DE8626" />
                </View>

                <Text style={styles.successTitleText}>STORE ONBOARDED 🎉</Text>
                <Text style={styles.successSubTitleText}>
                  Restaurant configuration & owner credentials set up successfully!
                </Text>

                {onboardedSummary && (
                  <View style={styles.successSummaryBox}>
                    <View style={styles.successSummaryRow}>
                      <Text style={styles.successLabel}>STORE NAME</Text>
                      <Text style={styles.successValue}>{onboardedSummary.storeName}</Text>
                    </View>
                    <View style={styles.successDivider} />
                    <View style={styles.successSummaryRow}>
                      <Text style={styles.successLabel}>STORE ID</Text>
                      <Text style={styles.successValueGold}>#{onboardedSummary.storeId}</Text>
                    </View>
                    <View style={styles.successDivider} />
                    <View style={styles.successSummaryRow}>
                      <Text style={styles.successLabel}>ASSIGNED OWNER</Text>
                      <Text style={styles.successValue}>{onboardedSummary.ownerName}</Text>
                    </View>
                    <View style={styles.successDivider} />
                    <View style={styles.successSummaryRow}>
                      <Text style={styles.successLabel}>ACTIVE ROLE</Text>
                      <Text style={styles.successValueGold}>{onboardedSummary.roleName}</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.successLaunchBtnWrapper}
                  onPress={() => {
                    setSuccessModalVisible(false);
                    onClose();
                  }}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.successLaunchBtnGradient}
                  >
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={styles.successLaunchBtnText}>LAUNCH DASHBOARD</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
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
    padding: Spacing.md,
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
  closeBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  closeBtnText: {
    color: '#DC2626',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: Spacing.md,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Spacing.borderRadius.sm,
    gap: 6,
  },
  stepPillActive: {
    backgroundColor: '#FFF0DE',
  },
  stepTitleText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  stepTitleTextActive: {
    color: '#D96B14',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
  },
  innerFormWrapper: {
    width: '100%',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 16,
  },
  storeSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F5EC',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
    marginBottom: Spacing.md,
    gap: 10,
  },
  storeSummaryText: {
    flex: 1,
  },
  storeSummaryTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
  },
  storeSummarySub: {
    color: '#17845A',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  workflowSummaryBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: Spacing.md,
    gap: 8,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryItemText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  boldText: {
    color: '#1F2937',
    fontWeight: Typography.fontWeight.bold,
  },
  roleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 10,
  },
  roleSelectCardSelected: {
    borderColor: '#DE8626',
    backgroundColor: '#FFF0DE',
  },
  roleCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  roleBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeIconSelected: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  roleCardTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
  },
  roleCardTitleSelected: {
    color: '#D96B14',
  },
  roleCardDesc: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  defaultAccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    padding: Spacing.md,
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginTop: Spacing.sm,
  },
  defaultAccessTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  defaultAccessSub: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cityCol: {
    flex: 1,
  },
  stateCol: {
    flex: 1,
  },
  label: {
    color: '#5C4E3D',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 6,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#FAF7F2',
    color: '#1F2937',
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.md,
    fontSize: Typography.fontSize.body1,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginBottom: Spacing.md,
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRightWidth: 0,
    borderTopLeftRadius: Spacing.borderRadius.md,
    borderBottomLeftRadius: Spacing.borderRadius.md,
    paddingHorizontal: 14,
    height: '100%',
  },
  countryCodeText: {
    color: '#DE8626',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
  },
  phoneTextInput: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderTopRightRadius: Spacing.borderRadius.md,
    borderBottomRightRadius: Spacing.borderRadius.md,
    paddingHorizontal: 14,
    height: '100%',
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
  },
  uploadPlaceholderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderStyle: 'dashed',
    height: 52,
    gap: 8,
  },
  uploadPlaceholderText: {
    color: '#D96B14',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  imagePreviewBox: {
    position: 'relative',
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  bannerPreviewImage: {
    width: '100%',
    height: 110,
  },
  logoPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FAF7F2',
    padding: Spacing.md,
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  logoPreviewImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  imageOverlayRow: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  changeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Spacing.borderRadius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  changeImageText: {
    color: '#DE8626',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  removeImageBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 6,
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  nextStepBtnWrapper: {
    flex: 1,
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  nextStepBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 8,
  },
  nextStepBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  workflowNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
    gap: 6,
  },
  backStepBtnText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  completeWorkflowBtnWrapper: {
    flex: 1,
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  completeWorkflowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  completeWorkflowBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.md,
  },
  dropdownValueText: {
    flex: 1,
    color: '#1F2937',
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
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
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.cardLarge,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
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
  galleryPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DE8626',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 8,
  },
  galleryPickText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  presetHeading: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  presetScroll: {
    marginBottom: Spacing.md,
  },
  presetCard: {
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  presetImage: {
    width: 100,
    height: 70,
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  presetSelectLabel: {
    color: '#DE8626',
    fontSize: Typography.fontSize.xs,
    marginTop: 4,
  },
  modalFooterCloseBtn: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  modalFooterCloseText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: Typography.fontSize.sm,
  },
  statesListScroll: {
    maxHeight: 320,
  },
  stateOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 8,
  },
  stateOptionCardSelected: {
    borderColor: '#DE8626',
    backgroundColor: '#FFF0DE',
  },
  stateOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  stateTextCol: {
    flex: 1,
  },
  statePinBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statePinBadgeSelected: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  stateCodeText: {
    color: '#DE8626',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  stateCodeTextSelected: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeight.bold,
  },
  stateOptionTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  stateOptionTitleSelected: {
    color: '#D96B14',
    fontWeight: Typography.fontWeight.bold,
  },
  stateCodeSubtitle: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.sm,
  },
  successModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  successBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0DE',
    borderWidth: 1.5,
    borderColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitleText: {
    color: '#1F2937',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubTitleText: {
    color: '#5C4E3D',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  successSummaryBox: {
    width: '100%',
    backgroundColor: '#FAF7F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 20,
  },
  successSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  successDivider: {
    height: 1,
    backgroundColor: '#E7E1DA',
    marginVertical: 4,
  },
  successLabel: {
    color: '#7C6F62',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  successValue: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  successValueGold: {
    color: '#DE8626',
    fontSize: 14,
    fontWeight: '700',
  },
  successLaunchBtnWrapper: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  successLaunchBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successLaunchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
