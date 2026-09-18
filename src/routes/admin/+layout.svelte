<script lang="ts">
	import { page } from '$app/state';
	import AccountMenu from '$components/admin/AccountMenu.svelte';
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

	/*
	 * The screens you reach before being signed in get no CMS shell.
	 *
	 * Recovery used to render the full sidebar — every section name, the account
	 * menu, the link to the site — to someone who has not proved anything yet.
	 * It is also the screen most likely to be reached by whoever should not be
	 * there, so it should show the least.
	 */
	const WAY_IN = ['/admin/login', '/admin/herstel', '/admin/unlock'];
	const bare = $derived(WAY_IN.some((path) => page.url.pathname.startsWith(path)));

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

{#if bare}
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
				<p class="cms-meta"><a href="/" target="_blank" rel="noopener">Bekijk de site ↗</a></p>
				<AccountMenu email={data.user?.email ?? null} />
			</div>
		</aside>
		<main class="cms-main">{@render children()}</main>
	</div>
{/if}
