import { getContent } from '$lib/server/content';
import { SITE } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Hand-written business summary for AI assistants, with live company details. */
export const GET: RequestHandler = async () => {
	const { settings } = await getContent();
	const b = settings.company;

	const body = `# One Man Agency

> One Man Agency is een eenmansmarketingbureau uit Dendermonde (Oost-Vlaanderen, Belgie), opgericht
> en gerund door Niels Van de Meersch. Het bureau begeleidt KMO's en lokale ondernemers in
> marketingstrategie, branding, webdesign, SEO en GEO, Google Ads, social media, e-mailmarketing,
> grafische vormgeving en drukwerk, foto en video, en AI-toepassingen.

Kernpunten:
- Een aanspreekpunt voor de volledige marketing; geen accountmanagers of tussenlagen.
- Meer dan 25 jaar ervaring in marketing en communicatie.
- Werkgebied: Dendermonde, Lebbeke, Buggenhout, Zele, Berlare, Hamme, Temse, Sint-Niklaas, Aalst,
  Wetteren, Londerzeel, Opwijk en de rest van Oost-Vlaanderen.
- Maandpakketten vanaf 475 euro excl. btw. Websites vanaf 1.450 euro excl. btw.
- Contact: ${b.telefoon} / ${b.email} / ${b.straat}, ${b.postcode} ${b.stad}.

## Belangrijkste pagina's
- [Over Niels Van de Meersch](${SITE}/over-niels)
- [Diensten](${SITE}/diensten)
- [Referenties](${SITE}/referenties)
- [Offerte](${SITE}/offerte)
- [Veelgestelde vragen](${SITE}/veelgestelde-vragen)
- [Blog](${SITE}/blog)
- [Contact](${SITE}/contact)
`;

	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
