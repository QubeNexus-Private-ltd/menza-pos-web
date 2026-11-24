import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  X,
  Utensils,
  Search,
  Users,
  CheckCircle2,
  Flame,
  ArrowRight,
  Plus,
  RefreshCw,
} from 'lucide-react-native';
import { TableMaster } from '../../domain/models/Table';
import { TableRemoteDataSource } from '../../data/datasources/TableRemoteDataSource';
import { TableRepositoryImpl } from '../../data/repositories/TableRepositoryImpl';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const tableDataSource = new TableRemoteDataSource();
const tableRepository = new TableRepositoryImpl(tableDataSource);

interface TablePickerModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: number;
  currentSelectedTableId?: number | null;
  onSelectTable: (table: TableMaster) => void;
  onOpenFloorView?: () => void;
}

export const TablePickerModal: React.FC<TablePickerModalProps> = ({
  visible,
  onClose,
  restaurantId,
  currentSelectedTableId,
  onSelectTable,
  onOpenFloorView,
}) => {
  const [tables, setTables] = useState<TableMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'OCCUPIED' | 'AVAILABLE'>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  const fetchTables = useCallback(async () => {
    if (!restaurantId || restaurantId <= 0) return;
    try {
      setLoading(true);
      const data = await tableRepository.getTables(restaurantId);
      if (Array.isArray(data)) {
        setTables(data);
      }
    } catch (err) {
      console.warn('[TablePickerModal] Failed to load tables:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (visible) {
      fetchTables();
    }
  }, [visible, fetchTables]);

  const isTableOccupied = (t: TableMaster): boolean => {
    const st = String(t.status || '').trim().toUpperCase();
    return st === 'OCCUPIED' || st === 'BILLED' || Boolean(t.activeOrderId);
  };

  const sections = useMemo(() => {
    const sSet = new Set<string>();
    tables.forEach((t) => {
      if (t.sectionName && t.sectionName.trim()) {
        sSet.add(t.sectionName.trim());
      }
    });
    return Array.from(sSet);
  }, [tables]);

  const { occupiedCount, availableCount } = useMemo(() => {
    let occ = 0;
    let avail = 0;
    tables.forEach((t) => {
      if (isTableOccupied(t)) occ++;
      else avail++;
    });
    return { occupiedCount: occ, availableCount: avail };
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = String(t.tableNumber || '').toLowerCase().includes(q);
        const nameMatch = String(t.tableName || '').toLowerCase().includes(q);
        const secMatch = String(t.sectionName || '').toLowerCase().includes(q);
        if (!numMatch && !nameMatch && !secMatch) return false;
      }

      const occupied = isTableOccupied(t);
      if (filterMode === 'OCCUPIED' && !occupied) return false;
      if (filterMode === 'AVAILABLE' && occupied) return false;

      if (selectedSection !== 'ALL') {
        if ((t.sectionName || '').trim() !== selectedSection) return false;
      }

      return true;
    });
  }, [tables, searchQuery, filterMode, selectedSection]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Utensils size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.headerTitle}>Dine-In Table Selector</Text>
                  <View style={styles.headerTag}>
                    <Text style={styles.headerTagText}>Add Dishes / Seat Guests</Text>
                  </View>
                </View>
                <Text style={styles.headerSub}>
                  Select an active table for Add-on KOT dishes, or an available table for a new order.
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={fetchTables}
                style={styles.refreshBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color="#667085" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={18} color="#667085" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar & Status Filter Chips */}
          <View style={styles.toolbar}>
            <View style={styles.searchBar}>
              <Search size={15} color="#DE8626" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search table or section..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              <TouchableOpacity
                style={[styles.filterChip, filterMode === 'ALL' && styles.filterChipActive]}
                onPress={() => setFilterMode('ALL')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterMode === 'ALL' && styles.filterChipTextActive,
                  ]}
                >
                  All ({tables.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  styles.filterChipOccupied,
                  filterMode === 'OCCUPIED' && styles.filterChipOccupiedActive,
                ]}
                onPress={() => setFilterMode('OCCUPIED')}
                activeOpacity={0.75}
              >
                <Flame size={13} color={filterMode === 'OCCUPIED' ? '#FFFFFF' : '#D96B14'} />
                <Text
                  style={[
                    styles.filterChipText,
                    styles.filterChipOccupiedText,
                    filterMode === 'OCCUPIED' && styles.filterChipTextActive,
                  ]}
                >
                  Running Orders ({occupiedCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  styles.filterChipAvailable,
                  filterMode === 'AVAILABLE' && styles.filterChipAvailableActive,
                ]}
                onPress={() => setFilterMode('AVAILABLE')}
                activeOpacity={0.75}
              >
                <CheckCircle2
                  size={13}
                  color={filterMode === 'AVAILABLE' ? '#FFFFFF' : '#15803D'}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    styles.filterChipAvailableText,
                    filterMode === 'AVAILABLE' && styles.filterChipTextActive,
                  ]}
                >
                  Available ({availableCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {sections.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectionChipsRow}
              >
                <Text style={styles.sectionLabel}>SECTION:</Text>
                <TouchableOpacity
                  style={[
                    styles.sectionChip,
                    selectedSection === 'ALL' && styles.sectionChipActive,
                  ]}
                  onPress={() => setSelectedSection('ALL')}
                >
                  <Text
                    style={[
                      styles.sectionChipText,
                      selectedSection === 'ALL' && styles.sectionChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {sections.map((sec) => (
                  <TouchableOpacity
                    key={`sec-${sec}`}
                    style={[
                      styles.sectionChip,
                      selectedSection === sec && styles.sectionChipActive,
                    ]}
                    onPress={() => setSelectedSection(sec)}
                  >
                    <Text
                      style={[
                        styles.sectionChipText,
                        selectedSection === sec && styles.sectionChipTextActive,
                      ]}
                    >
                      {sec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Table Cards Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#DE8626" />
              <Text style={styles.loadingText}>Loading tables...</Text>
            </View>
          ) : filteredTables.length === 0 ? (
            <View style={styles.centerContainer}>
              <Utensils size={36} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No tables found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No table matching "${searchQuery}".`
                  : 'No tables configured for this restaurant.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.tableScroll}
              contentContainerStyle={styles.tableGrid}
              showsVerticalScrollIndicator={false}
            >
              {filteredTables.map((t) => {
                const occupied = isTableOccupied(t);
                const isSelected = currentSelectedTableId === t.id;

                return (
                  <TouchableOpacity
                    key={`tbl-card-${t.id}`}
                    style={[
                      styles.tableCard,
                      occupied ? styles.tableCardOccupied : styles.tableCardAvailable,
                      isSelected && styles.tableCardSelected,
                    ]}
                    onPress={() => {
                      onSelectTable(t);
                      onClose();
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Top Row: Section & Status Badge */}
                    <View style={styles.tableCardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tableCardSection} numberOfLines={1}>
                          {t.sectionName || 'Table'}
                        </Text>
                        <Text style={styles.tableCardNum}>T-{t.tableNumber}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {occupied ? (
                          <View style={styles.badgeOccupied}>
                            <Flame size={11} color="#D96B14" />
                            <Text style={styles.badgeOccupiedText}>Active KOT</Text>
                          </View>
                        ) : (
                          <View style={styles.badgeAvailable}>
                            <CheckCircle2 size={11} color="#15803D" />
                            <Text style={styles.badgeAvailableText}>Available</Text>
                          </View>
                        )}
                        {isSelected && (
                          <View style={styles.badgeSelected}>
                            <Text style={styles.badgeSelectedText}>Selected</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Middle Info */}
                    <View style={styles.tableCardMid}>
                      <View style={styles.tableCardCapRow}>
                        <Users size={12} color="#667085" />
                        <Text style={styles.tableCardCapText}>
                          {t.seatingCapacity || t.capacity || 4} Guests
                        </Text>
                      </View>

                      {occupied && (
                        <View style={styles.tableCardActiveBillRow}>
                          <Text style={styles.tableCardBillOrder} numberOfLines={1}>
                            {t.activeOrderId ? `Order #${t.activeOrderId}` : 'Running Tab'}
                          </Text>
                          {t.activeOrderAmount !== undefined && t.activeOrderAmount > 0 && (
                            <Text style={styles.tableCardBillAmt}>₹{t.activeOrderAmount}</Text>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Bottom Action Hint */}
                    <View style={styles.tableCardBottom}>
                      {occupied ? (
                        <View style={styles.tableActionTextRow}>
                          <Plus size={12} color="#D96B14" strokeWidth={2.5} />
                          <Text style={styles.tableActionTextOccupied}>
                            Add Dishes (Round KOT)
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.tableActionTextRow}>
                          <Utensils size={12} color="#15803D" strokeWidth={2.2} />
                          <Text style={styles.tableActionTextAvailable}>Seat & Order</Text>
                        </View>
                      )}
                      <ArrowRight size={13} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.6,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerTag: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  headerTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D96B14',
  },
  headerSub: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  toolbar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    paddingVertical: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  filterChipOccupied: {
    backgroundColor: '#FFF8EB',
    borderColor: '#FDE68A',
  },
  filterChipOccupiedActive: {
    backgroundColor: '#D96B14',
    borderColor: '#D96B14',
  },
  filterChipAvailable: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  filterChipAvailableActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterChipOccupiedText: {
    color: '#D96B14',
  },
  filterChipAvailableText: {
    color: '#15803D',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sectionChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  sectionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  sectionChipActive: {
    backgroundColor: '#1F2937',
  },
  sectionChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  sectionChipTextActive: {
    color: '#FFFFFF',
  },
  tableScroll: {
    flex: 1,
  },
  tableGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tableCard: {
    width: (SCREEN_WIDTH - 34) / 2,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    justifyContent: 'space-between',
    minHeight: 125,
  },
  tableCardOccupied: {
    backgroundColor: '#FFFDF9',
    borderColor: '#FDE68A',
  },
  tableCardAvailable: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  tableCardSelected: {
    borderColor: '#DE8626',
    backgroundColor: '#FFF8F0',
  },
  tableCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tableCardSection: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  tableCardNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F2937',
    marginTop: 2,
  },
  badgeOccupied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOccupiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D96B14',
  },
  badgeAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EBF8F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeAvailableText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  badgeSelected: {
    backgroundColor: '#DE8626',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeSelectedText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  tableCardMid: {
    marginVertical: 6,
    gap: 4,
  },
  tableCardCapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableCardCapText: {
    fontSize: 10,
    color: '#667085',
    fontWeight: '600',
  },
  tableCardActiveBillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
  },
  tableCardBillOrder: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D96B14',
    flex: 1,
  },
  tableCardBillAmt: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D96B14',
  },
  tableCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tableActionTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tableActionTextOccupied: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D96B14',
  },
  tableActionTextAvailable: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
});
