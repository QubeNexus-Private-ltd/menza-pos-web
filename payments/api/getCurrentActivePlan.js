import API, {
  getGlobalProfile,
  getGlobalSocietyId,
} from '../../apiClient';

import { withApiError } from '../../apiError';
import { pickFirst } from '../../../utils/helpers';
import { normalizeActivePlan } from '../utils/normalizeActivePlan';

const resolveSocietyId = (societyId) => {
  const profile = getGlobalProfile() || {};
  return pickFirst(
    societyId,
    profile.societyId,
    profile.SocietyId,
    profile.society?.id,
    profile.Society?.Id,
    getGlobalSocietyId()
  );
};

/**
 * Fetches the current active subscription plan for a society.
 * Endpoint: GET /SocietySubscription/current-active-plan/{societyId}
 */
export const getCurrentActivePlan = async (societyId) => {
  const resolvedSocietyId = resolveSocietyId(societyId);

  if (!resolvedSocietyId) return null;

  try {
    const response = await API.get(
      `/SocietySubscription/current-active-plan/${resolvedSocietyId}`
    );

    // If the backend returns an array instead of a single object, pick the first one
    const data = Array.isArray(response.data) ? response.data[0] : response.data;

    return normalizeActivePlan(data);
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }

    throw withApiError(
      error,
      'Unable to fetch current active subscription plan.'
    );
  }
};
