document.addEventListener("DOMContentLoaded", async () => {
  const BASE_URL = "http://127.0.0.1:8000";
  const EMAIL_RULE_TEXT = "Enter a valid email address with @.";
  const PASSWORD_RULE_TEXT = "Password must be at least 7 characters long and contain at least one letter and one digit.";
  const form = document.getElementById("signup-form");
  const messageBox = document.getElementById("message");
  const submitButton = form?.querySelector('button[type="submit"]');

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const confirmError = document.getElementById("confirm-error");

  const nativeSelect = document.getElementById("native-select");
  const selectedValue = document.getElementById("selected-value");
  const optionsContainer = document.getElementById("select-options");

  let selectedLanguageId = null;

  function setMessage(text, type = "") {
    messageBox.textContent = text || "";
    messageBox.className = type;
  }

  function setPageReady() {
    document.body.classList.remove("page-pending");
  }

  function isValidEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const [localPart, domainPart, ...rest] = normalized.split("@");
    return Boolean(localPart && domainPart && rest.length === 0);
  }

  function isStrongPassword(password) {
    return /^(?=.*[A-Za-z])(?=.*\d).{7,}$/.test(String(password || ""));
  }

  function setFieldError(input, errorElement, text) {
    if (input) input.classList.toggle("input-error", Boolean(text));
    if (errorElement) errorElement.textContent = text || "";
  }

  function validateEmailField() {
    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
      setFieldError(emailInput, emailError, "Please enter your email.");
      return false;
    }

    if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, EMAIL_RULE_TEXT);
      return false;
    }

    setFieldError(emailInput, emailError, "");
    return true;
  }

  function validatePasswordField() {
    const password = passwordInput.value.trim();

    if (!password) {
      setFieldError(passwordInput, passwordError, "Please enter a password.");
      return false;
    }

    if (!isStrongPassword(password)) {
      setFieldError(passwordInput, passwordError, PASSWORD_RULE_TEXT);
      return false;
    }

    setFieldError(passwordInput, passwordError, "");
    return true;
  }

  function validateConfirmField() {
    const confirm = confirmInput.value.trim();
    const password = passwordInput.value.trim();

    if (!confirm) {
      setFieldError(confirmInput, confirmError, "Please confirm your password.");
      return false;
    }

    if (password && confirm !== password) {
      setFieldError(confirmInput, confirmError, "Passwords do not match.");
      return false;
    }

    setFieldError(confirmInput, confirmError, "");
    return true;
  }

  function initPasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target || "");
        if (!input) return;

        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.classList.toggle("is-visible", shouldShow);
        button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
      });
    });
  }

  function bindLiveValidation(input, validate) {
    let touched = false;

    input.addEventListener("blur", () => {
      touched = true;
      validate();
    });

    input.addEventListener("input", () => {
      if (touched || form.dataset.submitted === "1") {
        validate();
      }
      setMessage("", "");
    });
  }

  async function loadLanguages() {
    try {
      const res = await fetch(BASE_URL + "/users/languages");
      if (!res.ok) {
        throw new Error("Failed to load languages");
      }

      const languages = await res.json();
      optionsContainer.innerHTML = "";

      if (!Array.isArray(languages) || !languages.length) {
        setMessage("No languages available right now.", "error");
        return;
      }

      languages.forEach((lang) => {
        const option = document.createElement("div");
        option.classList.add("select-option");
        option.textContent = lang.name;

        option.addEventListener("click", () => {
          selectedValue.textContent = lang.name;
          selectedLanguageId = lang.id;
          closeDropdown();
          setMessage("", "");
        });

        optionsContainer.appendChild(option);
      });
    } catch (error) {
      console.error("Failed to load languages", error);
      setMessage("Cannot load languages right now.", "error");
    }
  }

  try {
    await loadLanguages();
  } finally {
    setPageReady();
  }

  const trigger = nativeSelect.querySelector(".select-trigger");

  trigger.addEventListener("click", () => {
    optionsContainer.classList.toggle("open");
    trigger.classList.toggle("active");
  });

  function closeDropdown() {
    optionsContainer.classList.remove("open");
    trigger.classList.remove("active");
  }

  document.addEventListener("click", (e) => {
    if (!nativeSelect.contains(e.target)) {
      closeDropdown();
    }
  });

  initPasswordToggles();
  bindLiveValidation(emailInput, validateEmailField);
  bindLiveValidation(passwordInput, () => {
    const passwordOk = validatePasswordField();
    if (confirmInput.value.trim()) {
      validateConfirmField();
    }
    return passwordOk;
  });
  bindLiveValidation(confirmInput, validateConfirmField);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.dataset.submitted = "1";
    setMessage("", "");

    const emailOk = validateEmailField();
    const passwordOk = validatePasswordField();
    const confirmOk = validateConfirmField();

    if (!selectedLanguageId) {
      setMessage("Please choose your native language.", "error");
      return;
    }

    if (!emailOk || !passwordOk || !confirmOk) {
      return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating account...";
      }

      const response = await fetch(BASE_URL + "/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          native_language_id: selectedLanguageId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Registration failed.", "error");
        return;
      }

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
      }

      window.location.replace("choose-language.html");
    } catch (error) {
      setMessage("Cannot connect to API.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign up";
      }
    }
  });
});
