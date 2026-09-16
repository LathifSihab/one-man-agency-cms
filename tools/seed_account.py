# -*- coding: utf-8 -*-
"""
Create or reset the CMS account.

The CMS has exactly one user (decision D5) and public sign-up is disabled, so
the account cannot be created through the application. This script does it with
the service role key instead.

    python tools/seed_account.py                          # use ADMIN_EMAIL/ADMIN_PASSWORD from .env
    python tools/seed_account.py --email niels@x.be       # generate a password and print it once
    python tools/seed_account.py --email niels@x.be --password 'secret'
    python tools/seed_account.py --list                   # show existing accounts
    python tools/seed_account.py --delete old@x.be        # remove an account

Idempotent: if the address already exists the password is reset rather than
failing, so this doubles as the recovery path for a lockout.

Credentials come from .env (PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
The service role key bypasses RLS — run this locally, never from the browser.
"""
import os, sys, string, secrets, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Excludes characters that are easy to confuse when read aloud or retyped.
ALPHABET = (
    ''.join(c for c in string.ascii_letters if c not in 'lIO')
    + ''.join(c for c in string.digits if c not in '01')
    + '!@#$%^&*-_=+'
)


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
        sys.exit(
            'PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.\n'
            'Find them in the Supabase dashboard under Project Settings > API.'
        )
    return create_client(url, key)


def generate_password(length=20):
    return ''.join(secrets.choice(ALPHABET) for _ in range(length))


def find_user(db, email):
    target = email.strip().lower()
    for user in db.auth.admin.list_users():
        if (user.email or '').lower() == target:
            return user
    return None


def main():
    ap = argparse.ArgumentParser(description='Create or reset the single CMS account.')
    ap.add_argument('--email', help='address to create or reset (default: ADMIN_EMAIL from .env)')
    ap.add_argument('--password', help='password to set (default: ADMIN_PASSWORD, else generated)')
    ap.add_argument('--list', action='store_true', help='list existing accounts and exit')
    ap.add_argument('--delete', metavar='EMAIL', help='delete an account and exit')
    args = ap.parse_args()

    env = load_env()
    db = client(env)

    if args.list:
        users = db.auth.admin.list_users()
        if not users:
            print('No accounts yet. Create one with --email.')
            return
        print(f'{len(users)} account(s):')
        for u in users:
            confirmed = 'confirmed' if u.email_confirmed_at else 'UNCONFIRMED'
            last = u.last_sign_in_at or 'never signed in'
            print(f'  {u.email:45} {confirmed:12} last: {last}')
        if len(users) > 1:
            print('\nNote: the CMS is designed for a single account (decision D5).')
        return

    if args.delete:
        user = find_user(db, args.delete)
        if not user:
            sys.exit(f'No account for {args.delete}.')
        db.auth.admin.delete_user(user.id)
        print(f'Deleted {user.email}.')
        return

    email = (args.email or env.get('ADMIN_EMAIL') or '').strip()
    if not email:
        sys.exit(
            'No address given. Pass --email, or set ADMIN_EMAIL in .env.\n'
            'Example:  python tools/seed_account.py --email niels@onemanagency.be'
        )

    password = args.password or env.get('ADMIN_PASSWORD') or ''
    generated = not password
    if generated:
        password = generate_password()
    elif len(password) < 12:
        sys.exit('Choose a password of at least 12 characters.')

    existing = find_user(db, email)
    if existing:
        db.auth.admin.update_user_by_id(
            existing.id, {'password': password, 'email_confirm': True}
        )
        action = 'Password reset for'
    else:
        db.auth.admin.create_user(
            {'email': email, 'password': password, 'email_confirm': True}
        )
        action = 'Created'

    print(f'{action} {email}')
    if generated:
        print(f'password: {password}')
        print('\nThis is shown once. Store it somewhere safe and change it after signing in.')
    else:
        print('Password set from the value you supplied.')

    others = [u for u in db.auth.admin.list_users() if (u.email or '').lower() != email.lower()]
    if others:
        print(f'\nWarning: {len(others)} other account(s) exist. The CMS assumes exactly one:')
        for u in others:
            print(f'  {u.email}')
        print('Remove them with --delete <email> unless they are intentional.')

    print('\nSign in at /admin/login. Public sign-up stays disabled.')


if __name__ == '__main__':
    main()
