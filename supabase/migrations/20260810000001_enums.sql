create type plan_tier as enum ('free', 'paid');
create type subscription_status as enum ('active', 'canceled', 'expired', 'grace_period');
create type subscription_store as enum ('app_store', 'google_play');
create type content_group_owner_type as enum ('system', 'user');
create type ai_usage_purpose as enum ('plan_generation', 'plan_chat', 'tts_generation');
create type ai_usage_provider as enum ('claude', 'openai');
