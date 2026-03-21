#!/usr/bin/env python3
"""Resolve Story as Code JSON-LD examples into single JSON files.

Scans spec/examples/ for directories containing a story.jsonld
and resolves each into .generated/data/<name>.story.json by
following @id cross-references across all .jsonld files.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = ROOT / "spec" / "examples"
OUTPUT_DIR = ROOT / ".generated" / "data"


def build_id_map(example_dir: Path) -> dict:
    """Scan all .jsonld files and build an id → entity map."""
    id_map: dict = {}
    for jsonld_file in example_dir.rglob("*.jsonld"):
        try:
            data = json.loads(jsonld_file.read_text())
        except Exception as e:
            print(f"  Warning: could not parse {jsonld_file}: {e}", file=sys.stderr)
            continue
        entity_id = data.get("id")
        if entity_id:
            id_map[entity_id] = data
    return id_map


def resolve(value, id_map: dict, visited: set):
    """Recursively resolve @id references using the id map."""
    if isinstance(value, dict):
        # Pure @id reference: { "@id": "some-id" }
        if list(value.keys()) == ["@id"]:
            ref_id = value["@id"]
            if ref_id in id_map and ref_id not in visited:
                entity = dict(id_map[ref_id])
                entity.pop("@context", None)
                visited = visited | {ref_id}
                return resolve(entity, id_map, visited)
            return value

        # Regular object: resolve all values, strip @context
        result = {}
        for k, v in value.items():
            if k == "@context":
                continue
            result[k] = resolve(v, id_map, visited)
        return result

    if isinstance(value, list):
        return [resolve(item, id_map, visited) for item in value]

    # String: resolve only if it's a known entity id
    if isinstance(value, str) and value in id_map:
        ref_id = value
        if ref_id not in visited:
            entity = dict(id_map[ref_id])
            entity.pop("@context", None)
            visited = visited | {ref_id}
            return resolve(entity, id_map, visited)

    return value


def resolve_example(example_dir: Path, output_path=None):
    """Resolve a single example directory into a JSON file."""
    story_file = example_dir / "story.jsonld"
    if not story_file.exists():
        sys.exit(f"Error: {story_file} not found")

    id_map = build_id_map(example_dir)

    story_data = json.loads(story_file.read_text())
    story_id = story_data.get("id")
    if story_id not in id_map:
        sys.exit(f"Error: story id '{story_id}' not found in id map")

    resolved = resolve(story_data, id_map, visited=set())

    if output_path is None:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_path = OUTPUT_DIR / f"{example_dir.name}.story.json"

    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(resolved, f, indent=2, ensure_ascii=False)

    print(f"\u2713 {output_path.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser(
        description="Resolve Story as Code @id references into single JSON files."
    )
    parser.add_argument("example_dir", nargs="?", type=Path, default=None)
    parser.add_argument("-o", "--output", type=Path, default=None)
    args = parser.parse_args()

    if args.example_dir:
        resolve_example(args.example_dir.resolve(), args.output)
    else:
        for example_dir in sorted(EXAMPLES_DIR.iterdir()):
            if not example_dir.is_dir():
                continue
            if not (example_dir / "story.jsonld").exists():
                continue
            resolve_example(example_dir)

        print(f"\nResolved stories written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
