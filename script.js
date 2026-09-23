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

const keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

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
    this.resources = [];
    this.invulnerable = 0;
  }

  update() {
    // Apply wind drift
    this.x += windForce;

    if (keys.left) {
      this.angle -= 0.05;
    }

    if (keys.right) {
      this.angle += 0.05;
    }

    if (keys.up) {
      this.acceleration = 0.1;
    } else if (keys.down) {
      this.acceleration = -0.1;
    } else {
      this.acceleration = 0;
    }

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

    if (this.invulnerable > 0) {
      this.invulnerable--;
    }

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
    const padding = 8;

    return (
      drone.x + 20 > this.x + padding &&
      drone.x - 20 < this.x + this.width - padding &&
      drone.y + 20 > this.y + padding &&
      drone.y - 20 < this.y + this.height - padding
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
    const dx = drone.x - this.x;
    const dy = drone.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < 30;
  }
}

class House {
  constructor(x, y, width, height, color) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.requiredResources = [];
    this.delivered = false;
  }

  assignResources() {
    const resourceTypes = [
      "Medical",
      "Food",
      "Education",
      "Emergency"
    ];

    const amountNeeded = Math.floor(Math.random() * 3) + 1;

    while (this.requiredResources.length < amountNeeded) {
      const randomResource =
        resourceTypes[Math.floor(Math.random() * resourceTypes.length)];

      if (!this.requiredResources.includes(randomResource)) {
        this.requiredResources.push(randomResource);
      }
    }
  }

  draw() {
    ctx.fillStyle = "lightgreen";
    ctx.fillRect(this.x - 10, this.y - 10, this.width + 20, this.height + 20);

    // House
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Left window
    ctx.fillStyle = "white";
    ctx.fillRect(this.x + 10, this.y + 15, 20, 20);

    // Right window
    ctx.fillRect(this.x + 70, this.y + 15, 20, 20);

    // Door
    ctx.fillStyle = "#654321";
    ctx.fillRect(this.x + 40, this.y + 35, 20, 35);

    // Roof
    ctx.fillStyle = "maroon";
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width / 2, this.y - this.height / 2);
    ctx.lineTo(this.x + this.width, this.y);
    ctx.closePath();
    ctx.fill();

    // Resource requirements
    ctx.fillStyle = "black";
    ctx.font = "10px Arial";

    if (!this.delivered) {
      ctx.fillText(
        `${this.requiredResources.length} Supplies Needed`,
        this.x - 10,
        this.y - 10
      );
    } else {
      ctx.fillStyle = "green";
      ctx.fillText("Delivered", this.x + 15, this.y - 10);
    }
  }

  contains(drone) {
    const droneRadius = 20;

    return (
      drone.x + droneRadius > this.x &&
      drone.x - droneRadius < this.x + this.width &&
      drone.y + droneRadius > this.y &&
      drone.y - droneRadius < this.y + this.height
    );
  }
}

class ResourcePoint {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.collected = false; // track if resources have been picked up
  }

  draw() {
    ctx.fillStyle = this.collected ? "grey" : "purple"; // grey if already collected
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "14px Calibri";
    ctx.fillText("Resources", this.x - this.radius, this.y - this.radius - 5);
  }

  contains(drone) {
    const dx = drone.x - this.x;
    const dy = drone.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + 20; // drone radius ~20
  }
}

// -------------------- HUD --------------------

function updateHUD() {
  document.getElementById("battery").textContent = `${drone.battery.toFixed(0)}%`;

  document.getElementById("distance").textContent = `${drone.distance.toFixed(0)}m`;

  document.getElementById("score").textContent = drone.score;

  document.getElementById("highScore").textContent = localStorage.getItem("highScore") || 0;

  const usedBattery = 100 - drone.battery;
  const efficiency = usedBattery > 0 ? (drone.distance / usedBattery).toFixed(2) : 0;

  document.getElementById("efficiency").textContent = efficiency;

  document.getElementById("rainStatus").textContent = raining ? "Rain: Visibility Reduced" : "";

  document.getElementById("windStatus").textContent = windForce !== 0 ? "Wind Drift Active" : "";

  document.getElementById("loadStatus").textContent = loadShedding ? "Load-Shedding: Charging Disabled" : "";

  document.getElementById("cargo").textContent = drone.resources.length > 0 ? drone.resources.join(", ") : "None";
}

// -------------------- OBJECTS --------------------

const drone = new Drone();

const chargingZone = new ChargingZone(750, 400, 60);

const trafficCars = [
  new TrafficCar(0, 200, 60, 30, 3),
  new TrafficCar(800, 350, 70, 35, -4)
];

const birds = [
  new Bird(0, 150, 40, 20, 2),    // bird flying right
  new Bird(800, 250, 50, 25, -3)  // bird flying left
];

const houses = [
  new House(50, 100, 100, 70, "lightblue"),
  new House(200, 100, 100, 70, "yellow"),
  new House(350, 100, 100, 70, "pink"),
  new House(500, 100, 100, 70, "lightgreen"),
  new House(650, 100, 100, 70, "orange"),

  new House(50, 650, 100, 70, "blue"),
  new House(200, 650, 100, 70, "purple"),
  new House(350, 650, 100, 70, "brown"),
  new House(500, 650, 100, 70, "green"),
  new House(650, 650, 100, 70, "grey")
];

houses.forEach(house => {
  house.assignResources();
});

const resourcePoint = new ResourcePoint(400, 250, 40);

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

function drawRoads() {
  ctx.fillStyle = "#444";

  // Top neighbourhood road
  ctx.fillRect(0, 250, canvas.width, 70);

  // Bottom neighbourhood road
  ctx.fillRect(0, 530, canvas.width, 70);

  ctx.fillStyle = "yellow";
  for (let x = 0; x < canvas.width; x += 60) {
    ctx.fillRect(x, 285, 30, 5);
    ctx.fillRect(x, 565, 30, 5);
  }
}

function drawTree(x, y) {
  ctx.fillStyle = "brown";
  ctx.fillRect(x, y, 10, 30);

  ctx.fillStyle = "green";
  ctx.beginPath();
  ctx.arc(x + 5, y - 10, 20, 0, Math.PI * 2);
  ctx.fill();
}

// -------------------- GAME LOOP --------------------

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawRoads();
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
    updateHUD();

    // Houses (background environment)
    houses.forEach(house => {
      house.draw();

      if (
        resourcePoint.collected &&
        !house.delivered &&
        house.contains(drone)
      ) {
        const canDeliver = house.requiredResources.every(
          resource => drone.resources.includes(resource)
        );

        if (canDeliver) {
          house.delivered = true;
          drone.score += 100;
          drone.resources = [];
          resourcePoint.collected = false;

          setTimeout(() => {
            house.requiredResources = [];
            house.delivered = false;
            house.assignResources();
          }, 10000);
        }
      }
    });

    // Draw tress
    drawTree(175, 170);
    drawTree(325, 170);
    drawTree(475, 170);
    drawTree(625, 170);

    drawTree(175, 720);
    drawTree(325, 720);
    drawTree(475, 720);
    drawTree(625, 720);

    // Resource Point
    resourcePoint.draw();
    if (resourcePoint.contains(drone) && !resourcePoint.collected) {

      drone.resources = ["Medical", "Food", "Education", "Emergency"];
      resourcePoint.collected = true;
      drone.score += 50; // bonus for collecting resources
    }

    // Traffic cars
    trafficCars.forEach(car => {
      car.update();
      car.draw();
      if (car.collides(drone) && drone.invulnerable === 0) {
        drone.invulnerable = 60;
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
      if (bird.collides(drone) && drone.invulnerable === 0) {
        drone.invulnerable = 60;
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
  drone.resources = [];
  resourcePoint.collected = false;

  houses.forEach(house => {
    house.requiredResources = [];
    house.delivered = false;
    house.assignResources();
  });
}

// -------------------- CONTROLS --------------------

document.addEventListener("keydown", e => {
  if (gameState === "start" && e.key === "Enter") {
    gameState = "playing";
  } else if (gameState === "playing") {
    if (e.key === "ArrowUp") keys.up = true;
    if (e.key === "ArrowDown") keys.down = true;
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
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

document.addEventListener("keyup", e => {
  if (e.key === "ArrowUp") keys.up = false;
  if (e.key === "ArrowDown") keys.down = false;
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});
