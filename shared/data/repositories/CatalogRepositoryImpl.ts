import { ICatalogRepository } from '../../domain/repositories/ICatalogRepository';
import { CatalogRemoteDataSource } from '../datasources/CatalogRemoteDataSource';
import { Category } from '../../domain/models/Category';
import { MenuItem } from '../../domain/models/Item';

export class CatalogRepositoryImpl implements ICatalogRepository {
  constructor(private remoteDataSource: CatalogRemoteDataSource) {}

  async getCategories(): Promise<Category[]> {
    return await this.remoteDataSource.getCategories();
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return await this.remoteDataSource.getMenuItems();
  }

  async updateItemStatus(itemId: number, isAvailable: boolean): Promise<boolean> {
    return await this.remoteDataSource.updateItemStatus(itemId, isAvailable);
  }
}
