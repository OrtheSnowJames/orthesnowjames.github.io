(() => {
    const app = document.getElementById("chat-app");
    if (!app) return;
    const entry = document.getElementById("chat-entry");
    const panel = document.getElementById("chat-panel");
    const nameInput = document.getElementById("chat-name");
    const joinButton = document.getElementById("chat-join-button");
    const joinError = document.getElementById("chat-join-error");
    const connection = document.getElementById("chat-connection");
    const messages = document.getElementById("chat-messages");
    const messageInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("chat-send");
    let socket = null;
    let requestedName = null;
    let joined = false;
    let joining = false;
    let joinTimer;

    function setJoining(value) {
        joining = value;
        nameInput.disabled = value;
        const label = value ? "Cancel connection" : "Join chat";
        joinButton.setAttribute("aria-label", label);
        joinButton.title = label;
        joinButton.querySelector("img").src = `archive_data/multiplayer_game_web/icons/arrow-${value ? "left" : "right"}.svg`;
    }

    function setConnected(value, text = value ? "Connected" : "Reconnecting...") {
        joined = value;
        messageInput.disabled = !value;
        sendButton.disabled = !value;
        connection.textContent = text;
        connection.dataset.state = value ? "connected" : "connecting";
    }

    function leaveChat(error = "") {
        requestedName = null;
        clearTimeout(joinTimer);
        socket?.disconnect();
        setConnected(false);
        setJoining(false);
        panel.hidden = true;
        entry.hidden = false;
        messages.replaceChildren();
        joinError.textContent = error;
        nameInput.focus({ preventScroll: true });
    }

    function joinChat() {
        clearTimeout(joinTimer);
        joinError.textContent = "Joining...";
        socket.emit("joinChat", { name: requestedName });
        joinTimer = setTimeout(() => leaveChat("Couldn't join chat. Please try again."), 10000);
    }

    function getSocket() {
        if (socket) return socket;
        socket = io(app.dataset.serverUrl, {
            autoConnect: false,
            timeout: 10000,
            transports: ["websocket"],
            reconnectionDelayMax: 5000,
        });
        socket.on("connect", () => {
            if (requestedName) joinChat();
        });
        socket.on("connect_error", () => {
            joinError.textContent = "Can't reach chat yet. Retrying...";
            setConnected(false, "Reconnecting...");
        });
        socket.on("disconnect", () => {
            clearTimeout(joinTimer);
            setConnected(false);
            if (requestedName && !socket.active) socket.connect();
        });
        socket.on("joinError", error => leaveChat(typeof error === "string" ? error : "Couldn't join chat."));
        socket.on("currentChat", data => {
            if (!requestedName || typeof data?.name !== "string") return;
            clearTimeout(joinTimer);
            requestedName = data.name;
            nameInput.value = data.name;
            setJoining(false);
            setConnected(true);
            joinError.textContent = "";
            entry.hidden = true;
            panel.hidden = false;
            try {
                localStorage.setItem("multiplayer-player-name", data.name);
            } catch {
                // Remembering a name is optional.
            }
            messageInput.focus({ preventScroll: true });
        });
        socket.on("playerMessage", data => {
            if (!joined || typeof data?.name !== "string" || typeof data.msg !== "string") return;
            const message = document.createElement("p");
            const sender = document.createElement("strong");
            sender.textContent = `${data.name}: `;
            message.append(sender, document.createTextNode(data.msg));
            messages.append(message);
            if (messages.childElementCount > 16) messages.firstElementChild.remove();
            messages.scrollTop = messages.scrollHeight;
        });
        return socket;
    }

    try {
        nameInput.value = (localStorage.getItem("multiplayer-player-name") || "").slice(0, 20);
    } catch {
        // Storage may be unavailable in embedded browsers.
    }

    nameInput.addEventListener("input", () => {
        nameInput.removeAttribute("aria-invalid");
        joinError.textContent = "";
    });
    document.getElementById("chat-join-form").addEventListener("submit", event => {
        event.preventDefault();
        if (joining) {
            leaveChat();
            return;
        }
        const name = nameInput.value.trim().replace(/\s+/g, " ");
        if (!name || name.length > 20 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)) {
            joinError.textContent = "Choose a name between 1 and 20 characters.";
            nameInput.setAttribute("aria-invalid", "true");
            nameInput.focus({ preventScroll: true });
            return;
        }
        if (typeof io !== "function") {
            joinError.textContent = "Chat is unavailable. Please refresh and try again.";
            return;
        }
        requestedName = name;
        nameInput.value = name;
        setJoining(true);
        joinError.textContent = "Connecting...";
        const client = getSocket();
        if (client.connected) joinChat();
        else client.connect();
    });
    document.getElementById("chat-form").addEventListener("submit", event => {
        event.preventDefault();
        const message = messageInput.value.trim();
        if (!joined || !socket?.connected || !message) return;
        socket.emit("message", { msg: message });
        messageInput.value = "";
        messageInput.focus({ preventScroll: true });
    });
    document.getElementById("chat-leave").addEventListener("click", () => leaveChat());
    function focusChat() {
        if (location.hash === "#chat") (joined ? messageInput : nameInput).focus({ preventScroll: true });
    }
    window.addEventListener("hashchange", focusChat);
    focusChat();
})();
