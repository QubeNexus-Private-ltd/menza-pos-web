import { apiClient } from '@shared/core/network/apiClient';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';

function resolveRestId(restaurantId: number): number {
  if (restaurantId > 0) return restaurantId;
  const store = useAuthStore.getState();
  return store.activeRestaurant?.restaurantId || (store.restaurants?.[0]?.restaurantId || 0);
}

export interface ScannedInvoiceItem {
  id?: number;
  rawScannedText: string;
  matchedIngredientId?: number;
  matchedIngredientName?: string;
  quantity: number;
  unitName: string;
  ratePerUnit: number;
  lineTotal: number;
  lastPurchasePrice?: number;
  priceDifferencePercent?: number;
  isNewIngredient?: boolean;
  confidence?: number;
}

export interface ScannedInvoiceResult {
  invoiceLogId: number;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate?: string;
  totalAmount: number;
  scannedImageUrl?: string;
  confidenceScore: number;
  status: string;
  items: ScannedInvoiceItem[];
}

export interface ConfirmInvoicePayload {
  invoiceLogId: number;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  items: {
    matchedIngredientId?: number;
    ingredientName: string;
    quantity: number;
    unitName: string;
    ratePerUnit: number;
    lineTotal: number;
  }[];
}

export interface RawIngredient {
  id: number;
  restId: number;
  ingredientName: string;
  sku?: string;
  categoryId: number;
  unitName: string;
  currentStock: number;
  minimumReorderLevel: number;
  lastPurchaseCostPerUnit: number;
  isLowStock: boolean;
}

export interface LogWastePayload {
  ingredientId: number;
  quantityWasted: number;
  reason: string;
  notes?: string;
}

export interface RecipeIngredientItem {
  id?: number;
  ingredientId: number;
  ingredientName?: string;
  quantityRequired: number;
  unitName: string;
  ingredientUnit?: string;
  costPerUnit?: number;
  lineCost?: number;
  wastageBufferPercent?: number;
  notes?: string;
}

export interface MenuItemRecipe {
  menuItemId: number;
  menuItemName: string;
  price: number;
  categoryId: number;
  categoryName?: string;
  ingredientsCount: number;
  totalRecipeCost: number;
  grossProfitMarginPercent: number;
  ingredients: RecipeIngredientItem[];
}

export interface SaveRecipePayload {
  menuItemId: number;
  ingredients: {
    ingredientId: number;
    quantityRequired: number;
    unitName: string;
    wastageBufferPercent?: number;
    notes?: string;
  }[];
}

export interface StockMovementItem {
  id: number;
  restId: number;
  ingredientId: number;
  ingredientName: string;
  unitName: string;
  quantity: number;
  balanceAfterMovement: number;
  movementType: string;
  referenceId?: string;
  costPerUnitAtMovement: number;
  notes?: string;
  createdDateUtc: string;
}

export interface StockLedgerStats {
  totalPurchasedValue: number;
  purchaseCount: number;
  totalCookedValue: number;
  cookedCount: number;
  totalWasteValue: number;
  wasteCount: number;
  adjustmentCount: number;
  totalCount: number;
  netValueDelta: number;
}

export interface PagedStockMovementResponse {
  items: StockMovementItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  stats: StockLedgerStats;
}

export interface DeductDishPayload {
  menuItemId: number;
  quantity: number;
  referenceId?: string;
}

export interface WasteLogItem {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unitName: string;
  quantityWasted: number;
  costPerUnit: number;
  totalEstimatedLoss: number;
  reason: string;
  notes?: string;
  loggedAtUtc: string;
}

export interface PagedRawIngredientResponse {
  items: RawIngredient[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  lowStockCount?: number;
}

export interface PagedMenuItemRecipeResponse {
  items: MenuItemRecipe[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  configuredCount?: number;
}

export interface PagedWasteLogResponse {
  items: WasteLogItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  totalEstimatedLoss?: number;
}

export interface PagedScannedInvoiceResponse {
  items: ScannedInvoiceResult[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export class WebInventoryService {
  static async scanInvoice(restaurantId: number, file: File): Promise<ScannedInvoiceResult> {
    const rid = resolveRestId(restaurantId);
    const formData = new FormData();
    formData.append('file', file, file.name);

    const response = await apiClient.post<ScannedInvoiceResult>(
      `/Inventory/invoices/scan?restaurantId=${rid}`,
      formData,
      {
        timeout: 90000,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  }

  static async confirmInvoice(restaurantId: number, payload: ConfirmInvoicePayload): Promise<{ success: boolean; message: string }> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/invoices/confirm?restaurantId=${rid}`,
      payload
    );
    return response.data;
  }

  static async getPagedIngredients(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedRawIngredientResponse> {
    const rid = resolveRestId(restaurantId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 25;
    let url = `/Inventory/ingredients?restaurantId=${rid}&page=${page}&pageSize=${pageSize}`;
    if (options?.searchTerm?.trim()) {
      url += `&searchTerm=${encodeURIComponent(options.searchTerm.trim())}`;
    }
    const response = await apiClient.get<PagedRawIngredientResponse | RawIngredient[]>(url);
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        pageNumber: 1,
        pageSize: response.data.length,
        totalCount: response.data.length,
        totalPages: 1,
        lowStockCount: response.data.filter(i => i.currentStock <= i.minimumReorderLevel).length,
      };
    }
    return response.data;
  }

  static async getIngredients(restaurantId: number): Promise<RawIngredient[]> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.get<RawIngredient[] | PagedRawIngredientResponse>(
      `/Inventory/ingredients?restaurantId=${rid}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  static async saveIngredient(restaurantId: number, payload: Partial<RawIngredient>): Promise<RawIngredient> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.post<RawIngredient>(
      `/Inventory/ingredients?restaurantId=${rid}`,
      payload
    );
    return response.data;
  }

  static async getPagedInvoices(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedScannedInvoiceResponse> {
    const rid = resolveRestId(restaurantId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    let url = `/Inventory/invoices?restaurantId=${rid}&page=${page}&pageSize=${pageSize}`;
    if (options?.searchTerm?.trim()) {
      url += `&searchTerm=${encodeURIComponent(options.searchTerm.trim())}`;
    }
    const response = await apiClient.get<PagedScannedInvoiceResponse | ScannedInvoiceResult[]>(url);
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        pageNumber: 1,
        pageSize: response.data.length,
        totalCount: response.data.length,
        totalPages: 1,
      };
    }
    return response.data;
  }

  static async getInvoices(restaurantId: number, limit = 20): Promise<ScannedInvoiceResult[]> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.get<ScannedInvoiceResult[] | PagedScannedInvoiceResponse>(
      `/Inventory/invoices?restaurantId=${rid}&limit=${limit}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  static async logWaste(restaurantId: number, payload: LogWastePayload): Promise<{ success: boolean; message: string }> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/waste?restaurantId=${rid}`,
      payload
    );
    return response.data;
  }

  static async getPagedWasteLogs(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedWasteLogResponse> {
    const rid = resolveRestId(restaurantId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    let url = `/Inventory/waste?restaurantId=${rid}&page=${page}&pageSize=${pageSize}`;
    if (options?.searchTerm?.trim()) {
      url += `&searchTerm=${encodeURIComponent(options.searchTerm.trim())}`;
    }
    const response = await apiClient.get<PagedWasteLogResponse | WasteLogItem[]>(url);
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        pageNumber: 1,
        pageSize: response.data.length,
        totalCount: response.data.length,
        totalPages: 1,
        totalEstimatedLoss: response.data.reduce((sum, item) => sum + (item.totalEstimatedLoss || 0), 0),
      };
    }
    return response.data;
  }

  static async getWasteLogs(restaurantId: number, limit = 50): Promise<WasteLogItem[]> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.get<WasteLogItem[] | PagedWasteLogResponse>(
      `/Inventory/waste?restaurantId=${rid}&limit=${limit}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  static async getPagedRecipes(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedMenuItemRecipeResponse> {
    const rid = resolveRestId(restaurantId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 12;
    let url = `/Inventory/recipes?restaurantId=${rid}&page=${page}&pageSize=${pageSize}`;
    if (options?.searchTerm?.trim()) {
      url += `&searchTerm=${encodeURIComponent(options.searchTerm.trim())}`;
    }
    const response = await apiClient.get<PagedMenuItemRecipeResponse | MenuItemRecipe[]>(url);
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        pageNumber: 1,
        pageSize: response.data.length,
        totalCount: response.data.length,
        totalPages: 1,
        configuredCount: response.data.filter(r => r.ingredientsCount > 0).length,
      };
    }
    return response.data;
  }

  static async getRecipes(restaurantId: number): Promise<MenuItemRecipe[]> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.get<MenuItemRecipe[] | PagedMenuItemRecipeResponse>(
      `/Inventory/recipes?restaurantId=${rid}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  static async getRecipeByMenuItem(restaurantId: number, menuItemId: number): Promise<MenuItemRecipe> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.get<MenuItemRecipe>(
      `/Inventory/recipes/${menuItemId}?restaurantId=${rid}`
    );
    return response.data;
  }

  static async saveRecipe(restaurantId: number, payload: SaveRecipePayload): Promise<{ success: boolean; message: string }> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/recipes?restaurantId=${rid}`,
      payload
    );
    return response.data;
  }

  static async deductDish(restaurantId: number, payload: DeductDishPayload): Promise<{ success: boolean; message: string }> {
    const rid = resolveRestId(restaurantId);
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/deduct-dish?restaurantId=${rid}`,
      payload
    );
    return response.data;
  }

  static async getPagedStockMovements(
    restaurantId: number,
    options?: {
      ingredientId?: number;
      movementType?: string;
      searchTerm?: string;
      fromDateUtc?: string;
      toDateUtc?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PagedStockMovementResponse> {
    const rid = resolveRestId(restaurantId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 25;
    let url = `/Inventory/movements?restaurantId=${rid}&page=${page}&pageSize=${pageSize}`;

    if (options?.ingredientId && options.ingredientId > 0) {
      url += `&ingredientId=${options.ingredientId}`;
    }
    if (options?.movementType && options.movementType !== 'All') {
      url += `&movementType=${encodeURIComponent(options.movementType)}`;
    }
    if (options?.searchTerm && options.searchTerm.trim()) {
      url += `&searchTerm=${encodeURIComponent(options.searchTerm.trim())}`;
    }
    if (options?.fromDateUtc) {
      url += `&fromDateUtc=${encodeURIComponent(options.fromDateUtc)}`;
    }
    if (options?.toDateUtc) {
      url += `&toDateUtc=${encodeURIComponent(options.toDateUtc)}`;
    }

    const response = await apiClient.get<PagedStockMovementResponse | StockMovementItem[]>(url);
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        pageNumber: 1,
        pageSize: response.data.length,
        totalCount: response.data.length,
        totalPages: 1,
        stats: {
          totalPurchasedValue: 0,
          purchaseCount: 0,
          totalCookedValue: 0,
          cookedCount: 0,
          totalWasteValue: 0,
          wasteCount: 0,
          adjustmentCount: 0,
          totalCount: response.data.length,
          netValueDelta: 0,
        },
      };
    }
    return response.data;
  }

  static async getStockMovements(
    restaurantId: number,
    ingredientId?: number,
    movementType?: string,
    limit = 100
  ): Promise<StockMovementItem[]> {
    const result = await WebInventoryService.getPagedStockMovements(restaurantId, {
      ingredientId,
      movementType,
      pageSize: limit,
      page: 1,
    });
    return result.items || [];
  }
}
