#!/usr/bin/env python3
"""Resolve Story as Code examples into single JSON files.

Scans spec/examples/ for directories containing a story.yaml
and resolves each into .generated/data/<name>.story.json.
"""
import argparse
import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required. Install it with: pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = ROOT / "spec" / "examples"
OUTPUT_DIR = ROOT / ".generated" / "data"


def resolve_refs(data, base_dir: Path):
    """Recursively resolve $ref pointers in a YAML/JSON structure."""
    if isinstance(data, dict):
        if "$ref" in data and len(data) == 1:
            ref_path = (base_dir / data["$ref"]).resolve()
            if not ref_path.exists():
                print(f"  Warning: referenced file not found: {ref_path}", file=sys.stderr)
                return data
            with open(ref_path) as f:
                resolved = yaml.safe_load(f)
            return resolve_refs(resolved, ref_path.parent)
        return {k: resolve_refs(v, base_dir) for k, v in data.items()}
    if isinstance(data, list):
        return [resolve_refs(item, base_dir) for item in data]
    return data


def resolve_example(example_dir: Path, output_path=None):
    """Resolve a single example directory into a JSON file."""
    story_file = example_dir / "story.yaml"
    if not story_file.exists():
        sys.exit(f"Error: {story_file} not found")

    with open(story_file) as f:
        story = yaml.safe_load(f)

    resolved = resolve_refs(story, example_dir)

    if output_path is None:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_path = OUTPUT_DIR / f"{example_dir.name}.story.json"

    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(resolved, f, indent=2, ensure_ascii=False)

    print(f"\u2713 {output_path.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser(description="Resolve Story as Code $refs into single JSON files.")
    parser.add_argument("example_dir", nargs="?", type=Path, default=None)
    parser.add_argument("-o", "--output", type=Path, default=None)
    args = parser.parse_args()

    if args.example_dir:
        resolve_example(args.example_dir.resolve(), args.output)
    else:
        for example_dir in sorted(EXAMPLES_DIR.iterdir()):
            if not example_dir.is_dir():
                continue
            if not (example_dir / "story.yaml").exists():
                continue
            resolve_example(example_dir)

        print(f"\nResolved stories written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
