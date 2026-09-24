<script lang="ts">
	import type { ServiceLink, Settings } from '$lib/types';

	interface Props {
		settings: Settings;
		services: ServiceLink[];
		pathname: string;
		children: import('svelte').Snippet;
	}

	let { settings, services, pathname, children }: Props = $props();

	// Simple Icons paths, keyed by the name typed in Instellingen. A network
	// without an icon here still shows, as its name.
	const SOCIAL_ICONS: Record<string, string> = {
		linkedin:
			'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
		facebook:
			'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z',
		instagram:
			'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z',
		youtube:
			'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'
	};

	const b = $derived(settings.company);
	const current = $derived('/' + pathname.replace(/^\/|\/$/g, ''));

	function active(link: string): boolean {
		const normalised = '/' + link.replace(/^\/|\/$/g, '');
		return current === normalised || current.startsWith(normalised + '/');
	}

	const year = new Date().getFullYear();
</script>

<a class="skip" href="#main">Naar de inhoud</a>

<div class="topbar"><div class="wrap">
	<span>Marketingbureau in Dendermonde &middot; werkt in heel Oost-Vlaanderen</span>
	<span><a href="tel:{b.telefoon_link}">{b.telefoon}</a> &nbsp; <a href="mailto:{b.email}">{b.email}</a></span>
</div></div>

<nav class="nav" id="nav" aria-label="Hoofdnavigatie"><div class="wrap">
	<a class="brand" href="/" aria-current={current === '/' ? 'page' : undefined}
	   aria-label="One Man Agency, naar de startpagina">
		<img src="/assets/logo-oma.png" alt="One Man Agency" width="337" height="215">
	</a>
	<button class="nav-toggle" aria-expanded="false" aria-controls="navlist">Menu</button>
	<ul id="navlist">
		{#each settings.navigation as item (item.link)}
			<li><a class="navlink" href={item.link}
			       aria-current={active(item.link) ? 'page' : undefined}>{item.label}</a></li>
		{/each}
		<li><a class="btn btn-green" href={settings.header_cta.link}>{settings.header_cta.label}</a></li>
	</ul>
</div></nav>

<main id="main">{@render children()}</main>

<section class="cta-band"><div class="wrap">
	<h2>Eén gesprek van 30 minuten. Daarna weet je waar je staat.</h2>
	<p>Gratis, vrijblijvend en zonder verkooppraat. Ik luister, jij vertelt wat er scheelt, en ik zeg eerlijk of ik kan helpen.</p>
	<div class="btns"><a class="btn btn-green" href="/afspraak">Maak een afspraak</a>
	<a class="btn btn-ghost wit" href="tel:{b.telefoon_link}">Bel {b.telefoon}</a></div>
</div></section>

<footer class="site"><div class="wrap">
	<div>
		<img class="footlogo" src="/assets/logo-oma-wit.png" alt="One Man Agency" width="337" height="215">
		<p class="tagline">{b.slogan}</p>
		<p>{b.juridisch}<br>{b.straat}<br>{b.postcode} {b.stad}<br>BTW {b.btw}</p>
		<!-- Here rather than under Sectoren: that column grows with every sector
		     added in Instellingen, and the socials made it the longest by far. -->
		{#if settings.socials?.length}
			<ul class="socials">
				{#each settings.socials as s (s.url)}
					{@const icon = SOCIAL_ICONS[s.naam.trim().toLowerCase()]}
					<li><a href={s.url} rel="me noopener" aria-label={s.naam} title={s.naam}>
						{#if icon}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={icon} /></svg>{:else}{s.naam}{/if}
					</a></li>
				{/each}
			</ul>
		{/if}
	</div>
	<div><h4>Diensten</h4><ul>
		{#each services.slice(0, 8) as s (s.link)}
			<li><a href={s.link}>{s.label}</a></li>
		{/each}
	</ul></div>
	<!-- Both columns are edited in Instellingen, not here: a sector or region
	     page renamed in the CMS has to be fixable in the CMS. -->
	{#if settings.footer_regions?.length}
		<div><h4>Regio</h4><ul>
			{#each settings.footer_regions as r}
				<li><a href={r.link}>{r.label}</a></li>
			{/each}
		</ul></div>
	{/if}
	<div>{#if settings.footer_sectors?.length}<h4>Sectoren</h4><ul>
		{#each settings.footer_sectors as s}
			<li><a href={s.link}>{s.label}</a></li>
		{/each}
	</ul>{/if}</div>
</div>
<div class="legal"><div class="wrap">
	<span>&copy; {year} {b.juridisch}</span>
	<span><a href="/veelgestelde-vragen">Veelgestelde vragen</a> &nbsp;
	<a href="/privacybeleid">Privacy</a> &nbsp; <a href="/cookiebeleid">Cookies</a> &nbsp;
	<a href="/algemene-voorwaarden">Algemene voorwaarden</a></span>
</div></div>
</footer>
