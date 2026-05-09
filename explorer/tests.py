import os
from pathlib import Path
from subprocess import CalledProcessError
from unittest.mock import MagicMock, patch

import fitz
from django.test import TestCase

from semantic_index.indexer import BASE_DIR


class OpenApiSafetyTests(TestCase):
    def setUp(self):
        self.docs_dir = BASE_DIR / "documents1"
        self.docs_dir.mkdir(parents=True, exist_ok=True)
        self.text_path = self.docs_dir / "test_open_api.txt"
        self.text_path.write_text("hello preview", encoding="utf-8")
        self.pdf_path = self.docs_dir / "test_open_api.pdf"
        pdf = fitz.open()
        page = pdf.new_page()
        page.insert_text((72, 72), "hello pdf")
        pdf.save(str(self.pdf_path))
        pdf.close()

    def tearDown(self):
        for p in [self.text_path, self.pdf_path]:
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass

    def test_open_rejects_missing_path(self):
        res = self.client.get("/api/open")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["code"], "missing_path")

    def test_open_rejects_unauthorized_path(self):
        res = self.client.get("/api/open", {"path": "../secrets.txt", "mode": "preview"})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"]["code"], "path_forbidden")

    def test_open_preview_returns_text(self):
        rel = f"documents1/{self.text_path.name}"
        res = self.client.get("/api/open", {"path": rel, "mode": "preview"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["type"], "text")
        self.assertEqual(data["name"], self.text_path.name)
        self.assertEqual(data["size"], self.text_path.stat().st_size)

    @patch("explorer.views_open.MAX_TEXT_PREVIEW_READ_BYTES", 8)
    def test_text_preview_reads_only_byte_cap(self):
        self.text_path.write_text("hellohelloworld", encoding="utf-8")
        rel = f"documents1/{self.text_path.name}"
        res = self.client.get("/api/open", {"path": rel, "mode": "preview"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["content"].encode("utf-8")), 8)
        self.assertEqual(data["size"], self.text_path.stat().st_size)

    def test_file_etag_returns_304(self):
        pdf_rel = f"documents1/{self.pdf_path.name}"
        r1 = self.client.get("/api/file", {"path": pdf_rel})
        self.assertEqual(r1.status_code, 200)
        etag = r1.get("ETag")
        self.assertTrue(etag)
        r2 = self.client.get("/api/file", {"path": pdf_rel}, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(r2.status_code, 304)
        self.assertEqual(r2.get("ETag"), etag)

    def test_file_if_none_match_star_still_returns_200(self):
        """GET If-None-Match: * must not force 304 for an existing representation."""
        pdf_rel = f"documents1/{self.pdf_path.name}"
        res = self.client.get("/api/file", {"path": pdf_rel}, HTTP_IF_NONE_MATCH="*")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get("ETag"))

    def test_file_range_returns_206(self):
        pdf_rel = f"documents1/{self.pdf_path.name}"
        r1 = self.client.get("/api/file", {"path": pdf_rel})
        size = len(b"".join(r1.streaming_content))
        self.assertGreater(size, 20)
        end = min(19, size - 1)
        r2 = self.client.get(
            "/api/file",
            {"path": pdf_rel},
            HTTP_RANGE=f"bytes=0-{end}",
        )
        self.assertEqual(r2.status_code, 206)
        self.assertEqual(r2["Content-Type"], "application/pdf")
        self.assertIn("Content-Range", r2)
        self.assertEqual(len(b"".join(r2.streaming_content)), end + 1)

    def test_open_preview_pdf_metadata_only(self):
        rel = f"documents1/{self.pdf_path.name}"
        res = self.client.get("/api/open", {"path": rel, "mode": "preview"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["type"], "pdf")
        self.assertEqual(data["content"], "")
        self.assertEqual(data["pages"], 1)
        self.assertEqual(data["preview_pages"], 1)
        self.assertNotIn("error", data)

    @patch("explorer.views_open.sys.platform", "linux")
    @patch("explorer.views_open.subprocess.run")
    def test_open_os_success_shape(self, mock_run):
        mock_run.return_value = None
        rel = f"documents1/{self.text_path.name}"
        res = self.client.get("/api/open", {"path": rel, "mode": "open_os"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertNotIn("error", data)
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("path"), rel)

    def test_open_rejects_invalid_mode(self):
        rel = f"documents1/{self.text_path.name}"
        res = self.client.get("/api/open", {"path": rel, "mode": "bad"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["code"], "invalid_mode")

    def test_file_endpoint_serves_pdf_only(self):
        txt_rel = f"documents1/{self.text_path.name}"
        txt_res = self.client.get("/api/file", {"path": txt_rel})
        self.assertEqual(txt_res.status_code, 400)

        pdf_rel = f"documents1/{self.pdf_path.name}"
        pdf_res = self.client.get("/api/file", {"path": pdf_rel})
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res["Content-Type"], "application/pdf")

    def test_reindex_rejects_invalid_directory(self):
        res = self.client.get("/api/reindex", {"dir": "nope"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["code"], "invalid_directory")

    def test_reindex_start_returns_job_id(self):
        res = self.client.post("/api/reindex/start?dir=documents1")
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertIn("job_id", data)
        self.assertTrue(data["job_id"])

    def test_reindex_start_rejects_invalid_directory(self):
        res = self.client.post("/api/reindex/start?dir=nope")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["code"], "invalid_directory")

    @patch("explorer.file_store.get_library_root", side_effect=OSError("read-only fs"))
    def test_reindex_start_does_not_require_library_dir(self, _mock_root):
        """
        Path validation must not mkdir the library root; otherwise reindexing
        documents* fails on read-only or permission-blocked library paths.
        """
        res = self.client.post("/api/reindex/start?dir=documents1")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn("job_id", res.json())

    @patch("explorer.views_open.sys.platform", "linux")
    @patch("explorer.views_open.subprocess.run")
    def test_open_os_subprocess_failure(self, mock_run):
        mock_run.side_effect = CalledProcessError(1, ["xdg-open"])
        rel = f"documents1/{self.text_path.name}"
        res = self.client.get("/api/open", {"path": rel, "mode": "open_os"})
        self.assertEqual(res.status_code, 500)
        self.assertEqual(res.json()["error"]["code"], "open_failed")

    def test_file_not_found(self):
        res = self.client.get("/api/file", {"path": "documents1/does_not_exist_xyz.pdf"})
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "file_not_found")

    def test_file_path_forbidden(self):
        res = self.client.get("/api/file", {"path": "../manage.py"})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"]["code"], "path_forbidden")


class ChromaSearchConfigTests(TestCase):
    def test_chroma_client_singleton(self):
        from semantic_index.search import _get_chroma_client

        self.assertIs(_get_chroma_client(), _get_chroma_client())

    def test_chroma_n_results_respects_env_cap(self):
        from semantic_index.search import search_files

        recorded: list[int] = []

        class MockCol:
            def query(self, **kwargs):
                recorded.append(kwargs.get("n_results"))
                return {"metadatas": [[]], "distances": [[]]}

        class MockClient:
            def get_collection(self, name):
                return MockCol()

        with patch.dict(os.environ, {"CHROMA_MAX_N_RESULTS": "7"}):
            with patch("semantic_index.search._get_chroma_client", return_value=MockClient()):
                with patch("semantic_index.search.get_model") as gm:
                    m = MagicMock()
                    m.encode.return_value.tolist.return_value = [[0.1, 0.2]]
                    gm.return_value = m
                    out = search_files(
                        "q",
                        k=10,
                        directory=["documents1"],
                        include_distances=False,
                        use_reranker=True,
                    )
        self.assertEqual(out, [])
        self.assertEqual(recorded, [7])


class PlaintextSearchBoundsTests(TestCase):
    """Substring search path uses bounded reads (semantic_index/document_text + file_scan)."""

    def test_extract_truncates_txt_when_max_bytes_set(self):
        from semantic_index.document_text import extract_document_text

        p = BASE_DIR / "documents1" / "plaintext_bounds_test.txt"
        p.write_bytes(b"x" * 200 + b"UNIQUE_MARKER_ABC" + b"y" * 200)
        try:
            full = extract_document_text(str(p))
            trunc = extract_document_text(str(p), max_bytes=100)
            self.assertIn("UNIQUE_MARKER_ABC", full)
            self.assertNotIn("UNIQUE_MARKER_ABC", trunc)
        finally:
            p.unlink(missing_ok=True)


class SearchApiTests(TestCase):
    def test_search_invalid_query_params(self):
        res = self.client.get(
            "/api/search",
            {
                "q": "hello",
                "dirs": "documents1",
                "search_mode": "text",
                "distance_threshold": "not_a_number",
            },
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body["error"]["code"], "invalid_query_params")
        self.assertIn("errors", body["error"]["details"])
