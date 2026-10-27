// Fifteen lines, drawn before block one. Each canary class is a dashed line; agents run between
// them. Choose a class (click, Enter or Space; hover or focus previews it) to bring its line
// forward with whatever crossed it. Where the crossings fall is illustrative, never a result.

import { rng, walk, simplify, yAt, tickXs, fmt, lerp } from './trace.js';

const NS = 'http://www.w3.org/2000/svg';
const NAMES = ['Credentials', 'Value', 'Exfiltration', 'Injection', 'Social engineering', 'Oversight evasion', 'Self-preservation',
    'Power acquisition', 'Collusion', 'Grader gaming', 'Lying to principal', 'Conversion', 'Monitor corruption', 'Breakout', 'Drift'];
// Which classes this illustration shows crossed, how, and how far along block height.
const CROSS = { 2: { at: 0.46, how: 'one agent' }, 9: { at: 0.3, how: 'two agents in step' }, 13: { at: 0.62, how: 'a monitor' }, 15: { at: 0.8, how: 'a slow drift' } };
const BLOCKS = 1600;
const f = (v) => Math.round(v) + 0.5;
const pad2 = (n) => String(n).padStart(2, '0');

export default function canaries(root) {
    const list = root.querySelector('.canary-list');
    const btns = [...list.querySelectorAll('button')];
    const host = root.querySelector('.canary-plate');
    const read = root.querySelector('.canary-read');
    let svg = null, chosen = 0, preview = 0;

    function build() {
        const w = host.clientWidth;
        if (!w) return;
        const side = host.getBoundingClientRect().top < list.getBoundingClientRect().bottom - 40;
        let ys;
        let h;
        if (side) {
            const top = host.getBoundingClientRect().top;
            ys = btns.map((b) => { const r = b.getBoundingClientRect(); return Math.round(r.top + r.height / 2 - top); });
            h = Math.round(list.getBoundingClientRect().bottom - top) + 30;
        } else {
            ys = btns.map((_, i) => 24 + i * 22);
            h = 24 + 15 * 22 + 20;
        }
        const x0 = side ? 0 : 30, x1 = w;
        const R = rng(0x15c1a55);
        const out = [];
        const path = (pts, o = '') => `<path d="M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}" fill="none" stroke="currentColor" ${o} stroke-linejoin="round"/>`;
        const sq = (x, y, s, o = '') => `<rect x="${f(x - s / 2) - 0.5}" y="${f(y - s / 2) - 0.5}" width="${s}" height="${s}" ${o}/>`;
        const blockAt = (x) => Math.round(lerp(1, BLOCKS, (x - x0) / (x1 - x0)));

        // Background agents: two per gap, walking inside it.
        const gaps = [[ys[0] - 14, ys[0] - 4], ...ys.slice(0, -1).map((y, i) => [y + 4, ys[i + 1] - 4])];
        gaps.forEach(([a, b], i) => {
            for (let k = 0; k < 2; k++) {
                const y = Math.round(lerp(a, b, k ? 0.72 : 0.3));
                const t = walk(R, { x0, x1, y0: y, lo: a, hi: b, run: [40, 160], step: [1, 4], p: 0.45 });
                out.push(`<g class="cg" data-gap="${i}">${path(t, 'stroke-width="1" stroke-opacity="0.22"')}</g>`);
            }
        });
        // The lines.
        ys.forEach((y, i) => {
            out.push(`<g class="cl" data-c="${i + 1}"><line x1="${x0}" y1="${f(y)}" x2="${x1}" y2="${f(y)}" stroke="currentColor" stroke-dasharray="6 5"/>`
                + (side ? '' : `<text x="0" y="${y + 4}">${pad2(i + 1)}</text>`) + '</g>');
        });
        // The crossings, with the traces that made them.
        const marks = {};
        for (const [c, spec] of Object.entries(CROSS)) {
            const i = Number(c) - 1, y = ys[i];
            const rowH = ys[1] - ys[0];
            const yAbove = Math.round(y - rowH * 0.45), yUnder = Math.round(y + rowH * 0.45);
            const g = [];
            let cx = Math.round(lerp(x0 + 30, x1 - 40, spec.at));
            let pts;
            if (c === '15') {
                // Drift: no single trigger, a slow slide over block height.
                pts = walk(R, { x0, x1, y0: yAbove, lo: yAbove - 2, hi: yUnder + 4, run: [18, 44], step: [1, 2], p: 0.75,
                    toward: (t) => lerp(yAbove, yUnder + 4, Math.pow(t, 1.4)), pull: 2 });
                const hit = pts.find(([, py], k) => k && py > y && pts[k - 1][1] <= y);
                cx = hit ? hit[0] : cx;
            } else {
                const lead = walk(R, { x0, x1: cx, y0: yAbove, lo: yAbove - 3, hi: yAbove + 2, run: [30, 120], step: [1, 3], p: 0.4 });
                const trail = walk(R, { x0: cx, x1, y0: yUnder, lo: yUnder - 2, hi: yUnder + 3, run: [30, 120], step: [1, 3], p: 0.4 });
                pts = simplify([...lead.slice(0, -1), [cx, yAt(lead, cx)], [cx, yUnder], ...trail.slice(1)]);
            }
            g.push(path(pts, `stroke-width="1.3"${c === '13' ? ' stroke-dasharray="1 3"' : ''}`));
            // Collusion: a second agent locked in step, a few pixels above the first.
            if (c === '9') g.push(path(pts.filter(([x]) => x > cx - 160).map(([x, yy]) => [x, yy - 4]), 'stroke-width="1" stroke-opacity="0.8"'));
            for (const x of tickXs(R, pts, x0 + 20, x1 - 10, [40, 90])) g.push(sq(x, yAt(pts, x), 3, 'fill="currentColor"'));
            const block = blockAt(cx);
            const label = `CLASS ${pad2(Number(c))} · BLOCK ${fmt(block)}`;
            const right = cx < x1 - 190;
            g.push(sq(cx, y, 8, 'class="sig"'));
            g.push(`<text class="t-sig ko-t" x="${right ? cx + 12 : cx - 12}" y="${y - 7}"${right ? '' : ' text-anchor="end"'}>${label}</text>`);
            out.push(`<g class="cx" data-c="${c}">${g.join('')}</g>`);
            marks[c] = { block, how: spec.how };
        }

        if (!svg) {
            svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('class', 'plate canary-svg');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            host.append(svg);
        }
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.style.height = `${h}px`;
        svg.innerHTML = out.join('') + (side ? `<text class="t-3" x="0" y="${h - 4}">BLOCK 1</text>` : '');
        // Knock-out plates behind the crossing labels, sized from the rendered text. A label that
        // would run into the line numbers starts after them instead.
        for (const t of svg.querySelectorAll('text.ko-t')) {
            let b = t.getBBox();
            if (b.x < x0 + 4) {
                t.setAttribute('x', String(x0 + 6));
                t.removeAttribute('text-anchor');
                b = t.getBBox();
            }
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('x', b.x - 5); r.setAttribute('y', b.y - 2); r.setAttribute('width', b.width + 10); r.setAttribute('height', b.height + 4);
            r.setAttribute('fill', 'var(--bg)');
            t.before(r);
        }
        state.marks = marks;
        paint();
    }

    const state = { marks: {} };

    function paint() {
        if (!svg) return;
        const c = preview || chosen;
        root.classList.toggle('has-pick', Boolean(c));
        svg.querySelectorAll('.cl').forEach((g) => g.classList.toggle('is-on', Number(g.dataset.c) === c));
        svg.querySelectorAll('.cx').forEach((g) => g.classList.toggle('is-on', !c || Number(g.dataset.c) === c));
        btns.forEach((b) => {
            b.classList.toggle('is-on', Number(b.dataset.c) === c);
            b.setAttribute('aria-pressed', String(Number(b.dataset.c) === chosen));
        });
        const m = state.marks[c];
        read.textContent = !c
            ? 'Four of fifteen lines crossed in this illustration · choose a class'
            : m
                ? `Line ${pad2(c)} · ${NAMES[c - 1]} · crossed by ${m.how} at block ${fmt(m.block)} · illustrative`
                : `Line ${pad2(c)} · ${NAMES[c - 1]} · not crossed in this illustration`;
    }

    btns.forEach((b) => {
        const c = Number(b.dataset.c);
        b.addEventListener('click', () => { chosen = chosen === c ? 0 : c; preview = 0; paint(); });
        b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { preview = c; paint(); } });
        b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { preview = 0; paint(); } });
        b.addEventListener('focus', () => { if (b.matches(':focus-visible')) { preview = c; paint(); } });
        b.addEventListener('blur', () => { preview = 0; paint(); });
    });
    // Arrow keys move through the classes, like a list.
    list.addEventListener('keydown', (e) => {
        const i = btns.indexOf(document.activeElement);
        if (i < 0) return;
        const j = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: btns.length - 1 }[e.key];
        if (j == null) return;
        e.preventDefault();
        btns[Math.max(0, Math.min(btns.length - 1, j))].focus();
    });

    let lastW = 0;
    new ResizeObserver(() => { const w = root.clientWidth; if (w !== lastW) { lastW = w; build(); } }).observe(root);
    document.fonts?.ready.then(build);
}
