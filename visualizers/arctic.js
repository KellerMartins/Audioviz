console.log("arctic.js: Script loaded");

let visualizer = (function () {
  let visualizerCanvas;
  let visualizerCtx;
  let backgroundCanvas;
  let backgroundCtx;
  let animationId;
  let bufferLength;
  let dataArray;
  let analyser;
  let audioContext;
  let mediaStreamSource;
  let history = [];
  const historyLength = 135;
  const horizonY = 0.2;
  const vanishingPoint = { x: 0.5, y: horizonY };
  const zSpeed = -0.015;

  // Camera controls
  const startZ = 2;
  let heightOffset = -0.2;
  let pitchRotation = 0.05;

  const minIntensity = 0.6; // Minimum intensity
  const maxIntensity = 1.0; // Maximum intensity

  const lowIntensityColor = { r: 0, g: 155, b: 255 };
  const highIntensityColor = { r: 255, g: 255, b: 255 };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(color1, color2, t) {
    return {
      r: Math.floor(lerp(color1.r, color2.r, t)),
      g: Math.floor(lerp(color1.g, color2.g, t)),
      b: Math.floor(lerp(color1.b, color2.b, t)),
    };
  }

  function setupVisualizer() {
    visualizerCanvas = document.getElementById("visualizerCanvas");
    visualizerCtx = visualizerCanvas.getContext("2d");
    backgroundCanvas = document.getElementById("backgroundCanvas");
    backgroundCtx = backgroundCanvas.getContext("2d");

    visualizerCanvas.width = window.innerWidth;
    visualizerCanvas.height = window.innerHeight;
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;

    document.getElementById("tabTitle").style.color = "white";

    let canvasContainer = document.getElementById("canvasContainer");
    canvasContainer.style.background =
      "linear-gradient(22deg, rgb(184, 223, 254), hsl(203 40% 63% / 1), rgb(255 255 255))";
    // canvasContainer.style.filter = "invert(1) hue-rotate(-112deg)"; // Optional, dark mode

    window.addEventListener("resize", () => {
      visualizerCanvas.width = window.innerWidth;
      visualizerCanvas.height = window.innerHeight;
      backgroundCanvas.width = window.innerWidth;
      backgroundCanvas.height = window.innerHeight;
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
      }
    });

    window.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowUp":
          heightOffset -= 0.05;
          break;
        case "ArrowDown":
          heightOffset += 0.05;
          break;
        case "ArrowLeft":
          pitchRotation += 0.05;
          break;
        case "ArrowRight":
          pitchRotation -= 0.05;
          break;
      }
    });
  }

  function setMediaStreamSource(source, context) {
    mediaStreamSource = source;
    audioContext = context;

    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      history = Array(historyLength)
        .fill(null)
        .map(() => ({
          data: new Uint8Array(bufferLength),
          z: startZ,
          intensity: 0,
        }));
    }

    mediaStreamSource.connect(analyser);
    drawVisualizer();
  }

  function project(x, y, z) {
    const fov = 90;
    const f = 1 / Math.tan((fov * Math.PI) / 180 / 2);
    const aspect = visualizerCanvas.width / visualizerCanvas.height;
    const zNear = 0.1;
    const zFar = 100;

    const yRotated = y * Math.cos(pitchRotation) - z * Math.sin(pitchRotation);
    const zRotated = y * Math.sin(pitchRotation) + z * Math.cos(pitchRotation);
    const yOffset = yRotated + heightOffset;

    const projectedX = ((f / aspect) * x) / (zRotated + zNear);
    const projectedY = (f * yOffset) / (zRotated + zNear);

    const screenX = (projectedX + 1) * 0.5 * visualizerCanvas.width;
    const screenY = (1 - (projectedY + 1) * 0.5) * visualizerCanvas.height;
    return { x: screenX, y: screenY };
  }

  function drawVisualizer() {
    animationId = requestAnimationFrame(drawVisualizer);

    if (!dataArray) {
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        history = Array(historyLength)
          .fill(null)
          .map(() => ({
            data: new Uint8Array(bufferLength),
            z: startZ,
            intensity: 0,
          }));
      } else return;
    }
    analyser.getByteTimeDomainData(dataArray);

    let max = 0;
    for (let i = 0; i < dataArray.length; i++) {
      max = Math.max(max, dataArray[i]);
    }

    let newData = new Uint8Array(dataArray);
    history.push({ data: newData, z: startZ, intensity: max / 255 });
    if (history.length > historyLength) {
      history.shift();
    }

    for (let i = 0; i < history.length; i++) {
      history[i].z += zSpeed;
    }

    visualizerCtx.clearRect(
      0,
      0,
      visualizerCanvas.width,
      visualizerCanvas.height
    );

    const gridSpacingX = 40;
    const amplitudeScale = visualizerCanvas.height * 0.2;

    // Draw horizontal slices
    for (let h = history.length - 2; h >= 0; h--) {
      let currentData = history[h].data;
      let currentZ = history[h].z;
      let currentMaxIntensity = history[h].intensity;

      let nextData = history[h + 1].data;
      let nextZ = history[h + 1].z;

      // Skip if *either* line is out of range
      if (currentZ < -0.1 || currentZ > startZ + 0.1) continue; //add a tolerance
      if (nextZ < -0.1 || nextZ > startZ + 0.1) continue;

      const alpha = Math.max(0.1, 1 / (1 + Math.abs(currentZ)));

      let t =
        (currentMaxIntensity - minIntensity) / (maxIntensity - minIntensity);
      t = Math.max(0, Math.min(1, t));
      let interpolatedColor = lerpColor(
        lowIntensityColor,
        highIntensityColor,
        t
      );
      const color = `rgba(${interpolatedColor.r}, ${interpolatedColor.g}, ${interpolatedColor.b}, ${alpha})`;
      visualizerCtx.fillStyle = color;

      visualizerCtx.beginPath();

      // --- Current line ---
      let startX = -1;
      let startY = 0;
      let startPoint = project(startX, startY, currentZ);
      visualizerCtx.moveTo(startPoint.x, startPoint.y);

      for (
        let x = -1;
        x <= 1;
        x += (2 / visualizerCanvas.width) * gridSpacingX
      ) {
        const dataIndex = Math.floor(((x + 1) / 2) * bufferLength);
        const v = currentData ? currentData[dataIndex] / 128.0 : 1.0;
        const distortion = (v - 1) * amplitudeScale;
        const unprojectedX = x;
        const unprojectedY = distortion / visualizerCanvas.height;

        let projectedPoint = project(unprojectedX, unprojectedY, currentZ);
        visualizerCtx.lineTo(projectedPoint.x, projectedPoint.y);
      }
      let endPoint = project(1, 0, currentZ); //connect to the end
      visualizerCtx.lineTo(endPoint.x, endPoint.y);

      // --- Next line (now the *top* of the slice) ---
      let nextEndPoint = project(1, 0, nextZ); //connect to the end of the top line
      visualizerCtx.lineTo(nextEndPoint.x, nextEndPoint.y);
      for (
        let x = 1;
        x >= -1;
        x -= (2 / visualizerCanvas.width) * gridSpacingX
      ) {
        const dataIndex = Math.floor(((x + 1) / 2) * bufferLength);
        const v = nextData ? nextData[dataIndex] / 128.0 : 1.0;
        const distortion = (v - 1) * amplitudeScale;
        const unprojectedX = x;
        const unprojectedY = distortion / visualizerCanvas.height;

        let projectedPoint = project(unprojectedX, unprojectedY, nextZ);
        visualizerCtx.lineTo(projectedPoint.x, projectedPoint.y);
      }

      visualizerCtx.closePath();
      visualizerCtx.fill();
    }

    backgroundCtx.clearRect(
      0,
      0,
      backgroundCanvas.width,
      backgroundCanvas.height
    );
    backgroundCtx.drawImage(visualizerCanvas, 0, 0);
  }

  setupVisualizer();

  return {
    setMediaStreamSource: setMediaStreamSource,
  };
})();
