import { useState, type FormEvent } from 'react';

type Props = {
  title: string;
  submitLabel: string;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  secondaryAction?: { label: string; onClick: () => void };
  minLength?: number;
};

export default function PinEntry({ title, submitLabel, onSubmit, secondaryAction, minLength = 4 }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length < minLength) {
      setError(`Enter at least ${minLength} digits.`);
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onSubmit(pin);
    setBusy(false);
    if (!ok) {
      setError('Incorrect PIN.');
      setPin('');
    }
  };

  return (
    <form className="pin-entry" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        placeholder="••••"
      />
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? 'Checking…' : submitLabel}
      </button>
      {secondaryAction && (
        <button type="button" className="text-button" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      )}
    </form>
  );
}
