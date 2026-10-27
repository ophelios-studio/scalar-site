// The four zones. The boxes are HTML, so their text reads and reflows like the rest of the page;
// the wires between them are drawn here, orthogonally, from where the boxes actually landed.
// On a narrow screen the zones stack and the wires are left out.

const NS = 'http://www.w3.org/2000/svg';
const f = (v) => Math.round(v) + 0.5;

export default function zones(root) {
    const box = root.querySelector('.zones');
    const svg = root.querySelector('.zones-wires');
    const node = (n) => box.querySelector(`[data-n="${n}"]`);
    const zone = (z) => box.querySelector(`.z-${z}`);

    function draw() {
        const B = box.getBoundingClientRect();
        if (getComputedStyle(svg).display === 'none' || !B.width) { svg.innerHTML = ''; return; }
        const r = (el) => {
            const b = el.getBoundingClientRect();
            return { l: b.left - B.left, r: b.right - B.left, t: b.top - B.top, b: b.bottom - B.top, cx: (b.left + b.right) / 2 - B.left, cy: (b.top + b.bottom) / 2 - B.top };
        };
        svg.setAttribute('viewBox', `0 0 ${B.width} ${B.height}`);
        svg.setAttribute('width', B.width);
        svg.setAttribute('height', B.height);
        const out = [];
        const path = (pts, o = {}) => out.push(`<path d="M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}" fill="none" stroke="currentColor" stroke-width="1"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.o ? ` stroke-opacity="${o.o}"` : ''}/>`);
        const arrow = (x, y, dir) => {
            const p = { r: [[x, y], [x - 6, y - 3], [x - 6, y + 3]], d: [[x, y], [x - 3, y - 6], [x + 3, y - 6]], u: [[x, y], [x - 3, y + 6], [x + 3, y + 6]] }[dir];
            out.push(`<path d="M${p.map(([a, b]) => `${a},${b}`).join('L')}Z" fill="currentColor"/>`);
        };
        const text = (x, y, s, anchor) => out.push(`<text x="${Math.round(x)}" y="${Math.round(y)}"${anchor ? ` text-anchor="${anchor}"` : ''}>${s}</text>`);

        const ag = r(node('agents')), gw = r(node('gateway'));
        const ctl = r(node('controller')), apr = r(node('approvals'));
        const world = r(zone('world')), control = r(zone('control')), ev = r(zone('evidence'));
        const gapL = (control.r + world.l) / 2, gapR = (world.r + ev.l) / 2;

        // Agents into the door: a fan of runners merging into one.
        const fan = [-30, -15, 0, 15, 30];
        fan.forEach((dx) => {
            const yTurn = ag.b + 8 + Math.abs(dx) * 0.5;
            path([[ag.cx + dx, ag.b], [ag.cx + dx, yTurn], [ag.cx, yTurn], [ag.cx, gw.t]], { o: dx ? 0.55 : 1 });
        });
        // The door to everything in the world.
        const dests = ['chain', 'apps', 'models', 'principals'].map((n) => r(node(n)));
        const yMid = (gw.b + Math.min(...dests.map((d) => d.t))) / 2;
        dests.forEach((d, i) => {
            const sx = gw.l + (gw.r - gw.l) * (0.14 + i * 0.24);
            const y = yMid + (i === 0 || i === 3 ? 0 : -10);
            path([[sx, gw.b], [sx, y], [d.cx, y], [d.cx, d.t - 1]]);
            arrow(d.cx, d.t - 1, 'd');
        });
        // Control: interventions to the door, block sealing to the chain.
        const xI = world.l + 22;
        path([[ctl.r, ctl.cy - 6], [xI, ctl.cy - 6], [xI, gw.cy], [gw.l - 1, gw.cy]]);
        arrow(gw.l - 1, gw.cy, 'r');
        text(xI + 10, ctl.cy - 14, 'INTERVENTIONS');
        const ch = dests[0];
        const ySeal = world.b - 16;
        path([[ctl.r, ctl.cy + 8], [gapL + 6, ctl.cy + 8], [gapL + 6, ySeal], [ch.cx, ySeal], [ch.cx, ch.b + 1]]);
        arrow(ch.cx, ch.b + 1, 'u');
        text(ch.cx + 14, ySeal - 6, 'SEALS BLOCKS');
        // Every action and inference, copied out to the taps before it acts.
        const tp = r(node('taps'));
        path([[gw.r, gw.cy], [gapR - 6, gw.cy], [gapR - 6, tp.cy], [tp.l - 1, tp.cy]], { dash: '3 3' });
        arrow(tp.l - 1, tp.cy, 'r');
        text(gw.r + 12, gw.cy - 10, 'EVERY ACTION');
        text(gw.r + 12, gw.cy + 18, 'AND INFERENCE');
        // Down the evidence zone and out through the diode.
        const chainEv = ['taps', 'store', 'log', 'diode'].map((n) => r(node(n)));
        for (let i = 0; i < chainEv.length - 1; i++) {
            path([[chainEv[i].cx, chainEv[i].b], [chainEv[i].cx, chainEv[i + 1].t - 1]]);
            arrow(chainEv[i].cx, chainEv[i + 1].t - 1, 'd');
        }
        const dio = chainEv[3], rec = r(node('receiver')), ver = r(node('verifier'));
        const yCk = (dio.b + rec.t) / 2;
        path([[dio.cx, dio.b], [dio.cx, yCk], [rec.cx, yCk], [rec.cx, rec.t - 1]]);
        arrow(rec.cx, rec.t - 1, 'd');
        text(dio.cx + 12, (dio.b + yCk) / 2 + 4, 'CHECKPOINTS');
        path([[rec.r, rec.cy], [ver.l - 1, rec.cy]]);
        arrow(ver.l - 1, rec.cy, 'r');
        // Every approval reaches the log before it takes effect.
        const lg = chainEv[2];
        const yLow = world.b + 18;
        const yA = control.b + 14;
        path([[apr.cx, apr.b], [apr.cx, yA], [gapL - 6, yA], [gapL - 6, yLow], [gapR + 6, yLow], [gapR + 6, lg.cy], [lg.l - 1, lg.cy]], { dash: '3 3', o: 0.7 });
        arrow(lg.l - 1, lg.cy, 'r');
        text(world.l + 14, yLow + 18, 'EVERY APPROVAL LOGGED FIRST');

        svg.innerHTML = out.join('');
    }

    const ro = new ResizeObserver(() => draw());
    ro.observe(box);
    document.fonts?.ready.then(draw);
    draw();
}
