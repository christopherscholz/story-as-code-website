(function () {
  'use strict';

  const root = document.getElementById('story-graph');
  if (!root) return;

  /* ── colour palette (auto-assigned, no hardcoded shapes) ───────── */
  const ASSIGNED = {};
  const PALETTE = [
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
  let _pi = 0;
  function colorFor(type) {
    if (ASSIGNED[type]) return ASSIGNED[type];
    ASSIGNED[type] = {
      light: PALETTE[_pi % PALETTE.length],
      dark: PALETTE[(_pi + 7) % PALETTE.length],
    };
    _pi++;
    return ASSIGNED[type];
  }
  function isDark() {
    return document.documentElement.classList.contains('dark');
  }
  function c(type) {
    const cl = colorFor(type);
    return isDark() ? cl.dark : cl.light;
  }

  // nodeType/edgeType may be resolved TypeDefinition objects {id, name, ...}
  // or plain strings — typeId() normalises both to the string ID.
  function typeId(t) {
    return t?.id ?? t ?? '';
  }
  function typeName(t) {
    return t?.name ?? t?.id ?? t ?? '';
  }

  // All type→color mappings are auto-assigned via colorFor(). No hardcoded
  // assumptions about specific schema enum values (beat functions, device
  // types, reliability levels, etc.).

  /* ── state ─────────────────────────────────────────────────────── */
  let story = null;
  let selected = null;
  const listeners = [];
  function select(sel) {
    if (selected && sel && selected.kind === sel.kind && selected.id === sel.id)
      selected = null;
    else selected = sel;
    listeners.forEach((fn) => fn(selected));
  }
  function onSelect(fn) {
    listeners.push(fn);
  }

  /* ── relevance engine: compute which IDs are "related" ─────────── */
  function relatedIds(sel) {
    if (!sel) return null; // null = no filtering
    const ids = {
      nodes: new Set(),
      edges: new Set(),
      beats: new Set(),
      threads: new Set(),
      devices: new Set(),
      lenses: new Set(),
    };
    const w = story.world || {},
      n = story.narrative || {};
    const beats = n.beats || [],
      threads = n.threads || [],
      devices = n.devices || [],
      lenses = n.lenses || [];

    if (sel.kind === 'node') {
      ids.nodes.add(sel.id);
      // connected edges
      (w.edges || []).forEach((e) => {
        if (typeId(e.source) === sel.id || typeId(e.target) === sel.id) {
          ids.edges.add(e.id);
          ids.nodes.add(typeId(e.source));
          ids.nodes.add(typeId(e.target));
        }
      });
      // beats referencing node
      beats.forEach((b) => {
        if ((b.nodeIds || []).includes(sel.id)) ids.beats.add(b.id);
      });
      // lenses
      lenses.forEach((l) => {
        if (
          l.perspective?.anchor === sel.id ||
          (l.emotional?.bias?.toward || []).includes(sel.id) ||
          (l.reliability?.distorts || []).some((d) => d.node === sel.id)
        )
          ids.lenses.add(l.id);
      });
    } else if (sel.kind === 'edge') {
      const edge = (w.edges || []).find((e) => e.id === sel.id);
      if (edge) {
        ids.edges.add(sel.id);
        ids.nodes.add(typeId(edge.source));
        ids.nodes.add(typeId(edge.target));
      }
      beats.forEach((b) => {
        if ((b.edgeIds || []).includes(sel.id)) ids.beats.add(b.id);
      });
    } else if (sel.kind === 'beat') {
      ids.beats.add(sel.id);
      const beat = beats.find((b) => b.id === sel.id);
      if (beat) {
        (beat.nodeIds || []).forEach((id) => ids.nodes.add(id));
        (beat.edgeIds || []).forEach((id) => {
          ids.edges.add(id);
          const e = (w.edges || []).find((e) => e.id === id);
          if (e) {
            ids.nodes.add(typeId(e.source));
            ids.nodes.add(typeId(e.target));
          }
        });
      }
      threads.forEach((t) => {
        if ((t.appearances || []).some((a) => a.beatId === sel.id))
          ids.threads.add(t.id);
      });
      devices.forEach((d) => {
        if (
          (d.setup || []).includes(sel.id) ||
          (d.payoff || []).includes(sel.id)
        )
          ids.devices.add(d.id);
      });
    } else if (sel.kind === 'thread') {
      ids.threads.add(sel.id);
      const thread = threads.find((t) => t.id === sel.id);
      if (thread)
        (thread.appearances || []).forEach((a) => {
          ids.beats.add(a.beatId);
          const b = beats.find((b) => b.id === a.beatId);
          if (b) (b.nodeIds || []).forEach((id) => ids.nodes.add(id));
        });
    } else if (sel.kind === 'device') {
      ids.devices.add(sel.id);
      const dev = devices.find((d) => d.id === sel.id);
      if (dev)
        [...(dev.setup || []), ...(dev.payoff || [])].forEach((id) => {
          ids.beats.add(id);
          const b = beats.find((b) => b.id === id);
          if (b) (b.nodeIds || []).forEach((nid) => ids.nodes.add(nid));
        });
    } else if (sel.kind === 'lens') {
      ids.lenses.add(sel.id);
      const lens = lenses.find((l) => l.id === sel.id);
      if (lens) {
        if (lens.perspective?.anchor) ids.nodes.add(lens.perspective.anchor);
        (lens.emotional?.bias?.toward || []).forEach((id) => ids.nodes.add(id));
        (lens.reliability?.distorts || []).forEach((d) =>
          ids.nodes.add(d.node),
        );
      }
    } else if (sel.kind === 'frame') {
      // edges scoped to this frame + edges without any scope (always valid)
      (w.edges || []).forEach((e) => {
        if (!e.scope || scopeRefFrame(e.scope, sel.id)) {
          ids.edges.add(e.id);
          ids.nodes.add(typeId(e.source));
          ids.nodes.add(typeId(e.target));
        }
      });
    }
    return ids;
  }

  /* ── data loading ──────────────────────────────────────────────── */
  const src = root.getAttribute('data-src');
  if (!src) {
    root.innerHTML = '<p>No data-src attribute.</p>';
    return;
  }
  fetch(src)
    .then((r) => r.json())
    .then((data) => {
      story = data;
      init();
    })
    .catch((e) => {
      root.innerHTML = '<p>Failed to load story: ' + e.message + '</p>';
    });

  /* ── init ───────────────────────────────────────────────────────── */
  let cy = null;
  const detailPanel = () => root.querySelector('#detail-panel');

  function init() {
    // pre-assign colors for all types found in data
    const w = story.world || {},
      _n = story.narrative || {};
    (w.nodes || []).forEach((nd) => colorFor(typeId(nd.nodeType)));
    (w.edges || []).forEach((e) => colorFor(typeId(e.edgeType)));

    renderAllSections();

    new MutationObserver(() => renderAllSections()).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ['class'] },
    );
  }

  function renderAllSections() {
    // clear stale listeners from previous render
    listeners.length = 0;
    // re-register the detail panel listener
    setupDetailPanel();

    root.querySelectorAll('.graph-section').forEach((sec) => {
      const content = sec.querySelector('.section-content');
      content.innerHTML = '';
      switch (sec.dataset.view) {
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

  function setupDetailPanel() {
    onSelect((sel) => {
      const dp = detailPanel();
      if (!sel) {
        dp.innerHTML = '';
        dp.classList.remove('open');
        return;
      }
      dp.classList.add('open');
      const w = story.world || {},
        n = story.narrative || {};
      let html = '';
      if (sel.kind === 'node') {
        const nd = (w.nodes || []).find((x) => x.id === sel.id);
        if (nd) html = nodeDetailHTML(nd);
      } else if (sel.kind === 'edge') {
        const e = (w.edges || []).find((x) => x.id === sel.id);
        if (e) html = edgeDetailHTML(e);
      } else if (sel.kind === 'beat') {
        const b = (n.beats || []).find((x) => x.id === sel.id);
        if (b) html = beatDetailHTML(b);
      } else if (sel.kind === 'thread') {
        const t = (n.threads || []).find((x) => x.id === sel.id);
        if (t) html = threadDetailHTML(t);
      } else if (sel.kind === 'device') {
        const d = (n.devices || []).find((x) => x.id === sel.id);
        if (d) html = deviceDetailHTML(d);
      } else if (sel.kind === 'lens') {
        const l = (n.lenses || []).find((x) => x.id === sel.id);
        if (l) html = lensCardHTML(l);
      } else if (sel.kind === 'frame') {
        const f = (w.frames || []).find((x) => x.id === sel.id);
        if (f) html = frameDetailHTML(f);
      }
      dp.innerHTML = '<button class="detail-close">&times;</button>' + html;
      dp.querySelector('.detail-close').addEventListener('click', () =>
        select(null),
      );
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW 1: WORLD GRAPH
     ═══════════════════════════════════════════════════════════════════ */
  function renderWorld(container) {
    const w = story.world || {};
    const nodes = w.nodes || [],
      edges = w.edges || [];

    const filterBar = document.createElement('div');
    filterBar.className = 'world-filters';
    const nodeTypes = [...new Set(nodes.map((n) => typeId(n.nodeType)))];
    const edgeTypes = [...new Set(edges.map((e) => typeId(e.edgeType)))];
    filterBar.innerHTML =
      '<span class="filter-label">Nodes:</span>' +
      nodeTypes
        .map(
          (t) =>
            `<label class="filter-chip" style="--chip-color:${c(t)}"><input type="checkbox" checked data-filter="node-${t}"> ${t}</label>`,
        )
        .join('') +
      '<span class="filter-label">Edges:</span>' +
      edgeTypes
        .map(
          (t) =>
            `<label class="filter-chip" style="--chip-color:${c(t)}"><input type="checkbox" checked data-filter="edge-${t}"> ${t}</label>`,
        )
        .join('');
    container.appendChild(filterBar);

    const cyDiv = document.createElement('div');
    cyDiv.className = 'cy-container';
    container.appendChild(cyDiv);

    // deterministic initial positions: group by type in a wide circle
    const typeGroups = {};
    nodes.forEach((n) => {
      const nt = typeId(n.nodeType);
      (typeGroups[nt] = typeGroups[nt] || []).push(n);
    });
    const typeKeys = Object.keys(typeGroups);
    const initPos = {};
    const R = 240; // radius of type group ring
    typeKeys.forEach((type, ti) => {
      const angle = (2 * Math.PI * ti) / typeKeys.length - Math.PI / 2;
      const cx = R * Math.cos(angle),
        cy = R * Math.sin(angle);
      const group = typeGroups[type];
      const spread = 40 + group.length * 16;
      group.forEach((n, ni) => {
        const ga = (2 * Math.PI * ni) / group.length;
        initPos[n.id] = {
          x: cx + spread * Math.cos(ga),
          y: cy + spread * Math.sin(ga),
        };
      });
    });

    const elements = [];
    nodes.forEach((n) =>
      elements.push({
        group: 'nodes',
        data: { id: n.id, label: n.name || n.id, type: typeId(n.nodeType) },
        classes: typeId(n.nodeType),
        position: initPos[n.id],
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
          hasScope: !!e.scope,
        },
        classes: typeId(e.edgeType),
      }),
    );

    const dk = isDark(),
      _bg = dk ? '#1e1e1e' : '#fafafa',
      textCol = dk ? '#ccc' : '#444';
    const styles = [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'font-size': 12,
          color: textCol,
          'text-valign': 'bottom',
          'text-margin-y': 5,
          width: 34,
          height: 34,
          'border-width': 2,
          'border-color': dk ? '#666' : '#ccc',
          'text-wrap': 'ellipsis',
          'text-max-width': 90,
          shape: 'ellipse',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#bbb',
          'line-color': '#bbb',
          opacity: 0.6,
        },
      },
      {
        selector: 'edge[?hasScope]',
        style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 3] },
      },
      { selector: '.dimmed', style: { opacity: 0.12 } },
      { selector: '.highlighted', style: { opacity: 1 } },
      { selector: '.filtered-out', style: { display: 'none' } },
    ];
    nodeTypes.forEach((type) =>
      styles.push({
        selector: 'node.' + type,
        style: { 'background-color': c(type) },
      }),
    );
    edgeTypes.forEach((type) =>
      styles.push({
        selector: 'edge.' + type,
        style: { 'line-color': c(type), 'target-arrow-color': c(type) },
      }),
    );

    cy = cytoscape({
      container: cyDiv,
      elements,
      style: styles,
      layout: { name: 'preset', fit: true, padding: 40 },
      minZoom: 0.1,
      maxZoom: 3,
    });

    cy.on('tap', 'node', (e) => select({ kind: 'node', id: e.target.id() }));
    cy.on('tap', 'edge', (e) => select({ kind: 'edge', id: e.target.id() }));
    cy.on('tap', (e) => {
      if (e.target === cy) select(null);
    });

    // hover: neighbourhood highlight
    cy.on('mouseover', 'node', (e) => {
      const nb = e.target.closedNeighborhood();
      cy.elements().not(nb).addClass('dimmed');
      nb.addClass('highlighted');
    });
    cy.on('mouseout', 'node', () =>
      cy.elements().removeClass('dimmed highlighted'),
    );
    cy.on('mouseover', 'edge', (e) => {
      const c = e.target.connectedNodes().union(e.target);
      cy.elements().not(c).addClass('dimmed');
      c.addClass('highlighted');
    });
    cy.on('mouseout', 'edge', () =>
      cy.elements().removeClass('dimmed highlighted'),
    );

    // selection: global grey-out
    onSelect((sel) => {
      if (!cy) return;
      cy.elements().removeClass('dimmed highlighted');
      const rel = relatedIds(sel);
      if (!rel) return;
      cy.nodes().forEach((n) => {
        if (!rel.nodes.has(n.id())) n.addClass('dimmed');
      });
      cy.edges().forEach((e) => {
        if (!rel.edges.has(e.id())) e.addClass('dimmed');
      });
    });

    filterBar.querySelectorAll('input[type=checkbox]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const [kind, type] = cb.dataset.filter.split('-');
        (kind === 'node'
          ? cy.nodes('.' + type)
          : cy.edges('.' + type)
        ).toggleClass('filtered-out', !cb.checked);
      }),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW 2: NARRATIVE FLOW (no stepper, just clickable)
     ═══════════════════════════════════════════════════════════════════ */
  function renderNarrative(container) {
    const n = story.narrative || {};
    const beats = (n.beats || [])
      .filter((b) => b.order != null)
      .sort((a, b) => a.order - b.order);
    const threads = n.threads || [],
      devices = n.devices || [];
    if (!beats.length) {
      container.innerHTML =
        '<p class="empty-msg">No beats with order defined.</p>';
      return;
    }

    // vertical layout — measure available width
    const wrapper = document.createElement('div');
    wrapper.className = 'narrative-scroll narrative-vertical';
    container.appendChild(wrapper);

    const availW = wrapper.clientWidth || 400;
    const PAD = threads.length > 0 ? 50 : 12;
    const deviceMargin = devices.length * 16 + 12;
    const tensionW = 30;
    const threadW = 16;
    const threadsTotal = threads.length * threadW;
    const CARD_W = Math.max(
      150,
      availW - deviceMargin - tensionW - threadsTotal - PAD * 2 - 20,
    );
    const CARD_H = 50,
      GAP = 12;
    const totalW = availW;
    const totalH = beats.length * (CARD_H + GAP) - GAP + PAD * 2;
    const cardX = deviceMargin + tensionW + PAD;

    const svg = createSVG(totalW, totalH);
    svg.style.width = '100%';
    svg.style.minWidth = '0';
    wrapper.appendChild(svg);

    const beatY = (i) => PAD + i * (CARD_H + GAP) + CARD_H / 2;

    // tension bar (left side, vertical)
    const tensionX = PAD + deviceMargin;
    svg.appendChild(
      svgEl('line', {
        x1: tensionX + tensionW,
        y1: PAD,
        x2: tensionX + tensionW,
        y2: totalH - PAD,
        stroke: isDark() ? '#444' : '#ddd',
        'stroke-width': 1,
      }),
    );
    let tensionPath = '';
    beats.forEach((b, i) => {
      const x = tensionX + tensionW - (b.tension || 0) * (tensionW - 4);
      const y = beatY(i);
      tensionPath += (i === 0 ? 'M' : 'L') + `${x},${y}`;
      svg.appendChild(
        svgEl('circle', {
          cx: x,
          cy: y,
          r: 3,
          fill: c(b.function || 'default'),
        }),
      );
    });
    svg.appendChild(
      svgEl('path', {
        d: tensionPath,
        fill: 'none',
        stroke: isDark() ? '#B39DDB' : '#7E57C2',
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      }),
    );
    const tLabel = svgEl('text', {
      x: tensionX + 2,
      y: PAD - 6,
      fill: isDark() ? '#666' : '#bbb',
      'font-size': 10,
    });
    tLabel.textContent = 'Tension';
    svg.appendChild(tLabel);

    // beat cards (vertical stack)
    beats.forEach((b, i) => {
      const x = cardX,
        y = PAD + i * (CARD_H + GAP);
      const funcColor = c(b.function || 'default');
      const emColor =
        b.emotionalTarget != null
          ? b.emotionalTarget < 0
            ? `rgba(66,165,245,${Math.abs(b.emotionalTarget) * 0.15})`
            : `rgba(255,167,38,${b.emotionalTarget * 0.15})`
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
          fill: isDark() ? '#2a2a2a' : '#fff',
          stroke: funcColor,
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
      // name (first line, left-aligned)
      const nameText = svgEl('text', {
        x: x + 6,
        y: y + 14,
        fill: isDark() ? '#ddd' : '#333',
        'font-size': 11,
        'font-weight': '600',
      });
      nameText.textContent = truncate(b.name || b.id, 28);
      g.appendChild(nameText);
      // order number right-aligned
      const orderText = svgEl('text', {
        x: x + CARD_W - 6,
        y: y + 14,
        fill: isDark() ? '#666' : '#bbb',
        'font-size': 10,
        'text-anchor': 'end',
      });
      orderText.textContent = `#${b.order}`;
      g.appendChild(orderText);
      // function badge (second line, small, left-aligned)
      const funcLabel = (b.function || '').replace(/_/g, ' ');
      const funcBadgeW = funcLabel.length * 5 + 10;
      g.appendChild(
        svgEl('rect', {
          x: x + 5,
          y: y + 20,
          width: funcBadgeW,
          height: 12,
          rx: 2,
          fill: funcColor,
        }),
      );
      const funcText = svgEl('text', {
        x: x + 8,
        y: y + 29,
        fill: '#fff',
        'font-size': 8,
        'font-weight': '600',
      });
      funcText.textContent = funcLabel;
      g.appendChild(funcText);
      // tension bar
      const barW = (CARD_W - 10) * (b.tension || 0);
      g.appendChild(
        svgEl('rect', {
          x: x + 5,
          y: y + CARD_H - 10,
          width: CARD_W - 10,
          height: 3,
          rx: 1.5,
          fill: isDark() ? '#444' : '#eee',
        }),
      );
      g.appendChild(
        svgEl('rect', {
          x: x + 5,
          y: y + CARD_H - 10,
          width: barW,
          height: 3,
          rx: 1.5,
          fill: funcColor,
        }),
      );
      // reveals
      if (b.reveals && b.reveals.length) {
        const revText = svgEl('text', {
          x: x + CARD_W - 6,
          y: y + CARD_H - 14,
          fill: isDark() ? '#FFD54F' : '#FF8F00',
          'font-size': 10,
          'text-anchor': 'end',
        });
        revText.textContent = `${b.reveals.length} reveal${b.reveals.length > 1 ? 's' : ''}`;
        g.appendChild(revText);
      }
      // transition label
      if (b.transition && i < beats.length - 1) {
        const tl = svgEl('text', {
          x: x + CARD_W / 2,
          y: y + CARD_H + GAP / 2 + 3,
          fill: isDark() ? '#555' : '#ccc',
          'font-size': 10,
          'text-anchor': 'middle',
        });
        tl.textContent = b.transition.transitionType;
        svg.appendChild(tl);
      }
      svg.appendChild(g);

      // arrow down
      if (i < beats.length - 1) {
        const ax = x + CARD_W / 2,
          ay = y + CARD_H + 1;
        svg.appendChild(
          svgEl('line', {
            x1: ax,
            y1: ay,
            x2: ax,
            y2: ay + GAP - 3,
            stroke: isDark() ? '#555' : '#ccc',
            'stroke-width': 1,
          }),
        );
        svg.appendChild(
          svgEl('polygon', {
            points: `${ax - 2},${ay + GAP - 3} ${ax},${ay + GAP} ${ax + 2},${ay + GAP - 3}`,
            fill: isDark() ? '#555' : '#ccc',
          }),
        );
      }
    });

    // thread columns (right of beats)
    const TCOLS = [
      isDark() ? '#F48FB1' : '#EC407A',
      isDark() ? '#90CAF9' : '#42A5F5',
      isDark() ? '#A5D6A7' : '#66BB6A',
      isDark() ? '#FFE082' : '#FFB300',
      isDark() ? '#CE93D8' : '#AB47BC',
    ];
    const threadBaseX = cardX + CARD_W + 16;
    threads.forEach((thread, ti) => {
      const x = threadBaseX + ti * threadW,
        col = TCOLS[ti % TCOLS.length];
      // vertical line
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
      // label at top, rotated so it doesn't overlap
      const labelEl = svgEl('text', {
        x: x + 3,
        y: PAD - 4,
        fill: col,
        'font-size': 10,
        'font-weight': '500',
        cursor: 'pointer',
        transform: `rotate(-45 ${x + 3} ${PAD - 4})`,
      });
      labelEl.textContent = truncate(thread.name, 16);
      labelEl.addEventListener('click', () =>
        select({ kind: 'thread', id: thread.id }),
      );
      svg.appendChild(labelEl);

      const apps = (thread.appearances || [])
        .map((a) => ({ ...a, idx: beats.findIndex((b) => b.id === a.beatId) }))
        .filter((a) => a.idx >= 0)
        .sort((a, b) => a.idx - b.idx);
      let lp = '';
      apps.forEach((a, ai) => {
        const cy = beatY(a.idx);
        lp += (ai === 0 ? 'M' : 'L') + `${x},${cy}`;
        const dot = svgEl('circle', {
          cx: x,
          cy,
          r: 4,
          fill: col,
          cursor: 'pointer',
          class: 'thread-dot',
          'data-thread': thread.id,
        });
        dot.innerHTML = `<title>${esc(a.description || a.beatId)}</title>`;
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

    // device brackets (left side, right-angle bracket from setup to payoff)
    const bracketBaseX = PAD + deviceMargin - 4;
    devices.forEach((dev, di) => {
      const setupIdxs = (dev.setup || [])
        .map((id) => beats.findIndex((b) => b.id === id))
        .filter((i) => i >= 0);
      const payoffIdxs = (dev.payoff || [])
        .map((id) => beats.findIndex((b) => b.id === id))
        .filter((i) => i >= 0);
      const col = c(dev.type || 'default');
      const bx = bracketBaseX - di * 14;
      setupIdxs.forEach((si) =>
        payoffIdxs.forEach((pi) => {
          const y1 = beatY(si),
            y2 = beatY(pi);
          // right-angle bracket: horizontal tick at top, vertical line, horizontal tick at bottom with arrow
          const dash = 'none';
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
          // invisible hit area
          g.appendChild(
            svgEl('rect', {
              x: bx - 10,
              y: y1 - 4,
              width: 22,
              height: y2 - y1 + 8,
              fill: 'transparent',
            }),
          );
          // top tick
          g.appendChild(
            svgEl('line', {
              x1: bx + 8,
              y1: y1,
              x2: bx,
              y2: y1,
              stroke: col,
              'stroke-width': 1.5,
              'stroke-dasharray': dash,
            }),
          );
          // vertical line
          g.appendChild(
            svgEl('line', {
              x1: bx,
              y1: y1,
              x2: bx,
              y2: y2,
              stroke: col,
              'stroke-width': 1.5,
              'stroke-dasharray': dash,
            }),
          );
          // bottom tick with arrow
          g.appendChild(
            svgEl('line', {
              x1: bx,
              y1: y2,
              x2: bx + 8,
              y2: y2,
              stroke: col,
              'stroke-width': 1.5,
              'stroke-dasharray': dash,
            }),
          );
          g.appendChild(
            svgEl('polygon', {
              points: `${bx + 5},${y2 - 2} ${bx + 9},${y2} ${bx + 5},${y2 + 2}`,
              fill: col,
            }),
          );
          // label (horizontal, left of bracket)
          const label = svgEl('text', {
            x: bx - 4,
            y: (y1 + y2) / 2 + 3,
            fill: col,
            'font-size': 9,
            'text-anchor': 'end',
            transform: `rotate(-90 ${bx - 4} ${(y1 + y2) / 2 + 3})`,
          });
          label.textContent = dev.type.replace(/_/g, ' ');
          g.appendChild(label);
          svg.appendChild(g);
        }),
      );
    });

    // global grey-out for narrative
    onSelect((sel) => {
      const rel = relatedIds(sel);
      svg.querySelectorAll('.beat-card').forEach((g) => {
        const id = g.getAttribute('data-beat');
        g.classList.toggle('greyed', rel != null && !rel.beats.has(id));
        g.classList.toggle('sel-highlight', rel != null && rel.beats.has(id));
      });
      svg.querySelectorAll('.device-arc').forEach((a) => {
        const id = a.getAttribute('data-device');
        a.classList.toggle('greyed', rel != null && !rel.devices.has(id));
      });
      svg.querySelectorAll('.thread-dot').forEach((d) => {
        const id = d.getAttribute('data-thread');
        d.classList.toggle('greyed', rel != null && !rel.threads.has(id));
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW 3: TIMELINE
     ═══════════════════════════════════════════════════════════════════ */
  function renderTimeline(container) {
    const w = story.world || {};
    const ts = w.time_system,
      frames = w.frames || [];
    if (!ts && !frames.length) {
      container.innerHTML =
        '<p class="empty-msg">No time system or frames defined.</p>';
      return;
    }

    // collect time points from frame-scoped edges and frame metadata
    const timePoints = new Set();
    (w.edges || []).forEach((e) => {
      if (e.scope) collectTimePoints(e.scope, timePoints);
    });
    frames.forEach((f) => {
      if (f.branches_at) timePoints.add(f.branches_at);
      (f.relations || []).forEach((r) => {
        if (r.at) timePoints.add(r.at);
      });
    });
    const sorted = [...timePoints].sort();

    const PAD = 50,
      axisY = 60;
    const WIDTH = Math.max(500, sorted.length * 120 + PAD * 2);
    const frameLaneY = axisY + 30;
    const FRAME_H = 30,
      FRAME_GAP = 12;
    const totalH =
      frameLaneY + (frames.length + 1) * (FRAME_H + FRAME_GAP) + PAD;

    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-scroll';
    container.appendChild(wrapper);
    const svg = createSVG(WIDTH, totalH);
    wrapper.appendChild(svg);
    const tpX = (tp) => {
      const idx = sorted.indexOf(tp);
      return idx >= 0
        ? PAD + (idx + 0.5) * ((WIDTH - PAD * 2) / sorted.length)
        : PAD;
    };

    const defs = svgEl('defs');
    svg.appendChild(defs);

    // time system header
    if (ts) {
      const title = svgEl('text', {
        x: PAD,
        y: 22,
        fill: isDark() ? '#ddd' : '#333',
        'font-size': 14,
        'font-weight': 'bold',
      });
      title.textContent = ts.name || 'Timeline';
      svg.appendChild(title);
      const sub = svgEl('text', {
        x: PAD,
        y: 36,
        fill: isDark() ? '#777' : '#999',
        'font-size': 10,
      });
      sub.textContent =
        `${ts.type}` +
        (ts.calendar
          ? ` | ${ts.calendar.unit || ''}` +
            (ts.calendar.season ? ` | ${ts.calendar.season}` : '')
          : '');
      svg.appendChild(sub);
    }

    // time axis
    svg.appendChild(
      svgEl('line', {
        x1: PAD,
        y1: axisY,
        x2: WIDTH - PAD,
        y2: axisY,
        stroke: isDark() ? '#444' : '#ccc',
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
          stroke: isDark() ? '#666' : '#999',
          'stroke-width': 1,
        }),
      );
      const l = svgEl('text', {
        x,
        y: axisY + 14,
        fill: isDark() ? '#999' : '#666',
        'font-size': 10,
        'text-anchor': 'middle',
      });
      l.textContent = tp;
      svg.appendChild(l);
    });

    if (frames.length) {
      const fLabel = svgEl('text', {
        x: PAD - 4,
        y: frameLaneY - 6,
        fill: isDark() ? '#aaa' : '#555',
        'font-size': 10,
        'font-weight': '600',
      });
      fLabel.textContent = 'Frames';
      svg.appendChild(fLabel);

      const FRAME_H = 30,
        FRAME_GAP = 12;
      const frameYMap = {};
      const frameX1Map = {};
      const col = isDark() ? '#A5D6A7' : '#388E3C';
      const colLight = isDark()
        ? 'rgba(165,214,167,0.12)'
        : 'rgba(56,142,60,0.06)';

      // derive each frame's time range from edges scoped to it
      function frameTimeRange(frameId) {
        const pts = new Set();
        // find edges whose scope references this frame
        (w.edges || []).forEach((e) => {
          if (!e.scope) return;
          if (scopeReferencesFrame(e.scope, frameId))
            collectTimePoints(e.scope, pts);
        });
        // also include branches_at of child frames (where children fork off)
        frames.forEach((f) => {
          if (f.parent === frameId && f.branches_at) pts.add(f.branches_at);
        });
        const arr = [...pts].filter((p) => sorted.includes(p)).sort();
        if (!arr.length) return null;
        return { from: arr[0], to: arr[arr.length - 1] };
      }

      // reuse top-level scopeRefFrame
      const scopeReferencesFrame = scopeRefFrame;

      frames.forEach((frame, fi) => {
        const y = frameLaneY + fi * (FRAME_H + FRAME_GAP);
        frameYMap[frame.id] = y;

        // determine x span from scoped edges
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
          'font-weight': '600',
        });
        nameEl.textContent = frame.name || frame.id;
        g.appendChild(nameEl);

        svg.appendChild(g);
      });

      // draw branching arrows from parent to child at branches_at
      frames.forEach((frame) => {
        if (!frame.parent || !frame.branches_at) return;
        const parentY = frameYMap[frame.parent];
        const childY = frameYMap[frame.id];
        if (parentY == null || childY == null) return;

        // branch point on parent timeline
        const branchX = sorted.includes(frame.branches_at)
          ? tpX(frame.branches_at)
          : PAD + 20;
        // left edge of child bar
        const childX1 = frameX1Map[frame.id] || PAD;
        const sy = parentY + FRAME_H / 2;
        const ty = childY + FRAME_H / 2;

        // curved arrow from branch point on parent to left edge of child
        const midY = (sy + ty) / 2;
        svg.appendChild(
          svgEl('path', {
            d: `M${branchX},${sy} C${branchX},${midY} ${childX1},${midY} ${childX1},${ty}`,
            fill: 'none',
            stroke: col,
            'stroke-width': 1.5,
            'stroke-dasharray': '4,2',
          }),
        );
        // arrow head at child
        const dir = ty > sy ? 1 : -1;
        svg.appendChild(
          svgEl('polygon', {
            points: `${childX1 - 4},${ty - dir * 6} ${childX1},${ty} ${childX1 + 4},${ty - dir * 6}`,
            fill: col,
          }),
        );
        // dot at branch point on parent
        svg.appendChild(
          svgEl('circle', { cx: branchX, cy: sy, r: 3, fill: col }),
        );
        // label at branch point
        const lbl = svgEl('text', {
          x: branchX + 6,
          y: sy - 4,
          fill: col,
          'font-size': 10,
        });
        lbl.textContent = frame.branches_at;
        svg.appendChild(lbl);
      });

      // update total height
      const newH = frameLaneY + frames.length * (FRAME_H + FRAME_GAP) + PAD;
      svg.setAttribute('height', newH);
      svg.setAttribute('viewBox', `0 0 ${WIDTH} ${newH}`);
    }

    onSelect((sel) => {
      svg.querySelectorAll('.frame-box').forEach((b) => {
        const fid = b.getAttribute('data-frame');
        const isSelected =
          sel != null && sel.kind === 'frame' && sel.id === fid;
        b.classList.toggle('greyed', sel != null && !isSelected);
        b.classList.toggle('sel-highlight', isSelected);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW 4: LENSES
     ═══════════════════════════════════════════════════════════════════ */
  function renderLenses(container) {
    const lenses = (story.narrative || {}).lenses || [];
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
      card.dataset.lens = lens.id;
      card.addEventListener('click', () =>
        select({ kind: 'lens', id: lens.id }),
      );
      card.innerHTML = lensCardHTML(lens);
      grid.appendChild(card);
    });
    onSelect((sel) => {
      const rel = relatedIds(sel);
      grid.querySelectorAll('.lens-card').forEach((c) => {
        const id = c.dataset.lens;
        c.classList.toggle('greyed', rel != null && !rel.lenses.has(id));
        c.classList.toggle('sel-highlight', rel != null && rel.lenses.has(id));
      });
    });
  }

  function lensCardHTML(lens) {
    let h = `<h4>${esc(lens.id)}</h4>`;
    const p = lens.perspective || {};
    h += `<div class="lens-row"><strong>Perspective:</strong> <span class="info-badge">${p.type || '?'}</span>`;
    if (p.person) h += ` <span class="info-badge">${p.person} person</span>`;
    h += '</div>';
    if (p.anchor)
      h += `<div class="lens-row"><strong>Anchor:</strong> <a class="info-link" data-kind="node" data-id="${p.anchor}">${p.anchor}</a></div>`;
    const k = lens.knowledge || {};
    if (k.mode) {
      h += `<div class="lens-row"><strong>Knowledge:</strong> ${k.mode}`;
      if (k.include_subconscious)
        h += ' <span class="lens-flag">+subconscious</span>';
      if (k.include_wrong_beliefs)
        h += ' <span class="lens-flag">+wrong beliefs</span>';
      h += '</div>';
    }
    const tp = lens.temporal_position || {};
    if (tp.type)
      h += `<div class="lens-row"><strong>Temporal:</strong> ${tp.type}</div>`;
    const em = lens.emotional || {};
    if (em.bias) {
      h += `<div class="lens-row"><strong>Bias toward:</strong> ${(em.bias.toward || []).map((id) => `<a class="info-link" data-kind="node" data-id="${id}">${id}</a>`).join(', ')}`;
      if (em.bias.bias_strength != null) h += ` (${em.bias.bias_strength})`;
      h += '</div>';
    }
    const v = lens.voice || {};
    if (v.vocabulary_level || v.sentence_tendency) {
      h += '<div class="lens-row"><strong>Voice:</strong> ';
      const pts = [];
      if (v.vocabulary_level) pts.push(v.vocabulary_level);
      if (v.sentence_tendency) pts.push(v.sentence_tendency);
      if (v.metaphor_density) pts.push('metaphor: ' + v.metaphor_density);
      if (v.inner_monologue) pts.push('inner monologue');
      h += pts.join(', ');
      if (v.verbal_tics?.length)
        h += `<br><em>"${v.verbal_tics.join('", "')}"</em>`;
      h += '</div>';
    }
    const r = lens.reliability || {};
    if (r.level) {
      h += `<div class="lens-row"><strong>Reliability:</strong> <span class="info-badge" style="background:${c(r.level)}">${r.level}</span>`;
      if (r.distorts?.length)
        h += `<br>Distorts: ${r.distorts.map((d) => `${d.node} (${d.direction})`).join(', ')}`;
      h += '</div>';
    }
    return h;
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW 5: FORMATS
     ═══════════════════════════════════════════════════════════════════ */
  function renderFormats(container) {
    const formats = (story.narrative || {}).formats || [];
    if (!formats.length) {
      container.innerHTML = '<p class="empty-msg">No formats defined.</p>';
      return;
    }
    formats.forEach((fmt) => {
      const card = document.createElement('div');
      card.className = 'format-card';
      let h = `<h4>${esc(fmt.name || fmt.id)}</h4><span class="info-badge">${fmt.type}</span>`;
      h +=
        '<div class="format-tree">' +
        renderStructureLevel(fmt.structure, 0) +
        '</div>';
      if (fmt.settings)
        h +=
          '<div class="format-settings"><strong>Settings:</strong><pre>' +
          esc(JSON.stringify(fmt.settings, null, 2)) +
          '</pre></div>';
      card.innerHTML = h;
      container.appendChild(card);
    });
  }
  function renderStructureLevel(s, depth) {
    if (!s) return '';
    let h = `<div class="structure-level" style="margin-left:${depth * 16}px"><span class="structure-type">${esc(s.type)}</span>`;
    if (s.constraints)
      h += ` <span class="structure-constraints">${Object.entries(s.constraints)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}</span>`;
    h += '</div>';
    if (s.children) h += renderStructureLevel(s.children, depth + 1);
    return h;
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW 6: CONSTRAINTS
     ═══════════════════════════════════════════════════════════════════ */
  function renderConstraints(container) {
    const constraints = (story.world || {}).constraints || [];
    if (!constraints.length) {
      container.innerHTML = '<p class="empty-msg">No constraints defined.</p>';
      return;
    }
    // group by severity dynamically (no hardcoded severity values)
    const groups = {};
    constraints.forEach((con) => {
      const s = con.severity || 'UNKNOWN';
      (groups[s] = groups[s] || []).push(con);
    });
    Object.keys(groups).forEach((sev) => {
      const sec = document.createElement('div');
      sec.innerHTML = `<h4 style="color:${c(sev)}">${sev}</h4>`;
      groups[sev].forEach((con) => {
        const card = document.createElement('div');
        card.className = 'constraint-card';
        card.style.borderLeftColor = c(sev);
        card.innerHTML =
          `<strong>${esc(con.name)}</strong><p>${esc(con.description || '')}</p>` +
          (con.scope
            ? `<div class="info-scope">${renderScope(con.scope)}</div>`
            : '');
        sec.appendChild(card);
      });
      container.appendChild(sec);
    });
  }

  /* ── detail HTML builders ──────────────────────────────────────── */
  function nodeDetailHTML(node) {
    let h = `<h4>${esc(node.name)}</h4><span class="info-badge" style="background:${c(typeId(node.nodeType))}">${typeName(node.nodeType)}</span>`;
    if (node.description)
      h += `<p class="info-desc">${esc(node.description)}</p>`;
    if (node.tags?.length)
      h += `<div class="info-tags">${node.tags.map((t) => `<span class="info-tag">${esc(t)}</span>`).join('')}</div>`;
    if (node.properties)
      h += `<table class="info-props">${Object.entries(node.properties)
        .map(
          ([k, v]) =>
            `<tr><td>${esc(k)}</td><td>${esc(JSON.stringify(v))}</td></tr>`,
        )
        .join('')}</table>`;
    return h;
  }
  function edgeDetailHTML(edge) {
    let h = `<h4>${esc(edge.name)}</h4><span class="info-badge" style="background:${c(typeId(edge.edgeType))}">${typeName(edge.edgeType)}</span>`;
    h += `<p><strong>${esc(typeId(edge.source))}</strong> &rarr; <strong>${esc(typeId(edge.target))}</strong></p>`;
    if (edge.description)
      h += `<p class="info-desc">${esc(edge.description)}</p>`;
    if (edge.scope)
      h += `<div class="info-scope"><strong>Scope:</strong> ${renderScope(edge.scope)}</div>`;
    return h;
  }
  function beatDetailHTML(beat) {
    let h = `<h4>${esc(beat.name)}</h4>`;
    if (beat.function)
      h += `<span class="info-badge" style="background:${c(beat.function || 'default')}">${beat.function}</span>`;
    if (beat.description)
      h += `<p class="info-desc">${esc(beat.description)}</p>`;
    if (beat.tension != null)
      h += `<p><strong>Tension:</strong> ${beat.tension}</p>`;
    if (beat.emotionalTarget != null)
      h += `<p><strong>Emotional:</strong> ${beat.emotionalTarget}</p>`;
    if (beat.nodeIds)
      h += `<p><strong>Nodes:</strong> ${beat.nodeIds.map((id) => `<a class="info-link" data-kind="node" data-id="${id}">${id}</a>`).join(', ')}</p>`;
    if (beat.edgeIds)
      h += `<p><strong>Edges:</strong> ${beat.edgeIds.map((id) => `<a class="info-link" data-kind="edge" data-id="${id}">${id}</a>`).join(', ')}</p>`;
    if (beat.reveals?.length)
      h += `<p><strong>Reveals:</strong> ${beat.reveals.map((r) => `${r.target} (${r.degree || 'FULL'})`).join(', ')}</p>`;
    if (beat.transition)
      h += `<p><strong>Transition:</strong> ${beat.transition.transitionType}</p>`;
    return h;
  }
  function threadDetailHTML(thread) {
    let h = `<h4>${esc(thread.name)}</h4><span class="info-badge">${thread.type}</span>`;
    if (thread.description)
      h += `<p class="info-desc">${esc(thread.description)}</p>`;
    if (thread.appearances) {
      h += '<ul class="appearance-list">';
      thread.appearances.forEach((a) => {
        h += `<li><a class="info-link" data-kind="beat" data-id="${a.beatId}"><strong>${a.beatId}</strong></a>: ${esc(a.description || '')}</li>`;
      });
      h += '</ul>';
    }
    return h;
  }
  function deviceDetailHTML(dev) {
    let h = `<h4>${esc(dev.id)}</h4><span class="info-badge">${dev.type}</span>`;
    if (dev.description)
      h += `<p class="info-desc">${esc(dev.description)}</p>`;
    if (dev.setup)
      h += `<p><strong>Setup:</strong> ${dev.setup.map((id) => `<a class="info-link" data-kind="beat" data-id="${id}">${id}</a>`).join(', ')}</p>`;
    if (dev.payoff)
      h += `<p><strong>Payoff:</strong> ${dev.payoff.map((id) => `<a class="info-link" data-kind="beat" data-id="${id}">${id}</a>`).join(', ')}</p>`;
    return h;
  }

  function frameDetailHTML(frame) {
    let h = `<h4>${esc(frame.name || frame.id)}</h4><span class="info-badge" style="background:#388E3C">FRAME</span>`;
    if (frame.description)
      h += `<p class="info-desc">${esc(frame.description)}</p>`;
    if (frame.parent)
      h += `<p><strong>Parent:</strong> ${esc(frame.parent)}</p>`;
    if (frame.branches_at)
      h += `<p><strong>Branches at:</strong> ${esc(frame.branches_at)}</p>`;
    if (frame.relations && frame.relations.length) {
      h += '<p><strong>Relations:</strong></p><ul class="appearance-list">';
      frame.relations.forEach((r) => {
        h +=
          `<li>${r.type.replace(/_/g, ' ')} → ${r.target}` +
          (r.at ? ` at ${r.at}` : '') +
          (r.description ? ` — ${esc(r.description)}` : '') +
          '</li>';
      });
      h += '</ul>';
    }
    return h;
  }

  /* ── helpers ────────────────────────────────────────────────────── */
  function scopeRefFrame(scope, frameId) {
    if (!scope) return false;
    if (scope.selectorType === 'frame' && scope.selectorItem === frameId)
      return true;
    if (scope.and) return scope.and.some((s) => scopeRefFrame(s, frameId));
    if (scope.or) return scope.or.some((s) => scopeRefFrame(s, frameId));
    if (scope.not) return scopeRefFrame(scope.not, frameId);
    return false;
  }
  function esc(s) {
    if (typeof s !== 'string') s = String(s || '');
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }
  function createSVG(w, h) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.style.width = w + 'px';
    s.style.minWidth = w + 'px';
    return s;
  }
  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function renderScope(scope) {
    if (!scope) return '';
    if (scope.selectorType && scope.selectorItem)
      return `<code>${scope.selectorType}: ${scope.selectorItem}</code>`;
    if (scope.and) return '(' + scope.and.map(renderScope).join(' AND ') + ')';
    if (scope.or) return '(' + scope.or.map(renderScope).join(' OR ') + ')';
    if (scope.not) return 'NOT ' + renderScope(scope.not);
    if (scope.in) return 'IN [' + scope.in.map(renderScope).join(', ') + ']';
    if (scope.range) {
      const f = scope.range.from ? renderScope(scope.range.from) : '∞',
        t = scope.range.to ? renderScope(scope.range.to) : '∞';
      return `${f} → ${t}`;
    }
    return JSON.stringify(scope);
  }
  function _extractRange(scope) {
    if (!scope) return null;
    if (scope.range)
      return {
        from: scope.range.from?.item || null,
        to: scope.range.to?.item || null,
      };
    if (scope.and) {
      for (const s of scope.and) {
        const r = extractRange(s);
        if (r) return r;
      }
    }
    return null;
  }
  function collectTimePoints(scope, set) {
    if (!scope) return;
    if (scope.selectorType === 'time' && scope.selectorItem) {
      set.add(scope.selectorItem);
      return;
    }
    if (scope.range) {
      if (scope.range.from) collectTimePoints(scope.range.from, set);
      if (scope.range.to) collectTimePoints(scope.range.to, set);
      return;
    }
    ['and', 'or'].forEach((k) => {
      if (scope[k]) scope[k].forEach((s) => collectTimePoints(s, set));
    });
    if (scope.not) collectTimePoints(scope.not, set);
    if (scope.in) scope.in.forEach((s) => collectTimePoints(s, set));
  }

  root.addEventListener('click', (e) => {
    const link = e.target.closest('.info-link');
    if (link) {
      e.preventDefault();
      select({ kind: link.dataset.kind, id: link.dataset.id });
    }
  });
})();
