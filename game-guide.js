const frame = document.querySelector(".game-frame");
// Preserve game-specific options, including Voyage's mobile override.
const runtime = new URL(frame.getAttribute("src"), document.baseURI);
runtime.search = location.search;
runtime.hash = location.hash;
if (frame.src !== runtime.href) frame.src = runtime.href;

const guide = document.querySelector("[data-guide]");
const status = guide.querySelector(".guide-status");
const content = guide.querySelector(".guide-content");

async function loadGuide() {
    try {
        const response = await fetch(guide.dataset.guide);
        if (!response.ok) throw new Error(`Guide request failed: ${response.status}`);
        const text = await response.text();
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
                    content.append(list);
                }
                const item = document.createElement("li");
                item.textContent = value.slice(2);
                list.append(item);
            } else {
                list = null;
                const element = document.createElement(/^[A-Z][A-Z0-9 /-]*$/.test(value) ? "h2" : "p");
                element.textContent = value;
                content.append(element);
            }
        }
        status.hidden = true;
    } catch {
        status.textContent = "The guide could not load. Use the text guide link below to try again.";
    }
}

loadGuide();
