'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Check,
  Sparkles,
  UtensilsCrossed,
  Info,
  Layers,
  ChefHat,
  MessageSquare,
} from 'lucide-react';
import { MenuItem } from '@shared/domain/models/Item';
import { CatalogRemoteDataSource } from '@shared/data/datasources/CatalogRemoteDataSource';
import { DishImage } from '@/components/common/DishImage';

interface ItemVariant {
  id: number;
  variantName: string;
  additionalPrice: number;
}

interface ItemModifier {
  id: number;
  modifierName: string;
  extraPrice: number;
}

interface ItemModifierGroup {
  id: number;
  groupName: string;
  modifiers: ItemModifier[];
}

export interface CustomizationResult {
  item: MenuItem;
  quantity: number;
  selectedVariant: ItemVariant | null;
  selectedModifiers: ItemModifier[];
  cookingInstructions: string;
  effectiveUnitPrice: number;
  totalPrice: number;
  cartKey: string;
}

interface DishCustomizationModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (result: CustomizationResult) => void;
}

const catalogDataSource = new CatalogRemoteDataSource();

export function DishCustomizationModal({
  isOpen,
  item,
  onClose,
  onConfirm,
}: DishCustomizationModalProps) {
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ItemModifierGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Selections
  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<ItemModifier[]>([]);
  const [cookingInstructions, setCookingInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen || !item) {
      setVariants([]);
      setModifierGroups([]);
      setSelectedVariant(null);
      setSelectedModifiers([]);
      setCookingInstructions('');
      setQuantity(1);
      return;
    }

    let isMounted = true;
    setLoadingOptions(true);

    Promise.allSettled([
      catalogDataSource.getItemVariants(item.id),
      catalogDataSource.getItemModifierGroups(item.id),
    ]).then(([varRes, modRes]) => {
      if (!isMounted) return;

      if (varRes.status === 'fulfilled' && Array.isArray(varRes.value)) {
        const parsedVariants: ItemVariant[] = varRes.value.map((v: any) => ({
          id: Number(v.id ?? v.Id ?? 0),
          variantName: String(v.variantName ?? v.VariantName ?? v.name ?? 'Standard'),
          additionalPrice: Number(v.additionalPrice ?? v.AdditionalPrice ?? v.priceDelta ?? 0),
        }));
        setVariants(parsedVariants);
        // Default select first variant if available
        if (parsedVariants.length > 0) {
          setSelectedVariant(parsedVariants[0]);
        }
      }

      if (modRes.status === 'fulfilled' && Array.isArray(modRes.value)) {
        const parsedGroups: ItemModifierGroup[] = modRes.value.map((g: any) => ({
          id: Number(g.id ?? g.Id ?? 0),
          groupName: String(g.groupName ?? g.GroupName ?? g.name ?? 'Addons'),
          modifiers: Array.isArray(g.modifiers ?? g.Modifiers)
            ? (g.modifiers ?? g.Modifiers).map((m: any) => ({
                id: Number(m.id ?? m.Id ?? 0),
                modifierName: String(m.modifierName ?? m.ModifierName ?? m.name ?? 'Addon'),
                extraPrice: Number(m.extraPrice ?? m.ExtraPrice ?? m.price ?? 0),
              }))
            : [],
        }));
        setModifierGroups(parsedGroups);
      }

      setLoadingOptions(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  // Toggle modifier
  const toggleModifier = (mod: ItemModifier) => {
    setSelectedModifiers((prev) => {
      const exists = prev.some((m) => m.id === mod.id && m.modifierName === mod.modifierName);
      if (exists) {
        return prev.filter((m) => !(m.id === mod.id && m.modifierName === mod.modifierName));
      }
      return [...prev, mod];
    });
  };

  // Unit Price Calculation
  const effectiveUnitPrice = useMemo(() => {
    if (!item) return 0;
    const base = Number(item.price || 0);
    const variantExtra = selectedVariant ? Number(selectedVariant.additionalPrice || 0) : 0;
    const modifiersExtra = selectedModifiers.reduce((acc, m) => acc + Number(m.extraPrice || 0), 0);
    return base + variantExtra + modifiersExtra;
  }, [item, selectedVariant, selectedModifiers]);

  const totalPrice = Math.round(effectiveUnitPrice * quantity * 100) / 100;

  // Unique cart key to differentiate variants & addon combinations in cart
  const cartKey = useMemo(() => {
    if (!item) return '';
    const vId = selectedVariant ? `v${selectedVariant.id || selectedVariant.variantName}` : 'v0';
    const modIds = selectedModifiers
      .map((m) => `m${m.id || m.modifierName}`)
      .sort()
      .join('-');
    const noteHash = cookingInstructions.trim() ? `_n${cookingInstructions.trim().slice(0, 10)}` : '';
    return `${item.id}_${vId}_${modIds}${noteHash}`;
  }, [item, selectedVariant, selectedModifiers, cookingInstructions]);

  if (!isOpen || !item) return null;

  const handleApply = () => {
    onConfirm({
      item,
      quantity,
      selectedVariant,
      selectedModifiers,
      cookingInstructions: cookingInstructions.trim(),
      effectiveUnitPrice,
      totalPrice,
      cartKey,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E7E1DA] dark:border-[#2B3540]">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-[#E7E1DA] dark:border-[#2B3540]">
              <DishImage
                src={item.imageUrl}
                alt={item.itemName}
                isVeg={item.isVeg}
                className="h-full w-full object-cover"
                fallbackIconSize={20}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {item.itemName}
                </h3>
              </div>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                Base: ₹{item.price} • {item.categoryName || 'Dish'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loadingOptions ? (
            <div className="py-12 text-center text-xs text-[#667085] animate-pulse">
              Loading dish portions & customization options...
            </div>
          ) : (
            <>
              {/* 1. Portion / Variant Selection (If available) */}
              {variants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>Portion / Size (Select 1)</span>
                    </label>
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {variants.map((v) => {
                      const isSelected = selectedVariant?.id === v.id || selectedVariant?.variantName === v.variantName;
                      const calculatedVariantPrice = Number(item.price) + Number(v.additionalPrice || 0);
                      return (
                        <button
                          key={v.id || v.variantName}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626] shadow-sm ring-1 ring-[#DE8626]'
                              : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-extrabold">{v.variantName}</p>
                            <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                              ₹{calculatedVariantPrice}
                              {v.additionalPrice > 0 && ` (+₹${v.additionalPrice})`}
                            </p>
                          </div>
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-[#DE8626] bg-[#DE8626] text-white'
                                : 'border-[#667085]/40'
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Modifiers / Addons (If available) */}
              {modifierGroups.length > 0 &&
                modifierGroups.map((group) => (
                  <div key={group.id || group.groupName} className="space-y-2">
                    <label className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>{group.groupName}</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      {group.modifiers.map((mod) => {
                        const isChecked = selectedModifiers.some(
                          (m) => m.id === mod.id && m.modifierName === mod.modifierName
                        );
                        return (
                          <button
                            key={mod.id || mod.modifierName}
                            type="button"
                            onClick={() => toggleModifier(mod)}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border text-left transition-all ${
                              isChecked
                                ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626] ring-1 ring-[#DE8626]'
                                : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                            }`}
                          >
                            <span className="text-xs font-semibold truncate pr-1">
                              {mod.modifierName}
                            </span>
                            <span className="text-xs font-bold shrink-0">
                              +₹{mod.extraPrice}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {/* 3. Cooking Instructions / Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wider flex items-center gap-1.5">
                  <ChefHat className="h-3.5 w-3.5 text-[#DE8626]" />
                  <span>Kitchen Cooking Instructions (Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cookingInstructions}
                    onChange={(e) => setCookingInstructions(e.target.value)}
                    placeholder="e.g. Less spicy, no coriander, extra hot..."
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] placeholder-[#9CA3AF] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>

              {/* 4. Quantity Stepper */}
              <div className="flex items-center justify-between p-3 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]">
                <div>
                  <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Quantity</p>
                  <p className="text-[11px] text-[#667085]">Item Count to Add</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] disabled:opacity-30 hover:bg-black/5"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-base font-extrabold w-6 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DE8626] text-white hover:bg-[#C4721C]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-[#667085] uppercase font-bold tracking-wider">Item Total</p>
            <p className="text-xl font-extrabold text-[#DE8626]">
              ₹{totalPrice}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] text-xs font-bold text-[#667085] hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#DE8626] text-white text-xs font-bold shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>Add to Order (₹{totalPrice})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
