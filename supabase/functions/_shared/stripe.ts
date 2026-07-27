/**
 * Минимальный клиент Stripe REST API. docs/SPEC.md §8.
 *
 * Почему не официальный SDK: Edge Functions выполняются в Deno, а нужны ровно три
 * вызова (Customer, SetupIntent, PaymentIntent). Тонкий клиент на fetch не тянет
 * npm-совместимость в рантайм и делает явным то, что важно в §3.3 —
 * idempotency key на каждой денежной операции.
 *
 * Stripe принимает form-encoded тело, а не JSON, включая вложенные объекты
 * в виде `a[b]=c`.
 */

export class StripeError extends Error {
  constructor(
    message: string,
    readonly type: string | undefined,
    readonly code: string | undefined,
    readonly statusCode: number,
    readonly raw: unknown,
  ) {
    super(message);
  }

  /**
   * Отказ банка, который не исправится повтором с теми же данными.
   * §8.6: такие ставки уходят в `failed` и блокируют денежные режимы
   * до обновления карты, а не крутятся в ретраях.
   */
  get isPermanentDecline(): boolean {
    return this.code === 'card_declined' || this.code === 'expired_card' ||
      this.code === 'incorrect_number' || this.code === 'invalid_expiry_year' ||
      this.code === 'invalid_expiry_month';
  }
}

type FormValue = string | number | boolean | undefined | null;
type FormInput = { [key: string]: FormValue | FormInput };

function encodeForm(input: FormInput, prefix = ''): string[] {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') {
      pairs.push(...encodeForm(value, name));
    } else {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs;
}

export interface StripePaymentIntent {
  id: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'canceled'
    | 'succeeded';
  amount: number;
  client_secret: string | null;
  last_payment_error?: { code?: string; message?: string } | null;
}

export interface StripeSetupIntent {
  id: string;
  status: string;
  client_secret: string | null;
}

export interface StripeCustomer {
  id: string;
}

export class StripeClient {
  constructor(
    private readonly secretKey: string,
    private readonly baseUrl = 'https://api.stripe.com/v1',
  ) {
    if (!secretKey) {
      throw new StripeError('Stripe secret key is not configured', undefined, undefined, 0, null);
    }
  }

  private async request<T>(
    path: string,
    body: FormInput,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    // §3.3: повтор после сетевого сбоя не должен списывать деньги дважды.
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: encodeForm(body).join('&'),
    });

    const payload = await response.json();
    if (!response.ok) {
      const error = payload?.error ?? {};
      throw new StripeError(
        error.message ?? `Stripe request failed with ${response.status}`,
        error.type,
        error.code,
        response.status,
        payload,
      );
    }
    return payload as T;
  }

  createCustomer(userId: string, email?: string): Promise<StripeCustomer> {
    return this.request<StripeCustomer>(
      '/customers',
      { email, metadata: { rise_user_id: userId } },
      // Один пользователь — один Customer, даже если запрос повторится.
      `rise:customer:${userId}`,
    );
  }

  /**
   * §8.1 шаг 1 — привязка карты. `usage: off_session` обязателен: без него
   * сохранённый способ оплаты нельзя будет использовать позже без пользователя,
   * а вся модель §8.1 построена именно на этом.
   */
  createSetupIntent(customerId: string): Promise<StripeSetupIntent> {
    return this.request<StripeSetupIntent>('/setup_intents', {
      customer: customerId,
      usage: 'off_session',
      'payment_method_types[0]': 'card',
    });
  }

  /**
   * §8.1 шаг 4 — списание без присутствия пользователя.
   *
   * `off_session: true` сообщает банку, что пользователя нет у экрана: это меняет
   * оценку риска и в Европе позволяет применить исключение из SCA. Если банк всё
   * же требует 3DS, PaymentIntent вернётся в статусе `requires_action` — по §8.6
   * это не ошибка, а сценарий с push-уведомлением.
   */
  createOffSessionCharge(params: {
    customerId: string;
    paymentMethodId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    alarmRunId: string;
    description: string;
  }): Promise<StripePaymentIntent> {
    return this.request<StripePaymentIntent>(
      '/payment_intents',
      {
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        amount: params.amountCents,
        currency: params.currency,
        confirm: true,
        off_session: true,
        description: params.description,
        metadata: { rise_alarm_run_id: params.alarmRunId },
      },
      params.idempotencyKey,
    );
  }
}
