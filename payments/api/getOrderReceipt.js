import API from '../../apiClient';
import { withApiError } from '../../apiError';

const formatDate = (value) => {
  if (!value) return new Date().toLocaleDateString('en-IN');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatMonthYear = (detail = {}, index = 0) => {
  if (detail.monthYear ?? detail.MonthYear) return String(detail.monthYear ?? detail.MonthYear);
  const month = detail.month ?? detail.Month;
  const year = detail.year ?? detail.Year;

  if (month && year) {
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  }

  return String(detail.period ?? detail.Period ?? `Item ${index + 1}`);
};

const normalizeOrderDetail = (detail = {}, index = 0) => ({
  id: String(detail.id ?? detail.Id ?? detail.ledgerId ?? detail.LedgerId ?? `${formatMonthYear(detail, index)}-${index}`),
  monthYear: formatMonthYear(detail, index),
  amountPaid: Number(detail.amountPaid ?? detail.AmountPaid ?? detail.amount ?? detail.Amount ?? 0),
  totalAmount: Number(detail.totalAmount ?? detail.TotalAmount ?? detail.amountPaid ?? detail.AmountPaid ?? 0),
  status: detail.ledgerStatusName ?? detail.LedgerStatusName ?? detail.status ?? detail.Status ?? 'Paid',
  paymentMethod: detail.paymentMethod ?? detail.PaymentMethod,
  txnId: detail.gatewayTransactionId ?? detail.GatewayTransactionId ?? detail.transactionId ?? detail.TransactionId,
  paymentDate: formatDate(detail.paymentDateUtc ?? detail.PaymentDateUtc ?? detail.paymentDate ?? detail.PaymentDate),
});

const getOrderDetails = (data = {}) => {
  const details = data.orderDetails ?? data.OrderDetails ?? data.items ?? data.Items ?? data.ledgers ?? data.Ledgers ?? [];
  return Array.isArray(details) ? details.map(normalizeOrderDetail) : [];
};

const normalizeReceipt = (payload = {}, orderId) => {
  const data = payload?.data ?? payload?.receipt ?? payload?.payment ?? payload;
  const orderDetails = getOrderDetails(data);
  const firstDetail = orderDetails[0] || {};
  const detailsAmount = orderDetails.reduce((sum, detail) => sum + detail.amountPaid, 0);

  return {
    ...data,
    orderId: data.orderId ?? data.OrderId ?? orderId,
    unitId: data.unitId ?? data.UnitId,
    receiptId:
      data.receiptId ??
      data.ReceiptId ??
      data.receiptNo ??
      data.ReceiptNo ??
      data.receiptNumber ??
      data.ReceiptNumber ??
      data.orderId ??
      data.OrderId ??
      orderId,
    txnId:
      data.txnId ??
      data.transactionId ??
      data.TransactionId ??
      data.transactionReference ??
      data.TransactionReference ??
      data.cfPaymentId ??
      data.CfPaymentId ??
      firstDetail.txnId ??
      data.orderId ??
      data.OrderId ??
      orderId,
    date: formatDate(
      data.date ??
      data.paymentDate ??
      data.PaymentDate ??
      data.paymentDateUtc ??
      data.PaymentDateUtc ??
      firstDetail.paymentDate ??
      data.createdAt
    ),
    amount: Number(data.amount ?? data.Amount ?? data.amountPaid ?? data.AmountPaid ?? data.orderAmount ?? detailsAmount ?? 0),
    plotNo: data.plotNo ?? data.PlotNo ?? data.unitNo ?? data.UnitNo ?? data.unitId ?? data.UnitId,
    plotType: data.plotType ?? data.PlotType ?? data.unitType ?? data.UnitType,
    society: data.society ?? data.Society ?? data.societyName ?? data.SocietyName ?? 'Home Orbit Society',
    months: data.months ?? data.Months ?? orderDetails.map((detail) => detail.monthYear),
    paidBy: data.paidBy ?? data.PaidBy ?? data.ownerName ?? data.OwnerName ?? 'Resident',
    mode: data.mode ?? data.paymentMode ?? data.PaymentMode ?? data.paymentModeName ?? data.PaymentModeName ?? firstDetail.paymentMethod ?? 'Online',
    qrImage: data.image ?? data.Image ?? data.qrImage ?? data.QrImage ?? data.qrCode ?? data.QrCode,
    orderDetails,
  };
};

export const getOrderReceipt = async (orderId) => {
  if (!orderId) {
    throw new Error('Order id is required to fetch receipt.');
  }

  try {
    const response = await API.get(`/Payment/order/${encodeURIComponent(orderId)}`);
    return normalizeReceipt(response.data, orderId);
  } catch (error) {
    throw withApiError(error, 'Unable to fetch payment receipt.');
  }
};
