<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let next = $state('');
	let repeat = $state('');
	let busy = $state(false);

	const tooShort = $derived(next.length > 0 && next.length < 12);
	const mismatch = $derived(repeat.length > 0 && next !== repeat);
</script>

<h1>Account</h1>
<p class="cms-lead">Je aanmeldgegevens voor het beheer.</p>

<div class="cms-card" style="max-width:520px">
	<h3>E-mailadres</h3>
	<p class="cms-meta" style="margin:0">{data.email}</p>
	<p class="cms-hint">
		Dit is het enige beheeraccount. Een nieuw adres instellen doe je met het
		script <code>tools/seed_account.py</code>.
	</p>
</div>

<h2>Wachtwoord wijzigen</h2>

{#if form?.message}<div class="cms-error" style="max-width:520px">{form.message}</div>{/if}
{#if form?.changed}
	<div class="cms-ok" style="max-width:520px">
		Je wachtwoord is gewijzigd. Gebruik het de volgende keer dat je je aanmeldt.
	</div>
{/if}

<form
	method="POST"
	action="?/password"
	style="max-width:520px"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update();
			next = '';
			repeat = '';
			busy = false;
		};
	}}
>
	<!-- Helps password managers associate the entry with the right account. -->
	<input type="hidden" name="username" autocomplete="username" value={data.email} />

	<div class="cms-field">
		<label for="current">Huidig wachtwoord</label>
		<input id="current" name="current" type="password" autocomplete="current-password" required />
	</div>

	<div class="cms-field">
		<label for="next">Nieuw wachtwoord</label>
		<input id="next" name="next" type="password" autocomplete="new-password"
		       bind:value={next} class:over={tooShort} required />
		<p class="cms-hint" style={tooShort ? 'color:#a32222' : ''}>
			Minstens 12 tekens.{tooShort ? ` Nu ${next.length}.` : ''}
		</p>
	</div>

	<div class="cms-field">
		<label for="repeat">Nieuw wachtwoord herhalen</label>
		<input id="repeat" name="repeat" type="password" autocomplete="new-password"
		       bind:value={repeat} class:over={mismatch} required />
		{#if mismatch}
			<p class="cms-hint" style="color:#a32222">De twee wachtwoorden zijn niet gelijk.</p>
		{/if}
	</div>

	<button class="cms-btn" type="submit" disabled={busy || tooShort || mismatch}>
		{busy ? 'Bezig…' : 'Wachtwoord wijzigen'}
	</button>
</form>
