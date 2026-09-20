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
 * Fetches both active and scheduled subscription plans for a society.
 * Endpoint: GET /SocietySubscription/active-and-scheduled-plans/{societyId}
 */
export const getActiveAndScheduledPlans = async (societyId) => {
  const resolvedSocietyId = resolveSocietyId(societyId);

  if (!resolvedSocietyId) return null;

  try {
    const response = await API.get(
      `/SocietySubscription/active-and-scheduled-plans/${resolvedSocietyId}`
    );

    const data = response.data;

    // Handle case where API returns a plain array of plans
    if (Array.isArray(data)) {
      const normalizedPlans = data.map(normalizeActivePlan).filter(Boolean);
      
      // Filter for active plans
      // A plan is active if its status is 'ACTIVE' OR (status is 'SCHEDULED' but current date is within range)
      // This logic is now inside normalizeActivePlan
      const activePlan = normalizedPlans.find(p => p.isActive) || null;
      
      // Filter for scheduled plans that are NOT yet active
      const scheduledPlans = normalizedPlans
        .filter(p => p.isScheduled && !p.isActive)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      
      const scheduledPlan = scheduledPlans[0] || null;
      
      return {
        activePlan,
        scheduledPlan,
        allPlans: normalizedPlans,
      };
    }

    // Default handling for structured response
    return {
      activePlan: data.activePlan ? normalizeActivePlan(data.activePlan) : null,
      scheduledPlan: data.scheduledPlan ? normalizeActivePlan(data.scheduledPlan) : null,
      allPlans: Array.isArray(data.allPlans) ? data.allPlans : [],
    };
  } catch (error) {
    if (error?.response?.status === 404) {
      return { activePlan: null, scheduledPlan: null, allPlans: [] };
    }

    throw withApiError(
      error,
      'Unable to fetch society subscription plans.'
    );
  }
};
