#!/usr/bin/env python3
"""
Pixelary — Rebuild Registry from Registration Issues

This script implements the event-sourcing pattern for user registration.
Instead of appending to data/registry.json on each registration (which causes
race conditions when multiple users register simultaneously), we treat
GitHub Issues as the source of truth:

    Issue (open OR closed with label "registered") = "this user wants in"

The script:
  1. Queries GitHub API for all issues with label "registration" or
     title starting with "Register:" (open + closed).
  2. Parses each issue body, expecting a JSON block:
       ```json
       {
         "login": "username",
         "repo": "pixelary-uploads",
         "url": "https://github.com/username/pixelary-uploads",
         "pages_url": "https://username.github.io/pixelary-uploads",
         "registered_at": "2026-08-13T10:00:00Z"
       }
       ```
  3. Validates: the issue author's login must match the "login" field in the
     body. This prevents users from registering someone else's repo.
  4. Deduplicates by login (last-write-wins by issue creation time).
  5. Sorts by registered_at.
  6. Writes data/registry.json atomically.

Run locally:
    GH_TOKEN=... python3 scripts/rebuild_registry.py

Run in CI:
    Triggered by .github/workflows/process-registration.yml on issue events.
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ---------- Config ----------
REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = REPO_ROOT / 'data' / 'registry.json'

REPO_OWNER = 'betaversion488-oss'
REPO_NAME = 'betaversion488-oss.github.io'

# Match ```json ... ``` blocks in issue bodies
JSON_BLOCK_RE = re.compile(r'```json\s*\n(.*?)\n```', re.DOTALL)


def log(msg):
    ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
    print(f'[{ts}] {msg}', flush=True)


def gh_api_get(path, token):
    """Fetch from GitHub API with auth."""
    url = f'https://api.github.com{path}'
    req = urllib.request.Request(url, headers={
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Pixelary-RegistryRebuilder/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status != 200:
                return None
            return json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        log(f'  ! API call failed: {path} → {e}')
        return None


def fetch_registration_issues(token):
    """Fetch all issues that look like registrations (open + closed)."""
    issues = []
    # Page through results (100 per page, up to 10 pages = 1000 issues max)
    for state in ('open', 'closed'):
        for page in range(1, 11):
            path = f'/repos/{REPO_OWNER}/{REPO_NAME}/issues?state={state}&labels=registration&per_page=100&page={page}'
            batch = gh_api_get(path, token)
            if not batch:
                break
            # Filter out PRs (issues endpoint returns PRs too)
            batch = [i for i in batch if 'pull_request' not in i]
            issues.extend(batch)
            if len(batch) < 100:
                break

    # Also fetch issues with "Register:" title prefix (in case label isn't applied)
    for state in ('open', 'closed'):
        for page in range(1, 11):
            path = f'/repos/{REPO_OWNER}/{REPO_NAME}/issues?state={state}&per_page=100&page={page}'
            batch = gh_api_get(path, token)
            if not batch:
                break
            batch = [i for i in batch if 'pull_request' not in i]
            for i in batch:
                title = (i.get('title') or '').strip()
                if title.lower().startswith('register:') and i not in issues:
                    issues.append(i)
            if len(batch) < 100:
                break

    log(f'Found {len(issues)} registration issues (open + closed).')
    return issues


def parse_issue_body(body, issue_author):
    """
    Parse an issue body and extract registration data.
    Returns dict on success, None on failure.
    Validates that the registration login matches the issue author.
    """
    if not body:
        return None

    # Find JSON block
    match = JSON_BLOCK_RE.search(body)
    if not match:
        return None

    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None

    login = data.get('login', '').strip()
    repo = data.get('repo', 'pixelary-uploads').strip()
    pages_url = data.get('pages_url', '').strip()
    url = data.get('url', '').strip()
    registered_at = data.get('registered_at', '').strip()

    if not login:
        return None

    # SECURITY: the issue author must match the login they're trying to register.
    # This prevents user A from registering user B's repo.
    if login.lower() != issue_author.lower():
        log(f'  ! Skipping: issue author @{issue_author} tried to register @{login}')
        return None

    # Fill in defaults if missing
    if not url:
        url = f'https://github.com/{login}/{repo}'
    if not pages_url:
        pages_url = f'https://{login}.github.io/{repo}'
    if not registered_at:
        registered_at = datetime.now(timezone.utc).isoformat()

    return {
        'login': login,
        'repo': repo,
        'url': url,
        'pages_url': pages_url,
        'registered_at': registered_at,
        'last_active': registered_at,
    }


def rebuild():
    """Main: rebuild registry from all registration issues."""
    log('Starting registry rebuild from issues...')

    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        log('FATAL: GH_TOKEN env var not set')
        sys.exit(1)

    issues = fetch_registration_issues(token)
    if not issues:
        log('No registration issues found. Keeping existing registry.')
        return

    # Sort by issue creation time so later issues override earlier ones
    # (last-write-wins for the same login)
    issues.sort(key=lambda i: i.get('created_at', ''))

    users_by_login = {}
    skipped = 0
    for issue in issues:
        body = issue.get('body') or ''
        author = (issue.get('user') or {}).get('login', '')
        parsed = parse_issue_body(body, author)
        if not parsed:
            skipped += 1
            continue
        users_by_login[parsed['login']] = parsed

    users = list(users_by_login.values())
    users.sort(key=lambda u: u.get('registered_at', ''))

    registry = {
        'users': users,
        'last_updated': datetime.now(timezone.utc).isoformat(),
        'source': 'rebuilt from registration issues by rebuild_registry.py',
        'total_users': len(users),
    }

    # Atomic write
    tmp_path = REGISTRY_PATH.with_suffix('.tmp')
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    tmp_path.replace(REGISTRY_PATH)

    log(f'Registry rebuilt: {len(users)} users ({skipped} issues skipped).')
    log(f'Written to {REGISTRY_PATH}')


if __name__ == '__main__':
    try:
        rebuild()
    except Exception as e:
        log(f'FATAL: {e}')
        sys.exit(1)
