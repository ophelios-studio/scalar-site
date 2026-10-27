// The field: simulated agents moving left to right over block height, in bands of ordinary work
// with gaps between them. The visitor draws a line. A line counts only from the block it was
// registered at, so moving it registers a new line from now on; the old one stays in the record.
// A trace that crosses the current line is marked in signal color and stays highlighted.
//
// Everything here is simulated on this page from a fixed seed. Nothing is chain data.

import { rng, lerp, clamp, fmt, sizeCanvas, colors, rgba, whenVisible, reducedMotion } from './trace.js';

const BANDS = [[0.05, 0.17], [0.26, 0.47], [0.56, 0.69], [0.78, 0.95]];
const BLOCKS_PER_SECOND = 10;
const HEAD = 0.76;                 // where "now" sits, as a fraction of the width
const START_BLOCK = 1600;          // history simulated before the first frame
const FIRST_LINE = { y: 0.515, at: 1310 };

const bandOf = (y) => BANDS.findIndex(([a, b]) => y >= a && y <= b);
const pad2 = (n) => String(n).padStart(2, '0');

export default function field(root) {
    const canvas = root.querySelector('canvas');
    const area = root.querySelector('.hero-field');
    const ctl = root.querySelector('.line-ctl');
    const handle = root.querySelector('.line-handle');
    const label = root.querySelector('.line-label');
    const pendingEl = root.querySelector('.line-pending');
    const hint = root.querySelector('.line-hint');
    const tag = root.querySelector('.cross-tag');
    const hudLine = root.querySelector('[data-hud="line"]');
    const hudWhere = root.querySelector('[data-hud="where"]');
    const live = root.querySelector('[data-hud="live"]');
    const toggle = root.querySelector('[data-hud="toggle"]');

    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const N = mobile ? 110 : 240;
    const R = rng(0x5ca1a7);

    // ── Agents ───────────────────────────────────────────────────────────
    const total = BANDS.reduce((s, [a, b]) => s + (b - a), 0);
    const agents = [];
    BANDS.forEach(([a, b], bi) => {
        const n = Math.round(N * (b - a) / total);
        for (let k = 0; k < n; k++) {
            const y = lerp(a, b, (k + 0.5) / n);
            const bright = R() < 0.08;
            agents.push({
                id: 0, band: bi, lo: a, hi: b, y,
                pts: [[0, y]], next: lerp(0, 120, R()), ticks: [], tickNext: lerp(0, 60, R()),
                alpha: bright ? lerp(0.34, 0.5, R()) : lerp(0.07, 0.24, R()),
                ticked: R() < 0.18, drifter: false, down: false, jumpAt: Infinity, lit: 0,
            });
        }
    });
    // Number agents top to bottom, as a register would list them.
    agents.forEach((g, i) => { g.id = i + 1; });
    // A few agents drift: now and then they leave their band for another, crossing the gaps.
    const pool = agents.filter((_, i) => i % Math.floor(agents.length / 14) === 3);
    pool.forEach(g => { g.drifter = true; g.jumpAt = lerp(120, 900, R()); });

    // ── Lines and crossings ──────────────────────────────────────────────
    let lineNo = 1;
    let line = { no: 1, y: FIRST_LINE.y, from: FIRST_LINE.at, to: Infinity };
    const past = [];
    const crossings = [];
    let head = 0;

    function stepAgent(g, b) {
        let ny = g.y;
        if (g.drifter && b >= g.jumpAt) {
            // Leave for a neighbouring band.
            const dir = g.down ? 1 : g.band === 0 ? 1 : g.band === BANDS.length - 1 ? -1 : (R() < 0.5 ? -1 : 1);
            g.down = false;
            g.band += dir;
            [g.lo, g.hi] = BANDS[g.band];
            ny = lerp(g.lo + 0.02, g.hi - 0.02, R());
            g.jumpAt = b + lerp(160, 520, R());
        } else if (R() < 0.55) {
            const mag = lerp(0.004, 0.02, R());
            ny = clamp(g.y + (R() < 0.5 ? -mag : mag), g.lo, g.hi);
        }
        g.next = b + lerp(18, 110, R());
        if (ny === g.y) return;
        if (b >= line.from && (g.y - line.y) * (ny - line.y) < 0) {
            crossings.push({ b, y: line.y, line: line.no, agent: g.id });
            g.lit = line.no;
            if (head > START_BLOCK) announce(g, b);
        }
        g.pts.push([b, g.y], [b, ny]);
        g.y = ny;
    }

    function advance(to) {
        // Process every step due before `to`, in block order, so crossings land where they happen.
        for (;;) {
            let g = null;
            for (const a of agents) if (a.next <= to && (!g || a.next < g.next)) g = a;
            if (!g) break;
            const b = Math.round(g.next);
            head = Math.max(head, b);
            stepAgent(g, b);
        }
        for (const g of agents) {
            if (!(g.ticked || g.lit === line.no)) continue;
            while (g.tickNext <= to) { g.ticks.push(g.tickNext); g.tickNext += lerp(30, 90, R()); }
        }
        head = to;
    }

    // A scripted first crossing a few seconds in, so the idea shows before anyone touches it:
    // the lowest agent of the second band steps down into the third, across the first line.
    function scheduleFirst() {
        const g = agents.filter(a => a.band === 1).sort((a, b) => b.y - a.y)[0];
        g.drifter = true; g.down = true;
        g.jumpAt = START_BLOCK + 24;
    }

    // Simulate the history the field opens on.
    advance(START_BLOCK);
    scheduleFirst();

    // ── Drawing ──────────────────────────────────────────────────────────
    let W = 0, H = 0, ctx, col, pxb, headX;
    function resize() {
        ({ ctx, w: W, h: H } = sizeCanvas(canvas));
        col = colors(root);
        headX = Math.round(W * HEAD);
        pxb = mobile ? 0.9 : clamp(W / 1200, 0.9, 1.5);
        placeLine();
        draw();
    }

    const xOf = (b) => headX - (head - b) * pxb;
    const margin = () => clamp(W * 0.0625, 20, 120);
    const yOf = (y) => Math.round(y * (H - 2)) + 0.5;

    function prune() {
        const minB = head - (headX + 40) / pxb;
        for (const g of agents) {
            let i = 0;
            while (i < g.pts.length - 2 && g.pts[i + 2][0] < minB) i += 2;
            if (i) g.pts.splice(0, i);
            while (g.ticks.length && g.ticks[0] < minB) g.ticks.shift();
        }
        while (crossings.length && crossings[0].b < minB - 200) crossings.shift();
        while (past.length && past[0].to < minB) past.shift();
    }

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        ctx.lineJoin = 'round';

        // Ordinary traces, batched by opacity.
        const buckets = new Map();
        for (const g of agents) {
            if (g.lit === line.no) continue;
            const key = Math.round(g.alpha * 20) / 20;
            let p = buckets.get(key);
            if (!p) buckets.set(key, (p = new Path2D()));
            trace(p, g);
        }
        ctx.lineWidth = 1;
        for (const [a, p] of buckets) { ctx.strokeStyle = rgba(col.fg, a); ctx.stroke(p); }

        // Action marks.
        for (const g of agents) {
            if (!g.ticks.length) continue;
            const lit = g.lit === line.no;
            ctx.fillStyle = rgba(col.fg, lit ? 1 : Math.min(1, g.alpha + 0.3));
            for (const t of g.ticks) {
                const y = yAtB(g, t);
                const s = lit ? 3 : 2.5;
                ctx.fillRect(Math.round(xOf(t) - s / 2), Math.round(yOf(y) - s / 2), s, s);
            }
        }

        // Past lines: still in the record, fainter, ending where the next one began.
        ctx.setLineDash([7, 5]);
        ctx.lineWidth = 1;
        for (const l of past) {
            const a = Math.max(0, xOf(l.from)), b = xOf(l.to);
            if (b <= 0) continue;
            ctx.strokeStyle = rgba(col.fg, 0.38);
            ctx.beginPath(); ctx.moveTo(a, yOf(l.y)); ctx.lineTo(b, yOf(l.y)); ctx.stroke();
        }
        // The current line runs from its block into the future.
        ctx.strokeStyle = rgba(col.fg, 0.9);
        ctx.beginPath(); ctx.moveTo(Math.max(0, xOf(line.from)), yOf(line.y)); ctx.lineTo(W, yOf(line.y)); ctx.stroke();
        if (pending != null) {
            ctx.strokeStyle = rgba(col.fg, 0.55);
            ctx.beginPath(); ctx.moveTo(headX, yOf(pending)); ctx.lineTo(W, yOf(pending)); ctx.stroke();
        }
        ctx.setLineDash([]);

        // Agents that crossed: full strength from now on.
        ctx.strokeStyle = rgba(col.fg, 0.95);
        ctx.lineWidth = 1.3;
        for (const g of agents) {
            if (g.lit !== line.no) continue;
            const p = new Path2D();
            trace(p, g);
            ctx.stroke(p);
        }

        // Crossings: the only color.
        ctx.fillStyle = col.signal;
        for (const c of crossings) {
            const x = xOf(c.b);
            if (x < -10) continue;
            const s = c.line === line.no ? 8 : 6;
            ctx.fillRect(Math.round(x - s / 2), Math.round(yOf(c.y) - s / 2), s, s);
        }

        // Now: the head of the record, and the future to its right.
        ctx.fillStyle = rgba(col.fg, 0.035);
        ctx.fillRect(headX, 0, W - headX, H);
        ctx.strokeStyle = rgba(col.fg, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(headX + 0.5, 0); ctx.lineTo(headX + 0.5, H); ctx.stroke();

        // Now, and the block it stands at.
        ctx.font = '500 11px "JetBrains Mono", monospace';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1.3px';
        // Where the future is too narrow for them (a phone), they stand left of the head instead.
        const note = (t, y) => {
            const tw = ctx.measureText(t).width;
            const x = headX + 10 + tw < W - 6 ? headX + 10 : headX - 10 - tw;
            if (x < headX) { ctx.fillStyle = col.bg; ctx.fillRect(x - 6, y - 12, tw + 12, 17); }
            ctx.fillStyle = col.fg3;
            ctx.fillText(t, x, y);
        };
        note(`NOW · BLOCK ${fmt(head)}`, 16);
        note('LINES ARE DRAWN AHEAD', H - 10);

        label.style.left = `${Math.round(Math.max(margin(), xOf(line.from) + 6))}px`;
        placeTag();
    }

    function trace(p, g) {
        const pts = g.pts;
        const x0 = xOf(pts[0][0]);
        p.moveTo(Math.max(-2, x0), yOf(pts[0][1]));
        for (let i = 1; i < pts.length; i++) p.lineTo(xOf(pts[i][0]), yOf(pts[i][1]));
        p.lineTo(headX, yOf(g.y));
    }

    function yAtB(g, b) {
        let y = g.pts[0][1];
        for (const [pb, py] of g.pts) { if (pb > b) break; y = py; }
        return y;
    }

    // ── The line's controls, over the canvas ─────────────────────────────
    function placeLine() {
        ctl.style.transform = `translateY(${yOf(pending ?? line.y)}px)`;
        label.innerHTML = `LINE ${pad2(line.no)} <span>· FROM BLOCK ${fmt(line.from)}</span>`;
        const inGap = bandOf(line.y) < 0;
        const k = countFor(line.no);
        hudLine.innerHTML = `<b>Line ${pad2(line.no)}</b> · from block ${fmt(line.from)} · <b data-count>${k}</b> crossing${k === 1 ? '' : 's'} since`;
        hudWhere.textContent = inGap
            ? 'In a gap: no ordinary task crosses here. A crossing is a finding.'
            : 'Through a band of ordinary work: crossed all the time. Draw it in a gap.';
        handle.setAttribute('aria-valuenow', String(Math.round((1 - (pending ?? line.y)) * 100)));
        handle.setAttribute('aria-valuetext', pending != null
            ? `New line at height ${Math.round((1 - pending) * 100)}, not registered yet. Press Enter to register it.`
            : `Line ${pad2(line.no)} at height ${Math.round((1 - line.y) * 100)}, registered at block ${fmt(line.from)}, ${inGap ? 'in a gap' : 'through a band'}, ${countFor(line.no)} crossings since.`);
        ctl.classList.toggle('is-pending', pending != null);
        if (pending != null) pendingEl.textContent = `Registers at block ${fmt(Math.ceil(head))}`;
    }
    const countFor = (no) => crossings.filter(c => c.line === no).length;

    function placeTag() {
        const c = [...crossings].reverse().find(k => k.line === line.no);
        if (!c) { tag.style.transform = 'translate(-200vw, 0)'; return; }
        const x = xOf(c.b), y = yOf(c.y);
        const text = mobile
            ? `Crossing · agent ${c.agent} · block ${fmt(c.b)}`
            : `Crossing · line ${pad2(c.line)} · agent ${c.agent} · block ${fmt(c.b)}`;
        if (tag.dataset.text !== text) { tag.textContent = text; tag.dataset.text = text; tag._w = tag.offsetWidth; }
        const w = tag._w || 260;
        const left = clamp(x - w - 12 > 8 ? x - w - 12 : x + 12, 8, Math.max(8, W - w - 8));
        tag.style.transform = `translate(${Math.round(left)}px, ${Math.round(y + 7)}px)`;
    }

    let lastAnnounce = 0;
    function announce(g, b) {
        const n = countFor(line.no);
        const el = hudLine.querySelector('[data-count]');
        if (el) placeLine();
        const now = performance.now();
        if (now - lastAnnounce < 8000) return;
        lastAnnounce = now;
        live.textContent = `Agent ${g.id} crossed line ${pad2(line.no)} at block ${fmt(b)}. ${n} crossing${n === 1 ? '' : 's'} since it was registered.`;
    }

    function register(y) {
        y = clamp(y, 0.02, 0.98);
        const at = Math.ceil(head);
        past.push({ ...line, to: at });
        lineNo += 1;
        line = { no: lineNo, y, from: at, to: Infinity };
        pending = null;
        placeLine();
        draw();
        hint?.classList.add('is-gone');
    }

    // Dragging the handle shows the new line ahead of now; letting go registers it.
    let pending = null, dragging = false, commitTimer = 0;
    const toY = (clientY) => {
        const r = area.getBoundingClientRect();
        return clamp((clientY - r.top) / r.height, 0.02, 0.98);
    };
    handle.addEventListener('pointerdown', (e) => {
        dragging = true;
        handle.setPointerCapture(e.pointerId);
        handle.classList.add('is-dragging');
        pending = toY(e.clientY);
        placeLine(); draw();
        e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        pending = toY(e.clientY);
        placeLine(); draw();
    });
    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('is-dragging');
        if (pending != null) register(pending);
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);

    // Tap or click anywhere in the field draws a line at that height.
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
        if (!down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        down = null;
        if (moved < 8) register(toY(e.clientY));
    });

    handle.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.05 : 0.01;
        const cur = pending ?? line.y;
        let next = null;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = cur - step;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = cur + step;
        else if (e.key === 'PageUp') next = cur - 0.1;
        else if (e.key === 'PageDown') next = cur + 0.1;
        else if (e.key === 'Home') next = 0.02;
        else if (e.key === 'End') next = 0.98;
        else if ((e.key === 'Enter' || e.key === ' ') && pending != null) { e.preventDefault(); clearTimeout(commitTimer); register(pending); return; }
        else if (e.key === 'Escape' && pending != null) { pending = null; placeLine(); draw(); return; }
        if (next == null) return;
        e.preventDefault();
        pending = clamp(next, 0.02, 0.98);
        placeLine(); draw();
        clearTimeout(commitTimer);
        commitTimer = setTimeout(() => { if (pending != null) register(pending); }, 1200);
    });

    // ── Time ─────────────────────────────────────────────────────────────
    let running = !reducedMotion(), visible = true, raf = 0, last = 0;
    const loop = (t) => {
        raf = 0;
        if (!running || !visible) return;
        const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
        last = t;
        advance(head + dt * BLOCKS_PER_SECOND);
        prune();
        draw();
        raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && running && visible) { last = 0; raf = requestAnimationFrame(loop); } };
    whenVisible(area, (v) => { visible = v; kick(); });

    const setRunning = (on) => {
        running = on;
        toggle.setAttribute('aria-pressed', String(!on));
        toggle.querySelector('span').textContent = on ? 'Pause' : 'Play';
        kick();
    };
    toggle.addEventListener('click', () => setRunning(!running));
    setRunning(running);

    new ResizeObserver(() => resize()).observe(area);
    document.fonts?.ready.then(() => { tag._w = 0; tag.dataset.text = ''; draw(); });
    resize();
    requestAnimationFrame(() => requestAnimationFrame(() => root.querySelector('.fig.draw')?.classList.add('is-drawn')));
}
