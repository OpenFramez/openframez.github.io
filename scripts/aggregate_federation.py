#!/usr/bin/env python3
"""
OpenFramez — Federated Content Aggregator (Phase 5)

Reads data/registry.json to get the list of registered user repos,
fetches each user's manifest.json from their openframez-uploads repo,
and aggregates everything into data/federated.json.

Run locally:
    python3 scripts/aggregate_federation.py

Run in CI:
    GitHub Action .github/workflows/aggregate-federation.yml
    triggers on schedule (hourly) and on push to data/registry.json.

The script:
  1. Reads data/registry.json from this repo (local file).
  2. For each registered user, fetches their manifest.json from
     https://raw.githubusercontent.com/{user}/openframez-uploads/main/manifest.json
  3. Normalizes each entry: assign fu_NNNN ID, attach source_user/source_repo,
     map to gallery schema.
  4. Writes data/federated.json with all aggregated entries.
  5. Commits the update if running in CI (GITHUB_TOKEN env var present).

Failures (user repo deleted, manifest missing, network error) are non-fatal —
that user is simply skipped. A warning is logged.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ---------- Config ----------
REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = REPO_ROOT / 'data' / 'registry.json'
FEDERATED_PATH = REPO_ROOT / 'data' / 'federated.json'

# GitHub raw URL pattern for fetching user manifests
MANIFEST_URL_TEMPLATE = (
    'https://raw.githubusercontent.com/{user}/openframez-uploads/main/manifest.json'
)

# Category label map (Persian) — matches upload.html category dropdown
CATEGORY_LABELS = {
    'nature': 'طبیعت و مناظر',
    'architecture': 'معماری',
    'wildlife': 'حیات وحش',
    'space': 'فضا و نجوم',
    'food': 'غذا و نوشیدنی',
    'travel': 'سفر و شهرها',
    'art': 'هنر و نقاشی',
    'sports': 'ورزش',
    'people': 'مردم',
    'technology': 'تکنولوژی',
    'music': 'موسیقی',
    'science': 'علم',
    'animation': 'انیمیشن',
    'timelapse': 'تایم‌لپس',
    'experiment': 'آزمایش',
    'history': 'تاریخ',
    'vintage_ad': 'تبلیغات قدیمی',
    'education': 'آموزشی',
    'other': 'سایر',
}


def log(msg):
    """Print with timestamp."""
    ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
    print(f'[{ts}] {msg}', flush=True)


def fetch_json(url, timeout=15):
    """Fetch JSON from URL with timeout. Returns dict or None on failure."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'OpenFramez-Aggregator/1.0',
            'Accept': 'application/json',
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            return json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError) as e:
        log(f'  ! fetch failed: {url} → {e}')
        return None
    except Exception as e:
        log(f'  ! unexpected error: {url} → {e}')
        return None


def load_registry():
    """Load the central registry.json."""
    if not REGISTRY_PATH.exists():
        log(f'Registry not found at {REGISTRY_PATH}, creating empty.')
        return {'users': [], 'last_updated': None}
    with open(REGISTRY_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def normalize_entry(entry, user_login, manifest):
    """
    Normalize a user's manifest entry to match gallery schema.
    Returns dict with all fields the gallery expects.
    """
    entry = entry or {}
    file_url = entry.get('file_url') or entry.get('url') or ''
    thumbnail_url = entry.get('thumbnail_url') or file_url

    # If file_url uses raw.githubusercontent, also construct a Pages URL
    # (Pages URL is faster + better CORS for the gallery)
    if 'raw.githubusercontent.com' in file_url and '/openframez-uploads/' in file_url:
        # raw.githubusercontent.com/{user}/openframez-uploads/main/uploads/...
        try:
            parts = file_url.split('/openframez-uploads/', 1)
            after_repo = parts[1]
            # Strip branch name (e.g., 'main/uploads/...')
            if '/' in after_repo:
                after_branch = after_repo.split('/', 1)[1]
                file_url = f'https://{user_login}.github.io/openframez-uploads/{after_branch}'
                if not entry.get('thumbnail_url'):
                    thumbnail_url = file_url
        except Exception:
            pass

    return {
        'id': entry.get('id') or f"fu_{entry.get('timestamp', '')[:10].replace('-', '')}",
        'type': entry.get('type', 'photo'),
        'title': entry.get('title', 'بدون عنوان'),
        'description': entry.get('description', ''),
        'category': entry.get('category', 'other'),
        'category_label': CATEGORY_LABELS.get(entry.get('category', 'other'), entry.get('category', 'سایر')),
        'author': entry.get('author', user_login),
        'license': entry.get('license', 'CC BY 4.0'),
        'license_url': entry.get('license_url') or get_license_url(entry.get('license', 'CC BY 4.0')),
        'spdx_id': entry.get('spdx_id') or get_spdx_id(entry.get('license', 'CC BY 4.0')),
        'license_viral': entry.get('license_viral', entry.get('license') == 'CC BY-SA 4.0'),
        'license_file_path': entry.get('license_file_path', ''),
        'source_user': user_login,
        'source_repo': 'openframez-uploads',
        'source_url': f'https://github.com/{user_login}/openframez-uploads',
        'source_user_url': f'https://github.com/{user_login}',
        'file_url': file_url,
        'thumbnail_url': thumbnail_url,
        'uploaded_at': entry.get('uploaded_at') or entry.get('timestamp') or manifest.get('last_updated', ''),
        'width': entry.get('width', 0),
        'height': entry.get('height', 0),
        'duration': entry.get('duration', 0),
        'size_bytes': entry.get('size_bytes', 0),
        'mime_type': entry.get('mime_type', ''),
        'original_filename': entry.get('original_filename', ''),
    }


# License metadata registry — SPDX IDs are the standard for machine-readable license identification.
LICENSE_METADATA = {
    'CC BY 4.0': {
        'url': 'https://creativecommons.org/licenses/by/4.0/',
        'spdx': 'CC-BY-4.0',
        'viral': False,
    },
    'CC BY-SA 4.0': {
        'url': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'spdx': 'CC-BY-SA-4.0',
        'viral': True,
    },
    'CC0': {
        'url': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'spdx': 'CC0-1.0',
        'viral': False,
    },
    'Public Domain': {
        'url': 'https://creativecommons.org/publicdomain/mark/1.0/',
        'spdx': 'CC-PDDC',
        'viral': False,
    },
    'GFDL': {
        'url': 'https://www.gnu.org/licenses/fdl-1.3.html',
        'spdx': 'GFDL-1.3-only',
        'viral': True,
    },
}


def get_license_url(license_name):
    """Map license name to URL."""
    return LICENSE_METADATA.get(license_name, {}).get('url', '')


def get_spdx_id(license_name):
    """Map license name to SPDX identifier."""
    return LICENSE_METADATA.get(license_name, {}).get('spdx', '')


def assign_ids(items):
    """Assign sequential fu_NNNN IDs."""
    for i, item in enumerate(items, start=1):
        item['id'] = f'fu_{i:04d}'
    return items


def aggregate():
    """Main aggregation routine."""
    log('Starting federated content aggregation...')

    # Optional: rebuild registry from registration issues first.
    # This keeps the registry fresh even between Action runs.
    # Only runs if GH_TOKEN is available (CI environment).
    if os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN'):
        log('GH_TOKEN detected — rebuilding registry from registration issues first...')
        try:
            import subprocess
            result = subprocess.run(
                ['python3', str(REPO_ROOT / 'scripts' / 'rebuild_registry.py')],
                env=os.environ.copy(),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                log(f'  ! rebuild_registry.py failed: {result.stderr}')
            else:
                log('  ✓ registry rebuilt from issues.')
        except Exception as e:
            log(f'  ! rebuild_registry.py exception: {e}')
    else:
        log('No GH_TOKEN — skipping registry rebuild (will use existing registry.json).')

    registry = load_registry()
    users = registry.get('users', [])
    log(f'Found {len(users)} registered users.')

    all_items = []
    successful_users = 0
    failed_users = 0

    for user in users:
        login = user.get('login')
        if not login:
            continue

        log(f'Fetching manifest for @{login}...')
        manifest_url = MANIFEST_URL_TEMPLATE.format(user=login)
        manifest = fetch_json(manifest_url)
        if not manifest:
            log(f'  ✗ Could not fetch manifest for @{login}, skipping.')
            failed_users += 1
            continue

        uploads = manifest.get('uploads', [])
        log(f'  ✓ Found {len(uploads)} uploads.')

        for entry in uploads:
            try:
                normalized = normalize_entry(entry, login, manifest)
                all_items.append(normalized)
            except Exception as e:
                log(f'  ! Failed to normalize entry: {e}')

        successful_users += 1
        # Be polite to GitHub
        time.sleep(0.2)

    # Sort by uploaded_at (newest first)
    all_items.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
    assign_ids(all_items)

    # Compute stats
    photos = sum(1 for i in all_items if i.get('type') == 'photo')
    videos = sum(1 for i in all_items if i.get('type') == 'video')

    federated = {
        'last_aggregated': datetime.now(timezone.utc).isoformat(),
        'users': successful_users,
        'users_failed': failed_users,
        'total_photos': photos,
        'total_videos': videos,
        'total_items': len(all_items),
        'items': all_items,
        'description': 'Auto-generated by aggregate_federation.py. Aggregates uploads from all registered user repos.',
    }

    with open(FEDERATED_PATH, 'w', encoding='utf-8') as f:
        json.dump(federated, f, ensure_ascii=False, indent=2)

    log(f'Aggregation complete: {len(all_items)} items from {successful_users} users ({failed_users} failed).')
    log(f'Written to {FEDERATED_PATH}')

    return federated


if __name__ == '__main__':
    try:
        aggregate()
    except Exception as e:
        log(f'FATAL: {e}')
        sys.exit(1)
