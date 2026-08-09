create or replace function public.check_test_completion()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_test_id uuid := new.test_id;
  v_total int;
  v_answered int;
begin
  if v_test_id is null then
    return new;
  end if;

  select count(*) into v_total from public.test_items where test_id = v_test_id;
  select count(distinct content_id) into v_answered
    from public.learning_records
    where test_id = v_test_id;

  if v_total > 0 and v_answered >= v_total then
    update public.tests set status = 'completed'
    where id = v_test_id and status <> 'completed';
  end if;

  return new;
end;
$$;

create trigger trg_check_test_completion
after insert on public.learning_records
for each row execute function public.check_test_completion();
