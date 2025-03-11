let audioContext;
let mediaStreamSource;
let sourceTabId = null;
let sourceStream = null;
let mediaRecorder;
let isCapturing = false;

console.log("sidepanel.js: Script loaded");

chrome.storage.local.get(["sourceTabTitle", "sourceTabId"], (result) => {
  console.log("sidepanel.js: Got data from storage:", result);
  if (result.sourceTabTitle) {
    document.getElementById("tabTitle").textContent = result.sourceTabTitle;
  }
  if (result.sourceTabId) {
    sourceTabId = result.sourceTabId;
    captureAudio(sourceTabId);
  }
});

chrome.storage.local.onChanged.addListener((changes) => {
  console.log("sidepanel.js: storage.local.onChanged", changes);
  if (changes.sourceTabId) {
    sourceTabId = changes.sourceTabId.newValue;
    captureAudio(sourceTabId);
  }
});

function captureAudio(tabId) {
  if (sourceStream) {
    sourceStream.getTracks().forEach((track) => track.stop());
    if (mediaStreamSource) {
      mediaStreamSource.disconnect();
      mediaStreamSource = null;
    }
    if (mediaRecorder) {
      mediaRecorder.stop();
      isCapturing = false;
    }
  }

  console.log("sidepanel.js: Capturing tab:", tabId);
  chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
    if (chrome.runtime.lastError) {
      console.error(
        "sidepanel.js: Error capturing tab:",
        chrome.runtime.lastError
      );
      return;
    }
    if (!stream) {
      console.error("sidepanel.js: Stream is null after capture.");
      return;
    }

    sourceStream = stream;
    console.log("sidepanel.js: Tab captured, stream:", sourceStream);
    handleStream(sourceStream);
  });
}

async function handleStream(stream) {
  console.log("sidepanel.js: handleStream called", stream);
  if (!audioContext) {
    console.log("sidepanel.js: Creating AudioContext");
    audioContext = new AudioContext();
  }
  const newStream = new MediaStream();
  const audioTrack = stream.getAudioTracks()[0];
  newStream.addTrack(audioTrack);

  mediaStreamSource = audioContext.createMediaStreamSource(newStream);
  console.log("sidepanel.js: mediaStreamSource created", mediaStreamSource);

  const analyser = audioContext.createAnalyser();
  mediaStreamSource.connect(analyser);
  console.log("sidepanel.js: mediaStreamSource connected to analyser");

  audioTrack.onended = () => {
    console.log("sidepanel.js: Audio track ended");
    if (mediaRecorder) {
      mediaRecorder.stop();
      isCapturing = false;
    }
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  };
}

const targetTabPorts = new Map();

chrome.runtime.onConnect.addListener(function (port) {
  console.log("sidepanel.js: onConnect", port.name);
  if (port.name.startsWith("target-tab-")) {
    const tabId = parseInt(port.name.split("-")[2], 10);
    console.log("sidepanel.js: New target tab connection. Tab ID:", tabId);

    targetTabPorts.set(tabId, port);

    port.onDisconnect.addListener(() => {
      console.log("sidepanel.js: Target tab port disconnected. Tab ID:", tabId);
      targetTabPorts.delete(tabId);
      if (targetTabPorts.size === 0 && mediaRecorder) {
        mediaRecorder.stop();
        isCapturing = false;
      }
    });

    port.onMessage.addListener((msg) => {
      console.log(
        "sidepanel.js: Message from target tab:",
        msg,
        "Tab ID:",
        tabId
      );
      if (msg.type === "requestAudio") {
        if (!isCapturing && mediaStreamSource) {
          startRecording(port);
        } else if (mediaRecorder && mediaRecorder.state === "recording") {
        } else {
          console.log("sidepanel.js: Sending audioNotReady to tab:", tabId);
          port.postMessage({ type: "audioNotReady" });
        }
      }
    });
  }
});

function startRecording(port) {
  if (isCapturing) return;

  console.log("sidepanel.js: Starting MediaRecorder");
  mediaRecorder = new MediaRecorder(sourceStream, {
    mimeType: "audio/webm;codecs=opus",
  });

  mediaRecorder.ondataavailable = async (event) => {
    // console.log("sidepanel.js: ondataavailable", event.data);
    if (event.data.size > 0) {
      const arrayBuffer = await event.data.arrayBuffer();
      // Convert ArrayBuffer to a plain array.  This is the key change.
      const plainArray = Array.from(new Uint8Array(arrayBuffer));

      if (targetTabPorts.size > 0) {
        for (const [tabId, port] of targetTabPorts) {
          // Send the plain array *directly*.
          port.postMessage(plainArray);
        }
      }
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error("sidepanel.js: MediaRecorder error:", event.error);
  };

  mediaRecorder.onstart = () => {
    console.log("sidepanel.js: MediaRecorder started");
    isCapturing = true;
  };
  mediaRecorder.start(20);
}
