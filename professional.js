(() => {
    const root = document.documentElement;
    let enabled = true;
    try {
        enabled = localStorage.getItem("professional-mode") !== "off";
    } catch {}
    root.dataset.professional = String(enabled);

    document.addEventListener("DOMContentLoaded", () => {
        const toggle = document.getElementById("professional-mode");
        toggle.setAttribute("aria-checked", String(enabled));
        toggle.addEventListener("click", () => {
            enabled = !enabled;
            root.dataset.professional = String(enabled);
            toggle.setAttribute("aria-checked", String(enabled));
            try {
                localStorage.setItem("professional-mode", enabled ? "on" : "off");
            } catch {}
        });

        const sections = document.querySelectorAll(".games-section");
        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    entry.target.classList.toggle("is-visible", entry.isIntersecting);
                }
            }, { rootMargin: "-30px 0px", threshold: 0 });
            sections.forEach((section, index) => {
                section.style.setProperty("--entrance-x", index % 2 ? "80px" : "-80px");
                observer.observe(section);
            });
            root.classList.add("reveal-ready");
        }

        const pointer = matchMedia("(hover: hover) and (pointer: fine)");
        let frame = 0;
        let x = 0;
        let y = 0;
        window.addEventListener("pointermove", event => {
            if (!enabled || !pointer.matches) return;
            x = event.clientX;
            y = event.clientY;
            if (frame) return;
            frame = requestAnimationFrame(() => {
                root.style.setProperty("--pointer-x", `${x}px`);
                root.style.setProperty("--pointer-y", `${y}px`);
                root.classList.add("pointer-active");
                frame = 0;
            });
        }, { passive: true });
        document.addEventListener("pointerleave", () => root.classList.remove("pointer-active"));
        window.addEventListener("blur", () => root.classList.remove("pointer-active"));
    });
})();
