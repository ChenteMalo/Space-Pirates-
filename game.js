const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.getElementById("levelLabel"),
  score: document.getElementById("scoreLabel"),
  health: document.getElementById("healthLabel"),
  character: document.getElementById("characterLabel"),
  story: document.getElementById("storyPanel")
};

const levels = [
  {
    name: "Nebula Run",
    crew: "Captain Rhea Starflare",
    story:
      "Rhea leads the Iron Tide through a glowing nebula while fending off scavenger drones sent by Dread Corsair Varn.",
    enemyColor: "#ff7b7b",
    enemySpeed: 1.4,
    spawnRate: 0.03,
    targetScore: 400,
    boss: { name: "Dread Corsair Varn", health: 160, color: "#ff3c3c", speed: 1.8 }
  },
  {
    name: "Moon of Rust",
    crew: "Navigator Jax Comet & Engineer Nyla Flux",
    story:
      "Jax and Nyla navigate wreckage fields around the Moon of Rust while rival raiders strike from cover.",
    enemyColor: "#ffd166",
    enemySpeed: 1.8,
    spawnRate: 0.042,
    targetScore: 850,
    boss: { name: "Admiral Scourge Talon", health: 220, color: "#ff9f1c", speed: 2.15 }
  },
  {
    name: "Kraken Gate",
    crew: "Gunner Bytebeard + First Mate Sol Rift",
    story:
      "At the ancient Kraken Gate, Bytebeard and Sol unleash broadside plasma cannons against the Void Armada.",
    enemyColor: "#8ecae6",
    enemySpeed: 2.2,
    spawnRate: 0.055,
    targetScore: 1500,
    boss: { name: "The Void Kraken", health: 300, color: "#7b2cbf", speed: 2.4 }
  }
];

const game = {
  running: true,
  paused: false,
  score: 0,
  stars: Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 2 })),
  bullets: [],
  enemies: [],
  enemyBullets: [],
  levelIndex: 0,
  boss: null,
  bossActive: false,
  gameOver: false,
  win: false
};

const player = {
  x: 110,
  y: canvas.height / 2,
  width: 52,
  height: 34,
  speed: 4.2,
  cooldown: 0,
  health: 100
};

const keys = {};

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;
  if (event.key === " ") {
    event.preventDefault();
  }
  if (event.key.toLowerCase() === "p") game.paused = !game.paused;
  if (event.key.toLowerCase() === "r" && (game.gameOver || game.win)) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

function currentLevel() {
  return levels[Math.min(game.levelIndex, levels.length - 1)];
}

function resetGame() {
  game.score = 0;
  game.levelIndex = 0;
  game.bullets = [];
  game.enemies = [];
  game.enemyBullets = [];
  game.boss = null;
  game.bossActive = false;
  game.gameOver = false;
  game.win = false;
  game.paused = false;
  player.health = 100;
  player.x = 110;
  player.y = canvas.height / 2;
  updateHud();
}

function updateHud() {
  const level = currentLevel();
  ui.level.textContent = `${game.levelIndex + 1} - ${level.name}`;
  ui.score.textContent = game.score;
  ui.health.textContent = Math.max(0, Math.floor(player.health));
  ui.character.textContent = level.crew;
  ui.story.textContent = level.story;
}

function shoot() {
  game.bullets.push({ x: player.x + player.width, y: player.y + player.height / 2, vx: 8, vy: 0, size: 4 });
}

function spawnEnemy() {
  const level = currentLevel();
  if (Math.random() < level.spawnRate && !game.bossActive) {
    const size = 28 + Math.random() * 20;
    game.enemies.push({
      x: canvas.width + size,
      y: 20 + Math.random() * (canvas.height - 80),
      size,
      vx: level.enemySpeed + Math.random() * 1.3,
      color: level.enemyColor,
      hp: 20 + game.levelIndex * 12
    });
  }
}

function maybeSpawnBoss() {
  const level = currentLevel();
  if (!game.bossActive && game.score >= level.targetScore) {
    game.bossActive = true;
    game.boss = {
      x: canvas.width - 140,
      y: canvas.height / 2 - 80,
      width: 160,
      height: 140,
      health: level.boss.health,
      dir: 1,
      speed: level.boss.speed,
      color: level.boss.color,
      name: level.boss.name,
      fireCooldown: 0
    };
  }
}

function progressLevel() {
  if (game.levelIndex < levels.length - 1) {
    game.levelIndex += 1;
    game.enemies = [];
    game.enemyBullets = [];
    game.boss = null;
    game.bossActive = false;
    player.health = Math.min(100, player.health + 25);
  } else {
    game.win = true;
  }
  updateHud();
}

function rectCollision(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function update() {
  if (game.paused || game.gameOver || game.win) return;

  if (keys.w || keys.arrowup) player.y -= player.speed;
  if (keys.s || keys.arrowdown) player.y += player.speed;
  if (keys.a || keys.arrowleft) player.x -= player.speed;
  if (keys.d || keys.arrowright) player.x += player.speed;

  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

  if (player.cooldown > 0) player.cooldown -= 1;
  if (keys[" "] && player.cooldown <= 0) {
    shoot();
    player.cooldown = 9;
  }

  spawnEnemy();
  maybeSpawnBoss();

  game.stars.forEach((star) => {
    star.x -= 0.8 + star.r * 0.4;
    if (star.x < 0) {
      star.x = canvas.width;
      star.y = Math.random() * canvas.height;
    }
  });

  game.bullets.forEach((bullet) => {
    bullet.x += bullet.vx;
  });
  game.bullets = game.bullets.filter((b) => b.x < canvas.width + 10);

  game.enemies.forEach((enemy) => {
    enemy.x -= enemy.vx;
    if (Math.random() < 0.01 + game.levelIndex * 0.004) {
      game.enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vx: -(3.1 + game.levelIndex), size: 4 });
    }
  });

  game.enemyBullets.forEach((bullet) => {
    bullet.x += bullet.vx;
  });
  game.enemyBullets = game.enemyBullets.filter((b) => b.x > -20);

  game.enemies = game.enemies.filter((enemy) => enemy.x + enemy.size > -40);

  if (game.bossActive && game.boss) {
    game.boss.y += game.boss.speed * game.boss.dir;
    if (game.boss.y < 20 || game.boss.y + game.boss.height > canvas.height - 20) game.boss.dir *= -1;

    if (game.boss.fireCooldown > 0) game.boss.fireCooldown -= 1;
    if (game.boss.fireCooldown <= 0) {
      game.enemyBullets.push({
        x: game.boss.x,
        y: game.boss.y + game.boss.height / 2,
        vx: -4.8,
        size: 6,
        boss: true
      });
      game.boss.fireCooldown = 32;
    }
  }

  // bullet vs enemies
  game.bullets.forEach((bullet) => {
    game.enemies.forEach((enemy) => {
      const hit = bullet.x > enemy.x && bullet.x < enemy.x + enemy.size && bullet.y > enemy.y && bullet.y < enemy.y + enemy.size;
      if (hit) {
        enemy.hp -= 14;
        bullet.x = canvas.width + 100;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          game.score += 30;
        }
      }
    });

    if (game.bossActive && game.boss) {
      const b = game.boss;
      const hitBoss = bullet.x > b.x && bullet.x < b.x + b.width && bullet.y > b.y && bullet.y < b.y + b.height;
      if (hitBoss) {
        b.health -= 8;
        bullet.x = canvas.width + 100;
        game.score += 2;
        if (b.health <= 0) {
          game.score += 180;
          progressLevel();
        }
      }
    }
  });

  game.enemies = game.enemies.filter((e) => !e.dead);

  const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };

  game.enemies.forEach((enemy) => {
    const enemyRect = { x: enemy.x, y: enemy.y, width: enemy.size, height: enemy.size };
    if (rectCollision(playerRect, enemyRect)) {
      player.health -= 16;
      enemy.dead = true;
    }
  });

  game.enemyBullets.forEach((bullet) => {
    if (
      bullet.x > player.x &&
      bullet.x < player.x + player.width &&
      bullet.y > player.y &&
      bullet.y < player.y + player.height
    ) {
      player.health -= bullet.boss ? 14 : 8;
      bullet.x = -100;
    }
  });

  if (game.bossActive && game.boss) {
    const bossRect = {
      x: game.boss.x,
      y: game.boss.y,
      width: game.boss.width,
      height: game.boss.height
    };
    if (rectCollision(playerRect, bossRect)) {
      player.health -= 0.7;
    }
  }

  if (player.health <= 0) {
    game.gameOver = true;
  }

  updateHud();
}

function drawShip(x, y, color = "#4cc9f0") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + player.height / 2);
  ctx.lineTo(x + player.width * 0.75, y);
  ctx.lineTo(x + player.width, y + player.height / 2);
  ctx.lineTo(x + player.width * 0.75, y + player.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#b8f2ff";
  ctx.fillRect(x + 12, y + 12, 14, 10);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#080d1d");
  grad.addColorStop(1, "#0e1637");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  game.stars.forEach((star) => {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });

  drawShip(player.x, player.y);

  game.bullets.forEach((bullet) => {
    ctx.fillStyle = "#8cffb2";
    ctx.fillRect(bullet.x, bullet.y - bullet.size / 2, bullet.size * 2, bullet.size);
  });

  game.enemyBullets.forEach((bullet) => {
    ctx.fillStyle = bullet.boss ? "#ff9ee5" : "#ffadad";
    ctx.fillRect(bullet.x, bullet.y - bullet.size / 2, bullet.size * 2, bullet.size);
  });

  game.enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(enemy.x + 4, enemy.y + 4, enemy.size - 8, enemy.size - 8);
  });

  if (game.bossActive && game.boss) {
    const boss = game.boss;
    ctx.fillStyle = boss.color;
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
    ctx.fillStyle = "#fefefe";
    ctx.font = "15px sans-serif";
    ctx.fillText(boss.name, boss.x + 10, boss.y - 10);

    const w = 180;
    const hpPct = Math.max(0, boss.health) / currentLevel().boss.health;
    ctx.fillStyle = "#111";
    ctx.fillRect(canvas.width - w - 20, 14, w, 14);
    ctx.fillStyle = "#ff595e";
    ctx.fillRect(canvas.width - w - 20, 14, w * hpPct, 14);
  }

  ctx.fillStyle = "#fff";
  ctx.font = "17px sans-serif";
  if (game.paused) {
    ctx.fillText("Paused - press P to continue", canvas.width / 2 - 120, canvas.height / 2);
  }

  if (game.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffb3b3";
    ctx.font = "42px sans-serif";
    ctx.fillText("Hull Breached", canvas.width / 2 - 130, canvas.height / 2 - 20);
    ctx.font = "20px sans-serif";
    ctx.fillText("Press R to restart", canvas.width / 2 - 82, canvas.height / 2 + 20);
  }

  if (game.win) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "38px sans-serif";
    ctx.fillText("The Starwake is Safe!", canvas.width / 2 - 180, canvas.height / 2 - 20);
    ctx.font = "20px sans-serif";
    ctx.fillText("Captain Rhea's crew claims victory.", canvas.width / 2 - 165, canvas.height / 2 + 20);
    ctx.fillText("Press R to play again.", canvas.width / 2 - 105, canvas.height / 2 + 50);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

updateHud();
loop();
