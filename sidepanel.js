console.log("sidepanel.js: Script loaded");

function updateTabTitle(sourceTabId) {
  chrome.tabs.get(sourceTabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error(
        "sidepanel.js: Error getting tab info:",
        chrome.runtime.lastError
      );
      return;
    }

    if (tab && tab.title) {
      document.getElementById("tabTitle").textContent = tab.title;
    }
  });
}

chrome.storage.local.get(["sourceTabId", "selectedVisualizer"], (result) => {
  console.log("sidepanel.js: Got data from storage:", result);

  if (result.selectedVisualizer) {
    const script = document.createElement("script");
    script.src = `visualizers/${result.selectedVisualizer}.js`;
    document.body.appendChild(script);
  }

  if (result.sourceTabId) {
    captureAudio(result.sourceTabId);
    updateTabTitle(result.sourceTabId);
    setInterval(() => updateTabTitle(result.sourceTabId), 1000);
  }
});

chrome.storage.local.onChanged.addListener((changes) => {
  console.log("sidepanel.js: storage.local.onChanged", changes);
  if (changes.selectedVisualizer || changes.sourceTabId || changes.reload) {
    window.location.reload();
  }
});

function captureAudio(tabId) {
  console.log("sidepanel.js: Capturing tab:", tabId);

  chrome.tabCapture.capture({ audio: true, video: false }, (sourceStream) => {
    if (chrome.runtime.lastError) {
      console.error(
        "sidepanel.js: Error capturing tab:",
        chrome.runtime.lastError
      );
      statusIndicator.style.backgroundColor = "red";
      return;
    }

    if (!sourceStream) {
      console.error("sidepanel.js: Stream is null after capture.");
      statusIndicator.style.backgroundColor = "red";
      return;
    }

    console.log("sidepanel.js: Tab captured, stream:", sourceStream);

    if (dataHandler && dataHandler.handleStream) {
      dataHandler.handleStream(sourceStream); // Pass the stream to dataHandler
    } else {
      console.error("sidepanel.js: dataHandler is not ready");
      statusIndicator.style.backgroundColor = "red";
    }
  });
}
