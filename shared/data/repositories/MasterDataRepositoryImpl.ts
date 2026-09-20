import { IMasterDataRepository } from '../../domain/repositories/IMasterDataRepository';
import { MasterDataRemoteDataSource } from '../datasources/MasterDataRemoteDataSource';
import { StateMaster, UnitMaster } from '../../domain/models/MasterData';

export class MasterDataRepositoryImpl implements IMasterDataRepository {
  constructor(private remoteDataSource: MasterDataRemoteDataSource) {}

  async getStates(): Promise<StateMaster[]> {
    return await this.remoteDataSource.getStates();
  }

  async getUnits(): Promise<UnitMaster[]> {
    return await this.remoteDataSource.getUnits();
  }

  async uploadImage(fileUri: string): Promise<string> {
    return await this.remoteDataSource.uploadImage(fileUri);
  }
}
