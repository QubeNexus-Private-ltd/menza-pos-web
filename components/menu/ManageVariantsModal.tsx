'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  Check,
  AlertCircle,
  IndianRupee,
  UtensilsCrossed,
  FolderPlus,
} from 'lucide-react';
import { MenuItem } from '@shared/domain/models/Item';
import { CatalogRemoteDataSource } from '@shared/data/datasources/CatalogRemoteDataSource';

interface ManageVariantsModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface VariantItem {
  id: number;
  variantName: string;
  additionalPrice: number;
}

interface ModifierItem {
  id: number;
  modifierName: string;
  extraPrice: number;
}

interface ModifierGroup {
  id: number;
  groupName: string;
  modifiers: ModifierItem[];
}

const catalogDataSource = new CatalogRemoteDataSource();

export function ManageVariantsModal({
  isOpen,
  item,
  onClose,
  onUpdated,
}: ManageVariantsModalProps) {
  const [activeTab, setActiveTab] = useState<'variants' | 'modifiers'>('variants');
  const [loading, setLoading] = useState(true);

  // Variants State
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(null);

  // Modifiers State
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newModName, setNewModName] = useState('');
  const [newModPrice, setNewModPrice] = useState('');
  const [isAddingMod, setIsAddingMod] = useState(false);

  const loadVariantsAndModifiers = useCallback(async () => {
    if (!item?.id) return;
    try {
      setLoading(true);
      const [varRes, modRes] = await Promise.allSettled([
        catalogDataSource.getItemVariants(item.id),
        catalogDataSource.getItemModifierGroups(item.id),
      ]);

      if (varRes.status === 'fulfilled' && Array.isArray(varRes.value)) {
        setVariants(
          varRes.value.map((v: any) => ({
            id: Number(v.id ?? v.Id ?? 0),
            variantName: String(v.variantName ?? v.VariantName ?? v.name ?? 'Standard'),
            additionalPrice: Number(v.additionalPrice ?? v.AdditionalPrice ?? v.priceDelta ?? 0),
          }))
        );
      }

      if (modRes.status === 'fulfilled' && Array.isArray(modRes.value)) {
        const parsedGroups: ModifierGroup[] = modRes.value.map((g: any) => ({
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
        if (parsedGroups.length > 0 && !selectedGroupId) {
          setSelectedGroupId(parsedGroups[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load item variants and modifiers:', err);
    } finally {
      setLoading(false);
    }
  }, [item?.id, selectedGroupId]);

  useEffect(() => {
    if (isOpen && item?.id) {
      loadVariantsAndModifiers();
    }
  }, [isOpen, item?.id, loadVariantsAndModifiers]);

  if (!isOpen || !item) return null;

  // Add Variant
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantName.trim()) {
      alert('Please enter a variant portion name (e.g. Half, Full, Large).');
      return;
    }

    try {
      setIsAddingVariant(true);
      const delta = parseFloat(newVariantPrice) || 0;
      const res = await catalogDataSource.addItemVariant(item.id, newVariantName.trim(), delta);
      if (res.success) {
        setNewVariantName('');
        setNewVariantPrice('');
        await loadVariantsAndModifiers();
        onUpdated?.();
      } else {
        alert(res.message || 'Failed to add variant.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error adding variant.');
    } finally {
      setIsAddingVariant(false);
    }
  };

  // Delete Variant
  const handleDeleteVariant = async (variantId: number) => {
    if (!window.confirm('Are you sure you want to delete this portion variant?')) return;
    try {
      setDeletingVariantId(variantId);
      const success = await catalogDataSource.deleteItemVariant(variantId);
      if (success) {
        await loadVariantsAndModifiers();
        onUpdated?.();
      } else {
        alert('Failed to delete variant.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting variant.');
    } finally {
      setDeletingVariantId(null);
    }
  };

  // Add Modifier Group
  const handleAddModifierGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setIsAddingGroup(true);
      const res = await catalogDataSource.addItemModifierGroup(item.id, newGroupName.trim());
      if (res.success) {
        setNewGroupName('');
        await loadVariantsAndModifiers();
        if (res.id) setSelectedGroupId(res.id);
        onUpdated?.();
      } else {
        alert('Failed to create modifier group.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error creating modifier group.');
    } finally {
      setIsAddingGroup(false);
    }
  };

  // Add Modifier to Selected Group
  const handleAddModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !newModName.trim()) return;

    try {
      setIsAddingMod(true);
      const extra = parseFloat(newModPrice) || 0;
      const res = await catalogDataSource.addItemModifier(selectedGroupId, newModName.trim(), extra);
      if (res.success) {
        setNewModName('');
        setNewModPrice('');
        await loadVariantsAndModifiers();
        onUpdated?.();
      } else {
        alert('Failed to add modifier.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error adding modifier.');
    } finally {
      setIsAddingMod(false);
    }
  };

  const activeGroup = modifierGroups.find((g) => g.id === selectedGroupId) || modifierGroups[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E7E1DA] dark:border-[#2B3540]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                Portions & Addon Modifiers
              </h3>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-[#DE8626]">
                {item.itemName} (₹{item.price})
              </span>
            </div>
            <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
              Configure portion sizes (Half/Full) and add-on toppings for kitchen & POS orders
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dual Tabs Bar */}
        <div className="flex border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-5">
          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'variants'
                ? 'border-[#DE8626] text-[#DE8626]'
                : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Portions & Sizes ({variants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('modifiers')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'modifiers'
                ? 'border-[#DE8626] text-[#DE8626]'
                : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Modifier Groups & Addons ({modifierGroups.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-20 text-center text-xs text-[#667085] animate-pulse">
              Loading customization rules...
            </div>
          ) : activeTab === 'variants' ? (
            /* TAB 1: VARIANTS */
            <div className="space-y-4">
              {/* Add Variant Form */}
              <form
                onSubmit={handleAddVariant}
                className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
              >
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                    Portion / Size Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    placeholder="e.g. Regular, Half, Full, 500g"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="w-full sm:w-36">
                  <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                    Price Delta (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newVariantPrice}
                    onChange={(e) => setNewVariantPrice(e.target.value)}
                    placeholder="e.g. +80 or 0"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingVariant}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-colors shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isAddingVariant ? 'Adding...' : 'Add Portion'}</span>
                </button>
              </form>

              {/* Variants List */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden">
                <div className="px-4 py-3 bg-[#FAF7F2] dark:bg-[#151A20] border-b border-[#E7E1DA] dark:border-[#2B3540] flex justify-between text-xs font-bold text-[#667085]">
                  <span>Configured Portions</span>
                  <span>Calculated Price</span>
                </div>

                {variants.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    No custom portions added yet. This dish sells at its standard base price of ₹{item.price}.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 text-xs">
                    {variants.map((v) => {
                      const finalPrice = Number(item.price) + Number(v.additionalPrice || 0);
                      return (
                        <div
                          key={v.id || v.variantName}
                          className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                              {v.variantName}
                            </span>
                            <span className="text-[11px] text-[#667085] ml-2">
                              {v.additionalPrice > 0
                                ? `(+₹${v.additionalPrice} to base)`
                                : '(Base Price)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-[#DE8626] text-sm">
                              ₹{finalPrice}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(v.id)}
                              disabled={deletingVariantId === v.id}
                              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                              title="Delete Portion"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: MODIFIERS */
            <div className="space-y-4">
              {/* Add Modifier Group Bar */}
              <form
                onSubmit={handleAddModifierGroup}
                className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex gap-3"
              >
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                    New Addon / Modifier Group Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Extra Toppings, Crust Choice, Cheese Options"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingGroup}
                  className="self-end flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50 transition-colors shrink-0"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>{isAddingGroup ? 'Creating...' : 'Create Group'}</span>
                </button>
              </form>

              {modifierGroups.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085] border border-dashed rounded-2xl">
                  No modifier groups added for this dish yet. Create a group above to add optional toppings or addons.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Groups Navigation */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                      Select Group
                    </label>
                    <div className="space-y-1.5">
                      {modifierGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGroupId(g.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                            (selectedGroupId || modifierGroups[0].id) === g.id
                              ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626]'
                              : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                          }`}
                        >
                          <span>{g.groupName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-[#1B2127]">
                            {g.modifiers.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Modifiers in Selected Group */}
                  <div className="md:col-span-2 space-y-3">
                    {activeGroup && (
                      <>
                        {/* Add Modifier Item inside selected group */}
                        <form
                          onSubmit={handleAddModifier}
                          className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 flex flex-col sm:flex-row items-stretch sm:items-end gap-2"
                        >
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                              Modifier Name in "{activeGroup.groupName}" *
                            </label>
                            <input
                              type="text"
                              required
                              value={newModName}
                              onChange={(e) => setNewModName(e.target.value)}
                              placeholder="e.g. Extra Mozzarella, Green Olives"
                              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                            />
                          </div>

                          <div className="w-28">
                            <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                              Price (₹)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={newModPrice}
                              onChange={(e) => setNewModPrice(e.target.value)}
                              placeholder="e.g. 40"
                              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isAddingMod}
                            className="flex items-center justify-center gap-1 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add</span>
                          </button>
                        </form>

                        {/* List of modifiers in group */}
                        <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden">
                          {activeGroup.modifiers.length === 0 ? (
                            <div className="py-8 text-center text-xs text-[#667085]">
                              No addons added to this group yet. Add items above.
                            </div>
                          ) : (
                            <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 text-xs">
                              {activeGroup.modifiers.map((m) => (
                                <div
                                  key={m.id || m.modifierName}
                                  className="flex items-center justify-between p-3"
                                >
                                  <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                                    {m.modifierName}
                                  </span>
                                  <span className="font-extrabold text-[#DE8626]">
                                    +₹{m.extraPrice}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#DE8626] text-white text-xs font-bold shadow-md hover:bg-[#C4721C] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
