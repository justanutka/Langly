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
    const nextBtn = document.getElementById("next-btn");
    const prevBtn = document.getElementById("prev-btn");

    card.addEventListener("click", () => {
        flipCard();
    });

    nextBtn.addEventListener("click", () => {
        showNextCard();
    });

    prevBtn.addEventListener("click", () => {
        showPrevCard();
    });

    document.addEventListener("keydown", (event) => {
        const activeElement = document.activeElement;
        const isTyping =
            activeElement &&
            (
                activeElement.tagName === "INPUT" ||
                activeElement.tagName === "TEXTAREA" ||
                activeElement.isContentEditable
            );

        if (isTyping) return;

        if (event.key === "ArrowRight") {
            event.preventDefault();
            showNextCard();
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            showPrevCard();
            return;
        }

        if (event.key === "Enter" || event.code === "Space") {
            event.preventDefault();
            flipCard();
        }
    });
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

function showNextCard() {
    currentIndex = (currentIndex + 1) % words.length;
    updateCard();
}

function showPrevCard() {
    currentIndex = (currentIndex - 1 + words.length) % words.length;
    updateCard();
}

function flipCard() {
    const card = document.getElementById("flashcard");

    card.classList.toggle("flipped");

    if (card.classList.contains("flipped")) {
        viewedCards.add(words[currentIndex].id);
        updateProgress();
    }
}

function updateProgress() {
    const progressElement = document.getElementById("progress");
    const progressFill = document.getElementById("progress-fill");

    progressElement.innerText = `${viewedCards.size} / ${words.length}`;

    if (progressFill) {
        const progressPercent = words.length > 0
            ? (viewedCards.size / words.length) * 100
            : 0;

        progressFill.style.width = `${progressPercent}%`;
    }
}

function goBack() {
    const folderId = sessionStorage.getItem("langlyCurrentFolderId");

    if (folderId) {
        window.location.href = `my-words.html?folder=${folderId}`;
    } else {
        window.location.href = "my-words.html";
    }
}