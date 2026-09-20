import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus,
  Lock,
  UtensilsCrossed,
  X,
  Edit2,
  Trash2,
  Flame,
  Clock,
  Layers,
  Sparkles,
  Check,
  Search,
  PackageCheck,
  Tag,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Sliders,
  PlusCircle,
  ChefHat,
  Grid,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Layers3,
  SlidersHorizontal,
  FolderOpen,
} from 'lucide-react-native';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { MenuItem } from '../../../domain/models/Item';
import { Category } from '../../../domain/models/Category';
import { UnitMaster } from '../../../domain/models/MasterData';
import { CatalogRemoteDataSource } from '../../../data/datasources/CatalogRemoteDataSource';
import { MasterDataRemoteDataSource } from '../../../data/datasources/MasterDataRemoteDataSource';
import { useAuthStore } from '../../state/useAuthStore';
import { useKitchenStationStore } from '../../state/useKitchenStationStore';
import { GildedAlertModal, GildedAlertConfig } from '../../components/GildedAlertModal';
import { SkeletonLoader } from '../../components/SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const catalogDataSource = new CatalogRemoteDataSource();
const masterDataDataSource = new MasterDataRemoteDataSource();

const DishCardSkeleton: React.FC = () => (
  <View style={styles.dishCard}>
    <View style={styles.dishTopRow}>
      <SkeletonLoader width={62} height={62} borderRadius={10} style={styles.skeletonBg} />
      <View style={[styles.dishDetailsCol, { gap: 6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <SkeletonLoader width={12} height={12} borderRadius={2} style={styles.skeletonBg} />
          <SkeletonLoader width="60%" height={15} borderRadius={4} style={styles.skeletonBg} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <SkeletonLoader width={55} height={14} borderRadius={4} style={styles.skeletonBg} />
          <SkeletonLoader width={35} height={14} borderRadius={4} style={styles.skeletonBg} />
          <SkeletonLoader width={45} height={14} borderRadius={4} style={styles.skeletonBg} />
        </View>
        <SkeletonLoader width="80%" height={11} borderRadius={4} style={[styles.skeletonBg, { marginTop: 2 }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <SkeletonLoader width={26} height={26} borderRadius={6} style={styles.skeletonBg} />
        <SkeletonLoader width={26} height={26} borderRadius={6} style={styles.skeletonBg} />
      </View>
    </View>
    <View style={styles.dishCardBottomRow}>
      <SkeletonLoader width={65} height={18} borderRadius={4} style={styles.skeletonBg} />
      <SkeletonLoader width={130} height={22} borderRadius={6} style={styles.skeletonBg} />
      <SkeletonLoader width={45} height={20} borderRadius={10} style={styles.skeletonBg} />
    </View>
  </View>
);

const CategoryStripSkeleton: React.FC = () => (
  <View style={styles.categoryStripWrapper}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStripContent}>
      <SkeletonLoader width={65} height={28} borderRadius={20} style={styles.skeletonBg} />
      <SkeletonLoader width={85} height={28} borderRadius={20} style={styles.skeletonBg} />
      <SkeletonLoader width={95} height={28} borderRadius={20} style={styles.skeletonBg} />
      <SkeletonLoader width={75} height={28} borderRadius={20} style={styles.skeletonBg} />
      <SkeletonLoader width={90} height={28} borderRadius={20} style={styles.skeletonBg} />
    </ScrollView>
  </View>
);

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
  itemDescription?: string;
  isSpicy?: boolean;
  preparationTimeMinutes?: number;
  variants?: ItemVariantItem[];
  modifiers?: ItemModifierItem[];
}

interface MenuCatalogScreenProps {
  onClose?: () => void;
}

export const MenuCatalogScreen: React.FC<MenuCatalogScreenProps> = ({ onClose }) => {
  const { activeRestaurant } = useAuthStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitMaster[]>([]);
  const [items, setItems] = useState<ExtendedMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom Gilded Alert State
  const [alertConfig, setAlertConfig] = useState<GildedAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'danger' | 'warning' | 'info' = 'success',
    confirmText = 'OK',
    cancelText?: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    });
  };

  // Filters & Search
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outofstock'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');

  // Subscription State
  const [hasActiveSub, setHasActiveSub] = useState<boolean>(true);
  const [checkingSub, setCheckingSub] = useState<boolean>(true);

  // Modal Visibility State
  const [addCatModalVisible, setAddCatModalVisible] = useState(false);
  const [editCatModalVisible, setEditCatModalVisible] = useState(false);
  const [addUnitModalVisible, setAddUnitModalVisible] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [editItemModalVisible, setEditItemModalVisible] = useState(false);
  const [variantsModalVisible, setVariantsModalVisible] = useState(false);
  const [imageSourceModalVisible, setImageSourceModalVisible] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'variants' | 'modifiers'>('variants');
  const [creating, setCreating] = useState(false);

  // Searchable Unit & Category Dropdowns
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);

  // Form State for Items & Categories
  const [imageTarget, setImageTarget] = useState<'item' | 'category'>('item');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnitName, setItemUnitName] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [catImageUrl, setCatImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemIsSpicy, setItemIsSpicy] = useState(false);
  const [itemPrepTime, setItemPrepTime] = useState('15');
  const [itemCatId, setItemCatId] = useState<number>(0);

  // Active Item / Category Selected for Editing
  const [activeItem, setActiveItem] = useState<ExtendedMenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  // Category Form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catStationId, setCatStationId] = useState<number | null>(null);
  const [itemStationId, setItemStationId] = useState<number | null>(null);

  const { stations, fetchStations } = useKitchenStationStore();

  // Unit Form
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');

  // Variants & Modifiers Form
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [modifierGroup, setModifierGroup] = useState('');
  const [modifierName, setModifierName] = useState('');
  const [modifierPrice, setModifierPrice] = useState('');

  const restId = activeRestaurant?.restaurantId || 0;

  useEffect(() => {
    verifySubscriptionAndLoadData();
  }, [restId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCatId, stockFilter, searchQuery, itemsPerPage]);

  const verifySubscriptionAndLoadData = async () => {
    try {
      setCheckingSub(true);
      setHasActiveSub(true);
      await loadCatalogData();
    } catch {
      setHasActiveSub(true);
      await loadCatalogData();
    } finally {
      setCheckingSub(false);
    }
  };

  const loadCatalogData = async () => {
    try {
      setLoading(true);
      if (restId > 0) {
        fetchStations(restId);
      }
      const [cats, unitList, rawMenuItems] = await Promise.all([
        catalogDataSource.getCategories(restId),
        masterDataDataSource.getUnits(),
        catalogDataSource.getMenuItems(restId),
      ]);

      const safeCategories = Array.isArray(cats) ? cats : [];
      const safeMenuItems = Array.isArray(rawMenuItems) ? rawMenuItems : [];

      const enhancedItems: ExtendedMenuItem[] = await Promise.all(
        safeMenuItems.map(async (it: any) => {
          let formattedVariants: ItemVariantItem[] = [];
          let formattedModifiers: ItemModifierItem[] = [];

          const itemId = Number(it.id || it.Id || 0);

          try {
            const [varList, modGroups] = await Promise.all([
              catalogDataSource.getItemVariants(itemId),
              catalogDataSource.getItemModifierGroups(itemId),
            ]);

            formattedVariants = (varList || []).map((v: any) => ({
              id: v.id || v.Id,
              name: v.variantName || v.VariantName || '',
              price: v.additionalPrice ?? v.AdditionalPrice ?? 0,
            }));

            formattedModifiers = (modGroups || []).flatMap((g: any) =>
              (g.modifiers || g.Modifiers || []).map((m: any) => ({
                id: m.id || m.Id,
                groupName: g.groupName || g.GroupName || '',
                modifierName: m.modifierName || m.ModifierName || '',
                price: m.extraPrice ?? m.ExtraPrice ?? 0,
              }))
            );
          } catch {
            // Fallback gracefully
          }

          const catId = Number(it.categoryId || it.CategoryId || 0);
          const catObj = safeCategories.find((c: Category) => Number(c.id) === catId);

          return {
            ...it,
            id: itemId,
            itemName: it.itemName || it.ItemName || '',
            itemDescription: it.itemDescription || it.ItemDescription || it.description || '',
            categoryId: catId,
            categoryName: catObj?.categoryName || it.categoryName || '',
            price: Number(it.price ?? it.Price ?? 0),
            quantity: Number(it.quantity ?? (it as any).Quantity ?? 1),
            portionDisplay: it.portionDisplay || (it as any).PortionDisplay || (it.unitName ? `${it.quantity && it.quantity > 0 ? it.quantity : 1} ${it.unitName}` : undefined),
            unitId: it.unitId ? Number(it.unitId) : undefined,
            unitName: it.unitName || '',
            isVeg: it.isVeg !== undefined ? !!it.isVeg : true,
            isSpicy: !!it.isSpicy,
            isAvailable: it.isAvailable !== undefined ? !!it.isAvailable : (it.isActive !== undefined ? !!it.isActive : true),
            preparationTimeMinutes: it.preparationTimeMinutes || 15,
            variants: formattedVariants,
            modifiers: formattedModifiers,
          };
        })
      );

      setCategories(safeCategories);
      setUnits(Array.isArray(unitList) ? unitList : []);
      setItems(enhancedItems);
    } catch (err) {
      console.warn('❌ [UI ERROR] Failed to load menu catalog', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = (target: 'item' | 'category' = 'item') => {
    setImageTarget(target);
    setImageSourceModalVisible(true);
  };

  const handleLaunchCamera = async () => {
    try {
      setUploadingImage(true);
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('Permission Denied', 'Camera access permission is required to capture photos.', 'warning');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uploadRes = await catalogDataSource.uploadImage({
          uri: asset.uri,
          name: asset.fileName || `${imageTarget}_photo.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });

        const finalUrl = (uploadRes.success && uploadRes.imageUrl) ? uploadRes.imageUrl : asset.uri;
        if (imageTarget === 'category') {
          setCatImageUrl(finalUrl);
        } else {
          setItemImageUrl(finalUrl);
        }
      }
    } catch (err: any) {
      showAlert('Camera Error', err?.message || 'Could not launch camera', 'danger');
    } finally {
      setUploadingImage(false);
      setImageSourceModalVisible(false);
    }
  };

  const handleLaunchGallery = async () => {
    try {
      setUploadingImage(true);
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('Permission Denied', 'Photo library permission is required to choose photos.', 'warning');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uploadRes = await catalogDataSource.uploadImage({
          uri: asset.uri,
          name: asset.fileName || `${imageTarget}_gallery.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });

        const finalUrl = (uploadRes.success && uploadRes.imageUrl) ? uploadRes.imageUrl : asset.uri;
        if (imageTarget === 'category') {
          setCatImageUrl(finalUrl);
        } else {
          setItemImageUrl(finalUrl);
        }
      }
    } catch (err: any) {
      showAlert('Gallery Error', err?.message || 'Could not access photo gallery', 'danger');
    } finally {
      setUploadingImage(false);
      setImageSourceModalVisible(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) {
      showAlert('Required Field', 'Please enter Category Name.', 'warning');
      return;
    }

    try {
      setCreating(true);
      const res = await catalogDataSource.createCategory(catName.trim(), catDesc.trim(), restId, catImageUrl.trim(), catStationId || undefined);
      if (res.success) {
        showAlert('Category Created', `Category "${catName}" created successfully.`, 'success', 'OK', undefined, () => {
          setCatName('');
          setCatDesc('');
          setCatImageUrl('');
          setCatStationId(null);
          setAddCatModalVisible(false);
          loadCatalogData();
        });
      } else {
        showAlert('Category Restricted', res.message || 'Active subscription account is required.', 'danger');
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not create category', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const handleEditCategory = async () => {
    if (!activeCategory || !catName.trim()) return;
    try {
      setCreating(true);
      const res = await catalogDataSource.updateCategory(activeCategory.id, catName.trim(), catDesc.trim(), restId, catImageUrl.trim(), catStationId || undefined);
      if (res.success) {
        showAlert('Category Updated', `Category updated successfully.`, 'success', 'OK', undefined, () => {
          setEditCatModalVisible(false);
          loadCatalogData();
        });
      } else {
        showAlert('Update Failed', res.message || 'Could not update category.', 'danger');
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not update category', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    showAlert(
      'Delete Category',
      `Are you sure you want to remove category "${cat.categoryName}"?`,
      'danger',
      'DELETE',
      'CANCEL',
      async () => {
        await catalogDataSource.deleteCategory(cat.id, restId);
        await loadCatalogData();
      }
    );
  };

  const handleCreateUnit = async () => {
    const trimmedName = newUnitName.trim();
    const trimmedDesc = newUnitDesc.trim();

    if (!trimmedName) {
      showAlert('Required Field', 'Please enter Unit Name (e.g. Slice, Portion, Pitcher).', 'warning');
      return;
    }

    try {
      setCreating(true);
      const res = await masterDataDataSource.createUnit(trimmedName, trimmedDesc);
      if (res.success) {
        // 1. Immediately update UI state optimistically
        const optimisticUnit: UnitMaster = {
          id: Date.now(),
          unitName: trimmedName,
          shortName: trimmedName,
        };
        setUnits((prev) => [
          ...prev.filter((u) => u.unitName.toLowerCase() !== trimmedName.toLowerCase()),
          optimisticUnit,
        ]);
        setItemUnitName(trimmedName);
        setNewUnitName('');
        setNewUnitDesc('');
        setUnitSearchQuery('');
        setAddUnitModalVisible(false);
        setUnitDropdownOpen(false);

        // 2. Fetch authoritative unit list from backend
        try {
          const refreshedUnits = await masterDataDataSource.getUnits();
          if (Array.isArray(refreshedUnits) && refreshedUnits.length > 0) {
            setUnits(refreshedUnits);
          }
        } catch {}

        showAlert('Unit Created', `Serving unit "${trimmedName}" has been created and selected!`, 'success');
      } else {
        showAlert('Unit Creation Failed', res.message || 'Could not create unit.', 'danger');
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not create unit', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateItem = async () => {
    if (!itemName.trim() || !itemPrice.trim()) {
      showAlert('Required Fields', 'Please enter Item Name and Price.', 'warning');
      return;
    }

    const targetCatId = itemCatId > 0 ? itemCatId : (categories.length > 0 ? categories[0].id : 1);
    const selectedUnit = units.find((u) => u.unitName.toLowerCase() === itemUnitName.trim().toLowerCase());

    try {
      setCreating(true);
      const res = await catalogDataSource.createMenuItem({
        restaurantId: restId,
        itemName: itemName.trim(),
        itemDescription: itemDesc.trim(),
        price: parseFloat(itemPrice) || 0,
        quantity: parseFloat(itemQuantity) || 1,
        unitId: selectedUnit?.id,
        isVeg: itemIsVeg,
        isSpicy: itemIsSpicy,
        preparationTimeMinutes: parseInt(itemPrepTime) || 15,
        categoryId: targetCatId,
        imageUrl: itemImageUrl.trim(),
        kitchenStationId: itemStationId || undefined,
      });

      if (res.success) {
        showAlert('Menu Item Added', `Menu item "${itemName}" added successfully.`, 'success', 'OK', undefined, () => {
          setItemName('');
          setItemDesc('');
          setItemPrice('');
          setItemQuantity('1');
          setItemUnitName('');
          setItemImageUrl('');
          setItemStationId(null);
          setUnitDropdownOpen(false);
          setCatDropdownOpen(false);
          setAddItemModalVisible(false);
          loadCatalogData();
        });
      } else {
        showAlert('Item Restricted', res.message || 'Active subscription account is required.', 'danger');
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not add item', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const openEditItemModal = (item: ExtendedMenuItem) => {
    setActiveItem(item);
    setItemName(item.itemName);
    setItemDesc(item.itemDescription || '');
    setItemPrice(item.price ? item.price.toString() : '0');
    setItemQuantity((item.quantity && item.quantity > 0 ? item.quantity : 1).toString());
    setItemUnitName(item.unitName || '');
    setItemImageUrl(item.imageUrl || '');
    setItemIsVeg(!!item.isVeg);
    setItemIsSpicy(!!item.isSpicy);
    setItemPrepTime((item.preparationTimeMinutes || 15).toString());
    setItemCatId(item.categoryId || 0);
    setItemStationId(item.kitchenStationId || null);
    setUnitDropdownOpen(false);
    setCatDropdownOpen(false);
    setUnitSearchQuery('');
    setEditItemModalVisible(true);
  };

  const handleUpdateItem = async () => {
    if (!activeItem) return;
    if (!itemName.trim() || !itemPrice.trim()) {
      showAlert('Required Fields', 'Please enter Item Name and Price.', 'warning');
      return;
    }

    const selectedUnit = units.find((u) => u.unitName.toLowerCase() === itemUnitName.trim().toLowerCase());

    try {
      setCreating(true);
      await catalogDataSource.updateMenuItem(activeItem.id, {
        restaurantId: restId,
        itemName: itemName.trim(),
        itemDescription: itemDesc.trim(),
        price: parseFloat(itemPrice) || 0,
        quantity: parseFloat(itemQuantity) || 1,
        unitId: selectedUnit?.id || activeItem.unitId,
        isVeg: itemIsVeg,
        isSpicy: itemIsSpicy,
        preparationTimeMinutes: parseInt(itemPrepTime) || 15,
        categoryId: itemCatId > 0 ? itemCatId : (activeItem.categoryId ?? 1),
        imageUrl: itemImageUrl.trim(),
        kitchenStationId: itemStationId || undefined,
      });

      showAlert('Item Updated', `Item "${itemName}" updated successfully.`, 'success', 'OK', undefined, () => {
        setEditItemModalVisible(false);
        loadCatalogData();
      });
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not update item', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteItem = (item: ExtendedMenuItem) => {
    showAlert(
      'Delete Dish',
      `Are you sure you want to remove "${item.itemName}" from menu catalog?`,
      'danger',
      'DELETE',
      'CANCEL',
      async () => {
        await catalogDataSource.deleteMenuItem(item.id, restId);
        await loadCatalogData();
      }
    );
  };

  const toggleAvailability = async (itemId: number, currentStatus: boolean) => {
    if (!hasActiveSub) {
      showAlert('Subscription Required', 'Active subscription is required to update menu item availability.', 'warning');
      return;
    }

    const safeItemsList = Array.isArray(items) ? items : [];
    const updatedItems = safeItemsList.map((i) => (i.id === itemId ? { ...i, isAvailable: !currentStatus } : i));
    setItems(updatedItems);
    try {
      await catalogDataSource.updateItemStatus(itemId, !currentStatus);
    } catch {
      showAlert('Status Updated', 'Item availability toggled.', 'info');
    }
  };

  // Add Variant to active item
  const handleAddVariant = async () => {
    if (!variantName.trim() || !variantPrice.trim() || !activeItem) return;
    const addPrice = parseFloat(variantPrice) || 0;
    const newVariant: ItemVariantItem = {
      id: Date.now(),
      name: variantName.trim(),
      price: addPrice,
    };
    const updatedVariants = [...(activeItem.variants || []), newVariant];
    setActiveItem({ ...activeItem, variants: updatedVariants });
    setItems(items.map((it) => (it.id === activeItem.id ? { ...it, variants: updatedVariants } : it)));
    setVariantName('');
    setVariantPrice('');

    await catalogDataSource.addItemVariant(activeItem.id, newVariant.name, addPrice);
  };

  // Delete Variant from active item
  const handleDeleteVariant = async (variantId: number) => {
    if (!activeItem) return;
    const updatedVariants = (activeItem.variants || []).filter((v) => v.id !== variantId);
    setActiveItem({ ...activeItem, variants: updatedVariants });
    setItems(items.map((it) => (it.id === activeItem.id ? { ...it, variants: updatedVariants } : it)));
    await catalogDataSource.deleteItemVariant(variantId);
  };

  // Add Modifier to active item
  const handleAddModifier = async () => {
    if (!modifierName.trim() || !modifierPrice.trim() || !activeItem) return;
    const addPrice = parseFloat(modifierPrice) || 0;
    const group = modifierGroup.trim() || 'Add-ons';
    const newModifier: ItemModifierItem = {
      id: Date.now(),
      groupName: group,
      modifierName: modifierName.trim(),
      price: addPrice,
    };
    const updatedModifiers = [...(activeItem.modifiers || []), newModifier];
    setActiveItem({ ...activeItem, modifiers: updatedModifiers });
    setItems(items.map((it) => (it.id === activeItem.id ? { ...it, modifiers: updatedModifiers } : it)));
    setModifierName('');
    setModifierPrice('');

    const groupRes = await catalogDataSource.addItemModifierGroup(activeItem.id, group);
    if (groupRes.id) {
      await catalogDataSource.addItemModifier(groupRes.id, newModifier.modifierName, addPrice);
    }
  };

  // Filter Logic
  const safeItems = Array.isArray(items) ? items : [];
  const filteredItems = safeItems.filter((i) => {
    const matchesCat = selectedCatId ? Number(i.categoryId) === Number(selectedCatId) : true;
    const matchesStock = stockFilter === 'all' ? true : stockFilter === 'instock' ? !!i.isAvailable : !i.isAvailable;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query
      ? true
      : (
          (i.itemName && i.itemName.toLowerCase().includes(query)) ||
          (i.itemDescription && i.itemDescription.toLowerCase().includes(query)) ||
          (i.unitName && i.unitName.toLowerCase().includes(query)) ||
          (i.categoryName && i.categoryName.toLowerCase().includes(query)) ||
          (i.price && i.price.toString().includes(query))
        );
    return matchesCat && matchesStock && matchesQuery;
  });

  // Pagination Computations
  const totalItems = filteredItems.length;
  const isAll = itemsPerPage === 'all';
  const effectiveItemsPerPage = isAll ? Math.max(1, totalItems) : Number(itemsPerPage);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / effectiveItemsPerPage));
  const startIndex = isAll ? 0 : (currentPage - 1) * effectiveItemsPerPage;
  const endIndex = isAll ? totalItems : Math.min(startIndex + effectiveItemsPerPage, totalItems);
  const paginatedItems = isAll ? filteredItems : filteredItems.slice(startIndex, endIndex);

  const safeCategories = Array.isArray(categories) ? categories : [];
  const filteredUnits = units.filter((u) => u.unitName.toLowerCase().includes(unitSearchQuery.toLowerCase()));
  const inStockCount = safeItems.filter((x) => x.isAvailable).length;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent={false} />
      <View style={styles.container}>
      {/* TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeftRow}>
          <Image
            source={
              activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                ? { uri: activeRestaurant.logoUrl.trim() }
                : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                ? { uri: (activeRestaurant as any).logo.trim() }
                : require('../../../../assets/menza-logo.png')
            }
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerOutletTitle} numberOfLines={1}>
              {activeRestaurant?.restaurantName || 'Menza Bistro'}
            </Text>
            <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
              Menu Catalog • {safeItems.length} Dishes
            </Text>
          </View>
        </View>

        {/* Top Right Quick Actions */}
        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={styles.addDishHeaderBtn}
            activeOpacity={0.88}
            onPress={() => {
              setItemName('');
              setItemDesc('');
              setItemPrice('');
              setItemUnitName('');
              setItemImageUrl('');
              setUnitDropdownOpen(false);
              setCatDropdownOpen(false);
              setAddItemModalVisible(true);
            }}
          >
            <LinearGradient
              colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addDishHeaderBtnGradient}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
              <Text style={styles.addDishHeaderBtnText}>+ Dish</Text>
            </LinearGradient>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeCircleBtn} activeOpacity={0.7}>
              <X size={16} color="#8C7A6B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subscription Guard Loading */}
      {checkingSub ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchFilterContainer}>
            <SkeletonLoader width="100%" height={38} borderRadius={12} style={styles.skeletonBg} />
          </View>
          <CategoryStripSkeleton />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
            <DishCardSkeleton />
            <DishCardSkeleton />
            <DishCardSkeleton />
            <DishCardSkeleton />
          </ScrollView>
        </View>
      ) : !hasActiveSub ? (
        /* LOCKED SUBSCRIPTION VIEW */
        <View style={styles.lockedContainer}>
          <View style={styles.lockedCard}>
            <View style={styles.lockedIconCircle}>
              <Lock size={32} color="#DC2626" />
            </View>
            <Text style={styles.lockedTitle}>Subscription Required 🔒</Text>
            <Text style={styles.lockedMessage}>
              Active subscription account is required for restaurant "{activeRestaurant?.restaurantName || 'this store'}" to perform menu catalog operations.
            </Text>
            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.lockedCloseBtn} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.lockedCloseBtnGradient}
                >
                  <Text style={styles.lockedCloseText}>Back to Dashboard</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        /* ACTIVE CATALOG INTERFACE */
        <View style={{ flex: 1 }}>
          {/* QUICK OPERATIONAL SUMMARY STRIP */}
          <View style={styles.catalogStatsStrip}>
            <View style={styles.catalogStatCard}>
              <Text style={styles.catalogStatValue}>{safeItems.length}</Text>
              <Text style={styles.catalogStatLabel}>Total Items</Text>
            </View>
            <View style={styles.catalogStatCard}>
              <Text style={styles.catalogStatValue}>{safeCategories.length}</Text>
              <Text style={styles.catalogStatLabel}>Categories</Text>
            </View>
            <View style={styles.catalogStatCard}>
              <Text style={[styles.catalogStatValue, { color: '#17845A' }]}>{inStockCount}</Text>
              <Text style={styles.catalogStatLabel}>In Stock</Text>
            </View>
          </View>
          {/* SEARCH & FILTER COMPACT BAR */}
          <View style={styles.searchFilterContainer}>
            <View style={styles.searchFieldBox}>
              <Search size={15} color="#DE8626" />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search dish, category, portion, or price..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color="#8C7A6B" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Filter Stock Switcher Segment */}
            <View style={styles.stockSegment}>
              <TouchableOpacity
                style={[styles.stockSegmentBtn, stockFilter === 'all' && styles.stockSegmentBtnActive]}
                onPress={() => setStockFilter('all')}
                activeOpacity={0.8}
              >
                <Text style={[styles.stockSegmentText, stockFilter === 'all' && styles.stockSegmentTextActive]}>
                  All ({safeItems.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stockSegmentBtn, stockFilter === 'instock' && styles.stockSegmentBtnActive]}
                onPress={() => setStockFilter('instock')}
                activeOpacity={0.8}
              >
                <Text style={[styles.stockSegmentText, stockFilter === 'instock' && styles.stockSegmentTextActive]}>
                  🟢 {inStockCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stockSegmentBtn, stockFilter === 'outofstock' && styles.stockSegmentBtnActive]}
                onPress={() => setStockFilter('outofstock')}
                activeOpacity={0.8}
              >
                <Text style={[styles.stockSegmentText, stockFilter === 'outofstock' && styles.stockSegmentTextActive]}>
                  🔴 {safeItems.length - inStockCount}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* HORIZONTAL CATEGORY STRIP */}
          <View style={styles.categoryStripWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryStripContent}
            >
              {/* All Categories Chip */}
              <TouchableOpacity
                style={[styles.catChip, selectedCatId === null && styles.catChipActive]}
                onPress={() => setSelectedCatId(null)}
                activeOpacity={0.8}
              >
                <Grid size={12} color={selectedCatId === null ? '#D96B14' : '#7C6F62'} />
                <Text style={[styles.catChipText, selectedCatId === null && styles.catChipTextActive]}>
                  All ({safeItems.length})
                </Text>
              </TouchableOpacity>

              {/* Dynamic Categories */}
              {safeCategories.map((cat) => {
                const count = safeItems.filter((i) => Number(i.categoryId) === Number(cat.id)).length;
                const isSelected = selectedCatId === cat.id;
                return (
                  <View key={`cat-${cat.id}`} style={styles.catChipContainer}>
                    <TouchableOpacity
                      style={[styles.catChip, isSelected && styles.catChipActive]}
                      onPress={() => setSelectedCatId(cat.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                        {cat.categoryName}
                      </Text>
                      <View style={[styles.catCountBadge, isSelected && styles.catCountBadgeActive]}>
                        <Text style={[styles.catCountText, isSelected && styles.catCountTextActive]}>{count}</Text>
                      </View>
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={styles.catActionPill}>
                        <TouchableOpacity
                          style={styles.catActionMiniBtn}
                          onPress={() => {
                            setActiveCategory(cat);
                            setCatName(cat.categoryName);
                            setCatDesc(cat.description || '');
                            setEditCatModalVisible(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Edit2 size={11} color="#DE8626" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.catActionMiniBtn}
                          onPress={() => handleDeleteCategory(cat)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={11} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Add Category Pill Button */}
              <TouchableOpacity
                style={styles.addCatPillBtn}
                onPress={() => setAddCatModalVisible(true)}
                activeOpacity={0.8}
              >
                <FolderPlus size={13} color="#DE8626" />
                <Text style={styles.addCatPillText}>+ Category</Text>
              </TouchableOpacity>

              {/* Create Unit Pill Button */}
              <TouchableOpacity
                style={styles.addUnitPillBtn}
                onPress={() => setAddUnitModalVisible(true)}
                activeOpacity={0.8}
              >
                <Tag size={13} color="#7C6F62" />
                <Text style={styles.addUnitPillText}>+ Unit</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* MAIN MENU DISHES LIST */}
          {loading ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
              <DishCardSkeleton />
              <DishCardSkeleton />
              <DishCardSkeleton />
              <DishCardSkeleton />
            </ScrollView>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <UtensilsCrossed size={32} color="#DE8626" />
              </View>
              <Text style={styles.emptyTitle}>No Menu Items Found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || selectedCatId || stockFilter !== 'all'
                  ? 'Try adjusting your search terms or active category filter.'
                  : 'Start setting up your restaurant menu by adding your first dish.'}
              </Text>
              {searchQuery || selectedCatId || stockFilter !== 'all' ? (
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCatId(null);
                    setStockFilter('all');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetFilterBtnText}>Reset All Filters</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.addItemEmptyBtnWrapper}
                  activeOpacity={0.88}
                  onPress={() => {
                    setItemName('');
                    setItemDesc('');
                    setItemPrice('');
                    setItemUnitName('');
                    setItemImageUrl('');
                    setAddItemModalVisible(true);
                  }}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addItemEmptyBtnGradient}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.addItemEmptyBtnText}>Add First Dish</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={paginatedItems}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item }) => {
                const variantsCount = item.variants?.length || 0;
                const modifiersCount = item.modifiers?.length || 0;

                return (
                  <View style={styles.dishCard}>
                    {/* Top Row: Thumbnail + Details + Controls */}
                    <View style={styles.dishTopRow}>
                      {/* Dish Thumbnail */}
                      {!!item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.dishThumbnail} />
                      ) : (
                        <View style={styles.dishThumbnailPlaceholder}>
                          <UtensilsCrossed size={20} color="#DE8626" />
                        </View>
                      )}

                      {/* Main Details */}
                      <View style={styles.dishDetailsCol}>
                        {/* Title Row with Veg Indicator */}
                        <View style={styles.dishTitleRow}>
                          <View style={[styles.vegBadge, { borderColor: item.isVeg ? '#17845A' : '#DC2626' }]}>
                            <View style={[styles.vegInnerDot, { backgroundColor: item.isVeg ? '#17845A' : '#DC2626' }]} />
                          </View>
                          <Text style={styles.dishName} numberOfLines={1}>
                            {item.itemName}
                          </Text>

                          {item.isSpicy && (
                            <View style={styles.spicyBadge}>
                              <Flame size={10} color="#DC2626" />
                            </View>
                          )}
                        </View>

                        {/* Meta Tags Row */}
                        <View style={styles.dishMetaRow}>
                          {!!item.categoryName && (
                            <View style={styles.catBadge}>
                              <Text style={styles.catBadgeText}>{item.categoryName}</Text>
                            </View>
                          )}
                          <View style={styles.prepBadge}>
                            <Clock size={10} color="#8C7A6B" />
                            <Text style={styles.prepText}>{item.preparationTimeMinutes || 15}m</Text>
                          </View>
                          {!!item.unitName && (
                            <View style={styles.unitBadge}>
                              <PackageCheck size={10} color="#7C6F62" />
                              <Text style={styles.unitBadgeText}>{item.unitName}</Text>
                            </View>
                          )}
                        </View>

                        {/* Description */}
                        {!!item.itemDescription && (
                          <Text style={styles.dishDesc} numberOfLines={1}>
                            {item.itemDescription}
                          </Text>
                        )}
                      </View>

                      {/* Right Action Icons (Edit / Delete) */}
                      <View style={styles.dishTopRightIcons}>
                        <TouchableOpacity style={styles.iconMiniBtn} onPress={() => openEditItemModal(item)} activeOpacity={0.7}>
                          <Edit2 size={13} color="#DE8626" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconMiniBtn} onPress={() => handleDeleteItem(item)} activeOpacity={0.7}>
                          <Trash2 size={13} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Portions & Add-ons Chips Preview (if configured) */}
                    {(variantsCount > 0 || modifiersCount > 0) && (
                      <View style={styles.chipsSection}>
                        {variantsCount > 0 && (
                          <View style={styles.chipsRow}>
                            <Text style={styles.chipSectionLabel}>Sizes:</Text>
                            {item.variants!.slice(0, 3).map((v) => (
                              <View key={`v-${v.id}`} style={styles.variantTag}>
                                <Text style={styles.variantTagText}>
                                  {v.name} • ₹{v.price}
                                </Text>
                              </View>
                            ))}
                            {variantsCount > 3 && (
                              <Text style={styles.chipMoreText}>+{variantsCount - 3} more</Text>
                            )}
                          </View>
                        )}

                        {modifiersCount > 0 && (
                          <View style={styles.chipsRow}>
                            <Text style={styles.chipSectionLabel}>Add-ons:</Text>
                            {item.modifiers!.slice(0, 3).map((m) => (
                              <View key={`m-${m.id}`} style={styles.modifierTag}>
                                <Text style={styles.modifierTagText}>
                                  +{m.modifierName} (₹{m.price})
                                </Text>
                              </View>
                            ))}
                            {modifiersCount > 3 && (
                              <Text style={styles.chipMoreText}>+{modifiersCount - 3} more</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Bottom Bar: Price, Portions Manager CTA, Stock Toggle */}
                    <View style={styles.dishCardBottomRow}>
                      {/* Price & Portion Size */}
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceCurrency}>₹</Text>
                        <Text style={styles.priceValue}>{item.price.toLocaleString()}</Text>
                        {Boolean(item.portionDisplay || item.unitName) && (
                          <View style={styles.portionPill}>
                            <Text style={styles.portionPillText}>
                              {item.portionDisplay || `${item.quantity && item.quantity > 0 ? item.quantity : 1} ${item.unitName}`}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Portions & Add-ons CTA */}
                      <TouchableOpacity
                        style={styles.portionsManageBtn}
                        onPress={() => {
                          setActiveItem(item);
                          setVariantsModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Sliders size={12} color="#DE8626" />
                        <Text style={styles.portionsManageBtnText}>
                          Portions & Add-ons ({variantsCount + modifiersCount})
                        </Text>
                      </TouchableOpacity>

                      {/* Stock Switch */}
                      <View style={styles.stockSwitchWrap}>
                        <Text style={[styles.stockStatusLabel, { color: item.isAvailable ? '#17845A' : '#DC2626' }]}>
                          {item.isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                        </Text>
                        <Switch
                          value={!!item.isAvailable}
                          onValueChange={() => toggleAvailability(item.id, !!item.isAvailable)}
                          trackColor={{ false: 'rgba(220, 38, 38, 0.2)', true: '#DE8626' }}
                          thumbColor={item.isAvailable ? '#FFFFFF' : '#9CA3AF'}
                        />
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* COMPACT PAGINATION TOOLBAR */}
          {totalItems > 0 && (
            <View style={styles.paginationToolbar}>
              <Text style={styles.paginationSummary}>
                Showing <Text style={{ color: '#DE8626', fontWeight: 'bold' }}>{totalItems}</Text> dishes
              </Text>

              <View style={styles.pageSizeRow}>
                <Text style={styles.pageSizeLabel}>Rows:</Text>
                {([10, 25, 50, 'all'] as const).map((size) => (
                  <TouchableOpacity
                    key={`size-${size}`}
                    style={[styles.pageSizeBtn, itemsPerPage === size && styles.pageSizeBtnActive]}
                    onPress={() => setItemsPerPage(size)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pageSizeBtnText, itemsPerPage === size && styles.pageSizeBtnTextActive]}>
                      {size === 'all' ? 'All' : size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!isAll && totalPages > 1 && (
                <View style={styles.pageControls}>
                  <TouchableOpacity
                    style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                    disabled={currentPage === 1}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pageBtnText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageCountText}>{currentPage}/{totalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                    disabled={currentPage === totalPages}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pageBtnText}>›</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ===================== MODALS ===================== */}

      {/* ADD / EDIT CATEGORY MODAL */}
      <Modal visible={addCatModalVisible || editCatModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FolderOpen size={18} color="#DE8626" />
                <Text style={styles.modalTitle}>{editCatModalVisible ? 'Edit Category' : 'New Category'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAddCatModalVisible(false);
                  setEditCatModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>CATEGORY NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Starters, Main Course, Beverages"
              placeholderTextColor="#9CA3AF"
              value={catName}
              onChangeText={setCatName}
            />

            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Freshly prepared appetizers & snacks"
              placeholderTextColor="#9CA3AF"
              value={catDesc}
              onChangeText={setCatDesc}
            />

            {/* PREPARATION STATION SELECTOR */}
            {stations.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>ASSIGNED KITCHEN STATION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.stationSelectChip, !catStationId && styles.stationSelectChipActive]}
                    onPress={() => setCatStationId(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stationSelectChipText, !catStationId && styles.stationSelectChipTextActive]}>
                      Default (Main Kitchen)
                    </Text>
                  </TouchableOpacity>
                  {stations.map((st) => (
                    <TouchableOpacity
                      key={`cat-st-${st.id}`}
                      style={[
                        styles.stationSelectChip,
                        catStationId === st.id && { backgroundColor: st.badgeColor || '#DE8626', borderColor: st.badgeColor || '#DE8626' },
                      ]}
                      onPress={() => setCatStationId(st.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.stationSelectChipText,
                          catStationId === st.id && { color: '#FFFFFF', fontWeight: '800' },
                        ]}
                      >
                        {st.stationName} ({st.stationCode})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.inputLabel}>BANNER IMAGE (OPTIONAL)</Text>
            {catImageUrl ? (
              <View style={styles.uploadedImageCard}>
                <Image source={{ uri: catImageUrl }} style={styles.uploadedImagePreview} />
                <View style={styles.imageActionsRow}>
                  <TouchableOpacity style={styles.changeImgBtn} onPress={() => handleUploadImage('category')} activeOpacity={0.8}>
                    <Camera size={12} color="#FFFFFF" />
                    <Text style={styles.changeImgBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => setCatImageUrl('')} activeOpacity={0.8}>
                    <Trash2 size={12} color="#DC2626" />
                    <Text style={styles.removeImgBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadZoneBox} onPress={() => handleUploadImage('category')} activeOpacity={0.8}>
                <Camera size={20} color="#DE8626" />
                <Text style={styles.uploadZoneTitle}>Upload Category Banner</Text>
                <Text style={styles.uploadZoneSub}>Tap to capture photo or pick from gallery</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.modalSubmitBtn}
              onPress={editCatModalVisible ? handleEditCategory : handleCreateCategory}
              disabled={creating}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalSubmitBtnGradient}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>
                      {editCatModalVisible ? 'UPDATE CATEGORY' : 'SAVE CATEGORY'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CREATE SERVING UNIT MODAL */}
      <Modal visible={addUnitModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color="#DE8626" />
                <Text style={styles.modalTitle}>Create Serving Unit</Text>
              </View>
              <TouchableOpacity onPress={() => setAddUnitModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>UNIT NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Slice, Portion, Pitcher, Bowl, Scoop"
              placeholderTextColor="#9CA3AF"
              value={newUnitName}
              onChangeText={setNewUnitName}
            />

            <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Standard single portion unit measure"
              placeholderTextColor="#9CA3AF"
              value={newUnitDesc}
              onChangeText={setNewUnitDesc}
            />

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.modalSubmitBtn}
              onPress={handleCreateUnit}
              disabled={creating}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalSubmitBtnGradient}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>CREATE UNIT</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADD / EDIT MENU ITEM MODAL */}
      <Modal visible={addItemModalVisible || editItemModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ChefHat size={18} color="#DE8626" />
                <Text style={styles.modalTitle}>{editItemModalVisible ? 'Edit Dish Details' : 'Add New Dish'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAddItemModalVisible(false);
                  setEditItemModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>DISH NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Butter Paneer Masala"
                placeholderTextColor="#9CA3AF"
                value={itemName}
                onChangeText={setItemName}
              />

              {/* DISH IMAGE UPLOAD */}
              <Text style={styles.inputLabel}>DISH PHOTO</Text>
              {itemImageUrl ? (
                <View style={styles.uploadedImageCard}>
                  <Image source={{ uri: itemImageUrl }} style={styles.uploadedImagePreview} />
                  <View style={styles.imageActionsRow}>
                    <TouchableOpacity style={styles.changeImgBtn} onPress={() => handleUploadImage('item')} activeOpacity={0.8}>
                      <Camera size={12} color="#FFFFFF" />
                      <Text style={styles.changeImgBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => setItemImageUrl('')} activeOpacity={0.8}>
                      <Trash2 size={12} color="#DC2626" />
                      <Text style={styles.removeImgBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadZoneBox} onPress={() => handleUploadImage('item')} activeOpacity={0.8}>
                  <Camera size={20} color="#DE8626" />
                  <Text style={styles.uploadZoneTitle}>Upload Dish Photo</Text>
                  <Text style={styles.uploadZoneSub}>Tap to capture or choose from library</Text>
                </TouchableOpacity>
              )}

              {/* CATEGORY SELECTOR */}
              <View style={styles.formRowHeader}>
                <Text style={styles.inputLabel}>CATEGORY</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAddItemModalVisible(false);
                    setEditItemModalVisible(false);
                    setAddCatModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.formActionLink}>+ New Category</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.selectDropdownBtn} onPress={() => setCatDropdownOpen(!catDropdownOpen)} activeOpacity={0.8}>
                <Text style={[styles.selectDropdownText, !itemCatId && { color: '#7C6F62' }]}>
                  {itemCatId ? categories.find((c) => c.id === itemCatId)?.categoryName || 'Select Category' : 'Select Category...'}
                </Text>
                {catDropdownOpen ? <ChevronUp size={16} color="#DE8626" /> : <ChevronDown size={16} color="#8C7A6B" />}
              </TouchableOpacity>

              {catDropdownOpen && (
                <View style={styles.dropdownListBox}>
                  <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={`cat-drop-${c.id}`}
                        style={[styles.dropdownItemRow, itemCatId === c.id && styles.dropdownItemRowActive]}
                        onPress={() => {
                          setItemCatId(c.id);
                          setCatDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownItemText, itemCatId === c.id && styles.dropdownItemTextActive]}>
                          {c.categoryName}
                        </Text>
                        {itemCatId === c.id && <Check size={14} color="#DE8626" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* BASE PRICE, PORTION QTY & PREP TIME */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>BASE PRICE (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 280"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={itemPrice}
                    onChangeText={setItemPrice}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PORTION QTY</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={itemQuantity}
                    onChangeText={setItemQuantity}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PREP (MIN)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 15"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={itemPrepTime}
                    onChangeText={setItemPrepTime}
                  />
                </View>
              </View>

              {/* SERVING UNIT DROPDOWN */}
              <View style={styles.formRowHeader}>
                <Text style={styles.inputLabel}>SERVING UNIT</Text>
                <TouchableOpacity onPress={() => setAddUnitModalVisible(true)} activeOpacity={0.7}>
                  <Text style={styles.formActionLink}>+ New Unit</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.selectDropdownBtn} onPress={() => setUnitDropdownOpen(!unitDropdownOpen)} activeOpacity={0.8}>
                <Text style={[styles.selectDropdownText, !itemUnitName && { color: '#7C6F62' }]}>
                  {itemUnitName ? itemUnitName : 'Select Serving Unit...'}
                </Text>
                {unitDropdownOpen ? <ChevronUp size={16} color="#DE8626" /> : <ChevronDown size={16} color="#8C7A6B" />}
              </TouchableOpacity>

              {unitDropdownOpen && (
                <View style={styles.dropdownListBox}>
                  <View style={styles.dropdownSearchRow}>
                    <Search size={13} color="#8C7A6B" />
                    <TextInput
                      style={styles.dropdownSearchInput}
                      placeholder="Filter units..."
                      placeholderTextColor="#9CA3AF"
                      value={unitSearchQuery}
                      onChangeText={setUnitSearchQuery}
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                    {filteredUnits.map((u) => (
                      <TouchableOpacity
                        key={`unit-opt-${u.id}`}
                        style={[styles.dropdownItemRow, itemUnitName === u.unitName && styles.dropdownItemRowActive]}
                        onPress={() => {
                          setItemUnitName(u.unitName);
                          setUnitDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownItemText, itemUnitName === u.unitName && styles.dropdownItemTextActive]}>
                          {u.unitName}
                        </Text>
                        {itemUnitName === u.unitName && <Check size={14} color="#DE8626" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* DESCRIPTION */}
              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingredients, taste notes, or preparation details"
                placeholderTextColor="#9CA3AF"
                value={itemDesc}
                onChangeText={setItemDesc}
              />

              {/* KITCHEN STATION OVERRIDE */}
              {stations.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>PREPARATION KITCHEN STATION</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.stationSelectChip, !itemStationId && styles.stationSelectChipActive]}
                      onPress={() => setItemStationId(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.stationSelectChipText, !itemStationId && styles.stationSelectChipTextActive]}>
                        Inherit from Category
                      </Text>
                    </TouchableOpacity>
                    {stations.map((st) => (
                      <TouchableOpacity
                        key={`item-st-${st.id}`}
                        style={[
                          styles.stationSelectChip,
                          itemStationId === st.id && { backgroundColor: st.badgeColor || '#DE8626', borderColor: st.badgeColor || '#DE8626' },
                        ]}
                        onPress={() => setItemStationId(st.id)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.stationSelectChipText,
                            itemStationId === st.id && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                        >
                          {st.stationName} ({st.stationCode})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* SWITCHES */}
              <View style={styles.switchBoxRow}>
                <Text style={styles.switchBoxLabel}>{itemIsVeg ? 'Vegetarian 🟩' : 'Non-Vegetarian 🟥'}</Text>
                <Switch value={itemIsVeg} onValueChange={setItemIsVeg} trackColor={{ false: '#FECACA', true: '#17845A' }} thumbColor="#FFFFFF" />
              </View>

              <View style={styles.switchBoxRow}>
                <Text style={styles.switchBoxLabel}>Spicy Dish 🌶️</Text>
                <Switch value={itemIsSpicy} onValueChange={setItemIsSpicy} trackColor={{ false: '#E5E7EB', true: '#DC2626' }} thumbColor="#FFFFFF" />
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.modalSubmitBtn}
                onPress={editItemModalVisible ? handleUpdateItem : handleCreateItem}
                disabled={creating}
              >
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalSubmitBtnGradient}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>
                        {editItemModalVisible ? 'UPDATE DISH' : 'SAVE DISH'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* IMAGE SOURCE MODAL (CAMERA VS GALLERY) */}
      <Modal visible={imageSourceModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: 330, alignSelf: 'center' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Photo Source</Text>
              <TouchableOpacity onPress={() => setImageSourceModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.sourceChoiceBtn} onPress={handleLaunchCamera} activeOpacity={0.8}>
              <View style={styles.sourceIconCircle}>
                <Camera size={18} color="#DE8626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>Take with Camera</Text>
                <Text style={styles.sourceSub}>Capture a live dish photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sourceChoiceBtn} onPress={handleLaunchGallery} activeOpacity={0.8}>
              <View style={[styles.sourceIconCircle, { backgroundColor: '#E4F5EC' }]}>
                <ImageIcon size={18} color="#17845A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>Pick from Gallery</Text>
                <Text style={styles.sourceSub}>Select photo from device storage</Text>
              </View>
            </TouchableOpacity>

            {uploadingImage && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                <ActivityIndicator size="small" color="#DE8626" />
                <Text style={{ color: '#DE8626', fontSize: 12 }}>Uploading image...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* PORTIONS & MODIFIERS MANAGER MODAL */}
      <Modal visible={variantsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Portions & Add-ons</Text>
                <Text style={styles.modalSubHeader}>Dish: {activeItem?.itemName}</Text>
              </View>
              <TouchableOpacity onPress={() => setVariantsModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <X size={16} color="#8C7A6B" />
              </TouchableOpacity>
            </View>

            {/* TAB SELECTOR */}
            <View style={styles.segmentedTabRow}>
              <TouchableOpacity
                style={[styles.segmentedTabBtn, activeModalTab === 'variants' && styles.segmentedTabBtnActive]}
                onPress={() => setActiveModalTab('variants')}
                activeOpacity={0.8}
              >
                <Layers3 size={13} color={activeModalTab === 'variants' ? '#D96B14' : '#6B7280'} />
                <Text style={[styles.segmentedTabText, activeModalTab === 'variants' && styles.segmentedTabTextActive]}>
                  Portion Sizes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentedTabBtn, activeModalTab === 'modifiers' && styles.segmentedTabBtnActive]}
                onPress={() => setActiveModalTab('modifiers')}
                activeOpacity={0.8}
              >
                <Tag size={13} color={activeModalTab === 'modifiers' ? '#D96B14' : '#6B7280'} />
                <Text style={[styles.segmentedTabText, activeModalTab === 'modifiers' && styles.segmentedTabTextActive]}>
                  Add-ons & Modifiers
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {activeModalTab === 'variants' ? (
                <View>
                  <Text style={styles.sectionHeaderLabel}>CONFIGURED PORTION SIZES</Text>

                  {activeItem?.variants && activeItem.variants.length > 0 ? (
                    activeItem.variants.map((v) => (
                      <View key={`var-${v.id}`} style={styles.variantRowCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.goldDot} />
                          <Text style={styles.variantRowName}>{v.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={styles.variantPricePill}>
                            <Text style={styles.variantPricePillText}>₹{v.price}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteVariant(v.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Trash2 size={13} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyItemsNotice}>No portion sizes created for this dish yet.</Text>
                  )}

                  {/* INLINE ADD PORTION FORM */}
                  <View style={styles.addInlineBox}>
                    <Text style={styles.addInlineTitle}>+ Add Portion Size</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Size Name (e.g. Half Portion, Large Bowl, 500ml)"
                      placeholderTextColor="#9CA3AF"
                      value={variantName}
                      onChangeText={setVariantName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Price (₹) (e.g. 140)"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={variantPrice}
                      onChangeText={setVariantPrice}
                    />
                    <TouchableOpacity style={styles.inlineAddBtn} onPress={handleAddVariant} activeOpacity={0.88}>
                      <LinearGradient
                        colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.inlineAddBtnGradient}
                      >
                        <PlusCircle size={15} color="#FFFFFF" />
                        <Text style={styles.inlineAddBtnText}>Save Portion Size</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.sectionHeaderLabel}>CONFIGURED ADD-ONS & TOPPINGS</Text>

                  {activeItem?.modifiers && activeItem.modifiers.length > 0 ? (
                    activeItem.modifiers.map((m) => (
                      <View key={`mod-${m.id}`} style={styles.variantRowCard}>
                        <View>
                          <Text style={styles.variantRowName}>{m.modifierName}</Text>
                          <Text style={styles.modifierSubGroup}>Group: {m.groupName}</Text>
                        </View>
                        <View style={styles.emeraldPricePill}>
                          <Text style={styles.emeraldPricePillText}>+₹{m.price}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyItemsNotice}>No add-ons or toppings configured for this dish yet.</Text>
                  )}

                  {/* INLINE ADD MODIFIER FORM */}
                  <View style={styles.addInlineBox}>
                    <Text style={styles.addInlineTitle}>+ Add Extra Add-on</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Group Name (e.g. Extra Cheese, Dips, Sauces)"
                      placeholderTextColor="#9CA3AF"
                      value={modifierGroup}
                      onChangeText={setModifierGroup}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Option Name (e.g. Mozzarella Crust, Garlic Mayo)"
                      placeholderTextColor="#9CA3AF"
                      value={modifierName}
                      onChangeText={setModifierName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Extra Price (₹) (e.g. 40)"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={modifierPrice}
                      onChangeText={setModifierPrice}
                    />
                    <TouchableOpacity style={styles.inlineAddBtn} onPress={handleAddModifier} activeOpacity={0.88}>
                      <LinearGradient
                        colors={['#17845A', '#0F6B48']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.inlineAddBtnGradient}
                      >
                        <PlusCircle size={15} color="#FFFFFF" />
                        <Text style={[styles.inlineAddBtnText, { color: '#FFFFFF' }]}>Save Extra Add-on</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REUSABLE GILDED ALERT MODAL */}
      <GildedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: Spacing.md,
  },

  /* TOP HEADER (MATCHING HOMEPAGE) */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE4DC',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  headerOutletTitle: {
    color: '#1C1917',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1.5,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addDishHeaderBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addDishHeaderBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  addDishHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },

  /* QUICK STATS STRIP */
  catalogStatsStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  catalogStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  catalogStatValue: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '800',
  },
  catalogStatLabel: {
    color: '#78716C',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },

  /* SEARCH & STOCK FILTER */
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchFieldBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: Spacing.sm + 2,
    height: 38,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 6,
  },
  searchTextInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: 12,
  },
  stockSegment: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  stockSegmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stockSegmentBtnActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  stockSegmentText: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
  },
  stockSegmentTextActive: {
    color: '#D96B14',
  },

  /* CATEGORY STRIP */
  categoryStripWrapper: {
    marginBottom: 8,
  },
  categoryStripContent: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  catChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  catChipActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
  },
  catChipText: {
    color: '#5C4E3D',
    fontSize: 11,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#D96B14',
    fontWeight: '700',
  },
  catCountBadge: {
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  catCountBadgeActive: {
    backgroundColor: 'rgba(222, 134, 38, 0.15)',
  },
  catCountText: {
    color: '#7C6F62',
    fontSize: 9,
    fontWeight: '700',
  },
  catCountTextActive: {
    color: '#D96B14',
  },
  catActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    gap: 2,
  },
  catActionMiniBtn: {
    padding: 4,
  },
  addCatPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  addCatPillText: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '700',
  },
  addUnitPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  addUnitPillText: {
    color: '#7C6F62',
    fontSize: 11,
    fontWeight: '600',
  },

  /* DISH CARD */
  listContent: {
    paddingBottom: 20,
    gap: 8,
  },
  dishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dishTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dishThumbnail: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: '#FAF7F2',
  },
  dishThumbnailPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  dishDetailsCol: {
    flex: 1,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vegBadge: {
    width: 12,
    height: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  vegInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dishName: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  spicyBadge: {
    padding: 2,
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  catBadge: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  catBadgeText: {
    color: '#D96B14',
    fontSize: 9,
    fontWeight: '700',
  },
  prepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  prepText: {
    color: '#8C7A6B',
    fontSize: 10,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  unitBadgeText: {
    color: '#5C4E3D',
    fontSize: 9,
    fontWeight: '600',
  },
  dishDesc: {
    color: '#5C4E3D',
    fontSize: 11,
    marginTop: 3,
  },
  dishTopRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },

  /* CHIPS SECTION */
  chipsSection: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
    gap: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  chipSectionLabel: {
    color: '#7C6F62',
    fontSize: 9,
    fontWeight: '700',
    marginRight: 2,
  },
  variantTag: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  variantTagText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '600',
  },
  modifierTag: {
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.25)',
  },
  modifierTagText: {
    color: '#17845A',
    fontSize: 10,
    fontWeight: '600',
  },
  chipMoreText: {
    color: '#7C6F62',
    fontSize: 9,
    fontStyle: 'italic',
  },

  /* DISH CARD BOTTOM ROW */
  dishCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceCurrency: {
    color: '#DE8626',
    fontSize: 12,
    fontWeight: '700',
  },
  priceValue: {
    color: '#DE8626',
    fontSize: 16,
    fontWeight: '800',
  },
  portionPill: {
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  portionPillText: {
    color: '#5C4E3D',
    fontSize: 9,
    fontWeight: '700',
  },
  portionsManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  portionsManageBtnText: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: '700',
  },
  stockSwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockStatusLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* PAGINATION TOOLBAR */
  paginationToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  paginationSummary: {
    color: '#7C6F62',
    fontSize: 10,
  },
  pageSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pageSizeLabel: {
    color: '#7C6F62',
    fontSize: 10,
  },
  pageSizeBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FAF7F2',
  },
  pageSizeBtnActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  pageSizeBtnText: {
    color: '#7C6F62',
    fontSize: 9,
    fontWeight: '700',
  },
  pageSizeBtnTextActive: {
    color: '#D96B14',
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    color: '#DE8626',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pageCountText: {
    color: '#7C6F62',
    fontSize: 10,
  },

  /* LOADING & EMPTY STATES */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    color: '#DE8626',
    fontSize: 13,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#5C4E3D',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 16,
  },
  resetFilterBtn: {
    marginTop: 10,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  resetFilterBtnText: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '700',
  },
  addItemEmptyBtnWrapper: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  addItemEmptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addItemEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* LOCKED CONTAINER */
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    maxWidth: 340,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  lockedIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockedTitle: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  lockedMessage: {
    color: '#5C4E3D',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  lockedCloseBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  lockedCloseBtnGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lockedCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  /* MODALS STYLING */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubHeader: {
    color: '#5C4E3D',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  inputLabel: {
    color: '#7C6F62',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FAF7F2',
    color: '#1F2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
    fontSize: 13,
  },
  formRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  formActionLink: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '700',
  },
  selectDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  selectDropdownText: {
    color: '#1F2937',
    fontSize: 12,
  },
  dropdownListBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 10,
    padding: 6,
    marginBottom: 10,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 32,
    gap: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  dropdownSearchInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: 11,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dropdownItemRowActive: {
    backgroundColor: '#FFF0DE',
  },
  dropdownItemText: {
    color: '#5C4E3D',
    fontSize: 12,
  },
  dropdownItemTextActive: {
    color: '#D96B14',
    fontWeight: '700',
  },
  uploadedImageCard: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
  },
  uploadedImagePreview: {
    width: '100%',
    height: 110,
    resizeMode: 'cover',
  },
  imageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    backgroundColor: '#FAF7F2',
  },
  changeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DE8626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeImgBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  removeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  removeImgBtnText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadZoneBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1.5,
    borderColor: 'rgba(222, 134, 38, 0.35)',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  uploadZoneTitle: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  uploadZoneSub: {
    color: '#7C6F62',
    fontSize: 9,
    marginTop: 1,
  },
  switchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 6,
  },
  switchBoxLabel: {
    color: '#5C4E3D',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalSubmitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    gap: 6,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* IMAGE SOURCE SELECTION */
  sourceChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF7F2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  sourceIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '700',
  },
  sourceSub: {
    color: '#7C6F62',
    fontSize: 10,
    marginTop: 1,
  },

  /* PORTIONS & MODIFIERS TABS & LIST */
  segmentedTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  segmentedTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  segmentedTabBtnActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  segmentedTabText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
  },
  segmentedTabTextActive: {
    color: '#D96B14',
  },
  sectionHeaderLabel: {
    color: '#7C6F62',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  variantRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DE8626',
  },
  variantRowName: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
  },
  variantPricePill: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
  },
  variantPricePillText: {
    color: '#D96B14',
    fontSize: 11,
    fontWeight: '700',
  },
  emeraldPricePill: {
    backgroundColor: '#E4F5EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(23, 132, 90, 0.3)',
  },
  emeraldPricePillText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: '700',
  },
  modifierSubGroup: {
    color: '#7C6F62',
    fontSize: 9,
  },
  emptyItemsNotice: {
    color: '#7C6F62',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  addInlineBox: {
    backgroundColor: '#FAF7F2',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  addInlineTitle: {
    color: '#DE8626',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  inlineAddBtn: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 2,
  },
  inlineAddBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
  },
  inlineAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  skeletonBg: {
    backgroundColor: '#EDE8E1',
  },
  stationSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  stationSelectChipActive: {
    backgroundColor: '#FFF0DE',
    borderColor: '#DE8626',
    borderWidth: 1.5,
  },
  stationSelectChipText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  stationSelectChipTextActive: {
    color: '#DE8626',
    fontWeight: '800',
  },
});
