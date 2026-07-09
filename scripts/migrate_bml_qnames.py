#!/usr/bin/env python3
"""Migrate BML type references from FQN to QName syntax."""
from __future__ import annotations

import re
import sys
from pathlib import Path

PRIMITIVES = {"Boolean", "Integer", "Float", "String"}

DEFAULT_PREFIX = {
    "com.machineblocks.core": "core",
    "com.machineblocks.type": "type",
    "com.machineblocks.bricks": "bricks",
    "com.machineblocks.calibration": "calibration",
    "com.machineblocks.examples": "examples",
    "org.blockml.core": "bcore",
    "org.blockml.type": "btype",
    "org.blockml.constraint": "constraint",
    "org.blockml.service": "service",
    "org.blockml.capability": "cap",
    "org.blockml.language": "lang",
}

TYPE_REF_ATTRS = frozenset({
    "type", "baseType", "inputType", "outputType", "contract",
})

FQN_RE = re.compile(
    r"\b((?:org\.blockml|com\.machineblocks)(?:\.[A-Za-z][A-Za-z0-9_]*)+)(\[\])?"
)


def namespace_for_fqn(fqn: str) -> str | None:
    parts = fqn.split(".")
    for length in range(len(parts) - 1, 1, -1):
        ns = ".".join(parts[:length])
        if ns.startswith(("org.blockml.", "com.machineblocks.")):
            return ns
    return None


def collect_namespaces(content: str) -> set[str]:
    namespaces: set[str] = set()

    for m in re.finditer(r"<(type|baseType)>([^<]+)</\1>", content):
        for fqn_m in FQN_RE.finditer(m.group(2)):
            ns = namespace_for_fqn(fqn_m.group(1))
            if ns:
                namespaces.add(ns)

    for m in re.finditer(
        r'(?<![:\w-])(' + "|".join(TYPE_REF_ATTRS) + r')=(["\x27])([^"\x27]*)\2',
        content,
    ):
        val = m.group(3)
        for fqn_m in FQN_RE.finditer(val):
            ns = namespace_for_fqn(fqn_m.group(1))
            if ns:
                namespaces.add(ns)

    return namespaces


def assign_prefixes(namespaces: set[str]) -> dict[str, str]:
    prefixes: dict[str, str] = {}
    pure_blockml = namespaces and all(ns.startswith("org.blockml.") for ns in namespaces)

    for ns in namespaces:
        if ns == "org.blockml.core" and pure_blockml:
            prefixes[ns] = "core"
        elif ns in DEFAULT_PREFIX:
            prefixes[ns] = DEFAULT_PREFIX[ns]
        else:
            prefixes[ns] = ns.split(".")[-1].lower()

    if "com.machineblocks.core" in namespaces and "org.blockml.core" in namespaces:
        prefixes["com.machineblocks.core"] = "core"
        prefixes["org.blockml.core"] = "bcore"

    return prefixes


def fqn_to_qname(fqn: str, array_suffix: str, prefixes: dict[str, str]) -> str:
    ns = namespace_for_fqn(fqn)
    if not ns or ns not in prefixes:
        return fqn + array_suffix

    simple = fqn[len(ns) + 1 :]
    if ns == "org.blockml.type" and simple in PRIMITIVES:
        return simple + array_suffix
    return f"{prefixes[ns]}:{simple}" + array_suffix


def replace_fqns_in_text(text: str, prefixes: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        return fqn_to_qname(m.group(1), m.group(2) or "", prefixes)

    return FQN_RE.sub(repl, text)


def add_xmlns_declarations(content: str, prefixes: dict[str, str]) -> str:
    match = re.search(r"(<block\b)(.*?)(>)", content, re.DOTALL)
    if not match:
        return content

    start, attrs, end = match.group(1), match.group(2), match.group(3)
    existing = dict(re.findall(r'xmlns:(\w+)="([^"]*)"', attrs))
    additions: list[str] = []
    for ns, prefix in sorted(prefixes.items(), key=lambda item: item[1]):
        if prefix not in existing:
            additions.append(f'\n  xmlns:{prefix}="{ns}"')

    if not additions:
        return content

    new_attrs = attrs + "".join(additions)
    return content[: match.start()] + start + new_attrs + end + content[match.end() :]


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    namespaces = collect_namespaces(original)
    if not namespaces:
        return False

    prefixes = assign_prefixes(namespaces)
    content = original

    def replace_element(m: re.Match[str]) -> str:
        tag, value = m.group(1), m.group(2).strip()
        return f"<{tag}>{replace_fqns_in_text(value, prefixes)}</{tag}>"

    content = re.sub(r"<(type|baseType)>([^<]+)</\1>", replace_element, content)

    def replace_attr(m: re.Match[str]) -> str:
        attr = m.group(1)
        quote = m.group(2)
        val = m.group(3)
        return f"{attr}={quote}{replace_fqns_in_text(val, prefixes)}{quote}"

    content = re.sub(
        r'(?<![:\w-])(' + "|".join(TYPE_REF_ATTRS) + r')=(["\x27])([^"\x27]*)\2',
        replace_attr,
        content,
    )

    content = add_xmlns_declarations(content, prefixes)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    changed = [str(path) for path in sorted(root.rglob("*.bml")) if process_file(path)]
    print(f"Updated {len(changed)} files")
    for item in changed:
        print(f"  {item}")


if __name__ == "__main__":
    main()
