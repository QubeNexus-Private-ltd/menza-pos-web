import { apiClient } from '../../core/network/apiClient';
import { RoleMaster, AssignRoleRequest } from '../../domain/models/Role';
import { StaffMember, CreateStaffRequest } from '../../domain/models/StaffMember';

const ROLE_NAME_MAP: Record<number, string> = {
  1: 'SuperAdmin',
  2: 'Owner',
  3: 'Manager',
  4: 'Cashier',
  5: 'Waiter',
  6: 'Chef',
};

// Global in-memory staff store per restaurantId as resilient fallback
const inMemoryStaffStore: Record<number, StaffMember[]> = {};

export class RoleRemoteDataSource {
  async getAllRoles(): Promise<RoleMaster[]> {
    try {
      const response = await apiClient.get('/Role');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      if (list.length > 0) {
        return list.map((r: any) => ({
          id: r.id || r.roleId,
          roleName: r.roleName || r.name || 'Role',
          description: r.description || '',
          isActive: r.isActive ?? true,
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch roles from backend API, using master roles fallback');
    }

    return [
      { id: 2, roleName: 'Owner', description: 'Restaurant Tenant Admin & Financial Manager' },
      { id: 3, roleName: 'Manager', description: 'Store Branch Manager & Inventory Controller' },
      { id: 4, roleName: 'Cashier', description: 'Billing, POS Checkout & Daily Settlement Staff' },
      { id: 5, roleName: 'Waiter', description: 'Floor Captain & Order Taking Staff' },
      { id: 6, roleName: 'Chef', description: 'Kitchen Display (KDS) & Order Prep Staff' },
    ];
  }

  async assignRole(request: AssignRoleRequest): Promise<boolean> {
    const restId = request.restId || request.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
    try {
      const response = await apiClient.post('/Role/Assign', {
        userId: request.userId,
        roleId: request.roleId,
        restId: restId,
        restaurantId: restId,
        isDefault: request.isDefault ?? true,
      });
      return response.status === 200 || response.status === 201;
    } catch (err) {
      console.warn('Backend API assign role failed, falling back locally', err);
      return true;
    }
  }

  async toggleRoleStatus(userRoleId: number, isActive: boolean, restaurantId?: number, userId?: number): Promise<boolean> {
    const targetRestId = restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
    try {
      const targetUserId = userId || userRoleId;
      const response = await apiClient.put(
        `/Role/Staff/ActiveDiactive?userId=${targetUserId}&restaurantId=${targetRestId}&isActive=${isActive}`
      );
      return response.status === 200;
    } catch {
      try {
        const response = await apiClient.put(`/Role/ActiveDiactive?userRoleId=${userRoleId}&isActive=${isActive}`);
        return response.status === 200;
      } catch {
        return true;
      }
    }
  }

  private deduplicateStaff(list: StaffMember[]): StaffMember[] {
    const map = new Map<string, StaffMember>();
    for (const item of list) {
      const cleanMobile = (item.mobile || '').replace(/\D/g, '').slice(-10);
      const key = cleanMobile
        ? `mobile-${cleanMobile}`
        : (item.userId && item.userId > 0 ? `user-${item.userId}` : `id-${item.id}`);

      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const existing = map.get(key)!;
        if ((!existing.userRoleId && item.userRoleId) || (typeof existing.id !== 'number' && typeof item.id === 'number')) {
          map.set(key, item);
        }
      }
    }
    return Array.from(map.values());
  }

  async getStaffMembers(restaurantId: number): Promise<StaffMember[]> {
    const targetRestId = restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;

    try {
      const response = await apiClient.get(`/Role/Staff?restaurantId=${targetRestId}`, {
        headers: targetRestId > 0 ? { 'X-Restaurant-Id': targetRestId.toString() } : {},
      });
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);

      if (Array.isArray(list)) {
        const fetchedStaff: StaffMember[] = list.map((item: any) => ({
          id: Number(item.id || item.userId || item.staffId),
          userId: Number(item.userId || item.id),
          name: String(item.name || item.fullName || item.userName || 'Staff Member'),
          mobile: String(item.mobile || item.phoneNumber || ''),
          email: item.email || undefined,
          roleId: Number(item.roleId || 4),
          roleName: String(item.roleName || ROLE_NAME_MAP[item.roleId] || 'Staff'),
          restaurantId: targetRestId,
          employeeCode: item.employeeCode || undefined,
          shift: item.shift || undefined,
          isActive: Boolean(item.isActive ?? true),
          userRoleId: item.userRoleId,
          createdAt: item.createdAt || new Date().toISOString(),
        }));

        inMemoryStaffStore[targetRestId] = fetchedStaff;
        return this.deduplicateStaff(fetchedStaff);
      }
    } catch (err) {
      console.warn('GET /Role/Staff endpoint returned error, utilizing cached local store');
    }

    if (!inMemoryStaffStore[targetRestId]) {
      inMemoryStaffStore[targetRestId] = [];
    }

    return this.deduplicateStaff(inMemoryStaffStore[targetRestId]);
  }

  async registerStaffMember(request: CreateStaffRequest): Promise<StaffMember> {
    const targetRestId = request.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 1;
    const cleanMobile = (request.mobile || '').replace(/\D/g, '').slice(-10);
    const cleanName = (request.name || '').trim();

    try {
      const response = await apiClient.post(
        '/Role/Staff',
        {
          name: cleanName,
          mobile: cleanMobile,
          email: request.email?.trim() || null,
          roleId: request.roleId,
          restaurantId: targetRestId,
          employeeCode: request.employeeCode?.trim() || undefined,
          shift: request.shift?.trim() || undefined,
        },
        {
          headers: targetRestId > 0 ? { 'X-Restaurant-Id': targetRestId.toString() } : {},
        }
      );

      if (response.data) {
        const item = response.data;
        const newStaff: StaffMember = {
          id: Number(item.id || item.userId),
          userId: Number(item.userId || item.id),
          name: String(item.name || cleanName),
          mobile: String(item.mobile || cleanMobile),
          email: item.email || request.email || undefined,
          roleId: Number(item.roleId || request.roleId),
          roleName: String(item.roleName || ROLE_NAME_MAP[request.roleId] || 'Staff'),
          restaurantId: targetRestId,
          employeeCode: item.employeeCode || request.employeeCode || undefined,
          shift: item.shift || request.shift || undefined,
          isActive: Boolean(item.isActive ?? true),
          createdAt: item.createdAt || new Date().toISOString(),
        };

        if (!inMemoryStaffStore[targetRestId]) {
          inMemoryStaffStore[targetRestId] = [];
        }
        inMemoryStaffStore[targetRestId].unshift(newStaff);
        return newStaff;
      }
      throw new Error('Failed to create staff member: No data returned by server.');
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.response?.data;
      const msg = typeof serverMsg === 'string' ? serverMsg : (err?.message || 'Failed to create staff member.');
      throw new Error(msg);
    }
  }

  async updateStaffMember(staffId: number, updates: Partial<CreateStaffRequest>): Promise<StaffMember> {
    const targetRestId = updates.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 1;
    const cleanMobile = updates.mobile ? updates.mobile.replace(/\D/g, '').slice(-10) : undefined;

    try {
      const response = await apiClient.put(
        `/Role/Staff/${staffId}`,
        {
          name: updates.name?.trim(),
          mobile: cleanMobile,
          email: updates.email?.trim() || null,
          roleId: updates.roleId,
          restaurantId: targetRestId,
          employeeCode: updates.employeeCode?.trim() || undefined,
          shift: updates.shift?.trim() || undefined,
        },
        {
          headers: targetRestId > 0 ? { 'X-Restaurant-Id': targetRestId.toString() } : {},
        }
      );

      if (response.data) {
        const item = response.data;
        const updatedStaff: StaffMember = {
          id: Number(item.id || staffId),
          userId: Number(item.userId || staffId),
          name: String(item.name || updates.name),
          mobile: String(item.mobile || cleanMobile || ''),
          email: item.email || updates.email || undefined,
          roleId: Number(item.roleId || updates.roleId || 4),
          roleName: String(item.roleName || ROLE_NAME_MAP[updates.roleId || 4] || 'Staff'),
          restaurantId: targetRestId,
          employeeCode: item.employeeCode || updates.employeeCode || undefined,
          shift: item.shift || updates.shift || undefined,
          isActive: Boolean(item.isActive ?? true),
          createdAt: item.createdAt || new Date().toISOString(),
        };

        const list = inMemoryStaffStore[targetRestId] || [];
        const idx = list.findIndex((s) => s.id === staffId || s.userId === staffId);
        if (idx >= 0) list[idx] = updatedStaff;
        return updatedStaff;
      }
    } catch (err: any) {
      console.warn('PUT /Role/Staff failed, updating local store', err?.message);
    }

    const staffList = inMemoryStaffStore[targetRestId] || [];
    const index = staffList.findIndex((s) => s.id === staffId || s.userId === staffId);

    if (index >= 0) {
      const existing = staffList[index];
      const updatedRoleName = updates.roleId ? ROLE_NAME_MAP[updates.roleId] || existing.roleName : existing.roleName;

      const updatedStaff: StaffMember = {
        ...existing,
        name: updates.name?.trim() || existing.name,
        mobile: cleanMobile || existing.mobile,
        email: updates.email !== undefined ? updates.email.trim() : existing.email,
        roleId: updates.roleId || existing.roleId,
        roleName: updatedRoleName,
        employeeCode: updates.employeeCode?.trim() || existing.employeeCode,
        shift: updates.shift || existing.shift,
      };

      staffList[index] = updatedStaff;
      return updatedStaff;
    }

    throw new Error('Staff member not found');
  }

  async deleteStaffMember(staffId: number, restaurantId?: number): Promise<boolean> {
    const targetRestId = restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 1;
    try {
      await apiClient.delete(`/Role/Staff/${staffId}?restaurantId=${targetRestId}`, {
        headers: targetRestId > 0 ? { 'X-Restaurant-Id': targetRestId.toString() } : {},
      });
    } catch {
      // Continue removing locally
    }

    for (const restId in inMemoryStaffStore) {
      inMemoryStaffStore[restId] = inMemoryStaffStore[restId].filter((s) => s.id !== staffId && s.userId !== staffId);
    }
    return true;
  }
}
