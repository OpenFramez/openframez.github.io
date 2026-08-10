#!/usr/bin/env python3
"""
Pixelary Phase 2 Data Scraper — Videos
======================================
Scrapes CC-licensed / public-domain SHORT videos (2-30 seconds) from Wikimedia Commons
across multiple topical search queries for content diversity.

Output: data/videos.json (manifest of all videos)

Each entry:
{
  "id": "fv_0001",
  "title": "Annie Oakley shooting glass balls, 1894",
  "description": "Short film of Annie Oakley ...",
  "category": "history",
  "category_label": "History",
  "page_url": "https://commons.wikimedia.org/wiki/File:...",
  "file_url": "https://upload.wikimedia.org/.../original.ogv",
  "thumb_url": "https://upload.wikimedia.org/.../640px-....jpg",
  "thumb_width": 640,
  "thumb_height": 480,
  "duration": 24.19,
  "width": 320,
  "height": 240,
  "aspect": "4:3",
  "size_bytes": 2850009,
  "sources": [
    {"label": "240p", "type": "video/webm; codecs=\"vp9, opus\"", "width": 320, "height": 240, "src": "...", "bandwidth": 229456},
    ...
  ],
  "license": "Public domain",
  "license_url": "...",
  "artist": "William Heise",
  "artist_url": "...",
  "credit": "...",
  "uploaded_at": "2008-01-15T..."
}

Strategy:
- Use search API: generator=search with gsrsearch=filetype:video duration:2-30 <topic>
- Wikimedia auto-transcodes to multiple quality tiers (240p/360p/480p/720p vp9.webm)
- Filter: only free licenses (CC BY*, CC BY-SA*, CC0, Public domain, GFDL)
- Filter: file size under 60MB (avoid huge files)
- Filter: duration 2-30 seconds (Phase 2 spec)
- Filter: width >= 240, height >= 180 (skip tiny clips)
- Use videoinfo API to get derivatives (multi-quality sources)
- Limit ~10-15 videos per topic for ~120 total
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from html import unescape

USER_AGENT = "PixelaryBot/2.0 (https://github.com/betaversion488-oss/betaversion488-oss.github.io; contact via GitHub Issues)"

# Topic-driven search queries. Wikimedia Commons search syntax:
#   filetype:video        restrict to video files
#   duration:2-30         duration range in seconds (strict — most short videos are 2-30s)
# Note: multi-word queries require ALL words; use single strong keyword per topic.
TOPICS = [
    ("instrument", "ساز موسیقی", "instrument"),  # 50+ results
    ("science",    "علم",        "science"),     # 46
    ("space",      "فضا",        "space"),       # 20
    ("biology",    "زیست‌شناسی", "biology"),     # 16
    ("telescope",  "تلسکوپ",     "telescope"),   # 15
    ("timelapse",  "تایم‌لپس",   "time-lapse"),  # 14
    ("nature",     "طبیعت",      "nature"),      # 8
    ("surface",    "سطح",        "surface"),     # 8
    ("design",     "طراحی",      "design"),      # 7
    ("experiment", "آزمایش",     "experiment"),  # 6
    ("animation",  "انیمیشن",    "animation"),   # 6
    ("history",    "تاریخ",      "history"),     # 5
    ("physics",    "فیزیک",      "physics"),     # 4
    ("art",        "هنر",        "art"),         # 4
    ("landscape",  "منظره",      "landscape"),   # 3
    ("wave",       "موج",        "wave"),        # 3
]

PER_TOPIC = 10  # ~10 per topic × 16 topics = up to 160 videos
MIN_DURATION = 2.0
MAX_DURATION = 30.0
MIN_WIDTH = 240
MIN_HEIGHT = 180
MAX_SIZE_BYTES = 60 * 1024 * 1024  # 60 MB cap
THUMB_WIDTH = 640

ALLOWED_LICENSES_LOWER = {
    "cc by-sa 4.0", "cc by-sa 3.0", "cc by-sa 2.5", "cc by-sa 2.0",
    "cc by 4.0", "cc by 3.0", "cc by 2.5", "cc by 2.0",
    "cc0", "public domain", "pd", "gfdl",
    "cc-by-sa-4.0", "cc-by-sa-3.0", "cc-by-sa-2.5", "cc-by-sa-2.0",
    "cc-by-4.0", "cc-by-3.0", "cc-by-2.5", "cc-by-2.0",
    "attribution", "cc-by-sa", "cc-by", "cc pd", "pd-self", "pd-old",
    "pd-usgov", "pd-nasa", "cc-by-sa-3.0,2.5,2.0,1.0",
}


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", "", s)
    s = unescape(s)
    s = s.strip()
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s)
    return s


def api_get(params, retries=3):
    """Call Wikimedia Commons API with proper UA + retry on transient failures."""
    params["format"] = "json"
    qs = urllib.parse.urlencode(params)
    url = f"https://commons.wikimedia.org/w/api.php?{qs}"
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                sleep_s = 1.5 * (attempt + 1)
                time.sleep(sleep_s)
    raise last_err


def strip_utm(url):
    """Strip ?utm_* tracking params from a URL (cleaner, more cacheable)."""
    if not url:
        return url
    return url.split("?")[0]


def parse_artist(artist_html):
    """Return (artist_text, artist_url)."""
    if not artist_html:
        return ("", "")
    artist_url = ""
    m = re.search(r'href="([^"]+)"', artist_html)
    if m:
        artist_url = m.group(1)
        if artist_url.startswith("//"):
            artist_url = "https:" + artist_url
    text = strip_html(artist_html)
    # Truncate long author strings
    if len(text) > 120:
        text = text[:117].rstrip() + "…"
    return (text, artist_url)


def compute_aspect(w, h):
    """Return simplified aspect ratio string."""
    if not w or not h:
        return "16:9"
    # Common ratios
    g = _gcd(w, h)
    rw, rh = w // g, h // g
    # Simplify known patterns
    if rw == 16 and rh == 9: return "16:9"
    if rw == 4 and rh == 3: return "4:3"
    if rw == 3 and rh == 4: return "3:4"
    if rw == 9 and rh == 16: return "9:16"
    if rw == 1 and rh == 1: return "1:1"
    if rw == 2 and rh == 1: return "2:1"
    if rw == 21 and rh == 9: return "21:9"
    return f"{rw}:{rh}"


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def quality_label(transcodekey, width, height):
    """Build a human label like '240p' from transcode info."""
    if transcodekey:
        # E.g. "240p.vp9.webm" -> "240p"
        m = re.match(r"(\d+)p", transcodekey)
        if m:
            return m.group(1) + "p"
    if height:
        return f"{height}p"
    return "src"


def build_source_entry(d):
    """Build a normalized source entry from a derivative."""
    transcodekey = d.get("transcodekey", "")
    label = quality_label(transcodekey, d.get("width"), d.get("height"))
    src = strip_utm(d.get("src", ""))
    mime = d.get("type", "video/webm")
    return {
        "label": label,
        "type": mime,
        "width": d.get("width", 0),
        "height": d.get("height", 0),
        "src": src,
        "bandwidth": d.get("bandwidth", 0),
    }


def fetch_videoinfo(title):
    """Fetch detailed videoinfo (derivatives, transcodes) for a single file."""
    params = {
        "action": "query",
        "titles": title,
        "prop": "videoinfo",
        "viprop": "derivatives|url|size|mime|metadata|extmetadata|timestamp",
        "viurlwidth": THUMB_WIDTH,
    }
    data = api_get(params)
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None
    # Get first page
    page = next(iter(pages.values()))
    vi_list = page.get("videoinfo") or []
    if not vi_list:
        return None
    return vi_list[0]


def search_topic(topic_keywords, limit):
    """Search Wikimedia for short videos matching keywords."""
    found = []
    # Build search query
    srsearch = f"filetype:video duration:{int(MIN_DURATION)}-{int(MAX_DURATION)} {topic_keywords}"
    gsroffset = 0
    seen_titles = set()

    while len(found) < limit and gsroffset < 200:
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": srsearch,
            "gsrnamespace": 6,  # File namespace
            "gsrlimit": min(50, 50),
            "gsroffset": gsroffset,
            "prop": "imageinfo",
            "iiprop": "url|mime|size|extmetadata|mediatype|timestamp",
            "iiurlwidth": THUMB_WIDTH,
        }
        try:
            data = api_get(params)
        except Exception as e:
            print(f"  API error: {e}")
            break

        pages = data.get("query", {}).get("pages", {})
        if not pages:
            break

        for page in pages.values():
            title = page.get("title", "")
            if title in seen_titles:
                continue
            seen_titles.add(title)
            ii_list = page.get("imageinfo") or []
            if not ii_list:
                continue
            ii = ii_list[0]
            # Must be a video
            if ii.get("mediatype") not in ("VIDEO", "MULTIMEDIA"):
                continue
            mime = ii.get("mime", "")
            # Accept webm (modern), video/ogg + application/ogg (legacy Theora),
            # and mp4 (Safari-friendly transcodes)
            if mime not in ("video/webm", "video/ogg", "video/mp4", "application/ogg"):
                continue

            # Duration / size / dimension filters
            duration = float(ii.get("duration", 0))
            if duration < MIN_DURATION or duration > MAX_DURATION:
                continue
            size = int(ii.get("size", 0))
            if size > MAX_SIZE_BYTES:
                continue
            w = int(ii.get("width", 0))
            h = int(ii.get("height", 0))
            if w < MIN_WIDTH or h < MIN_HEIGHT:
                continue

            # License filter
            meta = ii.get("extmetadata", {}) or {}
            license_name = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
            if not license_name:
                continue
            license_lower = license_name.lower().strip()
            # Normalize: strip spaces and dashes (so "CC BY-SA 4.0" -> "ccbysa4.0")
            normalized = re.sub(r"[^a-z0-9]", "", license_lower)
            # Reject NC/ND restrictions
            if "noncommercial" in license_lower or "noderivs" in license_lower or "nc" in normalized.split():
                continue
            # Accept if normalized form starts with a known free-license prefix
            is_free = (
                license_lower in ALLOWED_LICENSES_LOWER
                or normalized.startswith("ccbysa")
                or normalized.startswith("ccby")
                or normalized.startswith("cc0")
                or normalized.startswith("publicdomain")
                or normalized.startswith("pd")
                or normalized.startswith("gfdl")
                or normalized.startswith("attribution")
            )
            if not is_free:
                continue

            # Parse artist
            artist_html = meta.get("Artist", {}).get("value", "")
            artist, artist_url = parse_artist(artist_html)
            if not artist:
                artist = "ناشناس"

            # Parse description
            desc_html = meta.get("ImageDescription", {}).get("value", "")
            desc = strip_html(desc_html)
            if len(desc) > 280:
                # Cut at word boundary near 280
                desc = desc[:280].rsplit(" ", 1)[0].rstrip(",.;:") + "…"

            # License URL
            license_url = strip_html(meta.get("LicenseUrl", {}).get("value", ""))

            # Credit
            credit_html = meta.get("Credit", {}).get("value", "")
            credit = strip_html(credit_html)
            if len(credit) > 200:
                credit = credit[:197].rstrip() + "…"

            # Title cleanup
            clean_title = title.replace("File:", "").replace("_", " ")
            clean_title = re.sub(r"\.(webm|ogv|ogg|mp4|mov)$", "", clean_title, flags=re.IGNORECASE)
            # If title is super long, try to cut at a sensible boundary (comma, dash, or last full word)
            if len(clean_title) > 100:
                # Try to cut at the last comma/dash within the first 100 chars
                short = clean_title[:100]
                # Find last separator before pos 100
                last_sep = max(short.rfind(", "), short.rfind(" - "), short.rfind(" ("))
                if last_sep > 40:
                    clean_title = short[:last_sep].rstrip(", ") + "…"
                else:
                    # Cut at last word boundary
                    clean_title = short.rsplit(" ", 1)[0].rstrip(",.;:") + "…"

            obj = {
                "title": clean_title,
                "description": desc or clean_title,
                "commons_title": title,
                "page_url": "https://commons.wikimedia.org/wiki/" + title.replace(" ", "_"),
                "file_url": strip_utm(ii.get("url", "")),
                "thumb_url": strip_utm(ii.get("thumburl", "")),
                "thumb_width": THUMB_WIDTH,
                "thumb_height": ii.get("thumbheight", 0),
                "duration": round(duration, 2),
                "width": w,
                "height": h,
                "aspect": compute_aspect(w, h),
                "size_bytes": size,
                "mime": mime,
                "license": license_name,
                "license_url": license_url,
                "artist": artist,
                "artist_url": artist_url,
                "credit": credit,
                "uploaded_at": (ii.get("timestamp") or "")[:10],
                "_need_derivatives": True,  # marker to fetch later
            }
            found.append(obj)
            if len(found) >= limit:
                break

        # Pagination
        cont = data.get("continue", {})
        new_offset = cont.get("gsroffset")
        if not new_offset or int(new_offset) <= gsroffset:
            break
        gsroffset = int(new_offset)
        time.sleep(0.3)

    return found[:limit]


def fetch_derivatives(video):
    """Fetch multi-quality transcoded sources for a single video."""
    try:
        vi = fetch_videoinfo(video["commons_title"])
        if not vi:
            return
        # Derivatives array (includes original as first entry)
        derivs = vi.get("derivatives", []) or []
        sources = []
        seen_labels = set()
        # Prefer webm (vp9) over others for browser compat
        # Sort by bandwidth ascending
        derivs_sorted = sorted(derivs, key=lambda d: d.get("bandwidth", 0))
        for d in derivs_sorted:
            mime = d.get("type", "")
            # Skip non-webm transcodes (h.264 mov sometimes broken on Safari)
            # Actually keep mp4 for Safari compatibility; drop only .mov (quicktime)
            if "quicktime" in mime or ".mov" in d.get("src", ""):
                continue
            entry = build_source_entry(d)
            if entry["label"] in seen_labels:
                continue
            seen_labels.add(entry["label"])
            sources.append(entry)
        # Make sure we have at least one source — fallback to original
        if not sources and video["file_url"]:
            sources.append({
                "label": quality_label(None, video["width"], video["height"]),
                "type": video["mime"] or "video/webm",
                "width": video["width"],
                "height": video["height"],
                "src": video["file_url"],
                "bandwidth": 0,
            })
        # Sort by quality (height) ascending for the quality selector UI
        sources.sort(key=lambda s: s["height"] or 0)
        video["sources"] = sources
        # Update thumb_url if we got a better one
        if vi.get("thumburl") and not video.get("thumb_url"):
            video["thumb_url"] = vi["thumburl"]
    except Exception as e:
        print(f"    derivatives fetch error: {e}")
        # Fallback to original as sole source
        video["sources"] = [{
            "label": quality_label(None, video["width"], video["height"]),
            "type": video["mime"] or "video/webm",
            "width": video["width"],
            "height": video["height"],
            "src": video["file_url"],
            "bandwidth": 0,
        }]


def main():
    out_path = Path(__file__).resolve().parent.parent / "data" / "videos.json"
    print(f"Phase 2: scraping short videos ({MIN_DURATION}-{MAX_DURATION}s) from Wikimedia Commons")
    print(f"Topics: {len(TOPICS)}, target per topic: {PER_TOPIC}")
    print(f"Max file size: {MAX_SIZE_BYTES / 1024 / 1024:.0f} MB")
    print()

    all_videos = []
    counter = 1
    for slug, label_fa, keywords in TOPICS:
        print(f"→ {slug} ({keywords})")
        vids = []
        # Try up to 2 attempts per topic in case of transient API failures
        for attempt in range(2):
            try:
                vids = search_topic(keywords, PER_TOPIC)
                if vids:
                    break
                if attempt == 0:
                    print(f"  (no results, retrying in 2s…)")
                    time.sleep(2)
            except Exception as e:
                print(f"  ERROR (attempt {attempt+1}): {e}")
                time.sleep(2)
        if not vids:
            print(f"  Found 0 candidates (skipping)")
            continue
        print(f"  Found {len(vids)} candidates, fetching transcodes…")
        for v in vids:
            v["id"] = f"fv_{counter:04d}"
            v["category"] = slug
            v["category_label"] = label_fa
            counter += 1
            # Fetch multi-quality sources
            fetch_derivatives(v)
            v.pop("_need_derivatives", None)
            all_videos.append(v)
            time.sleep(0.15)  # gentle on API
        time.sleep(1.0)  # pause between topics

    # Sort by upload date (newest first)
    all_videos.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    # Renumber after sort
    for i, v in enumerate(all_videos, 1):
        v["id"] = f"fv_{i:04d}"

    # Build manifest
    manifest = {
        "version": "2.0.0",
        "phase": 2,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "Wikimedia Commons",
        "source_url": "https://commons.wikimedia.org",
        "license_note": "All videos are CC-licensed or public domain. See each video for specific license.",
        "duration_range_sec": [MIN_DURATION, MAX_DURATION],
        "max_file_size_mb": MAX_SIZE_BYTES / 1024 / 1024,
        "total": len(all_videos),
        "categories": [{"slug": s, "label": l} for s, l, _ in TOPICS],
        "videos": all_videos,
    }
    out_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"\n✓ Wrote {len(all_videos)} videos to {out_path}")
    print(f"  File size: {out_path.stat().st_size / 1024:.1f} KB")
    # Quick stats
    total_dur = sum(v["duration"] for v in all_videos)
    avg_dur = total_dur / len(all_videos) if all_videos else 0
    total_size_mb = sum(v["size_bytes"] for v in all_videos) / 1024 / 1024
    print(f"  Total duration: {total_dur:.0f}s, avg {avg_dur:.1f}s")
    print(f"  Total size: {total_size_mb:.1f} MB (avg {total_size_mb / max(len(all_videos),1):.1f} MB/video)")


if __name__ == "__main__":
    main()
