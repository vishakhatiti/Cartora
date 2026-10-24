import gzip
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import build_catalog as bc  # noqa: E402

IMG = "https://m.media-amazon.com/images/I/{}.jpg"


def meta(asin, **over):
    base = {"parent_asin": asin, "title": f"Product {asin}", "price": 19.99, "average_rating": 4.4,
            "rating_number": 50, "features": ["f"], "description": ["d"], "store": "Acme",
            "images": [{"thumb": IMG.format(asin + "t"), "large": IMG.format(asin + "l"), "hi_res": IMG.format(asin + "h"), "variant": "MAIN"}]}
    base.update(over)
    return base


def review(asin, n, **over):
    base = {"parent_asin": asin, "user_id": f"U{n}", "rating": 5.0, "title": "ok", "text": f"text {n}",
            "timestamp": 1700000000000 + n, "verified_purchase": True, "helpful_vote": 2}
    base.update(over)
    return base


def write(path, rows, gz=False):
    opener = gzip.open if gz else open
    with opener(path, "wt", encoding="utf-8") as f:
        for r in rows:
            f.write((r if isinstance(r, str) else json.dumps(r)) + "\n")


class PureFunctions(unittest.TestCase):
    def test_price_parsing(self):
        self.assertEqual(bc.parse_price(19.9), "19.90")
        self.assertEqual(bc.parse_price("12.5"), "12.50")
        for bad in ("None", None, 0, -3, "abc", float("nan")):
            self.assertIsNone(bc.parse_price(bad))

    def test_only_amazon_https_images(self):
        self.assertTrue(bc.is_amazon_image("https://m.media-amazon.com/x.jpg"))
        self.assertFalse(bc.is_amazon_image("http://m.media-amazon.com/x.jpg"))
        self.assertFalse(bc.is_amazon_image("https://evil.com/m.media-amazon.com/x.jpg"))
        self.assertFalse(bc.is_amazon_image("https://placeholder.com"))
        self.assertFalse(bc.is_amazon_image(None))

    def test_pick_images_prefers_hi_res_and_dedupes(self):
        imgs = [{"thumb": IMG.format("a"), "large": IMG.format("b"), "hi_res": IMG.format("c")},
                {"large": IMG.format("c"), "hi_res": IMG.format("c")},
                {"large": "https://x.com/a.jpg"}, {"large": IMG.format("d"), "hi_res": None}]
        picked = bc.pick_images(imgs)
        self.assertEqual([i["large"] for i in picked], [IMG.format("c"), IMG.format("d")])
        self.assertEqual(picked[1]["thumb"], IMG.format("d"))

    def test_to_product_rejects_unsellable(self):
        self.assertIsNotNone(bc.to_product(meta("A"), "Books", 5))
        self.assertIsNone(bc.to_product(meta("A", price="None"), "Books", 5))
        self.assertIsNone(bc.to_product(meta("A", images=[]), "Books", 5))
        self.assertIsNone(bc.to_product(meta("A", rating_number=2), "Books", 5))
        self.assertIsNone(bc.to_product(meta("A", title=" "), "Books", 5))

    def test_brand_from_details_string_or_store(self):
        self.assertEqual(bc.brand_of({"details": '{"Brand": "Zed"}', "store": "S"}), "Zed")
        self.assertEqual(bc.brand_of({"store": "S"}), "S")

    def test_review_timestamp_ms_to_seconds_and_validation(self):
        self.assertEqual(bc.to_review(review("A", 1))["timestamp"], 1700000000)
        self.assertIsNone(bc.to_review(review("A", 1, rating=9)))
        self.assertIsNone(bc.to_review(review("A", 1, text="  ")))


class EndToEnd(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        d = self.dir.name
        # Books: 10 good products, 2 bad. Toys: gz files, truncated review file tail.
        write(os.path.join(d, "meta_Books.jsonl"),
              [meta(f"B{i}") for i in range(10)] + [meta("BADP", price="None"), "{not json", meta("B0")])
        write(os.path.join(d, "Books.jsonl"),
              [review(f"B{i}", n) for i in range(10) for n in range(7)])
        write(os.path.join(d, "meta_Toys_and_Games.jsonl.gz"), [meta(f"T{i}") for i in range(6)], gz=True)
        write(os.path.join(d, "Toys_and_Games.jsonl.gz"),
              [review(f"T{i}", n) for i in range(6) for n in range(3)] + ['{"parent_asin": "T1", "ra'], gz=True)
        self.out = os.path.join(d, "out", "catalogue.json.gz")

    def tearDown(self):
        self.dir.cleanup()

    def run_build(self, *extra):
        argv = ["--input-dir", self.dir.name, "--output", self.out, "--target", "12",
                "--categories", "Books", "Toys_and_Games", "Missing_Cat", *extra]
        self.assertEqual(bc.main(argv), 0)
        with gzip.open(self.out, "rt", encoding="utf-8") as f:
            return json.load(f)

    def test_builds_valid_catalogue(self):
        data = self.run_build()
        self.assertEqual(len(data), 12)
        self.assertEqual({p["main_category"] for p in data}, {"Books", "Toys_and_Games"})
        self.assertEqual(len({p["parent_asin"] for p in data}), 12)  # no duplicates
        for p in data:
            self.assertTrue(p["images"][0]["large"].startswith("https://m.media-amazon.com/"))
            self.assertRegex(p["price"], r"^\d+\.\d\d$")
            self.assertGreaterEqual(len(p["reviews"]), 2)
            self.assertLessEqual(len(p["reviews"]), bc.MAX_REVIEWS_PER_PRODUCT)
            self.assertEqual(p["deal"], {"has_deal": False})

    def test_same_seed_same_output(self):
        a = self.run_build("--seed", "7")
        b = self.run_build("--seed", "7")
        self.assertEqual(a, b)

    def test_products_without_enough_reviews_are_dropped(self):
        write(os.path.join(self.dir.name, "Books.jsonl"), [review("B0", 1), review("B1", 1), review("B1", 2)])
        data = self.run_build("--target", "50")
        books = [p for p in data if p["main_category"] == "Books"]
        self.assertEqual([p["parent_asin"] for p in books], ["B1"])

    def test_truncated_gzip_does_not_crash(self):
        path = os.path.join(self.dir.name, "Toys_and_Games.jsonl.gz")
        with open(path, "rb") as f:
            raw = f.read()
        with open(path, "wb") as f:
            f.write(raw[: len(raw) // 2])
        self.run_build()  # must finish

    def test_fails_clearly_without_meta_files(self):
        with tempfile.TemporaryDirectory() as empty:
            with self.assertRaises(SystemExit):
                bc.main(["--input-dir", empty, "--output", self.out])


if __name__ == "__main__":
    unittest.main()
