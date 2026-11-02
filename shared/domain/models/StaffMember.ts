export interface StaffMember {
  id: number;
  userId?: number;
  name: string;
  mobile: string;
  email?: string;
  roleId: number;
  roleName: string;
  restaurantId: number;
  employeeCode?: string;
  shift?: string;
  isActive: boolean;
  userRoleId?: number;
  createdAt?: string;
  staffPin?: string;
  isPinLoginAllowed?: boolean;
}

export interface CreateStaffRequest {
  name: string;
  mobile: string;
  email?: string;
  roleId: number;
  restaurantId: number;
  employeeCode?: string;
  shift?: string;
  pin?: string;
}
