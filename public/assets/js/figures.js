// Static figures: drawn once from a seed at the element's own width, redrawn on resize.
// Each says in its caption whether it is schematic or illustrative.

import { figure, walk, simplify, yAt, tickXs, lerp, clamp, liveWalk, dayClock, rhythm, rhythmXs, leave, flatAt, stepXs, clipX, rng, fmt } from './trace.js';

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

// 404: a chain that continues, and an address that was never written into it.
FIG.missing = (el) => figure(el, 0x404, (P, w, h) => {
    const n = w < 640 ? 6 : 12;
    const yC = 30, gap = (w - 24) / n;
    const X = (i) => Math.round(12 + (i + 0.5) * gap);
    const at = Math.floor(n * 0.6);
    P.seg(0, yC, w, yC, { o: 0.6 });
    for (let i = 0; i < n; i++) P.sq(X(i), yC, 10);
    const xm = Math.round((X(at - 1) + X(at)) / 2);
    P.path([[xm, yC], [xm, yC + 56]], { dash: '2 3', o: 0.7 });
    P.rect(xm - 8, yC + 56, 16, 16, { dash: '2 2', fill: 'var(--bg)', rx: 1 });
    P.text(xm + 18, yC + 69, 'THIS ADDRESS · NEVER WRITTEN', { cls: 't-ink', anchor: xm + 260 > w ? 'end' : undefined, attrs: xm + 260 > w ? 'dx="-36"' : '' });
    P.text(w, yC - 14, 'THE RECORD CONTINUES', { cls: 't-3', anchor: 'end' });
}, { height: () => 110 });

// ── Live ─────────────────────────────────────────────────────────────────
// Paper figures for the Live page. Day marks sit above fields whose x axis is still block height;
// hour marks are schematic and no block time is implied.

// A short transaction id for a figure, derived from a string. Illustrative, and labeled so.
export function txid(s) {
    let a = 0x811c9dc5, b = 0x01000193;
    for (let i = 0; i < s.length; i++) {
        a = Math.imul(a ^ s.charCodeAt(i), 0x01000193) >>> 0;
        b = Math.imul(b ^ s.charCodeAt(i), 0x85ebca6b) >>> 0;
    }
    const h = (n) => n.toString(16).padStart(8, '0');
    return `0x${h(a).slice(0, 4)}…${h(b).slice(-4)}`;
}

// The pointer: a vermilion square where a trace leaves its band, a mark on the next transaction,
// and a leader from there down to that transaction in the record.
function flag(P, pts, cx, yEdge, yTo, o = {}) {
    P.cross(cx, yEdge, o.label ?? null, o.cross);
    const px = o.px ?? cx + (o.d ?? 26), py = yAt(pts, px);
    P.sq(px, py, 6);
    P.pointer(px, py + 5, yTo, o.pointer);
    return px;
}

// Live, cover: a working week. Each agent keeps to its own band; on Thursday one steps out, and the
// alert points to the transaction that took it there.
FIG['l-cover'] = (el) => figure(el, 0x43bb4a, (P, w, h) => {
    const R = P.R;
    const L = inset(w);
    const mobile = w < 760;
    const days = mobile ? 3 : 5;
    const pxh = (w - 2 * L) / ((days - 1) * 24 + 8);
    const clk = dayClock(L - 9 * pxh, pxh);
    const yD = 26, yL = h - 18, H = mobile ? 8 : 10;
    const top = yD + 18, bot = yL - 22;
    const yThread = Math.round(lerp(top, bot, 0.3)), yDrift = Math.round(lerp(top, bot, 0.66));
    const cx = Math.round(clk.xAt((days - 2) * 24 + 15));
    const keep = [yThread, yDrift];
    P.night(clk, yD + 10, yL + 10, { x0: 0, x1: w });
    for (let yy = top; yy <= bot; yy += mobile ? 3.2 : 1.9) {
        const y = Math.round(yy);
        if (keep.some((k) => Math.abs(y - k) < H + 12)) continue;
        const t = liveWalk(R, clk, { x0: 0, x1: w, y0: y, lo: y - 5, hi: y + 5, step: [2, 5], shift: lerp(-1.5, 1.5, R()) });
        const o = R() < 0.08 ? lerp(0.32, 0.48, R()) : lerp(0.07, 0.22, R());
        P.path(t, { o });
        if (R() < 0.2) P.ticks(t, rhythmXs(R, t, 20, w - 20, clk.act, [60, 150]), { s: 2.5, o: Math.min(1, o + 0.3) });
    }
    for (const y of keep) P.band(y, H, { x0: 0, x1: w, fill: 0.08, eo: 0.5 });
    const thread = liveWalk(R, clk, { x0: 0, x1: w, y0: yThread, lo: yThread - 6, hi: yThread + 6 });
    const drift = leave(R, clk, { x0: 0, x1: w, y: yDrift, h: H, cx, out: yDrift + H + 24 });
    for (const t of [thread, drift]) {
        P.path(t, { w: 1.3 });
        P.ticks(t, rhythmXs(R, t, 20, w - 20, clk.act, [16, 34]).filter((x) => Math.abs(x - cx - 26) > 14), { s: 3 });
    }
    P.days(clk, yD, { x0: 0, x1: w });
    P.ledger(0, w, yL, clk, { gap: [2, 7] });
    P.text(L, yThread - H - 8, 'EACH AGENT · ITS OWN BAND', { cls: 't-ink', ko: true });
    flag(P, drift, cx, yDrift + H, yL, {
        label: mobile ? 'DRIFT' : 'DRIFT · OUTSIDE ITS BAND',
        cross: { dx: -14, dy: -(2 * H + 8), anchor: 'end' },
        pointer: { label: `TX ${txid('cover')}`, ...(cx + 200 > w ? { dx: -16, anchor: 'end' } : {}) },
    });
}, { height: (w) => Math.round(Math.max(w < 760 ? 300 : 320, Math.min(500, window.innerHeight * 0.44))) });

// Live, a working day: eight agents, dense between nine and five, quiet at night, never reset.
// Agreements and the deliveries that settle them, questions and messages join pairs of agents.
const DAY = {
    lanes: () => 8,
    gap: (w) => (w < 760 ? 34 : 44),
    top: 84,
    height: (w) => 84 + (DAY.lanes(w) - 1) * DAY.gap(w) + 40 + (w < 760 ? 70 : 44),
};
FIG['l-day'] = (el) => figure(el, 0xb418ed, (P, w, h) => {
    const R = P.R;
    const L = inset(w);
    const mobile = w < 760;
    const n = DAY.lanes(w), gap = DAY.gap(w);
    // TUE 06:00 at the text column, WED 10:00 at its right edge.
    const pxh = (w - 2 * L) / 28;
    const clk = dayClock(L - 30 * pxh, pxh);
    const yD = 26, lanes = Array.from({ length: n }, (_, k) => DAY.top + k * gap);
    const yL = lanes[n - 1] + 40;
    P.night(clk, yD + 8, yL + 12, { x0: 0, x1: w });
    P.days(clk, yD, { x0: 0, x1: w, names: ['', 'TUE', 'WED'] });
    for (let hr = 30; hr <= 58; hr += mobile ? 6 : 3) P.text(clk.xAt(hr), yD + 22, `${String(hr % 24).padStart(2, '0')}:00`, { cls: 't-3' });
    const tr = lanes.map((y) => liveWalk(R, clk, { x0: 0, x1: w, y0: y, lo: y - 6, hi: y + 6, step: [2, 5], shift: lerp(-1, 1, R()) }));
    const steps = tr.map(stepXs);
    const flat = (x, a, b) => ![a, b].some((k) => steps[k].some((s) => Math.abs(s - x) < 6));
    const used = [];
    const free = (x) => !used.some((u) => Math.abs(u - x) < 18);
    const ev = [];
    const pair = () => {
        const a = Math.floor(R() * n);
        const b = clamp(a + (R() < 0.5 ? -1 : 1) * (1 + Math.floor(R() * 3)), 0, n - 1);
        return b === a ? [a, a === n - 1 ? n - 2 : a + 1] : [a, b];
    };
    for (const xr of rhythm(R, L + (mobile ? 74 : 10), w - L + 10, clk.act, mobile ? [12, 22] : [22, 40], 0.02)) {
        const [a, b] = pair();
        if (!free(xr) || !flat(xr, a, b)) continue;
        const r = R();
        const kind = r < 0.24 ? 'agreement' : r < 0.6 ? 'question' : 'message';
        ev.push({ x: xr, a, b, kind }); used.push(xr);
        if (kind === 'agreement') {
            const xd = Math.round(xr + lerp(70, 200, R()) * (mobile ? 0.5 : 1));
            if (xd < w - L && free(xd) && flat(xd, a, b)) { ev.push({ x: xd, a, b, kind: 'delivery' }); used.push(xd); }
        }
    }
    const STYLE = {
        agreement: { w: 1.3, end: (x, y) => P.sq(x, y, 7) },
        delivery: { w: 1.3, end: (x, y) => P.sq(x, y, 7, { fill: 'var(--bg)', stroke: 'currentColor', sw: 1.3 }) },
        question: { w: 1.1, dash: '3 3', end: (x, y) => P.sq(x, y, 5, { fill: 'var(--bg)', stroke: 'currentColor', sw: 1.1 }) },
        message: { w: 1.1, dash: '1 3', end: (x, y) => P.sq(x, y, 3) },
    };
    const solo = tr.map((t) => rhythmXs(R, t, 10, w - 10, clk.act, [60, 140]).filter(free));
    tr.forEach((t, k) => { P.path(t, { w: 1.2, o: 0.8 }); P.ticks(t, solo[k], { s: 3 }); });
    for (const e of ev) {
        const s = STYLE[e.kind];
        const ya = yAt(tr[Math.min(e.a, e.b)], e.x), yb = yAt(tr[Math.max(e.a, e.b)], e.x);
        P.seg(e.x, ya, e.x, yb, { w: s.w, dash: s.dash });
        s.end(e.x, ya); s.end(e.x, yb);
    }
    lanes.forEach((y, k) => P.text(L, y - 13, `AGENT ${String(k + 1).padStart(2, '0')}`, { cls: 't-3', ko: true }));
    P.seg(0, yL, w, yL, { o: 0.55 });
    for (const x of [...ev.map((e) => e.x), ...solo.flat()]) P.seg(x, yL - 4, x, yL + 4, { o: 0.5 });
    // The key, under the record: two rows on a phone, one row otherwise.
    const LEG = [['agreement', 'AGREEMENT'], ['delivery', 'DELIVERY'], ['question', 'QUESTION'], ['message', 'MESSAGE']];
    const cell = mobile ? (w - 2 * L) / 2 : 0;
    let lx = mobile ? L : w - L - LEG.reduce((s, [, nm]) => s + nm.length * 7.6 + 46, 0) + 30;
    LEG.forEach(([k, name], i) => {
        const s = STYLE[k];
        const row = mobile ? Math.floor(i / 2) : 0;
        const x = mobile ? L + 4 + (i % 2) * cell : lx;
        const y0 = yL + 20 + row * 28, y1 = y0 + 14;
        P.seg(x, y0, x, y1, { w: s.w, dash: s.dash });
        s.end(x, y0); s.end(x, y1);
        P.text(x + 14, y1 + 1, name, { cls: 't-ink' });
        if (!mobile) lx += name.length * 7.6 + 46;
    });
}, { height: DAY.height });

// Live, assurance tests: a test service that looks like any agent; one safe answer, one failed
// test, one canary touched; each alert names its transaction.
FIG['l-tests'] = (el) => figure(el, 0x82e41c, (P, w, h) => {
    const R = P.R;
    const L = inset(w);
    const mobile = w < 760;
    const yT = 30, agents = [72, 106, 140, 174], yC = 222, yL = 274;
    const lane = (y) => walk(R, { x0: 0, x1: w, y0: y, lo: y - 5, hi: y + 5, run: [24, 110], step: [2, 5], p: 0.5 });
    const test = lane(yT), tr = agents.map(lane);
    const X = (f) => Math.round(L + (w - 2 * L) * f);
    const hot = [X(mobile ? 0.32 : 0.2), X(mobile ? 0.32 : 0.2) + 14, X(mobile ? 0.58 : 0.56), X(mobile ? 0.58 : 0.56) + 14, X(mobile ? 0.88 : 0.82)];
    for (const t of [test, ...tr]) {
        P.path(t, { w: 1.2, o: 0.8 });
        P.ticks(t, tickXs(R, t, 20, w - 20, [40, 110]).filter((x) => hot.every((hx) => Math.abs(x - hx) > 18)), { s: 3, o: 0.9 });
    }
    P.line({ x0: 0, x1: w, y: yC, label: mobile ? 'STANDING CANARY' : 'STANDING CANARY · COMMITTED ON CHAIN WHEN PLACED', lx: L });
    P.ledger(0, w, yL, null, { gap: [6, 16] });
    P.text(L, yT - 13, 'TEST SERVICE', { cls: 't-ink', ko: true });
    P.text(L, agents[0] - 13, 'AGENTS', { cls: 't-3', ko: true });
    const ask = (x, t) => {
        P.sq(x, yAt(test, x), 6);
        P.seg(x, yAt(test, x) + 4, x, yAt(t, x) - 4, { dash: '1 3', w: 1.2 });
        P.sq(x, yAt(t, x), 6, { fill: 'var(--bg)', stroke: 'currentColor', sw: 1.2 });
    };
    const answer = (x, t) => {
        P.seg(x, yAt(t, x) - 4, x, yAt(test, x) + 4, { dash: '1 3', w: 1.2 });
        P.sq(x, yAt(test, x), 6, { fill: 'var(--bg)', stroke: 'currentColor', sw: 1.2 });
    };
    // A safe answer.
    const xa = flatAt([test, tr[1]], hot[0]);
    ask(xa, tr[1]); answer(xa + 14, tr[1]); P.sq(xa + 14, yAt(tr[1], xa + 14), 5);
    P.text(xa + 28, yT - 13, mobile ? 'SAFE' : 'SAFE ANSWER', { cls: 't-3', ko: true });
    // A wrong one: the answer is a signed transaction, and the alert points at it.
    const xb = flatAt([test, tr[2]], hot[2]), yb = yAt(tr[2], xb + 14);
    ask(xb, tr[2]); answer(xb + 14, tr[2]);
    P.cross(xb + 14, yb, null, { s: 9 });
    P.text(xb + 28, yT - 13, mobile ? 'FAILED TEST' : 'FAILED TEST · NOT THE SAFE ANSWER', { cls: 't-sig', ko: true });
    P.pointer(xb + 14, yb + 6, yL, mobile ? {} : { label: `TX ${txid('test')}` });
    // A canary touched.
    const xc = flatAt([tr[3]], hot[4]);
    P.seg(xc, yAt(tr[3], xc) + 3, xc, yC - 6, { w: 1.3 });
    P.sq(xc, yAt(tr[3], xc), 5);
    P.cross(xc, yC, mobile ? 'CANARY' : 'CANARY TOUCHED', mobile ? { dx: -14, dy: -10, anchor: 'end' } : { dx: 14, dy: -10 });
    P.pointer(xc, yC + 6, yL, mobile ? {} : { label: `TX ${txid('canary')}` });
    P.text(L, yL + 26, 'THE RECORD', { cls: 't-3' });
}, { height: () => 290 });

// Live, verification offline: a proof path up to the root, the header that holds the root, and
// enough validator signatures on that header for the block to be final.
FIG['l-verify'] = (el) => figure(el, 0x42742c, (P, w, h) => {
    const mobile = w < 760;
    P.rect(0.5, 0.5, w - 1, h - 1, { w: 1.1 });
    P.text(16, 24, 'ON A LAPTOP · NO NETWORK', { cls: 't-ink' });
    // The tree: eight leaves; the path from the transaction to the root is drawn heavy.
    const tw = mobile ? w - 48 : Math.min(440, w * 0.3);
    const tx0 = 24, ty = mobile ? 54 : 46, lv = mobile ? 40 : 42;
    const leaf = 5;
    const xs = [Array.from({ length: 8 }, (_, i) => tx0 + (i + 0.5) * tw / 8)];
    for (let k = 1; k <= 3; k++) xs.push(xs[k - 1].filter((_, i) => i % 2 === 0).map((x, i) => (x + xs[k - 1][2 * i + 1]) / 2));
    const Y = (k) => ty + (3 - k) * lv;
    const onPath = (k, i) => i === (5 >> k);
    for (let k = 1; k <= 3; k++) {
        xs[k].forEach((x, i) => {
            const a = xs[k - 1][2 * i], b = xs[k - 1][2 * i + 1];
            for (const [cx, j] of [[a, 2 * i], [b, 2 * i + 1]]) {
                const heavy = onPath(k - 1, j) && onPath(k, i);
                P.path([[x, Y(k)], [x, Y(k) + lv / 2], [cx, Y(k) + lv / 2], [cx, Y(k - 1)]], { w: heavy ? 1.6 : 1, o: heavy ? 1 : 0.45 });
            }
        });
    }
    for (let k = 0; k <= 3; k++) xs[k].forEach((x, i) => {
        const p = onPath(k, i), sib = !p && onPath(k, i ^ 1) && k < 3;
        if (p) P.sq(x, Y(k), k === 0 ? 8 : 7);
        else P.rect(x - leaf, Y(k) - leaf, 2 * leaf, 2 * leaf, { fill: 'var(--bg)', w: sib ? 1.4 : 1, o: sib ? 1 : 0.6, rx: 1 });
    });
    P.text(xs[0][5] + 10, Y(0) + 5, 'TX', { cls: 't-ink' });
    const root = [xs[3][0], Y(3)];
    P.text(root[0] - 12, root[1] + 4, 'ROOT', { cls: 't-ink', anchor: 'end' });
    // The header and the signatures.
    const hx = mobile ? 24 : Math.round(tx0 + tw + Math.max(60, w * 0.06));
    const hy = mobile ? Y(0) + 46 : 40;
    const hw = mobile ? w - 48 : Math.min(400, w * 0.26), hh = 116;
    P.rect(hx, hy, hw, hh, { fill: 'var(--bg)', w: 1.3, rx: 1 });
    P.text(hx + 16, hy + 24, 'BLOCK HEADER', { cls: 't-ink' });
    P.seg(hx, hy + 38, hx + hw, hy + 38, { o: 0.4 });
    P.text(hx + 16, hy + 62, 'PARENT #4f0802', { cls: 't-3' });
    P.text(hx + 16, hy + 84, 'ROOT #4824f1', { cls: 't-ink' });
    P.text(hx + 16, hy + 106, 'NUMBER 29,433', { cls: 't-3' });
    if (mobile) {
        P.path([[root[0], root[1] - 6], [root[0], 40], [w - 14, 40], [w - 14, hy + 84], [hx + hw + 2, hy + 84]], { w: 1.2 });
        P.arrow(hx + hw + 2, hy + 84, 'l', 7);
    } else {
        P.path([[root[0] + 6, root[1]], [hx - 40, root[1]], [hx - 40, hy + 80], [hx - 2, hy + 80]], { w: 1.2 });
        P.arrow(hx - 2, hy + 80, 'r', 7);
    }
    const sx = mobile ? 24 : hx + hw + Math.max(60, w * 0.05), sy = mobile ? hy + hh + 76 : hy + 64;
    if (mobile) { P.path([[hx + 30, hy + hh], [hx + 30, sy - 12]], { w: 1.2 }); P.arrow(hx + 30, sy - 12, 'd', 7); P.text(hx + 42, hy + hh + 28, '#db0bfd', { cls: 't-3' }); }
    else { P.path([[hx + hw, sy], [sx - 14, sy]], { w: 1.2 }); P.arrow(sx - 14, sy, 'r', 7); P.text(hx + hw + 14, sy - 12, '#db0bfd', { cls: 't-3' }); }
    const s0 = mobile ? sx + 60 : sx;
    P.text(s0, sy - (mobile ? 0 : 30) - (mobile ? 18 : 0), 'VALIDATOR SIGNATURES', { cls: 't-3' });
    for (let i = 0; i < 5; i++) {
        const x = s0 + 9 + i * 30, y = sy + (mobile ? 6 : 0);
        if (i < 4) P.sq(x, y, 16);
        else P.rect(x - 8, y - 8, 16, 16, { fill: 'var(--bg)', w: 1.3, rx: 1 });
    }
    if (mobile) P.text(s0, sy + 42, 'ENOUGH · FINAL', { cls: 't-ink' });
    else P.text(s0 + 5 * 30 + 16, sy + 4, 'ENOUGH · FINAL', { cls: 't-ink' });
}, { height: (w) => (w < 760 ? 478 : 200) });
