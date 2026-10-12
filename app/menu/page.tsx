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
  Layers,
  SlidersHorizontal,
  Clock,
  Flame,
  PackageCheck,
  Tag,
  FolderPlus,
  Upload,
  LayoutGrid,
  List,
  Sparkles,
  ChefHat,
  FolderOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { DishImage } from '@/components/common/DishImage';
import { ManageVariantsModal } from '@/components/menu/ManageVariantsModal';
import { WebImageUploadService } from '@/services/imageUploadService';
import { WebMenuService } from '@/services/menuService';
import { WebKitchenService, KitchenStationDTO } from '@/services/kitchenService';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { CatalogRemoteDataSource } from '@shared/data/datasources/CatalogRemoteDataSource';
import { MasterDataRemoteDataSource } from '@shared/data/datasources/MasterDataRemoteDataSource';
import { MenuItem } from '@shared/domain/models/Item';
import { Category } from '@shared/domain/models/Category';
import { UnitMaster } from '@shared/domain/models/MasterData';

const catalogDataSource = new CatalogRemoteDataSource();
const masterDataSource = new MasterDataRemoteDataSource();

interface ItemVariantItem {
  id: number;
  name: string;
  price: number;
}

interface ItemModifierItem {
  id: number;
  groupName: string;
  modifierName: string;
  price: number;
}

interface ExtendedMenuItem extends MenuItem {
  variants?: ItemVariantItem[];
  modifiers?: ItemModifierItem[];
  preparationTimeMinutes?: number;
  isSpicy?: boolean;
}

export default function MenuCatalogPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ExtendedMenuItem[]>([]);
  const [stations, setStations] = useState<KitchenStationDTO[]>([]);
  const [units, setUnits] = useState<UnitMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & View State
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outofstock'>('all');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');

  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);

  // Manage Portions & Addons Modal
  const [managingVariantsItem, setManagingVariantsItem] = useState<MenuItem | null>(null);

  // Add / Edit Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExtendedMenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrepTime, setItemPrepTime] = useState('15');
  const [itemCategoryId, setItemCategoryId] = useState<number>(0);
  const [itemStationId, setItemStationId] = useState<number | undefined>(undefined);
  const [itemUnitId, setItemUnitId] = useState<number | undefined>(undefined);
  const [itemPortionDisplay, setItemPortionDisplay] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemIsSpicy, setItemIsSpicy] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Add / Edit Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catStationId, setCatStationId] = useState<number | undefined>(undefined);
  const [catImageUrl, setCatImageUrl] = useState('');
  const [isUploadingCatImage, setIsUploadingCatImage] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  // Add Unit Modal
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [catsRes, itemsRes, stationsRes, unitsRes] = await Promise.allSettled([
        catalogDataSource.getCategories(currentRestId),
        catalogDataSource.getMenuItems(currentRestId),
        WebKitchenService.getStations(currentRestId),
        masterDataSource.getUnits(),
      ]);

      let safeCats: Category[] = [];
      if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value)) {
        safeCats = catsRes.value;
        setCategories(safeCats);
        if (safeCats.length > 0 && !itemCategoryId) {
          setItemCategoryId(safeCats[0].id);
        }
      }

      if (stationsRes.status === 'fulfilled' && Array.isArray(stationsRes.value)) {
        setStations(stationsRes.value);
      }

      if (unitsRes.status === 'fulfilled' && Array.isArray(unitsRes.value)) {
        setUnits(unitsRes.value);
        if (unitsRes.value.length > 0 && !itemUnitId) {
          setItemUnitId(unitsRes.value[0].id);
        }
      }

      if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value)) {
        const enhanced: ExtendedMenuItem[] = itemsRes.value.map((it: any) => {
          const catId = Number(it.categoryId || it.CategoryId || 0);
          const catObj = safeCats.find((c) => Number(c.id) === catId);
          return {
            ...it,
            id: Number(it.id || it.Id || 0),
            itemName: it.itemName || it.ItemName || '',
            description: it.description || it.Description || it.itemDescription || it.ItemDescription || '',
            categoryId: catId,
            categoryName: catObj?.categoryName || it.categoryName || '',
            price: Number(it.price ?? it.Price ?? 0),
            quantity: Number(it.quantity ?? it.Quantity ?? 1),
            portionDisplay: it.portionDisplay || it.PortionDisplay || (it.unitName ? `${it.quantity && it.quantity > 0 ? it.quantity : 1} ${it.unitName}` : undefined),
            unitId: it.unitId ? Number(it.unitId) : undefined,
            unitName: it.unitName || '',
            isVeg: it.isVeg !== undefined ? Boolean(it.isVeg) : true,
            isSpicy: Boolean(it.isSpicy),
            isAvailable: it.isAvailable !== undefined ? Boolean(it.isAvailable) : (it.isActive !== undefined ? Boolean(it.isActive) : true),
            preparationTimeMinutes: Number(it.preparationTimeMinutes || it.PreparationTimeMinutes || 15),
          };
        });
        setItems(enhanced);
      }
    } catch (err) {
      console.warn('Failed to load menu catalog', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId, itemCategoryId, itemUnitId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, stockFilter, vegFilter, searchQuery, itemsPerPage]);

  // Toggle item availability
  const handleToggleStatus = async (item: MenuItem) => {
    try {
      setTogglingItemId(item.id);
      const newStatus = !(item.isAvailable ?? true);
      await catalogDataSource.updateItemStatus(item.id, newStatus);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, isAvailable: newStatus } : it))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to update item status');
    } finally {
      setTogglingItemId(null);
    }
  };

  // Open Edit Dish Modal
  const handleOpenEdit = (item: ExtendedMenuItem) => {
    setEditingItem(item);
    setItemName(item.itemName);
    setItemDesc(item.description || '');
    setItemPrice(String(item.price));
    setItemQuantity(String(item.quantity || 1));
    setItemPrepTime(String(item.preparationTimeMinutes || 15));
    setItemCategoryId(item.categoryId || categories[0]?.id || 0);
    setItemStationId(item.kitchenStationId);
    setItemUnitId(item.unitId || units[0]?.id);
    setItemPortionDisplay(item.portionDisplay || '');
    setItemIsVeg(Boolean(item.isVeg));
    setItemIsSpicy(Boolean(item.isSpicy));
    setItemCode((item as any).itemCode || '');
    setItemImageUrl(item.imageUrl || '');
    setItemModalOpen(true);
  };

  // Open Create Dish Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setItemName('');
    setItemDesc('');
    setItemPrice('');
    setItemQuantity('1');
    setItemPrepTime('15');
    setItemCategoryId(selectedCategory || (categories.length > 0 ? categories[0].id : 0));
    setItemStationId(undefined);
    setItemUnitId(units.length > 0 ? units[0].id : 1);
    setItemPortionDisplay('');
    setItemIsVeg(true);
    setItemIsSpicy(false);
    setItemCode('');
    setItemImageUrl('');
    setItemModalOpen(true);
  };

  // Upload Dish Image File
  const handleDishImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Upload Category Image File
  const handleCatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingCatImage(true);
      const url = await WebImageUploadService.uploadImage(file);
      setCatImageUrl(url);
    } catch (err: any) {
      alert(err?.message || 'Category image upload failed. Please try a valid image.');
    } finally {
      setIsUploadingCatImage(false);
    }
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice || !itemCategoryId) {
      alert('Please fill in all required fields (Dish Name, Base Price, and Category).');
      return;
    }

    try {
      setSavingItem(true);
      const payload = {
        restaurantId: currentRestId,
        categoryId: itemCategoryId,
        itemName: itemName.trim(),
        itemDescription: itemDesc.trim(),
        price: parseFloat(itemPrice) || 0,
        quantity: parseFloat(itemQuantity) || 1,
        unitId: itemUnitId,
        portionDisplay: itemPortionDisplay.trim() || undefined,
        kitchenStationId: itemStationId || undefined,
        isVeg: itemIsVeg,
        isSpicy: itemIsSpicy,
        preparationTimeMinutes: parseInt(itemPrepTime) || 15,
        imageUrl: itemImageUrl.trim(),
      };

      if (editingItem) {
        await catalogDataSource.updateMenuItem(editingItem.id, payload);
      } else {
        await catalogDataSource.createMenuItem(payload);
      }

      await loadData();
      setItemModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save menu item');
    } finally {
      setSavingItem(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: MenuItem) => {
    if (!window.confirm(`Are you sure you want to delete "${item.itemName}"? This action cannot be undone.`)) return;
    try {
      const success = await WebMenuService.deleteMenuItem(item.id, currentRestId);
      if (success) {
        await loadData();
      } else {
        alert('Failed to delete menu item.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting menu item.');
    }
  };

  // Open Create Category Modal
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setNewCatName('');
    setNewCatDesc('');
    setCatStationId(undefined);
    setCatImageUrl('');
    setCatModalOpen(true);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCatName(cat.categoryName);
    setNewCatDesc(cat.description || '');
    setCatStationId(cat.kitchenStationId);
    setCatImageUrl(cat.imageUrl || '');
    setCatModalOpen(true);
  };

  // Save Category (Create or Update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      alert('Please enter category name.');
      return;
    }

    try {
      setSavingCat(true);
      if (editingCategory) {
        await catalogDataSource.updateCategory(
          editingCategory.id,
          newCatName.trim(),
          newCatDesc.trim(),
          currentRestId,
          catImageUrl.trim(),
          catStationId
        );
      } else {
        await catalogDataSource.createCategory(
          newCatName.trim(),
          newCatDesc.trim(),
          currentRestId,
          catImageUrl.trim(),
          catStationId
        );
      }
      const updatedCats = await catalogDataSource.getCategories(currentRestId);
      if (Array.isArray(updatedCats)) {
        setCategories(updatedCats);
        const match = updatedCats.find((c) => c.categoryName.toLowerCase() === newCatName.trim().toLowerCase());
        if (match) {
          setItemCategoryId(match.id);
        }
      }
      setCatModalOpen(false);
      setEditingCategory(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save category');
    } finally {
      setSavingCat(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.categoryName}"? Dishes in this category may be affected.`)) return;
    try {
      const success = await catalogDataSource.deleteCategory(cat.id, currentRestId);
      if (success) {
        if (selectedCategory === cat.id) setSelectedCategory(null);
        await loadData();
      } else {
        alert('Failed to delete category.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting category.');
    }
  };

  // Create Unit Modal Submission
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newUnitName.trim();
    if (!trimmedName) {
      alert('Please enter a Unit Name (e.g. Plate, Portion, Bowl, Slice).');
      return;
    }

    try {
      setSavingUnit(true);
      const res = await masterDataSource.createUnit(trimmedName, newUnitDesc.trim());
      if (res.success) {
        const optimisticUnit: UnitMaster = {
          id: Date.now(),
          unitName: trimmedName,
          shortName: trimmedName,
        };
        setUnits((prev) => [...prev.filter((u) => u.unitName.toLowerCase() !== trimmedName.toLowerCase()), optimisticUnit]);
        setItemUnitId(optimisticUnit.id);
        setNewUnitName('');
        setNewUnitDesc('');
        setUnitModalOpen(false);

        // authoritative refresh
        const refreshed = await masterDataSource.getUnits();
        if (Array.isArray(refreshed) && refreshed.length > 0) {
          setUnits(refreshed);
          const found = refreshed.find((u) => u.unitName.toLowerCase() === trimmedName.toLowerCase());
          if (found) setItemUnitId(found.id);
        }
      } else {
        alert(res.message || 'Could not create unit');
      }
    } catch (err: any) {
      alert(err?.message || 'Error creating unit');
    } finally {
      setSavingUnit(false);
    }
  };

  // Operational Counts
  const inStockCount = useMemo(() => items.filter((x) => x.isAvailable !== false).length, [items]);
  const outOfStockCount = useMemo(() => items.length - inStockCount, [items, inStockCount]);

  // Filtered items logic (matching Menza's search across 5 fields)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category Filter
      if (selectedCategory !== null && Number(item.categoryId) !== Number(selectedCategory)) return false;

      // Stock Filter (3-way)
      if (stockFilter === 'instock' && item.isAvailable === false) return false;
      if (stockFilter === 'outofstock' && item.isAvailable !== false) return false;

      // Dietary Veg Filter
      if (vegFilter === 'VEG' && !item.isVeg) return false;
      if (vegFilter === 'NON_VEG' && item.isVeg) return false;

      // Real-time Text Search (matches name, description, unit, category, code, price)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.itemName.toLowerCase().includes(q);
        const matchesDesc = Boolean(item.description && item.description.toLowerCase().includes(q));
        const matchesCat = Boolean(item.categoryName && item.categoryName.toLowerCase().includes(q));
        const matchesUnit = Boolean(item.unitName && item.unitName.toLowerCase().includes(q));
        const matchesCode = Boolean((item as any).itemCode && String((item as any).itemCode).toLowerCase().includes(q));
        const matchesPrice = Boolean(item.price && String(item.price).includes(q));

        if (!matchesName && !matchesDesc && !matchesCat && !matchesUnit && !matchesCode && !matchesPrice) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedCategory, stockFilter, vegFilter, searchQuery]);

  // Pagination Computations
  const totalItems = filteredItems.length;
  const isAll = itemsPerPage === 'all';
  const effectiveItemsPerPage = isAll ? Math.max(1, totalItems) : Number(itemsPerPage);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / effectiveItemsPerPage));
  const startIndex = isAll ? 0 : (currentPage - 1) * effectiveItemsPerPage;
  const endIndex = isAll ? totalItems : Math.min(startIndex + effectiveItemsPerPage, totalItems);
  const paginatedItems = isAll ? filteredItems : filteredItems.slice(startIndex, endIndex);

  // Selected Unit Name helper for live portion preview
  const currentUnitName = useMemo(() => {
    return units.find((u) => u.id === itemUnitId)?.unitName || '';
  }, [units, itemUnitId]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#DE8626] to-amber-400 flex items-center justify-center text-white shadow-md shadow-[#DE8626]/20">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                    Menu & Catalog
                  </h1>
                  <p className="text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                    {activeRestaurant?.restaurantName || 'Menza Bistro'} • {items.length} Dishes
                  </p>
                </div>
              </div>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* View Mode Switcher */}
              <div className="flex items-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Dish Cards View"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[#DE8626] text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Spreadsheet Table View"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'table'
                      ? 'bg-[#DE8626] text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Add Unit Button */}
              <button
                type="button"
                onClick={() => setUnitModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors"
              >
                <Tag className="h-3.5 w-3.5 text-[#DE8626]" />
                <span>+ Unit</span>
              </button>

              {/* Add Category Button */}
              <button
                type="button"
                onClick={handleOpenCreateCategory}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#DE8626]" />
                <span>+ Category</span>
              </button>

              {/* Add Dish Button */}
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#E58B24] to-[#CB741B] px-4 py-2 text-xs font-black text-white shadow-md shadow-[#DE8626]/25 hover:opacity-95 transition-opacity"
              >
                <Plus className="h-4 w-4 stroke-[2.8]" />
                <span>+ Dish</span>
              </button>
            </div>
          </div>

          {/* Operational Metrics Strip (Identical to Menza) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider block">
                Total Items
              </span>
              <p className="mt-1 text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">{items.length}</p>
            </div>

            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider block">
                Categories
              </span>
              <p className="mt-1 text-2xl font-black text-[#DE8626]">{categories.length}</p>
            </div>

            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider block">
                In Stock
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{inStockCount}</p>
            </div>

            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider block">
                Out of Stock
              </span>
              <p className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">{outOfStockCount}</p>
            </div>
          </div>

          {/* Search & Stock Filter Compact Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-3 shadow-xs">
            {/* Search Field */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#DE8626]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish, category, portion, or price..."
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-9 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1E2930]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick 3-way Stock Switcher (Identical to Menza) */}
            <div className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  stockFilter === 'all'
                    ? 'bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] shadow-xs'
                    : 'text-[#667085]'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('instock')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all ${
                  stockFilter === 'instock'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[#667085] hover:text-emerald-600'
                }`}
              >
                <span>🟢</span>
                <span>{inStockCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('outofstock')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all ${
                  stockFilter === 'outofstock'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-[#667085] hover:text-red-600'
                }`}
              >
                <span>🔴</span>
                <span>{outOfStockCount}</span>
              </button>
            </div>

            {/* Veg / Non-Veg Toggle Filter */}
            <div className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-1 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setVegFilter('ALL')}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  vegFilter === 'ALL'
                    ? 'bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] shadow-xs'
                    : 'text-[#667085]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('VEG')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold transition-all ${
                  vegFilter === 'VEG' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#667085]'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Veg
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('NON_VEG')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold transition-all ${
                  vegFilter === 'NON_VEG' ? 'bg-red-600 text-white shadow-xs' : 'text-[#667085]'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                Non-Veg
              </button>
            </div>
          </div>

          {/* Horizontal Category Strip (Identical to Menza) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* All Categories Chip */}
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                selectedCategory === null
                  ? 'bg-[#DE8626] text-white shadow-xs shadow-[#DE8626]/20'
                  : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
              }`}
            >
              <span>All Dishes</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                selectedCategory === null ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-[#667085]'
              }`}>
                {items.length}
              </span>
            </button>

            {/* Dynamic Categories */}
            {categories.map((cat) => {
              const count = items.filter((i) => Number(i.categoryId) === Number(cat.id)).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <div
                  key={`cat-${cat.id}`}
                  className={`group shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#DE8626] text-white shadow-xs shadow-[#DE8626]/20'
                      : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                  }`}
                >
                  <button type="button" onClick={() => setSelectedCategory(cat.id)} className="flex items-center gap-1.5">
                    <span>{cat.categoryName}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10 text-[#667085]'
                    }`}>
                      {count}
                    </span>
                  </button>

                  <div className="flex items-center gap-0.5 ml-1 border-l border-current/20 pl-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditCategory(cat);
                      }}
                      title="Edit Category"
                      className="rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
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
                      className="rounded p-1 opacity-70 hover:opacity-100 hover:text-red-300 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Quick Add Category Pill */}
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="shrink-0 flex items-center gap-1 rounded-xl border border-dashed border-[#DE8626] px-3 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>+ Category</span>
            </button>

            {/* Quick Add Unit Pill */}
            <button
              type="button"
              onClick={() => setUnitModalOpen(true)}
              className="shrink-0 flex items-center gap-1 rounded-xl border border-dashed border-[#8C7A6B] px-3 py-2 text-xs font-bold text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626] hover:text-[#DE8626] transition-colors"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>+ Unit</span>
            </button>
          </div>

          {/* Main Menu Display Area */}
          {loading ? (
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] py-24 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626] animate-spin mb-3">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-[#667085] dark:text-[#94A3B8]">Loading menu catalog dishes...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] py-20 px-4 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center text-[#DE8626] mb-3">
                <UtensilsCrossed className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">No Menu Items Found</h3>
              <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8] max-w-sm mx-auto">
                {searchQuery || selectedCategory || stockFilter !== 'all' || vegFilter !== 'ALL'
                  ? 'Try adjusting your search query, dietary filter, or active category.'
                  : 'Start setting up your restaurant menu by adding your first dish.'}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {searchQuery || selectedCategory || stockFilter !== 'all' || vegFilter !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      setStockFilter('all');
                      setVegFilter('ALL');
                    }}
                    className="rounded-xl border border-[#DE8626] px-4 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10"
                  >
                    Reset All Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#E58B24] to-[#CB741B] px-5 py-2.5 text-xs font-black text-white shadow-md shadow-[#DE8626]/20 hover:opacity-95"
                  >
                    <Plus className="h-4 w-4 stroke-[2.8]" />
                    <span>Add First Dish</span>
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* ===================== GRID CARDS VIEW (Menza Standard) ===================== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedItems.map((item) => {
                const cat = categories.find((c) => c.id === item.categoryId);
                const routedStation = stations.find((s) => s.id === item.kitchenStationId)
                  || (item.kitchenStationName ? { stationName: item.kitchenStationName } : null)
                  || stations.find((s) => s.id === cat?.kitchenStationId)
                  || (cat?.kitchenStationName ? { stationName: cat.kitchenStationName } : null);

                return (
                  <div
                    key={`card-${item.id}`}
                    className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 shadow-xs hover:border-[#DE8626]/40 transition-all flex flex-col justify-between gap-3"
                  >
                    {/* Top Row: Thumbnail + Details + Controls */}
                    <div className="flex items-start gap-3">
                      {/* Thumbnail with Veg Indicator Badge */}
                      <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] shadow-xs">
                        <DishImage
                          src={item.imageUrl}
                          alt={item.itemName}
                          isVeg={item.isVeg}
                          showDietBadge={true}
                          fallbackIconSize={20}
                        />
                      </div>

                      {/* Main Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] truncate">
                            {item.itemName}
                          </h4>
                          {item.isSpicy && (
                            <span className="inline-flex items-center text-red-500" title="Spicy Dish">
                              <Flame className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                            </span>
                          )}
                        </div>

                        {/* Meta Tags Row */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {item.categoryName && (
                            <span className="rounded-md bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                              {item.categoryName}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 rounded-md bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{item.preparationTimeMinutes || 15}m</span>
                          </span>

                          {item.unitName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                              <PackageCheck className="h-2.5 w-2.5" />
                              <span>{item.unitName}</span>
                            </span>
                          )}

                          {routedStation && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-[#DE8626] border border-amber-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {routedStation.stationName}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {item.description && (
                          <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Right Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#DE8626] transition-colors"
                          title="Edit Dish"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="rounded-lg p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 hover:text-red-500 transition-colors"
                          title="Delete Dish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Price, Portions CTA, and Stock Switch */}
                    <div className="pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{item.price}
                        </span>
                        {Boolean(item.portionDisplay || item.unitName) && (
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-[#DE8626]">
                            {item.portionDisplay || `${item.quantity && item.quantity > 0 ? item.quantity : 1} ${item.unitName}`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Portions & Addons CTA */}
                        <button
                          type="button"
                          onClick={() => setManagingVariantsItem(item)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                          title="Manage Portion Sizing & Add-on Modifiers"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          <span>Portions & Addons</span>
                        </button>

                        {/* In Stock Switch Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingItemId === item.id}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black transition-all ${
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
                          <span>{item.isAvailable !== false ? 'IN STOCK' : 'OUT'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ===================== TABLE VIEW ===================== */
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Dish</th>
                      <th className="py-3.5 px-4 font-semibold">Category</th>
                      <th className="py-3.5 px-4 font-semibold">Price & Portion</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {paginatedItems.map((item) => {
                      const cat = categories.find((c) => c.id === item.categoryId);
                      const catName = cat?.categoryName || 'General';
                      const routedStation = stations.find((s) => s.id === item.kitchenStationId)
                        || (item.kitchenStationName ? { stationName: item.kitchenStationName } : null)
                        || stations.find((s) => s.id === cat?.kitchenStationId)
                        || (cat?.kitchenStationName ? { stationName: cat.kitchenStationName } : null);

                      return (
                        <tr key={`table-${item.id}`} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">{item.itemName}</p>
                                  {item.isSpicy && (
                                    <span title="Spicy Dish">
                                      <Flame className="h-3 w-3 fill-red-500 text-red-500" />
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-0.5 rounded bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[#667085]">
                                    <Clock className="h-2.5 w-2.5" />
                                    {item.preparationTimeMinutes || 15}m
                                  </span>
                                </div>
                                {item.description ? (
                                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1 max-w-xs">{item.description}</p>
                                ) : (item as any).itemCode ? (
                                  <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">Code: {(item as any).itemCode}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#667085] dark:text-[#94A3B8]">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="rounded-lg bg-black/5 dark:bg-white/5 px-2 py-1 text-[11px] font-medium">
                                {catName}
                              </span>
                              {routedStation && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-[#DE8626] border border-amber-500/20">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  {routedStation.stationName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">₹{item.price}</p>
                            {Boolean(item.portionDisplay || item.unitName) && (
                              <p className="text-[10px] font-semibold text-[#DE8626]">
                                {item.portionDisplay || `${item.quantity && item.quantity > 0 ? item.quantity : 1} ${item.unitName}`}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
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
                                type="button"
                                onClick={() => setManagingVariantsItem(item)}
                                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                                title="Portions, Variants & Addons"
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Portions & Addons</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2 text-[#667085] hover:border-[#DE8626] hover:text-[#DE8626] transition-colors"
                                title="Edit Dish"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
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
            </div>
          )}

          {/* Compact Pagination Toolbar (Identical to Menza) */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 shadow-xs text-xs">
              <span className="text-[#667085] dark:text-[#94A3B8]">
                Showing <strong className="text-[#DE8626]">{totalItems}</strong> dishes
              </span>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[#667085] dark:text-[#94A3B8] font-medium">Rows:</span>
                {([10, 25, 50, 'all'] as const).map((size) => (
                  <button
                    key={`ps-${size}`}
                    type="button"
                    onClick={() => setItemsPerPage(size)}
                    className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                      itemsPerPage === size
                        ? 'bg-[#DE8626] text-white shadow-xs'
                        : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] hover:border-[#DE8626]'
                    }`}
                  >
                    {size === 'all' ? 'All' : size}
                  </button>
                ))}
              </div>

              {/* Page Controls */}
              {!isAll && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] p-1.5 text-[#667085] disabled:opacity-40 hover:border-[#DE8626]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] p-1.5 text-[#667085] disabled:opacity-40 hover:border-[#DE8626]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===================== MODALS ===================== */}

        {/* 1. ADD / EDIT MENU ITEM MODAL (100% Identical to Menza MenuCatalogScreen) */}
        {itemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 overflow-y-auto">
            <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl overflow-hidden my-auto">
              {/* Sticky Modal Header */}
              <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1B2127]/95 backdrop-blur-md px-5 sm:px-6 py-4 border-b border-[#E7E1DA] dark:border-[#2B3540] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-[#DE8626] flex items-center justify-center">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-[#1E2930] dark:text-[#F3F4F6]">
                      {editingItem ? 'Edit Dish Details' : 'Add New Dish'}
                    </h3>
                    <p className="text-[11px] font-semibold text-[#7C6F62] dark:text-[#94A3B8]">
                      {editingItem ? `Update details for "${editingItem.itemName}"` : 'Configure dish pricing, portion sizing, and preparation lines'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4 text-xs">
                {/* DISH NAME */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    Dish Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Butter Paneer Masala"
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                  />
                </div>

                {/* DISH PHOTO (Menza Upload Zone & Preview) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    Dish Photo (Optional)
                  </label>
                  {itemImageUrl ? (
                    <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] overflow-hidden">
                      <div className="relative h-36 w-full bg-black/5 dark:bg-white/5">
                        <img
                          src={itemImageUrl}
                          alt={itemName || 'Dish preview'}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>Photo Attached</span>
                        </div>
                      </div>
                      <div className="p-3 flex items-center justify-between gap-2 bg-white dark:bg-[#1B2127] border-t border-[#E7E1DA] dark:border-[#2B3540]">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors">
                          <Camera className="h-3.5 w-3.5" />
                          <span>{isUploadingImage ? 'Uploading...' : 'Change Photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingImage}
                            onChange={handleDishImageUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setItemImageUrl('')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="cursor-pointer block rounded-2xl border-2 border-dashed border-[#DE8626]/40 hover:border-[#DE8626] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-center transition-all group">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 text-[#DE8626] flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                          <Camera className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          {isUploadingImage ? 'Uploading Image...' : 'Upload Dish Photo'}
                        </p>
                        <p className="text-[10px] text-[#7C6F62] dark:text-[#94A3B8] mt-0.5">
                          Tap to capture or choose from library / files
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingImage}
                          onChange={handleDishImageUpload}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={itemImageUrl}
                        onChange={(e) => setItemImageUrl(e.target.value)}
                        placeholder="Or enter direct image URL (https://...)"
                        className="w-full h-9 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* CATEGORY SELECTOR (with In-line + New Category Shortcut) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setCatModalOpen(true)}
                      className="text-[11px] font-bold text-[#DE8626] hover:underline"
                    >
                      + New Category
                    </button>
                  </div>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(Number(e.target.value))}
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                  >
                    {categories.length === 0 ? (
                      <option value={0}>No categories available (click + New Category)</option>
                    ) : (
                      categories.map((c) => (
                        <option key={`opt-cat-${c.id}`} value={c.id}>
                          {c.categoryName}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* BASE PRICE, PORTION QTY & PREP TIME (Responsive 3 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                      Base Price (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7C6F62]">₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.5"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        placeholder="e.g. 280"
                        className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-8 pr-3 font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                      Portion Qty
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                      Prep (Min)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7C6F62]" />
                      <input
                        type="number"
                        min="1"
                        value={itemPrepTime}
                        onChange={(e) => setItemPrepTime(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-9 pr-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* SERVING UNIT & PORTION DISPLAY (Responsive 2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider">
                        Serving Unit
                      </label>
                      <button
                        type="button"
                        onClick={() => setUnitModalOpen(true)}
                        className="text-[11px] font-bold text-[#DE8626] hover:underline"
                      >
                        + New Unit
                      </button>
                    </div>
                    <select
                      value={itemUnitId ?? ''}
                      onChange={(e) => setItemUnitId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                    >
                      {units.map((u) => (
                        <option key={`opt-u-${u.id}`} value={u.id}>
                          {u.unitName} {u.shortName ? `(${u.shortName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider">
                        Portion Display (Optional)
                      </label>
                      {currentUnitName && (
                        <span className="text-[10px] text-[#7C6F62]">
                          Auto: {itemQuantity || 1} {currentUnitName}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={itemPortionDisplay}
                      onChange={(e) => setItemPortionDisplay(e.target.value)}
                      placeholder={currentUnitName ? `e.g. ${itemQuantity || 1} ${currentUnitName} / Half` : 'e.g. 1 Plate / 2 Pcs'}
                      className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                    />
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    placeholder="Ingredients, taste notes, allergens, or preparation details"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors resize-none"
                  />
                </div>

                {/* PREPARATION KITCHEN STATION ROUTING (Menza Chip Selector) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    Preparation Kitchen Station
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setItemStationId(undefined)}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        !itemStationId
                          ? 'bg-[#DE8626] text-white shadow-xs'
                          : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] hover:border-[#DE8626]'
                      }`}
                    >
                      Inherit from Category (Main Kitchen)
                    </button>
                    {stations.map((st) => {
                      const isSelected = itemStationId === st.id;
                      const stationColor = st.colorHex || (st as any).badgeColor;
                      return (
                        <button
                          key={`chip-st-${st.id}`}
                          type="button"
                          onClick={() => setItemStationId(st.id)}
                          style={isSelected && stationColor ? { backgroundColor: stationColor, borderColor: stationColor } : undefined}
                          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                            isSelected
                              ? (stationColor ? 'text-white shadow-xs' : 'bg-[#DE8626] text-white shadow-xs')
                              : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] hover:border-[#DE8626]'
                          }`}
                        >
                          {st.stationName} ({st.stationCode})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DIETARY & SPICY SWITCH CARDS (Menza switchBoxRow) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Vegetarian Switch Card */}
                  <div
                    onClick={() => setItemIsVeg(!itemIsVeg)}
                    className={`cursor-pointer rounded-2xl border p-3 flex items-center justify-between transition-all select-none ${
                      itemIsVeg
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-red-500/40 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`h-4 w-4 rounded-md border-2 flex items-center justify-center ${
                        itemIsVeg ? 'border-emerald-600' : 'border-red-600'
                      }`}>
                        <div className={`h-2 w-2 rounded-full ${itemIsVeg ? 'bg-emerald-600' : 'bg-red-600'}`} />
                      </div>
                      <div>
                        <p className={`font-bold text-xs ${itemIsVeg ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {itemIsVeg ? 'Vegetarian 🟩' : 'Non-Vegetarian 🟥'}
                        </p>
                        <span className="text-[10px] text-[#667085]">
                          {itemIsVeg ? 'Pure veg dietary dish' : 'Contains meat / egg / seafood'}
                        </span>
                      </div>
                    </div>
                    <div className={`relative h-6 w-11 rounded-full transition-colors ${
                      itemIsVeg ? 'bg-emerald-600' : 'bg-red-500'
                    }`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        itemIsVeg ? 'left-5' : 'left-0.5'
                      }`} />
                    </div>
                  </div>

                  {/* Spicy Dish Switch Card */}
                  <div
                    onClick={() => setItemIsSpicy(!itemIsSpicy)}
                    className={`cursor-pointer rounded-2xl border p-3 flex items-center justify-between transition-all select-none ${
                      itemIsSpicy
                        ? 'border-red-500/40 bg-red-500/5'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                        itemIsSpicy ? 'bg-red-500/15 text-red-600' : 'bg-black/5 dark:bg-white/5 text-[#667085]'
                      }`}>
                        <Flame className={`h-4 w-4 ${itemIsSpicy ? 'fill-red-500 text-red-500' : 'text-[#667085]'}`} />
                      </div>
                      <div>
                        <p className={`font-bold text-xs ${itemIsSpicy ? 'text-red-700 dark:text-red-400' : 'text-[#1E2930] dark:text-[#F3F4F6]'}`}>
                          {itemIsSpicy ? 'Spicy Dish 🌶️' : 'Mild / Normal'}
                        </p>
                        <span className="text-[10px] text-[#667085]">
                          {itemIsSpicy ? 'Marked with chili flame icon' : 'Regular spice level'}
                        </span>
                      </div>
                    </div>
                    <div className={`relative h-6 w-11 rounded-full transition-colors ${
                      itemIsSpicy ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        itemIsSpicy ? 'left-5' : 'left-0.5'
                      }`} />
                    </div>
                  </div>
                </div>

                {/* ITEM CODE / SHORT ID (OPTIONAL) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                    Item Code / Short ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="e.g. BPM-01"
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] transition-colors"
                  />
                </div>
              </form>

              {/* Sticky Modal Footer */}
              <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-[#1B2127]/95 backdrop-blur-md px-5 sm:px-6 py-4 border-t border-[#E7E1DA] dark:border-[#2B3540] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] font-bold text-xs text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  disabled={savingItem}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#E58B24] to-[#CB741B] font-black text-xs text-white shadow-md shadow-[#DE8626]/20 hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                >
                  {savingItem ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{editingItem ? 'UPDATE DISH' : 'SAVE DISH'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. ADD / EDIT CATEGORY MODAL (Higher z-index so it stacks cleanly over Dish modal) */}
        {catModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl p-6 my-auto">
              <div className="flex items-center justify-between mb-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-3">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                    {editingCategory ? 'Edit Category' : 'Create Menu Category'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCatModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="rounded-lg p-1 text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Starters, Main Course, Beverages"
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="e.g. Freshly prepared appetizers & snacks"
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                    Assigned Kitchen Station (Optional)
                  </label>
                  <select
                    value={catStationId ?? ''}
                    onChange={(e) => setCatStationId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  >
                    <option value="">Default (Main Kitchen)</option>
                    {stations.map((st) => (
                      <option key={`c-st-${st.id}`} value={st.id}>
                        {st.stationName} ({st.stationCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Banner Image */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                    Category Banner Image (Optional)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#DE8626] bg-amber-500/10 px-3 py-2 font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors">
                      <Camera className="h-3.5 w-3.5" />
                      <span>{isUploadingCatImage ? 'Uploading...' : 'Upload Banner'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingCatImage}
                        onChange={handleCatImageUpload}
                        className="hidden"
                      />
                    </label>
                    {catImageUrl && (
                      <button
                        type="button"
                        onClick={() => setCatImageUrl('')}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 px-2.5 py-2 font-bold text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={catImageUrl}
                    onChange={(e) => setCatImageUrl(e.target.value)}
                    placeholder="Or enter banner image URL..."
                    className="w-full h-9 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCatModalOpen(false);
                      setEditingCategory(null);
                    }}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 font-bold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCat}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#E58B24] to-[#DE8626] py-2.5 font-bold text-white shadow-md shadow-[#DE8626]/20 hover:opacity-95 disabled:opacity-50"
                  >
                    {savingCat ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. CREATE SERVING UNIT MODAL (Higher z-index so it stacks cleanly over Dish modal) */}
        {unitModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl p-6 my-auto">
              <div className="flex items-center justify-between mb-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                    Create Serving Unit
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUnitModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUnit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                    Unit Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Slice, Portion, Pitcher, Bowl, Scoop"
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#7C6F62] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newUnitDesc}
                    onChange={(e) => setNewUnitDesc(e.target.value)}
                    placeholder="e.g. Standard single portion unit measure"
                    className="w-full h-10 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 font-bold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingUnit}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#E58B24] to-[#DE8626] py-2.5 font-bold text-white shadow-md shadow-[#DE8626]/20 hover:opacity-95 disabled:opacity-50"
                  >
                    {savingUnit ? 'Creating...' : 'Create Unit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. MANAGE PORTIONS & ADD-ONS MODAL */}
        {managingVariantsItem && (
          <ManageVariantsModal
            isOpen={Boolean(managingVariantsItem)}
            item={managingVariantsItem}
            onClose={() => setManagingVariantsItem(null)}
            onUpdated={loadData}
          />
        )}
      </AppShell>
    </AuthGuard>
  );
}
