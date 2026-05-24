const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.getElementById("levelLabel"),
  score: document.getElementById("scoreLabel"),
  highScore: document.getElementById("highScoreLabel"),
  health: document.getElementById("healthLabel"),
  grenades: document.getElementById("grenadeLabel"),
  character: document.getElementById("characterLabel"),
  story: document.getElementById("storyPanel"),
  highScoreEntry: document.getElementById("highScoreEntry"),
  highScoreName: document.getElementById("highScoreName"),
  saveHighScoreBtn: document.getElementById("saveHighScoreBtn"),
  musicToggleBtn: document.getElementById("musicToggleBtn")
};

const highScoreStorageKey = "spacePiratesHighScoreV3";
const highScoreNameStorageKey = "spacePiratesHighScoreNameV3";
const storedHighScore = Number.parseInt(localStorage.getItem(highScoreStorageKey) || "0", 10);
const storedHighScoreName = localStorage.getItem(highScoreNameStorageKey) || "Anonymous";

const levels = [
  {
    name: "Nebula Run",
    crew: "Captain Rhea Starflare",
    story: "Rhea leads the Iron Tide through a glowing nebula while fending off scavenger drones sent by Dread Corsair Varn.",
    enemyColor: "#ff7b7b",
    enemySpeed: 1.5,
    spawnRate: 0.032,
    targetScore: 420,
    boss: { name: "Dread Corsair Varn", health: 200, color: "#ff3c3c", speed: 1.8 }
  },
  {
    name: "Moon of Rust",
    crew: "Navigator Jax Comet & Engineer Nyla Flux",
    story: "Jax and Nyla navigate wreckage fields around the Moon of Rust while rival raiders strike from cover.",
    enemyColor: "#ffd166",
    enemySpeed: 1.95,
    spawnRate: 0.046,
    targetScore: 980,
    boss: { name: "Admiral Scourge Talon", health: 280, color: "#ff9f1c", speed: 2.2 }
  },
  {
    name: "Kraken Gate",
    crew: "Gunner Bytebeard + First Mate Sol Rift",
    story: "At the ancient Kraken Gate, Bytebeard and Sol unleash broadside plasma cannons against the Void Armada.",
    enemyColor: "#8ecae6",
    enemySpeed: 2.3,
    spawnRate: 0.058,
    targetScore: 1700,
    boss: { name: "The Void Kraken", health: 380, color: "#7b2cbf", speed: 2.5 }
  }
];

const game = {
  paused: false,
  score: 0,
  starsFar: Array.from({ length: 100 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 0.5 + Math.random() * 1.2 })),
  starsNear: Array.from({ length: 60 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 1 + Math.random() * 2 })),
  bullets: [],
  grenades: [],
  enemies: [],
  enemyBullets: [],
  powerUps: [],
  explosions: [],
  highScore: Number.isFinite(storedHighScore) ? storedHighScore : 0,
  highScoreName: storedHighScoreName,
  isNewHighScore: false,
  levelIndex: 0,
  boss: null,
  bossActive: false,
  gameOver: false,
  win: false
};

const player = {
  x: 110,
  y: canvas.height / 2,
  width: 74,
  height: 44,
  speed: 4.2,
  cooldown: 0,
  grenadeCooldown: 0,
  gunPowerTimer: 0,
  gunMode: 1,
  shieldTimer: 0,
  health: 100,
  grenades: 5,
  damageFlash: 0
};

const music = {
  ctx: null,
  master: null,
  isPlaying: false,
  tempoMs: 280,
  lookAhead: 0.16,
  lastScheduleTime: 0,
  step: 0,
  rafId: null
};

const keys = {};

ui.saveHighScoreBtn.addEventListener("click", () => saveHighScoreName());
ui.highScoreName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveHighScoreName();
});
ui.musicToggleBtn.addEventListener("click", () => toggleMusic());

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (event.key === " ") event.preventDefault();
  if (key === "p") game.paused = !game.paused;
  if (key === "r" && (game.gameOver || game.win)) resetGame();
  if (key === "g" && !event.repeat) launchGrenade();
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

function ensureMusicContext() {
  if (!music.ctx) {
    music.ctx = new window.AudioContext();
    music.master = music.ctx.createGain();
    music.master.gain.value = 0.16;
    music.master.connect(music.ctx.destination);
    music.lastScheduleTime = music.ctx.currentTime;
  }
}

function playNoteAt(time, frequency, duration, type, gain) {
  if (!music.ctx || !music.master) return;
  const osc = music.ctx.createOscillator();
  const amp = music.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, time);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(amp);
  amp.connect(music.master);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function scheduleMusic() {
  if (!music.ctx || !music.isPlaying) return;

  const secondsPerStep = music.tempoMs / 1000;
  while (music.lastScheduleTime < music.ctx.currentTime + music.lookAhead) {
    const lead = [220, 246.94, 277.18, 329.63, 293.66, 246.94, 220, 329.63];
    const bass = [110, 110, 130.81, 146.83, 110, 98, 87.31, 98];
    const i = music.step % 8;

    playNoteAt(music.lastScheduleTime, lead[i], 0.22, "sawtooth", 0.055);
    playNoteAt(music.lastScheduleTime, bass[i], 0.26, "triangle", 0.06);
    if (music.step % 2 === 0) playNoteAt(music.lastScheduleTime, lead[(i + 3) % 8] * 2, 0.09, "square", 0.028);

    music.step += 1;
    music.lastScheduleTime += secondsPerStep;
  }

  music.rafId = requestAnimationFrame(scheduleMusic);
}

async function toggleMusic() {
  ensureMusicContext();
  if (!music.ctx) return;
  if (music.ctx.state !== "running") await music.ctx.resume();

  music.isPlaying = !music.isPlaying;
  ui.musicToggleBtn.textContent = music.isPlaying ? "🔇 Stop Epic Music" : "🎵 Start Epic Music";

  if (music.isPlaying) {
    music.lastScheduleTime = music.ctx.currentTime;
    scheduleMusic();
  } else if (music.rafId) {
    cancelAnimationFrame(music.rafId);
    music.rafId = null;
  }
}

function currentLevel() {
  return levels[Math.min(game.levelIndex, levels.length - 1)];
}

function saveHighScoreName() {
  if (!game.isNewHighScore) return;
  const name = ui.highScoreName.value.trim().slice(0, 14) || "Anonymous";
  game.highScoreName = name;
  localStorage.setItem(highScoreNameStorageKey, name);
  game.isNewHighScore = false;
  ui.highScoreEntry.classList.add("hidden");
  updateHud();
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
  player.gunPowerTimer = 0;
  player.gunMode = 1;
  player.shieldTimer = 0;
  player.x = 110;
  player.y = canvas.height / 2;
  player.cooldown = 0;
  player.grenadeCooldown = 0;

  updateHud();
}

function updateHighScore() {
  if (game.score > game.highScore) {
    game.highScore = game.score;
    game.isNewHighScore = true;
    ui.highScoreEntry.classList.remove("hidden");
    localStorage.setItem(highScoreStorageKey, String(game.highScore));
  }
}

function updateHud() {
  const level = currentLevel();
  ui.level.textContent = `${game.levelIndex + 1} - ${level.name}`;
  ui.score.textContent = game.score;
  ui.highScore.textContent = `${game.highScoreName}: ${game.highScore}`;
  ui.health.textContent = Math.max(0, Math.floor(player.health));
  ui.grenades.textContent = player.grenades;
  ui.character.textContent = level.crew;

  const buffs = [];
  if (player.gunPowerTimer > 0) buffs.push(`${player.gunMode === 4 ? "Quad" : "Twin"} cannons (${Math.ceil(player.gunPowerTimer / 60)}s)`);
  if (player.shieldTimer > 0) buffs.push(`Shield (${Math.ceil(player.shieldTimer / 60)}s)`);
  ui.story.textContent = buffs.length ? `${level.story} Active: ${buffs.join(" | ")}.` : level.story;
}

function takePlayerDamage(amount) {
  const scaledAmount = player.shieldTimer > 0 ? amount * 0.45 : amount;
  player.health -= scaledAmount;
  player.damageFlash = 10;
}

function spawnExplosion(x, y, color = "#ff9f1c", radius = 50) {
  const particles = Array.from({ length: 34 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4.4;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 22 + Math.floor(Math.random() * 14),
      size: 1.4 + Math.random() * 3.4,
      color
    };
  });
  game.explosions.push({ x, y, particles, shockwave: radius, life: 20 });
}

function shoot() {
  const centerY = player.y + player.height / 2;
  const x = player.x + player.width;
  if (player.gunMode === 4) {
    game.bullets.push({ x, y: centerY - 14, vx: 9.7, size: 4.2, glow: "#90e0ef" });
    game.bullets.push({ x, y: centerY - 5, vx: 9.7, size: 4.2, glow: "#90e0ef" });
    game.bullets.push({ x, y: centerY + 5, vx: 9.7, size: 4.2, glow: "#90e0ef" });
    game.bullets.push({ x, y: centerY + 14, vx: 9.7, size: 4.2, glow: "#90e0ef" });
  } else if (player.gunMode === 2) {
    game.bullets.push({ x, y: centerY - 9, vx: 9.2, size: 4.2, glow: "#8cf2ff" });
    game.bullets.push({ x, y: centerY + 9, vx: 9.2, size: 4.2, glow: "#8cf2ff" });
  } else {
    game.bullets.push({ x, y: centerY, vx: 8.8, size: 4, glow: "#8cffb2" });
  }
}

function launchGrenade() {
  if (game.paused || game.gameOver || game.win) return;
  if (player.grenades <= 0 || player.grenadeCooldown > 0) return;

  game.grenades.push({ x: player.x + player.width, y: player.y + player.height / 2, vx: 5.1, life: 130, radius: 195, damage: 120, exploded: false });
  player.grenades -= 1;
  player.grenadeCooldown = 22;
}

function maybeSpawnPowerUp(x, y) {
  const roll = Math.random();
  const kind = roll < 0.4 ? "weapon" : roll < 0.7 ? "shield" : "repair";
  game.powerUps.push({ x, y, vx: -2.3, size: 16, pulse: 0, ring: 0, kind });
}

function applyPowerUp(powerUp) {
  if (powerUp.kind === "weapon") {
    player.gunMode = player.gunPowerTimer > 0 ? 4 : 2;
    player.gunPowerTimer = 15 * 60;
    spawnExplosion(powerUp.x, powerUp.y, "#90e0ef", 60);
  } else if (powerUp.kind === "shield") {
    player.shieldTimer = 15 * 60;
    spawnExplosion(powerUp.x, powerUp.y, "#9bf6ff", 58);
  } else {
    player.health = Math.min(100, player.health + 35);
    spawnExplosion(powerUp.x, powerUp.y, "#caffbf", 52);
  }
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
      game.score += 48;
      spawnExplosion(ex, ey, enemy.color, 66);
      if (Math.random() < 0.3) maybeSpawnPowerUp(ex, ey);
    }
  });

  if (game.bossActive && game.boss) {
    const bx = game.boss.x + game.boss.width / 2;
    const by = game.boss.y + game.boss.height / 2;
    if (Math.hypot(bx - grenade.x, by - grenade.y) <= grenade.radius + 70) {
      game.boss.health -= grenade.damage;
      spawnExplosion(bx, by, "#ffd166", 78);
      if (game.boss.health <= 0) {
        game.score += 240;
        spawnExplosion(bx, by, game.boss.color, 160);
        progressLevel();
      }
    }
  }
}

function spawnEnemy() {
  const level = currentLevel();
  if (Math.random() < level.spawnRate && !game.bossActive) {
    const size = 30 + Math.random() * 18;
    game.enemies.push({
      x: canvas.width + size,
      y: 20 + Math.random() * (canvas.height - 80),
      size,
      vx: level.enemySpeed + Math.random() * 1.4,
      color: level.enemyColor,
      hp: 24 + game.levelIndex * 13,
      thruster: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2
    });
  }
}

function maybeSpawnBoss() {
  const level = currentLevel();
  if (!game.bossActive && game.score >= level.targetScore) {
    game.bossActive = true;
    game.boss = { x: canvas.width - 180, y: canvas.height / 2 - 95, width: 188, height: 172, health: level.boss.health, dir: 1, speed: level.boss.speed, color: level.boss.color, name: level.boss.name, fireCooldown: 0, phase: 0 };
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
    player.cooldown = player.gunMode === 4 ? 11 : 9;
  }

  spawnEnemy();
  maybeSpawnBoss();

  game.starsFar.forEach((s) => {
    s.x -= 0.35 + s.r * 0.25;
    if (s.x < 0) {
      s.x = canvas.width;
      s.y = Math.random() * canvas.height;
    }
  });

  game.starsNear.forEach((s) => {
    s.x -= 0.8 + s.r * 0.35;
    if (s.x < 0) {
      s.x = canvas.width;
      s.y = Math.random() * canvas.height;
    }
  });

  game.bullets.forEach((b) => {
    b.x += b.vx;
  });
  game.bullets = game.bullets.filter((b) => b.x < canvas.width + 10);

  game.grenades.forEach((g) => {
    g.x += g.vx;
    g.life -= 1;
    if (!g.exploded) {
      const nearEnemy = game.enemies.some((enemy) => Math.hypot(enemy.x - g.x, enemy.y - g.y) < enemy.size + 15);
      if (nearEnemy || g.life <= 0 || g.x > canvas.width * 0.85) detonateGrenade(g);
    }
  });
  game.grenades = game.grenades.filter((g) => !g.exploded);

  game.enemies.forEach((enemy) => {
    enemy.bob += 0.05;
    enemy.x -= enemy.vx;
    enemy.y += Math.sin(enemy.bob) * 0.4;
    enemy.thruster += 0.2;
    if (Math.random() < 0.011 + game.levelIndex * 0.004) game.enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vx: -(3.3 + game.levelIndex), size: 4 });
  });

  game.enemyBullets.forEach((b) => {
    b.x += b.vx;
  });
  game.enemyBullets = game.enemyBullets.filter((b) => b.x > -20);
  game.enemies = game.enemies.filter((enemy) => enemy.x + enemy.size > -40);

  if (game.bossActive && game.boss) {
    game.boss.phase += 0.04;
    game.boss.y += game.boss.speed * game.boss.dir;
    game.boss.x += Math.sin(game.boss.phase) * 0.9;
    if (game.boss.y < 20 || game.boss.y + game.boss.height > canvas.height - 20) game.boss.dir *= -1;

    if (game.boss.fireCooldown > 0) game.boss.fireCooldown -= 1;
    if (game.boss.fireCooldown <= 0) {
      const b = game.boss;
      game.enemyBullets.push({ x: b.x, y: b.y + b.height / 2 - 18, vx: -5.1, size: 5.4, boss: true });
      game.enemyBullets.push({ x: b.x, y: b.y + b.height / 2 + 18, vx: -5.1, size: 5.4, boss: true });
      game.boss.fireCooldown = 30;
    }
  }

  game.bullets.forEach((bullet) => {
    game.enemies.forEach((enemy) => {
      const hit = bullet.x > enemy.x && bullet.x < enemy.x + enemy.size && bullet.y > enemy.y && bullet.y < enemy.y + enemy.size;
      if (hit) {
        enemy.hp -= player.gunMode === 4 ? 12 : 14;
        bullet.x = canvas.width + 100;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          game.score += 30;
          spawnExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 45);
          if (Math.random() < 0.18) maybeSpawnPowerUp(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2);
        }
      }
    });

    if (game.bossActive && game.boss) {
      const b = game.boss;
      const hitBoss = bullet.x > b.x && bullet.x < b.x + b.width && bullet.y > b.y && bullet.y < b.y + b.height;
      if (hitBoss) {
        b.health -= player.gunMode === 4 ? 6 : 8;
        bullet.x = canvas.width + 100;
        game.score += 2;
        if (b.health <= 0) {
          game.score += 200;
          spawnExplosion(b.x + b.width / 2, b.y + b.height / 2, b.color, 150);
          progressLevel();
        }
      }
    }
  });

  game.enemies = game.enemies.filter((e) => !e.dead);

  game.powerUps.forEach((p) => {
    p.x += p.vx;
    p.pulse += 0.2;
    p.ring += 0.05;
  });
  game.powerUps = game.powerUps.filter((p) => p.x > -30);

  const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };

  game.enemies.forEach((enemy) => {
    const enemyRect = { x: enemy.x, y: enemy.y, width: enemy.size, height: enemy.size };
    if (rectCollision(playerRect, enemyRect)) {
      takePlayerDamage(16);
      enemy.dead = true;
      spawnExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 42);
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
    if (rectCollision(playerRect, bossRect)) takePlayerDamage(0.8);
  }

  game.powerUps.forEach((p) => {
    if (p.x > player.x && p.x < player.x + player.width && p.y > player.y && p.y < player.y + player.height) {
      applyPowerUp(p);
      p.collected = true;
    }
  });
  game.powerUps = game.powerUps.filter((p) => !p.collected);

  if (player.damageFlash > 0) player.damageFlash -= 1;
  if (player.gunPowerTimer > 0) {
    player.gunPowerTimer -= 1;
    if (player.gunPowerTimer <= 0) player.gunMode = 1;
  }
  if (player.shieldTimer > 0) player.shieldTimer -= 1;

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
  updateHighScore();
  updateHud();
}

function drawPlayerShip() {
  const flashing = player.damageFlash > 0 && player.damageFlash % 2 === 0;
  const hullColor = flashing ? "#ff8c42" : "#d5dceb";

  ctx.save();
  ctx.translate(player.x, player.y + player.height / 2);

  // X-wing style split wings
  ctx.fillStyle = "#b6c3d8";
  ctx.beginPath();
  ctx.moveTo(10, -16);
  ctx.lineTo(50, -9);
  ctx.lineTo(66, -18);
  ctx.lineTo(62, -5);
  ctx.lineTo(26, -1);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(10, 16);
  ctx.lineTo(50, 9);
  ctx.lineTo(66, 18);
  ctx.lineTo(62, 5);
  ctx.lineTo(26, 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#9fb0c9";
  ctx.beginPath();
  ctx.moveTo(10, -6);
  ctx.lineTo(50, -2);
  ctx.lineTo(64, -11);
  ctx.lineTo(58, 0);
  ctx.lineTo(28, 1);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(10, 6);
  ctx.lineTo(50, 2);
  ctx.lineTo(64, 11);
  ctx.lineTo(58, 0);
  ctx.lineTo(28, -1);
  ctx.closePath();
  ctx.fill();

  // fuselage
  ctx.fillStyle = hullColor;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(54, -8);
  ctx.lineTo(73, 0);
  ctx.lineTo(54, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#6fa8dc";
  ctx.fillRect(30, -5, 15, 10);

  ctx.fillStyle = "#ee6352";
  ctx.fillRect(18, -14, 4, 4);
  ctx.fillRect(18, 10, 4, 4);

  if (player.gunMode > 1) {
    ctx.fillStyle = player.gunMode === 4 ? "#90e0ef" : "#8cf2ff";
    ctx.fillRect(63, -17, 6, 4);
    ctx.fillRect(63, -7, 6, 4);
    ctx.fillRect(63, 3, 6, 4);
    ctx.fillRect(63, 13, 6, 4);
  }

  const flame = 6 + Math.random() * 7;
  ctx.fillStyle = flashing ? "#ffd166" : "#ff7f50";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-flame, -6);
  ctx.lineTo(-flame, 6);
  ctx.closePath();
  ctx.fill();

  if (player.shieldTimer > 0) {
    ctx.strokeStyle = "rgba(146, 240, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(36, 0, 32 + Math.sin(player.shieldTimer * 0.2) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemyDrone(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  const g = ctx.createLinearGradient(0, 0, enemy.size, enemy.size);
  g.addColorStop(0, enemy.color);
  g.addColorStop(1, "#2f2f4f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(enemy.size, enemy.size / 2);
  ctx.lineTo(enemy.size * 0.72, 2);
  ctx.lineTo(enemy.size * 0.3, 5);
  ctx.lineTo(0, enemy.size / 2);
  ctx.lineTo(enemy.size * 0.3, enemy.size - 5);
  ctx.lineTo(enemy.size * 0.72, enemy.size - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(enemy.size * 0.2, enemy.size * 0.2, enemy.size * 0.57, enemy.size * 0.6);

  ctx.fillStyle = "#ffd6a5";
  ctx.fillRect(enemy.size * 0.58, enemy.size * 0.43, enemy.size * 0.22, enemy.size * 0.14);

  const thruster = 3 + Math.sin(enemy.thruster) * 2;
  ctx.fillStyle = "#ff8fab";
  ctx.fillRect(-thruster, enemy.size * 0.45, thruster, enemy.size * 0.1);

  ctx.restore();
}

function drawBossShip() {
  const boss = game.boss;
  if (!boss) return;

  const body = ctx.createLinearGradient(boss.x, boss.y, boss.x + boss.width, boss.y + boss.height);
  body.addColorStop(0, boss.color);
  body.addColorStop(1, "#281a54");
  ctx.fillStyle = body;
  ctx.fillRect(boss.x, boss.y + 20, boss.width, boss.height - 40);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(boss.x + 16 + i * 36, boss.y + 30, 22, boss.height - 60);
  }

  ctx.beginPath();
  ctx.moveTo(boss.x + boss.width, boss.y + boss.height / 2);
  ctx.lineTo(boss.x + boss.width - 36, boss.y + 2);
  ctx.lineTo(boss.x + 36, boss.y + 20);
  ctx.lineTo(boss.x + 36, boss.y + boss.height - 20);
  ctx.lineTo(boss.x + boss.width - 36, boss.y + boss.height - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(boss.x + 22, boss.y + 34, boss.width - 56, boss.height - 68);

  ctx.fillStyle = "#94d2bd";
  ctx.fillRect(boss.x + boss.width - 32, boss.y + boss.height / 2 - 10, 16, 20);
  ctx.fillRect(boss.x + 10, boss.y + 26, 12, 14);
  ctx.fillRect(boss.x + 10, boss.y + boss.height - 40, 12, 14);

  const glowPulse = 0.5 + Math.sin(boss.phase * 2) * 0.5;
  ctx.fillStyle = `rgba(255,120,240,${0.28 + glowPulse * 0.22})`;
  ctx.beginPath();
  ctx.arc(boss.x + boss.width - 18, boss.y + boss.height / 2, 16 + glowPulse * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fefefe";
  ctx.font = "15px sans-serif";
  ctx.fillText(boss.name, boss.x + 10, boss.y - 10);

  const w = 190;
  const hpPct = Math.max(0, boss.health) / currentLevel().boss.health;
  ctx.fillStyle = "#111";
  ctx.fillRect(canvas.width - w - 20, 14, w, 15);
  ctx.fillStyle = "#ff595e";
  ctx.fillRect(canvas.width - w - 20, 14, w * hpPct, 15);
}

function drawPowerUp(powerUp) {
  const pulse = 1 + Math.sin(powerUp.pulse) * 0.2;
  ctx.save();
  ctx.translate(powerUp.x, powerUp.y);
  ctx.scale(pulse, pulse);

  const colors = {
    weapon: { base: "#90e0ef", icon: "#023047" },
    shield: { base: "#9bf6ff", icon: "#005f73" },
    repair: { base: "#caffbf", icon: "#2d6a4f" }
  };
  const c = colors[powerUp.kind];

  ctx.strokeStyle = c.base;
  ctx.beginPath();
  ctx.arc(0, 0, powerUp.size + Math.sin(powerUp.ring) * 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = c.base;
  ctx.beginPath();
  ctx.arc(0, 0, powerUp.size, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.icon;
  if (powerUp.kind === "weapon") {
    ctx.fillRect(-8, -2, 16, 4);
    ctx.fillRect(-2, -8, 4, 16);
  } else if (powerUp.kind === "shield") {
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -4);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 10);
    ctx.lineTo(-5, 6);
    ctx.lineTo(-7, -4);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-9, -2, 18, 4);
    ctx.fillRect(-2, -9, 4, 18);
    ctx.clearRect(-2, -2, 4, 4);
  }

  ctx.restore();
}

function drawExplosions() {
  game.explosions.forEach((blast) => {
    if (blast.life > 0) {
      ctx.globalAlpha = blast.life / 20;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, blast.shockwave * (1 - blast.life / 20), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    blast.particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0.15, particle.life / 32);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  });
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#070d1f");
  grad.addColorStop(1, "#0e1637");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  game.starsFar.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  game.starsNear.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayerShip();

  game.bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.glow;
    ctx.fillRect(bullet.x - 6, bullet.y - bullet.size / 2, 12, bullet.size);
  });

  game.grenades.forEach((grenade) => {
    ctx.fillStyle = "#ffbf69";
    ctx.beginPath();
    ctx.arc(grenade.x, grenade.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });

  game.powerUps.forEach(drawPowerUp);

  game.enemyBullets.forEach((bullet) => {
    ctx.fillStyle = bullet.boss ? "#ff9ee5" : "#ffadad";
    ctx.fillRect(bullet.x - 2, bullet.y - bullet.size / 2, bullet.size * 2, bullet.size);
  });

  game.enemies.forEach(drawEnemyDrone);
  if (game.bossActive && game.boss) drawBossShip();
  drawExplosions();

  ctx.fillStyle = "#fff";
  ctx.font = "17px sans-serif";
  if (game.paused) ctx.fillText("Paused - press P to continue", canvas.width / 2 - 120, canvas.height / 2);

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
