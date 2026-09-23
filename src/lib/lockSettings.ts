const AUTO_LOCK_MINUTES_KEY = 'vault.lock.autoLockMinutes';
const DEFAULT_AUTO_LOCK_MINUTES = 5;

export function getAutoLockMinutes(): number {
  const raw = localStorage.getItem(AUTO_LOCK_MINUTES_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AUTO_LOCK_MINUTES;
}

export function setAutoLockMinutes(minutes: number): void {
  localStorage.setItem(AUTO_LOCK_MINUTES_KEY, String(minutes));
}
