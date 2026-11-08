(function () {
    const defaultApiOrigin = "http://127.0.0.1:8000";
    const apiOrigin = window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : defaultApiOrigin;
    const renewalInterval = 5 * 60;
    const retryInterval = 30_000;
    let pendingRenewal = null;
    let lastAttemptAt = -Infinity;
    let rejectedToken = null;

    function claims(token) {
        try {
            const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            return JSON.parse(atob(payload));
        } catch {
            return {};
        }
    }

    function sameSession(first, second) {
        if (!first || !second) return false;
        if (first === second) return true;
        const sessionId = claims(first).sid;
        return Boolean(sessionId && sessionId === claims(second).sid);
    }

    function postSession(action, token, timeout) {
        return fetch(apiOrigin + "/users/session/" + action, {
            method: "POST",
            credentials: "include",
            headers: { Authorization: "Bearer " + token },
            signal: AbortSignal.timeout(timeout),
            keepalive: true
        });
    }

    function renewOnActivity(event) {
        if (!event.isTrusted || document.hidden || pendingRenewal) return;
        const token = localStorage.getItem("token");
        if (!token || token === rejectedToken) return;

        const { sid, iat } = claims(token);
        const now = Date.now();
        if (!sid || typeof iat !== "number" || now / 1000 - iat < renewalInterval
                || now - lastAttemptAt < retryInterval) return;

        lastAttemptAt = now;
        pendingRenewal = (async () => {
            const response = await postSession("renew", token, 8000);
            if (response.status === 401) rejectedToken = token;
            if (!response.ok) return;

            const { access_token: nextToken } = await response.json();
            const current = localStorage.getItem("token");
            if (sameSession(token, current) && sameSession(token, nextToken)
                    && claims(nextToken).iat >= claims(current).iat) {
                localStorage.setItem("token", nextToken);
            }
        })().catch(() => {
            // Keep the current token and retry after another interaction.
        }).finally(() => {
            pendingRenewal = null;
        });
    }

    async function request(url, options = {}) {
        const address = new URL(url, window.location.href);
        if (address.origin !== defaultApiOrigin && address.origin !== apiOrigin) {
            return fetch(url, options);
        }
        const target = apiOrigin + address.pathname + address.search;
        if (address.pathname === "/users/login" || address.pathname === "/users/register") {
            return fetch(target, { ...options, credentials: "include" });
        }

        const headers = new Headers(options.headers);
        const sentToken = headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
        if (!sentToken) return fetch(target, options);

        // A page may still hold the token it captured when it opened.
        if (pendingRenewal) await pendingRenewal;
        let token = localStorage.getItem("token");
        if (!sameSession(sentToken, token)) {
            return Response.json({ detail: "Could not validate credentials" }, { status: 401 });
        }

        headers.set("Authorization", "Bearer " + token);
        let response = await fetch(target, { ...options, headers });
        if (response.status === 401) {
            const current = localStorage.getItem("token");
            if (current !== token && sameSession(token, current)) {
                token = current;
                headers.set("Authorization", "Bearer " + token);
                response = await fetch(target, { ...options, headers });
            }
        }
        if (response.status === 401 && claims(token).sid && localStorage.getItem("token") === token) {
            localStorage.removeItem("token");
            window.langlyApi?.clearUserRuntimeCache?.();
            if (!window.location.pathname.endsWith("/login.html")) {
                window.location.replace("login.html");
            }
        }
        return response;
    }

    async function signOut() {
        const token = localStorage.getItem("token");
        localStorage.removeItem("token");
        if (claims(token).sid) {
            try {
                await postSession("logout", token, 3000);
            } catch {
                // Local sign-out also works without a network connection.
            }
        }
    }

    window.langlySession = { request, signOut };

    const page = window.location.pathname.split("/").pop();
    if (page && !["index.html", "login.html", "signup.html", "forgot-password.html", "terms.html"].includes(page)) {
        for (const event of ["pointerdown", "keydown", "click", "wheel"]) {
            document.addEventListener(event, renewOnActivity, { capture: true, passive: true });
        }
    }
})();
