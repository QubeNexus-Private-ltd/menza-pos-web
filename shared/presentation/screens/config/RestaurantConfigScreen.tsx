import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Dimensions,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  Building2,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Receipt,
  Camera,
  Image as ImageIcon,
  Save,
  X,
  CheckCircle2,
  Sparkles,
  Percent,
  Store,
  Wallet,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Lock,
  ShieldAlert,
  Scale,
  FileText,
  ShieldCheck,
  QrCode,
  Share2,
  Clock,
  Calendar,
  Table as TableIcon,
  Users,
  Utensils,
  Flame,
  Coffee,
  Plus,
  Trash2,
  Edit3,
  Layers,
  Zap,
  ChefHat,
  History,
  RotateCw,
  Power,
} from 'lucide-react-native';
import { RestaurantConfig, RestaurantOperatingHistoryEntry, StoreOperatingStatus } from '../../../domain/models/RestaurantConfig';
import { StateMaster } from '../../../domain/models/MasterData';
import { RestaurantConfigRemoteDataSource } from '../../../data/datasources/RestaurantConfigRemoteDataSource';
import { RestaurantConfigRepositoryImpl } from '../../../data/repositories/RestaurantConfigRepositoryImpl';
import { MasterDataRemoteDataSource } from '../../../data/datasources/MasterDataRemoteDataSource';
import { TableRemoteDataSource } from '../../../data/datasources/TableRemoteDataSource';
import { TableRepositoryImpl } from '../../../data/repositories/TableRepositoryImpl';
import { isCashierOnly, canEditStoreConfig, canConfigureKitchenStations } from '../../../core/auth/rolePermissions';
import { useAuthStore } from '../../state/useAuthStore';
import { useKitchenStationStore } from '../../state/useKitchenStationStore';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';
import { RestaurantQrModal } from '../../components/RestaurantQrModal';
import { RestaurantBankAccountScreen } from './RestaurantBankAccountScreen';
import { WalletEvents } from '../../../core/utils/walletEvents';

const configDataSource = new RestaurantConfigRemoteDataSource();
const configRepository = new RestaurantConfigRepositoryImpl(configDataSource);
const masterDataSource = new MasterDataRemoteDataSource();
const tableRepository = new TableRepositoryImpl(new TableRemoteDataSource());
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RestaurantConfigScreenProps {
  onClose: () => void;
}

export const RestaurantConfigScreen: React.FC<RestaurantConfigScreenProps> = ({ onClose }) => {
  const { activeRestaurant, setActiveRestaurant, user } = useAuthStore();
  const currentRestId =
    activeRestaurant?.restaurantId ||
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
    1;

  const cashierRestricted = isCashierOnly(user, activeRestaurant) || !canEditStoreConfig(user, activeRestaurant);
  const canManageStations = canConfigureKitchenStations(user, activeRestaurant);

  // Form Fields mapped to RestConfigModel & RestaurantConfig
  const [restaurantName, setRestaurantName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateCode, setStateCode] = useState('KA');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // GST & Tax Rates Fields
  const [gstNumber, setGstNumber] = useState('');
  const [sgstPercentage, setSgstPercentage] = useState('2.50');
  const [cgstPercentage, setCgstPercentage] = useState('2.50');

  // Operating Hours & Kitchen Timings
  const [orderingMode, setOrderingMode] = useState<'SCHEDULE' | 'MANUAL'>('SCHEDULE');
  const [openingTime, setOpeningTime] = useState('10:00');
  const [closingTime, setClosingTime] = useState('23:00');
  const [lastOrderBufferMinutes, setLastOrderBufferMinutes] = useState('30');

  // Advance Table Booking & Reservation Policy
  const [isAdvanceBookingEnabled, setIsAdvanceBookingEnabled] = useState(true);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('75');
  const [advanceBookingWindowDays, setAdvanceBookingWindowDays] = useState('14');
  const [requireAdvanceDeposit, setRequireAdvanceDeposit] = useState(false);
  const [depositAmountPerPerson, setDepositAmountPerPerson] = useState('100');

  // Kitchen Mode & Preparation Stations
  const [kitchenMode, setKitchenMode] = useState<'SINGLE_KITCHEN' | 'MULTI_STATION'>('SINGLE_KITCHEN');
  const [isKitchenActive, setIsKitchenActive] = useState<boolean>(true);
  const {
    stations,
    fetchStations,
    createStation,
    updateStation,
    deleteStation,
    toggleStationStatus,
    initializeDefaults,
    actionLoading,
  } = useKitchenStationStore();
  const [stationModalVisible, setStationModalVisible] = useState(false);
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [stationCode, setStationCode] = useState('');
  const [stationName, setStationName] = useState('');
  const [stationIcon, setStationIcon] = useState('utensils');
  const [stationBadgeColor, setStationBadgeColor] = useState('#DE8626');
  const [stationPrinter, setStationPrinter] = useState('');
  const [stationOrder, setStationOrder] = useState('1');
  const [stationIsActive, setStationIsActive] = useState<boolean>(true);

  // States Master for State Selection
  const [availableStates, setAvailableStates] = useState<StateMaster[]>([]);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Accordion Section States
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    branding: false,
    taxes: false,
    contact: false,
    hours: false,
    kitchen: false,
    reservations: false,
    history: false,
  });

  const [operatingHistory, setOperatingHistory] = useState<RestaurantOperatingHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(null);

  const fetchOperatingHistoryAndStatus = useCallback(async () => {
    if (!currentRestId || currentRestId <= 0) return;
    try {
      setLoadingHistory(true);
      const [hist, stat] = await Promise.all([
        configDataSource.getOperatingHistory(currentRestId, 20),
        configDataSource.getOperatingStatus(currentRestId),
      ]);
      setOperatingHistory(hist);
      if (stat) setOperatingStatus(stat);
    } catch {
      // non-blocking
    } finally {
      setLoadingHistory(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    if (expandedSections.history) {
      fetchOperatingHistoryAndStatus();
    }
  }, [expandedSections.history, fetchOperatingHistoryAndStatus]);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleExpandAll = () => {
    setExpandedSections({
      basic: true,
      branding: true,
      taxes: true,
      contact: true,
      hours: true,
      kitchen: true,
      reservations: true,
      history: true,
    });
  };

  const handleCollapseAll = () => {
    setExpandedSections({
      basic: false,
      branding: false,
      taxes: false,
      contact: false,
      hours: false,
      kitchen: false,
      reservations: false,
      history: false,
    });
  };

  const allExpanded = Object.values(expandedSections).every(Boolean);

  // Gilded Alert
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);

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

  const sanitize10DigitPhone = (phoneStr: string): string => {
    if (!phoneStr) return '';
    const digitsOnly = phoneStr.replace(/[^0-9]/g, '');
    return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
  };

  useEffect(() => {
    loadStoreProfileAndStates();
    const unsubscribe = WalletEvents.subscribe(() => {
      configRepository.getConfig(currentRestId).then((data) => {
        if (data && data.walletBalance !== undefined) {
          setWalletBalance(data.walletBalance);
        }
      }).catch(() => {});
    });
    return unsubscribe;
  }, [currentRestId]);

  const loadStoreProfileAndStates = async () => {
    try {
      setLoading(true);

      const [configData, statesData] = await Promise.allSettled([
        configRepository.getConfig(currentRestId),
        masterDataSource.getStates(),
      ]);

      if (statesData.status === 'fulfilled' && statesData.value.length > 0) {
        setAvailableStates(statesData.value);
      } else {
        setAvailableStates([
          { id: 1, stateCode: 'KA', stateDesc: 'Karnataka', stateName: 'Karnataka' },
          { id: 2, stateCode: 'MH', stateDesc: 'Maharashtra', stateName: 'Maharashtra' },
          { id: 3, stateCode: 'DL', stateDesc: 'Delhi', stateName: 'Delhi' },
          { id: 4, stateCode: 'TN', stateDesc: 'Tamil Nadu', stateName: 'Tamil Nadu' },
          { id: 5, stateCode: 'TS', stateDesc: 'Telangana', stateName: 'Telangana' },
          { id: 6, stateCode: 'KL', stateDesc: 'Kerala', stateName: 'Kerala' },
          { id: 7, stateCode: 'GJ', stateDesc: 'Gujarat', stateName: 'Gujarat' },
          { id: 8, stateCode: 'UP', stateDesc: 'Uttar Pradesh', stateName: 'Uttar Pradesh' },
          { id: 9, stateCode: 'WB', stateDesc: 'West Bengal', stateName: 'West Bengal' },
          { id: 10, stateCode: 'AP', stateDesc: 'Andhra Pradesh', stateName: 'Andhra Pradesh' },
        ]);
      }

      if (configData.status === 'fulfilled' && configData.value) {
        const data = configData.value;
        const fetchedName = data.restaurantName || activeRestaurant?.restaurantName || 'Menza Bistro & Grill';
        const fetchedAddress = data.address || (activeRestaurant as any)?.address || '';
        const fetchedCity = data.city || (activeRestaurant as any)?.city || 'Bengaluru';
        const fetchedState = data.state || (activeRestaurant as any)?.state || 'KA';
        const rawPhone = data.contactNumber || (activeRestaurant as any)?.contactNumber || (activeRestaurant as any)?.phone || user?.mobile || '';
        const fetchedEmail = data.email || (activeRestaurant as any)?.email || (user as any)?.email || '';
        const fetchedLogo = data.logoUrl || (activeRestaurant as any)?.logoUrl || (activeRestaurant as any)?.logo || '';
        const fetchedImage = data.imageUrl || (activeRestaurant as any)?.imageUrl || '';
        const fetchedGst = data.gstNumber || (activeRestaurant as any)?.gstNumber || '';

        setRestaurantName(fetchedName);
        setAddress(fetchedAddress);
        setCity(fetchedCity);
        setStateCode(fetchedState);
        setContactNumber(sanitize10DigitPhone(rawPhone));
        setEmail(fetchedEmail);
        setImageUrl(fetchedImage);
        setLogoUrl(fetchedLogo);
        setWalletBalance(data.walletBalance || 0);
        setIsActive(data.isActive ?? true);

        // GST & Tax rates
        setGstNumber(fetchedGst);
        setSgstPercentage(data.sgstPercentage !== undefined ? data.sgstPercentage.toString() : '2.50');
        setCgstPercentage(data.cgstPercentage !== undefined ? data.cgstPercentage.toString() : '2.50');

        // Operating Hours & Kitchen Timings
        setOrderingMode(data.orderingMode === 'MANUAL' ? 'MANUAL' : 'SCHEDULE');
        setOpeningTime(data.openingTime || '10:00');
        setClosingTime(data.closingTime || '23:00');
        setLastOrderBufferMinutes(data.lastOrderBufferMinutes !== undefined ? String(data.lastOrderBufferMinutes) : '30');

        // Kitchen Mode & Stations
        setKitchenMode(data.kitchenMode === 'MULTI_STATION' ? 'MULTI_STATION' : 'SINGLE_KITCHEN');
        setIsKitchenActive(data.isKitchenActive ?? true);
        fetchStations(currentRestId);

        // Advance Table Booking & Reservation Policy
        try {
          const resCfg = await tableRepository.getReservationConfig(currentRestId);
          if (resCfg) {
            setIsAdvanceBookingEnabled(resCfg.isAdvanceBookingEnabled);
            setSlotDurationMinutes(String(resCfg.averageDiningDurationMinutes || 75));
            setAdvanceBookingWindowDays(String(resCfg.advanceBookingWindowDays || 14));
            setRequireAdvanceDeposit(!!resCfg.requireAdvanceDeposit);
            setDepositAmountPerPerson(String(resCfg.depositAmountPerPerson || 100));
          }
        } catch {
          // Graceful fallback
        }
      } else {
        // Fallback prefilled data from active session
        if (activeRestaurant) {
          setRestaurantName(activeRestaurant.restaurantName || 'Menza Bistro');
          setContactNumber(sanitize10DigitPhone(user?.mobile || ''));
          setEmail((user as any)?.email || '');
          setAddress((activeRestaurant as any)?.address || '');
          setCity((activeRestaurant as any)?.city || 'Bengaluru');
          setStateCode((activeRestaurant as any)?.state || 'KA');
        }
      }
    } catch {
      if (activeRestaurant) {
        setRestaurantName(activeRestaurant.restaurantName || 'Menza Bistro');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (type: 'logo' | 'cover') => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers do not have permission to upload restaurant images.', 'warning');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const fileUri = result.assets[0].uri;
        if (type === 'logo') setUploadingLogo(true);
        else setUploadingImage(true);

        const uploadedUrl = await configDataSource.uploadImage(fileUri);
        const finalUrl = uploadedUrl || fileUri;

        if (type === 'logo') setLogoUrl(finalUrl);
        else setImageUrl(finalUrl);
      }
    } catch (err: any) {
      showAlert('Upload Note', 'Selected local image file.', 'info');
    } finally {
      setUploadingLogo(false);
      setUploadingImage(false);
    }
  };

  const buildFullPayload = (overrides: Partial<RestaurantConfig> = {}): Partial<RestaurantConfig> => {
    const cleanedPhone = contactNumber.trim().replace(/[^0-9]/g, '');
    const parsedSgst = parseFloat(sgstPercentage) || 0;
    const parsedCgst = parseFloat(cgstPercentage) || 0;

    return {
      id: currentRestId,
      restaurantName: restaurantName.trim(),
      address: address.trim(),
      city: city.trim(),
      state: stateCode.trim() || 'KA',
      imageUrl: imageUrl.trim(),
      logoUrl: logoUrl.trim(),
      contactNumber: cleanedPhone,
      email: email.trim(),
      gstNumber: gstNumber.trim(),
      sgstPercentage: parsedSgst,
      cgstPercentage: parsedCgst,
      kitchenMode,
      isKitchenActive,
      ...overrides,
    };
  };

  const handleSaveBasicDetails = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }
    if (!restaurantName.trim()) {
      showAlert('Required Field', 'Please enter your Restaurant / Outlet Name.', 'warning');
      return;
    }
    if (!address.trim()) {
      showAlert('Address Required', 'Please enter your Street Address.', 'warning');
      return;
    }
    if (!city.trim()) {
      showAlert('City Required', 'Please enter your City.', 'warning');
      return;
    }

    try {
      setSavingSection('basic');
      const payload = buildFullPayload({
        restaurantName: restaurantName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateCode.trim() || 'KA',
      });
      await configRepository.updateConfig(currentRestId, payload);
      if (activeRestaurant) {
        setActiveRestaurant({
          ...activeRestaurant,
          restaurantName: restaurantName.trim(),
        });
      }
      showAlert('Core Details Saved', 'Store name, street address, and city updated successfully.', 'success');
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update core details.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveBranding = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }
    try {
      setSavingSection('branding');
      const payload = buildFullPayload({
        logoUrl: logoUrl.trim(),
        imageUrl: imageUrl.trim(),
      });
      await configRepository.updateConfig(currentRestId, payload);
      if (activeRestaurant) {
        setActiveRestaurant({
          ...activeRestaurant,
          logoUrl: logoUrl.trim(),
          imageUrl: imageUrl.trim(),
        });
      }
      showAlert('Branding Saved', 'Restaurant logo and hero banner updated successfully.', 'success');
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update branding.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveTaxes = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }
    const parsedSgst = parseFloat(sgstPercentage) || 0;
    const parsedCgst = parseFloat(cgstPercentage) || 0;
    if (parsedSgst < 0 || parsedSgst > 50 || parsedCgst < 0 || parsedCgst > 50) {
      showAlert('Invalid Tax Rate', 'SGST and CGST percentages must be between 0% and 50%.', 'warning');
      return;
    }
    try {
      setSavingSection('taxes');
      const payload = buildFullPayload({
        gstNumber: gstNumber.trim(),
        sgstPercentage: parsedSgst,
        cgstPercentage: parsedCgst,
      });
      await configRepository.updateConfig(currentRestId, payload);
      showAlert(
        'Tax Rates Saved',
        `GSTIN and tax rates (${(parsedSgst + parsedCgst).toFixed(2)}% total) updated successfully.`,
        'success'
      );
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update tax settings.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveContact = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }
    const cleanedPhone = contactNumber.trim().replace(/[^0-9]/g, '');
    if (cleanedPhone.length > 0 && cleanedPhone.length !== 10) {
      showAlert('Invalid Mobile Number', 'Official contact number must be exactly 10 digits.', 'warning');
      return;
    }
    try {
      setSavingSection('contact');
      const payload = buildFullPayload({
        contactNumber: cleanedPhone,
        email: email.trim(),
      });
      await configRepository.updateConfig(currentRestId, payload);
      showAlert('Contact Details Saved', 'Official contact phone and email address updated successfully.', 'success');
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update contact details.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveOperatingHours = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }
    try {
      setSavingSection('hours');
      const buffer = parseInt(lastOrderBufferMinutes, 10) || 30;
      await configDataSource.updateOperatingHours(currentRestId, {
        orderingMode,
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
        lastOrderBufferMinutes: buffer,
      });

      const payload = buildFullPayload({
        orderingMode,
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
        lastOrderBufferMinutes: buffer,
      });
      await configRepository.updateConfig(currentRestId, payload);

      showAlert(
        'Operating Hours Saved',
        `Store hours set to ${openingTime.trim()} - ${closingTime.trim()} (${orderingMode === 'SCHEDULE' ? 'Auto Schedule' : 'Manual Mode'}).`,
        'success'
      );
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update operating hours.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveKitchenConfig = async () => {
    if (!canManageStations) {
      showAlert('Permission Denied', 'You do not have permission to modify kitchen configuration.', 'danger');
      return;
    }
    try {
      setSavingSection('kitchen');
      const payload = buildFullPayload({
        kitchenMode,
        isKitchenActive,
      });
      await configRepository.updateConfig(currentRestId, payload);

      try {
        await configDataSource.toggleOrdering(currentRestId, {
          isKitchenActive,
          mode: orderingMode,
        });
      } catch {
        // Graceful non-blocking
      }

      showAlert(
        'Kitchen Settings Saved',
        `Kitchen mode set to ${kitchenMode === 'MULTI_STATION' ? 'Multi-Station' : 'Single Kitchen'}. Live kitchen progress tracking is ${isKitchenActive ? 'Active' : 'Deactivated'}.`,
        'success'
      );
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update kitchen settings.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveReservationConfig = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }
    try {
      setSavingSection('reservations');
      await tableRepository.updateReservationConfig(currentRestId, {
        isAdvanceBookingEnabled,
        averageDiningDurationMinutes: parseInt(slotDurationMinutes, 10) || 75,
        advanceBookingWindowDays: parseInt(advanceBookingWindowDays, 10) || 14,
        requireAdvanceDeposit,
        depositAmountPerPerson: parseInt(depositAmountPerPerson, 10) || 100,
      });

      showAlert(
        'Reservation Policy Saved',
        isAdvanceBookingEnabled
          ? `Advance bookings enabled (${slotDurationMinutes}m dining duration, ${advanceBookingWindowDays} days window).`
          : 'Advance table reservations disabled.',
        'success'
      );
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update reservation policy.', 'danger');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveProfile = async () => {
    if (cashierRestricted) {
      showAlert('Permission Denied', 'Cashiers are not permitted to modify store configuration.', 'danger');
      return;
    }

    if (!restaurantName.trim()) {
      showAlert('Required Field', 'Please enter your Restaurant / Outlet Name.', 'warning');
      return;
    }

    if (!address.trim()) {
      showAlert('Address Required', 'Please enter your Street Address.', 'warning');
      return;
    }

    if (!city.trim()) {
      showAlert('City Required', 'Please enter your City.', 'warning');
      return;
    }

    const cleanedPhone = contactNumber.trim().replace(/[^0-9]/g, '');
    if (cleanedPhone.length > 0 && cleanedPhone.length !== 10) {
      showAlert('Invalid Mobile Number', 'Official contact number must be exactly 10 digits.', 'warning');
      return;
    }

    const parsedSgst = parseFloat(sgstPercentage) || 0;
    const parsedCgst = parseFloat(cgstPercentage) || 0;

    if (parsedSgst < 0 || parsedSgst > 50 || parsedCgst < 0 || parsedCgst > 50) {
      showAlert('Invalid Tax Rate', 'SGST and CGST percentages must be between 0% and 50%.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const updatePayload = buildFullPayload({
        restaurantName: restaurantName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateCode.trim() || 'KA',
        imageUrl: imageUrl.trim(),
        logoUrl: logoUrl.trim(),
        contactNumber: cleanedPhone,
        email: email.trim(),
        gstNumber: gstNumber.trim(),
        sgstPercentage: parsedSgst,
        cgstPercentage: parsedCgst,
        kitchenMode,
        isKitchenActive,
      });

      const success = await configRepository.updateConfig(currentRestId, updatePayload);

      // Save operating hours & order window timing
      try {
        await configDataSource.updateOperatingHours(currentRestId, {
          orderingMode,
          openingTime: openingTime.trim(),
          closingTime: closingTime.trim(),
          lastOrderBufferMinutes: parseInt(lastOrderBufferMinutes, 10) || 30,
        });
      } catch (hoursErr) {
        console.warn('Failed to update operating hours:', hoursErr);
      }

      // Save reservation policy settings
      try {
        await tableRepository.updateReservationConfig(currentRestId, {
          isAdvanceBookingEnabled,
          averageDiningDurationMinutes: parseInt(slotDurationMinutes, 10) || 75,
          advanceBookingWindowDays: parseInt(advanceBookingWindowDays, 10) || 14,
          requireAdvanceDeposit,
          depositAmountPerPerson: parseInt(depositAmountPerPerson, 10) || 100,
        });
      } catch (resErr) {
        console.warn('Failed to update reservation config:', resErr);
      }

      // Optimistically update active restaurant in auth store
      if (activeRestaurant) {
        setActiveRestaurant({
          ...activeRestaurant,
          restaurantName: restaurantName.trim(),
          logoUrl: logoUrl.trim(),
          imageUrl: imageUrl.trim(),
        });
      }

      if (success) {
        showAlert(
          'All Settings Saved',
          'Complete store profile, tax configuration, operating hours, and kitchen settings saved successfully.',
          'success'
        );
      } else {
        showAlert(
          'Profile Saved',
          'Store profile updated on device.',
          'success'
        );
      }
    } catch (err: any) {
      showAlert('Update Failed', err?.message || 'Could not update store profile.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddStation = () => {
    setEditingStationId(null);
    setStationCode('');
    setStationName('');
    setStationIcon('utensils');
    setStationBadgeColor('#DE8626');
    setStationPrinter('');
    setStationOrder(String(stations.length + 1));
    setStationIsActive(true);
    setStationModalVisible(true);
  };

  const handleOpenEditStation = (st: any) => {
    setEditingStationId(st.id);
    setStationCode(st.stationCode);
    setStationName(st.stationName);
    setStationIcon(st.iconName || 'utensils');
    setStationBadgeColor(st.badgeColor || '#DE8626');
    setStationPrinter(st.assignedPrinterMacOrIp || '');
    setStationOrder(String(st.displayOrder || 1));
    setStationIsActive(st.isActive !== false);
    setStationModalVisible(true);
  };

  const handleToggleStationActive = async (st: any) => {
    if (!canManageStations) {
      showAlert('Permission Denied', 'You do not have permission to modify kitchen station status.', 'danger');
      return;
    }
    try {
      await toggleStationStatus(st.id, { isActive: !st.isActive, pauseMinutes: 0 });
      showAlert(
        st.isActive ? 'Station Deactivated' : 'Station Activated',
        `Kitchen station "${st.stationName}" is now ${st.isActive ? 'Inactive (Offline)' : 'Active (Online)'}.`,
        'success'
      );
    } catch (err: any) {
      showAlert('Toggle Failed', err?.message || 'Could not update station status.', 'danger');
    }
  };

  const handleSaveStation = async () => {
    if (!stationCode.trim() || !stationName.trim()) {
      showAlert('Required Fields', 'Station Code and Station Name are required.', 'warning');
      return;
    }
    try {
      if (editingStationId) {
        await updateStation(editingStationId, {
          stationCode: stationCode.trim().toUpperCase(),
          stationName: stationName.trim(),
          iconName: stationIcon,
          badgeColor: stationBadgeColor,
          assignedPrinterMacOrIp: stationPrinter.trim(),
          displayOrder: parseInt(stationOrder, 10) || 1,
        });
        const currentSt = stations.find((s) => s.id === editingStationId);
        if (currentSt && currentSt.isActive !== stationIsActive) {
          await toggleStationStatus(editingStationId, {
            isActive: stationIsActive,
            pauseMinutes: 0,
          });
        }
        showAlert('Station Updated', `Kitchen station "${stationName.trim()}" updated successfully.`, 'success');
      } else {
        const created = await createStation({
          restaurantId: currentRestId,
          stationCode: stationCode.trim().toUpperCase(),
          stationName: stationName.trim(),
          iconName: stationIcon,
          badgeColor: stationBadgeColor,
          assignedPrinterMacOrIp: stationPrinter.trim(),
          displayOrder: parseInt(stationOrder, 10) || (stations.length + 1),
        });
        if (created && !stationIsActive) {
          await toggleStationStatus(created.id, {
            isActive: false,
            pauseMinutes: 0,
          });
        }
        showAlert('Station Created', `Kitchen station "${stationName.trim()}" added successfully.`, 'success');
      }
      setStationModalVisible(false);
    } catch (err: any) {
      showAlert('Save Failed', err?.message || 'Could not save kitchen station.', 'danger');
    }
  };

  const handleDeleteStation = (st: any) => {
    showAlert(
      'Delete Kitchen Station?',
      `Are you sure you want to remove "${st.stationName}" (${st.stationCode})? Dishes assigned to it will fallback to Main Kitchen.`,
      'danger',
      async () => {
        try {
          const success = await deleteStation(st.id);
          if (success) {
            showAlert('Station Deleted', `Kitchen station "${st.stationName}" removed.`, 'success');
          }
        } catch (err: any) {
          showAlert('Delete Failed', err?.message || 'Could not delete station.', 'danger');
        }
      }
    );
  };

  const handleInitializeDefaultStations = async () => {
    try {
      await initializeDefaults(currentRestId);
      showAlert('Stations Initialized', 'Standard 7 Kitchen Stations have been configured for your restaurant.', 'success');
    } catch (err: any) {
      showAlert('Initialization Failed', err?.message || 'Could not initialize default stations.', 'danger');
    }
  };

  const selectedStateObj = availableStates.find(
    (s) => s.stateCode.toUpperCase() === stateCode.toUpperCase()
  );

  const numSgst = parseFloat(sgstPercentage) || 0;
  const numCgst = parseFloat(cgstPercentage) || 0;
  const totalGst = (numSgst + numCgst).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* 1. TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Image
            source={
              logoUrl && logoUrl.trim().length > 0
                ? { uri: logoUrl.trim() }
                : activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                ? { uri: activeRestaurant.logoUrl.trim() }
                : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                ? { uri: (activeRestaurant as any).logo.trim() }
                : require('../../../../assets/menza-logo.png')
            }
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerOutletTitle} numberOfLines={1}>
                {restaurantName || activeRestaurant?.restaurantName || 'Menza Bistro'}
              </Text>
              {cashierRestricted && (
                <View style={styles.headerViewOnlyBadge}>
                  <Lock size={10} color="#DE8626" />
                  <Text style={styles.headerViewOnlyBadgeText}>VIEW ONLY</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
              {cashierRestricted ? 'Store Profile • Read-Only Configuration' : 'Store Profile • Config & Taxes'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.headerQrBtn}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.8}
          >
            <QrCode size={13} color="#D96B14" />
            <Text style={styles.headerQrBtnText}>Store QR</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn} activeOpacity={0.7}>
            <X size={16} color="#8C7A6B" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DE8626" />
          <Text style={styles.loadingText}>Loading store profile from server...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. STORE STATUS & TELEMETRY BANNER */}
          <LinearGradient
            colors={['#FFFFFF', '#FAF7F2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.telemetryCard}
          >
            <View style={styles.telemetryRow}>
              <View style={styles.telemetryLeft}>
                <View style={styles.outletIdBadge}>
                  <Text style={styles.outletIdText}>OUTLET #{currentRestId}</Text>
                </View>
                <Text style={styles.telemetryStoreName} numberOfLines={1}>
                  {restaurantName || activeRestaurant?.restaurantName || 'Menza Bistro'}
                </Text>
                <View style={styles.locationPill}>
                  <MapPin size={10} color="#DE8626" />
                  <Text style={styles.locationText}>
                    {city || 'Bengaluru'}, {stateCode || 'KA'}
                  </Text>
                </View>
              </View>

              <View style={styles.telemetryRight}>
                {/* Status Indicator */}
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isActive
                        ? '#E4F5EC'
                        : '#FEE2E2',
                      borderColor: isActive
                        ? 'rgba(23, 132, 90, 0.3)'
                        : 'rgba(220, 38, 38, 0.3)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isActive ? '#17845A' : '#DC2626' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isActive ? '#17845A' : '#DC2626' },
                    ]}
                  >
                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>

                {/* Prepaid Wallet */}
                <View style={styles.walletBox}>
                  <Wallet size={11} color="#DE8626" />
                  <Text style={styles.walletText}>₹{walletBalance.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* STORE QR CODE & MARKETING CARD */}
          <View style={styles.qrMarketingCard}>
            <View style={styles.qrMarketingTopRow}>
              <View style={styles.qrMarketingIconCircle}>
                <QrCode size={18} color="#D96B14" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrMarketingCardTitle}>Storefront & Table QR Ordering</Text>
                <Text style={styles.qrMarketingCardDesc}>
                  Share contactless QR ordering link with custom tagline or export printable standee
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.qrMarketingActionBtn}
              onPress={() => setQrModalVisible(true)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.qrMarketingActionGradient}
              >
                <Share2 size={14} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.qrMarketingActionText}>GENERATE QR & SHARE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* QR SETTLEMENT BANK ACCOUNT CARD */}
          <View style={styles.bankSettlementCard}>
            <View style={styles.bankSettlementTopRow}>
              <View style={styles.bankSettlementIconCircle}>
                <CreditCard size={18} color="#17845A" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.bankSettlementCardTitle}>QR Settlement Bank Account</Text>
                  <View style={styles.bankSettlementActiveBadge}>
                    <Text style={styles.bankSettlementActiveText}>100% DIRECT</Text>
                  </View>
                </View>
                <Text style={styles.bankSettlementCardDesc}>
                  Link owner bank account to receive 100% direct payouts for customer QR orders via Cashfree Easy Split
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.bankSettlementActionBtn}
              onPress={() => setBankModalVisible(true)}
              activeOpacity={0.88}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CreditCard size={14} color="#17845A" strokeWidth={2.4} />
                <Text style={styles.bankSettlementActionText}>MANAGE SETTLEMENT ACCOUNT</Text>
              </View>
              <ChevronRight size={14} color="#17845A" />
            </TouchableOpacity>
          </View>

          {/* CASHIER READ-ONLY NOTICE BANNER */}
          {cashierRestricted && (
            <View style={styles.permissionBanner}>
              <View style={styles.permissionIconBadge}>
                <Lock size={16} color="#DE8626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionBannerTitle}>Cashier Access (View-Only Mode)</Text>
                <Text style={styles.permissionBannerDesc}>
                  You do not have permission to edit store profile, taxes, or GST configurations. Changes can only be made by Store Owners and Admins.
                </Text>
              </View>
            </View>
          )}

          {/* PROFILE MODULES ACCORDION CONTROLS */}
          <View style={styles.sectionControlsRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Layers size={14} color="#78716C" />
              <Text style={styles.sectionControlsTitle}>STORE PROFILE MODULES</Text>
            </View>
            <TouchableOpacity
              style={styles.expandCollapseBtn}
              onPress={allExpanded ? handleCollapseAll : handleExpandAll}
              activeOpacity={0.7}
            >
              <Text style={styles.expandCollapseText}>
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1. CORE STORE DETAILS ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.basic && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('basic')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.basic && styles.accordionIconCircleOpen]}>
                  <Building2 size={16} color={expandedSections.basic ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>CORE STORE DETAILS</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {restaurantName || 'Outlet Name'} • {city || 'City'}, {stateCode || 'KA'}
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.basic && styles.accordionChevronBadgeOpen]}>
                {expandedSections.basic ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.basic && (
              <View style={styles.accordionBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>RESTAURANT / OUTLET NAME *</Text>
                  <TextInput
                    style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                    value={restaurantName}
                    onChangeText={setRestaurantName}
                    placeholder="e.g. Royal Spice Bistro & Bar"
                    placeholderTextColor="#9CA3AF"
                    editable={!cashierRestricted}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>STREET ADDRESS *</Text>
                  <TextInput
                    style={[styles.textInput, { height: 60, textAlignVertical: 'top', paddingTop: 8 }, cashierRestricted && styles.inputDisabled]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. #108 Commercial Street, 1st Cross, Indiranagar"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    editable={!cashierRestricted}
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.fieldLabel}>CITY *</Text>
                    <TextInput
                      style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. Bengaluru"
                      placeholderTextColor="#9CA3AF"
                      editable={!cashierRestricted}
                    />
                  </View>

                  {/* State Picker Button */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>STATE *</Text>
                    <TouchableOpacity
                      style={[styles.stateSelectBtn, cashierRestricted && styles.inputDisabled]}
                      onPress={() => !cashierRestricted && setStateModalVisible(true)}
                      disabled={cashierRestricted}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.stateSelectText} numberOfLines={1}>
                        {selectedStateObj ? `${selectedStateObj.stateCode} - ${selectedStateObj.stateDesc}` : stateCode}
                      </Text>
                      {!cashierRestricted && <ChevronDown size={14} color="#DE8626" />}
                    </TouchableOpacity>
                  </View>
                </View>

                {!cashierRestricted && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveBasicDetails}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'basic' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Core Details</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 2. STORE BRANDING & VISUALS ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.branding && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('branding')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.branding && styles.accordionIconCircleOpen]}>
                  <ImageIcon size={16} color={expandedSections.branding ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>STORE BRANDING & VISUALS</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {logoUrl ? 'Logo Uploaded' : 'No Logo'} • {imageUrl ? 'Banner Uploaded' : 'No Banner'}
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.branding && styles.accordionChevronBadgeOpen]}>
                {expandedSections.branding ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.branding && (
              <View style={styles.accordionBody}>
                <View style={styles.brandingRow}>
                  {/* Logo Box */}
                  <View style={styles.logoCol}>
                    <Text style={styles.inputSubLabel}>STORE LOGO</Text>
                    <TouchableOpacity
                      style={[styles.logoPickerBtn, cashierRestricted && { opacity: 0.8 }]}
                      onPress={() => !cashierRestricted && handlePickImage('logo')}
                      disabled={cashierRestricted}
                      activeOpacity={0.8}
                    >
                      {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.logoImg} />
                      ) : (
                        <View style={styles.logoPlaceholder}>
                          <Store size={26} color="#9CA3AF" />
                        </View>
                      )}
                      {!cashierRestricted && (
                        <View style={styles.cameraIconBadge}>
                          <Camera size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                    {uploadingLogo && <ActivityIndicator size="small" color="#DE8626" style={{ marginTop: 4 }} />}
                  </View>

                  {/* Cover Banner Box */}
                  <View style={styles.coverCol}>
                    <Text style={styles.inputSubLabel}>STORE COVER / HERO BANNER</Text>
                    <TouchableOpacity
                      style={[styles.coverPickerBtn, cashierRestricted && { opacity: 0.8 }]}
                      onPress={() => !cashierRestricted && handlePickImage('cover')}
                      disabled={cashierRestricted}
                      activeOpacity={0.8}
                    >
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.coverImg} />
                      ) : (
                        <View style={styles.coverPlaceholder}>
                          <Camera size={20} color="#9CA3AF" />
                          <Text style={styles.coverPlaceholderText}>
                            {cashierRestricted ? 'No Cover Banner' : 'Tap to Upload Banner'}
                          </Text>
                        </View>
                      )}
                      {!cashierRestricted && (
                        <View style={styles.cameraIconBadge}>
                          <Camera size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                    {uploadingImage && <ActivityIndicator size="small" color="#DE8626" style={{ marginTop: 4 }} />}
                  </View>
                </View>

                {!cashierRestricted && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveBranding}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'branding' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Branding & Visuals</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 3. GST NUMBER, SGST, CGST ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.taxes && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('taxes')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.taxes && styles.accordionIconCircleOpen]}>
                  <Receipt size={16} color={expandedSections.taxes ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>GST NUMBER & TAX RATES</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {gstNumber ? gstNumber : 'No GSTIN'} • {totalGst}% GST ({sgstPercentage}% + {cgstPercentage}%)
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.taxes && styles.accordionChevronBadgeOpen]}>
                {expandedSections.taxes ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.taxes && (
              <View style={styles.accordionBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>GST NUMBER (GSTIN)</Text>
                  <TextInput
                    style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                    value={gstNumber}
                    onChangeText={setGstNumber}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={15}
                    editable={!cashierRestricted}
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>SGST RATE (%) *</Text>
                    <TextInput
                      style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                      value={sgstPercentage}
                      onChangeText={setSgstPercentage}
                      placeholder="2.50"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      editable={!cashierRestricted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CGST RATE (%) *</Text>
                    <TextInput
                      style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                      value={cgstPercentage}
                      onChangeText={setCgstPercentage}
                      placeholder="2.50"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      editable={!cashierRestricted}
                    />
                  </View>
                </View>

                {/* Total GST Summary Card */}
                <View style={styles.gstSummaryPill}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Percent size={13} color="#17845A" />
                    <Text style={styles.gstSummaryTitle}>Total Applied GST Rate:</Text>
                  </View>
                  <Text style={styles.gstSummaryValue}>{totalGst}%</Text>
                  <Text style={styles.gstSummarySub}>(SGST {numSgst.toFixed(2)}% + CGST {numCgst.toFixed(2)}%)</Text>
                </View>

                {!cashierRestricted && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveTaxes}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'taxes' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Tax Rates</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 4. CONTACT & COMMUNICATION ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.contact && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('contact')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.contact && styles.accordionIconCircleOpen]}>
                  <Phone size={16} color={expandedSections.contact ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>CONTACT & COMMUNICATION</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {contactNumber ? `+91 ${contactNumber}` : 'No Mobile'} • {email || 'No Email'}
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.contact && styles.accordionChevronBadgeOpen]}>
                {expandedSections.contact ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.contact && (
              <View style={styles.accordionBody}>
                <View style={styles.fieldGroup}>
                  <View style={styles.labelWithCounterRow}>
                    <Text style={styles.fieldLabel}>OFFICIAL CONTACT NUMBER (10 DIGITS)</Text>
                    <Text
                      style={[
                        styles.digitCounter,
                        contactNumber.length === 10
                          ? { color: '#17845A', fontWeight: '800' }
                          : { color: '#7C6F62' },
                      ]}
                    >
                      {contactNumber.length}/10
                    </Text>
                  </View>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.phoneTextInput, cashierRestricted && styles.inputDisabled]}
                      value={contactNumber}
                      onChangeText={(txt) => setContactNumber(txt.replace(/[^0-9]/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={10}
                      editable={!cashierRestricted}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>OFFICIAL EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="e.g. contact@royalspice.in"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!cashierRestricted}
                  />
                </View>

                {!cashierRestricted && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveContact}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'contact' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Contact Details</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 5. STORE OPERATING HOURS & KITCHEN TIMINGS ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.hours && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('hours')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.hours && styles.accordionIconCircleOpen]}>
                  <Clock size={16} color={expandedSections.hours ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>OPERATING HOURS & TIMINGS</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {orderingMode === 'SCHEDULE' ? 'Auto Schedule' : 'Manual'} • {openingTime} - {closingTime} (Buffer: {lastOrderBufferMinutes}m)
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.hours && styles.accordionChevronBadgeOpen]}>
                {expandedSections.hours ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.hours && (
              <View style={styles.accordionBody}>
                {/* Mode Selector */}
                <Text style={styles.fieldLabel}>ORDERING CONTROL MODE</Text>
                <View style={styles.timingModeRow}>
                  <TouchableOpacity
                    style={[
                      styles.timingModeCard,
                      orderingMode === 'SCHEDULE' && styles.timingModeCardActive,
                    ]}
                    onPress={() => !cashierRestricted && setOrderingMode('SCHEDULE')}
                    disabled={cashierRestricted}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} color={orderingMode === 'SCHEDULE' ? '#DE8626' : '#78716C'} />
                      <Text style={[styles.timingModeTitle, orderingMode === 'SCHEDULE' && styles.timingModeTitleActive]}>
                        Auto Schedule
                      </Text>
                    </View>
                    <Text style={styles.timingModeDesc}>
                      Opens & closes QR ordering automatically by set hours.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.timingModeCard,
                      orderingMode === 'MANUAL' && styles.timingModeCardActive,
                    ]}
                    onPress={() => !cashierRestricted && setOrderingMode('MANUAL')}
                    disabled={cashierRestricted}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Zap size={14} color={orderingMode === 'MANUAL' ? '#DE8626' : '#78716C'} />
                      <Text style={[styles.timingModeTitle, orderingMode === 'MANUAL' && styles.timingModeTitleActive]}>
                        Manual Control
                      </Text>
                    </View>
                    <Text style={styles.timingModeDesc}>
                      Staff manually toggles accepting orders from Dashboard.
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Hours Row */}
                <View style={styles.hoursInputsRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>OPENING TIME (24H)</Text>
                    <TextInput
                      style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                      value={openingTime}
                      onChangeText={setOpeningTime}
                      placeholder="10:00"
                      placeholderTextColor="#9CA3AF"
                      editable={!cashierRestricted}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>CLOSING TIME (24H)</Text>
                    <TextInput
                      style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                      value={closingTime}
                      onChangeText={setClosingTime}
                      placeholder="23:00"
                      placeholderTextColor="#9CA3AF"
                      editable={!cashierRestricted}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>KITCHEN LAST ORDER BUFFER (MINUTES BEFORE CLOSING)</Text>
                  <TextInput
                    style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                    value={lastOrderBufferMinutes}
                    onChangeText={(t) => setLastOrderBufferMinutes(t.replace(/[^0-9]/g, ''))}
                    placeholder="30"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    editable={!cashierRestricted}
                  />
                  <Text style={styles.timingHintText}>
                    Example: If store closes at 23:00 with a 30 min buffer, last order cutoff is 22:30.
                  </Text>
                </View>

                {!cashierRestricted && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveOperatingHours}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'hours' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Operating Hours</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 6. KITCHEN ARCHITECTURE & PREPARATION STATIONS ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.kitchen && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('kitchen')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.kitchen && styles.accordionIconCircleOpen]}>
                  <Utensils size={16} color={expandedSections.kitchen ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>KITCHEN ARCHITECTURE & LIVE TRACKING</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {kitchenMode === 'MULTI_STATION' ? `Multi-Station (${stations.length})` : 'Single Kitchen'} • {isKitchenActive ? '🟢 Live Tracking ON' : '⚪ Tracking OFF'}
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.kitchen && styles.accordionChevronBadgeOpen]}>
                {expandedSections.kitchen ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.kitchen && (
              <View style={styles.accordionBody}>
                {/* Kitchen Mode Selector */}
                <Text style={styles.fieldLabel}>KITCHEN OPERATING MODE</Text>
                <View style={styles.timingModeRow}>
                  <TouchableOpacity
                    style={[
                      styles.timingModeCard,
                      kitchenMode === 'SINGLE_KITCHEN' && styles.timingModeCardActive,
                    ]}
                    onPress={() => canManageStations && setKitchenMode('SINGLE_KITCHEN')}
                    disabled={!canManageStations}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Utensils size={14} color={kitchenMode === 'SINGLE_KITCHEN' ? '#DE8626' : '#78716C'} />
                      <Text style={[styles.timingModeTitle, kitchenMode === 'SINGLE_KITCHEN' && styles.timingModeTitleActive]}>
                        Single Kitchen
                      </Text>
                    </View>
                    <Text style={styles.timingModeDesc}>
                      Single KDS / central kitchen. Best for cafes, bistros & single-prep outlets.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.timingModeCard,
                      kitchenMode === 'MULTI_STATION' && styles.timingModeCardActive,
                    ]}
                    onPress={() => canManageStations && setKitchenMode('MULTI_STATION')}
                    disabled={!canManageStations}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Layers size={14} color={kitchenMode === 'MULTI_STATION' ? '#DE8626' : '#78716C'} />
                      <Text style={[styles.timingModeTitle, kitchenMode === 'MULTI_STATION' && styles.timingModeTitleActive]}>
                        Multi-Station
                      </Text>
                    </View>
                    <Text style={styles.timingModeDesc}>
                      Routes orders to specialized stations (Bar, Grill, Chinese, Bakery, etc.).
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Multi-Station Management Panel */}
                {kitchenMode === 'MULTI_STATION' && (
                  <View style={styles.stationManagementContainer}>
                    <View style={styles.stationSectionHeader}>
                      <Text style={styles.stationSectionTitle}>
                        CONFIGURED PREP STATIONS ({stations.length})
                      </Text>
                      {canManageStations && (
                        <TouchableOpacity
                          style={styles.addStationHeaderBtn}
                          onPress={handleOpenAddStation}
                          activeOpacity={0.8}
                        >
                          <Plus size={13} color="#DE8626" />
                          <Text style={styles.addStationHeaderBtnText}>Add Station</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {stations.length === 0 ? (
                      <View style={styles.emptyStationsCard}>
                        <Utensils size={24} color="#D97706" />
                        <Text style={styles.emptyStationsTitle}>No Stations Configured Yet</Text>
                        <Text style={styles.emptyStationsDesc}>
                          Set up multiple preparation lines for independent KDS displays and split KOT printing.
                        </Text>
                        {canManageStations && (
                          <TouchableOpacity
                            style={styles.initDefaultsBtn}
                            onPress={handleInitializeDefaultStations}
                            activeOpacity={0.8}
                            disabled={actionLoading === 'init_defaults'}
                          >
                            {actionLoading === 'init_defaults' ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Sparkles size={13} color="#FFFFFF" />
                                <Text style={styles.initDefaultsBtnText}>Initialize Standard 7 Stations</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View style={styles.stationList}>
                        {stations.map((st) => {
                          const isPaused = st.isPaused && st.remainingPauseMinutes > 0;
                          const statusColor = !st.isActive ? '#DC2626' : isPaused ? '#D97706' : '#16A34A';
                          const statusBg = !st.isActive ? '#FEE2E2' : isPaused ? '#FEF3C7' : '#DCFCE7';
                          const statusLabel = !st.isActive ? 'INACTIVE' : isPaused ? `PAUSED (${st.remainingPauseMinutes}m)` : 'ACTIVE';

                          return (
                            <View key={st.id} style={styles.stationItemCard}>
                              <View style={[styles.stationColorBar, { backgroundColor: st.badgeColor || '#DE8626' }]} />
                              <View style={styles.stationItemBody}>
                                <View style={styles.stationItemTop}>
                                  <View style={styles.stationItemNameRow}>
                                    <Text style={styles.stationItemName}>{st.stationName}</Text>
                                    <View style={[styles.stationCodeBadge, { borderColor: st.badgeColor || '#DE8626' }]}>
                                      <Text style={[styles.stationCodeText, { color: st.badgeColor || '#DE8626' }]}>
                                        {st.stationCode}
                                      </Text>
                                    </View>
                                  </View>
                                  <View style={[styles.stationStatusPill, { backgroundColor: statusBg }]}>
                                    <Text style={[styles.stationStatusText, { color: statusColor }]}>{statusLabel}</Text>
                                  </View>
                                </View>

                                <View style={styles.stationItemBottom}>
                                  <Text style={styles.stationPrinterText}>
                                    {st.assignedPrinterMacOrIp ? `Printer: ${st.assignedPrinterMacOrIp}` : 'Display: Default KDS'}
                                  </Text>

                                  {canManageStations && (
                                    <View style={styles.stationActionsRow}>
                                      <TouchableOpacity
                                        style={[
                                          styles.stationActionToggleBtn,
                                          st.isActive ? styles.stationActionToggleBtnActive : styles.stationActionToggleBtnInactive,
                                        ]}
                                        onPress={() => handleToggleStationActive(st)}
                                        activeOpacity={0.7}
                                        disabled={actionLoading === `toggle_${st.id}`}
                                      >
                                        {actionLoading === `toggle_${st.id}` ? (
                                          <ActivityIndicator size="small" color={st.isActive ? '#16A34A' : '#DC2626'} />
                                        ) : (
                                          <>
                                            <Power size={11} color={st.isActive ? '#16A34A' : '#DC2626'} strokeWidth={2.4} />
                                            <Text style={[styles.stationActionToggleBtnText, { color: st.isActive ? '#16A34A' : '#DC2626' }]}>
                                              {st.isActive ? 'Deactivate' : 'Activate'}
                                            </Text>
                                          </>
                                        )}
                                      </TouchableOpacity>

                                      <TouchableOpacity
                                        style={styles.stationActionIconBtn}
                                        onPress={() => handleOpenEditStation(st)}
                                        activeOpacity={0.7}
                                      >
                                        <Edit3 size={13} color="#4B5563" />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.stationActionIconBtn, { backgroundColor: '#FEE2E2' }]}
                                        onPress={() => handleDeleteStation(st)}
                                        activeOpacity={0.7}
                                      >
                                        <Trash2 size={13} color="#DC2626" />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}

                        {canManageStations && (
                          <View style={styles.stationBottomBtnsRow}>
                            <TouchableOpacity
                              style={styles.addStationBottomBtn}
                              onPress={handleOpenAddStation}
                              activeOpacity={0.8}
                            >
                              <Plus size={13} color="#DE8626" />
                              <Text style={styles.addStationBottomBtnText}>Add Station</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.reseedDefaultsBtn}
                              onPress={handleInitializeDefaultStations}
                              activeOpacity={0.8}
                            >
                              <Sparkles size={13} color="#78716C" />
                              <Text style={styles.reseedDefaultsBtnText}>Reset to 7 Defaults</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Kitchen Live Status Switch (Customer Tracking) */}
                <View style={[styles.switchRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0EAE1' }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ChefHat size={14} color="#DE8626" />
                      <Text style={styles.switchTitle}>Kitchen Live Status & Tracking</Text>
                      <View
                        style={[
                          styles.kitchenStatusMiniBadge,
                          {
                            backgroundColor: isKitchenActive ? '#DCFCE7' : '#F3F4F6',
                            borderColor: isKitchenActive ? 'rgba(22, 163, 74, 0.3)' : 'rgba(107, 114, 128, 0.3)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kitchenStatusMiniBadgeText,
                            { color: isKitchenActive ? '#16A34A' : '#6B7280' },
                          ]}
                        >
                          {isKitchenActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.switchDesc}>
                      {isKitchenActive
                        ? 'Customer tracking displays 5-stage KDS progress (Pending → Confirmed → Preparing → Ready → Served), decreasing countdown clock, and chef messages.'
                        : 'Deactivated: Ticking timers, chef flame alerts, and prep time badges are hidden from customers. A simplified confirmation and order status is displayed.'}
                    </Text>
                  </View>
                  <Switch
                    value={isKitchenActive}
                    onValueChange={(val: boolean) => {
                      if (canManageStations) setIsKitchenActive(val);
                    }}
                    disabled={!canManageStations}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={isKitchenActive ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                {canManageStations && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveKitchenConfig}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'kitchen' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Kitchen Settings</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 7. ADVANCE TABLE BOOKING & RESERVATION POLICY ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.reservations && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('reservations')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.reservations && styles.accordionIconCircleOpen]}>
                  <TableIcon size={16} color={expandedSections.reservations ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>ADVANCE TABLE BOOKING & RESERVATIONS</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {isAdvanceBookingEnabled ? `Enabled (${slotDurationMinutes}m dining, ${advanceBookingWindowDays}d window)` : 'Disabled'}
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.reservations && styles.accordionChevronBadgeOpen]}>
                {expandedSections.reservations ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.reservations && (
              <View style={styles.accordionBody}>
                {/* Enable Toggle */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Enable Advance Table Reservations</Text>
                    <Text style={styles.switchDesc}>
                      Allow customers to book dining tables in advance via Online Portal / QR link
                    </Text>
                  </View>
                  <Switch
                    value={isAdvanceBookingEnabled}
                    onValueChange={(val: boolean) => {
                      if (!cashierRestricted) setIsAdvanceBookingEnabled(val);
                    }}
                    disabled={cashierRestricted}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={isAdvanceBookingEnabled ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                {isAdvanceBookingEnabled && (
                  <>
                    <View style={styles.hoursInputsRow}>
                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>DINING DURATION (MINS)</Text>
                        <TextInput
                          style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                          value={slotDurationMinutes}
                          onChangeText={(t) => setSlotDurationMinutes(t.replace(/[^0-9]/g, ''))}
                          placeholder="75"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          editable={!cashierRestricted}
                        />
                      </View>

                      <View style={[styles.fieldGroup, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>BOOKING WINDOW (DAYS AHEAD)</Text>
                        <TextInput
                          style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                          value={advanceBookingWindowDays}
                          onChangeText={(t) => setAdvanceBookingWindowDays(t.replace(/[^0-9]/g, ''))}
                          placeholder="14"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          editable={!cashierRestricted}
                        />
                      </View>
                    </View>

                    {/* Mandatory Advance Deposit */}
                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchTitle}>Mandatory Advance Deposit</Text>
                        <Text style={styles.switchDesc}>
                          Require guests to pay a per-person deposit via UPI/Card to confirm reservation
                        </Text>
                      </View>
                      <Switch
                        value={requireAdvanceDeposit}
                        onValueChange={(val: boolean) => {
                          if (!cashierRestricted) setRequireAdvanceDeposit(val);
                        }}
                        disabled={cashierRestricted}
                        trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                        thumbColor={requireAdvanceDeposit ? '#DE8626' : '#9CA3AF'}
                      />
                    </View>

                    {requireAdvanceDeposit && (
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>DEPOSIT AMOUNT PER PERSON (₹)</Text>
                        <TextInput
                          style={[styles.textInput, cashierRestricted && styles.inputDisabled]}
                          value={depositAmountPerPerson}
                          onChangeText={(t) => setDepositAmountPerPerson(t.replace(/[^0-9]/g, ''))}
                          placeholder="100"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          editable={!cashierRestricted}
                        />
                      </View>
                    )}
                  </>
                )}

                {!cashierRestricted && (
                  <TouchableOpacity
                    style={[styles.sectionSaveBtn, savingSection !== null && { opacity: 0.6 }]}
                    onPress={handleSaveReservationConfig}
                    disabled={savingSection !== null}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sectionSaveGradient}
                    >
                      {savingSection === 'reservations' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Save size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.sectionSaveText}>Save Reservation Policy</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 8. OPERATING HISTORY & AUDIT TRAIL ACCORDION */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={[styles.accordionHeader, expandedSections.history && styles.accordionHeaderOpen]}
              onPress={() => toggleSection('history')}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.accordionIconCircle, expandedSections.history && styles.accordionIconCircleOpen]}>
                  <History size={16} color={expandedSections.history ? '#DE8626' : '#78716C'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>OPERATING HISTORY & AUDIT TRAIL</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {operatingStatus
                      ? `Status: ${operatingStatus.status} (${operatingStatus.orderingMode}) • ${operatingHistory.length} events logged`
                      : 'Audit log of store open/close, order pause, and mode switches'}
                  </Text>
                </View>
              </View>
              <View style={[styles.accordionChevronBadge, expandedSections.history && styles.accordionChevronBadgeOpen]}>
                {expandedSections.history ? (
                  <ChevronUp size={16} color="#D96B14" strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color="#78716C" strokeWidth={2.4} />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.history && (
              <View style={styles.accordionBody}>
                {/* Real-time Status & Audit Summary Card */}
                {operatingStatus && (
                  <View style={styles.historyStatusSummaryCard}>
                    <View style={styles.historySummaryRow}>
                      <View style={styles.historySummaryItem}>
                        <Text style={styles.historySummaryLabel}>LIVE STATUS</Text>
                        <Text
                          style={[
                            styles.historySummaryVal,
                            operatingStatus.status === 'OPEN'
                              ? { color: '#16A34A' }
                              : operatingStatus.status === 'PAUSED'
                              ? { color: '#D97706' }
                              : { color: '#DC2626' },
                          ]}
                        >
                          {operatingStatus.status}
                        </Text>
                      </View>
                      <View style={styles.historySummaryItem}>
                        <Text style={styles.historySummaryLabel}>TIMING MODE</Text>
                        <Text style={styles.historySummaryVal}>{operatingStatus.orderingMode}</Text>
                      </View>
                      <View style={styles.historySummaryItem}>
                        <Text style={styles.historySummaryLabel}>KITCHEN TRACKING</Text>
                        <Text
                          style={[
                            styles.historySummaryVal,
                            operatingStatus.isKitchenActive ? { color: '#16A34A' } : { color: '#78716C' },
                          ]}
                        >
                          {operatingStatus.isKitchenActive ? 'ACTIVE' : 'OFF'}
                        </Text>
                      </View>
                    </View>

                    {/* Timestamps */}
                    <View style={styles.historyAuditTimesGrid}>
                      {operatingStatus.lastOpenedAtUtc && (
                        <View style={styles.historyAuditTimeCol}>
                          <Text style={styles.historyAuditTimeLabel}>LAST OPENED</Text>
                          <Text style={styles.historyAuditTimeVal}>
                            {new Date(operatingStatus.lastOpenedAtUtc).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {operatingStatus.lastClosedAtUtc && (
                        <View style={styles.historyAuditTimeCol}>
                          <Text style={styles.historyAuditTimeLabel}>LAST CLOSED</Text>
                          <Text style={styles.historyAuditTimeVal}>
                            {new Date(operatingStatus.lastClosedAtUtc).toLocaleString()}
                          </Text>
                          {operatingStatus.closeReason && (
                            <Text style={styles.historyAuditTimeSub}>{operatingStatus.closeReason}</Text>
                          )}
                        </View>
                      )}
                      {operatingStatus.lastOrderPausedAtUtc && (
                        <View style={styles.historyAuditTimeCol}>
                          <Text style={styles.historyAuditTimeLabel}>LAST PAUSED</Text>
                          <Text style={styles.historyAuditTimeVal}>
                            {new Date(operatingStatus.lastOrderPausedAtUtc).toLocaleString()} (
                            {operatingStatus.lastPauseDurationMinutes || 0}m)
                          </Text>
                        </View>
                      )}
                      {operatingStatus.lastOrderResumedAtUtc && (
                        <View style={styles.historyAuditTimeCol}>
                          <Text style={styles.historyAuditTimeLabel}>LAST RESUMED</Text>
                          <Text style={styles.historyAuditTimeVal}>
                            {new Date(operatingStatus.lastOrderResumedAtUtc).toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Timeline Header & Refresh */}
                <View style={styles.historyListHeader}>
                  <Text style={[styles.sectionDesc, { flex: 1, marginBottom: 0 }]}>
                    Chronological activity log recorded in RestaurantConfigHistory table.
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshHistoryBtn}
                    onPress={fetchOperatingHistoryAndStatus}
                    disabled={loadingHistory}
                    activeOpacity={0.7}
                  >
                    {loadingHistory ? (
                      <ActivityIndicator size="small" color="#DE8626" />
                    ) : (
                      <>
                        <RotateCw size={12} color="#DE8626" />
                        <Text style={styles.refreshHistoryText}>Refresh Log</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Log entries */}
                {loadingHistory && operatingHistory.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#DE8626" />
                    <Text style={{ fontSize: 11, color: '#8C7A6B', marginTop: 6 }}>
                      Loading operational events...
                    </Text>
                  </View>
                ) : operatingHistory.length === 0 ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#A89F91', fontStyle: 'italic' }}>
                      No operational events recorded yet.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.historyItemsContainer}>
                    {operatingHistory.map((item) => (
                      <View key={item.id} style={styles.historyTimelineItem}>
                        <View style={styles.historyTimelineHeader}>
                          <View style={styles.historyEventBadge}>
                            <Text style={styles.historyEventBadgeText}>
                              {item.eventType.replace(/_/g, ' ')}
                            </Text>
                          </View>
                          <Text style={styles.historyTimelineDate}>
                            {new Date(item.createdDateUtc).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        {item.remarks && (
                          <Text style={styles.historyTimelineRemarks}>{item.remarks}</Text>
                        )}
                        <View style={styles.historyTimelineMeta}>
                          {item.previousStatus && item.newStatus && (
                            <Text style={styles.historyTimelineMetaText}>
                              {item.previousStatus} → {item.newStatus}
                            </Text>
                          )}
                          {item.pauseDurationMinutes ? (
                            <Text style={styles.historyTimelineMetaText}>
                              • {item.pauseDurationMinutes} mins pause
                            </Text>
                          ) : null}
                          <Text style={styles.historyTimelineMetaText}>
                            • Source: {item.actionSource || 'Owner App'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 9. LEGAL & COMPLIANCE SECTION */}
          <View style={styles.formCard}>
            <View style={styles.cardHeaderRow}>
              <Scale size={15} color="#DE8626" />
              <Text style={styles.cardHeading}>LEGAL, RULES & COMPLIANCE</Text>
            </View>

            <TouchableOpacity
              style={styles.legalTermsButton}
              onPress={() => setTermsModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.legalIconBox}>
                <ShieldCheck size={18} color="#D96B14" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.legalTitleText}>Terms & Conditions, Rules & Regulations</Text>
                <Text style={styles.legalSubtitleText}>
                  Review 20 articles governing billing, wallet, food safety & liability
                </Text>
              </View>
              <ChevronRight size={16} color="#8C7A6B" />
            </TouchableOpacity>
          </View>

          {/* 9. MASTER SAVE ALL SETTINGS BUTTON OR LOCKED NOTICE */}
          {cashierRestricted ? (
            <View style={styles.lockedSaveCard}>
              <Lock size={16} color="#8C7A6B" />
              <Text style={styles.lockedSaveText}>Store configuration is locked for Cashier accounts.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveButton, (saving || savingSection !== null) && { opacity: 0.7 }]}
              onPress={handleSaveProfile}
              disabled={saving || savingSection !== null}
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
                    <Text style={styles.saveButtonText}>Save All Store Settings (Master Save)</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Terms & Conditions Modal */}
      <TermsAndConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />

      {/* State Picker Modal */}
      <Modal visible={stateModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableStates}
              keyExtractor={(item) => item.stateCode}
              renderItem={({ item }) => {
                const isSelected = item.stateCode.toUpperCase() === stateCode.toUpperCase();
                return (
                  <TouchableOpacity
                    style={[styles.stateItem, isSelected && styles.stateItemActive]}
                    onPress={() => {
                      setStateCode(item.stateCode);
                      setStateModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stateItemCode, isSelected && styles.stateItemTextActive]}>
                      {item.stateCode}
                    </Text>
                    <Text style={[styles.stateItemName, isSelected && styles.stateItemTextActive]}>
                      {item.stateDesc}
                    </Text>
                    {isSelected && <CheckCircle2 size={16} color="#D96B14" />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 380 }}
            />
          </View>
        </View>
      </Modal>

      {/* RESTAURANT QR CODE & MARKETING MODAL */}
      <RestaurantQrModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        restaurant={activeRestaurant}
      />

      {/* RESTAURANT BANK ACCOUNT & QR SETTLEMENTS MODAL */}
      <Modal
        visible={bankModalVisible}
        animationType="slide"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <RestaurantBankAccountScreen onClose={() => setBankModalVisible(false)} />
      </Modal>

      {/* ADD / EDIT KITCHEN STATION MODAL */}
      <Modal visible={stationModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 560 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Utensils size={18} color="#DE8626" />
                <Text style={styles.modalTitle}>
                  {editingStationId ? 'Edit Kitchen Station' : 'Add Kitchen Station'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setStationModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={18} color="#5C4E3D" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>STATION CODE (UNIQUE SHORT CODE) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={stationCode}
                  onChangeText={(t) => setStationCode(t.toUpperCase())}
                  placeholder="e.g. BAR, GRILL, CHINESE, CURRY, BAKERY"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>STATION DISPLAY NAME *</Text>
                <TextInput
                  style={styles.textInput}
                  value={stationName}
                  onChangeText={setStationName}
                  placeholder="e.g. Beverages & Bar Counter"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Station Active Status Switch */}
              <View style={[styles.switchRow, { marginVertical: 8, paddingVertical: 8 }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.switchTitle}>Station Status: {stationIsActive ? 'Active (Online)' : 'Deactivated (Offline)'}</Text>
                  <Text style={styles.switchDesc}>
                    {stationIsActive
                      ? 'Active: Order dishes route to this station display and printer.'
                      : 'Deactivated: Dishes will temporarily route to Main Kitchen.'}
                  </Text>
                </View>
                <Switch
                  value={stationIsActive}
                  onValueChange={setStationIsActive}
                  trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                  thumbColor={stationIsActive ? '#DE8626' : '#9CA3AF'}
                />
              </View>

              {/* Theme Color Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>BADGE COLOR</Text>
                <View style={styles.colorPickerRow}>
                  {['#DE8626', '#EF4444', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B'].map((col) => (
                    <TouchableOpacity
                      key={col}
                      style={[
                        styles.colorDot,
                        { backgroundColor: col },
                        stationBadgeColor === col && styles.colorDotSelected,
                      ]}
                      onPress={() => setStationBadgeColor(col)}
                      activeOpacity={0.8}
                    >
                      {stationBadgeColor === col && <CheckCircle2 size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dedicated Printer IP / MAC */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ASSIGNED BLUETOOTH / NETWORK PRINTER (OPTIONAL)</Text>
                <TextInput
                  style={styles.textInput}
                  value={stationPrinter}
                  onChangeText={setStationPrinter}
                  placeholder="e.g. 66:32:04:AB:CD:12 or 192.168.1.150"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.timingHintText}>
                  Leave blank if this station uses the central kitchen printer or KDS screen.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DISPLAY ORDER</Text>
                <TextInput
                  style={styles.textInput}
                  value={stationOrder}
                  onChangeText={(t) => setStationOrder(t.replace(/[^0-9]/g, ''))}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { marginTop: 14 }]}
                onPress={handleSaveStation}
                activeOpacity={0.85}
                disabled={actionLoading === 'create' || (editingStationId !== null && actionLoading === `update_${editingStationId}`)}
              >
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGradient}
                >
                  <Save size={15} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>
                    {editingStationId ? 'Save Changes' : 'Create Station'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Gilded Alert Dialog */}
      <GildedAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="OK"
        onConfirm={() => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          alertConfig.onConfirm?.();
        }}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
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
  /* TOP HEADER (Matching HomePage) */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E7E1DA',
  },
  headerQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  headerQrBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D96B14',
  },
  headerLeft: {
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
  headerViewOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  headerViewOnlyBadgeText: {
    color: '#D96B14',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  headerCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#5C4E3D',
    fontSize: 12,
  },

  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },

  /* TELEMETRY BANNER */
  telemetryCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  /* QR MARKETING CARD */
  qrMarketingCard: {
    backgroundColor: '#FFFBF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#FED7AA',
    gap: 12,
  },
  qrMarketingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrMarketingIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  qrMarketingCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#272B30',
  },
  qrMarketingCardDesc: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  qrMarketingActionBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  qrMarketingActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  qrMarketingActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  bankSettlementCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#BBF7D0',
    gap: 12,
  },
  bankSettlementTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bankSettlementIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  bankSettlementCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  bankSettlementActiveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  bankSettlementActiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  bankSettlementCardDesc: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  bankSettlementActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  bankSettlementActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.3,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryLeft: {
    flex: 1,
    gap: 4,
  },
  outletIdBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  outletIdText: {
    color: '#D96B14',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  telemetryStoreName: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#5C4E3D',
    fontSize: 11,
  },
  telemetryRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  walletBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.2)',
  },
  walletText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
  },

  /* SECTION CONTROLS ROW */
  sectionControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: -2,
  },
  sectionControlsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.8,
  },
  expandCollapseBtn: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  expandCollapseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D96B14',
  },

  /* ACCORDION MODULES */
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  accordionHeaderOpen: {
    backgroundColor: '#FFFDF9',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  accordionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F7F2EA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EADFCF',
  },
  accordionIconCircleOpen: {
    backgroundColor: '#FFF0DE',
    borderColor: '#FED7AA',
  },
  accordionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  accordionSubtitle: {
    fontSize: 10.5,
    color: '#78716C',
    marginTop: 2,
    fontWeight: '500',
  },
  accordionChevronBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionChevronBadgeOpen: {
    backgroundColor: '#FFF0DE',
  },
  accordionBody: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  sectionSaveBtn: {
    marginTop: 14,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  sectionSaveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  /* FORM CARD */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  cardHeading: {
    color: '#7C6F62',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  /* BRANDING */
  brandingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  logoCol: {
    width: 90,
  },
  coverCol: {
    flex: 1,
  },
  inputSubLabel: {
    color: '#7C6F62',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  logoPickerBtn: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPickerBtn: {
    position: 'relative',
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverPlaceholderText: {
    color: '#7C6F62',
    fontSize: 10,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* FIELDS */
  fieldGroup: {
    marginBottom: 10,
  },
  labelWithCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  digitCounter: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  fieldLabel: {
    color: '#5C4E3D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#FAF7F2',
    color: '#1F2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
  },
  countryCodeBadge: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E7E1DA',
  },
  countryCodeText: {
    color: '#D96B14',
    fontSize: 12,
    fontWeight: '800',
  },
  phoneTextInput: {
    flex: 1,
    color: '#1F2937',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    letterSpacing: 1,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 12,
    height: 40,
  },
  stateSelectText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* GST SUMMARY PILL */
  gstSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.25)',
    marginTop: 8,
  },
  gstSummaryTitle: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '800',
  },
  gstSummaryValue: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '900',
  },
  gstSummarySub: {
    color: '#5C4E3D',
    fontSize: 10,
  },

  /* PERMISSION BANNER FOR CASHIERS */
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF0DE',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.35)',
  },
  permissionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFE3C2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBannerTitle: {
    color: '#D96B14',
    fontSize: 13,
    fontWeight: '800',
  },
  permissionBannerDesc: {
    color: '#5C4E3D',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  inputDisabled: {
    backgroundColor: '#F3EFEA',
    color: '#374151',
    borderColor: '#E2DBD2',
  },

  /* LEGAL & COMPLIANCE */
  legalTermsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7DC CF',
    gap: 12,
  },
  legalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  legalTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  legalSubtitleText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  /* SAVE BUTTON */
  lockedSaveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3EFEA',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2DBD2',
    marginTop: 6,
  },
  lockedSaveText: {
    color: '#8C7A6B',
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  modalTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
  },
  stateItemActive: {
    backgroundColor: '#FFF0DE',
  },
  stateItemCode: {
    color: '#DE8626',
    fontSize: 12,
    fontWeight: '800',
    width: 36,
  },
  stateItemName: {
    color: '#1F2937',
    fontSize: 12,
    flex: 1,
  },
  stateItemTextActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  timingModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  timingModeCard: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 4,
  },
  timingModeCardActive: {
    backgroundColor: '#FFFDF9',
    borderColor: '#DE8626',
    borderWidth: 1.5,
  },
  timingModeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5C4E3D',
  },
  timingModeTitleActive: {
    color: '#DE8626',
  },
  timingModeDesc: {
    fontSize: 10,
    color: '#8C7A6B',
    lineHeight: 13,
  },
  hoursInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timingHintText: {
    fontSize: 10.5,
    color: '#8C7A6B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 10,
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  switchDesc: {
    fontSize: 10,
    color: '#7C6F62',
    marginTop: 2,
  },
  stationManagementContainer: {
    marginTop: 4,
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    padding: 12,
  },
  stationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stationSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.5,
  },
  addStationHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addStationHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DE8626',
  },
  emptyStationsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderStyle: 'dashed',
  },
  emptyStationsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C4E3D',
    marginTop: 8,
  },
  emptyStationsDesc: {
    fontSize: 11,
    color: '#8C7A6B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 15,
  },
  initDefaultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DE8626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  initDefaultsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stationList: {
    gap: 8,
  },
  stationItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
  },
  stationColorBar: {
    width: 5,
  },
  stationItemBody: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  stationItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stationItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  stationCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#FFFDF9',
  },
  stationCodeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stationStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stationStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  stationItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationPrinterText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  stationActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationActionIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationActionToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  stationActionToggleBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  stationActionToggleBtnInactive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  stationActionToggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stationBottomBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  addStationBottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  addStationBottomBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DE8626',
  },
  reseedDefaultsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 8,
  },
  reseedDefaultsBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: '#1F2937',
    transform: [{ scale: 1.1 }],
  },
  kitchenStatusMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  kitchenStatusMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* OPERATING HISTORY ACCORDION STYLES */
  sectionDesc: {
    fontSize: 11.5,
    color: '#78716C',
    lineHeight: 16,
  },
  historyStatusSummaryCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFE7DC',
    marginBottom: 14,
    gap: 10,
  },
  historySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DC',
  },
  historySummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  historySummaryLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.5,
  },
  historySummaryVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#292524',
    marginTop: 2,
  },
  historyAuditTimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyAuditTimeCol: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F0ECE4',
    flex: 1,
    minWidth: '45%',
  },
  historyAuditTimeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A89F91',
  },
  historyAuditTimeVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
    marginTop: 1,
  },
  historyAuditTimeSub: {
    fontSize: 9.5,
    color: '#78716C',
    marginTop: 1,
  },
  historyListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  refreshHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  refreshHistoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DE8626',
  },
  historyItemsContainer: {
    gap: 8,
  },
  historyTimelineItem: {
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFEAE3',
    gap: 4,
  },
  historyTimelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyEventBadge: {
    backgroundColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyEventBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#9A3412',
    letterSpacing: 0.3,
  },
  historyTimelineDate: {
    fontSize: 10,
    color: '#8C7A6B',
    fontWeight: '600',
  },
  historyTimelineRemarks: {
    fontSize: 11.5,
    color: '#292524',
    fontWeight: '600',
    marginTop: 2,
  },
  historyTimelineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  historyTimelineMetaText: {
    fontSize: 10,
    color: '#78716C',
  },
});
