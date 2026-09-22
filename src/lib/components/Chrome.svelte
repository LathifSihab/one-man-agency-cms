<script lang="ts">
	import type { ServiceLink, Settings } from '$lib/types';

	interface Props {
		settings: Settings;
		services: ServiceLink[];
		pathname: string;
		children: import('svelte').Snippet;
	}

	let { settings, services, pathname, children }: Props = $props();

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
	</div>
	<div><h4>Diensten</h4><ul>
		{#each services.slice(0, 8) as s (s.link)}
			<li><a href={s.link}>{s.label}</a></li>
		{/each}
	</ul></div>
	<div><h4>Regio</h4><ul>
		<li><a href="/regio/marketingbureau-dendermonde">Dendermonde</a></li>
		<li><a href="/regio/marketingbureau-lebbeke">Lebbeke</a></li>
		<li><a href="/regio/marketingbureau-aalst">Aalst</a></li>
		<li><a href="/regio/marketingbureau-sint-niklaas">Sint-Niklaas</a></li>
		<li><a href="/regio/marketingbureau-wetteren">Wetteren</a></li>
		<li><a href="/regio/marketingbureau-zele">Zele</a></li>
	</ul></div>
	<div><h4>Sectoren</h4><ul>
		<li><a href="/sectoren/verzekeringsmakelaars">Verzekeringsmakelaars</a></li>
		<li><a href="/sectoren/garages-en-autobedrijven">Garages &amp; autobedrijven</a></li>
		<li><a href="/sectoren/bouw-en-renovatie">Bouw &amp; renovatie</a></li>
		<li><a href="/sectoren/horeca-en-retail">Horeca &amp; retail</a></li>
	</ul><h4 style="margin-top:1.4rem">Volg mee</h4><ul>
		{#each settings.socials as s (s.url)}
			<li><a href={s.url} rel="me noopener">{s.naam}</a></li>
		{/each}
	</ul></div>
</div>
<div class="legal"><div class="wrap">
	<span>&copy; {year} {b.juridisch}</span>
	<span><a href="/veelgestelde-vragen">Veelgestelde vragen</a> &nbsp;
	<a href="/privacybeleid">Privacy</a> &nbsp; <a href="/cookiebeleid">Cookies</a> &nbsp;
	<a href="/algemene-voorwaarden">Algemene voorwaarden</a></span>
</div></div>
</footer>
