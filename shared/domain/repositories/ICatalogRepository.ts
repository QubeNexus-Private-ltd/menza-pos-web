import { Category } from '../models/Category';
import { MenuItem } from '../models/Item';

export interface ICatalogRepository {
  getCategories(): Promise<Category[]>;
  getMenuItems(): Promise<MenuItem[]>;
  updateItemStatus(itemId: number, isAvailable: boolean): Promise<boolean>;
}
