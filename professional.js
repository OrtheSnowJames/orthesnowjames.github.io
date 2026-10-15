(() => {
    const root = document.documentElement;
    // keep the highlight offscreen until the mouse moves
    root.style.setProperty("--mouse-position", "-500px -500px");
    let enabled = true;
    // restore the saved preference and start new visitors in professional mode
    try {
        enabled = localStorage.getItem("professional-mode") !== "off";
    } catch {}
    // set the theme before the page renders to avoid a flash of the old style
    root.dataset.professional = String(enabled);

    document.addEventListener("DOMContentLoaded", () => {
        // keep the accessible switch state in sync with the active theme
        const toggle = document.getElementById("professional-mode");
        toggle.setAttribute("aria-checked", String(enabled));
        toggle.addEventListener("click", () => {
            enabled = !enabled;
            root.dataset.professional = String(enabled);
            toggle.setAttribute("aria-checked", String(enabled));
            // storage can be blocked but the toggle still works for this visit
            try {
                localStorage.setItem("professional-mode", enabled ? "on" : "off");
            } catch {}
        });

        const sections = document.querySelectorAll(".games-section");
        // reveal sections on entry and reset them when they leave the viewport
        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    entry.target.classList.toggle("is-visible", entry.isIntersecting);
                }
            }, { rootMargin: "-30px 0px", threshold: 0 });
            // games enter from the left and each following section swaps sides
            sections.forEach((section, index) => {
                section.style.setProperty("--entrance-x", index % 2 ? "80px" : "-80px");
                observer.observe(section);
            });
            // only hide offscreen content once an observer can reveal it again
            root.classList.add("reveal-ready");
        }

        // skip the cursor effect on touch only devices
        const pointer = matchMedia("(hover: hover) and (pointer: fine)");
        let frame = 0;
        let x = 0;
        let y = 0;
        window.addEventListener("pointermove", event => {
            if (!enabled || !pointer.matches) return;
            // viewport coordinates line up with the fixed dot layer in css
            x = event.clientX;
            y = event.clientY;
            // combine rapid pointer events into one update per animation frame
            if (frame) return;
            frame = requestAnimationFrame(() => {
                // move the circular mask that reveals blue copies of the gray dots
                root.style.setProperty("--mouse-position", `${x}px ${y}px`);
                root.classList.add("pointer-active");
                frame = 0;
            });
        }, { passive: true });
        // fade out the highlight when the cursor or focus leaves the page
        document.addEventListener("pointerleave", () => root.classList.remove("pointer-active"));
        window.addEventListener("blur", () => root.classList.remove("pointer-active"));
    });
})();
