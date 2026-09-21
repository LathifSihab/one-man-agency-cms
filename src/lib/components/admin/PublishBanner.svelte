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

	/**
	 * Set when publishing was refused because the content points at something
	 * that is not there — a page that was renamed, or a deleted image.
	 */
	let problems = $state<{ ref: string; where: string }[]>([]);

	/** A build is genuinely running. Only this gets a progress bar. */
	const running = $derived(publishState.status === 'building');

	/*
	 * Polling continues through 'stale' as well: a deployment can go live a
	 * little after it finishes, and giving up at the build's end is how a slow
	 * promotion gets mistaken for a broken one. But 'stale' is not a build in
	 * progress, and showing it a progress bar and "de site wordt opnieuw
	 * opgebouwd" next to "het opbouwen is gelukt" said two opposite things at
	 * once.
	 */
	const polling = $derived(running || publishState.status === 'stale');

	/**
	 * Which build was already live when Publish was last pressed here.
	 *
	 * Null until something is published from this window, so a reload does not
	 * congratulate anyone on a publish they did not just make.
	 */
	let publishedPast = $state<string | null>(null);

	/**
	 * Whether a publish started here has reached the live site.
	 *
	 * Derived rather than latched. An earlier version raised a flag and let an
	 * effect consume it on the transition to 'live', which meant the answer
	 * depended on the effect observing a particular moment — and it did not
	 * reliably: republishing an already-live site fired the effect before
	 * invalidateAll had moved the status to 'building', so it consumed the flag
	 * against the build that was already there and had nothing left to report
	 * when the real one landed. Tests caught it passing and failing on timing
	 * alone.
	 *
	 * As a derivation there is no moment to miss: it is true exactly while the
	 * live site is showing a *different* finished build from the one that was
	 * live when Publish was pressed. It stops being true on its own when an edit
	 * makes the site pending again, when a later publish fails, or when the next
	 * publish moves the marker.
	 */
	const justPublished = $derived(
		publishedPast !== null &&
			publishState.status === 'live' &&
			(publishState.lastBuild?.finished_at ?? '') !== publishedPast
	);

	const TONE: Record<string, string> = {
		live: 'live',
		pending: 'pending',
		building: 'pending',
		failed: 'failed',
		// A wait, not a failure — the build worked, the hosting is catching up.
		stale: 'pending',
		unknown: 'pending'
	};

	/** Capped just below full: it only reaches 100% when the server says so. */
	const progress = $derived(Math.min(95, Math.round((elapsed / EXPECTED_SECONDS) * 100)));
	const overdue = $derived(elapsed > EXPECTED_SECONDS * 2);

	/**
	 * What went wrong, in words the person reading it can act on.
	 *
	 * The stored detail is written for the record, not for the editor: it can be
	 * as bare as "Deploy hook antwoordde met 500". Nobody should have to
	 * interpret an HTTP status to find out whether their afternoon's work is
	 * safe.
	 */
	function humanFailure(detail: string | null): string {
		const code = detail?.match(/antwoordde met (\d+)/)?.[1];
		if (code) {
			return (
				`De hosting nam de opdracht om te publiceren niet aan (foutcode ${code}). ` +
				'Dat ligt niet aan je wijzigingen.'
			);
		}
		if (detail?.includes('niets meer teruggemeld')) {
			return (
				'Het opbouwen van de site is stilgevallen zonder iets terug te melden. ' +
				'Waarschijnlijk liep er iets mis bij de hosting.'
			);
		}
		if (detail?.includes('niet aanvaard')) {
			return 'De bouwopdracht werd niet aanvaard door de hosting.';
		}
		return 'Er liep iets mis tijdens het opbouwen van de site.';
	}

	function when(iso: string | null): string {
		if (!iso) return 'onbekend';
		return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' });
	}

	// Tick and poll while a build runs, and on through a slow promotion.
	$effect(() => {
		if (!polling) {
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
		problems = [];
		try {
			const res = await fetch('/api/publish', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				// A refused publish lists what is wrong itself; the sentence then
				// only has to explain what to do about it.
				if (body.brokenLinks?.length) {
					problems = body.brokenLinks.map((b: { link: string; where: string }) => ({
						ref: b.link,
						where: b.where
					}));
					message =
						'Publiceren is gestopt: deze links verwijzen naar een pagina die niet meer ' +
						'bestaat. Dat gebeurt meestal nadat het webadres van een pagina is gewijzigd. ' +
						'Pas de link aan, of zet het oude webadres terug, en publiceer opnieuw. ' +
						'Je wijzigingen blijven bewaard.';
				} else if (body.missingImages?.length) {
					problems = body.missingImages.map((m: { value: string; where: string }) => ({
						ref: m.value,
						where: m.where
					}));
					message =
						'Publiceren is gestopt: deze afbeeldingen staan niet meer in de ' +
						'mediabibliotheek. Upload ze opnieuw, of haal ze van de pagina, en ' +
						'publiceer opnieuw. Je wijzigingen blijven bewaard.';
				} else {
					message = body.message ?? 'Publiceren is niet gelukt. Je wijzigingen blijven bewaard.';
				}
			} else if (body.deduped) {
				message = `Er loopt al een publicatie. Nog ongeveer ${body.wait} seconden.`;
			} else {
				message = '';
				// Remember which build was live at this moment. The confirmation is
				// then whatever differs from it, rather than a flag someone has to
				// catch being raised.
				publishedPast = publishState.lastBuild?.finished_at ?? '';
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
		!polling && publishState.pending.length > 0 &&
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
			{#if running}
				<span class="cms-spinner" aria-hidden="true"></span>
				Bezig met publiceren{changeCount ? ` van ${changeCount} ${changeWord}` : ''}…
			{:else if justPublished}
				<strong>Gepubliceerd.</strong> Je wijzigingen staan nu op de live site.
			{:else if publishState.status === 'live'}
				De site is bijgewerkt. Laatste publicatie {when(publishState.lastBuild?.finished_at ?? null)}.
			{:else if publishState.status === 'stale'}
				<span class="cms-spinner" aria-hidden="true"></span>
				De site is opgebouwd. Even wachten tot de hosting de nieuwe versie live zet…
			{:else if publishState.status === 'failed'}
				<strong>Publiceren is niet gelukt.</strong>
				{humanFailure(publishState.lastBuild?.detail ?? null)}
				Je wijzigingen zijn niet verloren — ze staan nog klaar om gepubliceerd te worden.
			{:else if publishState.status === 'pending'}
				{changeCount}
				{changeWord} sinds de laatste publicatie
			{:else}
				Nog niet gepubliceerd sinds deze omgeving is opgezet.
			{/if}
		</p>

		{#if running}
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
				Je wijzigingen zijn goed opgebouwd. De hosting zet de nieuwe versie meestal
				binnen een halve minuut live; deze melding verdwijnt dan vanzelf. Je hoeft
				niets te doen en kan dit venster gerust sluiten.
				{#if publishState.liveBuiltAt}
					Bezoekers krijgen op dit moment nog de versie van {when(publishState.liveBuiltAt)}.
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
		{#if running || publishState.status === 'stale'}
			<button class="cms-btn" disabled>Bezig…</button>
		{:else if justPublished}
			<!-- Nothing left to do here, so the action is to go and look at it
			     rather than an invitation to publish the same thing twice. -->
			<a class="cms-btn" href="/" target="_blank" rel="noopener">Bekijk de site ↗</a>
		{:else if publishState.status === 'live'}
			<button class="cms-btn cms-btn-ghost" onclick={triggerPublish} disabled={busy}>
				Opnieuw publiceren
			</button>
		{:else if publishState.status === 'failed'}
			<button class="cms-btn" onclick={triggerPublish} disabled={busy}>
				{busy ? 'Bezig…' : 'Probeer opnieuw'}
			</button>
		{:else}
			<button class="cms-btn" onclick={triggerPublish} disabled={busy}>
				{busy ? 'Bezig…' : 'Publiceren'}
			</button>
		{/if}
	</span>
</div>

{#if message}
	<p class="cms-hint" style="margin:-.9rem 0 {problems.length ? '.6rem' : '1.4rem'}">{message}</p>
{/if}

{#if problems.length}
	<ul class="cms-changes" style="margin:0 0 1.4rem">
		{#each problems as p (p.ref + p.where)}
			<li><code>{p.ref}</code> <span>in {p.where}</span></li>
		{/each}
	</ul>
{/if}
