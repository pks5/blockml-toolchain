#!/usr/bin/env python3
"""Legacy migration helper (pre-TypeReference ValueType rename).

Historical: moved identity type/baseType/language toward child-element forms and listed
type-reference aggregation tags. Current design uses scalar TypeReference text for identity
and TypeReferenceEntity aggregations for contracts/languages/Library lists — do not re-apply
blindly.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SINGULAR_TYPE_ELEMENTS = ("type", "baseType", "language")

TYPE_REF_AGGREGATIONS = {
    "bootstrap",
    "_dependencies",
    "_subLibraries",
    "_blocks",
    "contracts",
    "languages",
    "subTypes",
}

IMPLICIT_TYPE_NS = "org.blockml.bml.type"
IMPLICIT_TEST_NS = "com.blockml.test.constraints"


def parse_xmlns(content: str) -> dict[str, str]:
    return dict(re.findall(r'xmlns:([A-Za-z0-9_]+)="([^"]+)"', content))


def ref_to_element(ref: str, xmlns: dict[str, str], file_path: Path) -> tuple[str, str | None]:
    ref = ref.strip()
    if not ref:
        return "", None

    if ":" in ref:
        return f"  <{ref} />", None

    if "." in ref:
        package, local = ref.rsplit(".", 1)
        best_prefix = None
        best_len = -1
        for prefix, uri in xmlns.items():
            if package == uri or package.startswith(uri + "."):
                if len(uri) > best_len:
                    best_prefix = prefix
                    best_len = len(uri)
        if best_prefix:
            return f"  <{best_prefix}:{local} />", None
        if package == IMPLICIT_TEST_NS and "test" not in xmlns:
            return f"  <test:{local} />", f'xmlns:test="{IMPLICIT_TEST_NS}"'
        raise ValueError(f"no xmlns for FQN {ref}")

    for prefix, uri in xmlns.items():
        if uri == IMPLICIT_TYPE_NS or uri.endswith(".type"):
            return f"  <{prefix}:{ref} />", None
    if "btype" in xmlns:
        return f"  <btype:{ref} />", None
    if "type" in xmlns:
        return f"  <type:{ref} />", None

    raise ValueError(f"cannot resolve unqualified ref {ref!r} in {file_path}")


def inject_xmlns(content: str, declaration: str) -> str:
    if declaration in content:
        return content
    return re.sub(r"(<block\b[^>]*)(>)", rf"\1\n  {declaration}\2", content, count=1)


def convert_text_elements(content: str, file_path: Path) -> str:
    xmlns = parse_xmlns(content)
    pending_decl: str | None = None

    for tag in SINGULAR_TYPE_ELEMENTS:
        pattern = re.compile(rf"<{tag}>\s*([^<\s][^<]*?)\s*</{tag}>")

        def repl(match: re.Match[str], t: str = tag) -> str:
            nonlocal pending_decl, xmlns
            ref = match.group(1).strip()
            child, new_decl = ref_to_element(ref, xmlns, file_path)
            if new_decl:
                pending_decl = new_decl
                xmlns = parse_xmlns(inject_xmlns(content, new_decl))
            return f"<{t}>\n{child}\n</{t}>"

        content = pattern.sub(repl, content)

    if pending_decl:
        content = inject_xmlns(content, pending_decl)

    return content


def unwrap_type_ref_compositions(content: str) -> str:
    for agg in TYPE_REF_AGGREGATIONS:
        pattern = re.compile(rf"(<{agg}(?:\s[^>]*)?>)(.*?)(</{agg}>)", re.DOTALL)

        def repl(match: re.Match[str]) -> str:
            open_tag, inner, close_tag = match.group(1), match.group(2), match.group(3)
            if "<composition" not in inner:
                return match.group(0)
            inner = re.sub(r"<composition>\s*", "", inner)
            inner = re.sub(r"\s*</composition>", "", inner)
            lines = [ln for ln in inner.splitlines() if ln.strip()]
            if not lines:
                return f"{open_tag}{close_tag}"
            return open_tag + "\n" + "\n".join(lines) + "\n" + close_tag

        content = pattern.sub(repl, content)
    return content


def migrate_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    content = convert_text_elements(original, path)
    content = unwrap_type_ref_compositions(content)
    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    errors: list[str] = []
    for path in sorted(ROOT.rglob("*.bml")):
        try:
            if migrate_file(path):
                changed += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{path}: {exc}")

    print(f"{changed} files updated")
    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
