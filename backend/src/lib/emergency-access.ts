import { AppError } from './errors';

export function requireEmergencyOptIn(enabled: unknown): void {
  if (enabled !== true) throw new AppError('This patient has not enabled emergency access.', 403);
}
