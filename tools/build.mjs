/**
 * Build entry point.
 *
 * On Linux (Vercel, CI) this is a plain `vite build`.
 *
 * On Windows it first installs a narrow shim: adapter-vercel links each route's
 * `.func` directory to a shared bundle with a symlink, and Windows refuses to
 * create symlinks unless Developer Mode is on or the shell is elevated.
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

const { build } = await import('vite');
await build();
