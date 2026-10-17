const styleSelect = document.querySelector("#style-select");
const savedStyle = localStorage.getItem("jfunk42-site-style");

if (savedStyle && [...styleSelect.options].some((option) => option.value === savedStyle)) {
  document.documentElement.dataset.style = savedStyle;
  styleSelect.value = savedStyle;
}

styleSelect.addEventListener("change", () => {
  const selectedStyle = styleSelect.value;

  document.documentElement.dataset.style = selectedStyle;
  localStorage.setItem("jfunk42-site-style", selectedStyle);
});
