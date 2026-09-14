const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 600;

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
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.distance += Math.abs(this.speed);

    if (this.speed !== 0) {
      this.battery -= 0.05;
      this.score += 1; // score increases as you move
    }
    if (this.battery < 0) this.battery = 0;
  }

  draw() {
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    ctx.fillStyle = "black";
    ctx.fillText(`Battery: ${this.battery.toFixed(1)}%`, 10, 20);
    ctx.fillText(`Distance: ${this.distance.toFixed(0)}m`, 10, 40);
    ctx.fillText(`Score: ${this.score}`, 10, 60);
    ctx.fillText(`High Score: ${localStorage.getItem("highScore") || 0}`, 10, 80);
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
    return distance < this.radius + 20; // 20 = drone radius
  }
}

const drone = new Drone();
const obstacles = [new Obstacle(400, 300, 30), new Obstacle(600, 200, 40)];

let gameOver = false;

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameOver) {
    drone.update();
    drone.draw();

    obstacles.forEach(obs => {
      obs.draw();
      if (obs.collides(drone)) {
        ctx.fillStyle = "red";
        ctx.fillText("Collision! Game Over", 350, 50);
        endGame();
      }
    });
  }

  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameOver = true;
  // Save high score
  const highScore = parseInt(localStorage.getItem("highScore") || "0", 10);
  if (drone.score > highScore) {
    localStorage.setItem("highScore", drone.score);
  }
}

function restartGame() {
  drone.x = 100;
  drone.y = 100;
  drone.angle = 0;
  drone.speed = 0;
  drone.battery = 100;
  drone.distance = 0;
  drone.score = 0;
  gameOver = false;
}

gameLoop();

// Controls
document.addEventListener("keydown", e => {
  if (gameOver && e.key === "Enter") {
    restartGame();
  }
  if (e.key === "ArrowUp") drone.speed = 2;
  if (e.key === "ArrowDown") drone.speed = -2;
  if (e.key === "ArrowLeft") drone.angle -= 0.1;
  if (e.key === "ArrowRight") drone.angle += 0.1;
});
document.addEventListener("keyup", () => drone.speed = 0);