/**
 * Start a dev server for a browser test, and be certain it is the one we get.
 *
 * Both browser tests spawn `vite dev` through a shell, and on Windows killing
 * that shell leaves the actual server running. With --strictPort the next run's
 * spawn then fails quietly and the test connects to the ORPHAN instead — an old
 * server compiled from an older copy of the component. That is not a flaky
 * test, it is a test measuring last week's code: results alternated between
 * passes and failures depending on which stale server was still listening.
 *
 * So: refuse to start if the port is taken, and kill the whole process tree.
 */
import { spawn, execSync } from 'node:child_process';
import { createConnection } from 'node:net';

const isWindows = process.platform === 'win32';

/** Resolves true when something is already listening. */
function portBusy(port) {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: '127.0.0.1' });
		socket.on('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.on('error', () => resolve(false));
		setTimeout(() => {
			socket.destroy();
			resolve(false);
		}, 1500);
	});
}

/**
 * Start vite on `port` and wait until `path` answers.
 *
 * Returns a stop() that takes the whole tree down.
 */
export async function startDevServer(port, path, timeoutMs = 90000) {
	if (await portBusy(port)) {
		throw new Error(
			`Port ${port} is already in use. That is almost certainly an orphaned dev ` +
				`server from an earlier run, and connecting to it would test whatever code ` +
				`it was started with. Stop it first.`
		);
	}

	const child = spawn('npx', ['vite', 'dev', '--port', String(port), '--strictPort'], {
		stdio: 'ignore',
		shell: isWindows
	});

	let stopped = false;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		if (isWindows && child.pid) {
			// The shell is not the server; take the tree.
			try {
				execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
			} catch {
				/* already gone */
			}
		} else {
			child.kill();
		}
	};

	// Whatever happens to this process, do not leave a server behind.
	process.once('exit', stop);
	process.once('SIGINT', () => {
		stop();
		process.exit(130);
	});

	const base = `http://localhost:${port}`;
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (child.exitCode !== null) {
			stop();
			throw new Error(`vite dev exited with ${child.exitCode} before serving ${path}`);
		}
		try {
			const res = await fetch(`${base}${path}`);
			if (res.ok) break;
		} catch {
			/* not up yet */
		}
		if (Date.now() > deadline) {
			stop();
			throw new Error('vite dev did not start in time');
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	return { base, stop };
}
