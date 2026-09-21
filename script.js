const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

let gameState = "start"; // start, playing, paused, gameover
let windForce = 0;       // wind effect
let raining = false;     // rain effect
let loadShedding = false; // disables charging zones
let timeOfDay = 0;
let cycleCounter = 0;

// Load sounds
const bgMusic = new Audio("assets/sounds/background.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.5;

const collisionSound = new Audio("assets/sounds/collision.wav");
const moveSound = new Audio("assets/sounds/move.wav");

// -------------------- CLASSES --------------------

class Drone {
  constructor() {
    this.x = 100;
    this.y = 100;
    this.angle = 0;
    this.speed = 0;
    this.battery = 100;
    this.distance = 0;
    this.score = 0;
    this.acceleration = 0;
    this.maxSpeed = 10;
    this.friction = 0.08;
  }

  update() {
    // Apply wind drift
    this.x += windForce;

    // Apply acceleration
    this.speed += this.acceleration;

    // Apply friction
    if (this.acceleration === 0) {
      if (this.speed > 0) {
        this.speed -= this.friction;
        if (this.speed < 0) this.speed = 0;
      } else if (this.speed < 0) {
        this.speed += this.friction;
        if (this.speed > 0) this.speed = 0;
      }
    }

    // Clamp speed
    if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    if (this.speed < -this.maxSpeed) this.speed = -this.maxSpeed;

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
      gameState = "gameover";
      const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
      if (this.score > highScore) {
        localStorage.setItem("highScore", this.score);
      }
    }

    // Border collision checks
    if (this.x < 20) this.x = 20;
    if (this.x > canvas.width - 20) this.x = canvas.width - 20;
    if (this.y < 20) this.y = 20;
    if (this.y > canvas.height - 20) this.y = canvas.height - 20;
  }

  draw() {
    // Drone
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
    ctx.fill();

    // HUD text
    ctx.fillStyle = "black";
    ctx.fillText(`Distance: ${this.distance.toFixed(0)}m`, 10, 50);
    ctx.fillText(`Score: ${this.score}`, 10, 75);
    ctx.fillText(`High Score: ${localStorage.getItem("highScore") || 0}`, 10, 100);

    if (raining) ctx.fillText("Rain: Visibility Reduced", 10, 100);
    if (windForce !== 0) ctx.fillText("Wind Drift Active", 10, 120);
    if (loadShedding) ctx.fillText("Load-Shedding: Charging Disabled", 10, 140);

    // Efficiency score
    const usedBattery = 100 - this.battery;
    const efficiency = usedBattery > 0 ? (this.distance / usedBattery).toFixed(2) : 0;
    ctx.fillText(`Efficiency: ${efficiency} m/%`, 10, 125);

    // Battery bar HUD
    
    ctx.fillText(`Battery:  ${this.battery.toFixed(0)}%`, 10, 25);
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

class Pothole {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  draw() {
    ctx.fillStyle = "darkgrey";
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

class TrafficCar {
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
  }
  update() {
    this.x += this.speed;
    if (this.speed > 0 && this.x > canvas.width + this.width) {
      this.x = -this.width;
    } else if (this.speed < 0 && this.x < -this.width) {
      this.x = canvas.width + this.width;
    }
  }
  draw() {
    ctx.fillStyle = "red";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
  collides(drone) {
    return (
      drone.x < this.x + this.width &&
      drone.x + 20 > this.x &&
      drone.y < this.y + this.height &&
      drone.y + 20 > this.y
    );
  }
}

class Bird {
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
  }

  update() {
    this.x += this.speed;

    // Reset position when off-screen
    if (this.speed > 0 && this.x > canvas.width + this.width) {
      this.x = -this.width;
    } else if (this.speed < 0 && this.x < -this.width) {
      this.x = canvas.width + this.width;
    }
  }

  draw() {
    ctx.fillStyle = "orange"; // bird color
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 4, this.width, this.height / 2); // wings
  }

  collides(drone) {
    return (
      drone.x < this.x + this.width &&
      drone.x + 20 > this.x &&
      drone.y < this.y + this.height &&
      drone.y + 20 > this.y
    );
  }
}

// -------------------- OBJECTS --------------------

const drone = new Drone();
const obstacles = [
  new Obstacle(400, 300, 30),
  new Obstacle(600, 200, 40)
];

const chargingZone = new ChargingZone(750, 400, 60);
const potholes = [
  new Pothole(300, 250, 25),
  new Pothole(500, 400, 30)
];

const trafficCars = [
  new TrafficCar(0, 200, 60, 30, 3),
  new TrafficCar(800, 350, 70, 35, -4)
];

const birds = [
  new Bird(0, 150, 40, 20, 2),    // bird flying right
  new Bird(800, 250, 50, 25, -3)  // bird flying left
];


// -------------------- DRAWING --------------------

function drawBackground() {
  cycleCounter++;
  if (cycleCounter % 600 === 0) {
    timeOfDay = timeOfDay === 0 ? 1 : 0;
  }
  ctx.fillStyle = timeOfDay === 0 ? "#84bfd6" : "#315d89";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = timeOfDay === 0 ? "yellow" : "white";
  ctx.beginPath();
  ctx.arc(700, 100, timeOfDay === 0 ? 40 : 30, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillText("Game Paused", 300, 250);
  ctx.fillText("Press 'P' to Resume", 300, 300);
  ctx.fillText("Press 'R' to Restart", 300, 350);
}

function drawGameOverScreen() {
  ctx.fillStyle = "red";
  ctx.font = "30px Calibri";
  ctx.fillText("GAME OVER!", 330, 250);
  ctx.fillText("Press ENTER to Restart", 270, 300);
}

// -------------------- GAME LOOP --------------------

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
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

    // Obstacles
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

    // Potholes
    potholes.forEach(hole => {
      hole.draw();
      if (hole.collides(drone)) {
        gameState = "gameover";
        collisionSound.play();
        const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
        if (drone.score > highScore) {
          localStorage.setItem("highScore", drone.score);
        }
      }
    });

    // Traffic cars
    trafficCars.forEach(car => {
      car.update();
      car.draw();
      if (car.collides(drone)) {
        gameState = "gameover";
        collisionSound.play();
        const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
        if (drone.score > highScore) {
          localStorage.setItem("highScore", drone.score);
        }
      }
    });

    // Birds
    birds.forEach(bird => {
      bird.update();
      bird.draw();
      if (bird.collides(drone)) {
        gameState = "gameover";
        collisionSound.play();
        const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
        if (drone.score > highScore) {
          localStorage.setItem("highScore", drone.score);
        }
      }
    });

    // Rain effect
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

// -------------------- RESTART --------------------

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

// -------------------- CONTROLS --------------------

document.addEventListener("keydown", e => {
  if (gameState === "start" && e.key === "Enter") {
    gameState = "playing";
  } else if (gameState === "playing") {
    if (e.key === "ArrowUp") drone.acceleration = 0.1;
    if (e.key === "ArrowDown") drone.acceleration = -0.1;
    if (e.key === "ArrowLeft") drone.angle -= 0.1;
    if (e.key === "ArrowRight") drone.angle += 0.1;
    if (e.key.toLowerCase() === "p") gameState = "paused";

    // Toggle environmental effects
    if (e.key.toLowerCase() === "r") raining = !raining;
    if (e.key.toLowerCase() === "w") windForce = windForce === 0 ? 0.5 : 0;
    if (e.key.toLowerCase() === "l") loadShedding = !loadShedding;
  } else if (gameState === "paused" && e.key.toLowerCase() === "p") {
    gameState = "playing";
  } else if (gameState === "paused" && e.key === "r") {
    restartGame();
  } else if (gameState === "gameover" && e.key === "Enter") {
    restartGame();
  }
});

document.addEventListener("keyup", () => {
  if (gameState === "playing") drone.acceleration = 0;
});
