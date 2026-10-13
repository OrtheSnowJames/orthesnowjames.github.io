const catalogSections = document.querySelectorAll("[data-catalog]");
const actionLabel = document.body.dataset.actionLabel || "Play";
const instructionsLabel = document.body.dataset.instructionsLabel || "How to play";
const downloadDialog = document.getElementById("download-dialog");
const downloadTitle = document.getElementById("download-title");
const downloadOptions = document.getElementById("download-options");
const playDialog = document.getElementById("play-dialog");
const playTitle = document.getElementById("play-title");
const playOpen = document.getElementById("play-open");
const playInstructions = document.getElementById("play-instructions");
const playOptions = document.getElementById("play-options");
const instructionsText = document.getElementById("instructions-text");
let instructionsRequest = null;

function createIcon(name) {
    const icon = document.createElement("img");
    icon.src = `assets/icons/${name}.svg`;
    icon.alt = "";
    icon.width = 18;
    icon.height = 18;
    return icon;
}

function getRepositoryUrl(repo) {
    return repo.startsWith("https://") ? repo : `https://github.com/${repo}`;
}

function getDownloads(game) {
    const downloads = [];
    const platforms = [
        ["windows_download", "Windows"],
        ["mac_download", "Mac"],
        ["linux_download", "Linux"],
    ];

    for (const [key, platform] of platforms) {
        if (game[key]) {
            downloads.push({ label: `Download for ${platform}`, url: game[key], file: true });
        }
    }

    if (game.gh_repo) {
        const url = getRepositoryUrl(game.gh_repo);
        downloads.push({ label: "GitHub repo", url, file: false });
    }

    return downloads;
}

function openDownloads(name, downloads) {
    downloadTitle.textContent = `Download ${name}`;
    downloadOptions.replaceChildren();

    for (const download of downloads) {
        const link = document.createElement("a");
        link.className = "dialog-option";
        link.textContent = download.label;
        link.href = download.url;

        if (download.file) {
            link.download = "";
        } else {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }

        downloadOptions.append(link);
    }

    downloadDialog.showModal();
}

function openPlayOptions(name, wasm, howToPlay) {
    instructionsRequest?.abort();
    playDialog.classList.remove("is-reading");
    playOptions.hidden = false;
    instructionsText.hidden = true;
    playTitle.textContent = `${actionLabel} ${name}`;
    playOpen.href = wasm;
    playInstructions.textContent = instructionsLabel;
    playInstructions.onclick = () => openInstructions(howToPlay);
    playDialog.showModal();
}

async function openInstructions(path) {
    instructionsRequest?.abort();
    const request = new AbortController();
    instructionsRequest = request;
    playDialog.classList.add("is-reading");
    playTitle.textContent = instructionsLabel;
    playOptions.hidden = true;
    instructionsText.hidden = false;
    instructionsText.textContent = "Loading instructions...";
    instructionsText.scrollTop = 0;
    if (!playDialog.open) {
        playDialog.showModal();
    }
    instructionsText.focus();

    try {
        const response = await fetch(path, { signal: request.signal });
        if (!response.ok) throw new Error(`Could not load instructions: ${response.status}`);
        const text = await response.text();
        if (!request.signal.aborted) {
            instructionsText.textContent = text.trim() ? text : "No instructions yet.";
        }
    } catch (error) {
        if (!request.signal.aborted) {
            instructionsText.textContent = "Instructions could not be loaded. Please try again later.";
        }
    } finally {
        if (instructionsRequest === request) instructionsRequest = null;
    }
}

function createToolPanel(id, tool) {
    const name = tool.name || id;
    const panel = document.createElement("article");
    panel.className = "tool-panel";

    const title = document.createElement("h3");
    title.className = "tool-title";
    title.textContent = name;
    panel.append(title);

    if (tool.image) {
        const image = document.createElement("img");
        image.className = "tool-image";
        image.src = new URL(tool.image, document.baseURI).href;
        image.alt = `${name} preview`;
        panel.append(image);
    }

    const description = document.createElement("p");
    description.className = "tool-description";
    description.textContent = tool.description || "";
    panel.append(description);

    const repo = (tool.gh_repo || document.body.dataset.githubUrl || "").trim();
    const github = document.createElement(repo ? "a" : "button");
    github.className = "game-action tool-github";
    github.textContent = "GitHub";
    github.prepend(createIcon("external-link"));
    if (repo) {
        github.href = getRepositoryUrl(repo);
        github.target = "_blank";
        github.rel = "noopener noreferrer";
    } else {
        github.type = "button";
        github.disabled = true;
        github.title = "GitHub repository unavailable";
    }
    panel.append(github);
    return panel;
}

function createGamePanel(id, game) {
    const name = game.name || id;
    const downloads = getDownloads(game);
    const panel = document.createElement("article");
    panel.className = "game-panel";

    if (game.image) {
        const imageUrl = new URL(game.image, document.baseURI);
        panel.style.backgroundImage = `url(${JSON.stringify(imageUrl.href)})`;
        if (game.image_fit === "contain") {
            panel.classList.add("game-panel-contain");
        }
    }

    const title = document.createElement("h3");
    title.className = "game-title";
    title.textContent = name;

    const actions = document.createElement("div");
    actions.className = "buttons";

    const download = document.createElement("button");
    download.type = "button";
    download.className = "game-action";
    download.textContent = "Download";
    download.prepend(createIcon("download"));
    download.setAttribute("aria-haspopup", "dialog");
    download.setAttribute("aria-controls", "download-dialog");
    download.disabled = downloads.length === 0;
    download.addEventListener("click", () => openDownloads(name, downloads));

    const wasm = typeof game.wasm === "string" ? game.wasm.trim() : "";
    const howToPlay = typeof game.how_to_play === "string" ? game.how_to_play.trim() : "";
    const play = document.createElement(wasm && !howToPlay ? "a" : "button");
    play.className = "game-action";
    play.textContent = actionLabel;
    play.prepend(createIcon(actionLabel === "Open" ? "external-link" : "play"));

  if (wasm && howToPlay) {
    play.type = "button";
    play.setAttribute("aria-haspopup", "dialog");
    play.setAttribute("aria-controls", "play-dialog");
    play.addEventListener("click", () => openPlayOptions(name, wasm, howToPlay));
  } else if (wasm) {
    play.href = wasm;
  } else if (howToPlay) {
    play.type = "button";
    play.title = "How to play";
    // enable
    play.removeAttribute("aria-disabled");
    play.setAttribute("aria-haspopup", "dialog");
    play.setAttribute("aria-controls", "play-dialog");
    play.addEventListener("click", () => openInstructions(howToPlay));
  } else {
    play.type = "button";
    play.setAttribute("aria-disabled", "true");
    play.title = "Browser version unavailable";
    play.addEventListener("click", () => window.alert("Unavailable"));
  }

    actions.append(download, play);
    panel.append(title, actions);
    return panel;
}

async function loadGames(section) {
    const catalogSource = section.dataset.catalog;
    const catalogLabel = section.dataset.catalogLabel || "games";
    const catalogLayout = section.dataset.catalogLayout || "games";
    const gamesGrid = section.querySelector(".games-grid");
    const gamesStatus = section.querySelector("[role='status']");
    const retryButton = section.querySelector(".catalog-retry");
    retryButton.hidden = true;
    gamesStatus.hidden = false;
    gamesStatus.textContent = `Loading ${catalogLabel}...`;

    try {
        const response = await fetch(catalogSource);
        if (!response.ok) throw new Error(`Could not load ${catalogLabel}: ${response.status}`);
        const games = await response.json();
        const createPanel = catalogLayout === "tools" ? createToolPanel : createGamePanel;
        const panels = Object.entries(games).map(([id, game]) => createPanel(id, game));
        gamesGrid.replaceChildren(...panels);
        gamesStatus.textContent = panels.length ? "" : `No ${catalogLabel} yet.`;
        gamesStatus.hidden = panels.length > 0;
    } catch (error) {
        gamesStatus.textContent = `Could not load ${catalogLabel}.`;
        retryButton.hidden = false;
        console.error(error);
    }
}

for (const dialog of [downloadDialog, playDialog]) {
    dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) {
            dialog.close();
        }
    });
}

playDialog.addEventListener("close", () => instructionsRequest?.abort());
for (const section of catalogSections) {
    section.querySelector(".catalog-retry").addEventListener("click", () => loadGames(section));
    loadGames(section);
}
