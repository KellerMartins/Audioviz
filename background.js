console.log("background.js: Script loaded");

let sourceTabId = null; // Keep track of the source tab

chrome.storage.local.onChanged.addListener((changes) => {
  console.log("background.js: storage.local.onChanged", changes);
  if (changes.sourceTabId) {
    sourceTabId = changes.sourceTabId.newValue; // Update the sourceTabId
    chrome.sidePanel.open({ tabId: sourceTabId });
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === sourceTabId) {
    console.log("background.js: Source tab removed:", tabId);
    sourceTabId = null; // Clear the sourceTabId
  }
});

// Listen for tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === sourceTabId && changeInfo.status === "loading") {
    console.log("background.js: Source tab updated (loading):", tabId);
    sourceTabId = null;
  }
});
