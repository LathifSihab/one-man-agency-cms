/**
 * Where the build puts its output.
 *
 * adapter-cloudflare writes the prerendered site and `_worker.js` into one
 * directory. Several post-build tools write into it, and when this moved from
 * `.vercel/output/static` they did not all move together — so it lives here
 * once rather than as a string in four files.
 */
export const OUTPUT_DIR = '.svelte-kit/cloudflare';
