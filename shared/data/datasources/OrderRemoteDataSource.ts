import { apiClient } from '../../core/network/apiClient';
import {
  OrderMaster,
  OrderItem,
  PlaceOrderRequest,
  RestaurantTodayRevenue,
  PaginatedOrdersResult,
  OrderStatusOption,
  ActiveOrderType,
  SettleOrderRequest,
  SettleOrderResponse,
} from '../../domain/models/Order';

export class OrderRemoteDataSource {
  /**
   * GET /api/Order/Restaurant/{restaurantId}/Revenue/Today
   * Fetches today's live revenue, order counts, and commission metrics for a restaurant outlet
   */
  async getTodayRevenue(restaurantId: number): Promise<RestaurantTodayRevenue> {
    const response = await apiClient.get(`/Order/Restaurant/${restaurantId}/Revenue/Today`);
    const data = response.data;
    return {
      restaurantId: Number(data?.restaurantId ?? data?.RestaurantId ?? restaurantId),
      date: String(data?.date ?? data?.Date ?? ''),
      todayRevenue: Number(data?.todayRevenue ?? data?.TodayRevenue ?? 0),
      todayOrdersCount: Number(data?.todayOrdersCount ?? data?.TodayOrdersCount ?? 0),
      activeOrdersCount: Number(data?.activeOrdersCount ?? data?.ActiveOrdersCount ?? 0),
      completedOrdersCount: Number(data?.completedOrdersCount ?? data?.CompletedOrdersCount ?? 0),
      cancelledOrdersCount: Number(data?.cancelledOrdersCount ?? data?.CancelledOrdersCount ?? 0),
      todayCommissionDeducted: Number(data?.todayCommissionDeducted ?? data?.TodayCommissionDeducted ?? 0),
    };
  }

  /** Heuristic station detection matching backend and KDS */
  private detectStation(name: string, category?: string): string {
    const s = `${name} ${category || ''}`.toLowerCase();
    if (
      s.includes('grill') ||
      s.includes('tandoor') ||
      s.includes('tikka') ||
      s.includes('kebab') ||
      s.includes('kabab') ||
      s.includes('naan') ||
      s.includes('roti') ||
      s.includes('paratha') ||
      s.includes('kulcha') ||
      s.includes('bread') ||
      s.includes('pizza') ||
      s.includes('burger') ||
      s.includes('sandwich') ||
      s.includes('toast') ||
      s.includes('bbq') ||
      s.includes('barbeque') ||
      s.includes('steak') ||
      s.includes('sizzler') ||
      s.includes('shawarma')
    ) {
      return 'GRILL';
    }
    if (
      s.includes('curry') ||
      s.includes('gravy') ||
      s.includes('makhani') ||
      s.includes('korma') ||
      s.includes('masala') ||
      s.includes('paneer') ||
      s.includes('dal') ||
      s.includes('daal') ||
      s.includes('biryani') ||
      s.includes('rice') ||
      s.includes('pulao') ||
      s.includes('jeera rice') ||
      s.includes('kofta') ||
      s.includes('handi') ||
      s.includes('kadai') ||
      s.includes('kadhai') ||
      s.includes('butter chicken')
    ) {
      return 'CURRY';
    }
    if (
      s.includes('chinese') ||
      s.includes('wok') ||
      s.includes('noodle') ||
      s.includes('noodles') ||
      s.includes('chowmein') ||
      s.includes('manchurian') ||
      s.includes('fried rice') ||
      s.includes('schezwan') ||
      s.includes('chilli') ||
      s.includes('momos') ||
      s.includes('dim sum') ||
      s.includes('dimsum') ||
      s.includes('soup') ||
      s.includes('spring roll') ||
      s.includes('hakka') ||
      s.includes('ramen')
    ) {
      return 'CHINESE';
    }
    if (
      s.includes('beverage') ||
      s.includes('bar') ||
      s.includes('drink') ||
      s.includes('coffee') ||
      s.includes('tea') ||
      s.includes('chai') ||
      s.includes('mojito') ||
      s.includes('shake') ||
      s.includes('smoothie') ||
      s.includes('mocktail') ||
      s.includes('cocktail') ||
      s.includes('juice') ||
      s.includes('soda') ||
      s.includes('cold drink') ||
      s.includes('lassi') ||
      s.includes('water') ||
      s.includes('beer') ||
      s.includes('wine')
    ) {
      return 'BAR';
    }
    if (
      s.includes('dessert') ||
      s.includes('sweet') ||
      s.includes('ice cream') ||
      s.includes('icecream') ||
      s.includes('cake') ||
      s.includes('pastry') ||
      s.includes('brownie') ||
      s.includes('halwa') ||
      s.includes('gulab jamun') ||
      s.includes('jamun') ||
      s.includes('rasgulla') ||
      s.includes('kulfi') ||
      s.includes('pudding') ||
      s.includes('sundae') ||
      s.includes('waffle')
    ) {
      return 'DESSERT';
    }
    if (
      s.includes('starter') ||
      s.includes('appetizer') ||
      s.includes('snack') ||
      s.includes('pakoda') ||
      s.includes('pakora') ||
      s.includes('samosa') ||
      s.includes('cutlet') ||
      s.includes('finger') ||
      s.includes('fries') ||
      s.includes('crispy') ||
      s.includes('chaat') ||
      s.includes('nachos') ||
      s.includes('wings') ||
      s.includes('papad') ||
      s.includes('salad') ||
      s.includes('roll')
    ) {
      return 'STARTERS';
    }
    return 'MAIN';
  }

  private resolveStationMeta(stationCode: string): { name: string; color: string; icon: string } {
    switch (stationCode.toUpperCase()) {
      case 'GRILL':
        return { name: 'Grill & Tandoor', color: '#EF4444', icon: 'flame' };
      case 'CURRY':
        return { name: 'Main Curry & Gravy', color: '#F59E0B', icon: 'soup' };
      case 'CHINESE':
        return { name: 'Chinese & Wok', color: '#8B5CF6', icon: 'sparkles' };
      case 'BAR':
        return { name: 'Beverages & Bar', color: '#06B6D4', icon: 'coffee' };
      case 'DESSERT':
        return { name: 'Desserts & Bakery', color: '#EC4899', icon: 'cake' };
      case 'STARTERS':
        return { name: 'Starters & Snacks', color: '#10B981', icon: 'zap' };
      case 'MAIN':
      default:
        return { name: 'Main Kitchen', color: '#DE8626', icon: 'utensils' };
    }
  }

  /** Helper to robustly extract order items from various backend payload structures */
  private parseOrderItems(rawList: any): OrderItem[] {
    const list = Array.isArray(rawList)
      ? rawList
      : Array.isArray(rawList?.items)
      ? rawList.items
      : Array.isArray(rawList?.Items)
      ? rawList.Items
      : Array.isArray(rawList?.orderDetails)
      ? rawList.orderDetails
      : Array.isArray(rawList?.OrderDetails)
      ? rawList.OrderDetails
      : Array.isArray(rawList?.orderItems)
      ? rawList.orderItems
      : Array.isArray(rawList?.OrderItems)
      ? rawList.OrderItems
      : Array.isArray(rawList?.itemsList)
      ? rawList.itemsList
      : Array.isArray(rawList?.details)
      ? rawList.details
      : Array.isArray(rawList?.data)
      ? rawList.data
      : [];

    return list.map((it: any, idx: number) => {
      const rawName =
        it.itemName ??
        it.ItemName ??
        it.name ??
        it.Name ??
        it.dishName ??
        it.DishName ??
        it.itemTitle ??
        it.ItemTitle ??
        it.title ??
        it.Title ??
        it.menuItemName ??
        it.MenuItemName ??
        it.itemDescription ??
        it.item?.itemName ??
        it.item?.name ??
        it.Item?.ItemName ??
        it.Item?.Name ??
        it.menuItem?.itemName ??
        it.MenuItem?.ItemName ??
        `Item ${idx + 1}`;

      const name = String(rawName).trim() || `Item ${idx + 1}`;

      const quantity = Number(
        it.quantity ??
        it.Quantity ??
        it.qty ??
        it.Qty ??
        it.count ??
        it.Count ??
        1
      ) || 1;

      const unitPrice = Number(
        it.unitPrice ??
        it.UnitPrice ??
        it.amount ??
        it.Amount ??
        it.price ??
        it.Price ??
        it.rate ??
        it.Rate ??
        it.itemPrice ??
        it.ItemPrice ??
        it.item?.price ??
        it.Item?.Price ??
        0
      ) || 0;

      let totalPrice = Number(
        it.totalPrice ??
        it.TotalPrice ??
        it.totalAmount ??
        it.TotalAmount ??
        it.total ??
        it.Total ??
        (quantity * unitPrice)
      );

      if (isNaN(totalPrice) || totalPrice <= 0) {
        totalPrice = quantity * unitPrice;
      }

      const resolvedUnitPrice = unitPrice > 0 ? unitPrice : (totalPrice > 0 && quantity > 0 ? Number((totalPrice / quantity).toFixed(2)) : 0);
      const resolvedTotalPrice = totalPrice > 0 ? totalPrice : Number((quantity * resolvedUnitPrice).toFixed(2));

      // Station parsing and heuristic routing
      const rawStationCode = it.stationCode ?? it.StationCode ?? it.station ?? it.Station;
      const rawStationName = it.stationName ?? it.StationName;
      const rawStationBadge = it.stationBadgeColor ?? it.StationBadgeColor;
      const rawStationIcon = it.stationIcon ?? it.StationIcon;
      const categoryName = it.categoryName ?? it.CategoryName ?? it.category ?? it.Category ?? '';

      const detected = this.detectStation(name, String(categoryName));
      const isGeneric =
        !rawStationCode ||
        String(rawStationCode).toUpperCase() === 'MAIN' ||
        String(rawStationName || '').toLowerCase() === 'main kitchen';

      const stationCode =
        isGeneric && detected !== 'MAIN'
          ? detected
          : rawStationCode
          ? String(rawStationCode).toUpperCase()
          : detected;

      const defaultMeta = this.resolveStationMeta(stationCode);
      const stationName = rawStationName && !isGeneric ? String(rawStationName).trim() : defaultMeta.name;
      const stationBadgeColor = rawStationBadge && !isGeneric ? String(rawStationBadge) : defaultMeta.color;
      const stationIcon = rawStationIcon && !isGeneric ? String(rawStationIcon) : defaultMeta.icon;

      return {
        itemId: Number(it.itemId ?? it.ItemId ?? it.id ?? it.Id ?? 0),
        itemName: name,
        quantity,
        unitPrice: resolvedUnitPrice,
        totalPrice: resolvedTotalPrice,
        cookingInstruction: String(
          it.cookingInstruction ??
          it.CookingInstruction ??
          it.instruction ??
          it.Instruction ??
          it.notes ??
          it.remarks ??
          ''
        ),
        gstRate: Number(it.gstRate ?? it.GstRate ?? it.gstPercent ?? it.GstPercent ?? it.taxRate ?? it.TaxRate ?? 0) || undefined,
        gstAmount: Number(it.gstAmount ?? it.GstAmount ?? it.taxAmount ?? it.TaxAmount ?? 0) || undefined,
        stationCode,
        stationName,
        stationBadgeColor,
        stationIcon,
      };
    });
  }

  /**
   * GET /api/Order/Restaurant/{restaurantId}/Orders/Today
   * Fetches real settled, active, and cancelled orders placed today for this restaurant with pagination & search
   */
  async getTodayOrders(
    restaurantId: number,
    status?: string,
    pageNumber: number = 1,
    pageSize: number = 20,
    search?: string,
    fromDate?: string,
    toDate?: string
  ): Promise<PaginatedOrdersResult> {
    if (!restaurantId || restaurantId <= 0) {
      return { items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0, hasNextPage: false };
    }
    try {
      const params: Record<string, string | number> = {
        pageNumber,
        pageSize,
      };
      if (status && status !== 'ALL') params.status = status;
      if (search && search.trim().length > 0) params.search = search.trim();
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const endpoint = (fromDate || toDate)
        ? `/Order/Restaurant/${restaurantId}/Orders`
        : `/Order/Restaurant/${restaurantId}/Orders/Today`;

      const response = await apiClient.get(endpoint, { params });
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const totalCount = Number(data?.totalCount ?? data?.TotalCount ?? rawList.length);
      const respPageNumber = Number(data?.pageNumber ?? data?.PageNumber ?? pageNumber);
      const respPageSize = Number(data?.pageSize ?? data?.PageSize ?? pageSize);
      const totalPages = Number(data?.totalPages ?? data?.TotalPages ?? (respPageSize > 0 ? Math.ceil(totalCount / respPageSize) : 1));
      const hasNextPage = Boolean(data?.hasNextPage ?? (respPageNumber < totalPages));

      const items: OrderMaster[] = rawList.map((item: any) => {
        const parsedItems = this.parseOrderItems(
          item.items ?? item.Items ?? item.orderDetails ?? item.OrderDetails ?? item.orderItems ?? item.OrderItems ?? item.itemsList ?? item.details
        );
        const parsedItemsSum = parsedItems.reduce(
          (acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))),
          0
        );

        const rawSubtotal = Number(item.orderAmount ?? item.OrderAmount ?? item.subtotal ?? item.Subtotal ?? item.subTotal ?? item.SubTotal ?? 0);
        const rawTotalAmount = Number(item.totalAmount ?? item.TotalAmount ?? item.amount ?? item.Amount ?? 0);

        const effectiveSubtotal = rawSubtotal > 0
          ? rawSubtotal
          : (parsedItemsSum > 0 ? parsedItemsSum : rawTotalAmount);

        const effectiveTotalAmount = rawTotalAmount > 0
          ? rawTotalAmount
          : (rawSubtotal > 0 ? rawSubtotal : parsedItemsSum);

        return {
          id: Number(item.id ?? item.Id ?? item.orderId ?? item.OrderId ?? 0),
          orderNumber: String(item.orderNumber ?? item.OrderNumber ?? item.id ?? ''),
          restaurantId: Number(item.restaurantId ?? item.RestaurantId ?? restaurantId ?? 0),
          restaurantName: item.restaurantName ?? item.RestaurantName ?? undefined,
          customerName: String(item.customerName ?? item.CustomerName ?? item.name ?? item.Name ?? 'Walk-in Customer'),
          mobileNumber: String(item.mobileNumber ?? item.MobileNumber ?? item.mobile ?? item.Mobile ?? ''),
          tableId: item.tableId ?? item.TableId ?? undefined,
          tableName: item.tableName ?? item.TableName ?? (item.tableId ? `Table ${item.tableId}` : undefined),
          source: item.source ?? item.Source ?? item.tableName ?? item.TableName ?? (item.tableId ? `Table ${item.tableId}` : undefined),
          orderTypeId: Number(item.orderTypeId ?? item.OrderTypeId ?? 1),
          orderTypeName: item.orderTypeName ?? item.OrderTypeName ?? (item.orderTypeId === 2 ? 'Takeaway' : item.orderTypeId === 3 ? 'Delivery' : 'Dine-In'),
          subtotal: effectiveSubtotal,
          cgst: Number(item.cgst ?? item.Cgst ?? item.cgstAmount ?? item.CgstAmount ?? 0),
          sgst: Number(item.sgst ?? item.Sgst ?? item.sgstAmount ?? item.SgstAmount ?? 0),
          totalAmount: effectiveTotalAmount,
          discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0),
          paidAmount: Number(item.paidAmount ?? item.PaidAmount ?? 0),
          pendingAmount: Number(item.pendingAmount ?? item.PendingAmount ?? 0),
          settledDateUtc: item.settledDateUtc ?? item.SettledDateUtc ?? undefined,
          settledBy: item.settledBy ?? item.SettledBy ? Number(item.settledBy ?? item.SettledBy) : undefined,
          billingMode: item.billingMode ?? item.BillingMode ?? undefined,
          tenderedAmount: item.tenderedAmount ?? item.TenderedAmount ? Number(item.tenderedAmount ?? item.TenderedAmount) : undefined,
          changeAmount: item.changeAmount ?? item.ChangeAmount ? Number(item.changeAmount ?? item.ChangeAmount) : undefined,
          commission: Number(item.commission ?? item.Commission ?? 0),
          paymentMode: String(item.paymentMode ?? item.PaymentMode ?? 'CASH'),
          paymentStatus: String(item.paymentStatus ?? item.PaymentStatus ?? 'Pending'),
          status: String(item.orderStatus ?? item.OrderStatus ?? item.status ?? item.Status ?? 'Placed'),
          createdAt: String(item.createdDateUtc ?? item.CreatedDateUtc ?? item.createdAt ?? item.CreatedAt ?? item.orderDate ?? item.OrderDate ?? new Date().toISOString()),
          pickupToken: item.pickupToken ?? item.PickupToken ?? (item.tokenNumber ? String(item.tokenNumber) : (item.TokenNumber ? String(item.TokenNumber) : undefined)),
          tokenNumber: item.tokenNumber ?? item.TokenNumber ?? item.token ?? item.Token ?? undefined,
          gstNumber: item.gstNumber ?? item.GstNumber ?? item.gstin ?? item.Gstin ?? undefined,
          address: item.address ?? item.Address ?? undefined,
          city: item.city ?? item.City ?? undefined,
          state: item.state ?? item.State ?? undefined,
          contactNumber: item.contactNumber ?? item.ContactNumber ?? item.contactPhone ?? item.ContactPhone ?? undefined,
          contactPhone: item.contactPhone ?? item.ContactPhone ?? item.contactNumber ?? item.ContactNumber ?? undefined,
          logoUrl: item.logoUrl ?? item.LogoUrl ?? undefined,
          imageUrl: item.imageUrl ?? item.ImageUrl ?? undefined,
          items: parsedItems,
        };
      });

      return {
        items,
        totalCount,
        pageNumber: respPageNumber,
        pageSize: respPageSize,
        totalPages,
        hasNextPage,
      };
    } catch {
      return { items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0, hasNextPage: false };
    }
  }

  /**
   * GET /api/Order/Kitchen
   * Fetches kitchen tickets / live & settled orders for the active restaurant
   */
  async getKitchenOrders(restaurantId?: number): Promise<OrderMaster[]> {
    try {
      const headers: Record<string, string> = {};
      if (restaurantId && restaurantId > 0) {
        headers['X-Active-Restaurant-Id'] = restaurantId.toString();
      }
      const response = await apiClient.get('/Order/Kitchen', {
        headers,
        params: restaurantId ? { restaurantId } : undefined,
      });
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data?.data)
        ? data.data
        : [];

      return rawList.map((item: any) => {
        const parsedItems = this.parseOrderItems(
          item.items ?? item.Items ?? item.orderDetails ?? item.OrderDetails ?? item.orderItems ?? item.OrderItems ?? item.itemsList ?? item.details
        );
        const parsedItemsSum = parsedItems.reduce(
          (acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))),
          0
        );

        const rawSubtotal = Number(item.subtotal ?? item.Subtotal ?? item.subTotal ?? item.SubTotal ?? item.orderAmount ?? item.OrderAmount ?? 0);
        const rawTotalAmount = Number(item.totalAmount ?? item.TotalAmount ?? item.amount ?? item.Amount ?? 0);

        const effectiveSubtotal = rawSubtotal > 0
          ? rawSubtotal
          : (parsedItemsSum > 0 ? parsedItemsSum : rawTotalAmount);

        const effectiveTotalAmount = rawTotalAmount > 0
          ? rawTotalAmount
          : (rawSubtotal > 0 ? rawSubtotal : parsedItemsSum);

        return {
          id: Number(item.id ?? item.Id ?? item.orderId ?? item.OrderId ?? 0),
          orderNumber: String(item.orderNumber ?? item.OrderNumber ?? item.id ?? ''),
          restaurantId: Number(item.restaurantId ?? item.RestaurantId ?? restaurantId ?? 0),
          restaurantName: item.restaurantName ?? item.RestaurantName ?? undefined,
          customerName: String(item.customerName ?? item.CustomerName ?? item.name ?? item.Name ?? 'Walk-in Customer'),
          mobileNumber: String(item.mobileNumber ?? item.MobileNumber ?? item.mobile ?? item.Mobile ?? ''),
          tableId: item.tableId ?? item.TableId ?? undefined,
          tableName: item.tableName ?? item.TableName ?? (item.tableId ? `Table ${item.tableId}` : undefined),
          source: item.source ?? item.Source ?? item.tableName ?? item.TableName ?? (item.tableId ? `Table ${item.tableId}` : undefined),
          orderTypeId: Number(item.orderTypeId ?? item.OrderTypeId ?? 1),
          orderTypeName: item.orderTypeName ?? item.OrderTypeName ?? (item.orderTypeId === 2 ? 'Takeaway' : item.orderTypeId === 3 ? 'Delivery' : 'Dine-In'),
          subtotal: effectiveSubtotal,
          discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0),
          cgst: Number(item.cgst ?? item.Cgst ?? item.cgstAmount ?? item.CgstAmount ?? 0),
          sgst: Number(item.sgst ?? item.Sgst ?? item.sgstAmount ?? item.SgstAmount ?? 0),
          totalAmount: effectiveTotalAmount,
          tenderedAmount: item.tenderedAmount ?? item.TenderedAmount ? Number(item.tenderedAmount ?? item.TenderedAmount) : undefined,
          changeAmount: item.changeAmount ?? item.ChangeAmount ? Number(item.changeAmount ?? item.ChangeAmount) : undefined,
          settledBy: item.settledBy ?? item.SettledBy ? Number(item.settledBy ?? item.SettledBy) : undefined,
          settledDateUtc: item.settledDateUtc ?? item.SettledDateUtc ?? undefined,
          billingMode: item.billingMode ?? item.BillingMode ?? undefined,
          paidAmount: Number(item.paidAmount ?? item.PaidAmount ?? 0),
          pendingAmount: Number(item.pendingAmount ?? item.PendingAmount ?? 0),
          commission: Number(item.commission ?? item.Commission ?? 0),
          paymentMode: String(item.paymentMode ?? item.PaymentMode ?? 'CASH'),
          paymentStatus: String(item.paymentStatus ?? item.PaymentStatus ?? 'Pending'),
          status: String(item.status ?? item.Status ?? item.orderStatus ?? item.OrderStatus ?? 'Placed'),
          createdAt: String(item.createdAt ?? item.CreatedAt ?? item.orderDate ?? item.OrderDate ?? new Date().toISOString()),
          pickupToken: item.pickupToken ?? item.PickupToken ?? (item.tokenNumber ? String(item.tokenNumber) : (item.TokenNumber ? String(item.TokenNumber) : undefined)),
          tokenNumber: item.tokenNumber ?? item.TokenNumber ?? item.token ?? item.Token ?? undefined,
          gstNumber: item.gstNumber ?? item.GstNumber ?? item.gstin ?? item.Gstin ?? undefined,
          items: parsedItems,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * GET /api/Order/Table/{tableId}/Active
   * Fetches the live running order and itemized bill for a specific table
   */
  async getActiveOrderByTable(tableId: number, restaurantId?: number): Promise<OrderMaster | null> {
    try {
      const headers: Record<string, string> = {};
      if (restaurantId && restaurantId > 0) {
        headers['X-Restaurant-Id'] = restaurantId.toString();
      }
      const response = await apiClient.get(`/Order/Table/${tableId}/Active`, {
        headers,
        params: restaurantId ? { restaurantId } : undefined,
      });
      const data = response.data;
      const raw = data?.data ?? data;
      if (!raw) return null;

      const rawItems = raw.items ?? raw.Items ?? raw.orderDetails ?? raw.OrderDetails ?? [];
      const parsedItems = this.parseOrderItems(rawItems);
      const parsedItemsSum = parsedItems.reduce(
        (acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))),
        0
      );

      const rawSubtotal = Number(raw.subtotal ?? raw.Subtotal ?? raw.orderAmount ?? raw.OrderAmount ?? 0);
      const rawTotalAmount = Number(raw.totalAmount ?? raw.TotalAmount ?? raw.amount ?? raw.Amount ?? 0);

      const effectiveSubtotal = rawSubtotal > 0
        ? rawSubtotal
        : (parsedItemsSum > 0 ? parsedItemsSum : rawTotalAmount);

      const effectiveTotalAmount = rawTotalAmount > 0
        ? rawTotalAmount
        : (rawSubtotal > 0 ? rawSubtotal : parsedItemsSum);

      return {
        id: Number(raw.id ?? raw.Id ?? raw.orderId ?? raw.OrderId ?? 0),
        orderNumber: String(raw.orderNumber ?? raw.OrderNumber ?? raw.id ?? ''),
        restaurantId: Number(raw.restaurantId ?? raw.RestaurantId ?? restaurantId ?? 0),
        restaurantName: raw.restaurantName ?? raw.RestaurantName ?? undefined,
        customerName: String(raw.customerName ?? raw.CustomerName ?? raw.name ?? raw.Name ?? 'Walk-in Customer'),
        mobileNumber: String(raw.mobileNumber ?? raw.MobileNumber ?? raw.customerPhone ?? ''),
        tableId: raw.tableId ?? raw.TableId ?? tableId,
        tableName: raw.tableName ?? raw.TableName ?? `Table ${tableId}`,
        source: raw.source ?? raw.Source ?? 'Dine-In',
        orderTypeId: Number(raw.orderTypeId ?? raw.OrderTypeId ?? 1),
        orderTypeName: raw.orderTypeName ?? raw.OrderTypeName ?? 'Dine-In',
        subtotal: effectiveSubtotal,
        discountAmount: Number(raw.discountAmount ?? raw.DiscountAmount ?? 0),
        cgst: Number(raw.cgst ?? raw.Cgst ?? raw.cgstAmount ?? raw.CgstAmount ?? 0),
        sgst: Number(raw.sgst ?? raw.Sgst ?? raw.sgstAmount ?? raw.SgstAmount ?? 0),
        totalAmount: effectiveTotalAmount,
        paidAmount: Number(raw.paidAmount ?? raw.PaidAmount ?? 0),
        pendingAmount: Number(raw.pendingAmount ?? raw.PendingAmount ?? 0),
        totalOrdersCount: Number(raw.totalOrdersCount ?? raw.TotalOrdersCount ?? 1),
        paidOrdersCount: Number(raw.paidOrdersCount ?? raw.PaidOrdersCount ?? 0),
        pendingOrdersCount: Number(raw.pendingOrdersCount ?? raw.PendingOrdersCount ?? 0),
        paymentMode: String(raw.paymentMode ?? raw.PaymentMode ?? 'CASH'),
        paymentStatus: String(raw.paymentStatus ?? raw.PaymentStatus ?? 'Pending'),
        status: String(raw.orderStatus ?? raw.OrderStatus ?? raw.status ?? 'Placed'),
        createdAt: String(raw.createdDateUtc ?? raw.CreatedDateUtc ?? raw.createdAt ?? new Date().toISOString()),
        pickupToken: raw.pickupToken ?? raw.PickupToken ?? (raw.tokenNumber ? String(raw.tokenNumber) : (raw.TokenNumber ? String(raw.TokenNumber) : undefined)),
        tokenNumber: raw.tokenNumber ?? raw.TokenNumber ?? raw.token ?? raw.Token ?? undefined,
        items: parsedItems,
      };
    } catch {
      return null;
    }
  }

  async getOrderById(orderId: number): Promise<OrderMaster> {
    return this.getOrder(orderId);
  }

  async getOrder(orderId: number): Promise<OrderMaster> {
    const response = await apiClient.get(`/Order/${orderId}`);
    const data = response.data;
    const raw = data?.data ?? data;

    const parsedItems = this.parseOrderItems(raw?.items ?? raw?.Items ?? raw?.orderDetails ?? raw?.OrderDetails ?? raw?.orderItems ?? raw?.OrderItems ?? raw?.itemsList ?? raw?.details ?? raw?.data);
    const parsedItemsSum = parsedItems.reduce(
      (acc, it) => acc + (Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))),
      0
    );

    const rawSubtotal = Number(raw?.subtotal ?? raw?.Subtotal ?? raw?.subTotal ?? raw?.SubTotal ?? raw?.orderAmount ?? raw?.OrderAmount ?? 0);
    const rawTotalAmount = Number(raw?.totalAmount ?? raw?.TotalAmount ?? raw?.amount ?? raw?.Amount ?? 0);

    const effectiveSubtotal = rawSubtotal > 0
      ? rawSubtotal
      : (parsedItemsSum > 0 ? parsedItemsSum : rawTotalAmount);

    const effectiveTotalAmount = rawTotalAmount > 0
      ? rawTotalAmount
      : (rawSubtotal > 0 ? rawSubtotal : parsedItemsSum);

    return {
      id: Number(raw?.id ?? raw?.Id ?? raw?.orderId ?? raw?.OrderId ?? orderId),
      orderNumber: String(raw?.orderNumber ?? raw?.OrderNumber ?? raw?.id ?? orderId),
      restaurantId: Number(raw?.restaurantId ?? raw?.RestaurantId ?? raw?.rId ?? raw?.RId ?? 0),
      restaurantName: raw?.restaurantName ?? raw?.RestaurantName ?? undefined,
      customerName: String(raw?.customerName ?? raw?.CustomerName ?? raw?.name ?? raw?.Name ?? 'Walk-in Customer'),
      mobileNumber: String(raw?.mobileNumber ?? raw?.MobileNumber ?? raw?.mobile ?? raw?.Mobile ?? ''),
      tableId: raw?.tableId ?? raw?.TableId ?? undefined,
      tableName: raw?.tableName ?? raw?.TableName ?? (raw?.tableId ? `Table ${raw?.tableId}` : undefined),
      source: raw?.source ?? raw?.Source ?? raw?.tableName ?? raw?.TableName ?? (raw?.tableId ? `Table ${raw?.tableId}` : undefined),
      orderTypeId: Number(raw?.orderTypeId ?? raw?.OrderTypeId ?? 1),
      orderTypeName: raw?.orderTypeName ?? raw?.OrderTypeName ?? (raw?.orderTypeId === 2 ? 'Takeaway' : raw?.orderTypeId === 3 ? 'Delivery' : 'Dine-In'),
      subtotal: effectiveSubtotal,
      discountAmount: Number(raw?.discountAmount ?? raw?.DiscountAmount ?? 0),
      cgst: Number(raw?.cgst ?? raw?.Cgst ?? raw?.cgstAmount ?? raw?.CgstAmount ?? 0),
      sgst: Number(raw?.sgst ?? raw?.Sgst ?? raw?.sgstAmount ?? raw?.SgstAmount ?? 0),
      totalAmount: effectiveTotalAmount,
      tenderedAmount: raw?.tenderedAmount ?? raw?.TenderedAmount ? Number(raw?.tenderedAmount ?? raw?.TenderedAmount) : undefined,
      changeAmount: raw?.changeAmount ?? raw?.ChangeAmount ? Number(raw?.changeAmount ?? raw?.ChangeAmount) : undefined,
      settledBy: raw?.settledBy ?? raw?.SettledBy ? Number(raw?.settledBy ?? raw?.SettledBy) : undefined,
      settledDateUtc: raw?.settledDateUtc ?? raw?.SettledDateUtc ?? undefined,
      billingMode: raw?.billingMode ?? raw?.BillingMode ?? undefined,
      commission: Number(raw?.commission ?? raw?.Commission ?? 0),
      paymentMode: String(raw?.paymentMode ?? raw?.PaymentMode ?? 'CASH'),
      paymentStatus: String(raw?.paymentStatus ?? raw?.PaymentStatus ?? 'Pending'),
      status: String(raw?.status ?? raw?.Status ?? raw?.orderStatus ?? raw?.OrderStatus ?? 'Placed'),
      createdAt: String(raw?.createdAt ?? raw?.CreatedAt ?? raw?.createdDateUtc ?? raw?.CreatedDateUtc ?? raw?.orderDate ?? raw?.OrderDate ?? new Date().toISOString()),
      pickupToken: raw?.pickupToken ?? raw?.PickupToken ?? (raw?.tokenNumber ? String(raw?.tokenNumber) : (raw?.TokenNumber ? String(raw?.TokenNumber) : undefined)),
      tokenNumber: raw?.tokenNumber ?? raw?.TokenNumber ?? raw?.token ?? raw?.Token ?? undefined,
      gstNumber: raw?.gstNumber ?? raw?.GstNumber ?? raw?.gstin ?? raw?.Gstin ?? undefined,
      address: raw?.address ?? raw?.Address ?? undefined,
      city: raw?.city ?? raw?.City ?? undefined,
      state: raw?.state ?? raw?.State ?? undefined,
      contactNumber: raw?.contactNumber ?? raw?.ContactNumber ?? raw?.contactPhone ?? raw?.ContactPhone ?? undefined,
      contactPhone: raw?.contactPhone ?? raw?.ContactPhone ?? raw?.contactNumber ?? raw?.ContactNumber ?? undefined,
      logoUrl: raw?.logoUrl ?? raw?.LogoUrl ?? undefined,
      imageUrl: raw?.imageUrl ?? raw?.ImageUrl ?? undefined,
      items: this.parseOrderItems(raw?.items ?? raw?.Items ?? raw?.orderDetails ?? raw?.OrderDetails ?? raw?.orderItems ?? raw?.OrderItems ?? raw?.itemsList ?? raw?.details ?? raw?.data),
    };
  }

  async placeOrder(order: PlaceOrderRequest | Partial<OrderMaster>): Promise<number> {
    const payload: any = {
      restaurantId: (order as any).restaurantId ?? (order as any).rId,
      name: (order as any).name || (order as any).customerName || 'Walk-in Customer',
      mobileNumber: order.mobileNumber || '',
      remarks: (order as any).remarks || '',
      isHomeDelivery: (order as any).isHomeDelivery || false,
      orderTypeId: order.orderTypeId || 1,
      tableId: order.tableId || null,
      tableNumber: (order as any).tableNumber || undefined,
      sectionName: (order as any).sectionName || undefined,
      orderStatus: (order as any).orderStatus || 'Confirmed',
      paymentStatus: (order as any).paymentStatus || ((order as any).billingMode === 'POST_PAID' ? 'Pending' : undefined),
      billingMode: (order as any).billingMode || undefined,
      source: (order as any).source || 'POS_ADMIN',
      deviceId: (order as any).deviceId || 'ADMIN_APP',
      paymentMode: (order as any).billingMode === 'POST_PAID' || (order as any).paymentStatus === 'Pending'
        ? ((order as any).paymentMode || 'PENDING')
        : ((order as any).paymentMode || 'CASH'),
      tenderedAmount: (order as any).tenderedAmount ?? undefined,
      changeAmount: (order as any).changeAmount ?? undefined,
      cgst: (order as any).cgst || 0,
      sgst: (order as any).sgst || 0,
      totalAmount: order.totalAmount || 0,
      items: (order as any).items || [],
    };

    const response = await apiClient.post('/Order/PlaceOrder', payload);
    return response.data?.orderId || response.data?.id || 0;
  }

  async addItemToOrder(orderId: number, itemId: number, quantity: number): Promise<boolean> {
    const response = await apiClient.post(`/Order/${orderId}/Item`, { itemId, quantity });
    return response.status === 200;
  }

  /**
   * POST /api/Order/{orderId}/Status
   * Updates the workflow status of an order (e.g. Confirmed, Preparing, Ready, Served)
   */
  async updateOrderStatus(orderId: number, status: string): Promise<boolean> {
    try {
      const response = await apiClient.post(`/Order/${orderId}/Status`, { status });
      return response.status === 200 || response.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * POST /api/Order/{orderId}/Status
   * Cancels / voids an order with optional reason
   */
  async cancelOrder(orderId: number, reason?: string): Promise<boolean> {
    try {
      const response = await apiClient.post(`/Order/${orderId}/Status`, {
        status: 'Cancelled',
        reason: reason || 'Cancelled by staff',
      });
      return response.status === 200 || response.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * GET /api/Order/Statuses
   * Fetches the official order statuses list from the backend
   */
  async getOrderStatuses(): Promise<OrderStatusOption[]> {
    try {
      const response = await apiClient.get('/Order/Statuses');
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.statuses)
        ? data.statuses
        : Array.isArray(data?.data)
        ? data.data
        : [];

      if (rawList && rawList.length > 0) {
        return rawList.map((item: any) => ({
          key: String(item.key ?? item.Key ?? item),
          label: String(item.label ?? item.Label ?? item.key ?? item.Key ?? item),
          category: item.category ?? item.Category ?? undefined,
          displayOrder: Number(item.displayOrder ?? item.DisplayOrder ?? 0),
        }));
      }

      return [
        { key: 'ALL', label: 'All', category: 'ALL', displayOrder: 0 },
        { key: 'Placed', label: 'Placed', category: 'ACTIVE', displayOrder: 1 },
        { key: 'Confirmed', label: 'Confirmed', category: 'ACTIVE', displayOrder: 2 },
        { key: 'Preparing', label: 'Preparing', category: 'ACTIVE', displayOrder: 3 },
        { key: 'Ready', label: 'Ready', category: 'ACTIVE', displayOrder: 4 },
        { key: 'Served', label: 'Served', category: 'ACTIVE', displayOrder: 5 },
        { key: 'Delivered', label: 'Delivered', category: 'ACTIVE', displayOrder: 6 },
        { key: 'Completed', label: 'Completed', category: 'TERMINAL', displayOrder: 7 },
        { key: 'Cancelled', label: 'Cancelled', category: 'TERMINAL', displayOrder: 8 },
        { key: 'Settled', label: 'Settled', category: 'TERMINAL', displayOrder: 9 },
      ];
    } catch {
      return [
        { key: 'ALL', label: 'All', category: 'ALL', displayOrder: 0 },
        { key: 'Placed', label: 'Placed', category: 'ACTIVE', displayOrder: 1 },
        { key: 'Confirmed', label: 'Confirmed', category: 'ACTIVE', displayOrder: 2 },
        { key: 'Preparing', label: 'Preparing', category: 'ACTIVE', displayOrder: 3 },
        { key: 'Ready', label: 'Ready', category: 'ACTIVE', displayOrder: 4 },
        { key: 'Served', label: 'Served', category: 'ACTIVE', displayOrder: 5 },
        { key: 'Delivered', label: 'Delivered', category: 'ACTIVE', displayOrder: 6 },
        { key: 'Completed', label: 'Completed', category: 'TERMINAL', displayOrder: 7 },
        { key: 'Cancelled', label: 'Cancelled', category: 'TERMINAL', displayOrder: 8 },
        { key: 'Settled', label: 'Settled', category: 'TERMINAL', displayOrder: 9 },
      ];
    }
  }

  /**
   * GET /api/OrderTypeMaster/restaurant/{restaurantId}/active
   * Fetches active order type channels resolving subscription entitlements and restaurant configurations
   */
  async getActiveOrderTypes(restaurantId: number): Promise<ActiveOrderType[]> {
    if (!restaurantId || restaurantId <= 0) {
      return [
        { id: 4, code: 'COUNTER', typeName: 'Counter', configKey: 'IsCounterOrderingEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 1 },
        { id: 1, code: 'DINE_IN', typeName: 'Dine-in', configKey: 'IsTableOrderingEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 2 },
        { id: 2, code: 'TAKEAWAY', typeName: 'Takeaway', configKey: 'IsSelfPickupEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 3 },
      ];
    }
    try {
      const response = await apiClient.get(`/OrderTypeMaster/restaurant/${restaurantId}/active`);
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          id: Number(item?.id ?? item?.Id ?? 0),
          code: String(item?.code ?? item?.Code ?? ''),
          typeName: String(item?.typeName ?? item?.TypeName ?? ''),
          description: item?.description ?? item?.Description,
          configKey: String(item?.configKey ?? item?.ConfigKey ?? ''),
          isAllowedByPlan: Boolean(item?.isAllowedByPlan ?? item?.IsAllowedByPlan ?? true),
          isEnabledByStore: Boolean(item?.isEnabledByStore ?? item?.IsEnabledByStore ?? true),
          isActive: Boolean(item?.isActive ?? item?.IsActive ?? true),
          displayOrder: Number(item?.displayOrder ?? item?.DisplayOrder ?? 0),
        }));
      }
    } catch (err) {
      console.warn('Failed to load active order types:', err);
    }
    return [
      { id: 4, code: 'COUNTER', typeName: 'Counter', configKey: 'IsCounterOrderingEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 1 },
      { id: 1, code: 'DINE_IN', typeName: 'Dine-in', configKey: 'IsTableOrderingEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 2 },
      { id: 2, code: 'TAKEAWAY', typeName: 'Takeaway', configKey: 'IsSelfPickupEnabled', isAllowedByPlan: true, isEnabledByStore: true, isActive: true, displayOrder: 3 },
    ];
  }

  /**
   * POST /api/Order/{orderId}/Settle
   * Cashier settles the order amount with payment mode, discount, and tendered cash calculation
   */
  async settleOrder(orderId: number, data?: SettleOrderRequest): Promise<SettleOrderResponse> {
    const numericId = (() => {
      if (typeof orderId === 'number' && !isNaN(orderId) && orderId > 0) return orderId;
      if (typeof (orderId as any) === 'string') {
        const match = (orderId as any).match(/^notif_(\d+)_/);
        if (match && match[1]) return parseInt(match[1], 10);
        const parsed = parseInt(String(orderId), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      if (data?.orderId && typeof data.orderId === 'number' && data.orderId > 0) return data.orderId;
      return 0;
    })();

    if (!numericId || numericId <= 0) {
      throw new Error(`Invalid order ID for settlement: ${orderId}`);
    }

    const payload = {
      orderId: numericId,
      paymentMode: data?.paymentMode || 'CASH',
      discountAmount: typeof data?.discountAmount === 'number' ? data.discountAmount : 0,
      tenderedAmount: typeof data?.tenderedAmount === 'number' ? data.tenderedAmount : undefined,
      changeAmount: typeof data?.changeAmount === 'number' ? data.changeAmount : undefined,
      billingMode: data?.billingMode || undefined,
      remarks: data?.remarks || '',
      orderStatus: data?.orderStatus || 'Settled',
    };

    const response = await apiClient.post(`/Order/${numericId}/Settle`, payload);
    const respData = response.data?.data ?? response.data;

    return {
      success: Boolean(respData?.success ?? (response.status === 200 || response.status === 201)),
      statusCode: Number(respData?.statusCode ?? response.status),
      isAlreadySettled: Boolean(respData?.isAlreadySettled),
      orderId: Number(respData?.orderId ?? orderId),
      restaurantId: Number(respData?.restaurantId ?? 0),
      tableId: respData?.tableId ? Number(respData.tableId) : undefined,
      tableName: respData?.tableName ? String(respData.tableName) : undefined,
      customerName: respData?.customerName ? String(respData.customerName) : undefined,
      mobileNumber: respData?.mobileNumber ? String(respData.mobileNumber) : undefined,
      orderAmount: Number(respData?.orderAmount ?? 0),
      discountAmount: Number(respData?.discountAmount ?? 0),
      cgst: Number(respData?.cgst ?? 0),
      sgst: Number(respData?.sgst ?? 0),
      totalAmount: Number(respData?.totalAmount ?? 0),
      tenderedAmount: respData?.tenderedAmount ? Number(respData.tenderedAmount) : undefined,
      changeAmount: respData?.changeAmount ? Number(respData.changeAmount) : undefined,
      paymentMode: String(respData?.paymentMode ?? payload.paymentMode),
      paymentStatus: String(respData?.paymentStatus ?? 'PAID'),
      orderStatus: String(respData?.orderStatus ?? 'Settled'),
      settledBy: Number(respData?.settledBy ?? 0),
      settledDateUtc: respData?.settledDateUtc ? String(respData.settledDateUtc) : new Date().toISOString(),
      message: String(respData?.message ?? 'Order settled successfully.'),
    };
  }

  /**
   * POST /api/Order/Table/{tableId}/Settle
   * Cashier settles the active table session
   */
  async settleTable(tableId: number): Promise<boolean> {
    try {
      const response = await apiClient.post(`/Order/Table/${tableId}/Settle`);
      return response.status === 200 || response.status === 204;
    } catch {
      return false;
    }
  }
}
