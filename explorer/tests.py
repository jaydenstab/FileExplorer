import json
import os
import shutil
import tempfile
from pathlib import Path
from subprocess import CalledProcessError
from unittest.mock import MagicMock, patch

import chromadb
import fitz
from django.db.utils import OperationalError
from django.test import TestCase

from semantic_index.chroma_path_rename import rename_path_in_index
from semantic_index.indexer import BASE_DIR

from explorer.document_roots import get_document_root_dirs, invalidate_document_root_dirs_cache
from explorer.file_store import get_library_dirname
from explorer.models import ExplorerSettings, TaggedFile


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

    @patch(
        "explorer.models.ExplorerSettings.objects.filter",
        side_effect=OperationalError("no such table: explorer_explorersettings"),
    )
    def test_reindex_start_when_explorer_settings_db_unavailable(self, _mock_filter):
        """Missing migrations or broken DB must not 500 path validation for reindex/start."""
        invalidate_document_root_dirs_cache()
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


class RecentApiTests(TestCase):
    def setUp(self):
        self.docs = BASE_DIR / "documents1"
        self.docs.mkdir(parents=True, exist_ok=True)
        self.f = self.docs / "recent_api_probe.txt"
        self.f.write_text("probe", encoding="utf-8")

    def tearDown(self):
        self.f.unlink(missing_ok=True)

    def test_recent_returns_items(self):
        res = self.client.get("/api/recent", {"limit": "10", "dirs": "documents1"})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertIn("items", data)
        paths = [x["path"] for x in data["items"]]
        self.assertTrue(any(p.endswith("recent_api_probe.txt") for p in paths))

    def test_recent_invalid_limit(self):
        res = self.client.get("/api/recent", {"limit": "nope"})
        self.assertEqual(res.status_code, 400)


class SearchMetadataTests(TestCase):
    def setUp(self):
        self.docs = BASE_DIR / "documents1"
        self.docs.mkdir(parents=True, exist_ok=True)
        self.f = self.docs / "meta_search_probe.txt"
        self.f.write_text("hello meta unique xyz", encoding="utf-8")

    def tearDown(self):
        self.f.unlink(missing_ok=True)

    def test_search_include_metadata(self):
        res = self.client.get(
            "/api/search",
            {
                "q": "meta unique xyz",
                "dirs": "documents1",
                "search_mode": "text",
                "page": "1",
                "page_size": "10",
                "include_scores": "true",
                "include_metadata": "true",
            },
        )
        self.assertEqual(res.status_code, 200, res.content)
        results = res.json()["results"]
        self.assertTrue(results)
        first = results[0]
        self.assertIsInstance(first, dict)
        self.assertIn("mtime_ms", first)
        self.assertIn("size_bytes", first)
        self.assertIsNotNone(first.get("mtime_ms"))


class ChromaPathRenameTests(TestCase):
    """Ensures rename_path_in_index loads embeddings (get include) and moves rows."""

    def test_moves_chunks_under_temp_chroma_dir(self):
        old_p = "documents1/chroma_rename_old.txt"
        new_p = "documents1/chroma_rename_new.txt"
        dim = 384
        with tempfile.TemporaryDirectory() as tmp:
            tpath = Path(tmp)
            with patch("semantic_index.chroma_path_rename.CHROMA_DIR", tpath):
                client = chromadb.PersistentClient(path=str(tpath))
                col = client.get_or_create_collection("files_documents1")
                col.add(
                    ids=[f"{old_p}::chunk-0"],
                    documents=["chunk text"],
                    metadatas=[{"path": old_p, "chunk": 0}],
                    embeddings=[[0.01] * dim],
                )
                outcome = rename_path_in_index(old_p, new_p)
                self.assertEqual(outcome.chunks_updated, 1)
                self.assertIsNone(outcome.warning)
                got_new = col.get(
                    where={"path": new_p},
                    include=["embeddings", "documents", "metadatas"],
                )
                self.assertTrue(got_new.get("ids"))
                got_old = col.get(
                    where={"path": old_p},
                    include=["metadatas"],
                )
                self.assertEqual(len(got_old.get("ids") or []), 0)
                self.assertTrue(outcome.had_index_rows)

    def test_add_failure_does_not_delete_old_rows(self):
        mock_col = MagicMock()
        mock_col.get.return_value = {
            "ids": ["documents1/x.txt::chunk-0"],
            "embeddings": [[0.01] * 384],
            "documents": ["hello"],
            "metadatas": [{"path": "documents1/x.txt", "chunk": 0}],
        }
        mock_col.add.side_effect = RuntimeError("simulated add failure")
        mock_client = MagicMock()
        mock_client.get_collection.return_value = mock_col
        with tempfile.TemporaryDirectory() as tmp:
            with patch("semantic_index.chroma_path_rename.CHROMA_DIR", Path(tmp)):
                with patch(
                    "semantic_index.chroma_path_rename.chromadb.PersistentClient",
                    return_value=mock_client,
                ):
                    outcome = rename_path_in_index("documents1/x.txt", "documents1/y.txt")
        self.assertEqual(outcome.chunks_updated, 0)
        self.assertIsNotNone(outcome.warning)
        self.assertTrue(outcome.had_index_rows)
        mock_col.add.assert_called_once()
        mock_col.delete.assert_not_called()


class FsRenameApiTests(TestCase):
    def setUp(self):
        self.docs = BASE_DIR / "documents1"
        self.docs.mkdir(parents=True, exist_ok=True)
        self.src = self.docs / "rename_from_api.txt"
        self.dst = self.docs / "rename_to_api.txt"
        self.src.write_text("x", encoding="utf-8")

    def tearDown(self):
        self.src.unlink(missing_ok=True)
        self.dst.unlink(missing_ok=True)

    def test_rename_same_folder(self):
        res = self.client.post(
            "/api/fs/rename",
            data='{"from": "documents1/rename_from_api.txt", "to": "documents1/rename_to_api.txt"}',
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(self.src.exists())
        self.assertTrue(self.dst.exists())
        body = res.json()
        self.assertIn("chunks_updated", body)
        self.assertIn("index_updated", body)
        self.assertIsInstance(body["chunks_updated"], int)
        self.assertIsInstance(body["index_updated"], bool)
        self.assertIn("had_index_rows", body)
        self.assertIsInstance(body["had_index_rows"], bool)

    def test_rename_rejects_backslash_in_destination_basename(self):
        res = self.client.post(
            "/api/fs/rename",
            data=r'{"from": "documents1/rename_from_api.txt", "to": "documents1/rename_to_bad\\name.txt"}',
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["code"], "invalid_destination_name")

    def test_source_not_found_includes_hint_when_destination_exists(self):
        self.src.unlink(missing_ok=True)
        self.dst.write_text("already", encoding="utf-8")
        res = self.client.post(
            "/api/fs/rename",
            data='{"from": "documents1/rename_from_api.txt", "to": "documents1/rename_to_api.txt"}',
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 404)
        err = res.json()["error"]
        self.assertEqual(err["code"], "source_not_found")
        self.assertIn("details", err)
        self.assertIn("hint", err["details"])

    def test_rename_rejects_parent_mismatch(self):
        res = self.client.post(
            "/api/fs/rename",
            data='{"from": "documents1/rename_from_api.txt", "to": "documents2/x.txt"}',
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)


class FsRenameDirectoryApiTests(TestCase):
    """Folder rename: disk, TaggedFile prefix updates, Chroma migration."""

    def tearDown(self):
        import shutil

        for rel in (
            "documents1/fs_empty_dir_old",
            "documents1/fs_empty_dir_new",
            "documents1/chroma_folder_rename_old",
            "documents1/chroma_folder_rename_new",
            "documents1/fs_many_files_cap",
            "documents1/fs_many_files_cap_new",
            "documents1/fs_dir_dst_block",
            "documents1/fs_dir_dst_exists",
            "documents1/fs_symlink_dir",
            "documents1/fs_symlink_target",
            "documents1/fs_symlink_dir_new",
        ):
            p = BASE_DIR / rel
            if p.is_symlink() or p.is_file():
                p.unlink(missing_ok=True)
            elif p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
        lib = get_library_dirname()
        for rel in (f"{lib}/tf_nested_old", f"{lib}/tf_nested_new"):
            p = BASE_DIR / rel
            if p.exists():
                shutil.rmtree(p, ignore_errors=True)
        TaggedFile.objects.filter(path__startswith=f"{lib}/tf_nested").delete()

    def test_empty_directory_rename(self):
        old = BASE_DIR / "documents1" / "fs_empty_dir_old"
        new = BASE_DIR / "documents1" / "fs_empty_dir_new"
        old.mkdir(parents=True, exist_ok=True)
        res = self.client.post(
            "/api/fs/rename",
            data='{"from": "documents1/fs_empty_dir_old", "to": "documents1/fs_empty_dir_new"}',
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(old.exists())
        self.assertTrue(new.is_dir())
        body = res.json()
        self.assertTrue(body.get("index_updated"))
        self.assertEqual(body.get("files_index_migrated"), 0)

    def test_directory_rename_migrates_chroma(self):
        old_dir = BASE_DIR / "documents1" / "chroma_folder_rename_old"
        inner = old_dir / "inner.txt"
        old_dir.mkdir(parents=True)
        inner.write_text("chunkable text for indexing rename", encoding="utf-8")
        old_p = "documents1/chroma_folder_rename_old/inner.txt"
        new_p = "documents1/chroma_folder_rename_new/inner.txt"
        dim = 384
        with tempfile.TemporaryDirectory() as tmp:
            tpath = Path(tmp)
            with patch("semantic_index.chroma_path_rename.CHROMA_DIR", tpath):
                client = chromadb.PersistentClient(path=str(tpath))
                col = client.get_or_create_collection("files_documents1")
                col.add(
                    ids=[f"{old_p}::chunk-0"],
                    documents=["chunk text"],
                    metadatas=[{"path": old_p, "chunk": 0}],
                    embeddings=[[0.01] * dim],
                )
                res = self.client.post(
                    "/api/fs/rename",
                    data=(
                        '{"from": "documents1/chroma_folder_rename_old",'
                        '"to": "documents1/chroma_folder_rename_new"}'
                    ),
                    content_type="application/json",
                )
                self.assertEqual(res.status_code, 200, res.content)
                self.assertTrue((BASE_DIR / "documents1" / "chroma_folder_rename_new" / "inner.txt").is_file())
                body = res.json()
                self.assertTrue(body.get("had_index_rows"))
                self.assertTrue(body.get("index_updated"))
                self.assertGreaterEqual(body.get("chunks_updated", 0), 1)
                col2 = client.get_collection("files_documents1")
                got = col2.get(where={"path": new_p}, include=["metadatas"])
                self.assertTrue(got.get("ids"))
                got_old = col2.get(where={"path": old_p}, include=["metadatas"])
                self.assertEqual(len(got_old.get("ids") or []), 0)

    def test_tagged_file_paths_after_library_folder_rename(self):
        lib = get_library_dirname()
        old_rel = f"{lib}/tf_nested_old"
        new_rel = f"{lib}/tf_nested_new"
        base_old = BASE_DIR / old_rel
        base_old.mkdir(parents=True)
        (base_old / "a.txt").write_text("t", encoding="utf-8")
        tf_path = f"{old_rel}/a.txt"
        TaggedFile.objects.create(path=tf_path)
        res = self.client.post(
            "/api/fs/rename",
            data=json.dumps({"from": old_rel, "to": new_rel}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(base_old.exists())
        self.assertTrue((BASE_DIR / new_rel / "a.txt").is_file())
        tf = TaggedFile.objects.get(path=f"{new_rel}/a.txt")
        self.assertEqual(tf.path, f"{new_rel}/a.txt")

    def test_directory_rename_rejects_target_exists(self):
        a = BASE_DIR / "documents1" / "fs_dir_dst_block"
        b = BASE_DIR / "documents1" / "fs_dir_dst_exists"
        a.mkdir(parents=True)
        b.mkdir(parents=True)
        res = self.client.post(
            "/api/fs/rename",
            data='{"from": "documents1/fs_dir_dst_block", "to": "documents1/fs_dir_dst_exists"}',
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 409)
        self.assertTrue(a.exists())

    def test_directory_rename_rejects_parent_mismatch(self):
        d = BASE_DIR / "documents1" / "fs_cross_parent_dir"
        d.mkdir(parents=True)
        try:
            res = self.client.post(
                "/api/fs/rename",
                data='{"from": "documents1/fs_cross_parent_dir", "to": "documents2/fs_cross_parent_dir"}',
                content_type="application/json",
            )
            self.assertEqual(res.status_code, 400)
        finally:
            import shutil

            shutil.rmtree(d, ignore_errors=True)

    def test_directory_rename_rejects_too_many_indexable_files(self):
        root = BASE_DIR / "documents1" / "fs_many_files_cap"
        root.mkdir(parents=True)
        for i in range(3):
            (root / f"f{i}.txt").write_text("x", encoding="utf-8")
        with patch("explorer.views_fs.MAX_FILES", 2):
            res = self.client.post(
                "/api/fs/rename",
                data='{"from": "documents1/fs_many_files_cap", "to": "documents1/fs_many_files_cap_new"}',
                content_type="application/json",
            )
        self.assertEqual(res.status_code, 413)
        self.assertEqual(res.json()["error"]["code"], "too_many_files")
        self.assertTrue(root.exists())

    def test_directory_rename_rejects_symlink(self):
        target = BASE_DIR / "documents1" / "fs_symlink_target"
        link = BASE_DIR / "documents1" / "fs_symlink_dir"
        target.mkdir(parents=True)
        try:
            link.symlink_to(target, target_is_directory=True)
        except OSError:
            self.skipTest("symlink not supported")
        try:
            res = self.client.post(
                "/api/fs/rename",
                data='{"from": "documents1/fs_symlink_dir", "to": "documents1/fs_symlink_dir_new"}',
                content_type="application/json",
            )
            self.assertEqual(res.status_code, 400, res.content)
            self.assertEqual(res.json()["error"]["code"], "invalid_rename")
        finally:
            import shutil

            p_new = BASE_DIR / "documents1" / "fs_symlink_dir_new"
            if p_new.is_symlink() or p_new.is_file():
                p_new.unlink(missing_ok=True)
            elif p_new.is_dir():
                shutil.rmtree(p_new, ignore_errors=True)
            link.unlink(missing_ok=True)
            shutil.rmtree(target, ignore_errors=True)


class DocumentRootsConfigApiTests(TestCase):
    def tearDown(self):
        ExplorerSettings.objects.update_or_create(
            key="default",
            defaults={"document_root_dirs": ["documents1", "documents2"]},
        )
        invalidate_document_root_dirs_cache()

    def test_get_document_roots_returns_persisted_list(self):
        ExplorerSettings.objects.update_or_create(
            key="default",
            defaults={"document_root_dirs": ["custom_a", "custom_b"]},
        )
        invalidate_document_root_dirs_cache()
        res = self.client.get("/api/config/document-roots")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["roots"], ["custom_a", "custom_b"])
        self.assertEqual(get_document_root_dirs(), ["custom_a", "custom_b"])


class DocumentRootRenamePersistTests(TestCase):
    """Renaming a synthetic top-level document root updates ExplorerSettings (not real documents1)."""

    ROOT = "fs_rtest_docroot"
    NEW = "fs_rtest_docroot_renamed"

    def setUp(self):
        (BASE_DIR / self.ROOT).mkdir(exist_ok=True)
        ExplorerSettings.objects.update_or_create(
            key="default",
            defaults={
                "document_root_dirs": ["documents1", "documents2", self.ROOT],
            },
        )
        invalidate_document_root_dirs_cache()

    def tearDown(self):
        for rel in (self.ROOT, self.NEW):
            p = BASE_DIR / rel
            if p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
        ExplorerSettings.objects.update_or_create(
            key="default",
            defaults={"document_root_dirs": ["documents1", "documents2"]},
        )
        invalidate_document_root_dirs_cache()

    def test_rename_top_level_document_root_updates_settings(self):
        res = self.client.post(
            "/api/fs/rename",
            data=json.dumps({"from": self.ROOT, "to": self.NEW}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse((BASE_DIR / self.ROOT).exists())
        self.assertTrue((BASE_DIR / self.NEW).is_dir())
        roots = get_document_root_dirs()
        self.assertIn(self.NEW, roots)
        self.assertNotIn(self.ROOT, roots)

    def test_rename_document_root_rejects_name_collision(self):
        res = self.client.post(
            "/api/fs/rename",
            data=json.dumps({"from": self.ROOT, "to": "documents1"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()["error"]["code"], "target_exists")
        self.assertTrue((BASE_DIR / self.ROOT).is_dir())
