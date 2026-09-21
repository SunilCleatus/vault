import { useEffect, useState } from 'react';
import PinEntry from './PinEntry';
import { isWebAuthnRegistered, verifyWebAuthn } from '../../lib/authLock';
import { verifyPin } from '../../lib/crypto';

type Props = {
  onUnlock: (pinKey: CryptoKey | null) => void;
};

export default function LockScreen({ onUnlock }: Props) {
  const [tryingWebAuthn, setTryingWebAuthn] = useState(isWebAuthnRegistered());

  useEffect(() => {
    if (!tryingWebAuthn) return;
    let cancelled = false;
    verifyWebAuthn().then((ok) => {
      if (cancelled) return;
      if (ok) {
        onUnlock(null);
      } else {
        setTryingWebAuthn(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tryingWebAuthn]);

  if (tryingWebAuthn) {
    return (
      <div className="lock-screen">
        <h1>Vault</h1>
        <p className="status-line">Waiting for Face ID / Touch ID…</p>
        <button className="text-button" onClick={() => setTryingWebAuthn(false)}>
          Use PIN instead
        </button>
      </div>
    );
  }

  return (
    <div className="lock-screen">
      <h1>Vault</h1>
      <PinEntry
        title="Enter your PIN"
        submitLabel="Unlock"
        onSubmit={async (pin) => {
          const key = await verifyPin(pin);
          if (key) onUnlock(key);
          return !!key;
        }}
        secondaryAction={
          isWebAuthnRegistered()
            ? { label: 'Use Face ID / Touch ID', onClick: () => setTryingWebAuthn(true) }
            : undefined
        }
      />
    </div>
  );
}
