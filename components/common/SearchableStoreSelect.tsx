'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Store, X, MapPin } from 'lucide-react';

export interface StoreOption {
  id: number;
  name: string;
  city?: string;
  address?: string;
  role?: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface SearchableStoreSelectProps {
  stores: StoreOption[];
  value: number;
  onChange: (storeId: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  scopeLabel?: string;
}

export const SearchableStoreSelect: React.FC<SearchableStoreSelectProps> = ({
  stores,
  value,
  onChange,
  placeholder = 'Search store by name, city, or ID...',
  disabled = false,
  className = '',
  scopeLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected store
  const selectedStore = useMemo(() => {
    return stores.find((s) => Number(s.id) === Number(value)) || null;
  }, [stores, value]);

  // Filtered stores using smart multi-word search
  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return stores;
    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return stores.filter((store) => {
      const name = (store.name || '').toLowerCase();
      const city = (store.city || '').toLowerCase();
      const address = (store.address || '').toLowerCase();
      const idStr = String(store.id);

      // Every typed word must match at least one of name, city, address, or id
      return terms.every(
        (term) =>
          name.includes(term) ||
          city.includes(term) ||
          address.includes(term) ||
          idStr.includes(term.replace('#', ''))
      );
    });
  }, [stores, searchQuery]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus the search input
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (storeId: number) => {
    onChange(storeId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2 text-left text-xs transition-all shadow-xs ${
          isOpen
            ? 'border-[#DE8626] ring-2 ring-[#DE8626]/20 bg-white dark:bg-[#1B2127]'
            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#151A20] hover:border-[#DE8626]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-6 w-6 rounded-lg bg-amber-500/10 text-[#DE8626] flex items-center justify-center shrink-0">
            <Store className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            {scopeLabel && (
              <span className="block text-[9px] font-black uppercase tracking-wider text-[#DE8626] truncate">
                {scopeLabel}
              </span>
            )}
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                {selectedStore?.name || (value > 0 ? `Restaurant #${value}` : 'Select an outlet...')}
              </span>
              {selectedStore?.city && (
                <span className="text-[11px] text-[#667085] dark:text-[#94A3B8] shrink-0">
                  • {selectedStore.city}
                </span>
              )}
              {value > 0 && (
                <span className="font-mono text-[10px] font-bold text-[#667085] dark:text-[#94A3B8] bg-black/5 dark:bg-white/5 px-1.5 py-0.2 rounded shrink-0">
                  #{value}
                </span>
              )}
            </div>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-[#667085] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#DE8626]' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 max-w-[90vw] rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-2 shadow-2xl z-[70] animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box Header */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full h-9 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-9 pr-8 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] p-0.5"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-[#667085] dark:text-[#94A3B8] border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 mb-1">
            <span>
              {searchQuery ? `Matching outlets (${filteredStores.length})` : `All Outlets (${stores.length})`}
            </span>
            <span className="text-[#DE8626]">Type words to search</span>
          </div>

          {/* Scrollable Store List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            {filteredStores.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#667085] space-y-2">
                <Store className="h-8 w-8 text-[#667085]/40 mx-auto" />
                <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">No outlets found</p>
                <p className="text-[11px] text-[#667085]">
                  No restaurant matches &quot;{searchQuery}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-bold text-[#DE8626] hover:underline pt-1"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredStores.map((store) => {
                const isSelected = Number(store.id) === Number(value);
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => handleSelect(store.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-amber-500/15 font-bold text-[#DE8626]'
                        : 'text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black truncate text-xs">{store.name}</span>
                        <span className="font-mono text-[10px] text-[#667085] shrink-0">
                          #{store.id}
                        </span>
                        {store.isActive !== undefined && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              store.isActive ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                            title={store.isActive ? 'Active' : 'Inactive'}
                          />
                        )}
                      </div>

                      {(store.city || store.address) && (
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span>
                            {store.city}
                            {store.city && store.address ? `, ${store.address}` : store.address}
                          </span>
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-[#DE8626] shrink-0 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
