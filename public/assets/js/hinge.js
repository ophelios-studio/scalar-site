// The release. One world, two viewport widths wide: on its left half an agent is evaluated on
// fixed tasks, every few blocks; at its middle stands the release line; on its right half the
// same agent works unwatched and drifts from its baseline. Scrolling pans the camera across it,
// so the release line crosses the screen from right to left and the ground turns from ink to
// paper exactly where the line is. The header and the rail turn with it.

import { rng, lerp, walk, simplify, yAt, tickXs, sizeCanvas, colours, rgba, reducedMotion } from './trace.js';
import { setSplit } from './chrome.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function hinge(root) {
    const track = root.querySelector('.hinge-track');
    const faces = ['ink', 'paper'].map((g) => {
        const el = root.querySelector(`[data-face="${g}"]`);
        return { g, el, canvas: el.querySelector('canvas'), col: null, ctx: null };
    });
    const still = reducedMotion();
    root.classList.add(still ? 'is-still' : 'is-live');

    let W = 0, H = 0, world = null;

    function build() {
        const R = rng(0x7e1ea5e);
        const mobile = W < 760;
        const top = H * (mobile ? 0.70 : 0.53), bot = H * (mobile ? 0.9 : 0.86);
        const band = bot - top;
        const yF = Math.round(top + band * 0.34);
        const RX = W;                                   // the release, in world pixels
        const X1 = 2 * W;
        const m = Math.max(20, Math.min(120, W * 0.0625));

        // Companions: the agent's peers, tight before release and looser after it.
        const peers = [];
        const n = mobile ? 7 : 11;
        for (let k = 0; k < n; k++) {
            const y = Math.round(top + band * (0.08 + 0.84 * (k + 0.5) / n));
            if (Math.abs(y - yF) < band * 0.06) continue;
            const pre = walk(R, { x0: -20, x1: RX, y0: y, lo: y - 4, hi: y + 4, run: [14, 60], step: [2, 4], p: 0.5 });
            const post = walk(R, { x0: RX, x1: X1 + 20, y0: yAt(pre, RX), lo: y - band * 0.07, hi: y + band * 0.07, run: [14, 56], step: [3, 8], p: 0.62 });
            peers.push({ pts: simplify([...pre, ...post.slice(1)]), o: lerp(0.16, 0.34, R()) });
        }

        // The followed agent.
        const pre = walk(R, { x0: -20, x1: RX, y0: yF, lo: yF - 5, hi: yF + 5, run: [12, 44], step: [2, 5], p: 0.5 });
        const y0 = yAt(pre, RX);
        const yDrift = Math.round(yF + band * 0.42);
        const post = walk(R, { x0: RX, x1: X1 + 20, y0, lo: yF - 12, hi: bot - 4, run: [14, 48], step: [4, 10], p: 0.8,
            toward: (t) => lerp(y0, yDrift, Math.pow(t, 1.15)), pull: 10 });
        const agent = simplify([...pre, ...post.slice(1)]);
        const acts = tickXs(R, agent, 0, X1, [7, 17]);
        const checks = [];
        for (let x = m + 30; x < RX - 18; x += mobile ? 22 : 30) checks.push(x);

        const mx = X1 - m - (mobile ? 70 : 150);
        world = { top, bot, yF, RX, X1, m, peers, agent, acts, checks, mx, my: yAt(agent, mx), mobile };
    }

    function draw(face, cam) {
        const { ctx, col } = face;
        const w = world;
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        ctx.translate(-cam, 0);
        const ink = (a) => rgba(col.fg, a);
        const px = (v) => Math.round(v) + 0.5;
        const stroke = (pts, o, lw, dash) => {
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), px(y)) : ctx.moveTo(px(x), px(y))));
            ctx.strokeStyle = ink(o); ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
        };
        for (const p of w.peers) stroke(p.pts, p.o, 1);

        // Evaluation: a check above the agent every few blocks, on fixed tasks, until release.
        const yC = w.top - 26;
        ctx.strokeStyle = ink(0.45); ctx.lineWidth = 1;
        for (const x of w.checks) {
            ctx.beginPath(); ctx.moveTo(px(x), yC + 4); ctx.lineTo(px(x), yAt(w.agent, x) - 6); ctx.stroke();
            ctx.fillStyle = col.bg; ctx.fillRect(px(x) - 3.5, yC - 3.5, 7, 7);
            ctx.strokeStyle = ink(0.9); ctx.strokeRect(px(x) - 3.5, yC - 3.5, 7, 7);
            ctx.strokeStyle = ink(0.45);
        }

        // Baseline, after release.
        ctx.setLineDash([7, 5]); ctx.strokeStyle = ink(0.7);
        ctx.beginPath(); ctx.moveTo(w.RX, px(w.yF)); ctx.lineTo(w.X1, px(w.yF)); ctx.stroke(); ctx.setLineDash([]);

        stroke(w.agent, 1, 1.4);
        ctx.fillStyle = col.fg;
        for (const x of w.acts) ctx.fillRect(Math.round(x - 1.5), Math.round(yAt(w.agent, x) - 1.5), 3, 3);

        // The release line.
        ctx.fillStyle = col.fg;
        ctx.fillRect(Math.round(w.RX) - 1, w.top - 64, 2, w.bot - w.top + 96);

        // Drift: the gap between the agent and its baseline, bracketed.
        const yb = w.yF + 4, ye = w.my - 6;
        ctx.strokeStyle = ink(0.9); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px(w.mx), yb); ctx.lineTo(px(w.mx), ye);
        ctx.moveTo(px(w.mx) - 5, px(yb)); ctx.lineTo(px(w.mx) + 5, px(yb));
        ctx.moveTo(px(w.mx) - 5, px(ye)); ctx.lineTo(px(w.mx) + 5, px(ye));
        ctx.stroke();

        // Labels.
        ctx.font = '500 11px "JetBrains Mono", monospace';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
        const label = (t, x, y, c, align = 'left') => {
            ctx.textAlign = align;
            const tw = ctx.measureText(t).width;
            const lx = align === 'right' ? x - tw : x;
            ctx.fillStyle = col.bg; ctx.fillRect(lx - 6, y - 12, tw + 12, 17);
            ctx.fillStyle = c; ctx.fillText(t, x, y);
        };
        label('EVALUATION · FIXED TASKS', w.m, yC - 16, col.fg);
        label('RELEASE', w.RX + 14, w.top - 50, col.fg);
        label(w.mobile ? 'IN THE FIELD' : 'IN THE FIELD · NEW TOOLS, COUNTERPARTS, ITS OWN MEMORY, OTHER AGENTS’ INCENTIVES', w.RX + 14, w.top - 30, col.fg3);
        label('BASELINE', w.X1 - w.m, w.yF - 10, col.fg, 'right');
        label('DRIFT', w.mx - 12, (yb + ye) / 2 + 4, col.fg, 'right');
        label('BEFORE RELEASE · BLOCK HEIGHT →', w.m, w.bot + 30, col.fg3);
        label('UNWATCHED · BLOCK HEIGHT →', w.X1 - w.m, w.bot + 30, col.fg3, 'right');
        ctx.textAlign = 'left';
        ctx.restore();
    }

    function resize() {
        W = window.innerWidth;
        const stage = root.querySelector('.hinge-stage');
        for (const f of faces) {
            ({ ctx: f.ctx } = sizeCanvas(f.canvas));
            f.col = colours(f.el);
        }
        H = faces[0].canvas.getBoundingClientRect().height || stage.clientHeight;
        build();
        if (still) { draw(faces[0], 0); draw(faces[1], W); }
        frame();
    }

    let lastSplit = -1;
    function frame() {
        if (!world) return;
        if (still) {
            const paperTop = faces[1].el.getBoundingClientRect().top;
            setSplit(paperTop <= 64 ? 0 : W);
            return;
        }
        const r = track.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        const p = Math.max(0, Math.min(1, -r.top / span));
        const t = ease(Math.max(0, Math.min(1, (p - 0.14) / 0.72)));
        const cam = t * W;
        const s = W - cam;
        if (s !== lastSplit) {
            lastSplit = s;
            for (const f of faces) draw(f, cam);
            faces[0].el.style.clipPath = `inset(0 ${W - s}px 0 0)`;
            faces[1].el.style.clipPath = `inset(0 0 0 ${s}px)`;
        }
        setSplit(r.top > 0 ? W : s);
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; frame(); });
    }, { passive: true });
    window.addEventListener('resize', () => { lastSplit = -1; resize(); });
    document.fonts?.ready.then(() => { lastSplit = -1; if (still) resize(); else frame(); });
    resize();
}
