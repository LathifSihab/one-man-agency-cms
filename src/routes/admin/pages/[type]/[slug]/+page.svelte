<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import CountedField from '$components/admin/CountedField.svelte';
	import MarkdownEditor from '$components/admin/MarkdownEditor.svelte';
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
	const slugChanged = $derived(slug !== p.slug);

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
{#if form?.saved}
	<div class="cms-ok">
		Opgeslagen. Dit staat nog niet op de live site — publiceer via het overzicht.
	</div>
{/if}

<form
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

	<MarkdownEditor bind:value={body} {emptyBlocks} />
	<input type="hidden" name="body" value={body} />

	<div class="cms-field">
		<label for="f-form">Formulier op deze pagina</label>
		<select id="f-form" name="form_variant" bind:value={formVariant}>
			<option value="">Geen formulier</option>
			<option value="contact">Contactformulier (naam, bedrijf, vraag, budget)</option>
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
				{ key: 'functie', label: 'Functie en bedrijf' }
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
