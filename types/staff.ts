export interface RoleMaster {
  roleId: number;
  id?: number;
  roleName: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface StaffMember {
  staffId?: number;
  id?: number;
  userId?: number;
  restaurantId: number;
  name: string;
  mobile: string;
  email?: string;
  roleId: number;
  roleName?: string;
  employeeCode?: string;
  isActive?: boolean;
  joinedOn?: string;
}

export interface CreateStaffRequest {
  restaurantId: number;
  name: string;
  mobile: string;
  email?: string;
  roleId: number;
  employeeCode?: string;
  password?: string;
}
