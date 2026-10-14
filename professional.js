(() => {
    const root = document.documentElement;
    let enabled = true;
    // Restore the saved preference; new visitors start in professional mode.
    try {
        enabled = localStorage.getItem("professional-mode") !== "off";
    } catch {}
    // Set the theme before the page renders to avoid a flash of the old style.
    root.dataset.professional = String(enabled);

    document.addEventListener("DOMContentLoaded", () => {
        // Keep the accessible switch state in sync with the active theme.
        const toggle = document.getElementById("professional-mode");
        toggle.setAttribute("aria-checked", String(enabled));
        toggle.addEventListener("click", () => {
            enabled = !enabled;
            root.dataset.professional = String(enabled);
            toggle.setAttribute("aria-checked", String(enabled));
            // Storage can be blocked; the toggle still works for this visit.
            try {
                localStorage.setItem("professional-mode", enabled ? "on" : "off");
            } catch {}
        });

        const sections = document.querySelectorAll(".games-section");
        // Reveal sections on entry and reset them when they leave the viewport.
        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    entry.target.classList.toggle("is-visible", entry.isIntersecting);
                }
            }, { rootMargin: "-30px 0px", threshold: 0 });
            // Games enter from the left; each following section swaps sides.
            sections.forEach((section, index) => {
                section.style.setProperty("--entrance-x", index % 2 ? "80px" : "-80px");
                observer.observe(section);
            });
            // Only hide offscreen content once an observer can reveal it again.
            root.classList.add("reveal-ready");
        }

        // Skip the cursor effect on touch-only devices.
        const pointer = matchMedia("(hover: hover) and (pointer: fine)");
        let frame = 0;
        let x = 0;
        let y = 0;
        window.addEventListener("pointermove", event => {
            if (!enabled || !pointer.matches) return;
            // Viewport coordinates line up with the fixed dot layer in CSS.
            x = event.clientX;
            y = event.clientY;
            // Combine rapid pointer events into one update per animation frame.
            if (frame) return;
            frame = requestAnimationFrame(() => {
                // Move the circular mask that reveals blue copies of the gray dots.
                root.style.setProperty("--pointer-x", `${x}px`);
                root.style.setProperty("--pointer-y", `${y}px`);
                root.classList.add("pointer-active");
                frame = 0;
            });
        }, { passive: true });
        // Fade out the highlight when the cursor or focus leaves the page.
        document.addEventListener("pointerleave", () => root.classList.remove("pointer-active"));
        window.addEventListener("blur", () => root.classList.remove("pointer-active"));
    });
})();
