<script lang="ts">
	/**
	 * Q1 resolved to "store submissions in Supabase", so both variants POST to
	 * /api/submit (a server route using the service role key) instead of
	 * Formspree. A native form POST is used rather than fetch: the public site
	 * ships no client-side JavaScript, and the form must work without it.
	 */
	let { variant }: { variant: 'contact' | 'scan' | 'offerte' } = $props();

	/* 'offerte' collects the same fields as 'contact' — a quote request needs
	   exactly those — but says so in its own words. */
	const COPY = {
		contact: {
			heading: 'Stuur je vraag door',
			submit: 'Verstuur je vraag',
			vraag: 'Je vraag'
		},
		scan: {
			heading: 'Vraag je scan aan',
			submit: 'Vraag je scan aan',
			vraag: 'Waar loop je vooral op vast?'
		},
		offerte: {
			heading: 'Vraag je offerte aan',
			submit: 'Vraag je offerte aan',
			vraag: 'Wat heb je nodig?'
		}
	} as const;

	const copy = $derived(COPY[variant]);
</script>

<h2>{copy.heading}</h2>
<form action="/api/submit" method="POST">
	<input type="hidden" name="variant" value={variant}>
	<!-- Honeypot: a real visitor never fills this in. -->
	<input type="text" name="website_url" tabindex="-1" autocomplete="off"
	       style="position:absolute;left:-9999px" aria-hidden="true">

	{#if variant === 'scan'}
		<div class="field"><label for="f-naam">Naam</label><input id="f-naam" name="naam" required></div>
		<div class="field"><label for="f-bedrijf">Bedrijf</label><input id="f-bedrijf" name="bedrijf" required></div>
		<div class="field"><label for="f-web">Website</label><input id="f-web" name="website" type="url" placeholder="https://" required></div>
		<div class="field"><label for="f-gem">Gemeente</label><input id="f-gem" name="gemeente" required></div>
		<div class="field"><label for="f-mail">E-mail</label><input id="f-mail" name="email" type="email" required></div>
		<div class="field"><label for="f-tel">Telefoon <span class="opt">(optioneel)</span></label><input id="f-tel" name="telefoon" type="tel"></div>
		<div class="field"><label for="f-vraag">{copy.vraag}</label><textarea id="f-vraag" name="vraag"></textarea></div>
		<div class="field checkline"><input id="f-nb" name="nieuwsbrief" type="checkbox" value="ja">
			<label for="f-nb" class="normaal">Stuur me ook de maandelijkse marketingtips.</label></div>
	{:else}
		<div class="field"><label for="f-naam">Naam</label><input id="f-naam" name="naam" required></div>
		<div class="field"><label for="f-bedrijf">Bedrijf</label><input id="f-bedrijf" name="bedrijf"></div>
		<div class="field"><label for="f-mail">E-mail</label><input id="f-mail" name="email" type="email" required></div>
		<div class="field"><label for="f-tel">Telefoon</label><input id="f-tel" name="telefoon" type="tel"></div>
		<div class="field"><label for="f-ond">Waarover gaat het?</label>
			<select id="f-ond" name="onderwerp">
				<option>Website of webshop</option><option>Social media</option>
				<option>Branding en huisstijl</option><option>SEO en Google Ads</option>
				<option>Drukwerk</option><option>Foto en video</option>
				<option>AI voor mijn zaak</option><option>Iets anders</option></select></div>
		<div class="field"><label for="f-bud">Budgetvork <span class="opt">(optioneel)</span></label><input id="f-bud" name="budget" placeholder="bv. 2.000 – 4.000 euro"></div>
		<div class="field"><label for="f-vraag">{copy.vraag}</label><textarea id="f-vraag" name="vraag" required></textarea></div>
	{/if}

	<button class="btn" type="submit">{copy.submit}</button>
	<p class="hint">Je gegevens worden enkel gebruikt om je vraag te beantwoorden.</p>
</form>
