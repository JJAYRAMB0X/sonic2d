function playLevelCompleteSound() {
    // Classic victory fanfare
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((note, i) => {
        setTimeout(() => playSound(note, 0.3, 'square', 0.15), i * 100);
    });
}// Enhanced sound effect system
let chargingSoundOscillator = null;

function playSound(frequency, duration, type = 'sine', volume = 0.1) {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.log('Sound effect failed:', e);
    }
}

function playJumpSound() {
    // Classic Sonic jump sound - two-tone beep
    playSound(523, 0.1, 'square', 0.15); // C5
    setTimeout(() => playSound(659, 0.1, 'square', 0.1), 50); // E5
}

function playRingSound() {
    // Classic ring collection sound - bright chime
    playSound(988, 0.05, 'sine', 0.2); // B5
    setTimeout(() => playSound(1319, 0.05, 'sine', 0.15), 25); // E6
    setTimeout(() => playSound(1976, 0.1, 'sine', 0.1), 50); // B6
}

function playSpinDashLaunchSound() {
    // Revving engine-like sound
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            playSound(100 + i * 20, 0.05, 'sawtooth', 0.1);
        }, i * 20);
    }
}

function startChargingSound() {
    try {
        if (chargingSoundOscillator) return; // Already playing
        
        chargingSoundOscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        chargingSoundOscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        chargingSoundOscillator.frequency.value = 1500; // EXTREMELY HIGH PITCHED - starts very high
        chargingSoundOscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        
        chargingSoundOscillator.start(audioContext.currentTime);
        
        // Ramp up to even higher frequency as charging continues
        chargingSoundOscillator.frequency.exponentialRampToValueAtTime(2500, audioContext.currentTime + 3);
        
    } catch (e) {
        console.log('Charging sound failed:', e);
    }
}

function stopChargingSound() {
    if (chargingSoundOscillator) {
        try {
            chargingSoundOscillator.stop();
            chargingSoundOscillator = null;
        } catch (e) {
            console.log('Stop charging sound failed:', e);
        }
    }
}

function playDoubleJumpSound() {
    // Higher pitched double jump sound - more powerful
    playSound(659, 0.08, 'square', 0.18); // E5
    setTimeout(() => playSound(880, 0.08, 'square', 0.15), 30); // A5
    setTimeout(() => playSound(1109, 0.12, 'square', 0.12), 60); // C#6 - triumphant!
}// Sonic the Hedgehog Game - Main JavaScript File
// Put this in sonic-game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Asset loading system
const images = {};
let assetsLoaded = 0;
const totalAssets = 10;

// Game states
let currentGameState = 'loading'; // 'loading', 'intro', 'playing', 'completed'
let introStartTime = 0;

// Audio system
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};

// Game data
let gameData = {
    rings: 0,
    time: 0,
    gameStartTime: Date.now()
};

// Your asset file paths - UPDATED WITH NEW ASSETS
const assetPaths = {
    background: 'assets/background.png',        // Your blue sky image (Image 1)
    terrain1: 'assets/terrain1.png',           // Your terrain images (Images 2-4)
    terrain2: 'assets/terrain2.png',
    terrain3: 'assets/terrain3.png', 
    sonicIdle: 'assets/sonic_idle.png',        // Your Sonic idle pose (Image 5)
    sonicRun: 'assets/sonic_run.png',          // Your Sonic running pose (Image 6)
    sonicSpin: 'assets/Sonic-Spin.png',        // Your Sonic spin animation
    ring: 'assets/ring.png',                   // Your ring image (Image 7)
    loadingScreen: 'assets/LoadingScreen.png', // Loading screen
    levelEndSign: 'assets/Level-End-Sign1.png', // Level end sign
    segaAudio: 'assets/sega.mp3'              // Sega audio
};

// Load all assets with immediate Sega audio
function loadAssets() {
    console.log('Loading assets...');
    
    Object.keys(assetPaths).forEach(key => {
        if (key === 'segaAudio') {
            // Load audio file with immediate play attempt
            const audio = new Audio();
            audio.preload = 'auto';
            audio.volume = 0.8;
            
            audio.onloadeddata = () => {
                sounds[key] = audio;
                assetsLoaded++;
                console.log(`✓ Loaded ${key} (${assetsLoaded}/${totalAssets})`);
                
                // PLAY SEGA AUDIO IMMEDIATELY ON LOAD - BEFORE INTRO SCREEN
                console.log('🔊 Attempting to play Sega audio during loading...');
                audio.currentTime = 0;
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('🔊 Sega audio playing during loading screen!');
                        })
                        .catch(error => {
                            console.log('🔊 Sega autoplay blocked - storing for user interaction');
                            window.immediateAudio = audio;
                        });
                } else {
                    // Fallback for older browsers
                    window.immediateAudio = audio;
                }
                
                checkAllAssetsLoaded();
            };
            audio.onerror = (e) => {
                console.error(`✗ Failed to load audio ${key}:`, e);
                assetsLoaded++; // Continue even if audio fails
                checkAllAssetsLoaded();
            };
            audio.src = assetPaths[key];
            
            // Try to load and play immediately
            audio.load();
        } else {
            // Load image file
            const img = new Image();
            
            img.onload = () => {
                images[key] = img;
                assetsLoaded++;
                console.log(`✓ Loaded ${key} (${assetsLoaded}/${totalAssets})`);
                checkAllAssetsLoaded();
            };
            
            img.onerror = (e) => {
                console.error(`✗ Failed to load ${key} from ${assetPaths[key]}`);
                console.error('Error details:', e);
                assetsLoaded++; // Continue even if image fails
                checkAllAssetsLoaded();
            };
            
            img.src = assetPaths[key];
        }
    });
    
    // Fallback - start game after 5 seconds even if assets don't load
    setTimeout(() => {
        if (currentGameState === 'loading') {
            console.log('⚠️ Asset loading timeout - starting with fallbacks');
            startIntro();
        }
    }, 5000);
}

function checkAllAssetsLoaded() {
    if (assetsLoaded >= totalAssets) {
        console.log('🎉 All assets loaded! Starting intro...');
        startIntro();
    }
}

function startIntro() {
    currentGameState = 'intro';
    introStartTime = Date.now();
    
    // Hide the loading status message completely - no debug text on screen!
    document.getElementById('loadingStatus').style.display = 'none';
    
    // Do NOT play Sega sound here - it should have played already during loading
    console.log('✅ Intro screen ready - Sega audio should have played during loading');
}

// Camera system for side-scrolling
let camera = {
    x: 0,
    y: 0
};

// Input handling - FIXED DOUBLE JUMP DETECTION
const keys = {};
const keysPressed = {}; // Track key press events (not held keys)

document.addEventListener('keydown', (e) => {
    // Only register as new press if key wasn't already held
    const wasPressed = keys[e.code];
    keys[e.code] = true;
    
    if (!wasPressed) {
        keysPressed[e.code] = true; // Mark as newly pressed
    }
    
    // IMMEDIATELY try to play Sega audio on ANY user interaction
    if (window.immediateAudio) {
        window.immediateAudio.currentTime = 0;
        window.immediateAudio.play()
            .then(() => {
                console.log('🔊 Sega audio triggered by user interaction!');
                window.immediateAudio = null; // Clear it
            })
            .catch(err => console.log('Audio still blocked:', err));
    }
    
    // Start game from intro screen
    if (currentGameState === 'intro' && e.code === 'Enter') {
        console.log('🎮 Starting game...');
        currentGameState = 'playing';
        document.getElementById('loadingStatus').style.display = 'none';
        initializeGame();
    }
    
    // Debug: Press 'D' to see debug info
    if (e.code === 'KeyD' && e.ctrlKey) {
        console.log('=== DEBUG INFO ===');
        console.log('Game State:', currentGameState);
        console.log('Assets Loaded:', assetsLoaded, '/', totalAssets);
        console.log('Images:', Object.keys(images));
        console.log('Sounds:', Object.keys(sounds));
        console.log('Sonic Position:', sonic.x, sonic.y);
        console.log('Camera Position:', camera.x, camera.y);
        console.log('Ring Count:', gameData.rings);
    }
    
    e.preventDefault();
});

// Also try on mouse click - EARLIER IN LOADING
document.addEventListener('click', () => {
    if (window.immediateAudio) {
        window.immediateAudio.currentTime = 0;
        window.immediateAudio.play()
            .then(() => {
                console.log('🔊 Sega audio triggered by mouse click!');
                window.immediateAudio = null;
            })
            .catch(err => console.log('Click audio failed:', err));
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    keysPressed[e.code] = false; // Clear the press flag
    e.preventDefault();
});

// Sonic player object with double jump - FIXED SIZES
let sonic = {
    x: 100,
    y: 350,                    
    width: 64,                 // DOUBLED from 32 to 64
    height: 64,                // DOUBLED from 32 to 64
    velocityX: 0,
    velocityY: 0,
    speed: 6,                  
    jumpPower: 16,             
    doubleJumpPower: 24,       
    onGround: false,
    direction: 1,              
    animationFrame: 0,         
    animationCounter: 0,
    // Spin dash mechanics
    isSpinDashing: false,
    spinDashCharge: 0,
    spinDashMaxCharge: 100,
    isRolling: false,
    spinAnimationFrame: 0,
    // Double jump mechanics - FIXED
    canDoubleJump: false,
    lastJumpTime: 0,
    doubleJumpWindow: 300,
    jumpKeyPressed: false      // Track if jump key is currently held
};

// Physics constants
const GRAVITY = 0.8;
const FRICTION = 0.85;
const TERMINAL_VELOCITY = 20;

// Game objects
let rings = [];
let platforms = [];
let levelEndSign = null;

// Level constants
const LEVEL_WIDTH = 4800; // 45 seconds at average speed
const LEVEL_END_X = LEVEL_WIDTH - 200;

// Initialize game world
function initializeGame() {
    console.log('Initializing game...');
    
    // Create MANY more rings scattered throughout the extended level
    rings = [];
    for (let i = 0; i < 60; i++) { // 60 rings total!
        rings.push({
            x: 200 + i * 80 + Math.random() * 40, // Spread out with some randomness
            y: 280 + Math.sin(i * 0.5) * 60,      // Varying heights
            collected: false,
            animationFrame: 0
        });
    }
    
    // Add some bonus ring clusters
    const bonusClusters = [
        {x: 800, y: 250}, {x: 1200, y: 300}, {x: 1800, y: 280}, 
        {x: 2400, y: 320}, {x: 3000, y: 250}, {x: 3600, y: 290},
        {x: 4200, y: 300}
    ];
    
    bonusClusters.forEach(cluster => {
        for (let i = 0; i < 5; i++) {
            rings.push({
                x: cluster.x + i * 30,
                y: cluster.y + Math.sin(i) * 20,
                collected: false,
                animationFrame: Math.random() * Math.PI
            });
        }
    });
    
    // Enhanced platforms with terrain-specific collision for sloped terrain
    platforms = [
        // Main ground level - extends across entire level
        {x: -500, y: 480, width: LEVEL_WIDTH + 1000, height: 120},
        
        // TERRAIN2 AREAS - Require jumping (higher platforms)
        {x: 320, y: 400, width: 320, height: 40},   // terrain2 area 1 - must jump
        {x: 960, y: 390, width: 320, height: 50},   // terrain2 area 2 - must jump  
        {x: 1600, y: 410, width: 320, height: 30},  // terrain2 area 3 - must jump
        {x: 2240, y: 385, width: 320, height: 45},  // terrain2 area 4 - must jump
        {x: 2880, y: 405, width: 320, height: 35},  // terrain2 area 5 - must jump
        {x: 3520, y: 395, width: 320, height: 40},  // terrain2 area 6 - must jump
        {x: 4160, y: 400, width: 320, height: 35},  // terrain2 area 7 - must jump
        
        // TERRAIN3 AREAS - Also require jumping (different heights)
        {x: 640, y: 420, width: 320, height: 25},   // terrain3 area 1
        {x: 1280, y: 415, width: 320, height: 30},  // terrain3 area 2
        {x: 1920, y: 425, width: 320, height: 20},  // terrain3 area 3
        {x: 2560, y: 410, width: 320, height: 35},  // terrain3 area 4
        {x: 3200, y: 420, width: 320, height: 25},  // terrain3 area 5
        {x: 3840, y: 415, width: 320, height: 30},  // terrain3 area 6
        
        // Regular scattered platforms for variety
        {x: 1100, y: 350, width: 150, height: 20},
        {x: 1800, y: 320, width: 180, height: 20},
        {x: 2600, y: 340, width: 200, height: 20},
        {x: 3400, y: 330, width: 170, height: 20},
        {x: 4200, y: 360, width: 150, height: 20}
    ];
    
    // Create level end sign
    levelEndSign = {
        x: LEVEL_END_X,
        y: 400,
        width: 64,
        height: 96,
        crossed: false
    };
    
    // Reset Sonic position with correct size
    sonic.x = 100;
    sonic.y = 350;
    sonic.velocityX = 0;
    sonic.velocityY = 0;
    sonic.isSpinDashing = false;
    sonic.isRolling = false;
    sonic.spinDashCharge = 0;
    sonic.canDoubleJump = false;
    sonic.lastJumpTime = 0;
    
    // Reset game state
    gameData.rings = 0;
    gameData.time = 0;
    gameData.gameStartTime = Date.now();
    
    console.log('Game initialized with', rings.length, 'rings!');
}

// Main game update loop
function update() {
    // Spin Dash mechanics with charging sound
    if (keys['ArrowDown'] && sonic.onGround && !sonic.isRolling) {
        if (!sonic.isSpinDashing) {
            sonic.isSpinDashing = true;
            startChargingSound(); // Start charging sound
        }
        sonic.velocityX = 0; // Stop horizontal movement while charging
        
        // Charge up spin dash
        if (sonic.spinDashCharge < sonic.spinDashMaxCharge) {
            sonic.spinDashCharge += 2;
        }
        
        // Spin animation while charging
        sonic.spinAnimationFrame += 0.5;
        sonic.animationFrame = 2; // Spinning state
    } 
    // Release spin dash
    else if (sonic.isSpinDashing && !keys['ArrowDown']) {
        stopChargingSound(); // Stop charging sound
        
        // Launch based on charge
        const launchSpeed = (sonic.spinDashCharge / sonic.spinDashMaxCharge) * 15 + 8;
        sonic.velocityX = launchSpeed * sonic.direction;
        sonic.isSpinDashing = false;
        sonic.isRolling = true;
        sonic.spinDashCharge = 0;
        playSpinDashLaunchSound(); // Enhanced launch sound
    }
    // Regular movement (only if not spin dashing)
    else if (!sonic.isSpinDashing) {
        // Stop rolling if moving slowly
        if (sonic.isRolling && Math.abs(sonic.velocityX) < 3) {
            sonic.isRolling = false;
        }
        
        if (keys['ArrowLeft'] || keys['KeyA']) {
            if (!sonic.isRolling) {
                sonic.velocityX = -sonic.speed;
                sonic.direction = -1;
            }
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            if (!sonic.isRolling) {
                sonic.velocityX = sonic.speed;
                sonic.direction = 1;
            }
        } else if (!sonic.isRolling) {
            sonic.velocityX *= FRICTION;
        }
        
        // Rolling friction (less friction when rolling)
        if (sonic.isRolling) {
            sonic.velocityX *= 0.98;
        }
    }
    
    // FIXED Jumping with proper double jump detection
    const jumpKeys = ['Space', 'ArrowUp', 'KeyW'];
    const jumpPressed = jumpKeys.some(key => keysPressed[key]);
    
    if (jumpPressed && !sonic.isSpinDashing) {
        const currentTime = Date.now();
        
        // First jump (on ground)
        if (sonic.onGround) {
            sonic.velocityY = -sonic.jumpPower;
            sonic.onGround = false;
            sonic.canDoubleJump = true;
            sonic.lastJumpTime = currentTime;
            playJumpSound();
            console.log('🦘 Normal Jump');
            
            // If jumping while rolling, continue rolling in air
            if (sonic.isRolling) {
                sonic.animationFrame = 2;
            }
        }
        // Double jump (in air, within time window, and can double jump)
        else if (sonic.canDoubleJump && 
                 currentTime - sonic.lastJumpTime < sonic.doubleJumpWindow &&
                 currentTime - sonic.lastJumpTime > 100) { // Minimum 100ms between jumps
            
            sonic.velocityY = -sonic.doubleJumpPower; // Much higher jump!
            sonic.canDoubleJump = false; // Can only double jump once per ground contact
            playDoubleJumpSound(); // Different sound for double jump
            console.log('🚀 DOUBLE JUMP!');
        }
    }
    
    // Clear all key press flags after processing
    Object.keys(keysPressed).forEach(key => {
        keysPressed[key] = false;
    });
    
    // Apply gravity
    sonic.velocityY += GRAVITY;
    if (sonic.velocityY > TERMINAL_VELOCITY) {
        sonic.velocityY = TERMINAL_VELOCITY;
    }
    
    // Update Sonic's position
    sonic.x += sonic.velocityX;
    sonic.y += sonic.velocityY;
    
    // Platform collision detection - IMPROVED FOR BETTER GROUND DETECTION
    sonic.onGround = false;
    
    for (let platform of platforms) {
        // More precise collision detection
        if (sonic.x + sonic.width - 4 > platform.x &&
            sonic.x + 4 < platform.x + platform.width &&
            sonic.y + sonic.height > platform.y &&
            sonic.y < platform.y + platform.height) {
            
            // Landing on top of platform - more forgiving detection
            if (sonic.velocityY >= 0 && 
                sonic.y + sonic.height - sonic.velocityY <= platform.y + 8) {
                sonic.y = platform.y - sonic.height;
                sonic.velocityY = 0;
                sonic.onGround = true;
                // Reset double jump when touching ground
                sonic.canDoubleJump = false;
            }
            // Hit platform from below
            else if (sonic.velocityY < 0 && 
                     sonic.y - sonic.velocityY >= platform.y + platform.height - 8) {
                sonic.y = platform.y + platform.height;
                sonic.velocityY = 0;
            }
            // Hit platform from side - more precise side collision
            else if (sonic.velocityX > 0 && sonic.x + sonic.width - sonic.velocityX <= platform.x) {
                sonic.x = platform.x - sonic.width;
                sonic.velocityX = 0;
                sonic.isRolling = false;
            }
            else if (sonic.velocityX < 0 && sonic.x - sonic.velocityX >= platform.x + platform.width) {
                sonic.x = platform.x + platform.width;
                sonic.velocityX = 0;
                sonic.isRolling = false;
            }
        }
    }
    
    // Keep Sonic in bounds
    if (sonic.x < 0) {
        sonic.x = 0;
        sonic.velocityX = 0;
        sonic.isRolling = false;
    }
    
    // Reset if Sonic falls off screen
    if (sonic.y > canvas.height + 100) {
        sonic.x = 100;
        sonic.y = 350;  // Reset to proper ground level
        sonic.velocityX = 0;
        sonic.velocityY = 0;
        sonic.isSpinDashing = false;
        sonic.isRolling = false;
        sonic.spinDashCharge = 0;
    }
    
    // Camera follows Sonic
    camera.x = sonic.x - canvas.width / 2;
    if (camera.x < 0) camera.x = 0;
    
    // Ring collection with sound effect
    for (let ring of rings) {
        if (!ring.collected) {
            // Check collision with Sonic
            if (sonic.x < ring.x + 24 &&
                sonic.x + sonic.width > ring.x &&
                sonic.y < ring.y + 24 &&
                sonic.y + sonic.height > ring.y) {
                
                ring.collected = true;
                gameData.rings++;
                playRingSound(); // Enhanced ring collection sound
                console.log(`Ring collected! Total: ${gameData.rings}`);
            }
            
            // Animate ring rotation
            ring.animationFrame += 0.15;
        }
    }
    
    // Check level end sign collision
    if (levelEndSign && !levelEndSign.crossed &&
        sonic.x + sonic.width > levelEndSign.x &&
        sonic.x < levelEndSign.x + levelEndSign.width &&
        sonic.y + sonic.height > levelEndSign.y &&
        sonic.y < levelEndSign.y + levelEndSign.height) {
        
        levelEndSign.crossed = true;
        playLevelCompleteSound(); // Enhanced level complete sound
        
        // Restart level after brief delay
        setTimeout(() => {
            initializeGame();
        }, 1500);
    }
    
    // Sonic animation
    if (sonic.isSpinDashing || sonic.isRolling) {
        sonic.animationFrame = 2; // Spinning
        sonic.spinAnimationFrame += 0.3;
    } else if (Math.abs(sonic.velocityX) > 0.5) {
        sonic.animationCounter++;
        if (sonic.animationCounter > 8) {
            sonic.animationFrame = 1 - sonic.animationFrame; // Toggle between 0 and 1
            sonic.animationCounter = 0;
        }
    } else {
        sonic.animationFrame = 0; // Idle pose
    }
    
    // Update game timer
    gameData.time = Math.floor((Date.now() - gameData.gameStartTime) / 1000);
}

// Main render function
function render() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Handle different game states
    if (currentGameState === 'intro') {
        renderIntro();
        return;
    } else if (currentGameState === 'loading') {
        return; // Loading handled by HTML
    }
    
    // Game rendering continues here for 'playing' state
    renderGame();
}

function renderIntro() {
    // Draw loading screen if available, otherwise draw simple intro
    if (images.loadingScreen) {
        // Scale and center the loading screen
        const scale = Math.min(canvas.width / images.loadingScreen.width, canvas.height / images.loadingScreen.height);
        const scaledWidth = images.loadingScreen.width * scale;
        const scaledHeight = images.loadingScreen.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(images.loadingScreen, x, y, scaledWidth, scaledHeight);
    } else {
        // Fallback intro screen
        ctx.fillStyle = '#0066FF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SONIC', canvas.width / 2, canvas.height / 2 - 50);
        ctx.fillText('THE HEDGEHOG', canvas.width / 2, canvas.height / 2);
    }
    
    // Add "Press ENTER to start" text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    
    // Add a blinking effect
    const elapsed = Date.now() - introStartTime;
    if (Math.floor(elapsed / 500) % 2 === 0) {
        ctx.fillStyle = 'yellow';
    }
    ctx.fillText('Press ENTER to Start', canvas.width / 2, canvas.height - 50);
}

function renderGame() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context for camera transformation
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    // Draw background with parallax scrolling - EXTENDED FOR FULL LEVEL
    if (images.background) {
        ctx.save();
        ctx.translate(camera.x * 0.2, camera.y * 0.2);
        
        const bgWidth = 320;
        const parallaxX = camera.x * 0.2;
        const startTile = Math.floor(parallaxX / bgWidth);
        const offsetX = -(parallaxX % bgWidth);
        
        // Draw enough background tiles to cover the entire level
        const tilesNeeded = Math.ceil(LEVEL_WIDTH / bgWidth) + 2;
        for (let i = 0; i < tilesNeeded; i++) {
            ctx.drawImage(images.background, offsetX + i * bgWidth, 0, bgWidth, 240);
        }
        ctx.restore();
    }
    
    // Draw terrain with MORE VISIBLE terrain2 and terrain3 variations
    const terrainWidth = 320;
    const offsetX = -(camera.x % terrainWidth);
    const terrainTilesNeeded = Math.ceil(LEVEL_WIDTH / terrainWidth) + 2;
    
    // PRIMARY: Draw terrain1 as the base ground layer (always visible)
    if (images.terrain1) {
        for (let i = 0; i < terrainTilesNeeded; i++) {
            ctx.drawImage(images.terrain1, offsetX + i * terrainWidth, 320, terrainWidth, 240);
        }
    }
    
    // SECONDARY: Make terrain2 much more visible and frequent
    if (images.terrain2) {
        for (let i = 0; i < terrainTilesNeeded; i++) {
            const globalTileIndex = Math.floor(camera.x / terrainWidth) + i;
            
            // Show terrain2 more frequently - every 3 tiles
            if (globalTileIndex % 3 === 1) {
                ctx.save();
                ctx.globalAlpha = 0.9; // Much more visible
                ctx.drawImage(images.terrain2, offsetX + i * terrainWidth, 300, terrainWidth, 240);
                ctx.restore();
            }
        }
    }
    
    // TERTIARY: Make terrain3 more visible too
    if (images.terrain3) {
        for (let i = 0; i < terrainTilesNeeded; i++) {
            const globalTileIndex = Math.floor(camera.x / terrainWidth) + i;
            
            // Show terrain3 every 4 tiles
            if (globalTileIndex % 4 === 2) {
                ctx.save();
                ctx.globalAlpha = 0.85; // Very visible
                ctx.drawImage(images.terrain3, offsetX + i * terrainWidth, 310, terrainWidth, 240);
                ctx.restore();
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
    
    // Draw Sonic with proper animation states
    let sonicSprite;
    
    if (sonic.animationFrame === 2) {
        // Spinning/rolling animation
        sonicSprite = images.sonicSpin;
    } else if (sonic.animationFrame === 0) {
        // Idle pose
        sonicSprite = images.sonicIdle;
    } else {
        // Running animation
        sonicSprite = images.sonicRun;
    }
    
    if (sonicSprite) {
        ctx.save();
        ctx.translate(sonic.x + sonic.width/2, sonic.y + sonic.height/2);
        
        // Flip sprite if moving left
        if (sonic.direction === -1) {
            ctx.scale(-1, 1);
        }
        
        // Additional rotation for spin animation
        if (sonic.animationFrame === 2) {
            ctx.rotate(sonic.spinAnimationFrame);
        }
        
        // DOUBLED SPRITE SIZE - draw at 64x64 instead of 32x32
        ctx.drawImage(sonicSprite, -sonic.width/2, -sonic.height/2, sonic.width, sonic.height);
        ctx.restore();
    }
    
    // Draw spin dash charge indicator
    if (sonic.isSpinDashing) {
        const chargePercent = sonic.spinDashCharge / sonic.spinDashMaxCharge;
        const barWidth = 60;
        const barHeight = 8;
        const barX = sonic.x - 14;
        const barY = sonic.y - 20;
        
        // Background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Charge bar
        ctx.fillStyle = chargePercent > 0.8 ? '#FF0000' : '#FFFF00';
        ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * chargePercent, barHeight - 4);
        
        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // Draw level end sign
    if (levelEndSign && images.levelEndSign && !levelEndSign.crossed) {
        ctx.drawImage(images.levelEndSign, levelEndSign.x, levelEndSign.y, levelEndSign.width, levelEndSign.height);
    }
    
    // Draw collision boxes for debugging (remove this in final version)
    /*
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    for (let platform of platforms) {
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    }
    if (levelEndSign) {
        ctx.strokeStyle = 'green';
        ctx.strokeRect(levelEndSign.x, levelEndSign.y, levelEndSign.width, levelEndSign.height);
    }
    */
    
    ctx.restore();
}

// Update UI elements
function updateUI() {
    document.getElementById('ringCount').textContent = gameData.rings;
    
    const minutes = Math.floor(gameData.time / 60);
    const seconds = gameData.time % 60;
    document.getElementById('gameTime').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Main game loop
function gameLoop() {
    if (currentGameState === 'playing') {
        update();
    }
    render();
    if (currentGameState === 'playing') {
        updateUI();
    }
    requestAnimationFrame(gameLoop);
}

// Start the game and trigger Sega audio IMMEDIATELY on page load
window.addEventListener('load', () => {
    console.log('🎮 Page loaded - Starting immediate audio attempt...');
    
    // IMMEDIATELY try to play Sega audio on page load (before asset loading)
    const immediateSegaAttempt = new Audio('assets/sega.mp3');
    immediateSegaAttempt.volume = 0.8;
    immediateSegaAttempt.preload = 'auto';
    
    // Try to play as soon as possible
    const tryPlayImmediate = () => {
        immediateSegaAttempt.currentTime = 0;
        const playPromise = immediateSegaAttempt.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('🔊 Sega audio playing IMMEDIATELY on page load!');
                })
                .catch(error => {
                    console.log('🔊 Immediate play blocked, will try on first interaction');
                    window.immediateAudio = immediateSegaAttempt;
                });
        }
    };
    
    // Try to play immediately
    tryPlayImmediate();
    
    // Also try after a tiny delay
    setTimeout(tryPlayImmediate, 100);
    
    // Start asset loading
    loadAssets();
    gameLoop(); // Start the game loop immediately for intro screen
});

// Handle window focus/blur for pausing
window.addEventListener('blur', () => {
    // Game continues running, but you could pause here if needed
});

window.addEventListener('focus', () => {
    // Resume game if paused
});