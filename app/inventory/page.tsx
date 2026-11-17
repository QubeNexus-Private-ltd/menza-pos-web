'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Upload,
  Camera,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  ArrowUpRight,
  TrendingUp,
  Package,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Trash2,
  Edit2,
  Clock,
  Boxes,
  ChefHat,
  Activity,
  Flame,
  UtensilsCrossed,
  Sliders,
  Check,
  X,
  Layers,
  ArrowDownRight,
  TrendingDown,
  ReceiptIndianRupee as Receipt,
  Scale,
  Percent,
  Eye,
  Filter,
  Info,
  Download,
  ArrowUpDown,
  SlidersHorizontal,
  PackageCheck,
  Copy,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Crown,
  Lock,
  Loader2,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import {
  WebInventoryService,
  ScannedInvoiceResult,
  ScannedInvoiceItem,
  RawIngredient,
  WasteLogItem,
  MenuItemRecipe,
  RecipeIngredientItem,
  StockMovementItem,
  StockLedgerStats,
} from '@/services/inventoryService';

type TabType = 'scanner' | 'ingredients' | 'recipes' | 'movements' | 'waste' | 'history';

interface SampleInvoicePreset {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  badgeColor: string;
  url: string;
  filename: string;
}

const SAMPLE_INVOICES: SampleInvoicePreset[] = [
  {
    id: 'mandi',
    title: 'सब्जी मंडी कच्चा पर्चा',
    subtitle: 'Handwritten Hindi Mandi Slip (Tomato, Onion, Chilli, Garlic)',
    type: 'Handwritten Mandi',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    url: '/dummy-invoices/handwritten_mandi_parcha.jpg',
    filename: 'handwritten_mandi_parcha.jpg',
  },
  {
    id: 'dairy',
    title: 'श्री गणेश डेयरी पर्ची',
    subtitle: 'Handwritten Dairy Slip (Paneer, Butter, Cream, Dahi)',
    type: 'Handwritten Dairy',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    url: '/dummy-invoices/handwritten_dairy_slip.jpg',
    filename: 'handwritten_dairy_slip.jpg',
  },
  {
    id: 'poultry',
    title: 'Al-Noor Poultry & Meat',
    subtitle: 'Printed Bill (Boneless Chicken, Curry Cut, Egg Crates)',
    type: 'Poultry / Meat',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    url: '/dummy-invoices/poultry_meat_invoice.jpg',
    filename: 'poultry_meat_invoice.jpg',
  },
  {
    id: 'bilingual',
    title: 'Amul Wholesale Dairy Tax Bill',
    subtitle: 'Bilingual Printed Tax Invoice with itemized GST',
    type: 'Bilingual Invoice',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    url: '/dummy-invoices/dairy_bilingual_invoice.jpg',
    filename: 'dairy_bilingual_invoice.jpg',
  },
];

const RECIPE_BOM_UNITS = ['Kg', 'g', 'L', 'ml', 'Pcs', 'Box'];

const normalizeUnitName = (u?: string): string => {
  if (!u) return 'Kg';
  const clean = u.trim();
  const lower = clean.toLowerCase();
  if (lower === 'kg' || lower === 'kgs' || lower === 'kilogram' || lower === 'kilograms') return 'Kg';
  if (lower === 'g' || lower === 'gm' || lower === 'gms' || lower === 'gram' || lower === 'grams') return 'g';
  if (lower === 'l' || lower === 'ltr' || lower === 'ltrs' || lower === 'liter' || lower === 'litre' || lower === 'liters' || lower === 'litres') return 'L';
  if (lower === 'ml' || lower === 'milliliter' || lower === 'millilitre') return 'ml';
  if (lower === 'pcs' || lower === 'pc' || lower === 'piece' || lower === 'pieces') return 'Pcs';
  if (lower === 'box' || lower === 'boxes' || lower === 'crate') return 'Box';
  if (lower === 'bag' || lower === 'bags') return 'Bag';
  if (lower === 'can' || lower === 'cans') return 'Can';
  if (lower === 'tin' || lower === 'tins') return 'Tin';
  return clean;
};

export default function InventoryPage() {
  const { user, activeRestaurant, restaurants } = useAuthStore();
  const restId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);
  const { hasLoaded: isSubLoaded, isFeatureAllowed, openRenewalModal, subscription } = useSubscriptionStore();
  const isSuperAdmin = Boolean(
    (user as any)?.isSuperAdmin ||
    user?.roles?.some((r: any) =>
      typeof r === 'string' && r.toLowerCase().includes('superadmin')
    )
  );
  const isInventoryAllowed = isFeatureAllowed('inventory');

  const [activeTab, setActiveTab] = useState<TabType>('scanner');
  const [loading, setLoading] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Scanner States
  const [scannedBill, setScannedBill] = useState<ScannedInvoiceResult | null>(null);
  const [editableItems, setEditableItems] = useState<ScannedInvoiceItem[]>([]);
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [previewImageZoom, setPreviewImageZoom] = useState<boolean>(false);

  // Ingredients States
  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newIngredientName, setNewIngredientName] = useState<string>('');
  const [newUnit, setNewUnit] = useState<string>('Kg');
  const [newStock, setNewStock] = useState<string>('0');
  const [newMinLevel, setNewMinLevel] = useState<string>('5');
  const [newCost, setNewCost] = useState<string>('0');

  // Recipes / BOM States
  const [recipes, setRecipes] = useState<MenuItemRecipe[]>([]);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState<string>('');
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [selectedRecipeDish, setSelectedRecipeDish] = useState<MenuItemRecipe | null>(null);
  const [recipeDraftIngredients, setRecipeDraftIngredients] = useState<RecipeIngredientItem[]>([]);
  const [simulatingDishId, setSimulatingDishId] = useState<number | null>(null);
  const [recipeActionFeedback, setRecipeActionFeedback] = useState<string | null>(null);

  // Movements Ledger States
  const [movementLogs, setMovementLogs] = useState<StockMovementItem[]>([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('All');
  const [movementIngredientFilter, setMovementIngredientFilter] = useState<number>(0);
  const [movementSearchTerm, setMovementSearchTerm] = useState<string>('');
  const [movementSortOrder, setMovementSortOrder] = useState<'desc' | 'asc'>('desc');
  const [movementLoading, setMovementLoading] = useState<boolean>(false);
  const [ledgerDensity, setLedgerDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(25);
  const [ledgerTotalCount, setLedgerTotalCount] = useState<number>(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState<number>(1);
  const [ledgerStats, setLedgerStats] = useState<StockLedgerStats>({
    totalPurchasedValue: 0,
    purchaseCount: 0,
    totalCookedValue: 0,
    cookedCount: 0,
    totalWasteValue: 0,
    wasteCount: 0,
    adjustmentCount: 0,
    totalCount: 0,
    netValueDelta: 0,
  });
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const movementSearchInputRef = useRef<HTMLInputElement>(null);

  const handleCopyRef = (refId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!refId) return;
    navigator.clipboard.writeText(refId);
    setCopiedRefId(refId);
    setTimeout(() => {
      setCopiedRefId((prev) => (prev === refId ? null : prev));
    }, 1800);
  };

  // Spoilage / Waste States
  const [showWasteModal, setShowWasteModal] = useState<boolean>(false);
  const [wasteIngredientId, setWasteIngredientId] = useState<number>(0);
  const [wasteQty, setWasteQty] = useState<string>('');
  const [wasteReason, setWasteReason] = useState<string>('Spoilage');
  const [wasteNotes, setWasteNotes] = useState<string>('');
  const [wasteLogs, setWasteLogs] = useState<WasteLogItem[]>([]);
  const [wasteSearchTerm, setWasteSearchTerm] = useState<string>('');

  // Past Invoices
  const [historyInvoices, setHistoryInvoices] = useState<ScannedInvoiceResult[]>([]);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMovements = useCallback(
    async (
      overrides?:
        | number
        | {
            page?: number;
            pageSize?: number;
            ingredientId?: number;
            movementType?: string;
            searchTerm?: string;
          }
    ) => {
      if (restId <= 0) return;
      try {
        setMovementLoading(true);
        const isNum = typeof overrides === 'number';
        const opts = isNum ? { ingredientId: overrides, page: 1 } : overrides || {};

        const page = opts.page !== undefined ? opts.page : ledgerPage;
        const pageSize = opts.pageSize !== undefined ? opts.pageSize : ledgerPageSize;
        const ingredientId = opts.ingredientId !== undefined ? opts.ingredientId : movementIngredientFilter;
        const movementType = opts.movementType !== undefined ? opts.movementType : movementTypeFilter;
        const searchTerm = opts.searchTerm !== undefined ? opts.searchTerm : movementSearchTerm;

        const result = await WebInventoryService.getPagedStockMovements(restId, {
          page: pageSize === 0 ? 1 : page,
          pageSize: pageSize === 0 ? 1000 : pageSize,
          ingredientId,
          movementType,
          searchTerm,
        });

        setMovementLogs(result.items || []);
        setLedgerTotalCount(result.totalCount || 0);
        setLedgerTotalPages(result.totalPages || 1);
        if (result.stats) {
          setLedgerStats(result.stats);
        }
      } catch (err) {
        console.error('Failed to load stock movements:', err);
      } finally {
        setMovementLoading(false);
      }
    },
    [restId, ledgerPage, ledgerPageSize, movementIngredientFilter, movementTypeFilter, movementSearchTerm]
  );

  // Reset ledger page to 1 whenever any filter or search term changes
  useEffect(() => {
    setLedgerPage(1);
  }, [movementTypeFilter, movementIngredientFilter, movementSearchTerm]);

  // Unified debounced movement ledger loader
  useEffect(() => {
    if (restId > 0 && isInventoryAllowed && activeTab === 'movements') {
      const timer = setTimeout(() => {
        loadMovements();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [restId, isInventoryAllowed, activeTab, ledgerPage, ledgerPageSize, movementIngredientFilter, movementTypeFilter, movementSearchTerm]);

  // Load initial reference datasets
  useEffect(() => {
    if (restId > 0 && isInventoryAllowed) {
      loadIngredients();
      loadHistory();
      loadWasteLogs();
      loadRecipes();
    }
  }, [restId, isInventoryAllowed]);

  // Global keyboard shortcut '/' to focus search & 'Escape' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      const isInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

      if (isInput) {
        if (e.key === 'Escape' && activeTab === 'movements') {
          activeEl.blur();
          setMovementSearchTerm('');
        }
        return;
      }

      if (activeTab === 'movements') {
        if (e.key === '/') {
          e.preventDefault();
          movementSearchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const loadIngredients = async () => {
    try {
      const data = await WebInventoryService.getIngredients(restId);
      setIngredients(data || []);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await WebInventoryService.getInvoices(restId);
      setHistoryInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoice history:', err);
    }
  };

  const loadWasteLogs = async () => {
    try {
      const data = await WebInventoryService.getWasteLogs(restId);
      setWasteLogs(data || []);
    } catch (err) {
      console.error('Failed to load waste logs:', err);
    }
  };

  const loadRecipes = async () => {
    try {
      const data = await WebInventoryService.getRecipes(restId);
      setRecipes(data || []);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || restId <= 0) return;

    setScanning(true);
    setScanError(null);
    setConfirmSuccess(null);

    try {
      const result = await WebInventoryService.scanInvoice(restId, file);
      setScannedBill(result);
      setVendorName(result.vendorName || '');
      setInvoiceNumber(result.invoiceNumber || '');
      setInvoiceDate(result.invoiceDate ? result.invoiceDate.substring(0, 10) : new Date().toISOString().substring(0, 10));
      setEditableItems(result.items || []);
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(err.response?.data?.message || err.message || 'Failed to extract invoice data. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleSampleInvoiceClick = async (preset: SampleInvoicePreset) => {
    if (restId <= 0) return;
    setScanning(true);
    setScanError(null);
    setConfirmSuccess(null);

    try {
      const response = await fetch(preset.url);
      const blob = await response.blob();
      const file = new File([blob], preset.filename, { type: blob.type || 'image/jpeg' });

      const result = await WebInventoryService.scanInvoice(restId, file);
      setScannedBill(result);
      setVendorName(result.vendorName || '');
      setInvoiceNumber(result.invoiceNumber || '');
      setInvoiceDate(result.invoiceDate ? result.invoiceDate.substring(0, 10) : new Date().toISOString().substring(0, 10));
      setEditableItems(result.items || []);
    } catch (err: any) {
      console.error('Sample invoice scan error:', err);
      setScanError(err.response?.data?.message || err.message || 'Failed to scan sample slip.');
    } finally {
      setScanning(false);
    }
  };

  const handleItemChange = (index: number, field: keyof ScannedInvoiceItem, value: any) => {
    const updated = [...editableItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'ratePerUnit') {
      const qty = field === 'quantity' ? Number(value) : updated[index].quantity;
      const rate = field === 'ratePerUnit' ? Number(value) : updated[index].ratePerUnit;
      updated[index].lineTotal = Math.round(qty * rate * 100) / 100;
    }

    setEditableItems(updated);
  };

  const handleAddNewItemRow = () => {
    setEditableItems((prev) => [
      ...prev,
      {
        rawScannedText: 'New Ingredient',
        matchedIngredientName: 'New Ingredient',
        quantity: 1,
        unitName: 'Kg',
        ratePerUnit: 0,
        lineTotal: 0,
        isNewIngredient: true,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmInvoice = async () => {
    if (!scannedBill || restId <= 0) return;
    if (editableItems.length === 0) {
      alert('Please add at least one line item to approve into inventory.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        invoiceLogId: scannedBill.invoiceLogId,
        vendorName,
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
        totalAmount: totalCalculatedBill,
        items: editableItems.map((item) => ({
          matchedIngredientId: item.matchedIngredientId,
          ingredientName: item.rawScannedText || 'Ingredient',
          quantity: item.quantity,
          unitName: item.unitName,
          ratePerUnit: item.ratePerUnit,
          lineTotal: item.lineTotal,
        })),
      };

      const res = await WebInventoryService.confirmInvoice(restId, payload);
      setConfirmSuccess(res.message || 'Invoice confirmed and raw materials stock updated!');
      setScannedBill(null);
      await loadIngredients();
      await loadHistory();
      await loadMovements();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to confirm invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientName.trim() || restId <= 0) return;

    try {
      await WebInventoryService.saveIngredient(restId, {
        ingredientName: newIngredientName.trim(),
        unitName: newUnit,
        currentStock: parseFloat(newStock) || 0,
        minimumReorderLevel: parseFloat(newMinLevel) || 5,
        lastPurchaseCostPerUnit: parseFloat(newCost) || 0,
      });

      setShowAddModal(false);
      setNewIngredientName('');
      setNewStock('0');
      setNewCost('0');
      await loadIngredients();
      await loadMovements();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save ingredient.');
    }
  };

  const handleLogWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(wasteQty);
    if (!wasteIngredientId || isNaN(qty) || qty <= 0) {
      alert('Please select an ingredient and enter a positive quantity.');
      return;
    }

    try {
      await WebInventoryService.logWaste(restId, {
        ingredientId: wasteIngredientId,
        quantityWasted: qty,
        reason: wasteReason,
        notes: wasteNotes.trim() || undefined,
      });

      setShowWasteModal(false);
      setWasteQty('');
      setWasteNotes('');
      await loadIngredients();
      await loadWasteLogs();
      await loadMovements();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record wastage.');
    }
  };

  // Recipe Modal Handlers
  const openRecipeConfig = (dish: MenuItemRecipe) => {
    setSelectedRecipeDish(dish);
    setRecipeDraftIngredients(
      dish.ingredients
        ? dish.ingredients.map((i) => ({
            ...i,
            unitName: normalizeUnitName(i.unitName),
          }))
        : []
    );
    setRecipeActionFeedback(null);
    setShowRecipeModal(true);
  };

  const handleAddIngredientRow = () => {
    const firstIng = ingredients.length > 0 ? ingredients[0] : null;
    const initUnit = normalizeUnitName(firstIng?.unitName || 'Kg');
    setRecipeDraftIngredients([
      ...recipeDraftIngredients,
      {
        ingredientId: firstIng ? firstIng.id : 0,
        ingredientName: firstIng ? firstIng.ingredientName : '',
        quantityRequired: 0.1,
        unitName: initUnit,
        costPerUnit: firstIng ? firstIng.lastPurchaseCostPerUnit : 0,
        lineCost: 0,
        wastageBufferPercent: 0,
      },
    ]);
  };

  const handleDraftIngredientChange = (index: number, field: keyof RecipeIngredientItem, value: any) => {
    const updated = [...recipeDraftIngredients];
    if (field === 'ingredientId') {
      const ingId = Number(value);
      const ing = ingredients.find((i) => i.id === ingId);
      updated[index] = {
        ...updated[index],
        ingredientId: ingId,
        ingredientName: ing ? ing.ingredientName : '',
        unitName: normalizeUnitName(ing ? ing.unitName : 'Kg'),
        costPerUnit: ing ? ing.lastPurchaseCostPerUnit : 0,
      };
    } else if (field === 'unitName') {
      updated[index] = { ...updated[index], unitName: normalizeUnitName(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    // Recalculate line cost preview
    const qty = Number(updated[index].quantityRequired) || 0;
    const cost = Number(updated[index].costPerUnit) || 0;
    const buffer = Number(updated[index].wastageBufferPercent) || 0;
    updated[index].lineCost = Math.round(qty * (1 + buffer / 100) * cost * 100) / 100;

    setRecipeDraftIngredients(updated);
  };

  const handleRemoveDraftIngredient = (index: number) => {
    const updated = recipeDraftIngredients.filter((_, i) => i !== index);
    setRecipeDraftIngredients(updated);
  };

  const handleSaveRecipeSubmit = async () => {
    if (!selectedRecipeDish || restId <= 0) return;

    try {
      const payload = {
        menuItemId: selectedRecipeDish.menuItemId,
        ingredients: recipeDraftIngredients
          .filter((i) => i.ingredientId > 0 && i.quantityRequired > 0)
          .map((i) => ({
            ingredientId: i.ingredientId,
            quantityRequired: Number(i.quantityRequired),
            unitName: i.unitName,
            wastageBufferPercent: Number(i.wastageBufferPercent) || 0,
            notes: i.notes,
          })),
      };

      const res = await WebInventoryService.saveRecipe(restId, payload);
      setRecipeActionFeedback(res.message || 'Recipe saved successfully!');
      setTimeout(() => setShowRecipeModal(false), 800);
      await loadRecipes();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save recipe.');
    }
  };

  const handleSimulateCook = async (dish: MenuItemRecipe) => {
    if (dish.ingredientsCount === 0) {
      alert(`Please configure the recipe for "${dish.menuItemName}" first before preparing.`);
      return;
    }

    setSimulatingDishId(dish.menuItemId);
    try {
      const res = await WebInventoryService.deductDish(restId, {
        menuItemId: dish.menuItemId,
        quantity: 1,
        referenceId: `SIM-${Date.now().toString().slice(-6)}`,
      });

      alert(`✅ Cooked 1 Portion of "${dish.menuItemName}"!\n constituent raw ingredients were deducted from stock and written to the movement log.`);
      await loadIngredients();
      await loadMovements();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to simulate cooking.');
    } finally {
      setSimulatingDishId(null);
    }
  };

  // Filtered Lists & Memoized Calculations
  const filteredIngredients = useMemo(() => {
    if (!searchTerm.trim()) return ingredients;
    const term = searchTerm.trim().toLowerCase();
    return ingredients.filter(
      (i) =>
        (i.ingredientName && i.ingredientName.toLowerCase().includes(term)) ||
        (i.sku && i.sku.toLowerCase().includes(term)) ||
        (i.unitName && i.unitName.toLowerCase().includes(term))
    );
  }, [ingredients, searchTerm]);

  const lowStockCount = useMemo(() => {
    return ingredients.filter((i) => i.currentStock <= i.minimumReorderLevel).length;
  }, [ingredients]);

  const totalCalculatedBill = useMemo(() => {
    return editableItems.reduce((acc, curr) => acc + (curr.lineTotal || 0), 0);
  }, [editableItems]);

  const totalStockHoldingValue = useMemo(() => {
    return ingredients.reduce((acc, curr) => acc + (curr.currentStock * curr.lastPurchaseCostPerUnit || 0), 0);
  }, [ingredients]);

  const totalWasteLoss = useMemo(() => {
    return wasteLogs.reduce((acc, curr) => acc + (curr.totalEstimatedLoss || 0), 0);
  }, [wasteLogs]);

  const filteredWasteLogs = useMemo(() => {
    if (!wasteSearchTerm.trim()) return wasteLogs;
    const term = wasteSearchTerm.trim().toLowerCase();
    return wasteLogs.filter(
      (w) =>
        (w.ingredientName && w.ingredientName.toLowerCase().includes(term)) ||
        (w.reason && w.reason.toLowerCase().includes(term)) ||
        (w.notes && w.notes.toLowerCase().includes(term))
    );
  }, [wasteLogs, wasteSearchTerm]);

  const filteredRecipes = useMemo(() => {
    if (!recipeSearchTerm.trim()) return recipes;
    const term = recipeSearchTerm.trim().toLowerCase();
    return recipes.filter(
      (r) =>
        (r.menuItemName && r.menuItemName.toLowerCase().includes(term)) ||
        (r.categoryName && r.categoryName.toLowerCase().includes(term)) ||
        r.ingredients?.some(
          (ing) => ing.ingredientName && ing.ingredientName.toLowerCase().includes(term)
        )
    );
  }, [recipes, recipeSearchTerm]);

  const filteredHistoryInvoices = useMemo(() => {
    if (!historySearchTerm.trim()) return historyInvoices;
    const term = historySearchTerm.trim().toLowerCase();
    return historyInvoices.filter(
      (inv) =>
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(term)) ||
        (inv.vendorName && inv.vendorName.toLowerCase().includes(term)) ||
        inv.items?.some(
          (item) =>
            (item.rawScannedText && item.rawScannedText.toLowerCase().includes(term)) ||
            (item.matchedIngredientName && item.matchedIngredientName.toLowerCase().includes(term))
        )
    );
  }, [historyInvoices, historySearchTerm]);

  const draftRecipeTotalCost = useMemo(() => {
    return recipeDraftIngredients.reduce((acc, curr) => {
      const qty = Number(curr.quantityRequired) || 0;
      const cost = Number(curr.costPerUnit) || 0;
      const buffer = Number(curr.wastageBufferPercent) || 0;
      return acc + qty * (1 + buffer / 100) * cost;
    }, 0);
  }, [recipeDraftIngredients]);

  const draftGrossMargin = useMemo(() => {
    if (!selectedRecipeDish || selectedRecipeDish.price <= 0) return 0;
    const cost = draftRecipeTotalCost;
    return Math.round(((selectedRecipeDish.price - cost) / selectedRecipeDish.price) * 1000) / 10;
  }, [selectedRecipeDish, draftRecipeTotalCost]);

  const paginatedMovements = useMemo(() => {
    if (movementSortOrder === 'asc') {
      return [...movementLogs].reverse();
    }
    return movementLogs;
  }, [movementLogs, movementSortOrder]);

  const handleExportLedgerCsv = async () => {
    try {
      setMovementLoading(true);
      // Fetch up to 1,000 movements matching current filters for full report export
      const exportData = await WebInventoryService.getPagedStockMovements(restId, {
        page: 1,
        pageSize: 1000,
        ingredientId: movementIngredientFilter,
        movementType: movementTypeFilter,
        searchTerm: movementSearchTerm,
      });
      const itemsToExport = exportData.items && exportData.items.length > 0 ? exportData.items : movementLogs;
      if (itemsToExport.length === 0) return;

      const headers = [
        'ID',
        'Date & Time',
        'Movement Type',
        'Raw Ingredient',
        'Quantity Flow',
        'Unit',
        'Balance After',
        'Unit Cost (INR)',
        'Total Value (INR)',
        'Reference ID',
        'Notes & Reason',
      ];
      const rows = itemsToExport.map((m) => {
        const sign = m.quantity >= 0 ? '+' : '';
        const totalVal = Math.round(Math.abs(m.quantity) * (m.costPerUnitAtMovement || 0) * 100) / 100;
        const dateFormatted = m.createdDateUtc ? new Date(m.createdDateUtc).toLocaleString('en-IN') : '';
        return [
          m.id,
          `"${dateFormatted}"`,
          `"${m.movementType}"`,
          `"${m.ingredientName.replace(/"/g, '""')}"`,
          `"${sign}${m.quantity}"`,
          `"${m.unitName}"`,
          m.balanceAfterMovement,
          m.costPerUnitAtMovement || 0,
          totalVal,
          `"${(m.referenceId || '').replace(/"/g, '""')}"`,
          `"${(m.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `menza-stock-ledger-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setMovementLoading(false);
    }
  };

  if (!isSubLoaded) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#DE8626]" />
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] font-medium">Verifying subscription entitlements...</p>
            </div>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (!isInventoryAllowed) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
            {/* Upgrade Paywall Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#DE8626]/15 via-amber-500/5 to-emerald-500/10 border border-[#DE8626]/30 p-8 sm:p-12 text-center shadow-lg">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DE8626]/10 border border-[#DE8626]/20 text-[#DE8626] font-bold text-xs uppercase tracking-wider mb-6">
                <Crown className="w-4 h-4 text-[#DE8626]" />
                Subscription Plan Addon Required
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                Unlock AI Inventory & Smart Stock Management
              </h1>
              <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                Automate your entire kitchen supply chain with AI bill parsing, recipe costing (BOM), real-time KOT stock depletion, and automated waste auditing.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => openRenewalModal(undefined, 'explore')}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#B7791F] text-white font-bold text-sm shadow-md hover:brightness-110 active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade Subscription Plan
                </button>
                <button
                  onClick={() => openRenewalModal(undefined, 'renew')}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 font-semibold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 active:scale-95 transition-all shadow-sm"
                >
                  View Active Plan Details
                </button>
              </div>

              {subscription && (
                <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
                  Current Active Plan: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{subscription.planName || 'Standard'}</span> ({subscription.daysRemaining} days remaining)
                </p>
              )}
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Multimodal Vision AI Scanner</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Digitizes handwritten Hindi mandi parchis, dairy challans, and printed GST tax invoices in seconds. No manual typing needed.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Dish Recipes & Live Food Costing</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Map raw materials to dishes, compute real-time recipe food cost %, protect margins, and automatically deduct stock when KOT orders are placed.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">360° Stock Ledger & Loss Auditing</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Full audit trail of every purchase, consumption, waste, and manual adjustment. Reorder notifications when ingredients run low.
                </p>
              </div>
            </div>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Top Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-transparent border border-amber-500/20 p-6 sm:p-8 backdrop-blur-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI-Powered Inventory & BOM
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Auto-Depletion Active on KOT Orders
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-900/10 dark:bg-neutral-100/10 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                    Outlet: {activeRestaurant?.restaurantName || (restaurants.length > 0 ? restaurants[0].restaurantName : 'Active Restaurant')} (#{restId})
                  </span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  Smart Kitchen Inventory Hub
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
                  Extract handwritten mandi slips & vendor bills with multimodal Vision AI, track real-time dish recipe costs (BOM), and monitor full 360° kitchen stock movements.
                </p>
              </div>

              {/* Fast Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    setActiveTab('scanner');
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-sm shadow-md transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Scan Paper Bill
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 font-semibold text-sm shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Ingredient
                </button>
              </div>
            </div>
          </div>

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Stock Holding Value
                </span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <IndianRupee className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black mt-2 text-neutral-900 dark:text-white">
                ₹{totalStockHoldingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[11px] text-neutral-500 mt-1 block font-medium">
                {ingredients.length} raw ingredients tracked
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Reorder Alert
                </span>
                <span className={`p-2 rounded-xl ${lowStockCount > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-700'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <p className={`text-2xl font-black mt-2 ${lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-white'}`}>
                {lowStockCount} Items
              </p>
              <span className="text-[11px] text-neutral-500 mt-1 block font-medium">
                {lowStockCount > 0 ? 'Requires immediate restock' : 'All stock levels optimal'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Recipe Yield Coverage
                </span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <ChefHat className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black mt-2 text-neutral-900 dark:text-white">
                {recipes.filter((r) => r.ingredientsCount > 0).length} / {recipes.length} Dishes
              </p>
              <span className="text-[11px] text-neutral-500 mt-1 block font-medium">
                Live cost & KOT auto-deduction
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Kitchen Loss / Waste
                </span>
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black mt-2 text-rose-600 dark:text-rose-400">
                ₹{totalWasteLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[11px] text-neutral-500 mt-1 block font-medium">
                {wasteLogs.length} recorded incidents
              </span>
            </div>
          </div>

          {/* Segmented Navigation Bar */}
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-neutral-800/70 w-max min-w-full sm:min-w-0">
              <button
                onClick={() => setActiveTab('scanner')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'scanner'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Camera className="w-4 h-4 text-amber-500" />
                AI Bill Scanner
                {scannedBill && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('ingredients')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'ingredients'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Boxes className="w-4 h-4 text-emerald-500" />
                Raw Materials ({ingredients.length})
                {lowStockCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
                    {lowStockCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('recipes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'recipes'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <ChefHat className="w-4 h-4 text-amber-500" />
                Dish Recipes & BOM
              </button>

              <button
                onClick={() => setActiveTab('movements')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'movements'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 text-blue-500" />
                Stock Movement Ledger
              </button>

              <button
                onClick={() => setActiveTab('waste')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'waste'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Waste Tracking ({wasteLogs.length})
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Receipt className="w-4 h-4 text-neutral-500" />
                Invoice Archive ({historyInvoices.length})
              </button>
            </div>
          </div>

          {/* TAB 1: AI SCANNER HUB */}
          {activeTab === 'scanner' && (
            <div className="space-y-6">
              {confirmSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                    <p className="text-sm font-semibold">{confirmSuccess}</p>
                  </div>
                  <button
                    onClick={() => setConfirmSuccess(null)}
                    className="text-xs font-bold uppercase tracking-wider hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {scanError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center gap-3 shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                  <p className="text-sm font-semibold">{scanError}</p>
                </div>
              )}

              {!scannedBill ? (
                <div className="space-y-6">
                  {/* Upload Dropzone */}
                  <div className="rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 p-8 sm:p-12 text-center transition-all hover:border-amber-400">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                      Scan Vendor Invoice or Handwritten Slip
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-lg mx-auto">
                      Supports phone snapshots, scanned PDFs, Mandi slips (कच्चा पर्चा), dairy receipts, and printed invoices in Hindi or English.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
                      >
                        {scanning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Analyzing Slip with Gemini Multimodal AI...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload Bill / Slip (JPEG, PNG, PDF)
                          </>
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Sample Test Cards ("Try a Sample") */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          One-Click Sample Invoices to Test
                        </h4>
                        <p className="text-xs text-neutral-500">
                          Click any realistic dummy invoice to test extraction accuracy immediately:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {SAMPLE_INVOICES.map((sample) => (
                        <div
                          key={sample.id}
                          className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-all space-y-3"
                        >
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${sample.badgeColor} mb-2`}>
                              {sample.type}
                            </span>
                            <h5 className="font-bold text-sm text-neutral-900 dark:text-white">
                              {sample.title}
                            </h5>
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                              {sample.subtitle}
                            </p>
                          </div>

                          <button
                            onClick={() => handleSampleInvoiceClick(sample)}
                            disabled={scanning}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white transition-all disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Test Scan This Slip
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Split-Screen Reviewer (Left: Document Preview / Right: Extracted Reconciliation) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Scanned Document Preview (4 Cols) */}
                  <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm space-y-4 lg:sticky lg:top-20">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-700/60">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Scanned Bill Document
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {Math.round(scannedBill.confidenceScore * 100)}% Confidence
                      </span>
                    </div>

                    {scannedBill.scannedImageUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-900/5 aspect-[3/4] flex items-center justify-center">
                        <img
                          src={scannedBill.scannedImageUrl}
                          alt="Scanned invoice"
                          className="w-full h-full object-contain cursor-zoom-in"
                          onClick={() => setPreviewImageZoom(!previewImageZoom)}
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-6 text-center text-xs text-neutral-500">
                        <FileText className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                        Document processed via live stream.
                      </div>
                    )}

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                          Vendor / Mandi Supplier
                        </label>
                        <input
                          type="text"
                          value={vendorName}
                          onChange={(e) => setVendorName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                            Invoice #
                          </label>
                          <input
                            type="text"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                            Invoice Date
                          </label>
                          <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Extracted Items Table & Stock Update (8 Cols) */}
                  <div className="lg:col-span-8 rounded-3xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                      <div>
                        <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                          Verified Extracted Items ({editableItems.length})
                        </h3>
                        <p className="text-xs text-neutral-500">
                          Confirm matches with existing inventory ingredients before adding to stock.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddNewItemRow}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Missing Item
                        </button>
                        <button
                          onClick={() => setScannedBill(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handleConfirmInvoice}
                          disabled={loading || editableItems.length === 0}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Updating Stock...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve & Update Inventory
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-700">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 dark:bg-neutral-900/50 uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200 dark:border-neutral-700">
                          <tr>
                            <th className="p-3">Scanned Text / Item</th>
                            <th className="p-3">Matched Ingredient</th>
                            <th className="p-3">Quantity & Unit</th>
                            <th className="p-3">Rate (₹)</th>
                            <th className="p-3">Line Total (₹)</th>
                            <th className="p-3">Rate Variance</th>
                            <th className="p-3 text-center w-14">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                          {editableItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30">
                              <td className="p-3">
                                {item.isNewIngredient || !item.matchedIngredientId ? (
                                  <input
                                    type="text"
                                    value={item.rawScannedText}
                                    onChange={(e) => handleItemChange(idx, 'rawScannedText', e.target.value)}
                                    placeholder="Ingredient name"
                                    className="w-full min-w-[130px] px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20 text-neutral-900 dark:text-white font-bold text-xs focus:ring-1 focus:ring-amber-500"
                                  />
                                ) : (
                                  <span className="font-bold text-neutral-900 dark:text-white">
                                    {item.rawScannedText}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <select
                                  value={item.matchedIngredientId || ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : undefined;
                                    const matched = ingredients.find((ing) => ing.id === val);
                                    handleItemChange(idx, 'matchedIngredientId', val);
                                    if (matched) {
                                      handleItemChange(idx, 'matchedIngredientName', matched.ingredientName);
                                      handleItemChange(idx, 'unitName', matched.unitName);
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-medium"
                                >
                                  <option value="">+ Add as New Ingredient</option>
                                  {ingredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.ingredientName} ({ing.unitName})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-16 px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                                  />
                                  {item.isNewIngredient && !item.matchedIngredientId ? (
                                    <select
                                      value={item.unitName || 'Kg'}
                                      onChange={(e) => handleItemChange(idx, 'unitName', e.target.value)}
                                      className="px-1.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold"
                                    >
                                      {['Kg', 'Gm', 'Ltr', 'Ml', 'Pcs', 'Box', 'Bag', 'Can', 'Tin'].map((u) => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-neutral-500 font-semibold">{item.unitName}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.ratePerUnit}
                                  onChange={(e) => handleItemChange(idx, 'ratePerUnit', parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                                />
                              </td>
                              <td className="p-3 font-bold text-neutral-900 dark:text-white">
                                ₹{item.lineTotal.toFixed(2)}
                              </td>
                              <td className="p-3">
                                {item.priceDifferencePercent !== undefined && item.priceDifferencePercent !== 0 ? (
                                  <span
                                    className={`inline-flex items-center gap-0.5 font-bold ${
                                      item.priceDifferencePercent > 0
                                        ? 'text-red-500'
                                        : 'text-emerald-500'
                                    }`}
                                  >
                                    {item.priceDifferencePercent > 0 ? (
                                      <ArrowUpRight className="w-3 h-3" />
                                    ) : (
                                      <ArrowDownRight className="w-3 h-3" />
                                    )}
                                    {Math.abs(item.priceDifferencePercent)}%
                                  </span>
                                ) : (
                                  <span className="text-neutral-400">Baseline</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                  title="Remove line item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-neutral-50 dark:bg-neutral-900/50 font-bold border-t border-neutral-200 dark:border-neutral-700">
                          <tr>
                            <td colSpan={4} className="p-3 text-right">
                              Total Calculated Amount:
                            </td>
                            <td colSpan={3} className="p-3 text-sm text-amber-600 dark:text-amber-400 font-black">
                              ₹{totalCalculatedBill.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Add Missing Line Item Button */}
                    <button
                      type="button"
                      onClick={handleAddNewItemRow}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 font-bold text-xs transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Missing Line Item (Manual Entry)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RAW INGREDIENTS MASTER */}
          {activeTab === 'ingredients' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search raw ingredients, chicken, paneer, tomatoes..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Ingredient
                  </button>
                  <button
                    onClick={() => {
                      if (ingredients.length > 0) {
                        setWasteIngredientId(ingredients[0].id);
                        setShowWasteModal(true);
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 font-bold text-xs shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Log Waste
                  </button>
                </div>
              </div>

              {/* Ingredients Table */}
              <div className="overflow-x-auto rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/50 uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="p-3.5">Raw Material</th>
                      <th className="p-3.5">Stock Level</th>
                      <th className="p-3.5">Stock Health Bar</th>
                      <th className="p-3.5">Reorder Level</th>
                      <th className="p-3.5">Unit Purchase Cost (₹)</th>
                      <th className="p-3.5">Total Valuation (₹)</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {filteredIngredients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-neutral-500 font-medium">
                          {searchTerm ? `No raw ingredients match "${searchTerm}".` : 'No raw materials added yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredIngredients.map((item) => {
                      const isLow = item.currentStock <= item.minimumReorderLevel;
                      const ratio = item.minimumReorderLevel > 0 
                        ? Math.min(100, Math.round((item.currentStock / (item.minimumReorderLevel * 2)) * 100))
                        : 100;

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30">
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            {item.ingredientName}
                          </td>
                          <td className="p-3.5 font-extrabold text-neutral-900 dark:text-white">
                            {item.currentStock} {item.unitName}
                          </td>
                          <td className="p-3.5 w-44">
                            <div className="space-y-1">
                              <div className="w-full bg-neutral-100 dark:bg-neutral-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isLow ? 'bg-rose-500' : ratio < 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.max(8, ratio)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-neutral-400 font-semibold block">
                                {isLow ? 'Low Stock Warning' : `${ratio}% safety buffer`}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {item.minimumReorderLevel} {item.unitName}
                          </td>
                          <td className="p-3.5 text-neutral-700 dark:text-neutral-300 font-medium">
                            ₹{item.lastPurchaseCostPerUnit} / {item.unitName}
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            ₹{(item.currentStock * item.lastPurchaseCostPerUnit).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => {
                                setWasteIngredientId(item.id);
                                setShowWasteModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Waste
                            </button>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DISH RECIPES & BOM */}
          {activeTab === 'recipes' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={recipeSearchTerm}
                    onChange={(e) => setRecipeSearchTerm(e.target.value)}
                    placeholder="Search by dish name, category, or raw ingredient..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {recipeSearchTerm && (
                    <button
                      onClick={() => setRecipeSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-xs font-semibold text-neutral-500">
                  {recipes.filter((r) => r.ingredientsCount > 0).length} of {recipes.length} dishes linked with recipes
                </div>
              </div>

              {/* Recipe Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRecipes.length === 0 ? (
                  <div className="col-span-full p-8 text-center rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-500 font-medium">
                    {recipeSearchTerm ? `No recipes match "${recipeSearchTerm}".` : 'No menu dishes found.'}
                  </div>
                ) : (
                  filteredRecipes.map((dish) => {
                  const isConfigured = dish.ingredientsCount > 0;
                  return (
                    <div
                      key={dish.menuItemId}
                      className="p-5 rounded-3xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col justify-between space-y-4 hover:border-amber-400 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-base text-neutral-900 dark:text-white">
                            {dish.menuItemName}
                          </h3>
                          <span className="font-black text-neutral-900 dark:text-white text-base">
                            ₹{dish.price}
                          </span>
                        </div>

                        <div className="mt-2">
                          {isConfigured ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <Check className="w-3.5 h-3.5" />
                              {dish.ingredientsCount} Raw Ingredients Linked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-700 text-neutral-500">
                              No Recipe Configured
                            </span>
                          )}
                        </div>

                        {/* Cost & Profit Margin Analysis */}
                        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-700/50 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                              Food Cost / Plate
                            </span>
                            <span className="font-black text-neutral-900 dark:text-white text-base">
                              {isConfigured ? `₹${dish.totalRecipeCost.toFixed(2)}` : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                              Gross Margin %
                            </span>
                            {isConfigured ? (
                              <span
                                className={`font-black text-base ${
                                  dish.grossProfitMarginPercent >= 65
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : dish.grossProfitMarginPercent >= 45
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {dish.grossProfitMarginPercent}%
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </div>
                        </div>

                        {/* Ingredients preview chips */}
                        {isConfigured && dish.ingredients && dish.ingredients.length > 0 && (
                          <div className="mt-3 text-xs space-y-1">
                            <span className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                              BOM Components:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {dish.ingredients.slice(0, 3).map((ing, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-300 text-[11px] font-medium"
                                >
                                  {ing.ingredientName}: {ing.quantityRequired} {normalizeUnitName(ing.unitName)}
                                </span>
                              ))}
                              {dish.ingredients.length > 3 && (
                                <span className="px-1 text-neutral-400 text-[11px] self-center">
                                  +{dish.ingredients.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between gap-2">
                        <button
                          onClick={() => openRecipeConfig(dish)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white transition-all"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          {isConfigured ? 'Edit Recipe' : 'Configure Recipe'}
                        </button>

                        <button
                          onClick={() => handleSimulateCook(dish)}
                          disabled={!isConfigured || simulatingDishId === dish.menuItemId}
                          title="Simulate cooking 1 plate to immediately deduct constituent raw materials"
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-all disabled:opacity-40"
                        >
                          {simulatingDishId === dish.menuItemId ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          Simulate Cook
                        </button>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          )}

          {/* TAB 4: STOCK MOVEMENT LEDGER (360° AUDIT TRAIL) */}
          {activeTab === 'movements' && (
            <div className="space-y-6">
              {/* Header Title & Quick Export Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                        Stock Movement & Velocity Ledger
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1.5 flex-wrap">
                        <span>Real-time 360° audit timeline across purchases, KOT orders, and loss.</span>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                          Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 font-mono text-[10px] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600">/</kbd> to search
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Density Toggle (Compact vs Comfortable) */}
                  <button
                    onClick={() => setLedgerDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 transition-all shadow-sm"
                    title={`Switch to ${ledgerDensity === 'comfortable' ? 'Compact' : 'Comfortable'} row density`}
                  >
                    {ledgerDensity === 'comfortable' ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="hidden sm:inline">Compact</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="hidden sm:inline">Comfortable</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setMovementSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 transition-all shadow-sm"
                    title="Toggle Date Sort Order"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{movementSortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                  </button>

                  <button
                    onClick={handleExportLedgerCsv}
                    disabled={ledgerTotalCount === 0 || movementLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
                    title="Export Ledger to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV ({ledgerTotalCount > 1000 ? 'Top 1,000' : ledgerTotalCount})</span>
                  </button>

                  <button
                    onClick={() => loadMovements()}
                    className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-all"
                    title="Refresh Movement Ledger"
                  >
                    <RefreshCw className={`w-4 h-4 ${movementLoading ? 'animate-spin text-blue-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 4 VELOCITY KPI SUMMARY CARDS (WITH SHIMMER SKELETONS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {movementLoading ? (
                  // KPI Shimmer Skeletons
                  [...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-3xl p-5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 animate-pulse space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                        <div className="w-8 h-8 rounded-2xl bg-neutral-200 dark:bg-neutral-700" />
                      </div>
                      <div className="h-7 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
                      <div className="mt-2 flex justify-between">
                        <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                        <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {/* 1. Purchases / Restock */}
                    <div
                      onClick={() => setMovementTypeFilter(movementTypeFilter === 'Purchase' ? 'All' : 'Purchase')}
                      className={`cursor-pointer group relative overflow-hidden rounded-3xl p-5 border transition-all ${
                        movementTypeFilter === 'Purchase'
                          ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10'
                          : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Inward Purchases
                        </span>
                        <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                          <PackageCheck className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                        +₹{ledgerStats.totalPurchasedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                        <span>{ledgerStats.purchaseCount} Inward Bill Batches</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Stock +
                        </span>
                      </div>
                    </div>

                    {/* 2. Kitchen KOT Depletion */}
                    <div
                      onClick={() => setMovementTypeFilter(movementTypeFilter === 'Sale_KOT' ? 'All' : 'Sale_KOT')}
                      className={`cursor-pointer group relative overflow-hidden rounded-3xl p-5 border transition-all ${
                        movementTypeFilter === 'Sale_KOT'
                          ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
                          : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-blue-500/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Cooked in Orders (KOT)
                        </span>
                        <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                          <ChefHat className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight tabular-nums">
                        -₹{ledgerStats.totalCookedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                        <span>{ledgerStats.cookedCount} Recipe Depletions</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          Order Use
                        </span>
                      </div>
                    </div>

                    {/* 3. Kitchen Spoilage & Loss */}
                    <div
                      onClick={() => setMovementTypeFilter(movementTypeFilter === 'Waste' ? 'All' : 'Waste')}
                      className={`cursor-pointer group relative overflow-hidden rounded-3xl p-5 border transition-all ${
                        movementTypeFilter === 'Waste'
                          ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/20 shadow-lg shadow-rose-500/10'
                          : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-rose-500/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Kitchen Loss & Spoilage
                        </span>
                        <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
                          <Trash2 className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
                        -₹{ledgerStats.totalWasteValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                        <span>{ledgerStats.wasteCount} Waste Incidents</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          Loss -
                        </span>
                      </div>
                    </div>

                    {/* 4. Net Velocity Balance */}
                    <div
                      onClick={() => setMovementTypeFilter('All')}
                      className="cursor-pointer group relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 text-white dark:from-neutral-800 dark:via-neutral-800 dark:to-neutral-900 border border-neutral-700 shadow-md hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                          Net Material Velocity
                        </span>
                        <div className="p-2 rounded-2xl bg-white/10 text-white border border-white/10 group-hover:scale-110 transition-transform">
                          <Scale className="w-4 h-4" />
                        </div>
                      </div>
                      <div
                        className={`text-2xl font-black tracking-tight tabular-nums ${
                          ledgerStats.netValueDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {ledgerStats.netValueDelta >= 0 ? '+' : ''}₹
                        {ledgerStats.netValueDelta.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-400 font-medium">
                        <span>{ledgerStats.totalCount} Total Timeline Events</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-white">
                          Balance Flow
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* FILTER BAR & SEARCH CONTROLS */}
              <div className="space-y-3 p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                {/* Movement Type Filter Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Channel:
                  </span>

                  <button
                    onClick={() => setMovementTypeFilter('All')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      movementTypeFilter === 'All'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    <span>All Movements</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                        movementTypeFilter === 'All'
                          ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900 font-black'
                          : 'bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      {ledgerStats.totalCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setMovementTypeFilter('Sale_KOT')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      movementTypeFilter === 'Sale_KOT'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Cooked in Orders</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums bg-blue-500/20 font-black">
                      {ledgerStats.cookedCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setMovementTypeFilter('Purchase')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      movementTypeFilter === 'Purchase'
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/25'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Inward Vendor Bills</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums bg-emerald-500/20 font-black">
                      {ledgerStats.purchaseCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setMovementTypeFilter('Waste')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      movementTypeFilter === 'Waste'
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/25'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Spoilage / Waste</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums bg-rose-500/20 font-black">
                      {ledgerStats.wasteCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setMovementTypeFilter('Adjustment')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      movementTypeFilter === 'Adjustment'
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Audit Adjustments</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums bg-purple-500/20 font-black">
                      {ledgerStats.adjustmentCount}
                    </span>
                  </button>
                </div>

                {/* Search & Ingredient Scope Row & Page Size */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-700/60">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      ref={movementSearchInputRef}
                      type="text"
                      value={movementSearchTerm}
                      onChange={(e) => setMovementSearchTerm(e.target.value)}
                      placeholder="Search by ingredient, invoice #, KOT #, notes..."
                      className="w-full pl-9 pr-10 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {movementSearchTerm ? (
                      <button
                        onClick={() => setMovementSearchTerm('')}
                        className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        title="Clear Search (Esc)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="absolute right-2.5 top-2.5 pointer-events-none">
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-200 dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-700">
                          /
                        </kbd>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Raw Material Dropdown */}
                    <div className="relative">
                      <select
                        value={movementIngredientFilter}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMovementIngredientFilter(val);
                          setLedgerPage(1);
                        }}
                        className="pl-3 pr-8 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={0}>All Raw Materials ({ingredients.length})</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.ingredientName} ({ing.currentStock} {ing.unitName})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Page Size Selector */}
                    <select
                      value={ledgerPageSize}
                      onChange={(e) => {
                        setLedgerPageSize(Number(e.target.value));
                        setLedgerPage(1);
                      }}
                      className="px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Items per page"
                    >
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                      <option value={0}>All items</option>
                    </select>

                    {movementIngredientFilter > 0 && (
                      <button
                        onClick={() => {
                          setMovementIngredientFilter(0);
                          setLedgerPage(1);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 transition-all"
                        title="Clear Ingredient Filter"
                      >
                        <X className="w-3.5 h-3.5 text-neutral-500" />
                        Clear Scope
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTIVE FILTER BADGE NOTIFICATION */}
              {movementIngredientFilter > 0 && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                  <div className="flex items-center gap-2 font-medium">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>
                      Viewing dedicated audit trail for{' '}
                      <strong>
                        {ingredients.find((i) => i.id === movementIngredientFilter)?.ingredientName || 'selected ingredient'}
                      </strong>
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setMovementIngredientFilter(0);
                      setLedgerPage(1);
                    }}
                    className="font-bold underline hover:no-underline"
                  >
                    View All Materials
                  </button>
                </div>
              )}

              {/* ZERO-CLS SHIMMER LOADING SKELETON */}
              {movementLoading ? (
                <div className="space-y-3">
                  {/* Desktop skeleton */}
                  <div className="hidden lg:block rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 space-y-4 animate-pulse">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full" />
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-8 bg-neutral-100 dark:bg-neutral-700/50 rounded w-full" />
                    ))}
                  </div>

                  {/* Mobile skeleton */}
                  <div className="block lg:hidden space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl p-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 animate-pulse space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                          <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                        </div>
                        <div className="h-6 w-44 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
                        <div className="h-10 bg-neutral-100 dark:bg-neutral-700/40 rounded-xl" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : paginatedMovements.length === 0 ? (
                /* EMPTY STATE */
                <div className="p-12 text-center rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
                  <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                    <div className="p-3.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-400">
                      <Layers className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                      No stock movement records found
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                      No inventory transactions match your selected filter or search keyword.
                    </p>
                    {(movementTypeFilter !== 'All' || movementSearchTerm || movementIngredientFilter > 0) && (
                      <button
                        onClick={() => {
                          setMovementTypeFilter('All');
                          setMovementSearchTerm('');
                          setMovementIngredientFilter(0);
                          setLedgerPage(1);
                        }}
                        className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* VIEW A: DESKTOP DATA-GRID (HIDDEN < LG) */}
                  <div className="hidden lg:block overflow-x-auto rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 backdrop-blur-md bg-neutral-50/95 dark:bg-neutral-900/90 uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200 dark:border-neutral-700 text-[11px]">
                        <tr>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Date & Time</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Channel / Type</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Raw Material</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Flow Delta</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Stock After</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Unit Rate</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Line Value (₹)</th>
                          <th className={ledgerDensity === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>Audit Reference & Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {paginatedMovements.map((log) => {
                          const isOutflow = log.quantity < 0;
                          const lineTotal = Math.round(Math.abs(log.quantity) * (log.costPerUnitAtMovement || 0) * 100) / 100;
                          const isCopied = copiedRefId === log.referenceId;
                          return (
                            <tr
                              key={log.id}
                              className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-700/30 transition-colors group ${
                                ledgerDensity === 'compact' ? 'text-[11px]' : 'text-xs'
                              }`}
                            >
                              {/* 1. Date & Time */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} text-neutral-600 dark:text-neutral-400 font-medium whitespace-nowrap`}>
                                <div className="flex flex-col">
                                  <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                                    {log.createdDateUtc
                                      ? new Date(log.createdDateUtc).toLocaleDateString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : '—'}
                                  </span>
                                  <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                                    {log.createdDateUtc
                                      ? new Date(log.createdDateUtc).toLocaleTimeString('en-IN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : ''}
                                  </span>
                                </div>
                              </td>

                              {/* 2. Channel / Movement Type */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} whitespace-nowrap`}>
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                    log.movementType === 'Purchase'
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                      : log.movementType === 'Sale_KOT'
                                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                      : log.movementType === 'Waste'
                                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                                      : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                                  }`}
                                >
                                  {log.movementType === 'Sale_KOT' ? (
                                    <>
                                      <ChefHat className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span>Kitchen KOT</span>
                                    </>
                                  ) : log.movementType === 'Purchase' ? (
                                    <>
                                      <PackageCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span>Inward Bill</span>
                                    </>
                                  ) : log.movementType === 'Waste' ? (
                                    <>
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                      <span>Spoilage / Loss</span>
                                    </>
                                  ) : (
                                    <>
                                      <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                      <span>{log.movementType}</span>
                                    </>
                                  )}
                                </span>
                              </td>

                              {/* 3. Raw Material (with 1-click filter isolate) */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-neutral-900 dark:text-white">
                                    {log.ingredientName}
                                  </span>
                                  {movementIngredientFilter !== log.ingredientId && (
                                    <button
                                      onClick={() => {
                                        setMovementIngredientFilter(log.ingredientId);
                                        setLedgerPage(1);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-neutral-100 dark:bg-neutral-700 text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 transition-opacity"
                                      title={`Isolate ${log.ingredientName} audit trail`}
                                    >
                                      <Filter className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* 4. Quantity Flow Delta */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} whitespace-nowrap`}>
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl font-mono font-black tabular-nums ${
                                    !isOutflow
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      : log.movementType === 'Sale_KOT'
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  {!isOutflow && '+'}
                                  {log.quantity} {log.unitName}
                                </span>
                              </td>

                              {/* 5. Balance After */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} whitespace-nowrap font-bold text-neutral-900 dark:text-white`}>
                                <span className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-700/60 font-mono tabular-nums text-xs">
                                  {log.balanceAfterMovement} {log.unitName}
                                </span>
                              </td>

                              {/* 6. Unit Cost */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} whitespace-nowrap text-neutral-600 dark:text-neutral-300 font-medium tabular-nums font-mono`}>
                                {log.costPerUnitAtMovement > 0 ? `₹${log.costPerUnitAtMovement}/${log.unitName}` : '—'}
                              </td>

                              {/* 7. Line Value (Financial Impact) */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} whitespace-nowrap font-black font-mono tabular-nums`}>
                                {lineTotal > 0 ? (
                                  <span
                                    className={
                                      !isOutflow
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : log.movementType === 'Sale_KOT'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }
                                  >
                                    {!isOutflow ? '+' : '-'}₹
                                    {lineTotal.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 font-mono">—</span>
                                )}
                              </td>

                              {/* 8. Audit Reference & Notes */}
                              <td className={`${ledgerDensity === 'compact' ? 'px-3.5 py-2' : 'px-4 py-3.5'} max-w-xs`}>
                                <div className="flex flex-col gap-1">
                                  {log.referenceId && (
                                    <div className="flex items-center gap-1 self-start">
                                      <button
                                        onClick={(e) => handleCopyRef(log.referenceId, e)}
                                        className="group/ref inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700/80 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-[10px] font-mono font-bold text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 transition-colors"
                                        title="Click to copy reference ID"
                                      >
                                        <span>{log.referenceId}</span>
                                        {isCopied ? (
                                          <Check className="w-3 h-3 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-2.5 h-2.5 text-neutral-400 group-hover/ref:text-neutral-700 dark:group-hover/ref:text-neutral-200" />
                                        )}
                                      </button>
                                      {isCopied && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-fade-in">
                                          Copied!
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <span className="text-neutral-600 dark:text-neutral-300 text-xs truncate" title={log.notes || ''}>
                                    {log.notes || '—'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* VIEW B: MOBILE & TABLET CARD TIMELINE (BLOCK < LG) */}
                  <div className="block lg:hidden space-y-3">
                    {paginatedMovements.map((log) => {
                      const isOutflow = log.quantity < 0;
                      const lineTotal = Math.round(Math.abs(log.quantity) * (log.costPerUnitAtMovement || 0) * 100) / 100;
                      const isCopied = copiedRefId === log.referenceId;
                      return (
                        <div
                          key={log.id}
                          className="rounded-2xl p-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 shadow-xs space-y-3 transition-all hover:border-neutral-300 dark:hover:border-neutral-600"
                        >
                          {/* Card Header Row */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                log.movementType === 'Purchase'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                  : log.movementType === 'Sale_KOT'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                  : log.movementType === 'Waste'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                              }`}
                            >
                              {log.movementType === 'Sale_KOT' ? (
                                <>
                                  <ChefHat className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  <span>Kitchen KOT</span>
                                </>
                              ) : log.movementType === 'Purchase' ? (
                                <>
                                  <PackageCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>Inward Bill</span>
                                </>
                              ) : log.movementType === 'Waste' ? (
                                <>
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>Waste / Loss</span>
                                </>
                              ) : (
                                <>
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                  <span>{log.movementType}</span>
                                </>
                              )}
                            </span>

                            <div className="text-[11px] font-mono tabular-nums text-neutral-400 flex items-center gap-1">
                              <span>
                                {log.createdDateUtc
                                  ? new Date(log.createdDateUtc).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                    })
                                  : '—'}
                              </span>
                              <span>•</span>
                              <span>
                                {log.createdDateUtc
                                  ? new Date(log.createdDateUtc).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </span>
                            </div>
                          </div>

                          {/* Material & Quantity Delta Row */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="font-bold text-neutral-900 dark:text-white text-sm truncate">
                                {log.ingredientName}
                              </h4>
                              {movementIngredientFilter !== log.ingredientId && (
                                <button
                                  onClick={() => {
                                    setMovementIngredientFilter(log.ingredientId);
                                    setLedgerPage(1);
                                  }}
                                  className="p-1 rounded-md bg-neutral-100 dark:bg-neutral-700 text-neutral-500 hover:text-blue-500"
                                  title="Filter this item"
                                >
                                  <Filter className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-black tabular-nums text-xs shrink-0 ${
                                !isOutflow
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : log.movementType === 'Sale_KOT'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {!isOutflow && '+'}
                              {log.quantity} {log.unitName}
                            </span>
                          </div>

                          {/* Financials Strip */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-700/50 text-xs font-mono tabular-nums">
                            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                              <span className="text-neutral-400">Stock After:</span>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                                {log.balanceAfterMovement} {log.unitName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {log.costPerUnitAtMovement > 0 && (
                                <span className="text-neutral-400 text-[11px]">
                                  @ ₹{log.costPerUnitAtMovement}/{log.unitName}
                                </span>
                              )}
                              {lineTotal > 0 && (
                                <span
                                  className={`font-black ${
                                    !isOutflow
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : log.movementType === 'Sale_KOT'
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {!isOutflow ? '+' : '-'}₹
                                  {lineTotal.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Reference ID & Notes Footer */}
                          {(log.referenceId || log.notes) && (
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-700/50 text-xs">
                              {log.referenceId && (
                                <button
                                  onClick={(e) => handleCopyRef(log.referenceId, e)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700/70 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-[10px] font-mono font-bold text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 transition-colors"
                                  title="Copy reference ID"
                                >
                                  <span>{log.referenceId}</span>
                                  {isCopied ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5 text-neutral-400" />
                                  )}
                                </button>
                              )}
                              {log.notes && (
                                <span className="text-neutral-500 dark:text-neutral-400 text-[11px] truncate flex-1 text-right" title={log.notes}>
                                  {log.notes}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* PAGINATION CONTROLS FOOTER */}
                  {ledgerTotalCount > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                      <div className="text-neutral-500 dark:text-neutral-400 font-medium tabular-nums">
                        {ledgerPageSize === 0 ? (
                          <span>Showing all <strong>{ledgerTotalCount.toLocaleString()}</strong> transactions</span>
                        ) : (
                          <span>
                            Showing{' '}
                            <strong>{(ledgerPage - 1) * ledgerPageSize + 1}</strong> –{' '}
                            <strong>{Math.min(ledgerPage * ledgerPageSize, ledgerTotalCount)}</strong> of{' '}
                            <strong>{ledgerTotalCount.toLocaleString()}</strong> transactions
                          </span>
                        )}
                      </div>

                      {ledgerPageSize > 0 && ledgerTotalPages > 1 && (
                        <div className="flex items-center gap-2 self-center sm:self-auto">
                          <button
                            onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                            disabled={ledgerPage === 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Previous</span>
                          </button>

                          <span className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-mono font-bold text-xs tabular-nums">
                            {ledgerPage} / {ledgerTotalPages}
                          </span>

                          <button
                            onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                            disabled={ledgerPage === ledgerTotalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 5: SPOILAGE & WASTE LOGS */}
          {activeTab === 'waste' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={wasteSearchTerm}
                    onChange={(e) => setWasteSearchTerm(e.target.value)}
                    placeholder="Search waste logs by ingredient, reason, or notes..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {wasteSearchTerm && (
                    <button
                      onClick={() => setWasteSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (ingredients.length > 0) {
                      setWasteIngredientId(ingredients[0].id);
                      setShowWasteModal(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Record Kitchen Loss
                </button>
              </div>

              {/* Waste Table */}
              <div className="overflow-x-auto rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/50 uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="p-3.5">Logged Date</th>
                      <th className="p-3.5">Ingredient Name</th>
                      <th className="p-3.5">Quantity Wasted</th>
                      <th className="p-3.5">Unit Cost (₹)</th>
                      <th className="p-3.5">Financial Loss (₹)</th>
                      <th className="p-3.5">Reason</th>
                      <th className="p-3.5">Staff Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {filteredWasteLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-neutral-500 font-medium">
                          No spoilage or waste records found. Use the &quot;Record Kitchen Loss&quot; button to track waste.
                        </td>
                      </tr>
                    ) : (
                      filteredWasteLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30">
                          <td className="p-3.5 text-neutral-500 font-mono text-[11px]">
                            {log.loggedAtUtc
                              ? new Date(log.loggedAtUtc).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            {log.ingredientName}
                          </td>
                          <td className="p-3.5 font-black text-sm text-rose-600 dark:text-rose-400">
                            -{log.quantityWasted} {log.unitName}
                          </td>
                          <td className="p-3.5 text-neutral-600 dark:text-neutral-400 font-medium">
                            ₹{log.costPerUnit} / {log.unitName}
                          </td>
                          <td className="p-3.5 font-black text-sm text-rose-600 dark:text-rose-400">
                            ₹{log.totalEstimatedLoss?.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                log.reason?.toLowerCase().includes('burn')
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : log.reason?.toLowerCase().includes('drop')
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {log.reason || 'Spoilage'}
                            </span>
                          </td>
                          <td className="p-3.5 text-neutral-600 dark:text-neutral-300 max-w-xs truncate">
                            {log.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: INVOICES ARCHIVE */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    placeholder="Search invoices by vendor, invoice #, ingredient..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {historySearchTerm && (
                    <button
                      onClick={() => setHistorySearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/50 uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="p-3.5">Invoice #</th>
                      <th className="p-3.5">Vendor / Mandi Supplier</th>
                      <th className="p-3.5">Invoice Date</th>
                      <th className="p-3.5">Total Amount (₹)</th>
                      <th className="p-3.5">Items Count</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">AI Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {filteredHistoryInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-neutral-500 font-medium">
                          {historySearchTerm ? 'No archived invoices match your search.' : 'No past scanned invoices found. Scan a bill to populate archive.'}
                        </td>
                      </tr>
                    ) : (
                      filteredHistoryInvoices.map((inv) => (
                        <tr key={inv.invoiceLogId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30">
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white font-mono">
                            {inv.invoiceNumber || `Slip #${inv.invoiceLogId}`}
                          </td>
                          <td className="p-3.5 font-bold text-neutral-800 dark:text-neutral-200">
                            {inv.vendorName || 'Mandi / Local Supplier'}
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3.5 font-black text-sm text-neutral-900 dark:text-white">
                            ₹{inv.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-neutral-500 font-medium">
                            {inv.items?.length || 0} items
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                inv.status === 'Confirmed'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-neutral-500 font-semibold">
                            {Math.round((inv.confidenceScore || 0) * 100)}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODAL 1: ADD RAW INGREDIENT */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-700">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Add New Raw Material
                  </h3>
                  <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateIngredient} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-500 block mb-1">
                      Ingredient Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newIngredientName}
                      onChange={(e) => setNewIngredientName(e.target.value)}
                      placeholder="e.g. Kasuri Methi, Desi Ghee, Garam Masala"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-neutral-500 block mb-1">
                        Tracking Unit
                      </label>
                      <select
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-bold"
                      >
                        <option value="Kg">Kilogram (Kg)</option>
                        <option value="g">Gram (g)</option>
                        <option value="L">Litre (L)</option>
                        <option value="ml">Millilitre (ml)</option>
                        <option value="Pcs">Pieces (Pcs)</option>
                        <option value="Box">Box / Crate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 block mb-1">
                        Initial Stock
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-neutral-500 block mb-1">
                        Min Reorder Level
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newMinLevel}
                        onChange={(e) => setNewMinLevel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 block mb-1">
                        Cost / Unit (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-700">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm"
                    >
                      Save Raw Ingredient
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL 2: LOG SPOILAGE / WASTE */}
          {showWasteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-700">
                  <div className="flex items-center gap-2 text-rose-600">
                    <Trash2 className="w-5 h-5" />
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      Record Spoilage / Kitchen Loss
                    </h3>
                  </div>
                  <button onClick={() => setShowWasteModal(false)} className="text-neutral-400 hover:text-neutral-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleLogWasteSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-500 block mb-1">
                      Raw Ingredient
                    </label>
                    <select
                      value={wasteIngredientId}
                      onChange={(e) => setWasteIngredientId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-bold"
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.ingredientName} (Stock: {ing.currentStock} {ing.unitName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-neutral-500 block mb-1">
                        Quantity Wasted
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={wasteQty}
                        onChange={(e) => setWasteQty(e.target.value)}
                        placeholder="e.g. 2.5"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-black text-rose-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 block mb-1">
                        Reason
                      </label>
                      <select
                        value={wasteReason}
                        onChange={(e) => setWasteReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-semibold"
                      >
                        <option value="Spoilage">Spoilage / Expired</option>
                        <option value="Burned">Burned / Overcooked</option>
                        <option value="Dropped">Dropped / Spilled</option>
                        <option value="TrimLoss">Trimming / Prep Loss</option>
                        <option value="CustomerRejected">Customer Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500 block mb-1">
                      Kitchen Staff Notes
                    </label>
                    <textarea
                      value={wasteNotes}
                      onChange={(e) => setWasteNotes(e.target.value)}
                      placeholder="e.g. Tomato crate got wet in storage, milk curdled"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-700">
                    <button
                      type="button"
                      onClick={() => setShowWasteModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm"
                    >
                      Deduct & Log Loss
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL 3: RECIPE / BOM CONFIGURATOR */}
          {showRecipeModal && selectedRecipeDish && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-neutral-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-neutral-200 dark:border-neutral-700 space-y-4 max-h-[90vh] flex flex-col">
                <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-700">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                        Recipe & Bill of Materials (BOM)
                      </span>
                      {selectedRecipeDish.categoryName && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                          {selectedRecipeDish.categoryName}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white">
                      {selectedRecipeDish.menuItemName}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium mt-0.5">
                      <span>Selling Price: ₹{selectedRecipeDish.price}</span>
                      <span>•</span>
                      <span>Target Cost: ₹{selectedRecipeDish.totalRecipeCost ? selectedRecipeDish.totalRecipeCost.toFixed(2) : '0.00'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowRecipeModal(false)}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {recipeActionFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {recipeActionFeedback}
                  </div>
                )}

                {/* Recipe Ingredients List (Scrollable) */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {recipeDraftIngredients.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700">
                      <ChefHat className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                        No raw ingredients linked to this dish yet.
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Map constituent raw materials so each customer order automatically deducts inventory.
                      </p>
                      <button
                        onClick={handleAddIngredientRow}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Ingredient
                      </button>
                    </div>
                  ) : (
                    recipeDraftIngredients.map((row, idx) => {
                      const matchedIng = ingredients.find((i) => i.id === row.ingredientId);
                      const unitRate = row.costPerUnit || matchedIng?.lastPurchaseCostPerUnit || 0;
                      const unitName = normalizeUnitName(row.unitName || matchedIng?.unitName || 'Kg');

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 space-y-2 text-xs"
                        >
                          <div className="grid grid-cols-12 gap-2 items-center">
                            {/* Ingredient Select */}
                            <div className="col-span-4">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                                Raw Material
                              </label>
                              <select
                                value={row.ingredientId}
                                onChange={(e) => handleDraftIngredientChange(idx, 'ingredientId', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-bold"
                              >
                                {ingredients.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.ingredientName} (₹{ing.lastPurchaseCostPerUnit}/{normalizeUnitName(ing.unitName)})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                                Portion Qty
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={row.quantityRequired}
                                onChange={(e) => handleDraftIngredientChange(idx, 'quantityRequired', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-black"
                              />
                            </div>

                            {/* Unit */}
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                                Unit
                              </label>
                              <select
                                value={normalizeUnitName(row.unitName)}
                                onChange={(e) => handleDraftIngredientChange(idx, 'unitName', e.target.value)}
                                className="w-full px-1.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-bold"
                              >
                                {RECIPE_BOM_UNITS.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </div>

                            {/* Rate / Cost per Unit */}
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                                Cost / Unit (₹)
                              </label>
                              <div className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs truncate">
                                ₹{unitRate.toFixed(2)}/{unitName}
                              </div>
                            </div>

                            {/* Yield / Trim Buffer % */}
                            <div className="col-span-1">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5" title="Prep / Trimming Waste Buffer %">
                                Buffer %
                              </label>
                              <input
                                type="number"
                                step="1"
                                value={row.wastageBufferPercent || 0}
                                onChange={(e) => handleDraftIngredientChange(idx, 'wastageBufferPercent', e.target.value)}
                                placeholder="0%"
                                className="w-full px-1.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-semibold"
                              />
                            </div>

                            {/* Cost & Delete */}
                            <div className="col-span-1 flex items-center justify-between">
                              <div>
                                <span className="text-[9px] text-neutral-400 block font-bold">Line ₹</span>
                                <span className="font-black text-neutral-900 dark:text-white text-xs">
                                  ₹{row.lineCost?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRemoveDraftIngredient(idx)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                title="Remove ingredient"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Cooking & Prep Notes */}
                          <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
                              Prep Notes:
                            </label>
                            <input
                              type="text"
                              value={row.notes || ''}
                              onChange={(e) => handleDraftIngredientChange(idx, 'notes', e.target.value)}
                              placeholder="e.g. Finely chopped, Blanch 2 mins, Marinate with garlic paste..."
                              className="flex-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[11px] placeholder-neutral-400"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}

                  {recipeDraftIngredients.length > 0 && (
                    <button
                      onClick={handleAddIngredientRow}
                      className="w-full py-2.5 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs font-bold hover:border-amber-500 hover:text-amber-500 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Raw Ingredient
                    </button>
                  )}
                </div>

                {/* Footer Cost & Margin Preview */}
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                        Calculated Food Cost
                      </span>
                      <span className="text-lg font-black text-neutral-900 dark:text-white">
                        ₹{draftRecipeTotalCost.toFixed(2)}
                      </span>
                    </div>

                    <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />

                    <div>
                      <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                        Gross Profit Margin
                      </span>
                      <span
                        className={`text-lg font-black ${
                          draftGrossMargin >= 65
                            ? 'text-emerald-600'
                            : draftGrossMargin >= 45
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {draftGrossMargin}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRecipeModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRecipeSubmit}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-sm transition-all"
                    >
                      Save Recipe (BOM)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
