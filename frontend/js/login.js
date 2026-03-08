document.addEventListener("DOMContentLoaded", () => {

    const BASE_URL = "http://127.0.0.1:8000";
    const form = document.getElementById("login-form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        try {
            const response = await fetch(BASE_URL + "/users/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail || "Login failed");
                return;
            }

            localStorage.setItem("token", data.access_token);

            // 🔥 Проверяем выбран ли язык
            const meRes = await fetch(BASE_URL + "/users/me", {
                headers: {
                    "Authorization": `Bearer ${data.access_token}`
                }
            });

            const meData = await meRes.json();

            if (meData.active_language_id) {
                window.location.href = "dashboard.html";
            } else {
                window.location.href = "choose-language.html";
            }

        } catch (error) {
            alert("Cannot connect to server");
        }
    });

});