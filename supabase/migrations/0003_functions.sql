-- Серверные функции денежного контура. docs/SPEC.md §3.3, §8.
--
-- Всё, что меняет деньги или производные от них счётчики, живёт здесь и вызывается
-- только из Edge Functions под service_role. Клиенту эти функции не выдаются.

-- §6.4: карточка «Потеряно во сне». Счётчик наращивается атомарно: два вебхука
-- Stripe, доставленные одновременно, не должны затереть инкремент друг друга,
-- что и произошло бы при read-modify-write на стороне приложения.
create or replace function increment_total_lost(p_user_id uuid, p_amount_cents int)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set total_lost_cents = total_lost_cents + p_amount_cents
   where id = p_user_id;
$$;

-- §6.4: парная карточка «Спасено». Вызывается при успешном прохождении испытания,
-- когда ставка отпущена и деньги остались у пользователя.
create or replace function increment_total_saved(p_user_id uuid, p_amount_cents int)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set total_saved_cents = total_saved_cents + p_amount_cents
   where id = p_user_id;
$$;

-- Функции денежного контура не должны быть доступны клиенту даже на выполнение:
-- SECURITY DEFINER означает выполнение с правами владельца, поэтому право EXECUTE
-- здесь равносильно праву менять чужую статистику.
revoke execute on function increment_total_lost(uuid, int) from public, anon, authenticated;
revoke execute on function increment_total_saved(uuid, int) from public, anon, authenticated;

-- Хелперы RLS, напротив, обязаны быть исполнимы клиентом — политики вызывают их
-- в контексте запроса пользователя.
grant execute on function is_squad_member(uuid) to authenticated;
grant execute on function current_squad_id() to authenticated;
