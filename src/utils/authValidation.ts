// Pure, dependency-free validation helpers for the Authentication UI phase.
// No network calls, no Supabase, no real authentication — these only
// validate form shape so the UI can give immediate feedback.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrengthResult {
  score: PasswordStrength; // 0 = empty/very weak, 4 = strong
  label: 'empty' | 'weak' | 'fair' | 'good' | 'strong';
  hasMinLength: boolean;
  hasUpperAndLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * A simple, transparent heuristic password-strength scorer for immediate
 * UI feedback only. This is NOT a substitute for server-side password
 * policy enforcement (which will be handled by Supabase Auth once wired
 * up in a later phase).
 */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      label: 'empty',
      hasMinLength: false,
      hasUpperAndLower: false,
      hasNumber: false,
      hasSymbol: false,
    };
  }

  const hasMinLength = password.length >= 8;
  const hasUpperAndLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const criteriaMet = [hasMinLength, hasUpperAndLower, hasNumber, hasSymbol].filter(Boolean).length;

  let score: PasswordStrength;
  let label: PasswordStrengthResult['label'];

  if (password.length < 6) {
    score = 1;
    label = 'weak';
  } else if (criteriaMet <= 1) {
    score = 1;
    label = 'weak';
  } else if (criteriaMet === 2) {
    score = 2;
    label = 'fair';
  } else if (criteriaMet === 3) {
    score = 3;
    label = 'good';
  } else {
    score = 4;
    label = 'strong';
  }

  return { score, label, hasMinLength, hasUpperAndLower, hasNumber, hasSymbol };
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword;
}
