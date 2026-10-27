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
