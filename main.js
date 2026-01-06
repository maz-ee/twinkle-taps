const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
let needsRotate = false;

//resize
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function handleOrientation() {
  const portrait = isMobile && window.innerHeight > window.innerWidth;
  const prev = needsRotate;
  needsRotate = portrait;

  if (prev && !needsRotate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeCanvas();
        resetWorld();
      });
    });
  }
}

resizeCanvas();
handleOrientation();

window.addEventListener("resize", () => {
  resizeCanvas();
  handleOrientation();
});

const orientationQuery = window.matchMedia("(orientation: portrait)");
orientationQuery.addEventListener("change", handleOrientation);

const playerImg = new Image();
playerImg.src = "player.png";

const playerHitImg = new Image();
playerHitImg.src = "player_hit.png";
let currentPlayerImg = playerImg;

const starImg = new Image();
starImg.src = "star.png";

const bgImg = new Image();
bgImg.src = "background.png";
let bgLoaded = false;
bgImg.onload = () => (bgLoaded = true);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

document.body.addEventListener("touchstart", () => audioCtx.resume(), {
  once: true,
});

const melody = [
  261.63, 261.63, 392.0, 392.0, 440.0, 440.0, 392.0, 349.23, 349.23, 329.63,
  329.63, 293.66, 293.66, 261.63,
];
let melodyIndex = 0;

const minFreq = Math.min(...melody);
const maxFreq = Math.max(...melody);

function playNote(freq) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.7);
}

const gravity = 1300;
const groundY = () => canvas.height * 0.75;
const levelWidth = 6000;

const PLAYER_SIZE = isMobile ? 72 : 60;

const player = {
  x: 100,
  y: 0,
  w: PLAYER_SIZE,
  h: PLAYER_SIZE,
  vx: 0,
  vy: 0,
  onGround: false,
};

const STAR_SIZE = isMobile ? 64 : 48;
const starSpacing = 180;

function noteHeight(freq, maxHeight) {
  const t = (freq - minFreq) / (maxFreq - minFreq || 1);
  return t * maxHeight;
}

const stars = melody.map((_, i) => ({
  x: 300 + i * starSpacing,
  y: 0,
  collected: false,
}));

function resetWorld() {
  player.y = groundY() - PLAYER_SIZE;

  const maxHeight = isMobile ? canvas.height * 0.35 : 180;

  stars.forEach((s, i) => {
    const freq = melody[i];
    const h = noteHeight(freq, maxHeight);
    s.y = groundY() - 80 - h;
    s.collected = false;
  });

  melodyIndex = 0;
}

resetWorld();

let cameraX = 0;

const keys = {};
const touch = { left: false, right: false, jump: false };
let started = false;
let hintAlpha = 1;

window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  startGame();
});
window.addEventListener("keyup", (e) => (keys[e.key] = false));

canvas.addEventListener("touchstart", handleTouch, { passive: false });
canvas.addEventListener("touchmove", handleTouch, { passive: false });
canvas.addEventListener("touchend", () => {
  touch.left = touch.right = touch.jump = false;
});

function handleTouch(e) {
  e.preventDefault();
  touch.left = touch.right = touch.jump = false;

  for (const t of e.touches) {
    const x = t.clientX;
    const y = t.clientY;

    if (x < canvas.width * 0.33) touch.left = true;
    else if (x > canvas.width * 0.66) touch.right = true;
    else if (y > canvas.height * 0.6) touch.jump = true;
  }

  startGame();
}

function startGame() {
  if (!needsRotate && bgLoaded) {
    audioCtx.resume();
    started = true;
  }
}

let lastTime = 0;
let time = 0;

function loop(t) {
  const dt = (t - lastTime) / 1000;
  lastTime = t;
  time += dt;

  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt) {
  if (!started || needsRotate) return;

  hintAlpha = Math.max(0, hintAlpha - dt * 0.8);

  if (keys.ArrowLeft || keys.a || touch.left) player.vx = -320;
  else if (keys.ArrowRight || keys.d || touch.right) player.vx = 320;
  else player.vx = 0; // stop when no input

  // jumpy
  if ((keys.ArrowUp || keys.w || keys[" "] || touch.jump) && player.onGround) {
    player.vy = -820;
    player.onGround = false;
  }

  // physics
  player.vy += gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // bounds
  player.x = Math.max(0, Math.min(player.x, levelWidth - player.w));
  if (player.y + player.h > groundY()) {
    player.y = groundY() - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  // collect stars
  stars.forEach((star) => {
    if (star.collected) return;

    if (
      player.x < star.x + STAR_SIZE &&
      player.x + player.w > star.x &&
      player.y < star.y + STAR_SIZE &&
      player.y + player.h > star.y
    ) {
      star.collected = true;
      currentPlayerImg = playerHitImg;
      setTimeout(() => (currentPlayerImg = playerImg), 200);
      playNote(melody[melodyIndex++] || melody.at(-1));
    }
  });

  // cam follow plaer
  const targetCameraX = player.x - canvas.width / 2;
  cameraX += (targetCameraX - cameraX) * 0.1;
  cameraX = Math.max(0, Math.min(cameraX, levelWidth - canvas.width));
}

function drawGlow(x, y, r, p, c) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * p);
  g.addColorStop(0, `${c}0.6)`);
  g.addColorStop(0.4, `${c}0.25)`);
  g.addColorStop(1, `${c}0)`);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * p, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (needsRotate) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Rotate your phone ↻", canvas.width / 2, canvas.height / 2);
    return;
  }

  // bckgrd
  const bgW = canvas.width;
  for (let i = -1; i < 3; i++) {
    const x = i * bgW - cameraX * 0.5;
    ctx.drawImage(bgImg, x, 0, bgW, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, 0, bgW, canvas.height);
  }

  // grnd
  ctx.fillStyle = "#555";
  ctx.fillRect(-cameraX, groundY(), levelWidth, 4);

  const pulse = 1 + Math.sin(time * 2) * 0.08;

  // instrucxns
  if (!started) {
    ctx.fillStyle = "#fff";
    ctx.font = "22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(
      isMobile ? "Tap to start" : "Press any key to start",
      canvas.width / 2,
      canvas.height * 0.3
    );

    ctx.font = "18px system-ui";
    ctx.fillText(
      isMobile ? "Left ◀   Jump ●   Right ▶" : "← move   ● jump   → move",
      canvas.width / 2,
      canvas.height * 0.36
    );
  }

  // xingxing!!
  stars.forEach((s) => {
    if (!s.collected) {
      drawGlow(
        s.x - cameraX + STAR_SIZE / 2,
        s.y + STAR_SIZE / 2,
        80,
        pulse,
        "rgba(255,210,80,"
      );
      ctx.drawImage(starImg, s.x - cameraX, s.y, STAR_SIZE, STAR_SIZE);
    }
  });

  // plyer
  drawGlow(
    player.x - cameraX + player.w / 2,
    player.y + player.h / 2,
    100,
    pulse,
    "rgba(255,190,60,"
  );
  ctx.drawImage(
    currentPlayerImg,
    player.x - cameraX,
    player.y,
    player.w,
    player.h
  );

  // ending message
  if (melodyIndex >= melody.length) {
    const lines = [
      "Wishing you a twinkling new year, Martha!!",
      "Thank you for being the teacher who gave me whimsy :D",
    ];

    const glowPulse = 1 + Math.sin(time * 3) * 0.05;

    ctx.font = `${26 * glowPulse}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";

    lines.forEach((line, i) => {
      const y = canvas.height * 0.4 + i * 40;

      ctx.save();
      ctx.shadowColor = "rgba(255,220,180,0.9)";
      ctx.shadowBlur = 30;
      ctx.fillText(line, canvas.width / 2, y);
      ctx.restore();
    });
  }
}
