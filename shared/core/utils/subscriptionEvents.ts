type SubscriptionEventListener = (message?: string) => void;
type SubscriptionVoidListener = () => void;

class SubscriptionEventEmitter {
  private expiredListeners: Set<SubscriptionEventListener> = new Set();
  private updatedListeners: Set<SubscriptionVoidListener> = new Set();
  private renewalPromptListeners: Set<SubscriptionEventListener> = new Set();

  subscribeExpired(listener: SubscriptionEventListener): () => void {
    this.expiredListeners.add(listener);
    return () => {
      this.expiredListeners.delete(listener);
    };
  }

  emitExpired(message?: string): void {
    this.expiredListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.warn('Subscription expired listener error:', err);
      }
    });
  }

  subscribeUpdated(listener: SubscriptionVoidListener): () => void {
    this.updatedListeners.add(listener);
    return () => {
      this.updatedListeners.delete(listener);
    };
  }

  emitUpdated(): void {
    this.updatedListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('Subscription updated listener error:', err);
      }
    });
  }

  subscribeRenewalPrompt(listener: SubscriptionEventListener): () => void {
    this.renewalPromptListeners.add(listener);
    return () => {
      this.renewalPromptListeners.delete(listener);
    };
  }

  emitRenewalPrompt(message?: string): void {
    this.renewalPromptListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.warn('Subscription renewal prompt listener error:', err);
      }
    });
  }
}

export const SubscriptionEvents = new SubscriptionEventEmitter();
