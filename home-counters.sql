-- ══════════════════════════════════════════════════════════════
-- نواة المستقبل — عدّادات الصفحة الرئيسية = نفس أرقام لوحة الإدارة
--
-- الخانات التلاتة في الرئيسية بقت بتعد بنفس طريقة «الطلبات المستلمة»:
--   طلب مفتوح     = جديدة محتاجة إسناد (استلام ومحدش اتسند له)
--   جاري التنفيذ  = جارية (اتسند ولسه ما اتصلحش)
--   تم الإصلاح    = إصلاح أو غلق
-- لكل طلبات المدينة، وبترجع أعداد بس من غير أي بيانات شخصية.
--
-- شغّل الملف ده مرة واحدة في:
--   Supabase → SQL Editor → New query → الصق → Run
-- ══════════════════════════════════════════════════════════════

create or replace function public.request_stage_counts()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'open', count(*) filter (where stage = 0 and coalesce(btrim(tech_id), '') = ''),
    'work', count(*) filter (where stage < 3 and not (stage = 0 and coalesce(btrim(tech_id), '') = '')),
    'done', count(*) filter (where stage >= 3),
    'all',  count(*))
  from public.requests;
$$;

revoke all on function public.request_stage_counts() from public;
grant execute on function public.request_stage_counts() to anon, authenticated;

-- النتيجة المفروض تطابق أرقام «الطلبات المستلمة» في اللوحة
select public.request_stage_counts() as "عدّادات الرئيسية";
