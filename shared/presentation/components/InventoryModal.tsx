import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import {
  X,
  Boxes,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  ReceiptIndianRupee,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Check,
  ShieldCheck,
  Package,
  ChefHat,
  History,
  Flame,
  Filter,
  Utensils,
  TrendingDown,
  Info,
  SlidersHorizontal,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  inventoryRemoteDataSource,
  ScannedInvoiceResult,
  ScannedInvoiceItem,
  RawIngredient,
  ConfirmInvoicePayload,
  WasteLogItem,
  RecipeIngredientItem,
  MenuItemRecipe,
  SaveRecipePayload,
  StockMovementItem,
  StockLedgerStats,
  DeductDishPayload,
} from '../../data/datasources/InventoryRemoteDataSource';
import { useAuthStore } from '../state/useAuthStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STANDARD_UNITS = ['Kg', 'g', 'L', 'ml', 'Pcs', 'Box', 'Bag', 'Can', 'Tin'];
const RECIPE_BOM_UNITS = ['Kg', 'g', 'L', 'ml', 'Pcs', 'Box'];

export const normalizeUnitName = (u?: string): string => {
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
const WASTE_REASONS = [
  'Expired / Spoiled',
  'Spillage / Dropped',
  'Burnt / Overcooked',
  'Customer Return',
  'Preparation Trim',
  'Other',
];

type InventoryTab = 'scanner' | 'stock' | 'recipes' | 'movements' | 'waste' | 'history';

interface InventoryModalProps {
  visible: boolean;
  onClose: () => void;
  isInventoryAllowed: boolean;
  onUpgradePlan?: () => void;
  restaurantName?: string;
  restaurantId?: number;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  visible,
  onClose,
  isInventoryAllowed,
  onUpgradePlan,
  restaurantName,
  restaurantId = 0,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<InventoryTab>('scanner');

  // Fallback to active restaurant from auth store if restaurantId prop is not provided
  const authActiveRestaurant = useAuthStore((s) => s.activeRestaurant);
  const effectiveRestId = restaurantId > 0 ? restaurantId : (authActiveRestaurant?.restaurantId || 0);
  const effectiveRestName = restaurantName || authActiveRestaurant?.restaurantName || 'Restaurant';

  // Scanner state
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<ScannedInvoiceResult | null>(null);
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [editableItems, setEditableItems] = useState<ScannedInvoiceItem[]>([]);

  // Ingredient Mapping & Unit Picker Modal States
  const [activeMappingIndex, setActiveMappingIndex] = useState<number | null>(null);
  const [mappingSearchQuery, setMappingSearchQuery] = useState<string>('');
  const [activeUnitIndex, setActiveUnitIndex] = useState<number | null>(null);

  // Stock state
  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // History state
  const [invoicesHistory, setInvoicesHistory] = useState<ScannedInvoiceResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // New Ingredient modal state
  const [showAddIngredientModal, setShowAddIngredientModal] = useState<boolean>(false);
  const [newIngredientName, setNewIngredientName] = useState<string>('');
  const [newIngredientUnit, setNewIngredientUnit] = useState<string>('Kg');
  const [newIngredientStock, setNewIngredientStock] = useState<string>('0');
  const [newIngredientMinLevel, setNewIngredientMinLevel] = useState<string>('5');
  const [newIngredientCost, setNewIngredientCost] = useState<string>('0');
  const [newIngredientSku, setNewIngredientSku] = useState<string>('');
  const [savingIngredient, setSavingIngredient] = useState<boolean>(false);

  // Dish Recipes & BOM state
  const [recipes, setRecipes] = useState<MenuItemRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState<boolean>(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState<string>('');
  const [selectedRecipeDish, setSelectedRecipeDish] = useState<MenuItemRecipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [recipeDraftIngredients, setRecipeDraftIngredients] = useState<RecipeIngredientItem[]>([]);
  const [savingRecipe, setSavingRecipe] = useState<boolean>(false);
  const [simulatingDishId, setSimulatingDishId] = useState<number | null>(null);
  const [activeRecipeIngPickerIndex, setActiveRecipeIngPickerIndex] = useState<number | null>(null);
  const [activeRecipeUnitPickerIndex, setActiveRecipeUnitPickerIndex] = useState<number | null>(null);
  const [recipeIngPickerSearch, setRecipeIngPickerSearch] = useState<string>('');
  const [recipeActionFeedback, setRecipeActionFeedback] = useState<string | null>(null);

  // Stock Movement Ledger state
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('All');
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>('');
  const [movementStats, setMovementStats] = useState<StockLedgerStats | null>(null);

  // Waste Tracking state
  const [wasteLogs, setWasteLogs] = useState<WasteLogItem[]>([]);
  const [loadingWasteLogs, setLoadingWasteLogs] = useState<boolean>(false);
  const [wasteSearchQuery, setWasteSearchQuery] = useState<string>('');
  const [showLogWasteModal, setShowLogWasteModal] = useState<boolean>(false);
  const [wasteIngredientId, setWasteIngredientId] = useState<number | null>(null);
  const [wasteQuantity, setWasteQuantity] = useState<string>('0');
  const [wasteReason, setWasteReason] = useState<string>('Expired / Spoiled');
  const [wasteNotes, setWasteNotes] = useState<string>('');
  const [savingWaste, setSavingWaste] = useState<boolean>(false);
  const [showWasteIngPicker, setShowWasteIngPicker] = useState<boolean>(false);
  const [wasteIngPickerSearch, setWasteIngPickerSearch] = useState<string>('');

  // Invoice Archive state
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

  // Load ingredients when opening or switching to stock
  const loadIngredients = useCallback(async () => {
    if (!effectiveRestId || effectiveRestId <= 0) return;
    try {
      setLoadingIngredients(true);
      const data = await inventoryRemoteDataSource.getIngredients(effectiveRestId);
      setIngredients(Array.isArray(data) ? data : []);
    } catch {
      // handle gracefully
    } finally {
      setLoadingIngredients(false);
    }
  }, [effectiveRestId]);

  // Load recipes for dish BOM
  const loadRecipes = useCallback(async () => {
    if (!effectiveRestId || effectiveRestId <= 0) return;
    try {
      setLoadingRecipes(true);
      const data = await inventoryRemoteDataSource.getRecipes(effectiveRestId);
      setRecipes(Array.isArray(data) ? data : []);
    } catch {
      // handle gracefully
    } finally {
      setLoadingRecipes(false);
    }
  }, [effectiveRestId]);

  // Load movements for stock ledger
  const loadMovements = useCallback(async () => {
    if (!effectiveRestId || effectiveRestId <= 0) return;
    try {
      setLoadingMovements(true);
      const res = await inventoryRemoteDataSource.getPagedStockMovements(effectiveRestId, {
        movementType: movementTypeFilter === 'All' ? undefined : movementTypeFilter,
        searchTerm: movementSearchQuery.trim() || undefined,
        pageSize: 50,
      });
      setMovements(Array.isArray(res.items) ? res.items : []);
      setMovementStats(res.stats || null);
    } catch {
      // handle gracefully
    } finally {
      setLoadingMovements(false);
    }
  }, [effectiveRestId, movementTypeFilter, movementSearchQuery]);

  // Load waste logs
  const loadWasteLogs = useCallback(async () => {
    if (!effectiveRestId || effectiveRestId <= 0) return;
    try {
      setLoadingWasteLogs(true);
      const res = await inventoryRemoteDataSource.getWasteLogs(effectiveRestId, 50);
      setWasteLogs(Array.isArray(res) ? res : []);
    } catch {
      // handle gracefully
    } finally {
      setLoadingWasteLogs(false);
    }
  }, [effectiveRestId]);

  // Load history when switching to history
  const loadHistory = useCallback(async () => {
    if (!effectiveRestId || effectiveRestId <= 0) return;
    try {
      setLoadingHistory(true);
      const data = await inventoryRemoteDataSource.getInvoices(effectiveRestId, 40);
      setInvoicesHistory(Array.isArray(data) ? data : []);
    } catch {
      // handle gracefully
    } finally {
      setLoadingHistory(false);
    }
  }, [effectiveRestId]);

  useEffect(() => {
    if (visible && isInventoryAllowed && effectiveRestId > 0) {
      if (activeTab === 'stock' || activeTab === 'scanner') {
        loadIngredients();
      } else if (activeTab === 'recipes') {
        loadIngredients();
        loadRecipes();
      } else if (activeTab === 'movements') {
        loadMovements();
      } else if (activeTab === 'waste') {
        loadIngredients();
        loadWasteLogs();
      } else if (activeTab === 'history') {
        loadHistory();
      }
    }
  }, [
    visible,
    isInventoryAllowed,
    effectiveRestId,
    activeTab,
    loadIngredients,
    loadRecipes,
    loadMovements,
    loadWasteLogs,
    loadHistory,
  ]);

  // Action: Save New Raw Ingredient
  const handleSaveNewIngredient = async () => {
    if (!newIngredientName.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid ingredient name.');
      return;
    }
    const currentStockNum = parseFloat(newIngredientStock) || 0;
    const minLevelNum = parseFloat(newIngredientMinLevel) || 5;
    const costNum = parseFloat(newIngredientCost) || 0;

    try {
      setSavingIngredient(true);
      await inventoryRemoteDataSource.saveIngredient(effectiveRestId, {
        ingredientName: newIngredientName.trim(),
        unitName: newIngredientUnit || 'Kg',
        currentStock: currentStockNum,
        minimumReorderLevel: minLevelNum,
        lastPurchaseCostPerUnit: costNum,
        sku: newIngredientSku.trim() || undefined,
      });

      setShowAddIngredientModal(false);
      setNewIngredientName('');
      setNewIngredientStock('0');
      setNewIngredientMinLevel('5');
      setNewIngredientCost('0');
      setNewIngredientSku('');
      await loadIngredients();
      Alert.alert('Success', `Raw material "${newIngredientName.trim()}" added to inventory.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to save raw ingredient.');
    } finally {
      setSavingIngredient(false);
    }
  };

  // Unit conversion factor helper
  const getUnitConversionFactor = (recipeUnit?: string, baseUnit?: string): number => {
    if (!recipeUnit || !baseUnit) return 1;
    const r = normalizeUnitName(recipeUnit).toLowerCase();
    const b = normalizeUnitName(baseUnit).toLowerCase();
    if (r === b) return 1;

    // Weight conversions
    if (r === 'g' && b === 'kg') return 0.001;
    if (r === 'kg' && b === 'g') return 1000;

    // Volume conversions
    if (r === 'ml' && b === 'l') return 0.001;
    if (r === 'l' && b === 'ml') return 1000;

    return 1;
  };

  // Action: Open Recipe Modal for Dish
  const handleOpenRecipeModal = (dish: MenuItemRecipe) => {
    setSelectedRecipeDish(dish);
    setRecipeActionFeedback(null);
    if (ingredients.length === 0 && effectiveRestId > 0) {
      loadIngredients();
    }
    const hasExisting = Array.isArray(dish.ingredients) && dish.ingredients.length > 0;
    const initialRows: RecipeIngredientItem[] = hasExisting
      ? dish.ingredients.map((ing) => {
          const rawIng = ingredients.find((i) => i.id === ing.ingredientId);
          const normUnit = normalizeUnitName(ing.unitName || rawIng?.unitName);
          const baseNormUnit = normalizeUnitName(rawIng?.unitName);
          const cost = ing.costPerUnit || rawIng?.lastPurchaseCostPerUnit || 0;
          const factor = getUnitConversionFactor(normUnit, baseNormUnit);
          const qty = Number(ing.quantityRequired) || 0;
          const buffer = Number(ing.wastageBufferPercent) || 0;
          const lineCost = Math.round(qty * factor * (1 + buffer / 100) * cost * 100) / 100;
          return {
            ...ing,
            ingredientName: ing.ingredientName || rawIng?.ingredientName || '',
            unitName: normUnit,
            costPerUnit: cost,
            lineCost: lineCost,
            notes: ing.notes || '',
          };
        })
      : [];
    setRecipeDraftIngredients(initialRows);
    setShowRecipeModal(true);
  };

  // Action: Add Row to Recipe Draft
  const handleAddRecipeIngredientRow = () => {
    const firstIng = ingredients.length > 0 ? ingredients[0] : null;
    const initialUnit = normalizeUnitName(firstIng?.unitName || 'Kg');
    const initialCost = firstIng?.lastPurchaseCostPerUnit || 0;
    setRecipeDraftIngredients((prev) => [
      ...prev,
      {
        ingredientId: firstIng ? firstIng.id : 0,
        ingredientName: firstIng ? firstIng.ingredientName : '',
        quantityRequired: 0.1,
        unitName: initialUnit,
        costPerUnit: initialCost,
        wastageBufferPercent: 0,
        lineCost: Math.round(0.1 * initialCost * 100) / 100,
        notes: '',
      },
    ]);
  };

  // Action: Update Field in Recipe Row
  const handleUpdateRecipeRow = (index: number, field: keyof RecipeIngredientItem, val: any) => {
    setRecipeDraftIngredients((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const item = { ...next[index], [field]: val };
      if (field === 'ingredientId') {
        const found = ingredients.find((i) => i.id === Number(val));
        if (found) {
          item.ingredientId = found.id;
          item.ingredientName = found.ingredientName;
          item.unitName = normalizeUnitName(found.unitName);
          item.costPerUnit = found.lastPurchaseCostPerUnit;
        }
      } else if (field === 'unitName') {
        item.unitName = normalizeUnitName(val);
      }
      const rawIng = ingredients.find((i) => i.id === item.ingredientId);
      const baseUnit = normalizeUnitName(rawIng?.unitName || item.unitName);
      const qty = parseFloat(field === 'quantityRequired' ? val : String(item.quantityRequired)) || 0;
      const buffer = parseFloat(field === 'wastageBufferPercent' ? val : String(item.wastageBufferPercent)) || 0;
      const cost = item.costPerUnit || 0;
      const factor = getUnitConversionFactor(item.unitName, baseUnit);
      item.lineCost = Math.round(qty * factor * (1 + buffer / 100) * cost * 100) / 100;
      next[index] = item;
      return next;
    });
  };

  // Action: Remove Recipe Row
  const handleRemoveRecipeRow = (index: number) => {
    setRecipeDraftIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // Action: Save Recipe to Backend
  const handleSaveRecipe = async () => {
    if (!selectedRecipeDish || !effectiveRestId) return;
    try {
      setSavingRecipe(true);
      const payload: SaveRecipePayload = {
        menuItemId: selectedRecipeDish.menuItemId,
        ingredients: recipeDraftIngredients
          .filter((i) => i.ingredientId > 0 && Number(i.quantityRequired) > 0)
          .map((i) => ({
            ingredientId: i.ingredientId,
            quantityRequired: Number(i.quantityRequired),
            unitName: i.unitName,
            wastageBufferPercent: Number(i.wastageBufferPercent) || 0,
            notes: i.notes,
          })),
      };

      await inventoryRemoteDataSource.saveRecipe(effectiveRestId, payload);
      setRecipeActionFeedback(`Recipe & BOM saved for "${selectedRecipeDish.menuItemName}"!`);
      setTimeout(() => {
        setShowRecipeModal(false);
        setRecipeActionFeedback(null);
      }, 750);
      await loadRecipes();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to save recipe.');
    } finally {
      setSavingRecipe(false);
    }
  };

  // Action: Simulate Cooking Dish Portions
  const handleSimulateCook = async (dish: MenuItemRecipe) => {
    if (dish.ingredientsCount === 0) {
      Alert.alert('No Recipe Linked', `Configure recipe ingredients for "${dish.menuItemName}" before preparing.`);
      return;
    }

    try {
      setSimulatingDishId(dish.menuItemId);
      await inventoryRemoteDataSource.deductDish(effectiveRestId, {
        menuItemId: dish.menuItemId,
        quantity: 1,
        referenceId: `SIM-${Date.now().toString().slice(-6)}`,
      });
      await loadIngredients();
      if (activeTab === 'movements') {
        await loadMovements();
      }
      Alert.alert(
        'Cooked 1 Portion',
        `✅ Cooked 1 Portion of "${dish.menuItemName}"!\nConstituent raw ingredients were deducted from kitchen stock and written to the movement ledger.`
      );
    } catch (err: any) {
      Alert.alert('Deduct Failed', err?.response?.data?.message || err?.message || 'Could not deduct dish ingredients.');
    } finally {
      setSimulatingDishId(null);
    }
  };

  // Action: Save Waste
  const handleSaveWaste = async () => {
    if (!wasteIngredientId || wasteIngredientId <= 0) {
      Alert.alert('Validation Error', 'Please select a kitchen raw ingredient.');
      return;
    }
    const qty = parseFloat(wasteQuantity) || 0;
    if (qty <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid wasted quantity greater than 0.');
      return;
    }

    try {
      setSavingWaste(true);
      await inventoryRemoteDataSource.logWaste(effectiveRestId, {
        ingredientId: wasteIngredientId,
        quantityWasted: qty,
        reason: wasteReason,
        notes: wasteNotes.trim(),
      });
      setShowLogWasteModal(false);
      setWasteQuantity('0');
      setWasteNotes('');
      await loadWasteLogs();
      await loadIngredients();
      Alert.alert('Wastage Recorded', 'Stock deducted and waste event logged.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to record kitchen waste.');
    } finally {
      setSavingWaste(false);
    }
  };

  // Action: Review & Inward Draft Invoice
  const handleReviewDraftInvoice = (inv: ScannedInvoiceResult) => {
    setScannedResult(inv);
    setVendorName(inv.vendorName || 'Mandi / Local Supplier');
    setInvoiceNumber(inv.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`);
    setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditableItems(Array.isArray(inv.items) ? inv.items.map((i) => ({ ...i })) : []);
    setActiveTab('scanner');
  };

  // Camera Capture Handler
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture paper receipts and mandi slips.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.65,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        runScanPipeline(asset.uri, asset.fileName || 'camera_invoice.jpg', asset.mimeType || 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Could not open device camera.');
    }
  };

  // Gallery Picker Handler
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo gallery permission is required to select receipt photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.65,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        runScanPipeline(asset.uri, asset.fileName || 'gallery_invoice.jpg', asset.mimeType || 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Could not select photo from gallery.');
    }
  };

  // Sample Invoice Quick Test Handler
  const handleScanSample = async (type: 'mandi' | 'dairy') => {
    try {
      const asset =
        type === 'mandi'
          ? Image.resolveAssetSource(require('../../../../assets/dummy-invoices/handwritten_mandi_parcha.jpg'))
          : Image.resolveAssetSource(require('../../../../assets/dummy-invoices/handwritten_dairy_slip.jpg'));

      if (asset?.uri) {
        setSelectedImageUri(asset.uri);
        runScanPipeline(
          asset.uri,
          type === 'mandi' ? 'handwritten_mandi_parcha.jpg' : 'handwritten_dairy_slip.jpg',
          'image/jpeg'
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load sample invoice.');
    }
  };

  // Run AI Vision Scanner Pipeline
  const runScanPipeline = async (uri: string, filename = 'invoice_scan.jpg', mimeType = 'image/jpeg') => {
    if (!effectiveRestId || effectiveRestId <= 0) {
      Alert.alert('Error', 'Please select an active restaurant outlet before scanning invoices.');
      return;
    }

    try {
      setIsScanning(true);
      setScannedResult(null);

      const result = await inventoryRemoteDataSource.scanInvoice(effectiveRestId, {
        uri,
        name: filename,
        type: mimeType,
      });

      setScannedResult(result);
      setVendorName(result.vendorName || 'Mandi / Local Supplier');
      setInvoiceNumber(result.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(result.invoiceDate ? new Date(result.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setEditableItems(Array.isArray(result.items) ? result.items : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'AI Vision could not parse the receipt. Please ensure good lighting and text clarity.';
      Alert.alert('Scan Failed', msg);
    } finally {
      setIsScanning(false);
    }
  };

  // Item field editing
  const handleUpdateItem = (index: number, field: keyof ScannedInvoiceItem, value: any) => {
    setEditableItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'ratePerUnit') {
        const q = parseFloat(field === 'quantity' ? value : String(item.quantity)) || 0;
        const r = parseFloat(field === 'ratePerUnit' ? value : String(item.ratePerUnit)) || 0;
        item.lineTotal = Math.round(q * r * 100) / 100;
        if (item.lastPurchasePrice && item.lastPurchasePrice > 0 && r > 0) {
          item.priceDifferencePercent = Math.round(((r - item.lastPurchasePrice) / item.lastPurchasePrice) * 1000) / 10;
        }
      }
      next[index] = item;
      return next;
    });
  };

  const handleDeleteItem = (index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNewItemRow = () => {
    setEditableItems((prev) => [
      ...prev,
      {
        rawScannedText: '',
        matchedIngredientName: '',
        quantity: 1,
        unitName: 'Kg',
        ratePerUnit: 0,
        lineTotal: 0,
        isNewIngredient: true,
        confidence: 1.0,
      },
    ]);
  };

  const handleSelectIngredient = (index: number, ingredient: RawIngredient | null) => {
    setEditableItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;

      if (ingredient) {
        const prevPrice = ingredient.lastPurchaseCostPerUnit || 0;
        const currentRate = Number(current.ratePerUnit) || 0;
        let diffPercent: number | undefined = undefined;
        if (prevPrice > 0 && currentRate > 0) {
          diffPercent = Math.round(((currentRate - prevPrice) / prevPrice) * 1000) / 10;
        }
        next[index] = {
          ...current,
          matchedIngredientId: ingredient.id,
          matchedIngredientName: ingredient.ingredientName,
          unitName: ingredient.unitName || current.unitName || 'Kg',
          isNewIngredient: false,
          lastPurchasePrice: prevPrice > 0 ? prevPrice : current.lastPurchasePrice,
          priceDifferencePercent: diffPercent,
        };
      } else {
        // Add as New Ingredient
        next[index] = {
          ...current,
          matchedIngredientId: undefined,
          matchedIngredientName: current.rawScannedText || 'New Ingredient',
          isNewIngredient: true,
          priceDifferencePercent: undefined,
        };
      }
      return next;
    });
    setActiveMappingIndex(null);
    setMappingSearchQuery('');
  };

  const handleSelectUnit = (index: number, unit: string) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], unitName: unit };
      }
      return next;
    });
    setActiveUnitIndex(null);
  };

  const handleDiscardScan = () => {
    Alert.alert(
      'Discard Scanned Bill?',
      'Are you sure you want to discard these extracted items? Unsaved changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setScannedResult(null);
            setSelectedImageUri(null);
            setEditableItems([]);
          },
        },
      ]
    );
  };

  const mappingFilteredIngredients = useMemo(() => {
    if (!mappingSearchQuery.trim()) return ingredients;
    const q = mappingSearchQuery.toLowerCase().trim();
    return ingredients.filter(
      (ing) =>
        ing.ingredientName.toLowerCase().includes(q) ||
        (ing.sku && ing.sku.toLowerCase().includes(q)) ||
        (ing.unitName && ing.unitName.toLowerCase().includes(q))
    );
  }, [ingredients, mappingSearchQuery]);

  // Calculated grand total of items
  const computedGrandTotal = useMemo(() => {
    return editableItems.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
  }, [editableItems]);

  // Confirm Invoice and Update Stock
  const handleConfirmInvoice = async () => {
    if (!scannedResult && editableItems.length === 0) return;
    if (editableItems.length === 0) {
      Alert.alert('Empty Items', 'Please add at least one line item to approve into inventory.');
      return;
    }

    try {
      setIsConfirming(true);
      const payload: ConfirmInvoicePayload = {
        invoiceLogId: scannedResult?.invoiceLogId || 0,
        vendorName: vendorName.trim() || 'Mandi Supplier',
        invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: invoiceDate || new Date().toISOString(),
        totalAmount: computedGrandTotal,
        items: editableItems.map((item) => ({
          matchedIngredientId: item.matchedIngredientId,
          ingredientName: item.matchedIngredientName || item.rawScannedText || 'Ingredient',
          quantity: Number(item.quantity) || 0,
          unitName: item.unitName || 'Kg',
          ratePerUnit: Number(item.ratePerUnit) || 0,
          lineTotal: Number(item.lineTotal) || 0,
        })),
      };

      const res = await inventoryRemoteDataSource.confirmInvoice(effectiveRestId, payload);
      // Immediately reload ingredients in background
      await loadIngredients();
      Alert.alert('Stock Updated', res.message || 'Invoice approved! Raw ingredient stock updated successfully.', [
        {
          text: 'View Stock',
          onPress: () => {
            setScannedResult(null);
            setSelectedImageUri(null);
            setEditableItems([]);
            setActiveTab('stock');
            loadIngredients();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Confirmation Failed', err?.response?.data?.message || err?.message || 'Could not update inventory.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return ingredients;
    const q = searchQuery.toLowerCase().trim();
    return ingredients.filter(
      (ing) =>
        ing.ingredientName.toLowerCase().includes(q) ||
        (ing.sku && ing.sku.toLowerCase().includes(q)) ||
        (ing.unitName && ing.unitName.toLowerCase().includes(q))
    );
  }, [ingredients, searchQuery]);

  const lowStockCount = useMemo(() => {
    return ingredients.filter((i) => i.currentStock <= i.minimumReorderLevel).length;
  }, [ingredients]);

  // Filtered dishes for BOM recipes tab (matches dish name, category, or constituent raw material)
  const filteredRecipes = useMemo(() => {
    if (!recipeSearchQuery.trim()) return recipes;
    const q = recipeSearchQuery.toLowerCase().trim();
    return recipes.filter(
      (r) =>
        r.menuItemName?.toLowerCase().includes(q) ||
        r.categoryName?.toLowerCase().includes(q) ||
        (Array.isArray(r.ingredients) &&
          r.ingredients.some((ing) => ing.ingredientName?.toLowerCase().includes(q)))
    );
  }, [recipes, recipeSearchQuery]);

  const configuredRecipesCount = useMemo(() => {
    return recipes.filter((r) => r.ingredientsCount > 0).length;
  }, [recipes]);

  // Recipe Draft calculations
  const draftRecipeTotalCost = useMemo(() => {
    return recipeDraftIngredients.reduce((sum, item) => sum + (Number(item.lineCost) || 0), 0);
  }, [recipeDraftIngredients]);

  const draftRecipeMarginPercent = useMemo(() => {
    if (!selectedRecipeDish || selectedRecipeDish.price <= 0) return 0;
    const margin = ((selectedRecipeDish.price - draftRecipeTotalCost) / selectedRecipeDish.price) * 100;
    return Math.round(margin * 10) / 10;
  }, [selectedRecipeDish, draftRecipeTotalCost]);

  // Filtered waste logs
  const filteredWasteLogs = useMemo(() => {
    if (!wasteSearchQuery.trim()) return wasteLogs;
    const q = wasteSearchQuery.toLowerCase().trim();
    return wasteLogs.filter(
      (w) =>
        w.ingredientName?.toLowerCase().includes(q) ||
        w.reason?.toLowerCase().includes(q) ||
        w.notes?.toLowerCase().includes(q)
    );
  }, [wasteLogs, wasteSearchQuery]);

  const totalWasteLoss = useMemo(() => {
    return wasteLogs.reduce((sum, w) => sum + (Number(w.totalEstimatedLoss) || 0), 0);
  }, [wasteLogs]);

  // Filtered invoice archive
  const filteredInvoicesHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return invoicesHistory;
    const q = historySearchQuery.toLowerCase().trim();
    return invoicesHistory.filter(
      (inv) =>
        inv.vendorName?.toLowerCase().includes(q) ||
        inv.invoiceNumber?.toLowerCase().includes(q)
    );
  }, [invoicesHistory, historySearchQuery]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.modalContainer}>
          {/* Top Navigation Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.headerIconCircle, { backgroundColor: isInventoryAllowed ? '#E4F5EC' : '#FFF0DE' }]}>
                <Boxes size={22} color={isInventoryAllowed ? '#16A34A' : '#DE8626'} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.modalTitle}>AI Inventory Studio</Text>
                  <View
                    style={[
                      styles.activePill,
                      { backgroundColor: isInventoryAllowed ? '#DCFCE7' : '#FEF3C7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activePillText,
                        { color: isInventoryAllowed ? '#16A34A' : '#B45309' },
                      ]}
                    >
                      {isInventoryAllowed ? 'ACTIVE' : 'PRO 🔒'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modalSub} numberOfLines={1}>
                  {effectiveRestName} {effectiveRestId > 0 ? `(#${effectiveRestId})` : ''} • Smart Kitchen Supply Chain
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#8C7A6B" />
            </TouchableOpacity>
          </View>

          {/* Sub-Tab Bar (Horizontal Scrollable for 6 modules) */}
          {isInventoryAllowed && (
            <View style={styles.tabBarWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabBarScroll}
              >
                {/* 1. AI Scanner */}
                <TouchableOpacity
                  style={[styles.tabPill, activeTab === 'scanner' && styles.tabPillActive]}
                  onPress={() => setActiveTab('scanner')}
                  activeOpacity={0.8}
                >
                  <Camera size={15} color={activeTab === 'scanner' ? '#DE8626' : '#8C7A6B'} />
                  <Text style={[styles.tabPillText, activeTab === 'scanner' && styles.tabPillTextActive]}>
                    AI Scanner
                  </Text>
                </TouchableOpacity>

                {/* 2. Raw Materials Stock */}
                <TouchableOpacity
                  style={[styles.tabPill, activeTab === 'stock' && styles.tabPillActive]}
                  onPress={() => {
                    setActiveTab('stock');
                    loadIngredients();
                  }}
                  activeOpacity={0.8}
                >
                  <Package size={15} color={activeTab === 'stock' ? '#DE8626' : '#8C7A6B'} />
                  <Text style={[styles.tabPillText, activeTab === 'stock' && styles.tabPillTextActive]}>
                    Stock ({ingredients.length})
                  </Text>
                  {lowStockCount > 0 && <View style={styles.tabBadgeDot} />}
                </TouchableOpacity>

                {/* 3. Dish Recipes & BOM */}
                <TouchableOpacity
                  style={[styles.tabPill, activeTab === 'recipes' && styles.tabPillActive]}
                  onPress={() => {
                    setActiveTab('recipes');
                    loadRecipes();
                  }}
                  activeOpacity={0.8}
                >
                  <ChefHat size={15} color={activeTab === 'recipes' ? '#DE8626' : '#8C7A6B'} />
                  <Text style={[styles.tabPillText, activeTab === 'recipes' && styles.tabPillTextActive]}>
                    Dish Recipes & BOM
                  </Text>
                </TouchableOpacity>

                {/* 4. Stock Movement Ledger */}
                <TouchableOpacity
                  style={[styles.tabPill, activeTab === 'movements' && styles.tabPillActive]}
                  onPress={() => {
                    setActiveTab('movements');
                    loadMovements();
                  }}
                  activeOpacity={0.8}
                >
                  <History size={15} color={activeTab === 'movements' ? '#DE8626' : '#8C7A6B'} />
                  <Text style={[styles.tabPillText, activeTab === 'movements' && styles.tabPillTextActive]}>
                    Ledger
                  </Text>
                </TouchableOpacity>

                {/* 5. Waste Tracking */}
                <TouchableOpacity
                  style={[styles.tabPill, activeTab === 'waste' && styles.tabPillActive]}
                  onPress={() => {
                    setActiveTab('waste');
                    loadWasteLogs();
                  }}
                  activeOpacity={0.8}
                >
                  <Trash2 size={15} color={activeTab === 'waste' ? '#DE8626' : '#8C7A6B'} />
                  <Text style={[styles.tabPillText, activeTab === 'waste' && styles.tabPillTextActive]}>
                    Waste {wasteLogs.length > 0 ? `(${wasteLogs.length})` : ''}
                  </Text>
                </TouchableOpacity>

                {/* 6. Invoice Archive */}
                <TouchableOpacity
                  style={[styles.tabPill, activeTab === 'history' && styles.tabPillActive]}
                  onPress={() => {
                    setActiveTab('history');
                    loadHistory();
                  }}
                  activeOpacity={0.8}
                >
                  <ReceiptIndianRupee size={15} color={activeTab === 'history' ? '#DE8626' : '#8C7A6B'} />
                  <Text style={[styles.tabPillText, activeTab === 'history' && styles.tabPillTextActive]}>
                    Archive {invoicesHistory.length > 0 ? `(${invoicesHistory.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Content Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Paywall Banner if plan does not include Inventory */}
            {!isInventoryAllowed ? (
              <View style={styles.paywallWrapper}>
                <LinearGradient
                  colors={['#FFF8F0', '#FFF0DE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCardLocked}
                >
                  <View style={styles.heroTopRow}>
                    <View style={styles.badgeLocked}>
                      <Lock size={12} color="#D96B14" />
                      <Text style={styles.badgeLockedText}>SUBSCRIPTION REQUIRED</Text>
                    </View>
                    <View style={styles.badgePill}>
                      <Sparkles size={11} color="#B45309" />
                      <Text style={styles.badgePillText}>PRO TIER</Text>
                    </View>
                  </View>
                  <Text style={styles.heroTitleLocked}>Unlock AI Inventory & Smart Stock</Text>
                  <Text style={styles.heroDescLocked}>
                    Scan physical mandi parchis and dairy slips with AI Vision. Automatically track dish recipes (BOM), automate KOT stock depletion, and control kitchen food costs.
                  </Text>
                </LinearGradient>

                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => {
                    onClose();
                    if (onUpgradePlan) onUpgradePlan();
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#F59E0B', '#E58B24', '#DE8626']} style={styles.upgradeBtnGradient}>
                    <Sparkles size={16} color="#FFFFFF" />
                    <Text style={styles.upgradeBtnText}>Upgrade Subscription Plan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* 1. SCANNER TAB */}
                {activeTab === 'scanner' && (
                  <View style={{ gap: 14 }}>
                    {/* Capture Hero Card */}
                    <View style={styles.cardBox}>
                      <Text style={styles.cardHeaderTitle}>Scan Mandi Parcha / GST Invoice</Text>
                      <Text style={styles.cardHeaderSub}>
                        Capture handwritten Hindi/English vegetable slips, dairy challans, or printed tax bills.
                      </Text>

                      {/* Photo preview or Camera trigger */}
                      {selectedImageUri ? (
                        <View style={styles.previewContainer}>
                          <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="contain" />
                          <View style={styles.previewActionsOverlay}>
                            <TouchableOpacity
                              style={styles.miniChangeBtn}
                              onPress={handleTakePhoto}
                              disabled={isScanning || isConfirming}
                            >
                              <Camera size={14} color="#FFFFFF" />
                              <Text style={styles.miniChangeBtnText}>Retake Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.miniChangeBtn}
                              onPress={handlePickFromGallery}
                              disabled={isScanning || isConfirming}
                            >
                              <ImageIcon size={14} color="#FFFFFF" />
                              <Text style={styles.miniChangeBtnText}>Gallery</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <>
                          <View style={styles.captureButtonsRow}>
                            {/* Take Photo button */}
                            <TouchableOpacity
                              style={styles.captureLargeBtn}
                              onPress={handleTakePhoto}
                              activeOpacity={0.85}
                            >
                              <LinearGradient colors={['#FFF5EB', '#FFEADB']} style={styles.captureBtnInner}>
                                <View style={[styles.captureIconCircle, { backgroundColor: '#FEE2CA' }]}>
                                  <Camera size={26} color="#D96B14" strokeWidth={2.4} />
                                </View>
                                <Text style={styles.captureBtnTitle}>Take Photo</Text>
                                <Text style={styles.captureBtnSub}>Use Phone Camera</Text>
                              </LinearGradient>
                            </TouchableOpacity>

                            {/* Gallery button */}
                            <TouchableOpacity
                              style={styles.captureLargeBtn}
                              onPress={handlePickFromGallery}
                              activeOpacity={0.85}
                            >
                              <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={styles.captureBtnInner}>
                                <View style={[styles.captureIconCircle, { backgroundColor: '#BBF7D0' }]}>
                                  <ImageIcon size={26} color="#16A34A" strokeWidth={2.4} />
                                </View>
                                <Text style={styles.captureBtnTitle}>Choose Photo</Text>
                                <Text style={styles.captureBtnSub}>From Device Gallery</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          </View>

                          {/* Quick Test with Sample Mandi & Dairy Slips */}
                          <View style={{ marginTop: 14 }}>
                            <Text style={styles.sampleHeaderLabel}>OR TEST WITH SAMPLE BILLS</Text>
                            <View style={styles.sampleButtonsRow}>
                              <TouchableOpacity
                                style={styles.sampleSlipBtn}
                                onPress={() => handleScanSample('mandi')}
                                disabled={isScanning || isConfirming}
                                activeOpacity={0.8}
                              >
                                <View style={[styles.sampleIconBox, { backgroundColor: '#DCFCE7' }]}>
                                  <Sparkles size={14} color="#16A34A" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.sampleBtnTitle}>सब्जी मंडी कच्चा पर्चा</Text>
                                  <Text style={styles.sampleBtnSub}>Tomato, Onion, Chilli (Hindi Mandi Slip)</Text>
                                </View>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.sampleSlipBtn}
                                onPress={() => handleScanSample('dairy')}
                                disabled={isScanning || isConfirming}
                                activeOpacity={0.8}
                              >
                                <View style={[styles.sampleIconBox, { backgroundColor: '#FEF3C7' }]}>
                                  <Sparkles size={14} color="#D97706" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.sampleBtnTitle}>श्री गणेश डेयरी पर्ची</Text>
                                  <Text style={styles.sampleBtnSub}>Paneer, Butter, Dahi (Dairy Receipt)</Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </>
                      )}

                      {/* Scanning Progress Banner */}
                      {isScanning && (
                        <View style={styles.scanningBanner}>
                          <ActivityIndicator size="small" color="#DE8626" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scanningBannerTitle}>AI Vision Reading Receipt...</Text>
                            <Text style={styles.scanningBannerSub}>
                              Extracting Hindi/English line items, weights, and rates.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Scanned Verification Card */}
                    {scannedResult && (
                      <View style={styles.cardBox}>
                        {/* Header Row */}
                        <View style={styles.resultHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardHeaderTitle}>
                              Verified Extracted Items ({editableItems.length})
                            </Text>
                            <Text style={styles.cardHeaderSub}>
                              Confirm matches with existing inventory ingredients before adding to stock
                            </Text>
                          </View>
                          <View style={styles.confidenceBadge}>
                            <Sparkles size={11} color="#15803D" />
                            <Text style={styles.confidenceBadgeText}>
                              {Math.round(scannedResult.confidenceScore * 100)}% Confidence
                            </Text>
                          </View>
                        </View>

                        {/* Top Action Buttons (Add Missing Item / Discard) */}
                        <View style={styles.scannedActionsBar}>
                          <TouchableOpacity
                            style={styles.addMissingHeaderBtn}
                            onPress={handleAddNewItemRow}
                            activeOpacity={0.8}
                          >
                            <Plus size={13} color="#DE8626" />
                            <Text style={styles.addMissingHeaderBtnText}>Add Missing Item</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.discardHeaderBtn}
                            onPress={handleDiscardScan}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.discardHeaderBtnText}>Discard</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Bill Metadata Fields (Vendor Name, Invoice #, Bill Date) */}
                        <View style={styles.metadataGrid}>
                          <View style={styles.metaField}>
                            <Text style={styles.metaLabel}>VENDOR / MANDI SUPPLIER</Text>
                            <TextInput
                              style={styles.metaInput}
                              value={vendorName}
                              onChangeText={setVendorName}
                              placeholder="Supplier Name"
                              placeholderTextColor="#A89E92"
                            />
                          </View>
                        </View>
                        <View style={[styles.metadataGrid, { marginTop: -4 }]}>
                          <View style={styles.metaField}>
                            <Text style={styles.metaLabel}>INVOICE #</Text>
                            <TextInput
                              style={styles.metaInput}
                              value={invoiceNumber}
                              onChangeText={setInvoiceNumber}
                              placeholder="Bill Ref #"
                              placeholderTextColor="#A89E92"
                            />
                          </View>
                          <View style={styles.metaField}>
                            <Text style={styles.metaLabel}>BILL DATE</Text>
                            <TextInput
                              style={styles.metaInput}
                              value={invoiceDate}
                              onChangeText={setInvoiceDate}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#A89E92"
                            />
                          </View>
                        </View>

                        {/* Verified Extracted Items List */}
                        <View style={styles.itemsListContainer}>
                          {editableItems.map((item, idx) => {
                            const isSurge = item.priceDifferencePercent !== undefined && item.priceDifferencePercent > 0;
                            const isDrop = item.priceDifferencePercent !== undefined && item.priceDifferencePercent < 0;
                            const hasVariance = isSurge || isDrop;

                            return (
                              <View key={`item-${idx}`} style={styles.itemCard}>
                                {/* Row 1: Index, Scanned Text, Delete */}
                                <View style={styles.itemCardHeaderRow}>
                                  <View style={styles.itemIndexBadge}>
                                    <Text style={styles.itemIndexText}>#{idx + 1}</Text>
                                  </View>
                                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                                    <Text style={styles.fieldMicroLabel}>SCANNED TEXT / ITEM</Text>
                                    <TextInput
                                      style={styles.scannedTextInput}
                                      value={item.rawScannedText}
                                      onChangeText={(val) => handleUpdateItem(idx, 'rawScannedText', val)}
                                      placeholder="Ingredient name / Hindi slip text"
                                      placeholderTextColor="#A89E92"
                                    />
                                  </View>
                                  <TouchableOpacity
                                    style={styles.cardTrashBtn}
                                    onPress={() => handleDeleteItem(idx)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Trash2 size={16} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>

                                {/* Row 2: Matched Ingredient & Rate Variance */}
                                <View style={styles.itemCardMiddleRow}>
                                  <View style={{ flex: 1.35 }}>
                                    <Text style={styles.fieldMicroLabel}>MATCHED INVENTORY INGREDIENT</Text>
                                    <TouchableOpacity
                                      style={[
                                        styles.ingredientPickerBtn,
                                        item.isNewIngredient || !item.matchedIngredientId
                                          ? styles.ingredientPickerBtnNew
                                          : styles.ingredientPickerBtnMatched,
                                      ]}
                                      onPress={() => {
                                        setActiveMappingIndex(idx);
                                        setMappingSearchQuery('');
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                        {item.isNewIngredient || !item.matchedIngredientId ? (
                                          <Sparkles size={13} color="#D97706" />
                                        ) : (
                                          <Package size={13} color="#16A34A" />
                                        )}
                                        <Text
                                          style={[
                                            styles.ingredientPickerBtnText,
                                            item.isNewIngredient || !item.matchedIngredientId
                                              ? styles.ingredientPickerBtnTextNew
                                              : styles.ingredientPickerBtnTextMatched,
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {item.matchedIngredientName || item.rawScannedText || '+ Add as New'}
                                        </Text>
                                      </View>
                                      <ChevronDown size={14} color="#8C7A6B" />
                                    </TouchableOpacity>
                                  </View>

                                  <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <Text style={styles.fieldMicroLabel}>RATE VARIANCE</Text>
                                    {hasVariance ? (
                                      <View style={{ alignItems: 'flex-end' }}>
                                        <View
                                          style={[
                                            styles.variancePill,
                                            isSurge ? styles.variancePillSurge : styles.variancePillDrop,
                                          ]}
                                        >
                                          {isSurge ? (
                                            <ArrowUpRight size={11} color="#DC2626" />
                                          ) : (
                                            <ArrowDownRight size={11} color="#16A34A" />
                                          )}
                                          <Text
                                            style={[
                                              styles.variancePillText,
                                              isSurge ? styles.variancePillTextSurge : styles.variancePillTextDrop,
                                            ]}
                                          >
                                            {isSurge ? `+${item.priceDifferencePercent}%` : `${item.priceDifferencePercent}%`}
                                          </Text>
                                        </View>
                                        {item.lastPurchasePrice !== undefined && item.lastPurchasePrice > 0 && (
                                          <Text style={styles.prevPriceText}>Prev: ₹{item.lastPurchasePrice}</Text>
                                        )}
                                      </View>
                                    ) : item.lastPurchasePrice !== undefined && item.lastPurchasePrice > 0 ? (
                                      <View style={{ alignItems: 'flex-end' }}>
                                        <View style={styles.variancePillBaseline}>
                                          <Text style={styles.variancePillTextBaseline}>Baseline</Text>
                                        </View>
                                        <Text style={styles.prevPriceText}>₹{item.lastPurchasePrice}/{item.unitName || 'Kg'}</Text>
                                      </View>
                                    ) : (
                                      <View style={styles.variancePillNew}>
                                        <Text style={styles.variancePillTextNew}>+ New Item</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>

                                {/* Row 3: Numeric Inputs - Quantity, Unit, Rate, Line Total */}
                                <View style={styles.itemCardBottomGrid}>
                                  {/* Quantity */}
                                  <View style={styles.gridInputColSmall}>
                                    <Text style={styles.fieldMicroLabel}>QTY</Text>
                                    <TextInput
                                      style={styles.gridNumericInput}
                                      value={String(item.quantity ?? '')}
                                      keyboardType="numeric"
                                      onChangeText={(val) => handleUpdateItem(idx, 'quantity', val)}
                                      selectTextOnFocus
                                    />
                                  </View>

                                  {/* Unit Selector */}
                                  <View style={styles.gridInputColSmall}>
                                    <Text style={styles.fieldMicroLabel}>UNIT</Text>
                                    <TouchableOpacity
                                      style={styles.gridUnitPickerBtn}
                                      onPress={() => setActiveUnitIndex(idx)}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.gridUnitPickerText}>{item.unitName || 'Kg'}</Text>
                                      <ChevronDown size={11} color="#8C7A6B" />
                                    </TouchableOpacity>
                                  </View>

                                  {/* Rate */}
                                  <View style={styles.gridInputColMedium}>
                                    <Text style={styles.fieldMicroLabel}>RATE (₹)</Text>
                                    <TextInput
                                      style={styles.gridNumericInput}
                                      value={String(item.ratePerUnit ?? '')}
                                      keyboardType="numeric"
                                      onChangeText={(val) => handleUpdateItem(idx, 'ratePerUnit', val)}
                                      selectTextOnFocus
                                    />
                                  </View>

                                  {/* Line Total */}
                                  <View style={styles.gridTotalCol}>
                                    <Text style={styles.fieldMicroLabel}>LINE TOTAL</Text>
                                    <Text style={styles.gridLineTotalVal}>
                                      ₹{(Number(item.lineTotal) || 0).toFixed(2)}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>

                        {/* Add Row Button (Dashed Full-width) */}
                        <TouchableOpacity style={styles.addRowBtn} onPress={handleAddNewItemRow} activeOpacity={0.8}>
                          <Plus size={14} color="#DE8626" />
                          <Text style={styles.addRowBtnText}>Add Missing Line Item (Manual Entry)</Text>
                        </TouchableOpacity>

                        {/* Grand Total & Approval Button */}
                        <View style={styles.confirmSection}>
                          <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total Calculated Amount:</Text>
                            <Text style={styles.totalValue}>₹{computedGrandTotal.toFixed(2)}</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.confirmBtn, (isConfirming || editableItems.length === 0) && { opacity: 0.7 }]}
                            onPress={handleConfirmInvoice}
                            disabled={isConfirming || editableItems.length === 0}
                            activeOpacity={0.88}
                          >
                            <LinearGradient
                              colors={['#16A34A', '#15803D']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.confirmBtnGradient}
                            >
                              {isConfirming ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <CheckCircle2 size={18} color="#FFFFFF" />
                                  <Text style={styles.confirmBtnText}>
                                    Approve & Update Inventory (+₹{computedGrandTotal.toFixed(2)})
                                  </Text>
                                </>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* 2. STOCK LEVELS TAB */}
                {activeTab === 'stock' && (
                  <View style={{ gap: 12 }}>
                    {/* Low Stock Warning Card */}
                    {lowStockCount > 0 && (
                      <View style={styles.lowStockBanner}>
                        <AlertTriangle size={18} color="#DC2626" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lowStockBannerTitle}>
                            {lowStockCount} {lowStockCount === 1 ? 'Ingredient is' : 'Ingredients are'} Below Reorder Level!
                          </Text>
                          <Text style={styles.lowStockBannerSub}>
                            Replenish raw stock to avoid stock-outs during peak dinner rushes.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Search & Refresh Bar */}
                    <View style={styles.searchRow}>
                      <View style={styles.searchBox}>
                        <Search size={16} color="#8C7A6B" />
                        <TextInput
                          style={styles.searchInput}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          placeholder="Search raw items (Tomato, Paneer, Oil)..."
                          placeholderTextColor="#A89E92"
                        />
                        {searchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={14} color="#8C7A6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.refreshIconBtn}
                        onPress={loadIngredients}
                        activeOpacity={0.7}
                      >
                        <RefreshCw size={16} color="#DE8626" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addIngredientQuickBtn}
                        onPress={() => setShowAddIngredientModal(true)}
                        activeOpacity={0.8}
                      >
                        <Plus size={14} color="#FFFFFF" />
                        <Text style={styles.addIngredientQuickBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Stock List */}
                    {loadingIngredients ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#DE8626" />
                        <Text style={styles.loadingText}>Loading live kitchen stock...</Text>
                      </View>
                    ) : filteredIngredients.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Package size={36} color="#C4B5A5" />
                        <Text style={styles.emptyTitle}>No Raw Ingredients Found</Text>
                        <Text style={styles.emptySub}>
                          {searchQuery
                            ? `No materials matching "${searchQuery}"`
                            : 'Scan a mandi bill or tap "+ Add Ingredient" to populate kitchen materials.'}
                        </Text>
                        <TouchableOpacity
                          style={styles.emptyAddBtn}
                          onPress={() => setShowAddIngredientModal(true)}
                          activeOpacity={0.8}
                        >
                          <Plus size={14} color="#DE8626" />
                          <Text style={styles.emptyAddBtnText}>Add Raw Ingredient</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.stockGrid}>
                        {filteredIngredients.map((ing) => {
                          const isLow = ing.currentStock <= ing.minimumReorderLevel;
                          return (
                            <View key={`ing-${ing.id}`} style={[styles.stockCard, isLow && styles.stockCardLow]}>
                              <View style={styles.stockCardTop}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.stockCardName}>{ing.ingredientName}</Text>
                                  <Text style={styles.stockCardSku}>
                                    Unit: {ing.unitName} {ing.sku ? `• SKU: ${ing.sku}` : ''}
                                  </Text>
                                </View>
                                <View style={[styles.stockPill, isLow ? styles.stockPillLow : styles.stockPillGood]}>
                                  <Text style={[styles.stockPillText, isLow ? styles.stockPillTextLow : styles.stockPillTextGood]}>
                                    {isLow ? 'LOW STOCK' : 'IN STOCK'}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.stockCardMetrics}>
                                <View style={styles.metricCol}>
                                  <Text style={styles.metricColLabel}>CURRENT STOCK</Text>
                                  <Text style={[styles.metricColVal, isLow && { color: '#DC2626' }]}>
                                    {ing.currentStock} {ing.unitName}
                                  </Text>
                                </View>
                                <View style={styles.metricDivider} />
                                <View style={styles.metricCol}>
                                  <Text style={styles.metricColLabel}>MIN REORDER</Text>
                                  <Text style={styles.metricColValSub}>{ing.minimumReorderLevel} {ing.unitName}</Text>
                                </View>
                                <View style={styles.metricDivider} />
                                <View style={styles.metricCol}>
                                  <Text style={styles.metricColLabel}>LAST COST</Text>
                                  <Text style={styles.metricColValSub}>₹{ing.lastPurchaseCostPerUnit}/{ing.unitName}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* 3. DISH RECIPES & BOM TAB */}
                {activeTab === 'recipes' && (
                  <View style={{ gap: 12 }}>
                    {/* Search Dishes Bar & Count */}
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.searchBox, { flex: 1 }]}>
                          <Search size={16} color="#8C7A6B" />
                          <TextInput
                            style={styles.searchInput}
                            value={recipeSearchQuery}
                            onChangeText={setRecipeSearchQuery}
                            placeholder="Search by dish name, category, or raw ingredient..."
                            placeholderTextColor="#A89E92"
                          />
                          {recipeSearchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setRecipeSearchQuery('')}>
                              <X size={14} color="#8C7A6B" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <TouchableOpacity onPress={loadRecipes} style={styles.refreshIconBtn}>
                          <RefreshCw size={14} color="#DE8626" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.recipeStatsHeader}>
                        <Text style={styles.recipeStatsCounterText}>
                          {recipes.filter((r) => r.ingredientsCount > 0).length} of {recipes.length} dishes linked with recipes
                        </Text>
                      </View>
                    </View>

                    {/* Recipes List */}
                    {loadingRecipes ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#DE8626" />
                        <Text style={styles.loadingText}>Loading dish recipes & BOM...</Text>
                      </View>
                    ) : filteredRecipes.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <ChefHat size={36} color="#C4B5A5" />
                        <Text style={styles.emptyTitle}>No Menu Dishes Found</Text>
                        <Text style={styles.emptySub}>
                          {recipeSearchQuery
                            ? `No recipes match "${recipeSearchQuery}".`
                            : 'Ensure menu catalog has items configured to set up recipe BOMs.'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {filteredRecipes.map((dish) => {
                          const isConfigured = dish.ingredientsCount > 0;
                          const isCooking = simulatingDishId === dish.menuItemId;
                          const marginColor =
                            dish.grossProfitMarginPercent >= 65
                              ? '#059669'
                              : dish.grossProfitMarginPercent >= 45
                              ? '#D97706'
                              : '#E11D48';

                          return (
                            <View key={`dish-${dish.menuItemId}`} style={styles.recipeCardWeb}>
                              {/* Dish Name & Price (Header) */}
                              <View style={styles.recipeCardTop}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.recipeDishName}>{dish.menuItemName}</Text>
                                    {dish.categoryName ? (
                                      <View style={styles.recipeWebCategoryPill}>
                                        <Text style={styles.recipeWebCategoryPillText}>{dish.categoryName}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                                <Text style={styles.recipeDishPriceText}>
                                  ₹{dish.price}
                                </Text>
                              </View>

                              {/* Status Badge */}
                              <View style={{ marginTop: 2 }}>
                                {isConfigured ? (
                                  <View style={styles.recipeStatusBadgeGood}>
                                    <Check size={12} color="#059669" />
                                    <Text style={styles.recipeStatusTextGood}>
                                      {dish.ingredientsCount} Raw Ingredients Linked
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={styles.recipeStatusBadgeDraft}>
                                    <Text style={styles.recipeStatusTextDraft}>
                                      No Recipe Configured
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Cost & Profit Margin Analysis (2 Columns like Web) */}
                              <View style={styles.recipeMetricsRow2Col}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.recipeMetricLabel}>FOOD COST / PLATE</Text>
                                  <Text style={styles.recipeMetricVal}>
                                    {isConfigured ? `₹${dish.totalRecipeCost.toFixed(2)}` : '—'}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.recipeMetricLabel}>GROSS MARGIN %</Text>
                                  <Text
                                    style={[
                                      styles.recipeMetricVal,
                                      isConfigured ? { color: marginColor } : { color: '#9CA3AF' },
                                    ]}
                                  >
                                    {isConfigured ? `${dish.grossProfitMarginPercent}%` : '—'}
                                  </Text>
                                </View>
                              </View>

                              {/* BOM Components Preview Chips */}
                              {isConfigured && Array.isArray(dish.ingredients) && dish.ingredients.length > 0 && (
                                <View style={styles.recipeBomChipsContainer}>
                                  <Text style={styles.recipeBomChipsLabel}>BOM COMPONENTS:</Text>
                                  <View style={styles.recipeBomChipsWrap}>
                                    {dish.ingredients.slice(0, 3).map((ing, i) => (
                                      <View key={`bom-chip-${dish.menuItemId}-${i}`} style={styles.recipeBomChip}>
                                        <Text style={styles.recipeBomChipText}>
                                          {ing.ingredientName}: {ing.quantityRequired} {normalizeUnitName(ing.unitName)}
                                        </Text>
                                      </View>
                                    ))}
                                    {dish.ingredients.length > 3 && (
                                      <Text style={styles.recipeBomChipMore}>
                                        +{dish.ingredients.length - 3} more
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              )}

                              {/* Actions */}
                              <View style={styles.recipeActionsRow}>
                                <TouchableOpacity
                                  style={styles.recipeConfigBtn}
                                  onPress={() => handleOpenRecipeModal(dish)}
                                  activeOpacity={0.8}
                                >
                                  <SlidersHorizontal size={14} color="#1F2937" />
                                  <Text style={styles.recipeConfigBtnText}>
                                    {isConfigured ? 'Edit Recipe' : 'Configure Recipe'}
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.recipeCookBtn,
                                    !isConfigured && styles.recipeCookBtnDisabled,
                                    isCooking && { opacity: 0.6 },
                                  ]}
                                  onPress={() => handleSimulateCook(dish)}
                                  disabled={!isConfigured || isCooking}
                                  activeOpacity={0.8}
                                >
                                  {isCooking ? (
                                    <ActivityIndicator size="small" color="#B45309" />
                                  ) : (
                                    <>
                                      <Flame size={14} color={isConfigured ? '#F59E0B' : '#9CA3AF'} />
                                      <Text style={[styles.recipeCookBtnText, !isConfigured && { color: '#9CA3AF' }]}>
                                        Simulate Cook
                                      </Text>
                                    </>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* 4. STOCK MOVEMENT LEDGER TAB */}
                {activeTab === 'movements' && (
                  <View style={{ gap: 12 }}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardHeaderTitle}>Stock Movement Ledger</Text>
                        <Text style={styles.cardHeaderSub}>Real-time 360° kitchen audit trail of purchases, consumption & waste</Text>
                      </View>
                      <TouchableOpacity onPress={loadMovements} style={styles.refreshIconBtn}>
                        <RefreshCw size={14} color="#DE8626" />
                      </TouchableOpacity>
                    </View>

                    {/* Filter Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {['All', 'Purchase', 'Consumption', 'Wastage', 'Adjustment'].map((mType) => {
                        const isSel = movementTypeFilter === mType;
                        return (
                          <TouchableOpacity
                            key={`filter-${mType}`}
                            style={[styles.filterChip, isSel && styles.filterChipActive]}
                            onPress={() => setMovementTypeFilter(mType)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>{mType}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Search Movements Bar */}
                    <View style={styles.searchRow}>
                      <View style={styles.searchBox}>
                        <Search size={16} color="#8C7A6B" />
                        <TextInput
                          style={styles.searchInput}
                          value={movementSearchQuery}
                          onChangeText={setMovementSearchQuery}
                          placeholder="Search by ingredient, ref or notes..."
                          placeholderTextColor="#A89E92"
                        />
                        {movementSearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setMovementSearchQuery('')}>
                            <X size={14} color="#8C7A6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Movement Metric Highlights */}
                    {movementStats && (
                      <View style={styles.movementStatsGrid}>
                        <View style={styles.movementStatCard}>
                          <Text style={styles.movementStatLabel}>PURCHASES</Text>
                          <Text style={[styles.movementStatVal, { color: '#16A34A' }]}>
                            ₹{movementStats.totalPurchasedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </Text>
                          <Text style={styles.movementStatSub}>{movementStats.purchaseCount} bills</Text>
                        </View>
                        <View style={styles.movementStatCard}>
                          <Text style={styles.movementStatLabel}>KITCHEN USAGE</Text>
                          <Text style={[styles.movementStatVal, { color: '#D97706' }]}>
                            ₹{movementStats.totalCookedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </Text>
                          <Text style={styles.movementStatSub}>{movementStats.cookedCount} orders</Text>
                        </View>
                        <View style={styles.movementStatCard}>
                          <Text style={styles.movementStatLabel}>WASTE LOSS</Text>
                          <Text style={[styles.movementStatVal, { color: '#DC2626' }]}>
                            ₹{movementStats.totalWasteValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </Text>
                          <Text style={styles.movementStatSub}>{movementStats.wasteCount} events</Text>
                        </View>
                      </View>
                    )}

                    {/* Movements List */}
                    {loadingMovements ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#DE8626" />
                        <Text style={styles.loadingText}>Loading stock audit ledger...</Text>
                      </View>
                    ) : movements.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <History size={36} color="#C4B5A5" />
                        <Text style={styles.emptyTitle}>No Stock Movements Recorded</Text>
                        <Text style={styles.emptySub}>
                          Movements appear automatically when invoices are approved or dishes are cooked.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {movements.map((m) => {
                          const isPurchase = m.movementType?.toLowerCase() === 'purchase';
                          const isWaste = m.movementType?.toLowerCase() === 'wastage' || m.movementType?.toLowerCase() === 'waste';
                          const isCooked = m.movementType?.toLowerCase() === 'consumption' || m.movementType?.toLowerCase() === 'cooked';
                          const sign = m.quantity > 0 && isPurchase ? '+' : '';
                          const dateStr = m.createdDateUtc ? new Date(m.createdDateUtc).toLocaleDateString() : '';
                          const timeStr = m.createdDateUtc ? new Date(m.createdDateUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                          return (
                            <View key={`move-${m.id}`} style={styles.movementCard}>
                              <View style={styles.movementCardTop}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.movementIngName}>{m.ingredientName}</Text>
                                  <Text style={styles.movementDateText}>{dateStr} • {timeStr} {m.referenceId ? `• Ref: ${m.referenceId}` : ''}</Text>
                                </View>
                                <View
                                  style={[
                                    styles.movementTypeBadge,
                                    isPurchase && { backgroundColor: '#DCFCE7' },
                                    isWaste && { backgroundColor: '#FEE2E2' },
                                    isCooked && { backgroundColor: '#FEF3C7' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.movementTypeBadgeText,
                                      isPurchase && { color: '#16A34A' },
                                      isWaste && { color: '#DC2626' },
                                      isCooked && { color: '#D97706' },
                                    ]}
                                  >
                                    {m.movementType}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.movementCardBottom}>
                                <View>
                                  <Text style={styles.movementQtyLabel}>QUANTITY FLOW</Text>
                                  <Text
                                    style={[
                                      styles.movementQtyVal,
                                      isPurchase && { color: '#16A34A' },
                                      (isWaste || isCooked) && { color: '#DC2626' },
                                    ]}
                                  >
                                    {sign}{m.quantity} {m.unitName}
                                  </Text>
                                </View>
                                <View style={styles.metricDivider} />
                                <View>
                                  <Text style={styles.movementQtyLabel}>BALANCE AFTER</Text>
                                  <Text style={styles.movementBalVal}>{m.balanceAfterMovement} {m.unitName}</Text>
                                </View>
                                <View style={styles.metricDivider} />
                                <View>
                                  <Text style={styles.movementQtyLabel}>UNIT COST</Text>
                                  <Text style={styles.movementCostVal}>₹{m.costPerUnitAtMovement || 0}</Text>
                                </View>
                              </View>

                              {m.notes ? (
                                <Text style={styles.movementNotesText} numberOfLines={1}>
                                  Note: {m.notes}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* 5. WASTE TRACKING TAB */}
                {activeTab === 'waste' && (
                  <View style={{ gap: 12 }}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardHeaderTitle}>Kitchen Waste Tracking</Text>
                        <Text style={styles.cardHeaderSub}>Log and monitor kitchen food loss, spoilage & trim wastage</Text>
                      </View>
                      <TouchableOpacity onPress={loadWasteLogs} style={styles.refreshIconBtn}>
                        <RefreshCw size={14} color="#DE8626" />
                      </TouchableOpacity>
                    </View>

                    {/* Waste Summary Card */}
                    <View style={styles.wasteHeroCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.wasteHeroLabel}>ESTIMATED WASTE LOSS</Text>
                        <Text style={styles.wasteHeroVal}>₹{totalWasteLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                        <Text style={styles.wasteHeroSub}>{wasteLogs.length} wastage incidents recorded</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.wasteLogActionBtn}
                        onPress={() => setShowLogWasteModal(true)}
                        activeOpacity={0.85}
                      >
                        <Plus size={15} color="#FFFFFF" />
                        <Text style={styles.wasteLogActionBtnText}>Log Waste</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Search Waste Bar */}
                    <View style={styles.searchRow}>
                      <View style={styles.searchBox}>
                        <Search size={16} color="#8C7A6B" />
                        <TextInput
                          style={styles.searchInput}
                          value={wasteSearchQuery}
                          onChangeText={setWasteSearchQuery}
                          placeholder="Search wastage by ingredient or reason..."
                          placeholderTextColor="#A89E92"
                        />
                        {wasteSearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setWasteSearchQuery('')}>
                            <X size={14} color="#8C7A6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Waste Incidents List */}
                    {loadingWasteLogs ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#DE8626" />
                        <Text style={styles.loadingText}>Loading kitchen waste logs...</Text>
                      </View>
                    ) : filteredWasteLogs.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Trash2 size={36} color="#C4B5A5" />
                        <Text style={styles.emptyTitle}>No Wastage Incidents</Text>
                        <Text style={styles.emptySub}>
                          {wasteSearchQuery
                            ? `No records matching "${wasteSearchQuery}"`
                            : 'Kitchen waste is clean. Tap "Log Waste" to record spoiled or expired stock.'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {filteredWasteLogs.map((w) => {
                          const dateStr = w.loggedAtUtc ? new Date(w.loggedAtUtc).toLocaleDateString() : 'Recent';
                          return (
                            <View key={`waste-${w.id}`} style={styles.wasteCard}>
                              <View style={styles.wasteCardTop}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.wasteIngName}>{w.ingredientName}</Text>
                                  <Text style={styles.wasteDateText}>{dateStr} {w.notes ? `• ${w.notes}` : ''}</Text>
                                </View>
                                <View style={styles.wasteReasonBadge}>
                                  <Text style={styles.wasteReasonText}>{w.reason || 'Spoiled'}</Text>
                                </View>
                              </View>

                              <View style={styles.wasteCardBottom}>
                                <View>
                                  <Text style={styles.wasteMetricLabel}>QTY WASTED</Text>
                                  <Text style={styles.wasteMetricQty}>{w.quantityWasted} {w.unitName}</Text>
                                </View>
                                <View style={styles.metricDivider} />
                                <View>
                                  <Text style={styles.wasteMetricLabel}>UNIT COST</Text>
                                  <Text style={styles.wasteMetricCost}>₹{w.costPerUnit || 0}/{w.unitName}</Text>
                                </View>
                                <View style={styles.metricDivider} />
                                <View>
                                  <Text style={styles.wasteMetricLabel}>EST. LOSS</Text>
                                  <Text style={styles.wasteMetricLoss}>₹{w.totalEstimatedLoss.toFixed(2)}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* 6. INVOICE ARCHIVE TAB */}
                {activeTab === 'history' && (
                  <View style={{ gap: 12 }}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardHeaderTitle}>Scanned Invoice Archive</Text>
                        <Text style={styles.cardHeaderSub}>Historical paper receipts, mandi parchis & dairy bills</Text>
                      </View>
                      <TouchableOpacity onPress={loadHistory} style={styles.refreshIconBtn}>
                        <RefreshCw size={14} color="#DE8626" />
                      </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchRow}>
                      <View style={styles.searchBox}>
                        <Search size={16} color="#8C7A6B" />
                        <TextInput
                          style={styles.searchInput}
                          value={historySearchQuery}
                          onChangeText={setHistorySearchQuery}
                          placeholder="Search bills by vendor or invoice #..."
                          placeholderTextColor="#A89E92"
                        />
                        {historySearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
                            <X size={14} color="#8C7A6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {loadingHistory ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#DE8626" />
                        <Text style={styles.loadingText}>Fetching invoice records...</Text>
                      </View>
                    ) : filteredInvoicesHistory.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <ReceiptIndianRupee size={36} color="#C4B5A5" />
                        <Text style={styles.emptyTitle}>No Invoices Found</Text>
                        <Text style={styles.emptySub}>
                          {historySearchQuery
                            ? `No bills matching "${historySearchQuery}"`
                            : 'Tap AI Scanner to snap your first vegetable or dairy bill.'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {filteredInvoicesHistory.map((inv) => {
                          const isExpanded = expandedInvoiceId === inv.invoiceLogId;
                          const isDraft = inv.status?.toLowerCase() === 'draft';
                          return (
                            <TouchableOpacity
                              key={`inv-${inv.invoiceLogId}`}
                              style={[styles.historyCard, isDraft && styles.historyCardDraft]}
                              onPress={() => setExpandedInvoiceId(isExpanded ? null : inv.invoiceLogId)}
                              activeOpacity={0.85}
                            >
                              <View style={styles.historyCardTop}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.historyVendorText}>{inv.vendorName || 'Supplier Bill'}</Text>
                                    <View
                                      style={[
                                        styles.historyStatusPill,
                                        isDraft ? styles.historyStatusPillDraft : styles.historyStatusPillConfirmed,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.historyStatusText,
                                          isDraft ? styles.historyStatusTextDraft : styles.historyStatusTextConfirmed,
                                        ]}
                                      >
                                        {isDraft ? 'DRAFT' : 'CONFIRMED'}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={styles.historyMetaText}>
                                    #{inv.invoiceNumber || 'INV'} • {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : 'Recent'}
                                  </Text>
                                </View>
                                <View style={styles.historyTotalBadge}>
                                  <Text style={styles.historyTotalText}>₹{inv.totalAmount.toLocaleString('en-IN')}</Text>
                                </View>
                              </View>

                              <View style={styles.historyCardBottom}>
                                <Text style={styles.historyItemCountText}>
                                  {inv.items?.length || 0} line items {isExpanded ? '▲ Tap to hide' : '▼ Tap to view items'}
                                </Text>
                                {isDraft && (
                                  <TouchableOpacity
                                    style={styles.reviewDraftBtn}
                                    onPress={() => handleReviewDraftInvoice(inv)}
                                    activeOpacity={0.8}
                                  >
                                    <CheckCircle2 size={12} color="#FFFFFF" />
                                    <Text style={styles.reviewDraftBtnText}>Review & Approve</Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* Expanded Line Items Table */}
                              {isExpanded && Array.isArray(inv.items) && inv.items.length > 0 && (
                                <View style={styles.historyItemsExpandedBox}>
                                  <Text style={styles.historyItemsHeader}>Extracted Items Detail:</Text>
                                  {inv.items.map((it, idx) => (
                                    <View key={`it-${idx}`} style={styles.historyItemRow}>
                                      <Text style={styles.historyItemName} numberOfLines={1}>
                                        {it.matchedIngredientName || it.rawScannedText || 'Ingredient'}
                                      </Text>
                                      <Text style={styles.historyItemQty}>
                                        {it.quantity} {it.unitName}
                                      </Text>
                                      <Text style={styles.historyItemRate}>
                                        @ ₹{it.ratePerUnit}/{it.unitName}
                                      </Text>
                                      <Text style={styles.historyItemTotal}>
                                        ₹{it.lineTotal.toFixed(2)}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* 1. Ingredient Mapping Selection Overlay */}
          {activeMappingIndex !== null && (
            <View style={styles.mappingOverlayBackdrop}>
              <View style={styles.mappingOverlayCard}>
                {/* Header */}
                <View style={styles.pickerModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerModalTitle}>Map to Inventory Ingredient</Text>
                    <Text style={styles.pickerModalSub} numberOfLines={1}>
                      Scanned Text: "{editableItems[activeMappingIndex]?.rawScannedText || 'Ingredient'}"
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerModalCloseBtn}
                    onPress={() => {
                      setActiveMappingIndex(null);
                      setMappingSearchQuery('');
                    }}
                  >
                    <X size={18} color="#2D2319" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.pickerSearchBox}>
                  <Search size={16} color="#8C7A6B" />
                  <TextInput
                    style={styles.pickerSearchInput}
                    value={mappingSearchQuery}
                    onChangeText={setMappingSearchQuery}
                    placeholder="Search materials (Tomato, Paneer, Oil)..."
                    placeholderTextColor="#A89E92"
                  />
                  {mappingSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setMappingSearchQuery('')}>
                      <X size={14} color="#8C7A6B" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Options List */}
                <ScrollView style={styles.pickerListScroll} keyboardShouldPersistTaps="handled">
                  {/* Option 1: Add as New Ingredient */}
                  <TouchableOpacity
                    style={styles.pickerOptionNew}
                    onPress={() => {
                      if (activeMappingIndex !== null) {
                        handleSelectIngredient(activeMappingIndex, null);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerOptionNewIconCircle}>
                      <Plus size={16} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerOptionNewTitle}>+ Add as New Ingredient</Text>
                      <Text style={styles.pickerOptionNewSub}>Track as brand-new kitchen raw material</Text>
                    </View>
                    {activeMappingIndex !== null && editableItems[activeMappingIndex]?.isNewIngredient && (
                      <Check size={18} color="#D97706" />
                    )}
                  </TouchableOpacity>

                  <View style={styles.pickerDividerRow}>
                    <View style={styles.pickerDividerLine} />
                    <Text style={styles.pickerDividerLabel}>OR MAP TO EXISTING INGREDIENT</Text>
                    <View style={styles.pickerDividerLine} />
                  </View>

                  {mappingFilteredIngredients.length === 0 ? (
                    <View style={styles.pickerEmptyBox}>
                      <Text style={styles.pickerEmptyText}>No matching ingredients found</Text>
                      <Text style={styles.pickerEmptySub}>Tap "+ Add as New Ingredient" above to create it</Text>
                    </View>
                  ) : (
                    mappingFilteredIngredients.map((ing) => {
                      const isSelected =
                        activeMappingIndex !== null &&
                        editableItems[activeMappingIndex]?.matchedIngredientId === ing.id;
                      return (
                        <TouchableOpacity
                          key={`map-ing-${ing.id}`}
                          style={[styles.pickerOptionItem, isSelected && styles.pickerOptionItemSelected]}
                          onPress={() => {
                            if (activeMappingIndex !== null) {
                              handleSelectIngredient(activeMappingIndex, ing);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.pickerOptionIconCircle, isSelected && styles.pickerOptionIconCircleSelected]}>
                            <Package size={15} color={isSelected ? '#FFFFFF' : '#16A34A'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pickerOptionTitle, isSelected && styles.pickerOptionTitleSelected]}>
                              {ing.ingredientName}
                            </Text>
                            <Text style={styles.pickerOptionMeta}>
                              Unit: {ing.unitName} • Stock: {ing.currentStock} {ing.unitName} • Last: ₹{ing.lastPurchaseCostPerUnit || 0}
                            </Text>
                          </View>
                          {isSelected && <Check size={18} color="#16A34A" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </View>
          )}

          {/* 2. Unit Selection Overlay */}
          {activeUnitIndex !== null && (
            <View style={styles.unitOverlayBackdrop}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setActiveUnitIndex(null)}
              />
              <View style={styles.unitModalCard}>
                <View style={styles.unitModalHeader}>
                  <Text style={styles.unitModalTitle}>Select Unit of Measure</Text>
                  <TouchableOpacity onPress={() => setActiveUnitIndex(null)}>
                    <X size={16} color="#2D2319" />
                  </TouchableOpacity>
                </View>
                <View style={styles.unitGrid}>
                  {STANDARD_UNITS.map((u) => {
                    const isSelected =
                      activeUnitIndex !== null &&
                      editableItems[activeUnitIndex]?.unitName?.toLowerCase() === u.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={`unit-${u}`}
                        style={[styles.unitPillBtn, isSelected && styles.unitPillBtnSelected]}
                        onPress={() => {
                          if (activeUnitIndex !== null) {
                            handleSelectUnit(activeUnitIndex, u);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}>{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Overlay 3: Add New Raw Ingredient Modal */}
          {showAddIngredientModal && (
            <View style={styles.mappingOverlayBackdrop}>
              <View style={styles.mappingOverlayCard}>
                <View style={styles.pickerModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerModalTitle}>Add New Raw Ingredient</Text>
                    <Text style={styles.pickerModalSub}>
                      Create a persistent ingredient in your kitchen stock catalog
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerModalCloseBtn}
                    onPress={() => setShowAddIngredientModal(false)}
                  >
                    <X size={18} color="#2D2319" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={{ gap: 12, paddingVertical: 10 }}>
                    {/* Name */}
                    <View style={styles.formFieldBox}>
                      <Text style={styles.formLabel}>INGREDIENT NAME *</Text>
                      <TextInput
                        style={styles.formInput}
                        value={newIngredientName}
                        onChangeText={setNewIngredientName}
                        placeholder="e.g. Amul Butter, Desi Ghee, Paneer..."
                        placeholderTextColor="#A89E92"
                      />
                    </View>

                    {/* Unit Selector */}
                    <View style={styles.formFieldBox}>
                      <Text style={styles.formLabel}>UNIT OF MEASURE *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {STANDARD_UNITS.map((u) => {
                          const isSel = newIngredientUnit === u;
                          return (
                            <TouchableOpacity
                              key={`new-unit-${u}`}
                              style={[styles.unitPillBtn, isSel && styles.unitPillBtnSelected]}
                              onPress={() => setNewIngredientUnit(u)}
                            >
                              <Text style={[styles.unitPillText, isSel && styles.unitPillTextSelected]}>{u}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Initial Stock & Min Reorder Level */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={[styles.formFieldBox, { flex: 1 }]}>
                        <Text style={styles.formLabel}>INITIAL STOCK ({newIngredientUnit})</Text>
                        <TextInput
                          style={styles.formInput}
                          value={newIngredientStock}
                          onChangeText={setNewIngredientStock}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#A89E92"
                        />
                      </View>
                      <View style={[styles.formFieldBox, { flex: 1 }]}>
                        <Text style={styles.formLabel}>MIN REORDER LEVEL</Text>
                        <TextInput
                          style={styles.formInput}
                          value={newIngredientMinLevel}
                          onChangeText={setNewIngredientMinLevel}
                          keyboardType="numeric"
                          placeholder="5"
                          placeholderTextColor="#A89E92"
                        />
                      </View>
                    </View>

                    {/* Cost Per Unit & SKU */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={[styles.formFieldBox, { flex: 1 }]}>
                        <Text style={styles.formLabel}>PURCHASE COST / {newIngredientUnit} (₹)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={newIngredientCost}
                          onChangeText={setNewIngredientCost}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#A89E92"
                        />
                      </View>
                      <View style={[styles.formFieldBox, { flex: 1 }]}>
                        <Text style={styles.formLabel}>SKU / BARCODE (OPTIONAL)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={newIngredientSku}
                          onChangeText={setNewIngredientSku}
                          placeholder="RAW-001"
                          placeholderTextColor="#A89E92"
                        />
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveSubmitBtn, savingIngredient && { opacity: 0.6 }]}
                  onPress={handleSaveNewIngredient}
                  disabled={savingIngredient}
                  activeOpacity={0.88}
                >
                  <LinearGradient colors={['#DE8626', '#D96B14']} style={styles.saveSubmitBtnGradient}>
                    {savingIngredient ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Check size={16} color="#FFFFFF" />
                        <Text style={styles.saveSubmitBtnText}>Save Raw Ingredient</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Overlay 4: Recipe Configurator Modal */}
          {showRecipeModal && selectedRecipeDish && (
            <View style={styles.recipeWebBackdrop}>
              <View style={styles.recipeWebCard}>
                {/* Header */}
                <View style={styles.recipeWebHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.recipeWebTag}>RECIPE & BILL OF MATERIALS (BOM)</Text>
                      {selectedRecipeDish.categoryName ? (
                        <View style={styles.recipeWebCategoryPill}>
                          <Text style={styles.recipeWebCategoryPillText}>{selectedRecipeDish.categoryName}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.recipeWebTitle} numberOfLines={1}>
                      {selectedRecipeDish.menuItemName}
                    </Text>
                    <Text style={styles.recipeWebSubtitle}>
                      Selling Price: ₹{selectedRecipeDish.price.toFixed(2)} • Target Cost: ₹{(selectedRecipeDish.totalRecipeCost || 0).toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.recipeWebCloseBtn}
                    onPress={() => setShowRecipeModal(false)}
                    activeOpacity={0.7}
                  >
                    <X size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Success Feedback Banner */}
                {recipeActionFeedback && (
                  <View style={styles.recipeWebFeedbackBanner}>
                    <CheckCircle2 size={16} color="#059669" />
                    <Text style={styles.recipeWebFeedbackText}>{recipeActionFeedback}</Text>
                  </View>
                )}

                {/* Recipe Ingredients List (Scrollable) */}
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 6 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {recipeDraftIngredients.length === 0 ? (
                    <View style={styles.recipeWebEmptyBox}>
                      <ChefHat size={40} color="#9CA3AF" style={{ alignSelf: 'center', marginBottom: 8 }} />
                      <Text style={styles.recipeWebEmptyTitle}>No raw ingredients linked to this dish yet.</Text>
                      <Text style={styles.recipeWebEmptySubtitle}>
                        Map constituent raw materials so each customer order automatically deducts inventory.
                      </Text>
                      <TouchableOpacity
                        style={styles.recipeWebAddFirstBtn}
                        onPress={handleAddRecipeIngredientRow}
                        activeOpacity={0.8}
                      >
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.recipeWebAddFirstBtnText}>Add First Ingredient</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {recipeDraftIngredients.map((row, idx) => {
                        const baseIng = ingredients.find((i) => i.id === row.ingredientId);
                        const baseCost = baseIng?.lastPurchaseCostPerUnit || row.costPerUnit || 0;
                        const baseUnit = baseIng?.unitName || row.unitName || 'Kg';

                        return (
                          <View key={`recipe-row-${idx}`} style={styles.recipeWebRowCard}>
                            {/* Raw Material Select & Trash Button */}
                            <View style={{ gap: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={styles.recipeWebFieldLabel}>RAW MATERIAL</Text>
                                <TouchableOpacity
                                  style={styles.recipeWebTrashBtn}
                                  onPress={() => handleRemoveRecipeRow(idx)}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Trash2 size={15} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                              <TouchableOpacity
                                style={styles.recipeWebSelectBtn}
                                onPress={() => {
                                  setActiveRecipeIngPickerIndex(idx);
                                  setRecipeIngPickerSearch('');
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.recipeWebSelectBtnText} numberOfLines={1}>
                                  {row.ingredientName
                                    ? `${row.ingredientName} (₹${baseCost.toFixed(2)}/${baseUnit})`
                                    : 'Select Raw Material'}
                                </Text>
                                <ChevronDown size={14} color="#6B7280" />
                              </TouchableOpacity>
                            </View>

                            {/* 5-Field Grid: Quantity, Unit, Cost/Unit, Prep Buffer %, Line Cost */}
                            <View style={styles.recipeWebGridRow}>
                              {/* Quantity */}
                              <View style={[styles.recipeWebCol, { flex: 1.1 }]}>
                                <Text style={styles.recipeWebFieldLabel}>PORTION QTY</Text>
                                <TextInput
                                  style={styles.recipeWebInputBold}
                                  value={String(row.quantityRequired ?? '')}
                                  onChangeText={(val) => handleUpdateRecipeRow(idx, 'quantityRequired', val)}
                                  keyboardType="numeric"
                                  placeholder="0.1"
                                  placeholderTextColor="#9CA3AF"
                                />
                              </View>

                              {/* Unit */}
                              <View style={[styles.recipeWebCol, { flex: 0.9 }]}>
                                <Text style={styles.recipeWebFieldLabel}>UNIT</Text>
                                <TouchableOpacity
                                  style={styles.recipeWebUnitBtn}
                                  onPress={() => setActiveRecipeUnitPickerIndex(idx)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.recipeWebUnitBtnText} numberOfLines={1}>
                                    {normalizeUnitName(row.unitName)}
                                  </Text>
                                  <ChevronDown size={12} color="#6B7280" />
                                </TouchableOpacity>
                              </View>

                              {/* Cost / Unit Rate */}
                              <View style={[styles.recipeWebCol, { flex: 1.15 }]}>
                                <Text style={styles.recipeWebFieldLabel} numberOfLines={1}>COST / UNIT (₹)</Text>
                                <View style={styles.recipeWebReadOnlyBox}>
                                  <Text
                                    style={styles.recipeWebReadOnlyText}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.7}
                                  >
                                    ₹{baseCost.toFixed(2)}/{normalizeUnitName(row.unitName || baseIng?.unitName)}
                                  </Text>
                                </View>
                              </View>

                              {/* Yield / Trim Buffer % */}
                              <View style={[styles.recipeWebCol, { flex: 0.9 }]}>
                                <Text style={styles.recipeWebFieldLabel}>BUFFER %</Text>
                                <TextInput
                                  style={styles.recipeWebInput}
                                  value={String(row.wastageBufferPercent ?? 0)}
                                  onChangeText={(val) => handleUpdateRecipeRow(idx, 'wastageBufferPercent', val)}
                                  keyboardType="numeric"
                                  placeholder="0%"
                                  placeholderTextColor="#9CA3AF"
                                />
                              </View>

                              {/* Line Cost */}
                              <View style={[styles.recipeWebCol, { flex: 1, alignItems: 'flex-end', justifyContent: 'center' }]}>
                                <Text style={styles.recipeWebFieldLabel}>LINE ₹</Text>
                                <Text style={styles.recipeWebLineCostText}>
                                  ₹{(row.lineCost ?? 0).toFixed(2)}
                                </Text>
                              </View>
                            </View>

                            {/* Cooking & Prep Notes */}
                            <View style={styles.recipeWebNotesRow}>
                              <Text style={styles.recipeWebNotesLabel}>PREP NOTES:</Text>
                              <TextInput
                                style={styles.recipeWebNotesInput}
                                value={row.notes || ''}
                                onChangeText={(val) => handleUpdateRecipeRow(idx, 'notes', val)}
                                placeholder="e.g. Finely chopped, Blanch 2 mins, Marinate with garlic paste..."
                                placeholderTextColor="#9CA3AF"
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Add Ingredient Row Button */}
                  {recipeDraftIngredients.length > 0 && (
                    <TouchableOpacity
                      style={styles.recipeWebAddRowBtn}
                      onPress={handleAddRecipeIngredientRow}
                      activeOpacity={0.7}
                    >
                      <Plus size={16} color="#4B5563" />
                      <Text style={styles.recipeWebAddRowBtnText}>Add Another Raw Ingredient</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>

                {/* Footer Cost & Margin Preview */}
                <View style={styles.recipeWebFooter}>
                  <View style={styles.recipeWebFooterTopRow}>
                    <View style={styles.recipeWebMetricsGroup}>
                      <View>
                        <Text style={styles.recipeWebMetricLabel}>CALCULATED FOOD COST</Text>
                        <Text style={styles.recipeWebMetricValue}>₹{draftRecipeTotalCost.toFixed(2)}</Text>
                      </View>

                      <View style={styles.recipeWebMetricDivider} />

                      <View>
                        <Text style={styles.recipeWebMetricLabel}>GROSS PROFIT MARGIN</Text>
                        <Text
                          style={[
                            styles.recipeWebMetricValue,
                            {
                              color:
                                draftRecipeMarginPercent >= 65
                                  ? '#059669'
                                  : draftRecipeMarginPercent >= 45
                                  ? '#D97706'
                                  : '#E11D48',
                            },
                          ]}
                        >
                          {draftRecipeMarginPercent}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.recipeWebButtonsGroup}>
                      <TouchableOpacity
                        style={styles.recipeWebCancelBtn}
                        onPress={() => setShowRecipeModal(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.recipeWebCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.recipeWebSaveBtn, savingRecipe && { opacity: 0.6 }]}
                        onPress={handleSaveRecipe}
                        disabled={savingRecipe}
                        activeOpacity={0.88}
                      >
                        {savingRecipe ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.recipeWebSaveBtnText}>Save Recipe (BOM)</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Overlay 4.1: Unit Selector for Recipe Row */}
          {activeRecipeUnitPickerIndex !== null && (
            <View style={[styles.recipeWebBackdrop, { zIndex: 100000, elevation: 80 }]}>
              <View style={[styles.recipeWebCard, { maxWidth: 320, height: undefined, maxHeight: '80%', padding: 20, elevation: 90 }]}>
                <View style={styles.recipeWebPickerHeader}>
                  <Text style={styles.recipeWebPickerTitle}>Select Unit</Text>
                  <TouchableOpacity
                    style={styles.recipeWebCloseBtn}
                    onPress={() => setActiveRecipeUnitPickerIndex(null)}
                  >
                    <X size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 8, marginVertical: 10 }}>
                  {RECIPE_BOM_UNITS.map((u) => {
                    const currentUnit = normalizeUnitName(recipeDraftIngredients[activeRecipeUnitPickerIndex]?.unitName);
                    const isSel = currentUnit.toLowerCase() === u.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={`pick-unit-${u}`}
                        style={[styles.recipeWebUnitOption, isSel && styles.recipeWebUnitOptionActive]}
                        onPress={() => {
                          handleUpdateRecipeRow(activeRecipeUnitPickerIndex, 'unitName', u);
                          setActiveRecipeUnitPickerIndex(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.recipeWebUnitOptionText, isSel && styles.recipeWebUnitOptionTextActive]}>
                          {u}
                        </Text>
                        {isSel && <Check size={16} color="#F59E0B" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Overlay 5: Raw Ingredient Selector for Recipe Row */}
          {activeRecipeIngPickerIndex !== null && (
            <View style={[styles.recipeWebBackdrop, { zIndex: 100000, elevation: 80 }]}>
              <View style={[styles.recipeWebCard, { maxWidth: 460, height: '80%', maxHeight: '85%', padding: 20, elevation: 90 }]}>
                <View style={styles.recipeWebPickerHeader}>
                  <View>
                    <Text style={styles.recipeWebPickerTitle}>Select Raw Material</Text>
                    <Text style={styles.recipeWebPickerSub}>Choose ingredient to bind into recipe BOM</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.recipeWebCloseBtn}
                    onPress={() => setActiveRecipeIngPickerIndex(null)}
                  >
                    <X size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.recipeWebSearchBox}>
                  <Search size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.recipeWebSearchInput}
                    value={recipeIngPickerSearch}
                    onChangeText={setRecipeIngPickerSearch}
                    placeholder="Search raw material..."
                    placeholderTextColor="#9CA3AF"
                  />
                  {recipeIngPickerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setRecipeIngPickerSearch('')}>
                      <X size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={{ maxHeight: 340, marginVertical: 6 }} keyboardShouldPersistTaps="handled">
                  {ingredients
                    .filter(
                      (ing) =>
                        !recipeIngPickerSearch.trim() ||
                        ing.ingredientName.toLowerCase().includes(recipeIngPickerSearch.toLowerCase())
                    )
                    .map((ing) => {
                      const isSelected = recipeDraftIngredients[activeRecipeIngPickerIndex]?.ingredientId === ing.id;
                      return (
                        <TouchableOpacity
                          key={`recipe-pick-${ing.id}`}
                          style={[styles.recipeWebIngOption, isSelected && styles.recipeWebIngOptionActive]}
                          onPress={() => {
                            handleUpdateRecipeRow(activeRecipeIngPickerIndex, 'ingredientId', ing.id);
                            setActiveRecipeIngPickerIndex(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.recipeWebIngIconCircle, isSelected && { backgroundColor: '#FEF3C7' }]}>
                            <Package size={15} color={isSelected ? '#F59E0B' : '#059669'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.recipeWebIngOptionTitle, isSelected && { color: '#B45309' }]}>
                              {ing.ingredientName}
                            </Text>
                            <Text style={styles.recipeWebIngOptionMeta}>
                              Rate: ₹{ing.lastPurchaseCostPerUnit || 0} / {ing.unitName}
                            </Text>
                          </View>
                          {isSelected && <Check size={16} color="#F59E0B" />}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Overlay 6: Log Kitchen Waste Modal */}
          {showLogWasteModal && (
            <View style={styles.mappingOverlayBackdrop}>
              <View style={styles.mappingOverlayCard}>
                <View style={styles.pickerModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerModalTitle}>Record Kitchen Wastage</Text>
                    <Text style={styles.pickerModalSub}>
                      Deducts stock immediately and records loss in the waste audit ledger
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerModalCloseBtn}
                    onPress={() => setShowLogWasteModal(false)}
                  >
                    <X size={18} color="#2D2319" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={{ gap: 12, paddingVertical: 10 }}>
                    {/* Pick Ingredient */}
                    <View style={styles.formFieldBox}>
                      <Text style={styles.formLabel}>RAW INGREDIENT *</Text>
                      <TouchableOpacity
                        style={styles.formPickerTrigger}
                        onPress={() => setShowWasteIngPicker(true)}
                      >
                        <Package size={15} color="#DE8626" />
                        <Text style={styles.formPickerTriggerText}>
                          {ingredients.find((i) => i.id === wasteIngredientId)?.ingredientName ||
                            'Tap to Select Ingredient...'}
                        </Text>
                        <ChevronDown size={15} color="#8C7A6B" />
                      </TouchableOpacity>
                    </View>

                    {/* Quantity */}
                    <View style={styles.formFieldBox}>
                      <Text style={styles.formLabel}>
                        QUANTITY WASTED ({ingredients.find((i) => i.id === wasteIngredientId)?.unitName || 'Units'}) *
                      </Text>
                      <TextInput
                        style={styles.formInput}
                        value={wasteQuantity}
                        onChangeText={setWasteQuantity}
                        keyboardType="numeric"
                        placeholder="e.g. 2.5"
                        placeholderTextColor="#A89E92"
                      />
                    </View>

                    {/* Reason Selection */}
                    <View style={styles.formFieldBox}>
                      <Text style={styles.formLabel}>WASTE REASON *</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {WASTE_REASONS.map((r) => {
                          const isSel = wasteReason === r;
                          return (
                            <TouchableOpacity
                              key={`reason-${r}`}
                              style={[styles.reasonPill, isSel && styles.reasonPillActive]}
                              onPress={() => setWasteReason(r)}
                            >
                              <Text style={[styles.reasonPillText, isSel && styles.reasonPillTextActive]}>{r}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Notes */}
                    <View style={styles.formFieldBox}>
                      <Text style={styles.formLabel}>NOTES / EXPLANATION (OPTIONAL)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={wasteNotes}
                        onChangeText={setWasteNotes}
                        placeholder="e.g. Refrigerator temperature failure overnight"
                        placeholderTextColor="#A89E92"
                      />
                    </View>
                  </View>
                </ScrollView>

                {/* Submit Waste Button */}
                <TouchableOpacity
                  style={[styles.saveSubmitBtn, savingWaste && { opacity: 0.6 }]}
                  onPress={handleSaveWaste}
                  disabled={savingWaste}
                  activeOpacity={0.88}
                >
                  <LinearGradient colors={['#DC2626', '#B91C1C']} style={styles.saveSubmitBtnGradient}>
                    {savingWaste ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Trash2 size={16} color="#FFFFFF" />
                        <Text style={styles.saveSubmitBtnText}>Record Wastage & Deplete Stock</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Overlay 7: Raw Ingredient Picker for Waste Modal */}
          {showWasteIngPicker && (
            <View style={styles.mappingOverlayBackdrop}>
              <View style={styles.mappingOverlayCard}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Pick Wasted Ingredient</Text>
                  <TouchableOpacity
                    style={styles.pickerModalCloseBtn}
                    onPress={() => setShowWasteIngPicker(false)}
                  >
                    <X size={18} color="#2D2319" />
                  </TouchableOpacity>
                </View>

                <View style={styles.pickerSearchBox}>
                  <Search size={16} color="#8C7A6B" />
                  <TextInput
                    style={styles.pickerSearchInput}
                    value={wasteIngPickerSearch}
                    onChangeText={setWasteIngPickerSearch}
                    placeholder="Search material..."
                    placeholderTextColor="#A89E92"
                  />
                </View>

                <ScrollView style={{ maxHeight: 350 }} keyboardShouldPersistTaps="handled">
                  {ingredients
                    .filter(
                      (ing) =>
                        !wasteIngPickerSearch.trim() ||
                        ing.ingredientName.toLowerCase().includes(wasteIngPickerSearch.toLowerCase())
                    )
                    .map((ing) => (
                      <TouchableOpacity
                        key={`waste-pick-${ing.id}`}
                        style={styles.pickerOptionItem}
                        onPress={() => {
                          setWasteIngredientId(ing.id);
                          setShowWasteIngPicker(false);
                        }}
                      >
                        <View style={styles.pickerOptionIconCircle}>
                          <Package size={15} color="#DC2626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickerOptionTitle}>{ing.ingredientName}</Text>
                          <Text style={styles.pickerOptionMeta}>
                            Current Stock: {ing.currentStock} {ing.unitName} • Cost: ₹{ing.lastPurchaseCostPerUnit || 0}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 23, 17, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '65%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DC',
    backgroundColor: '#FFFFFF',
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2319',
    letterSpacing: -0.2,
  },
  modalSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8C7A6B',
    marginTop: 2,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DC',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    position: 'relative',
  },
  tabItemActive: {
    borderBottomColor: '#DE8626',
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  tabItemTextActive: {
    color: '#DE8626',
  },
  tabBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  paywallWrapper: {
    gap: 16,
  },
  heroCardLocked: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  heroCardActive: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(217, 107, 20, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeLockedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D96B14',
    letterSpacing: 0.5,
  },
  badgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitleLocked: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2319',
    marginBottom: 4,
  },
  heroDescLocked: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7C6F62',
    lineHeight: 18,
  },
  heroTitleActive: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532D',
    marginBottom: 4,
  },
  heroDescActive: {
    fontSize: 12,
    fontWeight: '500',
    color: '#166534',
    lineHeight: 18,
  },
  upgradeBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  upgradeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBE5DC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D2319',
  },
  cardHeaderSub: {
    fontSize: 12,
    color: '#7C6F62',
    marginTop: 2,
    marginBottom: 12,
  },
  captureButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  captureLargeBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBE5DC',
  },
  captureBtnInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
    gap: 8,
  },
  captureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D2319',
  },
  captureBtnSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7C6F62',
  },
  sampleHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sampleButtonsRow: {
    gap: 8,
  },
  sampleSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 10,
  },
  sampleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2319',
  },
  sampleBtnSub: {
    fontSize: 11,
    color: '#7C6F62',
    marginTop: 1,
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#000',
    position: 'relative',
    marginBottom: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActionsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  miniChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  miniChangeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8F0',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEE2CA',
    marginTop: 10,
  },
  scanningBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  scanningBannerSub: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 1,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  metadataGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metaField: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C7A6B',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  metaInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2319',
  },
  scannedActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  addMissingHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addMissingHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DE8626',
  },
  discardHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#FAF7F2',
  },
  discardHeaderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C6F62',
  },
  itemsListContainer: {
    gap: 10,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBE5DC',
  },
  itemIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C6F62',
  },
  fieldMicroLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8C7A6B',
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  scannedTextInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2319',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  cardTrashBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  itemCardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#F5F1EA',
  },
  ingredientPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  ingredientPickerBtnMatched: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  ingredientPickerBtnNew: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  ingredientPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ingredientPickerBtnTextMatched: {
    color: '#15803D',
  },
  ingredientPickerBtnTextNew: {
    color: '#B45309',
  },
  variancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variancePillSurge: {
    backgroundColor: '#FEE2E2',
  },
  variancePillDrop: {
    backgroundColor: '#DCFCE7',
  },
  variancePillBaseline: {
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variancePillNew: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variancePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  variancePillTextSurge: {
    color: '#DC2626',
  },
  variancePillTextDrop: {
    color: '#16A34A',
  },
  variancePillTextBaseline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C6F62',
  },
  variancePillTextNew: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  prevPriceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8C7A6B',
    marginTop: 2,
  },
  itemCardBottomGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F0EBE1',
  },
  gridInputColSmall: {
    flex: 1,
  },
  gridInputColMedium: {
    flex: 1.2,
  },
  gridTotalCol: {
    flex: 1.3,
    alignItems: 'flex-end',
  },
  gridNumericInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2319',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'center',
  },
  gridUnitPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  gridUnitPickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2319',
  },
  gridLineTotalVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 4,
  },
  mappingOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(29, 23, 17, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  mappingOverlayCard: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 16,
    gap: 12,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D2319',
  },
  pickerModalSub: {
    fontSize: 11,
    color: '#7C6F62',
    marginTop: 2,
  },
  pickerModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBE5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2319',
    padding: 0,
  },
  pickerListScroll: {
    maxHeight: 320,
  },
  pickerOptionNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
  },
  pickerOptionNewIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionNewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  pickerOptionNewSub: {
    fontSize: 11,
    color: '#D97706',
    marginTop: 1,
  },
  pickerDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
  },
  pickerDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E2D9',
  },
  pickerDividerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.5,
  },
  pickerEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  pickerEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C6F62',
  },
  pickerEmptySub: {
    fontSize: 11,
    color: '#A89E92',
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE5DC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  pickerOptionItemSelected: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  pickerOptionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionIconCircleSelected: {
    backgroundColor: '#16A34A',
  },
  pickerOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2319',
  },
  pickerOptionTitleSelected: {
    color: '#15803D',
    fontWeight: '800',
  },
  pickerOptionMeta: {
    fontSize: 11,
    color: '#7C6F62',
    marginTop: 2,
  },
  unitOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(29, 23, 17, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999,
  },
  unitModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  unitModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
    paddingBottom: 8,
  },
  unitModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D2319',
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    minWidth: 54,
    alignItems: 'center',
  },
  unitPillBtnSelected: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  unitPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2319',
  },
  unitPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DE8626',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 12,
  },
  addRowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DE8626',
  },
  confirmSection: {
    borderTopWidth: 1,
    borderTopColor: '#EBE5DC',
    paddingTop: 12,
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C6F62',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#15803D',
  },
  confirmBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  lowStockBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  lowStockBannerSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2319',
    padding: 0,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D2319',
  },
  emptySub: {
    fontSize: 12,
    color: '#8C7A6B',
    textAlign: 'center',
    maxWidth: 260,
  },
  stockGrid: {
    gap: 10,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  stockCardLow: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  stockCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stockCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D2319',
  },
  stockCardSku: {
    fontSize: 11,
    color: '#8C7A6B',
    marginTop: 1,
  },
  stockPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockPillGood: {
    backgroundColor: '#DCFCE7',
  },
  stockPillLow: {
    backgroundColor: '#FEE2E2',
  },
  stockPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  stockPillTextGood: {
    color: '#15803D',
  },
  stockPillTextLow: {
    color: '#DC2626',
  },
  stockCardMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E8E2D9',
  },
  metricColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8C7A6B',
    marginBottom: 2,
  },
  metricColVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  metricColValSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2319',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 8,
  },
  historyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyVendorText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D2319',
  },
  historyMetaText: {
    fontSize: 11,
    color: '#8C7A6B',
    marginTop: 2,
  },
  historyTotalBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  historyTotalText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  historyCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F1EA',
    paddingTop: 8,
  },
  historyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  historyItemCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  flowStepsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 14,
  },
  flowStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flowStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowStepNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  flowStepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2319',
  },
  flowStepDesc: {
    fontSize: 11,
    color: '#7C6F62',
    lineHeight: 16,
    marginTop: 2,
  },

  // 6-Tab Navigation Scroll
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DC',
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F7F4EF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  tabPillActive: {
    backgroundColor: '#FFF2E2',
    borderColor: '#DE8626',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  tabPillTextActive: {
    color: '#DE8626',
    fontWeight: '800',
  },

  // Add Ingredient Buttons
  addIngredientQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addIngredientQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: '#FDBA74',
    marginTop: 12,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DE8626',
  },

  // Dish Recipes & BOM Cards
  recipeCardWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAE4DA',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  recipeCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  recipeDishName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  recipeDishPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  recipeStatusBadgeGood: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  recipeStatusBadgeDraft: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  recipeMetricsRow2Col: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 16,
  },
  recipeCategoryPill: {
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recipeCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  recipePriceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C6F62',
    marginTop: 2,
  },
  recipeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recipeStatusPillGood: {
    backgroundColor: '#DCFCE7',
  },
  recipeStatusPillDraft: {
    backgroundColor: '#FEF3C7',
  },
  recipeStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  recipeStatusTextGood: {
    color: '#16A34A',
  },
  recipeStatusTextDraft: {
    color: '#D97706',
  },
  recipeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recipeMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  recipeMetricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.4,
  },
  recipeMetricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2319',
    marginTop: 2,
  },
  recipeMetricValSub: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  recipeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  recipeConfigBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipeConfigBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  recipeCookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  recipeCookBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  recipeCookBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  recipeBomChipsContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3EFEA',
    gap: 4,
  },
  recipeBomChipsLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  recipeBomChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  recipeBomChip: {
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recipeBomChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  recipeBomChipMore: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    alignSelf: 'center',
    paddingHorizontal: 2,
  },
  recipeStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  recipeStatsCounterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Filter Chips for Movements
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  filterChipActive: {
    backgroundColor: '#DE8626',
    borderColor: '#DE8626',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C6F62',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  movementStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  movementStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
  },
  movementStatLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.3,
  },
  movementStatVal: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  movementStatSub: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 1,
  },
  movementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 8,
  },
  movementCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  movementIngName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2319',
  },
  movementDateText: {
    fontSize: 10,
    color: '#8C7A6B',
    marginTop: 2,
  },
  movementTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F3EFEA',
  },
  movementTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  movementCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  movementQtyLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  movementQtyVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2319',
    marginTop: 1,
  },
  movementBalVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2319',
    marginTop: 1,
  },
  movementCostVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 1,
  },
  movementNotesText: {
    fontSize: 10,
    color: '#8C7A6B',
    fontStyle: 'italic',
  },

  // Waste Tracking
  wasteHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 12,
  },
  wasteHeroLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  wasteHeroVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#991B1B',
    marginTop: 2,
  },
  wasteHeroSub: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 2,
  },
  wasteLogActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  wasteLogActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  wasteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 8,
  },
  wasteCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  wasteIngName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2319',
  },
  wasteDateText: {
    fontSize: 10,
    color: '#8C7A6B',
    marginTop: 2,
  },
  wasteReasonBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  wasteReasonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  wasteCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  wasteMetricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  wasteMetricQty: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2319',
    marginTop: 1,
  },
  wasteMetricCost: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 1,
  },
  wasteMetricLoss: {
    fontSize: 12,
    fontWeight: '900',
    color: '#DC2626',
    marginTop: 1,
  },

  // Archive Upgraded
  historyCardDraft: {
    borderColor: '#FDBA74',
    borderWidth: 1.5,
  },
  historyStatusPillDraft: {
    backgroundColor: '#FEF3C7',
  },
  historyStatusPillConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  historyStatusTextDraft: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  historyStatusTextConfirmed: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  reviewDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  reviewDraftBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historyItemsExpandedBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EBE5DC',
    gap: 6,
  },
  historyItemsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C7A6B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  historyItemName: {
    flex: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2319',
  },
  historyItemQty: {
    flex: 1,
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
  },
  historyItemRate: {
    flex: 1,
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  historyItemTotal: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#2D2319',
    textAlign: 'right',
  },

  // Form Fields for Overlays
  formFieldBox: {
    gap: 4,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.4,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#2D2319',
  },
  formPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formPickerTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2319',
  },
  reasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3EFEA',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  reasonPillActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
  },
  reasonPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  reasonPillTextActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  saveSubmitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  saveSubmitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Recipe Modal Configurator
  recipeModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  recipeModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2319',
    marginTop: 1,
  },
  recipeModalSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8C7A6B',
    marginTop: 2,
  },
  recipeWebBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    zIndex: 9999,
    elevation: 50,
  },
  recipeWebCard: {
    width: '100%',
    maxWidth: 640,
    height: '88%',
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 60,
    gap: 12,
  },
  recipeWebHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recipeWebTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  recipeWebCategoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipeWebCategoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  recipeWebTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 1,
    marginBottom: 2,
  },
  recipeWebSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  recipeWebCloseBtn: {
    padding: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeWebFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  recipeWebFeedbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
  recipeWebEmptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    marginVertical: 8,
  },
  recipeWebEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  recipeWebEmptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  recipeWebAddFirstBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  recipeWebAddFirstBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recipeWebRowCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  recipeWebFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  recipeWebSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  recipeWebSelectBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  recipeWebTrashBtn: {
    padding: 4,
    borderRadius: 6,
  },
  recipeWebGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeWebCol: {
    gap: 2,
  },
  recipeWebInputBold: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    minHeight: 32,
  },
  recipeWebInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    minHeight: 32,
  },
  recipeWebUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 32,
  },
  recipeWebUnitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  recipeWebLineCostText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
  },
  recipeWebReadOnlyBox: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 32,
  },
  recipeWebReadOnlyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  recipeWebNotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 2,
  },
  recipeWebNotesLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recipeWebNotesInput: {
    flex: 1,
    fontSize: 11,
    color: '#111827',
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
  },
  recipeWebAddRowBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  recipeWebAddRowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  recipeWebFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  recipeWebFooterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  recipeWebMetricsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recipeWebMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  recipeWebMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipeWebMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
  },
  recipeWebButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeWebCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeWebCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  recipeWebSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  recipeWebSaveBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  recipeWebPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recipeWebPickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  recipeWebPickerSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  recipeWebUnitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipeWebUnitOptionActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  recipeWebUnitOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  recipeWebUnitOptionTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  recipeWebSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  recipeWebSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    padding: 0,
  },
  recipeWebIngOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  recipeWebIngOptionActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  recipeWebIngIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeWebIngOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  recipeWebIngOptionMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
});
