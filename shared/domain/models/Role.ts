export interface RoleMaster {
  id: number;
  roleName: string;
  description?: string;
  isActive?: boolean;
}

export interface AssignRoleRequest {
  userId: number;
  roleId: number;
  restId?: number;
  restaurantId?: number;
  isDefault?: boolean;
}
