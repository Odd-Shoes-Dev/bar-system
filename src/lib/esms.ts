interface EsmsSendPayload {
  to: string;
  text: string;
}

interface EsmsApiResponse {
  status?: string;
  message?: string;
  messageId?: string;
  reason?: string;
  [key: string]: any;
}

export interface SmsTemplateVariables {
  salonName: string;
  clientName: string;
  services: string;
  total: string;
  pointsEarned: string;
  totalPoints: string;
  receiptNumber: string;
  paymentMethod: string;
}

const ESMS_BASE_URL = 'https://sms.esmsafrica.io/api/messages';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getRequiredEnv('ESMS_API_KEY')}`,
  };
}

// Strip characters outside the GSM-7 character set so messages use standard
// encoding (160 chars/segment). Emojis and fancy Unicode force UCS-2 mode
// (70 chars/segment) which many African carrier gateways reject outright.
export function toGsm7Safe(text: string): string {
  // GSM-7 basic character set + extended set (common punctuation)
  // Replace common Unicode lookalikes with ASCII equivalents first
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u20AC/g, 'EUR')
    // Remove everything outside printable ASCII (removes all emojis and non-GSM chars)
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E\n\r]/g, '');
}

export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;

  // Normalize local Uganda-style numbers (e.g. 0700xxxxxx) to E.164
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.startsWith('0') && digitsOnly.length >= 10) {
    return `+256${digitsOnly.slice(1)}`;
  }

  // Fallback: prepend + if already country format without symbol
  if (digitsOnly.length >= 9) {
    return `+${digitsOnly}`;
  }

  return trimmed;
}

export function renderSmsTemplate(template: string, vars: SmsTemplateVariables): string {
  return template
    .replaceAll('{salonName}', vars.salonName)
    .replaceAll('{clientName}', vars.clientName)
    .replaceAll('{services}', vars.services)
    .replaceAll('{total}', vars.total)
    .replaceAll('{pointsEarned}', vars.pointsEarned)
    .replaceAll('{totalPoints}', vars.totalPoints)
    .replaceAll('{receiptNumber}', vars.receiptNumber)
    .replaceAll('{paymentMethod}', vars.paymentMethod);
}

export function getDefaultReceiptSmsTemplate(): string {
  return (
    'Hello {clientName}. Thank you for visiting {salonName}. Your {paymentMethod} payment of UGX {total} has been received with receipt {receiptNumber}. ' +
    'Thank you and see you again soon!'
  );
}

export async function sendSms(payload: EsmsSendPayload): Promise<EsmsApiResponse> {
  const response = await fetch(`${ESMS_BASE_URL}/send`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      to: normalizePhoneNumber(payload.to),
      text: toGsm7Safe(payload.text),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as EsmsApiResponse;

  if (!response.ok) {
    throw new Error(data.reason || data.message || 'Failed to send SMS');
  }

  return data;
}

export async function getSmsCountries(): Promise<any> {
  const response = await fetch(`${ESMS_BASE_URL}/countries`, {
    headers: getHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.reason || data.message || 'Failed to fetch countries');
  }
  return data;
}

export async function getSmsPricing(): Promise<any> {
  const response = await fetch(`${ESMS_BASE_URL}/pricing`, {
    headers: getHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.reason || data.message || 'Failed to fetch pricing');
  }
  return data;
}

export async function getSmsCountryPricing(countryCode: string): Promise<any> {
  const response = await fetch(`${ESMS_BASE_URL}/pricing/${countryCode}`, {
    headers: getHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.reason || data.message || 'Failed to fetch country pricing');
  }
  return data;
}
