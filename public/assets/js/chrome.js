// The header and the rail sit over both grounds. Each has two faces: the base face (ink or
// paper, interactive) and a copy in the other ground, clipped to the part of the screen where
// that ground shows. On the home page the release line moves that boundary as you scroll.

const root = document.documentElement;
const wraps = [...document.querySelectorAll('[data-header], [data-rail-wrap]')];
let split = root.classList.contains('ground-paper') ? 0 : Infinity;

export function setSplit(x) {
    const W = window.innerWidth;
    const s = Math.max(0, Math.min(W, x));
    if (s === split) return;
    split = s;
    root.style.setProperty('--split', `${s}px`);
    const baseInk = s >= W / 2;
    for (const w of wraps) {
        const base = w.querySelector('[data-face="base"]');
        const copy = w.querySelector('[data-face="copy"]');
        base.classList.toggle('ink', baseInk);
        base.classList.toggle('paper', !baseInk);
        copy.classList.toggle('ink', !baseInk);
        copy.classList.toggle('paper', baseInk);
        copy.style.clipPath = baseInk ? `inset(0 0 0 ${s}px)` : `inset(0 ${W - s}px 0 0)`;
    }
}

export function initChrome() {
    const header = document.querySelector('[data-header]');
    if (!header) return;
    let lastY = window.scrollY, ticking = false;
    const update = () => {
        ticking = false;
        const y = window.scrollY;
        header.classList.toggle('is-solid', y > 8);
        const within = header.contains(document.activeElement);
        if (!within && y > lastY + 6 && y > 320) header.classList.add('is-hidden');
        else if (y < lastY - 6 || y < 320 || within) header.classList.remove('is-hidden');
        lastY = y;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
    update();
}
