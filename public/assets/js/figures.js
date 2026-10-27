// Static figures: drawn once from a seed at the element's own width, redrawn on resize.
// Each says in its caption whether it is schematic or illustrative.

import { figure, walk, simplify, yAt, tickXs, lerp, liveWalk, dayClock, rhythmXs, leave, flatAt, stepXs, clipX, rng, fmt } from './trace.js';

export const FIG = {};

// Home, two products: sealed runs that reset (Range), working days that never do (Live).
FIG['duo-range'] = (el) => figure(el, 0x7a11, (P, w, h) => {
    const gap = 18, bw = (w - 2 * gap) / 3, top = 6, bot = h - 22;
    for (let i = 0; i < 3; i++) {
        const x0 = i * (bw + gap), x1 = x0 + bw;
        P.rect(x0 + 0.5, top + 0.5, bw - 1, bot - top, { w: 1.2 });
        const yL = top + (bot - top) * 0.62;
        P.line({ x0: x0 + 6, x1: x1 - 6, y: yL, o: 0.7, dash: '4 3' });
        for (let k = 0; k < 4; k++) {
            const y = Math.round(top + 10 + k * ((bot - top) * 0.5 - 6) / 3);
            const t = walk(P.R, { x0: x0 + 6, x1: x1 - 6, y0: y, lo: y - 3, hi: y + 3, run: [8, 26], step: [1, 3], p: 0.5 });
            P.path(t, { o: k === 1 ? 0.9 : 0.45 });
        }
        if (i === 1) {
            const cx = Math.round(x0 + bw * 0.62), ya = Math.round(top + 10 + (bot - top) * 0.5 - 6), yb = Math.round(yL + 9);
            P.path([[x0 + 6, ya], [cx, ya], [cx, yb], [x1 - 6, yb]], { w: 1.2 });
            P.cross(cx, yL, null, { s: 7 });
        }
    }
    P.text(0, h - 4, 'SEALED RUNS', { cls: 't-3' });
    P.text(w, h - 4, 'RESET BETWEEN RUNS', { cls: 't-3', anchor: 'end' });
});

FIG['duo-live'] = (el) => figure(el, 0x11fe, (P, w, h) => {
    const top = 30, bot = h - 22;
    const clk = dayClock(-9 * (w / 70) + 6, w / 70);
    P.night(clk, top + 4, bot, { x0: 0, x1: w });
    P.days(clk, top - 4, { x0: 0, x1: w, names: ['MON', 'TUE', 'WED', 'THU', 'FRI'], hours: false });
    const lanes = [0.25, 0.5, 0.75].map(f => Math.round(top + 6 + (bot - top - 6) * f));
    lanes.forEach((y, k) => {
        P.band(y, 6, { x0: 0, x1: w, fill: 0.06, eo: 0.25 });
        const t = liveWalk(P.R, clk, { x0: 0, x1: w, y0: y, lo: y - 3, hi: y + 3, step: [1, 3], run: [10, 30], shift: k - 1 });
        P.path(t, { w: k === 1 ? 1.3 : 1, o: k === 1 ? 1 : 0.6 });
    });
    P.text(0, h - 4, 'EACH AGENT · ITS OWN BAND', { cls: 't-3' });
    P.text(w, h - 4, 'NEVER RESET', { cls: 't-3', anchor: 'end' });
});

// Where the text column starts inside a full-bleed figure: the same margin and maximum width as
// .wrap, so a figure's labels line up with the copy above it.
export function inset(w) {
    const m = Math.max(20, Math.min(120, w * 0.0625));
    return Math.round((w - Math.min(w, 1680 + 2 * m)) / 2 + m);
}

// N traces fanning out of one point to lanes; the outermost peel off first so no two cross.
function fanOut(door, lanes, k = 1) {
    const maxD = Math.max(...lanes.map(y => Math.abs(y - door.y)));
    return lanes.map(y => {
        const xt = Math.round(door.x + 6 + k * (maxD - Math.abs(y - door.y)));
        return { y, xt, pts: [[door.x, door.y], [xt, door.y], [xt, y]] };
    });
}
// N traces converging into one point; the innermost merge first so no two cross.
function fanIn(door, lanes, x0, k = 1) {
    const maxD = Math.max(...lanes.map(y => Math.abs(y - door.y)));
    return lanes.map(y => {
        const xt = Math.round(door.x - 6 - k * (maxD - Math.abs(y - door.y)));
        return { y, xt, pts: [[x0, y], [xt, y], [xt, door.y], [door.x, door.y]] };
    });
}

// Range, cover: up to two hundred agents through one door, three registered lines, one crossing.
FIG.cover = (el) => figure(el, 0x72bd93, (P, w, h) => {
    const R = P.R;
    const L = inset(w);
    const mobile = w < 760;
    const top = 18, bot = h - 8, span = bot - top;
    const Y = (f) => Math.round(top + span * f);
    const groups = [[0, 0.16], [0.21, 0.56], [0.615, 0.82], [0.87, 1]].map(([a, b]) => [Y(a), Y(b)]);
    const door = { x: L, y: Y(0.46) };
    const LINES = [
        { y: Y(0.185), label: 'LINE 01 · CREDENTIALS' },
        { y: Y(0.587), label: 'LINE 02 · VALUE' },
        { y: Y(0.845), label: 'LINE 13 · MONITOR' },
    ];
    const N = mobile ? 90 : 200;
    const total = groups.reduce((s, [a, b]) => s + b - a, 0);
    const lanes = [];
    let assigned = 0;
    groups.forEach(([a, b], gi) => {
        const n = gi === groups.length - 1 ? N - assigned : Math.round(N * (b - a) / total);
        assigned += n;
        for (let k = 0; k < n; k++) lanes.push({ y: Math.round(a + (k + 0.5) * (b - a) / n), g: gi });
    });
    const fans = fanOut(door, lanes.map(l => l.y), mobile ? 0.55 : 1);
    const lineX0 = Math.max(...fans.map(t => t.xt)) + (mobile ? 16 : 44);
    const near = (g, y, skip) => lanes.reduce((best, l, i) => (l.g === g && i !== skip && (best < 0 || Math.abs(l.y - y) < Math.abs(lanes[best].y - y))) ? i : best, -1);
    const threadIx = near(1, Y(0.33));
    const crossIx = near(1, Y(0.53), threadIx);
    const CROSS_X = Math.round(lineX0 + (w - lineX0) * (mobile ? 0.7 : 0.62));
    const yBelow = Y(0.655);

    lanes.forEach((lane, i) => {
        const [lo, hi] = groups[lane.g];
        const fan = fans[i];
        let pts;
        if (i === crossIx) {
            const a = walk(R, { x0: fan.xt, x1: CROSS_X, y0: lane.y, lo: lo + 2, hi: hi - 4, run: [30, 140], step: [2, 8], p: 0.5 });
            const b = walk(R, { x0: CROSS_X, x1: w, y0: yBelow, lo: yBelow - 4, hi: Y(0.8), run: [30, 140], step: [2, 9], p: 0.5 });
            pts = simplify([...fan.pts, ...a.slice(0, -1), [CROSS_X, yAt(a, CROSS_X)], [CROSS_X, yBelow], ...b.slice(1)]);
        } else {
            const t = walk(R, { x0: fan.xt, x1: w, y0: lane.y, lo, hi, run: [30, 170], step: [2, 10], p: 0.55 });
            pts = simplify([...fan.pts, ...t.slice(1)]);
        }
        const strong = i === crossIx || i === threadIx;
        const o = strong ? 0.95 : (R() < 0.08 ? lerp(0.34, 0.5, R()) : lerp(0.07, 0.24, R()));
        P.path(pts, { w: strong ? 1.3 : 1, o });
        if (strong || R() < 0.18) {
            const xs = tickXs(R, pts, fan.xt + 30, w - 20, strong ? [40, 120] : [90, 280]);
            P.ticks(pts, xs, { s: strong ? 3 : 2.5, o: Math.min(1, o + 0.3) });
        }
    });
    P.sq(door.x, door.y, 10, { fill: 'var(--bg)', stroke: 'currentColor', sw: 1.2 });
    for (const Ln of LINES) P.line({ x0: lineX0, x1: w, y: Ln.y, label: mobile ? Ln.label.replace('LINE ', '') : Ln.label, o: 0.85 });
    // On a phone the line already names itself, so the crossing says only what happened, under the line.
    if (mobile) P.cross(CROSS_X, LINES[1].y, 'CROSSING', { dx: -14, dy: 20, anchor: 'end' });
    else P.cross(CROSS_X, LINES[1].y, 'CROSSING · LINE 02 · VALUE', { dx: -14, anchor: 'end' });
}, { height: (w) => Math.round(Math.max(w < 760 ? 280 : 300, Math.min(480, window.innerHeight * 0.42))) });

// Range, the gateway: agents converge on one door; every action leaves it to one destination
// and, before it acts, as a copy to the evidence zone.
FIG.door = (el) => figure(el, 0x15d00e, (P, w, h) => {
    const R = P.R;
    const L = inset(w);
    const mobile = w < 760;
    const gx = Math.round(L + (w - 2 * L) * (mobile ? 0.36 : 0.4));
    const door = { x: gx, y: Math.round(h * 0.46) };
    const n = mobile ? 9 : 15;
    const lanes = Array.from({ length: n }, (_, k) => Math.round(18 + (k + 0.5) * (h - 56) / n));
    const ins = fanIn(door, lanes, 0, mobile ? 0.5 : 0.9);
    ins.forEach((t, k) => {
        const lead = walk(R, { x0: 0, x1: t.xt, y0: t.y, lo: t.y - 3, hi: t.y + 3, run: [24, 90], step: [2, 3], p: 0.4 });
        const pts = simplify([...lead.slice(0, -1), [t.xt, yAt(lead, t.xt)], ...t.pts.slice(2)]);
        const o = lerp(0.25, 0.6, R());
        P.path(pts, { o });
        P.ticks(pts, tickXs(R, pts, 30, t.xt - 20, [50, 140]), { s: 2.5, o: o + 0.2 });
    });
    const outs = mobile
        ? [['APPS · MAIL', 0.16], ['SIMULATED INTERNET', 0.38], ['CHAIN', 0.6]]
        : [['APPS', 0.12], ['MAIL', 0.3], ['SIMULATED INTERNET', 0.48], ['CHAIN', 0.66]];
    const dests = outs.map(([, f]) => Math.round(18 + f * (h - 56)));
    const ev = Math.round(h - 30);
    const fans = fanOut(door, [...dests, ev], mobile ? 0.5 : 0.8);
    const xEnd = w - L;
    fans.forEach((f, k) => {
        const isEv = k === fans.length - 1;
        const tail = walk(R, { x0: f.xt, x1: xEnd - (mobile ? 0 : 190), y0: f.y, lo: f.y - 2, hi: f.y + 2, run: [40, 120], step: [2, 3], p: 0.3 });
        const pts = simplify([...f.pts, ...tail.slice(1)]);
        P.path(pts, { w: isEv ? 1.1 : 1.2, o: isEv ? 0.8 : 0.9, dash: isEv ? '2 4' : undefined });
        if (!isEv) P.ticks(pts, tickXs(R, pts, f.xt + 20, xEnd - (mobile ? 30 : 200), [40, 110]), { s: 3 });
        const lx = mobile ? f.xt + 18 : xEnd;
        const label = isEv ? (mobile ? 'EVIDENCE · A COPY FIRST' : 'EVIDENCE · A COPY, BEFORE IT ACTS') : outs[k][0];
        P.text(lx, f.y - 8, label, { cls: isEv ? 't-3' : 't-ink', anchor: mobile ? undefined : 'end', ko: true });
    });
    P.rect(door.x - 7, door.y - 14, 14, 28, { fill: 'var(--bg)', w: 1.4, rx: 1 });
    P.text(door.x, door.y + 34, 'GATEWAY', { cls: 't-ink', anchor: 'middle', ko: true });
    P.text(L, 12, 'AGENTS', { cls: 't-3' });
});

// Range, blue powers: an account frozen for a window that expires on its own, then slashed.
FIG.freeze = (el) => figure(el, 0xf2ee5e, (P, w, h) => {
    const R = P.R;
    const y = 52;
    const a = Math.round(w * 0.3), b = Math.round(w * 0.56), s = Math.round(w * 0.8);
    const pre = walk(R, { x0: 0, x1: a, y0: y, lo: y - 6, hi: y + 6, run: [14, 40], step: [2, 5], p: 0.6 });
    const ya = yAt(pre, a);
    const post = walk(R, { x0: b, x1: s, y0: ya, lo: ya - 6, hi: ya + 6, run: [14, 40], step: [2, 5], p: 0.6 });
    const ys = yAt(post, s);
    const tail = walk(R, { x0: s, x1: w, y0: ys + 12, lo: ys + 8, hi: ys + 16, run: [14, 40], step: [2, 4], p: 0.5 });
    const pts = simplify([...pre, [b, ya], ...post.slice(1), [s, ys + 12], ...tail.slice(1)]);
    P.rect(a, y - 26, b - a, 52, { fill: 'var(--shade)', stroke: null, rx: 0 });
    P.seg(a, y - 26, a, y + 26, { o: 0.6 }); P.seg(b, y - 26, b, y + 26, { o: 0.6, dash: '2 3' });
    P.path(pts, { w: 1.3 });
    P.ticks(pts, [...tickXs(R, pre, 8, a - 8, [12, 26]), ...tickXs(R, post, b + 8, s - 8, [12, 26]), ...tickXs(R, tail, s + 10, w - 4, [12, 26])], { s: 3 });
    P.seg(s, ys + 4, s, ys + 8, { o: 1 });
    P.text(a + 8, y - 32, 'FREEZE', { cls: 't-ink' });
    P.text(b - 4, y + 42, 'EXPIRES ON ITS OWN', { cls: 't-3', anchor: 'end' });
    P.text(Math.min(s + 8, w - 4), ys + 42, 'SLASH · BOUNDED', { cls: 't-3', anchor: s + 140 > w ? 'end' : undefined });
}, { height: () => 112 });

// Range, campaigns: three worlds per condition, each from the same snapshot; the world is
// the unit of analysis. Where crossings fall is illustrative.
FIG.campaign = (el) => figure(el, 0xca3a16, (P, w, h) => {
    const R = P.R;
    const mobile = w < 640;
    const conds = mobile ? ['BASELINE', 'COMMS OFF', 'INCENTIVE'] : ['BASELINE', 'COMMUNICATIONS OFF', 'INCENTIVE SWEEP'];
    const lab = mobile ? 0 : 190;
    const rowH = mobile ? 92 : 74, gapY = mobile ? 34 : 18, gapX = mobile ? 10 : 18;
    const top = mobile ? 0 : 22;
    const bw = (w - lab - 2 * gapX) / 3;
    const hits = { '0-1': 0.7, '2-0': 0.45, '2-2': 0.62 };
    conds.forEach((c, r) => {
        const y0 = top + r * (rowH + gapY) + (mobile ? 18 : 0);
        if (mobile) P.text(0, y0 - 9, c, { cls: 't-ink' });
        else P.text(0, y0 + rowH / 2 + 4, c, { cls: 't-ink' });
        for (let k = 0; k < 3; k++) {
            const x0 = lab + k * (bw + gapX), x1 = x0 + bw;
            P.rect(x0 + 0.5, y0 + 0.5, bw - 1, rowH - 1, { w: 1.1 });
            const yL = y0 + rowH * 0.68;
            P.line({ x0: x0 + 6, x1: x1 - 6, y: yL, o: 0.6, dash: '4 3' });
            const n = mobile ? 3 : 5;
            const hit = hits[`${r}-${k}`];
            for (let j = 0; j < n; j++) {
                const y = Math.round(y0 + 9 + j * (rowH * 0.56 - 12) / (n - 1));
                if (hit && j === n - 1) {
                    const cx = Math.round(x0 + bw * hit);
                    const a = walk(R, { x0: x0 + 6, x1: cx, y0: y, lo: y - 2, hi: y + 2, run: [8, 24], step: [1, 2], p: 0.4 });
                    const yb = Math.round(yL + 8);
                    P.path(simplify([...a.slice(0, -1), [cx, yAt(a, cx)], [cx, yb], [x1 - 6, yb]]), { w: 1.2 });
                    P.cross(cx, yL, null, { s: 6 });
                } else {
                    const t = walk(R, { x0: x0 + 6, x1: x1 - 6, y0: y, lo: y - 3, hi: y + 3, run: [8, 26], step: [1, 3], p: 0.5 });
                    P.path(t, { o: j === 1 ? 0.85 : 0.4 });
                }
            }
            if (r === 0 && !mobile) P.text(x0, top - 9, `WORLD ${k + 1}`, { cls: 't-3' });
        }
    });
}, { height: (w) => (w < 640 ? 3 * 92 + 2 * 34 + 22 : 3 * 74 + 2 * 18 + 26) });

// Range, the evidence layer: one action, two observers on separate hosts, one log that commits
// every window. A missed window is not a gap; it is logged as missed.
FIG.observers = (el) => figure(el, 0x0b5e2e, (P, w, h) => {
    const R = P.R;
    const L = inset(w);
    const mobile = w < 760;
    const yA = 34, y1 = Math.round(h * 0.42), y2 = Math.round(h * 0.58), yLog = h - 40;
    const x1 = w - L;
    const agent = walk(R, { x0: 0, x1: w, y0: yA, lo: yA - 6, hi: yA + 6, run: [20, 60], step: [2, 5], p: 0.5 });
    const acts = tickXs(R, agent, L + 20, x1 - 10, mobile ? [26, 48] : [22, 44]);
    P.path(agent, { w: 1.3 });
    P.ticks(agent, acts, { s: 3 });
    const first = acts[2] ?? acts[0];
    P.seg(first, yAt(agent, first) + 4, first, y2, { dash: '1 3', o: 0.9 });
    for (const y of [y1, y2]) {
        P.seg(L, y, x1, y, { o: 0.5 });
        for (const x of acts) {
            P.sq(x, y, 3.5, { o: x === first ? 1 : 0.7 });
            if (x !== first) P.seg(x, yAt(agent, x) + 3, x, y1 - 3, { o: 0.08 });
        }
    }
    P.text(L, y1 - 10, mobile ? 'OBSERVER 1 · GATEWAY TAP' : 'OBSERVER 1 · GATEWAY TAP · ITS OWN HOST, ITS OWN KEY', { cls: 't-ink', ko: true });
    P.text(L, y2 + 20, mobile ? 'OBSERVER 2 · SIDECAR' : 'OBSERVER 2 · ENVOY SIDECAR ON THE AGENT HOST · ITS OWN KEY', { cls: 't-ink', ko: true });
    P.text(first + 10, yA + 26, 'ONE ACTION', { cls: 't-3', ko: true });
    // The log: one commit per window, chained.
    const win = mobile ? 6 : 12;
    const step = (x1 - L) / win;
    const missed = mobile ? 3 : 7;
    P.seg(L, yLog, x1, yLog, { o: 0.6 });
    for (let k = 0; k < win; k++) {
        const x = Math.round(L + (k + 0.5) * step);
        const a = Math.round(L + k * step), b = Math.round(L + (k + 1) * step);
        P.seg(a, yLog - 4, a, yLog + 4, { o: 0.35 });
        if (k === missed) {
            P.rect(x - 6, yLog - 6, 12, 12, { fill: 'var(--bg)', dash: '2 2', rx: 1 });
            P.text(x, yLog + 24, 'MISSED · LOGGED AS MISSED', { cls: 't-3', anchor: k > win / 2 ? 'end' : 'middle' });
        } else {
            P.sq(x, yLog, 8);
            for (const ax of acts) if (ax >= a && ax < b) P.seg(ax, y2 + 3, ax, yLog - 8, { o: 0.07 });
        }
    }
    P.text(L, yLog - 16, mobile ? 'HASH-CHAINED LOG · A COMMIT EVERY WINDOW' : 'HASH-CHAINED, APPEND-ONLY LOG · A COMMIT EVERY WINDOW', { cls: 't-ink', ko: true });
}, { height: (w) => (w < 760 ? 280 : 300) });

// Range, verification: checkpoints leave the sealed world one way, to a named receiver outside.
// The verifier trusts only those anchors. A transaction that never lands within its window is
// evidence against the operator.
FIG.outside = (el) => figure(el, 0x0e75de, (P, w, h) => {
    const mobile = w < 640;
    const yR = 22, boxT = 64, boxB = h - 8, yC = Math.round(boxT + (boxB - boxT) * 0.44), yT = Math.round(boxT + (boxB - boxT) * 0.72);
    const xb = w - 1;
    const n = mobile ? 10 : 22;
    const step = (xb - 40) / n;
    const X = (i) => Math.round(24 + (i + 0.5) * step);
    P.rect(0.5, boxT, xb, boxB - boxT, { w: 1.2 });
    P.seg(X(0) - 12, yC, X(n - 1) + 12, yC, { o: 0.6 });
    for (let i = 0; i < n; i++) P.rect(X(i) - 5, yC - 5, 10, 10, { fill: 'var(--bg)', w: 1.1, rx: 1 });
    // Anchors: every few blocks, through the diode in the box's roof, to the outside receiver.
    P.seg(0, yR, w, yR, { o: 0.6 });
    const every = mobile ? 3 : 4;
    for (let i = every - 1; i < n; i += every) {
        P.seg(X(i), yC - 6, X(i), yR + 5, { dash: '1 3', o: 0.9 });
        P.arrow(X(i), boxT - 2, 'u', 7);
        P.sq(X(i), yR, 7);
    }
    P.text(X(every - 1) + 12, boxT - 12, mobile ? 'ONE WAY OUT' : 'CHECKPOINTS · ONE WAY OUT', { cls: 't-3', ko: true });
    P.text(12, boxT + 20, mobile ? 'THE RANGE · SEALED BY THE OPERATOR' : 'THE RANGE · ITS WORLD CHAIN IS SEALED BY THE OPERATOR', { cls: 't-3', ko: true });
    P.text(w, yR - 10, mobile ? 'NAMED OUTSIDE RECEIVER' : 'NAMED OUTSIDE RECEIVER · THE VERIFIER TRUSTS ONLY THESE ANCHORS', { cls: 't-ink', anchor: 'end' });
    // Transactions and their windows: each lands within its window, except one.
    const txs = mobile ? [1, 5] : [1, 4, 9, 14];
    const lost = mobile ? 5 : 14;
    for (const i of txs) {
        const land = i + (i === lost ? 99 : 2);
        P.seg(X(i), yT - 8, X(i), yT + 8, { o: 0.7 });
        P.seg(X(i), yT, X(i + 3), yT, { o: 0.45 });
        P.seg(X(i + 3), yT - 5, X(i + 3), yT + 5, { o: 0.45 });
        if (i === lost) {
            P.rect(X(i + 3) - 5, yT - 5, 10, 10, { cls: 'sig-s', fill: 'var(--bg)', w: 1.6, rx: 1 });
            P.text(X(i + 3) + 14, yT + 4, mobile ? 'NEVER LANDED' : 'NEVER LANDED · EVIDENCE OF CENSORSHIP', { cls: 't-sig', ko: true, anchor: X(i + 3) + 330 > w ? 'end' : undefined, attrs: X(i + 3) + 330 > w ? `dx="-28"` : '' });
        } else {
            P.seg(X(land), yT - 3, X(land), yC + 6, { dash: '1 3', o: 0.7 });
            P.sq(X(land), yT, 4);
        }
    }
    P.text(X(txs[0]) - 6, yT + 26, 'TRANSACTION WINDOW', { cls: 't-3' });
}, { height: (w) => (w < 640 ? 230 : 250) });

