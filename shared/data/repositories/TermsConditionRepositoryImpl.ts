import { ITermsConditionRepository } from '../../domain/repositories/ITermsConditionRepository';
import { TermsConditionRemoteDataSource } from '../datasources/TermsConditionRemoteDataSource';

export class TermsConditionRepositoryImpl implements ITermsConditionRepository {
  constructor(private dataSource: TermsConditionRemoteDataSource) {}

  async getTermsConditionStatus(userId: number, token?: string): Promise<boolean> {
    return this.dataSource.getTermsConditionStatus(userId, token);
  }

  async acceptTermsCondition(userId: number, token?: string): Promise<boolean> {
    return this.dataSource.acceptTermsCondition(userId, token);
  }
}
