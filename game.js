const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.getElementById("levelLabel"),
  score: document.getElementById("scoreLabel"),
  highScore: document.getElementById("highScoreLabel"),
  health: document.getElementById("healthLabel"),
  grenades: document.getElementById("grenadeLabel"),
  character: document.getElementById("characterLabel"),
  story: document.getElementById("storyPanel")
};

const highScoreStorageKey = "spacePiratesHighScore";
const storedHighScore = Number.parseInt(localStorage.getItem(highScoreStorageKey) || "0", 10);

const levels = [
  {
    name: "Nebula Run",
    crew: "Captain Rhea Starflare",
    story: "Rhea leads the Iron Tide through a glowing nebula while fending off scavenger drones sent by Dread Corsair Varn.",
    enemyColor: "#ff7b7b",
    enemySpeed: 1.4,
    spawnRate: 0.03,
    targetScore: 400,
    boss: { name: "Dread Corsair Varn", health: 160, color: "#ff3c3c", speed: 1.8 }
  },
  {
    name: "Moon of Rust",
    crew: "Navigator Jax Comet & Engineer Nyla Flux",
    story: "Jax and Nyla navigate wreckage fields around the Moon of Rust while rival raiders strike from cover.",
    enemyColor: "#ffd166",
    enemySpeed: 1.8,
    spawnRate: 0.042,
    targetScore: 850,
    boss: { name: "Admiral Scourge Talon", health: 220, color: "#ff9f1c", speed: 2.15 }
  },
  {
    name: "Kraken Gate",
    crew: "Gunner Bytebeard + First Mate Sol Rift",
    story: "At the ancient Kraken Gate, Bytebeard and Sol unleash broadside plasma cannons against the Void Armada.",
    enemyColor: "#8ecae6",
    enemySpeed: 2.2,
    spawnRate: 0.055,
    targetScore: 1500,
    boss: { name: "The Void Kraken", health: 300, color: "#7b2cbf", speed: 2.4 }
  }
];

const game = {
  paused: false,
  score: 0,
  stars: Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 2 })),
  bullets: [],
  grenades: [],
  enemies: [],
  enemyBullets: [],
  powerUps: [],
  explosions: [],
  highScore: Number.isFinite(storedHighScore) ? storedHighScore : 0,
  levelIndex: 0,
  boss: null,
  bossActive: false,
  gameOver: false,
  win: false
};

const player = {
  x: 110,
  y: canvas.height / 2,
  width: 64,
  height: 38,
  speed: 4.2,
  cooldown: 0,
  grenadeCooldown: 0,
  doubleGunTimer: 0,
  health: 100,
  grenades: 5,
  damageFlash: 0
};

const keys = {};

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (event.key === " ") event.preventDefault();
  if (key === "p") game.paused = !game.paused;
  if (key === "r" && (game.gameOver || game.win)) resetGame();

  if (key === "g" && !event.repeat) {
    launchGrenade();
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
  game.grenades = [];
  game.enemies = [];
  game.enemyBullets = [];
  game.powerUps = [];
  game.explosions = [];
  game.boss = null;
  game.bossActive = false;
  game.gameOver = false;
  game.win = false;
  game.paused = false;

  player.health = 100;
  player.grenades = 5;
  player.damageFlash = 0;
  player.doubleGunTimer = 0;
  player.x = 110;
  player.y = canvas.height / 2;
  player.cooldown = 0;
  player.grenadeCooldown = 0;

  updateHud();
}

function updateHud() {
  const level = currentLevel();
  ui.level.textContent = `${game.levelIndex + 1} - ${level.name}`;
  ui.score.textContent = game.score;
  game.highScore = Math.max(game.highScore, game.score);
  localStorage.setItem(highScoreStorageKey, String(game.highScore));
  ui.highScore.textContent = game.highScore;
  ui.health.textContent = Math.max(0, Math.floor(player.health));
  ui.grenades.textContent = player.grenades;
  ui.character.textContent = level.crew;
  if (player.doubleGunTimer > 0) {
    ui.story.textContent = `${level.story} Twin-cannon mode active (${Math.ceil(player.doubleGunTimer / 60)}s).`;
  } else {
    ui.story.textContent = level.story;
  }
}

function takePlayerDamage(amount) {
  player.health -= amount;
  player.damageFlash = 10;
}

function spawnExplosion(x, y, color = "#ff9f1c", radius = 50) {
  const particles = Array.from({ length: 24 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 24 + Math.floor(Math.random() * 10),
      size: 2 + Math.random() * 3,
      color
    };
  });
  game.explosions.push({ x, y, particles, shockwave: radius, life: 18 });
}

function shoot() {
  const centerY = player.y + player.height / 2;
  if (player.doubleGunTimer > 0) {
    game.bullets.push({ x: player.x + player.width, y: centerY - 9, vx: 9.2, size: 4.4 });
    game.bullets.push({ x: player.x + player.width, y: centerY + 9, vx: 9.2, size: 4.4 });
  } else {
    game.bullets.push({ x: player.x + player.width, y: centerY, vx: 8.8, size: 4 });
  }
}

function launchGrenade() {
  if (game.paused || game.gameOver || game.win) return;
  if (player.grenades <= 0 || player.grenadeCooldown > 0) return;

  game.grenades.push({
    x: player.x + player.width,
    y: player.y + player.height / 2,
    vx: 4.8,
    life: 130,
    radius: 175,
    damage: 90,
    exploded: false
  });
  player.grenades -= 1;
  player.grenadeCooldown = 25;
}

function detonateGrenade(grenade) {
  if (grenade.exploded) return;
  grenade.exploded = true;
  spawnExplosion(grenade.x, grenade.y, "#ffbf69", grenade.radius);

  game.enemies.forEach((enemy) => {
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const dist = Math.hypot(ex - grenade.x, ey - grenade.y);
    if (dist <= grenade.radius) {
      enemy.dead = true;
      game.score += 45;
      spawnExplosion(ex, ey, enemy.color, 62);
    }
  });

  if (game.bossActive && game.boss) {
    const bx = game.boss.x + game.boss.width / 2;
    const by = game.boss.y + game.boss.height / 2;
    const dist = Math.hypot(bx - grenade.x, by - grenade.y);
    if (dist <= grenade.radius + 60) {
      game.boss.health -= grenade.damage;
      spawnExplosion(bx, by, "#ffd166", 65);
      if (game.boss.health <= 0) {
        game.score += 200;
        spawnExplosion(bx, by, game.boss.color, 140);
        progressLevel();
      }
    }
  }
}

function spawnEnemy() {
  const level = currentLevel();
  if (Math.random() < level.spawnRate && !game.bossActive) {
    const size = 28 + Math.random() * 16;
    game.enemies.push({
      x: canvas.width + size,
      y: 20 + Math.random() * (canvas.height - 80),
      size,
      vx: level.enemySpeed + Math.random() * 1.3,
      color: level.enemyColor,
      hp: 24 + game.levelIndex * 12,
      thruster: Math.random() * Math.PI * 2
    });
  }
}

function maybeSpawnPowerUp(x, y) {
  if (Math.random() < 0.13) {
    game.powerUps.push({
      x,
      y,
      vx: -2.2,
      size: 16,
      kind: "doubleGun",
      pulse: 0
    });
  }
}

function maybeSpawnBoss() {
  const level = currentLevel();
  if (!game.bossActive && game.score >= level.targetScore) {
    game.bossActive = true;
    game.boss = {
      x: canvas.width - 150,
      y: canvas.height / 2 - 84,
      width: 170,
      height: 150,
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
    game.powerUps = [];
    game.grenades = [];
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
  if (player.grenadeCooldown > 0) player.grenadeCooldown -= 1;

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

  game.grenades.forEach((grenade) => {
    grenade.x += grenade.vx;
    grenade.life -= 1;

    if (!grenade.exploded) {
      const nearEnemy = game.enemies.some((enemy) => Math.hypot(enemy.x - grenade.x, enemy.y - grenade.y) < enemy.size + 15);
      if (nearEnemy || grenade.life <= 0 || grenade.x > canvas.width * 0.8) {
        detonateGrenade(grenade);
      }
    }
  });
  game.grenades = game.grenades.filter((grenade) => !grenade.exploded);

  game.enemies.forEach((enemy) => {
    enemy.x -= enemy.vx;
    enemy.thruster += 0.2;
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
      game.enemyBullets.push({ x: game.boss.x, y: game.boss.y + game.boss.height / 2, vx: -4.8, size: 6, boss: true });
      game.boss.fireCooldown = 32;
    }
  }

  game.bullets.forEach((bullet) => {
    game.enemies.forEach((enemy) => {
      const hit = bullet.x > enemy.x && bullet.x < enemy.x + enemy.size && bullet.y > enemy.y && bullet.y < enemy.y + enemy.size;
      if (hit) {
        enemy.hp -= 14;
        bullet.x = canvas.width + 100;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          game.score += 30;
          spawnExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 45);
          maybeSpawnPowerUp(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2);
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
          spawnExplosion(b.x + b.width / 2, b.y + b.height / 2, b.color, 140);
          progressLevel();
        }
      }
    }
  });

  game.enemies = game.enemies.filter((e) => !e.dead);

  game.powerUps.forEach((powerUp) => {
    powerUp.x += powerUp.vx;
    powerUp.pulse += 0.2;
  });
  game.powerUps = game.powerUps.filter((powerUp) => powerUp.x > -30);

  const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };

  game.enemies.forEach((enemy) => {
    const enemyRect = { x: enemy.x, y: enemy.y, width: enemy.size, height: enemy.size };
    if (rectCollision(playerRect, enemyRect)) {
      takePlayerDamage(16);
      enemy.dead = true;
      spawnExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 40);
    }
  });

  game.enemyBullets.forEach((bullet) => {
    if (bullet.x > player.x && bullet.x < player.x + player.width && bullet.y > player.y && bullet.y < player.y + player.height) {
      takePlayerDamage(bullet.boss ? 14 : 8);
      bullet.x = -100;
    }
  });

  if (game.bossActive && game.boss) {
    const bossRect = { x: game.boss.x, y: game.boss.y, width: game.boss.width, height: game.boss.height };
    if (rectCollision(playerRect, bossRect)) {
      takePlayerDamage(0.7);
    }
  }

  game.powerUps.forEach((powerUp) => {
    if (
      powerUp.x > player.x &&
      powerUp.x < player.x + player.width &&
      powerUp.y > player.y &&
      powerUp.y < player.y + player.height
    ) {
      player.doubleGunTimer = 15 * 60;
      spawnExplosion(powerUp.x, powerUp.y, "#90e0ef", 55);
      powerUp.collected = true;
    }
  });
  game.powerUps = game.powerUps.filter((powerUp) => !powerUp.collected);

  if (player.damageFlash > 0) player.damageFlash -= 1;
  if (player.doubleGunTimer > 0) player.doubleGunTimer -= 1;

  game.explosions.forEach((blast) => {
    blast.life -= 1;
    blast.particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      particle.life -= 1;
    });
    blast.particles = blast.particles.filter((particle) => particle.life > 0);
  });
  game.explosions = game.explosions.filter((blast) => blast.life > 0 || blast.particles.length > 0);

  if (player.health <= 0) game.gameOver = true;

  updateHud();
}

function drawPlayerShip() {
  const flashing = player.damageFlash > 0 && player.damageFlash % 2 === 0;
  const hull = flashing ? "#ff8c42" : "#4cc9f0";
  const wing = flashing ? "#ffc37b" : "#7bdff2";

  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(32, 10);
  ctx.lineTo(10, player.height - 4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(4, player.height - 4);
  ctx.lineTo(32, player.height - 10);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(6, player.height / 2);
  ctx.lineTo(player.width * 0.72, 4);
  ctx.lineTo(player.width - 2, player.height / 2);
  ctx.lineTo(player.width * 0.72, player.height - 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d4f4ff";
  ctx.fillRect(22, 13, 20, 12);

  ctx.fillStyle = player.doubleGunTimer > 0 ? "#90e0ef" : "#264653";
  ctx.fillRect(46, 10, 8, 6);
  ctx.fillRect(46, player.height - 16, 8, 6);

  ctx.fillStyle = flashing ? "#ffd166" : "#ff7f50";
  const flameSize = 5 + Math.random() * 6;
  ctx.beginPath();
  ctx.moveTo(0, player.height / 2);
  ctx.lineTo(-flameSize, player.height / 2 - 5);
  ctx.lineTo(-flameSize, player.height / 2 + 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawEnemyDrone(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.moveTo(enemy.size, enemy.size / 2);
  ctx.lineTo(enemy.size * 0.68, 2);
  ctx.lineTo(enemy.size * 0.28, 6);
  ctx.lineTo(0, enemy.size / 2);
  ctx.lineTo(enemy.size * 0.28, enemy.size - 6);
  ctx.lineTo(enemy.size * 0.68, enemy.size - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(enemy.size * 0.2, enemy.size * 0.2, enemy.size * 0.55, enemy.size * 0.6);

  ctx.fillStyle = "#ffd6a5";
  ctx.fillRect(enemy.size * 0.56, enemy.size * 0.41, enemy.size * 0.2, enemy.size * 0.14);

  const thruster = 3 + Math.sin(enemy.thruster) * 2;
  ctx.fillStyle = "#ff8fab";
  ctx.fillRect(-thruster, enemy.size * 0.45, thruster, enemy.size * 0.1);

  ctx.restore();
}

function drawBossShip() {
  const boss = game.boss;
  if (!boss) return;

  ctx.fillStyle = boss.color;
  ctx.fillRect(boss.x, boss.y + 18, boss.width, boss.height - 36);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(boss.x + 16 + i * 34, boss.y + 28, 20, boss.height - 56);
  }

  ctx.beginPath();
  ctx.moveTo(boss.x + boss.width, boss.y + boss.height / 2);
  ctx.lineTo(boss.x + boss.width - 32, boss.y + 2);
  ctx.lineTo(boss.x + 32, boss.y + 18);
  ctx.lineTo(boss.x + 32, boss.y + boss.height - 18);
  ctx.lineTo(boss.x + boss.width - 32, boss.y + boss.height - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(boss.x + 20, boss.y + 30, boss.width - 52, boss.height - 60);

  ctx.fillStyle = "#94d2bd";
  ctx.fillRect(boss.x + boss.width - 30, boss.y + boss.height / 2 - 8, 14, 16);
  ctx.fillRect(boss.x + 8, boss.y + 26, 10, 12);
  ctx.fillRect(boss.x + 8, boss.y + boss.height - 38, 10, 12);

  ctx.strokeStyle = "rgba(255, 209, 102, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boss.x + 26, boss.y + boss.height / 2);
  ctx.lineTo(boss.x + boss.width - 36, boss.y + boss.height / 2);
  ctx.stroke();

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

function drawExplosions() {
  game.explosions.forEach((blast) => {
    if (blast.life > 0) {
      ctx.globalAlpha = blast.life / 18;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, blast.shockwave * (1 - blast.life / 18), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    blast.particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0.2, particle.life / 30);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  });
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

  drawPlayerShip();

  game.bullets.forEach((bullet) => {
    ctx.fillStyle = "#8cffb2";
    ctx.fillRect(bullet.x, bullet.y - bullet.size / 2, bullet.size * 2, bullet.size);
  });

  game.grenades.forEach((grenade) => {
    ctx.fillStyle = "#ffbf69";
    ctx.beginPath();
    ctx.arc(grenade.x, grenade.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1c1";
    ctx.fillRect(grenade.x - 2, grenade.y - 2, 4, 4);
  });

  game.powerUps.forEach((powerUp) => {
    const pulse = 1 + Math.sin(powerUp.pulse) * 0.2;
    ctx.save();
    ctx.translate(powerUp.x, powerUp.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#90e0ef";
    ctx.beginPath();
    ctx.arc(0, 0, powerUp.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#023047";
    ctx.fillRect(-7, -2, 14, 4);
    ctx.fillRect(-2, -7, 4, 14);
    ctx.restore();
  });

  game.enemyBullets.forEach((bullet) => {
    ctx.fillStyle = bullet.boss ? "#ff9ee5" : "#ffadad";
    ctx.fillRect(bullet.x, bullet.y - bullet.size / 2, bullet.size * 2, bullet.size);
  });

  game.enemies.forEach(drawEnemyDrone);

  if (game.bossActive && game.boss) drawBossShip();

  drawExplosions();

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
