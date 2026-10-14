const frame = document.querySelector(".game-frame");
// preserve game specific options including the voyage mobile override
const runtime = new URL(frame.getAttribute("src"), document.baseURI);
runtime.search = location.search;
runtime.hash = location.hash;
if (frame.src !== runtime.href) frame.src = runtime.href;

const guide = document.querySelector("[data-guide]");
const status = guide.querySelector(".guide-status");
const content = guide.querySelector(".guide-content");
let guideRequest;
let sizeObserver;
let resizeFrame = 0;

function fitGameContent() {
    if (!frame.dataset.fitContent) return;
    sizeObserver?.disconnect();
    const game = frame.contentDocument.querySelector(frame.dataset.fitContent);
    if (!game) return;
    const resize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            // measure the game rather than the document so the frame can shrink again too
            const bounds = game.getBoundingClientRect();
            const gameBottom = bounds.height ? bounds.bottom + frame.contentWindow.scrollY : 0;
            const height = Math.ceil(Math.max(window.innerHeight * 0.9, gameBottom));
            if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
        });
    };
    sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(game);
    resize();
}

window.addEventListener("resize", () => {
    if (guide.isConnected && frame.dataset.fitContent) fitGameContent();
});

function followGameNavigation() {
    sizeObserver?.disconnect();
    cancelAnimationFrame(resizeFrame);
    let destination;
    try {
        destination = new URL(frame.contentWindow.location.href);
    } catch {
        // a different origin cannot be inspected but no longer belongs to this guide
        guideRequest?.abort();
        guide.remove();
        frame.style.height = "100svh";
        return;
    }
    if (destination.href === "about:blank") return;
    if (destination.origin === runtime.origin && destination.pathname === runtime.pathname) {
        fitGameContent();
        return;
    }

    // let the new page replace the shell instead of nesting another page and guide inside it
    guideRequest?.abort();
    guide.remove();
    window.location.replace(destination.href);
}

frame.addEventListener("load", followGameNavigation);
followGameNavigation();

async function loadGuide() {
    guideRequest?.abort();
    const request = new AbortController();
    guideRequest = request;
    try {
        const response = await fetch(guide.dataset.guide, { signal: request.signal });
        if (!response.ok) throw new Error(`Guide request failed: ${response.status}`);
        const text = await response.text();
        if (request.signal.aborted || !guide.isConnected) return;
        // build the guide once and replace the old contents rather than appending duplicates
        const fragment = document.createDocumentFragment();
        let list = null;
        for (const line of text.split(/\r?\n/)) {
            const value = line.trim();
            if (!value) {
                list = null;
                continue;
            }
            if (value.startsWith("- ")) {
                if (!list) {
                    list = document.createElement("ul");
                    fragment.append(list);
                }
                const item = document.createElement("li");
                item.textContent = value.slice(2);
                list.append(item);
            } else {
                list = null;
                const element = document.createElement(/^[A-Z][A-Z0-9 /-]*$/.test(value) ? "h2" : "p");
                element.textContent = value;
                fragment.append(element);
            }
        }
        content.replaceChildren(fragment);
        status.hidden = true;
    } catch {
        if (request.signal.aborted || !guide.isConnected) return;
        status.textContent = "The guide could not load. Use the text guide link below to try again.";
    }
}

// a shell opened inside another shell is promoted by its parent without showing a second guide
if (window.parent !== window) {
    guide.hidden = true;
} else if (guide.isConnected) {
    loadGuide();
}
