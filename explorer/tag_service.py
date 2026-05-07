"""Tag names and library paths; filter search results by tag."""
from __future__ import annotations

from typing import Iterable, List, Optional, Sequence, Set, Union

from .path_policy import validate_library_relative_path
from .models import Tag, TaggedFile


def normalize_tag_names(tags: Iterable[str]) -> List[str]:
    out: List[str] = []
    seen: Set[str] = set()
    for t in tags:
        n = (str(t) or "").strip().lower()
        if not n:
            continue
        if len(n) > 64:
            n = n[:64]
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out

def _get_or_create_tags(names: Sequence[str]) -> List[Tag]:
    return [Tag.objects.get_or_create(name=n)[0] for n in names]


def set_file_tags(*, path: str, tag_names: Sequence[str]) -> List[str]:
    rel = validate_library_relative_path(path)
    names = normalize_tag_names(tag_names)
    tf, _ = TaggedFile.objects.get_or_create(path=rel)
    tf.tags.clear()
    if names:
        tf.tags.add(*_get_or_create_tags(names))
    return list(tf.tags.order_by("name").values_list("name", flat=True))


def get_file_tags(*, path: str) -> List[str]:
    rel = validate_library_relative_path(path)
    try:
        tf = TaggedFile.objects.get(path=rel)
    except TaggedFile.DoesNotExist:
        return []
    return list(tf.tags.order_by("name").values_list("name", flat=True))


def list_all_tag_names() -> List[str]:
    return list(Tag.objects.order_by("name").values_list("name", flat=True))


def paths_for_tags(tag_names: Sequence[str], *, match: str = "any") -> Set[str]:
    names = normalize_tag_names(tag_names)
    if not names:
        return set()
    qs = TaggedFile.objects.filter(tags__name__in=names).distinct()
    if match == "all":
        for n in names:
            qs = qs.filter(tags__name=n)
    return set(qs.values_list("path", flat=True))


def filter_results_by_tags(
    results: List[Union[dict, str]],
    tag_names: Optional[Sequence[str]],
    *,
    match: str = "any",
) -> List[Union[dict, str]]:
    if not tag_names:
        return results
    allowed = paths_for_tags(tag_names, match=match)
    if not allowed:
        return []
    out: List[Union[dict, str]] = []
    for r in results:
        p = r.get("path") if isinstance(r, dict) else r
        if isinstance(p, str) and p in allowed:
            out.append(r)
    return out
