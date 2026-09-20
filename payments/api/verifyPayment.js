const formatDate = () => new Date().toLocaleDateString('en-IN');

export const verifyPayment = async (orderId, metadata = {}) => {
  return {
    success: true,
    status: 'Paid',
    orderId,
    receipt: {
      orderId,
      receiptId: `CF-${orderId}`,
      txnId: orderId,
      date: formatDate(),
      amount: Number(metadata.amount ?? metadata.order?.amount ?? 0),
      mode: 'Online',
      desc: metadata.paymentFor === 'subscription' ? 'Subscription payment' : 'Maintenance payment',
      plotId: metadata.plotId,
      months: metadata.months ?? [],
      planId: metadata.planId,
      status: 'Paid',
    },
  };
};
