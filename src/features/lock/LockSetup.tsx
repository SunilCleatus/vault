import { useEffect, useState } from 'react';
import { setupPin } from '../../lib/crypto';
import { isPlatformAuthenticatorAvailable, registerWebAuthn } from '../../lib/authLock';
import PinEntry from './PinEntry';

type Step = 'intro' | 'create' | 'confirm' | 'webauthn';

export default function LockSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('intro');
  const [firstPin, setFirstPin] = useState('');
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setWebauthnAvailable);
  }, []);

  if (step === 'intro') {
    return (
      <div className="lock-screen">
        <h1>Set Up App Lock</h1>
        <p className="tagline">
          Your documents include Aadhaar, PAN, and other sensitive IDs. A PIN keeps Vault locked
          even if your phone itself is unlocked, and lets you save documents for secure offline
          access.
        </p>
        <button className="primary-button" onClick={() => setStep('create')}>
          Set Up App Lock
        </button>
        <button className="text-button" onClick={onDone}>
          Skip for now
        </button>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div className="lock-screen">
        <PinEntry
          title="Create a PIN"
          submitLabel="Next"
          minLength={4}
          onSubmit={(pin) => {
            setFirstPin(pin);
            setStep('confirm');
            return true;
          }}
          secondaryAction={{ label: 'Skip for now', onClick: onDone }}
        />
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="lock-screen">
        <PinEntry
          title="Confirm your PIN"
          submitLabel="Confirm"
          minLength={4}
          onSubmit={async (pin) => {
            if (pin !== firstPin) return false;
            await setupPin(pin);
            setStep(webauthnAvailable ? 'webauthn' : 'intro');
            if (!webauthnAvailable) onDone();
            return true;
          }}
          secondaryAction={{ label: 'Start over', onClick: () => setStep('create') }}
        />
      </div>
    );
  }

  // webauthn step
  return (
    <div className="lock-screen">
      <h1>Faster Unlock</h1>
      <p className="tagline">Enable Face ID / Touch ID / fingerprint so you don't need your PIN every time.</p>
      <button
        className="primary-button"
        onClick={async () => {
          await registerWebAuthn();
          onDone();
        }}
      >
        Enable Biometric Unlock
      </button>
      <button className="text-button" onClick={onDone}>
        Not now
      </button>
    </div>
  );
}
