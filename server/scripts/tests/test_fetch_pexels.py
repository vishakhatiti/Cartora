import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import fetch_pexels_images as fp  # noqa: E402


def photo(pid, host="images.pexels.com"):
    return {"id": pid, "url": f"https://www.pexels.com/photo/{pid}/", "photographer": " Ann ",
            "photographer_url": "https://www.pexels.com/@ann", "alt": "a thing",
            "src": {"large2x": f"https://{host}/{pid}-l2.jpg", "medium": f"https://{host}/{pid}-m.jpg"}}


class FakeGet:
    def __init__(self, remaining="150"):
        self.calls, self.remaining = [], remaining

    def __call__(self, url, headers):
        self.calls.append((url, headers))
        return {"photos": [photo(1), photo(2), photo(3, host="evil.example"), {"id": 9}]}, {"X-Ratelimit-Remaining": self.remaining}


class PexelsTests(unittest.TestCase):
    def test_to_photo_filters_and_trims(self):
        self.assertEqual(fp.to_photo(photo(5))["photographer"], "Ann")
        self.assertIsNone(fp.to_photo(photo(5, host="evil.example")))  # only Pexels-hosted images
        self.assertIsNone(fp.to_photo({"id": 1}))

    def test_search_sends_key_in_header_not_url(self):
        get = FakeGet()
        result = fp.search("garden tools", "SECRETKEY", get)
        url, headers = get.calls[0]
        self.assertNotIn("SECRETKEY", url)
        self.assertEqual(headers["Authorization"], "SECRETKEY")
        self.assertIn("query=garden+tools", url)
        self.assertEqual([p["id"] for p in result], [1, 2])

    def test_stops_when_quota_is_low(self):
        with self.assertRaises(fp.QuotaLow):
            fp.search("x", "k", FakeGet(remaining="3"))

    def test_build_dedupes_across_terms_and_caps(self):
        get = FakeGet()
        out = fp.build({"books": ["a", "b"], "toys": ["c"]}, "k", get, pause=0)
        self.assertEqual(len(get.calls), 3)
        self.assertEqual([p["id"] for p in out["categories"]["books"]], [1, 2])  # same photos from 2 terms
        self.assertEqual(out["source"], "Pexels")

    def test_build_fails_when_a_category_has_no_photos(self):
        empty = lambda url, headers: ({"photos": []}, {})
        with self.assertRaises(RuntimeError):
            fp.build({"books": ["a"]}, "k", empty, pause=0)

    def test_queries_file_is_valid(self):
        with open(fp.QUERIES_PATH, encoding="utf-8") as f:
            queries = json.load(f)
        self.assertGreaterEqual(len(queries), 25)
        total = sum(len(v) for v in queries.values())
        self.assertLess(total, 150, "must stay well under the 200 requests/hour limit")
        for slug, terms in queries.items():
            self.assertRegex(slug, r"^[a-z0-9-]+$")
            self.assertTrue(terms)

    def test_write_output_is_atomic_json(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "sub", "out.json")
            fp.write_output({"source": "Pexels", "categories": {}}, path)
            with open(path) as f:
                self.assertEqual(json.load(f)["source"], "Pexels")
            self.assertFalse(os.path.exists(path + ".tmp"))


if __name__ == "__main__":
    unittest.main()
