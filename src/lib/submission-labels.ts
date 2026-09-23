/**
 * How a submission reads to a person, shared by the admin inbox and the mail
 * that announces it, so the two cannot label the same answer differently.
 */
export const FIELD_LABELS: Record<string, string> = {
	naam: 'Naam', bedrijf: 'Bedrijf', email: 'E-mail', telefoon: 'Telefoon',
	onderwerp: 'Onderwerp', budget: 'Budget', vraag: 'Vraag', website: 'Website',
	gemeente: 'Gemeente', nieuwsbrief: 'Nieuwsbrief',
	// The quote form. Without these the answers arrive as raw column names,
	// and a request with twenty of them is unreadable.
	diensten: 'Waarmee helpen', huidige_website: 'Huidige website',
	website_soort: 'Soort website', website_materiaal: 'Teksten en beeld',
	branding_status: 'Huisstijl nu', social_kanalen: 'Kanalen',
	social_soort: 'Social: wat', google_ads: 'Google Ads',
	email_lijst: 'Klantgegevens staan', fotovideo_onderwerp: 'In beeld',
	fotovideo_vorm: 'Foto of video', drukwerk_deadline: 'Deadline drukwerk',
	start_termijn: 'Wil starten', btw: 'Btw-nummer', functie: 'Functie',
	adres: 'Adres', postcode_gemeente: 'Postcode en gemeente',
	hoe_gevonden: 'Gevonden via', opmerkingen: 'Opmerkingen', privacy: 'Privacy akkoord'
};

/** How each form announces itself. */
export const VARIANT_LABELS: Record<string, string> = {
	scan: 'Gratis scan',
	offerte: 'Offerteaanvraag',
	contact: 'Contact'
};

/** A ticked list arrives as an array; anything else prints as it is. */
export const showValue = (value: unknown) =>
	Array.isArray(value) ? value.join(', ') : String(value);
