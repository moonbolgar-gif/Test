/**
 * Тесты проверки подписи вебхуков Stripe.
 *
 * Запуск: npm run test:money (из корня репозитория).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TOLERANCE_SECONDS,
  SignatureError,
  signPayload,
  verifyStripeSignature,
} from './stripe_signature.ts';

const SECRET = 'whsec_test_secret';
const NOW = 1_800_000_000;
const BODY = JSON.stringify({
  id: 'evt_1',
  type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_1', amount: 530 } },
});

test('подлинная подпись принимается', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  await verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW });
});

test('подделанное тело отвергается', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  const tampered = BODY.replace('530', '1');
  await assert.rejects(
    () => verifyStripeSignature(tampered, header, SECRET, { nowSeconds: NOW }),
    SignatureError,
  );
});

test('чужой секрет отвергается', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  await assert.rejects(
    () => verifyStripeSignature(BODY, header, 'whsec_wrong', { nowSeconds: NOW }),
    SignatureError,
  );
});

test('пустой секрет отвергается, а не пропускает всё', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  await assert.rejects(
    () => verifyStripeSignature(BODY, header, '', { nowSeconds: NOW }),
    SignatureError,
  );
});

test('устаревшее сообщение отвергается (защита от повтора)', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  await assert.rejects(
    () =>
      verifyStripeSignature(BODY, header, SECRET, {
        nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS + 1,
      }),
    SignatureError,
  );
});

test('сообщение из будущего тоже отвергается', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  await assert.rejects(
    () =>
      verifyStripeSignature(BODY, header, SECRET, {
        nowSeconds: NOW - DEFAULT_TOLERANCE_SECONDS - 1,
      }),
    SignatureError,
  );
});

test('сообщение на границе допуска принимается', async () => {
  const header = await signPayload(BODY, SECRET, NOW);
  await verifyStripeSignature(BODY, header, SECRET, {
    nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS,
  });
});

test('подпись, подставленная под другой timestamp, отвергается', async () => {
  // Подписываем одно время, а объявляем другое: подпись перестаёт сходиться,
  // потому что время входит в подписываемую строку.
  const header = await signPayload(BODY, SECRET, NOW);
  const moved = header.replace(`t=${NOW}`, `t=${NOW + 10}`);
  await assert.rejects(
    () => verifyStripeSignature(BODY, moved, SECRET, { nowSeconds: NOW + 10 }),
    SignatureError,
  );
});

test('во время ротации секрета подходит любая из подписей v1', async () => {
  const valid = await signPayload(BODY, SECRET, NOW);
  const validSignature = valid.split('v1=')[1];
  const header = `t=${NOW},v1=${'0'.repeat(64)},v1=${validSignature}`;
  await verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW });
});

test('заголовок без подписей v1 отвергается', async () => {
  await assert.rejects(
    () => verifyStripeSignature(BODY, `t=${NOW},v0=abc`, SECRET, { nowSeconds: NOW }),
    SignatureError,
  );
});

test('заголовок без времени отвергается', async () => {
  await assert.rejects(
    () => verifyStripeSignature(BODY, `v1=${'0'.repeat(64)}`, SECRET, { nowSeconds: NOW }),
    SignatureError,
  );
});

test('мусор вместо заголовка отвергается', async () => {
  for (const header of ['', 'garbage', 't=,v1=', 't=abc,v1=def']) {
    await assert.rejects(
      () => verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW }),
      SignatureError,
      `заголовок ${JSON.stringify(header)}`,
    );
  }
});

test('пустое тело подписывается и проверяется корректно', async () => {
  const header = await signPayload('', SECRET, NOW);
  await verifyStripeSignature('', header, SECRET, { nowSeconds: NOW });
});
