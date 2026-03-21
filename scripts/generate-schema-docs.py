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
    "derivation-meta": "shapes/derivation-meta.shapes.ttl",
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
        local = str(sh_node).split("#")[-1].split("Shape")[0]
        return f"object ({local})"

    if node_kind:
        local = str(node_kind).split("#")[-1]
        if local == "IRI":
            return "IRI"
        if local == "BlankNodeOrIRI":
            return "IRI or object"

    return "any"


def generate_shape_doc(slug: str, g: Graph, ctx_map: dict) -> str:
    """Generate markdown for a single shape slug."""
    lines: list[str] = []

    # Find NodeShape(s) in graph
    shapes = list(g.subjects(RDF.type, SH.NodeShape))
    if not shapes:
        return ""

    for shape in shapes:
        target = g.value(shape, SH.targetClass)
        class_name = str(target).split("#")[-1] if target else slug.title()
        comment = str(g.value(target, RDFS.comment) or "") if target else ""

        if comment:
            lines.append(f"{comment}\n")

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

        if props:
            lines.append("## Properties\n")
            lines.append("| Property | Type | Required | Description |")
            lines.append("|---|---|:---:|---|")
            for compact, type_str, req, desc in props:
                lines.append(f"| `{compact}` | {type_str} | {req} | {desc} |")
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
