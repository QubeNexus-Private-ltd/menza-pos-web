import { TermsConditionStatus } from '../models/TermsCondition';

export interface ITermsConditionRepository {
  getTermsConditionStatus(userId: number, token?: string): Promise<boolean>;
  acceptTermsCondition(userId: number, token?: string): Promise<boolean>;
}
