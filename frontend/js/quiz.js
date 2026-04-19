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

    const logo = document.getElementById("logo");
    const logoutBtn = document.getElementById("logout-btn");
    const backBtn = document.getElementById("back-btn");

    const startView = document.getElementById("quiz-start-view");
    const playView = document.getElementById("quiz-play-view");
    const resultView = document.getElementById("quiz-result-view");
    const emptyView = document.getElementById("quiz-empty-view");

    const moduleTitleEl = document.getElementById("quiz-module-title");
    const questionCountLabel = document.getElementById("question-count-label");
    const wordCountLabel = document.getElementById("word-count-label");

    const progressLabel = document.getElementById("progress-label");
    const scoreLabel = document.getElementById("score-label");
    const progressFill = document.getElementById("progress-fill");
    const questionContainer = document.getElementById("question-container");

    const resultSummary = document.getElementById("result-summary");
    const resultCorrect = document.getElementById("result-correct");
    const resultTotal = document.getElementById("result-total");
    const resultPercent = document.getElementById("result-percent");
    const mistakesBlock = document.getElementById("mistakes-block");
    const mistakesList = document.getElementById("mistakes-list");

    const restartBtn = document.getElementById("restart-btn");
    const changeModeBtn = document.getElementById("change-mode-btn");

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

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            clearSavedResultState();
            const folderId = sessionStorage.getItem("langlyCurrentFolderId");
            if (folderId) {
                window.location.href = `my-words.html?folder=${folderId}`;
            } else {
                window.location.href = "my-words.html";
            }
        });
    }

    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("module");
    const moduleName =
        params.get("name") ||
        sessionStorage.getItem("langlyCurrentModuleTitle") ||
        "Quiz";

    moduleTitleEl.textContent = moduleName;

    let moduleWords = [];
    let selectedMode = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let mistakes = [];
    let answersToSave = [];
    let quizSaved = false;
    let earnedXp = 0;
    let isFinishingQuiz = false;

    function getResultStorageKey() {
        return `langlyQuizResult_${moduleId}`;
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
                mistakes
            })
        );
    }

    function clearSavedResultState() {
        sessionStorage.removeItem(getResultStorageKey());
    }

    function restoreSavedResultState() {
        const raw = sessionStorage.getItem(getResultStorageKey());
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);

            if (!data || String(data.moduleId) !== String(moduleId)) {
                return false;
            }

            let summaryText = `You answered ${data.score} out of ${data.total} questions correctly.`;

            if (data.quizSaved) {
                summaryText += ` You earned ${data.earnedXp || 0} XP.`;
            }

            resultSummary.textContent = summaryText;
            resultCorrect.textContent = data.score;
            resultTotal.textContent = data.total;
            resultPercent.textContent = `${data.percent}%`;

            mistakesList.innerHTML = "";

            if (Array.isArray(data.mistakes) && data.mistakes.length > 0) {
                mistakesBlock.style.display = "block";

                data.mistakes.forEach(mistake => {
                    const item = document.createElement("div");
                    item.className = "mistake-item";
                    item.innerHTML = `
                        <div class="mistake-word">${mistake.word}</div>
                        <div class="mistake-line">Your answer: ${mistake.userAnswer}</div>
                        <div class="mistake-line">Correct answer: ${mistake.correctAnswer}</div>
                    `;
                    mistakesList.appendChild(item);
                });
            } else {
                mistakesBlock.style.display = "none";
            }

            showView("result");
            return true;
        } catch (error) {
            console.error("Failed to restore quiz result:", error);
            return false;
        }
    }

    function normalizeText(text) {
        return (text || "")
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

    function getQuestionCount(words) {
        return Math.min(10, words.length);
    }

    function showView(viewName) {
        startView.style.display = viewName === "start" ? "block" : "none";
        playView.style.display = viewName === "play" ? "block" : "none";
        resultView.style.display = viewName === "result" ? "block" : "none";
        emptyView.style.display = viewName === "empty" ? "block" : "none";
    }

    async function loadModuleWords() {
        if (!moduleId) {
            showView("empty");
            return;
        }

        if (restoreSavedResultState()) {
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
                return;
            }

            moduleWords = await res.json();

            const questionCount = getQuestionCount(moduleWords);

            wordCountLabel.textContent = moduleWords.length;
            questionCountLabel.textContent = questionCount;

            if (moduleWords.length < 2) {
                showView("empty");
                return;
            }

            showView("start");
        } catch (error) {
            console.error(error);
            showView("empty");
        }
    }

    function getRandomWrongTranslations(correctWordId, count = 3) {
        const pool = moduleWords
            .filter(word => word.id !== correctWordId)
            .map(word => word.translation);

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
            const wrongPool = moduleWords.filter(w => w.id !== word.id);
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
        const questionCount = getQuestionCount(moduleWords);
        const baseWords = sampleWords(moduleWords, questionCount);

        return baseWords.map(word => {
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
        const current = currentQuestionIndex + 1;
        const progressPercent = total ? (currentQuestionIndex / total) * 100 : 0;

        progressLabel.textContent = `Question ${current} / ${total}`;
        scoreLabel.textContent = `Score: ${score}`;
        progressFill.style.width = `${progressPercent}%`;
    }

    function recordMistake(word, userAnswer, correctAnswer) {
        mistakes.push({
            word: word.word,
            userAnswer: userAnswer || "—",
            correctAnswer: correctAnswer || "—"
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

            setTimeout(async () => {
                await showResults();
                isFinishingQuiz = false;
            }, 120);

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
                ${question.options.map(option => `
                    <button class="answer-btn" type="button" data-answer="${option.replace(/"/g, "&quot;")}">
                        ${option}
                    </button>
                `).join("")}
            </div>
        `;

        const answerButtons = questionContainer.querySelectorAll(".answer-btn");

        answerButtons.forEach(button => {
            button.addEventListener("click", () => {
                const selectedAnswer = button.dataset.answer;
                const isCorrect = normalizeText(selectedAnswer) === normalizeText(question.correctAnswer);

                answerButtons.forEach(btn => {
                    btn.classList.add("disabled");

                    if (normalizeText(btn.dataset.answer) === normalizeText(question.correctAnswer)) {
                        btn.classList.add("correct");
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
                ? `Correct!`
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

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
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

        answerButtons.forEach(button => {
            button.addEventListener("click", () => {
                const selectedAnswer = button.dataset.answer;
                const isCorrect = selectedAnswer === question.correctAnswer;

                answerButtons.forEach(btn => {
                    btn.classList.add("disabled");

                    if (btn.dataset.answer === question.correctAnswer) {
                        btn.classList.add("correct");
                    }
                });

                if (!isCorrect) {
                    button.classList.add("wrong");
                    recordMistake(
                        question.word,
                        `${question.word.word} → ${question.shownTranslation}`,
                        `${question.word.word} → ${question.word.translation}`
                    );
                } else {
                    score++;
                    scoreLabel.textContent = `Score: ${score}`;
                }

                recordAnswer(
                    question,
                    selectedAnswer,
                    isCorrect,
                    `${question.word.word} → ${question.word.translation}`
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
                    score: score,
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

        progressFill.style.width = "100%";

        let summaryText = `You answered ${score} out of ${total} questions correctly.`;

        if (quizSaved) {
            summaryText += ` You earned ${earnedXp} XP.`;
        }

        resultSummary.textContent = summaryText;
        resultCorrect.textContent = score;
        resultTotal.textContent = total;
        resultPercent.textContent = `${percent}%`;

        mistakesList.innerHTML = "";

        if (mistakes.length > 0) {
            mistakesBlock.style.display = "block";

            mistakes.forEach(mistake => {
                const item = document.createElement("div");
                item.className = "mistake-item";
                item.innerHTML = `
                    <div class="mistake-word">${mistake.word}</div>
                    <div class="mistake-line">Your answer: ${mistake.userAnswer}</div>
                    <div class="mistake-line">Correct answer: ${mistake.correctAnswer}</div>
                `;
                mistakesList.appendChild(item);
            });
        } else {
            mistakesBlock.style.display = "none";
        }

        saveResultState();
        showView("result");
    }

    function startQuiz(mode) {
        clearSavedResultState();

        selectedMode = mode;
        questions = buildQuestions(mode);
        currentQuestionIndex = 0;
        score = 0;
        mistakes = [];
        answersToSave = [];
        quizSaved = false;
        earnedXp = 0;
        isFinishingQuiz = false;

        if (!questions.length) {
            showView("empty");
            return;
        }

        showView("play");
        renderCurrentQuestion();
    }

    document.querySelectorAll(".mode-card").forEach(button => {
        button.addEventListener("click", () => {
            if (isFinishingQuiz) return;
            const mode = button.dataset.mode;
            startQuiz(mode);
        });
    });

    restartBtn.addEventListener("click", () => {
        if (isFinishingQuiz) return;

        clearSavedResultState();

        if (selectedMode) {
            startQuiz(selectedMode);
        }
    });

    changeModeBtn.addEventListener("click", () => {
        if (isFinishingQuiz) return;

        clearSavedResultState();
        showView("start");
    });

    loadModuleWords();
});