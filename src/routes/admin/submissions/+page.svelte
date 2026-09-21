<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import { confirmSubmit, reportTo } from '$lib/components/admin/confirmSubmit';
	let { data, form } = $props();

	const LABELS: Record<string, string> = {
		naam: 'Naam', bedrijf: 'Bedrijf', email: 'E-mail', telefoon: 'Telefoon',
		onderwerp: 'Onderwerp', budget: 'Budget', vraag: 'Vraag', website: 'Website',
		gemeente: 'Gemeente', nieuwsbrief: 'Nieuwsbrief'
	};

	/** How each form announces itself in the list. */
	const VARIANT_LABEL: Record<string, string> = {
		scan: 'Gratis scan',
		offerte: 'Offerteaanvraag',
		contact: 'Contact'
	};

	let confirmer: ConfirmDialog | undefined = $state();

	const when = (iso: string) =>
		new Date(iso).toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<ConfirmDialog bind:this={confirmer} />

<h1>Berichten</h1>
<p class="cms-lead">
	Ingevulde contact-, offerte- en scanformulieren. Nieuwste eerst.
</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}

{#if !data.submissions.length}
	<div class="cms-card"><p style="margin:0">Nog geen berichten ontvangen.</p></div>
{/if}

{#each data.submissions as s (s.id)}
	<div class="cms-card" style="margin-bottom:.8rem">
		<div class="cms-row-head">
			<strong>
				{VARIANT_LABEL[s.variant] ?? s.variant} &middot; {when(s.created_at)}
				{#if !s.is_read}<span class="cms-badge warn">Nieuw</span>{/if}
			</strong>
			<span class="cms-actions">
				<form method="POST" action="?/read" use:enhance>
					<input type="hidden" name="id" value={s.id} />
					{#if !s.is_read}
						<button class="cms-btn cms-btn-ghost cms-btn-small" type="submit">
							Markeer als gelezen
						</button>
					{:else}
						<input type="hidden" name="unread" value="on" />
						<button class="cms-btn cms-btn-ghost cms-btn-small" type="submit">
							Markeer als nieuw
						</button>
					{/if}
				</form>
				<form method="POST" action="?/delete"
				      use:enhance={reportTo(confirmer, {
					      success: 'Het bericht is verwijderd.',
					      failure: 'Verwijderen is niet gelukt.'
				      })}
				      onsubmit={(e) =>
					      confirmSubmit(e, confirmer, {
						      title: 'Dit bericht verwijderen?',
						      body: `Het bericht van ${s.payload.naam ?? 'deze afzender'} wordt definitief verwijderd.`,
						      confirmLabel: 'Verwijderen',
						      workingLabel: 'Bezig met verwijderen…'
					      })}>
					<input type="hidden" name="id" value={s.id} />
					<button class="cms-btn cms-btn-danger cms-btn-small" type="submit">Verwijderen</button>
				</form>
			</span>
		</div>
		<table class="cms-table" style="margin-top:.6rem;border:0">
			<tbody>
				{#each Object.entries(s.payload) as [key, value] (key)}
					<tr>
						<th style="width:150px">{LABELS[key] ?? key}</th>
						<td>
							{#if key === 'email'}<a href="mailto:{value}">{value}</a>
							{:else if key === 'telefoon'}<a href="tel:{value}">{value}</a>
							{:else if key === 'website'}<a href={String(value)} target="_blank" rel="noopener">{value}</a>
							{:else}{value}{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}
