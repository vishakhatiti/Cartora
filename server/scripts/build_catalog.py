#!/usr/bin/env python3
"""Build server/data/catalogue.json.gz from Amazon Reviews 2023 files you have downloaded.

This script only READS local files. It does not download anything. Download the per-category
files yourself (see README, "Real product data") and point --input-dir at them:

    <input-dir>/meta_<Category>.jsonl[.gz]     item metadata   (raw/meta_categories/<Category>.jsonl)
    <input-dir>/<Category>.jsonl[.gz]          reviews         (raw/review_categories/<Category>.jsonl)
    -- or --
    <input-dir>/meta_categories/<Category>.jsonl[.gz]
    <input-dir>/review_categories/<Category>.jsonl[.gz]

Only the Python standard library is used. Sampling is seeded, so the same inputs and seed give
the same catalogue. Output records use the same field names as server/data/data.json, so the
server's catalog loader reads them unchanged.

Usage:
    python server/scripts/build_catalog.py --input-dir ~/amazon2023 --target 13000
"""
import argparse
import gzip
import io
import json
import os
import random
import sys
from urllib.parse import urlparse

# 24 categories that have real prices and photos. Each file you downloaded is used if present.
DEFAULT_CATEGORIES = [
    "All_Beauty", "Appliances", "Arts_Crafts_and_Sewing", "Automotive", "Baby_Products",
    "Beauty_and_Personal_Care", "Books", "CDs_and_Vinyl", "Cell_Phones_and_Accessories",
    "Clothing_Shoes_and_Jewelry", "Electronics", "Grocery_and_Gourmet_Food",
    "Health_and_Household", "Home_and_Kitchen", "Industrial_and_Scientific",
    "Movies_and_TV", "Musical_Instruments", "Office_Products", "Patio_Lawn_and_Garden",
    "Pet_Supplies", "Sports_and_Outdoors", "Tools_and_Home_Improvement", "Toys_and_Games",
    "Video_Games",
]

IMAGE_HOST_SUFFIX = "media-amazon.com"
MAX_IMAGES = 6
MAX_FEATURES = 5
MAX_REVIEWS_PER_PRODUCT = 5
MAX_REVIEW_TEXT = 1200


def open_text(path):
    """Open .jsonl or .jsonl.gz as UTF-8 text. A truncated .gz simply ends early."""
    if path.endswith(".gz"):
        return io.TextIOWrapper(gzip.open(path, "rb"), encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def read_jsonl(path, max_lines=None):
    """Yield parsed objects, skipping blank/corrupt lines and stopping quietly on a cut-off file."""
    count = 0
    with open_text(path) as handle:
        try:
            for line in handle:
                if max_lines is not None and count >= max_lines:
                    return
                count += 1
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue  # a half-written last line of a partial download
        except (EOFError, OSError):
            return  # truncated gzip


def find_file(input_dir, kind, category):
    """Locate the meta or review file for a category. kind is 'meta' or 'review'."""
    names = {
        "meta": [f"meta_{category}", os.path.join("meta_categories", category),
                 os.path.join("meta_categories", f"meta_{category}")],
        "review": [category, os.path.join("review_categories", category)],
    }[kind]
    for base in names:
        for ext in (".jsonl.gz", ".jsonl"):
            path = os.path.join(input_dir, base + ext)
            if os.path.isfile(path):
                return path
    return None


def parse_price(value):
    """Return price as a string with 2 decimals, or None. Source values may be 'None'."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number <= 0 or number > 1_000_000:  # NaN, zero, absurd
        return None
    return f"{number:.2f}"


def is_amazon_image(url):
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme == "https" and (parsed.hostname or "").endswith(IMAGE_HOST_SUFFIX)


def pick_images(images):
    """Keep up to MAX_IMAGES Amazon-hosted images as {thumb, large}. Prefers hi_res for large."""
    picked = []
    seen = set()
    for item in images if isinstance(images, list) else []:
        if not isinstance(item, dict):
            continue
        large = next((item.get(k) for k in ("hi_res", "large") if is_amazon_image(item.get(k))), None)
        if not large or large in seen:
            continue
        seen.add(large)
        thumb = item.get("thumb") if is_amazon_image(item.get("thumb")) else large
        picked.append({"thumb": thumb, "large": large})
        if len(picked) >= MAX_IMAGES:
            break
    return picked


def clean_text(value, limit=None):
    text = " ".join(str(value or "").split())
    return text[:limit] if limit else text


def brand_of(meta):
    details = meta.get("details")
    if isinstance(details, str):  # some exports store details as a JSON string
        try:
            details = json.loads(details)
        except json.JSONDecodeError:
            details = None
    brand = details.get("Brand") if isinstance(details, dict) else None
    return clean_text(brand or meta.get("store"), 120)


def to_product(meta, category, min_ratings):
    """Convert one raw meta record into a catalogue record, or None if it is not sellable."""
    asin = clean_text(meta.get("parent_asin"), 40)
    title = clean_text(meta.get("title"), 300)
    price = parse_price(meta.get("price"))
    images = pick_images(meta.get("images"))
    try:
        rating_number = int(meta.get("rating_number") or 0)
        average_rating = round(float(meta.get("average_rating") or 0), 1)
    except (TypeError, ValueError):
        return None
    if not (asin and title and price and images):
        return None
    if rating_number < min_ratings or not 0 <= average_rating <= 5:
        return None
    features = [clean_text(f, 300) for f in meta.get("features") or [] if clean_text(f)]
    description = " ".join(clean_text(d) for d in meta.get("description") or [] if clean_text(d))
    return {
        "parent_asin": asin,
        "title": title,
        "main_category": category,
        "brand": brand_of(meta),
        "price": price,
        "deal": {"has_deal": False},  # the dataset has no deal data; none is invented
        "average_rating": average_rating,
        "rating_number": rating_number,
        "features": features[:MAX_FEATURES],
        "description": description[:1500],
        "images": images,
        "reviews": [],
    }


def to_review(raw):
    try:
        rating = int(round(float(raw.get("rating"))))
    except (TypeError, ValueError):
        return None
    text = clean_text(raw.get("text"), MAX_REVIEW_TEXT)
    if not 1 <= rating <= 5 or not text:
        return None
    ts = raw.get("timestamp")
    if isinstance(ts, (int, float)) and ts > 1e11:  # Amazon 2023 stores milliseconds
        ts = int(ts // 1000)
    return {
        "user_id": clean_text(raw.get("user_id"), 60),
        "rating": rating,
        "title": clean_text(raw.get("title"), 200),
        "text": text,
        "timestamp": ts if isinstance(ts, int) else None,
        "verified_purchase": bool(raw.get("verified_purchase")),
        "helpful_vote": int(raw.get("helpful_vote") or 0) if str(raw.get("helpful_vote") or 0).isdigit() else 0,
    }


def sample_products(meta_path, category, want, rng, min_ratings, max_lines):
    """Reservoir-sample `want` eligible products from one meta file in a single streaming pass."""
    reservoir, seen_ids, eligible = [], set(), 0
    for raw in read_jsonl(meta_path, max_lines):
        product = to_product(raw, category, min_ratings)
        if not product or product["parent_asin"] in seen_ids:
            continue
        seen_ids.add(product["parent_asin"])
        eligible += 1
        if len(reservoir) < want:
            reservoir.append(product)
        else:
            slot = rng.randrange(eligible)
            if slot < want:
                reservoir[slot] = product
    return reservoir, eligible


def attach_reviews(products, review_path, max_lines):
    """Stream one review file once, keeping up to MAX_REVIEWS_PER_PRODUCT for the sampled products."""
    by_id = {p["parent_asin"]: p for p in products}
    for raw in read_jsonl(review_path, max_lines):
        product = by_id.get(raw.get("parent_asin"))
        if product is None or len(product["reviews"]) >= MAX_REVIEWS_PER_PRODUCT:
            continue
        review = to_review(raw)
        if review:
            product["reviews"].append(review)


def build(args):
    rng = random.Random(args.seed)
    categories = args.categories or DEFAULT_CATEGORIES
    available = [(c, find_file(args.input_dir, "meta", c)) for c in categories]
    available = [(c, p) for c, p in available if p]
    missing = [c for c in categories if c not in {c for c, _ in available}]
    if not available:
        sys.exit(f"No meta files found in {args.input_dir}. See the README section 'Real product data'.")

    per_category = -(-args.target // len(available))  # ceiling division
    want = int(per_category * args.oversample)  # extra candidates, because some get dropped for lacking reviews
    catalogue, report = [], {}
    for category, meta_path in available:
        sampled, eligible = sample_products(meta_path, category, want, rng, args.min_ratings, args.max_meta_lines)
        review_path = find_file(args.input_dir, "review", category)
        if review_path:
            attach_reviews(sampled, review_path, args.max_review_lines)
        kept = [p for p in sampled if len(p["reviews"]) >= args.min_reviews]
        rng.shuffle(kept)
        kept = kept[:per_category]
        catalogue.extend(kept)
        report[category] = {"eligible": eligible, "sampled": len(sampled), "kept": len(kept),
                            "reviews_file": bool(review_path)}
        print(f"{category}: eligible={eligible} sampled={len(sampled)} kept={len(kept)}", file=sys.stderr)

    rng.shuffle(catalogue)
    catalogue = catalogue[: args.target]
    catalogue.sort(key=lambda p: (p["main_category"], p["parent_asin"]))
    return catalogue, report, missing


def write_output(catalogue, out_path):
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    tmp = out_path + ".tmp"
    with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=9) as handle:
        json.dump(catalogue, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, out_path)  # never leave a half-written output


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input-dir", required=True, help="folder holding the downloaded Amazon 2023 files")
    p.add_argument("--output", default=os.path.join(os.path.dirname(__file__), "..", "data", "catalogue.json.gz"))
    p.add_argument("--target", type=int, default=13000, help="total products wanted (default 13000)")
    p.add_argument("--categories", nargs="*", help="category names to use (default: 24 built-in)")
    p.add_argument("--seed", type=int, default=2023)
    p.add_argument("--min-ratings", type=int, default=5, help="skip products with fewer ratings")
    p.add_argument("--min-reviews", type=int, default=2, help="skip products with fewer collected reviews")
    p.add_argument("--oversample", type=float, default=1.6, help="candidates per slot before review filtering")
    p.add_argument("--max-meta-lines", type=int, default=None, help="read only the first N lines of each meta file")
    p.add_argument("--max-review-lines", type=int, default=None, help="read only the first N lines of each review file")
    args = p.parse_args(argv)
    if args.target < 1:
        p.error("--target must be at least 1")
    return args


def main(argv=None):
    args = parse_args(argv)
    catalogue, report, missing = build(args)
    if not catalogue:
        sys.exit("Nothing qualified. Check the input files or lower --min-ratings / --min-reviews.")
    write_output(catalogue, args.output)
    cats = {p["main_category"] for p in catalogue}
    print(f"\nWrote {len(catalogue)} products in {len(cats)} categories to {os.path.abspath(args.output)}")
    if missing:
        print(f"Categories with no meta file (skipped): {', '.join(missing)}")
    if len(catalogue) < args.target:
        print(f"Note: fewer than the {args.target} requested. Add more category files or lower the filters.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
