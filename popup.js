document.addEventListener("DOMContentLoaded", () => {
  const captureButton = document.getElementById("captureButton");

  captureButton.addEventListener("click", () => {
    // Get the currently active tab.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        console.log(
          "popup.js: Capturing current tab:",
          currentTab.id,
          currentTab.title
        );

        // Store the tab ID and title.
        chrome.storage.local.set({
          sourceTabId: currentTab.id,
          sourceTabTitle: currentTab.title,
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
