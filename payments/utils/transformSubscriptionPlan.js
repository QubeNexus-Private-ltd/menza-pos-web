export const transformSubscriptionPlans =
  (items = []) => {
    return items.map((plan) => ({
      id: String(
        plan.subscriptionId
      ),

      subscriptionId:
        plan.subscriptionId,

      title:
        plan.subscriptionName,

      amount:
        Number(
          plan.subscriptionAmount
        ) || 0,

      desc:
        plan.subscriptionDescription,

      noOfDays:
        plan.noOfDays,
    }));
  };