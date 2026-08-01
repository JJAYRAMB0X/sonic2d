// Sonic the Hedgehog Game - Main JavaScript File
// Put this in sonic-game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Asset loading system
const images = {};
let assetsLoaded = 0;
const totalAssets = 7;

// Your asset file paths - CHANGE THESE TO MATCH YOUR FILES
const assetPaths = {
    background: 'assets/background.png',        // Your blue sky image (Image 1)
    terrain1: 'assets/terrain1.png',           // Your terrain images (Images 2-4)
    terrain2: 'assets/terrain2.png',
    terrain3: 'assets/terrain3.png', 
    sonicIdle: 'assets/sonic_idle.png',        // Your Sonic idle pose (Image 5)
    sonicRun: 'assets/sonic_run.png',          // Your Sonic running pose (Image 6)
    ring: 'assets/ring.png'                    // Your ring image (Image 7)
};

// Load all assets
function loadAssets() {
    console.log('Loading assets...');
    
    Object.keys(assetPaths).forEach(key => {
        const img = new Image();
        
        img.onload = () => {
            images[key] = img;
            assetsLoaded++;
            console.log(`Loaded ${key} (${assetsLoaded}/${totalAssets})`);
            
            if (assetsLoaded >= totalAssets) {
                document.getElementById('loadingStatus').style.display = 'none';
                console.log('All assets loaded! Starting game...');
                initializeGame();
                gameLoop();
            }
        };
        
        img.onerror = () => {
            console.error(`Failed to load ${key} from ${assetPaths[key]}`);
            console.log('Make sure your image files are in the correct paths!');
        };
        
        img.src = assetPaths[key];
    });
}

// Game state
let gameState = {
    rings: 0,
    time: 0,
    gameStartTime: Date.now()
};

// Camera system for side-scrolling
let camera = {
    x: 0,
    y: 0
};

// Input handling
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    e.preventDefault(); // Prevent default browser behavior
});
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    e.preventDefault();
});

// Sonic player object
let sonic = {
    x: 100,
    y: 400,                    // Start position
    width: 32,                 // Based on your sprite size
    height: 32,
    velocityX: 0,
    velocityY: 0,
    speed: 6,                  // Movement speed
    jumpPower: 16,             // Jump strength
    onGround: false,
    direction: 1,              // 1 = right, -1 = left
    animationFrame: 0,         // 0 = idle, 1 = running
    animationCounter: 0
};

// Physics constants
const GRAVITY = 0.8;
const FRICTION = 0.85;
const TERMINAL_VELOCITY = 20;

// Game objects
let rings = [];
let platforms = [];

// Initialize game world
function initializeGame() {
    console.log('Initializing game...');
    
    // Create rings scattered around the level
    rings = [
        {x: 250, y: 350, collected: false, animationFrame: 0},
        {x: 400, y: 280, collected: false, animationFrame: 0},
        {x: 600, y: 380, collected: false, animationFrame: 0},
        {x: 800, y: 200, collected: false, animationFrame: 0},
        {x: 1000, y: 350, collected: false, animationFrame: 0},
        {x: 1200, y: 250, collected: false, animationFrame: 0},
        {x: 1400, y: 380, collected: false, animationFrame: 0}
    ];
    
    // Create platform collision boxes
    // These should match your terrain images
    platforms = [
        // Main ground level
        {x: 0, y: 450, width: 2000, height: 200},
        
        // Elevated platforms (adjust based on your terrain images)
        {x: 350, y: 350, width: 200, height: 30},
        {x: 700, y: 280, width: 180, height: 30},
        {x: 1100, y: 320, width: 200, height: 30},
        {x: 1350, y: 250, width: 150, height: 30}
    ];
    
    console.log('Game initialized!');
}

// Main game update loop
function update() {
    // Handle player input
    if (keys['ArrowLeft'] || keys['KeyA']) {
        sonic.velocityX = -sonic.speed;
        sonic.direction = -1;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        sonic.velocityX = sonic.speed;
        sonic.direction = 1;
    } else {
        sonic.velocityX *= FRICTION;
    }
    
    // Jumping
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && sonic.onGround) {
        sonic.velocityY = -sonic.jumpPower;
        sonic.onGround = false;
    }
    
    // Apply gravity
    sonic.velocityY += GRAVITY;
    if (sonic.velocityY > TERMINAL_VELOCITY) {
        sonic.velocityY = TERMINAL_VELOCITY;
    }
    
    // Update Sonic's position
    sonic.x += sonic.velocityX;
    sonic.y += sonic.velocityY;
    
    // Platform collision detection
    sonic.onGround = false;
    
    for (let platform of platforms) {
        // Check if Sonic is overlapping with platform
        if (sonic.x + sonic.width > platform.x &&
            sonic.x < platform.x + platform.width &&
            sonic.y + sonic.height > platform.y &&
            sonic.y < platform.y + platform.height) {
            
            // Landing on top of platform
            if (sonic.velocityY > 0 && 
                sonic.y + sonic.height - sonic.velocityY <= platform.y + 5) {
                sonic.y = platform.y - sonic.height;
                sonic.velocityY = 0;
                sonic.onGround = true;
            }
            // Hit platform from below
            else if (sonic.velocityY < 0 && 
                     sonic.y - sonic.velocityY >= platform.y + platform.height - 5) {
                sonic.y = platform.y + platform.height;
                sonic.velocityY = 0;
            }
            // Hit platform from side
            else if (sonic.velocityX > 0) {
                sonic.x = platform.x - sonic.width;
                sonic.velocityX = 0;
            }
            else if (sonic.velocityX < 0) {
                sonic.x = platform.x + platform.width;
                sonic.velocityX = 0;
            }
        }
    }
    
    // Keep Sonic in bounds
    if (sonic.x < 0) {
        sonic.x = 0;
        sonic.velocityX = 0;
    }
    
    // Reset if Sonic falls off screen
    if (sonic.y > canvas.height + 100) {
        sonic.x = 100;
        sonic.y = 400;
        sonic.velocityX = 0;
        sonic.velocityY = 0;
    }
    
    // Camera follows Sonic
    camera.x = sonic.x - canvas.width / 2;
    if (camera.x < 0) camera.x = 0;
    
    // Ring collection
    for (let ring of rings) {
        if (!ring.collected) {
            // Check collision with Sonic
            if (sonic.x < ring.x + 24 &&
                sonic.x + sonic.width > ring.x &&
                sonic.y < ring.y + 24 &&
                sonic.y + sonic.height > ring.y) {
                
                ring.collected = true;
                gameState.rings++;
                console.log(`Ring collected! Total: ${gameState.rings}`);
            }
            
            // Animate ring rotation
            ring.animationFrame += 0.15;
        }
    }
    
    // Sonic animation
    if (Math.abs(sonic.velocityX) > 0.5) {
        sonic.animationCounter++;
        if (sonic.animationCounter > 8) {
            sonic.animationFrame = 1 - sonic.animationFrame; // Toggle between 0 and 1
            sonic.animationCounter = 0;
        }
    } else {
        sonic.animationFrame = 0; // Idle pose
    }
    
    // Update game timer
    gameState.time = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
}

// Main render function
function render() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context for camera transformation
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    // Draw background with parallax scrolling
    if (images.background) {
        ctx.save();
        ctx.translate(camera.x * 0.2, camera.y * 0.2); // Slower movement for depth
        
        // Draw multiple background images to create seamless scrolling
        const bgWidth = 320; // Your background image width
        const startX = Math.floor(camera.x * 0.2 / bgWidth) * bgWidth;
        
        for (let i = -1; i < 4; i++) {
            ctx.drawImage(images.background, startX + i * bgWidth, 0);
        }
        ctx.restore();
    }
    
    // Draw terrain layers
    const terrainImages = [images.terrain1, images.terrain2, images.terrain3];
    const terrainWidth = 320; // Your terrain image width
    
    for (let layer = 0; layer < terrainImages.length; layer++) {
        if (terrainImages[layer]) {
            const startX = Math.floor(camera.x / terrainWidth) * terrainWidth;
            
            for (let i = -1; i < 4; i++) {
                ctx.drawImage(
                    terrainImages[layer], 
                    startX + i * terrainWidth, 
                    200 + layer * 50 // Adjust Y position for each terrain layer
                );
            }
        }
    }
    
    // Draw rings
    if (images.ring) {
        for (let ring of rings) {
            if (!ring.collected) {
                ctx.save();
                ctx.translate(ring.x + 12, ring.y + 12); // Center of ring
                ctx.rotate(ring.animationFrame); // Rotate for animation
                ctx.drawImage(images.ring, -12, -12, 24, 24);
                ctx.restore();
            }
        }
    }
    
    // Draw Sonic
    const sonicSprite = sonic.animationFrame === 0 ? images.sonicIdle : images.sonicRun;
    if (sonicSprite) {
        ctx.save();
        ctx.translate(sonic.x + sonic.width/2, sonic.y + sonic.height/2);
        
        // Flip sprite if moving left
        if (sonic.direction === -1) {
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(sonicSprite, -sonic.width/2, -sonic.height/2, sonic.width, sonic.height);
        ctx.restore();
    }
    
    // Draw collision boxes for debugging (remove this in final version)
    /*
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    for (let platform of platforms) {
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    }
    */
    
    // Restore context
    ctx.restore();
}

// Update UI elements
function updateUI() {
    document.getElementById('ringCount').textContent = gameState.rings;
    
    const minutes = Math.floor(gameState.time / 60);
    const seconds = gameState.time % 60;
    document.getElementById('gameTime').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Main game loop
function gameLoop() {
    update();
    render();
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Start the game when page loads
window.addEventListener('load', () => {
    console.log('Page loaded, starting asset loading...');
    loadAssets();
});

// Handle window focus/blur for pausing
window.addEventListener('blur', () => {
    // Game continues running, but you could pause here if needed
});

window.addEventListener('focus', () => {
    // Resume game if paused
});