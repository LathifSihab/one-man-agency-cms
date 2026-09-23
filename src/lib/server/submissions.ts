/**
 * What each form is allowed to send.
 *
 * Kept beside the endpoint rather than inside it so a test can compare this
 * against the fields the form actually renders. The endpoint drops anything not
 * listed here, which is the right default — but it means a field renamed on the
 * form and not here is lost in silence: the visitor is thanked and the answer
 * never arrives.
 */
export const FIELDS: Record<string, string[]> = {
	contact: ['naam', 'bedrijf', 'email', 'telefoon', 'onderwerp', 'vraag'],
	scan: ['naam', 'bedrijf', 'website', 'gemeente', 'email', 'telefoon', 'vraag', 'nieuwsbrief'],
	// The quote form asks far more, and only the parts that apply to what was
	// ticked, so most of these arrive empty on any given submission.
	offerte: [
		'diensten',
		'huidige_website',
		'website_soort',
		'website_materiaal',
		'branding_status',
		'social_kanalen',
		'social_soort',
		'google_ads',
		'email_lijst',
		'fotovideo_onderwerp',
		'fotovideo_vorm',
		'drukwerk_deadline',
		'start_termijn',
		'budget',
		'bedrijf',
		'btw',
		'naam',
		'functie',
		'email',
		'telefoon',
		'adres',
		'postcode_gemeente',
		'hoe_gevonden',
		'opmerkingen',
		'privacy'
	]
};

/** Fields that can be ticked more than once, and are stored as a list. */
export const MULTI_FIELDS = new Set(['diensten']);
