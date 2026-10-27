// The one drawing language. An agent is an orthogonal step path moving left to right across
// block height (the x axis is never time). Lines are registered in advance and dashed. The only
// color anywhere is a crossing. Every figure is seeded, so every render is the same.

// Mulberry32: small, fast, and good enough for drawing.
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
const f = (v) => String(Math.round(v * 100) / 100);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Orthogonal geometry ──────────────────────────────────────────────────

export function simplify(pts) {
    const out = [];
    for (const p of pts) {
        const last = out[out.length - 1];
        if (last && last[0] === p[0] && last[1] === p[1]) continue;
        if (out.length >= 2) {
            const a = out[out.length - 2], b = last;
            if ((a[0] === b[0] && b[0] === p[0]) || (a[1] === b[1] && b[1] === p[1])) { out[out.length - 1] = p; continue; }
        }
        out.push(p);
    }
    return out;
}

// An orthogonal polyline as a path with small rounded corners: the geometry of the S mark.
export function orth(pts, r = 2) {
    const p = simplify(pts);
    if (p.length < 2) return '';
    let d = `M${f(p[0][0])},${f(p[0][1])}`;
    for (let i = 1; i < p.length - 1; i++) {
        const [ax, ay] = p[i - 1], [bx, by] = p[i], [cx, cy] = p[i + 1];
        const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by);
        const rr = Math.min(r, l1 / 2, l2 / 2);
        const ux = (bx - ax) / l1, uy = (by - ay) / l1, vx = (cx - bx) / l2, vy = (cy - by) / l2;
        d += `L${f(bx - ux * rr)},${f(by - uy * rr)}Q${f(bx)},${f(by)} ${f(bx + vx * rr)},${f(by + vy * rr)}`;
    }
    const z = p[p.length - 1];
    return d + `L${f(z[0])},${f(z[1])}`;
}

export function yAt(pts, x) {
    for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        if (y1 === y2 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) return y1;
    }
    return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}

export function stepXs(pts) {
    const xs = [];
    for (let i = 0; i < pts.length - 1; i++) if (pts[i][0] === pts[i + 1][0]) xs.push(pts[i][0]);
    return xs;
}

export function clipX(pts, a, b) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        if (x1 === x2) { if (x1 >= a && x1 <= b) out.push([x1, y1], [x2, y2]); }
        else {
            const lo = Math.max(Math.min(x1, x2), a), hi = Math.min(Math.max(x1, x2), b);
            if (lo <= hi) out.push([lo, y1], [hi, y2]);
        }
    }
    return simplify(out);
}

export const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);

// An orthogonal random walk from x0 to x1. toward(t) pulls it toward a height so drift accrues
// step by step; pAt(x) replaces the step probability (Live agents move by day, rest at night);
// end forces a final height, reached by a step `flat` before x1.
export function walk(R, o) {
    const { x0, x1, y0 } = o;
    const lo = o.lo ?? -1e9, hi = o.hi ?? 1e9;
    const run = o.run ?? [24, 120], step = o.step ?? [3, 12], p = o.p ?? 0.7;
    const stopAt = o.end != null ? x1 - (o.flat ?? 48) : x1;
    const pts = [[x0, y0]];
    let x = x0 + (o.flat0 ?? 0), y = y0;
    if (o.flat0) pts.push([x, y]);
    for (;;) {
        const nx = Math.round(x + lerp(run[0], run[1], R()));
        if (nx >= stopAt - 6) break;
        x = nx;
        if (R() < (o.pAt ? o.pAt(x) : p)) {
            const t = (x - x0) / (x1 - x0);
            const pd = o.toward ? 0.5 + clamp((o.toward(t) - y) / (o.pull ?? 24), -0.42, 0.42) : 0.5 + (o.bias ? o.bias(t) : 0);
            const down = R() < pd;
            const mag = lerp(step[0], step[1], R());
            const ny = Math.round(clamp(y + (down ? mag : -mag), lo, hi));
            if (ny !== y) { pts.push([x, y], [x, ny]); y = ny; }
        }
    }
    if (o.end != null && o.end !== y) { pts.push([stopAt, y], [stopAt, o.end]); y = o.end; }
    pts.push([x1, y]);
    return simplify(pts);
}

// Positions for action marks along [a, b], kept clear of the trace's own vertical steps.
export function tickXs(R, pts, a, b, gap) {
    const steps = stepXs(pts);
    const out = [];
    for (let x = a + lerp(gap[0], gap[1], R()); x < b; x += lerp(gap[0], gap[1], R())) {
        const xr = Math.round(x);
        if (steps.some(s => Math.abs(s - xr) < 4)) continue;
        out.push(xr);
    }
    return out;
}

// ── Live: the working day ────────────────────────────────────────────────
// Live has real time, so its figures carry day marks above a field whose x axis stays block
// height. Days are evenly spaced and no block time is ever stated or implied.

export const WORK = [9, 17];
export function activity(h) {
    const [a, b] = WORK;
    if (h >= a && h < b) return h >= 12 && h < 13 ? 0.6 : 1;
    if (h >= a - 1 && h < a) return lerp(0.12, 1, h - (a - 1));
    if (h >= b && h < b + 3) return lerp(0.7, 0.08, (h - b) / 3);
    return 0.05;
}
export function dayClock(x0, pxh) {
    const hourAt = (x) => (x - x0) / pxh;
    const hod = (x) => ((hourAt(x) % 24) + 24) % 24;
    return { x0, pxh, hourAt, hod, xAt: (h) => x0 + h * pxh, act: (x) => activity(hod(x)) };
}
export function rhythm(R, a, b, act, gap, floor = 0.03) {
    const out = [];
    let acc = 0, need = lerp(gap[0], gap[1], R());
    for (let x = a; x < b; x++) {
        acc += Math.max(act ? act(x) : 1, floor);
        if (acc >= need) { out.push(x); acc = 0; need = lerp(gap[0], gap[1], R()); }
    }
    return out;
}
export function rhythmXs(R, pts, a, b, act, gap) {
    const steps = stepXs(pts);
    return rhythm(R, a, b, act, gap).filter(x => !steps.some(s => Math.abs(s - x) < 4));
}
export function liveWalk(R, clk, o) {
    const sh = o.shift ?? 0;
    const pAt = clk ? (x) => 0.04 + 0.7 * activity((((clk.hourAt(x) + sh) % 24) + 24) % 24) : undefined;
    return walk(R, { run: [18, 64], step: [2, 6], ...o, pAt });
}
// An agent that keeps to its band (y ± h) until cx, then steps out to `out` and stays there.
export function leave(R, clk, o) {
    const m = o.m ?? 3, sp = o.spread ?? 4;
    const a = liveWalk(R, clk, { x0: o.x0, x1: o.cx, y0: o.y, lo: o.y - o.h + m, hi: o.y + o.h - m, ...o.a });
    const b = liveWalk(R, clk, { x0: o.cx, x1: o.x1, y0: o.out, lo: o.out - sp, hi: o.out + sp, ...o.b });
    return simplify([...a.slice(0, -1), [o.cx, yAt(a, o.cx)], [o.cx, o.out], ...b.slice(1)]);
}
// The nearest x where none of the traces is mid-step, so a connector lands on a flat run.
export function flatAt(trs, x) {
    const s = trs.flatMap(stepXs);
    for (let d = 0; d < 80; d++) for (const c of [x + d, x - d]) if (!s.some(v => Math.abs(v - c) < 6)) return c;
    return x;
}

// ── The plate: one SVG figure being drawn ────────────────────────────────
// Figures size their viewBox to the element's real width, so text stays at its true size and
// strokes stay one pixel at any viewport. They redraw on resize.

export function plate(svg, seed) {
    const out = [];
    const P = {
        R: rng(seed),
        raw(s) { out.push(s); },
        path(pts, o = {}) {
            const d = orth(pts, o.r ?? 2);
            if (!d) return;
            const a = [`d="${d}"`, 'fill="none"', `stroke="${o.stroke ?? 'currentColor'}"`, `stroke-width="${o.w ?? 1}"`];
            if (o.o != null) a.push(`stroke-opacity="${o.o}"`);
            if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
            if (o.cls) a.push(`class="${o.cls}"`);
            if (o.attrs) a.push(o.attrs);
            a.push('stroke-linejoin="round"', 'vector-effect="non-scaling-stroke"');
            out.push(`<path ${a.join(' ')}/>`);
        },
        seg(x1, y1, x2, y2, o = {}) {
            const a = [`x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"`, `stroke="${o.stroke ?? 'currentColor'}"`, `stroke-width="${o.w ?? 1}"`];
            if (o.o != null) a.push(`stroke-opacity="${o.o}"`);
            if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
            if (o.cls) a.push(`class="${o.cls}"`);
            if (o.attrs) a.push(o.attrs);
            out.push(`<line ${a.join(' ')}/>`);
        },
        sq(x, y, s, o = {}) {
            const a = [`x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}"`, `fill="${o.fill ?? 'currentColor'}"`];
            if (o.stroke) a.push(`stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"`);
            if (o.o != null) a.push(`opacity="${o.o}"`);
            if (o.cls) a.push(`class="${o.cls}"`);
            if (o.attrs) a.push(o.attrs);
            out.push(`<rect ${a.join(' ')}/>`);
        },
        rect(x, y, w, h, o = {}) {
            const a = [`x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"`, `rx="${o.rx ?? 2}"`, `fill="${o.fill ?? 'none'}"`];
            if (o.stroke !== null) a.push(`stroke="${o.stroke ?? 'currentColor'}" stroke-width="${o.w ?? 1}"`);
            if (o.o != null) a.push(`stroke-opacity="${o.o}"`);
            if (o.fo != null) a.push(`fill-opacity="${o.fo}"`);
            if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
            if (o.cls) a.push(`class="${o.cls}"`);
            if (o.attrs) a.push(o.attrs);
            out.push(`<rect ${a.join(' ')}/>`);
        },
        text(x, y, s, o = {}) {
            const a = [`x="${f(x)}" y="${f(y)}"`];
            const cls = [o.cls ?? '', o.ko ? 'ko' : ''].join(' ').trim();
            if (cls) a.push(`class="${cls}"`);
            if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
            if (o.attrs) a.push(o.attrs);
            out.push(`<text ${a.join(' ')}>${esc(s)}</text>`);
        },
        arrow(x, y, dir, s = 7, o = {}) {
            const h = s / 2;
            const pts = { r: [[x, y], [x - s, y - h], [x - s, y + h]], l: [[x, y], [x + s, y - h], [x + s, y + h]],
                d: [[x, y], [x - h, y - s], [x + h, y - s]], u: [[x, y], [x - h, y + s], [x + h, y + s]] }[dir];
            out.push(`<path d="M${pts.map(p => p.map(f).join(',')).join('L')}Z" fill="currentColor"${o.o != null ? ` opacity="${o.o}"` : ''}/>`);
        },
        ticks(pts, xs, o = {}) {
            for (const x of xs) P.sq(x, yAt(pts, x), o.s ?? 3, { fill: o.fill, stroke: o.stroke, sw: o.sw, o: o.o });
        },
        // A registered line: dashed, labeled in mono.
        line(o) {
            P.seg(o.x0, o.y, o.x1, o.y, { dash: o.dash ?? '7 5', o: o.o ?? 0.8, w: o.w ?? 1, cls: o.cls, attrs: o.attrs });
            if (o.label) P.text(o.lx ?? o.x0 + 8, o.y - 8, o.label, { cls: o.lcls ?? 't-ink', ko: true });
        },
        // The crossing: a signal square on the line and its annotation.
        cross(x, y, label, o = {}) {
            P.sq(x, y, o.s ?? 9, { cls: 'sig' });
            if (label) P.text(x + (o.dx ?? 14), y + (o.dy ?? -10), label, { cls: 't-sig', ko: o.ko ?? true, anchor: o.anchor });
        },
        // The band an agent's own baseline calls normal. Drift is the trace leaving it.
        band(c, h, o = {}) {
            const base = Array.isArray(c) ? simplify(c) : [[o.x0 ?? 0, c], [o.x1 ?? 1000, c]];
            const up = shift(base, 0, -h), dn = shift(base, 0, h);
            const pt = (q) => `${f(q[0])},${f(q[1])}`;
            out.push(`<path d="M${up.map(pt).join('L')}L${dn.slice().reverse().map(pt).join('L')}Z" fill="currentColor" fill-opacity="${o.fill ?? 0.07}" stroke="none"${o.attrs ? ' ' + o.attrs : ''}/>`);
            if (o.edges !== false) for (const e of [up, dn]) P.path(e, { o: o.eo ?? 0.38, w: 0.8, r: 0, attrs: o.eattrs });
        },
        // An alert is a pointer into the record, never a verdict: a leader from the crossing to
        // the exact transaction, which it names.
        pointer(x, y, yTo, o = {}) {
            const s = o.s ?? 12;
            P.path([[x, y], [x, yTo - s / 2]], { cls: 'sig-s', w: o.w ?? 1.2 });
            P.rect(x - s / 2, yTo - s / 2, s, s, { cls: 'sig-s', w: 1.8, fill: 'var(--bg)', rx: 1 });
            P.sq(x, yTo, Math.max(3, s - 8), { cls: 'sig' });
            if (o.label) P.text(x + (o.dx ?? s / 2 + 10), yTo + 4 + (o.dy ?? 0), o.label, { cls: 't-sig', anchor: o.anchor, ko: true });
        },
        key(x, y, s = 12) { P.sq(x, y, s); P.sq(x, y, Math.max(2, Math.round(s / 3)), { fill: 'var(--bg)' }); },
        days(clk, y, o = {}) {
            const x0 = o.x0 ?? 0, x1 = o.x1 ?? 1000;
            const names = o.names ?? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            const h0 = Math.ceil(clk.hourAt(x0)), h1 = Math.floor(clk.hourAt(x1));
            P.seg(x0, y, x1, y, { o: 0.3 });
            for (let h = h0; h <= h1; h++) {
                const x = clk.xAt(h), hd = ((h % 24) + 24) % 24;
                if (hd === 0) P.seg(x, y - 6, x, y + 6, { o: 0.6 });
                else if (o.hours !== false && clk.pxh >= 4) P.seg(x, y, x, y + (hd % 6 === 0 ? 6 : 3), { o: 0.32 });
            }
            for (let d = Math.floor(h0 / 24) - 1; d <= Math.ceil(h1 / 24); d++) {
                const xa = clk.xAt(d * 24 + WORK[0]), xb = clk.xAt(d * 24 + WORK[1]);
                const a = Math.max(x0, xa), b = Math.min(x1, xb);
                if (b <= a) continue;
                P.seg(a, y, b, y, { w: 3 });
                if (names[d] && xa >= x0 - 1 && xa + 30 < x1) P.text(xa, y - 11, names[d], { cls: 't-ink' });
            }
        },
        night(clk, y0, y1, o = {}) {
            const x0 = o.x0 ?? 0, x1 = o.x1 ?? 1000;
            const d0 = Math.floor(clk.hourAt(x0) / 24) - 1, d1 = Math.ceil(clk.hourAt(x1) / 24);
            for (let d = d0; d <= d1; d++) {
                const a = Math.max(x0, clk.xAt(d * 24 + WORK[1])), b = Math.min(x1, clk.xAt((d + 1) * 24 + WORK[0]));
                if (b > a) P.rect(a, y0, b - a, y1 - y0, { fill: 'var(--shade)', stroke: null, rx: 0 });
            }
        },
        // The record as a ledger line, one mark per transaction.
        ledger(x0, x1, y, clk, o = {}) {
            P.seg(x0, y, x1, y, { o: o.o ?? 0.55 });
            for (const x of rhythm(rng(o.seed ?? 0x1ed9e7), x0, x1, clk && clk.act, o.gap ?? [3, 9], 0.04)) {
                P.seg(x, y - 3, x, y + 3, { o: 0.4 });
            }
        },
        flush() {
            svg.innerHTML = out.join('');
            out.length = 0;
            // Knock-out labels: a ground-colored plate behind text that sits over traces.
            for (const t of svg.querySelectorAll('text.ko')) {
                let b;
                try { b = t.getBBox(); } catch { continue; }
                if (!b.width) continue;
                const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                r.setAttribute('x', f(b.x - 5)); r.setAttribute('y', f(b.y - 2));
                r.setAttribute('width', f(b.width + 10)); r.setAttribute('height', f(b.height + 4));
                r.setAttribute('fill', 'var(--bg)');
                t.parentNode.insertBefore(r, t);
            }
        },
    };
    return P;
}

// Draw a figure into an SVG sized to its container; redraw when the width changes.
// draw(P, w, h) returns nothing; h comes from the container's CSS height or from ratio(w).
export function figure(el, seed, draw, opts = {}) {
    let svg = el.querySelector('svg.plate');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'plate');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        el.prepend(svg);
    }
    let lastW = 0;
    const render = () => {
        const w = Math.round(el.clientWidth);
        if (!w || w === lastW) return;
        lastW = w;
        const h = Math.round(opts.height ? opts.height(w) : el.clientHeight);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const P = plate(svg, seed);
        draw(P, w, h);
        P.flush();
        opts.after?.(svg, w, h);
    };
    render();
    const ro = new ResizeObserver(() => render());
    ro.observe(el);
    return { svg, redraw: () => { lastW = 0; render(); } };
}

// ── Canvas helpers ───────────────────────────────────────────────────────

export function sizeCanvas(canvas, maxDpr = 2) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
}

// Colors come from the element's computed custom properties, so one figure serves both grounds.
export function colors(el) {
    const cs = getComputedStyle(el);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { bg: v('--bg'), fg: v('--fg'), fg2: v('--fg-2'), fg3: v('--fg-3'), rule: v('--rule'), signal: v('--signal') };
}

export function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Animate only while visible and while the tab is shown.
export function whenVisible(el, onChange) {
    let inView = false;
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; onChange(inView && !document.hidden); }, { rootMargin: '80px 0px' });
    io.observe(el);
    document.addEventListener('visibilitychange', () => onChange(inView && !document.hidden));
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
