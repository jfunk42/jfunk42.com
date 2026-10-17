const styles = [
  ["ocean-sunset", "Ocean Sunset"],
  ["classic-blue", "Classic Blue"],
  ["retro-terminal", "Retro Terminal"],
  ["industrial-space", "Industrial Space"],
  ["time-vortex", "Time Vortex"],
  ["cosmic-guide", "Cosmic Guide"],
];
const styleSelect = document.createElement("select");
const savedStyle = localStorage.getItem("jfunk42-site-style");
const hasSavedStyle = styles.some(([value]) => value === savedStyle);
const initialStyle = hasSavedStyle
  ? savedStyle
  : styles[Math.floor(Math.random() * styles.length)][0];

styleSelect.id = "style-select";
styleSelect.name = "style";

for (const [value, label] of styles) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  styleSelect.append(option);
}

document.documentElement.dataset.style = initialStyle;
styleSelect.value = initialStyle;

if (!hasSavedStyle) {
  localStorage.setItem("jfunk42-site-style", initialStyle);
}

const footer = document.createElement("footer");
const selector = document.createElement("div");
const label = document.createElement("label");

footer.className = "site-style-footer";
selector.className = "style-selector";
label.htmlFor = styleSelect.id;
label.textContent = "Site style";
selector.append(label, styleSelect);
footer.append(selector);
document.body.append(footer);

function trackTheme(eventName, parameters) {
  if (typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, parameters);
}

document.addEventListener("DOMContentLoaded", () => {
  trackTheme("site_theme_viewed", {
    theme_name: initialStyle,
  });

  if (!hasSavedStyle) {
    trackTheme("site_theme_assigned", {
      theme_name: initialStyle,
      selection_method: "random",
    });
  }
}, { once: true });

styleSelect.addEventListener("change", () => {
  const previousStyle = document.documentElement.dataset.style;
  const selectedStyle = styleSelect.value;

  document.documentElement.dataset.style = selectedStyle;
  localStorage.setItem("jfunk42-site-style", selectedStyle);
  trackTheme("site_theme_changed", {
    theme_from: previousStyle,
    theme_to: selectedStyle,
  });
});
