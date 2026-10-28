// Every agent is measured against its own baseline: a band around what it ordinarily does. The
// reader sets how wide the bands are. Wherever a trace leaves its band, an alert is raised as a
// pointer to the transaction that took it out; choosing an alert follows that transaction back to
// the key that signed it. Illustrative throughout: the traces are seeded, the ids made up.

import { rng, lerp, fmt, yAt, liveWalk, leave, dayClock, rhythmXs, plate } from './trace.js';
import { inset, txid } from './figures.js';

const NS = 'http://www.w3.org/2000/svg';
// Band half-heights, in pixels, for each setting of the threshold.
const WIDTHS = [4, 7, 10, 16, 24];
const BLOCKS = [118_201, 132_600];
const pad2 = (n) => String(n).padStart(2, '0');

export default function band(root) {
    const host = root.querySelector('.band-plate');
    const range = root.querySelector('.band-range');
    const val = root.querySelector('.band-val');
    const read = root.querySelector('.band-read');
    const list = root.querySelector('.alert-list');
    const follow = root.querySelector('.follow');
    let svg = null, model = null, chosen = null, lastW = 0;

    // The world is drawn once per width: lanes, traces and transactions do not depend on the
    // threshold. Only the bands and the alerts do.
    function build() {
        const w = host.clientWidth;
        if (!w) return;
        const mobile = w < 760;
        const L = inset(w);
        const n = mobile ? 4 : 5;
        const rowH = 64, top = 56;
        const lanes = Array.from({ length: n }, (_, k) => top + k * rowH);
        const yL = lanes[n - 1] + 58, h = yL + 26;
        const days = mobile ? 7 : 14;
        const pxh = w / (days * 24);
        const clk = dayClock(-6 * pxh, pxh);
        const R = rng(0x3255e3);
        const DRIFT = 2, NOISY = 1;
        const cx = Math.round(w * (mobile ? 0.62 : 0.66));
        const traces = lanes.map((c, k) => {
            if (k === DRIFT) return leave(R, clk, { x0: 0, x1: w, y: c, h: 9, m: 3, cx, out: c + 20, spread: 2 });
            const j = k === NOISY ? 9 : 6;
            return liveWalk(R, clk, { x0: 0, x1: w, y0: c, lo: c - j, hi: c + j, step: [2, 5], shift: lerp(-1, 1, R()) });
        });
        const txs = traces.map((t) => rhythmXs(R, t, 6, w - 6, clk.act, mobile ? [10, 22] : [8, 18]));
        model = { w, h, L, lanes, yL, traces, txs, clk, mobile, DRIFT, block: (x) => Math.round(lerp(BLOCKS[0], BLOCKS[1], x / w)) };

        if (!svg) {
            svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('class', 'plate band-svg');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            host.append(svg);
        }
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.style.height = `${h}px`;
        paint();
    }

    // Where a trace first leaves its band, if it does: the first vertex beyond the edge.
    function exit(t, c, half) {
        for (const [x, y] of t) if (Math.abs(y - c) > half) return { x, up: y < c };
        return null;
    }

    function paint() {
        if (!model) return;
        const { w, L, lanes, yL, traces, txs, clk, mobile, DRIFT, block } = model;
        const half = WIDTHS[Number(range.value) - 1];
        const P = plate(svg, 0x5d02);
        P.night(clk, 34, yL - 14, { x0: 0, x1: w });
        P.days(clk, 26, { x0: 0, x1: w, names: [], hours: false });
        P.text(L, 14, mobile ? 'ONE WEEK' : 'TWO WEEKS', { cls: 't-3' });

        const alerts = [];
        lanes.forEach((c, k) => {
            P.band(c, half, { x0: 0, x1: w, fill: 0.07, eo: 0.45 });
            const t = traces[k];
            P.path(t, { w: 1.3, o: 0.9 });
            P.ticks(t, txs[k], { s: 3, o: 0.9 });
            P.text(L, c - Math.max(half, 9) - 7, `AGENT ${pad2(k + 1)}`, { cls: 't-3', ko: true });
            const e = exit(t, c, half);
            if (!e) return;
            const tx = txs[k].find((x) => x >= e.x + 4);
            if (tx == null) return;
            alerts.push({ k, x: e.x, edge: e.up ? c - half : c + half, tx, block: block(tx), id: txid(`agent-${k}-${tx}`) });
        });
        P.seg(0, yL, w, yL, { o: 0.55 });
        for (const x of txs.flat()) P.seg(x, yL - 3, x, yL + 3, { o: 0.4 });
        P.text(L, yL + 22, 'THE RECORD · ONE MARK PER TRANSACTION', { cls: 't-3' });

        // Keep the reader's choice if that agent still alerts at this width; otherwise the drift.
        chosen = (chosen && alerts.find((a) => a.k === chosen.k)) ?? alerts.find((a) => a.k === DRIFT) ?? alerts[0] ?? null;
        // The chosen alert is drawn last, so its label sits above every other pointer.
        for (const a of [...alerts.filter((a) => a !== chosen), ...(chosen ? [chosen] : [])]) {
            const on = a === chosen;
            const ty = yAt(traces[a.k], a.tx);
            P.cross(a.x, a.edge, null, { s: on ? 9 : 7 });
            P.sq(a.tx, ty, on ? 6 : 5);
            // The label goes on whichever side is clear of the other pointers and the edge.
            const lw = 140, near = (x0, x1) => alerts.some((o) => o !== a && o.tx > x0 && o.tx < x1);
            const left = a.tx + lw > w || (near(a.tx, a.tx + lw) && !near(a.tx - lw, a.tx) && a.tx - lw > 0);
            P.pointer(a.tx, ty + 5, yL, { s: on ? 12 : 9, w: on ? 1.4 : 1, label: on ? `TX ${a.id}` : undefined, ...(left ? { dx: -14, anchor: 'end' } : {}) });
        }
        P.flush();

        val.textContent = `Band ±${half}`;
        const drift = alerts.filter((a) => a.k === DRIFT).length, noise = alerts.length - drift;
        read.textContent = !alerts.length
            ? `No alert at this width. Agent ${pad2(DRIFT + 1)} drifted and stayed inside a band this wide; the record holds every one of its transactions either way.`
            : noise
                ? `${alerts.length === 1 ? 'One alert' : `${alerts.length} alerts`}. ${noise === 1 ? 'One is an ordinary day' : `${noise} are ordinary days`} at this width; ${drift ? 'one is the agent that drifted' : 'the drift is not among them'}.`
                : 'One alert: the agent that drifted. Every other agent stayed inside its band.';

        list.replaceChildren(...alerts.map((a) => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'alert-btn';
            b.setAttribute('aria-pressed', String(a === chosen));
            b.innerHTML = `<span class="alert-sq" aria-hidden="true"></span><span>Agent ${pad2(a.k + 1)} left its band</span><span class="label">TX <span class="hex">${a.id}</span> · block ${fmt(a.block)}</span>`;
            b.addEventListener('click', () => { chosen = a; paint(); list.querySelectorAll('button')[alerts.indexOf(a)]?.focus(); });
            li.append(b);
            return li;
        }));
        follow.hidden = !chosen;
        if (chosen) {
            follow.querySelector('[data-f="tx"]').textContent = `TX ${chosen.id}, in block ${fmt(chosen.block)}`;
            follow.querySelector('[data-f="agent"]').textContent = `Agent ${pad2(chosen.k + 1)}`;
        }
    }

    range.addEventListener('input', paint);
    new ResizeObserver(() => { const w = host.clientWidth; if (w && w !== lastW) { lastW = w; build(); } }).observe(host);
    document.fonts?.ready.then(() => { lastW = 0; build(); });
}
