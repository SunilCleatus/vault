import { useEffect, useState } from 'react';
import { setupPin, verifyPin } from '../../lib/crypto';
import { reencryptFavorites } from '../../lib/favoritesStore';
import {
  disableWebAuthn,
  isPlatformAuthenticatorAvailable,
  isWebAuthnRegistered,
  registerWebAuthn,
} from '../../lib/authLock';
import { getAutoLockMinutes, setAutoLockMinutes } from '../../lib/lockSettings';
import { usePinKey } from '../lock/LockGate';
import PinEntry from '../lock/PinEntry';

type Step = 'menu' | 'change-pin-current' | 'change-pin-new' | 'change-pin-confirm';

export default function SettingsView({ onBack }: { onBack: () => void }) {
  const { setKey } = usePinKey();
  const [step, setStep] = useState<Step>('menu');
  const [oldKey, setOldKey] = useState<CryptoKey | null>(null);
  const [firstNewPin, setFirstNewPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [autoLock, setAutoLock] = useState(getAutoLockMinutes());
  const [webAuthnAvailable, setWebAuthnAvailable] = useState(false);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(isWebAuthnRegistered());

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setWebAuthnAvailable);
  }, []);

  const handleAutoLockChange = (minutes: number) => {
    setAutoLockMinutes(minutes);
    setAutoLock(minutes);
  };

  const handleEnableBiometric = async () => {
    const ok = await registerWebAuthn();
    if (ok) setWebAuthnEnabled(true);
  };

  const handleDisableBiometric = () => {
    disableWebAuthn();
    setWebAuthnEnabled(false);
  };

  if (step === 'change-pin-current') {
    return (
      <div className="folder-view">
        <header className="capture-header">
          <button className="text-button" onClick={() => setStep('menu')}>
            Back
          </button>
          <h2>Change PIN</h2>
          <span />
        </header>
        <PinEntry
          title="Enter your current PIN"
          submitLabel="Next"
          onSubmit={async (pin) => {
            const key = await verifyPin(pin);
            if (!key) return false;
            setOldKey(key);
            setStep('change-pin-new');
            return true;
          }}
        />
      </div>
    );
  }

  if (step === 'change-pin-new') {
    return (
      <div className="folder-view">
        <header className="capture-header">
          <button className="text-button" onClick={() => setStep('menu')}>
            Back
          </button>
          <h2>Change PIN</h2>
          <span />
        </header>
        <PinEntry
          title="Create a new PIN"
          submitLabel="Next"
          onSubmit={(pin) => {
            setFirstNewPin(pin);
            setStep('change-pin-confirm');
            return true;
          }}
        />
      </div>
    );
  }

  if (step === 'change-pin-confirm') {
    return (
      <div className="folder-view">
        <header className="capture-header">
          <button className="text-button" onClick={() => setStep('menu')}>
            Back
          </button>
          <h2>Change PIN</h2>
          <span />
        </header>
        <PinEntry
          title="Confirm new PIN"
          submitLabel="Save"
          onSubmit={async (pin) => {
            if (pin !== firstNewPin) return false;
            await setupPin(pin);
            const newKey = await verifyPin(pin);
            if (oldKey && newKey) {
              await reencryptFavorites(oldKey, newKey);
            }
            if (newKey) setKey(newKey);
            setMessage('PIN changed.');
            setStep('menu');
            return true;
          }}
        />
      </div>
    );
  }

  return (
    <div className="folder-view">
      <header className="capture-header">
        <button className="text-button" onClick={onBack}>
          Back
        </button>
        <h2>Settings</h2>
        <span />
      </header>

      {message && <p className="status-line">{message}</p>}

      <div className="settings-section">
        <h3>Security</h3>
        <button className="secondary-button" onClick={() => setStep('change-pin-current')}>
          Change PIN
        </button>

        {webAuthnAvailable &&
          (webAuthnEnabled ? (
            <button className="secondary-button" onClick={handleDisableBiometric}>
              Disable Face ID / Touch ID
            </button>
          ) : (
            <button className="secondary-button" onClick={handleEnableBiometric}>
              Enable Face ID / Touch ID
            </button>
          ))}

        <div className="form-field">
          <label htmlFor="autolock-minutes">Auto-lock after</label>
          <select
            id="autolock-minutes"
            value={autoLock}
            onChange={(e) => handleAutoLockChange(Number(e.target.value))}
          >
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </div>
      </div>
    </div>
  );
}
