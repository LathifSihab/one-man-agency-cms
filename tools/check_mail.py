# -*- coding: utf-8 -*-
"""
Prove the CMS can actually send mail.

A code that was never delivered looks exactly like a wrong address from the
inside: the form says it sent one, and nothing arrives. This asks the provider
directly, so the cause is named — a bad key, an unverified sender, a daily cap.

    python tools/check_mail.py                       # credentials valid?
    python tools/check_mail.py --to you@example.com  # send one real message

Checks whichever transport is configured, using the same precedence the
application does: Brevo's HTTP API when BREVO_API_KEY is set, otherwise SMTP. So
this tests what will actually run.

MAIL_FROM is the sender and must be verified with the provider. Recipients never
need verifying — the two are easily confused.
"""
import os, sys, ssl, json, smtplib, argparse, urllib.request, urllib.error
from email.message import EmailMessage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def test_message(sender, to, name):
    message = EmailMessage()
    message['Subject'] = 'Testbericht van het beheer'
    message['From'] = f'{name} <{sender}>' if name else sender
    message['To'] = to
    message.set_content(
        'Dit is een testbericht.\n\n'
        'Komt dit aan, dan kan het beheer codes versturen.\n'
    )
    return message


def check_smtp(env, sender, to):
    host = env.get('SMTP_HOST', '').strip()
    port = int(env.get('SMTP_PORT', '587') or 587)
    user = env.get('SMTP_USER', '').strip()
    password = env.get('SMTP_PASS', '').strip()

    print('transport SMTP')
    print(f'host      {host}:{port}')
    print(f'user      {user}')
    print(f'from      {sender}')

    if not password:
        sys.exit('SMTP_PASS is not set in .env')

    try:
        with smtplib.SMTP(host, port, timeout=25) as smtp:
            smtp.ehlo()
            # 465 is TLS from the first byte; 587 upgrades with STARTTLS.
            if port != 465:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            print('\nconnected and secured')

            try:
                smtp.login(user, password)
            except smtplib.SMTPAuthenticationError as exc:
                detail = exc.smtp_error
                if isinstance(detail, bytes):
                    detail = detail.decode(errors='replace')
                sys.exit(
                    f'\nAuthentication refused: {exc.smtp_code} {detail}\n\n'
                    'For Brevo the username is the SMTP login it shows you, which\n'
                    'looks like 9xxxxx@smtp-brevo.com and is not your account email,\n'
                    'and the password is the SMTP key, not the account password.'
                )
            print('authenticated')

            if not to:
                print('\nCredentials are good. Add --to <address> to send a real message.')
                return

            try:
                smtp.send_message(test_message(sender, to, env.get('MAIL_FROM_NAME', '')))
            except smtplib.SMTPSenderRefused as exc:
                sys.exit(
                    f'\nThe sender address was refused: {exc.smtp_error}\n'
                    f'Verify {sender} with your provider first.'
                )
            print(f'\nSent to {to}. Check the inbox, and the spam folder.')

    except (smtplib.SMTPException, OSError) as exc:
        sys.exit(f'\nCould not reach the relay: {exc}')


def call(url, key, payload=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode() if payload else None,
        headers={'api-key': key, 'content-type': 'application/json', 'accept': 'application/json'},
        method='POST' if payload else 'GET',
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read() or b'{}')


def check_api(env, sender, to):
    key = env.get('BREVO_API_KEY', '').strip()
    print('transport Brevo HTTP API')
    print(f'from      {sender}')

    try:
        account = call('https://api.brevo.com/v3/account', key)
    except urllib.error.HTTPError as exc:
        sys.exit(
            f'\nBrevo refused the key ({exc.code}). Use an API key from '
            'SMTP & API > API keys,\nnot the SMTP key.'
        )
    except Exception as exc:                                    # noqa: BLE001
        sys.exit(f'\nCould not reach Brevo: {exc}')

    print(f'account   {account.get("email", "?")}')
    plan = (account.get('plan') or [{}])[0]
    if plan:
        print(f'plan      {plan.get("type", "?")}, credits left: {plan.get("credits", "?")}')

    try:
        senders = call('https://api.brevo.com/v3/senders', key).get('senders', [])
        allowed = [s['email'] for s in senders if s.get('active')]
        print(f'senders   {", ".join(allowed) or "(none verified yet)"}')
        if allowed and sender not in allowed:
            sys.exit(
                f'\nMAIL_FROM is {sender}, which is not a verified sender.\n'
                'Verify it in Brevo under Senders, Domains & Dedicated IPs, or set\n'
                'MAIL_FROM to one of the addresses listed above.'
            )
    except urllib.error.HTTPError as exc:
        print(f'senders   could not be listed ({exc.code}); the key may lack permission')

    if not to:
        print('\nCredentials are good. Add --to <address> to send a real message.')
        return

    try:
        call('https://api.brevo.com/v3/smtp/email', key, {
            'sender': {'email': sender, 'name': env.get('MAIL_FROM_NAME', 'One Man Agency')},
            'to': [{'email': to}],
            'subject': 'Testbericht van het beheer',
            'textContent': 'Dit is een testbericht.\n\n'
                           'Komt dit aan, dan kan het beheer codes versturen.\n',
        })
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors='replace')[:200]
        sys.exit(f'\nSending failed ({exc.code}): {body}')

    print(f'\nSent to {to}. Check the inbox, and the spam folder.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--to', help='send a real test message to this address')
    args = ap.parse_args()

    env = load_env()
    sender = env.get('MAIL_FROM', '').strip()
    if not sender:
        sys.exit('MAIL_FROM is not set in .env')

    # Same precedence the application uses, so this tests what will actually run.
    if env.get('BREVO_API_KEY', '').strip():
        check_api(env, sender, args.to)
    elif env.get('SMTP_HOST', '').strip() and env.get('SMTP_USER', '').strip():
        check_smtp(env, sender, args.to)
    else:
        sys.exit('Set either SMTP_HOST/SMTP_USER/SMTP_PASS, or BREVO_API_KEY, in .env')


if __name__ == '__main__':
    main()
