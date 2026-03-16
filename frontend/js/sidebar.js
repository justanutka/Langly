async function loadSidebar() {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    const res = await fetch("components/sidebar.html");
    const html = await res.text();

    container.innerHTML = html;

    initSidebar();
    initNewFolderButton();
    initSidebarToggle();
}

/* SIDEBAR TOGGLE */
function initSidebar() {
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");

    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });
}

/* NEW FOLDER BUTTON */
function initNewFolderButton() {
    const newFolderBtn = document.getElementById("add-folder-btn");

    if (!newFolderBtn) return;

    newFolderBtn.addEventListener("click", (e) => {
        e.preventDefault();

        if (window.location.pathname.includes("my-words.html")) {
            const modal = document.getElementById("folder-modal");
            if (modal) {
                modal.style.display = "flex";
            }
        } else {
            window.location.href = "my-words.html?create=true";
        }
    });
}