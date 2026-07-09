#!/usr/bin/env python3
"""Apply member syntax conversion to XML examples inside markdown docs."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import importlib.util

_spec = importlib.util.spec_from_file_location(
    "convert_member_syntax",
    Path(__file__).resolve().parent / "convert-member-syntax.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
convert_content = _mod.convert_content
ensure_bml_ns = _mod.ensure_bml_ns

XML_FENCE = re.compile(r"(```xml\n)(.*?)(```)", re.DOTALL)


def convert_markdown(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        prefix, body, suffix = match.group(1), match.group(2), match.group(3)
        converted = convert_content(body)
        converted = ensure_bml_ns(converted)
        # Prose references inside xml blocks should stay — only convert actual tags
        return prefix + converted + suffix

    return XML_FENCE.sub(repl, text)


def main(argv: list[str]) -> int:
    root = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent / "docs"
    for path in sorted(root.glob("*.md")):
        original = path.read_text(encoding="utf-8")
        converted = convert_markdown(original)
        if converted != original:
            path.write_text(converted, encoding="utf-8")
            print(f"updated: {path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
