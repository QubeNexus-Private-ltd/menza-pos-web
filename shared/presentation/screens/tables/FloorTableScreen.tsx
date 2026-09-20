import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Table as TableIcon,
  Users,
  CheckCircle2,
  Clock,
  X,
  Plus,
  Search,
  QrCode,
  Sparkles,
  Edit2,
  Trash2,
  Grid,
  Layers,
  ChevronDown,
  Info,
  Calendar,
  SlidersHorizontal,
  UserCheck,
  Phone,
  ArrowRight,
  Ban,
  Check,
  AlertCircle,
  AlertTriangle,
  Utensils,
  ChevronRight,
  Eye,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Receipt,
  Printer,
  CreditCard,
  History,
} from 'lucide-react-native';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import {
  TableMaster,
  TableStatus,
  TableReservation,
  ReservationStatus,
  RestaurantReservationConfig,
  FloorSection,
  TableHistoryItem,
} from '../../../domain/models/Table';
import { TableRemoteDataSource } from '../../../data/datasources/TableRemoteDataSource';
import { TableRepositoryImpl } from '../../../data/repositories/TableRepositoryImpl';
import { RestaurantConfigRemoteDataSource } from '../../../data/datasources/RestaurantConfigRemoteDataSource';
import { OrderRemoteDataSource } from '../../../data/datasources/OrderRemoteDataSource';
import { OrderMaster } from '../../../domain/models/Order';
import { useAuthStore } from '../../state/useAuthStore';
import { usePrinterStore } from '../../state/usePrinterStore';
import { useNotificationStore } from '../../state/useNotificationStore';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { RestaurantQrModal } from '../../components/RestaurantQrModal';
import { WalletRechargeModal } from '../../components/WalletRechargeModal';
import { CashierSettlementModal } from '../../components/CashierSettlementModal';
import { WalletEvents } from '../../../core/utils/walletEvents';
import { formatToIstTime } from '../../../core/utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const tableDataSource = new TableRemoteDataSource();
const tableRepository = new TableRepositoryImpl(tableDataSource);
const configDataSource = new RestaurantConfigRemoteDataSource();
const orderDataSource = new OrderRemoteDataSource();

interface FloorTableScreenProps {
  onClose?: () => void;
  onOpenPos?: (tableInfo?: { tableId?: number; tableNumber?: string; sectionName?: string }) => void;
}

const DEFAULT_SECTIONS = ['Main Hall', 'AC Dining', 'Terrace', 'Rooftop', 'VIP Lounge'];

const TIME_SLOTS = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
];

const TableCardSkeleton: React.FC = () => (
  <View style={styles.tableCardSkeleton}>
    <View style={styles.tableCardTopRow}>
      <SkeletonLoader width={50} height={14} borderRadius={4} style={styles.skeletonBg} />
      <SkeletonLoader width={40} height={14} borderRadius={4} style={styles.skeletonBg} />
    </View>
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <SkeletonLoader width={54} height={28} borderRadius={6} style={styles.skeletonBg} />
    </View>
    <View style={styles.tableCardBottomRow}>
      <SkeletonLoader width="100%" height={22} borderRadius={12} style={styles.skeletonBg} />
    </View>
  </View>
);

export const FloorTableScreen: React.FC<FloorTableScreenProps> = ({ onClose, onOpenPos }) => {
  const { activeRestaurant } = useAuthStore();
  const { activeFloorWaitersCount } = useNotificationStore();
  const restId = activeRestaurant?.restaurantId || 0;

  // View Mode: 'floor' (Live Tables) or 'reservations' (Advance Bookings)
  const [activeTab, setActiveTab] = useState<'floor' | 'reservations'>('floor');

  // --- FLOOR TABLES STATE ---
  const [tables, setTables] = useState<TableMaster[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [dbSections, setDbSections] = useState<FloorSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | TableStatus>('All');

  // --- RESERVATIONS STATE ---
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchResQuery, setSearchResQuery] = useState('');
  const [selectedResStatusFilter, setSelectedResStatusFilter] = useState<'All' | ReservationStatus>('All');
  const [reservationConfig, setReservationConfig] = useState<RestaurantReservationConfig>({
    isAdvanceBookingEnabled: true,
    bookingSlotIntervalMinutes: 30,
    averageDiningDurationMinutes: 75,
    advanceBookingWindowDays: 14,
    cutoffLeadTimeHours: 1,
    autoReleaseGracePeriodMinutes: 15,
    requireAdvanceDeposit: false,
    depositAmountPerPerson: 100,
    depositFlatAmount: 300,
    cancellationRefundWindowHours: 4,
    maxOnlineBookingGuests: 10,
  });

  // --- MODALS STATE ---
  const [addTableModalVisible, setAddTableModalVisible] = useState(false);
  const [editingTable, setEditingTable] = useState<TableMaster | null>(null);
  const [selectedTableAction, setSelectedTableAction] = useState<TableMaster | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedTableForQr, setSelectedTableForQr] = useState<TableMaster | null>(null);

  // Table History Timeline Modal
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyTable, setHistoryTable] = useState<TableMaster | null>(null);
  const [tableHistoryList, setTableHistoryList] = useState<TableHistoryItem[]>([]);
  const [isLoadingTableHistory, setIsLoadingTableHistory] = useState(false);

  // Reservation Modals
  const [newBookingModalVisible, setNewBookingModalVisible] = useState(false);
  const [assignTableModalVisible, setAssignTableModalVisible] = useState(false);
  const [selectedResForAssignment, setSelectedResForAssignment] = useState<TableReservation | null>(null);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Form State for Add / Edit Table
  const [tableNumInput, setTableNumInput] = useState('');
  const [tableSeatsInput, setTableSeatsInput] = useState('4');
  const [tableMinSeatsInput, setTableMinSeatsInput] = useState('2');
  const [tableSectionInput, setTableSectionInput] = useState('Main Hall');
  const [tableOnlineBookable, setTableOnlineBookable] = useState(true);
  const [savingTable, setSavingTable] = useState(false);

  // Form State for New Reservation
  const [resGuestName, setResGuestName] = useState('');
  const [resGuestPhone, setResGuestPhone] = useState('');
  const [resGuestCount, setResGuestCount] = useState('2');
  const [resDate, setResDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [resTime, setResTime] = useState('07:30 PM');
  const [resSection, setResSection] = useState('Main Hall');
  const [resTableId, setResTableId] = useState<number | null>(null);
  const [resNotes, setResNotes] = useState('');
  const [resRequireDeposit, setResRequireDeposit] = useState(false);
  const [resDepositAmount, setResDepositAmount] = useState('200');
  const [savingBooking, setSavingBooking] = useState(false);

  // Wallet Modal & Balance State
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Active Table Bill Modal State
  const [activeTableBillTarget, setActiveTableBillTarget] = useState<TableMaster | null>(null);
  const [activeTableOrder, setActiveTableOrder] = useState<OrderMaster | null>(null);
  const [loadingActiveBill, setLoadingActiveBill] = useState<boolean>(false);
  const [activeBillModalVisible, setActiveBillModalVisible] = useState<boolean>(false);

  // Cashier Settlement Modal State
  const [settlementModalVisible, setSettlementModalVisible] = useState<boolean>(false);
  const [orderToSettle, setOrderToSettle] = useState<OrderMaster | null>(null);

  const { printReceipt } = usePrinterStore();

  const handleOpenTableHistory = async (table: TableMaster) => {
    setSelectedTableAction(null);
    setHistoryTable(table);
    setHistoryModalVisible(true);
    setIsLoadingTableHistory(true);
    try {
      const list = await tableDataSource.getTableHistory(table.id, 30);
      setTableHistoryList(list);
    } catch {
      setTableHistoryList([]);
    } finally {
      setIsLoadingTableHistory(false);
    }
  };

  const handleOpenActiveBill = async (table: TableMaster) => {
    setSelectedTableAction(null);
    setActiveTableBillTarget(table);
    setActiveBillModalVisible(true);
    setLoadingActiveBill(true);
    try {
      // 1. Primary: Direct Table Active Order API
      let match = await orderDataSource.getActiveOrderByTable(table.id, restId);

      // 2. Secondary fallback: Kitchen orders
      if (!match) {
        const kitchenOrders = await orderDataSource.getKitchenOrders(restId);
        match =
          kitchenOrders.find(
            (o) =>
              o.tableId === table.id ||
              (o.tableName &&
                String(o.tableName).trim().toLowerCase() === String(table.tableNumber).trim().toLowerCase())
          ) || null;
      }

      // 3. Tertiary fallback: Today orders
      if (!match) {
        const todayRes = await orderDataSource.getTodayOrders(restId, 'ALL', 1, 50);
        match =
          todayRes.items.find(
            (o) =>
              (o.tableId === table.id ||
                (o.tableName &&
                  String(o.tableName).trim().toLowerCase() ===
                    String(table.tableNumber).trim().toLowerCase())) &&
              o.status !== 'Cancelled'
          ) || null;
      }

      setActiveTableOrder(match || null);
    } catch (err) {
      console.warn('Failed to load active bill for table', err);
      setActiveTableOrder(null);
    } finally {
      setLoadingActiveBill(false);
    }
  };

  const handleSettleTableFromBillModal = () => {
    if (!activeTableBillTarget || !activeTableOrder) return;
    setActiveBillModalVisible(false);
    setOrderToSettle(activeTableOrder);
    setSettlementModalVisible(true);
  };

  // Custom Alert Modal State
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

  const loadRestaurantConfig = async () => {
    try {
      if (restId > 0) {
        const config = await configDataSource.getConfig(restId);
        if (config && config.walletBalance !== undefined) {
          setWalletBalance(config.walletBalance);
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadTables();
    loadSections();
    loadReservationConfig();
    loadRestaurantConfig();

    const unsub = WalletEvents.subscribe(() => {
      loadRestaurantConfig();
    });
    return () => unsub();
  }, [restId]);

  useEffect(() => {
    if (activeTab === 'reservations') {
      loadReservations();
    }
  }, [activeTab, selectedDate, restId]);

  // --- API DATA LOADERS ---
  const loadSections = async () => {
    try {
      setLoadingSections(true);
      if (restId > 0) {
        const list = await tableRepository.getSections(restId);
        setDbSections(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.warn('Failed to fetch sections', err);
      setDbSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  const loadTables = async () => {
    try {
      setLoadingTables(true);
      const data = await tableRepository.getTables(restId);
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch tables', err);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const loadReservations = async () => {
    try {
      setLoadingReservations(true);
      const list = await tableRepository.getReservations(restId, selectedDate);
      setReservations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to fetch reservations', err);
      setReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  };

  const loadReservationConfig = async () => {
    try {
      const cfg = await tableRepository.getReservationConfig(restId);
      if (cfg) setReservationConfig(cfg);
    } catch (err) {
      console.warn('Failed to fetch reservation policy', err);
    }
  };

  // --- DYNAMIC SECTIONS LIST ---
  const availableSectionNames = useMemo(() => {
    const set = new Set<string>();
    dbSections.forEach((s) => {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    });
    tables.forEach((t) => {
      if (t.sectionName && t.sectionName.trim()) set.add(t.sectionName.trim());
    });
    if (set.size === 0) {
      DEFAULT_SECTIONS.forEach((s) => set.add(s));
    }
    return Array.from(set);
  }, [dbSections, tables]);

  const uniqueSections = useMemo(() => {
    return ['All', ...availableSectionNames];
  }, [availableSectionNames]);

  // --- DYNAMIC DATE CAROUSEL (Next 14 Days) ---
  const dateOptions = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dates.push({ iso, dayName, monthDay });
    }
    return dates;
  }, []);

  // --- TABLE FILTERING ---
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (selectedStatusFilter !== 'All' && t.status !== selectedStatusFilter) return false;
      if (selectedSection !== 'All' && t.sectionName !== selectedSection) return false;
      if (searchTableQuery.trim()) {
        const q = searchTableQuery.toLowerCase();
        const numMatch = (t.tableNumber ?? '').toString().toLowerCase().includes(q);
        const secMatch = (t.sectionName ?? '').toLowerCase().includes(q);
        const guestMatch = (t.currentReservationGuestName ?? '').toLowerCase().includes(q);
        return numMatch || secMatch || guestMatch;
      }
      return true;
    });
  }, [tables, selectedStatusFilter, selectedSection, searchTableQuery]);

  // --- RESERVATION FILTERING ---
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (selectedResStatusFilter !== 'All' && r.status !== selectedResStatusFilter) return false;
      if (searchResQuery.trim()) {
        const q = searchResQuery.toLowerCase();
        return (
          r.customerName?.toLowerCase().includes(q) ||
          r.customerPhone?.includes(q) ||
          r.reservationCode?.toLowerCase().includes(q) ||
          r.tableNumber?.toLowerCase().includes(q) ||
          r.sectionName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reservations, selectedResStatusFilter, searchResQuery]);

  // --- METRICS ---
  const tableMetrics = useMemo(() => {
    return {
      all: tables.length,
      available: tables.filter((t) => t.status === 'Available').length,
      occupied: tables.filter((t) => t.status === 'Occupied').length,
      reserved: tables.filter((t) => t.status === 'Reserved').length,
      billed: tables.filter((t) => t.status === 'Billed').length,
    };
  }, [tables]);

  const reservationMetrics = useMemo(() => {
    const total = reservations.length;
    const totalGuests = reservations.reduce((acc, curr) => acc + (curr.guestCount || 0), 0);
    const confirmed = reservations.filter((r) => r.status === 'Confirmed').length;
    const seated = reservations.filter((r) => r.status === 'Seated').length;
    return { total, totalGuests, confirmed, seated };
  }, [reservations]);

  // --- TABLE ACTIONS ---
  const handleSaveTable = async () => {
    if (!tableNumInput.trim()) {
      showAlert('Required Field', 'Please enter a Table Number / Code (e.g. T-01, 10, VIP-2).', 'warning');
      return;
    }

    try {
      setSavingTable(true);
      const capacity = parseInt(tableSeatsInput, 10) || 4;
      const minCapacity = parseInt(tableMinSeatsInput, 10) || 2;
      const cleanNum = tableNumInput.trim().toUpperCase();
      const cleanSection = tableSectionInput.trim() || 'Main Hall';
      const matchedSection = dbSections.find(
        (s) => s.name.trim().toLowerCase() === cleanSection.toLowerCase()
      );
      const sectionId = matchedSection ? matchedSection.id : undefined;

      if (editingTable) {
        // Edit existing table
        const updatedTable: TableMaster = {
          ...editingTable,
          tableNumber: cleanNum,
          seatingCapacity: capacity,
          minSeatingCapacity: minCapacity,
          sectionName: cleanSection,
          sectionId: sectionId ?? editingTable.sectionId,
          isOnlineBookable: tableOnlineBookable,
        };

        setTables((prev) => prev.map((t) => (t.id === editingTable.id ? updatedTable : t)));
        await tableRepository.updateTable(editingTable.id, updatedTable);
        showAlert('Table Updated', `Table ${cleanNum} configuration updated successfully.`, 'success');
      } else {
        // Create new table
        const newTable: TableMaster = {
          id: Date.now(),
          restaurantId: restId,
          tableNumber: cleanNum,
          seatingCapacity: capacity,
          minSeatingCapacity: minCapacity,
          sectionName: cleanSection,
          sectionId: sectionId,
          status: 'Available',
          isOnlineBookable: tableOnlineBookable,
        };

        setTables((prev) => [...prev, newTable]);
        await tableRepository.createTable(newTable);
        await loadTables();
        showAlert('Table Added', `Table ${cleanNum} added to ${cleanSection}.`, 'success');
      }

      setAddTableModalVisible(false);
      setEditingTable(null);
      setTableNumInput('');
      setTableSeatsInput('4');
      setTableMinSeatsInput('2');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not save table configuration.', 'danger');
    } finally {
      setSavingTable(false);
    }
  };

  const handleDeleteTable = (table: TableMaster) => {
    showAlert(
      'Delete Table',
      `Are you sure you want to delete Table ${table.tableNumber}? This action cannot be undone.`,
      'danger',
      'Delete',
      'Cancel',
      async () => {
        setTables((prev) => prev.filter((t) => t.id !== table.id));
        setSelectedTableAction(null);
        try {
          await tableRepository.deleteTable(table.id);
        } catch {
          // Optimistic UI
        }
      }
    );
  };

  const handleUpdateTableStatus = async (table: TableMaster, newStatus: TableStatus) => {
    setSelectedTableAction(null);
    setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, status: newStatus } : t)));
    try {
      await tableRepository.updateTableStatus(table.id, newStatus);
    } catch {
      // Optimistic UI retained
    }
  };

  const handleFreeTable = async (table: TableMaster, transitionToCleaning: boolean = false) => {
    const formattedNum = formatTableNumber(table.tableNumber);
    const actionTitle = transitionToCleaning ? 'Mark for Cleaning' : 'Free Table';
    const actionDesc = transitionToCleaning
      ? `Mark Table ${formattedNum} for cleaning and busing? Table status will change to Cleaning.`
      : `Free Table ${formattedNum} and reset it to Available immediately for the next guests?`;

    showAlert(
      actionTitle,
      actionDesc,
      'info',
      transitionToCleaning ? 'Mark Cleaning' : 'Free Table',
      'Cancel',
      async () => {
        setSelectedTableAction(null);
        const newStatus = transitionToCleaning ? 'Cleaning' : 'Available';
        setTables((prev) =>
          prev.map((t) =>
            t.id === table.id
              ? {
                  ...t,
                  status: newStatus,
                  occupiedSince: undefined,
                  currentReservationGuestName: undefined,
                }
              : t
          )
        );
        try {
          await tableRepository.freeTable(table.id, {
            restaurantId: restId,
            transitionToCleaning,
            releasedByRole: 'STAFF',
          });
        } catch {
          // Optimistic UI retained
        }
      }
    );
  };

  // --- RESERVATION ACTIONS ---
  const handleCreateBooking = async () => {
    if (walletBalance !== null && walletBalance <= 0) {
      showAlert(
        'Prepaid Wallet Exhausted 💳',
        `Your restaurant's prepaid wallet balance is ₹${walletBalance.toFixed(2)}. Table bookings and advance reservations cannot be accepted while wallet balance is zero or negative.\n\nPlease recharge your wallet to continue.`,
        'warning',
        'Recharge Wallet',
        'Cancel',
        () => setWalletModalVisible(true)
      );
      return;
    }

    if (!resGuestName.trim() || !resGuestPhone.trim()) {
      showAlert('Required Fields', 'Please provide Guest Name and Mobile Number.', 'warning');
      return;
    }

    try {
      setSavingBooking(true);
      const count = parseInt(resGuestCount, 10) || 2;
      const depositAmt = resRequireDeposit ? parseInt(resDepositAmount, 10) || 0 : 0;

      const matchedTable = tables.find((t) => t.id === resTableId);

      const newResObj: Partial<TableReservation> = {
        restaurantId: restId,
        customerName: resGuestName.trim(),
        customerPhone: resGuestPhone.trim(),
        guestCount: count,
        reservationDate: resDate,
        reservationTime: resTime,
        durationMinutes: reservationConfig.averageDiningDurationMinutes || 75,
        sectionName: resSection,
        tableId: resTableId || null,
        tableNumber: matchedTable?.tableNumber,
        status: 'Confirmed',
        specialNotes: resNotes.trim() || undefined,
        isDepositRequired: resRequireDeposit,
        depositAmount: depositAmt,
        depositPaymentStatus: resRequireDeposit ? 'Paid' : 'Pending',
        source: 'STAFF_APP',
      };

      const created = await tableRepository.createReservation(newResObj);

      if (created) {
        setReservations((prev) => [created, ...prev]);

        // If today and table assigned, update table status to Reserved
        if (resDate === new Date().toISOString().split('T')[0] && resTableId) {
          setTables((prev) =>
            prev.map((t) =>
              t.id === resTableId
                ? {
                    ...t,
                    status: 'Reserved',
                    currentReservationGuestName: created.customerName,
                    currentReservationTime: created.reservationTime,
                  }
                : t
            )
          );
        }
      }

      showAlert(
        'Reservation Confirmed',
        `Booking confirmed for ${newResObj.customerName} (${count} guests) on ${resDate} at ${resTime}.`,
        'success',
        'OK',
        undefined,
        () => {
          setNewBookingModalVisible(false);
          setResGuestName('');
          setResGuestPhone('');
          setResNotes('');
          setResTableId(null);
        }
      );
    } catch (err: any) {
      showAlert('Booking Error', err?.message || 'Could not create reservation.', 'danger');
    } finally {
      setSavingBooking(false);
    }
  };

  const handleSeatReservation = async (reservation: TableReservation) => {
    try {
      // Find assigned table or best fit
      let targetTable = tables.find((t) => t.id === reservation.tableId);
      if (!targetTable) {
        targetTable = tables.find((t) => t.status === 'Available' && t.seatingCapacity >= reservation.guestCount);
      }

      if (!targetTable) {
        showAlert(
          'No Table Available',
          'Please assign an available table manually before seating the guest.',
          'warning'
        );
        setSelectedResForAssignment(reservation);
        setAssignTableModalVisible(true);
        return;
      }

      // Update reservation status to Seated
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservation.id
            ? { ...r, status: 'Seated', seatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            : r
        )
      );
      await tableRepository.updateReservationStatus(reservation.id, 'Seated');

      // Update Table status to Occupied
      setTables((prev) =>
        prev.map((t) =>
          t.id === targetTable!.id
            ? {
                ...t,
                status: 'Occupied',
                activeGuestCount: reservation.guestCount,
                occupiedSince: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            : t
        )
      );
      await tableRepository.updateTableStatus(targetTable.id, 'Occupied');

      showAlert(
        'Guests Seated',
        `${reservation.customerName} has been seated at Table ${targetTable.tableNumber}.`,
        'success',
        'Open POS',
        'Stay Here',
        () => {
          if (onOpenPos) onOpenPos({ tableId: targetTable?.id, tableNumber: targetTable?.tableNumber, sectionName: targetTable?.sectionName });
        }
      );
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not update seating status.', 'danger');
    }
  };

  const handleUpdateReservationStatus = async (reservationId: number, newStatus: ReservationStatus) => {
    setReservations((prev) => prev.map((r) => (r.id === reservationId ? { ...r, status: newStatus } : r)));
    try {
      await tableRepository.updateReservationStatus(reservationId, newStatus);
    } catch {
      // Optimistic
    }
  };

  const handleAssignTableToRes = async (table: TableMaster) => {
    if (!selectedResForAssignment) return;

    try {
      setReservations((prev) =>
        prev.map((r) =>
          r.id === selectedResForAssignment.id
            ? { ...r, tableId: table.id, tableNumber: table.tableNumber, sectionName: table.sectionName }
            : r
        )
      );

      // If reservation is today, tag table as reserved
      if (selectedResForAssignment.reservationDate === new Date().toISOString().split('T')[0]) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === table.id
              ? {
                  ...t,
                  status: 'Reserved',
                  currentReservationGuestName: selectedResForAssignment.customerName,
                  currentReservationTime: selectedResForAssignment.reservationTime,
                }
              : t
          )
        );
      }

      await tableRepository.assignTableToReservation(selectedResForAssignment.id, table.id, table.tableNumber);
      setAssignTableModalVisible(false);
      setSelectedResForAssignment(null);
      showAlert('Table Assigned', `Table ${table.tableNumber} assigned to ${selectedResForAssignment.customerName}.`, 'success');
    } catch (err: any) {
      showAlert('Assignment Error', err?.message || 'Could not assign table.', 'danger');
    }
  };

  const handleSavePolicySettings = async () => {
    try {
      await tableRepository.updateReservationConfig(restId, reservationConfig);
      setSettingsModalVisible(false);
      showAlert('Settings Saved', 'Reservation policy and booking slot rules updated.', 'success');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not save policy settings.', 'danger');
    }
  };

  const isDateBlocked = (dateStr: string) => {
    if (reservationConfig.isAdvanceBookingEnabled === false) return true;
    const blocked = reservationConfig.blockedDates || [];
    return blocked.includes(dateStr);
  };

  const handleToggleDateBlock = async () => {
    const isCurrentlyBlocked = isDateBlocked(selectedDate);
    const actionText = isCurrentlyBlocked ? 'Unblock' : 'Block';
    const confirmMessage = isCurrentlyBlocked
      ? `Do you want to re-enable advance table bookings for ${selectedDate}?`
      : `Disabling advance bookings for ${selectedDate} will prevent guests and online users from booking tables on this date. Existing bookings will remain intact. Continue?`;

    showAlert(
      `${actionText} Advance Bookings`,
      confirmMessage,
      isCurrentlyBlocked ? 'info' : 'warning',
      `${actionText} Date`,
      'Cancel',
      async () => {
        try {
          const success = await tableRepository.toggleDateBlock(restId, selectedDate, !isCurrentlyBlocked);
          if (success) {
            setReservationConfig((prev) => {
              const currentBlocked = new Set(prev.blockedDates || []);
              if (isCurrentlyBlocked) {
                currentBlocked.delete(selectedDate);
              } else {
                currentBlocked.add(selectedDate);
              }
              return { ...prev, blockedDates: Array.from(currentBlocked) };
            });
            showAlert(
              'Updated Successfully',
              `Advance bookings for ${selectedDate} are now ${isCurrentlyBlocked ? 'ENABLED' : 'BLOCKED'}.`,
              'success'
            );
          }
        } catch (err: any) {
          showAlert('Update Failed', err?.message || 'Could not update date block status.', 'danger');
        }
      }
    );
  };

  const handleToggleTableAdvanceBooking = async (table: TableMaster) => {
    const currentStatus = table.isOnlineBookable !== false;
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'Enable Advance Booking' : 'Disable Advance Booking';
    const confirmMessage = newStatus
      ? `Allow advance online & staff reservations for Table ${formatTableNumber(table.tableNumber)}?`
      : `Table ${formatTableNumber(table.tableNumber)} will be reserved for Walk-in Diners only and excluded from advance online booking slots. Continue?`;

    showAlert(
      actionText,
      confirmMessage,
      newStatus ? 'info' : 'warning',
      newStatus ? 'Enable' : 'Disable',
      'Cancel',
      async () => {
        try {
          const success = await tableRepository.toggleTableAdvanceBooking(table.id, newStatus);
          if (success) {
            setTables((prev) =>
              prev.map((t) => (t.id === table.id ? { ...t, isOnlineBookable: newStatus } : t))
            );
            if (selectedTableAction?.id === table.id) {
              setSelectedTableAction((prev) => (prev ? { ...prev, isOnlineBookable: newStatus } : null));
            }
            showAlert(
              'Table Updated',
              `Table ${formatTableNumber(table.tableNumber)} is now ${newStatus ? 'available for advance reservations' : 'set to Walk-In Only'}.`,
              'success'
            );
          }
        } catch (err: any) {
          showAlert('Update Failed', err?.message || 'Could not update table booking mode.', 'danger');
        }
      }
    );
  };

  // Helper formatting for table number
  const formatTableNumber = (tableNumber?: string | number) => {
    const raw = (tableNumber ?? '').toString().trim();
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return `T-${raw}`;
    return raw;
  };

  // Card visual theme by status
  const getTableCardTheme = (status: string) => {
    switch (status) {
      case 'Occupied':
        return {
          cardBg: '#FFF3DC',
          borderColor: 'rgba(222, 134, 38, 0.45)',
          numColor: '#1F2937',
          badgeBg: '#FFF0DE',
          badgeColor: '#D96B14',
          dotColor: '#DE8626',
          label: 'OCCUPIED',
        };
      case 'Reserved':
        return {
          cardBg: '#FFFDF5',
          borderColor: 'rgba(254, 166, 25, 0.45)',
          numColor: '#1F2937',
          badgeBg: '#FFF3DC',
          badgeColor: '#FEA619',
          dotColor: '#FEA619',
          label: 'RESERVED',
        };
      case 'Billed':
        return {
          cardBg: '#F0F7FF',
          borderColor: 'rgba(52, 108, 176, 0.45)',
          numColor: '#1F2937',
          badgeBg: '#EBF5FF',
          badgeColor: '#346CB0',
          dotColor: '#346CB0',
          label: 'BILLED',
        };
      case 'Maintenance':
        return {
          cardBg: '#F3F4F6',
          borderColor: '#D1D5DB',
          numColor: '#6B7280',
          badgeBg: '#E5E7EB',
          badgeColor: '#4B5563',
          dotColor: '#9CA3AF',
          label: 'MAINTENANCE',
        };
      case 'Available':
      default:
        return {
          cardBg: '#FFFFFF',
          borderColor: 'rgba(23, 132, 90, 0.35)',
          numColor: '#1F2937',
          badgeBg: '#E4F5EC',
          badgeColor: '#17845A',
          dotColor: '#17845A',
          label: 'AVAILABLE',
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent={false} />
      <View style={styles.container}>
        {/* HEADER BAR */}
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
                {tables.length} Tables • {reservations.filter((r) => r.status === 'Confirmed').length} Upcoming Bookings
              </Text>
            </View>
          </View>

          <View style={styles.headerRightCol}>
            <TouchableOpacity
              style={styles.settingsHeaderBtn}
              onPress={() => setSettingsModalVisible(true)}
              activeOpacity={0.8}
            >
              <SlidersHorizontal size={14} color="#7C6F62" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.storeQrHeaderBtn}
              onPress={() => {
                setSelectedTableForQr(null);
                setQrModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <QrCode size={13} color="#D96B14" />
              <Text style={styles.storeQrHeaderBtnText}>QR</Text>
            </TouchableOpacity>

            {activeTab === 'floor' ? (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  setEditingTable(null);
                  setTableNumInput('');
                  setTableSeatsInput('4');
                  setTableMinSeatsInput('2');
                  setTableSectionInput(uniqueSections[1] || 'Main Hall');
                  setTableOnlineBookable(true);
                  setAddTableModalVisible(true);
                }}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryActionBtnGradient}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={styles.primaryActionBtnText}>+ Table</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  setResGuestName('');
                  setResGuestPhone('');
                  setResGuestCount('2');
                  setResDate(selectedDate);
                  setResTime('07:30 PM');
                  setResSection(uniqueSections[1] || 'Main Hall');
                  setResTableId(null);
                  setResNotes('');
                  setResRequireDeposit(reservationConfig.requireAdvanceDeposit);
                  setNewBookingModalVisible(true);
                }}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryActionBtnGradient}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={styles.primaryActionBtnText}>+ Booking</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtnCircle} activeOpacity={0.7}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DUAL MODE VIEW TABS */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'floor' && styles.tabButtonActive]}
            onPress={() => setActiveTab('floor')}
            activeOpacity={0.85}
          >
            <TableIcon size={14} color={activeTab === 'floor' ? '#D96B14' : '#7C6F62'} />
            <Text style={[styles.tabButtonText, activeTab === 'floor' && styles.tabButtonTextActive]}>
              Floor Tables ({tables.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'reservations' && styles.tabButtonActive]}
            onPress={() => setActiveTab('reservations')}
            activeOpacity={0.85}
          >
            <Calendar size={14} color={activeTab === 'reservations' ? '#D96B14' : '#7C6F62'} />
            <Text style={[styles.tabButtonText, activeTab === 'reservations' && styles.tabButtonTextActive]}>
              Advance Bookings
            </Text>
            {reservations.filter((r) => r.status === 'Confirmed').length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {reservations.filter((r) => r.status === 'Confirmed').length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ------------------- TAB 1: FLOOR TABLES ------------------- */}
        {activeTab === 'floor' && (
          <>
            {/* FLOOR STAFF PRESENCE BANNER */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginHorizontal: 16,
              marginTop: 10,
              marginBottom: 4,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: activeFloorWaitersCount > 0 ? '#ECFDF5' : '#FFFBEB',
              borderWidth: 1,
              borderColor: activeFloorWaitersCount > 0 ? '#A7F3D0' : '#FDE68A',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: activeFloorWaitersCount > 0 ? '#10B981' : '#F59E0B',
                }} />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activeFloorWaitersCount > 0 ? '#065F46' : '#92400E',
                }}>
                  {activeFloorWaitersCount > 0
                    ? `🟢 ${activeFloorWaitersCount} Waiter${activeFloorWaitersCount === 1 ? '' : 's'} on Duty`
                    : '⚠️ 0 Waiters on Duty — Table calls auto-route to POS Counter'}
                </Text>
              </View>

              <Text style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: activeFloorWaitersCount > 0 ? '#059669' : '#D97706',
              }}>
                {activeFloorWaitersCount > 0 ? 'Team Floor Mode' : 'Solo / Counter Fallback'}
              </Text>
            </View>

            {/* STATUS METRICS BAR */}
            <View style={styles.metricsBar}>
              <TouchableOpacity
                style={[styles.metricChip, selectedStatusFilter === 'All' && styles.metricChipActive]}
                onPress={() => setSelectedStatusFilter('All')}
                activeOpacity={0.8}
              >
                <Text style={[styles.metricNumber, selectedStatusFilter === 'All' && styles.metricNumberActive]}>
                  {tableMetrics.all}
                </Text>
                <Text style={[styles.metricLabel, selectedStatusFilter === 'All' && styles.metricLabelActive]}>
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, selectedStatusFilter === 'Available' && styles.metricChipActiveEmerald]}
                onPress={() => setSelectedStatusFilter('Available')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.statusDot, { backgroundColor: '#17845A' }]} />
                  <Text style={[styles.metricNumber, { color: '#17845A' }]}>{tableMetrics.available}</Text>
                </View>
                <Text style={styles.metricLabel}>Available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, selectedStatusFilter === 'Occupied' && styles.metricChipActiveRuby]}
                onPress={() => setSelectedStatusFilter('Occupied')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.statusDot, { backgroundColor: '#DE8626' }]} />
                  <Text style={[styles.metricNumber, { color: '#DE8626' }]}>{tableMetrics.occupied}</Text>
                </View>
                <Text style={styles.metricLabel}>Occupied</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, selectedStatusFilter === 'Reserved' && styles.metricChipActiveGold]}
                onPress={() => setSelectedStatusFilter('Reserved')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.statusDot, { backgroundColor: '#FEA619' }]} />
                  <Text style={[styles.metricNumber, { color: '#FEA619' }]}>{tableMetrics.reserved}</Text>
                </View>
                <Text style={styles.metricLabel}>Reserved</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metricChip, selectedStatusFilter === 'Billed' && styles.metricChipActiveBlue]}
                onPress={() => setSelectedStatusFilter('Billed')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.statusDot, { backgroundColor: '#346CB0' }]} />
                  <Text style={[styles.metricNumber, { color: '#346CB0' }]}>{tableMetrics.billed}</Text>
                </View>
                <Text style={styles.metricLabel}>Billed</Text>
              </TouchableOpacity>
            </View>

            {/* SEARCH ROW */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search size={14} color="#DE8626" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search table code, section or guest..."
                  placeholderTextColor="#9CA3AF"
                  value={searchTableQuery}
                  onChangeText={setSearchTableQuery}
                />
                {!!searchTableQuery && (
                  <TouchableOpacity onPress={() => setSearchTableQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={13} color="#8C7A6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* DYNAMIC SECTION STRIP */}
            <View style={styles.sectionStripContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionStripContent}>
                {uniqueSections.map((sec) => {
                  const count = sec === 'All' ? tables.length : tables.filter((t) => t.sectionName === sec).length;
                  const isSelected = selectedSection === sec;
                  return (
                    <TouchableOpacity
                      key={`sec-${sec}`}
                      style={[styles.sectionChip, isSelected && styles.sectionChipActive]}
                      onPress={() => setSelectedSection(sec)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sectionChipText, isSelected && styles.sectionChipTextActive]}>
                        {sec}
                      </Text>
                      <View style={[styles.sectionCountPill, isSelected && styles.sectionCountPillActive]}>
                        <Text style={[styles.sectionCountText, isSelected && styles.sectionCountTextActive]}>
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* TABLES GRID */}
            {loadingTables ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer}>
                <View style={styles.gridRow}>
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                </View>
                <View style={styles.gridRow}>
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                </View>
              </ScrollView>
            ) : filteredTables.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <TableIcon size={30} color="#DE8626" />
                </View>
                <Text style={styles.emptyTitle}>No Tables Found</Text>
                <Text style={styles.emptySubtext}>
                  {searchTableQuery || selectedSection !== 'All' || selectedStatusFilter !== 'All'
                    ? 'Try adjusting your search query, section or status filter.'
                    : 'Get started by creating your floor layout and table numbers.'}
                </Text>
                {searchTableQuery || selectedSection !== 'All' || selectedStatusFilter !== 'All' ? (
                  <TouchableOpacity
                    style={styles.resetFiltersBtn}
                    onPress={() => {
                      setSearchTableQuery('');
                      setSelectedSection('All');
                      setSelectedStatusFilter('All');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resetFiltersBtnText}>Reset All Filters</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyAddBtnWrapper}
                    onPress={() => {
                      setEditingTable(null);
                      setTableNumInput('');
                      setTableSeatsInput('4');
                      setTableMinSeatsInput('2');
                      setTableSectionInput('Main Hall');
                      setTableOnlineBookable(true);
                      setAddTableModalVisible(true);
                    }}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.emptyAddBtnGradient}
                    >
                      <Plus size={15} color="#FFFFFF" strokeWidth={3} />
                      <Text style={styles.emptyAddBtnText}>Add First Table</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredTables}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const theme = getTableCardTheme(item.status || 'Available');
                  const formattedNum = formatTableNumber(item.tableNumber);

                  return (
                    <View style={styles.tableCardOuter}>
                      <TouchableOpacity
                        style={[styles.tableCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                        onPress={() => setSelectedTableAction(item)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.tableCardTop}>
                          <View style={styles.sectionBadge}>
                            <Text style={styles.sectionBadgeText} numberOfLines={1}>
                              {item.sectionName || 'Floor'}
                            </Text>
                          </View>
                          <View style={styles.seatsBadge}>
                            <Users size={11} color="#7C6F62" />
                            <Text style={styles.seatsText}>{item.seatingCapacity || 4}</Text>
                          </View>
                        </View>

                        <View style={styles.tableNumberCenter}>
                          <Text style={[styles.tableNum, { color: theme.numColor }]}>
                            {formattedNum}
                          </Text>
                          {item.isOnlineBookable === false && (
                            <View style={styles.walkInOnlyTag}>
                              <Text style={styles.walkInOnlyTagText}>WALK-IN ONLY</Text>
                            </View>
                          )}
                          {item.status === 'Reserved' && item.currentReservationGuestName && (
                            <Text style={styles.tableResSubtext} numberOfLines={1}>
                              {item.currentReservationGuestName} • {item.currentReservationTime}
                            </Text>
                          )}
                          {item.status === 'Occupied' && item.occupiedSince && (
                            <Text style={styles.tableOccupiedSubtext} numberOfLines={1}>
                              Since {item.occupiedSince}
                            </Text>
                          )}
                        </View>

                        <View style={styles.tableCardBottom}>
                          <View style={[styles.statusPill, { backgroundColor: theme.badgeBg }]}>
                            <View style={[styles.statusDotSmall, { backgroundColor: theme.dotColor }]} />
                            <Text style={[styles.statusPillText, { color: theme.badgeColor }]}>
                              {theme.label}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.qrIconBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedTableForQr(item);
                              setQrModalVisible(true);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <QrCode size={13} color="#7C6F62" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </>
        )}

        {/* ------------------- TAB 2: ADVANCE RESERVATIONS ------------------- */}
        {activeTab === 'reservations' && (
          <>
            {/* DATE SELECTOR CAROUSEL */}
            <View style={styles.dateSelectorContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStripContent}>
                {dateOptions.map((item) => {
                  const isSelected = selectedDate === item.iso;
                  const isBlocked = isDateBlocked(item.iso);
                  return (
                    <TouchableOpacity
                      key={`date-${item.iso}`}
                      style={[
                        styles.dateCard,
                        isSelected && styles.dateCardActive,
                        isBlocked && styles.dateCardBlocked,
                      ]}
                      onPress={() => setSelectedDate(item.iso)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dateCardDay, isSelected && styles.dateCardDayActive, isBlocked && styles.dateCardDayBlocked]}>
                        {item.dayName}
                      </Text>
                      <Text style={[styles.dateCardMonthDay, isSelected && styles.dateCardMonthDayActive, isBlocked && styles.dateCardMonthDayBlocked]}>
                        {item.monthDay}
                      </Text>
                      {isBlocked && (
                        <View style={styles.dateBlockedPill}>
                          <Text style={styles.dateBlockedPillText}>BLOCKED</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* DATE CONTROL & BLACKOUT TOGGLE BAR */}
            <View style={styles.dateControlBar}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color="#DE8626" />
                <Text style={styles.dateControlText}>
                  {selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate}
                </Text>
                {isDateBlocked(selectedDate) ? (
                  <View style={styles.blockedBadge}>
                    <Ban size={10} color="#DC2626" />
                    <Text style={styles.blockedBadgeText}>DISABLED</Text>
                  </View>
                ) : (
                  <View style={styles.activeDateBadge}>
                    <CheckCircle2 size={10} color="#17845A" />
                    <Text style={styles.activeDateBadgeText}>ACTIVE</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.toggleBlockBtn,
                  isDateBlocked(selectedDate) ? styles.toggleBlockBtnUnblock : styles.toggleBlockBtnBlock,
                ]}
                onPress={handleToggleDateBlock}
                activeOpacity={0.8}
              >
                {isDateBlocked(selectedDate) ? (
                  <>
                    <CheckCircle2 size={12} color="#FFFFFF" />
                    <Text style={styles.toggleBlockBtnTextUnblock}>Unblock Date</Text>
                  </>
                ) : (
                  <>
                    <Ban size={12} color="#DC2626" />
                    <Text style={styles.toggleBlockBtnTextBlock}>Block Date</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* BLACKOUT WARNING BANNER */}
            {isDateBlocked(selectedDate) && (
              <View style={styles.blackoutWarningCard}>
                <AlertTriangle size={16} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blackoutWarningTitle}>Advance Bookings Disabled for {selectedDate}</Text>
                  <Text style={styles.blackoutWarningSub}>
                    Online customers and guests cannot reserve tables on this date. Existing bookings remain intact.
                  </Text>
                </View>
              </View>
            )}

            {/* RESERVATIONS METRIC SUMMARY */}
            <View style={styles.resMetricsRow}>
              <View style={styles.resMetricBox}>
                <Text style={styles.resMetricVal}>{reservationMetrics.total}</Text>
                <Text style={styles.resMetricLbl}>Bookings</Text>
              </View>
              <View style={styles.resMetricDivider} />
              <View style={styles.resMetricBox}>
                <Text style={styles.resMetricVal}>{reservationMetrics.totalGuests}</Text>
                <Text style={styles.resMetricLbl}>Guests</Text>
              </View>
              <View style={styles.resMetricDivider} />
              <View style={styles.resMetricBox}>
                <Text style={[styles.resMetricVal, { color: '#FEA619' }]}>{reservationMetrics.confirmed}</Text>
                <Text style={styles.resMetricLbl}>Confirmed</Text>
              </View>
              <View style={styles.resMetricDivider} />
              <View style={styles.resMetricBox}>
                <Text style={[styles.resMetricVal, { color: '#17845A' }]}>{reservationMetrics.seated}</Text>
                <Text style={styles.resMetricLbl}>Seated</Text>
              </View>
            </View>

            {/* SEARCH & STATUS FILTER */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search size={14} color="#DE8626" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search guest name, phone, or code..."
                  placeholderTextColor="#9CA3AF"
                  value={searchResQuery}
                  onChangeText={setSearchResQuery}
                />
                {!!searchResQuery && (
                  <TouchableOpacity onPress={() => setSearchResQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={13} color="#8C7A6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* STATUS CHIPS */}
            <View style={styles.resStatusFilterStrip}>
              {(['All', 'Confirmed', 'Seated', 'Completed', 'Cancelled', 'NoShow'] as const).map((st) => {
                const isSelected = selectedResStatusFilter === st;
                return (
                  <TouchableOpacity
                    key={`res-st-${st}`}
                    style={[styles.resStatusChip, isSelected && styles.resStatusChipActive]}
                    onPress={() => setSelectedResStatusFilter(st)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.resStatusChipText, isSelected && styles.resStatusChipTextActive]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* RESERVATIONS LIST */}
            {loadingReservations ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <ActivityIndicator size="large" color="#DE8626" />
                <Text style={{ marginTop: 12, color: '#7C6F62', fontSize: 12, fontWeight: '600' }}>
                  Loading reservations for {selectedDate}...
                </Text>
              </View>
            ) : filteredReservations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Calendar size={30} color="#DE8626" />
                </View>
                <Text style={styles.emptyTitle}>No Reservations for {selectedDate}</Text>
                <Text style={styles.emptySubtext}>
                  {searchResQuery || selectedResStatusFilter !== 'All'
                    ? 'No reservations matched your filter criteria.'
                    : 'No advance bookings placed for this date yet. Tap + Booking to add one.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtnWrapper}
                  onPress={() => {
                    setResGuestName('');
                    setResGuestPhone('');
                    setResGuestCount('2');
                    setResDate(selectedDate);
                    setResTime('07:30 PM');
                    setResSection(uniqueSections[1] || 'Main Hall');
                    setResTableId(null);
                    setResNotes('');
                    setNewBookingModalVisible(true);
                  }}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyAddBtnGradient}
                  >
                    <Plus size={15} color="#FFFFFF" strokeWidth={3} />
                    <Text style={styles.emptyAddBtnText}>Create New Booking</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredReservations}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isConfirmed = item.status === 'Confirmed';
                  const isSeated = item.status === 'Seated';

                  return (
                    <View style={styles.resCard}>
                      {/* Top Row */}
                      <View style={styles.resCardHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.resGuestName}>{item.customerName}</Text>
                            <View style={styles.resCodeBadge}>
                              <Text style={styles.resCodeBadgeText}>{item.reservationCode || `RES-${item.id}`}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Phone size={11} color="#7C6F62" />
                              <Text style={styles.resGuestPhone}>{item.customerPhone}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Users size={11} color="#7C6F62" />
                              <Text style={styles.resGuestCount}>{item.guestCount} Guests</Text>
                            </View>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View
                            style={[
                              styles.resStatusBadge,
                              item.status === 'Confirmed' && { backgroundColor: '#FFF3DC', borderColor: '#FEA619' },
                              item.status === 'Seated' && { backgroundColor: '#E4F5EC', borderColor: '#17845A' },
                              item.status === 'Completed' && { backgroundColor: '#EBF5FF', borderColor: '#346CB0' },
                              (item.status === 'Cancelled' || item.status === 'NoShow') && {
                                backgroundColor: '#FEE2E2',
                                borderColor: '#EF4444',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.resStatusBadgeText,
                                item.status === 'Confirmed' && { color: '#D97706' },
                                item.status === 'Seated' && { color: '#17845A' },
                                item.status === 'Completed' && { color: '#346CB0' },
                                (item.status === 'Cancelled' || item.status === 'NoShow') && { color: '#DC2626' },
                              ]}
                            >
                              {item.status.toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.resTimePill}>
                            <Clock size={11} color="#5C4E3D" />
                            <Text style={styles.resTimePillText}>{item.reservationTime}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Middle Details */}
                      <View style={styles.resCardDetailsRow}>
                        <View style={styles.resDetailItem}>
                          <Text style={styles.resDetailLabel}>SECTION</Text>
                          <Text style={styles.resDetailValue}>{item.sectionName || 'Any Section'}</Text>
                        </View>
                        <View style={styles.resDetailItem}>
                          <Text style={styles.resDetailLabel}>TABLE</Text>
                          <Text
                            style={[
                              styles.resDetailValue,
                              !item.tableNumber && { color: '#D97706', fontStyle: 'italic' },
                            ]}
                          >
                            {item.tableNumber ? formatTableNumber(item.tableNumber) : 'Unassigned'}
                          </Text>
                        </View>
                        {item.isDepositRequired && (
                          <View style={styles.resDetailItem}>
                            <Text style={styles.resDetailLabel}>DEPOSIT</Text>
                            <Text style={[styles.resDetailValue, { color: '#17845A' }]}>
                              ₹{item.depositAmount} ({item.depositPaymentStatus})
                            </Text>
                          </View>
                        )}
                      </View>

                      {!!item.specialNotes && (
                        <View style={styles.resNotesBox}>
                          <Text style={styles.resNotesText}>💬 {item.specialNotes}</Text>
                        </View>
                      )}

                      {/* Actions */}
                      <View style={styles.resCardActions}>
                        {isConfirmed && (
                          <>
                            <TouchableOpacity
                              style={styles.seatGuestBtn}
                              onPress={() => handleSeatReservation(item)}
                              activeOpacity={0.85}
                            >
                              <UserCheck size={13} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.seatGuestBtnText}>Seat Guest</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.assignTableBtn}
                              onPress={() => {
                                setSelectedResForAssignment(item);
                                setAssignTableModalVisible(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <TableIcon size={12} color="#5C4E3D" />
                              <Text style={styles.assignTableBtnText}>
                                {item.tableNumber ? 'Change Table' : 'Assign Table'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.moreActionChip}
                              onPress={() => handleUpdateReservationStatus(item.id, 'NoShow')}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.moreActionChipText}>No-Show</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.moreActionChip}
                              onPress={() => handleUpdateReservationStatus(item.id, 'Cancelled')}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.moreActionChipText, { color: '#DC2626' }]}>Cancel</Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {isSeated && (
                          <>
                            <TouchableOpacity
                              style={styles.completeResBtn}
                              onPress={() => handleUpdateReservationStatus(item.id, 'Completed')}
                              activeOpacity={0.8}
                            >
                              <CheckCircle2 size={13} color="#17845A" />
                              <Text style={styles.completeResBtnText}>Mark Completed</Text>
                            </TouchableOpacity>

                            {item.tableNumber && (
                              <TouchableOpacity
                                style={styles.openPosBtn}
                                onPress={() => onOpenPos && onOpenPos({ tableId: item.tableId || undefined, tableNumber: item.tableNumber, sectionName: item.sectionName })}
                                activeOpacity={0.8}
                              >
                                <ShoppingBag size={12} color="#D96B14" />
                                <Text style={styles.openPosBtnText}>View POS</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </>
        )}

        {/* ------------------- MODAL: CONTEXTUAL TABLE ACTION SHEET ------------------- */}
        <Modal visible={!!selectedTableAction} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.actionModalCard}>
              <View style={styles.actionModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.actionModalIconBox}>
                    <TableIcon size={20} color="#DE8626" />
                  </View>
                  <View>
                    <Text style={styles.actionModalTitle}>
                      Table {formatTableNumber(selectedTableAction?.tableNumber)}
                    </Text>
                    <Text style={styles.actionModalSubtitle}>
                      {selectedTableAction?.sectionName || 'Main Hall'} • {selectedTableAction?.seatingCapacity || 4} Seats • {selectedTableAction?.status}
                    </Text>
                    {selectedTableAction?.isOnlineBookable === false ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' }}>
                        <Ban size={10} color="#DC2626" />
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#DC2626' }}>ADVANCE BOOKINGS BLOCKED (WALK-IN ONLY)</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E4F5EC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' }}>
                        <CheckCircle2 size={10} color="#17845A" />
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#17845A' }}>ONLINE & ADVANCE BOOKABLE</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedTableAction(null)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              {/* Status Specific Actions */}
              <View style={styles.actionOptionsList}>
                {selectedTableAction?.status === 'Available' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionRowBtnPrimary}
                      onPress={() => {
                        const target = selectedTableAction;
                        if (!target) return;
                        setSelectedTableAction(null);
                        if (onOpenPos) onOpenPos({ tableId: target.id, tableNumber: target.tableNumber, sectionName: target.sectionName });
                      }}
                      activeOpacity={0.88}
                    >
                      <ShoppingBag size={16} color="#FFFFFF" />
                      <Text style={styles.actionRowBtnPrimaryText}>Start Dine-In Order (POS)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => {
                        const target = selectedTableAction;
                        if (!target) return;
                        if (target.isOnlineBookable === false) {
                          showAlert(
                            'Table Advance Booking Disabled',
                            `Table ${formatTableNumber(target.tableNumber)} is set to Walk-in Only (advance booking disabled). Do you want to proceed with a manual staff booking for this table?`,
                            'warning',
                            'Proceed',
                            'Cancel',
                            () => {
                              setSelectedTableAction(null);
                              setResGuestName('');
                              setResGuestPhone('');
                              setResGuestCount(String(target.seatingCapacity || 4));
                              setResDate(new Date().toISOString().split('T')[0]);
                              setResSection(target.sectionName || 'Main Hall');
                              setResTableId(target.id);
                              setNewBookingModalVisible(true);
                            }
                          );
                        } else {
                          setSelectedTableAction(null);
                          setResGuestName('');
                          setResGuestPhone('');
                          setResGuestCount(String(target.seatingCapacity || 4));
                          setResDate(new Date().toISOString().split('T')[0]);
                          setResSection(target.sectionName || 'Main Hall');
                          setResTableId(target.id);
                          setNewBookingModalVisible(true);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Calendar size={16} color="#D96B14" />
                      <Text style={styles.actionRowBtnText}>Quick Reserve This Table</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedTableAction?.status === 'Occupied' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionRowBtnPrimary}
                      onPress={() => {
                        const target = selectedTableAction;
                        if (!target) return;
                        handleOpenActiveBill(target);
                      }}
                      activeOpacity={0.88}
                    >
                      <Receipt size={16} color="#FFFFFF" />
                      <Text style={styles.actionRowBtnPrimaryText}>View Active Running Bill</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => {
                        const target = selectedTableAction;
                        if (!target) return;
                        setSelectedTableAction(null);
                        if (onOpenPos) onOpenPos({ tableId: target.id, tableNumber: target.tableNumber, sectionName: target.sectionName });
                      }}
                      activeOpacity={0.7}
                    >
                      <ShoppingBag size={16} color="#D96B14" />
                      <Text style={[styles.actionRowBtnText, { color: '#D96B14', fontWeight: '700' }]}>
                        Add More Dishes / KOT (POS)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => selectedTableAction && handleFreeTable(selectedTableAction, false)}
                      activeOpacity={0.7}
                    >
                      <CheckCircle2 size={16} color="#17845A" />
                      <Text style={[styles.actionRowBtnText, { color: '#17845A', fontWeight: '700' }]}>
                        Free Table (Guests Left / Table Vacated)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => selectedTableAction && handleFreeTable(selectedTableAction, true)}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={16} color="#D97706" />
                      <Text style={[styles.actionRowBtnText, { color: '#D97706', fontWeight: '600' }]}>
                        Mark for Cleaning / Busing
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => selectedTableAction && handleUpdateTableStatus(selectedTableAction, 'Billed')}
                      activeOpacity={0.7}
                    >
                      <CheckCircle2 size={16} color="#346CB0" />
                      <Text style={styles.actionRowBtnText}>Mark as Billed (Awaiting Payment)</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedTableAction?.status === 'Cleaning' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionRowBtnPrimary}
                      onPress={() => selectedTableAction && handleFreeTable(selectedTableAction, false)}
                      activeOpacity={0.88}
                    >
                      <CheckCircle2 size={16} color="#FFFFFF" />
                      <Text style={styles.actionRowBtnPrimaryText}>Cleaning Done (Mark Available / Ready)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => {
                        const target = selectedTableAction;
                        if (!target) return;
                        handleUpdateTableStatus(target, 'Occupied');
                        if (onOpenPos) onOpenPos({ tableId: target.id, tableNumber: target.tableNumber, sectionName: target.sectionName });
                      }}
                      activeOpacity={0.7}
                    >
                      <UserCheck size={16} color="#5C4E3D" />
                      <Text style={styles.actionRowBtnText}>Seat Guests & Start Order</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedTableAction?.status === 'Reserved' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionRowBtnPrimary}
                      onPress={() => {
                        const target = selectedTableAction;
                        if (!target) return;
                        handleUpdateTableStatus(target, 'Occupied');
                        if (onOpenPos) onOpenPos({ tableId: target.id, tableNumber: target.tableNumber, sectionName: target.sectionName });
                      }}
                      activeOpacity={0.88}
                    >
                      <UserCheck size={16} color="#FFFFFF" />
                      <Text style={styles.actionRowBtnPrimaryText}>Seat Guests (Start Order)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => selectedTableAction && handleFreeTable(selectedTableAction, false)}
                      activeOpacity={0.7}
                    >
                      <Ban size={16} color="#DC2626" />
                      <Text style={[styles.actionRowBtnText, { color: '#DC2626' }]}>
                        Cancel Reservation / Release Table
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedTableAction?.status === 'Billed' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionRowBtnPrimary}
                      onPress={() => selectedTableAction && handleFreeTable(selectedTableAction, false)}
                      activeOpacity={0.88}
                    >
                      <CheckCircle2 size={16} color="#FFFFFF" />
                      <Text style={styles.actionRowBtnPrimaryText}>Settle Bill & Free Table</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => selectedTableAction && handleFreeTable(selectedTableAction, true)}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={16} color="#D97706" />
                      <Text style={[styles.actionRowBtnText, { color: '#D97706' }]}>
                        Mark for Cleaning / Busing
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionRowBtn}
                      onPress={() => selectedTableAction && handleUpdateTableStatus(selectedTableAction, 'Occupied')}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={16} color="#5C4E3D" />
                      <Text style={styles.actionRowBtnText}>Re-open Table (Occupied)</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Advance Booking Eligibility Toggle */}
                <TouchableOpacity
                  style={styles.actionRowBtn}
                  onPress={() => {
                    const target = selectedTableAction;
                    if (!target) return;
                    handleToggleTableAdvanceBooking(target);
                  }}
                  activeOpacity={0.7}
                >
                  {selectedTableAction?.isOnlineBookable === false ? (
                    <>
                      <CheckCircle2 size={15} color="#17845A" />
                      <Text style={[styles.actionRowBtnText, { color: '#17845A', fontWeight: '700' }]}>
                        Unblock Table (Enable Advance Booking)
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ban size={15} color="#DC2626" />
                      <Text style={[styles.actionRowBtnText, { color: '#DC2626', fontWeight: '700' }]}>
                        Block Table (Walk-in Only - Disable Advance Booking)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Common Operations */}
                <View style={styles.actionDivider} />

                <TouchableOpacity
                  style={styles.actionRowBtn}
                  onPress={() => {
                    const target = selectedTableAction;
                    if (!target) return;
                    setSelectedTableAction(null);
                    setSelectedTableForQr(target);
                    setQrModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <QrCode size={15} color="#DE8626" />
                  <Text style={[styles.actionRowBtnText, { color: '#DE8626', fontWeight: '600' }]}>
                    View & Print Table QR Code
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionRowBtn}
                  onPress={() => {
                    const target = selectedTableAction;
                    if (!target) return;
                    handleOpenTableHistory(target);
                  }}
                  activeOpacity={0.7}
                >
                  <History size={15} color="#4338CA" />
                  <Text style={[styles.actionRowBtnText, { color: '#4338CA', fontWeight: '700' }]}>
                    View Table Activity Timeline / History
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionRowBtn}
                  onPress={() => {
                    const target = selectedTableAction;
                    if (!target) return;
                    setSelectedTableAction(null);
                    setEditingTable(target);
                    setTableNumInput(target.tableNumber);
                    setTableSeatsInput(String(target.seatingCapacity || 4));
                    setTableMinSeatsInput(String(target.minSeatingCapacity || 2));
                    setTableSectionInput(target.sectionName || 'Main Hall');
                    setTableOnlineBookable(target.isOnlineBookable !== false);
                    setAddTableModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Edit2 size={15} color="#5C4E3D" />
                  <Text style={styles.actionRowBtnText}>Edit Table Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionRowBtnDanger}
                  onPress={() => selectedTableAction && handleDeleteTable(selectedTableAction)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color="#DC2626" />
                  <Text style={styles.actionRowBtnDangerText}>Delete Table</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ------------------- MODAL: ADD / EDIT TABLE ------------------- */}
        <Modal visible={addTableModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TableIcon size={18} color="#DE8626" />
                  <Text style={styles.modalTitle}>
                    {editingTable ? `Edit Table ${editingTable.tableNumber}` : 'Add New Table'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAddTableModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>TABLE NUMBER / CODE *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1, 2, 10, T-01, VIP-2"
                  placeholderTextColor="#9CA3AF"
                  value={tableNumInput}
                  onChangeText={setTableNumInput}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>MAX SEATS *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 4"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={tableSeatsInput}
                      onChangeText={setTableSeatsInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>MIN SEATS</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 2"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={tableMinSeatsInput}
                      onChangeText={setTableMinSeatsInput}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>FLOOR SECTION</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Main Hall, AC Dining, Rooftop, Terrace, VIP"
                  placeholderTextColor="#9CA3AF"
                  value={tableSectionInput}
                  onChangeText={setTableSectionInput}
                />

                {/* Quick Section Chips */}
                <View style={styles.quickChipRow}>
                  {availableSectionNames.map((sec) => (
                    <TouchableOpacity
                      key={`qs-${sec}`}
                      style={[styles.quickChip, tableSectionInput === sec && styles.quickChipActive]}
                      onPress={() => setTableSectionInput(sec)}
                    >
                      <Text style={[styles.quickChipText, tableSectionInput === sec && styles.quickChipTextActive]}>
                        {sec}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Allow Online Advance Booking</Text>
                    <Text style={styles.switchDesc}>Enable guests to reserve this table via online portal</Text>
                  </View>
                  <Switch
                    value={tableOnlineBookable}
                    onValueChange={setTableOnlineBookable}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={tableOnlineBookable ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.modalSubmitBtn}
                  onPress={handleSaveTable}
                  disabled={savingTable}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSubmitBtnGradient}
                  >
                    {savingTable ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.modalSubmitBtnText}>
                          {editingTable ? 'UPDATE TABLE' : 'SAVE TABLE'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ------------------- MODAL: NEW ADVANCE RESERVATION ------------------- */}
        <Modal visible={newBookingModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCardLarge}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Calendar size={18} color="#DE8626" />
                  <Text style={styles.modalTitle}>New Table Reservation</Text>
                </View>
                <TouchableOpacity onPress={() => setNewBookingModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={styles.inputLabel}>GUEST FULL NAME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#9CA3AF"
                  value={resGuestName}
                  onChangeText={setResGuestName}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>MOBILE NUMBER *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 9876543210"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={resGuestPhone}
                      onChangeText={setResGuestPhone}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>GUESTS (PARTY SIZE) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 4"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={resGuestCount}
                      onChangeText={setResGuestCount}
                    />
                  </View>
                </View>

                {/* DATE SELECTOR */}
                <Text style={styles.inputLabel}>RESERVATION DATE *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {dateOptions.map((d) => {
                      const isDateBlk = isDateBlocked(d.iso);
                      const isSelected = resDate === d.iso;
                      return (
                        <TouchableOpacity
                          key={`bdate-${d.iso}`}
                          style={[
                            styles.smallDateChip,
                            isSelected && styles.smallDateChipActive,
                            isDateBlk && styles.dateCardBlocked,
                          ]}
                          onPress={() => setResDate(d.iso)}
                        >
                          <Text
                            style={[
                              styles.smallDateChipText,
                              isSelected && styles.smallDateChipTextActive,
                              isDateBlk && styles.dateCardDayBlocked,
                            ]}
                          >
                            {d.dayName} ({d.monthDay}){isDateBlk ? ' 🚫' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {isDateBlocked(resDate) && (
                  <View style={[styles.blackoutWarningCard, { marginTop: 4, marginBottom: 10 }]}>
                    <AlertTriangle size={14} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blackoutWarningTitle}>Date is Blocked for Online Reservations</Text>
                      <Text style={styles.blackoutWarningSub}>
                        Creating this reservation will proceed as a manual staff booking override.
                      </Text>
                    </View>
                  </View>
                )}

                {/* TIME SLOT SELECTOR */}
                <Text style={styles.inputLabel}>TIME SLOT *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {TIME_SLOTS.map((ts) => (
                      <TouchableOpacity
                        key={`ts-${ts}`}
                        style={[styles.slotChip, resTime === ts && styles.slotChipActive]}
                        onPress={() => setResTime(ts)}
                      >
                        <Text style={[styles.slotChipText, resTime === ts && styles.slotChipTextActive]}>
                          {ts}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* SECTION SELECTOR */}
                <Text style={styles.inputLabel}>PREFERRED SECTION</Text>
                <View style={styles.quickChipRow}>
                  {uniqueSections.filter((s) => s !== 'All').map((sec) => (
                    <TouchableOpacity
                      key={`rsec-${sec}`}
                      style={[styles.quickChip, resSection === sec && styles.quickChipActive]}
                      onPress={() => setResSection(sec)}
                    >
                      <Text style={[styles.quickChipText, resSection === sec && styles.quickChipTextActive]}>
                        {sec}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ASSIGN SPECIFIC TABLE (OPTIONAL) */}
                <Text style={styles.inputLabel}>ASSIGN TABLE (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.tableSelectChip, resTableId === null && styles.tableSelectChipActive]}
                      onPress={() => setResTableId(null)}
                    >
                      <Text style={[styles.tableSelectChipText, resTableId === null && styles.tableSelectChipTextActive]}>
                        Auto-Assign Best Fit
                      </Text>
                    </TouchableOpacity>
                    {tables.map((t) => {
                      const isBlocked = t.isOnlineBookable === false;
                      const isSelected = resTableId === t.id;
                      return (
                        <TouchableOpacity
                          key={`tb-sel-${t.id}`}
                          style={[
                            styles.tableSelectChip,
                            isSelected && styles.tableSelectChipActive,
                            isBlocked && styles.tableSelectChipBlocked,
                          ]}
                          onPress={() => {
                            if (isBlocked) {
                              showAlert(
                                'Table Walk-in Only',
                                `Table ${formatTableNumber(t.tableNumber)} is currently set to Walk-in Only (advance booking blocked). Would you like to select it anyway as a manual staff assignment?`,
                                'warning',
                                'Select Table',
                                'Cancel',
                                () => setResTableId(t.id)
                              );
                            } else {
                              setResTableId(t.id);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.tableSelectChipText,
                              isSelected && styles.tableSelectChipTextActive,
                              isBlocked && styles.tableSelectChipTextBlocked,
                            ]}
                          >
                            {formatTableNumber(t.tableNumber)} ({t.seatingCapacity}s){isBlocked ? ' 🚫 Blocked' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <Text style={styles.inputLabel}>SPECIAL NOTES / OCCASION</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Anniversary, Quiet Corner, High Chair needed"
                  placeholderTextColor="#9CA3AF"
                  value={resNotes}
                  onChangeText={setResNotes}
                />

                {/* DEPOSIT TOGGLE */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Require Advance Deposit</Text>
                    <Text style={styles.switchDesc}>Collect deposit via UPI/Card to lock booking</Text>
                  </View>
                  <Switch
                    value={resRequireDeposit}
                    onValueChange={setResRequireDeposit}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={resRequireDeposit ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                {resRequireDeposit && (
                  <View style={{ marginTop: 6, marginBottom: 10 }}>
                    <Text style={styles.inputLabel}>DEPOSIT AMOUNT (₹)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 500"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={resDepositAmount}
                      onChangeText={setResDepositAmount}
                    />
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.modalSubmitBtn}
                  onPress={handleCreateBooking}
                  disabled={savingBooking}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSubmitBtnGradient}
                  >
                    {savingBooking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.modalSubmitBtnText}>CONFIRM RESERVATION</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ------------------- MODAL: ASSIGN TABLE TO RESERVATION ------------------- */}
        <Modal visible={assignTableModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TableIcon size={18} color="#DE8626" />
                  <Text style={styles.modalTitle}>Assign Table</Text>
                </View>
                <TouchableOpacity onPress={() => setAssignTableModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.assignModalSub}>
                Assign table for <Text style={{ fontWeight: '700', color: '#1F2937' }}>{selectedResForAssignment?.customerName}</Text> ({selectedResForAssignment?.guestCount} Guests) at {selectedResForAssignment?.reservationTime}:
              </Text>

              <FlatList
                data={tables}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => {
                  const isBlocked = item.isOnlineBookable === false;
                  return (
                    <TouchableOpacity
                      style={styles.assignTableRow}
                      onPress={() => {
                        if (isBlocked) {
                          showAlert(
                            'Table Walk-in Only',
                            `Table ${formatTableNumber(item.tableNumber)} is set to Walk-in Only (advance booking disabled). Do you want to assign it anyway to ${selectedResForAssignment?.customerName}?`,
                            'warning',
                            'Assign',
                            'Cancel',
                            () => handleAssignTableToRes(item)
                          );
                        } else {
                          handleAssignTableToRes(item);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.assignTableNum}>Table {formatTableNumber(item.tableNumber)}</Text>
                          {isBlocked && (
                            <View style={styles.walkInOnlyTag}>
                              <Text style={styles.walkInOnlyTagText}>WALK-IN ONLY</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.assignTableSub}>
                          {item.sectionName || 'Main Hall'} • {item.seatingCapacity} Seats • Status: {item.status}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#DE8626" />
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>

        {/* ------------------- MODAL: RESERVATION POLICY SETTINGS ------------------- */}
        <Modal visible={settingsModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCardLarge}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SlidersHorizontal size={18} color="#DE8626" />
                  <Text style={styles.modalTitle}>Reservation Rules & Policy</Text>
                </View>
                <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Enable Advance Table Bookings</Text>
                    <Text style={styles.switchDesc}>Allow guests to reserve tables online & via staff</Text>
                  </View>
                  <Switch
                    value={reservationConfig.isAdvanceBookingEnabled}
                    onValueChange={(val) => setReservationConfig((p) => ({ ...p, isAdvanceBookingEnabled: val }))}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={reservationConfig.isAdvanceBookingEnabled ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                <Text style={styles.inputLabel}>AVERAGE DINING SLOT DURATION</Text>
                <View style={styles.quickChipRow}>
                  {[45, 60, 75, 90, 120].map((mins) => (
                    <TouchableOpacity
                      key={`dur-${mins}`}
                      style={[
                        styles.quickChip,
                        reservationConfig.averageDiningDurationMinutes === mins && styles.quickChipActive,
                      ]}
                      onPress={() => setReservationConfig((p) => ({ ...p, averageDiningDurationMinutes: mins }))}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          reservationConfig.averageDiningDurationMinutes === mins && styles.quickChipTextActive,
                        ]}
                      >
                        {mins} Mins
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>NO-SHOW AUTO RELEASE GRACE PERIOD</Text>
                <View style={styles.quickChipRow}>
                  {[10, 15, 20, 30].map((mins) => (
                    <TouchableOpacity
                      key={`grace-${mins}`}
                      style={[
                        styles.quickChip,
                        reservationConfig.autoReleaseGracePeriodMinutes === mins && styles.quickChipActive,
                      ]}
                      onPress={() => setReservationConfig((p) => ({ ...p, autoReleaseGracePeriodMinutes: mins }))}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          reservationConfig.autoReleaseGracePeriodMinutes === mins && styles.quickChipTextActive,
                        ]}
                      >
                        {mins} Mins
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>ADVANCE BOOKING WINDOW</Text>
                <View style={styles.quickChipRow}>
                  {[7, 14, 30, 60].map((days) => (
                    <TouchableOpacity
                      key={`win-${days}`}
                      style={[
                        styles.quickChip,
                        reservationConfig.advanceBookingWindowDays === days && styles.quickChipActive,
                      ]}
                      onPress={() => setReservationConfig((p) => ({ ...p, advanceBookingWindowDays: days }))}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          reservationConfig.advanceBookingWindowDays === days && styles.quickChipTextActive,
                        ]}
                      >
                        {days} Days Ahead
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Mandatory Advance Deposit</Text>
                    <Text style={styles.switchDesc}>Require per-guest deposit to secure table</Text>
                  </View>
                  <Switch
                    value={reservationConfig.requireAdvanceDeposit}
                    onValueChange={(val) => setReservationConfig((p) => ({ ...p, requireAdvanceDeposit: val }))}
                    trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                    thumbColor={reservationConfig.requireAdvanceDeposit ? '#DE8626' : '#9CA3AF'}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.modalSubmitBtn}
                  onPress={handleSavePolicySettings}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSubmitBtnGradient}
                  >
                    <CheckCircle2 size={16} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>SAVE RESERVATION RULES</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ------------------- MODAL: ACTIVE RUNNING BILL ------------------- */}
        <Modal visible={activeBillModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCardLarge}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Receipt size={18} color="#DE8626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      Table {formatTableNumber(activeTableBillTarget?.tableNumber)} Bill
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {activeTableBillTarget?.sectionName || 'Main Hall'} • Seated {activeTableBillTarget?.occupiedSince ? `Since ${activeTableBillTarget.occupiedSince}` : 'Now'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setActiveBillModalVisible(false)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              {loadingActiveBill ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <ActivityIndicator size="large" color="#DE8626" />
                  <Text style={{ color: '#8C7A6B', fontSize: 13, fontWeight: '600' }}>
                    Fetching live active bill & running KOT...
                  </Text>
                </View>
              ) : activeTableOrder ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                  {/* ORDER META CARD */}
                  <View style={styles.activeBillMetaCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={styles.activeBillOrderNum}>Order #{activeTableOrder.orderNumber || activeTableOrder.id}</Text>
                        <Text style={styles.activeBillOrderTime}>
                          {activeTableOrder.createdAt
                            ? formatToIstTime(activeTableOrder.createdAt)
                            : 'Active'} • {activeTableOrder.orderTypeName || 'Dine-In'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View
                          style={[
                            styles.activeBillStatusPill,
                            {
                              backgroundColor:
                                activeTableOrder.paymentStatus === 'PAID' ? '#EBF8F1' : '#FFF8EB',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.activeBillStatusText,
                              {
                                color:
                                  activeTableOrder.paymentStatus === 'PAID' ? '#15803D' : '#B45309',
                              },
                            ]}
                          >
                            {activeTableOrder.paymentStatus === 'PAID' ? 'PAID ONLINE' : 'PAYMENT PENDING'}
                          </Text>
                        </View>
                        <Text style={styles.activeBillPaymentMode}>Mode: {activeTableOrder.paymentMode || 'CASH'}</Text>
                      </View>
                    </View>

                    {/* Customer & Token details if present */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: '#F5EFE8',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#5C4E3D' }}>
                        👤 {activeTableOrder.customerName || 'Walk-in Guest'}
                        {activeTableOrder.mobileNumber ? ` • ${activeTableOrder.mobileNumber}` : ''}
                      </Text>
                      {activeTableOrder.pickupToken && (
                        <View
                          style={{
                            backgroundColor: '#FFF0DE',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: '#FED7AA',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#D96B14' }}>
                            Token #{activeTableOrder.pickupToken}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* ITEM LIST */}
                  <Text style={styles.activeBillSectionTitle}>
                    ORDERED ITEMS ({activeTableOrder.items?.length || 0})
                  </Text>
                  <View style={styles.activeBillItemsBox}>
                    {activeTableOrder.items && activeTableOrder.items.length > 0 ? (
                      activeTableOrder.items.map((item, idx) => (
                        <View key={`bill-item-${idx}`} style={styles.activeBillItemRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.activeBillItemName}>{item.itemName || `Item ${idx + 1}`}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                              <Text style={styles.activeBillItemSub}>
                                ₹{item.unitPrice} × {item.quantity}
                              </Text>
                              {(item.stationName || item.stationCode) ? (
                                <View
                                  style={{
                                    backgroundColor: `${item.stationBadgeColor || '#DE8626'}18`,
                                    borderColor: item.stationBadgeColor || '#DE8626',
                                    borderWidth: 1,
                                    borderRadius: 3,
                                    paddingHorizontal: 5,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 8.5,
                                      fontWeight: '700',
                                      color: item.stationBadgeColor || '#DE8626',
                                    }}
                                  >
                                    {item.stationName || item.stationCode}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.activeBillItemTotal}>
                            ₹{((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: '#8C7A6B', padding: 12, textAlign: 'center', fontSize: 12 }}>
                        No item breakdown available for this active ticket.
                      </Text>
                    )}
                  </View>

                  {/* BILL CALCULATION TOTAL */}
                  <View style={styles.activeBillTotalCard}>
                    {activeTableOrder.subtotal && activeTableOrder.subtotal > 0 ? (
                      <>
                        <View style={[styles.activeBillTotalRow, { marginBottom: 4 }]}>
                          <Text style={{ fontSize: 11.5, color: '#7C6F62', fontWeight: '600' }}>Subtotal</Text>
                          <Text style={{ fontSize: 12, color: '#1F2937', fontWeight: '700' }}>
                            ₹{Number(activeTableOrder.subtotal).toFixed(2)}
                          </Text>
                        </View>
                        {Boolean(activeTableOrder.cgst && activeTableOrder.cgst > 0) && (
                          <View style={[styles.activeBillTotalRow, { marginBottom: 4 }]}>
                            <Text style={{ fontSize: 11, color: '#7C6F62', fontWeight: '500' }}>CGST</Text>
                            <Text style={{ fontSize: 11.5, color: '#1F2937', fontWeight: '600' }}>
                              ₹{Number(activeTableOrder.cgst).toFixed(2)}
                            </Text>
                          </View>
                        )}
                        {Boolean(activeTableOrder.sgst && activeTableOrder.sgst > 0) && (
                          <View style={[styles.activeBillTotalRow, { marginBottom: 4 }]}>
                            <Text style={{ fontSize: 11, color: '#7C6F62', fontWeight: '500' }}>SGST</Text>
                            <Text style={{ fontSize: 11.5, color: '#1F2937', fontWeight: '600' }}>
                              ₹{Number(activeTableOrder.sgst).toFixed(2)}
                            </Text>
                          </View>
                        )}
                        <View style={{ height: 1, backgroundColor: '#FED7AA', marginVertical: 6 }} />
                      </>
                    ) : null}
                    <View style={styles.activeBillTotalRow}>
                      <Text style={styles.activeBillTotalLabel}>
                        {activeTableOrder.paidAmount !== undefined && activeTableOrder.paidAmount > 0
                          ? 'Total Session Value'
                          : 'Grand Total'}
                      </Text>
                      <Text style={styles.activeBillGrandTotal}>
                        ₹{Number(activeTableOrder.totalAmount || 0).toFixed(2)}
                      </Text>
                    </View>

                    {/* Paid & Pending Breakdown for Multi-Order Sessions */}
                    {activeTableOrder.paidAmount !== undefined && activeTableOrder.paidAmount > 0 && (
                      <>
                        <View style={[styles.activeBillTotalRow, { marginTop: 4 }]}>
                          <Text style={{ fontSize: 11.5, color: '#15803D', fontWeight: '600' }}>
                            ✓ Already Paid ({activeTableOrder.paidOrdersCount || 0} order{(activeTableOrder.paidOrdersCount || 0) > 1 ? 's' : ''})
                          </Text>
                          <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '700' }}>
                            - ₹{Number(activeTableOrder.paidAmount).toFixed(2)}
                          </Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: '#FED7AA', marginVertical: 6 }} />
                        <View style={styles.activeBillTotalRow}>
                          <Text style={[styles.activeBillTotalLabel, { color: '#B45309', fontWeight: '800' }]}>
                            {activeTableOrder.pendingAmount !== undefined && activeTableOrder.pendingAmount > 0
                              ? 'Balance Due'
                              : 'Balance Status'}
                          </Text>
                          <Text
                            style={[
                              styles.activeBillGrandTotal,
                              {
                                color:
                                  activeTableOrder.pendingAmount !== undefined && activeTableOrder.pendingAmount > 0
                                    ? '#DC2626'
                                    : '#15803D',
                              },
                            ]}
                          >
                            {activeTableOrder.pendingAmount !== undefined && activeTableOrder.pendingAmount > 0
                              ? `₹${Number(activeTableOrder.pendingAmount).toFixed(2)}`
                              : 'Fully Paid 🟢'}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* ACTION BUTTONS */}
                  <View style={{ gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={styles.activeBillAddKotBtn}
                      onPress={() => {
                        const target = activeTableBillTarget;
                        setActiveBillModalVisible(false);
                        if (target && onOpenPos) {
                          onOpenPos({ tableId: target.id, tableNumber: target.tableNumber, sectionName: target.sectionName });
                        }
                      }}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.activeBillAddKotGradient}
                      >
                        <ShoppingBag size={16} color="#FFFFFF" />
                        <Text style={styles.activeBillAddKotText}>+ Add More Dishes / KOT (POS)</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={styles.activeBillPrintBtn}
                        onPress={() => {
                          if (activeTableOrder) {
                            const effectiveSubtotal = activeTableOrder.subtotal && activeTableOrder.subtotal > 0
                              ? activeTableOrder.subtotal
                              : (activeTableOrder.items || []).reduce((acc, it) => acc + (it.unitPrice || 0) * (it.quantity || 1), 0);

                            printReceipt({
                              restaurantName: activeRestaurant?.restaurantName || activeTableOrder.restaurantName || 'Menza Bistro',
                              address: activeRestaurant?.address || activeTableOrder.address,
                              city: activeRestaurant?.city || activeTableOrder.city,
                              state: activeRestaurant?.state || activeTableOrder.state,
                              contactPhone: activeRestaurant?.ownerMobile || (activeRestaurant as any)?.contactNumber || activeTableOrder.contactPhone || '',
                              gstNumber: activeTableOrder.gstNumber || (activeRestaurant as any)?.gstNumber,
                              orderId: activeTableOrder.id,
                              orderNumber: activeTableOrder.orderNumber || String(activeTableOrder.id),
                              pickupToken: activeTableOrder.pickupToken,
                              date: activeTableOrder.createdAt || new Date().toISOString(),
                              tableName: activeTableBillTarget?.tableNumber ? `Table ${activeTableBillTarget.tableNumber}` : activeTableOrder.tableName,
                              sectionName: activeTableBillTarget?.sectionName || (activeTableOrder as any).sectionName,
                              orderType: 'Dine-In',
                              subtotal: effectiveSubtotal,
                              discountAmount: activeTableOrder.discountAmount,
                              cgstAmount: activeTableOrder.cgst,
                              sgstAmount: activeTableOrder.sgst,
                              taxAmount: (activeTableOrder.cgst || 0) + (activeTableOrder.sgst || 0),
                              paymentMode: activeTableOrder.paymentMode || 'PAY LATER',
                              paymentStatus: activeTableOrder.paymentStatus,
                              items: (activeTableOrder.items || []).map((it) => ({
                                itemName: it.itemName || 'Dish',
                                quantity: it.quantity || 1,
                                unitPrice: it.unitPrice || 0,
                                totalAmount: (it.unitPrice || 0) * (it.quantity || 1),
                              })),
                              grandTotal: Number(activeTableOrder.totalAmount || 0),
                            });
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Printer size={15} color="#5C4E3D" />
                        <Text style={styles.activeBillPrintBtnText}>Print Bill</Text>
                      </TouchableOpacity>

                      {(activeTableOrder.pendingAmount !== undefined ? activeTableOrder.pendingAmount > 0 : activeTableOrder.paymentStatus !== 'PAID') ? (
                        <TouchableOpacity
                          style={[styles.activeBillFreeBtn, { backgroundColor: '#DE8626', borderColor: '#CB741B' }]}
                          onPress={handleSettleTableFromBillModal}
                          activeOpacity={0.85}
                        >
                          <CreditCard size={15} color="#FFFFFF" />
                          <Text style={[styles.activeBillFreeBtnText, { color: '#FFFFFF' }]}>
                            {activeTableOrder.pendingAmount !== undefined && activeTableOrder.pendingAmount > 0
                              ? `Settle (₹${activeTableOrder.pendingAmount.toFixed(0)})`
                              : 'Settle & Free'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.activeBillFreeBtn}
                          onPress={() => {
                            setActiveBillModalVisible(false);
                            if (activeTableBillTarget) {
                              handleFreeTable(activeTableBillTarget, false);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <CheckCircle2 size={15} color="#15803D" />
                          <Text style={styles.activeBillFreeBtnText}>Free Table</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </ScrollView>
              ) : (
                <View style={{ paddingVertical: 30, alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1917' }}>
                    No Active Running Bill Found
                  </Text>
                  <Text style={{ fontSize: 12, color: '#8C7A6B', textAlign: 'center', paddingHorizontal: 20 }}>
                    Table {formatTableNumber(activeTableBillTarget?.tableNumber)} is marked occupied but does not have a recorded running ticket yet.
                  </Text>
                  <TouchableOpacity
                    style={styles.activeBillAddKotBtn}
                    onPress={() => {
                      const target = activeTableBillTarget;
                      setActiveBillModalVisible(false);
                      if (target && onOpenPos) {
                        onOpenPos({ tableId: target.id, tableNumber: target.tableNumber, sectionName: target.sectionName });
                      }
                    }}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.activeBillAddKotGradient}
                    >
                      <Plus size={16} color="#FFFFFF" />
                      <Text style={styles.activeBillAddKotText}>Start Dine-In Order (POS)</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* TABLE ACTIVITY TIMELINE / HISTORY MODAL */}
        <Modal visible={historyModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.actionModalCard, { maxWidth: 540, maxHeight: '85%' }]}>
              <View style={styles.actionModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.actionModalIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <History size={20} color="#4338CA" />
                  </View>
                  <View>
                    <Text style={styles.actionModalTitle}>
                      Table {formatTableNumber(historyTable?.tableNumber)} Timeline
                    </Text>
                    <Text style={styles.actionModalSubtitle}>
                      {historyTable?.sectionName || 'Main Hall'} • Status: {historyTable?.status}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setHistoryModalVisible(false)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={16} color="#8C7A6B" />
                </TouchableOpacity>
              </View>

              {isLoadingTableHistory ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                  <ActivityIndicator size="small" color="#4338CA" />
                  <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>
                    Fetching activity timeline...
                  </Text>
                </View>
              ) : tableHistoryList.length === 0 ? (
                <View style={{ paddingVertical: 36, alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                    <History size={24} color="#9CA3AF" />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>
                    No Activity Logged Yet
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 18 }}>
                    Table lifecycle events (seating, KOT orders, bill settlement, cleaning turnover) will appear here in chronological order.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 420, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
                  <View style={{ paddingTop: 8, paddingBottom: 16 }}>
                    {tableHistoryList.map((item, idx) => {
                      const isLast = idx === tableHistoryList.length - 1;
                      const dateStr = item.createdDateUTC ? formatToIstTime(item.createdDateUTC) : '';
                      return (
                        <View key={`hist-${item.id || idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                          <View style={{ width: 68, alignItems: 'flex-start' }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>
                              {dateStr}
                            </Text>
                            {!isLast && (
                              <View style={{ width: 2, flex: 1, backgroundColor: '#E5E7EB', marginLeft: 16, marginTop: 4, minHeight: 24 }} />
                            )}
                          </View>
                          <View style={{ width: 18, alignItems: 'center', paddingTop: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4338CA' }} />
                          </View>
                          <View style={{ flex: 1, paddingLeft: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                                {item.action ? item.action.replace(/_/g, ' ') : 'Status Updated'}
                              </Text>
                              {item.durationMinutes !== undefined && item.durationMinutes > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                  <Clock size={10} color="#4B5563" />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#4B5563' }}>
                                    {item.durationMinutes}m
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500' }}>
                                  {item.fromStatus}
                                </Text>
                              </View>
                              <ArrowRight size={10} color="#9CA3AF" />
                              <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 11, color: '#4338CA', fontWeight: '700' }}>
                                  {item.toStatus}
                                </Text>
                              </View>
                            </View>
                            {(item.performedByRole || item.customerName || item.remarks) ? (
                              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' }}>
                                {item.performedByRole ? `Role: ${item.performedByRole}` : ''}
                                {item.customerName ? ` • Guest: ${item.customerName}` : ''}
                                {item.guestCount ? ` (${item.guestCount} guests)` : ''}
                                {item.remarks ? ` • "${item.remarks}"` : ''}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' }}
                  onPress={() => historyTable && handleOpenTableHistory(historyTable)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#374151' }}>Refresh Timeline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#4338CA', alignItems: 'center' }}
                  onPress={() => setHistoryModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* RESTAURANT & TABLE QR CODE & SHARE MODAL */}
        <RestaurantQrModal
          visible={qrModalVisible}
          onClose={() => setQrModalVisible(false)}
          restaurant={activeRestaurant}
          tableId={selectedTableForQr?.id}
          tableNumber={selectedTableForQr?.tableNumber}
          tables={tables}
          sections={dbSections}
        />

        <WalletRechargeModal
          visible={walletModalVisible}
          restaurantId={restId}
          onClose={() => {
            setWalletModalVisible(false);
            loadRestaurantConfig();
          }}
          onRechargeSuccess={() => {
            loadRestaurantConfig();
          }}
        />

        {/* CASHIER BILL SETTLEMENT MODAL */}
        <CashierSettlementModal
          visible={settlementModalVisible}
          order={orderToSettle}
          restaurantId={restId}
          restaurantName={activeRestaurant?.restaurantName || 'Menza Bistro'}
          onClose={() => {
            setSettlementModalVisible(false);
            setOrderToSettle(null);
          }}
          onSettlementSuccess={async (res) => {
            setSettlementModalVisible(false);
            const target = activeTableBillTarget;
            setOrderToSettle(null);
            setActiveTableBillTarget(null);
            setActiveTableOrder(null);
            if (target) {
              try {
                await tableRepository.freeTable(target.id, {
                  restaurantId: restId,
                  transitionToCleaning: false,
                  releasedByRole: 'STAFF',
                });
              } catch {}
            }
            showAlert(
              'Table Settled & Vacated! 🟢',
              `Table ${formatTableNumber(target?.tableNumber)} bill settled via ${res.paymentMode || 'Cash'} (₹${(res.totalAmount ?? orderToSettle?.totalAmount ?? 0).toFixed(2)}). Table is now Available.`,
              'success'
            );
            loadTables();
          }}
        />

        <GildedAlertModal {...alertConfig} onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { flex: 1, backgroundColor: '#FAF7F2', paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
  },
  headerLeftCol: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 8 },
  headerLogo: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(222, 134, 38, 0.25)', backgroundColor: '#FFFFFF' },
  headerOutletTitle: { color: '#1C1917', fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  headerOutletSubtitle: { color: '#78716C', fontSize: 10.5, fontWeight: '500', marginTop: 1 },
  headerRightCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingsHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeQrHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  storeQrHeaderBtnText: { fontSize: 10.5, fontWeight: '800', color: '#D96B14' },
  primaryActionBtn: { borderRadius: 9, overflow: 'hidden', shadowColor: '#D96B14', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  primaryActionBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  primaryActionBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  closeBtnCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E1DA' },

  // TAB SWITCHER
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#EFEAE3',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonText: { fontSize: 11.5, fontWeight: '600', color: '#7C6F62' },
  tabButtonTextActive: { fontWeight: '800', color: '#1F2937' },
  tabBadge: { backgroundColor: '#DE8626', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 10 },
  tabBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  // METRICS BAR
  metricsBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metricChip: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: '#E7E1DA' },
  metricChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  metricChipActiveEmerald: { backgroundColor: '#E4F5EC', borderColor: '#17845A' },
  metricChipActiveRuby: { backgroundColor: '#FFF3DC', borderColor: '#DE8626' },
  metricChipActiveGold: { backgroundColor: '#FFF3DC', borderColor: '#FEA619' },
  metricChipActiveBlue: { backgroundColor: '#EBF5FF', borderColor: '#346CB0' },
  metricNumber: { color: '#1F2937', fontSize: 12.5, fontWeight: '800' },
  metricNumberActive: { color: '#D96B14' },
  metricLabel: { color: '#7C6F62', fontSize: 8.5, fontWeight: '700', marginTop: 1 },
  metricLabelActive: { color: '#D96B14' },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },

  // SEARCH ROW
  searchRow: { marginBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, height: 36, borderWidth: 1, borderColor: '#E7E1DA', gap: 8 },
  searchInput: { flex: 1, color: '#1F2937', fontSize: 12 },

  // SECTION STRIP
  sectionStripContainer: { marginBottom: 8 },
  sectionStripContent: { alignItems: 'center', gap: 6, paddingVertical: 2 },
  sectionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: 18, borderWidth: 1, borderColor: '#E7E1DA' },
  sectionChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  sectionChipText: { color: '#5C4E3D', fontSize: 11, fontWeight: '600' },
  sectionChipTextActive: { color: '#D96B14', fontWeight: '700' },
  sectionCountPill: { backgroundColor: '#FAF7F2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  sectionCountPillActive: { backgroundColor: 'rgba(222, 134, 38, 0.15)' },
  sectionCountText: { color: '#7C6F62', fontSize: 8.5, fontWeight: '700' },
  sectionCountTextActive: { color: '#D96B14' },

  // LIST & GRID
  listContent: { paddingBottom: 24 },
  columnWrapper: { gap: 10 },
  tableCardOuter: { flex: 1 },
  tableCard: { height: 124, borderRadius: 14, padding: 10, borderWidth: 1.5, justifyContent: 'space-between', shadowColor: '#3C2F00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tableCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBadge: { backgroundColor: '#FAF7F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, maxWidth: '65%' },
  sectionBadgeText: { color: '#5C4E3D', fontSize: 8.5, fontWeight: '700' },
  seatsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FAF7F2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  seatsText: { color: '#5C4E3D', fontSize: 9.5, fontWeight: '700' },
  tableNumberCenter: { alignItems: 'center', justifyContent: 'center' },
  tableNum: { fontSize: 23, fontWeight: '800', letterSpacing: 0.5 },
  tableResSubtext: { fontSize: 9, fontWeight: '700', color: '#FEA619', marginTop: 2 },
  tableOccupiedSubtext: { fontSize: 9, fontWeight: '600', color: '#DE8626', marginTop: 2 },
  tableCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 8 },
  statusDotSmall: { width: 4.5, height: 4.5, borderRadius: 2.5 },
  statusPillText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.3 },
  qrIconBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E7E1DA', alignItems: 'center', justifyContent: 'center' },

  gridContainer: { gap: 10, paddingBottom: 24 },
  gridRow: { flexDirection: 'row', gap: 10 },
  tableCardSkeleton: { flex: 1, height: 124, borderRadius: 14, backgroundColor: '#FFFFFF', padding: 10, justifyContent: 'space-between', borderWidth: 1, borderColor: '#E7E1DA' },
  tableCardTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tableCardBottomRow: { alignItems: 'center' },
  skeletonBg: { backgroundColor: '#EDE8E1' },

  emptyContainer: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', justifyContent: 'center', marginVertical: 16, borderWidth: 1, borderColor: '#E7E1DA', shadowColor: '#3C2F00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, gap: 4 },
  emptyIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF0DE', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  emptySubtext: { color: '#5C4E3D', fontSize: 11, textAlign: 'center', maxWidth: 260, lineHeight: 15 },
  resetFiltersBtn: { marginTop: 10, backgroundColor: '#FAF7F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E7E1DA' },
  resetFiltersBtnText: { color: '#DE8626', fontSize: 11, fontWeight: '700' },
  emptyAddBtnWrapper: { marginTop: 10, borderRadius: 8, overflow: 'hidden' },
  emptyAddBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7 },
  emptyAddBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // DATE SELECTOR
  dateSelectorContainer: { marginBottom: 8 },
  dateStripContent: { gap: 6, paddingVertical: 2 },
  dateCard: { backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#E7E1DA', alignItems: 'center', minWidth: 64 },
  dateCardActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  dateCardDay: { fontSize: 10, fontWeight: '600', color: '#7C6F62' },
  dateCardDayActive: { color: '#D96B14', fontWeight: '800' },
  dateCardMonthDay: { fontSize: 11, fontWeight: '800', color: '#1F2937', marginTop: 1 },
  dateCardMonthDayActive: { color: '#D96B14' },

  // RESERVATION METRICS
  resMetricsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E7E1DA' },
  resMetricBox: { flex: 1, alignItems: 'center' },
  resMetricVal: { fontSize: 13, fontWeight: '800', color: '#1F2937' },
  resMetricLbl: { fontSize: 9, fontWeight: '600', color: '#7C6F62', marginTop: 1 },
  resMetricDivider: { width: 1, height: 20, backgroundColor: '#EBE4DC' },

  // RESERVATION STATUS CHIPS
  resStatusFilterStrip: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  resStatusChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: '#E7E1DA' },
  resStatusChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  resStatusChipText: { fontSize: 10, fontWeight: '600', color: '#5C4E3D' },
  resStatusChipTextActive: { color: '#D96B14', fontWeight: '700' },

  // RESERVATION CARD
  resCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E7E1DA', shadowColor: '#3C2F00', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  resCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resGuestName: { fontSize: 13.5, fontWeight: '800', color: '#1F2937' },
  resCodeBadge: { backgroundColor: '#FAF7F2', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4, borderWidth: 1, borderColor: '#E7E1DA' },
  resCodeBadgeText: { fontSize: 9, fontWeight: '700', color: '#7C6F62' },
  resGuestPhone: { fontSize: 10.5, color: '#5C4E3D', fontWeight: '500' },
  resGuestCount: { fontSize: 10.5, color: '#5C4E3D', fontWeight: '600' },
  resStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  resStatusBadgeText: { fontSize: 9, fontWeight: '800' },
  resTimePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FAF7F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  resTimePillText: { fontSize: 9.5, fontWeight: '700', color: '#1F2937' },

  resCardDetailsRow: { flexDirection: 'row', gap: 14, marginVertical: 8, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F5EFE8' },
  resDetailItem: { gap: 1 },
  resDetailLabel: { fontSize: 8, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  resDetailValue: { fontSize: 10.5, fontWeight: '700', color: '#1F2937' },

  resNotesBox: { backgroundColor: '#FFFDF5', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#FEF08A', marginBottom: 8 },
  resNotesText: { fontSize: 10, color: '#78350F', fontWeight: '500' },

  resCardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  seatGuestBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#17845A', paddingHorizontal: 10, paddingVertical: 5.5, borderRadius: 7 },
  seatGuestBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  assignTableBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FAF7F2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: '#E7E1DA' },
  assignTableBtnText: { color: '#5C4E3D', fontSize: 10.5, fontWeight: '600' },
  completeResBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E4F5EC', paddingHorizontal: 10, paddingVertical: 5.5, borderRadius: 7 },
  completeResBtnText: { color: '#17845A', fontSize: 11, fontWeight: '700' },
  openPosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0DE', paddingHorizontal: 10, paddingVertical: 5.5, borderRadius: 7, borderWidth: 1, borderColor: '#FED7AA' },
  openPosBtnText: { color: '#D96B14', fontSize: 11, fontWeight: '700' },
  moreActionChip: { backgroundColor: '#FAF7F2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#E7E1DA' },
  moreActionChipText: { fontSize: 10, fontWeight: '600', color: '#7C6F62' },

  // MODALS GENERAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18, 20, 20, 0.55)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E7E1DA', shadowColor: '#3C2F00', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, maxHeight: '85%' },
  modalCardLarge: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E7E1DA', shadowColor: '#3C2F00', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  modalSubtitle: { color: '#7C6F62', fontSize: 11, fontWeight: '500', marginTop: 2 },
  modalCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FAF7F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E1DA' },

  inputLabel: { color: '#7C6F62', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  input: { backgroundColor: '#FAF7F2', color: '#1F2937', borderRadius: 9, borderWidth: 1, borderColor: '#E7E1DA', paddingHorizontal: 10, height: 38, marginBottom: 10, fontSize: 12.5 },
  modalSubmitBtn: { marginTop: 10, borderRadius: 9, overflow: 'hidden', shadowColor: '#D96B14', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  modalSubmitBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, gap: 6 },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5 },

  // QUICK CHIPS
  quickChipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  quickChip: { backgroundColor: '#FAF7F2', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E7E1DA' },
  quickChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  quickChipText: { fontSize: 10.5, fontWeight: '600', color: '#5C4E3D' },
  quickChipTextActive: { color: '#D96B14', fontWeight: '700' },

  smallDateChip: { backgroundColor: '#FAF7F2', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E7E1DA' },
  smallDateChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  smallDateChipText: { fontSize: 10, fontWeight: '600', color: '#5C4E3D' },
  smallDateChipTextActive: { color: '#D96B14', fontWeight: '800' },

  slotChip: { backgroundColor: '#FAF7F2', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E7E1DA' },
  slotChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  slotChipText: { fontSize: 10.5, fontWeight: '600', color: '#5C4E3D' },
  slotChipTextActive: { color: '#D96B14', fontWeight: '800' },

  tableSelectChip: { backgroundColor: '#FAF7F2', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E7E1DA' },
  tableSelectChipActive: { backgroundColor: '#FFF0DE', borderColor: '#DE8626' },
  tableSelectChipBlocked: { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' },
  tableSelectChipText: { fontSize: 10.5, fontWeight: '600', color: '#5C4E3D' },
  tableSelectChipTextActive: { color: '#D96B14', fontWeight: '800' },
  tableSelectChipTextBlocked: { color: '#DC2626', fontWeight: '600' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAF7F2', padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#E7E1DA', marginBottom: 10 },
  switchTitle: { fontSize: 11.5, fontWeight: '700', color: '#1F2937' },
  switchDesc: { fontSize: 9.5, color: '#7C6F62', marginTop: 1 },

  // ACTION MODAL
  actionModalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E7E1DA', shadowColor: '#3C2F00', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  actionModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EBE4DC' },
  actionModalIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFF0DE', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FED7AA' },
  actionModalTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  actionModalSubtitle: { fontSize: 10.5, fontWeight: '500', color: '#7C6F62', marginTop: 2 },
  actionOptionsList: { gap: 8 },
  actionRowBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D96B14', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9 },
  actionRowBtnPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  actionRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FAF7F2', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: '#E7E1DA' },
  actionRowBtnText: { color: '#1F2937', fontSize: 11.5, fontWeight: '600' },
  actionRowBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: '#FCA5A5' },
  actionRowBtnDangerText: { color: '#DC2626', fontSize: 11.5, fontWeight: '700' },
  actionDivider: { height: 1, backgroundColor: '#EBE4DC', marginVertical: 2 },

  // ASSIGN MODAL
  assignModalSub: { fontSize: 11.5, color: '#5C4E3D', marginBottom: 12 },
  assignTableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F5EFE8' },
  assignTableNum: { fontSize: 12.5, fontWeight: '700', color: '#1F2937' },
  assignTableSub: { fontSize: 10, color: '#7C6F62', marginTop: 2 },

  // WALK-IN ONLY TAG
  walkInOnlyTag: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 2,
  },
  walkInOnlyTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },

  // DATE CONTROL & BLACKOUT
  dateControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginBottom: 8,
  },
  dateControlText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  blockedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  activeDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeDateBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#17845A',
  },
  toggleBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  toggleBlockBtnBlock: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FCA5A5',
  },
  toggleBlockBtnUnblock: {
    backgroundColor: '#17845A',
    borderColor: '#17845A',
  },
  toggleBlockBtnTextBlock: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  toggleBlockBtnTextUnblock: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  blackoutWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 8,
  },
  blackoutWarningTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  blackoutWarningSub: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 1,
    lineHeight: 13,
  },
  dateCardBlocked: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  dateCardDayBlocked: {
    color: '#DC2626',
  },
  dateCardMonthDayBlocked: {
    color: '#EF4444',
  },
  dateBlockedPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  dateBlockedPillText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '800',
  },

  // ACTIVE TABLE BILL MODAL STYLES
  activeBillMetaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  activeBillOrderNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  activeBillOrderTime: {
    fontSize: 11,
    color: '#7C6F62',
    marginTop: 2,
  },
  activeBillStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBillStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  activeBillPaymentMode: {
    fontSize: 10,
    color: '#5C4E3D',
    fontWeight: '600',
  },
  activeBillSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C6F62',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  activeBillItemsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    overflow: 'hidden',
    marginBottom: 12,
  },
  activeBillItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE8',
  },
  activeBillItemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  activeBillItemSub: {
    fontSize: 11,
    color: '#7C6F62',
    marginTop: 2,
  },
  activeBillItemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },
  activeBillTotalCard: {
    backgroundColor: '#FFF7EE',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
  },
  activeBillTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeBillTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C4E3D',
  },
  activeBillGrandTotal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#D96B14',
  },
  activeBillAddKotBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeBillAddKotGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  activeBillAddKotText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  activeBillPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  activeBillPrintBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4E3D',
  },
  activeBillFreeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EBF8F1',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A4E8C2',
  },
  activeBillFreeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
});
