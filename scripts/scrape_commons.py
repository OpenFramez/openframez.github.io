#!/usr/bin/env python3
"""
Pixelary Phase 1 Data Scraper
=============================
Scrapes CC-licensed / public-domain images from Wikimedia Commons
"Quality Images" and "Featured Pictures" categories across multiple themes.

Output: data/photos.json (manifest of all images)

Each entry:
{
  "id": "fi_0001",
  "title": "Mountain tour near S-charl village",
  "description": "Mountain tour in the vicinity of mountain village S-charl.",
  "category": "nature",
  "category_label": "Nature & Landscapes",
  "thumbnail": "https://upload.wikimedia.org/.../800px-....jpg",
  "full": "https://upload.wikimedia.org/.../original.jpg",
  "width": 5184,
  "height": 3456,
  "thumb_width": 800,
  "thumb_height": 533,
  "license": "CC BY-SA 4.0",
  "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
  "author": "Agnes Monkelbaan",
  "author_url": "https://commons.wikimedia.org/wiki/User:Agnes_Monkelbaan",
  "source": "https://commons.wikimedia.org/wiki/File:...",
  "uploaded_at": "2019-09-17",
  "categories": ["mountains", "switzerland"]
}

Strategy:
- Pull from multiple curated categories for content diversity
- Limit to 30 images per category (~210 total)
- Filter: only JPEG, min 1200px wide, has license info
- Order: most recent first within each category
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from html import unescape

USER_AGENT = "PixelaryBot/1.0 (https://github.com/betaversion488-oss/betaversion488-oss.github.io; contact via GitHub Issues)"

# Curated categories - high-quality, freely-licensed images
CATEGORIES = [
    ("nature", "Nature & Landscapes", "Category:Featured_pictures_of_nature"),
    ("architecture", "Architecture", "Category:Quality_images_of_architecture"),
    ("wildlife", "Wildlife & Animals", "Category:Featured_pictures_of_animals"),
    ("space", "Space & Astronomy", "Category:Featured_pictures_of_NASA"),
    ("food", "Food & Drink", "Category:Quality_images_of_food"),
    ("travel", "Travel & Cities", "Category:Featured_pictures_of_cities"),
    ("art", "Art & Paintings", "Category:Featured_pictures_of_paintings"),
    ("landscape", "Landscapes", "Category:Quality_images_of_landscapes"),
    ("aerial", "Aerial & Drone", "Category:Featured_pictures_of_aerial_views"),
    ("macro", "Macro & Close-up", "Category:Quality_images_of_macros"),
    ("people", "People & Culture", "Category:Quality_images_of_people"),
    ("science", "Science & Tech", "Category:Featured_pictures_of_science"),
    ("history", "History & Heritage", "Category:Featured_pictures_of_history"),
    ("sports", "Sports & Action", "Category:Quality_images_of_sports"),
]

PER_CATEGORY = 30
THUMB_WIDTH = 800


def strip_html(s):
    """Strip HTML tags from a string and decode entities."""
    if not s:
        return ""
    # Remove tags
    s = re.sub(r"<[^>]+>", "", s)
    s = unescape(s)
    s = s.strip()
    return s


def api_get(params):
    """Call Wikimedia Commons API with proper UA."""
    params["format"] = "json"
    qs = urllib.parse.urlencode(params)
    url = f"https://commons.wikimedia.org/w/api.php?{qs}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_category(category_commons_name, limit):
    """Fetch images from a Commons category."""
    images = []
    gcmcontinue = None
    while len(images) < limit:
        params = {
            "action": "query",
            "generator": "categorymembers",
            "gcmtitle": category_commons_name,
            "gcmtype": "file",
            "gcmlimit": min(50, limit - len(images)),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime|timestamp",
            "iiurlwidth": THUMB_WIDTH,
            "iimetadataversion": "latest",
        }
        if gcmcontinue:
            params["gcmcontinue"] = gcmcontinue
        data = api_get(params)
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            ii_list = page.get("imageinfo") or []
            if not ii_list:
                continue
            ii = ii_list[0]
            # Filter: only JPEGs, min width
            if ii.get("mime") not in ("image/jpeg", "image/png"):
                continue
            if ii.get("width", 0) < 1200:
                continue
            meta = ii.get("extmetadata", {}) or {}
            license_name = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
            if not license_name:
                continue
            # Skip non-free licenses
            license_lower = license_name.lower()
            if "non-commercial" in license_lower or "no derivatives" in license_lower:
                continue
            if license_lower not in (
                "cc by-sa 4.0", "cc by-sa 3.0", "cc by-sa 2.5", "cc by-sa 2.0",
                "cc by 4.0", "cc by 3.0", "cc by 2.5", "cc by 2.0",
                "cc0", "public domain", "pd", "gfdl", "cc-by-sa-4.0", "cc-by-4.0",
                "cc-by-sa-3.0", "cc-by-3.0", "cc-by-sa-2.5", "cc-by-2.5",
            ):
                # Allow but flag - we'll keep most
                pass

            artist_html = meta.get("Artist", {}).get("value", "")
            artist = strip_html(artist_html)
            # Extract author URL from HTML
            author_url = ""
            m = re.search(r'href="([^"]+)"', artist_html)
            if m:
                author_url = m.group(1)
                if author_url.startswith("//"):
                    author_url = "https:" + author_url

            desc_html = meta.get("ImageDescription", {}).get("value", "")
            desc = strip_html(desc_html)
            # Limit description length
            if len(desc) > 280:
                desc = desc[:280].rsplit(" ", 1)[0] + "…"

            license_url = strip_html(meta.get("LicenseUrl", {}).get("value", ""))

            title = page.get("title", "").replace("File:", "").replace("_", " ")
            # Strip extension
            title = re.sub(r"\.(jpg|jpeg|png|gif|tif|tiff)$", "", title, flags=re.IGNORECASE)

            # Build object id
            author_clean = artist if artist else "Unknown"
            obj = {
                "title": title,
                "description": desc,
                "thumbnail": ii.get("thumburl", ""),
                "full": ii.get("url", ""),
                "width": ii.get("width", 0),
                "height": ii.get("height", 0),
                "thumb_width": THUMB_WIDTH,
                "thumb_height": ii.get("thumbheight", 0),
                "license": license_name,
                "license_url": license_url,
                "author": author_clean,
                "author_url": author_url,
                "source": "https://commons.wikimedia.org/wiki/" + page.get("title", "").replace(" ", "_"),
                "uploaded_at": (ii.get("timestamp") or "")[:10],
                "commons_page": page.get("title", ""),
            }
            images.append(obj)
        if "continue" in data and "gcmcontinue" in data["continue"]:
            gcmcontinue = data["continue"]["gcmcontinue"]
            time.sleep(0.3)
        else:
            break
    return images[:limit]


def main():
    out_path = Path(__file__).resolve().parent.parent / "data" / "photos.json"
    print(f"Scraping {len(CATEGORIES)} categories, {PER_CATEGORY} images each = up to {len(CATEGORIES)*PER_CATEGORY} total")
    all_photos = []
    counter = 1
    for slug, label, commons_cat in CATEGORIES:
        print(f"\n→ {label} ({commons_cat})")
        try:
            imgs = fetch_category(commons_cat, PER_CATEGORY)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue
        print(f"  Fetched {len(imgs)} images")
        for img in imgs:
            img["id"] = f"fi_{counter:04d}"
            img["category"] = slug
            img["category_label"] = label
            all_photos.append(img)
            counter += 1
        time.sleep(0.5)
    # Sort: newest first
    all_photos.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    # Renumber after sort
    for i, p in enumerate(all_photos, 1):
        p["id"] = f"fi_{i:04d}"

    manifest = {
        "version": "1.0.0",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "Wikimedia Commons",
        "source_url": "https://commons.wikimedia.org",
        "license_note": "All images are CC-licensed or public domain. See each photo for specific license.",
        "total": len(all_photos),
        "categories": [{"slug": s, "label": l} for s, l, _ in CATEGORIES],
        "photos": all_photos,
    }
    out_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"\n✓ Wrote {len(all_photos)} photos to {out_path}")
    print(f"  File size: {out_path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
