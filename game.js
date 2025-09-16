const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("score");
const bestScoreText = document.getElementById("best-score");
const messageText = document.getElementById("message");

const GRAVITY = 0.6;
const JUMP_STRENGTH = -12;
const GROUND_HEIGHT = 80;
const groundY = canvas.height - GROUND_HEIGHT;
const BASE_SPEED = 260; // pixels per second
const MAX_SPEED = 460;

const STATE = {
  READY: "ready",
  RUNNING: "running",
  OVER: "over",
};

let player = {
  x: 110,
  y: groundY - 48,
  width: 44,
  height: 48,
  vy: 0,
  jumping: false,
};

let obstacles = [];
let score = 0;
let bestScore = 0;
let spawnTimer = 0;
let backgroundOffset = 0;
let worldSpeed = BASE_SPEED;
let gameState = STATE.READY;
let lastTimestamp = 0;

function startGame() {
  score = 0;
  worldSpeed = BASE_SPEED;
  obstacles = [];
  spawnTimer = 900;
  backgroundOffset = 0;
  player.y = groundY - player.height;
  player.vy = 0;
  player.jumping = false;
  gameState = STATE.RUNNING;
  updateScoreDisplays();
  setMessage("障害物をジャンプでよけよう！");
}

function endGame() {
  gameState = STATE.OVER;
  bestScore = Math.max(bestScore, Math.floor(score));
  updateScoreDisplays();
  setMessage("ゲームオーバー！スペースキーまたはタップでリトライ");
}

function updateScoreDisplays() {
  scoreText.textContent = Math.floor(score);
  bestScoreText.textContent = bestScore;
}

function setMessage(text) {
  messageText.textContent = text;
}

function spawnObstacle() {
  const height = 30 + Math.random() * 50;
  const width = 28 + Math.random() * 38;
  const speedBonus = Math.random() * 80;
  obstacles.push({
    x: canvas.width + width,
    y: groundY - height,
    width,
    height,
    speedBonus,
    color: `hsl(${Math.random() * 30 + 10}, 75%, 55%)`,
  });

  const baseInterval = 900 - Math.min(500, score * 4);
  const variability = 400;
  spawnTimer = Math.max(320, baseInterval) + Math.random() * variability;
}

function attemptJump() {
  if (gameState === STATE.RUNNING) {
    jump();
  } else {
    startGame();
    jump();
  }
}

function jump() {
  if (!player.jumping) {
    player.vy = JUMP_STRENGTH;
    player.jumping = true;
    setMessage("");
  }
}

function update(delta) {
  const deltaSeconds = delta / 1000;

  const difficultyBoost = Math.min(1, score / 200);
  worldSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * difficultyBoost;
  backgroundOffset = (backgroundOffset + worldSpeed * deltaSeconds) % canvas.width;

  player.vy += GRAVITY;
  player.y += player.vy;
  if (player.y >= groundY - player.height) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.jumping = false;
  }

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnObstacle();
  }

  obstacles = obstacles.filter((obstacle) => {
    obstacle.x -= (worldSpeed + obstacle.speedBonus) * deltaSeconds;
    return obstacle.x + obstacle.width > -10;
  });

  for (const obstacle of obstacles) {
    if (isColliding(player, obstacle)) {
      endGame();
      return;
    }
  }

  score += deltaSeconds * 10 * (1 + difficultyBoost);
  updateScoreDisplays();
}

function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function draw() {
  drawBackground();
  drawPlayer();
  drawObstacles();

  if (gameState !== STATE.RUNNING) {
    drawOverlay();
  }
}

function drawBackground() {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, "#7dc8ff");
  skyGradient.addColorStop(1, "#bfe7ff");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cloudOffset = backgroundOffset * 0.3;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (let i = -120; i < canvas.width + 120; i += 160) {
    const x = (i + cloudOffset) % (canvas.width + 160) - 160;
    drawCloud(x, 80);
    drawCloud(x + 80, 150);
  }

  const hillOffset = backgroundOffset * 0.6;
  ctx.fillStyle = "#63ad57";
  for (let i = -200; i < canvas.width + 200; i += 220) {
    const x = (i + hillOffset) % (canvas.width + 220) - 220;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.quadraticCurveTo(x + 110, groundY - 120, x + 220, groundY);
    ctx.fill();
  }

  const groundGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  groundGradient.addColorStop(0, "#7ec850");
  groundGradient.addColorStop(1, "#4c8b2e");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  const stripeSpacing = 120;
  const stripeOffset = backgroundOffset % stripeSpacing;
  for (let x = -stripeSpacing + stripeOffset; x < canvas.width; x += stripeSpacing) {
    ctx.fillRect(x, groundY - 6, 60, 6);
  }
}

function drawCloud(x, y) {
  ctx.beginPath();
  ctx.arc(x + 30, y, 20, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 50, y - 20, 26, Math.PI * 1, Math.PI * 1.85);
  ctx.arc(x + 70, y - 10, 20, Math.PI * 1.2, Math.PI * 1.9);
  ctx.arc(x + 90, y, 24, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  ctx.save();
  ctx.fillStyle = "#ff7f50";
  ctx.strokeStyle = "#f5562b";
  ctx.lineWidth = 4;
  roundedRectPath(ctx, player.x, player.y, player.width, player.height, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(player.x + player.width * 0.7, player.y + player.height * 0.35, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(player.x + player.width * 0.72, player.y + player.height * 0.35, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    ctx.save();
    ctx.fillStyle = obstacle.color;
    roundedRectPath(ctx, obstacle.x, obstacle.y, obstacle.width, obstacle.height, 6);
    ctx.fill();
    ctx.restore();
  }
}

function drawOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(19, 48, 71, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function loop(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (gameState === STATE.RUNNING) {
    update(delta);
  }
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    attemptJump();
  }
});

canvas.addEventListener("pointerdown", () => {
  attemptJump();
});

setMessage("スペースキーまたは画面タップでスタート");
requestAnimationFrame(loop);
