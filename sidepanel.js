let sourceTabId = null;
let sourceStream = null;
let mediaRecorder;
let isCapturing = false;
let statusIndicator = null;
let tabTitleUpdateInterval = null;

console.log("sidepanel.js: Script loaded");

function updateTabTitle() {
  if (sourceTabId) {
    chrome.tabs.get(sourceTabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(
          "sidepanel.js: Error getting tab info:",
          chrome.runtime.lastError
        );
        clearInterval(tabTitleUpdateInterval);
        return;
      }
      if (tab && tab.title) {
        document.getElementById("tabTitle").textContent = tab.title;
      }
    });
  }
}

chrome.storage.local.get(["sourceTabTitle", "sourceTabId"], (result) => {
  console.log("sidepanel.js: Got data from storage:", result);
  if (result.sourceTabTitle) {
    document.getElementById("tabTitle").textContent = result.sourceTabTitle;
  }
  if (result.sourceTabId) {
    sourceTabId = result.sourceTabId;
    captureAudio(sourceTabId);
    tabTitleUpdateInterval = setInterval(updateTabTitle, 1000);
  }
});

chrome.storage.local.onChanged.addListener((changes) => {
  console.log("sidepanel.js: storage.local.onChanged", changes);
  if (changes.sourceTabTitle) {
    document.getElementById("tabTitle").textContent =
      changes.sourceTabTitle.newValue;
  }
  if (changes.sourceTabId) {
    if (tabTitleUpdateInterval) {
      clearInterval(tabTitleUpdateInterval);
    }
    sourceTabId = changes.sourceTabId.newValue;
    if (sourceTabId) {
      captureAudio(sourceTabId);
      tabTitleUpdateInterval = setInterval(updateTabTitle, 1000);
    } else {
      document.getElementById("tabTitle").textContent = "";
    }
  }
});

function captureAudio(tabId) {
  if (sourceStream) {
    sourceStream.getTracks().forEach((track) => track.stop());
    if (dataHandler && dataHandler.cleanup) {
      // Check if dataHandler exists
      dataHandler.cleanup(); // Clean up MediaSource
    }
    if (mediaRecorder) {
      mediaRecorder.stop();
      isCapturing = false;
      updateStatusIndicator();
    }
  }

  console.log("sidepanel.js: Capturing tab:", tabId);
  chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
    if (chrome.runtime.lastError) {
      console.error(
        "sidepanel.js: Error capturing tab:",
        chrome.runtime.lastError
      );
      statusIndicator.style.backgroundColor = "red";
      return;
    }
    if (!stream) {
      console.error("sidepanel.js: Stream is null after capture.");
      statusIndicator.style.backgroundColor = "red";
      return;
    }

    sourceStream = stream;
    console.log("sidepanel.js: Tab captured, stream:", sourceStream);

    if (dataHandler && dataHandler.handleStream) {
      dataHandler.handleStream(sourceStream); // Pass the stream to dataHandler
    } else {
      console.error("dataHandler is not ready");
    }
    stream.onended = () => {
      console.log("sidepanel.js: Audio track ended");

      if (mediaRecorder) {
        mediaRecorder.stop();
      }
      isCapturing = false;
      updateStatusIndicator();
      if (dataHandler && dataHandler.cleanup) {
        // Check if dataHandler exists
        dataHandler.cleanup(); // Clean up MediaSource
      }
    };
  });
}
function updateStatusIndicator() {
  if (!statusIndicator) {
    statusIndicator = document.getElementById("statusIndicator");
  }
  if (isCapturing) {
    statusIndicator.style.backgroundColor = "#00aaff";
  } else {
    statusIndicator.style.backgroundColor = "transparent";
  }
}
