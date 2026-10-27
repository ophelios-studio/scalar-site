// The record, editable. Each row is one block of this page: its headline, the hash recorded when
// the page loaded, and the hash of what the page says now. Editing a headline here edits the
// real headline on the page, then the whole chain is recomputed with real SHA-256. The edited
// block's hash changes, and so does every hash after it, because each one covers its parent.

import { ENGINE } from './record.js';

const short = (h) => h.slice(0, 8);

export default function ledger(root, record) {
    if (!record) return;
    const list = root.querySelector('.ledger-rows');
    const status = root.querySelector('.ledger-status');
    const restore = root.querySelector('[data-restore]');
    const engine = root.querySelector('[data-engine]');
    if (engine) engine.textContent = ENGINE;

    const rows = record.blocks.map((block, i) => {
        const headline = block.querySelector('[data-headline]');
        return { block, headline, original: headline ? headline.innerHTML : '', i };
    });

    list.innerHTML = '';
    for (const r of rows) {
        const n = String(r.i + 1).padStart(2, '0');
        const row = document.createElement('div');
        row.className = 'ledger-row';
        row.innerHTML = `
            <span class="ln">${n}</span>
            <span class="ledger-edit" role="textbox" aria-multiline="false" spellcheck="false"
                  aria-label="Headline of block ${n}. Edit it to change the page."></span>
            <span class="h-rec"></span>
            <span class="h-now"></span>
            <details><summary>Exact input to SHA-256</summary><pre></pre></details>`;
        const edit = row.querySelector('.ledger-edit');
        edit.textContent = r.headline ? r.headline.textContent.replace(/\s+/g, ' ').trim() : '';
        edit.contentEditable = supportsPlaintext() ? 'plaintext-only' : 'true';
        r.row = row; r.edit = edit; r.initial = edit.textContent;

        edit.addEventListener('input', () => apply(r));
        edit.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); edit.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); edit.textContent = r.initial; apply(r); edit.blur(); }
        });
        edit.addEventListener('paste', (e) => {
            e.preventDefault();
            const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
            document.execCommand('insertText', false, t);
        });
        list.append(row);
    }

    let pending = 0;
    async function apply(r) {
        const text = r.edit.textContent.replace(/\s+/g, ' ').trim();
        if (r.headline) {
            if (text === r.initial) r.headline.innerHTML = r.original;
            else r.headline.textContent = text;
        }
        const ticket = ++pending;
        await record.recompute();
        if (ticket === pending) paint();
    }

    function paint() {
        let first = -1, broken = 0;
        rows.forEach((r, i) => {
            const rec = record.recorded[i], now = record.now[i];
            const isBroken = rec.hash !== now.hash;
            const isEdited = rec.text !== now.text;
            if (isEdited && first < 0) first = i;
            if (isBroken) broken++;
            r.row.classList.toggle('is-broken', isBroken);
            r.row.classList.toggle('is-edited', isEdited);
            r.row.querySelector('.h-rec').textContent = `#${short(rec.hash)}`;
            r.row.querySelector('.h-now').textContent = `${isBroken ? '≠' : '='} #${short(now.hash)}`;
            r.row.querySelector('.h-now').setAttribute('aria-label', isBroken ? `Now ${short(now.hash)}, no longer matches` : `Now ${short(now.hash)}, matches`);
            r.row.querySelector('pre').textContent = `${now.parent}\n${now.text}`;
        });
        const n = rows.length;
        if (first < 0) {
            status.textContent = `The record holds · ${n} blocks · every hash matches`;
            status.classList.remove('is-broken');
            restore.disabled = true;
        } else {
            const later = n - first - 1;
            status.textContent = `Block ${String(first + 1).padStart(2, '0')} changed · ${broken} of ${n} hashes no longer match` +
                (later ? ` · ${later} later block${later > 1 ? 's' : ''} broken by inheritance` : '');
            status.classList.add('is-broken');
            restore.disabled = false;
        }
    }

    restore.addEventListener('click', async () => {
        for (const r of rows) {
            r.edit.textContent = r.initial;
            if (r.headline) r.headline.innerHTML = r.original;
        }
        await record.recompute();
        paint();
        status.focus?.();
    });

    paint();
}

function supportsPlaintext() {
    const d = document.createElement('div');
    try { d.contentEditable = 'plaintext-only'; } catch { return false; }
    return d.contentEditable === 'plaintext-only';
}
