import { RoleMaster, AssignRoleRequest } from '../models/Role';
import { StaffMember, CreateStaffRequest } from '../models/StaffMember';

export interface IRoleRepository {
  getAllRoles(): Promise<RoleMaster[]>;
  assignRole(request: AssignRoleRequest): Promise<boolean>;
  toggleRoleStatus(userRoleId: number, isActive: boolean, restaurantId?: number, userId?: number): Promise<boolean>;
  getStaffMembers(restaurantId: number): Promise<StaffMember[]>;
  registerStaffMember(staff: CreateStaffRequest): Promise<StaffMember>;
  updateStaffMember(staffId: number, staff: Partial<CreateStaffRequest> & { restaurantId?: number; userId?: number; isActive?: boolean }): Promise<StaffMember>;
  deleteStaffMember(staffId: number, restaurantId?: number, userId?: number): Promise<boolean>;
}

