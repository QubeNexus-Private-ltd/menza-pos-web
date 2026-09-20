import API, { getGlobalProfile } from '../../apiClient';
import { withApiError } from '../../apiError';

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const PAYMENT_TYPES = {
  subscription: 1,
  maintenance: 2,
};

const normalizeOrder = (data, payload, amount, metadata = {}) => ({
  ...data,
  orderId:
    data?.orderId ??
    data?.order_id ??
    data?.id ??
    data?.data?.orderId ??
    data?.data?.order_id,
  paymentSessionId:
    data?.paymentSessionId ??
    data?.payment_session_id ??
    data?.paymentSessionID ??
    data?.data?.paymentSessionId ??
    data?.data?.payment_session_id,
  environment:
    data?.environment ??
    data?.paymentEnvironment ??
    data?.data?.environment ??
    'SANDBOX',
  amount: Number(data?.amount ?? data?.order_amount ?? amount ?? 0),
  payload,
  metadata,
});

const buildCreateOrderPayload = (amount, metadata = {}) => {
  const ledgerId = metadata.ledgerId ?? metadata.LedgerId ?? metadata.paymentId ?? metadata.rows?.[0]?.id;
  const ledgerIdsFromMetadata = metadata.ledgerIds ?? metadata.LedgerIds ?? metadata.rows?.map((row) => (
    row.ledgerId ?? row.LedgerId ?? row.paymentId ?? row.id
  )) ?? [ledgerId];
  const ledgerIds = toArray(ledgerIdsFromMetadata)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
  const profile = getGlobalProfile() || {};
  const paymentFor = String(metadata.paymentFor ?? metadata.PaymentFor ?? '').toLowerCase();
  const type = Number(metadata.type ?? metadata.Type ?? PAYMENT_TYPES[paymentFor] ?? PAYMENT_TYPES.maintenance);
  const isMaintenance = type === PAYMENT_TYPES.maintenance;
  const subscriptionId = pickFirst(
    metadata.subscriptionId,
    metadata.SubscriptionId,
    metadata.planId,
    metadata.PlanId
  );
  const societyId = pickFirst(metadata.societyId, metadata.SocietyId, profile.societyId, profile.SocietyId);
  const ownerId = pickFirst(metadata.ownerId, metadata.OwnerId, profile.ownerId, profile.OwnerId);
  const numericSocietyId = Number(societyId);
  const numericOwnerId = Number(ownerId);
  const ownerName = pickFirst(
    metadata.ownerName,
    metadata.OwnerName,
    profile.ownerName,
    profile.OwnerName,
    profile.name,
    profile.Name
  );
  const ownerPhone = pickFirst(
    metadata.ownerPhone,
    metadata.OwnerPhone,
    metadata.phone,
    metadata.Phone,
    metadata.mobile,
    metadata.Mobile,
    metadata.mobileNumber,
    metadata.MobileNumber,
    profile.ownerPhone,
    profile.OwnerPhone,
    profile.phone,
    profile.Phone,
    profile.mobile,
    profile.Mobile,
    profile.mobileNumber,
    profile.MobileNumber
  );
  const paymentPurpose = pickFirst(
    metadata.paymentPurpose,
    metadata.PaymentPurpose,
    metadata.paymentFor,
    metadata.PaymentFor
  );
  const currency = pickFirst(metadata.currency, metadata.Currency, 'INR');

  if (![PAYMENT_TYPES.subscription, PAYMENT_TYPES.maintenance].includes(type)) {
    throw new Error('Payment type must be 1 for subscription or 2 for maintenance.');
  }

  if (isMaintenance && ledgerIds.length === 0) {
    throw new Error('Ledger ids are required to create a maintenance payment order.');
  }

  if (
    !Number.isFinite(numericSocietyId) ||
    !Number.isFinite(numericOwnerId) ||
    !ownerName ||
    !ownerPhone ||
    !paymentPurpose
  ) {
    throw new Error('Society, owner, phone, and payment purpose are required to create a payment order.');
  }

  return {
    type,
    ledgerIds: isMaintenance ? ledgerIds : [],
    societyId: numericSocietyId,
    ownerId: numericOwnerId,
    ownerName: String(ownerName).trim(),
    ownerPhone: String(ownerPhone).trim(),
    currency: String(currency).trim(),
    paymentPurpose: String(paymentPurpose).trim(),
    subscriptionId: subscriptionId ?? null,
  };
};

export const createOrder = async (amount, metadata = {}) => {
  const payload = buildCreateOrderPayload(amount, metadata);

  try {
    const response = await API.post('/CashFreepayment/create-order', payload);
    const order = normalizeOrder(response.data, payload, amount, metadata);

    if (!order.orderId || !order.paymentSessionId) {
      throw new Error('Payment order response is missing orderId or paymentSessionId.');
    }

    return order;
  } catch (error) {
    throw withApiError(error, 'Unable to create payment order.');
  }
};
