const MIXED_LANGUAGE_PLACEHOLDERS = new Set(['Changelog будет загружен...']);
const PLACEHOLDER_PATTERN = /\$\{[^}]+\}|\{\{[^}]+\}\}/;
const TRANSLATION_KEY_PATTERN = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+$/i;

function normalizeUiText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function isSuspiciousUiText(value: string | null | undefined): boolean {
  const text = normalizeUiText(value ?? '');

  if (!text) {
    return true;
  }

  if (MIXED_LANGUAGE_PLACEHOLDERS.has(text)) {
    return true;
  }

  if (PLACEHOLDER_PATTERN.test(text)) {
    return true;
  }

  if (/^\[object\s+\w+\]$/.test(text)) {
    return true;
  }

  if (/^(?:error:\s*)?(?:null|undefined)$/i.test(text)) {
    return true;
  }

  if (TRANSLATION_KEY_PATTERN.test(text) && !text.includes('://')) {
    return true;
  }

  return false;
}

export function sanitizeUiText(value: string | null | undefined, fallback: string) {
  const safeFallback = normalizeUiText(fallback);
  const text = normalizeUiText(value ?? '');

  if (isSuspiciousUiText(text)) {
    return safeFallback;
  }

  return text;
}
