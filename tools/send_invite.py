# -*- coding: utf-8 -*-
"""
Send someone their access to the CMS.

Emails a one-time link that lets them choose their own password. No password is
ever generated, transmitted or written down: a password mailed in plain text
stays in an inbox forever, gets forwarded, and is the single credential to a
site with no second account to fall back on.

    python tools/send_invite.py --email niels@onemanagency.be
    python tools/send_invite.py --email niels@onemanagency.be --reset
    python tools/send_invite.py --check

`--reset` sends a password-reset link instead of an invitation, which is what an
existing account needs. `--check` reports whether mail can actually be delivered
before you rely on it.

Mail delivery: Supabase's built-in SMTP only delivers to addresses on the
project team and is heavily rate limited. Sending to a client address needs
custom SMTP configured under Authentication > Emails in the dashboard. --check
will tell you which of the two you have.
"""
import os, sys, argparse

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


def client(env):
    try:
        from supabase import create_client
    except ImportError:
        sys.exit('supabase-py is required:  pip install supabase')

    url = env.get('PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        sys.exit('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.')
    return create_client(url, key)


def redirect_target(env, override=None):
    """Where the link lands.

    Not necessarily PUBLIC_SITE_URL: that is the canonical address for search
    engines and points at the production domain, which is still the old site
    until the cutover. Send invitations to wherever the CMS is reachable today.
    """
    site = (override or env.get('ADMIN_URL') or env.get('PUBLIC_SITE_URL') or '').rstrip('/')
    return f'{site}/admin/login' if site else None


def main():
    ap = argparse.ArgumentParser(description='Email CMS access as a one-time link.')
    ap.add_argument('--email', help='who should receive it')
    ap.add_argument('--reset', action='store_true',
                    help='send a password-reset link (for an account that exists)')
    ap.add_argument('--redirect', metavar='URL',
                    help='where the link should land (default: ADMIN_URL, then PUBLIC_SITE_URL)')
    ap.add_argument('--check', action='store_true',
                    help='report whether mail can be delivered, and send nothing')
    args = ap.parse_args()

    env = load_env()
    db = client(env)

    if args.check:
        print('Mail delivery')
        print('  Supabase can always send to addresses on the project team.')
        print('  Any other address needs custom SMTP:')
        print('    Dashboard > Authentication > Emails > SMTP Settings')
        print('  Without it, an invite to a client address is accepted and never arrives.\n')
        users = db.auth.admin.list_users()
        print(f'Accounts: {len(users)}')
        for u in users:
            state = 'confirmed' if u.email_confirmed_at else 'not yet confirmed'
            print(f'  {u.email:45} {state}')
        print(f'\nLink returns to: {redirect_target(env) or "(PUBLIC_SITE_URL not set)"}')
        return

    if not args.email:
        sys.exit('Pass --email, or --check to see what is configured.')

    email = args.email.strip()
    target = redirect_target(env, args.redirect)
    existing = next(
        (u for u in db.auth.admin.list_users() if (u.email or '').lower() == email.lower()), None
    )

    try:
        if args.reset or existing:
            # An invite is refused for an address that already exists, so an
            # account that is merely locked out needs the reset flow.
            db.auth.reset_password_for_email(email, {'redirect_to': target} if target else {})
            print(f'Password-reset link sent to {email}.')
            print('It lets them choose a new password; the old one keeps working until they do.')
        else:
            db.auth.admin.invite_user_by_email(
                email, {'redirect_to': target} if target else {}
            )
            print(f'Invitation sent to {email}.')
            print('It creates the account when they set a password. Nothing to pass on separately.')
    except Exception as exc:                                   # noqa: BLE001
        sys.exit(f'Sending failed: {exc}\n\nRun --check to see whether SMTP is configured.')

    print('\nLinks expire, so send it close to when they will use it.')
    print('If it does not arrive, the likely cause is SMTP: run --check.')


if __name__ == '__main__':
    main()
