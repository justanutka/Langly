const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("module");
    const moduleName =
        params.get("name") ||
        sessionStorage.getItem("langlyCurrentModuleTitle") ||
        "Lesson";

    const moduleTitle = document.getElementById("lesson-module-title");
    const cardsLink = document.getElementById("lesson-cards-link");
    const quizLink = document.getElementById("lesson-quiz-link");
    const startQuizBtn = document.getElementById("lesson-start-quiz-btn");
    const logo = document.getElementById("logo");
    const logoutBtn = document.getElementById("logout-btn");
    const backBtn = document.getElementById("lesson-back-btn");

    const stepLabel = document.getElementById("lesson-step-label");
    const wordCount = document.getElementById("lesson-word-count");
    const progressFill = document.getElementById("lesson-progress-fill");
    const stage = document.getElementById("lesson-stage");

    const introView = document.getElementById("lesson-intro-view");
    const previewView = document.getElementById("lesson-preview-view");
    const cardsView = document.getElementById("lesson-cards-view");
    const practiceView = document.getElementById("lesson-practice-view");
    const resultView = document.getElementById("lesson-result-view");
    const emptyView = document.getElementById("lesson-empty-view");
    const views = [introView, previewView, cardsView, practiceView, resultView, emptyView].filter(Boolean);

    const previewList = document.getElementById("lesson-preview-list");
    const startBtn = document.getElementById("lesson-start-btn");
    const previewNextBtn = document.getElementById("lesson-preview-next");

    const cardCounter = document.getElementById("lesson-card-counter");
    const flipCard = document.getElementById("lesson-flip-card");
    const cardFrontWord = document.getElementById("lesson-card-front-word");
    const cardBackWord = document.getElementById("lesson-card-back-word");
    const cardPrevBtn = document.getElementById("lesson-card-prev");
    const cardNextBtn = document.getElementById("lesson-card-next");

    const questionCounter = document.getElementById("lesson-question-counter");
    const questionContainer = document.getElementById("lesson-question-container");

    const resultSummary = document.getElementById("lesson-result-summary");
    const resultScore = document.getElementById("lesson-result-score");
    const resultTotal = document.getElementById("lesson-result-total");
    const resultPercent = document.getElementById("lesson-result-percent");
    const repeatBtn = document.getElementById("lesson-repeat-btn");

    let moduleWords = [];
    let practiceQuestions = [];
    let currentStep = "intro";
    let currentCardIndex = 0;
    let currentQuestionIndex = 0;
    let score = 0;
    let viewedCardIds = new Set();
    let savedAttempt = false;
    let currentCardFlipped = false;

    if (moduleTitle) {
        moduleTitle.textContent = moduleName;
    }

    if (typeof loadSidebar === "function") {
        await loadSidebar();
    }

    await window.langlyUiText?.init?.();
    window.langlyUiText?.apply(document);
    if (moduleTitle) {
        moduleTitle.textContent = moduleName;
    }

    function lt(key, params, fallback) {
        const value = window.langlyUiText?.t(key, params);
        return value && value !== key ? value : fallback || key;
    }

    if (cardsLink && moduleId) {
        cardsLink.href = `flashcards.html?module=${moduleId}&name=${encodeURIComponent(moduleName)}`;
    }

    if (quizLink && moduleId) {
        quizLink.href = `quiz.html?module=${moduleId}&name=${encodeURIComponent(moduleName)}`;
    }

    if (startQuizBtn && moduleId) {
        startQuizBtn.href = `quiz.html?module=${moduleId}&name=${encodeURIComponent(moduleName)}`;
    }

    function escapeHtml(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(text) {
        return String(text || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }

    function shuffle(items) {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function sample(items, count) {
        return shuffle(items).slice(0, count);
    }

    function setView(name) {
        currentStep = name;

        const activeId = `lesson-${name}-view`;
        views.forEach((view) => {
            view.classList.toggle("lesson-card--active", view.id === activeId);
        });

        const stepMap = {
            intro: { label: "1 / 4", progress: 10 },
            preview: { label: "2 / 4", progress: 35 },
            cards: { label: "3 / 4", progress: 60 },
            practice: { label: "4 / 4", progress: 82 },
            result: { label: lt("lesson.done", null, "Done"), progress: 100 },
            empty: { label: "-", progress: 0 }
        };

        const meta = stepMap[name] || stepMap.intro;
        if (stepLabel) stepLabel.textContent = meta.label;
        if (progressFill) progressFill.style.width = `${meta.progress}%`;

        window.requestAnimationFrame(() => {
            const top = stage?.getBoundingClientRect().top || 0;
            if (top < 80) {
                window.scrollTo({ top: Math.max(0, window.scrollY + top - 90), behavior: "auto" });
            }
        });
    }

    function buildPreview() {
        if (!previewList) return;

        previewList.innerHTML = moduleWords.map((item) => `
            <div class="lesson-preview-item">
                <div class="lesson-preview-word">${escapeHtml(item.word)}</div>
                <div class="lesson-preview-translation">${escapeHtml(item.translation)}</div>
            </div>
        `).join("");
    }

    function renderCard() {
        const word = moduleWords[currentCardIndex];
        if (!word || !flipCard || !cardFrontWord || !cardBackWord || !cardCounter) return;

        currentCardFlipped = false;
        flipCard.classList.remove("is-flipped", "is-changing-next", "is-changing-prev");
        cardFrontWord.textContent = word.word;
        cardBackWord.textContent = word.translation;
        cardCounter.textContent = lt(
            "lesson.card_counter",
            { current: currentCardIndex + 1, total: moduleWords.length },
            `Card ${currentCardIndex + 1} / ${moduleWords.length}`
        );

        if (cardNextBtn) {
            cardNextBtn.textContent = currentCardIndex === moduleWords.length - 1
                ? lt("lesson.start_practice", null, "Start practice")
                : lt("cards.next", null, "Next");
        }
    }

    function animateCardChange(direction) {
        if (!flipCard) return;

        const className = direction === "prev" ? "is-changing-prev" : "is-changing-next";
        flipCard.classList.remove("is-changing-next", "is-changing-prev");
        void flipCard.offsetWidth;
        flipCard.classList.add(className);

        window.setTimeout(() => {
            flipCard?.classList.remove(className);
        }, 300);
    }

    function flipLessonCard() {
        const word = moduleWords[currentCardIndex];
        if (!word || !flipCard) return;

        currentCardFlipped = !currentCardFlipped;
        flipCard.classList.toggle("is-flipped", currentCardFlipped);

        if (currentCardFlipped) {
            viewedCardIds.add(word.id);
        }
    }

    function buildPracticeQuestions() {
        const count = Math.min(5, moduleWords.length);
        const baseWords = sample(moduleWords, count);

        if (moduleWords.length < 2) {
            return baseWords.map((word) => ({
                type: "write",
                word,
                correctAnswer: word.translation
            }));
        }

        return baseWords.map((word, index) => {
            if (index % 3 === 1) {
                return {
                    type: "write",
                    word,
                    correctAnswer: word.translation
                };
            }

            const wrongOptions = shuffle(
                moduleWords
                    .filter((candidate) => candidate.id !== word.id)
                    .map((candidate) => candidate.translation)
            ).slice(0, 3);

            return {
                type: "multiple",
                word,
                options: shuffle([word.translation, ...wrongOptions]),
                correctAnswer: word.translation
            };
        });
    }

    function renderQuestion() {
        const question = practiceQuestions[currentQuestionIndex];
        if (!question || !questionContainer || !questionCounter) {
            showResult();
            return;
        }

        questionCounter.textContent = lt(
            "lesson.question_counter",
            { current: currentQuestionIndex + 1, total: practiceQuestions.length },
            `Question ${currentQuestionIndex + 1} / ${practiceQuestions.length}`
        );

        if (question.type === "write") {
            renderWriteQuestion(question);
            return;
        }

        renderMultipleQuestion(question);
    }

    function renderMultipleQuestion(question) {
        questionContainer.innerHTML = `
            <h3 class="lesson-question-title">${escapeHtml(question.word.word)}</h3>
            <p class="lesson-question-subtitle">${lt("quiz.choose_translation", null, "Choose the correct translation.")}</p>
            <div class="lesson-answer-grid">
                ${question.options.map((option) => `
                    <button class="lesson-answer-btn" type="button" data-answer="${escapeHtml(option)}">
                        ${escapeHtml(option)}
                    </button>
                `).join("")}
            </div>
        `;

        questionContainer.querySelectorAll(".lesson-answer-btn").forEach((button) => {
            button.addEventListener("click", () => {
                const selected = button.dataset.answer || "";
                const isCorrect = normalizeText(selected) === normalizeText(question.correctAnswer);

                questionContainer.querySelectorAll(".lesson-answer-btn").forEach((candidate) => {
                    candidate.classList.add("disabled");

                    if (normalizeText(candidate.dataset.answer) === normalizeText(question.correctAnswer)) {
                        candidate.classList.add("correct");
                    }
                });

                if (isCorrect) {
                    score++;
                } else {
                    button.classList.add("wrong");
                }

                addNextQuestionButton(isCorrect, question.correctAnswer);
            }, { once: true });
        });
    }

    function renderWriteQuestion(question) {
        questionContainer.innerHTML = `
            <h3 class="lesson-question-title">${escapeHtml(question.word.word)}</h3>
            <p class="lesson-question-subtitle">${lt("lesson.type_translation", null, "Type the correct translation.")}</p>
            <div class="lesson-write-box">
                <input id="lesson-write-input" class="lesson-write-input" type="text" placeholder="${lt("lesson.type_placeholder", null, "Type translation...")}">
                <button id="lesson-check-btn" class="lesson-primary-btn" type="button">${lt("lesson.check_answer", null, "Check answer")}</button>
            </div>
        `;

        const input = document.getElementById("lesson-write-input");
        const checkBtn = document.getElementById("lesson-check-btn");

        function submit() {
            if (!input || !checkBtn || checkBtn.disabled) return;

            const answer = input.value.trim();
            if (!answer) return;

            const isCorrect = normalizeText(answer) === normalizeText(question.correctAnswer);
            if (isCorrect) {
                score++;
            }

            input.disabled = true;
            checkBtn.disabled = true;
            addNextQuestionButton(isCorrect, question.correctAnswer);
        }

        checkBtn?.addEventListener("click", submit);
        input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submit();
            }
        });
        input?.focus();
    }

    function addNextQuestionButton(isCorrect, correctAnswer) {
        const feedback = document.createElement("div");
        feedback.className = `lesson-feedback ${isCorrect ? "correct" : "wrong"}`;
        feedback.innerHTML = isCorrect
            ? lt("lesson.correct", null, "Correct.")
            : lt("lesson.correct_answer", { answer: `<strong>${escapeHtml(correctAnswer)}</strong>` }, `Correct answer: <strong>${escapeHtml(correctAnswer)}</strong>`);

        const actions = document.createElement("div");
        actions.className = "lesson-actions";
        actions.innerHTML = `<button class="lesson-primary-btn" type="button">${lt("cards.next", null, "Next")}</button>`;

        questionContainer.appendChild(feedback);
        questionContainer.appendChild(actions);

        actions.querySelector("button")?.addEventListener("click", () => {
            currentQuestionIndex++;

            if (currentQuestionIndex >= practiceQuestions.length) {
                showResult();
                return;
            }

            renderQuestion();
        }, { once: true });
    }

    function resetLesson() {
        currentCardIndex = 0;
        currentQuestionIndex = 0;
        score = 0;
        viewedCardIds = new Set();
        savedAttempt = false;
        practiceQuestions = buildPracticeQuestions();
        renderCard();
        setView("intro");
    }

    function startPractice() {
        currentQuestionIndex = 0;
        score = 0;
        practiceQuestions = buildPracticeQuestions();
        renderQuestion();
        setView("practice");
    }

    async function saveLessonAttempt() {
        if (savedAttempt || !moduleId) return null;

        savedAttempt = true;

        try {
            const res = await fetch(`${BASE_URL}/lessons/attempt`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    module_id: Number(moduleId),
                    score,
                    total_tasks: practiceQuestions.length,
                    words_reviewed: Math.max(viewedCardIds.size, moduleWords.length)
                })
            });

            if (!res.ok) {
                savedAttempt = false;
                return null;
            }

            return await res.json();
        } catch (error) {
            console.error("Lesson save error:", error);
            savedAttempt = false;
            return null;
        }
    }

    function showResult() {
        const total = practiceQuestions.length;
        const percent = total ? Math.round((score / total) * 100) : 0;

        if (resultScore) resultScore.textContent = String(score);
        if (resultTotal) resultTotal.textContent = String(total);
        if (resultPercent) resultPercent.textContent = `${percent}%`;
        if (resultSummary) {
            resultSummary.textContent = lt(
                "lesson.summary",
                { words: moduleWords.length, score, total },
                `You reviewed ${moduleWords.length} word(s) and answered ${score} out of ${total} task(s) correctly.`
            );
        }

        setView("result");

        saveLessonAttempt().then((data) => {
            if (!data || !resultSummary || currentStep !== "result") return;
            resultSummary.textContent = lt(
                "lesson.summary_xp",
                { words: moduleWords.length, score, total, xp: data.xp_earned || 0 },
                `You reviewed ${moduleWords.length} word(s), answered ${score} out of ${total} task(s) correctly, and earned ${data.xp_earned || 0} XP.`
            );
        });
    }

    async function loadWords() {
        if (!moduleId) {
            setView("empty");
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/words/module/${moduleId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) {
                setView("empty");
                return;
            }

            moduleWords = await res.json();
            if (wordCount) wordCount.textContent = String(moduleWords.length);

            if (!Array.isArray(moduleWords) || moduleWords.length === 0) {
                setView("empty");
                return;
            }

            buildPreview();
            resetLesson();
        } catch (error) {
            console.error("Lesson load error:", error);
            setView("empty");
        }
    }

    function goBack() {
        const folderId = sessionStorage.getItem("langlyCurrentFolderId");
        document.body?.classList.add("page-transitioning");

        window.setTimeout(() => {
            if (folderId) {
                window.location.href = `my-words.html?folder=${folderId}`;
            } else {
                window.location.href = "my-words.html";
            }
        }, 120);
    }

    logo?.addEventListener("click", () => {
        document.body?.classList.add("page-transitioning");
        window.setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 120);
    });

    logoutBtn?.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });

    backBtn?.addEventListener("click", goBack);

    startBtn?.addEventListener("click", () => {
        setView("preview");
    });

    previewNextBtn?.addEventListener("click", () => {
        renderCard();
        setView("cards");
    });

    flipCard?.addEventListener("click", flipLessonCard);

    cardPrevBtn?.addEventListener("click", () => {
        currentCardIndex = (currentCardIndex - 1 + moduleWords.length) % moduleWords.length;
        renderCard();
        animateCardChange("prev");
    });

    cardNextBtn?.addEventListener("click", () => {
        if (currentCardIndex >= moduleWords.length - 1) {
            startPractice();
            return;
        }

        currentCardIndex++;
        renderCard();
        animateCardChange("next");
    });

    repeatBtn?.addEventListener("click", resetLesson);

    document.addEventListener("keydown", (event) => {
        const active = document.activeElement;
        const isTyping = active && (
            active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable
        );

        if (isTyping || currentStep !== "cards") return;

        if (event.key === "Enter" || event.code === "Space") {
            event.preventDefault();
            flipLessonCard();
        }
    });

    await loadWords();
});
