// Wire up the settings tabs: clicking a tab shows its panel.
function initTabs(root) {
  const tabs = root.querySelectorAll("[data-tab]");
  const panels = root.querySelectorAll("[data-panel]");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function () {
      panels.forEach((p) => p.setAttribute("hidden", ""));
      tabs.forEach((t) => t.classList.remove("active"));
      panels[i].removeAttribute("hidden");
      tabs[i].classList.add("active");
    });
  }
}

export { initTabs };
