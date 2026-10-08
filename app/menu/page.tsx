'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RefreshCw,
  Power,
  Layers,
  Filter,
  ArrowUpDown,
  Sparkles,
  Upload,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { DishImage } from '@/components/common/DishImage';
import { WebImageUploadService } from '@/services/imageUploadService';
import { MenuService, WebMenuService } from '@/services/menuService';
import { useAuthStore } from '@/stores/useAuthStore';
import { MenuItem, Category } from '@/types/menu';

export default function MenuCatalogPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);

  // Add/Edit Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState<number>(0);
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemCode, setItemCode] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Add / Edit Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const cats = await MenuService.getCatalogTree(currentRestId);
      if (Array.isArray(cats)) {
        setCategories(cats);
        if (cats.length > 0 && !itemCategoryId) {
          setItemCategoryId(cats[0].id || cats[0].categoryId);
        }
        const allItems = cats.flatMap((c) =>
          (c.items || []).map((it) => ({ ...it, categoryId: it.categoryId || c.categoryId }))
        );
        setItems(allItems);
      }
    } catch (err) {
      console.warn('Failed to load menu catalog', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId, itemCategoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle item availability
  const handleToggleStatus = async (item: MenuItem) => {
    const targetId = item.id || item.itemId;
    try {
      setTogglingItemId(targetId);
      const newStatus = !(item.isAvailable ?? true);
      await MenuService.updateMenuItem(targetId, { isAvailable: newStatus, isActive: newStatus });
      setItems((prev) =>
        prev.map((it) => ((it.id || it.itemId) === targetId ? { ...it, isAvailable: newStatus } : it))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to update item status');
    } finally {
      setTogglingItemId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.itemName);
    setItemPrice(String(item.price));
    setItemCategoryId(item.categoryId || categories[0]?.id || 0);
    setItemIsVeg(Boolean(item.isVeg));
    setItemCode((item as any).itemCode || '');
    setItemImageUrl(item.imageUrl || '');
    setItemModalOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setItemName('');
    setItemPrice('');
    setItemCategoryId(categories[0]?.id || 0);
    setItemIsVeg(true);
    setItemCode('');
    setItemImageUrl('');
    setItemModalOpen(true);
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice || !itemCategoryId) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      setSavingItem(true);
      const payload = {
        restaurantId: currentRestId,
        categoryId: itemCategoryId,
        itemName: itemName.trim(),
        itemDescription: '',
        price: parseFloat(itemPrice),
        isVeg: itemIsVeg,
        imageUrl: itemImageUrl.trim(),
      };

      if (editingItem) {
        await MenuService.updateMenuItem(editingItem.id || (editingItem as any).itemId, payload);
      } else {
        await MenuService.createMenuItem({ ...payload, restaurantId: currentRestId });
      }

      await loadData();
      setItemModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save menu item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingImage(true);
      const url = await WebImageUploadService.uploadImage(file);
      setItemImageUrl(url);
    } catch (err: any) {
      alert(err?.message || 'Image upload failed. Please try a valid JPG/PNG image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!window.confirm(`Are you sure you want to delete "${item.itemName}"? This action cannot be undone.`)) return;
    try {
      const itemId = item.id || item.itemId;
      const success = await WebMenuService.deleteMenuItem(itemId, currentRestId);
      if (success) {
        await loadData();
      } else {
        alert('Failed to delete menu item.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting menu item.');
    }
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setNewCatName('');
    setCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCatName(cat.categoryName);
    setCatModalOpen(true);
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.categoryName}"? Dishes in this category may be affected.`)) return;
    try {
      const catId = cat.id || cat.categoryId;
      const success = await WebMenuService.deleteCategory(catId);
      if (success) {
        if (selectedCategory === cat.id || selectedCategory === cat.categoryId) setSelectedCategory(null);
        await loadData();
      } else {
        alert('Failed to delete category.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting category.');
    }
  };

  // Save Category (Create or Update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      setSavingCat(true);
      if (editingCategory) {
        const catId = editingCategory.id || editingCategory.categoryId;
        await WebMenuService.updateCategory(catId, newCatName.trim(), '', currentRestId);
      } else {
        await MenuService.createCategory(currentRestId, newCatName.trim());
      }
      await loadData();
      setNewCatName('');
      setEditingCategory(null);
      setCatModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save category');
    } finally {
      setSavingCat(false);
    }
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== null && item.categoryId !== selectedCategory) return false;
      if (vegFilter === 'VEG' && !item.isVeg) return false;
      if (vegFilter === 'NON_VEG' && item.isVeg) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.itemName.toLowerCase().includes(q) || Boolean((item as any).itemCode && (item as any).itemCode.toLowerCase().includes(q));
      }
      return true;
    });
  }, [items, selectedCategory, vegFilter, searchQuery]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Menu & Catalog
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {items.length} Dishes
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Manage categories, prices, veg/non-veg tags, and instant kitchen stock availability
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setCatModalOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors"
              >
                <Layers className="h-4 w-4 text-[#DE8626]" />
                <span>Add Category</span>
              </button>

              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Dish</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-3 shadow-sm">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter dishes by name or item code..."
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-4 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
              />
            </div>

            {/* Veg / Non-Veg Toggle Filter */}
            <div className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1 text-xs">
              <button
                onClick={() => setVegFilter('ALL')}
                className={`rounded-lg px-3 py-1 font-semibold ${
                  vegFilter === 'ALL'
                    ? 'bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] shadow-sm'
                    : 'text-[#667085]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setVegFilter('VEG')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold ${
                  vegFilter === 'VEG' ? 'bg-emerald-500 text-white shadow-sm' : 'text-[#667085]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Veg
              </button>
              <button
                onClick={() => setVegFilter('NON_VEG')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold ${
                  vegFilter === 'NON_VEG' ? 'bg-red-500 text-white shadow-sm' : 'text-[#667085]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-300" />
                Non-Veg
              </button>
            </div>
          </div>

          {/* Category Horizontal Scrolling Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                selectedCategory === null
                  ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                  : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
              }`}
            >
              All Dishes ({items.length})
            </button>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`group shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                    : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                }`}
              >
                <button type="button" onClick={() => setSelectedCategory(cat.id ?? cat.categoryId ?? null)}>
                  {cat.categoryName}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditCategory(cat);
                  }}
                  title="Edit Category"
                  className="rounded p-0.5 opacity-60 hover:opacity-100 hover:text-amber-200 transition-opacity"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(cat);
                  }}
                  title="Delete Category"
                  className="rounded p-0.5 opacity-60 hover:opacity-100 hover:text-red-300 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="shrink-0 flex items-center gap-1 rounded-xl border border-dashed border-[#DE8626] px-3 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Category</span>
            </button>
          </div>

          {/* Catalog Data Table */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#667085]">Loading menu items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="py-20 text-center text-xs text-[#667085]">
                No menu items found. Click "Add New Dish" to add your first item.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Dish</th>
                      <th className="py-3.5 px-4 font-semibold">Category</th>
                      <th className="py-3.5 px-4 font-semibold">Price</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Status (In Stock)</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {filteredItems.map((item) => {
                      const catName = categories.find((c) => c.id === item.categoryId)?.categoryName || 'General';
                      return (
                        <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] shadow-xs">
                                <DishImage
                                  src={item.imageUrl}
                                  alt={item.itemName}
                                  isVeg={item.isVeg}
                                  showDietBadge
                                  fallbackIconSize={18}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">{item.itemName}</p>
                                </div>
                                {item.description ? (
                                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1 max-w-xs">{item.description}</p>
                                ) : (item as any).itemCode ? (
                                  <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">Code: {(item as any).itemCode}</p>
                                ) : item.portionDisplay ? (
                                  <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">{item.portionDisplay}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#667085] dark:text-[#94A3B8]">
                            <span className="rounded-lg bg-black/5 dark:bg-white/5 px-2 py-1 text-[11px] font-medium">
                              {catName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{item.price}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleStatus(item)}
                              disabled={togglingItemId === item.id}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                                item.isAvailable !== false
                                  ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  item.isAvailable !== false ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                              />
                              <span>{item.isAvailable !== false ? 'Available' : 'Out of Stock'}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2 text-[#667085] hover:border-[#DE8626] hover:text-[#DE8626] transition-colors"
                                title="Edit Dish"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2 text-[#667085] hover:border-red-500 hover:text-red-500 transition-colors"
                                title="Delete Dish"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 1. Add / Edit Dish Modal */}
        {itemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  {editingItem ? 'Edit Dish' : 'Add New Dish'}
                </h3>
                <button onClick={() => setItemModalOpen(false)} className="rounded-lg p-1 text-[#667085]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                    Dish Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Paneer Butter Masala"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.5"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="e.g. 240"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                      Category *
                    </label>
                    <select
                      value={itemCategoryId}
                      onChange={(e) => setItemCategoryId(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.categoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dietary Tag */}
                <div>
                  <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                    Dietary Classification
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(true)}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-bold transition-all ${
                        itemIsVeg
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] text-[#667085]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Vegetarian</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(false)}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-bold transition-all ${
                        !itemIsVeg
                          ? 'border-red-500 bg-red-500/10 text-red-600'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] text-[#667085]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span>Non-Vegetarian</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                    Item Code / Short ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="e.g. PBM-01"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                    Dish Photo / Image
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]">
                      <DishImage
                        src={itemImageUrl}
                        alt="Dish image preview"
                        isVeg={itemIsVeg}
                        fallbackIconSize={16}
                      />
                    </div>
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#DE8626] bg-amber-500/10 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>{isUploadingImage ? 'Uploading Image...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingImage}
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={itemImageUrl}
                    onChange={(e) => setItemImageUrl(e.target.value)}
                    placeholder="Or enter image URL (https://...)"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                  <p className="mt-1 text-[10px] text-[#667085] dark:text-[#94A3B8]">
                    Uploads directly to Menza Azure Blob storage or paste any image URL
                  </p>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setItemModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085] hover:bg-black/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingItem}
                    className="flex-1 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {savingItem ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Dish'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Add / Edit Category Modal */}
        {catModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  {editingCategory ? 'Edit Category' : 'Create Menu Category'}
                </h3>
                <button
                  onClick={() => {
                    setCatModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="rounded-lg p-1 text-[#667085]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Starters, Beverages, Biryani"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCatModalOpen(false);
                      setEditingCategory(null);
                    }}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCat}
                    className="flex-1 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {savingCat ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
