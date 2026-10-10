import { IAppVersionRepository } from '../../domain/repositories/IAppVersionRepository';
import { AppVersionRemoteDataSource } from '../datasources/AppVersionRemoteDataSource';
import { AppVersionCheckRequest, AppVersionCheckResponse } from '../../domain/models/AppVersion';

export class AppVersionRepositoryImpl implements IAppVersionRepository {
  constructor(private remoteDataSource: AppVersionRemoteDataSource) {}

  async checkVersion(request?: Partial<AppVersionCheckRequest>): Promise<AppVersionCheckResponse> {
    return await this.remoteDataSource.checkVersion(request);
  }
}
