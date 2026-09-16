import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * Privileged database access for admin server routes.
 *
 * The service role key bypasses RLS, so this must only ever be called from
 * server code behind the /admin guard in hooks.server.ts, or from an API route
 * that does its own authorisation.
 */
export function adminDb(): SupabaseClient {
	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw error(
			500,
			'Supabase is not configured. Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
		);
	}
	return createClient(url, key, { auth: { persistSession: false } });
}
