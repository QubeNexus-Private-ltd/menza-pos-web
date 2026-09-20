type WalletEventListener = () => void;

class WalletEventEmitter {
  private listeners: Set<WalletEventListener> = new Set();

  subscribe(listener: WalletEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('Wallet listener error:', err);
      }
    });
  }
}

export const WalletEvents = new WalletEventEmitter();
