#!/usr/bin/env python3
"""Fetch category-level stock photos from the Pexels API into server/data/category-images.json.

Needs the PEXELS_API_KEY environment variable (never pass it on the command line, never commit it).
Standard library only. Pexels allows 200 requests/hour and 20,000/month by default; this script
makes one request per search term (about 85 in total) and stops early if the remaining quota is low.

The photos are generic pictures for a category, NOT pictures of the specific product. The server
labels them as illustrative, and the website must show "Photos provided by Pexels" with a link, and
credit photographers where it can (Pexels API guidelines).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API_URL = "https://api.pexels.com/v1/search"
HERE = os.path.dirname(os.path.abspath(__file__))
QUERIES_PATH = os.path.join(HERE, "pexels_queries.json")
OUTPUT_PATH = os.path.join(HERE, "..", "data", "category-images.json")
PER_PAGE = 30
MAX_PER_CATEGORY = 60
MIN_REMAINING = 10  # stop before using the last requests of the hourly quota


class QuotaLow(Exception):
    pass


def http_get(url, headers):
    """Return (parsed_json, response_headers). Raises urllib errors on failure."""
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response), dict(response.headers)


def to_photo(raw):
    """Keep only the fields we need. Returns None if the photo lacks usable URLs."""
    src = raw.get("src") or {}
    large, thumb = src.get("large2x") or src.get("large"), src.get("medium") or src.get("small")
    if not (raw.get("id") and large and thumb and raw.get("url")):
        return None
    if not str(large).startswith("https://images.pexels.com/"):
        return None
    return {
        "id": raw["id"],
        "thumb": thumb,
        "large": large,
        "photographer": str(raw.get("photographer") or "").strip(),
        "photographerUrl": raw.get("photographer_url") or "",
        "pageUrl": raw["url"],
        "alt": str(raw.get("alt") or "").strip()[:200],
    }


def search(query, api_key, get=http_get):
    params = urllib.parse.urlencode({"query": query, "per_page": PER_PAGE, "orientation": "square"})
    data, headers = get(f"{API_URL}?{params}", {"Authorization": api_key, "User-Agent": "cartora-catalog/1.0"})
    remaining = {k.lower(): v for k, v in headers.items()}.get("x-ratelimit-remaining")
    if remaining is not None and str(remaining).isdigit() and int(remaining) < MIN_REMAINING:
        raise QuotaLow(f"only {remaining} Pexels requests left this hour")
    return [p for p in (to_photo(r) for r in data.get("photos", [])) if p]


def build(queries, api_key, get=http_get, pause=0.3):
    categories = {}
    for slug, terms in queries.items():
        seen, photos = set(), []
        for term in terms:
            for photo in search(term, api_key, get):
                if photo["id"] not in seen:
                    seen.add(photo["id"])
                    photos.append(photo)
            time.sleep(pause)
        if not photos:
            raise RuntimeError(f"No photos found for category '{slug}'")
        categories[slug] = photos[:MAX_PER_CATEGORY]
        print(f"{slug}: {len(categories[slug])} photos", file=sys.stderr)
    return {"source": "Pexels", "sourceUrl": "https://www.pexels.com", "categories": categories}


def write_output(result, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=1, sort_keys=True)
        handle.write("\n")
    os.replace(tmp, path)


def main():
    api_key = os.environ.get("PEXELS_API_KEY", "").strip()
    if not api_key:
        sys.exit("PEXELS_API_KEY is not set. Add it as a GitHub Actions secret or an environment variable.")
    with open(QUERIES_PATH, encoding="utf-8") as handle:
        queries = json.load(handle)
    try:
        result = build(queries, api_key)
    except urllib.error.HTTPError as err:
        # Report the status only; the request headers contain the key.
        sys.exit(f"Pexels request failed with HTTP {err.code}.")
    except (QuotaLow, RuntimeError, urllib.error.URLError) as err:
        sys.exit(f"Stopped without writing output: {err}")
    write_output(result, OUTPUT_PATH)
    total = sum(len(v) for v in result["categories"].values())
    print(f"Wrote {total} photos for {len(result['categories'])} categories to {os.path.abspath(OUTPUT_PATH)}")


if __name__ == "__main__":
    main()
