console.log("visualizer.js: Script loaded");
let visualizer = (function () {
  let visualizerCanvas;
  let backgroundCanvas;
  let visualizerCtx;
  let backgroundCtx;
  let animationId;
  let particles = [];
  let bufferLength;
  let dataArray;
  let analyser; // Analyser is now here
  let audioContext;
  let mediaStreamSource;

  class Particle {
    constructor(x, y, radius, color, velocity) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.color = color;
      this.velocity = velocity;
      this.alpha = 1;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.restore();
    }

    update() {
      this.draw(visualizerCtx);
      this.x += this.velocity.x;
      this.y += this.velocity.y;
      this.alpha -= 0.01;
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
    visualizerCanvas = document.getElementById("visualizerCanvas");
    backgroundCanvas = document.getElementById("backgroundCanvas");
    visualizerCtx = visualizerCanvas.getContext("2d");
    backgroundCtx = backgroundCanvas.getContext("2d");

    visualizerCanvas.width = window.innerWidth;
    visualizerCanvas.height = window.innerHeight;
    backgroundCanvas.width = window.innerWidth;
    backgroundCanvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
      visualizerCanvas.width = window.innerWidth;
      visualizerCanvas.height = window.innerHeight;
      backgroundCanvas.width = window.innerWidth;
      backgroundCanvas.height = window.innerHeight;

      // Recalculate bufferLength after resize
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
      }
    });

    // Don't start drawing until the media stream source is set
    // drawVisualizer(); // Removed from here
  }

  function setMediaStreamSource(source, context) {
    mediaStreamSource = source;
    audioContext = context;

    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    mediaStreamSource.connect(analyser);
    drawVisualizer(); // Start drawing *after* connecting the analyser
  }

  function drawVisualizer() {
    animationId = requestAnimationFrame(drawVisualizer);

    if (!dataArray) {
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
      } else return; // Wait for the analyser to be initialized.
    }

    analyser.getByteTimeDomainData(dataArray);

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

    const centerX = visualizerCanvas.width / 2;
    const centerY = visualizerCanvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.5;
    let lastX, lastY;

    const colorStops = [
      { intensity: 0, color: { r: 0, g: 0, b: 255 } },
      { intensity: 0.33, color: { r: 0, g: 155, b: 255 } },
      { intensity: 0.66, color: { r: 128, g: 0, b: 255 } },
      { intensity: 1, color: { r: 255, g: 0, b: 255 } },
    ];

    for (let i = 0; i < bufferLength; i++) {
      const angle = (i / bufferLength) * 2 * Math.PI;
      const v = dataArray[i] / 128.0;
      const amp = (v * radius) / 4 + radius;
      const x = centerX + amp * Math.cos(angle);
      const y = centerY + amp * Math.sin(angle);
      const intensity = dataArray[i] / 255;

      let color1, color2;
      for (let j = 0; j < colorStops.length - 1; j++) {
        if (
          intensity >= colorStops[j].intensity &&
          intensity <= colorStops[j + 1].intensity
        ) {
          color1 = colorStops[j].color;
          color2 = colorStops[j + 1].color;
          let t =
            (intensity - colorStops[j].intensity) /
            (colorStops[j + 1].intensity - colorStops[j].intensity);
          var interpolatedColor = lerpColor(color1, color2, t);
          break;
        }
      }

      const color = `rgb(${interpolatedColor.r}, ${interpolatedColor.g}, ${interpolatedColor.b})`;
      visualizerCtx.strokeStyle = color;
      visualizerCtx.lineWidth = 2 + intensity * 10;

      if (i === 0) {
        visualizerCtx.moveTo(x, y);
        backgroundCtx.moveTo(x, y);
        lastX = x;
        lastY = y;
      } else {
        visualizerCtx.beginPath();
        visualizerCtx.moveTo(lastX, lastY);
        visualizerCtx.lineTo(x, y);
        visualizerCtx.stroke();

        backgroundCtx.strokeStyle = color;
        backgroundCtx.lineWidth = 4 + intensity * 20;
        backgroundCtx.beginPath();
        backgroundCtx.moveTo(lastX, lastY);
        backgroundCtx.lineTo(x, y);
        backgroundCtx.stroke();

        lastX = x;
        lastY = y;
      }

      if (intensity > 0.88 && Math.random() < 0.1) {
        const particleRadius = Math.random() * 3 + 1;
        const particleVelocity = {
          x: (Math.random() - 0.5) * 6,
          y: (Math.random() - 0.5) * 6,
        };
        particles.push(
          new Particle(x, y, particleRadius, color, particleVelocity)
        );
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if (particles[i].alpha <= 0) {
        particles.splice(i, 1);
      }
    }
  }
  setupVisualizer();

  return {
    setMediaStreamSource: setMediaStreamSource, // Expose this function
  };
})();
