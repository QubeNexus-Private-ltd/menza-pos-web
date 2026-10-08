import { apiClient } from '@/lib/api/client';
import { StaffMember, RoleMaster, CreateStaffRequest } from '@/types/staff';

export class StaffService {
  static async getStaff(restaurantId: number): Promise<StaffMember[]> {
    const res = await apiClient.get<StaffMember[]>('/Staff', {
      params: { restaurantId },
    });
    return res.data || [];
  }

  static async createStaff(payload: CreateStaffRequest): Promise<boolean> {
    const res = await apiClient.post('/Staff', payload);
    return res.status === 200 || res.status === 201;
  }

  static async getRoles(): Promise<RoleMaster[]> {
    const res = await apiClient.get<RoleMaster[]>('/Role');
    return res.data || [];
  }
}
