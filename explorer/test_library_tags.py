"""Tests for file library upload/import and tagging + search filter."""
import json
import os
import shutil
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.client import Client

from semantic_index.indexer import BASE_DIR


class LibraryAndTagApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self._prev = os.environ.get("FILE_LIBRARY_DIR")
        self.lib = f"indexed_files_test_{os.getpid()}"
        os.environ["FILE_LIBRARY_DIR"] = self.lib

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("FILE_LIBRARY_DIR", None)
        else:
            os.environ["FILE_LIBRARY_DIR"] = self._prev
        root = BASE_DIR / self.lib
        if root.exists():
            shutil.rmtree(root, ignore_errors=True)

    def _library_dir_param(self) -> str:
        from explorer.file_store import get_library_dirname

        return get_library_dirname()

    def test_upload_list_tags_and_text_search_by_tag(self):
        up = self.client.post(
            "/api/library/upload",
            {"file": SimpleUploadedFile("notes.txt", b"hello tagsearch", content_type="text/plain")},
        )
        self.assertEqual(up.status_code, 200, up.content)
        path = up.json()["stored"]["path"]
        self.assertTrue(path.startswith(f"{self.lib}/"))

        lst = self.client.get("/api/library/list")
        self.assertEqual(lst.status_code, 200)
        self.assertGreaterEqual(len(lst.json()["files"]), 1)

        ts = self.client.post(
            "/api/tags/set",
            data=json.dumps({"path": path, "tags": ["study", "week1"]}),
            content_type="application/json",
        )
        self.assertEqual(ts.status_code, 200, ts.content)
        self.assertEqual(set(ts.json()["tags"]), {"study", "week1"})

        tf = self.client.get("/api/tags/for_file", {"path": path})
        self.assertEqual(tf.status_code, 200)
        self.assertEqual(set(tf.json()["tags"]), {"study", "week1"})

        tlist = self.client.get("/api/tags/list")
        self.assertEqual(tlist.status_code, 200)
        self.assertIn("study", tlist.json()["tags"])

        r = self.client.get(
            "/api/search",
            {
                "q": "tagsearch",
                "dir": self._library_dir_param(),
                "search_mode": "text",
                "tags": "study",
            },
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn(path, r.json()["results"])

        r2 = self.client.get(
            "/api/search",
            {
                "q": "tagsearch",
                "dir": self._library_dir_param(),
                "search_mode": "text",
                "tags": "wrongtag",
            },
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["results"], [])

    def test_import_local_path(self):
        import tempfile

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("imported body")
            src = f.name
        try:
            r = self.client.post(
                "/api/library/import",
                data=json.dumps({"paths": [src]}),
                content_type="application/json",
            )
            self.assertEqual(r.status_code, 200, r.content)
            body = r.json()
            self.assertEqual(len(body["imported"]), 1)
            self.assertEqual(body["errors"], [])
            rel = body["imported"][0]["path"]
            self.assertTrue(Path(BASE_DIR / rel).is_file())
        finally:
            os.unlink(src)
