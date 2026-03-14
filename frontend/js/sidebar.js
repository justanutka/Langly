async function loadSidebar() {

    const container = document.getElementById("sidebar-container");
    if (!container) return;

    const res = await fetch("components/sidebar.html");
    const html = await res.text();

    container.innerHTML = html;

    initSidebar();

}


function initSidebar() {

    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");

    if (!toggle || !sidebar) return;

    toggle.onclick = () => {

        sidebar.classList.toggle("collapsed");

    };

}
