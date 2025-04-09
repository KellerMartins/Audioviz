console.log("horizon.js: Script loaded");

let visualizer = (function () {
  let visualizerCanvas;
  let visualizerCtx;
  let backgroundCanvas;
  let backgroundCtx;
  let beatAnalyser;
  let beatArray;
  let audioContext;
  let delayNode;
  let mediaStreamSource;

  let circles = []; // Array to store circles

  let lastCalc = 0;
  let lastBeat = { x: 0, y: 0.1, time: 0, sequence: 0 };

  // Camera controls
  const startZ = 4;
  const endZ = 0.1;
  const hitTolerance = 0.05;
  let noteDuration = 3; // Default note duration
  let audioDelay = 290; // Default audio delay in ms

  let heightOffset = 0;
  let pitchRotation = 0;

  const lowIntensityColor = { r: 33, g: 5, b: 2 };
  const highIntensityColor = { r: 255, g: 255, b: 255 };

  // Cursor tracking variables
  let cursorX = 0;
  let cursorY = 0;

  // Score variables
  let score = 0;
  let scoreDisplay = null;
  let precisionDisplay = null;
  let precisionFadeOutTimeout = null;

  // --- UI Style String ---
  const uiStyle = `
    #sliderContainer {
      position: absolute;
      bottom: 10px;
      left: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 1000; /* Ensure it's on top */
    }

    .slider-label {
      color: #ccc;
      font-family: monospace;
      font-size: 12px;
      user-select: none; /* Prevent text selection */
      width: 100px;
    }

    .slider-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .slider {
      width: 150px;
      background: #444;
      appearance: none;
      height: 5px;
      border-radius: 5px;
      outline: none;
      cursor: pointer;
      -webkit-appearance: none;
      -moz-appearance: none;
    }

    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ccc;
      border: none;
      cursor: pointer;
    }

    .slider::-webkit-slider-runnable-track {
      background: #666;
      height: 5px;
      border-radius: 5px;
    }
    .slider-value {
        color: #ccc;
        font-family: monospace;
        font-size: 12px;
        user-select: none;
        width: 30px;
        text-align: right;
    }
    #scoreDisplay {
        position: absolute;
        top: 10px;
        right: 10px;
        color: white;
        font-family: monospace;
        font-size: 100px;
        z-index: 1000;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }
    #precisionDisplay {
        position: absolute;
        top: 100px;
        right: 10px;
        color: #ffffff69;
        font-family: monospace;
        font-size: 64px;
        z-index: 1000;
        opacity: 1;
        font-style: italic;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }
    #precisionDisplay.hide {
        opacity: 0;
    }
  `;

  // Hit accuracy enum
  const HitAccuracy = {
    PERFECT: "perfect",
    CLOSE: "close",
    MISS: "miss",
  };

  class Circle {
    constructor(x, y, creationTime) {
      this.x = x;
      this.y = y;
      this.z = startZ;
      this.radius = 0;
      this.radiusMultiplier = 15;
      this.maxRadius = 120;
      this.creationTime = creationTime;
      this.color = "white";
      this.hit = null;
      this.finished = false;
    }

    update(currentTime) {
      const timeElapsed = currentTime - this.creationTime;

      if (timeElapsed < noteDuration) {
        const progress = timeElapsed / noteDuration;
        this.z = startZ + (endZ - startZ) * progress;
      } else {
        this.z = endZ;
      }

      this.radius = Math.max(
        0,
        Math.min(this.maxRadius, this.radiusMultiplier * (1 / this.z))
      );

      let startedJudgment =
        this.creationTime + noteDuration < currentTime + hitTolerance;
      if (startedJudgment) {
        const projected = project(this.x, this.y, this.z);
        let distanceToCursor = Math.sqrt(
          Math.pow(cursorX - projected.x, 2) +
            Math.pow(cursorY - projected.y, 2)
        );

        if (distanceToCursor < this.radius) {
          this.hit = HitAccuracy.PERFECT;
          this.finished = timeElapsed >= noteDuration;
        } else if (
          this.hit !== HitAccuracy.PERFECT &&
          distanceToCursor < this.radius * 1.5
        ) {
          this.hit = HitAccuracy.CLOSE;
        }
      }

      let finishedJudgment =
        this.creationTime + noteDuration < currentTime - hitTolerance;
      if (finishedJudgment) {
        if (!this.hit) this.hit = HitAccuracy.MISS;

        this.finished = true;
      }
    }

    draw(ctx) {
      const projected = project(this.x, this.y, this.z);

      const lineWidth = this.finished
        ? 20
        : Math.min(10, Math.max(1, 4 * (1 / this.z)));
      const alpha = 1;
      ctx.lineWidth = lineWidth;

      let t = Math.min(1, Math.max(0, 1 - this.z / startZ));
      let interpolatedColor = lerpColor(
        lowIntensityColor,
        highIntensityColor,
        t
      );

      const color = this.finished
        ? this.hit === HitAccuracy.PERFECT
          ? "limegreen"
          : this.hit === HitAccuracy.CLOSE
          ? "cyan"
          : "crimson"
        : `rgba(${interpolatedColor.r}, ${interpolatedColor.g}, ${interpolatedColor.b}, ${alpha})`;

      ctx.beginPath();
      ctx.arc(projected.x, projected.y, this.radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.stroke();

      if (this.finished && this.hit === HitAccuracy.MISS) {
        this.drawMiss(ctx);
      }
    }

    drawMiss(ctx) {
      const projected = project(this.x, this.y, this.z);
      const crossSize = 20;
      ctx.beginPath();
      ctx.moveTo(projected.x - crossSize, projected.y - crossSize);
      ctx.lineTo(projected.x + crossSize, projected.y + crossSize);
      ctx.moveTo(projected.x + crossSize, projected.y - crossSize);
      ctx.lineTo(projected.x - crossSize, projected.y + crossSize);
      ctx.strokeStyle = "crimson";
      ctx.lineWidth = 20;
      ctx.stroke();
    }
  }

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
    console.log("horizon.js: Setting up visualizer");

    visualizerCanvas = document.getElementById("visualizerCanvas");
    visualizerCtx = visualizerCanvas.getContext("2d");
    backgroundCanvas = document.getElementById("backgroundCanvas");
    backgroundCtx = backgroundCanvas.getContext("2d");

    visualizerCanvas.width = window.innerWidth;
    visualizerCanvas.height = window.innerHeight;
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;
    backgroundCanvas.style.filter = "blur(40px) saturate(1.5)";

    document.body.style.background = "#000";
    document.body.style.cursor =
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' version='1.2' viewBox='0 0 16 16' width='16' height='16'%3E%3Cstyle%3E.s0%7Bopacity:.5;fill:%23fff%7D%3C/style%3E%3Cpath id='Background' fill-rule='evenodd' class='s0' d='m8 16c-4.4 0-8-3.6-8-8 0-4.4 3.6-8 8-8 4.4 0 8 3.6 8 8 0 4.4-3.6 8-8 8z'/%3E%3C/svg%3E\") 8 8, pointer";

    window.addEventListener("resize", () => {
      visualizerCanvas.width = window.innerWidth;
      visualizerCanvas.height = window.innerHeight;
      backgroundCanvas.width = window.innerWidth;
      backgroundCanvas.height = window.innerHeight;
    });

    // Add event listeners for mouse movement
    window.addEventListener("mousemove", (event) => {
      cursorX = event.clientX;
      cursorY = event.clientY;
    });

    // Add UI sliders
    setupSliders();
    injectUIStyle();
    setupScoreDisplay();
  }

  function injectUIStyle() {
    const style = document.createElement("style");
    style.textContent = uiStyle;
    document.head.appendChild(style);
  }

  function setupSliders() {
    // Container for sliders and labels
    const sliderContainer = document.createElement("div");
    sliderContainer.id = "sliderContainer";
    document.body.appendChild(sliderContainer);

    // --- Delay Slider ---
    const delaySliderContainer = createSliderWithLabel(
      "Audio Delay (ms)", // Inform that it is in ms
      "delaySlider",
      0,
      1000,
      1, // Step is now 1
      audioDelay
    );
    sliderContainer.appendChild(delaySliderContainer);

    const delaySlider = document.getElementById("delaySlider");
    const delayValue = document.getElementById("delaySliderValue");
    delaySlider.addEventListener("input", () => {
      audioDelay = parseInt(delaySlider.value); // Parse as int
      delayValue.textContent = audioDelay;
      updateDelay();
    });

    // --- Duration Slider ---
    const durationSliderContainer = createSliderWithLabel(
      "Note Duration",
      "durationSlider",
      1,
      10,
      0.1,
      noteDuration
    );
    sliderContainer.appendChild(durationSliderContainer);

    const durationSlider = document.getElementById("durationSlider");
    const durationValue = document.getElementById("durationSliderValue");
    durationSlider.addEventListener("input", () => {
      noteDuration = parseFloat(durationSlider.value);
      durationValue.textContent = noteDuration.toFixed(1);
      updateDelay();
    });
  }

  function createSliderWithLabel(labelText, sliderId, min, max, step, value) {
    const container = document.createElement("div");
    container.classList.add("slider-wrapper");

    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = sliderId;
    label.classList.add("slider-label");
    container.appendChild(label);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = value.toString();
    slider.id = sliderId;
    slider.classList.add("slider");
    container.appendChild(slider);

    const valueLabel = document.createElement("span");
    valueLabel.id = sliderId + "Value";
    valueLabel.classList.add("slider-value");
    valueLabel.textContent = value.toString();
    container.appendChild(valueLabel);

    return container;
  }

  function updateDelay() {
    if (delayNode) {
      delayNode.delayTime.value = getDelayTime();
    }
  }

  function getDelayTime() {
    return noteDuration - audioDelay / 1000;
  }

  function setMediaStreamSource(source, context) {
    mediaStreamSource = source;
    audioContext = context;

    beatAnalyser = audioContext.createAnalyser();
    beatAnalyser.fftSize = 2048;
    beatArray = new Uint8Array(beatAnalyser.frequencyBinCount);

    delayNode = audioContext.createDelay(getDelayTime());
    delayNode.delayTime.value = getDelayTime();

    mediaStreamSource.connect(delayNode);
    mediaStreamSource.connect(beatAnalyser);

    delayNode.connect(audioContext.destination);

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

  function setupScoreDisplay() {
    scoreDisplay = document.createElement("div");
    scoreDisplay.id = "scoreDisplay";
    scoreDisplay.textContent = "";
    document.body.appendChild(scoreDisplay);

    precisionDisplay = document.createElement("div");
    precisionDisplay.id = "precisionDisplay";
    document.body.appendChild(precisionDisplay);
  }

  function updateScore(hitType) {
    let points = 0;
    let precisionText = "";
    switch (hitType) {
      case HitAccuracy.PERFECT:
        points = 100;
        precisionText = "Perfect!";
        break;
      case HitAccuracy.CLOSE:
        points = 50;
        precisionText = "Close!";
        break;
      case HitAccuracy.MISS:
        points = 0;
        precisionText = "Miss!";
        break;
    }
    score += points;
    scoreDisplay.textContent = score;

    // Display precision
    precisionDisplay.textContent = precisionText;
    clearTimeout(precisionFadeOutTimeout);
    precisionDisplay.classList.remove("hide");
    precisionFadeOutTimeout = setTimeout(() => {
      precisionDisplay.classList.add("hide");
    }, 100);
  }

  function drawVisualizer() {
    const now = performance.now();
    const currentTime = audioContext.currentTime;

    requestAnimationFrame(drawVisualizer);

    beatAnalyser.getByteFrequencyData(beatArray);

    let calc = beatArray.slice(0, 200).reduce((a, x) => a + x, 0) / 200;
    let beat = calc - lastCalc > 2;
    if (beat) {
      let spread =
        lastBeat.sequence > 0
          ? 0
          : Math.max(0, Math.min(1, (now - lastBeat.time) / 200));

      let x = lerp(lastBeat.x, Math.random() * 0.2 - 0.1, spread);
      let y = lerp(lastBeat.y, Math.random() * 0.2 - 0.1, spread);
      circles.push(new Circle(x, y, currentTime)); // New: Pass currentTime

      lastBeat = {
        x,
        y,
        time: now,
        sequence: lastBeat.sequence + 1,
      };
    } else {
      lastBeat.sequence = 0;
    }
    lastCalc = calc;

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

    // Update and draw circles
    for (let i = circles.length - 1; i >= 0; i--) {
      circles[i].update(currentTime);
      circles[i].draw(visualizerCtx);

      if (circles[i].finished) {
        circles.splice(i, 1);

        if (circles[i].hit) {
          updateScore(circles[i].hit);
        }
      }
    }

    // Draw line from center to cursor
    const centerX = visualizerCanvas.width / 2;
    const centerY = visualizerCanvas.height / 2;
    visualizerCtx.beginPath();
    visualizerCtx.moveTo(centerX, centerY);
    visualizerCtx.lineTo(cursorX, cursorY);
    visualizerCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    visualizerCtx.lineWidth = 1;
    visualizerCtx.stroke();

    backgroundCtx.drawImage(visualizerCanvas, 0, 0);
  }

  setupVisualizer();

  return {
    setMediaStreamSource: setMediaStreamSource,
  };
})();
