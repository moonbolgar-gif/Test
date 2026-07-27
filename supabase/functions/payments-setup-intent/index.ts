/**
 * POST /payments/setup-intent — привязка карты. docs/SPEC.md §10, §8.1 шаг 1.
 *
 * Возвращает client_secret для SetupIntent. Само сохранение способа оплаты
 * происходит на клиенте через Stripe SDK, а `payment_method_id` доезжает до нас
 * вебхуком `setup_intent.succeeded` — клиенту не доверяем сообщать, что карта
 * привязана.
 *
 * Проверки перед выдачей SetupIntent:
 *   - §8.5 — денежные режимы не выключены аварийным флагом;
 *   - §6.3 / §14.4 — пользователь подтвердил, что ему есть 18;
 *   - §8.6 — пользователь сам не отключил денежные режимы.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { StripeClient, StripeError } from '../_shared/stripe.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'unauthorized' }, 401);
  }

  // Клиент под service_role: нам нужно читать и писать profiles.stripe_customer_id,
  // а эта колонка закрыта от клиента политиками RLS.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userError || !userData.user) {
    return json({ error: 'unauthorized' }, 401);
  }
  const userId = userData.user.id;

  // §8.5: аварийный выключатель денежных режимов без перевыпуска приложения.
  const { data: flags } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'feature_flags')
    .single();
  if (flags?.value?.money_modes !== true) {
    return json({ error: 'money_modes_disabled' }, 403);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('stripe_customer_id, is_adult_confirmed, money_modes_enabled')
    .eq('id', userId)
    .single();
  if (profileError || !profile) {
    return json({ error: 'profile_not_found' }, 404);
  }

  // §14.4: денежная механика доступна только с 18 лет.
  if (!profile.is_adult_confirmed) {
    return json({ error: 'adult_confirmation_required' }, 403);
  }
  if (!profile.money_modes_enabled) {
    return json({ error: 'money_modes_disabled_by_user' }, 403);
  }

  try {
    const stripe = new StripeClient(Deno.env.get('STRIPE_SECRET_KEY')!);

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.createCustomer(userId, userData.user.email);
      customerId = customer.id;
      const { error: saveError } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
      if (saveError) {
        // Customer в Stripe уже создан, но у нас не сохранён. Повторный вызов
        // вернёт того же Customer благодаря idempotency key, так что расхождение
        // самоустранится — но знать о нём надо.
        console.error('failed to persist stripe_customer_id', { userId, saveError });
        return json({ error: 'internal_error' }, 500);
      }
    }

    const setupIntent = await stripe.createSetupIntent(customerId);
    return json({ client_secret: setupIntent.client_secret });
  } catch (error) {
    if (error instanceof StripeError) {
      console.error('stripe error in setup-intent', {
        userId,
        type: error.type,
        code: error.code,
        message: error.message,
      });
      return json({ error: 'payment_provider_error' }, 502);
    }
    console.error('unexpected error in setup-intent', { userId, error });
    return json({ error: 'internal_error' }, 500);
  }
});
