-- Ascendo sample content seed script.
-- Run this once in the Supabase Dashboard SQL Editor to populate enough vocabulary/grammar/
-- listening content for the Vocab/Grammar/Listening screens to have something to show.
--
-- BEFORE RUNNING: replace the placeholder below with your own auth.users.id (Authentication →
-- Users in the dashboard, or `select id from auth.users where email = '...'`). That account is
-- inserted into public.admins so it can be the created_by for this content — it does not need to
-- be an account you actually sign in with, but reusing your own test account is fine and also
-- gives it admin access.
--
-- The listening passage below has no audio_url (real audio requires a real OpenAI TTS call,
-- which this script can't make) — the Listening screen shows "音源準備中です。しばらくお待ちくだ
-- さい。" for it, which is the existing, already-handled state for content with no audio yet.

do $$
declare
  v_admin_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE with your auth.users.id
  v_group_vocab uuid := gen_random_uuid();
  v_group_grammar uuid := gen_random_uuid();
  v_group_listening uuid := gen_random_uuid();
  v_content_id uuid;
  v_passage_id uuid := gen_random_uuid();
  v_position int := 0;
  v_word jsonb;
  v_question jsonb;
  v_words jsonb := '[
    {"target_text":"achieve","target_phonetic":"/əˈtʃiːv/","native_text":"達成する"},
    {"target_text":"improve","target_phonetic":"/ɪmˈpruːv/","native_text":"改善する"},
    {"target_text":"negotiate","target_phonetic":"/nɪˈɡoʊʃieɪt/","native_text":"交渉する"},
    {"target_text":"deadline","target_phonetic":"/ˈdedlaɪn/","native_text":"締め切り"},
    {"target_text":"opportunity","target_phonetic":"/ˌɑːpərˈtuːnəti/","native_text":"機会"},
    {"target_text":"colleague","target_phonetic":"/ˈkɑːliːɡ/","native_text":"同僚"},
    {"target_text":"schedule","target_phonetic":"/ˈskedʒuːl/","native_text":"予定"},
    {"target_text":"presentation","target_phonetic":"/ˌpriːzenˈteɪʃn/","native_text":"プレゼンテーション"},
    {"target_text":"feedback","target_phonetic":"/ˈfiːdbæk/","native_text":"フィードバック"},
    {"target_text":"budget","target_phonetic":"/ˈbʌdʒɪt/","native_text":"予算"}
  ]'::jsonb;
  v_grammar_questions jsonb := '[
    {"question":"I ___ to the meeting yesterday.","choices":["go","went","gone","going"],"answer":"went","explanation":"過去の出来事なので過去形went。"},
    {"question":"She has ___ finished her report.","choices":["already","yet","still","ago"],"answer":"already","explanation":"現在完了形でalreadyは「もう〜した」を表す。"},
    {"question":"If I ___ more time, I would finish the project.","choices":["have","had","has","having"],"answer":"had","explanation":"仮定法過去はif節でhad(過去形)を使う。"},
    {"question":"The presentation was given ___ the marketing team.","choices":["by","for","with","at"],"answer":"by","explanation":"受動態の動作主を示すbyを使う。"},
    {"question":"They ___ working on this project since March.","choices":["are","were","have been","had been"],"answer":"have been","explanation":"継続を表す現在完了進行形。"}
  ]'::jsonb;
begin
  if v_admin_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'Set v_admin_id to your real auth.users.id before running this script';
  end if;

  insert into public.admins (id) values (v_admin_id) on conflict (id) do nothing;

  insert into public.content_groups (id, owner_type, title, type, is_published, created_by)
  values
    (v_group_vocab, 'system', '基礎英単語', 'vocabulary', true, v_admin_id),
    (v_group_grammar, 'system', '基礎文法', 'grammar', true, v_admin_id),
    (v_group_listening, 'system', '基礎リスニング', 'listening', true, v_admin_id);

  -- vocabulary
  for v_word in select * from jsonb_array_elements(v_words)
  loop
    v_content_id := gen_random_uuid();
    insert into public.learning_contents (id, type, difficulty, is_published, created_by)
    values (v_content_id, 'vocabulary', 1, true, v_admin_id);

    insert into public.vocabulary_items (content_id, target_lang, target_text, target_phonetic, native_lang, native_text)
    values (v_content_id, 'en', v_word->>'target_text', v_word->>'target_phonetic', 'ja', v_word->>'native_text');

    v_position := v_position + 1;
    insert into public.content_group_items (content_group_id, content_id, position)
    values (v_group_vocab, v_content_id, v_position);
  end loop;

  -- grammar
  v_position := 0;
  for v_question in select * from jsonb_array_elements(v_grammar_questions)
  loop
    v_content_id := gen_random_uuid();
    insert into public.learning_contents (id, type, difficulty, is_published, created_by)
    values (v_content_id, 'grammar', 1, true, v_admin_id);

    insert into public.grammar_items (content_id, target_lang, question, choices, answer, explanation)
    values (v_content_id, 'en', v_question->>'question', v_question->'choices', v_question->>'answer', v_question->>'explanation');

    v_position := v_position + 1;
    insert into public.content_group_items (content_group_id, content_id, position)
    values (v_group_grammar, v_content_id, v_position);
  end loop;

  -- listening (one passage, one question; no audio_url yet — see note above)
  insert into public.listening_passages (id, created_by, target_lang, script_text)
  values (
    v_passage_id, v_admin_id, 'en',
    'Good morning everyone. Today we will discuss our quarterly sales results and plan for next quarter.'
  );

  v_content_id := gen_random_uuid();
  insert into public.learning_contents (id, type, difficulty, is_published, created_by)
  values (v_content_id, 'listening', 1, true, v_admin_id);

  insert into public.listening_items (content_id, listening_passage_id, question, choices, answer)
  values (
    v_content_id, v_passage_id,
    'What is the main topic of the talk?',
    '["Weather forecast","Quarterly sales results","Employee vacation policy","Office renovation"]'::jsonb,
    'Quarterly sales results'
  );

  insert into public.content_group_items (content_group_id, content_id, position)
  values (v_group_listening, v_content_id, 1);

  raise notice 'Seeded: vocab group %, grammar group %, listening group %', v_group_vocab, v_group_grammar, v_group_listening;
end $$;
