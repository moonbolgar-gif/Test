/**
 * POST /webhooks/stripe — обработка событий Stripe. docs/SPEC.md §10, §8.6.
 *
 * Единственный источник истины о судьбе платежа. Клиент никогда не сообщает нам,
 * что деньги списаны (§3.3).
 *
 * Обрабатываемые события:
 *   setup_intent.succeeded          — карта привязана, сохраняем payment_method
 *   payment_intent.succeeded        — ставка списана, ставка → charged
 *   payment_intent.payment_failed   — отказ, §8.6: ретраи 1ч / 24ч / 72ч
 *   payment_intent.requires_action  — нужен 3DS, §8.6: push пользователю
 *
 * Порядок событий Stripe не гарантирует, а доставку делает «хотя бы один раз»,
 * поэтому обработчики идемпотентны: повторное событие не меняет состояние дважды.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { SignatureError, verifyStripeSignature } from '../_shared/stripe_signature.ts';

/** §8.6: ретраи через 1 ч, 24 ч, 72 ч. */
const RETRY_DELAYS_HOURS = [1, 24, 72];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

async function handleSetupIntentSucceeded(
  admin: SupabaseClient,
  object: Record<string, unknown>,
): Promise<void> {
  const customerId = object.customer as string | null;
  const paymentMethodId = object.payment_method as string | null;
  if (!customerId || !paymentMethodId) return;

  await admin
    .from('profiles')
    .update({ default_payment_method_id: paymentMethodId })
    .eq('stripe_customer_id', customerId);
}

async function handlePaymentSucceeded(
  admin: SupabaseClient,
  object: Record<string, unknown>,
): Promise<void> {
  const paymentIntentId = object.id as string;

  // Условие `status <> 'charged'` делает обработчик идемпотентным: повторная
  // доставка того же события не перезапишет charged_at и не удвоит статистику.
  const { data: stake } = await admin
    .from('stakes')
    .update({ status: 'charged', charged_at: new Date().toISOString(), last_error: null })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .neq('status', 'charged')
    .select('id, user_id, amount_cents')
    .maybeSingle();

  if (!stake) return;   // Уже обработано, либо ставка не наша.

  // Записи ledger создаёт та же функция, что инициировала списание: она знает
  // доли на момент операции. Здесь только фиксируем факт успеха.
  if (stake.user_id) {
    await admin.rpc('increment_total_lost', {
      p_user_id: stake.user_id,
      p_amount_cents: stake.amount_cents,
    });
  }
}

async function handlePaymentFailed(
  admin: SupabaseClient,
  object: Record<string, unknown>,
): Promise<void> {
  const paymentIntentId = object.id as string;
  const error = object.last_payment_error as { message?: string; code?: string } | null;

  const { data: stake } = await admin
    .from('stakes')
    .select('id, charge_attempts, user_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (!stake) return;

  const attempts = stake.charge_attempts + 1;
  const delayHours = RETRY_DELAYS_HOURS[attempts - 1];

  // §8.6: после трёх неудач ретраи прекращаются, денежные режимы блокируются
  // до погашения задолженности.
  const nextRetryAt = delayHours === undefined
    ? null
    : new Date(Date.now() + delayHours * 3600_000).toISOString();

  await admin
    .from('stakes')
    .update({
      status: 'failed',
      charge_attempts: attempts,
      next_retry_at: nextRetryAt,
      last_error: error?.message ?? error?.code ?? 'unknown_error',
    })
    .eq('id', stake.id);

  if (nextRetryAt === null && stake.user_id) {
    await admin
      .from('profiles')
      .update({ money_modes_enabled: false })
      .eq('id', stake.user_id);
  }
}

async function handleRequiresAction(
  admin: SupabaseClient,
  object: Record<string, unknown>,
): Promise<void> {
  // §8.6: 3DS/SCA. Ставка остаётся pending — деньги ещё не списаны и не отпущены.
  // Пользователю уходит push «Подтверди платёж» (§11), экран с челленджем
  // открывается по client_secret.
  const paymentIntentId = object.id as string;
  await admin
    .from('stakes')
    .update({ last_error: 'requires_action:3ds' })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('status', 'pending');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Тело читается сырым: проверка подписи идёт по точным байтам запроса.
  const rawBody = await req.text();
  const signature = req.headers.get('Stripe-Signature');

  if (!signature) {
    return json({ error: 'missing_signature' }, 400);
  }

  try {
    await verifyStripeSignature(
      rawBody,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (error) {
    if (error instanceof SignatureError) {
      // Тело не логируем: оно не прошло проверку подлинности.
      console.warn('rejected stripe webhook', { reason: error.message });
      return json({ error: 'invalid_signature' }, 400);
    }
    throw error;
  }

  const event = JSON.parse(rawBody) as StripeEvent;
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    switch (event.type) {
      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(admin, event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(admin, event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(admin, event.data.object);
        break;
      case 'payment_intent.requires_action':
        await handleRequiresAction(admin, event.data.object);
        break;
      default:
        // Неизвестные события подтверждаем: иначе Stripe будет слать их с
        // нарастающей задержкой и в итоге отключит эндпоинт.
        break;
    }
  } catch (error) {
    // Отвечаем 500, чтобы Stripe повторил доставку: потерять событие об успешном
    // списании хуже, чем обработать его дважды — обработчики идемпотентны.
    console.error('failed to handle stripe event', { eventId: event.id, type: event.type, error });
    return json({ error: 'handler_failed' }, 500);
  }

  return json({ received: true });
});
