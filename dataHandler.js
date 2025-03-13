console.log("dataHandler.js: Script loaded");

let dataHandler = (function () {
  let audioContext;
  let mediaStreamSource;
  // let analyser; // Removed analyser from here
  let mediaSource;
  let sourceBuffer;
  let isCapturing = false;
  let mediaRecorder;

  function setupMediaSource() {
    if (mediaSource) return;

    mediaSource = new MediaSource();
    mediaSource.addEventListener("sourceopen", handleSourceOpen);
    mediaSource.addEventListener("sourceended", () =>
      console.log("dataHandler.js: MediaSource ended")
    );
    mediaSource.addEventListener("sourceclose", () =>
      console.log("dataHandler.js: MediaSource closed")
    );
    const audio = new Audio();
    audio.src = URL.createObjectURL(mediaSource);
    audio.play().catch((e) => {
      console.log("dataHandler.js: Suppressed play() error:", e.message);
    });
  }

  function handleSourceOpen() {
    console.log("dataHandler.js: MediaSource opened");
    try {
      sourceBuffer = mediaSource.addSourceBuffer("audio/webm; codecs=opus");
    } catch (e) {
      console.error("dataHandler.js: Error adding source buffer:", e);
      return;
    }

    sourceBuffer.addEventListener("updateend", () => {});

    sourceBuffer.addEventListener("error", (e) => {
      console.error("dataHandler.js: SourceBuffer error:", e);
    });
    sourceBuffer.addEventListener("abort", (e) => {
      console.log("dataHandler.js: SourceBuffer aborted:", e);
    });
  }

  function handleStream(stream) {
    console.log("dataHandler.js: handleStream called", stream);

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const newStream = new MediaStream();
    const audioTrack = stream.getAudioTracks()[0];
    newStream.addTrack(audioTrack);
    mediaStreamSource = audioContext.createMediaStreamSource(newStream);

    // Connect the mediaStreamSource to the visualizer
    if (visualizer && visualizer.setMediaStreamSource) {
      visualizer.setMediaStreamSource(mediaStreamSource, audioContext);
    }

    setupMediaSource();
    startRecording(stream);
  }

  function startRecording(stream) {
    if (isCapturing) return;
    console.log("dataHandler.js: Starting MediaRecorder");

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const arrayBuffer = await event.data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // No longer sending data to the visualizer here

        if (sourceBuffer && !sourceBuffer.updating) {
          try {
            sourceBuffer.appendBuffer(uint8Array);
            if (audioContext?.state === "suspended") {
              audioContext.resume();
            }
          } catch (error) {
            console.error("Error appending buffer:", error);
          }
        }
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("dataHandler.js: MediaRecorder error:", event.error);
    };

    mediaRecorder.onstart = () => {
      console.log("dataHandler.js: MediaRecorder started");
      isCapturing = true;
      updateStatusIndicator();
    };

    mediaRecorder.onstop = () => {
      console.log("dataHandler.js: MediaRecorder stopped");
      isCapturing = false;
    };

    mediaRecorder.start(20);
  }
  function cleanup() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      isCapturing = false;
    }
    if (mediaStreamSource) {
      mediaStreamSource.disconnect();
      mediaStreamSource = null;
    }
    if (audioContext) {
      try {
        audioContext.close(); //close context
      } catch (e) {
        console.warn("Error while closing audioContext", e);
      }
      audioContext = null;
    }

    if (mediaSource) {
      if (mediaSource.readyState === "open") {
        try {
          mediaSource.endOfStream();
        } catch (e) {
          console.warn("Media source was not open", e);
        }
      }
      mediaSource = null;
    }
  }

  return {
    handleStream: handleStream,
    cleanup: cleanup,
  };
})();
