# Story as Code — Website

Documentation website for the [Story as Code](https://story-as-code.dev/) specification — a declarative YAML format for defining worlds as temporal graphs.

**Live site:** [story-as-code.dev](https://story-as-code.dev/)

## Tech Stack

- [Astro](https://astro.build/) — static site generator
- [Tailwind CSS v4](https://tailwindcss.com/) — styling
- [Pagefind](https://pagefind.app/) — full-text search
- TypeScript

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

## Build

The build is a two-stage process:

**1. Generate content from the spec submodule**

```bash
npm run generate
```

Reads from `spec/` (git submodule) and writes generated schema docs, example docs, and story data to `.generated/`.

**2. Prepare Astro content collections**

```bash
npm run prepare-content
```

Populates `src/content/` and `public/data/` from the generated output and `content/`.

**3. Build the static site**

```bash
npm run build
```

Runs the Astro build and Pagefind indexing. Output goes to `dist/`.

Or run everything at once:

```bash
npm run generate && npm run prepare-content && npm run build
```

## Project Structure

```
├── spec/           # Git submodule — the Story as Code spec
├── content/        # Hand-authored website content (Markdown)
├── scripts/        # Generation and content-preparation scripts
├── src/
│   ├── components/ # Astro components
│   ├── content/    # Astro content collections (auto-generated)
│   ├── layouts/    # Page layout templates
│   └── pages/      # Astro routes
└── public/         # Static assets
```

## Contributing

See [CONTRIBUTING](https://story-as-code.dev/contributing/) on the website or open an issue on GitHub.

## License

[Apache 2.0](LICENSE)
