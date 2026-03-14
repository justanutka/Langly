const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {

    if (!document.getElementById("welcome-container")) {
        return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    await checkLanguageSelected();
    await loadUserEmail();
    await loadFolders();
    await loadFullDashboard();

    initSidebarToggle();

    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {

            localStorage.removeItem("token");
            window.location.href = "index.html";

        });
    }

});


async function checkLanguageSelected() {

    const token = localStorage.getItem("token");

    try {

        const res = await fetch(BASE_URL + "/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Unauthorized");

        const user = await res.json();

        if (!user.active_language_id) {
            window.location.href = "choose-language.html";
        }

    } catch (error) {

        localStorage.removeItem("token");
        window.location.href = "login.html";

    }

}


async function loadUserEmail() {

    const token = localStorage.getItem("token");

    try {

        const res = await fetch(BASE_URL + "/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        const emailElement = document.getElementById("user-email");

        if (emailElement) {
            emailElement.textContent = data.email;
        }

    } catch (error) {

        localStorage.removeItem("token");
        window.location.href = "login.html";

    }

}


async function loadFullDashboard() {

    const token = localStorage.getItem("token");

    try {

        const [dashboardRes, statsRes, wordsRes] = await Promise.all([

            fetch(BASE_URL + "/study/dashboard", {
                headers: { "Authorization": `Bearer ${token}` }
            }),

            fetch(BASE_URL + "/study/stats", {
                headers: { "Authorization": `Bearer ${token}` }
            }),

            fetch(BASE_URL + "/study/daily-words-online", {
                headers: { "Authorization": `Bearer ${token}` }
            })

        ]);

        if (!dashboardRes.ok || !statsRes.ok || !wordsRes.ok) {
            throw new Error("API error");
        }

        const dashboard = await dashboardRes.json();
        const stats = await statsRes.json();
        const words = await wordsRes.json();

        renderWelcome(dashboard, stats);
        renderStats(stats);
        renderTodayWords(words);

    } catch (error) {

        console.error("Dashboard load error:", error);

    }

}


function renderWelcome(dashboard, stats) {

    const container = document.getElementById("welcome-container");
    if (!container) return;

    const xpNeededTotal = stats.xp_to_next_level + dashboard.xp;

    let percent = xpNeededTotal > 0
        ? (dashboard.xp / xpNeededTotal) * 100
        : 0;

    container.innerHTML = `
        <div class="welcome-card">

            <h1 style="color:#4C5BFF;">Welcome back 👋</h1>

            <div class="level-row">
                Level ${dashboard.level} • 
                XP ${dashboard.xp} / ${xpNeededTotal} • 
                🔥 Streak ${dashboard.streak}
            </div>

            <div class="progress-bar">
                <div class="progress-fill" style="width:${percent}%"></div>
            </div>

        </div>
    `;
}


function renderStats(stats) {

    const container = document.getElementById("stats-container");
    if (!container) return;

    container.innerHTML = `
        <div class="stats-grid">

            <div class="stat-card">
                <div class="stat-title">Words learned</div>
                <div class="stat-value">${stats.mastered_words}</div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Due today</div>
                <div class="stat-value">${stats.due_today}</div>
            </div>

            <div class="stat-card">
                <div class="stat-title">Progress</div>
                <div class="stat-value">${stats.progress_percent}%</div>
            </div>

        </div>
    `;
}


function renderTodayWords(words) {

    const container = document.getElementById("today-words-container");
    if (!container) return;

    let wordsHTML = `
        <div class="words-card">
            <h3>Today's words</h3>
    `;

    if (!words || words.length === 0) {

        wordsHTML += `
            <div class="empty-state">
                🌍 No words available today.
            </div>
        `;

    } else {

        words.forEach(word => {

            wordsHTML += `
                <div class="word-item">
                    <span>${word.word} — ${word.translation}</span>
                </div>
            `;

        });

    }

    wordsHTML += `</div>`;

    container.innerHTML = wordsHTML;

}


async function loadFolders() {

    const token = localStorage.getItem("token");
    const container = document.getElementById("folders-container");

    if (!container) return;

    try {

        const res = await fetch(BASE_URL + "/folders", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!res.ok) return;

        const folders = await res.json();

        const recentFolders = folders.slice(-4).reverse();

        container.innerHTML = "";

        recentFolders.forEach(folder => {

            container.innerHTML += `
                <div class="folder-item">
                    <span class="icon">📁</span>
                    <span class="folder-name">${folder.name}</span>
                </div>
            `;

        });

    } catch (error) {

        console.error("Folders load error:", error);

    }

}


function initSidebarToggle() {

    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");

    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", () => {

        sidebar.classList.toggle("collapsed");

    });

}
