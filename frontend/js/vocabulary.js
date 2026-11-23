(function () {
    let confirmationQueue = Promise.resolve();
    let dialogNumber = 0;

    function normalize(text) {
        return String(text ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
    }

    function groupEntries(entries) {
        const groups = new Map();
        for (const entry of entries) {
            const key = normalize(entry.word);
            if (!groups.has(key)) groups.set(key, { ...entry, translations: [] });
            const group = groups.get(key);
            if (!group.translations.some(value => normalize(value) === normalize(entry.translation))) {
                group.translations.push(entry.translation);
            }
        }
        return [...groups.values()];
    }

    function accepts(entry, answer) {
        return (entry.translations || [entry.translation]).some(value => normalize(value) === normalize(answer));
    }

    function wrongTranslations(entries, entry) {
        const options = new Map();
        for (const candidate of entries) {
            if (normalize(candidate.word) === normalize(entry.word)) continue;
            for (const value of candidate.translations || [candidate.translation]) {
                if (!accepts(entry, value)) options.set(normalize(value), value);
            }
        }
        return [...options.values()];
    }

    function text(key) {
        return window.langlyUiText.t(key);
    }

    function showConfirmation(warnings, entry) {
        return new Promise(resolve => {
            const dialog = document.createElement("dialog");
            dialog.className = "vocabulary-confirm";
            const heading = document.createElement("h2");
            heading.id = `vocabulary-confirm-${++dialogNumber}`;
            heading.textContent = text("words.confirm_title");
            dialog.setAttribute("aria-labelledby", heading.id);
            dialog.appendChild(heading);
            const preview = document.createElement("p");
            preview.className = "vocabulary-confirm-entry";
            preview.textContent = `${entry.word} — ${entry.translation}`;
            dialog.appendChild(preview);
            for (const warning of warnings) {
                const message = document.createElement("p");
                message.textContent = text(`words.warning_${warning}`);
                dialog.appendChild(message);
            }
            const actions = document.createElement("div");
            actions.className = "vocabulary-confirm-actions";
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = text("words.confirm_cancel");
            cancel.addEventListener("click", () => dialog.close("cancel"));
            const confirm = document.createElement("button");
            confirm.type = "button";
            confirm.className = "vocabulary-confirm-accept";
            confirm.textContent = text("words.confirm_add");
            confirm.addEventListener("click", () => dialog.close("confirm"));
            actions.append(cancel, confirm);
            dialog.appendChild(actions);
            dialog.addEventListener("close", () => {
                const accepted = dialog.returnValue === "confirm";
                dialog.remove();
                resolve(accepted);
            }, { once: true });
            document.body.appendChild(dialog);
            dialog.showModal();
            cancel.focus();
        });
    }

    function confirmWarnings(warnings, entry) {
        const result = confirmationQueue.then(() => showConfirmation(warnings, entry));
        confirmationQueue = result.catch(() => false);
        return result;
    }

    async function createWord(entry, token) {
        const payload = { ...entry };
        for (let attempt = 0; attempt < 3; attempt++) {
            const response = await window.langlySession.request("http://127.0.0.1:8000/words/", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => null);
            if (response.status !== 409 || data?.detail?.code !== "word_confirmation_required") {
                return { response, data, cancelled: false };
            }
            const warnings = data.detail.warnings;
            if (!Array.isArray(warnings) || !warnings.length || warnings.some(value => !["duplicate", "unverified_phrase"].includes(value))) {
                return { response, data, cancelled: false };
            }
            if (!await confirmWarnings(warnings, payload)) return { cancelled: true };
            if (warnings.includes("duplicate")) payload.allow_duplicate = true;
            if (warnings.includes("unverified_phrase")) payload.allow_unverified_phrase = true;
        }
        throw new Error("Word confirmation could not be completed");
    }

    function errorMessage(data, fallback) {
        const code = data?.detail?.code;
        if (["invalid_word", "dictionary_unavailable", "empty_entry"].includes(code)) {
            return text(`words.${code}`);
        }
        return typeof data?.detail === "string" ? data.detail : fallback;
    }

    window.langlyVocabulary = { normalize, groupEntries, accepts, wrongTranslations, createWord, errorMessage };
})();
