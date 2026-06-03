(function () {
  const API_BASE_URL = "http://127.0.0.1:8000";
  const STORAGE_KEY = "langlyInterfaceLanguage";
  const SUPPORTED = ["en", "pl", "es", "de", "ru"];

  let currentLocale = normalize(localStorage.getItem(STORAGE_KEY) || "en");
  let currentDictionary = {};
  let currentAutoText = {};
  let fallbackDictionary = {};
  let initPromise = null;
  let currentUserPromise = null;
  let foldersPromise = null;
  let foldersCache = null;
  let languagesPromise = null;
  let languagesCache = null;
  let studyStatsPromise = null;
  let studyStatsCache = null;

  document.body?.classList.add("langly-i18n-pending");

  const localeCache = new Map();
  const localePromises = new Map();

  function normalize(code) {
    const short = String(code || "en").trim().toLowerCase().split("-")[0];
    return SUPPORTED.includes(short) ? short : "en";
  }

  function format(text, params) {
    return String(text).replace(/\{(\w+)\}/g, (_, key) => {
      return params && Object.prototype.hasOwnProperty.call(params, key) ? params[key] : "";
    });
  }

  async function loadLocale(locale, { force = false } = {}) {
    const normalized = normalize(locale);

    if (!force && localeCache.has(normalized)) {
      return localeCache.get(normalized);
    }

    if (!force && localePromises.has(normalized)) {
      return localePromises.get(normalized);
    }

    const promise = fetch(`locales/${normalized}.json`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Locale ${normalized} load failed`);
        }

        const payload = await response.json();
        const entry = {
          translations: payload.translations || {},
          autoText: payload.autoText || {}
        };

        localeCache.set(normalized, entry);

        if (normalized === "en") {
          fallbackDictionary = entry.translations;
        }

        if (normalized === currentLocale) {
          currentDictionary = entry.translations;
          currentAutoText = entry.autoText;
        }

        return entry;
      })
      .finally(() => {
        localePromises.delete(normalized);
      });

    localePromises.set(normalized, promise);
    return promise;
  }

  async function ensureLocale(locale = currentLocale) {
    await loadLocale("en").catch((error) => {
      console.error("Fallback locale load error:", error);
    });

    try {
      return await loadLocale(locale);
    } catch (error) {
      console.error("Interface language load error:", error);
      currentDictionary = fallbackDictionary;
      currentAutoText = {};
      return { translations: currentDictionary, autoText: currentAutoText };
    }
  }

  function t(key, params) {
    const value = currentDictionary[key] || fallbackDictionary[key] || key;
    return format(value, params || {});
  }

  function getKnownTranslation(key, params) {
    if (Object.prototype.hasOwnProperty.call(currentDictionary, key)) {
      return format(currentDictionary[key], params || {});
    }

    if (Object.prototype.hasOwnProperty.call(fallbackDictionary, key)) {
      return format(fallbackDictionary[key], params || {});
    }

    return null;
  }

  function setLocale(code) {
    currentLocale = normalize(code);
    localStorage.setItem(STORAGE_KEY, currentLocale);
    document.documentElement.lang = currentLocale;

    const cached = localeCache.get(currentLocale);
    if (cached) {
      currentDictionary = cached.translations;
      currentAutoText = cached.autoText;
    }

    return ensureLocale(currentLocale).then(() => currentLocale);
  }

  function setLocaleFromUser(user) {
    return setLocale(user?.interface_language_code || user?.native_language_code || currentLocale);
  }

  function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function getCurrentUser({ force = false } = {}) {
    if (!force && window.langlyCurrentUser) {
      return window.langlyCurrentUser;
    }

    if (!force && currentUserPromise) {
      return currentUserPromise;
    }

    currentUserPromise = fetch(`${API_BASE_URL}/users/me`, {
      headers: authHeaders()
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Current user load failed");
      }

      const user = await response.json();
      window.langlyCurrentUser = user;
      return user;
    }).catch((error) => {
      currentUserPromise = null;
      throw error;
    });

    return currentUserPromise;
  }

  async function getFolders({ force = false } = {}) {
    if (!force && foldersCache) {
      return foldersCache;
    }

    if (!force && foldersPromise) {
      return foldersPromise;
    }

    foldersPromise = fetch(`${API_BASE_URL}/folders/`, {
      headers: authHeaders()
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Folders load failed");
      }

      foldersCache = await response.json();
      return foldersCache;
    }).catch((error) => {
      foldersPromise = null;
      throw error;
    });

    return foldersPromise;
  }

  function clearFoldersCache() {
    foldersPromise = null;
    foldersCache = null;
  }

  async function getLanguages({ force = false } = {}) {
    if (!force && languagesCache) {
      return languagesCache;
    }

    if (!force && languagesPromise) {
      return languagesPromise;
    }

    languagesPromise = fetch(`${API_BASE_URL}/users/languages`, {
      headers: authHeaders()
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Languages load failed");
      }

      languagesCache = await response.json();
      return languagesCache;
    }).catch((error) => {
      languagesPromise = null;
      throw error;
    });

    return languagesPromise;
  }

  async function getStudyStats({ force = false } = {}) {
    if (!force && studyStatsCache) {
      return studyStatsCache;
    }

    if (!force && studyStatsPromise) {
      return studyStatsPromise;
    }

    studyStatsPromise = fetch(`${API_BASE_URL}/study/stats`, {
      headers: authHeaders()
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Stats load failed");
      }

      studyStatsCache = await response.json();
      return studyStatsCache;
    }).catch((error) => {
      studyStatsPromise = null;
      throw error;
    });

    return studyStatsPromise;
  }

  function clearStudyStatsCache() {
    studyStatsPromise = null;
    studyStatsCache = null;
  }

  function clearLanguageScopedCache() {
    clearFoldersCache();
    clearStudyStatsCache();
    localStorage.removeItem("langlyDiscoveryFolderId");
    localStorage.removeItem("langlyDiscoveryModuleId");
    sessionStorage.removeItem("langlyWordsView");
    sessionStorage.removeItem("langlyCurrentFolderId");
    sessionStorage.removeItem("langlyCurrentModuleId");
    sessionStorage.removeItem("langlyCurrentFolderTitle");
    sessionStorage.removeItem("langlyCurrentModuleTitle");
  }

  function apply(root) {
    const scope = root || document;

    scope.querySelectorAll("[data-ui-text]").forEach((element) => {
      let params = {};
      if (element.dataset.uiTextParams) {
        try {
          params = JSON.parse(element.dataset.uiTextParams);
        } catch {
          params = {};
        }
      }
      const value = getKnownTranslation(element.dataset.uiText, params);
      if (value !== null) {
        element.textContent = value;
      }
    });

    scope.querySelectorAll("[data-ui-placeholder]").forEach((element) => {
      const value = getKnownTranslation(element.dataset.uiPlaceholder);
      if (value !== null) {
        element.setAttribute("placeholder", value);
        if (element.hasAttribute("data-placeholder")) {
          element.setAttribute("data-placeholder", value);
        }
      }
    });

    scope.querySelectorAll("[data-ui-title]").forEach((element) => {
      const value = getKnownTranslation(element.dataset.uiTitle);
      if (value !== null) {
        element.setAttribute("title", value);
      }
    });

    scope.querySelectorAll("[data-ui-aria-label]").forEach((element) => {
      const value = getKnownTranslation(element.dataset.uiAriaLabel);
      if (value !== null) {
        element.setAttribute("aria-label", value);
      }
    });

    if (Object.keys(currentAutoText).length) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const nodes = [];

      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }

      nodes.forEach((node) => {
        const original = node.nodeValue;
        const trimmed = original.trim();
        if (!trimmed || !currentAutoText[trimmed]) return;
        node.nodeValue = original.replace(trimmed, currentAutoText[trimmed]);
      });
    }
  }

  async function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const token = localStorage.getItem("token");

      try {
        if (!token) {
          currentLocale = "en";
          document.documentElement.lang = currentLocale;
          await ensureLocale(currentLocale);
          apply(document);
          return currentLocale;
        }

        try {
          const user = await getCurrentUser();
          await setLocaleFromUser(user);
        } catch (error) {
          console.error("Interface language load error:", error);
          await setLocale(currentLocale);
        }

        apply(document);
        return currentLocale;
      } finally {
        document.body?.classList.remove("langly-i18n-pending");
      }
    })().catch((error) => {
      document.body?.classList.remove("langly-i18n-pending");
      throw error;
    });

    return initPromise;
  }

  window.langlyUiText = {
    init,
    apply,
    t,
    setLocale,
    setLocaleFromUser,
    getLocale: () => currentLocale,
    normalize,
    loadLocale
  };

  window.langlyApi = {
    getCurrentUser,
    getFolders,
    getLanguages,
    getStudyStats,
    clearFoldersCache,
    clearStudyStatsCache,
    clearLanguageScopedCache
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
    });
  } else {
    init();
  }
})();
