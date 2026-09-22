import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const prerender = true;

/**
 * A stamp of the build that produced this copy of the site.
 *
 * Written into the published output, so it can be fetched from the live site
 * and compared with the build the CMS triggered. That is the only way to answer
 * the question the Publish button actually poses — "is what I just built the
 * thing visitors are seeing?" — rather than the much weaker one it answered
 * before, which was "did a build start?".
 *
 * Those two came apart in practice: a build succeeded and the production alias
 * went on serving the previous deployment, so the CMS reported success while
 * the site had not changed. Something the editor cannot see is worse than an
 * error they can.
 *
 * Read by anyone, deliberately: it has to be fetchable from the admin without a
 * session, and it says nothing a visitor could not learn from the page source.
 */
export const GET: RequestHandler = async () => {
	const body = {
		builtAt: new Date().toISOString(),
		// Injected by Workers Builds, absent locally. Neither is secret.
		commit: env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) ?? null,
		deployment: env.WORKERS_CI_BUILD_UUID ?? null
	};

	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json',
			// Must never be cached, or the check reads a stale answer and the CMS
			// goes back to lying about whether the site updated.
			'cache-control': 'no-store, max-age=0',
			'x-robots-tag': 'noindex'
		}
	});
};
