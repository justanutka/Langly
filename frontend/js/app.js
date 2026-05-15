const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    await loadSidebar();

    const user = await getCurrentUserAndUpdateStreak();

    if (!user) {
        return;
    }

    if (!user.active_language_id) {
        window.location.href = "choose-language.html";
        return;
    }

    renderUserEmail(user);

    const isDashboard = document.getElementById("welcome-container");

    if (isDashboard) {
        await loadFullDashboard();
    }

    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            window.location.href = "index.html";
        });
    }
});


async function getCurrentUserAndUpdateStreak() {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(BASE_URL + "/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error("Unauthorized");
        }

        const user = await res.json();
        return user;

    } catch (error) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return null;
    }
}


function renderUserEmail(user) {
    const emailElement = document.getElementById("user-email");

    if (emailElement) {
        emailElement.textContent = user.email;
    }
}


async function loadFullDashboard() {
    const token = localStorage.getItem("token");

    try {
        const [dashboardRes, statsRes] = await Promise.all([
            fetch(BASE_URL + "/study/dashboard", {
                headers: { "Authorization": `Bearer ${token}` }
            }),

            fetch(BASE_URL + "/study/stats", {
                headers: { "Authorization": `Bearer ${token}` }
            })
        ]);

        if (!dashboardRes.ok || !statsRes.ok) {
            throw new Error("API error");
        }

        const dashboard = await dashboardRes.json();
        const stats = await statsRes.json();

        renderWelcome(dashboard, stats);
        renderStats(stats);

    } catch (error) {
        console.error("Dashboard load error:", error);
    }
}


function renderWelcome(dashboard, stats) {
    const container = document.getElementById("welcome-container");
    if (!container) return;

    const xpNeededTotal = Number(stats?.xp_to_next_level || 0) + Number(dashboard?.xp || 0);
    const percent = xpNeededTotal > 0 ? (Number(dashboard?.xp || 0) / xpNeededTotal) * 100 : 0;

    const dot = "•";
    const fire = "\uD83D\uDD25";

    container.innerHTML = `
        <div class="welcome-card focus-card">
            <div class="focus-kicker">TODAY'S FOCUS</div>
            <div class="focus-main">
                <div class="focus-title">Learn a small set and mark what sticks.</div>
                <div class="focus-meta">
                    Level ${dashboard.level} ${dot}
                    ${dashboard.xp} / ${xpNeededTotal} XP ${dot}
                    ${fire} ${dashboard.streak} day streak
                </div>
                <div class="focus-progress-row">
                    <div class="focus-progress-label">Level progress</div>
                    <div class="focus-progress-percent">${Math.round(percent)}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percent}%"></div>
                </div>
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
            const item = document.createElement("div");
            item.className = "folder-item";

            item.innerHTML = `
                <span class="icon">\uD83D\uDCC1</span>
                <span class="folder-name">${folder.name}</span>
            `;

            item.onclick = () => {
                if (window.location.pathname.includes("my-words.html")) {
                    if (typeof openFolderFromSidebar === "function") {
                        openFolderFromSidebar(folder.id);
                    }
                } else {
                    window.location.href = `my-words.html?folder=${folder.id}`;
                }
            };

            container.appendChild(item);
        });

    } catch (error) {
        console.error("Folders load error:", error);
    }
}
