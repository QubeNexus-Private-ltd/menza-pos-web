'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Layers } from 'lucide-react';
import { Category } from '@shared/domain/models/Category';

interface SearchableCategorySelectProps {
  categories: Category[];
  value: number;
  onChange: (categoryId: number) => void;
  onAddNewCategory?: (initialName?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchableCategorySelect: React.FC<SearchableCategorySelectProps> = ({
  categories,
  value,
  onChange,
  onAddNewCategory,
  placeholder = 'Search & select category...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Deduplicate categories by normalized name so redundant DB entries don't appear repeatedly
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    const list: Category[] = [];

    categories.forEach((cat) => {
      const norm = (cat.categoryName || '').trim().toLowerCase();
      if (!norm) return;
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push(cat);
      }
    });

    return list.sort((a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''));
  }, [categories]);

  // Filtered categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCategories;
    const q = searchQuery.toLowerCase().trim();
    return uniqueCategories.filter((cat) =>
      (cat.categoryName || '').toLowerCase().includes(q) ||
      (cat.description || '').toLowerCase().includes(q)
    );
  }, [uniqueCategories, searchQuery]);

  // Find currently selected category
  const selectedCategory = useMemo(() => {
    return categories.find((c) => Number(c.id) === Number(value)) || null;
  }, [categories, value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
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

  const handleSelect = (catId: number) => {
    onChange(catId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        className={`w-full h-10 rounded-xl border flex items-center justify-between px-3 text-xs font-bold transition-all ${
          isOpen
            ? 'border-[#DE8626] ring-2 ring-[#DE8626]/20 bg-white dark:bg-[#1B2127]'
            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] hover:border-[#DE8626]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-[#DE8626] shrink-0" />
          <span className={`truncate ${selectedCategory ? 'text-[#1E2930] dark:text-[#F3F4F6]' : 'text-[#667085] dark:text-[#94A3B8] font-normal'}`}>
            {selectedCategory ? selectedCategory.categoryName : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#8C7A6B] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#DE8626]' : ''
          }`}
        />
      </button>

      {/* Floating Search & Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-2.5 border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#DE8626]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to filter categories..."
                className="w-full h-8.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-8.5 pr-8 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7A6B] hover:text-[#1E2930]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
            {filteredCategories.length === 0 ? (
              <div className="py-6 px-3 text-center space-y-2">
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  No category matching &ldquo;<span className="font-bold text-[#DE8626]">{searchQuery}</span>&rdquo;
                </p>
                {onAddNewCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = searchQuery.trim();
                      setIsOpen(false);
                      onAddNewCategory(q);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DE8626] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create &ldquo;{searchQuery}&rdquo; as new category</span>
                  </button>
                )}
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected = Number(cat.id) === Number(value);
                return (
                  <button
                    key={`search-cat-${cat.id}`}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-colors ${
                      isSelected
                        ? 'bg-[#DE8626] text-white shadow-xs'
                        : 'text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="truncate">{cat.categoryName}</span>
                      {cat.kitchenStationName && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-[#667085]'
                        }`}>
                          {cat.kitchenStationName}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-white" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Action Footer */}
          {onAddNewCategory && (
            <div className="p-2 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]">
              <button
                type="button"
                onClick={() => {
                  const q = searchQuery.trim();
                  setIsOpen(false);
                  onAddNewCategory(q);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 rounded-xl transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add New Category</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
