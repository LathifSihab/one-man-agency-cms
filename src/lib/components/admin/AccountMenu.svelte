<script lang="ts">
	/**
	 * Avatar with the signed-in address, a link to change the password, and sign
	 * out. There is one account, so this is identity rather than user switching.
	 */
	let { email }: { email: string | null } = $props();

	let open = $state(false);
	let root: HTMLDivElement | null = $state(null);

	const initials = $derived(
		(email ?? '?')
			.split('@')[0]
			.split(/[.\-_+]/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || '?'
	);

	function onWindowClick(event: MouseEvent) {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<div class="cms-account" bind:this={root}>
	<button
		type="button"
		class="cms-avatar-btn"
		aria-expanded={open}
		aria-haspopup="menu"
		aria-controls="account-menu"
		onclick={() => (open = !open)}
	>
		<span class="cms-avatar" aria-hidden="true">{initials}</span>
		<span class="cms-avatar-email">{email ?? 'Niet aangemeld'}</span>
		<span class="cms-avatar-caret" aria-hidden="true">{open ? '▾' : '▴'}</span>
		<span class="cms-sr">Accountmenu</span>
	</button>

	{#if open}
		<div class="cms-menu" id="account-menu" role="menu">
			<p class="cms-menu-head">
				Aangemeld als<br /><strong>{email}</strong>
			</p>
			<a class="cms-menu-item" href="/admin/account" role="menuitem" onclick={() => (open = false)}>
				Wachtwoord wijzigen
			</a>
			<form method="POST" action="/admin/login?/logout">
				<button class="cms-menu-item cms-menu-danger" type="submit" role="menuitem">
					Afmelden
				</button>
			</form>
		</div>
	{/if}
</div>
