<script lang="ts">
	import { page } from '$app/state';
	import '$lib/admin.css';

	let { data, children } = $props();

	const NAV = [
		{ href: '/admin', label: 'Overzicht' },
		{ href: '/admin/pages', label: "Pagina's" },
		{ href: '/admin/blog', label: 'Blog' },
		{ href: '/admin/logos', label: "Logo's" },
		{ href: '/admin/submissions', label: 'Berichten' },
		{ href: '/admin/media', label: 'Afbeeldingen' },
		{ href: '/admin/settings', label: 'Instellingen' }
	];

	const onLogin = $derived(page.url.pathname.startsWith('/admin/login'));

	function active(href: string): boolean {
		return href === '/admin'
			? page.url.pathname === '/admin'
			: page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>Beheer — One Man Agency</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if onLogin}
	{@render children()}
{:else}
	<div class="cms">
		<aside class="cms-side">
			<a class="cms-brand" href="/admin">
				<img src="/assets/logo-oma.png" alt="One Man Agency" width="337" height="215" />
			</a>
			<nav aria-label="Beheernavigatie">
				<ul>
					{#each NAV as item (item.href)}
						<li>
							<a href={item.href} aria-current={active(item.href) ? 'page' : undefined}>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
			<div class="cms-user">
				{#if data.user}<p>{data.user.email}</p>{/if}
				<form method="POST" action="/admin/login?/logout">
					<button class="cms-btn cms-btn-ghost" type="submit">Afmelden</button>
				</form>
				<p class="cms-meta"><a href="/" target="_blank" rel="noopener">Bekijk de site ↗</a></p>
			</div>
		</aside>
		<main class="cms-main">{@render children()}</main>
	</div>
{/if}
