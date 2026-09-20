import { StateMaster, UnitMaster } from '../models/MasterData';

export interface IMasterDataRepository {
  getStates(): Promise<StateMaster[]>;
  getUnits(): Promise<UnitMaster[]>;
  uploadImage(fileUri: string): Promise<string>;
}
