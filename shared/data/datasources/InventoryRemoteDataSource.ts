import { Platform } from 'react-native';
import { apiClient } from '../../core/network/apiClient';
import { APP_CONSTANTS } from '../../core/constants/appConstants';
import { useAuthStore } from '../../presentation/state/useAuthStore';

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
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount: number;
  scannedImageUrl?: string;
  confidenceScore: number;
  status: string;
  items: ScannedInvoiceItem[];
}

export interface ConfirmInvoiceItem {
  matchedIngredientId?: number;
  ingredientName: string;
  quantity: number;
  unitName: string;
  ratePerUnit: number;
  lineTotal: number;
}

export interface ConfirmInvoicePayload {
  invoiceLogId: number;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  items: ConfirmInvoiceItem[];
}

export interface RawIngredient {
  id: number;
  restId: number;
  ingredientName: string;
  sku?: string;
  categoryId?: number;
  unitName: string;
  currentStock: number;
  minimumReorderLevel: number;
  lastPurchaseCostPerUnit: number;
  isLowStock?: boolean;
}

export interface LogWastePayload {
  ingredientId: number;
  quantityWasted: number;
  reason: string;
  notes?: string;
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

export interface DeductDishPayload {
  menuItemId: number;
  quantity: number;
  referenceId?: string;
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

export class InventoryRemoteDataSource {
  async scanInvoice(
    restaurantId: number,
    fileData: { uri: string; name?: string; type?: string }
  ): Promise<ScannedInvoiceResult> {
    const storeState = useAuthStore.getState();
    const token = (globalThis as any).__MENZA_AUTH_TOKEN__ || storeState.token;
    const resolvedRestId = restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const fileName = fileData.name || fileData.uri.split('/').pop() || 'invoice.jpg';
    const match = /\.(\w+)$/.exec(fileName);
    const fileType = fileData.type || (match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : 'image/jpeg');

    // Normalize URI for React Native Android / iOS
    let cleanUri = fileData.uri;
    if (Platform.OS === 'android' && !cleanUri.startsWith('file://') && !cleanUri.startsWith('content://')) {
      cleanUri = `file://${cleanUri}`;
    }

    const endpointUrl = `${APP_CONSTANTS.API_BASE_URL}/Inventory/invoices/scan?restaurantId=${resolvedRestId}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Active-Restaurant-Id': resolvedRestId.toString(),
      'X-Restaurant-Id': resolvedRestId.toString(),
      'X-Menza-Client': 'Menza-POS-App',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Helper: Native React Native XMLHttpRequest uploader
    // React Native's XMLHttpRequest delegates directly to native Java NetworkingModule (Android)
    // and Objective-C RCTNetworking (iOS), which natively stream { uri, name, type }
    // file parts directly from disk/ContentResolver without throwing "Unsupported FormDataPart implementation".
    const uploadWithXhr = (data: FormData): Promise<ScannedInvoiceResult> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpointUrl);
        xhr.timeout = 90000; // 90 seconds timeout for AI vision OCR analysis

        // Attach custom headers. Omit Content-Type so native XHR sets multipart boundary automatically
        Object.entries(headers).forEach(([k, v]) => {
          if (k.toLowerCase() !== 'content-type') {
            xhr.setRequestHeader(k, v);
          }
        });

        xhr.onload = () => {
          const status = xhr.status;
          let json: any;
          try {
            json = JSON.parse(xhr.responseText);
          } catch {
            json = { message: xhr.responseText };
          }

          if (status >= 200 && status < 300) {
            resolve(json as ScannedInvoiceResult);
          } else {
            const errorMsg =
              json?.message ||
              json?.error ||
              json?.title ||
              `AI Vision scan failed with HTTP ${status}`;
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during receipt upload. Please verify your internet connection.'));
        };

        xhr.ontimeout = () => {
          reject(new Error('AI Vision invoice scan timed out after 90 seconds. Please check your network connection.'));
        };

        xhr.send(data);
      });
    };

    // Prepare FormData
    const formData = new FormData();

    if (Platform.OS === 'web') {
      // In web browser runtime, convert URI to a standard Web Blob
      try {
        const res = await fetch(cleanUri);
        const blob = await res.blob();
        formData.append('file', blob, fileName);
      } catch {
        formData.append('file', {
          uri: cleanUri,
          name: fileName,
          type: fileType,
        } as any);
      }
    } else {
      // In React Native native mobile runtime, attach the standard RN file object
      formData.append('file', {
        uri: cleanUri,
        name: fileName,
        type: fileType,
      } as any);
    }

    // Execute upload via native XMLHttpRequest (bypasses expo/fetch convertFormData)
    try {
      return await uploadWithXhr(formData);
    } catch (xhrErr: any) {
      // If native XHR fails with network error, attempt fallback through apiClient
      try {
        const res = await apiClient.post<ScannedInvoiceResult>(
          `/Inventory/invoices/scan?restaurantId=${resolvedRestId}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 90000,
            transformRequest: (d) => d,
          }
        );
        return res.data;
      } catch (apiErr: any) {
        throw xhrErr || apiErr;
      }
    }
  }

  async confirmInvoice(
    restaurantId: number,
    payload: ConfirmInvoicePayload
  ): Promise<{ success: boolean; message: string }> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/invoices/confirm?restaurantId=${resolvedRestId}`,
      payload
    );
    return response.data;
  }

  async getPagedIngredients(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedRawIngredientResponse> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 25;
    let url = `/Inventory/ingredients?restaurantId=${resolvedRestId}&page=${page}&pageSize=${pageSize}`;
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
        lowStockCount: response.data.filter((i) => i.currentStock <= i.minimumReorderLevel).length,
      };
    }
    return response.data;
  }

  async getIngredients(restaurantId: number): Promise<RawIngredient[]> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.get<RawIngredient[] | PagedRawIngredientResponse>(
      `/Inventory/ingredients?restaurantId=${resolvedRestId}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  async getPagedInvoices(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedScannedInvoiceResponse> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    let url = `/Inventory/invoices?restaurantId=${resolvedRestId}&page=${page}&pageSize=${pageSize}`;
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

  async getInvoices(restaurantId: number, limit: number = 20): Promise<ScannedInvoiceResult[]> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.get<ScannedInvoiceResult[] | PagedScannedInvoiceResponse>(
      `/Inventory/invoices?restaurantId=${resolvedRestId}&limit=${limit}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  async logWaste(
    restaurantId: number,
    payload: LogWastePayload
  ): Promise<{ success: boolean; message: string }> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/waste?restaurantId=${resolvedRestId}`,
      payload
    );
    return response.data;
  }

  async saveIngredient(
    restaurantId: number,
    payload: Partial<RawIngredient>
  ): Promise<RawIngredient> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.post<RawIngredient>(
      `/Inventory/ingredients?restaurantId=${resolvedRestId}`,
      payload
    );
    return response.data;
  }

  async getPagedWasteLogs(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedWasteLogResponse> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    let url = `/Inventory/waste?restaurantId=${resolvedRestId}&page=${page}&pageSize=${pageSize}`;
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

  async getWasteLogs(
    restaurantId: number,
    limit: number = 50
  ): Promise<WasteLogItem[]> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.get<WasteLogItem[] | PagedWasteLogResponse>(
      `/Inventory/waste?restaurantId=${resolvedRestId}&limit=${limit}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  async getPagedRecipes(
    restaurantId: number,
    options?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PagedMenuItemRecipeResponse> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 12;
    let url = `/Inventory/recipes?restaurantId=${resolvedRestId}&page=${page}&pageSize=${pageSize}`;
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
        configuredCount: response.data.filter((r) => (r.ingredients?.length || 0) > 0).length,
      };
    }
    return response.data;
  }

  async getRecipes(restaurantId: number): Promise<MenuItemRecipe[]> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.get<MenuItemRecipe[] | PagedMenuItemRecipeResponse>(
      `/Inventory/recipes?restaurantId=${resolvedRestId}`
    );
    if (Array.isArray(response.data)) return response.data;
    return response.data.items || [];
  }

  async getRecipeByMenuItem(
    restaurantId: number,
    menuItemId: number
  ): Promise<MenuItemRecipe> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.get<MenuItemRecipe>(
      `/Inventory/recipes/${menuItemId}?restaurantId=${resolvedRestId}`
    );
    return response.data;
  }

  async saveRecipe(
    restaurantId: number,
    payload: SaveRecipePayload
  ): Promise<{ success: boolean; message: string }> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/recipes?restaurantId=${resolvedRestId}`,
      payload
    );
    return response.data;
  }

  async deductDish(
    restaurantId: number,
    payload: DeductDishPayload
  ): Promise<{ success: boolean; message: string }> {
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/Inventory/deduct-dish?restaurantId=${resolvedRestId}`,
      payload
    );
    return response.data;
  }

  async getPagedStockMovements(
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
    const storeState = useAuthStore.getState();
    const resolvedRestId =
      restaurantId > 0 ? restaurantId : (storeState.activeRestaurant?.restaurantId || 0);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 25;
    let url = `/Inventory/movements?restaurantId=${resolvedRestId}&page=${page}&pageSize=${pageSize}`;

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

  async getStockMovements(
    restaurantId: number,
    ingredientId?: number,
    movementType?: string,
    limit = 100
  ): Promise<StockMovementItem[]> {
    const result = await this.getPagedStockMovements(restaurantId, {
      ingredientId,
      movementType,
      pageSize: limit,
      page: 1,
    });
    return result.items || [];
  }
}

export const inventoryRemoteDataSource = new InventoryRemoteDataSource();
