/* ── Minimal Cytoscape ambient types (loaded from CDN) ─────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const cytoscape: (...args: any[]) => CyCore;

interface CyCore {
  on(event: string, handler: (e: CyEvt) => void): void;
  on(event: string, selector: string, handler: (e: CyEvt) => void): void;
  elements(selector?: string): CyCol;
  nodes(selector?: string): CyCol;
  edges(selector?: string): CyCol;
  destroy(): void;
}
interface CyCol {
  not(other: CyCol | string): CyCol;
  addClass(cls: string): CyCol;
  removeClass(cls: string): CyCol;
  toggleClass(cls: string, state?: boolean): CyCol;
  forEach(fn: (el: CyEl) => void): void;
  union(other: CyCol | CyEl): CyCol;
}
interface CyEl extends CyCol {
  id(): string;
  closedNeighborhood(): CyCol;
  connectedNodes(): CyCol;
}
interface CyEvt {
  target: CyEl | CyCore;
}

/* ── Data model ────────────────────────────────────────────────────────────── */
interface Ref {
  type: string;
  id: string;
  name?: string;
  description?: string;
}
type IdOrRef = string | Ref;

interface StoryNode {
  type: string;
  id: string;
  name: string;
  nodeType: IdOrRef;
  description?: string;
  properties?: Record<string, unknown>;
  hasTag?: IdOrRef[];
}
interface StoryEdge {
  type: string;
  id: string;
  name?: string;
  edgeType: IdOrRef;
  source: IdOrRef;
  target: IdOrRef;
  description?: string;
  directed?: boolean;
  scope?: Scope;
}
interface Beat {
  type: string;
  id: string;
  name?: string;
  order?: number;
  function?: IdOrRef;
  tension?: number;
  emotionalTarget?: number;
  nodeIds?: IdOrRef[];
  edgeIds?: IdOrRef[];
  reveals?: Array<{ target: IdOrRef; degree?: string }>;
  transition?: { transitionType: IdOrRef };
  description?: string;
  parent?: string;
}
interface ThreadAppearance {
  beatId: IdOrRef;
  description?: string;
}
interface Thread {
  type: string;
  id: string;
  name?: string;
  threadType?: IdOrRef;
  description?: string;
  appearances?: ThreadAppearance[];
}
interface Device {
  type: string;
  id: string;
  name?: string;
  deviceType?: IdOrRef;
  description?: string;
  setup?: IdOrRef[];
  payoff?: IdOrRef[];
}
interface Lens {
  type: string;
  id: string;
  name?: string;
  lensType?: IdOrRef;
  perspective?: {
    perspectiveType?: IdOrRef;
    person?: IdOrRef;
    anchor?: IdOrRef;
  };
  knowledge?: {
    mode?: IdOrRef;
    includeSubconscious?: boolean;
    includeWrongBeliefs?: boolean;
  };
  temporalPosition?: { temporalType?: IdOrRef };
  emotional?: { bias?: { toward?: IdOrRef[]; biasStrength?: number } };
  voice?: {
    vocabularyLevel?: IdOrRef;
    sentenceTendency?: IdOrRef;
    metaphorDensity?: IdOrRef;
    innerMonologue?: boolean;
    verbalTics?: string[];
  };
  reliability?: {
    level?: IdOrRef;
    distorts?: Array<{ node?: IdOrRef; direction?: string }>;
  };
}
interface StructureLevel {
  structureType?: IdOrRef;
  structureConstraints?: Record<string, unknown>;
  children?: StructureLevel;
}
interface Format {
  type: string;
  id: string;
  name?: string;
  formatType?: IdOrRef;
  structure?: StructureLevel;
  formatSettings?: Record<string, unknown>;
}
interface FrameRelation {
  relationType?: IdOrRef;
  target?: IdOrRef;
  at?: string;
  description?: string;
}
interface Frame {
  type: string;
  id: string;
  name?: string;
  description?: string;
  parent?: string;
  branchesAt?: string;
  relations?: FrameRelation[];
}
interface Constraint {
  type: string;
  id: string;
  name?: string;
  description?: string;
  severity?: IdOrRef;
  scope?: Scope;
}
interface TimeSystem {
  type: string;
  id: string;
  name?: string;
  timeSystemType?: IdOrRef;
  calendar?: { unit?: string; season?: string };
}
interface Scope {
  selectorType?: string;
  selectorItem?: IdOrRef;
  and?: Scope[];
  or?: Scope[];
  not?: Scope;
  in?: Scope[];
  range?: { from?: Scope; to?: Scope; item?: string };
}
interface Story {
  type: string;
  id: string;
  name: string;
  specVersion?: string;
  world?: {
    type: string;
    id: string;
    nodes: StoryNode[];
    edges: StoryEdge[];
    frames: Frame[];
    constraints: Constraint[];
    timeSystem?: TimeSystem;
  };
  narrative?: {
    type: string;
    id: string;
    lenses: Lens[];
    beats: Beat[];
    devices: Device[];
    threads: Thread[];
    formats: Format[];
  };
}
interface StorySelection {
  kind: string;
  id: string;
}
interface ColorPair {
  light: string;
  dark: string;
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const root = document.getElementById('story-graph');
  if (!root) return;

  /* ── Colour system ─────────────────────────────────────────────────── */
  const PALETTE: string[] = [
    '#7E57C2',
    '#26A69A',
    '#FFB300',
    '#EF5350',
    '#78909C',
    '#5C6BC0',
    '#EC407A',
    '#8D6E63',
    '#66BB6A',
    '#42A5F5',
    '#AB47BC',
    '#FFA726',
    '#26C6DA',
    '#D4E157',
  ];
  const ASSIGNED: Record<string, ColorPair> = {};
  let _pi = 0;

  function colorFor(key: string): ColorPair {
    if (!key) key = '__default__';
    if (!ASSIGNED[key]) {
      ASSIGNED[key] = {
        light: PALETTE[_pi % PALETTE.length],
        dark: PALETTE[(_pi + 7) % PALETTE.length],
      };
      _pi++;
    }
    return ASSIGNED[key];
  }

  function isDark(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  function c(key: string): string {
    const pair = colorFor(key || '__default__');
    return isDark() ? pair.dark : pair.light;
  }

  /* ── Data helpers ──────────────────────────────────────────────────── */
  // Both handle resolved Ref objects {id, name, ...} AND plain string IDs.

  function typeId(t: IdOrRef | null | undefined): string {
    if (t == null) return '';
    if (typeof t === 'string') return t;
    return String(t.id ?? '');
  }

  function typeName(t: IdOrRef | null | undefined): string {
    if (t == null) return '';
    if (typeof t === 'string') return t;
    return String(t.name ?? t.id ?? '');
  }

  function esc(s: unknown): string {
    const str = typeof s === 'string' ? s : String(s ?? '');
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function trunc(s: string | null | undefined, n: number): string {
    const str = s ?? '';
    return str.length > n ? str.slice(0, n - 1) + '\u2026' : str;
  }

  /* ── SVG helpers ───────────────────────────────────────────────────── */
  function createSVG(w: number, h: number): SVGSVGElement {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', String(w));
    s.setAttribute('height', String(h));
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.style.width = '100%';
    s.style.overflow = 'visible';
    return s;
  }

  function svgEl<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs?: Record<string, string | number>,
  ): SVGElementTagNameMap[K] {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  /* ── State ─────────────────────────────────────────────────────────── */
  let story: Story | null = null;
  let selected: StorySelection | null = null;
  const listeners: Array<(sel: StorySelection | null) => void> = [];

  function select(sel: StorySelection | null): void {
    if (
      selected &&
      sel &&
      selected.kind === sel.kind &&
      selected.id === sel.id
    ) {
      selected = null;
    } else {
      selected = sel;
    }
    for (const fn of listeners) fn(selected);
  }

  function onSelect(fn: (sel: StorySelection | null) => void): void {
    listeners.push(fn);
  }

  /* ── Relevance engine ──────────────────────────────────────────────── */
  function relatedIds(sel: StorySelection | null): {
    nodes: Set<string>;
    edges: Set<string>;
    beats: Set<string>;
    threads: Set<string>;
    devices: Set<string>;
    lenses: Set<string>;
  } | null {
    if (!sel || !story) return null;

    const ids = {
      nodes: new Set<string>(),
      edges: new Set<string>(),
      beats: new Set<string>(),
      threads: new Set<string>(),
      devices: new Set<string>(),
      lenses: new Set<string>(),
    };

    const nodes = story.world?.nodes ?? [];
    const edges = story.world?.edges ?? [];
    const beats = story.narrative?.beats ?? [];
    const threads = story.narrative?.threads ?? [];
    const devices = story.narrative?.devices ?? [];
    const lenses = story.narrative?.lenses ?? [];

    if (sel.kind === 'node') {
      ids.nodes.add(sel.id);
      for (const e of edges) {
        if (typeId(e.source) === sel.id || typeId(e.target) === sel.id) {
          ids.edges.add(e.id);
          ids.nodes.add(typeId(e.source));
          ids.nodes.add(typeId(e.target));
        }
      }
      for (const b of beats) {
        if ((b.nodeIds ?? []).some((n) => typeId(n) === sel.id))
          ids.beats.add(b.id);
      }
      for (const l of lenses) {
        if (
          typeId(l.perspective?.anchor) === sel.id ||
          (l.emotional?.bias?.toward ?? []).some((n) => typeId(n) === sel.id) ||
          (l.reliability?.distorts ?? []).some((d) => typeId(d.node) === sel.id)
        )
          ids.lenses.add(l.id);
      }
    } else if (sel.kind === 'edge') {
      const edge = edges.find((e) => e.id === sel.id);
      if (edge) {
        ids.edges.add(sel.id);
        ids.nodes.add(typeId(edge.source));
        ids.nodes.add(typeId(edge.target));
      }
      for (const b of beats) {
        if ((b.edgeIds ?? []).some((e) => typeId(e) === sel.id))
          ids.beats.add(b.id);
      }
    } else if (sel.kind === 'beat') {
      ids.beats.add(sel.id);
      const beat = beats.find((b) => b.id === sel.id);
      if (beat) {
        for (const n of beat.nodeIds ?? []) ids.nodes.add(typeId(n));
        for (const eRef of beat.edgeIds ?? []) {
          const eid = typeId(eRef);
          ids.edges.add(eid);
          const e = edges.find((edge) => edge.id === eid);
          if (e) {
            ids.nodes.add(typeId(e.source));
            ids.nodes.add(typeId(e.target));
          }
        }
      }
      for (const t of threads) {
        if ((t.appearances ?? []).some((a) => typeId(a.beatId) === sel.id))
          ids.threads.add(t.id);
      }
      for (const d of devices) {
        if (
          (d.setup ?? []).some((b) => typeId(b) === sel.id) ||
          (d.payoff ?? []).some((b) => typeId(b) === sel.id)
        )
          ids.devices.add(d.id);
      }
    } else if (sel.kind === 'thread') {
      ids.threads.add(sel.id);
      const thread = threads.find((t) => t.id === sel.id);
      if (thread) {
        for (const a of thread.appearances ?? []) {
          const bid = typeId(a.beatId);
          ids.beats.add(bid);
          const b = beats.find((beat) => beat.id === bid);
          if (b) for (const n of b.nodeIds ?? []) ids.nodes.add(typeId(n));
        }
      }
    } else if (sel.kind === 'device') {
      ids.devices.add(sel.id);
      const dev = devices.find((d) => d.id === sel.id);
      if (dev) {
        for (const beatRef of [...(dev.setup ?? []), ...(dev.payoff ?? [])]) {
          const bid = typeId(beatRef);
          ids.beats.add(bid);
          const b = beats.find((beat) => beat.id === bid);
          if (b) for (const n of b.nodeIds ?? []) ids.nodes.add(typeId(n));
        }
      }
    } else if (sel.kind === 'lens') {
      ids.lenses.add(sel.id);
      const lens = lenses.find((l) => l.id === sel.id);
      if (lens) {
        if (lens.perspective?.anchor)
          ids.nodes.add(typeId(lens.perspective.anchor));
        for (const n of lens.emotional?.bias?.toward ?? [])
          ids.nodes.add(typeId(n));
        for (const d of lens.reliability?.distorts ?? []) {
          if (d.node) ids.nodes.add(typeId(d.node));
        }
      }
    } else if (sel.kind === 'frame') {
      for (const e of edges) {
        if (!e.scope || scopeRefFrame(e.scope, sel.id)) {
          ids.edges.add(e.id);
          ids.nodes.add(typeId(e.source));
          ids.nodes.add(typeId(e.target));
        }
      }
    }
    // silence unused-var for nodes array (only used indirectly via edges)
    void nodes;
    return ids;
  }

  /* ── Data loading ──────────────────────────────────────────────────── */
  const src = root.getAttribute('data-src');
  if (!src) {
    root.innerHTML =
      '<p style="color:var(--color-fg-secondary)">No data-src attribute.</p>';
    return;
  }

  fetch(src)
    .then((r) => r.json())
    .then((data: Story) => {
      story = data;
      init();
    })
    .catch((err: Error) => {
      root.innerHTML = `<p style="color:#EF5350;padding:1rem">Failed to load story: ${esc(err.message)}</p>`;
    });

  /* ── Init ──────────────────────────────────────────────────────────── */
  let cy: CyCore | null = null;

  function init(): void {
    if (!story) return;
    // Pre-assign colours for all known types so they stay stable across re-renders
    for (const nd of story.world?.nodes ?? []) colorFor(typeId(nd.nodeType));
    for (const e of story.world?.edges ?? []) colorFor(typeId(e.edgeType));
    for (const b of story.narrative?.beats ?? [])
      if (b.function) colorFor(typeId(b.function));
    for (const d of story.narrative?.devices ?? [])
      if (d.deviceType) colorFor(typeId(d.deviceType));
    for (const con of story.world?.constraints ?? [])
      if (con.severity) colorFor(typeId(con.severity));

    renderAll();

    new MutationObserver(() => {
      if (cy) {
        cy.destroy();
        cy = null;
      }
      listeners.length = 0;
      renderAll();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  function renderAll(): void {
    listeners.length = 0;
    setupDetailPanel();
    root!.querySelectorAll('.graph-section').forEach((sec) => {
      const content = (sec as HTMLElement).querySelector(
        '.section-content',
      ) as HTMLElement | null;
      if (!content) return;
      content.innerHTML = '';
      const view = (sec as HTMLElement).dataset['view'];
      switch (view) {
        case 'world':
          renderWorld(content);
          break;
        case 'narrative':
          renderNarrative(content);
          break;
        case 'timeline':
          renderTimeline(content);
          break;
        case 'lenses':
          renderLenses(content);
          break;
        case 'formats':
          renderFormats(content);
          break;
        case 'constraints':
          renderConstraints(content);
          break;
      }
    });
  }

  /* ── Detail panel ──────────────────────────────────────────────────── */
  function setupDetailPanel(): void {
    onSelect((sel) => {
      const dp = root!.querySelector('#detail-panel') as HTMLElement | null;
      if (!dp) return;
      if (!sel) {
        dp.innerHTML = '';
        dp.classList.remove('open');
        return;
      }

      dp.classList.add('open');
      const w = story?.world;
      const n = story?.narrative;
      let html = '';

      if (sel.kind === 'node') {
        const nd = (w?.nodes ?? []).find((x) => x.id === sel.id);
        if (nd) html = nodeDetailHTML(nd);
      } else if (sel.kind === 'edge') {
        const e = (w?.edges ?? []).find((x) => x.id === sel.id);
        if (e) html = edgeDetailHTML(e);
      } else if (sel.kind === 'beat') {
        const b = (n?.beats ?? []).find((x) => x.id === sel.id);
        if (b) html = beatDetailHTML(b);
      } else if (sel.kind === 'thread') {
        const t = (n?.threads ?? []).find((x) => x.id === sel.id);
        if (t) html = threadDetailHTML(t);
      } else if (sel.kind === 'device') {
        const d = (n?.devices ?? []).find((x) => x.id === sel.id);
        if (d) html = deviceDetailHTML(d);
      } else if (sel.kind === 'lens') {
        const l = (n?.lenses ?? []).find((x) => x.id === sel.id);
        if (l) html = lensCardHTML(l);
      } else if (sel.kind === 'frame') {
        const f = (w?.frames ?? []).find((x) => x.id === sel.id);
        if (f) html = frameDetailHTML(f);
      }

      dp.innerHTML = `<button class="detail-close">&times;</button>${html}`;
      dp.querySelector('.detail-close')?.addEventListener('click', () =>
        select(null),
      );
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     VIEW 1 — WORLD GRAPH (Cytoscape)
  ══════════════════════════════════════════════════════════════════════ */
  function renderWorld(container: HTMLElement): void {
    const nodes = story?.world?.nodes ?? [];
    const edges = story?.world?.edges ?? [];

    /* Filter bar */
    const filterBar = document.createElement('div');
    filterBar.className = 'world-filters';

    const nodeTypes = [
      ...new Set(nodes.map((nd) => typeId(nd.nodeType))),
    ].filter(Boolean);
    const edgeTypes = [...new Set(edges.map((e) => typeId(e.edgeType)))].filter(
      Boolean,
    );
    const ntNames: Record<string, string> = {};
    const etNames: Record<string, string> = {};
    nodes.forEach((nd) => {
      ntNames[typeId(nd.nodeType)] = typeName(nd.nodeType);
    });
    edges.forEach((e) => {
      etNames[typeId(e.edgeType)] = typeName(e.edgeType);
    });

    filterBar.innerHTML =
      '<span class="filter-label">Nodes:</span>' +
      nodeTypes
        .map(
          (t) =>
            `<label class="filter-chip" style="--chip-color:${c(t)}">` +
            `<input type="checkbox" checked data-kind="node" data-type="${esc(t)}"> ${esc(ntNames[t] || t)}</label>`,
        )
        .join('') +
      '<span class="filter-label">Edges:</span>' +
      edgeTypes
        .map(
          (t) =>
            `<label class="filter-chip" style="--chip-color:${c(t)}">` +
            `<input type="checkbox" checked data-kind="edge" data-type="${esc(t)}"> ${esc(etNames[t] || t)}</label>`,
        )
        .join('');
    container.appendChild(filterBar);

    const cyDiv = document.createElement('div');
    cyDiv.className = 'cy-container';
    container.appendChild(cyDiv);

    /* Deterministic initial layout: type groups around a circle */
    const typeGroups: Record<string, StoryNode[]> = {};
    nodes.forEach((nd) => {
      const nt = typeId(nd.nodeType);
      (typeGroups[nt] ??= []).push(nd);
    });
    const typeKeys = Object.keys(typeGroups);
    const initPos: Record<string, { x: number; y: number }> = {};
    const R = 260;
    typeKeys.forEach((type, ti) => {
      const angle = (2 * Math.PI * ti) / typeKeys.length - Math.PI / 2;
      const cx = R * Math.cos(angle);
      const groupCy = R * Math.sin(angle);
      const group = typeGroups[type];
      const spread = 44 + group.length * 18;
      group.forEach((nd, ni) => {
        const ga = (2 * Math.PI * ni) / Math.max(group.length, 1);
        initPos[nd.id] = {
          x: cx + spread * Math.cos(ga),
          y: groupCy + spread * Math.sin(ga),
        };
      });
    });

    /* CSS class names: replace non-word chars to stay valid */
    function ntCls(t: string): string {
      return 'nt-' + t.replace(/\W/g, '_');
    }
    function etCls(t: string): string {
      return 'et-' + t.replace(/\W/g, '_');
    }

    const dk = isDark();
    const textCol = dk ? '#ccc' : '#444';

    /* Elements */
    const elements: unknown[] = [];
    nodes.forEach((nd) =>
      elements.push({
        group: 'nodes',
        data: { id: nd.id, label: nd.name || nd.id, type: typeId(nd.nodeType) },
        classes: ntCls(typeId(nd.nodeType)),
        position: initPos[nd.id] ?? { x: 0, y: 0 },
      }),
    );
    edges.forEach((e) =>
      elements.push({
        group: 'edges',
        data: {
          id: e.id,
          source: typeId(e.source),
          target: typeId(e.target),
          label: e.name || '',
          type: typeId(e.edgeType),
          hasScope: e.scope ? 'yes' : '',
        },
        classes: etCls(typeId(e.edgeType)),
      }),
    );

    /* Styles */
    const styles: unknown[] = [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'font-size': 11,
          'font-family': 'Inter, system-ui, sans-serif',
          color: textCol,
          'text-valign': 'bottom',
          'text-margin-y': 6,
          width: 32,
          height: 32,
          'border-width': 2,
          'border-color': dk ? '#555' : '#ccc',
          'text-wrap': 'ellipsis',
          'text-max-width': 80,
          shape: 'ellipse',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': dk ? '#555' : '#bbb',
          'line-color': dk ? '#555' : '#bbb',
          opacity: 0.65,
          label: 'data(label)',
          'font-size': 9,
          color: dk ? '#888' : '#999',
          'text-background-color': dk ? '#1e1e1e' : '#fff',
          'text-background-opacity': 0.85,
          'text-background-padding': '2px',
        },
      },
      {
        selector: 'edge[hasScope != ""]',
        style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 3] },
      },
      { selector: '.dimmed', style: { opacity: 0.1 } },
      { selector: '.highlighted', style: { opacity: 1 } },
      { selector: '.filtered-out', style: { display: 'none' } },
    ];
    nodeTypes.forEach((t) =>
      styles.push({
        selector: '.' + ntCls(t),
        style: { 'background-color': c(t) },
      }),
    );
    edgeTypes.forEach((t) =>
      styles.push({
        selector: '.' + etCls(t),
        style: { 'line-color': c(t), 'target-arrow-color': c(t) },
      }),
    );

    cy = cytoscape({
      container: cyDiv,
      elements,
      style: styles,
      layout: { name: 'preset', fit: true, padding: 40 },
      minZoom: 0.1,
      maxZoom: 4,
    });

    cy.on('tap', 'node', (e: CyEvt) => {
      const el = e.target as CyEl;
      select({ kind: 'node', id: el.id() });
    });
    cy.on('tap', 'edge', (e: CyEvt) => {
      const el = e.target as CyEl;
      select({ kind: 'edge', id: el.id() });
    });
    cy.on('tap', (e: CyEvt) => {
      if (e.target === cy) select(null);
    });

    cy.on('mouseover', 'node', (e: CyEvt) => {
      const nb = (e.target as CyEl).closedNeighborhood();
      cy!.elements().not(nb).addClass('dimmed');
      nb.addClass('highlighted');
    });
    cy.on('mouseout', 'node', () =>
      cy!.elements().removeClass('dimmed highlighted'),
    );
    cy.on('mouseover', 'edge', (e: CyEvt) => {
      const grp = (e.target as CyEl).connectedNodes().union(e.target as CyEl);
      cy!.elements().not(grp).addClass('dimmed');
      grp.addClass('highlighted');
    });
    cy.on('mouseout', 'edge', () =>
      cy!.elements().removeClass('dimmed highlighted'),
    );

    onSelect((sel) => {
      if (!cy) return;
      cy.elements().removeClass('dimmed highlighted');
      const rel = relatedIds(sel);
      if (!rel) return;
      cy.nodes().forEach((nd) => {
        if (!rel.nodes.has(nd.id())) nd.addClass('dimmed');
      });
      cy.edges().forEach((e) => {
        if (!rel.edges.has(e.id())) e.addClass('dimmed');
      });
    });

    filterBar
      .querySelectorAll<HTMLInputElement>('input[type=checkbox]')
      .forEach((cb) => {
        cb.addEventListener('change', () => {
          const kind = (cb as HTMLInputElement).dataset['kind'] ?? '';
          const type = (cb as HTMLInputElement).dataset['type'] ?? '';
          const cls = '.' + (kind === 'node' ? ntCls(type) : etCls(type));
          if (cy)
            (kind === 'node' ? cy.nodes(cls) : cy.edges(cls)).toggleClass(
              'filtered-out',
              !cb.checked,
            );
        });
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     VIEW 2 — NARRATIVE FLOW
  ══════════════════════════════════════════════════════════════════════ */
  function renderNarrative(container: HTMLElement): void {
    const n = story?.narrative;
    const beats = (n?.beats ?? [])
      .filter((b) => b.order != null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const threads = n?.threads ?? [];
    const devices = n?.devices ?? [];

    if (!beats.length) {
      container.innerHTML =
        '<p class="empty-msg">No beats with order defined.</p>';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'narrative-scroll narrative-vertical';
    container.appendChild(wrapper);

    const availW = wrapper.clientWidth || 420;
    const PAD = 14;
    const devMargin = devices.length > 0 ? devices.length * 16 + 16 : 0;
    const tensionW = 32;
    const threadW = 18;
    const threadsW = threads.length * threadW;
    const CARD_W = Math.max(
      160,
      availW - devMargin - tensionW - threadsW - PAD * 2 - 20,
    );
    const CARD_H = 56;
    const GAP = 10;
    const totalH = beats.length * (CARD_H + GAP) - GAP + PAD * 2;
    const cardX = devMargin + tensionW + PAD;

    const svg = createSVG(availW, totalH);
    wrapper.appendChild(svg);

    const dk = isDark();
    const beatY = (i: number): number => PAD + i * (CARD_H + GAP) + CARD_H / 2;
    const tensX = PAD + devMargin;

    /* Tension axis */
    svg.appendChild(
      svgEl('line', {
        x1: tensX + tensionW,
        y1: PAD,
        x2: tensX + tensionW,
        y2: totalH - PAD,
        stroke: dk ? '#444' : '#ddd',
        'stroke-width': 1,
      }),
    );

    /* Tension curve */
    let tensPath = '';
    beats.forEach((b, i) => {
      const x = tensX + tensionW - (b.tension ?? 0) * (tensionW - 4);
      const y = beatY(i);
      tensPath += (i === 0 ? 'M' : 'L') + `${x},${y}`;
      svg.appendChild(
        svgEl('circle', {
          cx: x,
          cy: y,
          r: 3,
          fill: c(typeId(b.function) || '__default__'),
        }),
      );
    });
    if (tensPath)
      svg.appendChild(
        svgEl('path', {
          d: tensPath,
          fill: 'none',
          stroke: dk ? '#B39DDB' : '#7E57C2',
          'stroke-width': 2,
          'stroke-linejoin': 'round',
        }),
      );
    const tLbl = svgEl('text', {
      x: tensX + 2,
      y: PAD - 6,
      fill: dk ? '#666' : '#bbb',
      'font-size': 9,
    });
    tLbl.textContent = 'tension';
    svg.appendChild(tLbl);

    /* Beat cards */
    beats.forEach((b, i) => {
      const x = cardX;
      const y = PAD + i * (CARD_H + GAP);
      const funcKey = typeId(b.function) || '__default__';
      const funcCol = c(funcKey);
      const funcLbl = typeName(b.function).replace(/_/g, ' ');
      const emColor =
        b.emotionalTarget != null
          ? b.emotionalTarget < 0
            ? `rgba(66,165,245,${Math.abs(b.emotionalTarget) * 0.18})`
            : `rgba(255,167,38,${b.emotionalTarget * 0.18})`
          : 'transparent';

      const g = svgEl('g', {
        class: 'beat-card',
        'data-beat': b.id,
        cursor: 'pointer',
      });
      g.addEventListener('click', () => select({ kind: 'beat', id: b.id }));

      g.appendChild(
        svgEl('rect', {
          x,
          y,
          width: CARD_W,
          height: CARD_H,
          rx: 5,
          fill: dk ? '#2a2a2a' : '#fff',
          stroke: funcCol,
          'stroke-width': 1.5,
        }),
      );
      g.appendChild(
        svgEl('rect', {
          x: x + 1,
          y: y + 1,
          width: CARD_W - 2,
          height: CARD_H - 2,
          rx: 4,
          fill: emColor,
        }),
      );

      const nameT = svgEl('text', {
        x: x + 8,
        y: y + 17,
        fill: dk ? '#ddd' : '#333',
        'font-size': 11,
        'font-weight': 600,
      });
      nameT.textContent = trunc(b.name || b.id, 30);
      g.appendChild(nameT);

      const orderT = svgEl('text', {
        x: x + CARD_W - 8,
        y: y + 17,
        fill: dk ? '#666' : '#bbb',
        'font-size': 10,
        'text-anchor': 'end',
      });
      orderT.textContent = `#${b.order}`;
      g.appendChild(orderT);

      if (funcLbl) {
        const bw = funcLbl.length * 5.2 + 10;
        g.appendChild(
          svgEl('rect', {
            x: x + 7,
            y: y + 24,
            width: bw,
            height: 13,
            rx: 2,
            fill: funcCol,
          }),
        );
        const fT = svgEl('text', {
          x: x + 10,
          y: y + 33,
          fill: '#fff',
          'font-size': 8,
          'font-weight': 600,
        });
        fT.textContent = funcLbl;
        g.appendChild(fT);
      }

      /* Tension bar */
      const barW = (CARD_W - 10) * (b.tension ?? 0);
      g.appendChild(
        svgEl('rect', {
          x: x + 5,
          y: y + CARD_H - 9,
          width: CARD_W - 10,
          height: 3,
          rx: 1.5,
          fill: dk ? '#444' : '#eee',
        }),
      );
      g.appendChild(
        svgEl('rect', {
          x: x + 5,
          y: y + CARD_H - 9,
          width: barW,
          height: 3,
          rx: 1.5,
          fill: funcCol,
        }),
      );

      if (b.reveals?.length) {
        const revT = svgEl('text', {
          x: x + CARD_W - 8,
          y: y + CARD_H - 13,
          fill: dk ? '#FFD54F' : '#FF8F00',
          'font-size': 9,
          'text-anchor': 'end',
        });
        revT.textContent = `${b.reveals.length} reveal${b.reveals.length > 1 ? 's' : ''}`;
        g.appendChild(revT);
      }

      svg.appendChild(g);

      if (i < beats.length - 1) {
        const ax = x + CARD_W / 2,
          ay = y + CARD_H + 1;
        svg.appendChild(
          svgEl('line', {
            x1: ax,
            y1: ay,
            x2: ax,
            y2: ay + GAP - 2,
            stroke: dk ? '#555' : '#ccc',
            'stroke-width': 1,
          }),
        );
        svg.appendChild(
          svgEl('polygon', {
            points: `${ax - 3},${ay + GAP - 4} ${ax},${ay + GAP} ${ax + 3},${ay + GAP - 4}`,
            fill: dk ? '#555' : '#ccc',
          }),
        );
        if (b.transition) {
          const tl = svgEl('text', {
            x: ax + 4,
            y: ay + GAP / 2 + 2,
            fill: dk ? '#555' : '#bbb',
            'font-size': 9,
          });
          tl.textContent = typeName(b.transition.transitionType);
          svg.appendChild(tl);
        }
      }
    });

    /* Thread columns */
    const TCOLS = [
      dk ? '#F48FB1' : '#EC407A',
      dk ? '#90CAF9' : '#42A5F5',
      dk ? '#A5D6A7' : '#66BB6A',
      dk ? '#FFE082' : '#FFB300',
      dk ? '#CE93D8' : '#AB47BC',
    ];
    const threadBaseX = cardX + CARD_W + 16;
    threads.forEach((thread, ti) => {
      const x = threadBaseX + ti * threadW;
      const col = TCOLS[ti % TCOLS.length];
      svg.appendChild(
        svgEl('line', {
          x1: x,
          y1: PAD,
          x2: x,
          y2: totalH - PAD,
          stroke: col,
          'stroke-width': 1,
          opacity: 0.2,
        }),
      );
      const lbl = svgEl('text', {
        x: x + 3,
        y: PAD - 4,
        fill: col,
        'font-size': 9,
        cursor: 'pointer',
        transform: `rotate(-45 ${x + 3} ${PAD - 4})`,
      });
      lbl.textContent = trunc(thread.name, 14);
      lbl.addEventListener('click', () =>
        select({ kind: 'thread', id: thread.id }),
      );
      svg.appendChild(lbl);

      const apps = (thread.appearances ?? [])
        .map((a) => ({
          ...a,
          idx: beats.findIndex((b) => b.id === typeId(a.beatId)),
        }))
        .filter((a) => a.idx >= 0)
        .sort((a, b) => a.idx - b.idx);
      let lp = '';
      apps.forEach((a, ai) => {
        const cy2 = beatY(a.idx);
        lp += (ai === 0 ? 'M' : 'L') + `${x},${cy2}`;
        const dot = svgEl('circle', {
          cx: x,
          cy: cy2,
          r: 4,
          fill: col,
          cursor: 'pointer',
          class: 'thread-dot',
          'data-thread': thread.id,
        });
        dot.innerHTML = `<title>${esc(a.description || typeName(a.beatId) || typeId(a.beatId))}</title>`;
        dot.addEventListener('click', (ev) => {
          ev.stopPropagation();
          select({ kind: 'thread', id: thread.id });
        });
        svg.appendChild(dot);
      });
      if (lp)
        svg.insertBefore(
          svgEl('path', {
            d: lp,
            fill: 'none',
            stroke: col,
            'stroke-width': 1.5,
            opacity: 0.4,
          }),
          svg.querySelector('.beat-card'),
        );
    });

    /* Device brackets */
    const bracketBaseX = PAD + devMargin - 4;
    devices.forEach((dev, di) => {
      const siIdxs = (dev.setup ?? [])
        .map((s) => beats.findIndex((b) => b.id === typeId(s)))
        .filter((i) => i >= 0);
      const piIdxs = (dev.payoff ?? [])
        .map((p) => beats.findIndex((b) => b.id === typeId(p)))
        .filter((i) => i >= 0);
      const col = c(typeId(dev.deviceType) || '__default__');
      const bx = bracketBaseX - di * 14;
      siIdxs.forEach((si) =>
        piIdxs.forEach((pi) => {
          const y1 = beatY(si),
            y2 = beatY(pi);
          const g = svgEl('g', {
            class: 'device-arc',
            'data-device': dev.id,
            cursor: 'pointer',
            'pointer-events': 'all',
          });
          g.addEventListener('click', (ev) => {
            ev.stopPropagation();
            select({ kind: 'device', id: dev.id });
          });
          g.appendChild(
            svgEl('rect', {
              x: bx - 10,
              y: y1 - 4,
              width: 22,
              height: y2 - y1 + 8,
              fill: 'transparent',
            }),
          );
          g.appendChild(
            svgEl('line', {
              x1: bx + 8,
              y1,
              x2: bx,
              y2: y1,
              stroke: col,
              'stroke-width': 1.5,
            }),
          );
          g.appendChild(
            svgEl('line', {
              x1: bx,
              y1,
              x2: bx,
              y2,
              stroke: col,
              'stroke-width': 1.5,
            }),
          );
          g.appendChild(
            svgEl('line', {
              x1: bx,
              y1: y2,
              x2: bx + 8,
              y2,
              stroke: col,
              'stroke-width': 1.5,
            }),
          );
          g.appendChild(
            svgEl('polygon', {
              points: `${bx + 5},${y2 - 2} ${bx + 9},${y2} ${bx + 5},${y2 + 2}`,
              fill: col,
            }),
          );
          const lbl = svgEl('text', {
            x: bx - 4,
            y: (y1 + y2) / 2 + 3,
            fill: col,
            'font-size': 8,
            'text-anchor': 'end',
            transform: `rotate(-90 ${bx - 4} ${(y1 + y2) / 2 + 3})`,
          });
          lbl.textContent = typeName(dev.deviceType);
          g.appendChild(lbl);
          svg.appendChild(g);
        }),
      );
    });

    /* Selection highlight */
    onSelect((sel) => {
      const rel = relatedIds(sel);
      svg.querySelectorAll('.beat-card').forEach((g) => {
        const id = g.getAttribute('data-beat') ?? '';
        g.classList.toggle('greyed', rel != null && !rel.beats.has(id));
        g.classList.toggle('sel-highlight', rel != null && rel.beats.has(id));
      });
      svg.querySelectorAll('.device-arc').forEach((a) => {
        const id = a.getAttribute('data-device') ?? '';
        a.classList.toggle('greyed', rel != null && !rel.devices.has(id));
      });
      svg.querySelectorAll('.thread-dot').forEach((d) => {
        const id = d.getAttribute('data-thread') ?? '';
        d.classList.toggle('greyed', rel != null && !rel.threads.has(id));
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     VIEW 3 — TIMELINE & FRAMES
  ══════════════════════════════════════════════════════════════════════ */
  function renderTimeline(container: HTMLElement): void {
    const w = story?.world;
    const ts = w?.timeSystem;
    const frames = w?.frames ?? [];

    if (!ts && !frames.length) {
      container.innerHTML =
        '<p class="empty-msg">No time system or frames defined.</p>';
      return;
    }

    const timePoints = new Set<string>();
    (w?.edges ?? []).forEach((e) => {
      if (e.scope) collectTimePoints(e.scope, timePoints);
    });
    frames.forEach((f) => {
      if (f.branchesAt) timePoints.add(f.branchesAt);
      (f.relations ?? []).forEach((r) => {
        if (r.at) timePoints.add(r.at);
      });
    });
    const sorted = [...timePoints].sort();

    const PAD = 50;
    const axisY = 60;
    const FRAME_H = 30;
    const FRAME_GAP = 12;
    const frameLaneY = axisY + 30;
    const WIDTH = Math.max(500, sorted.length * 120 + PAD * 2);
    const totalH =
      frameLaneY + (frames.length + 1) * (FRAME_H + FRAME_GAP) + PAD;

    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-scroll';
    container.appendChild(wrapper);

    const svg = createSVG(WIDTH, totalH);
    wrapper.appendChild(svg);

    const dk = isDark();
    const tpX = (tp: string): number => {
      const idx = sorted.indexOf(tp);
      return idx >= 0
        ? PAD + (idx + 0.5) * ((WIDTH - PAD * 2) / Math.max(sorted.length, 1))
        : PAD;
    };

    /* Header */
    if (ts) {
      const titleT = svgEl('text', {
        x: PAD,
        y: 22,
        fill: dk ? '#ddd' : '#333',
        'font-size': 14,
        'font-weight': 600,
      });
      titleT.textContent = ts.name || 'Timeline';
      svg.appendChild(titleT);
      const subT = svgEl('text', {
        x: PAD,
        y: 36,
        fill: dk ? '#777' : '#999',
        'font-size': 10,
      });
      subT.textContent =
        typeName(ts.timeSystemType) +
        (ts.calendar?.unit ? ` · ${ts.calendar.unit}` : '');
      svg.appendChild(subT);
    }

    /* Time axis */
    svg.appendChild(
      svgEl('line', {
        x1: PAD,
        y1: axisY,
        x2: WIDTH - PAD,
        y2: axisY,
        stroke: dk ? '#444' : '#ccc',
        'stroke-width': 1.5,
      }),
    );
    sorted.forEach((tp) => {
      const x = tpX(tp);
      svg.appendChild(
        svgEl('line', {
          x1: x,
          y1: axisY - 4,
          x2: x,
          y2: axisY + 4,
          stroke: dk ? '#666' : '#999',
          'stroke-width': 1,
        }),
      );
      const lbl = svgEl('text', {
        x,
        y: axisY + 14,
        fill: dk ? '#999' : '#666',
        'font-size': 10,
        'text-anchor': 'middle',
      });
      lbl.textContent = tp;
      svg.appendChild(lbl);
    });

    if (!frames.length) return;

    const col = dk ? '#A5D6A7' : '#388E3C';
    const colLight = dk ? 'rgba(165,214,167,0.12)' : 'rgba(56,142,60,0.06)';
    const frameYMap: Record<string, number> = {};
    const frameX1Map: Record<string, number> = {};

    function frameTimeRange(
      frameId: string,
    ): { from: string; to: string } | null {
      const pts = new Set<string>();
      (w?.edges ?? []).forEach((e) => {
        if (e.scope && scopeRefFrame(e.scope, frameId))
          collectTimePoints(e.scope, pts);
      });
      frames.forEach((f) => {
        if (f.parent === frameId && f.branchesAt) pts.add(f.branchesAt);
      });
      const arr = [...pts].filter((p) => sorted.includes(p)).sort();
      return arr.length ? { from: arr[0], to: arr[arr.length - 1] } : null;
    }

    frames.forEach((frame, fi) => {
      const y = frameLaneY + fi * (FRAME_H + FRAME_GAP);
      frameYMap[frame.id] = y;
      const range = frameTimeRange(frame.id);
      let x1 = PAD,
        x2 = WIDTH - PAD;
      if (range) {
        x1 = tpX(range.from) - 20;
        x2 = tpX(range.to) + 20;
      }
      frameX1Map[frame.id] = x1;

      const g = svgEl('g', {
        class: 'frame-box',
        'data-frame': frame.id,
        cursor: 'pointer',
        'pointer-events': 'all',
      });
      g.addEventListener('click', (ev) => {
        ev.stopPropagation();
        select({ kind: 'frame', id: frame.id });
      });
      g.appendChild(
        svgEl('rect', {
          x: x1,
          y,
          width: Math.max(x2 - x1, 60),
          height: FRAME_H,
          rx: 4,
          fill: colLight,
          stroke: col,
          'stroke-width': 1.5,
        }),
      );
      const nameEl = svgEl('text', {
        x: x1 + 8,
        y: y + FRAME_H / 2 + 4,
        fill: col,
        'font-size': 11,
        'font-weight': 600,
      });
      nameEl.textContent = frame.name || frame.id;
      g.appendChild(nameEl);
      svg.appendChild(g);
    });

    /* Branch arrows */
    frames.forEach((frame) => {
      if (!frame.parent || !frame.branchesAt) return;
      const parentY = frameYMap[frame.parent];
      const childY = frameYMap[frame.id];
      if (parentY == null || childY == null) return;
      const branchX = sorted.includes(frame.branchesAt)
        ? tpX(frame.branchesAt)
        : PAD + 20;
      const childX1 = frameX1Map[frame.id] ?? PAD;
      const sy = parentY + FRAME_H / 2,
        ty2 = childY + FRAME_H / 2;
      const midY = (sy + ty2) / 2;
      svg.appendChild(
        svgEl('path', {
          d: `M${branchX},${sy} C${branchX},${midY} ${childX1},${midY} ${childX1},${ty2}`,
          fill: 'none',
          stroke: col,
          'stroke-width': 1.5,
          'stroke-dasharray': '4,2',
        }),
      );
      const dir = ty2 > sy ? 1 : -1;
      svg.appendChild(
        svgEl('polygon', {
          points: `${childX1 - 4},${ty2 - dir * 6} ${childX1},${ty2} ${childX1 + 4},${ty2 - dir * 6}`,
          fill: col,
        }),
      );
      svg.appendChild(
        svgEl('circle', { cx: branchX, cy: sy, r: 3, fill: col }),
      );
    });

    onSelect((sel) => {
      svg.querySelectorAll('.frame-box').forEach((b) => {
        const fid = b.getAttribute('data-frame') ?? '';
        const isSel = sel != null && sel.kind === 'frame' && sel.id === fid;
        b.classList.toggle('greyed', sel != null && !isSel);
        b.classList.toggle('sel-highlight', isSel);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     VIEW 4 — LENSES
  ══════════════════════════════════════════════════════════════════════ */
  function renderLenses(container: HTMLElement): void {
    const lenses = story?.narrative?.lenses ?? [];
    if (!lenses.length) {
      container.innerHTML = '<p class="empty-msg">No lenses defined.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'lens-grid';
    container.appendChild(grid);

    lenses.forEach((lens) => {
      const card = document.createElement('div');
      card.className = 'lens-card';
      card.dataset['lens'] = lens.id;
      card.addEventListener('click', () =>
        select({ kind: 'lens', id: lens.id }),
      );
      card.innerHTML = lensCardHTML(lens);
      grid.appendChild(card);
    });

    onSelect((sel) => {
      const rel = relatedIds(sel);
      grid.querySelectorAll<HTMLElement>('.lens-card').forEach((el) => {
        const id = el.dataset['lens'] ?? '';
        el.classList.toggle('greyed', rel != null && !rel.lenses.has(id));
        el.classList.toggle('sel-highlight', rel != null && rel.lenses.has(id));
      });
    });
  }

  function lensCardHTML(lens: Lens): string {
    let h = `<h4>${esc(lens.name || lens.id)}</h4>`;
    const p = lens.perspective ?? {};
    h += `<div class="lens-row"><strong>Perspective:</strong> <span class="info-badge">${esc(typeName(p.perspectiveType) || '?')}</span>`;
    if (p.person)
      h += ` <span class="info-badge">${esc(typeName(p.person))}</span>`;
    h += '</div>';
    if (p.anchor) {
      const aid = typeId(p.anchor);
      h += `<div class="lens-row"><strong>Anchor:</strong> <a class="info-link" data-kind="node" data-id="${esc(aid)}">${esc(typeName(p.anchor) || aid)}</a></div>`;
    }
    const k = lens.knowledge ?? {};
    if (k.mode) {
      h += `<div class="lens-row"><strong>Knowledge:</strong> ${esc(typeName(k.mode))}`;
      if (k.includeSubconscious)
        h += ' <span class="lens-flag">+subconscious</span>';
      if (k.includeWrongBeliefs)
        h += ' <span class="lens-flag">+wrong beliefs</span>';
      h += '</div>';
    }
    if (lens.temporalPosition?.temporalType)
      h += `<div class="lens-row"><strong>Temporal:</strong> ${esc(typeName(lens.temporalPosition.temporalType))}</div>`;
    const em = lens.emotional ?? {};
    if (em.bias) {
      h += `<div class="lens-row"><strong>Bias toward:</strong> ${(
        em.bias.toward ?? []
      )
        .map((nd) => {
          const nid = typeId(nd);
          return `<a class="info-link" data-kind="node" data-id="${esc(nid)}">${esc(typeName(nd) || nid)}</a>`;
        })
        .join(', ')}`;
      if (em.bias.biasStrength != null) h += ` (${em.bias.biasStrength})`;
      h += '</div>';
    }
    const v = lens.voice ?? {};
    if (v.vocabularyLevel || v.sentenceTendency) {
      const pts: string[] = [];
      if (v.vocabularyLevel) pts.push(esc(typeName(v.vocabularyLevel)));
      if (v.sentenceTendency) pts.push(esc(typeName(v.sentenceTendency)));
      if (v.metaphorDensity)
        pts.push('metaphor: ' + esc(typeName(v.metaphorDensity)));
      if (v.innerMonologue) pts.push('inner monologue');
      h += `<div class="lens-row"><strong>Voice:</strong> ${pts.join(', ')}`;
      if (v.verbalTics?.length)
        h += `<br><em>"${v.verbalTics.map(esc).join('", "')}"</em>`;
      h += '</div>';
    }
    const r = lens.reliability ?? {};
    if (r.level) {
      const rlId = typeId(r.level);
      h += `<div class="lens-row"><strong>Reliability:</strong> <span class="info-badge" style="background:${c(rlId)}">${esc(typeName(r.level))}</span>`;
      if (r.distorts?.length)
        h += `<br>Distorts: ${r.distorts.map((d) => `${esc(typeName(d.node) || typeId(d.node) || '')} (${esc(d.direction || '')})`).join(', ')}`;
      h += '</div>';
    }
    return h;
  }

  /* ══════════════════════════════════════════════════════════════════════
     VIEW 5 — FORMATS
  ══════════════════════════════════════════════════════════════════════ */
  function renderFormats(container: HTMLElement): void {
    const formats = story?.narrative?.formats ?? [];
    if (!formats.length) {
      container.innerHTML = '<p class="empty-msg">No formats defined.</p>';
      return;
    }
    formats.forEach((fmt) => {
      const card = document.createElement('div');
      card.className = 'format-card';
      let h = `<h4>${esc(fmt.name || fmt.id)}</h4>`;
      if (fmt.structure)
        h +=
          '<div class="format-tree">' +
          renderStructureLevel(fmt.structure, 0) +
          '</div>';
      if (fmt.formatSettings)
        h += `<div class="format-settings"><strong>Settings:</strong><pre>${esc(JSON.stringify(fmt.formatSettings, null, 2))}</pre></div>`;
      card.innerHTML = h;
      container.appendChild(card);
    });
  }

  function renderStructureLevel(
    s: StructureLevel | undefined,
    depth: number,
  ): string {
    if (!s) return '';
    let h = `<div class="structure-level" style="margin-left:${depth * 16}px"><span class="structure-type">${esc(typeName(s.structureType))}</span>`;
    if (s.structureConstraints)
      h += ` <span class="structure-constraints">${Object.entries(
        s.structureConstraints,
      )
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}</span>`;
    h += '</div>';
    if (s.children) h += renderStructureLevel(s.children, depth + 1);
    return h;
  }

  /* ══════════════════════════════════════════════════════════════════════
     VIEW 6 — CONSTRAINTS
  ══════════════════════════════════════════════════════════════════════ */
  function renderConstraints(container: HTMLElement): void {
    const constraints = story?.world?.constraints ?? [];
    if (!constraints.length) {
      container.innerHTML = '<p class="empty-msg">No constraints defined.</p>';
      return;
    }

    const groups: Record<string, Constraint[]> = {};
    const groupNames: Record<string, string> = {};
    constraints.forEach((con) => {
      const s = typeId(con.severity) || 'UNKNOWN';
      (groups[s] ??= []).push(con);
      groupNames[s] = typeName(con.severity) || 'UNKNOWN';
    });
    Object.keys(groups).forEach((sev) => {
      const sec = document.createElement('div');
      sec.innerHTML = `<h4 style="color:${c(sev)}">${esc(groupNames[sev])}</h4>`;
      groups[sev].forEach((con) => {
        const card = document.createElement('div');
        card.className = 'constraint-card';
        card.style.borderLeftColor = c(sev);
        card.innerHTML =
          `<strong>${esc(con.name ?? '')}</strong><p>${esc(con.description || '')}</p>` +
          (con.scope
            ? `<div class="info-scope">${renderScope(con.scope)}</div>`
            : '');
        sec.appendChild(card);
      });
      container.appendChild(sec);
    });
  }

  /* ── Detail panel HTML ─────────────────────────────────────────────── */
  function nodeDetailHTML(node: StoryNode): string {
    let h = `<h4>${esc(node.name)}</h4><span class="info-badge" style="background:${c(typeId(node.nodeType))}">${esc(typeName(node.nodeType))}</span>`;
    if (node.description)
      h += `<p class="info-desc">${esc(node.description)}</p>`;
    if (node.hasTag?.length)
      h += `<div class="info-tags">${node.hasTag.map((t) => `<span class="info-tag">${esc(typeName(t))}</span>`).join('')}</div>`;
    if (node.properties)
      h += `<table class="info-props">${Object.entries(node.properties)
        .map(
          ([k, v]) =>
            `<tr><td>${esc(k)}</td><td>${esc(JSON.stringify(v))}</td></tr>`,
        )
        .join('')}</table>`;
    return h;
  }

  function edgeDetailHTML(edge: StoryEdge): string {
    let h = `<h4>${esc(edge.name ?? edge.id)}</h4><span class="info-badge" style="background:${c(typeId(edge.edgeType))}">${esc(typeName(edge.edgeType))}</span>`;
    h += `<p><strong>${esc(typeId(edge.source))}</strong> &rarr; <strong>${esc(typeId(edge.target))}</strong></p>`;
    if (edge.description)
      h += `<p class="info-desc">${esc(edge.description)}</p>`;
    if (edge.scope)
      h += `<div class="info-scope"><strong>Scope:</strong> ${renderScope(edge.scope)}</div>`;
    return h;
  }

  function beatDetailHTML(beat: Beat): string {
    let h = `<h4>${esc(beat.name ?? beat.id)}</h4>`;
    if (beat.function)
      h += `<span class="info-badge" style="background:${c(typeId(beat.function))}">${esc(typeName(beat.function))}</span>`;
    if (beat.description)
      h += `<p class="info-desc">${esc(beat.description)}</p>`;
    if (beat.tension != null)
      h += `<p><strong>Tension:</strong> ${beat.tension}</p>`;
    if (beat.emotionalTarget != null)
      h += `<p><strong>Emotional:</strong> ${beat.emotionalTarget}</p>`;
    if (beat.nodeIds?.length)
      h += `<p><strong>Nodes:</strong> ${beat.nodeIds
        .map((n) => {
          const nid = typeId(n);
          return `<a class="info-link" data-kind="node" data-id="${esc(nid)}">${esc(typeName(n) || nid)}</a>`;
        })
        .join(', ')}</p>`;
    if (beat.edgeIds?.length)
      h += `<p><strong>Edges:</strong> ${beat.edgeIds
        .map((e) => {
          const eid = typeId(e);
          return `<a class="info-link" data-kind="edge" data-id="${esc(eid)}">${esc(typeName(e) || eid)}</a>`;
        })
        .join(', ')}</p>`;
    if (beat.reveals?.length)
      h += `<p><strong>Reveals:</strong> ${beat.reveals.map((r) => `${esc(typeId(r.target) || String(r.target ?? ''))} (${r.degree ?? 'FULL'})`).join(', ')}</p>`;
    if (beat.transition)
      h += `<p><strong>Transition:</strong> ${esc(typeName(beat.transition.transitionType))}</p>`;
    return h;
  }

  function threadDetailHTML(thread: Thread): string {
    let h = `<h4>${esc(thread.name ?? thread.id)}</h4><span class="info-badge">${esc(typeName(thread.threadType) || thread.type)}</span>`;
    if (thread.description)
      h += `<p class="info-desc">${esc(thread.description)}</p>`;
    if (thread.appearances?.length) {
      h += '<ul class="appearance-list">';
      thread.appearances.forEach((a) => {
        const bid = typeId(a.beatId);
        h += `<li><a class="info-link" data-kind="beat" data-id="${esc(bid)}"><strong>${esc(typeName(a.beatId) || bid)}</strong></a>: ${esc(a.description || '')}</li>`;
      });
      h += '</ul>';
    }
    return h;
  }

  function deviceDetailHTML(dev: Device): string {
    let h = `<h4>${esc(dev.name || dev.id)}</h4><span class="info-badge">${esc(typeName(dev.deviceType) || dev.type)}</span>`;
    if (dev.description)
      h += `<p class="info-desc">${esc(dev.description)}</p>`;
    if (dev.setup?.length)
      h += `<p><strong>Setup:</strong> ${dev.setup
        .map((b) => {
          const bid = typeId(b);
          return `<a class="info-link" data-kind="beat" data-id="${esc(bid)}">${esc(typeName(b) || bid)}</a>`;
        })
        .join(', ')}</p>`;
    if (dev.payoff?.length)
      h += `<p><strong>Payoff:</strong> ${dev.payoff
        .map((b) => {
          const bid = typeId(b);
          return `<a class="info-link" data-kind="beat" data-id="${esc(bid)}">${esc(typeName(b) || bid)}</a>`;
        })
        .join(', ')}</p>`;
    return h;
  }

  function frameDetailHTML(frame: Frame): string {
    let h = `<h4>${esc(frame.name || frame.id)}</h4><span class="info-badge" style="background:#388E3C">Frame</span>`;
    if (frame.description)
      h += `<p class="info-desc">${esc(frame.description)}</p>`;
    if (frame.parent)
      h += `<p><strong>Parent:</strong> ${esc(frame.parent)}</p>`;
    if (frame.branchesAt)
      h += `<p><strong>Branches at:</strong> ${esc(frame.branchesAt)}</p>`;
    if (frame.relations?.length) {
      h += '<p><strong>Relations:</strong></p><ul class="appearance-list">';
      frame.relations.forEach((r) => {
        h += `<li>${esc(typeName(r.relationType))} → ${esc(typeId(r.target) || String(r.target ?? ''))}${r.at ? ` at ${r.at}` : ''}${r.description ? ` — ${esc(r.description)}` : ''}</li>`;
      });
      h += '</ul>';
    }
    return h;
  }

  /* ── Scope / time helpers ──────────────────────────────────────────── */
  function scopeRefFrame(scope: Scope, frameId: string): boolean {
    if (
      scope.selectorType === 'frame' &&
      typeId(scope.selectorItem) === frameId
    )
      return true;
    if (scope.and) return scope.and.some((s) => scopeRefFrame(s, frameId));
    if (scope.or) return scope.or.some((s) => scopeRefFrame(s, frameId));
    if (scope.not) return scopeRefFrame(scope.not, frameId);
    return false;
  }

  function renderScope(scope: Scope | undefined): string {
    if (!scope) return '';
    if (scope.selectorType && scope.selectorItem)
      return `<code>${esc(scope.selectorType)}: ${esc(typeId(scope.selectorItem))}</code>`;
    if (scope.and) return '(' + scope.and.map(renderScope).join(' AND ') + ')';
    if (scope.or) return '(' + scope.or.map(renderScope).join(' OR ') + ')';
    if (scope.not) return 'NOT ' + renderScope(scope.not);
    if (scope.in) return 'IN [' + scope.in.map(renderScope).join(', ') + ']';
    if (scope.range) {
      const f = scope.range.from ? renderScope(scope.range.from) : '∞';
      const t = scope.range.to ? renderScope(scope.range.to) : '∞';
      return `${f} → ${t}`;
    }
    return JSON.stringify(scope);
  }

  function collectTimePoints(scope: Scope, set: Set<string>): void {
    if (scope.selectorType === 'time' && scope.selectorItem) {
      set.add(String(scope.selectorItem));
      return;
    }
    if (scope.range) {
      if (scope.range.from) collectTimePoints(scope.range.from, set);
      if (scope.range.to) collectTimePoints(scope.range.to, set);
      return;
    }
    for (const k of ['and', 'or'] as const) {
      const arr = scope[k];
      if (arr) arr.forEach((s) => collectTimePoints(s, set));
    }
    if (scope.not) collectTimePoints(scope.not, set);
    if (scope.in) scope.in.forEach((s) => collectTimePoints(s, set));
  }

  /* ── Info-link click handler ───────────────────────────────────────── */
  root.addEventListener('click', (e) => {
    const link = (e.target as Element).closest(
      '.info-link',
    ) as HTMLElement | null;
    if (link) {
      e.preventDefault();
      select({
        kind: link.dataset['kind'] ?? '',
        id: link.dataset['id'] ?? '',
      });
    }
  });
})();
