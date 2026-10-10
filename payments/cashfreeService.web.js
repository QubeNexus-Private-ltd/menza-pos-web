let registeredCallbacks = null;

/**
 * Dynamically loads Cashfree JS SDK (v3) into the web DOM if not already loaded.
 */
const loadCashfreeWebSdk = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cashfree Web SDK is only supported in browser environments.'));
      return;
    }

    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }

    const scriptId = 'cashfree-js-sdk-script';
    let script = document.getElementById(scriptId);

    if (script) {
      const handleLoad = () => {
        script.removeEventListener('load', handleLoad);
        if (window.Cashfree) resolve(window.Cashfree);
        else reject(new Error('Cashfree JS SDK loaded but window.Cashfree is missing.'));
      };
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', (err) => reject(err));
      return;
    }

    script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;

    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        reject(new Error('Cashfree Web SDK loaded, but window.Cashfree is undefined.'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Cashfree JS SDK script from CDN.'));
    };

    document.head.appendChild(script);
  });
};

/**
 * Initiates Web-based Cashfree Payment Checkout flow.
 */
export const startCashfreePayment = async ({
  paymentSessionId,
  orderId,
  environment = 'SANDBOX',
  paymentLink,
}) => {
  const logPrefix = `[CashfreeWebPayment][${new Date().toISOString()}]`;
  console.log(`${logPrefix} Initiating web payment for Order: ${orderId}`);

  if (!paymentSessionId && !paymentLink) {
    const err = 'Neither paymentSessionId nor paymentLink was provided for Web payment.';
    console.error(`${logPrefix} ${err}`);
    registeredCallbacks?.onFailure?.(err, orderId);
    return { success: false, error: err, orderId };
  }

  const mode = String(environment).toUpperCase() === 'PRODUCTION' ? 'production' : 'sandbox';

  try {
    const Cashfree = await loadCashfreeWebSdk();
    const cashfree = Cashfree({ mode });

    if (paymentSessionId) {
      console.log(`${logPrefix} Opening Cashfree Web Drop Checkout Modal with session ID: ${paymentSessionId}`);
      const checkoutOptions = {
        paymentSessionId,
        redirectTarget: '_modal',
      };

      const result = await cashfree.checkout(checkoutOptions);
      console.log(`${logPrefix} Checkout result received:`, result);

      if (result?.error) {
        const errMsg = result.error.message || result.error.description || 'Payment checkout failed or closed.';
        console.error(`${logPrefix} Checkout error: ${errMsg}`);
        registeredCallbacks?.onFailure?.(errMsg, orderId);
        return { success: false, error: errMsg, orderId };
      }

      if (result?.paymentDetails) {
        console.log(`${logPrefix} Payment successful:`, result.paymentDetails);
        registeredCallbacks?.onSuccess?.(orderId);
        return { success: true, orderId };
      }

      // When the modal is closed without payment details or user backs out
      const cancelMsg = 'Payment was not completed or was cancelled.';
      console.log(`${logPrefix} ${cancelMsg}`);
      registeredCallbacks?.onFailure?.(cancelMsg, orderId);
      return { success: false, error: cancelMsg, orderId };
    }
  } catch (sdkError) {
    console.warn(`${logPrefix} Web Drop Checkout modal error, checking paymentLink fallback...`, sdkError);

    if (paymentLink) {
      console.log(`${logPrefix} Opening paymentLink URL: ${paymentLink}`);
      if (typeof window !== 'undefined') {
        window.open(paymentLink, '_blank');
        return { success: false, orderId, paymentLink, pendingVerification: true };
      }
    }

    const errMsg = sdkError?.message || 'Cashfree Web payment SDK failed to initialize.';
    console.error(`${logPrefix} Payment execution error: ${errMsg}`);
    registeredCallbacks?.onFailure?.(errMsg, orderId);
    return { success: false, error: errMsg, orderId };
  }

  return { success: false, error: 'Web checkout failed', orderId };
};

export const setPaymentCallbacks = (onSuccess, onFailure) => {
  registeredCallbacks = { onSuccess, onFailure };
};

export const removePaymentCallbacks = () => {
  registeredCallbacks = null;
};
