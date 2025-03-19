console.log("synthwave.js: Script loaded");

let visualizer = (function () {
  let visualizerCanvas;
  let visualizerCtx;
  let backgroundCanvas;
  let backgroundCtx;
  let bufferLength;
  let dataArray;
  let analyser;
  let audioContext;
  let mediaStreamSource;
  let history = [];
  const historyLength = 135;
  const zSpeed = -0.03;

  // Camera controls
  const startZ = 4;
  let heightOffset = -0.1;
  let pitchRotation = 0.05;

  const minIntensity = 0.6; // Minimum intensity
  const maxIntensity = 1.0; // Maximum intensity

  const lowIntensityColor = { r: 155, g: 0, b: 255 };
  const highIntensityColor = { r: 0, g: 155, b: 255 };

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
    backgroundCanvas.style.filter = "blur(40px) saturate(1.5)";

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
    mediaStreamSource.connect(audioContext.destination);

    drawVisualizer();
  }

  function project(x, y, z) {
    const fov = 90;
    const f = 1 / Math.tan((fov * Math.PI) / 180 / 2);
    const aspect = visualizerCanvas.width / visualizerCanvas.height;
    const zNear = 0.1;

    const yRotated = y * Math.cos(pitchRotation) - z * Math.sin(pitchRotation);
    const zRotated = y * Math.sin(pitchRotation) + z * Math.cos(pitchRotation);
    const yOffset = yRotated + heightOffset;

    const projectedX = ((f / aspect) * x) / (zRotated + zNear);
    const projectedY = (f * yOffset) / (zRotated + zNear);

    const screenX = (projectedX + 1) * 0.5 * visualizerCanvas.width;
    const screenY = (1 - (projectedY + 1) * 0.5) * visualizerCanvas.height;
    return { x: screenX, y: screenY };
  }

  function drawSun(intensity) {
    const sunRadius = 30;
    const sunCenterX = 0.5 * visualizerCanvas.width;
    const sunCenterY = 0.524 * visualizerCanvas.height;
    const numRays = 40;
    const rayLength = 10;

    visualizerCtx.lineWidth = 2;

    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * 1.5 * Math.PI + Math.PI * 0.77;
      const color =
        Math.abs((i - numRays / 2) / (numRays / 2)) > 1 - intensity
          ? highIntensityColor
          : lowIntensityColor;

      visualizerCtx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      visualizerCtx.filter = `drop-shadow(0 0 5px ${visualizerCtx.strokeStyle})`;

      const rayStartX = sunCenterX + (sunRadius - rayLength) * Math.cos(angle);
      const rayStartY = sunCenterY + (sunRadius - rayLength) * Math.sin(angle);
      const rayEndX = sunCenterX + sunRadius * Math.cos(angle);
      const rayEndY = sunCenterY + sunRadius * Math.sin(angle);

      visualizerCtx.beginPath();
      visualizerCtx.moveTo(rayStartX, rayStartY);
      visualizerCtx.lineTo(rayEndX, rayEndY);
      visualizerCtx.stroke();
    }
    visualizerCtx.filter = "none";
  }

  function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

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
    backgroundCtx.clearRect(
      0,
      0,
      backgroundCanvas.width,
      backgroundCanvas.height
    );

    const gridSpacingX = 40;
    const amplitudeScale = visualizerCanvas.height * 0.5;

    drawSun((max / 255 - minIntensity) / (maxIntensity - minIntensity));

    // Draw horizontal lines
    for (let h = 0; h < history.length; h++) {
      let historicalData = history[h].data;
      let z = history[h].z;
      let currentMaxIntensity = history[h].intensity;

      if (z < -0.1 || z > startZ) continue;

      // Line width and alpha based on z
      const lineWidth = Math.max(1, 4 * (1 / (1 + Math.abs(4 - z))));
      const alpha = h === 0 ? 1 : Math.max(0.33, 1 / (1 + Math.abs(3 - z)));
      visualizerCtx.lineWidth = lineWidth;

      // Interpolate color based on intensity
      let t =
        (currentMaxIntensity - minIntensity) / (maxIntensity - minIntensity);
      t = Math.max(0, Math.min(1, t));
      let interpolatedColor = lerpColor(
        lowIntensityColor,
        highIntensityColor,
        t
      );
      const coloro = `rgba(${interpolatedColor.r}, ${interpolatedColor.g}, ${interpolatedColor.b}, ${alpha})`;
      const colort = `rgba(${interpolatedColor.r}, ${interpolatedColor.g}, ${interpolatedColor.b}, 0)`;
      const gradient = visualizerCtx.createLinearGradient(
        project(-1, 0, z).x,
        0,
        project(1, 0, z).x,
        0
      );

      gradient.addColorStop(0, colort);
      gradient.addColorStop(0.15, coloro);
      gradient.addColorStop(0.85, coloro);
      gradient.addColorStop(1, colort);
      visualizerCtx.strokeStyle = gradient;

      visualizerCtx.beginPath();
      let startX = -1;
      let startY = 0;
      let startPoint = project(startX, startY, z);
      visualizerCtx.moveTo(startPoint.x, startPoint.y);

      for (
        let x = -1;
        x <= 1;
        x += (2 / visualizerCanvas.width) * gridSpacingX
      ) {
        const dataIndex = Math.floor(((x + 1) / 2) * bufferLength);
        const v = historicalData ? historicalData[dataIndex] / 128.0 : 1.0;
        const distortion =
          (v - 1) *
          amplitudeScale *
          Math.min(Math.max(0, Math.pow(Math.abs(x), 1.33)), 1);
        const unprojectedX = x;
        const unprojectedY = distortion / visualizerCanvas.height;

        let projectedPoint = project(unprojectedX, unprojectedY, z);

        visualizerCtx.lineTo(projectedPoint.x, projectedPoint.y);
        startPoint = projectedPoint;
      }
      visualizerCtx.stroke();
    }

    // Draw vertical lines
    visualizerCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";

    for (
      let x = -0.33;
      x <= 0.33;
      x += (2 / visualizerCanvas.width) * gridSpacingX
    ) {
      visualizerCtx.beginPath();
      // Top point (at horizon)
      let topPoint = project(x, 0, startZ);

      // Bottom point (closer, but with a fixed z)
      let bottomPoint = project(x, 0, 0);

      visualizerCtx.moveTo(topPoint.x, topPoint.y);
      visualizerCtx.lineTo(bottomPoint.x, bottomPoint.y);
      visualizerCtx.stroke();
    }

    backgroundCtx.drawImage(visualizerCanvas, 0, 0);
  }

  setupVisualizer();

  return {
    setMediaStreamSource: setMediaStreamSource,
  };
})();
