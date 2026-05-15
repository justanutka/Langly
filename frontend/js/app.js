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

(function initLanglySpeech() {
    const speechApi = window.speechSynthesis;
    const supported = typeof window !== "undefined" && !!speechApi && typeof SpeechSynthesisUtterance !== "undefined";
    let voicesReadyPromise = null;

    function normalizeLanguageCode(code) {
        return String(code || "")
            .trim()
            .replace(/_/g, "-")
            .toLowerCase();
    }

    function getVoices() {
        return supported ? speechApi.getVoices() : [];
    }

    function ensureVoicesReady() {
        if (!supported) return Promise.resolve([]);
        const existingVoices = getVoices();
        if (existingVoices.length) return Promise.resolve(existingVoices);
        if (voicesReadyPromise) return voicesReadyPromise;

        voicesReadyPromise = new Promise((resolve) => {
            let settled = false;

            const finish = () => {
                if (settled) return;
                settled = true;
                speechApi.removeEventListener("voiceschanged", handleVoicesChanged);
                resolve(getVoices());
            };

            const handleVoicesChanged = () => finish();

            speechApi.addEventListener("voiceschanged", handleVoicesChanged);
            setTimeout(finish, 1200);
        });

        return voicesReadyPromise;
    }

    function findMatchingVoice(languageCode, voices) {
        const normalizedCode = normalizeLanguageCode(languageCode);
        if (!normalizedCode || !Array.isArray(voices) || !voices.length) return null;

        const exactMatch = voices.find((voice) => normalizeLanguageCode(voice.lang) === normalizedCode);
        if (exactMatch) return exactMatch;

        const prefixMatch = voices.find((voice) => normalizeLanguageCode(voice.lang).startsWith(`${normalizedCode}-`));
        if (prefixMatch) return prefixMatch;

        const shortCode = normalizedCode.split("-")[0];
        return voices.find((voice) => normalizeLanguageCode(voice.lang).split("-")[0] === shortCode) || null;
    }

    async function speakOnce({ text, languageCode }) {
        const trimmedText = String(text || "").trim();

        if (!supported || !trimmedText) {
            return false;
        }

        const voices = await ensureVoicesReady();
        const utterance = new SpeechSynthesisUtterance(trimmedText);
        const normalizedCode = normalizeLanguageCode(languageCode);
        const matchedVoice = findMatchingVoice(normalizedCode, voices);

        if (normalizedCode) {
            utterance.lang = normalizedCode;
        }

        if (matchedVoice) {
            utterance.voice = matchedVoice;
            utterance.lang = matchedVoice.lang;
        }

        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        return new Promise((resolve) => {
            let finished = false;

            const finalize = (success) => {
                if (finished) return;
                finished = true;
                resolve(success);
            };

            utterance.addEventListener("end", () => finalize(true), { once: true });
            utterance.addEventListener("error", () => finalize(false), { once: true });

            speechApi.cancel();

            try {
                speechApi.speak(utterance);
            } catch (error) {
                console.error("Speech playback error:", error);
                finalize(false);
            }
        });
    }

    function createButton({ text, languageCode, label = "Play pronunciation", className = "" }) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = ["speak-btn", className].filter(Boolean).join(" ");
        button.setAttribute("aria-label", label);
        button.setAttribute("title", supported ? label : "Speech is not supported in this browser");
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M11 5 6.7 8.5H3.5a1.5 1.5 0 0 0-1.5 1.5v4a1.5 1.5 0 0 0 1.5 1.5h3.2L11 19c.9.7 2.2.1 2.2-1.1V6.1C13.2 4.9 11.9 4.3 11 5Z" fill="currentColor"></path>
                <path d="M16 9.2a1 1 0 0 1 1.4.1 4.2 4.2 0 0 1 0 5.4 1 1 0 1 1-1.5-1.3 2.2 2.2 0 0 0 0-2.8 1 1 0 0 1 .1-1.4Z" fill="currentColor"></path>
                <path d="M18.8 6.5a1 1 0 0 1 1.4.1 8.1 8.1 0 0 1 0 10.8 1 1 0 0 1-1.5-1.3 6.1 6.1 0 0 0 0-8.2 1 1 0 0 1 .1-1.4Z" fill="currentColor"></path>
            </svg>
        `;

        if (!supported || !String(text || "").trim()) {
            button.disabled = true;
            return button;
        }

        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (button.classList.contains("is-speaking")) {
                return;
            }

            button.classList.add("is-speaking");
            button.disabled = true;

            try {
                await speakOnce({ text, languageCode });
            } finally {
                window.setTimeout(() => {
                    button.disabled = false;
                    button.classList.remove("is-speaking");
                }, 120);
            }
        });

        return button;
    }

    window.langlySpeech = {
        isSupported: () => supported,
        normalizeLanguageCode,
        speakOnce,
        createButton
    };
})();
