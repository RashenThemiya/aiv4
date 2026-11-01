const CONFIG_KEY = "rag_solar_demo_widget_config";
const dialog = document.querySelector(".setup-dialog");
const setupForm = document.querySelector(".setup-card");
const setupStatus = document.querySelector(".setup-status");
const toast = document.querySelector(".toast");

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

function openSetup(message = "") {
  const config = readConfig();
  setupForm.elements.apiBaseUrl.value = config.apiBaseUrl || "http://localhost:3000";
  setupForm.elements.companyId.value = config.companyId || "";
  setupForm.elements.apiKey.value = config.apiKey || "";
  setupStatus.textContent = message;
  if (!dialog.open) dialog.showModal();
}

async function loadWidget(config) {
  if (!config.companyId || !config.apiKey) {
    openSetup("Add the company ID and full widget API key to start testing.");
    return;
  }

  window.RAG_CHAT_WIDGET = {
    autoInit: true,
    apiBaseUrl: String(config.apiBaseUrl || "http://localhost:3000").replace(/\/$/, ""),
    companyId: config.companyId,
    apiKey: config.apiKey,
    title: "BrightGrid Guide",
    subtitle: "Clear answers and 24/7 support for smarter energy",
    accentColor: "#ff6b4a",
    headerColor: "#ffffff",
    headerTextColor: "#15372f",
    sendButtonColor: "#ff6b4a",
    launcherColor: "#ff6b4a",
    launcherIcon: "message",
    position: "right",
    greeting: "Hi! What would you like to know about building your energy setup?",
  };

  try {
    await import("./widget.js");
  } catch {
    openSetup("The widget could not be loaded. Check the browser console and frontend build.");
  }
}

setupForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const formData = new FormData(setupForm);
  const config = {
    apiBaseUrl: String(formData.get("apiBaseUrl") || "").trim(),
    companyId: String(formData.get("companyId") || "").trim(),
    apiKey: String(formData.get("apiKey") || "").trim(),
  };

  if (!config.apiBaseUrl || !config.companyId || !config.apiKey) {
    setupStatus.textContent = "All three values are required.";
    return;
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  dialog.close();
  window.location.reload();
});

document.querySelector(".clear-config").addEventListener("click", () => {
  localStorage.removeItem(CONFIG_KEY);
  setupForm.reset();
  setupForm.elements.apiBaseUrl.value = "http://localhost:3000";
  setupStatus.textContent = "Saved widget configuration cleared.";
});

document.querySelector(".setup-link").addEventListener("click", () => openSetup());

document.querySelectorAll(".open-support").forEach((button) => {
  button.addEventListener("click", () => {
    const launcher = document.querySelector(".ragw-button");
    if (launcher) launcher.click();
    else openSetup("Connect the widget before opening product support.");
  });
});

const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".main-nav");
menuButton.addEventListener("click", () => {
  const open = navigation.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});
navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  navigation.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}));

const searchBar = document.querySelector(".search-bar");
document.querySelector(".search-toggle").addEventListener("click", () => {
  searchBar.hidden = false;
  document.querySelector("#site-search").focus();
});
document.querySelector(".search-close").addEventListener("click", () => { searchBar.hidden = true; });

let cartCount = 0;
document.querySelectorAll(".add-cart").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("added")) return;
    cartCount += 1;
    document.querySelector(".cart-count").textContent = String(cartCount);
    button.classList.add("added");
    button.textContent = "Added to cart";
    showToast("Product added to your demo cart");
  });
});

loadWidget(readConfig());
