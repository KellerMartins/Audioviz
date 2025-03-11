console.log("content.js: Script loaded");

let port = chrome.runtime.connect({ name: `target-tab-${chrome.runtime.id}` });
console.log("content.js: Connected to side panel with port name:", port.name);

port.onMessage.addListener((msg) => {
  // console.log("content.js: Message from side panel:", msg);
  // Check if the message is an array.
  if (Array.isArray(msg)) {
    // console.log(
    //   "content.js: Sending audioData array to webpage, size:",
    //   msg.length
    // );
    // Pass the plain array *directly* to the webpage.
    window.top.postMessage(msg, "*");
  } else if (msg.type === "audioNotReady") {
    console.warn("content.js: Received audioNotReady from side panel");
  }
});

window.addEventListener(
  "message",
  (event) => {
    // console.log("content.js: Message from webpage:", event);
    if (event.source === window && event.data.type === "fromWebPage") {
      if (event.data.action === "requestAudio") {
        // console.log("content.js: Sending requestAudio to side panel");
        port.postMessage({ type: "requestAudio" });
      }
    }
  },
  false
);

window.top.postMessage({ type: "fromContentScript", ready: true }, "*");
console.log("content.js: Sent ready message to webpage");
