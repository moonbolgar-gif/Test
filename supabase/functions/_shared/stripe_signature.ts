/**
 * Проверка подписи вебхуков Stripe. docs/SPEC.md §10 (`POST /webhooks/stripe`).
 *
 * Вебхук — это неаутентифицированный публичный эндпоинт, по которому в систему
 * приходят сообщения «платёж прошёл» и «платёж провалился». Без проверки подписи
 * любой желающий может объявить чужую ставку оплаченной или, наоборот, вызвать
 * начисление. Поэтому проверка обязательна и вынесена отдельным модулем с тестами.
 *
 * Реализация на Web Crypto: один и тот же код работает и в Deno (Edge Functions),
 * и в Node — тесты гоняются в Node, продакшен в Deno.
 *
 * Формат заголовка Stripe-Signature:
 *   t=1699999999,v1=<hex hmac>,v1=<hex hmac>,v0=<...>
 * Подписывается строка `${t}.${rawBody}` по HMAC-SHA256 секретом вебхука.
 * Схем v1 может быть несколько (во время ротации секрета) — достаточно совпадения
 * с любой из них.
 */

export class SignatureError extends Error {}

/** Расхождение по времени, после которого сообщение считается устаревшим. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

interface ParsedHeader {
  timestamp: number;
  signatures: string[];
}

function parseSignatureHeader(header: string): ParsedHeader {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === 't') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new SignatureError('malformed timestamp in Stripe-Signature header');
      }
      timestamp = parsed;
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }

  if (timestamp === null) {
    throw new SignatureError('missing timestamp in Stripe-Signature header');
  }
  if (signatures.length === 0) {
    throw new SignatureError('no v1 signatures in Stripe-Signature header');
  }
  return { timestamp, signatures };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Сравнение за постоянное время.
 *
 * Обычное `===` на строках выходит из сравнения на первом несовпавшем байте, что
 * позволяет подобрать подпись побайтово по времени ответа. Здесь сравниваются все
 * байты всегда.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(signature);
}

export interface VerifyOptions {
  /** Допустимое расхождение по времени в секундах. */
  toleranceSeconds?: number;
  /** Текущее время в секундах Unix. Параметр существует ради тестируемости. */
  nowSeconds?: number;
}

/**
 * Проверяет подпись вебхука. Бросает SignatureError, если сообщение подделано,
 * устарело или заголовок повреждён.
 *
 * `rawBody` должен быть ровно тем телом, что пришло по сети. Любой цикл
 * JSON.parse → JSON.stringify меняет байты (порядок ключей, пробелы) и ломает
 * подпись, поэтому проверка всегда идёт до разбора тела.
 */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  options: VerifyOptions = {},
): Promise<void> {
  if (!secret) {
    throw new SignatureError('webhook secret is not configured');
  }

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  // Защита от повтора: перехваченное сообщение нельзя переиграть позже.
  if (Math.abs(now - timestamp) > tolerance) {
    throw new SignatureError(
      `timestamp outside tolerance: ${Math.abs(now - timestamp)}s > ${tolerance}s`,
    );
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);

  // Все кандидаты проверяются до конца, без раннего выхода.
  let matched = false;
  for (const candidate of signatures) {
    if (timingSafeEqual(candidate, expected)) {
      matched = true;
    }
  }
  if (!matched) {
    throw new SignatureError('signature mismatch');
  }
}

/** Сборка заголовка для тестов и локальной отладки. */
export async function signPayload(
  rawBody: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const signature = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return `t=${timestamp},v1=${signature}`;
}
