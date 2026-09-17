const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

let gameState = "start"; // start, playing, paused, gameover
let windForce = 0;       // wind effect
let raining = false;     // rain effect
let loadShedding = false; // disables charging zones

class Drone {
  constructor() {
    this.x = 100;
    this.y = 100;
    this.angle = 0;
    this.speed = 0;
    this.battery = 100;
    this.distance = 0;
    this.score = 0;
  }

  update() {
    // Apply wind drift
    this.x += windForce;

    // Movement
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.distance += Math.abs(this.speed);

    // Battery drain
    if (this.speed !== 0) {
      this.battery -= 0.05;
      this.score += 1;
    }

    if (this.battery <= 0) {
      this.battery = 0;
      gameState = "gameover";   // End the game when battery runs out
      const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
    if (this.score > highScore) {
      localStorage.setItem("highScore", this.score);
    }
  }

  }

  draw() {
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.fillText(`Battery: ${this.battery.toFixed(1)}%`, 10, 20);
    ctx.fillText(`Distance: ${this.distance.toFixed(0)}m`, 10, 40);
    ctx.fillText(`Score: ${this.score}`, 10, 60);
    ctx.fillText(`High Score: ${localStorage.getItem("highScore") || 0}`, 10, 80);

    if (raining) ctx.fillText("Rain: Visibility Reduced", 10, 100);
    if (windForce !== 0) ctx.fillText("Wind Drift Active", 10, 120);
    if (loadShedding) ctx.fillText("Load-Shedding: Charging Disabled", 10, 140);
  }
}

class ChargingZone {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    draw() {
        ctx.fillStyle = "green";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    contains(drone) {
        const dx = drone.x - this.x;
        const dy = drone.y - this.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < this.radius;
    }
}

class Obstacle {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  draw() {
    ctx.fillStyle = "brown";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  collides(drone) {
    const dx = drone.x - this.x;
    const dy = drone.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + 20;
  }
}

const drone = new Drone();
const obstacles = [new Obstacle(400, 300, 30), new Obstacle(600, 200, 40)];
const chargingZone = new ChargingZone(750, 400, 60);

function drawBackground() {
  // Cycle between day and night
  cycleCounter++;
  if (cycleCounter % 600 === 0) { // every ~10 seconds
    timeOfDay = timeOfDay === 0 ? 1 : 0;
  }

  if (timeOfDay === 0) {
    // Daytime sky
    ctx.fillStyle = "#84bfd6";
  } else {
    // Nighttime sky
    ctx.fillStyle = "#315d89";
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add sun/moon
  if (timeOfDay === 0) {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(700, 100, 40, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(700, 100, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStartScreen() {
  ctx.fillStyle = "black";
  ctx.font = "30px Calibri";
  ctx.fillText("EcoDash - African Logistics", 250, 250);
  ctx.fillText("Press ENTER to Start", 280, 300);
}

function drawPauseScreen() {
  ctx.fillStyle = "black";
  ctx.font = "30px Calibri";
  ctx.fillText("Game Paused", 320, 250);
  ctx.fillText("Press P to Resume", 300, 300);
}

function drawGameOverScreen() {
  ctx.fillStyle = "red";
  ctx.font = "30px Calibri";
  ctx.fillText("Game Over!", 330, 250);
  ctx.fillText("Press ENTER to Restart", 270, 300);
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  chargingZone.draw();

if (chargingZone.contains(drone) && !loadShedding) {
    drone.battery += 0.2;

    if (drone.battery > 100) {
        drone.battery = 100;
    }
}

  if (gameState === "start") {
    drawStartScreen();
  } else if (gameState === "playing") {
    drone.update();
    drone.draw();

    obstacles.forEach(obs => {
      obs.draw();
      if (obs.collides(drone)) {
        gameState = "gameover";
        const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
        if (drone.score > highScore) {
          localStorage.setItem("highScore", drone.score);
        }
      }
    });

    // Rain effect: reduce visibility
    if (raining) {
      ctx.fillStyle = "rgba(0,0,255,0.2)";
      for (let i = 0; i < 50; i++) {
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 10);
      }
    }
  } else if (gameState === "paused") {
    drawPauseScreen();
  } else if (gameState === "gameover") {
    drawGameOverScreen();
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();

function restartGame() {
  drone.x = 100;
  drone.y = 100;
  drone.angle = 0;
  drone.speed = 0;
  drone.battery = 100;
  drone.distance = 0;
  drone.score = 0;
  gameState = "playing";
}

// Controls
document.addEventListener("keydown", e => {
  if (gameState === "start" && e.key === "Enter") {
    gameState = "playing";
  } else if (gameState === "playing") {
    if (e.key === "ArrowUp") drone.speed = 2;
    if (e.key === "ArrowDown") drone.speed = -2;
    if (e.key === "ArrowLeft") drone.angle -= 0.1;
    if (e.key === "ArrowRight") drone.angle += 0.1;
    if (e.key.toLowerCase() === "p") gameState = "paused";

    // Toggle environmental effects
    if (e.key.toLowerCase() === "r") raining = !raining;
    if (e.key.toLowerCase() === "w") windForce = windForce === 0 ? 0.5 : 0;
    if (e.key.toLowerCase() === "l") loadShedding = !loadShedding;
  } else if (gameState === "paused" && e.key.toLowerCase() === "p") {
    gameState = "playing";
  } else if (gameState === "gameover" && e.key === "Enter") {
    restartGame();
  }
});

document.addEventListener("keyup", () => {
  if (gameState === "playing") drone.speed = 0;
});