#!/usr/bin/env python3
"""Generate documentation pages for all examples.

Scans spec/examples/ for directories containing a story.yaml.
For each example, generates a markdown page in .generated/examples/
with the README.md as intro and all YAML files as collapsible sections.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = ROOT / "spec" / "examples"
OUTPUT_DIR = ROOT / ".generated" / "examples"

DIR_LABELS = {
    "definitions": "Definitions",
    "world": "World",
    "narrative": "Narrative",
    "tags": "Tags",
    "types": "Types",
    "characters": "Characters",
    "locations": "Locations",
    "objects": "Objects",
    "events": "Events",
    "edges": "Edges",
    "lenses": "Lenses",
    "beats": "Beats",
    "devices": "Devices",
    "threads": "Threads",
    "formats": "Formats",
}

SECTION_ORDER = ["definitions", "world", "narrative"]

SUBSECTION_ORDER = [
    "tags", "types",
    "characters", "locations", "objects", "events", "edges",
    "lenses", "beats", "devices", "threads", "formats",
]


def slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace("'", "").replace("\u2019", "")


def yaml_section(filepath: Path) -> str:
    """Create a collapsible details section for a YAML file."""
    content = filepath.read_text().rstrip()
    return (
        f'<details>\n'
        f'<summary>{filepath.name}</summary>\n\n'
        f'```yaml\n{content}\n```\n\n'
        f'</details>\n'
    )


def sort_key(name: str, order: list[str]) -> int:
    try:
        return order.index(name)
    except ValueError:
        return 999


def generate_example_page(example_dir: Path) -> str:
    """Generate a markdown page for a single example."""
    parts: list[str] = []

    readme = example_dir / "README.md"
    if readme.exists():
        parts.append(readme.read_text().rstrip() + "\n")
    else:
        name = example_dir.name.replace("-", " ").title()
        parts.append(f"# {name}")

    root_yamls = sorted(example_dir.glob("*.yaml"))
    story_file = example_dir / "story.yaml"
    if story_file.exists():
        root_yamls = [story_file] + [f for f in root_yamls if f != story_file]

    if root_yamls:
        parts.append("## Root Files\n")
        for f in root_yamls:
            parts.append(yaml_section(f))

    top_dirs = sorted(
        [d for d in example_dir.iterdir() if d.is_dir()],
        key=lambda d: sort_key(d.name, SECTION_ORDER),
    )

    for top_dir in top_dirs:
        sub_dirs = sorted(
            [d for d in top_dir.iterdir() if d.is_dir()],
            key=lambda d: sort_key(d.name, SUBSECTION_ORDER),
        )
        has_subsections = bool(sub_dirs)
        index_yamls = sorted(top_dir.glob("*.yaml"))

        if not has_subsections:
            if not index_yamls:
                continue
            label = DIR_LABELS.get(top_dir.name, top_dir.name.title())
            parts.append(f"## {label}\n")
            for f in index_yamls:
                parts.append(yaml_section(f))
        else:
            label = DIR_LABELS.get(top_dir.name, top_dir.name.title())
            parts.append(f"## {label}\n")
            for f in index_yamls:
                parts.append(yaml_section(f))
            for sub_dir in sub_dirs:
                sub_yamls = sorted(sub_dir.glob("*.yaml"))
                if not sub_yamls:
                    continue
                sub_label = DIR_LABELS.get(sub_dir.name, sub_dir.name.title())
                parts.append(f"### {sub_label}\n")
                for f in sub_yamls:
                    parts.append(yaml_section(f))

    return "\n".join(parts) + "\n"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for example_dir in sorted(EXAMPLES_DIR.iterdir()):
        if not example_dir.is_dir():
            continue
        if not (example_dir / "story.yaml").exists():
            continue

        readme = example_dir / "README.md"
        name = example_dir.name.replace("-", " ").title()
        if readme.exists():
            first_line = readme.read_text().splitlines()[0]
            if first_line.startswith("# "):
                name = first_line[2:].strip()

        doc_name = slug(name)
        output_file = OUTPUT_DIR / f"{doc_name}.md"
        content = generate_example_page(example_dir)
        output_file.write_text(content)
        print(f"\u2713 {doc_name}.md")

    print(f"\nExample docs generated in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
