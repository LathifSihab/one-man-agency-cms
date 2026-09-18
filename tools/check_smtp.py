# -*- coding: utf-8 -*-
"""
Prove the SMTP credentials work before Supabase depends on them.

Supabase does not report a failed send. A wrong password, an unverified sender
or a blocked port all look identical from the CMS: the code is "sent" and never
arrives. This connects to the relay directly, so the failure is named.

    python tools/check_smtp.py                       # connect and authenticate
    python tools/check_smtp.py --to you@example.com  # and send one real message

Reads BREVO_SMTP_USER, BREVO_SMTP_KEY and MAIL_FROM from .env.
"""
import os, sys, ssl, smtplib, argparse
from email.message import EmailMessage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HOST = 'smtp-relay.brevo.com'
PORT = 587


def load_env():
    env = dict(os.environ)
    path = os.path.join(ROOT, '.env')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return env


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--to', help='send a real test message to this address')
    ap.add_argument('--host', default=HOST)
    ap.add_argument('--port', type=int, default=PORT)
    args = ap.parse_args()

    env = load_env()
    user = env.get('BREVO_SMTP_USER', '').strip()
    key = env.get('BREVO_SMTP_KEY', '').strip()
    sender = env.get('MAIL_FROM', '').strip()

    missing = [n for n, v in
               [('BREVO_SMTP_USER', user), ('BREVO_SMTP_KEY', key), ('MAIL_FROM', sender)]
               if not v]
    if missing:
        sys.exit('Not set in .env: ' + ', '.join(missing))

    print(f'host   {args.host}:{args.port}')
    print(f'user   {user}')
    print(f'from   {sender}')

    try:
        with smtplib.SMTP(args.host, args.port, timeout=25) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            print('\nconnected and upgraded to TLS')

            try:
                smtp.login(user, key)
            except smtplib.SMTPAuthenticationError as exc:
                sys.exit(
                    f'\nAuthentication refused: {exc.smtp_code} '
                    f'{exc.smtp_error.decode(errors="replace") if isinstance(exc.smtp_error, bytes) else exc.smtp_error}\n'
                    'The username is the SMTP login Brevo shows (like 9xxxxx@smtp-brevo.com),\n'
                    'not your account email, and the password is the SMTP key, not the\n'
                    'account password.'
                )
            print('authenticated')

            if not args.to:
                print('\nCredentials are good. Add --to <address> to send a real message.')
                return

            message = EmailMessage()
            message['Subject'] = 'Testbericht van het beheer'
            message['From'] = sender
            message['To'] = args.to
            message.set_content(
                'Dit is een testbericht.\n\n'
                'Komt dit aan, dan kan het beheer codes en uitnodigingen versturen.\n'
            )

            try:
                smtp.send_message(message)
            except smtplib.SMTPSenderRefused as exc:
                sys.exit(
                    f'\nThe sender address was refused: {exc.smtp_error}\n'
                    f'Verify {sender} in Brevo under Senders, Domains & Dedicated IPs.'
                )
            print(f'\nSent to {args.to}. Check the inbox, and the spam folder.')

    except (smtplib.SMTPException, OSError) as exc:
        sys.exit(f'\nCould not reach the relay: {exc}')


if __name__ == '__main__':
    main()
