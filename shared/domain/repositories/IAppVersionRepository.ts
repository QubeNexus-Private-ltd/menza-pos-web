import { AppVersionCheckRequest, AppVersionCheckResponse } from '../models/AppVersion';

export interface IAppVersionRepository {
  checkVersion(request?: Partial<AppVersionCheckRequest>): Promise<AppVersionCheckResponse>;
}
