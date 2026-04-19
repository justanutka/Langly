const BASE_URL = "http://127.0.0.1:8000";

let words = [];
let currentIndex = 0;
let viewedCards = new Set();

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    if (typeof loadSidebar === "function") {
        await loadSidebar();
    }

    const logo = document.getElementById("logo");
    if (logo) {
        logo.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            window.location.href = "index.html";
        });
    }

    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("module");
    const moduleNameFromUrl = params.get("name");

    if (!moduleId) {
        alert("No module selected");
        return;
    }

    const userRes = await fetch(BASE_URL + "/users/me", {
        headers: { Authorization: `Bearer ${token}` }
    });
    const user = await userRes.json();

    const res = await fetch(
        `${BASE_URL}/words/?language_id=${user.active_language_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await res.json();

    words = data.filter(w => w.module_id == moduleId);

    if (words.length === 0) {
        alert("No words in this module");
        return;
    }

    let moduleName = moduleNameFromUrl;

    if (!moduleName) {
        moduleName = sessionStorage.getItem("langlyCurrentModuleTitle");
    }

    document.getElementById("module-name").innerText =
        moduleName || "Module";

    renderCard();

    const card = document.getElementById("flashcard");

    card.addEventListener("click", () => {
        card.classList.toggle("flipped");

        if (card.classList.contains("flipped")) {
            viewedCards.add(words[currentIndex].id);
            updateProgress();
        }
    });

    document.getElementById("next-btn").onclick = () => {
        currentIndex = (currentIndex + 1) % words.length;
        updateCard();
    };

    document.getElementById("prev-btn").onclick = () => {
        currentIndex = (currentIndex - 1 + words.length) % words.length;
        updateCard();
    };
});

function renderCard() {
    updateCard();
}

function updateCard() {
    const card = document.getElementById("flashcard");

    card.classList.remove("flipped");

    document.getElementById("word-text").innerText = words[currentIndex].word;
    document.getElementById("translation-text").innerText = words[currentIndex].translation;

    updateProgress();
}

function updateProgress() {
    document.getElementById("progress").innerText =
        `${viewedCards.size} / ${words.length}`;
}

function goBack() {
    const folderId = sessionStorage.getItem("langlyCurrentFolderId");
    window.location.href = `my-words.html?folder=${folderId}`;
}