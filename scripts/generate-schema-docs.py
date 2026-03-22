#!/usr/bin/env python3
"""Generate schema reference documentation from RDF ontology and SHACL shapes.

Reads spec/ontology/sac.ttl and spec/shapes/**/*.shapes.ttl,
generates .generated/schemas/{slug}.md for each entry in SHAPE_FILES.
"""
import json
import sys
from pathlib import Path

try:
    import rdflib
    from rdflib import Graph, Namespace, RDF, RDFS, OWL, XSD
    from rdflib.namespace import SH
except ImportError:
    sys.exit("rdflib is required. Install it with: pip install rdflib")

ROOT = Path(__file__).resolve().parent.parent
SPEC_ROOT = ROOT / "spec"
OUTPUT_DIR = ROOT / ".generated" / "schemas"

SAC = Namespace("https://story-as-code.dev/ontology#")
SACSH = Namespace("https://story-as-code.dev/shapes/")
SACEX = Namespace("https://story-as-code.dev/expr/")

# Map: slug → shape file (relative to spec/)
SHAPE_FILES = {
    "story": "shapes/story.shapes.ttl",
    "world": "shapes/world/world.shapes.ttl",
    "time-system": "shapes/world/time-system.shapes.ttl",
    "node": "shapes/world/node.shapes.ttl",
    "edge": "shapes/world/edge.shapes.ttl",
    "frame": "shapes/world/frame.shapes.ttl",
    "constraint": "shapes/world/constraint.shapes.ttl",
    "narrative": "shapes/narrative/narrative.shapes.ttl",
    "lens": "shapes/narrative/lens.shapes.ttl",
    "format": "shapes/narrative/format.shapes.ttl",
    "beat": "shapes/narrative/beat.shapes.ttl",
    "device": "shapes/narrative/device.shapes.ttl",
    "thread": "shapes/narrative/thread.shapes.ttl",
    "variant-meta": "shapes/narrative/variant-meta.shapes.ttl",
    "definitions": "shapes/definitions/definitions.shapes.ttl",
    "tag": "shapes/definitions/tag.shapes.ttl",
    "type": "shapes/definitions/type.shapes.ttl",
    "value": "shapes/definitions/value.shapes.ttl",
    "derivation": "shapes/derivation/derivation.shapes.ttl",
    "rendering": "shapes/derivation/rendering.shapes.ttl",
    "section": "shapes/derivation/section.shapes.ttl",
    "passage": "shapes/derivation/passage.shapes.ttl",
    "derivation-meta": "shapes/derivation-meta.shapes.ttl",
}

# Map: slug → path components under spec/examples/*/
EXAMPLE_DIRS: dict[str, list[str]] = {
    "lens": ["narrative", "lenses"],
    "beat": ["narrative", "beats"],
    "device": ["narrative", "devices"],
    "thread": ["narrative", "threads"],
    "format": ["narrative", "formats"],
    "node": ["world", "characters"],
    "edge": ["world", "edges"],
}


def build_context_reverse_map() -> dict:
    """Parse sac.context.jsonld and build full_URI → compact_name map."""
    ctx_path = SPEC_ROOT / "context" / "sac.context.jsonld"
    ctx = json.loads(ctx_path.read_text())["@context"]

    # Collect prefix bindings (string values that end with # or /)
    prefixes = {}
    for k, v in ctx.items():
        if isinstance(v, str) and (v.endswith("#") or v.endswith("/")):
            prefixes[k + ":"] = v

    def expand(curie: str) -> str:
        for prefix, uri in prefixes.items():
            if curie.startswith(prefix):
                return uri + curie[len(prefix):]
        return curie

    reverse: dict = {}
    for compact, value in ctx.items():
        if compact.startswith("@"):
            continue
        if isinstance(value, str) and ":" in value and not value.startswith("@"):
            full = expand(value)
            if full not in reverse:
                reverse[full] = compact
        elif isinstance(value, dict) and "@id" in value:
            raw_id = value["@id"]
            if ":" in raw_id:
                full = expand(raw_id)
                if full not in reverse:
                    reverse[full] = compact
    return reverse


def shape_local_name(shape_iri) -> str:
    """Extract local name from a shape IRI, stripping 'Shape' suffix."""
    raw = str(shape_iri)
    local = raw.split("/")[-1].split("#")[-1]
    return local.replace("Shape", "")


def type_label(g: Graph, prop_node, ctx_map: dict) -> str:
    """Derive a human-readable type label for a SHACL property constraint."""
    datatype = g.value(prop_node, SH.datatype)
    node_kind = g.value(prop_node, SH.nodeKind)
    sh_class = g.value(prop_node, SH["class"])
    sh_node = g.value(prop_node, SH.node)
    sh_in = g.value(prop_node, SH["in"])

    if sh_in is not None:
        # Collect allowed values from rdf:List
        values = []
        cur = sh_in
        while cur and cur != RDF.nil:
            first = g.value(cur, RDF.first)
            if first:
                values.append(str(first).split("#")[-1].split("/")[-1])
            cur = g.value(cur, RDF.rest)
        if values:
            return "enum: " + ", ".join(f"`{v}`" for v in values)

    if datatype:
        local = str(datatype).split("#")[-1].split("/")[-1]
        mapping = {"string": "string", "boolean": "boolean",
                   "double": "number", "integer": "integer",
                   "JSON": "JSON object"}
        return mapping.get(local, local)

    if sh_class:
        local = str(sh_class).split("#")[-1]
        compact = ctx_map.get(str(sh_class), local)
        return f"[{compact}]()"

    if sh_node:
        local = shape_local_name(sh_node)
        anchor = local.lower()
        return f"object ([{local}](#{anchor}))"

    if node_kind:
        local = str(node_kind).split("#")[-1]
        if local == "IRI":
            return "IRI"
        if local == "BlankNodeOrIRI":
            return "IRI or object"

    return "any"


def ordered_sub_shapes(g: Graph, primary_shape) -> list:
    """BFS traversal of sub-shapes referenced via sh:node from a primary shape."""
    seen = {str(primary_shape)}
    order = []
    queue = [primary_shape]
    while queue:
        current = queue.pop(0)
        for prop_node in g.objects(current, SH["property"]):
            sh_node = g.value(prop_node, SH.node)
            if sh_node and str(sh_node) not in seen:
                seen.add(str(sh_node))
                order.append(sh_node)
                queue.append(sh_node)
    return order


def generate_shape_section(g: Graph, shape, ctx_map: dict) -> list[str]:
    """Generate markdown lines for a single shape section (heading + table)."""
    local = shape_local_name(shape)
    target = g.value(shape, SH.targetClass)
    comment = str(g.value(target, RDFS.comment) or "") if target else ""

    # Collect properties
    props = []
    for prop_node in g.objects(shape, SH["property"]):
        path = g.value(prop_node, SH["path"])
        if path is None:
            continue
        path_uri = str(path)
        compact = ctx_map.get(path_uri, path_uri.split("#")[-1])

        min_count = g.value(prop_node, SH.minCount)
        required = "✓" if (min_count and int(min_count) >= 1) else ""

        max_count = g.value(prop_node, SH.maxCount)
        multi = "" if (max_count and int(max_count) == 1) else " (multi)"

        type_str = type_label(g, prop_node, ctx_map) + multi
        desc = str(g.value(path, RDFS.comment) or "")

        props.append((compact, type_str, required, desc))

    if not props and not comment:
        return []

    lines: list[str] = []
    lines.append(f"## {local}\n")
    if comment:
        lines.append(f"{comment}\n")
    if props:
        lines.append("| Property | Type | Required | Description |")
        lines.append("|---|---|:---:|---|")
        for compact, type_str, req, desc in props:
            lines.append(f"| `{compact}` | {type_str} | {req} | {desc} |")
        lines.append("")
    return lines


def find_example(slug: str) -> str | None:
    """Return the content of the first available example JSON-LD for this slug."""
    path_parts = EXAMPLE_DIRS.get(slug)
    if not path_parts:
        return None
    examples_root = SPEC_ROOT / "examples"
    for example_dir in sorted(examples_root.iterdir()):
        if not example_dir.is_dir():
            continue
        target_dir = example_dir
        for part in path_parts:
            target_dir = target_dir / part
        if target_dir.exists():
            files = sorted(target_dir.glob("*.jsonld"))
            if files:
                return files[0].read_text()
    return None


def generate_shape_doc(slug: str, g: Graph, ctx_map: dict) -> str:
    """Generate markdown for a shape file."""
    lines: list[str] = []

    all_shapes = list(g.subjects(RDF.type, SH.NodeShape))
    primaries = [s for s in all_shapes if g.value(s, SH.targetClass) is not None]
    if not primaries:
        return ""

    # Build ordered shape list: primary shapes first, then BFS sub-shapes
    seen: set[str] = set()
    ordered = []
    for primary in primaries:
        if str(primary) not in seen:
            seen.add(str(primary))
            ordered.append(primary)
        for sub in ordered_sub_shapes(g, primary):
            if str(sub) not in seen:
                seen.add(str(sub))
                ordered.append(sub)

    # Any shapes in the file not reachable via BFS (edge case)
    for shape in all_shapes:
        if str(shape) not in seen:
            seen.add(str(shape))
            ordered.append(shape)

    for shape in ordered:
        lines.extend(generate_shape_section(g, shape, ctx_map))

    # Example section
    example = find_example(slug)
    if example:
        lines.append("## Example\n")
        lines.append("```json")
        lines.append(example.strip())
        lines.append("```")
        lines.append("")

    return "\n".join(lines)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Build context reverse map for URI → compact name
    ctx_map = build_context_reverse_map()

    # Load ontology once (for rdfs:comment on classes and properties)
    ontology = Graph()
    ontology.parse(SPEC_ROOT / "ontology" / "sac.ttl", format="turtle")

    for slug, shape_rel_path in SHAPE_FILES.items():
        shape_path = SPEC_ROOT / shape_rel_path
        if not shape_path.exists():
            print(f"  ⚠ Shape file not found: {shape_path}", file=sys.stderr)
            continue

        # Load shape file merged with ontology (for rdfs:comment lookups)
        g = Graph()
        g += ontology
        g.parse(shape_path, format="turtle")

        content = generate_shape_doc(slug, g, ctx_map)
        output_path = OUTPUT_DIR / f"{slug}.md"
        output_path.write_text(content)
        print(f"✓ {slug}.md")

    print(f"\nSchema docs generated in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
