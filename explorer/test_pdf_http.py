"""Table-driven unit tests for explorer.pdf_http (no HTTP server)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest import TestCase

from explorer.pdf_http import (
    content_disposition_inline,
    file_etag,
    if_none_match_get_matches,
    parse_single_byte_range,
)


class IfNoneMatchGetTests(TestCase):
    def test_star_only_does_not_match(self):
        self.assertFalse(if_none_match_get_matches("*", 'W/"1-2"'))
        self.assertFalse(if_none_match_get_matches(" * , ", 'W/"1-2"'))

    def test_real_etag_still_matches(self):
        etag = 'W/"99-100"'
        self.assertTrue(if_none_match_get_matches(etag, etag))

    def test_star_ignored_when_other_token_matches(self):
        etag = 'W/"a-b"'
        self.assertTrue(if_none_match_get_matches(f'*, {etag}', etag))

    def test_weak_form_equivalence(self):
        etag = 'W/"x-y"'
        self.assertTrue(if_none_match_get_matches('W/"x-y"', etag))


class ParseSingleByteRangeTests(TestCase):
    def test_cases(self):
        size = 1000
        cases: list[tuple[str, int, tuple[int, int] | None]] = [
            ("bytes=0-9", size, (0, 9)),
            ("bytes=0-0", size, (0, 0)),
            ("bytes=500-499", size, None),
            ("bytes=1000-1000", size, None),
            ("bytes=0-", size, (0, 999)),
            ("bytes=-500", size, (500, 999)),
            ("bytes=-1000", size, (0, 999)),
            ("bytes=-1001", size, (0, 999)),
            ("bytes=-0", size, None),
            ("bytes=-1", size, (999, 999)),
            ("bytes=", size, None),
            ("bytes=-", size, None),
            ("bytes=0-9,10-19", size, None),
            ("notbytes=0-9", size, None),
        ]
        for header, sz, want in cases:
            with self.subTest(header=header, size=sz):
                self.assertEqual(parse_single_byte_range(header, sz), want)

    def test_zero_file_size(self):
        self.assertIsNone(parse_single_byte_range("bytes=0-0", 0))


class FileEtagTests(TestCase):
    def test_shape(self):
        st = SimpleNamespace(st_mtime_ns=9, st_size=10)
        self.assertEqual(file_etag(st), 'W/"9-10"')


class ContentDispositionInlineTests(TestCase):
    def test_strips_quotes_and_newlines(self):
        self.assertEqual(
            content_disposition_inline('a"b\r\nc.pdf'),
            'inline; filename="abc.pdf"',
        )

    def test_empty_after_sanitize_falls_back(self):
        self.assertEqual(
            content_disposition_inline('""\r\n'),
            'inline; filename="file.pdf"',
        )
