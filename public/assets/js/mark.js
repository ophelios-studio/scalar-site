// The close: the S mark drawn as one orthogonal stroke, the way a trace is drawn, then filled.
export default function mark(root) {
    const svg = root.querySelector('.close-mark');
    if (!svg) return;
    const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        svg.classList.add('is-drawn');
        io.disconnect();
    }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(svg);
}
