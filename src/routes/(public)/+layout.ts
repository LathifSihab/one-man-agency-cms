/**
 * The public site is fully prerendered and ships no client-side JavaScript
 * (handover/06). `/admin` opts back out of both — see src/routes/admin/+layout.ts.
 */
export const prerender = true;
export const ssr = true;
export const csr = false;
