// Entry point. Seals the page's record, then loads each interactive block's module only when
// that block exists on the page.

import { seal } from './record.js';
import { initChrome } from './chrome.js';

initChrome();
const record = seal().catch((e) => { console.error(e); return null; });

for (const el of document.querySelectorAll('[data-module]')) {
    const name = el.dataset.module;
    import(`./${name}.js`)
        .then(async (m) => m.default(el, await record))
        .catch((e) => console.error(`${name}:`, e));
}

const figs = [...document.querySelectorAll('[data-fig]')];
if (figs.length) {
    import('./figures.js').then((m) => {
        for (const el of figs) {
            const draw = m.FIG[el.dataset.fig];
            if (draw) draw(el);
            else console.error(`No figure named ${el.dataset.fig}`);
        }
    });
}

// Figures draw left to right, the way block height advances, the first time they are seen.
const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-drawn');
        reveal.unobserve(e.target);
    }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.fig.draw').forEach((el) => reveal.observe(el));
