import { apiClient } from '../../core/network/apiClient';
import { logger } from '../../core/logging';

export class TermsConditionRemoteDataSource {
  /**
   * Check if user has accepted Terms & Conditions
   * Endpoint: GET /api/Owner/term-condition?userId={userId}
   * Backend requires [Authorize] header.
   * If user is not an owner, backend returns 403 Forbidden.
   */
  async getTermsConditionStatus(userId: number, token?: string): Promise<boolean> {
    try {
      const activeToken = token || (globalThis as any).__MENZA_AUTH_TOKEN__;
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      logger.api('API_REQUEST', `Checking Terms & Conditions status for userId: ${userId}`);
      const response = await apiClient.get('/Owner/term-condition', {
        params: { userId },
        headers,
      });

      const data = response?.data;
      if (typeof data === 'boolean') return data;
      if (typeof data?.isTermConditionChecked === 'boolean') return data.isTermConditionChecked;
      if (typeof data?.isChecked === 'boolean') return data.isChecked;
      if (typeof data?.data?.isTermConditionChecked === 'boolean') return data.data.isTermConditionChecked;
      if (typeof data?.data === 'boolean') return data.data;

      // In case integer flag is returned (1 or 0)
      if (data?.isTermConditionChecked === 1 || data?.isChecked === 1) return true;

      return false;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        // Backend returns 403 when user is not an owner:
        // "Terms and conditions status is only applicable for restaurant owners."
        // For non-owners, terms consent is not required, so return true.
        logger.api('API_REQUEST', 'User is not an owner (403), terms acceptance not applicable');
        return true;
      }

      if (err?.response?.status === 401) {
        logger.api('API_ERROR', 'Unauthorized when checking Terms & Conditions - session token not yet established');
        return false;
      }

      logger.api('API_ERROR', 'Failed to fetch Terms & Conditions status, attempting fallback endpoint', {
        error: err?.message,
      });

      // Try alternate alias endpoint if primary returned error
      try {
        const activeToken = token || (globalThis as any).__MENZA_AUTH_TOKEN__;
        const headers: Record<string, string> = {};
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
        }
        const altResponse = await apiClient.get('/Owner/IsTermConditionChecked', {
          params: { userId },
          headers,
        });
        const altData = altResponse?.data;
        if (typeof altData === 'boolean') return altData;
        if (typeof altData?.isTermConditionChecked === 'boolean') return altData.isTermConditionChecked;
        if (typeof altData?.isChecked === 'boolean') return altData.isChecked;
        return false;
      } catch {
        return false;
      }
    }
  }

  /**
   * Accept Terms & Conditions for the user
   * Endpoint: POST /api/Owner/term-condition
   * Backend requires [Authorize] header.
   */
  async acceptTermsCondition(userId: number, token?: string): Promise<boolean> {
    const activeToken = token || (globalThis as any).__MENZA_AUTH_TOKEN__;
    const headers: Record<string, string> = {};
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const payload = {
      userId,
      isTermConditionChecked: true,
      isChecked: true,
    };
    const params = {
      userId,
      isChecked: true,
      isTermConditionChecked: true,
    };

    logger.api('API_REQUEST', `Submitting Terms & Conditions acceptance for userId: ${userId}`);

    try {
      // Primary: POST /api/Owner/term-condition matching OwnerController
      await apiClient.post('/Owner/term-condition', payload, { params, headers });
      return true;
    } catch (err: any) {
      logger.api('API_ERROR', 'POST /Owner/term-condition failed, retrying with PUT', { error: err?.message });
      try {
        await apiClient.put('/Owner/term-condition', payload, { params, headers });
        return true;
      } catch (putErr: any) {
        // Fallback to /Owner/IsTermConditionChecked
        logger.api('API_ERROR', 'PUT /Owner/term-condition failed, retrying with /Owner/IsTermConditionChecked', {
          error: putErr?.message,
        });
        await apiClient.post('/Owner/IsTermConditionChecked', payload, { params, headers });
        return true;
      }
    }
  }
}
