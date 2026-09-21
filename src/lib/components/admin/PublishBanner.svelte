<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PublishState } from '$lib/server/dashboard';

	/**
	 * Saving is never called publishing. A save writes to the database; only a
	 * rebuild changes the live site. This banner states which of those is true
	 * right now, and never shows a green state it has not verified.
	 *
	 * While a build runs it polls the server rather than guessing: the progress
	 * bar is a time estimate, clearly labelled as one, but the status it settles
	 * on comes from the build record.
	 */
	let { publish: publishState }: { publish: PublishState } = $props();

	/** A build normally takes about this long; used only for the progress bar. */
	const EXPECTED_SECONDS = 60;
	const POLL_MS = 4000;
	/**
	 * Must outlast BUILD_DEADLINE_MS in $lib/server/dashboard.ts, which settles a
	 * silent build as failed after ten minutes. Giving up before then stopped the
	 * polling that would have collected that verdict, leaving the spinner turning
	 * on a build the server had already written off.
	 */
	const GIVE_UP_SECONDS = 11 * 60;

	let busy = $state(false);
	let message = $state('');
	let elapsed = $state(0);

	/** Set when publishing was refused because a link points at a missing page. */
	let brokenLinks = $state<{ link: string; where: string }[]>([]);

	/* Polling continues through 'stale' as well as 'building': a deployment can
	   go live a little after it finishes, and giving up at the build's end is how
	   a slow promotion gets mistaken for a broken one. */
	const building = $derived(
		publishState.status === 'building' || publishState.status === 'stale'
	);

	const TONE: Record<string, string> = {
		live: 'live',
		pending: 'pending',
		building: 'pending',
		failed: 'failed',
		stale: 'failed',
		unknown: 'pending'
	};

	/** Capped just below full: it only reaches 100% when the server says so. */
	const progress = $derived(Math.min(95, Math.round((elapsed / EXPECTED_SECONDS) * 100)));
	const overdue = $derived(elapsed > EXPECTED_SECONDS * 2);

	function when(iso: string | null): string {
		if (!iso) return 'onbekend';
		return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' });
	}

	// Tick and poll only while a build is actually running.
	$effect(() => {
		if (!building) {
			elapsed = 0;
			return;
		}

		const started = publishState.lastBuild?.triggered_at
			? new Date(publishState.lastBuild.triggered_at).getTime()
			: Date.now();

		const tick = setInterval(() => {
			elapsed = Math.round((Date.now() - started) / 1000);
		}, 1000);

		const poll = setInterval(() => {
			if (elapsed > GIVE_UP_SECONDS) {
				clearInterval(poll);
				message =
					'Deze publicatie geeft geen teken van leven meer. Herlaad deze pagina: ' +
					'de status wordt dan op mislukt gezet en je kan opnieuw publiceren. ' +
					'Je wijzigingen blijven bewaard.';
				return;
			}
			invalidateAll();
		}, POLL_MS);

		return () => {
			clearInterval(tick);
			clearInterval(poll);
		};
	});

	async function triggerPublish() {
		busy = true;
		message = '';
		brokenLinks = [];
		try {
			const res = await fetch('/api/publish', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				// A refused publish lists the links itself; the sentence then only
				// has to explain what to do about them.
				brokenLinks = body.brokenLinks ?? [];
				message = brokenLinks.length
					? 'Publiceren is gestopt: deze links verwijzen naar een pagina die niet meer ' +
						'bestaat. Dat gebeurt meestal nadat het webadres van een pagina is gewijzigd. ' +
						'Pas de link aan, of zet het oude webadres terug, en publiceer opnieuw. ' +
						'Je wijzigingen blijven bewaard.'
					: (body.message ?? 'Publiceren is niet gelukt. Je wijzigingen blijven bewaard.');
			} else if (body.deduped) {
				message = `Er loopt al een publicatie. Nog ongeveer ${body.wait} seconden.`;
			} else {
				message = '';
			}
			await invalidateAll();
		} catch {
			message = 'Publiceren is niet gelukt. Je wijzigingen blijven bewaard.';
		} finally {
			busy = false;
		}
	}

	const changeCount = $derived(publishState.pendingChanges);
	const changeWord = $derived(changeCount === 1 ? 'wijziging' : 'wijzigingen');

	/** Long lists are collapsed: saving the logo screen can touch many rows. */
	const COLLAPSED = 5;
	let expanded = $state(false);

	const showList = $derived(
		!building && publishState.pending.length > 0 &&
			(publishState.status === 'pending' || publishState.status === 'failed')
	);
	const visible = $derived(
		expanded ? publishState.pending : publishState.pending.slice(0, COLLAPSED)
	);
	const hidden = $derived(publishState.pending.length - visible.length);

	function clock(iso: string): string {
		return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
	}
</script>

<div class="cms-banner {TONE[publishState.status]}">
	<div style="flex:1 1 320px">
		<p>
			{#if building}
				<span class="cms-spinner" aria-hidden="true"></span>
				Bezig met publiceren{changeCount ? ` van ${changeCount} ${changeWord}` : ''}…
			{:else if publishState.status === 'live'}
				De site is bijgewerkt. Laatste publicatie {when(publishState.lastBuild?.finished_at ?? null)}.
			{:else if publishState.status === 'stale'}
			De site is opnieuw opgebouwd, maar bezoekers krijgen nog de vorige versie.
		{:else if publishState.status === 'failed'}
				De laatste publicatie is mislukt{publishState.lastBuild?.detail
					? ` (${publishState.lastBuild.detail})`
					: ''}. Je wijzigingen staan nog klaar.
			{:else if publishState.status === 'pending'}
				{changeCount}
				{changeWord} sinds de laatste publicatie
			{:else}
				Nog niet gepubliceerd sinds deze omgeving is opgezet.
			{/if}
		</p>

		{#if building}
			<div
				class="cms-progress"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={progress}
				aria-label="Voortgang van het publiceren"
			>
				<div class="cms-progress-bar" style="width:{progress}%"></div>
			</div>
			<p class="cms-progress-note">
				{elapsed}s bezig{overdue ? ' — langer dan gewoonlijk' : ', meestal ongeveer een minuut'}.
				De site wordt opnieuw opgebouwd; je kan dit venster gerust sluiten.
			</p>
		{/if}

		{#if publishState.status === 'stale'}
			<p class="cms-progress-note">
				Het opbouwen is gelukt, maar de nieuwe versie is niet live gezet. Probeer
				opnieuw te publiceren. Blijft dit staan, dan moet de laatste versie bij de
				hosting handmatig live gezet worden.
				{#if publishState.liveBuiltAt}
					De live versie dateert van {when(publishState.liveBuiltAt)}.
				{/if}
			</p>
		{/if}

		{#if showList}
			<ul class="cms-changes">
				{#each visible as change (change.kind + change.label + change.updatedAt)}
					<li>
						<span class="cms-badge draft">{change.kind}</span>
						{#if change.href}
							<a href={change.href}>{change.label}</a>
						{:else}
							<span>{change.label}</span>
						{/if}
						<time datetime={change.updatedAt}>{clock(change.updatedAt)}</time>
					</li>
				{/each}
			</ul>

			{#if hidden > 0}
				<button type="button" class="cms-link-btn" onclick={() => (expanded = !expanded)}>
					{expanded ? 'Toon minder' : `En ${hidden} ${hidden === 1 ? 'andere' : 'andere'}…`}
				</button>
			{/if}

			<p class="cms-progress-note">
				{changeCount === 1 ? 'Deze wijziging staat' : 'Deze wijzigingen staan'} nog niet op de
				live site. Publiceren duurt ongeveer een minuut.
			</p>
		{/if}
	</div>

	<span class="cms-actions">
		{#if publishState.status === 'stale'}
			<button class="cms-btn" onclick={triggerPublish} disabled={busy}>
				{busy ? 'Bezig…' : 'Opnieuw proberen'}
			</button>
		{:else if building}
			<button class="cms-btn" disabled>Bezig…</button>
		{:else if publishState.status === 'live'}
			<button class="cms-btn cms-btn-ghost" onclick={triggerPublish} disabled={busy}>
				Opnieuw publiceren
			</button>
		{:else}
			<button class="cms-btn" onclick={triggerPublish} disabled={busy}>
				{busy ? 'Bezig…' : 'Publiceren'}
			</button>
		{/if}
	</span>
</div>

{#if message}
	<p class="cms-hint" style="margin:-.9rem 0 {brokenLinks.length ? '.6rem' : '1.4rem'}">{message}</p>
{/if}

{#if brokenLinks.length}
	<ul class="cms-changes" style="margin:0 0 1.4rem">
		{#each brokenLinks as b (b.link + b.where)}
			<li><code>{b.link}</code> <span>in {b.where}</span></li>
		{/each}
	</ul>
{/if}
