// Block height is the only clock. In a Range world the controller seals blocks; on this page the
// reader's scroll does. Each block is stamped with the previous timestamp plus a fixed increment,
// one agent's action budget falls by one per tool call and refills every eight blocks, and one
// pause takes a snapshot. Nothing moves unless the page scrolls: there is no timer here.

import { rng, reducedMotion } from './trace.js';
import { inset } from './figures.js';

const NS = 'http://www.w3.org/2000/svg';
const REFILL = 8, FULL = 4;

export default function clock(root) {
    const host = root.querySelector('.clock-plate');
    const count = root.querySelector('[data-clock="count"]');
    const still = reducedMotion();
    let blocks = [], budget = null, clip = null, B = 0, n = -1, X = () => 0, svg = null;

    function build() {
        const w = host.clientWidth;
        if (!w) return;
        const mobile = w < 760;
        const L = inset(w);
        B = mobile ? 14 : 40;
        const pause = mobile ? 9 : 27;
        const h = 210;
        const yB = 150, yBud = 54, yAct = yB - 22;
        const step = (w - 2 * L) / B;
        X = (i) => Math.round(L + (i + 0.5) * step) + (i >= pause ? 6 : 0) - 3;
        const R = rng(0xc10c4);

        // Each block's actions, spent from a budget that refills every REFILL blocks.
        let left = FULL;
        const acts = [], level = [];
        for (let i = 0; i < B; i++) {
            if (i % REFILL === 0) left = FULL;
            const want = i === pause ? 0 : Math.floor(R() * 3.2);
            const k = Math.min(want, left);
            left -= k;
            acts.push(k);
            level.push(left);
        }
        const yLvl = (v) => yBud + (FULL - v) * 7;
        const pts = [];
        let lv = FULL;
        for (let i = 0; i < B; i++) {
            const x0 = X(i) - step / 2;
            if (i % REFILL === 0 && i) { pts.push([x0, yLvl(lv)], [x0, yLvl(FULL)]); lv = FULL; }
            for (let a = 0; a < acts[i]; a++) {
                const xa = Math.round(X(i) - 6 + a * 6);
                pts.push([xa, yLvl(lv)], [xa, yLvl(lv - 1)]);
                lv -= 1;
            }
        }
        pts.push([X(B - 1) + step / 2, yLvl(lv)]);
        pts.unshift([X(0) - step / 2, yLvl(FULL)]);

        const out = [];
        out.push(`<text class="t-ink" x="${L}" y="18">${mobile ? 'ACTION BUDGET · ONE AGENT' : 'ACTION BUDGET · ONE AGENT · REFILLED EVERY 8 BLOCKS'}</text>`);
        out.push(`<clipPath id="clock-clip"><rect x="0" y="0" width="0" height="${h}"/></clipPath>`);
        out.push(`<g clip-path="url(#clock-clip)"><path d="M${pts.map(([x, y]) => `${Math.round(x) + 0.5},${Math.round(y) + 0.5}`).join('L')}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`);
        for (let i = REFILL; i < B; i += REFILL) out.push(`<text class="t-3" x="${Math.round(X(i) - step / 2)}" y="${yBud - 12}" text-anchor="middle">REFILL</text>`);
        out.push('</g>');
        out.push(`<line x1="${L}" y1="${yB + 0.5}" x2="${w - L}" y2="${yB + 0.5}" stroke="currentColor" stroke-opacity="0.35"/>`);
        for (let i = 0; i < B; i++) {
            const x = X(i);
            let g = `<g class="blk" data-i="${i}"><rect x="${x - 5.5}" y="${yB - 5.5}" width="11" height="11" rx="1.5"/>`;
            for (let a = 0; a < acts[i]; a++) g += `<line x1="${x - 3 + a * 3 + 0.5}" y1="${yAct}" x2="${x - 3 + a * 3 + 0.5}" y2="${yAct + 7}"/>`;
            if (i === 0) g += `<text x="${x}" y="${yB + 28}" text-anchor="middle">t</text>`;
            else if (i % (mobile ? 4 : 5) === 0) g += `<text x="${x}" y="${yB + 28}" text-anchor="middle">t+${i}Δ</text>`;
            out.push(g + '</g>');
        }
        const xp = Math.round((X(pause - 1) + X(pause)) / 2);
        out.push(`<g class="blk pause" data-i="${pause}"><line x1="${xp - 1.5}" y1="${yB - 18}" x2="${xp - 1.5}" y2="${yB + 12}"/><line x1="${xp + 1.5}" y1="${yB - 18}" x2="${xp + 1.5}" y2="${yB + 12}"/><text class="t-ink" x="${xp}" y="${yB - 46}" text-anchor="middle">${mobile ? 'PAUSE · IMAGE' : 'PAUSE · IMAGE · RESTORE'}</text></g>`);
        out.push(`<text class="t-3" x="${L}" y="${h - 4}">${mobile ? 'EACH BLOCK: PREVIOUS + Δ' : 'EACH BLOCK: PREVIOUS TIMESTAMP + Δ · NO WALL CLOCK IN THE WORLD'}</text>`);
        out.push(`<text class="t-3" x="${w - L}" y="${h - 4}" text-anchor="end">BLOCK HEIGHT →</text>`);

        if (!svg) {
            svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('class', 'plate clock-svg');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            host.append(svg);
        }
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.innerHTML = out.join('');
        blocks = [...svg.querySelectorAll('.blk')];
        clip = svg.querySelector('#clock-clip rect');
        n = -1;
        update();
    }

    function update() {
        if (!B) return;
        let k = B;
        if (!still) {
            const r = host.getBoundingClientRect();
            const vh = window.innerHeight;
            const p = Math.max(0, Math.min(1, (vh * 0.92 - r.top) / (vh * 0.62)));
            k = Math.round(p * B);
        }
        if (k === n) return;
        n = k;
        for (const g of blocks) g.classList.toggle('is-sealed', Number(g.dataset.i) < n);
        const xHead = n ? X(n - 1) + 8 : 0;
        clip.setAttribute('width', String(Math.max(0, xHead)));
        if (still) { if (count.isConnected) count.parentElement.textContent = `Blocks 1 to ${B}, all sealed`; }
        else count.textContent = `Block ${n}`;
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; update(); });
    }, { passive: true });
    let lastW = 0;
    new ResizeObserver(() => { if (host.clientWidth !== lastW) { lastW = host.clientWidth; build(); } }).observe(host);
}
