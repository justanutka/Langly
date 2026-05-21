const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    if (typeof loadSidebar === "function") {
        await loadSidebar();
    }

    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("module");
    const moduleName =
        params.get("name") ||
        sessionStorage.getItem("langlyCurrentModuleTitle") ||
        "Quiz";

    const quizShell = document.querySelector(".quiz-shell");
    const logo = document.getElementById("logo");
    const logoutBtn = document.getElementById("logout-btn");
    const backBtn = document.getElementById("back-btn");

    const startView = document.getElementById("quiz-start-view");
    const playView = document.getElementById("quiz-play-view");
    const resultView = document.getElementById("quiz-result-view");
    const emptyView = document.getElementById("quiz-empty-view");
    const quizViews = [startView, playView, resultView, emptyView].filter(Boolean);

    const moduleTitleEl = document.getElementById("quiz-module-title");
    const wordCountLabel = document.getElementById("word-count-label");
    const countSelect = document.getElementById("quiz-count-select");
    const countSelectSelected = countSelect?.querySelector(".quiz-select-selected");
    const countSelectItems = countSelect?.querySelector(".quiz-select-items");
    const countHint = document.getElementById("quiz-count-hint");

    const progressLabel = document.getElementById("progress-label");
    const scoreLabel = document.getElementById("score-label");
    const progressFill = document.getElementById("progress-fill");
    const questionContainer = document.getElementById("question-container");

    const restartBtn = document.getElementById("restart-btn");
    const changeModeBtn = document.getElementById("change-mode-btn");

    let moduleWords = [];
    let selectedMode = null;
    let selectedQuestionCount = 0;
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let mistakes = [];
    let answersToSave = [];
    let quizSaved = false;
    let earnedXp = 0;
    let isFinishingQuiz = false;
    let currentView = "start";
    let persistentShellMinHeight = "";
    let persistentResultMinHeight = "";
    const RESULT_EMOJI = "\uD83C\uDF89";

    function getResultStorageKey() {
        return `langlyQuizResult_${moduleId}`;
    }

    function getHistoryState(view) {
        return {
            langlyQuizPage: true,
            moduleId: String(moduleId || ""),
            view
        };
    }

    function updateBackButton() {
        if (!backBtn) return;

        if (currentView === "play" || currentView === "result") {
            backBtn.textContent = "← Back to quiz modes";
            return;
        }

        backBtn.textContent = "← Back to module";
    }

    function stabilizeShellHeight(callback, { scrollToTop = false, freezeFrom = null, freezeTo = null } = {}) {
        const previousMinHeight = quizShell?.style.minHeight || "";
        const currentHeight = quizShell?.getBoundingClientRect().height || 0;
        const previousTargetMinHeight = freezeTo?.style.minHeight || "";
        const fromHeight = freezeFrom?.getBoundingClientRect().height || 0;
        const scrollBefore = window.scrollY;
        const shellTopBefore = quizShell?.getBoundingClientRect().top || 0;

        if (quizShell && currentHeight > 0) {
            quizShell.style.minHeight = `${Math.ceil(currentHeight)}px`;
        }

        callback();

        if (freezeTo && fromHeight > 0) {
            freezeTo.style.minHeight = `${Math.ceil(fromHeight)}px`;
        }

        if (scrollToTop && quizShell) {
            const shellTop = quizShell.getBoundingClientRect().top + window.scrollY - 12;
            window.scrollTo({
                top: Math.max(0, shellTop),
                behavior: "auto"
            });
        }

        if (!scrollToTop) {
            window.requestAnimationFrame(() => {
                const shellTopAfter = quizShell?.getBoundingClientRect().top || 0;
                const delta = shellTopAfter - shellTopBefore;
                window.scrollTo({
                    top: Math.max(0, scrollBefore + delta),
                    behavior: "auto"
                });
            });
        }

        window.setTimeout(() => {
            if (quizShell) {
                quizShell.style.minHeight = persistentShellMinHeight || previousMinHeight;
            }
            if (freezeTo) {
                freezeTo.style.minHeight = persistentResultMinHeight || previousTargetMinHeight;
            }
        }, 320);
    }

    function clearPersistentHeightLocks() {
        persistentShellMinHeight = "";
        persistentResultMinHeight = "";

        if (quizShell) {
            quizShell.style.minHeight = "";
        }

        if (playView) {
            playView.style.minHeight = "";
        }

        if (resultView) {
            resultView.style.minHeight = "";
        }
    }

    function showView(viewName, options = {}) {
        if (viewName === "result" && currentView === "play") {
            if (playView) {
                playView.classList.add("quiz-play-view--result");
                playView.setAttribute("aria-hidden", "false");
            }

            currentView = viewName;
            updateBackButton();
            return;
        }

        stabilizeShellHeight(() => {
            const activeViewId = viewName === "result"
                ? "quiz-play-view"
                : `quiz-${viewName}-view`;

            quizViews.forEach((view) => {
                const isActive = view.id === activeViewId;
                view.classList.toggle("quiz-card--active", isActive);
                view.setAttribute("aria-hidden", isActive ? "false" : "true");
            });

            if (playView) {
                playView.classList.toggle("quiz-play-view--result", viewName === "result");
            }

            currentView = viewName;
            updateBackButton();
        }, options);
    }

    function syncHistory(view, mode = "replace") {
        const state = getHistoryState(view);

        if (mode === "push") {
            window.history.pushState(state, "", window.location.href);
            return;
        }

        window.history.replaceState(state, "", window.location.href);
    }

    function saveResultState() {
        const total = questions.length;
        const percent = total ? Math.round((score / total) * 100) : 0;

        sessionStorage.setItem(
            getResultStorageKey(),
            JSON.stringify({
                moduleId,
                moduleName,
                score,
                total,
                percent,
                earnedXp,
                quizSaved,
                mistakes,
                selectedMode,
                selectedQuestionCount
            })
        );
    }

    function clearSavedResultState() {
        sessionStorage.removeItem(getResultStorageKey());
    }

    function resetActiveQuizState() {
        clearPersistentHeightLocks();
        questions = [];
        currentQuestionIndex = 0;
        score = 0;
        mistakes = [];
        answersToSave = [];
        quizSaved = false;
        earnedXp = 0;
        isFinishingQuiz = false;
        playView?.classList.remove("quiz-play-view--result");
        questionContainer.innerHTML = "";
        progressFill.style.transition = "";
        progressFill.style.width = "0%";
        progressLabel.textContent = "Question 0 / 0";
        scoreLabel.textContent = "Score: 0";
    }

    function buildResultSummary(scoreValue, totalValue, saved, xpValue) {
        let summaryText = `You answered ${scoreValue} out of ${totalValue} questions correctly.`;

        if (saved) {
            summaryText += ` You earned ${xpValue || 0} XP.`;
        }

        return summaryText;
    }

    function renderResultContent({
        scoreValue,
        totalValue,
        percentValue,
        mistakesValue = [],
        saved = false,
        xpValue = 0
    }) {
        const summaryText = buildResultSummary(scoreValue, totalValue, saved, xpValue);
        const hasMistakes = Array.isArray(mistakesValue) && mistakesValue.length > 0;
        const mistakesMarkup = hasMistakes
            ? `
                <div class="mistakes-block">
                    <h3>Mistakes</h3>
                    <div class="mistakes-list">
                        ${mistakesValue.map((mistake) => `
                            <div class="mistake-item">
                                <div class="mistake-word">${mistake.word}</div>
                                <div class="mistake-line">Your answer: ${mistake.userAnswer}</div>
                                <div class="mistake-line">Correct answer: ${mistake.correctAnswer}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `
            : "";

        questionContainer.innerHTML = `
            <div class="result-top">
                <div class="result-emoji">${RESULT_EMOJI}</div>
                <h2>Your result</h2>
                <p class="result-summary">${summaryText}</p>
            </div>

            <div class="result-stats">
                <div class="result-stat">
                    <span>Correct</span>
                    <strong>${scoreValue}</strong>
                </div>

                <div class="result-stat">
                    <span>Total</span>
                    <strong>${totalValue}</strong>
                </div>

                <div class="result-stat">
                    <span>Accuracy</span>
                    <strong>${percentValue}%</strong>
                </div>
            </div>

            ${mistakesMarkup}

            <div class="result-actions">
                <button id="quiz-result-restart" class="btn-main" type="button">Try again</button>
                <button id="quiz-result-change-mode" class="btn-secondary" type="button">Choose another mode</button>
            </div>
        `;

        questionContainer.querySelector("#quiz-result-restart")?.addEventListener("click", () => {
            if (isFinishingQuiz || !selectedMode) return;
            clearSavedResultState();
            startQuiz(selectedMode);
        });

        questionContainer.querySelector("#quiz-result-change-mode")?.addEventListener("click", () => {
            if (isFinishingQuiz) return;
            showStartScreen();
        });
    }

    function restoreSavedResultState() {
        const raw = sessionStorage.getItem(getResultStorageKey());
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);

            if (!data || String(data.moduleId) !== String(moduleId)) {
                return false;
            }

            selectedMode = data.selectedMode || selectedMode;

            if (data.selectedQuestionCount) {
                selectedQuestionCount = Number(data.selectedQuestionCount) || selectedQuestionCount;
                initQuestionCountSelect(moduleWords.length);
            }

            renderResultContent({
                scoreValue: data.score,
                totalValue: data.total,
                percentValue: data.percent,
                mistakesValue: Array.isArray(data.mistakes) ? data.mistakes : [],
                saved: Boolean(data.quizSaved),
                xpValue: data.earnedXp || 0
            });

            showView("result", { scrollToTop: false });
            syncHistory("result", "replace");
            return true;
        } catch (error) {
            console.error("Failed to restore quiz result:", error);
            return false;
        }
    }

    function normalizeText(text) {
        return String(text || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }

    function shuffle(array) {
        const arr = [...array];

        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        return arr;
    }

    function sampleWords(words, count) {
        return shuffle(words).slice(0, count);
    }

    function getQuestionCountOptions(wordsLength) {
        if (wordsLength < 2) return [];

        if (wordsLength <= 10) {
            return Array.from({ length: wordsLength - 1 }, (_, index) => index + 2);
        }

        const options = [5, 10, 15, 20, wordsLength];
        return [...new Set(options.filter((value) => value >= 2 && value <= wordsLength))];
    }

    function getDefaultQuestionCount(wordsLength) {
        if (wordsLength < 2) return 0;
        return Math.min(10, wordsLength);
    }

    function updateQuestionCountMeta() {
        if (!countHint) return;

        if (moduleWords.length < 2) {
            countHint.textContent = "";
            return;
        }

        if (moduleWords.length <= 10) {
            countHint.textContent = `This module has ${moduleWords.length} words, so you can choose between 2 and ${moduleWords.length} questions.`;
            return;
        }

        countHint.textContent = `You can choose up to ${moduleWords.length} questions for this module.`;
    }

    function initCustomSelect(dropdown) {
        if (!dropdown) return;

        const selected = dropdown.querySelector(".quiz-select-selected");
        const items = dropdown.querySelector(".quiz-select-items");
        if (!selected || !items) return;

        selected.addEventListener("click", (event) => {
            event.stopPropagation();
            document.querySelectorAll(".quiz-custom-select").forEach((candidate) => {
                if (candidate !== dropdown) {
                    candidate.querySelector(".quiz-select-items")?.classList.add("quiz-select-hide");
                    candidate.querySelector(".quiz-select-selected")?.classList.remove("active");
                }
            });
            items.classList.toggle("quiz-select-hide");
            selected.classList.toggle("active");
        });
    }

    function setCustomSelectOptions({ dropdown, options, value, placeholder, onChange }) {
        if (!dropdown) return;

        const selected = dropdown.querySelector(".quiz-select-selected");
        const items = dropdown.querySelector(".quiz-select-items");
        if (!selected || !items) return;

        const normalizedOptions = Array.isArray(options) ? options : [];
        const current = normalizedOptions.find((option) => String(option.value) === String(value));

        dropdown.dataset.value = current ? String(current.value) : "";
        selected.textContent = current ? current.label : (placeholder || "Select");
        items.innerHTML = "";

        normalizedOptions.forEach((option) => {
            const element = document.createElement("div");
            element.dataset.value = String(option.value);
            element.textContent = option.label;

            if (String(option.value) === String(value)) {
                element.classList.add("selected");
            }

            element.addEventListener("click", (event) => {
                event.stopPropagation();
                dropdown.dataset.value = String(option.value);
                selected.textContent = option.label;
                items.querySelectorAll("div").forEach((candidate) => candidate.classList.remove("selected"));
                element.classList.add("selected");
                items.classList.add("quiz-select-hide");
                selected.classList.remove("active");
                if (typeof onChange === "function") {
                    onChange(String(option.value));
                }
            });

            items.appendChild(element);
        });
    }

    function initQuestionCountSelect(wordsLength) {
        if (!countSelect) return;

        const options = getQuestionCountOptions(wordsLength);

        if (!options.length) {
            selectedQuestionCount = 0;
            if (countSelectSelected) {
                countSelectSelected.textContent = "Select amount";
            }
            if (countSelectItems) {
                countSelectItems.innerHTML = "";
            }
            updateQuestionCountMeta();
            return;
        }

        const preferredCount = selectedQuestionCount || getDefaultQuestionCount(wordsLength);
        selectedQuestionCount = options.includes(preferredCount)
            ? preferredCount
            : options[options.length - 1];

        setCustomSelectOptions({
            dropdown: countSelect,
            options: options.map((value) => ({
                value: String(value),
                label: value === wordsLength ? `All available (${value})` : `${value} questions`
            })),
            value: String(selectedQuestionCount),
            placeholder: "Select amount",
            onChange: (nextValue) => {
                selectedQuestionCount = Number(nextValue) || getDefaultQuestionCount(moduleWords.length);
                updateQuestionCountMeta();
            }
        });

        updateQuestionCountMeta();
    }

    function getCurrentQuestionCount() {
        if (!moduleWords.length) return 0;

        const maxAllowed = moduleWords.length;
        const normalizedCount = Number(selectedQuestionCount) || getDefaultQuestionCount(maxAllowed);
        return Math.max(2, Math.min(normalizedCount, maxAllowed));
    }

    async function loadModuleWords() {
        if (!moduleId) {
            showView("empty");
            syncHistory("empty", "replace");
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/words/module/${moduleId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) {
                showView("empty");
                syncHistory("empty", "replace");
                return;
            }

            moduleWords = await res.json();
            wordCountLabel.textContent = String(moduleWords.length);

            initQuestionCountSelect(moduleWords.length);

            if (moduleWords.length < 2) {
                showView("empty");
                syncHistory("empty", "replace");
                return;
            }

            if (restoreSavedResultState()) {
                return;
            }

            showView("start");
            syncHistory("start", "replace");
        } catch (error) {
            console.error(error);
            showView("empty");
            syncHistory("empty", "replace");
        }
    }

    function getRandomWrongTranslations(correctWordId, count = 3) {
        const pool = moduleWords
            .filter((word) => word.id !== correctWordId)
            .map((word) => word.translation);

        return shuffle([...new Set(pool)]).slice(0, count);
    }

    function buildMultipleChoiceQuestion(word) {
        const wrongOptions = getRandomWrongTranslations(word.id, 3);
        const options = shuffle([word.translation, ...wrongOptions]);

        return {
            type: "multiple",
            word,
            options,
            correctAnswer: word.translation
        };
    }

    function buildWriteQuestion(word) {
        return {
            type: "write",
            word,
            correctAnswer: word.translation
        };
    }

    function buildTrueFalseQuestion(word) {
        const shouldBeCorrect = Math.random() > 0.5;
        let shownTranslation = word.translation;
        let isCorrectPair = true;

        if (!shouldBeCorrect) {
            const wrongPool = moduleWords.filter((candidate) => candidate.id !== word.id);
            const randomWrongWord = shuffle(wrongPool)[0];

            if (randomWrongWord) {
                shownTranslation = randomWrongWord.translation;
                isCorrectPair = false;
            }
        }

        return {
            type: "truefalse",
            word,
            shownTranslation,
            correctAnswer: isCorrectPair ? "true" : "false"
        };
    }

    function buildQuestions(mode) {
        const questionCount = getCurrentQuestionCount();
        const baseWords = sampleWords(moduleWords, questionCount);

        return baseWords.map((word) => {
            if (mode === "multiple") return buildMultipleChoiceQuestion(word);
            if (mode === "write") return buildWriteQuestion(word);
            if (mode === "truefalse") return buildTrueFalseQuestion(word);

            const types = ["multiple", "write", "truefalse"];
            const randomType = shuffle(types)[0];

            if (randomType === "multiple") return buildMultipleChoiceQuestion(word);
            if (randomType === "write") return buildWriteQuestion(word);
            return buildTrueFalseQuestion(word);
        });
    }

    function updateProgress() {
        const total = questions.length;
        const current = Math.min(currentQuestionIndex + 1, total);
        const progressPercent = total ? (currentQuestionIndex / total) * 100 : 0;

        progressLabel.textContent = `Question ${current} / ${total}`;
        scoreLabel.textContent = `Score: ${score}`;
        progressFill.style.width = `${progressPercent}%`;
    }

    function recordMistake(word, userAnswer, correctAnswer) {
        mistakes.push({
            word: word.word,
            userAnswer: userAnswer || "-",
            correctAnswer: correctAnswer || "-"
        });
    }

    function recordAnswer(question, userAnswer, isCorrect, correctAnswerOverride = null) {
        answersToSave.push({
            word_id: question.word.id,
            question_type: question.type,
            user_answer: userAnswer,
            correct_answer: correctAnswerOverride || question.correctAnswer,
            is_correct: isCorrect
        });
    }

    async function goToNextQuestion() {
        if (isFinishingQuiz) return;

        currentQuestionIndex++;

        if (currentQuestionIndex >= questions.length) {
            isFinishingQuiz = true;
            await showResults();
            isFinishingQuiz = false;
            return;
        }

        renderCurrentQuestion();
    }

    function renderMultipleChoice(question) {
        questionContainer.innerHTML = `
            <div class="question-type">Multiple choice</div>
            <h2 class="question-title">${question.word.word}</h2>
            <p class="question-subtitle">Choose the correct translation.</p>
            <div class="answer-grid">
                ${question.options.map((option) => `
                    <button class="answer-btn" type="button" data-answer="${option.replace(/"/g, "&quot;")}">
                        ${option}
                    </button>
                `).join("")}
            </div>
        `;

        const answerButtons = questionContainer.querySelectorAll(".answer-btn");

        answerButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const selectedAnswer = button.dataset.answer;
                const isCorrect = normalizeText(selectedAnswer) === normalizeText(question.correctAnswer);

                answerButtons.forEach((candidate) => {
                    candidate.classList.add("disabled");

                    if (normalizeText(candidate.dataset.answer) === normalizeText(question.correctAnswer)) {
                        candidate.classList.add("correct");
                    }
                });

                if (!isCorrect) {
                    button.classList.add("wrong");
                    recordMistake(question.word, selectedAnswer, question.correctAnswer);
                } else {
                    score++;
                    scoreLabel.textContent = `Score: ${score}`;
                }

                recordAnswer(question, selectedAnswer, isCorrect);

                const nextRow = document.createElement("div");
                nextRow.className = "next-row";
                nextRow.innerHTML = `<button class="btn-main" type="button">Next</button>`;
                questionContainer.appendChild(nextRow);

                nextRow.querySelector("button").addEventListener("click", goToNextQuestion, { once: true });
            }, { once: true });
        });
    }

    function renderWriteAnswer(question) {
        questionContainer.innerHTML = `
            <div class="question-type">Write answer</div>
            <h2 class="question-title">${question.word.word}</h2>
            <p class="question-subtitle">Type the correct translation.</p>

            <div class="write-box">
                <input id="write-input" class="write-input" type="text" placeholder="Type your answer...">
                <div class="write-actions">
                    <button id="check-answer-btn" class="btn-main" type="button">Check answer</button>
                </div>
            </div>
        `;

        const input = document.getElementById("write-input");
        const checkBtn = document.getElementById("check-answer-btn");

        function submitAnswer() {
            if (checkBtn.disabled) return;

            const userAnswer = input.value.trim();
            if (!userAnswer) return;

            const isCorrect = normalizeText(userAnswer) === normalizeText(question.correctAnswer);

            const feedback = document.createElement("div");
            feedback.className = `feedback-box ${isCorrect ? "correct" : "wrong"}`;
            feedback.innerHTML = isCorrect
                ? "Correct!"
                : `Wrong. Correct answer: <strong>${question.correctAnswer}</strong>`;

            if (isCorrect) {
                score++;
                scoreLabel.textContent = `Score: ${score}`;
            } else {
                recordMistake(question.word, userAnswer, question.correctAnswer);
            }

            recordAnswer(question, userAnswer, isCorrect);

            checkBtn.disabled = true;
            input.disabled = true;

            const nextRow = document.createElement("div");
            nextRow.className = "next-row";
            nextRow.innerHTML = `<button class="btn-main" type="button">Next</button>`;

            questionContainer.appendChild(feedback);
            questionContainer.appendChild(nextRow);

            nextRow.querySelector("button").addEventListener("click", goToNextQuestion, { once: true });
        }

        checkBtn.addEventListener("click", submitAnswer);

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submitAnswer();
            }
        });
    }

    function renderTrueFalse(question) {
        questionContainer.innerHTML = `
            <div class="question-type">True / False</div>
            <h2 class="question-title">${question.word.word}</h2>
            <p class="question-subtitle">Does this translation match: <strong>${question.shownTranslation}</strong>?</p>
            <div class="answer-grid">
                <button class="answer-btn" type="button" data-answer="true">True</button>
                <button class="answer-btn" type="button" data-answer="false">False</button>
            </div>
        `;

        const answerButtons = questionContainer.querySelectorAll(".answer-btn");

        answerButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const selectedAnswer = button.dataset.answer;
                const isCorrect = selectedAnswer === question.correctAnswer;

                answerButtons.forEach((candidate) => {
                    candidate.classList.add("disabled");

                    if (candidate.dataset.answer === question.correctAnswer) {
                        candidate.classList.add("correct");
                    }
                });

                if (!isCorrect) {
                    button.classList.add("wrong");
                    recordMistake(
                        question.word,
                        `${question.word.word} -> ${question.shownTranslation}`,
                        `${question.word.word} -> ${question.word.translation}`
                    );
                } else {
                    score++;
                    scoreLabel.textContent = `Score: ${score}`;
                }

                recordAnswer(
                    question,
                    selectedAnswer,
                    isCorrect,
                    `${question.word.word} -> ${question.word.translation}`
                );

                const nextRow = document.createElement("div");
                nextRow.className = "next-row";
                nextRow.innerHTML = `<button class="btn-main" type="button">Next</button>`;
                questionContainer.appendChild(nextRow);

                nextRow.querySelector("button").addEventListener("click", goToNextQuestion, { once: true });
            }, { once: true });
        });
    }

    function renderCurrentQuestion() {
        updateProgress();

        const question = questions[currentQuestionIndex];
        if (!question) return;

        if (question.type === "multiple") {
            renderMultipleChoice(question);
            return;
        }

        if (question.type === "write") {
            renderWriteAnswer(question);
            return;
        }

        renderTrueFalse(question);
    }

    async function saveQuizAttempt() {
        if (quizSaved || !moduleId || !selectedMode || !questions.length) {
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/quiz/attempt`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    module_id: Number(moduleId),
                    quiz_type: selectedMode,
                    score,
                    total_questions: questions.length,
                    answers: answersToSave
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                console.error("Quiz save error:", errorData);
                return;
            }

            const data = await res.json();
            earnedXp = data.xp_earned || 0;
            quizSaved = true;
        } catch (error) {
            console.error("Failed to save quiz attempt:", error);
        }
    }

    async function showResults() {
        await saveQuizAttempt();

        const total = questions.length;
        const percent = total ? Math.round((score / total) * 100) : 0;
        const playHeight = playView?.getBoundingClientRect().height || 0;

        progressFill.style.transition = "none";
        progressFill.style.width = "100%";

        saveResultState();
        if (playHeight > 0) {
            persistentShellMinHeight = `${Math.ceil(playHeight)}px`;
            persistentResultMinHeight = `${Math.ceil(playHeight)}px`;
        }

        renderResultContent({
            scoreValue: score,
            totalValue: total,
            percentValue: percent,
            mistakesValue: mistakes,
            saved: quizSaved,
            xpValue: earnedXp
        });

        showView("result", {
            scrollToTop: false,
            freezeFrom: playView,
            freezeTo: playView
        });
        syncHistory("result", "replace");
    }

    function startQuiz(mode) {
        clearSavedResultState();
        selectedMode = mode;
        selectedQuestionCount = getCurrentQuestionCount();

        resetActiveQuizState();
        questions = buildQuestions(mode);

        if (!questions.length) {
            showView("empty");
            syncHistory("empty", "replace");
            return;
        }

        renderCurrentQuestion();
        showView("play", { scrollToTop: true });
        syncHistory("play", "push");
    }

    function showStartScreen({ fromHistory = false } = {}) {
        clearSavedResultState();
        resetActiveQuizState();
        showView("start", { scrollToTop: false });

        if (!fromHistory) {
            syncHistory("start", "replace");
        }
    }

    if (logo) {
        logo.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            window.location.href = "index.html";
        });
    }

    initCustomSelect(countSelect);

    document.addEventListener("click", () => {
        countSelectItems?.classList.add("quiz-select-hide");
        countSelectSelected?.classList.remove("active");
    });

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (currentView === "play" || currentView === "result") {
                if (window.history.state?.langlyQuizPage) {
                    window.history.back();
                } else {
                    showStartScreen();
                }
                return;
            }

            clearSavedResultState();
            const folderId = sessionStorage.getItem("langlyCurrentFolderId");
            if (folderId) {
                window.location.href = `my-words.html?folder=${folderId}`;
            } else {
                window.location.href = "my-words.html";
            }
        });
    }

    window.addEventListener("popstate", (event) => {
        const state = event.state;

        if (!state || !state.langlyQuizPage || String(state.moduleId) !== String(moduleId)) {
            return;
        }

        if (state.view === "start") {
            showStartScreen({ fromHistory: true });
            return;
        }

        if (state.view === "result") {
            restoreSavedResultState();
        }
    });

    moduleTitleEl.textContent = moduleName;

    document.querySelectorAll(".mode-card").forEach((button) => {
        button.addEventListener("click", () => {
            if (isFinishingQuiz) return;
            startQuiz(button.dataset.mode);
        });
    });

    restartBtn?.addEventListener("click", () => {
        if (isFinishingQuiz || !selectedMode) return;
        clearSavedResultState();
        startQuiz(selectedMode);
    });

    changeModeBtn?.addEventListener("click", () => {
        if (isFinishingQuiz) return;
        showStartScreen();
    });

    await loadModuleWords();
});
