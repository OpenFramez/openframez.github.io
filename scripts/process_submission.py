#!/usr/bin/env python3
"""
Pixelary — Submission Processor

Reads YAML metadata from a GitHub issue body, validates it,
adds an entry to data/photos.json or data/videos.json,
and posts a comment on the issue with the result.

Triggered by .github/workflows/process-submission.yml when the
"approved" label is added to an issue.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ---------- Configuration ----------
REPO_OWNER = "betaversion488-oss"
REPO_NAME = "betaversion488-oss.github.io"
PHOTOS_JSON = Path("data/photos.json")
VIDEOS_JSON = Path("data/videos.json")

# Free licenses we accept (normalized: lowercase, alphanumeric only)
FREE_LICENSE_PATTERNS = [
    "publicdomain",
    "cc0",
    "ccbysa",
    "ccby",
    "gfdl",
    "pd",
]

# ---------- Helpers ----------
def log(msg):
    print(msg, flush=True)


def error(msg):
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)


def parse_yaml_block(body):
    """Extract the YAML metadata block from the issue body."""
    match = re.search(r"```yaml\s*\n(.*?)\n```", body, re.DOTALL)
    if not match:
        return None
    yaml_text = match.group(1)
    # Simple YAML parser (we control the format)
    data = {}
    for line in yaml_text.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        # Strip surrounding quotes
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1].replace('\\"', '"')
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
        # Try to convert to number
        if value.isdigit():
            value = int(value)
        elif re.match(r"^-?\d+\.\d+$", value):
            value = float(value)
        data[key] = value
    return data


def is_free_license(license_str):
    if not license_str:
        return False
    # Normalize: lowercase, alphanumeric only
    normalized = re.sub(r"[^a-z0-9]", "", license_str.lower())
    # Reject NC (NonCommercial) and ND (NoDerivatives) variants upfront
    if "nc" in normalized or "nd" in normalized:
        return False
    for pattern in FREE_LICENSE_PATTERNS:
        if pattern in normalized:
            return True
    return False


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def next_id(data, prefix):
    """Generate next ID like 'fu_0001' (fu = from user)."""
    max_num = 0
    for item in data.get("photos", []) if prefix == "fu" else data.get("videos", []):
        item_id = item.get("id", "")
        if item_id.startswith(prefix + "_"):
            try:
                num = int(item_id.split("_")[1])
                if num > max_num:
                    max_num = num
            except (IndexError, ValueError):
                pass
    return f"{prefix}_{max_num + 1:04d}"


def post_comment(issue_number, body):
    """Post a comment on the GitHub issue using GITHUB_TOKEN."""
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        error("No GH_TOKEN available, cannot post comment")
        return False
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues/{issue_number}/comments"
    payload = json.dumps({"body": body}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if 200 <= resp.status < 300:
                log(f"Posted comment on issue #{issue_number}")
                return True
            error(f"GitHub API returned {resp.status}")
    except Exception as e:
        error(f"Failed to post comment: {e}")
    return False


def close_issue(issue_number):
    """Close the GitHub issue."""
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        return False
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues/{issue_number}"
    payload = json.dumps({"state": "closed"}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        error(f"Failed to close issue: {e}")
        return False


# ---------- Main ----------
def main():
    issue_number = os.environ.get("ISSUE_NUMBER")
    issue_title = os.environ.get("ISSUE_TITLE", "")
    issue_body = os.environ.get("ISSUE_BODY", "")
    issue_author = os.environ.get("ISSUE_AUTHOR", "unknown")
    issue_url = os.environ.get("ISSUE_URL", "")

    if not issue_number:
        error("ISSUE_NUMBER not set")
        sys.exit(1)

    log(f"Processing submission issue #{issue_number}")
    log(f"  Title: {issue_title}")
    log(f"  Author: {issue_author}")

    # Parse YAML metadata
    data = parse_yaml_block(issue_body)
    if not data:
        msg = "❌ متادیتا YAML در issue یافت نشد. لطفاً مطمئن شوید که issue به‌صورت خودکار از صفحه آپلود ایجاد شده است."
        post_comment(issue_number, msg)
        error("No YAML block found in issue body")
        sys.exit(1)

    log(f"  Parsed metadata: {data}")

    # Validate required fields
    required = ["type", "title", "category", "license", "file_url", "mime_type", "size_bytes"]
    for field in required:
        if field not in data or not data[field]:
            msg = f"❌ فیلد موردنیاز `{field}` در متادیتا وجود ندارد."
            post_comment(issue_number, msg)
            error(f"Missing required field: {field}")
            sys.exit(1)

    # Validate type
    if data["type"] not in ("photo", "video"):
        msg = f"❌ نوع محتوا باید `photo` یا `video` باشد (دریافت‌شده: {data['type']})."
        post_comment(issue_number, msg)
        sys.exit(1)

    # Validate license
    if not is_free_license(data["license"]):
        msg = f"❌ مجوز `{data['license']}` قابل‌قبول نیست. فقط مجوزهای آزاد (CC0, CC BY, CC BY-SA, Public Domain) پذیرفته می‌شوند."
        post_comment(issue_number, msg)
        sys.exit(1)

    # Process based on type
    if data["type"] == "photo":
        success = process_photo(data, issue_author)
    else:
        success = process_video(data, issue_author)

    if success:
        # Success comment
        gallery_link = "https://betaversion488-oss.github.io/"
        msg = f"""✅ محتوای شما با موفقیت پردازش و به گالری اضافه شد!

| فیلد | مقدار |
|------|-------|
| نوع | {data['type']} |
| عنوان | {data['title']} |
| دسته | `{data['category']}` |
| مجوز | {data['license']} |
| نویسنده | {data.get('author', issue_author)} |

🔗 محتوای شما در گالری پیکسلری نمایش داده خواهد شد: {gallery_link}

این issue بسته می‌شود. در صورت نیاز به تغییر، می‌توانید issue جدیدی باز کنید."""
        post_comment(issue_number, msg)
        close_issue(issue_number)
        log(f"Successfully processed submission #{issue_number}")
    else:
        error(f"Failed to process submission #{issue_number}")
        sys.exit(1)


def process_photo(data, issue_author):
    """Add entry to data/photos.json."""
    if not PHOTOS_JSON.exists():
        error(f"{PHOTOS_JSON} not found")
        return False

    photos_data = load_json(PHOTOS_JSON)
    new_id = next_id(photos_data, "fu")

    # Determine category label
    cat_label_map = {
        "nature": "Nature & Landscapes",
        "architecture": "Architecture",
        "wildlife": "Wildlife & Animals",
        "space": "Space & Astronomy",
        "food": "Food & Drink",
        "travel": "Travel & Cities",
        "art": "Art & Paintings",
        "sports": "Sports & Action",
        "people": "People",
        "technology": "Technology",
    }
    category = data["category"]
    cat_label = cat_label_map.get(category, category.title())

    # Compute thumbnail dimensions (max 800px on longest side)
    width = int(data.get("width", 0))
    height = int(data.get("height", 0))
    if width and height:
        if width >= height:
            thumb_width = 800
            thumb_height = round(800 * height / width)
        else:
            thumb_height = 800
            thumb_width = round(800 * width / height)
    else:
        thumb_width = 800
        thumb_height = 600

    license_url = ""
    lic = data["license"].lower().replace(" ", "")
    if lic.startswith("ccby4.0") or lic == "ccby4.0":
        license_url = "https://creativecommons.org/licenses/by/4.0/"
    elif lic.startswith("ccbysa4.0") or lic == "ccbysa4.0":
        license_url = "https://creativecommons.org/licenses/by-sa/4.0/"
    elif lic == "cc0":
        license_url = "https://creativecommons.org/publicdomain/zero/1.0/"

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    entry = {
        "id": new_id,
        "title": data["title"],
        "description": data.get("description", ""),
        "category": category,
        "category_label": cat_label,
        "thumbnail": data["file_url"],
        "full": data["file_url"],
        "width": width,
        "height": height,
        "thumb_width": thumb_width,
        "thumb_height": thumb_height,
        "license": data["license"],
        "license_url": license_url,
        "author": data.get("author", issue_author),
        "author_url": "",
        "source": "User submission via Pixelary upload",
        "uploaded_at": today,
        "commons_page": "",
        "submission_source": "user",
        "submission_issue": f"#{os.environ.get('ISSUE_NUMBER', '')}",
    }

    photos_data["photos"].append(entry)
    photos_data["total"] = len(photos_data["photos"])
    photos_data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Update categories list if category is new
    existing_cats = {c["slug"] for c in photos_data.get("categories", [])}
    if category not in existing_cats:
        photos_data.setdefault("categories", []).append({
            "slug": category,
            "label": cat_label,
        })

    save_json(PHOTOS_JSON, photos_data)
    log(f"Added photo {new_id} to {PHOTOS_JSON}")
    return True


def process_video(data, issue_author):
    """Add entry to data/videos.json."""
    if not VIDEOS_JSON.exists():
        error(f"{VIDEOS_JSON} not found")
        return False

    videos_data = load_json(VIDEOS_JSON)
    new_id = next_id(videos_data, "fu")

    cat_label_map = {
        "music": "موسیقی",
        "science": "علم",
        "space": "فضا",
        "biology": "زیست‌شناسی",
        "nature": "طبیعت",
        "animation": "انیمیشن",
        "timelapse": "تایم‌لپس",
        "experiment": "آزمایش",
        "history": "تاریخ",
        "vintage_ad": "تبلیغات قدیمی",
    }
    category = data["category"]
    cat_label = cat_label_map.get(category, category)

    width = int(data.get("width", 0))
    height = int(data.get("height", 0))
    duration = float(data.get("duration", 0))

    # Compute aspect ratio
    if width and height:
        from math import gcd
        g = gcd(width, height)
        aspect = f"{width // g}:{height // g}"
    else:
        aspect = "16:9"

    license_url = ""
    lic = data["license"].lower().replace(" ", "")
    if lic.startswith("ccby4.0") or lic == "ccby4.0":
        license_url = "https://creativecommons.org/licenses/by/4.0/"
    elif lic.startswith("ccbysa4.0") or lic == "ccbysa4.0":
        license_url = "https://creativecommons.org/licenses/by-sa/4.0/"
    elif lic == "cc0":
        license_url = "https://creativecommons.org/publicdomain/zero/1.0/"

    mime_type = data["mime_type"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    entry = {
        "id": new_id,
        "title": data["title"],
        "description": data.get("description", ""),
        "commons_title": "",
        "page_url": "",
        "file_url": data["file_url"],
        "thumb_url": "",  # No thumbnail for user uploads (could be generated)
        "thumb_width": 0,
        "thumb_height": 0,
        "duration": duration,
        "width": width,
        "height": height,
        "aspect": aspect,
        "size_bytes": int(data["size_bytes"]),
        "mime": mime_type,
        "license": data["license"],
        "license_url": license_url,
        "artist": data.get("author", issue_author),
        "artist_url": "",
        "credit": "User submission via Pixelary upload",
        "uploaded_at": today,
        "category": category,
        "category_label": cat_label,
        "sources": [
            {
                "label": "original",
                "type": mime_type,
                "width": width,
                "height": height,
                "src": data["file_url"],
            }
        ],
        "submission_source": "user",
        "submission_issue": f"#{os.environ.get('ISSUE_NUMBER', '')}",
    }

    videos_data["videos"].append(entry)
    videos_data["total"] = len(videos_data["videos"])
    videos_data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Update categories list if category is new
    existing_cats = {c["slug"] for c in videos_data.get("categories", [])}
    if category not in existing_cats:
        videos_data.setdefault("categories", []).append({
            "slug": category,
            "label": cat_label,
        })

    save_json(VIDEOS_JSON, videos_data)
    log(f"Added video {new_id} to {VIDEOS_JSON}")
    return True


if __name__ == "__main__":
    main()
