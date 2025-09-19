const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("score");
const bestScoreText = document.getElementById("best-score");
const messageText = document.getElementById("message");
const livesText = document.getElementById("lives");

const STATE = {
  READY: "ready",
  RUNNING: "running",
  OVER: "over",
  CLEARED: "cleared",
};

const WORLD_WIDTH = 4600;
const GROUND_HEIGHT = 92;
const groundY = canvas.height - GROUND_HEIGHT;

const PLAYER_CONFIG = {
  width: 46,
  height: 60,
  acceleration: 1900,
  maxSpeed: 300,
  airAcceleration: 1200,
  friction: 2400,
  gravity: 2200,
  jumpSpeed: 840,
  maxFallSpeed: 1400,
  shotCooldown: 0.24,
  maxHp: 5,
};

const BULLET_CONFIG = {
  speed: 520,
  width: 16,
  height: 10,
  enemySpeed: 300,
  enemyWidth: 14,
  enemyHeight: 10,
};

const goal = {
  x: WORLD_WIDTH - 160,
  y: groundY - 156,
  width: 80,
  height: 156,
};

const PLATFORM_TEMPLATES = [
  { x: -400, y: groundY, width: WORLD_WIDTH + 800, height: canvas.height - groundY },
  { x: 340, y: groundY - 120, width: 160, height: 18 },
  { x: 720, y: groundY - 200, width: 140, height: 18 },
  { x: 1180, y: groundY - 160, width: 220, height: 18 },
  { x: 1580, y: groundY - 100, width: 140, height: 18 },
  { x: 1960, y: groundY - 160, width: 220, height: 18 },
  { x: 2380, y: groundY - 240, width: 180, height: 18 },
  { x: 2760, y: groundY - 120, width: 220, height: 18 },
  { x: 3140, y: groundY - 190, width: 200, height: 18 },
  { x: 3520, y: groundY - 120, width: 180, height: 18 },
  { x: 3920, y: groundY - 160, width: 160, height: 18 },
];

const ENEMY_TEMPLATES = [
  {
    type: "walker",
    x: 620,
    width: 44,
    height: 58,
    leftBound: 560,
    rightBound: 880,
    speed: 70,
    hp: 2,
    baseY: groundY - 58,
    score: 1,
  },
  {
    type: "walker",
    x: 1480,
    width: 44,
    height: 58,
    leftBound: 1420,
    rightBound: 1780,
    speed: 80,
    hp: 3,
    baseY: groundY - 58,
    score: 1,
  },
  {
    type: "turret",
    x: 2050,
    width: 48,
    height: 60,
    hp: 3,
    cooldown: 1.3,
    baseY: groundY - 160 - 60,
    score: 2,
  },
  {
    type: "walker",
    x: 2460,
    width: 44,
    height: 58,
    leftBound: 2420,
    rightBound: 2600,
    speed: 70,
    hp: 2,
    baseY: groundY - 240 - 58,
    score: 1,
  },
  {
    type: "turret",
    x: 3220,
    width: 50,
    height: 64,
    hp: 4,
    cooldown: 1.1,
    baseY: groundY - 190 - 64,
    score: 2,
  },
  {
    type: "walker",
    x: 3740,
    width: 46,
    height: 60,
    leftBound: 3680,
    rightBound: 4020,
    speed: 90,
    hp: 3,
    baseY: groundY - 60,
    score: 1,
  },
];

const jumpKeys = new Set(["Space", "ArrowUp", "KeyZ", "KeyW"]);
const shootKeys = new Set(["KeyX", "KeyC", "KeyJ", "KeyK"]);
const startKeys = new Set(["Enter", ...jumpKeys, ...shootKeys]);

let platforms = [];
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let camera = { x: 0 };

let gameState = STATE.READY;
let lastTimestamp = 0;
let score = 0;
let bestScore = 0;

const keyState = new Set();

let player = createPlayer();

function createPlayer() {
  return {
    x: 120,
    y: groundY - PLAYER_CONFIG.height,
    width: PLAYER_CONFIG.width,
    height: PLAYER_CONFIG.height,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    shotTimer: 0,
    hp: PLAYER_CONFIG.maxHp,
    invincibleTimer: 0,
  };
}

function createPlatforms() {
  return PLATFORM_TEMPLATES.map((platform) => ({ ...platform }));
}

function createEnemies() {
  return ENEMY_TEMPLATES.map((enemy) => ({
    ...enemy,
    y: enemy.baseY,
    direction: enemy.direction ?? 1,
    timer: 0,
  }));
}

function resetStage() {
  platforms = createPlatforms();
  enemies = createEnemies();
  playerBullets = [];
  enemyBullets = [];
  player = createPlayer();
  camera.x = 0;
  score = 0;
  updateScoreDisplays();
  updateLivesDisplay();
}

function startGame() {
  resetStage();
  gameState = STATE.RUNNING;
  setMessage("敵を倒してゴールへ進もう！");
}

function endGame(isClear = false) {
  gameState = isClear ? STATE.CLEARED : STATE.OVER;
  bestScore = Math.max(bestScore, score);
  updateScoreDisplays();
  const text = isClear
    ? "ステージクリア！Enterキーでリトライ"
    : "ゲームオーバー… Enterキーで再挑戦";
  setMessage(text);
}

function updateScoreDisplays() {
  scoreText.textContent = score;
  bestScoreText.textContent = bestScore;
}

function updateLivesDisplay() {
  livesText.textContent = Math.max(0, player.hp);
}

function setMessage(text) {
  messageText.textContent = text;
}

function isKeyDown(code) {
  return keyState.has(code);
}

function attemptJump() {
  if (player.onGround) {
    player.vy = -PLAYER_CONFIG.jumpSpeed;
    player.onGround = false;
  }
}

function attemptShoot() {
  if (player.shotTimer <= 0) {
    const bulletY = player.y + player.height * 0.4;
    const offsetX = player.facing > 0 ? player.width - 4 : -BULLET_CONFIG.width + 4;
    playerBullets.push({
      x: player.x + offsetX,
      y: bulletY,
      width: BULLET_CONFIG.width,
      height: BULLET_CONFIG.height,
      vx: BULLET_CONFIG.speed * player.facing,
      friendly: true,
    });
    player.shotTimer = PLAYER_CONFIG.shotCooldown;
  }
}

function updatePlayer(delta) {
  const moveRight = isKeyDown("ArrowRight") || isKeyDown("KeyD");
  const moveLeft = isKeyDown("ArrowLeft") || isKeyDown("KeyA");
  const move = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

  if (move !== 0) {
    const accel = player.onGround
      ? PLAYER_CONFIG.acceleration
      : PLAYER_CONFIG.airAcceleration;
    player.vx += accel * move * delta;
    player.facing = move > 0 ? 1 : -1;
  } else if (player.onGround) {
    if (Math.abs(player.vx) < PLAYER_CONFIG.friction * delta) {
      player.vx = 0;
    } else {
      player.vx -= PLAYER_CONFIG.friction * delta * Math.sign(player.vx);
    }
  }

  player.vx = clamp(player.vx, -PLAYER_CONFIG.maxSpeed, PLAYER_CONFIG.maxSpeed);

  const nextX = player.x + player.vx * delta;
  const horizontalMovement = nextX - player.x;
  player.x += horizontalMovement;
  resolveHorizontalCollision(player, platforms);

  player.vy += PLAYER_CONFIG.gravity * delta;
  player.vy = clamp(player.vy, -Infinity, PLAYER_CONFIG.maxFallSpeed);
  player.onGround = false;

  const nextY = player.y + player.vy * delta;
  const verticalMovement = nextY - player.y;
  player.y += verticalMovement;
  resolveVerticalCollision(player, platforms);

  player.x = clamp(player.x, 0, Math.max(0, WORLD_WIDTH - player.width));

  if (player.y > canvas.height + 200) {
    damagePlayer(player.hp);
  }

  if (player.shotTimer > 0) {
    player.shotTimer -= delta;
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer -= delta;
  }
}

function resolveHorizontalCollision(entity, solids) {
  for (const solid of solids) {
    if (rectsIntersect(entity, solid)) {
      if (entity.vx > 0) {
        entity.x = solid.x - entity.width - 0.01;
      } else if (entity.vx < 0) {
        entity.x = solid.x + solid.width + 0.01;
      }
      entity.vx = 0;
    }
  }
}

function resolveVerticalCollision(entity, solids) {
  for (const solid of solids) {
    if (rectsIntersect(entity, solid)) {
      if (entity.vy > 0) {
        entity.y = solid.y - entity.height - 0.01;
        entity.vy = 0;
        entity.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = solid.y + solid.height + 0.01;
        entity.vy = 0;
      }
    }
  }
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (enemy.type === "walker") {
      if (enemy.direction === 0) {
        enemy.direction = 1;
      }
      enemy.x += enemy.speed * enemy.direction * delta;
      if (enemy.x < enemy.leftBound) {
        enemy.x = enemy.leftBound;
        enemy.direction = 1;
      }
      if (enemy.x + enemy.width > enemy.rightBound) {
        enemy.x = enemy.rightBound - enemy.width;
        enemy.direction = -1;
      }
    } else if (enemy.type === "turret") {
      enemy.timer -= delta;
      const distance = Math.abs(player.x - enemy.x);
      if (distance < 440 && enemy.timer <= 0) {
        spawnEnemyBullet(enemy);
        enemy.timer = enemy.cooldown;
      }
    }

    if (rectsIntersect(player, enemy)) {
      damagePlayer(1);
    }
  }
}

function spawnEnemyBullet(enemy) {
  const direction = player.x < enemy.x ? -1 : 1;
  enemyBullets.push({
    x: enemy.x + enemy.width / 2 - BULLET_CONFIG.enemyWidth / 2,
    y: enemy.y + enemy.height * 0.45,
    width: BULLET_CONFIG.enemyWidth,
    height: BULLET_CONFIG.enemyHeight,
    vx: BULLET_CONFIG.enemySpeed * direction,
    friendly: false,
  });
}

function updateBullets(delta) {
  for (const bullet of playerBullets) {
    bullet.x += bullet.vx * delta;
    if (
      bullet.x + bullet.width < -300 ||
      bullet.x > WORLD_WIDTH + 300
    ) {
      bullet.remove = true;
      continue;
    }

    for (const enemy of enemies) {
      if (!bullet.remove && rectsIntersect(bullet, enemy)) {
        enemy.hp -= 1;
        bullet.remove = true;
        if (enemy.hp <= 0) {
          enemy.remove = true;
          score += enemy.score;
          updateScoreDisplays();
        }
      }
    }
  }

  for (const bullet of enemyBullets) {
    bullet.x += bullet.vx * delta;
    if (
      bullet.x + bullet.width < -300 ||
      bullet.x > WORLD_WIDTH + 300
    ) {
      bullet.remove = true;
      continue;
    }
    if (rectsIntersect(bullet, player)) {
      bullet.remove = true;
      damagePlayer(1);
    }
  }

  playerBullets = playerBullets.filter((bullet) => !bullet.remove);
  enemies = enemies.filter((enemy) => !enemy.remove);
  enemyBullets = enemyBullets.filter((bullet) => !bullet.remove);
}

function damagePlayer(amount) {
  if (player.invincibleTimer > 0 || gameState !== STATE.RUNNING) {
    return;
  }
  player.hp -= amount;
  player.invincibleTimer = 1.2;
  updateLivesDisplay();
  if (player.hp <= 0) {
    endGame(false);
  }
}

function updateCamera() {
  const target = player.x + player.width / 2 - canvas.width / 2;
  camera.x = clamp(target, 0, Math.max(0, WORLD_WIDTH - canvas.width));
}

function updateGoalState() {
  if (rectsIntersect(player, goal)) {
    if (gameState === STATE.RUNNING) {
      score += 5;
      updateScoreDisplays();
      endGame(true);
    }
  }
}

function update(delta) {
  if (gameState !== STATE.RUNNING) {
    return;
  }
  updatePlayer(delta);
  updateEnemies(delta);
  updateBullets(delta);
  updateCamera();
  updateGoalState();
}

function draw() {
  drawBackground();
  ctx.save();
  ctx.translate(-camera.x, 0);
  drawPlatforms();
  drawGoal();
  drawEnemies();
  drawBullets();
  drawPlayer();
  ctx.restore();

  if (gameState !== STATE.RUNNING) {
    drawOverlay();
  }
}

function drawBackground() {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, "#4da7ff");
  skyGradient.addColorStop(1, "#9bd5ff");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const parallax = (camera.x * 0.3) % canvas.width;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  for (let i = -160; i < canvas.width + 160; i += 200) {
    const x = (i - parallax) % (canvas.width + 200) - 200;
    drawCloud(x, 70);
    drawCloud(x + 100, 130);
  }

  const hillOffset = (camera.x * 0.6) % 320;
  ctx.fillStyle = "#5ea454";
  for (let x = -320; x < canvas.width + 320; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x - hillOffset, groundY + 60);
    ctx.quadraticCurveTo(x + 80 - hillOffset, groundY - 40, x + 160 - hillOffset, groundY + 60);
    ctx.fill();
  }
}

function drawCloud(x, y) {
  ctx.beginPath();
  ctx.arc(x + 30, y, 24, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 60, y - 20, 28, Math.PI * 1.2, Math.PI * 1.9);
  ctx.arc(x + 90, y, 24, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawPlatforms() {
  for (const platform of platforms) {
    const gradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
    gradient.addColorStop(0, "#5c8bff");
    gradient.addColorStop(1, "#304d8f");
    ctx.fillStyle = platform === platforms[0] ? "#2f4370" : gradient;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    if (platform !== platforms[0]) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(platform.x, platform.y, platform.width, 4);
    }
  }
}

function drawGoal() {
  ctx.save();
  ctx.fillStyle = "#f2d94e";
  roundedRectPath(ctx, goal.x, goal.y, goal.width, goal.height, 12);
  ctx.fill();
  ctx.fillStyle = "#d46f4c";
  ctx.fillRect(goal.x + goal.width * 0.3, goal.y + goal.height * 0.15, goal.width * 0.4, goal.height * 0.7);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.save();
    if (enemy.type === "walker") {
      ctx.fillStyle = "#1f9acb";
      roundedRectPath(ctx, enemy.x, enemy.y, enemy.width, enemy.height, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(enemy.x + 12, enemy.y + 16, 16, 10);
      ctx.fillStyle = "#0f3a5b";
      ctx.fillRect(enemy.x + 18, enemy.y + 18, 6, 6);
    } else {
      ctx.fillStyle = "#6b3aff";
      roundedRectPath(ctx, enemy.x, enemy.y, enemy.width, enemy.height, 10);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(enemy.x + enemy.width * 0.3, enemy.y + enemy.height * 0.2, enemy.width * 0.4, enemy.height * 0.3);
      ctx.fillStyle = "#1c0f52";
      ctx.fillRect(enemy.x + enemy.width * 0.45, enemy.y + enemy.height * 0.28, 8, 8);
    }
    ctx.restore();
  }
}

function drawBullets() {
  ctx.fillStyle = "#ffdd55";
  for (const bullet of playerBullets) {
    roundedRectPath(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 4);
    ctx.fill();
  }
  ctx.fillStyle = "#ff6b6b";
  for (const bullet of enemyBullets) {
    roundedRectPath(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 4);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer * 10) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }
  ctx.fillStyle = "#00a8ff";
  roundedRectPath(ctx, player.x, player.y, player.width, player.height, 10);
  ctx.fill();

  ctx.fillStyle = "#fff";
  const eyeOffset = player.facing > 0 ? player.width * 0.55 : player.width * 0.25;
  ctx.beginPath();
  ctx.arc(player.x + eyeOffset, player.y + player.height * 0.35, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0d2a46";
  ctx.beginPath();
  ctx.arc(player.x + eyeOffset, player.y + player.height * 0.35, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd166";
  const armX = player.facing > 0 ? player.x + player.width - 6 : player.x - 10;
  ctx.fillRect(armX, player.y + player.height * 0.45, 10 * player.facing, 14);
  ctx.restore();
}

function drawOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(12, 28, 44, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
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

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loop(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keyState.add(event.code);
  if (startKeys.has(event.code)) {
    event.preventDefault();
    if (gameState === STATE.READY || gameState === STATE.OVER || gameState === STATE.CLEARED) {
      startGame();
      return;
    }
  }

  if (gameState !== STATE.RUNNING) {
    return;
  }

  if (jumpKeys.has(event.code)) {
    event.preventDefault();
    attemptJump();
  }

  if (shootKeys.has(event.code)) {
    event.preventDefault();
    attemptShoot();
  }
});

window.addEventListener("keyup", (event) => {
  keyState.delete(event.code);
});

canvas.addEventListener("pointerdown", () => {
  if (gameState === STATE.RUNNING) {
    attemptJump();
  } else {
    startGame();
  }
});

setMessage("左右キーで移動、Zでジャンプ、Xでショット！");
updateScoreDisplays();
updateLivesDisplay();
requestAnimationFrame(loop);
