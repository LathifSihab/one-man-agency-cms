/**
 * Build entry point.
 *
 * On Linux (Workers Builds, CI) this is a plain `vite build`.
 *
 * On Windows it first installs a narrow shim: an adapter may link part of its
 * output with a symlink, and Windows refuses to create symlinks unless
 * Developer Mode is on or the shell is elevated. adapter-vercel did this for
 * every route's `.func` directory; adapter-cloudflare is lighter on symlinks,
 * but the shim costs nothing and only intercepts an outright EPERM.
 * Directory junctions are allowed and behave identically for this purpose, so
 * we fall back to one only when the symlink is refused. Without this, a local
 * production build cannot complete and the parity check cannot run.
 */
import fs from 'node:fs';
import path from 'node:path';

if (process.platform === 'win32') {
	const original = fs.symlinkSync;

	fs.symlinkSync = (target, linkPath, type) => {
		try {
			return original(target, linkPath, type);
		} catch (err) {
			if (err.code !== 'EPERM') throw err;
			// A junction needs an absolute target; the caller may have passed a
			// path relative to the link's own directory.
			const absolute = path.isAbsolute(target)
				? target
				: path.resolve(path.dirname(linkPath), target);
			return original(absolute, linkPath, 'junction');
		}
	};
}

/*
 * Which commit this build is. build-info.json publishes it.
 *
 * WORKERS_CI_COMMIT_SHA is not reliable on its own: builds started by the
 * deploy hook (the CMS Publish button) or by Retry are tied to a branch, not a
 * commit, and there the variable holds the branch name — the live site
 * reported `"commit":"main"`. The build container always has the clone, so ask
 * git instead whenever the variable does not look like a SHA.
 *
 * Set here rather than in the route because this runs as plain Node before the
 * build, and the prerender process inherits the environment it is given.
 */
const SHA = /^[0-9a-f]{7,40}$/i;
const fromCi = process.env.WORKERS_CI_COMMIT_SHA;
if (fromCi && SHA.test(fromCi)) {
	process.env.BUILD_COMMIT = fromCi;
} else {
	try {
		const { execFileSync } = await import('node:child_process');
		const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
		if (SHA.test(head)) process.env.BUILD_COMMIT = head;
	} catch {
		// No git, no clone: build-info.json says null, as it always did.
	}
}

const { build } = await import('vite');
await build();
