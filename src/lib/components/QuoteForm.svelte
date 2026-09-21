<script lang="ts">
	/**
	 * The quote request form.
	 *
	 * Asks what the visitor needs, then only the follow-up questions that apply,
	 * then who they are — the three stages of the design this was built from.
	 *
	 * Those stages are three headed sections on one page rather than a stepped
	 * wizard, and that is a consequence of the site shipping no JavaScript at all
	 * (csr = false; see (public)/+layout.ts). A CSS-only wizard is possible, but
	 * every field of the steps you are not on is display:none, and a browser will
	 * not submit a form whose hidden field is `required` — it tries to focus
	 * something invisible and stops, with nothing shown to the person. The way
	 * round it is to drop `required` everywhere and check on the server, which on
	 * a lead form means answering a long questionnaire and losing it to a redirect
	 * over one missing telephone number. One page keeps the browser's own
	 * validation working, keeps autofill working, and cannot swallow an answer.
	 *
	 * The conditional questions are real, though, and they are the point: the CSS
	 * reveals a block only when its service is ticked. Where :has() is missing,
	 * everything is simply visible — long, but complete and working.
	 */
	const DIENSTEN = [
		['website', 'Website of webshop'],
		['branding', 'Branding & huisstijl'],
		['social', 'Social media'],
		['vindbaarheid', 'SEO & vindbaarheid'],
		['email', 'E-mailmarketing'],
		['fotovideo', 'Foto & video'],
		['drukwerk', 'Drukwerk & vormgeving'],
		['strategie', 'Strategie of AI-audit'],
		['onbeslist', 'Dat weet ik nog niet']
	] as const;
</script>

<form class="offerteform" action="/api/submit" method="POST">
	<input type="hidden" name="variant" value="offerte" />
	<!-- Honeypot: a real visitor never fills this in. Deliberately not named
	     after anything on this form — there is a real "current website" question
	     below, and the two must not collide. -->
	<input type="text" name="website_url" tabindex="-1" autocomplete="off"
	       style="position:absolute;left:-9999px" aria-hidden="true" />

	<!-- ── 1 ─────────────────────────────────────────────────────────────── -->
	<fieldset class="offertestap">
		<legend><span class="stapnr">1</span> Waarmee kan ik je helpen?</legend>
		<p class="hint" style="margin-top:0">
			Vink aan wat van toepassing is. Op basis daarvan stel ik hieronder een paar gerichte
			vragen — de rest sla je gewoon over.
		</p>
		<div class="keuzes">
			{#each DIENSTEN as [waarde, label] (waarde)}
				<div class="checkline">
					<input id="d-{waarde}" type="checkbox" name="diensten" value={label} />
					<label for="d-{waarde}" class="normaal">{label}</label>
				</div>
			{/each}
		</div>
	</fieldset>

	<!-- ── 2 ─────────────────────────────────────────────────────────────── -->
	<fieldset class="offertestap">
		<legend><span class="stapnr">2</span> Iets meer over het project</legend>

		<div class="alsdan als-website">
			<h3>Over de website</h3>
			<div class="field">
				<label for="q-site">Heb je nu al een website?</label>
				<input id="q-site" name="huidige_website" type="text" placeholder="www.jouwzaak.be — of laat leeg" />
			</div>
			<div class="field">
				<label for="q-sitesoort">Wat heb je nodig?</label>
				<select id="q-sitesoort" name="website_soort">
					<option value="">Maak een keuze</option>
					<option>Een nieuwe, eenvoudige website</option>
					<option>Een nieuwe, uitgebreide website</option>
					<option>Een webshop</option>
					<option>Een opfrissing van wat er staat</option>
					<option>Dat weet ik nog niet</option>
				</select>
			</div>
			<div class="field">
				<label for="q-materiaal">Teksten en beeldmateriaal</label>
				<select id="q-materiaal" name="website_materiaal">
					<option value="">Maak een keuze</option>
					<option>Die heb ik klaar</option>
					<option>Deels klaar</option>
					<option>Daar heb ik hulp bij nodig</option>
				</select>
			</div>
		</div>

		<div class="alsdan als-branding">
			<h3>Over je merk</h3>
			<div class="field">
				<label for="q-branding">Hoe ziet je huisstijl er vandaag uit?</label>
				<select id="q-branding" name="branding_status">
					<option value="">Maak een keuze</option>
					<option>Er is nog niets</option>
					<option>Alleen een logo</option>
					<option>Verouderd</option>
					<option>Het hangt niet goed samen</option>
				</select>
			</div>
		</div>

		<div class="alsdan als-social">
			<h3>Over social media</h3>
			<div class="field">
				<label for="q-kanalen">Welke kanalen?</label>
				<input id="q-kanalen" name="social_kanalen" type="text" placeholder="Bv. Facebook en Instagram" />
			</div>
			<div class="field">
				<label for="q-socialsoort">Wat zoek je?</label>
				<select id="q-socialsoort" name="social_soort">
					<option value="">Maak een keuze</option>
					<option>Volledig beheer</option>
					<option>Enkel content</option>
					<option>Enkel advertenties</option>
					<option>Dat weet ik nog niet</option>
				</select>
			</div>
		</div>

		<div class="alsdan als-vindbaarheid">
			<h3>Over vindbaarheid</h3>
			<div class="field">
				<label for="q-ads">Heb je al eens met Google Ads gewerkt?</label>
				<select id="q-ads" name="google_ads">
					<option value="">Maak een keuze</option>
					<option>Nee, nog nooit</option>
					<option>Ja, dat loopt nu</option>
					<option>Vroeger wel, nu gestopt</option>
				</select>
			</div>
		</div>

		<div class="alsdan als-email">
			<h3>Over e-mailmarketing</h3>
			<div class="field">
				<label for="q-lijst">Waar staan je klantgegevens nu?</label>
				<select id="q-lijst" name="email_lijst">
					<option value="">Maak een keuze</option>
					<option>In een e-mailtool</option>
					<option>In een bestand of spreadsheet</option>
					<option>Nog nergens</option>
				</select>
			</div>
		</div>

		<div class="alsdan als-fotovideo">
			<h3>Over foto en video</h3>
			<div class="field">
				<label for="q-onderwerp">Wat moet er in beeld?</label>
				<input id="q-onderwerp" name="fotovideo_onderwerp" type="text" placeholder="Bv. het team, de werkplaats, een product" />
			</div>
			<div class="field">
				<label for="q-vorm">Foto, video of allebei?</label>
				<select id="q-vorm" name="fotovideo_vorm">
					<option value="">Maak een keuze</option>
					<option>Enkel foto</option>
					<option>Enkel video</option>
					<option>Allebei</option>
				</select>
			</div>
		</div>

		<div class="alsdan als-drukwerk">
			<h3>Over het drukwerk</h3>
			<div class="field">
				<label for="q-deadline">Is er een datum waarop het klaar moet zijn?</label>
				<input id="q-deadline" name="drukwerk_deadline" type="text" placeholder="Bv. beurs op 14 maart" />
			</div>
		</div>

		<div class="field">
			<label for="q-termijn">Wanneer zou je willen starten?</label>
			<select id="q-termijn" name="start_termijn">
				<option value="">Maak een keuze</option>
				<option>Zo snel mogelijk</option>
				<option>Binnen een maand</option>
				<option>Binnen drie maanden</option>
				<option>Later dit jaar</option>
				<option>Ik ben nog aan het verkennen</option>
			</select>
		</div>

		<div class="field">
			<p class="veldkop">Budget</p>
			<p class="hint" style="margin:0 0 .6rem">
				Een richting volstaat. Ik gebruik dit om een voorstel te maken dat klopt, niet om een
				prijs op te plakken.
			</p>
			{#each [['geen', 'Ik heb er nog geen idee van'], ['beperkt', 'Beperkt — laten we klein beginnen'], ['degelijk', 'Er is ruimte voor een degelijk traject'], ['bedrag', 'Ik heb een bedrag in gedachten, dat bespreek ik liever persoonlijk']] as [waarde, label] (waarde)}
				<div class="checkline">
					<input id="b-{waarde}" type="radio" name="budget" value={label} />
					<label for="b-{waarde}" class="normaal">{label}</label>
				</div>
			{/each}
		</div>
	</fieldset>

	<!-- ── 3 ─────────────────────────────────────────────────────────────── -->
	<fieldset class="offertestap">
		<legend><span class="stapnr">3</span> Je gegevens</legend>

		<div class="tweeluik">
			<div class="field">
				<label for="q-bedrijf">Bedrijfsnaam</label>
				<input id="q-bedrijf" name="bedrijf" type="text" autocomplete="organization" required />
			</div>
			<div class="field">
				<label for="q-btw">Btw-nummer <span class="opt">(voor op de offerte)</span></label>
				<input id="q-btw" name="btw" type="text" placeholder="BE 0123.456.789" />
			</div>
			<div class="field">
				<label for="q-naam">Naam</label>
				<input id="q-naam" name="naam" type="text" autocomplete="name" required />
			</div>
			<div class="field">
				<label for="q-functie">Functie <span class="opt">(optioneel)</span></label>
				<input id="q-functie" name="functie" type="text" autocomplete="organization-title" />
			</div>
			<div class="field">
				<label for="q-mail">E-mail</label>
				<input id="q-mail" name="email" type="email" autocomplete="email" required />
			</div>
			<div class="field">
				<label for="q-tel">Telefoon</label>
				<input id="q-tel" name="telefoon" type="tel" autocomplete="tel" required />
			</div>
			<div class="field">
				<label for="q-adres">Adres</label>
				<input id="q-adres" name="adres" type="text" autocomplete="street-address" />
			</div>
			<div class="field">
				<label for="q-gemeente">Postcode en gemeente</label>
				<input id="q-gemeente" name="postcode_gemeente" type="text" autocomplete="postal-code" />
			</div>
		</div>

		<div class="field">
			<label for="q-gevonden">Hoe ben je bij me terechtgekomen?</label>
			<select id="q-gevonden" name="hoe_gevonden">
				<option value="">Maak een keuze</option>
				<option>Via Google of een AI-assistent</option>
				<option>Iemand heeft je aanbevolen</option>
				<option>Via social media</option>
				<option>Ik kreeg een mail van je</option>
				<option>We kennen elkaar</option>
				<option>Anders</option>
			</select>
		</div>

		<div class="field">
			<label for="q-opmerking">Nog iets dat ik moet weten? <span class="opt">(optioneel)</span></label>
			<textarea id="q-opmerking" name="opmerkingen" rows="4"></textarea>
		</div>

		<div class="field checkline">
			<input id="q-privacy" name="privacy" type="checkbox" value="ja" required />
			<label for="q-privacy" class="normaal">
				Ik ga ermee akkoord dat mijn gegevens gebruikt worden om deze aanvraag te
				beantwoorden. <a href="/privacybeleid">Privacybeleid</a>
			</label>
		</div>

		<button class="btn" type="submit">Vraag je offerte aan</button>
		<p class="hint">
			Vrijblijvend. Je krijgt binnen twee werkdagen antwoord — van mij, niet van een
			verkoper.
		</p>
	</fieldset>
</form>
