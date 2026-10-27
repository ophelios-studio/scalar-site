// The film never plays by itself. Until the reader asks for it, only the poster and one button
// show; the button starts it with sound and hands over to the player's own controls.

export default function film(root) {
    const video = root.querySelector('.film-video');
    const play = root.querySelector('.film-play');
    if (!video || !play) return;
    video.controls = false;
    play.hidden = false;
    play.addEventListener('click', () => {
        play.hidden = true;
        video.controls = true;
        video.play().then(() => video.focus()).catch(() => { play.hidden = false; video.controls = false; });
    });
    video.addEventListener('ended', () => { video.controls = false; play.hidden = false; video.load(); });
}
