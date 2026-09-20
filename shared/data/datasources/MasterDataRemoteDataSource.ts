import { apiClient } from '../../core/network/apiClient';
import { StateMaster, UnitMaster, OrderTypeMaster } from '../../domain/models/MasterData';

export class MasterDataRemoteDataSource {
  async getStates(): Promise<StateMaster[]> {
    const response = await apiClient.get('/StateMaster');
    const data = response.data;
    const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
    return list.map((item: any, idx: number) => ({
      id: item.id || idx + 1,
      stateCode: item.stateCode || '',
      stateDesc: item.stateDesc || item.stateName || '',
      stateName: item.stateDesc || item.stateName || '',
    })).filter((item: StateMaster) => item.stateDesc.trim().length > 0);
  }

  async getUnits(): Promise<UnitMaster[]> {
    try {
      const response = await apiClient.get('/UnitMaster');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list.map((item: any, idx: number) => ({
        id: item.id || item.unitId || idx + 1,
        unitName: item.unitName || item.name || '',
        shortName: item.shortName || item.code || '',
      }));
    } catch {
      return [
        { id: 1, unitName: 'Plate', shortName: 'Plt' },
        { id: 2, unitName: 'Portion', shortName: 'Ptn' },
        { id: 3, unitName: 'Piece (Pc)', shortName: 'Pc' },
        { id: 4, unitName: 'Bowl', shortName: 'Bwl' },
        { id: 5, unitName: 'Bottle/Glass', shortName: 'Gls' },
        { id: 6, unitName: 'Serving/Pack', shortName: 'Pck' },
      ];
    }
  }

  async createUnit(unitName: string, unitDescription: string = ''): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/UnitMaster', {
        unitName,
        unitDescription,
      });
      return { success: response.status === 200 || response.status === 201, message: response.data?.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Failed to create unit';
      return { success: false, message: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
  }

  async getOrderTypes(): Promise<OrderTypeMaster[]> {
    try {
      const response = await apiClient.get('/OrderTypeMaster');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list.map((item: any) => ({
        id: item.id || item.Id || 0,
        typeName: item.typeName || item.TypeName || 'Ordering Channel',
        description: item.description || item.Description || '',
        isActive: item.isActive ?? item.IsActive ?? true,
      }));
    } catch {
      return [
        { id: 1, typeName: 'Table QR Ordering', description: 'In-restaurant dining via table QR scan', isActive: true },
        { id: 2, typeName: 'Self Pickup / Takeaway', description: 'Customer takeaway & self pickup orders', isActive: true },
        { id: 3, typeName: 'Direct Home Delivery', description: 'Doorstep delivery ordered via web/app', isActive: true },
        { id: 4, typeName: 'Counter POS Ordering', description: 'Express counter POS orders', isActive: true },
      ];
    }
  }

  async getMasterOrderConfigs(): Promise<any[]> {
    try {
      const response = await apiClient.get('/OrderConfigMaster');
      return response.data || [];
    } catch {
      return [];
    }
  }

  async uploadImage(fileUri: string): Promise<string> {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    formData.append('File', {
      uri: fileUri,
      name: filename,
      type: type,
    } as any);

    const response = await apiClient.post('/Image/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data?.url || response.data?.Url || '';
  }
}
