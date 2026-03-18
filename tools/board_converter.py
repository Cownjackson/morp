#!/usr/bin/env python3
"""Convert between board JSON and a human-readable text format.

Readable format
---------------
# Board hint here
word1, word2, word3, word4, word5
word6, word7, word8, word9, word10
...

# Another board hint
wordA, wordB, wordC, wordD, wordE
...

Usage
-----
  # JSON -> readable text
  python board_converter.py to-text boards.json              # prints to stdout
  python board_converter.py to-text boards.json -o boards.txt

  # Readable text -> JSON
  python board_converter.py to-json boards.txt               # prints to stdout
  python board_converter.py to-json boards.txt -o boards.json
"""

import argparse
import json
import sys
from pathlib import Path


def json_to_text(boards: list[dict]) -> str:
    lines = []
    for board in boards:
        lines.append(f"# {board['board_hint']}")
        words = board["words"]
        for i in range(0, len(words), 5):
            lines.append(", ".join(words[i:i + 5]) + ",")
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def text_to_json(text: str) -> list[dict]:
    boards = []
    hint = None
    words = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            if hint is not None and words:
                boards.append({"board_hint": hint, "words": words})
                hint = None
                words = []
            continue
        if line.startswith("#"):
            if hint is not None and words:
                boards.append({"board_hint": hint, "words": words})
                words = []
            hint = line.lstrip("#").strip()
        else:
            if hint is None:
                raise ValueError(f"Found words before any # hint line: {line!r}")
            words.extend(w.strip() for w in line.split(",") if w.strip())
    if hint is not None and words:
        boards.append({"board_hint": hint, "words": words})
    elif hint is not None:
        raise ValueError(f"Trailing hint with no words: {hint!r}")
    return boards


def main():
    parser = argparse.ArgumentParser(description="Convert board JSON <-> readable text")
    parser.add_argument("direction", choices=["to-text", "to-json"])
    parser.add_argument("input", type=Path, help="Input file (JSON or text)")
    parser.add_argument("-o", "--output", type=Path, help="Output file (default: stdout)")
    args = parser.parse_args()

    content = args.input.read_text(encoding="utf-8")

    if args.direction == "to-text":
        boards = json.loads(content)
        result = json_to_text(boards)
    else:
        boards = text_to_json(content)
        result = json.dumps(boards, indent=2, ensure_ascii=False) + "\n"

    if args.output:
        args.output.write_text(result, encoding="utf-8")
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(result)


if __name__ == "__main__":
    main()
