import { env } from '$env/dynamic/private';

/**
 * Sending mail from the CMS.
 *
 * Over Brevo's HTTP API rather than SMTP. A serverless function is a poor place
 * to open an SMTP conversation — connections cannot be reused between
 * invocations and outbound ports are not always open — while an HTTPS request
 * is the one thing the platform is certain to allow.
 *
 * Doing it here rather than through Supabase's mailer is deliberate. On the free
 * tier Supabase refuses to let the recovery template be changed while the
 * default provider is in use, so its mail always carries a link and a one-time
 * code can never reach anyone. It is also capped near two messages an hour,
 * which breaks the second press of "send me another code". Composing the message
 * ourselves sidesteps both, and means the wording is in the same Dutch as the
 * rest of the CMS.
 *
 * The address it is sent FROM has to be one Brevo has verified. The address it
 * is sent TO is unrestricted — the two are commonly confused, and only the
 * sender ever needs proving.
 */

export interface MailResult {
	ok: boolean;
	/** Why it failed, for the server log. Never shown to the visitor. */
	detail?: string;
}

export function mailConfigured(): boolean {
	return Boolean(env.BREVO_API_KEY && env.MAIL_FROM);
}

export async function sendMail(options: {
	to: string;
	subject: string;
	text: string;
	html: string;
}): Promise<MailResult> {
	const key = env.BREVO_API_KEY;
	const from = env.MAIL_FROM;

	if (!key || !from) {
		return { ok: false, detail: 'BREVO_API_KEY or MAIL_FROM is not set' };
	}

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
