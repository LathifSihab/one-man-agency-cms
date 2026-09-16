<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PublishState } from '$lib/server/dashboard';

	/**
	 * Saving is never called publishing. A save writes to the database; only a
	 * rebuild changes the live site. This banner states which of those is true
	 * right now, and never shows a green state it has not verified.
	 */
	let { publish: publishState }: { publish: PublishState } = $props();

	let busy = $state(false);
	let message = $state('');

	const TONE: Record<string, string> = {
		live: 'live',
		pending: 'pending',
		building: 'pending',
		failed: 'failed',
		unknown: 'pending'
	};

	function when(iso: string | null): string {
		if (!iso) return 'onbekend';
		return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' });
	}

	async function triggerPublish() {
		busy = true;
		message = '';
		try {
			const res = await fetch('/api/publish', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				message = body.message ?? 'Publiceren is niet gelukt. Je wijzigingen blijven bewaard.';
			} else if (body.deduped) {
				message = `Er loopt al een publicatie. Nog ongeveer ${body.wait} seconden.`;
			} else {
				message = 'Publiceren gestart. Dit duurt ongeveer een minuut.';
			}
			await invalidateAll();
		} catch {
			message = 'Publiceren is niet gelukt. Je wijzigingen blijven bewaard.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="cms-banner {TONE[publishState.status]}">
	<p>
		{#if publishState.status === 'live'}
			De site is bijgewerkt. Laatste publicatie {when(publishState.lastBuild?.finished_at ?? null)}.
		{:else if publishState.status === 'building'}
			Publiceren is bezig, gestart om {when(publishState.lastBuild?.triggered_at ?? null)}.
		{:else if publishState.status === 'failed'}
			De laatste publicatie is mislukt{publishState.lastBuild?.detail ? ` (${publishState.lastBuild.detail})` : ''}.
			Je wijzigingen staan nog klaar.
		{:else if publishState.status === 'pending'}
			{publishState.pendingChanges || 'Enkele'} wijziging{publishState.pendingChanges === 1 ? '' : 'en'} staan nog
			niet op de live site.
		{:else}
			Nog niet gepubliceerd sinds deze omgeving is opgezet.
		{/if}
	</p>
	<span class="cms-actions">
		{#if publishState.status !== 'live'}
			<button class="cms-btn" onclick={triggerPublish} disabled={busy || publishState.status === 'building'}>
				{busy ? 'Bezig…' : 'Publiceren'}
			</button>
		{:else}
			<button class="cms-btn cms-btn-ghost" onclick={triggerPublish} disabled={busy}>
				Opnieuw publiceren
			</button>
		{/if}
	</span>
</div>

{#if message}<p class="cms-hint" style="margin:-.9rem 0 1.4rem">{message}</p>{/if}
