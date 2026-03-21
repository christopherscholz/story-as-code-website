#!/usr/bin/env bash
# Generate schema reference documentation from JSON schemas
# using json-schema-for-humans.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_DIR="$ROOT_DIR/spec/schemas"
OUTPUT_DIR="$ROOT_DIR/.generated/schemas"

mkdir -p "$OUTPUT_DIR"

find "$SCHEMA_DIR" -name '*.schema.json' | sort | while read -r schema_file; do
  name="$(basename "$schema_file" .schema.json)"
  output_file="$OUTPUT_DIR/${name}.md"

  python3 -m json_schema_for_humans.cli \
    "$schema_file" "$output_file" \
    --config template_name=md \
    --config show_toc=false \
    --config show_breadcrumbs=false \
    --config examples_as_yaml=true \
    --config with_footer=false \
    2>/dev/null

  echo "✓ ${name}.md"
done

echo ""
echo "Schema docs generated in $OUTPUT_DIR"
