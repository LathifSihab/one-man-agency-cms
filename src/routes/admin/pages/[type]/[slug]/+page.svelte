<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$components/admin/ConfirmDialog.svelte';
	import { confirmSubmit, reportTo } from '$components/admin/confirmSubmit';
	import CountedField from '$components/admin/CountedField.svelte';
	import MarkdownEditor from '$components/admin/MarkdownEditor.svelte';
	import PagePreview from '$components/admin/PagePreview.svelte';
	import RepeatRows from '$components/admin/RepeatRows.svelte';
	import ImageField from '$components/admin/ImageField.svelte';
	import SeoPanel from '$components/admin/SeoPanel.svelte';
	import type { Subject } from '$lib/seo';

	let { data, form } = $props();

	// Read once on purpose: these seed the editing state below.
	const p = untrack(() => data.page);

	// Local editing state. Repeating structures are edited as rows and only
	// serialised to JSON in a hidden input at submit time — no JSON in the UI.
	let title = $state(p.title ?? '');
	let seoTitle = $state(p.seo_title ?? '');
	let metaDescription = $state(p.meta_description ?? '');
	let intro = $state(p.intro ?? '');
	let body = $state(p.body ?? '');
	let slug = $state(p.slug ?? '');
	let todoNote = $state(p.todo_note ?? '');
	let portraitUrl = $state(p.portrait_url ?? '');
	let portraitAlt = $state(p.portrait_alt ?? '');
	let headerImageUrl = $state(p.header_image_url ?? '');
	let headerAlt = $state(p.header_alt ?? '');
	let formVariant = $state(p.form_variant ?? '');
	let isPublished = $state(p.is_published !== false);
	let inServices = $state(Boolean(p.in_services));
	let menuLabel = $state(p.menu_label ?? '');
	let menuSummary = $state(p.menu_summary ?? '');
	let menuGroup = $state(p.menu_group ?? '');
	let menuOrder = $state(p.menu_order ?? 0);

	/* Only the pages that actually show an image offer the fields. */
	const hasPortrait = $derived(Boolean(p.portrait_url) || p.slug === 'home');
	const hasHeaderImage = $derived(Boolean(p.header_image_url) || p.slug === 'home');

	let faq = $state([...(p.faq ?? [])]);
	let prices = $state([...(p.prices ?? [])]);
	let packages = $state([...(p.packages ?? [])]);
	let projects = $state([...(p.projects ?? [])]);
	let figures = $state([...(p.figures ?? [])]);
	let testimonials = $state([...(p.testimonials ?? [])]);
	let sectorList = $state<{ waarde: string }[]>(
		((p.sector_list as string[] | null) ?? []).map((waarde) => ({ waarde }))
	);

	let busy = $state(false);
	let confirmer: ConfirmDialog | undefined = $state();
	let editorForm: HTMLFormElement | undefined = $state();

	/* Everything the preview shows, so a change anywhere refreshes it — rows
	   edited in RepeatRows and picked images change no input the form hears. */
	const previewWatch = $derived(
		JSON.stringify([
			title, intro, body, todoNote, portraitUrl, portraitAlt, headerImageUrl, headerAlt,
			formVariant, faq, prices, packages, projects, figures, testimonials, sectorList,
			inServices, menuLabel, menuSummary, menuGroup, menuOrder
		])
	);
	const slugChanged = $derived(slug !== p.slug);

	/** The site root. Hiding it would take the whole site down. */
	const isHome = p.type === 'page' && p.slug === 'home';

	/** Mirrors UNDELETABLE in the server action. */
	const canDelete = !(p.type === 'page' && (p.slug === 'home' || p.slug === '404'));

	/**
	 * A form replaces the blocks rather than joining them: the public template
	 * puts the text and the form side by side and renders nothing else. Worth
	 * saying out loud before someone turns it on and loses a price table.
	 */
	const blocksHiddenByForm = $derived(
		[
			prices.length && 'prijzen',
			packages.length && 'maandpakketten',
			projects.length && 'projectprijzen',
			figures.length && 'cijfers',
			testimonials.length && 'citaten',
			faq.length && 'veelgestelde vragen'
		].filter(Boolean) as string[]
	);

	const TYPE_LABEL: Record<string, string> = {
		page: 'Pagina',
		service: 'Dienst',
		sector: 'Sector',
		region: 'Regio'
	};

	const prefix: Record<string, string> = {
		page: '',
		service: '/diensten',
		sector: '/sectoren',
		region: '/regio'
	};

	const liveUrl = $derived(
		p.type === 'page' ? (slug === 'home' ? '/' : `/${slug}`) : `${prefix[p.type]}/${slug}`
	);

	/* The SEO panel reads the bound state, so its verdict follows the typing.
	   The home page's path is / rather than /home. */
	const seoSubject: Subject = $derived({
		kind: 'page',
		title,
		seoTitle,
		metaDescription,
		intro,
		body,
		path: liveUrl,
		imageUrl: headerImageUrl
	});

	/** Blocks whose backing data is empty — the editor warns before they vanish silently. */
	const emptyBlocks = $derived(
		[
			faq.length ? null : '{{faq}}',
			packages.length ? null : '{{pakketten}}',
			projects.length ? null : '{{projecten}}',
			testimonials.length ? null : '{{citaten}}',
			sectorList.length ? null : '{{sectoren}}'
		].filter(Boolean) as string[]
	);
</script>

<p class="cms-meta"><a href="/admin/pages">&larr; Alle pagina's</a></p>
<h1>{title || p.slug}</h1>
<p class="cms-lead">
	{TYPE_LABEL[p.type]} &middot;
	<a href={liveUrl} target="_blank" rel="noopener">{liveUrl} ↗</a>
</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.placed}
	<div class="cms-ok">
		Toegevoegd. Het menu verandert op de live site bij de volgende publicatie.
	</div>
{/if}
{#if form?.saved}
	<div class="cms-ok">
		Opgeslagen. Dit staat nog niet op de live site — publiceer via het overzicht.
	</div>
{/if}

<!-- Where visitors can reach this page from. A new page starts with none, and
     nothing else in the editor would tell you. The home page is the site's own
     address and the 404 page is never linked to, so neither needs this. -->
{#if canDelete && p.is_published !== false}
	<div class="cms-card" style="margin-bottom:1.4rem">
		<strong>Gelinkt vanuit</strong>
		{#if data.linkedFrom.length}
			<ul style="margin:.4rem 0 0;padding-left:1.2rem">
				{#each data.linkedFrom as place (place)}<li>{place}</li>{/each}
			</ul>
		{:else}
			<p class="cms-hint" style="margin:.4rem 0 0">
				<strong>Nergens.</strong> Geen menu, knop of tekst op de site linkt naar deze pagina, dus
				bezoekers vinden ze enkel als ze het adres kennen{p.noindex ? '' : ' of via Google'}.
			</p>
		{/if}
		{#if data.menuOptions.length}
			<div class="cms-actions" style="margin-top:.8rem">
				{#each data.menuOptions as option (option.placement)}
					<form method="POST" action="?/placeInMenu" use:enhance={() => async ({ update }) => update({ reset: false })}>
						<input type="hidden" name="placement" value={option.placement} />
						<button class="cms-btn cms-btn-ghost cms-btn-small" type="submit">{option.label}</button>
					</form>
				{/each}
			</div>
		{/if}
		<p class="cms-hint">
			Links in een tekst voeg je toe in die tekst; het menu en de voettekst pas je aan onder
			Instellingen. Wat hier staat is de toestand na opslaan, niet noodzakelijk de live site.
		</p>
	</div>
{/if}

{#if !isPublished}
	<div class="cms-banner pending">
		<p>
			Deze pagina staat <strong>niet op de site</strong>. Bezoekers die het adres openen
			krijgen de foutpagina te zien. Alles wat je hier invult blijft bewaard.
		</p>
	</div>
{/if}

<form
	bind:this={editorForm}
	method="POST"
	action="?/save"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<div class="cms-field">
		<label for="f-title">Titel op de pagina</label>
		<input id="f-title" name="title" type="text" bind:value={title} required />
		<p class="cms-hint">Dit is de grote kop bovenaan.</p>
	</div>

	<CountedField
		label="SEO-titel"
		name="seo_title"
		bind:value={seoTitle}
		limit={62}
		required
		hint="De titel in de zoekresultaten van Google."
	/>

	<CountedField
		label="Meta-omschrijving"
		name="meta_description"
		bind:value={metaDescription}
		limit={158}
		multiline
		required
		hint="De korte tekst onder de titel in Google."
	/>

	<div class="cms-field">
		<label for="f-intro">Inleiding</label>
		<textarea id="f-intro" name="intro" bind:value={intro} rows="3" required></textarea>
		<p class="cms-hint">De eerste alinea onder de titel.</p>
	</div>

	<MarkdownEditor bind:value={body} {emptyBlocks} example={false} />
	<input type="hidden" name="body" value={body} />

	<PagePreview form={editorForm} type={p.type} slug={p.slug} watch={previewWatch} />

	<div class="cms-field">
		<label for="f-form">Formulier op deze pagina</label>
		<select id="f-form" name="form_variant" bind:value={formVariant}>
			<option value="">Geen formulier</option>
			<option value="contact">Contactformulier (naam, bedrijf, vraag, budget)</option>
			<option value="offerte">Offerteformulier (zelfde velden, andere tekst)</option>
			<option value="scan">Scanformulier (naam, bedrijf, website, gemeente)</option>
		</select>
		<p class="cms-hint">
			Het formulier komt naast de tekst hierboven te staan. Berichten komen binnen bij
			<a href="/admin/submissions">Berichten</a>.
		</p>
		{#if formVariant && blocksHiddenByForm.length}
			<div class="cms-banner failed" style="margin-top:.6rem">
				<p>
					Met een formulier toont deze pagina enkel de tekst hierboven en het formulier.
					Deze blokken verdwijnen dan van de live pagina:
					<strong>{blocksHiddenByForm.join(', ')}</strong>. Ze blijven wel bewaard.
				</p>
			</div>
		{/if}
	</div>

	{#if p.type === 'service' || prices.length}
		<RepeatRows
			label="Prijzen"
			noun="prijs"
			bind:rows={prices}
			fields={[
				{ key: 'wat', label: 'Wat' },
				{ key: 'vanaf', label: 'Vanaf', placeholder: '€ 1.450' }
			]}
			summary={(r) => String(r.wat ?? '')}
		/>
		<input type="hidden" name="prices" value={JSON.stringify(prices)} />
	{/if}

	{#if packages.length || p.slug === 'offerte'}
		<RepeatRows
			label="Maandpakketten"
			noun="pakket"
			bind:rows={packages}
			fields={[
				{ key: 'naam', label: 'Naam' },
				{ key: 'voor_wie', label: 'Voor wie' },
				{ key: 'prijs', label: 'Prijs', placeholder: '€ 475' },
				{ key: 'periode', label: 'Periode', placeholder: 'per maand, excl. btw' },
				{ key: 'uitgelicht', label: 'Uitgelicht tonen', type: 'checkbox' },
				{ key: 'inbegrepen', label: 'Inbegrepen', type: 'list' }
			]}
			summary={(r) => String(r.naam ?? '')}
		/>
		<input type="hidden" name="packages" value={JSON.stringify(packages)} />
	{/if}

	{#if projects.length || p.slug === 'offerte'}
		<RepeatRows
			label="Projectprijzen"
			noun="project"
			bind:rows={projects}
			fields={[
				{ key: 'wat', label: 'Project' },
				{ key: 'vanaf', label: 'Vanaf' },
				{ key: 'link', label: 'Link naar', placeholder: '/diensten/webdesign' }
			]}
			summary={(r) => String(r.wat ?? '')}
		/>
		<input type="hidden" name="projects" value={JSON.stringify(projects)} />
	{/if}

	{#if figures.length}
		<RepeatRows
			label="Cijfers"
			noun="cijfer"
			bind:rows={figures}
			fields={[
				{ key: 'getal', label: 'Getal' },
				{ key: 'label', label: 'Omschrijving' }
			]}
			summary={(r) => String(r.getal ?? '')}
		/>
		<input type="hidden" name="figures" value={JSON.stringify(figures)} />
	{/if}

	{#if testimonials.length}
		<RepeatRows
			label="Citaten"
			noun="citaat"
			bind:rows={testimonials}
			fields={[
				{ key: 'tekst', label: 'Citaat', type: 'textarea' },
				{ key: 'naam', label: 'Naam' },
				{ key: 'functie', label: 'Functie en bedrijf (optioneel)' }
			]}
			summary={(r) => String(r.naam ?? '')}
		/>
		<input type="hidden" name="testimonials" value={JSON.stringify(testimonials)} />
	{/if}

	{#if sectorList.length}
		<RepeatRows
			label="Sectoren op de startpagina"
			noun="sector"
			bind:rows={sectorList}
			fields={[{ key: 'waarde', label: 'Sector' }]}
			summary={(r) => String(r.waarde ?? '')}
		/>
		<input
			type="hidden"
			name="sector_list"
			value={JSON.stringify(sectorList.map((s) => s.waarde).filter(Boolean))}
		/>
	{/if}

	<RepeatRows
		label="Veelgestelde vragen"
		noun="vraag"
		bind:rows={faq}
		fields={[
			{ key: 'vraag', label: 'Vraag' },
			{ key: 'antwoord', label: 'Antwoord', type: 'textarea' }
		]}
		summary={(r) => String(r.vraag ?? '')}
	/>
	<input type="hidden" name="faq" value={JSON.stringify(faq)} />

	{#if hasPortrait || hasHeaderImage}
		<h2>Afbeeldingen</h2>
	{/if}

	{#if hasPortrait}
		<ImageField label="Portret" name="portrait_url" bind:value={portraitUrl} folder="site" />
		<div class="cms-field">
			<label for="f-portret-alt">Omschrijving van het portret</label>
			<input id="f-portret-alt" name="portrait_alt" type="text" bind:value={portraitAlt} />
			<p class="cms-hint">
				Wat er op de foto te zien is. Google leest dit, en schermlezers lezen het voor.
			</p>
		</div>
	{/if}

	{#if hasHeaderImage}
		<ImageField
			label="Brede afbeelding onder de titel"
			name="header_image_url"
			bind:value={headerImageUrl}
			folder="site"
		/>
		<div class="cms-field">
			<label for="f-header-alt">Omschrijving van die afbeelding</label>
			<input id="f-header-alt" name="header_alt" type="text" bind:value={headerAlt} />
		</div>
	{/if}

	<h2>Zichtbaarheid</h2>

	<div class="cms-field">
		<label style="font-weight:500;display:flex;align-items:center;gap:.5rem">
			<input type="checkbox" bind:checked={isPublished} disabled={isHome} style="width:auto" />
			Deze pagina staat op de site
		</label>
		<input type="hidden" name="is_published" value={isPublished ? 'on' : ''} />
		{#if isHome}
			<p class="cms-hint">De startpagina is het adres van de site zelf en kan niet verborgen worden.</p>
		{:else}
			<p class="cms-hint">
				Zet dit uit om de pagina van de site te halen zonder ze te verwijderen. De pagina
				verdwijnt dan volledig: het adres geeft de foutpagina, en ze staat niet meer in het
				menu, het overzicht of de sitemap. Alle tekst en afbeeldingen blijven bewaard, en je
				kan dit later gewoon weer aanzetten.
			</p>
			{#if isPublished}
				<p class="cms-hint">
					Let op bij een pagina die al in Google staat: het adres geeft daarna een foutmelding
					voor wie er via een zoekresultaat of een oude link op terechtkomt.
				</p>
			{:else if inServices}
				<p class="cms-hint">
					Zolang ze verborgen is, staat ze ook niet bij de diensten.
				</p>
			{/if}
		{/if}
	</div>

	<h2>Plaats bij de diensten</h2>

	<div class="cms-field">
		<label style="font-weight:500;display:flex;align-items:center;gap:.5rem">
			<input type="checkbox" bind:checked={inServices} style="width:auto" />
			Toon deze pagina bij de diensten
		</label>
		<input type="hidden" name="in_services" value={inServices ? 'on' : ''} />
		<p class="cms-hint">
			Zet dit aan om de pagina op te nemen in het dienstenoverzicht en in de voettekst. De
			pagina blijft op haar eigen webadres staan.
		</p>
	</div>

	{#if inServices}
		<div class="cms-two">
			<div class="cms-field">
				<label for="f-menulabel">Korte naam</label>
				<input id="f-menulabel" name="menu_label" type="text" bind:value={menuLabel}
				       placeholder={title} />
				<p class="cms-hint">De naam in de lijst. Laat leeg om de titel hierboven te gebruiken.</p>
			</div>
			<div class="cms-field">
				<label for="f-menugroup">Onder welke tussentitel</label>
				<input id="f-menugroup" name="menu_group" type="text" bind:value={menuGroup}
				       placeholder="Bv. Online zichtbaar" list="menu-groups" />
				<datalist id="menu-groups">
					{#each data.groups ?? [] as g (g)}<option value={g}></option>{/each}
				</datalist>
				<p class="cms-hint">
					Diensten met dezelfde tussentitel staan samen. Typ een nieuwe naam om een nieuwe
					groep te maken.
				</p>
			</div>
		</div>

		<div class="cms-field">
			<label for="f-menusummary">Regel onder de naam</label>
			<input id="f-menusummary" name="menu_summary" type="text" bind:value={menuSummary}
			       placeholder="Eén zin die zegt wat het oplevert." />
		</div>

		<div class="cms-field">
			<label for="f-menuorder">Volgorde</label>
			<input id="f-menuorder" name="menu_order" type="number" bind:value={menuOrder}
			       style="max-width:9rem" />
			<p class="cms-hint">Lager staat vooraan. De tussentitels volgen deze volgorde.</p>
		</div>
	{/if}

	<h2>Geavanceerd</h2>

	<div class="cms-field">
		<label for="f-todo">Notitie "nog aan te vullen"</label>
		<textarea id="f-todo" name="todo_note" bind:value={todoNote} rows="2"></textarea>
		<p class="cms-hint">
			Let op: deze notitie staat <strong>zichtbaar op de live pagina</strong>, voor bezoekers.
			Laat leeg om ze te verwijderen.
		</p>
	</div>

	<div class="cms-field">
		<label for="f-slug">Webadres</label>
		<input id="f-slug" name="slug" type="text" bind:value={slug} />
		<p class="cms-hint">Enkel kleine letters, cijfers en koppeltekens.</p>
		{#if slugChanged}
			<div class="cms-banner failed" style="margin-top:.6rem">
				<p>
					Je wijzigt het webadres. De oude link <strong>{prefix[p.type]}/{p.slug}</strong> werkt
					daarna niet meer, en bestaande links en Google-resultaten gaan verloren.
				</p>
			</div>
		{/if}
	</div>

	<SeoPanel subject={seoSubject} noindex={p.noindex} />

	<div class="cms-actions" style="margin-top:1.5rem">
		<button class="cms-btn" type="submit" disabled={busy}>
			{busy ? 'Bezig…' : 'Opslaan'}
		</button>
		<span class="cms-hint">Opslaan wijzigt de live site nog niet.</span>
	</div>
</form>

<!-- Its own form, outside the editor, for the same reason as the delete below.
     Not enhanced: the copy opens in this same editor, which reads its page once,
     so it needs a full load or it would keep showing the original's fields. -->
<form method="POST" action="?/duplicate" style="margin-top:2.5rem">
	<button class="cms-btn cms-btn-ghost cms-btn-small" type="submit">Pagina dupliceren</button>
	<span class="cms-hint">
		Maakt een kopie van de opgeslagen versie, die nog niet op de site staat. Sla eerst op als
		je wijzigingen wil meenemen.
	</span>
</form>

{#if canDelete}
	<!-- Its own form, outside the editor: see the note in the blog editor on why
	     a delete inside the save form skipped its confirmation. -->
	<ConfirmDialog bind:this={confirmer} />
	<form
		method="POST"
		action="?/delete"
		style="margin-top:1.2rem"
		use:enhance={reportTo(confirmer, {
			success: 'De pagina is verwijderd.',
			failure: 'Verwijderen is niet gelukt.'
		})}
		onsubmit={(e) =>
			confirmSubmit(e, confirmer, {
				title: 'Deze pagina verwijderen?',
				body:
					`“${p.title}” wordt definitief verwijderd, met alle tekst erop. Staat ze in het ` +
					`menu of de voettekst, dan verdwijnt ze daar ook. Na de volgende publicatie is ` +
					`${prefix[p.type]}/${p.slug} niet meer bereikbaar. Wil je ze liever bewaren, zet ` +
					`ze dan uit onder Zichtbaarheid.`,
				confirmLabel: 'Definitief verwijderen',
				workingLabel: 'Bezig met verwijderen…'
			})}
	>
		<button class="cms-btn cms-btn-danger cms-btn-small" type="submit">Pagina verwijderen</button>
	</form>
{/if}
