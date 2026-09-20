import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Share,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  QrCode,
  Share2,
  Copy,
  Printer,
  X,
  CheckCircle2,
  Sparkles,
  Store,
  Table as TableIcon,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Lock,
  Search,
  Layers,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Spacing } from '../../core/theme/spacing';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { TableMaster, FloorSection } from '../../domain/models/Table';
import { TableRemoteDataSource } from '../../data/datasources/TableRemoteDataSource';
import { apiClient } from '../../core/network/apiClient';
import { encryptIdentifier } from '../../core/security/encryptionHelper';
import { APP_CONSTANTS } from '../../core/constants/appConstants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const tableDataSource = new TableRemoteDataSource();

interface RestaurantQrModalProps {
  visible: boolean;
  onClose: () => void;
  restaurant: RestaurantDetail | null;
  tableId?: number | null;
  tableNumber?: string | number | null;
  tables?: TableMaster[];
  sections?: FloorSection[];
}

const PRESET_TAGLINES = [
  '🍽️ Scan, Order & Dine Contactless! Fast, seamless & delicious.',
  '✨ Explore our live chef specials & signature dishes. Scan to order!',
  '🚀 Skip the wait! Scan our QR to browse the menu and order instantly.',
  '🍕 Craving fresh flavors? Scan the QR code to view our live menu & order now!',
];

export const RestaurantQrModal: React.FC<RestaurantQrModalProps> = ({
  visible,
  onClose,
  restaurant,
  tableId,
  tableNumber,
  tables,
  sections,
}) => {
  const restId = restaurant?.restaurantId || 0;
  const restName = restaurant?.restaurantName || 'Our Restaurant';
  const restAddress = restaurant?.address || `${restaurant?.city || ''}, ${restaurant?.state || 'India'}`;

  // If tableId/tableNumber is passed, this is a dedicated table QR view
  const isDedicatedTable = Boolean(tableId || tableNumber);
  const effectiveTableNumber = tableNumber ? String(tableNumber) : '1';

  const [selectedMode, setSelectedMode] = useState<'store' | 'table'>(isDedicatedTable ? 'table' : 'store');
  const [customTableNum, setCustomTableNum] = useState<string>(effectiveTableNumber);
  const [selectedTagline, setSelectedTagline] = useState<string>(PRESET_TAGLINES[0]);
  const [customTagline, setCustomTagline] = useState<string>('');
  const [isCustomTagline, setIsCustomTagline] = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [loadingQr, setLoadingQr] = useState<boolean>(false);

  // Database Tables and Sections state
  const [dbTables, setDbTables] = useState<TableMaster[]>(tables || []);
  const [dbSections, setDbSections] = useState<FloorSection[]>(sections || []);
  const [loadingDbTables, setLoadingDbTables] = useState<boolean>(false);
  const [selectedDbTable, setSelectedDbTable] = useState<TableMaster | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('All');
  const [isCustomInputActive, setIsCustomInputActive] = useState<boolean>(false);

  // Dedicated Storefront QR State
  const [storeEncRestId, setStoreEncRestId] = useState<string>(() => encryptIdentifier(restId));
  const [storeQrPng, setStoreQrPng] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  // Dedicated Table Standee QR State
  const [tableEncRestId, setTableEncRestId] = useState<string>(() => encryptIdentifier(restId));
  const [tableEncTableId, setTableEncTableId] = useState<string>(() => (tableId ? encryptIdentifier(tableId) : ''));
  const [tableQrPng, setTableQrPng] = useState<string | null>(null);
  const [tableUrl, setTableUrl] = useState<string | null>(null);

  // Load tables & sections from DB when modal opens
  useEffect(() => {
    if (!visible || !restId) return;

    if (tables && tables.length > 0) {
      setDbTables(tables);
    } else {
      loadTablesFromDb();
    }

    if (sections && sections.length > 0) {
      setDbSections(sections);
    } else {
      loadSectionsFromDb();
    }
  }, [visible, restId, tables, sections]);

  const loadTablesFromDb = async () => {
    try {
      setLoadingDbTables(true);
      const data = await tableDataSource.getTables(restId);
      setDbTables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('RestaurantQrModal: Failed to fetch tables', err);
    } finally {
      setLoadingDbTables(false);
    }
  };

  const loadSectionsFromDb = async () => {
    try {
      const data = await tableDataSource.getSections(restId);
      setDbSections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('RestaurantQrModal: Failed to fetch sections', err);
    }
  };

  // Sync selection state whenever props change or tables load
  useEffect(() => {
    if (!visible) return;

    if (isDedicatedTable) {
      setSelectedMode('table');
      const match = dbTables.find(
        (t) =>
          (tableId && t.id === tableId) ||
          (tableNumber && String(t.tableNumber).toLowerCase() === String(tableNumber).toLowerCase())
      );
      if (match) {
        setSelectedDbTable(match);
        setCustomTableNum(match.tableNumber);
      } else {
        setSelectedDbTable(null);
        setCustomTableNum(effectiveTableNumber);
      }
    } else {
      if (!selectedDbTable && dbTables.length > 0) {
        setSelectedDbTable(dbTables[0]);
        setCustomTableNum(dbTables[0].tableNumber);
      }
    }
  }, [visible, isDedicatedTable, tableId, tableNumber, dbTables]);

  // Active table ID resolution: prioritizes selected database table
  const activeTableId = useMemo(() => {
    if (selectedMode !== 'table') return null;
    if (selectedDbTable?.id) return selectedDbTable.id;
    if (tableId && tableId > 0) return tableId;
    const match = dbTables.find(
      (t) => String(t.tableNumber).toLowerCase() === customTableNum.trim().toLowerCase()
    );
    return match ? match.id : null;
  }, [selectedMode, selectedDbTable, tableId, customTableNum, dbTables]);

  // Fetch official backend encrypted QR code whenever mode or selected table changes
  useEffect(() => {
    if (!visible || !restId) return;

    let isMounted = true;
    const fetchEncryptedQr = async () => {
      try {
        setLoadingQr(true);

        if (selectedMode === 'table') {
          if (activeTableId && activeTableId > 0) {
            // Dedicated Table QR endpoint with AES-256 encrypted tableId
            const res = await apiClient.get(`/TableMaster/${activeTableId}/qr-download?restaurantId=${restId}`);
            if (isMounted && res.data) {
              if (res.data.encryptedRestaurantId) {
                setTableEncRestId(res.data.encryptedRestaurantId);
              }
              if (res.data.encryptedTableId) {
                setTableEncTableId(res.data.encryptedTableId);
              }
              if (res.data.qrCodeBase64Png) {
                setTableQrPng(res.data.qrCodeBase64Png);
              }
              const dUrl = res.data.dineInUrl || res.data.DineInUrl || res.data.orderingUrl;
              if (dUrl) {
                setTableUrl(dUrl);
              }
            }
          } else {
            if (isMounted) {
              setTableQrPng(null);
              setTableUrl(null);
              setTableEncRestId(encryptIdentifier(restId));
              setTableEncTableId(encryptIdentifier(customTableNum.trim() || '1'));
            }
          }
        } else {
          // General Storefront QR endpoint
          const res = await apiClient.get(`/TableMaster/store-qr/${restId}`);
          if (isMounted && res.data) {
            if (res.data.encryptedRestaurantId) {
              setStoreEncRestId(res.data.encryptedRestaurantId);
            }
            if (res.data.qrCodeBase64Png) {
              setStoreQrPng(res.data.qrCodeBase64Png);
            }
            const sUrl = res.data.dineInUrl || res.data.DineInUrl || res.data.orderingUrl;
            if (sUrl) {
              setStoreUrl(sUrl);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch server QR code, using client encryption fallback', err);
        if (isMounted) {
          if (selectedMode === 'table') {
            setTableEncRestId(encryptIdentifier(restId));
            if (activeTableId) {
              setTableEncTableId(encryptIdentifier(activeTableId));
            } else {
              setTableEncTableId(encryptIdentifier(customTableNum.trim() || '1'));
            }
          } else {
            setStoreEncRestId(encryptIdentifier(restId));
          }
        }
      } finally {
        if (isMounted) {
          setLoadingQr(false);
        }
      }
    };

    fetchEncryptedQr();
    return () => {
      isMounted = false;
    };
  }, [visible, restId, activeTableId, selectedMode, customTableNum]);

  // Section options for table filter
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    dbSections.forEach((s) => {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    });
    dbTables.forEach((t) => {
      if (t.sectionName && t.sectionName.trim()) set.add(t.sectionName.trim());
    });
    return ['All', ...Array.from(set)];
  }, [dbSections, dbTables]);

  // Filtered tables by search query and section
  const filteredDbTables = useMemo(() => {
    return dbTables.filter((t) => {
      if (selectedSectionFilter !== 'All' && t.sectionName !== selectedSectionFilter) return false;
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.trim().toLowerCase();
        const numMatch = String(t.tableNumber || '').toLowerCase().includes(q);
        const nameMatch = String(t.tableName || '').toLowerCase().includes(q);
        const secMatch = String(t.sectionName || '').toLowerCase().includes(q);
        return numMatch || nameMatch || secMatch;
      }
      return true;
    });
  }, [dbTables, selectedSectionFilter, tableSearchQuery]);

  // Active Tagline
  const activeTagline = isCustomTagline && customTagline.trim() ? customTagline.trim() : selectedTagline;

  // Encrypted Ordering URL: completely decoupled between Storefront & Table Standee modes
  const targetOrderingUrl = useMemo(() => {
    const host = (
      APP_CONSTANTS.CUSTOMER_ORDERING_BASE_URL ||
      'https://lemon-mud-097d55a00.7.azurestaticapps.net'
    ).replace(/\/+$/, '');

    if (selectedMode === 'table') {
      if (tableUrl) {
        return tableUrl;
      }
      const encRest = tableEncRestId || encryptIdentifier(restId);
      const encTable =
        tableEncTableId ||
        (activeTableId
          ? encryptIdentifier(activeTableId)
          : encryptIdentifier(customTableNum.trim() || '1'));
      return `${host}/dinein/${encodeURIComponent(encRest)}/${encodeURIComponent(encTable)}`;
    }

    // Storefront mode: strictly storefront URL without table
    if (storeUrl) {
      return storeUrl;
    }
    const encRest = storeEncRestId || encryptIdentifier(restId);
    return `${host}/?r=${encodeURIComponent(encRest)}`;
  }, [
    restId,
    selectedMode,
    tableUrl,
    tableEncRestId,
    tableEncTableId,
    activeTableId,
    customTableNum,
    storeUrl,
    storeEncRestId,
  ]);

  // QR Code Image source (prioritizes backend-generated Base64 PNG)
  const qrImageUri = useMemo(() => {
    const activeServerQr = selectedMode === 'table' ? tableQrPng : storeQrPng;
    if (activeServerQr) {
      return activeServerQr;
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
      targetOrderingUrl
    )}&color=1F2937&bgcolor=FFFFFF&margin=1`;
  }, [selectedMode, tableQrPng, storeQrPng, targetOrderingUrl]);

  // Share Action
  const handleShare = async () => {
    try {
      const modeText =
        selectedMode === 'table'
          ? `Table ${customTableNum.trim()}${selectedDbTable?.sectionName ? ` (${selectedDbTable.sectionName})` : ''}`
          : 'Dine-In & Takeaway';
      const shareMessage = `🍽️ *${restName}* (${modeText})\n${activeTagline}\n\n📲 *Scan QR or Order Online:*\n👉 ${targetOrderingUrl}\n\n🔒 _Secured & Powered by Menza Suite_`;

      await Share.share({
        title: `${restName} - ${modeText} Ordering`,
        message: shareMessage,
        url: targetOrderingUrl,
      });
    } catch (err: any) {
      Alert.alert('Share Note', err?.message || 'Could not launch share sheet.');
    }
  };

  // Generate Standee Printable PDF
  const handlePrintStandee = async () => {
    try {
      setGeneratingPdf(true);
      const isTableMode = selectedMode === 'table' && customTableNum.trim();
      const secSuffix = selectedDbTable?.sectionName ? ` • ${selectedDbTable.sectionName.toUpperCase()}` : '';
      const headerSubtitle = isTableMode
        ? `TABLE ${customTableNum.trim().toUpperCase()}${secSuffix}`
        : 'DINE-IN & TAKEAWAY';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${restName} - ${headerSubtitle} QR Standee</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #FAF7F2;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              color: #272B30;
            }
            .standee-card {
              width: 480px;
              background: #FFFFFF;
              border-radius: 24px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08);
              border: 2px solid #E7E1DA;
              overflow: hidden;
              text-align: center;
              margin: 40px auto;
            }
            .header-banner {
              background: linear-gradient(135deg, #F59E0B, #DE8626, #CB741B);
              padding: 32px 24px;
              color: #FFFFFF;
            }
            .rest-name {
              font-size: 28px;
              font-weight: 800;
              margin: 0 0 6px 0;
              letter-spacing: -0.5px;
            }
            .rest-sub {
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 1.5px;
              background: rgba(255,255,255,0.25);
              display: inline-block;
              padding: 4px 14px;
              border-radius: 20px;
              margin-top: 4px;
            }
            .body-content {
              padding: 32px 24px;
            }
            .tagline-box {
              background: #FFF7ED;
              border: 1px solid #FED7AA;
              border-radius: 12px;
              padding: 12px 16px;
              font-size: 15px;
              font-weight: 600;
              color: #9A3412;
              margin-bottom: 24px;
              line-height: 1.4;
            }
            .qr-wrapper {
              background: #FFFFFF;
              display: inline-block;
              padding: 16px;
              border-radius: 16px;
              border: 3px solid #DE8626;
              box-shadow: 0 4px 14px rgba(222, 134, 38, 0.15);
              margin-bottom: 20px;
            }
            .qr-image {
              width: 260px;
              height: 260px;
              display: block;
            }
            .instruction-step {
              font-size: 14px;
              color: #5C4E3D;
              font-weight: 600;
              margin-top: 8px;
            }
            .order-url {
              font-size: 11px;
              color: #DE8626;
              font-weight: 700;
              word-break: break-all;
              margin-top: 8px;
            }
            .footer {
              border-top: 1px solid #E7E1DA;
              padding: 16px 24px;
              background: #FAF7F2;
              font-size: 11px;
              color: #8C7A6B;
              font-weight: 700;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="header-banner">
              <div class="rest-name">${restName}</div>
              <div class="rest-sub">${headerSubtitle}</div>
            </div>
            <div class="body-content">
              <div class="tagline-box">${activeTagline}</div>
              <div class="qr-wrapper">
                <img src="${qrImageUri}" class="qr-image" alt="QR Code" />
              </div>
              <div class="instruction-step">📱 Open Camera or Any UPI / QR App & Scan to Order</div>
              <div class="order-url">${targetOrderingUrl}</div>
            </div>
            <div class="footer">
              ⚡ Contactless Dining • Instant Kitchen Sync • Powered by Menza
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `${restName} - Standee PDF`,
      });
    } catch (err: any) {
      Alert.alert('Print Standee', err?.message || 'Could not generate standee PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.headerIconCircle}>
                <QrCode size={18} color="#D96B14" />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {isDedicatedTable ? `Table QR — ${customTableNum}` : 'Store QR & Standee'}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {restName} • Encrypted Table Identity
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnCircle} activeOpacity={0.7}>
              <X size={16} color="#8C7A6B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* If general mode (not opened for a specific table), allow mode toggle */}
            {!isDedicatedTable ? (
              <View style={styles.modeSwitchRow}>
                <TouchableOpacity
                  style={[styles.modeTabBtn, selectedMode === 'store' && styles.modeTabBtnActive]}
                  onPress={() => setSelectedMode('store')}
                  activeOpacity={0.8}
                >
                  <Store size={14} color={selectedMode === 'store' ? '#D96B14' : '#7C6F62'} />
                  <Text style={[styles.modeTabText, selectedMode === 'store' && styles.modeTabTextActive]}>
                    General Storefront QR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeTabBtn, selectedMode === 'table' && styles.modeTabBtnActive]}
                  onPress={() => setSelectedMode('table')}
                  activeOpacity={0.8}
                >
                  <TableIcon size={14} color={selectedMode === 'table' ? '#D96B14' : '#7C6F62'} />
                  <Text style={[styles.modeTabText, selectedMode === 'table' && styles.modeTabTextActive]}>
                    Table-Specific QR
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.dedicatedBadgeRow}>
                <View style={styles.lockBadge}>
                  <Lock size={12} color="#D96B14" />
                  <Text style={styles.lockBadgeText}>Table {customTableNum} Locked</Text>
                </View>
                <View style={styles.secureBadge}>
                  <ShieldCheck size={12} color="#17845A" />
                  <Text style={styles.secureBadgeText}>AES-256 Encrypted ID</Text>
                </View>
              </View>
            )}

            {/* If in Table Mode (and not locked), bind and select tables from Database */}
            {!isDedicatedTable && selectedMode === 'table' && (
              <View style={styles.tableSelectionContainer}>
                <View style={styles.tableSelectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} color="#D96B14" />
                    <Text style={styles.tableInputLabel}>CHOOSE TABLE (BOUND FROM DATABASE)</Text>
                  </View>
                  <Text style={styles.tableCountBadge}>
                    {filteredDbTables.length} {filteredDbTables.length === 1 ? 'table' : 'tables'}
                  </Text>
                </View>

                {/* Section Filter Pills */}
                {availableSections.length > 2 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.sectionFilterScroll}
                    contentContainerStyle={styles.sectionFilterRow}
                  >
                    {availableSections.map((sec) => (
                      <TouchableOpacity
                        key={`sec-filt-${sec}`}
                        style={[
                          styles.sectionFilterChip,
                          selectedSectionFilter === sec && styles.sectionFilterChipActive,
                        ]}
                        onPress={() => setSelectedSectionFilter(sec)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.sectionFilterText,
                            selectedSectionFilter === sec && styles.sectionFilterTextActive,
                          ]}
                        >
                          {sec}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Search table input if multiple tables */}
                {dbTables.length > 6 && (
                  <View style={styles.searchTableBox}>
                    <Search size={13} color="#9CA3AF" />
                    <TextInput
                      style={styles.searchTableInput}
                      placeholder="Search table code (e.g. T-01, 10)..."
                      placeholderTextColor="#9CA3AF"
                      value={tableSearchQuery}
                      onChangeText={setTableSearchQuery}
                    />
                    {tableSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setTableSearchQuery('')}>
                        <X size={13} color="#9CA3AF" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Database Table Chips Grid / Scroll */}
                {loadingDbTables ? (
                  <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#DE8626" />
                    <Text style={{ fontSize: 10.5, color: '#7C6F62', marginTop: 4 }}>
                      Loading tables from database...
                    </Text>
                  </View>
                ) : filteredDbTables.length === 0 ? (
                  <View style={styles.emptyTablesBox}>
                    <Text style={styles.emptyTablesText}>No tables found matching section filter.</Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tableChipsScroll}
                    contentContainerStyle={styles.tableChipsContent}
                  >
                    {filteredDbTables.map((tbl) => {
                      const isSelected =
                        selectedDbTable?.id === tbl.id ||
                        (!selectedDbTable && String(tbl.tableNumber).toLowerCase() === customTableNum.trim().toLowerCase());
                      return (
                        <TouchableOpacity
                          key={`tbl-chip-${tbl.id}`}
                          style={[styles.tableSelectChip, isSelected && styles.tableSelectChipActive]}
                          onPress={() => {
                            setSelectedDbTable(tbl);
                            setCustomTableNum(tbl.tableNumber);
                            setIsCustomInputActive(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.tableChipHeader}>
                            <Text style={[styles.tableChipNum, isSelected && styles.tableChipNumActive]}>
                              Table {tbl.tableNumber}
                            </Text>
                            {isSelected ? (
                              <CheckCircle2 size={13} color="#FFFFFF" />
                            ) : (
                              <TableIcon size={12} color="#8C7A6B" />
                            )}
                          </View>
                          <View style={styles.tableChipMetaRow}>
                            <Text style={[styles.tableChipSection, isSelected && styles.tableChipSectionActive]}>
                              {tbl.sectionName || 'Main Hall'}
                            </Text>
                            <Text style={[styles.tableChipCapacity, isSelected && styles.tableChipCapacityActive]}>
                              • {tbl.seatingCapacity || 4}p
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Manual Table Code Toggle for Custom Overrides */}
                <View style={styles.customCodeToggleRow}>
                  <TouchableOpacity
                    onPress={() => setIsCustomInputActive((prev) => !prev)}
                    style={styles.customCodeToggleBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.customCodeToggleText}>
                      {isCustomInputActive ? '▲ Hide manual code entry' : '✎ Enter custom / non-listed table code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isCustomInputActive && (
                  <View style={styles.customCodeInputBox}>
                    <TextInput
                      style={styles.tableInput}
                      value={customTableNum}
                      onChangeText={(val) => {
                        setCustomTableNum(val);
                        const match = dbTables.find(
                          (t) => String(t.tableNumber).toLowerCase() === val.trim().toLowerCase()
                        );
                        setSelectedDbTable(match || null);
                      }}
                      placeholder="e.g. 1, 2, 10, T-01, VIP-2"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                    />
                  </View>
                )}
              </View>
            )}

            {/* QR Visual Card */}
            <View style={styles.qrDisplayCard}>
              <LinearGradient
                colors={['#FFF8F0', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.qrDisplayGradient}
              >
                <View style={styles.qrBanner}>
                  <Text style={styles.qrBannerRestName} numberOfLines={1}>
                    {restName}
                  </Text>
                  <View style={styles.qrBannerPill}>
                    <Text style={styles.qrBannerPillText}>
                      {selectedMode === 'table'
                        ? `TABLE ${customTableNum.toUpperCase()}${selectedDbTable?.sectionName ? ` • ${selectedDbTable.sectionName.toUpperCase()}` : ''}`
                        : 'SCAN & ORDER'}
                    </Text>
                  </View>
                </View>

                {/* QR Code Graphic */}
                <View style={styles.qrCodeFrame}>
                  {loadingQr ? (
                    <View style={styles.qrLoadingBox}>
                      <ActivityIndicator size="large" color="#DE8626" />
                      <Text style={styles.qrLoadingText}>Fetching Encrypted QR...</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: qrImageUri }} style={styles.qrCodeImage} resizeMode="contain" />
                  )}
                </View>

                <Text style={styles.qrScanInstructions}>
                  📱 Open Camera or any UPI App to scan & order
                </Text>

                <View style={styles.encryptedTokenRow}>
                  <ShieldCheck size={12} color="#17845A" />
                  <Text style={styles.encryptedTokenText} numberOfLines={1}>
                    Encrypted URL: {targetOrderingUrl}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Tagline Selection */}
            <Text style={styles.sectionHeading}>STAND & PROMO TAGLINE</Text>
            <View style={styles.taglinesList}>
              {PRESET_TAGLINES.map((tag, idx) => {
                const isSelected = !isCustomTagline && selectedTagline === tag;
                return (
                  <TouchableOpacity
                    key={`tag-${idx}`}
                    style={[styles.taglineOption, isSelected && styles.taglineOptionSelected]}
                    onPress={() => {
                      setIsCustomTagline(false);
                      setSelectedTagline(tag);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.taglineOptionText, isSelected && styles.taglineOptionTextSelected]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={handlePrintStandee} activeOpacity={0.88}>
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionBtnGradient}
                >
                  {generatingPdf ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Printer size={15} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>Print Standee (PDF)</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleShare} activeOpacity={0.8}>
                <Share2 size={14} color="#D96B14" />
                <Text style={styles.actionBtnSecondaryText}>Share Link</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
    backgroundColor: '#FAF7F2',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#7C6F62',
    marginTop: 1,
  },
  closeBtnCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // MODE SWITCHER
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EFE8',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C6F62',
  },
  modeTabTextActive: {
    color: '#1F2937',
    fontWeight: '800',
  },

  // DEDICATED TABLE BADGES
  dedicatedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D96B14',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  secureBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17845A',
  },

  tableSelectionContainer: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  tableSelectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tableCountBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D96B14',
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  sectionFilterScroll: {
    marginBottom: 8,
  },
  sectionFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sectionFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  sectionFilterChipActive: {
    backgroundColor: '#DE8626',
    borderColor: '#CB741B',
  },
  sectionFilterText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#7C6F62',
  },
  sectionFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  searchTableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 8,
    height: 32,
    gap: 6,
    marginBottom: 8,
  },
  searchTableInput: {
    flex: 1,
    fontSize: 11,
    color: '#1F2937',
    paddingVertical: 0,
  },
  tableChipsScroll: {
    marginBottom: 6,
  },
  tableChipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  tableSelectChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 105,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tableSelectChipActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tableChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 3,
  },
  tableChipNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
  },
  tableChipNumActive: {
    color: '#B45309',
  },
  tableChipMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tableChipSection: {
    fontSize: 9.5,
    color: '#8C7A6B',
    fontWeight: '600',
  },
  tableChipSectionActive: {
    color: '#9A3412',
    fontWeight: '700',
  },
  tableChipCapacity: {
    fontSize: 9.5,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  tableChipCapacityActive: {
    color: '#B45309',
  },
  emptyTablesBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyTablesText: {
    fontSize: 11,
    color: '#8C7A6B',
    fontStyle: 'italic',
  },
  customCodeToggleRow: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  customCodeToggleBtn: {
    paddingVertical: 2,
  },
  customCodeToggleText: {
    fontSize: 10,
    color: '#D96B14',
    fontWeight: '700',
  },
  customCodeInputBox: {
    marginTop: 6,
  },
  tableInputRow: {
    marginBottom: 12,
  },
  tableInputLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C6F62',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tableInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12.5,
    color: '#1F2937',
    fontWeight: '700',
  },

  // QR DISPLAY CARD
  qrDisplayCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    marginBottom: 14,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  qrDisplayGradient: {
    alignItems: 'center',
    padding: 16,
  },
  qrBanner: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrBannerRestName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  qrBannerPill: {
    backgroundColor: '#D96B14',
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 12,
    marginTop: 4,
  },
  qrBannerPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  qrCodeFrame: {
    width: 190,
    height: 190,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  qrCodeImage: {
    width: '100%',
    height: '100%',
  },
  qrLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrLoadingText: {
    fontSize: 10,
    color: '#7C6F62',
    fontWeight: '600',
  },
  qrScanInstructions: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4E3D',
    marginTop: 10,
  },
  encryptedTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    maxWidth: '95%',
  },
  encryptedTokenText: {
    fontSize: 9,
    color: '#7C6F62',
    fontWeight: '500',
  },

  // TAGLINES
  sectionHeading: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C6F62',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  taglinesList: {
    gap: 6,
    marginBottom: 14,
  },
  taglineOption: {
    backgroundColor: '#FAF7F2',
    padding: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  taglineOptionSelected: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
  },
  taglineOptionText: {
    fontSize: 11,
    color: '#5C4E3D',
    lineHeight: 14,
  },
  taglineOptionTextSelected: {
    color: '#9A3412',
    fontWeight: '700',
  },

  // ACTION GRID
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnPrimary: {
    flex: 1.3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    height: 42,
  },
  actionBtnSecondaryText: {
    color: '#D96B14',
    fontSize: 12,
    fontWeight: '800',
  },
});
