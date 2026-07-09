#!/usr/bin/env python3
"""
Convert BML files from legacy member syntax to simplified member syntax.
Preserves comments and formatting via text-based transformation.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MEMBER_KINDS = ("property", "aggregation", "association", "capability")
MEMBER_CONTAINERS = ("properties", "aggregations", "associations", "capabilities")
CONTAINER_OPEN = re.compile(
    r"<(" + "|".join(MEMBER_CONTAINERS) + r")(\s[^>]*)?>",
    re.IGNORECASE,
)
CONTAINER_CLOSE = re.compile(
    r"</(" + "|".join(MEMBER_CONTAINERS) + r")\s*>",
    re.IGNORECASE,
)
MEMBER_OPEN = re.compile(
    r"<(" + "|".join(MEMBER_KINDS) + r")(\s[^>/]*?)(\s*/)?>",
    re.DOTALL,
)
NAME_ATTR = re.compile(r'\sname="([^"]+)"')
VALUE_ATTR = re.compile(r'\svalue="([^"]*)"')
EXPORT_ATTR = re.compile(r'\sexport="true"')


def convert_member_open_tag(match: re.Match[str]) -> str:
    kind = match.group(1)
    attrs = match.group(2) or ""
    self_close = match.group(3) or ""

    name_match = NAME_ATTR.search(attrs)
    if not name_match:
        return match.group(0)

    name = name_match.group(1)
    attrs = NAME_ATTR.sub("", attrs, count=1)

    if kind == "property":
        value_match = VALUE_ATTR.search(attrs)
        if value_match:
            value = value_match.group(1)
            attrs = VALUE_ATTR.sub("", attrs, count=1)
            if self_close:
                inner = f"\n      <value>{value}</value>\n    "
                return f"<{name}{attrs}>{inner}</{name}>"
            return f"<{name}{attrs}>\n      <value>{value}</value>"

    return f"<{name}{attrs}{self_close}>"


def convert_member_close_tag(match: re.Match[str]) -> str:
    kind = match.group(1)
    # Close tags cannot be converted without matching context; handled via open tag renames
    # We track via a stack in convert_content
    return match.group(0)


def convert_content(text: str) -> str:
    text = EXPORT_ATTR.sub(' bml:exportIds="true"', text)

    # Process member containers section by section
    result: list[str] = []
    pos = 0
    container_stack: list[str] = []
    member_name_stack: list[str] = []

    token_re = re.compile(
        r"<!--.*?-->|<\?.*?\?>|<!(?:\[CDATA\[.*?\]\]|--).*?>|"
        r"</(" + "|".join(MEMBER_KINDS + MEMBER_CONTAINERS) + r")\s*>|"
        r"<(" + "|".join(MEMBER_KINDS + MEMBER_CONTAINERS) + r")(\s[^>/]*)?(\s*/)?>",
        re.DOTALL,
    )

    for m in token_re.finditer(text):
        result.append(text[pos : m.start()])
        token = m.group(0)

        if token.startswith("<!--") or token.startswith("<?") or token.startswith("<!"):
            result.append(token)
            pos = m.end()
            continue

        close_kind = m.group(1)
        open_kind = m.group(2)

        if close_kind:
            kind = close_kind
            if kind in MEMBER_CONTAINERS:
                if container_stack and container_stack[-1] == kind:
                    container_stack.pop()
                result.append(f"</{kind}>")
            elif kind in MEMBER_KINDS and container_stack:
                if member_name_stack:
                    result.append(f"</{member_name_stack.pop()}>")
                else:
                    result.append(f"</{kind}>")
            else:
                result.append(token)
        elif open_kind:
            kind = open_kind
            attrs = m.group(3) or ""
            self_close = m.group(4) or ""

            if kind in MEMBER_CONTAINERS:
                container_stack.append(kind)
                result.append(token)
            elif kind in MEMBER_KINDS and container_stack:
                name_match = NAME_ATTR.search(attrs)
                if not name_match:
                    result.append(token)
                else:
                    name = name_match.group(1)
                    attrs = NAME_ATTR.sub("", attrs, count=1)

                    if kind == "property":
                        value_match = VALUE_ATTR.search(attrs)
                        if value_match:
                            value = value_match.group(1)
                            attrs = VALUE_ATTR.sub("", attrs, count=1)
                            if self_close:
                                indent = " " * 4
                                result.append(
                                    f"<{name}{attrs}>\n{indent}  <value>{value}</value>\n{indent}</{name}>"
                                )
                                pos = m.end()
                                continue
                            result.append(f"<{name}{attrs}>")
                            result.append(f"\n      <value>{value}</value>")
                            member_name_stack.append(name)
                            pos = m.end()
                            continue

                    if self_close:
                        result.append(f"<{name}{attrs}/>")
                    else:
                        result.append(f"<{name}{attrs}>")
                        member_name_stack.append(name)
            else:
                result.append(token)

        pos = m.end()

    result.append(text[pos:])
    return "".join(result)


def ensure_bml_ns(content: str) -> str:
    if 'bml:exportIds=' in content and 'xmlns:bml=' not in content:
        content = content.replace(
            "<block",
            '<block\n  xmlns:bml="http://blockml.org/schema/bml"',
            1,
        )
    return content


def convert_file(path: Path) -> None:
    original = path.read_text(encoding="utf-8")
    converted = convert_content(original)
    converted = ensure_bml_ns(converted)
    if converted != original:
        path.write_text(converted, encoding="utf-8")


def main(argv: list[str]) -> int:
    root_dir = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent
    files = sorted(root_dir.rglob("*.bml"))
    for path in files:
        convert_file(path)
        print(f"converted: {path.relative_to(root_dir)}")
    print(f"\nDone: {len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
