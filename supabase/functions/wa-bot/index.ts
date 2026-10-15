// Entry point Supabase Edge Function "wa-bot" (webhook WhatsApp Cloud API).
// Deploy: supabase functions deploy wa-bot --no-verify-jwt
// Logika ada di handler.mjs & logic.mjs; lihat README.md di folder ini.
import { createHandler } from "./handler.mjs";

const handler = createHandler({ env: Deno.env.toObject(), fetchImpl: fetch });

Deno.serve(handler);
