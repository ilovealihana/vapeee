export type ApiErrorDetails = Record<string, unknown>;

export interface ApiErrorResponse {
  code?: string;
  message?: string;
  details?: ApiErrorDetails;
  detail?: unknown;
}

export type TranslationFunction = (key: string, params?: Record<string, unknown>) => string;

const INTERNAL_ERROR_CODE = 'common.internal_error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function interpolate(message: string, params: Record<string, unknown>): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    message,
  );
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function parseApiError(response: Response): Promise<ApiClientError> {
  const payload = await response.json().catch(() => undefined);

  if (isRecord(payload) && typeof payload.code === 'string') {
    const message = typeof payload.message === 'string' ? payload.message : payload.code;
    const details = isRecord(payload.details) ? payload.details : {};

    return new ApiClientError(response.status, payload.code, message, details);
  }

  const detail = isRecord(payload) ? payload.detail : undefined;
  const message = typeof detail === 'string' ? detail : `HTTP ${response.status}`;

  return new ApiClientError(response.status, INTERNAL_ERROR_CODE, message, {});
}

export function getErrorCode(error: unknown): string {
  return error instanceof ApiClientError ? error.code : INTERNAL_ERROR_CODE;
}

export function formatApiError(error: unknown, t: TranslationFunction): string {
  const code = getErrorCode(error);
  const key = `errors.${code}`;
  const message = t(key);

  if (message !== key) {
    return message;
  }

  return t(`errors.${INTERNAL_ERROR_CODE}`);
}

export function formatValidationFieldErrors(
  error: unknown,
  t: TranslationFunction,
): Record<string, string> {
  if (!(error instanceof ApiClientError) || error.code !== 'validation.failed') {
    return {};
  }

  const fields = error.details.fields;
  if (!Array.isArray(fields)) {
    return {};
  }

  return fields.reduce<Record<string, string>>((fieldErrors, item) => {
    if (!isRecord(item) || typeof item.field !== 'string' || typeof item.code !== 'string') {
      return fieldErrors;
    }

    const params = isRecord(item.params) ? item.params : {};
    const key = item.code.startsWith('validation.') ? item.code : `validation.${item.code}`;
    const message = t(key, params);

    fieldErrors[item.field] =
      message === key ? t(`errors.${INTERNAL_ERROR_CODE}`) : interpolate(message, params);

    return fieldErrors;
  }, {});
}
