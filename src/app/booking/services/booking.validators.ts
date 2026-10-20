import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validators shared by the booking forms.
 *
 * Angular's built-in Validators.email accepts things like "a@b" which most
 * backends reject, so the email check here is deliberately stricter.
 */

/** Rejects addresses without a dotted TLD of at least two characters. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Accepts E.164 (+2348012345678) and common local formats, tolerating
 * spaces, hyphens, dots and parentheses as separators.
 */
export const PHONE_PATTERN = /^\+?[0-9][0-9\s\-().]{6,19}$/;

/** Strips every character that isn't a digit or a leading plus. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/** Collapses runs of whitespace and trims the ends. */
export function normaliseWhitespace(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Stricter alternative to Validators.email. */
export function strictEmail(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null; // let `required` own emptiness
    }
    return EMAIL_PATTERN.test(String(value).trim())
      ? null
      : { strictEmail: true };
  };
}

/** Validates a phone number by its digit count after normalisation. */
export function phoneNumber(
  options: { minDigits?: number; maxDigits?: number } = {}
): ValidatorFn {
  const { minDigits = 7, maxDigits = 15 } = options;

  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const raw = String(value).trim();
    if (!PHONE_PATTERN.test(raw)) {
      return { phoneNumber: { reason: 'format' } };
    }

    const digitCount = raw.replace(/\D/g, '').length;
    if (digitCount < minDigits) {
      return { phoneNumber: { reason: 'tooShort', minDigits, digitCount } };
    }
    if (digitCount > maxDigits) {
      return { phoneNumber: { reason: 'tooLong', maxDigits, digitCount } };
    }

    return null;
  };
}

/**
 * Length check that ignores surrounding whitespace, so a field of spaces
 * cannot satisfy a minimum length.
 */
export function trimmedLength(
  min: number,
  max: number
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const length = String(value).trim().length;
    if (length < min) {
      return { trimmedLength: { reason: 'tooShort', min, actual: length } };
    }
    if (length > max) {
      return { trimmedLength: { reason: 'tooLong', max, actual: length } };
    }
    return null;
  };
}

/** Fails when a value is only whitespace. */
export function notBlank(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return String(value).trim().length > 0 ? null : { notBlank: true };
  };
}

/**
 * Turns a control's errors into a message the template can render directly,
 * so error copy lives in one place instead of being spread across templates.
 */
export function firstErrorMessage(
  control: AbstractControl | null,
  fieldLabel: string
): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) {
    return null;
  }

  const errors = control.errors;

  if (errors['required'] || errors['notBlank']) {
    return `${fieldLabel} is required.`;
  }
  if (errors['strictEmail'] || errors['email']) {
    return `Enter a valid email address.`;
  }
  if (errors['phoneNumber']) {
    const detail = errors['phoneNumber'];
    if (detail?.reason === 'tooShort') {
      return `Phone number is too short.`;
    }
    if (detail?.reason === 'tooLong') {
      return `Phone number is too long.`;
    }
    return `Enter a valid phone number, including country code.`;
  }
  if (errors['trimmedLength']) {
    const detail = errors['trimmedLength'];
    if (detail?.reason === 'tooShort') {
      return `${fieldLabel} must be at least ${detail.min} characters.`;
    }
    return `${fieldLabel} must be ${detail.max} characters or fewer.`;
  }
  if (errors['minlength']) {
    return `${fieldLabel} must be at least ${errors['minlength'].requiredLength} characters.`;
  }
  if (errors['maxlength']) {
    return `${fieldLabel} must be ${errors['maxlength'].requiredLength} characters or fewer.`;
  }

  return `${fieldLabel} is not valid.`;
}
