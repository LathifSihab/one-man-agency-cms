import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// hooks.server.ts has already redirected unauthenticated requests.
	return {
		user: locals.user ? { email: locals.user.email } : null,
		pathname: url.pathname
	};
};
