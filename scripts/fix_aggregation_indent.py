#!/usr/bin/env python3
"""Normalize indentation inside type-reference aggregation blocks."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGGS = ("bootstrap", "_dependencies", "_subLibraries", "_blocks", "contracts", "languages", "subTypes")


def fix_aggregation_blocks(text: str) -> str:
    for agg in AGGS:
        pattern = re.compile(rf"(?P<open>^[ \t]*<{agg}(?:\s[^>]*)?>)\s*\n(?P<body>.*?)(?P<close>^[ \t]*</{agg}>\s*)$", re.MULTILINE | re.DOTALL)

        def repl(m: re.Match[str]) -> str:
            open_line = m.group("open")
            body = m.group("body")
            close_line = m.group("close")
            indent = re.match(r"^([ \t]*)", open_line).group(1)
            child_indent = indent + "  "
            lines = []
            for raw in body.splitlines():
                s = raw.strip()
                if not s:
                    continue
                lines.append(f"{child_indent}{s}")
            if not lines:
                return f"{open_line}\n{indent}</{agg}>"
            return open_line + "\n" + "\n".join(lines) + f"\n{indent}</{agg}>"

        text = pattern.sub(repl, text)
    return text


def main() -> None:
    n = 0
    for path in ROOT.rglob("*.bml"):
        original = path.read_text(encoding="utf-8")
        updated = fix_aggregation_blocks(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            n += 1
    print(f"fixed {n} files")


if __name__ == "__main__":
    main()
