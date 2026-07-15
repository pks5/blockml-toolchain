#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAGS = ("type", "baseType", "language")


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text
    for tag in TAGS:
        pattern = re.compile(
            rf"(?P<indent>^[ \t]*)<{tag}>\s*\n"
            rf"(?P<child>^[ \t]*<[^/][^\n]*)\s*\n"
            rf"(?P<close>^[ \t]*</{tag}>\s*)$",
            re.MULTILINE,
        )

        def repl(m: re.Match[str]) -> str:
            indent = m.group("indent")
            child = m.group("child").strip()
            return f"{indent}<{tag}>\n{indent}  {child}\n{indent}</{tag}>"

        text = pattern.sub(repl, text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    n = sum(fix_file(p) for p in ROOT.rglob("*.bml"))
    print(f"fixed {n} files")


if __name__ == "__main__":
    main()
