import { IRoleRepository } from '../../domain/repositories/IRoleRepository';
import { RoleRemoteDataSource } from '../datasources/RoleRemoteDataSource';
import { RoleMaster, AssignRoleRequest } from '../../domain/models/Role';
import { StaffMember, CreateStaffRequest } from '../../domain/models/StaffMember';

export class RoleRepositoryImpl implements IRoleRepository {
  constructor(private remoteDataSource: RoleRemoteDataSource) {}

  async getAllRoles(): Promise<RoleMaster[]> {
    return await this.remoteDataSource.getAllRoles();
  }

  async assignRole(request: AssignRoleRequest): Promise<boolean> {
    return await this.remoteDataSource.assignRole(request);
  }

  async toggleRoleStatus(userRoleId: number, isActive: boolean): Promise<boolean> {
    return await this.remoteDataSource.toggleRoleStatus(userRoleId, isActive);
  }

  async getStaffMembers(restaurantId: number): Promise<StaffMember[]> {
    return await this.remoteDataSource.getStaffMembers(restaurantId);
  }

  async registerStaffMember(staff: CreateStaffRequest): Promise<StaffMember> {
    return await this.remoteDataSource.registerStaffMember(staff);
  }

  async updateStaffMember(staffId: number, staff: Partial<CreateStaffRequest>): Promise<StaffMember> {
    return await this.remoteDataSource.updateStaffMember(staffId, staff);
  }

  async deleteStaffMember(staffId: number): Promise<boolean> {
    return await this.remoteDataSource.deleteStaffMember(staffId);
  }
}

