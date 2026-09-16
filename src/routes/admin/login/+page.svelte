<script lang="ts">
	import { enhance } from '$app/forms';
	import '$lib/admin.css';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<div class="cms-login">
	<div class="cms-card">
		<img src="/assets/logo-oma.png" alt="One Man Agency" />
		<h1>Aanmelden</h1>
		<p class="cms-lead">Beheer van onemanagency.be</p>

		{#if data.configError}
			<div class="cms-error">Supabase is nog niet geconfigureerd op deze omgeving.</div>
		{/if}
		{#if form?.message}
			<div class="cms-error">{form.message}</div>
		{/if}
		{#if form?.sent}
			<div class="cms-ok">Als dit adres bestaat, is er een herstelmail verstuurd.</div>
		{/if}

		<form method="POST" action="?/login" use:enhance={() => {
			busy = true;
			return async ({ update }) => { await update(); busy = false; };
		}}>
			<div class="cms-field">
				<label for="email">E-mailadres</label>
				<input id="email" name="email" type="email" autocomplete="username"
				       value={form?.email ?? ''} required />
			</div>
			<div class="cms-field">
				<label for="password">Wachtwoord</label>
				<input id="password" name="password" type="password"
				       autocomplete="current-password" required />
			</div>
			<div class="cms-actions">
				<button class="cms-btn" type="submit" disabled={busy}>
					{busy ? 'Bezig…' : 'Aanmelden'}
				</button>
				<button class="cms-btn cms-btn-ghost cms-btn-small" type="submit"
				        formaction="?/reset" formnovalidate>Wachtwoord vergeten</button>
			</div>
		</form>
	</div>
</div>
