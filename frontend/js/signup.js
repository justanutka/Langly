document.addEventListener("DOMContentLoaded", async () => {

  const BASE_URL = "http://127.0.0.1:8000";
  const form = document.getElementById("signup-form");
  const messageBox = document.getElementById("message");

  const nativeSelect = document.getElementById("native-select");
  const selectedValue = document.getElementById("selected-value");
  const optionsContainer = document.getElementById("select-options");

  let selectedLanguageId = null;

  // =========================
  // LOAD LANGUAGES
  // =========================
  async function loadLanguages() {
    try {
      const res = await fetch(BASE_URL + "/users/languages");
      const languages = await res.json();

      languages.forEach(lang => {
        const option = document.createElement("div");
        option.classList.add("select-option");
        option.textContent = lang.name;

        option.addEventListener("click", () => {
          selectedValue.textContent = lang.name;
          selectedLanguageId = lang.id;
          closeDropdown();
        });

        optionsContainer.appendChild(option);
      });

    } catch (error) {
      console.error("Failed to load languages");
    }
  }

  await loadLanguages();

  // =========================
  // TOGGLE DROPDOWN
  // =========================
  const trigger = nativeSelect.querySelector(".select-trigger");

  trigger.addEventListener("click", () => {
    optionsContainer.classList.toggle("open");
    trigger.classList.toggle("active");
  });

  function closeDropdown() {
    optionsContainer.classList.remove("open");
    trigger.classList.remove("active");
  }

  // Закрытие при клике вне блока
  document.addEventListener("click", (e) => {
    if (!nativeSelect.contains(e.target)) {
      closeDropdown();
    }
  });

  // =========================
  // SUBMIT FORM
  // =========================
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    messageBox.textContent = "";
    messageBox.className = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirm = document.getElementById("confirm").value.trim();

    if (!email || !password || !confirm || !selectedLanguageId) {
      messageBox.textContent = "Please fill in all fields.";
      messageBox.className = "error";
      return;
    }

    if (password !== confirm) {
      messageBox.textContent = "Passwords do not match.";
      messageBox.className = "error";
      return;
    }

    try {
      const response = await fetch(BASE_URL + "/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password,
          native_language_id: selectedLanguageId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        messageBox.textContent = data.detail || "Registration failed.";
        messageBox.className = "error";
        return;
      }

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
      }

      window.location.href = "choose-language.html";

    } catch (error) {
      messageBox.textContent = "Cannot connect to API.";
      messageBox.className = "error";
    }

  });

});