import argparse
import sys
from datetime import datetime

from .slicer import slice_lines


def main() -> int:
    p = argparse.ArgumentParser(prog="logslice")
    p.add_argument("file")
    p.add_argument("--since", required=True)
    p.add_argument("--until", default=None)
    p.add_argument("-n", "--limit", type=int, default=None)
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()
    until = args.until or datetime.now().isoformat(timespec="minutes")
    printed = skipped = 0

    def count_skip() -> None:
        nonlocal skipped
        skipped += 1

    with open(args.file, encoding="utf-8") as fh:
        for line in slice_lines(fh, since=args.since, until=until, on_skip=count_skip):
            if args.limit is not None and printed >= args.limit:
                break
            sys.stdout.write(line)
            printed += 1
    if args.verbose:
        print(f"skipped {skipped} lines", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
