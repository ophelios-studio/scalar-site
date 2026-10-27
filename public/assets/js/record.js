// Every page on this site is a hash chain. Each block (a section with data-block) is hashed as
//     SHA-256( parent_hash + "\n" + normalized_text )
// where the first block's parent is 64 zeros and normalized_text is the section's visible text
// with its chrome removed: text nodes joined by one space, Unicode NFC, whitespace collapsed,
// trimmed. Change one word in a block and its hash changes, and so does every hash after it.
//
// SHA-256 comes from Web Crypto. Outside a secure context (a file:// preview, a plain-http LAN
// address), Web Crypto is not available, so a small synchronous implementation stands in.

export const GENESIS = '0'.repeat(64);

// What a block "says": everything a reader can read, minus chrome and anything that changes
// while the page runs (counters, live status lines), which carry data-volatile.
const EXCLUDE = '.block-meta, [data-volatile], [aria-hidden="true"], script, style, canvas, template, noscript';

export function normalize(block) {
    const clone = block.cloneNode(true);
    clone.querySelectorAll(EXCLUDE).forEach(e => e.remove());
    const parts = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
    return parts.join(' ').normalize('NFC').replace(/\s+/g, ' ').trim();
}

// FIPS 180-4 SHA-256, for contexts without Web Crypto. Round constants and the initial state
// are the fractional parts of the cube and square roots of the first primes.
const PRIMES = [];
for (let n = 2; PRIMES.length < 64; n++) if (PRIMES.every(p => n % p)) PRIMES.push(n);
const frac = (x) => ((x - Math.floor(x)) * 0x100000000) >>> 0;
const K = Uint32Array.from(PRIMES, p => frac(Math.cbrt(p)));
const H0 = Uint32Array.from(PRIMES.slice(0, 8), p => frac(Math.sqrt(p)));
const ror = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256Sync(text) {
    const bytes = new TextEncoder().encode(text);
    const len = bytes.length;
    const size = (((len + 9) + 63) >> 6) << 6;
    const buf = new Uint8Array(size);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(size - 8, Math.floor(len / 0x20000000));
    dv.setUint32(size - 4, (len * 8) >>> 0);
    const H = Uint32Array.from(H0);
    const W = new Uint32Array(64);
    for (let off = 0; off < size; off += 64) {
        for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
        for (let i = 16; i < 64; i++) {
            const a = W[i - 15], b = W[i - 2];
            W[i] = (W[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + W[i - 7] + (ror(b, 17) ^ ror(b, 19) ^ (b >>> 10))) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
            const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
            const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
            h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, v => v.toString(16).padStart(8, '0')).join('');
}

const subtle = globalThis.isSecureContext && globalThis.crypto && crypto.subtle;
export const ENGINE = subtle ? 'Web Crypto' : 'built-in';

export async function sha256(text) {
    if (!subtle) return sha256Sync(text);
    const d = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

export async function chain(blocks) {
    const links = [];
    let parent = GENESIS;
    for (const el of blocks) {
        const text = normalize(el);
        const hash = await sha256(`${parent}\n${text}`);
        links.push({ el, parent, text, hash });
        parent = hash;
    }
    return links;
}

const short = (h) => h.slice(0, 6);

// The page's record: sealed once at load, recomputed whenever a block's text changes.
export async function seal() {
    const blocks = [...document.querySelectorAll('[data-block]')];
    if (!blocks.length) return null;
    const recorded = await chain(blocks);
    const state = { blocks, recorded, now: recorded };

    const paint = () => {
        state.now.forEach((l, i) => {
            const broken = l.hash !== recorded[i].hash;
            for (const el of l.el.querySelectorAll('.block-meta .hash')) {
                el.textContent = `#${short(l.hash)} ← #${short(l.parent)}`;
                el.classList.toggle('is-broken', broken);
            }
        });
        const head = state.now[state.now.length - 1];
        const headBroken = head.hash !== recorded[recorded.length - 1].hash;
        document.querySelectorAll('[data-head-hash]').forEach(el => {
            el.textContent = `#${short(head.hash)}`;
            el.classList.toggle('is-broken', headBroken);
        });
        rail?.paint();
        document.dispatchEvent(new CustomEvent('record:change', { detail: state }));
    };

    state.recompute = async () => {
        state.now = await chain(blocks);
        paint();
        return state.now;
    };

    const rail = railFor(state);
    paint();
    return state;
}

// The rail at the foot of the screen: where you are in the page's record, and its hash.
function railFor(state) {
    const rails = [...document.querySelectorAll('[data-rail]')];
    if (!rails.length) return null;
    const n = state.blocks.length;
    let current = 0;

    for (const rail of rails) {
        const strip = rail.querySelector('.rail-strip');
        const copy = rail.closest('[aria-hidden="true"]');
        strip.innerHTML = state.blocks.map((b, i) => {
            const name = b.dataset.name || `Block ${i + 1}`;
            const label = `Block ${String(i + 1).padStart(2, '0')}: ${name}`;
            return copy
                ? `<a tabindex="-1" href="#${b.id}"><span></span></a>`
                : `<a href="#${b.id}" aria-label="${label}"><span></span></a>`;
        }).join('');
    }

    const update = () => {
        const probe = window.innerHeight * 0.45;
        let idx = 0;
        state.blocks.forEach((b, i) => { if (b.getBoundingClientRect().top <= probe) idx = i; });
        if (idx !== current) { current = idx; paint(); }
    };

    const paint = () => {
        const l = state.now[current];
        const broken = l.hash !== state.recorded[current].hash;
        const name = state.blocks[current].dataset.name || '';
        for (const rail of rails) {
            rail.querySelector('.rail-where').innerHTML =
                `BLOCK <b>${String(current + 1).padStart(2, '0')}</b> / ${String(n).padStart(2, '0')}<span class="rail-name"> · ${name.toUpperCase()}</span>`;
            const hash = rail.querySelector('.rail-hash');
            hash.innerHTML = `<b>#${short(l.hash)}</b> ← #${short(l.parent)}`;
            hash.classList.toggle('is-broken', broken);
            rail.querySelectorAll('.rail-strip a').forEach((a, i) => {
                a.toggleAttribute('aria-current', i === current);
                if (i === current) a.setAttribute('aria-current', 'true');
                a.classList.toggle('is-broken', state.now[i].hash !== state.recorded[i].hash);
                a.classList.toggle('is-edited', state.now[i].text !== state.recorded[i].text);
            });
        }
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
    return { paint };
}
