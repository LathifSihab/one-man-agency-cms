import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			getUser?: () => Promise<User | null>;
			user?: User;
		}
		interface PageData {
			user?: { email?: string } | null;
		}
	}
}

export {};
