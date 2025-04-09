document.addEventListener("DOMContentLoaded", () => {
  const captureButton = document.getElementById("captureButton");
  const messageDiv = document.getElementById("message");
  const visualizerSelect = document.getElementById("visualizerSelect");

  chrome.storage.local.get(["selectedVisualizer"], (result) => {
    if (result.selectedVisualizer) {
      visualizerSelect.value = result.selectedVisualizer;
    }
  });

  captureButton.addEventListener("click", () => {
    messageDiv.textContent = "Capturing...";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        console.log(
          "popup.js: Capturing current tab:",
          currentTab.id,
          currentTab.title
        );

        // Store the tab ID and visualizer.
        chrome.storage.local.set({
          sourceTabId: currentTab.id,
          selectedVisualizer: visualizerSelect.value,
          reload: Date.now(),
        });

        // Open the side panel for the captured tab.
        chrome.sidePanel.open({ tabId: currentTab.id });
        window.close(); // Close the popup.
      } else {
        console.error("popup.js: No active tab found.");
      }
    });
  });
});
