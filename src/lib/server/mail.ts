import { env } from '$env/dynamic/private';

/**
 * Sending mail from the CMS.
 *
 * Composed and sent here rather than by Supabase. On the free tier Supabase
 * refuses to let its recovery template be changed while the default provider is
 * in use, so its mail always carries a link and a one-time code can never reach
 * anyone. It is also capped near two messages an hour, which breaks the second
 * press of "send me another code". Supabase still mints and validates the token;
 * only the delivery moved.
 *
 * Two transports, chosen by what is configured:
 *
 *   BREVO_API_KEY set    Brevo's HTTP API
 *   SMTP_HOST set        SMTP, via nodemailer
 *
 * The API wins when both are present. Brevo restricts SMTP to authorised IP
 * addresses, and a serverless function's address changes and cannot be
 * whitelisted — so SMTP here breaks the moment that setting is switched on, and
 * the failure looks like mail simply not arriving. An API key is not subject to
 * it. The API also needs no dependency and is one request rather than a
 * handshake of half a dozen round trips, which tells in a function that starts
 * cold.
 *
 * SMTP stays supported because it is the portable one: moving to another
 * provider, on a host that is not serverless, is then configuration rather than
 * code.
 *
 * The address mail is sent FROM has to be one the provider has verified, and
 * must be one we control. The address it is sent TO is unrestricted. The two are
 * easily confused, and only the sender ever needs proving.
 */

export interface MailResult {
	ok: boolean;
	/** Why it failed, for the server log. Never shown to the visitor. */
	detail?: string;
}

/** Which transport a send would use, or null if none is usable. */
export function mailTransport(): 'smtp' | 'api' | null {
	if (!env.MAIL_FROM) return null;
	if (env.BREVO_API_KEY) return 'api';
	if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return 'smtp';
	return null;
}

export function mailConfigured(): boolean {
	return mailTransport() !== null;
}

async function sendViaSmtp(options: {
	to: string;
	subject: string;
	text: string;
	html: string;
}): Promise<MailResult> {
	try {
		// Imported here rather than at module scope so the public build never
		// pulls a mail client into a bundle that has no use for one.
		const nodemailer = (await import('nodemailer')).default;

		const port = Number(env.SMTP_PORT || 587);
		const transporter = nodemailer.createTransport({
			host: env.SMTP_HOST,
			port,
			// 465 is TLS from the first byte; 587 upgrades with STARTTLS.
			secure: port === 465,
			auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
			connectionTimeout: 15_000,
			greetingTimeout: 10_000,
			socketTimeout: 20_000
		});

		await transporter.sendMail({
			from: { address: env.MAIL_FROM!, name: env.MAIL_FROM_NAME || 'One Man Agency' },
			to: options.to,
			subject: options.subject,
			text: options.text,
			html: options.html
		});

		return { ok: true };
	} catch (error) {
		return { ok: false, detail: String(error).slice(0, 200) };
	}
}

export async function sendMail(options: {
	to: string;
	subject: string;
	text: string;
	html: string;
}): Promise<MailResult> {
	const transport = mailTransport();
	if (!transport) {
		return { ok: false, detail: 'MAIL_FROM with either SMTP_HOST or BREVO_API_KEY is required' };
	}
	if (transport === 'smtp') return sendViaSmtp(options);

	const key = env.BREVO_API_KEY!;
	const from = env.MAIL_FROM!;

	try {
		const response = await fetch('https://api.brevo.com/v3/smtp/email', {
			method: 'POST',
			headers: {
				'api-key': key,
				'content-type': 'application/json',
				accept: 'application/json'
			},
			body: JSON.stringify({
				sender: { email: from, name: env.MAIL_FROM_NAME || 'One Man Agency' },
				to: [{ email: options.to }],
				subject: options.subject,
				textContent: options.text,
				htmlContent: options.html
			})
		});

		if (!response.ok) {
			// Brevo names the cause — an unverified sender, a bad key, a daily cap.
			// Worth keeping, because none of it is visible from the CMS otherwise.
			const body = await response.text().catch(() => '');
			return { ok: false, detail: `${response.status} ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (error) {
		return { ok: false, detail: String(error).slice(0, 200) };
	}
}

/** The one-time code mail. Plain, and unbranded on purpose. */
export function recoveryMail(code: string): { subject: string; text: string; html: string } {
	const subject = 'Je code om een nieuw wachtwoord in te stellen';

	const text =
		'Je vroeg een nieuw wachtwoord aan voor het beheer.\n\n' +
		`Je code is: ${code}\n\n` +
		'Vul deze in op het scherm waar je hem hebt aangevraagd. De code werkt ' +
		'een keer en vervalt binnen het uur.\n\n' +
		'Heb je dit niet zelf gedaan, dan hoef je niets te doen. Je wachtwoord ' +
		'blijft ongewijzigd zolang de code niet gebruikt wordt.\n';

	const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0A0A0A;max-width:480px">
  <p>Je vroeg een nieuw wachtwoord aan voor het beheer.</p>
  <p style="margin:24px 0">
    <span style="display:inline-block;font-size:28px;font-weight:700;letter-spacing:.18em;padding:14px 20px;border:1px solid #C9D5D3;border-radius:4px;background:#F4F9F8">${code}</span>
  </p>
  <p>Vul deze code in op het scherm waar je hem hebt aangevraagd. Ze werkt een keer en vervalt binnen het uur.</p>
  <p style="color:#6E6E6E">Heb je dit niet zelf gedaan, dan hoef je niets te doen. Je wachtwoord blijft ongewijzigd zolang de code niet gebruikt wordt.</p>
</div>`;

	return { subject, text, html };
}
