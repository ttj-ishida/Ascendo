import 'dotenv/config';
import { createApp, type AppDeps } from './app.ts';
import { createJwksVerifier } from './shared/auth/verify.ts';
import { createUserClient, createServiceClient } from './shared/supabase-client.ts';
import { createAiAdapter } from './shared/ai-adapter.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
const openaiApiKey = requireEnv('OPENAI_API_KEY');
const port = Number(process.env.PORT ?? 3000);

const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);

const deps: AppDeps = {
  verify: createJwksVerifier(supabaseUrl),
  isAdmin: async (accessToken: string) => {
    const client = createUserClient(supabaseUrl, anonKey, accessToken);
    const { data, error } = await client.rpc('is_admin');
    return !error && data === true;
  },
  aiAdapter: createAiAdapter({ anthropicApiKey, openaiApiKey }),
  serviceClient,
  createUserClient: (accessToken: string) => createUserClient(supabaseUrl, anonKey, accessToken),
};

const app = createApp(deps);

app.listen(port, () => {
  console.log(`Ascendo backend listening on port ${port}`);
});
