<script lang="ts">
	import { enhance } from '$app/forms';
	import '$lib/admin.css';

	let { form } = $props();

	/* The step lives in the server's answer, so a refresh cannot strand someone
	   halfway with a code they can no longer submit. */
	const step = $derived(form?.step ?? 'email');
	const email = $derived(form?.email ?? '');

	let busy = $state(false);
	let next = $state('');
	let repeat = $state('');

	const tooShort = $derived(next.length > 0 && next.length < 12);
	const mismatch = $derived(repeat.length > 0 && next !== repeat);

	/* Each step is a single question on its own screen, so putting the cursor in
	   the field is help rather than hijacking. Done on mount rather than with the
	   autofocus attribute, which applies before anyone can have formed an
	   intention about where to type. */
	function focusHere(node: HTMLInputElement) {
		node.focus();
	}

	const submitting = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
</script>

<svelte:head>
	<title>Wachtwoord herstellen</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="cms-login">
	<div class="cms-card">
		<h1>Wachtwoord herstellen</h1>

		<ol class="cms-steps" aria-label="Voortgang">
			<li class:done={step !== 'email'} class:now={step === 'email'}>E-mailadres</li>
			<li class:done={step === 'wachtwoord'} class:now={step === 'code'}>Code</li>
			<li class:now={step === 'wachtwoord'}>Nieuw wachtwoord</li>
		</ol>

		{#if form?.message}<div class="cms-error">{form.message}</div>{/if}

		{#if step === 'email'}
			<p class="cms-lead">
				Vul je e-mailadres in. Als er een account op staat, krijg je een code toegestuurd.
			</p>
			<form method="POST" action="?/send" use:enhance={submitting}>
				<div class="cms-field">
					<label for="email">E-mailadres</label>
					<input id="email" name="email" type="email" autocomplete="username"
					       value={form?.email ?? ''} required />
				</div>
				<div class="cms-actions">
					<button class="cms-btn" type="submit" disabled={busy}>
						{busy ? 'Bezig…' : 'Stuur me een code'}
					</button>
					<a class="cms-btn cms-btn-ghost cms-btn-small" href="/admin/login">Terug</a>
				</div>
			</form>
		{:else if step === 'code'}
			{#if form?.sent}
				<div class="cms-ok">
					Als er een account bestaat op {email}, is er een code onderweg.
				</div>
			{/if}
			<p class="cms-lead">
				Vul de code uit die e-mail in. Ze werkt één keer en vervalt binnen het uur.
			</p>
			<form method="POST" action="?/verify" use:enhance={submitting}>
				<input type="hidden" name="email" value={email} />
				<div class="cms-field">
					<label for="code">Code</label>
					<!-- inputmode numeric brings up a number pad; one-time-code lets a
					     phone offer the value straight from the message. -->
					<input id="code" name="code" type="text" inputmode="numeric"
					       autocomplete="one-time-code" pattern="[0-9 ]*"
					       class="cms-code" required use:focusHere />
				</div>
				<div class="cms-actions">
					<button class="cms-btn" type="submit" disabled={busy}>
						{busy ? 'Bezig…' : 'Controleer de code'}
					</button>
				</div>
			</form>

			<form method="POST" action="?/send" use:enhance={submitting} style="margin-top:.8rem">
				<input type="hidden" name="email" value={email} />
				<button class="cms-btn cms-btn-ghost cms-btn-small" type="submit" disabled={busy}>
					Stuur een nieuwe code
				</button>
			</form>
		{:else}
			<div class="cms-ok">De code klopte. Kies nu een nieuw wachtwoord.</div>
			<form method="POST" action="?/update" use:enhance={submitting}>
				<input type="hidden" name="username" autocomplete="username" value={email} />
				<div class="cms-field">
					<label for="next">Nieuw wachtwoord</label>
					<input id="next" name="next" type="password" autocomplete="new-password"
					       bind:value={next} class:over={tooShort} required use:focusHere />
					<p class="cms-hint" style={tooShort ? 'color:#a32222' : ''}>
						Minstens 12 tekens.{tooShort ? ` Nu ${next.length}.` : ''}
					</p>
				</div>
				<div class="cms-field">
					<label for="repeat">Herhaal het wachtwoord</label>
					<input id="repeat" name="repeat" type="password" autocomplete="new-password"
					       bind:value={repeat} class:over={mismatch} required />
					{#if mismatch}
						<p class="cms-hint" style="color:#a32222">De twee wachtwoorden zijn niet gelijk.</p>
					{/if}
				</div>
				<button class="cms-btn" type="submit" disabled={busy || tooShort || mismatch}>
					{busy ? 'Bezig…' : 'Wachtwoord instellen'}
				</button>
			</form>
		{/if}
	</div>
</div>
