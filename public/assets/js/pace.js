// Machine speed, human pace. One agent's trace with a mark per action, a monitoring agent that
// keeps the same pace, and a human review lane with a mark every few hundred blocks. The counter
// counts this drawing's own marks since its last review mark. Schematic rates, not data.

import { rng, lerp, clamp, sizeCanvas, colours, rgba, whenVisible, reducedMotion } from './trace.js';

const RATE = 20;          // blocks per second
const REVIEW = 640;       // blocks between two human reviews, schematic
const LAG = 14;           // the monitor follows a few blocks behind

export default function pace(root) {
    const canvas = root.querySelector('.lanes canvas');
    const area = root.querySelector('.lanes');
    const count = root.querySelector('[data-pace="count"]');
    const toggle = root.querySelector('[data-pace="toggle"]');
    const R = rng(0x2a9e);

    let head = 0;
    let y = 0, nextStep = 10, nextAct = 4;
    const pts = [[0, 0]];
    const acts = [];
    const reviews = [];
    let since = 0;

    function advance(to) {
        while (Math.min(nextStep, nextAct) <= to) {
            if (nextStep <= nextAct) {
                const b = nextStep;
                if (R() < 0.6) {
                    const ny = clamp(y + (R() < 0.5 ? -1 : 1) * lerp(0.15, 0.6, R()), -1, 1);
                    pts.push([b, y], [b, ny]); y = ny;
                }
                nextStep = b + lerp(8, 50, R());
            } else {
                const b = nextAct;
                acts.push(b);
                since += 1;
                nextAct = b + lerp(2.5, 7, R());
            }
        }
        const r = Math.floor(to / REVIEW);
        if (r > 0 && reviews[reviews.length - 1] !== r * REVIEW) { reviews.push(r * REVIEW); since = acts.filter(a => a > r * REVIEW).length; }
        head = to;
        const keep = head - 3000;
        while (acts.length && acts[0] < keep) acts.shift();
        while (pts.length > 3 && pts[2][0] < keep) pts.splice(0, 2);
        while (reviews.length > 4) reviews.shift();
    }
    advance(REVIEW * 2 + 260);

    let W, H, ctx, col, pxb = 2, m;
    function resize() {
        ({ ctx, w: W, h: H } = sizeCanvas(canvas));
        col = colours(root);
        m = clamp(W * 0.0625, 20, 120);
        pxb = W < 760 ? 1.4 : 2;
        draw();
    }

    function draw() {
        if (!ctx) return;
        const hx = W - m;
        const xOf = (b) => hx - (head - b) * pxb;
        const minB = head - (hx + 20) / pxb;
        const yA = H * 0.2, yM = H * 0.5, yH = H * 0.8, amp = Math.min(22, H * 0.06);
        ctx.clearRect(0, 0, W, H);

        // Agent.
        const agent = new Path2D();
        let started = false;
        for (let i = 0; i < pts.length; i++) {
            const [b, v] = pts[i];
            if (i + 2 < pts.length && pts[i + 2][0] < minB) continue;
            const x = Math.max(-2, xOf(b)), yy = Math.round(yA + v * amp) + 0.5;
            if (!started) { agent.moveTo(x, yy); started = true; } else agent.lineTo(x, yy);
        }
        agent.lineTo(hx, Math.round(yA + y * amp) + 0.5);
        ctx.strokeStyle = rgba(col.fg, 0.95); ctx.lineWidth = 1.3; ctx.stroke(agent);

        // Monitor: the same path a few blocks behind, dotted.
        ctx.save();
        ctx.translate(-LAG * pxb, yM - yA);
        ctx.beginPath(); ctx.rect(m + LAG * pxb, -H, W, 3 * H); ctx.clip();
        ctx.setLineDash([2, 3]); ctx.strokeStyle = rgba(col.fg, 0.8); ctx.lineWidth = 1; ctx.stroke(agent);
        ctx.restore();

        const yOn = (b) => { let v = pts[0][1]; for (const [pb, pv] of pts) { if (pb > b) break; v = pv; } return v; };
        ctx.fillStyle = col.fg;
        for (let i = 0; i < acts.length; i++) {
            const b = acts[i];
            if (b < minB) continue;
            const x = xOf(b);
            ctx.fillRect(Math.round(x - 1.5), Math.round(yA + yOn(b) * amp - 1.5) + 0.5, 3, 3);
            const xm = x - LAG * pxb;
            if (xm > m && i % 2 === 0) {
                ctx.strokeStyle = rgba(col.fg, 0.85); ctx.lineWidth = 1;
                ctx.strokeRect(Math.round(xm - 2) + 0.5, Math.round(yM + yOn(b - LAG) * amp - 2) + 0.5, 4, 4);
            }
        }

        // Human review.
        ctx.strokeStyle = rgba(col.fg, 0.45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(m, Math.round(yH) + 0.5); ctx.lineTo(hx, Math.round(yH) + 0.5); ctx.stroke();
        for (const b of reviews) {
            const x = xOf(b);
            if (x < m - 10) continue;
            ctx.strokeStyle = col.fg; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, yH - 14); ctx.lineTo(Math.round(x) + 0.5, yH + 14); ctx.stroke();
            ctx.fillStyle = col.fg; ctx.fillRect(Math.round(x - 4.5), Math.round(yH - 4.5), 9, 9);
        }

        // Labels, knocked out of the traces.
        ctx.font = '500 11px "JetBrains Mono", monospace';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
        const label = (t, x, yy, c) => {
            const w = ctx.measureText(t).width;
            ctx.fillStyle = col.bg; ctx.fillRect(x - 6, yy - 12, w + 12, 17);
            ctx.fillStyle = c; ctx.fillText(t, x, yy);
        };
        label('AGENT · EACH SQUARE IS ONE ACTION', m, yA - amp - 14, col.fg);
        label('MONITORING AGENT · SAME PACE', m, yM - amp - 14, col.fg);
        label('HUMAN REVIEW', m, yH - 26, col.fg);
        ctx.textAlign = 'right';
        label('BLOCK HEIGHT →', hx, yH + 40, col.fg3);
        ctx.textAlign = 'left';
        if (count) count.textContent = String(since);
    }

    let running = !reducedMotion(), visible = false, raf = 0, last = 0;
    const loop = (t) => {
        raf = 0;
        if (!running || !visible) return;
        const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
        last = t;
        advance(head + dt * RATE);
        draw();
        raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && running && visible) { last = 0; raf = requestAnimationFrame(loop); } };
    whenVisible(area, (v) => { visible = v; kick(); });
    if (toggle) {
        const set = (on) => {
            running = on;
            toggle.setAttribute('aria-pressed', String(!on));
            toggle.querySelector('span').textContent = on ? 'Pause' : 'Play';
            kick();
        };
        toggle.addEventListener('click', () => set(!running));
        set(running);
    }
    new ResizeObserver(resize).observe(area);
    document.fonts?.ready.then(draw);
    resize();
}
