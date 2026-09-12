import { describe, it, expect } from 'vitest';
import { isValidEmail, getPasswordStrength, passwordsMatch } from '../authValidation';
import { translations } from '../../i18n';

describe('Auth UI — Email Validation', () => {
  it('accepts well-formed email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last@institution.edu')).toBe(true);
    expect(isValidEmail('name+tag@sub.domain.co')).toBe(true);
  });

  it('rejects malformed email addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing-at-sign.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@nodot')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

describe('Auth UI — Password Strength Heuristic', () => {
  it('reports empty for an empty password', () => {
    const res = getPasswordStrength('');
    expect(res.score).toBe(0);
    expect(res.label).toBe('empty');
  });

  it('reports weak for a very short password', () => {
    const res = getPasswordStrength('abc');
    expect(res.label).toBe('weak');
  });

  it('reports weak for a long password with only lowercase letters', () => {
    const res = getPasswordStrength('abcdefghijk');
    expect(res.label).toBe('weak');
  });

  it('reports increasing strength as more character classes are added', () => {
    const onlyLower = getPasswordStrength('abcdefgh');
    const lowerUpper = getPasswordStrength('abcdefghI');
    const lowerUpperNum = getPasswordStrength('abcdefghI1');
    const allFour = getPasswordStrength('abcdefghI1!');

    expect(lowerUpper.score).toBeGreaterThanOrEqual(onlyLower.score);
    expect(lowerUpperNum.score).toBeGreaterThanOrEqual(lowerUpper.score);
    expect(allFour.score).toBeGreaterThanOrEqual(lowerUpperNum.score);
    expect(allFour.label).toBe('strong');
  });

  it('correctly reports which individual criteria are met', () => {
    const res = getPasswordStrength('abcdefghI1!');
    expect(res.hasMinLength).toBe(true);
    expect(res.hasUpperAndLower).toBe(true);
    expect(res.hasNumber).toBe(true);
    expect(res.hasSymbol).toBe(true);
  });

  it('never returns a score outside the 0-4 range', () => {
    const samples = ['', 'a', 'password', 'Password1', 'Password1!', 'aVeryLongPassword123!@#$%^&*()'];
    for (const s of samples) {
      const res = getPasswordStrength(s);
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(4);
    }
  });
});

describe('Auth UI — Password Match Check', () => {
  it('confirms matching non-empty passwords', () => {
    expect(passwordsMatch('Secret123!', 'Secret123!')).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    expect(passwordsMatch('Secret123!', 'Secret124!')).toBe(false);
  });

  it('rejects when both are empty (nothing to confirm yet)', () => {
    expect(passwordsMatch('', '')).toBe(false);
  });
});

describe('Auth UI — i18n Completeness', () => {
  const languages: Array<keyof typeof translations> = ['en', 'fa', 'zh', 'es', 'fr', 'de'];

  // Every user-facing string key referenced across the Auth components.
  const authKeys = [
    'navSignIn',
    'authBrandTagline',
    'authWelcomeBack',
    'authLoginSubtitle',
    'authEmailLabel',
    'authEmailPlaceholder',
    'authInvalidEmail',
    'authPasswordLabel',
    'authForgotPasswordLink',
    'authHidePassword',
    'authShowPassword',
    'authRememberMe',
    'authSigningIn',
    'authSignInButton',
    'authOrDivider',
    'authContinueWithGoogle',
    'authNoAccount',
    'authCreateAccountLink',
    'authCreateAccountTitle',
    'authRegisterSubtitle',
    'authConfirmPasswordLabel',
    'authPasswordMismatch',
    'authPasswordRequirements',
    'authCreatingAccount',
    'authCreateAccountButton',
    'authHaveAccount',
    'authSignInLink',
    'authPwStrengthWeak',
    'authPwStrengthFair',
    'authPwStrengthGood',
    'authPwStrengthStrong',
    'authBackToLogin',
    'authForgotPasswordTitle',
    'authForgotPasswordSubtitle',
    'authSendingLink',
    'authSendResetLink',
    'authResetPasswordTitle',
    'authResetPasswordSubtitle',
    'authNewPasswordLabel',
    'authResettingPassword',
    'authResetPasswordButton',
    'authCheckEmailTitle',
    'authCheckEmailVerifyDesc',
    'authCheckEmailResetDesc',
    'authResendEmail',
    'authEnterResetLinkManually',
    'authAccount',
    'authPlanFree',
    'authPlanPro',
    'authSignOutBtn',
    'authNotConfigured',
    'authEmailResent',
    'authFunFact1',
    'authFunFact2',
    'authFunFact3',
    'authFunFact4',
    'authFunFact5',
    'authFunFact6',
  ];

  it('every auth UI key has a real (non-fallback) translation in every supported language', () => {
    for (const key of authKeys) {
      for (const lang of languages) {
        const value = translations[lang][key];
        expect(value, `Missing "${key}" in "${lang}"`).toBeDefined();
        expect(value).not.toBe(key);
        expect(value!.length).toBeGreaterThan(0);
      }
    }
  });
});
