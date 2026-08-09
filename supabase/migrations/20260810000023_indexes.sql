create index idx_learning_contents_type_published on public.learning_contents (type, is_published);
create index idx_content_group_items_group on public.content_group_items (content_group_id);
create index idx_content_group_items_content on public.content_group_items (content_id);
create index idx_learning_records_profile_content on public.learning_records (profile_id, content_id);
create index idx_learning_records_test on public.learning_records (test_id) where test_id is not null;
create index idx_plan_day_logs_plan_date on public.plan_day_logs (learning_plan_id, log_date);
create index idx_user_vocabulary_progress_profile on public.user_vocabulary_progress (profile_id);
create index idx_ai_usage_logs_created_at on public.ai_usage_logs (created_at);
create index idx_admin_audit_logs_created_at on public.admin_audit_logs (created_at);
