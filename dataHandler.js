console.log("dataHandler.js: Script loaded");

let dataHandler = (function () {
  let audioContext;
  let mediaStreamSource;

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
  }

  return {
    handleStream: handleStream,
  };
})();
