from pathlib import Path

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
