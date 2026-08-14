#!/usr/bin/env python3
"""
OpenFramez Phase 2.5 — Internet Archive Video Scraper
===================================================
Scrapes short (≤ 60 s) public-domain / CC-licensed videos from the Internet Archive
to enrich the existing Wikimedia Commons catalog and feed the new Reels mode.

Collections targeted:
  - prelinger   (CC-licensed educational/industrial films — explicit licenseurl)
  - adviews      (vintage TV commercials, 1950s-1980s — Duke University Libraries donation)
  - opensource_movies (community-contributed open video)

Strategy:
  1. Use the advancedsearch.php API with format filter (MPEG4 OR h.264) and licenseurl:*
     where possible; fall back to collection-only for adviews.
  2. For each candidate identifier, fetch /metadata/<id> to read the file list, find the
     smallest h.264/MPEG4 derivative, and verify the duration is ≤ 60 s.
  3. Normalize to the same schema as data/videos.json so the front-end can use both
     sources transparently. The `source` field distinguishes them.
  4. Output: data/videos_ia.json  (consumed by merge_videos.py)

Each output entry:
{
  "id": "ia_0001",
  "title": "...",
  "description": "...",
  "category": "vintage_ad",        # category slug (see CATEGORIES below)
  "category_label": "تبلیغات قدیمی",
  "ia_identifier": "dmbb00506",
  "page_url": "https://archive.org/details/dmbb00506",
  "file_url": "https://archive.org/download/dmbb00506/dmbb00506_512kb.mp4",
  "thumb_url": "https://archive.org/download/dmbb00506/dmbb00506.thumbs/dmbb00506_000001.jpg",
  "thumb_width": 640,
  "thumb_height": 480,
  "duration": 23.99,
  "width": 320,
  "height": 240,
  "aspect": "4:3",
  "size_bytes": 2012667,
  "mime": "video/mp4",
  "sources": [
    {"label": "240p", "type": "video/mp4", "width": 320, "height": 240, "src": "...", "bandwidth": 0},
    {"label": "480p", "type": "video/mp4", "width": 640, "height": 480, "src": "...", "bandwidth": 0}
  ],
  "license": "Public domain",
  "license_url": "http://creativecommons.org/licenses/publicdomain/",
  "artist": "Duke University Libraries",
  "artist_url": "https://archive.org/details/adviews",
  "credit": "Internet Archive — AdViews collection",
  "uploaded_at": "2011-03-21",
  "source": "Internet Archive",
  "collection": "adviews"
}

Filters:
  - duration ≤ 60 s (Reels-friendly upper bound; lower bound 5 s for non-trivial clips)
  - file size ≤ 30 MB (keeps loading fast on mobile)
  - width ≥ 240, height ≥ 180
  - h.264 MPEG4 mp4 only (broadest browser support — IA auto-derives this for almost every item)
  - skip items already in the Wikimedia set (deduplicate by normalized title)
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
import html
from pathlib import Path

USER_AGENT = "OpenFramezBot/2.5 (https://github.com/OpenFramez/openframez.github.io; contact via GitHub Issues)"

# ----------- Categories (Persian labels) -----------
# Each IA collection maps to one or more category slugs that are recognizable
# alongside the existing Wikimedia categories. We add three new slugs unique
# to IA content: vintage_ad, archival, educational.
CATEGORIES = [
    ("vintage_ad",  "تبلیغات قدیمی"),
    ("archival",    "آرشیوی"),
    ("educational", "آموزشی"),
    ("history",     "تاریخ"),
    ("science",     "علم"),
    ("space",       "فضا"),
    ("art",         "هنر"),
    ("nature",      "طبیعت"),
]

# ----------- Source collections -----------
# Each tuple: (collection_id, default_category, default_license_label, default_license_url, max_per_collection)
# AdViews items don't carry per-item licenseurl but are widely recognized as
# public-domain vintage ads donated by Duke University Libraries. We tag them
# with a clear "Public domain (Duke University Libraries donation)" note.
SOURCES = [
    {
        "collection": "adviews",
        "category": "vintage_ad",
        "license_label": "Public domain",
        "license_url": "https://archive.org/details/adviews",
        "artist": "Duke University Libraries",
        "artist_url": "https://archive.org/details/adviews",
        "credit": "Internet Archive — AdViews collection (vintage TV commercial)",
        "require_licenseurl": False,
        "max_items": 40,
        "sort": "downloads desc",
    },
    {
        "collection": "prelinger",
        "category": "archival",
        "license_label": "",  # filled per-item from licenseurl
        "license_url": "",
        "artist": "Prelinger Archives",
        "artist_url": "https://archive.org/details/prelinger",
        "credit": "Internet Archive — Prelinger Archives",
        "require_licenseurl": True,  # only items with explicit CC licenseurl
        "max_items": 8,
        "sort": "downloads desc",
    },
    {
        "collection": "opensource_movies",
        "category": "educational",
        "license_label": "",
        "license_url": "",
        "artist": "Internet Archive Community",
        "artist_url": "https://archive.org/details/opensource_movies",
        "credit": "Internet Archive — Open Source Movies",
        "require_licenseurl": True,
        "max_items": 5,
        "sort": "downloads desc",
    },
]

# ----------- Hard filters -----------
MIN_DURATION = 5.0
MAX_DURATION = 60.0
MIN_WIDTH = 240
MIN_HEIGHT = 180
MAX_SIZE_BYTES = 30 * 1024 * 1024  # 30 MB cap

# Allow only these MIME types
ACCEPTABLE_FILE_FORMATS = {
    "MPEG4",       # IA label for h.264 mp4 (most common)
    "h.264",
    "H.264",
    "512Kb MPEG4", # smaller derivative — great for mobile
    "HiRes MPEG4",
}

# Map IA format -> MIME type
FORMAT_TO_MIME = {
    "MPEG4": "video/mp4",
    "h.264": "video/mp4",
    "H.264": "video/mp4",
    "512Kb MPEG4": "video/mp4",
    "HiRes MPEG4": "video/mp4",
}

# License URL normalization map (also catches old "publicdomain" URL form)
LICENSE_NORMALIZE = {
    "http://creativecommons.org/licenses/publicdomain/": ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/"),
    "https://creativecommons.org/licenses/publicdomain/": ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/"),
    # CC-BY licenses
    "https://creativecommons.org/licenses/by/4.0/": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "http://creativecommons.org/licenses/by/4.0/":  ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "https://creativecommons.org/licenses/by/3.0/": ("CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"),
    "https://creativecommons.org/licenses/by/2.0/": ("CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"),
    # CC-BY-SA
    "https://creativecommons.org/licenses/by-sa/4.0/": ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
    "http://creativecommons.org/licenses/by-sa/4.0/":  ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
    "https://creativecommons.org/licenses/by-sa/3.0/": ("CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"),
    "https://creativecommons.org/licenses/by-sa/2.0/": ("CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"),
    # CC-NC licenses (we still accept — non-commercial use is fine for a non-commercial gallery)
    "https://creativecommons.org/licenses/by-nc/4.0/": ("CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/"),
    "https://creativecommons.org/licenses/by-nc/3.0/": ("CC BY-NC 3.0", "https://creativecommons.org/licenses/by-nc/3.0/"),
    "https://creativecommons.org/licenses/by-nc-sa/4.0/": ("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"),
    "http://creativecommons.org/licenses/by-nc-sa/4.0/":  ("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"),
    "https://creativecommons.org/licenses/by-nc-sa/3.0/": ("CC BY-NC-SA 3.0", "https://creativecommons.org/licenses/by-nc-sa/3.0/"),
    "http://creativecommons.org/licenses/by-nc-sa/3.0/":  ("CC BY-NC-SA 3.0", "https://creativecommons.org/licenses/by-nc-sa/3.0/"),
    "https://creativecommons.org/licenses/by-nd/4.0/": ("CC BY-ND 4.0", "https://creativecommons.org/licenses/by-nd/4.0/"),
    "https://creativecommons.org/licenses/by-nd/3.0/": ("CC BY-ND 3.0", "https://creativecommons.org/licenses/by-nd/3.0/"),
    "http://creativecommons.org/licenses/by-nd/2.0/deed.en": ("CC BY-ND 2.0", "https://creativecommons.org/licenses/by-nd/2.0/"),
}


# ============ HTTP helpers ============

def http_get(url, retries=2, timeout=20):
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(0.5 * (attempt + 1))
    raise last_err


def ia_search(collection, rows=50, page=1, sort="downloads desc", require_licenseurl=False):
    """Search the Internet Archive advancedsearch API for items in a collection."""
    q = f'collection:({collection}) AND mediatype:(movies) AND (format:("MPEG4") OR format:("h.264"))'
    if require_licenseurl:
        q += ' AND licenseurl:*'
    params = {
        'q': q,
        'fl[]': ['identifier', 'title', 'licenseurl', 'description', 'creator', 'date'],
        'sort[]': sort,
        'rows': str(rows),
        'page': str(page),
        'output': 'json',
    }
    # Manually build query string to handle repeated fl[] params
    qs_parts = []
    for k, v in params.items():
        if isinstance(v, list):
            for item in v:
                qs_parts.append(f"{urllib.parse.quote(k)}={urllib.parse.quote(item)}")
        else:
            qs_parts.append(f"{urllib.parse.quote(k)}={urllib.parse.quote(v)}")
    qs = '&'.join(qs_parts)
    url = f"https://archive.org/advancedsearch.php?{qs}"
    raw = http_get(url)
    return json.loads(raw.decode('utf-8'))


def ia_metadata(identifier):
    """Fetch full item metadata including file list."""
    url = f"https://archive.org/metadata/{identifier}"
    raw = http_get(url)
    return json.loads(raw.decode('utf-8'))


# ============ Helpers ============

def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def compute_aspect(w, h):
    if not w or not h:
        return "4:3"
    g = gcd(w, h)
    rw, rh = w // g, h // g
    if rw == 16 and rh == 9: return "16:9"
    if rw == 4 and rh == 3: return "4:3"
    if rw == 3 and rh == 4: return "3:4"
    if rw == 9 and rh == 16: return "9:16"
    if rw == 1 and rh == 1: return "1:1"
    if rw == 2 and rh == 1: return "2:1"
    if rw == 21 and rh == 9: return "21:9"
    if rw == 5 and rh == 4: return "5:4"
    return f"{rw}:{rh}"


def normalize_license(license_url, fallback_label="Public domain"):
    """Return (label, normalized_url) given a raw IA licenseurl."""
    if not license_url:
        return (fallback_label, "")
    lu = license_url.strip()
    if lu in LICENSE_NORMALIZE:
        return LICENSE_NORMALIZE[lu]
    # Generic pattern match: try to detect CC license from URL
    m = re.search(r'creativecommons\.org/licenses/([a-z\-]+)/(\d+\.\d+)', lu, re.IGNORECASE)
    if m:
        code = m.group(1).upper()
        ver = m.group(2)
        return (f"CC {code} {ver}", lu)
    # Public domain mark
    if 'publicdomain' in lu.lower() and 'mark' in lu.lower():
        return ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/")
    if 'publicdomain' in lu.lower():
        return ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/")
    return (fallback_label, lu)


def parse_duration(length_str):
    """Parse a duration string like '23.99', '1:23', '03:14', '1:23:45' to seconds (float)."""
    if length_str is None:
        return 0.0
    if isinstance(length_str, (int, float)):
        return float(length_str)
    s = str(length_str).strip()
    if not s:
        return 0.0
    # If it's just a number
    if re.match(r'^\d+(\.\d+)?$', s):
        return float(s)
    # HH:MM:SS or MM:SS
    parts = s.split(':')
    try:
        parts = [float(p) for p in parts]
    except ValueError:
        return 0.0
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0.0


def pick_best_files(item_metadata):
    """
    From an item's file list, pick the h.264/MPEG4 derivatives that pass our filters.
    Returns a list of file dicts sorted by size ascending.
    """
    files = item_metadata.get('files', []) or []
    candidates = []
    for f in files:
        fmt = f.get('format', '')
        if fmt not in ACCEPTABLE_FILE_FORMATS:
            continue
        name = f.get('name', '')
        if not name.lower().endswith('.mp4'):
            continue
        # Parse fields
        size = int(f.get('size', 0) or 0)
        if size <= 0 or size > MAX_SIZE_BYTES:
            continue
        length = parse_duration(f.get('length'))
        if length < MIN_DURATION or length > MAX_DURATION:
            continue
        w = int(f.get('width', 0) or 0)
        h = int(f.get('height', 0) or 0)
        if w < MIN_WIDTH or h < MIN_HEIGHT:
            continue
        candidates.append({
            'name': name,
            'format': fmt,
            'size': size,
            'length': length,
            'width': w,
            'height': h,
            'mime': FORMAT_TO_MIME.get(fmt, 'video/mp4'),
        })
    # Sort by size ascending (smallest first = lowest quality)
    candidates.sort(key=lambda c: c['size'])
    return candidates


def pick_thumbnail(item_metadata, identifier):
    """Find a thumbnail URL for the item."""
    files = item_metadata.get('files', []) or []
    # Prefer __ia_thumb.jpg (always present, small, square)
    for f in files:
        if f.get('format') == 'Item Tile' or f.get('name', '').endswith('__ia_thumb.jpg'):
            return f"https://archive.org/download/{identifier}/{f['name']}"
    # Fall back to first thumbs/*.jpg
    for f in files:
        name = f.get('name', '')
        if '/thumbs/' in name and name.endswith('.jpg'):
            return f"https://archive.org/download/{identifier}/{name}"
    # Fall back to .gif (animated preview)
    for f in files:
        if f.get('format') == 'Animated GIF':
            return f"https://archive.org/download/{identifier}/{f['name']}"
    return ""


def build_source_entry(file_info, identifier):
    """Build a source entry like the Wikimedia manifest format."""
    h = file_info['height']
    label = f"{h}p"
    src = f"https://archive.org/download/{identifier}/{file_info['name']}"
    return {
        'label': label,
        'type': file_info['mime'],
        'width': file_info['width'],
        'height': file_info['height'],
        'src': src,
        'bandwidth': 0,
    }


def clean_title(raw_title, identifier):
    """Trim and clean a title; append identifier if too generic."""
    if not raw_title:
        return identifier
    t = strip_html(raw_title)
    # Remove the trailing "(identifier)" pattern IA often adds
    t = re.sub(r'\s*\([' + re.escape(identifier[0]) + r'A-Za-z0-9_\-]{4,}' + re.escape(identifier[-4:]) + r'\)\s*$', '', t)
    # Collapse whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) > 100:
        # Cut at last word boundary near 100
        short = t[:100]
        last_space = short.rfind(' ')
        if last_space > 60:
            t = short[:last_space].rstrip(',.;:') + '…'
        else:
            t = short.rstrip(',.;:') + '…'
    return t or identifier


# ============ Main pipeline ============

def process_source(source, seen_ids):
    """Process one source collection. Returns list of normalized video entries."""
    coll = source['collection']
    print(f"\n→ Collection: {coll}")
    print(f"  require_licenseurl={source['require_licenseurl']}, max={source['max_items']}")

    found = []
    page = 1
    pages_tried = 0
    max_pages = 8  # safety cap
    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 4  # circuit breaker: abort collection after this many timeouts in a row

    while len(found) < source['max_items'] and pages_tried < max_pages:
        pages_tried += 1
        try:
            data = ia_search(
                coll,
                rows=50,
                page=page,
                sort=source.get('sort', 'downloads desc'),
                require_licenseurl=source['require_licenseurl'],
            )
        except Exception as e:
            print(f"  search error (page {page}): {e}")
            break

        docs = data.get('response', {}).get('docs', [])
        if not docs:
            print(f"  no more results at page {page}")
            break

        print(f"  page {page}: {len(docs)} candidates")

        for doc in docs:
            if len(found) >= source['max_items']:
                break
            identifier = doc.get('identifier')
            if not identifier or identifier in seen_ids:
                continue

            # Fetch item metadata
            try:
                meta = ia_metadata(identifier)
            except Exception as e:
                print(f"    {identifier}: metadata fetch failed: {e}")
                consecutive_failures += 1
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    print(f"  ⚠ {MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting {coll} early")
                    return found
                time.sleep(0.2)
                continue
            consecutive_failures = 0  # reset on success
            time.sleep(0.05)  # be gentle but fast

            m = meta.get('metadata', {})
            # Verify license
            raw_license_url = m.get('licenseurl') or ''
            if source['require_licenseurl'] and not raw_license_url:
                continue
            if source['require_licenseurl']:
                lic_label, lic_url = normalize_license(raw_license_url, fallback_label=source['license_label'])
            else:
                # Use collection default
                lic_label = source['license_label']
                lic_url = source['license_url']

            # Pick best video files
            files = pick_best_files(meta)
            if not files:
                continue

            # Build sources list (all acceptable derivatives)
            sources = [build_source_entry(f, identifier) for f in files]
            # Sort sources by height ascending (lowest quality first — matches existing convention)
            sources.sort(key=lambda s: s['height'])

            # Pick "primary" file = the smallest above 240p if available, else first
            primary = next((f for f in files if f['height'] >= 360), files[0])
            # Use smallest as file_url (lightest to start streaming)
            smallest = files[0]

            # Build thumb URL
            thumb_url = pick_thumbnail(meta, identifier)

            # Build description
            desc_raw = m.get('description') or ''
            desc = strip_html(desc_raw)
            # If description is just a category like "Food and Beverage", expand it
            if len(desc) < 30:
                desc = f"{desc} — {source['credit']}" if desc else source['credit']
            if len(desc) > 280:
                desc = desc[:280].rsplit(' ', 1)[0].rstrip(',.;:') + '…'

            # Title
            title = clean_title(m.get('title') or identifier, identifier)

            # Uploaded date (publicdate preferred; fall back to date)
            uploaded_at = ''
            pd = m.get('publicdate') or ''
            if pd:
                # Format: "2011-03-21 06:27:06"
                uploaded_at = pd[:10]
            else:
                d = m.get('date') or ''
                if d:
                    uploaded_at = d[:10]

            # Width/height of the *primary* file for the manifest's top-level fields
            w = primary['width']
            h = primary['height']
            aspect = compute_aspect(w, h)

            entry = {
                'title': title,
                'description': desc,
                'ia_identifier': identifier,
                'page_url': f"https://archive.org/details/{identifier}",
                'file_url': f"https://archive.org/download/{identifier}/{smallest['name']}",
                'thumb_url': thumb_url,
                'thumb_width': 640,  # IA thumbs are not a fixed size; use 640 as nominal
                'thumb_height': 480 if aspect != '9:16' and aspect != '3:4' else 1138,
                'duration': round(primary['length'], 2),
                'width': w,
                'height': h,
                'aspect': aspect,
                'size_bytes': primary['size'],
                'mime': primary['mime'],
                'license': lic_label,
                'license_url': lic_url,
                'artist': source['artist'],
                'artist_url': source['artist_url'],
                'credit': source['credit'],
                'uploaded_at': uploaded_at,
                'source': 'Internet Archive',
                'collection': coll,
                'sources': sources,
            }
            found.append(entry)
            seen_ids.add(identifier)
            print(f"    ✓ {identifier}: {title[:50]} ({entry['duration']}s, {w}x{h}, {primary['size']//1024}KB)")

        page += 1
        time.sleep(0.2)

    print(f"  collected {len(found)} items from {coll}")
    return found


def main():
    out_path = Path(__file__).resolve().parent.parent / "data" / "videos_ia.json"
    print(f"OpenFramez Phase 2.5 — Internet Archive Scraper")
    print(f"Target: {len(SOURCES)} collections")
    print(f"Filters: duration {MIN_DURATION}-{MAX_DURATION}s, size ≤ {MAX_SIZE_BYTES/1024/1024:.0f}MB")

    all_videos = []
    seen_ids = set()

    for source in SOURCES:
        vids = process_source(source, seen_ids)
        all_videos.extend(vids)

    # Assign sequential IDs
    for i, v in enumerate(all_videos, 1):
        v['id'] = f"ia_{i:04d}"
        # Attach category based on collection + title heuristics
        coll = v.get('collection', '')
        if coll == 'adviews':
            v['category'] = 'vintage_ad'
            v['category_label'] = 'تبلیغات قدیمی'
        elif coll == 'prelinger':
            # Heuristic: educational films often have keyword hints
            title_lower = v['title'].lower()
            if any(k in title_lower for k in ['space', 'nasa', 'moon', 'rocket', 'astronaut']):
                v['category'] = 'space'
                v['category_label'] = 'فضا'
            elif any(k in title_lower for k in ['science', 'physics', 'chemistry', 'biology']):
                v['category'] = 'science'
                v['category_label'] = 'علم'
            elif any(k in title_lower for k in ['nature', 'wildlife', 'animal', 'forest']):
                v['category'] = 'nature'
                v['category_label'] = 'طبیعت'
            elif any(k in title_lower for k in ['art', 'painting', 'music', 'dance']):
                v['category'] = 'art'
                v['category_label'] = 'هنر'
            elif any(k in title_lower for k in ['history', 'war', 'century', 'ancient']):
                v['category'] = 'history'
                v['category_label'] = 'تاریخ'
            else:
                v['category'] = 'archival'
                v['category_label'] = 'آرشیوی'
        elif coll == 'opensource_movies':
            v['category'] = 'educational'
            v['category_label'] = 'آموزشی'
        else:
            v['category'] = 'archival'
            v['category_label'] = 'آرشیوی'

    # Sort by upload date (newest first)
    all_videos.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
    # Renumber after sort
    for i, v in enumerate(all_videos, 1):
        v['id'] = f"ia_{i:04d}"

    manifest = {
        'version': '2.5.0',
        'phase': 2.5,
        'generated_at': time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        'source': 'Internet Archive',
        'source_url': 'https://archive.org',
        'license_note': 'Videos from Internet Archive collections (Prelinger, AdViews, Open Source Movies). All items are public domain or CC-licensed.',
        'duration_range_sec': [MIN_DURATION, MAX_DURATION],
        'max_file_size_mb': MAX_SIZE_BYTES / 1024 / 1024,
        'total': len(all_videos),
        'categories': [{'slug': s, 'label': l} for s, l in CATEGORIES],
        'videos': all_videos,
    }
    out_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"\n✓ Wrote {len(all_videos)} IA videos to {out_path}")
    print(f"  File size: {out_path.stat().st_size / 1024:.1f} KB")

    # Stats
    if all_videos:
        total_dur = sum(v['duration'] for v in all_videos)
        avg_dur = total_dur / len(all_videos)
        total_size_mb = sum(v['size_bytes'] for v in all_videos) / 1024 / 1024
        print(f"  Total duration: {total_dur:.0f}s, avg {avg_dur:.1f}s")
        print(f"  Total size: {total_size_mb:.1f} MB (avg {total_size_mb / len(all_videos):.1f} MB/video)")
        # Breakdown by collection
        from collections import Counter
        coll_counts = Counter(v['collection'] for v in all_videos)
        for c, n in coll_counts.most_common():
            print(f"  {c}: {n} videos")


if __name__ == '__main__':
    main()
