# -*- coding: utf-8 -*-
"""
Prove the CMS can actually send mail.

A code that was never delivered looks exactly like a wrong address from the
inside: the form says it sent one, and nothing arrives. This asks Brevo
directly, so the cause is named — a bad key, an unverified sender, a daily cap.

    python tools/check_mail.py                       # key valid? sender allowed?
    python tools/check_mail.py --to you@example.com  # send one real message

Reads BREVO_API_KEY and MAIL_FROM from .env. MAIL_FROM is the sender and must be
verified in Brevo; recipients never need verifying.
"""
import os, sys, json, argparse, urllib.request, urllib.error

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


def call(url, key, payload=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode() if payload else None,
        headers={'api-key': key, 'content-type': 'application/json', 'accept': 'application/json'},
        method='POST' if payload else 'GET',
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read() or b'{}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--to', help='send a real test message to this address')
    args = ap.parse_args()

    env = load_env()
    key = env.get('BREVO_API_KEY', '').strip()
    sender = env.get('MAIL_FROM', '').strip()

    missing = [n for n, v in [('BREVO_API_KEY', key), ('MAIL_FROM', sender)] if not v]
    if missing:
        sys.exit('Not set in .env: ' + ', '.join(missing))

    try:
        account = call('https://api.brevo.com/v3/account', key)
    except urllib.error.HTTPError as exc:
        sys.exit(
            f'Brevo refused the key ({exc.code}). Use an API key from '
            'SMTP & API > API keys, not the SMTP key.'
        )
    except Exception as exc:                                    # noqa: BLE001
        sys.exit(f'Could not reach Brevo: {exc}')

    print(f'account   {account.get("email", "?")}')
    plan = (account.get('plan') or [{}])[0]
    if plan:
        print(f'plan      {plan.get("type", "?")}, credits left: {plan.get("credits", "?")}')

    try:
        senders = call('https://api.brevo.com/v3/senders', key).get('senders', [])
        allowed = [s['email'] for s in senders if s.get('active')]
        print(f'senders   {", ".join(allowed) or "(none verified yet)"}')
        if sender not in allowed:
            print(f'\nMAIL_FROM is {sender}, which is not a verified sender.')
            print('Verify it in Brevo under Senders, Domains & Dedicated IPs, or set')
            print('MAIL_FROM to one of the addresses listed above.')
            sys.exit(1)
        print(f'\nMAIL_FROM {sender} is verified.')
    except urllib.error.HTTPError as exc:
        print(f'senders   could not be listed ({exc.code}); the key may lack permission')

    if not args.to:
        print('\nReady. Add --to <address> to send a real message.')
        return

    try:
        call('https://api.brevo.com/v3/smtp/email', key, {
            'sender': {'email': sender, 'name': env.get('MAIL_FROM_NAME', 'One Man Agency')},
            'to': [{'email': args.to}],
            'subject': 'Testbericht van het beheer',
            'textContent': 'Dit is een testbericht.\n\n'
                           'Komt dit aan, dan kan het beheer codes versturen.\n',
        })
    except urllib.error.HTTPError as exc:
        sys.exit(f'Sending failed ({exc.code}): {exc.read().decode(errors="replace")[:200]}')

    print(f'\nSent to {args.to}. Check the inbox, and the spam folder.')


if __name__ == '__main__':
    main()
