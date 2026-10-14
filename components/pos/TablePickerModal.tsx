'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Utensils,
  Search,
  Users,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Flame,
  Receipt,
  Plus,
} from 'lucide-react';
import { TableMaster } from '@shared/domain/models/Table';

interface TablePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableMaster[];
  currentSelectedTableId?: number | null;
  onSelectTable: (table: TableMaster) => void;
  onOpenFloorView?: () => void;
}

export function TablePickerModal({
  isOpen,
  onClose,
  tables,
  currentSelectedTableId,
  onSelectTable,
  onOpenFloorView,
}: TablePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'OCCUPIED' | 'AVAILABLE'>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Helper to determine if table is occupied
  const isTableOccupied = (t: TableMaster): boolean => {
    const st = String(t.status || '').trim().toUpperCase();
    return st === 'OCCUPIED' || st === 'BILLED' || Boolean(t.activeOrderId);
  };

  // Distinct Sections
  const sections = useMemo(() => {
    const sSet = new Set<string>();
    tables.forEach((t) => {
      if (t.sectionName && t.sectionName.trim()) {
        sSet.add(t.sectionName.trim());
      }
    });
    return Array.from(sSet);
  }, [tables]);

  // Counts
  const { occupiedCount, availableCount } = useMemo(() => {
    let occ = 0;
    let avail = 0;
    tables.forEach((t) => {
      if (isTableOccupied(t)) occ++;
      else avail++;
    });
    return { occupiedCount: occ, availableCount: avail };
  }, [tables]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = String(t.tableNumber || '').toLowerCase().includes(q);
        const nameMatch = String(t.tableName || '').toLowerCase().includes(q);
        const secMatch = String(t.sectionName || '').toLowerCase().includes(q);
        if (!numMatch && !nameMatch && !secMatch) return false;
      }

      // 2. Status filter
      const occupied = isTableOccupied(t);
      if (filterMode === 'OCCUPIED' && !occupied) return false;
      if (filterMode === 'AVAILABLE' && occupied) return false;

      // 3. Section filter
      if (selectedSection !== 'ALL') {
        if ((t.sectionName || '').trim() !== selectedSection) return false;
      }

      return true;
    });
  }, [tables, searchQuery, filterMode, selectedSection]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-[#DE8626] text-white shadow-xs">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-2">
                  <span>Dine-In Table Selector</span>
                  <span className="text-[11px] font-bold text-[#DE8626] bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    Add Dishes / Seat Guests
                  </span>
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Select an active table to stage add-on dishes (KOT), or choose an available table for a fresh order.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenFloorView && (
                <button
                  type="button"
                  onClick={onOpenFloorView}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] text-xs font-bold text-[#667085] hover:text-[#DE8626] hover:border-[#DE8626] transition-colors"
                  title="View full floor layout"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Floor View</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#DE8626]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search table number or section..."
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-9 pr-8 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7A6B] hover:text-[#1E2930]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  filterMode === 'ALL'
                    ? 'bg-[#DE8626] text-white shadow-xs'
                    : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:border-[#DE8626]'
                }`}
              >
                All ({tables.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('OCCUPIED')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  filterMode === 'OCCUPIED'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:border-amber-500'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Running Orders ({occupiedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('AVAILABLE')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  filterMode === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Available ({availableCount})</span>
              </button>
            </div>
          </div>

          {/* Section filter chips if multiple */}
          {sections.length > 1 && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-[#667085]">
              <span className="shrink-0 text-[10px] uppercase font-bold text-[#8C7A6B]">Section:</span>
              <button
                type="button"
                onClick={() => setSelectedSection('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  selectedSection === 'ALL'
                    ? 'bg-black/10 dark:bg-white/10 text-[#1E2930] dark:text-white font-bold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                All Sections
              </button>
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    selectedSection === sec
                      ? 'bg-black/10 dark:bg-white/10 text-[#1E2930] dark:text-white font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tables Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredTables.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#667085] space-y-2">
              <Utensils className="h-10 w-10 mx-auto opacity-30 text-[#DE8626]" />
              <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">No tables found</p>
              <p className="text-[11px] opacity-75">
                {searchQuery
                  ? `No table matching "${searchQuery}" in this filter.`
                  : 'No tables configured for this restaurant.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredTables.map((t) => {
                const occupied = isTableOccupied(t);
                const isSelected = currentSelectedTableId === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTable(t)}
                    className={`group relative text-left rounded-2xl p-3.5 sm:p-4 border transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'ring-2 ring-[#DE8626] border-[#DE8626] bg-amber-500/10 shadow-md'
                        : occupied
                        ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-amber-500/15 hover:border-[#DE8626] hover:shadow-md'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-emerald-500 hover:bg-emerald-500/5 hover:shadow-md'
                    }`}
                  >
                    {/* Top Row: Table Number & Status Pill */}
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div>
                        <span className="text-xs font-bold text-[#8C7A6B] uppercase block">
                          {t.sectionName || 'Table'}
                        </span>
                        <h4 className="text-base sm:text-lg font-black text-[#1E2930] dark:text-[#F3F4F6] group-hover:text-[#DE8626] transition-colors">
                          T-{t.tableNumber}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {occupied ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
                            <Flame className="h-3 w-3 text-amber-600 animate-pulse" />
                            <span>Active KOT</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Available</span>
                          </span>
                        )}

                        {isSelected && (
                          <span className="text-[9px] font-extrabold uppercase bg-[#DE8626] text-white px-1.5 py-0.2 rounded-md">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Info: Capacity & Active Order Info */}
                    <div className="space-y-1 my-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>{t.seatingCapacity || t.capacity || 4} Guests</span>
                      </div>

                      {occupied && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-500/20 font-bold text-[#DE8626]">
                          <span className="truncate">
                            {t.activeOrderId ? `Order #${t.activeOrderId}` : 'Running Tab'}
                          </span>
                          {t.activeOrderAmount !== undefined && t.activeOrderAmount > 0 && (
                            <span className="font-black">₹{t.activeOrderAmount}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Trigger */}
                    <div className="mt-3 pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 flex items-center justify-between text-xs font-bold">
                      {occupied ? (
                        <span className="text-[#DE8626] group-hover:underline flex items-center gap-1 text-[11px]">
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Dishes (Round KOT)</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-1 text-[11px]">
                          <Utensils className="h-3.5 w-3.5" />
                          <span>Seat & Order</span>
                        </span>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-[#667085] group-hover:text-[#DE8626] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#667085] dark:text-[#94A3B8]">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <span>Amber = Occupied / Running KOT Order</span>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ml-2" />
            <span>Green = Available for New Seating</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-4 py-2 font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
