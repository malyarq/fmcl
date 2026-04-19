import { sanitizeUiText } from './safeUiText';

const ERROR_PREFIX_PATTERN = /^Error:\s*/i;
const IPC_WRAPPER_PATTERN = /^\[[^[\]]+\]\s+[\w.-]+\s+failed:\s*/i;
const RECOVERY_UNSAFE_PATTERN =
  /(?:\b(?:localhost|node_modules|react-dom|webpack|vite)\b|https?:\/\/|file:\/\/|\/Users\/|[A-Z]:\\|(?:^|\s)at\s.+:\d+:\d+|Cannot read properties|Cannot destructure|Minified React error|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Hooks can only be called|Objects are not valid as a React child)/i;

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || error.toString();
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }

  return '';
}

export function unwrapTechnicalErrorMessage(message: string) {
  let current = message.trim();
  let previous = '';

  while (current && current !== previous) {
    previous = current;
    current = current.replace(ERROR_PREFIX_PATTERN, '').trim();
    current = current.replace(IPC_WRAPPER_PATTERN, '').trim();
  }

  return current;
}

export function toDisplayErrorMessage(error: unknown, fallback: string) {
  const rawMessage = readErrorMessage(error);

  if (!rawMessage) {
    return fallback;
  }

  return sanitizeUiText(unwrapTechnicalErrorMessage(rawMessage), fallback);
}

export function toRecoveryErrorMessage(error: unknown, fallback: string) {
  const displayMessage = toDisplayErrorMessage(error, fallback);

  if (!displayMessage || displayMessage === fallback) {
    return fallback;
  }

  if (displayMessage.includes('\n') || RECOVERY_UNSAFE_PATTERN.test(displayMessage)) {
    return fallback;
  }

  return displayMessage;
}

export function formatTechnicalErrorDetails(error: Error | null | undefined) {
  if (!error) {
    return '';
  }

  const summary = error.message.trim() ? `${error.name || 'Error'}: ${error.message.trim()}` : error.toString().trim();

  return error.stack?.trim() || summary || 'Error';
}
