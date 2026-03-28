"""Count non-overlapping substring occurrences (Ctrl+F-style)."""


def count_substring_matches(haystack: str, needle: str, *, case_sensitive: bool = False) -> int:
    if not needle:
        return 0
    if case_sensitive:
        return haystack.count(needle)
    return haystack.lower().count(needle.lower())
