import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import LockScreen from './LockScreen';
import LockSetup from './LockSetup';
import PinEntry from './PinEntry';
import { isPinConfigured, verifyPin } from '../../lib/crypto';
import { getAutoLockMinutes } from '../../lib/lockSettings';

type PinKeyContextValue = {
  key: CryptoKey | null;
  // Resolves with the cached key immediately if we already have it; otherwise
  // prompts for the PIN inline and resolves once entered (or null if
  // cancelled). Used wherever offline favorites need to encrypt/decrypt but
  // the user unlocked this session via a WebAuthn gesture instead of a PIN.
  requestKey: () => Promise<CryptoKey | null>;
  // Lets Settings push the freshly-derived key in immediately after a PIN
  // change, so the rest of the current session doesn't need to re-unlock.
  setKey: (key: CryptoKey) => void;
};

const PinKeyContext = createContext<PinKeyContextValue | null>(null);

export function usePinKey(): PinKeyContextValue {
  const ctx = useContext(PinKeyContext);
  if (!ctx) throw new Error('usePinKey must be used within LockGate');
  return ctx;
}

const IDLE_CHECK_INTERVAL_MS = 15_000;

export default function LockGate({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState(isPinConfigured());
  const [unlocked, setUnlocked] = useState(false);
  const [pinKey, setPinKey] = useState<CryptoKey | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const resolverRef = useRef<((key: CryptoKey | null) => void) | null>(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!unlocked) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', markActivity);
    window.addEventListener('keydown', markActivity);

    const interval = setInterval(() => {
      const autoLockMs = getAutoLockMinutes() * 60 * 1000;
      if (Date.now() - lastActivityRef.current > autoLockMs) {
        setUnlocked(false);
        setPinKey(null);
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      clearInterval(interval);
    };
  }, [unlocked]);

  const requestKey = useCallback((): Promise<CryptoKey | null> => {
    if (pinKey) return Promise.resolve(pinKey);
    setPromptOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, [pinKey]);

  const handlePromptSubmit = async (pin: string): Promise<boolean> => {
    const key = await verifyPin(pin);
    if (key) {
      setPinKey(key);
      setPromptOpen(false);
      resolverRef.current?.(key);
      resolverRef.current = null;
    }
    return !!key;
  };

  const handlePromptCancel = () => {
    setPromptOpen(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  };

  if (unlocked) {
    return (
      <PinKeyContext.Provider value={{ key: pinKey, requestKey, setKey: setPinKey }}>
        {children}
        {promptOpen && (
          <div className="modal-overlay">
            <div className="modal-card">
              <PinEntry
                title="Enter your PIN to continue"
                submitLabel="Continue"
                onSubmit={handlePromptSubmit}
              />
              <button className="text-button" onClick={handlePromptCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </PinKeyContext.Provider>
    );
  }

  if (!configured) {
    return (
      <LockSetup
        onDone={() => {
          setConfigured(isPinConfigured());
          setUnlocked(true);
          lastActivityRef.current = Date.now();
        }}
      />
    );
  }

  return (
    <LockScreen
      onUnlock={(key) => {
        setUnlocked(true);
        if (key) setPinKey(key);
        lastActivityRef.current = Date.now();
      }}
    />
  );
}
