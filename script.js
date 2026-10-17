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

styleSelect.id = "style-select";
styleSelect.name = "style";

for (const [value, label] of styles) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  styleSelect.append(option);
}

if (savedStyle && styles.some(([value]) => value === savedStyle)) {
  document.documentElement.dataset.style = savedStyle;
  styleSelect.value = savedStyle;
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

styleSelect.addEventListener("change", () => {
  const selectedStyle = styleSelect.value;

  document.documentElement.dataset.style = selectedStyle;
  localStorage.setItem("jfunk42-site-style", selectedStyle);
});
