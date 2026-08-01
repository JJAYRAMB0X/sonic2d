// Sonic the Hedgehog Game - Complete JavaScript File
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Asset loading system
const images = {};
let assetsLoaded = 0;
const totalAssets = 16;

// Game states
let currentGameState = 'loading';
let introStartTime = 0;

// Audio system
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};

// Enhanced sound effect system
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
    playSound(523, 0.1, 'square', 0.15);
    setTimeout(() => playSound(659, 0.1, 'square', 0.1), 50);
}

function playRingSound() {
    playSound(988, 0.05, 'sine', 0.2);
    setTimeout(() => playSound(1319, 0.05, 'sine', 0.15), 25);
    setTimeout(() => playSound(1976, 0.1, 'sine', 0.1), 50);
}

function playSpinDashLaunchSound() {
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            playSound(100 + i * 20, 0.05, 'sawtooth', 0.1);
        }, i * 20);
    }
}

function startChargingSound() {
    try {
        if (chargingSoundOscillator) return;
        
        chargingSoundOscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        chargingSoundOscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        chargingSoundOscillator.frequency.value = 1500;
        chargingSoundOscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        
        chargingSoundOscillator.start(audioContext.currentTime);
        
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
    playSound(659, 0.08, 'square', 0.18);
    setTimeout(() => playSound(880, 0.08, 'square', 0.15), 30);
    setTimeout(() => playSound(1109, 0.12, 'square', 0.12), 60);
}

function playBadnikDestroySound() {
    playSound(800, 0.05, 'square', 0.2);
    setTimeout(() => playSound(400, 0.1, 'sawtooth', 0.15), 25);
    setTimeout(() => playSound(200, 0.15, 'sawtooth', 0.1), 50);
}

function playSonicHurtSound() {
    playSound(523, 0.08, 'square', 0.2);
    setTimeout(() => playSound(466, 0.08, 'square', 0.18), 50);
    setTimeout(() => playSound(392, 0.12, 'square', 0.15), 100);
}

function playRingScatterSound() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            playSound(988 + i * 100, 0.03, 'sine', 0.1);
        }, i * 30);
    }
}

function playLevelCompleteSound() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => {
        setTimeout(() => playSound(note, 0.3, 'square', 0.15), i * 100);
    });
}

// Game data
let gameData = {
    rings: 0,
    time: 0,
    gameStartTime: Date.now()
};

// Asset file paths
const assetPaths = {
    background: 'assets/background.png',
    terrain1: 'assets/terrain1.png',
    terrain2: 'assets/terrain2.png',
    terrain3: 'assets/terrain3.png', 
    sonicIdle: 'assets/sonic_idle.png',
    sonicRun: 'assets/sonic_run.png',
    sonicSpin: 'assets/Sonic-Spin.png',
    sonicColliding: 'assets/Sonic-Colliding.png',
    ring: 'assets/ring.png',
    loadingScreen: 'assets/LoadingScreen.png',
    levelEndSign: 'assets/Level-End-Sign1.png',
    badnik1_frame1: 'assets/badnik1_frame1.png',
    badnik1_frame2: 'assets/badnik1_frame2.png',
    badnik2_frame1: 'assets/badnik2_frame1.png',
    badnik2_frame2: 'assets/badnik2_frame2.png',
    segaAudio: 'assets/sega.mp3'
};

// Load all assets
function loadAssets() {
    console.log('Loading assets...');
    
    Object.keys(assetPaths).forEach(key => {
        if (key === 'segaAudio') {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.volume = 0.8;
            
            audio.onloadeddata = () => {
                sounds[key] = audio;
                assetsLoaded++;
                console.log(`✓ Loaded ${key} (${assetsLoaded}/${totalAssets})`);
                
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
                    window.immediateAudio = audio;
                }
                
                checkAllAssetsLoaded();
            };
            audio.onerror = (e) => {
                console.error(`✗ Failed to load audio ${key}:`, e);
                assetsLoaded++;
                checkAllAssetsLoaded();
            };
            audio.src = assetPaths[key];
            audio.load();
        } else {
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
                assetsLoaded++;
                checkAllAssetsLoaded();
            };
            
            img.src = assetPaths[key];
        }
    });
    
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
    document.getElementById('loadingStatus').style.display = 'none';
    console.log('✅ Intro screen ready - Sega audio should have played during loading');
}

// Camera system
let camera = {
    x: 0,
    y: 0
};

// Input handling
const keys = {};
const keysPressed = {};

document.addEventListener('keydown', (e) => {
    const wasPressed = keys[e.code];
    keys[e.code] = true;
    
    if (!wasPressed) {
        keysPressed[e.code] = true;
    }
    
    if (window.immediateAudio) {
        window.immediateAudio.currentTime = 0;
        window.immediateAudio.play()
            .then(() => {
                console.log('🔊 Sega audio triggered by user interaction!');
                window.immediateAudio = null;
            })
            .catch(err => console.log('Audio still blocked:', err));
    }
    
    if (currentGameState === 'intro' && e.code === 'Enter') {
        console.log('🎮 Starting game...');
        currentGameState = 'playing';
        document.getElementById('loadingStatus').style.display = 'none';
        initializeGame();
    }
    
    e.preventDefault();
});

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
    keysPressed[e.code] = false;
    e.preventDefault();
});

// Sonic player object
let sonic = {
    x: 100,
    y: 441,
    width: 64,                 
    height: 64,                
    velocityX: 0,
    velocityY: 0,
    speed: 3.5,                
    jumpPower: 16,             
    doubleJumpPower: 24,       
    onGround: false,
    direction: 1,              
    animationFrame: 0,         
    animationCounter: 0,
    isSpinDashing: false,
    spinDashCharge: 0,
    spinDashMaxCharge: 100,
    isRolling: false,
    spinAnimationFrame: 0,
    canDoubleJump: false,
    lastJumpTime: 0,
    doubleJumpWindow: 300,
    jumpKeyPressed: false,
    isHurt: false,
    hurtTimer: 0,
    invulnerabilityTime: 120
};

// Physics constants
const GRAVITY = 0.8;
const FRICTION = 0.85;
const TERMINAL_VELOCITY = 20;

// Game objects
let rings = [];
let platforms = [];
let badniks = [];
let levelEndSign = null;

// Level constants
const LEVEL_WIDTH = 4800;
const LEVEL_END_X = LEVEL_WIDTH - 200;

// GROUND HEIGHTMAP
// Single source of truth for both ground collision and terrain art: a
// continuous, piecewise-linear array of segments built from a repeating
// flat/cliff/hill pattern. Each segment starts where the previous one ended,
// so there are no height discontinuities at tile boundaries, and terrain
// rendering below reads the same tile-type pattern used to build it.
const GROUND_TILE_WIDTH = 320;
const GROUND_PATTERN = ['flat', 'cliff', 'hill'];
const GROUND_RISE = 80;

function buildGroundSegments() {
    const segments = [];
    const tileCount = Math.ceil(LEVEL_WIDTH / GROUND_TILE_WIDTH) + 1;
    let startY = 505;

    for (let i = 0; i < tileCount; i++) {
        const type = GROUND_PATTERN[i % GROUND_PATTERN.length];
        const startX = i * GROUND_TILE_WIDTH;
        const endX = startX + GROUND_TILE_WIDTH;
        let endY = startY;
        if (type === 'cliff') endY = startY - GROUND_RISE;
        if (type === 'hill') endY = startY + GROUND_RISE;

        segments.push({ startX, endX, startY, endY, type });
        startY = endY;
    }
    return segments;
}

const groundSegments = buildGroundSegments();

function getGroundTileType(tileIndex) {
    const patternLength = GROUND_PATTERN.length;
    return GROUND_PATTERN[((tileIndex % patternLength) + patternLength) % patternLength];
}

function getGroundLevel(x) {
    const clampedX = Math.min(Math.max(x, 0), LEVEL_WIDTH);
    const segment = groundSegments[Math.min(
        Math.floor(clampedX / GROUND_TILE_WIDTH),
        groundSegments.length - 1
    )];
    const t = (clampedX - segment.startX) / (segment.endX - segment.startX);
    return segment.startY + (segment.endY - segment.startY) * t;
}

// Initialize game world
function initializeGame() {
    console.log('Initializing game...');
    
    // Create rings
    rings = [];
    for (let i = 0; i < 60; i++) {
        rings.push({
            x: 200 + i * 80 + Math.random() * 40,
            y: 280 + Math.sin(i * 0.5) * 60,
            collected: false,
            animationFrame: 0
        });
    }
    
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
    
    platforms = [];
    
    // Create badniks
    badniks = [];
    const badnikPositions = [
        {x: 500, y: 416, type: 1}, 
        {x: 1000, y: 416, type: 2}, 
        {x: 1500, y: 416, type: 1}, 
        {x: 2000, y: 416, type: 2},
        {x: 2500, y: 416, type: 1}, 
        {x: 3000, y: 416, type: 2},
        {x: 3500, y: 416, type: 1},
        {x: 1100, y: 326, type: 2},
        {x: 2700, y: 316, type: 1},
        {x: 3500, y: 306, type: 2}
    ];
    
    badnikPositions.forEach(pos => {
        badniks.push({
            x: pos.x,
            y: pos.y - 89,
            width: 32,
            height: 32,
            type: pos.type, 
            velocityX: pos.type === 1 ? 1.5 : -1.5, 
            direction: pos.type === 1 ? 1 : -1,
            destroyed: false,
            animationFrame: 0, 
            animationSpeed: 0.15, 
            frameCount: 2, 
            patrolDistance: 120, 
            startX: pos.x 
        });
    });
    
    // Create level end sign
    levelEndSign = {
        x: LEVEL_END_X,
        y: 400,
        width: 80,                
        height: 96,
        crossed: false
    };
    
    // Reset Sonic
    sonic.x = 100;
    sonic.y = 441;
    sonic.velocityX = 0;
    sonic.velocityY = 0;
    sonic.isSpinDashing = false;
    sonic.isRolling = false;
    sonic.spinDashCharge = 0;
    sonic.canDoubleJump = false;
    sonic.lastJumpTime = 0;
    sonic.isHurt = false;
    sonic.hurtTimer = 0;
    
    // Reset game state
    gameData.rings = 0;
    gameData.time = 0;
    gameData.gameStartTime = Date.now();
    
    console.log('Game initialized with', rings.length, 'rings and', badniks.length, 'badniks!');
}

// Main game update loop
function update() {
    // Spin Dash mechanics
    if (keys['ArrowDown'] && sonic.onGround && !sonic.isRolling) {
        if (!sonic.isSpinDashing) {
            sonic.isSpinDashing = true;
            startChargingSound();
        }
        sonic.velocityX = 0;
        
        if (sonic.spinDashCharge < sonic.spinDashMaxCharge) {
            sonic.spinDashCharge += 2;
        }
        
        sonic.spinAnimationFrame += 0.5;
        sonic.animationFrame = 2;
    } 
    else if (sonic.isSpinDashing && !keys['ArrowDown']) {
        stopChargingSound();
        
        const launchSpeed = (sonic.spinDashCharge / sonic.spinDashMaxCharge) * 15 + 8;
        sonic.velocityX = launchSpeed * sonic.direction;
        sonic.isSpinDashing = false;
        sonic.isRolling = true;
        sonic.spinDashCharge = 0;
        playSpinDashLaunchSound();
    }
    else if (!sonic.isSpinDashing) {
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
        
        if (sonic.isRolling) {
            sonic.velocityX *= 0.98;
        }
    }
    
    // Jumping
    const jumpKeys = ['Space', 'ArrowUp', 'KeyW'];
    const jumpPressed = jumpKeys.some(key => keysPressed[key]);
    
    if (jumpPressed && !sonic.isSpinDashing) {
        const currentTime = Date.now();
        
        if (sonic.onGround) {
            sonic.velocityY = -sonic.jumpPower;
            sonic.onGround = false;
            sonic.canDoubleJump = true;
            sonic.lastJumpTime = currentTime;
            playJumpSound();
            
            if (sonic.isRolling) {
                sonic.animationFrame = 2;
            }
        }
        else if (sonic.canDoubleJump && 
                 currentTime - sonic.lastJumpTime < sonic.doubleJumpWindow &&
                 currentTime - sonic.lastJumpTime > 100) {
            
            sonic.velocityY = -sonic.doubleJumpPower;
            sonic.canDoubleJump = false;
            playDoubleJumpSound();
        }
    }
    
    // Clear key press flags
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
    
    // Update hurt state
    if (sonic.isHurt) {
        sonic.hurtTimer--;
        if (sonic.hurtTimer <= 0) {
            sonic.isHurt = false;
        }
    }
    
    // Ground detection — single velocity-guarded snap against the continuous heightmap
    sonic.onGround = false;
    const sonicCenterX = sonic.x + sonic.width / 2;
    const groundLevel = getGroundLevel(sonicCenterX);

    if (sonic.velocityY >= 0 && sonic.y + sonic.height >= groundLevel) {
        sonic.y = groundLevel - sonic.height;
        sonic.velocityY = 0;
        sonic.onGround = true;
        sonic.canDoubleJump = false;
    }
    
    // Additional platform collision for scattered platforms
    const scatteredPlatforms = [
        {x: 1100, y: 350, width: 150, height: 40},
        {x: 1800, y: 330, width: 180, height: 40},
        {x: 2600, y: 340, width: 200, height: 40},
        {x: 3400, y: 335, width: 170, height: 40},
        {x: 4200, y: 360, width: 150, height: 40}
    ];
    
    for (let platform of scatteredPlatforms) {
        if (sonic.x + sonic.width > platform.x &&
            sonic.x < platform.x + platform.width &&
            sonic.y + sonic.height > platform.y &&
            sonic.y < platform.y + platform.height) {
            
            if (sonic.velocityY >= 0 && 
                sonic.y + sonic.height - sonic.velocityX <= platform.y + 4) {
                sonic.y = platform.y - sonic.height;
                sonic.velocityY = 0;
                sonic.onGround = true;
                sonic.canDoubleJump = false;
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
        sonic.y = 441;
        sonic.velocityX = 0;
        sonic.velocityY = 0;
        sonic.isSpinDashing = false;
        sonic.isRolling = false;
        sonic.spinDashCharge = 0;
    }
    
    // Camera follows Sonic
    camera.x = sonic.x - canvas.width / 2;
    if (camera.x < 0) camera.x = 0;
    
    // Update badniks
    for (let badnik of badniks) {
        if (!badnik.destroyed) {
            badnik.x += badnik.velocityX;
            
            if (Math.abs(badnik.x - badnik.startX) > badnik.patrolDistance) {
                badnik.velocityX *= -1;
                badnik.direction *= -1;
            }
            
            badnik.animationFrame += badnik.animationSpeed;
        }
    }
    
    // Collision detection
    if (!sonic.isHurt) {
        for (let badnik of badniks) {
            if (!badnik.destroyed) {
                if (sonic.x < badnik.x + badnik.width &&
                    sonic.x + sonic.width > badnik.x &&
                    sonic.y < badnik.y + badnik.height &&
                    sonic.y + sonic.height > badnik.y) {
                    
                    console.log('COLLISION!');
                    
                    const isJumpingOnTop = sonic.velocityY > 0 && sonic.y < badnik.y;
                    const isSpinDashing = sonic.isRolling || sonic.isSpinDashing;
                    
                    if (isJumpingOnTop || isSpinDashing) {
                        badnik.destroyed = true;
                        playBadnikDestroySound();
                        console.log('Badnik destroyed!');
                        
                        if (isJumpingOnTop) {
                            sonic.velocityY = -12;
                        }
                    } else {
                        console.log('Sonic hurt!');
                        
                        if (gameData.rings > 0) {
                            gameData.rings = Math.max(0, gameData.rings - 10);
                            playRingScatterSound();
                        }
                        
                        sonic.isHurt = true;
                        sonic.hurtTimer = sonic.invulnerabilityTime;
                        
                        const knockbackDirection = sonic.x < badnik.x ? -1 : 1;
                        sonic.velocityX = knockbackDirection * 8;
                        sonic.velocityY = -6;
                        
                        playSonicHurtSound();
                    }
                }
            }
        }
    }
    
    // Ring collection
    for (let ring of rings) {
        if (!ring.collected) {
            if (sonic.x < ring.x + 24 &&
                sonic.x + sonic.width > ring.x &&
                sonic.y < ring.y + 24 &&
                sonic.y + sonic.height > ring.y) {
                
                ring.collected = true;
                gameData.rings++;
                playRingSound();
            }
            
            ring.animationFrame += 0.15;
        }
    }
    
    // Check level end sign
    if (levelEndSign && !levelEndSign.crossed &&
        sonic.x + sonic.width > levelEndSign.x &&
        sonic.x < levelEndSign.x + levelEndSign.width &&
        sonic.y + sonic.height > levelEndSign.y &&
        sonic.y < levelEndSign.y + levelEndSign.height) {
        
        levelEndSign.crossed = true;
        playLevelCompleteSound();
        
        setTimeout(() => {
            initializeGame();
        }, 1500);
    }
    
    // Sonic animation
    if (sonic.isSpinDashing || sonic.isRolling) {
        sonic.animationFrame = 2;
        sonic.spinAnimationFrame += 0.3;
    } else if (Math.abs(sonic.velocityX) > 0.5) {
        sonic.animationCounter++;
        if (sonic.animationCounter > 8) {
            sonic.animationFrame = 1 - sonic.animationFrame;
            sonic.animationCounter = 0;
        }
    } else {
        sonic.animationFrame = 0;
    }
    
    // Update game timer
    gameData.time = Math.floor((Date.now() - gameData.gameStartTime) / 1000);
}

// Main render function
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (currentGameState === 'intro') {
        renderIntro();
        return;
    } else if (currentGameState === 'loading') {
        return;
    }
    
    renderGame();
}

function renderIntro() {
    if (images.loadingScreen) {
        const scale = Math.min(canvas.width / images.loadingScreen.width, canvas.height / images.loadingScreen.height);
        const scaledWidth = images.loadingScreen.width * scale;
        const scaledHeight = images.loadingScreen.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(images.loadingScreen, x, y, scaledWidth, scaledHeight);
    } else {
        ctx.fillStyle = '#0066FF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SONIC', canvas.width / 2, canvas.height / 2 - 50);
        ctx.fillText('THE HEDGEHOG', canvas.width / 2, canvas.height / 2);
    }
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    
    const elapsed = Date.now() - introStartTime;
    if (Math.floor(elapsed / 500) % 2 === 0) {
        ctx.fillStyle = 'yellow';
    }
    ctx.fillText('Press ENTER to Start', canvas.width / 2, canvas.height - 50);
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    // Draw background
    if (images.background) {
        ctx.save();
        ctx.translate(camera.x * 0.2, camera.y * 0.2);
        
        const bgWidth = 320;
        const parallaxX = camera.x * 0.2;
        const offsetX = -(parallaxX % bgWidth);
        
        const tilesNeeded = Math.ceil(LEVEL_WIDTH / bgWidth) + 2;
        for (let i = 0; i < tilesNeeded; i++) {
            ctx.drawImage(images.background, offsetX + i * bgWidth, 0, bgWidth, 240);
        }
        ctx.restore();
    }
    
    // Draw terrain
    const terrainWidth = 320;
    const offsetX = -(camera.x % terrainWidth);
    const terrainTilesNeeded = Math.ceil(LEVEL_WIDTH / terrainWidth) + 2;
    
    if (images.terrain1) {
        for (let i = 0; i < terrainTilesNeeded; i++) {
            ctx.drawImage(images.terrain1, offsetX + i * terrainWidth, 320, terrainWidth, 240);
        }
    }
    
    if (images.terrain2) {
        for (let i = 0; i < terrainTilesNeeded; i++) {
            const globalTileIndex = Math.floor(camera.x / terrainWidth) + i;

            if (getGroundTileType(globalTileIndex) === 'cliff') {
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.drawImage(images.terrain2, offsetX + i * terrainWidth, 300, terrainWidth, 240);
                ctx.restore();
            }
        }
    }

    if (images.terrain3) {
        for (let i = 0; i < terrainTilesNeeded; i++) {
            const globalTileIndex = Math.floor(camera.x / terrainWidth) + i;

            if (getGroundTileType(globalTileIndex) === 'hill') {
                ctx.save();
                ctx.globalAlpha = 0.85;
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
                ctx.translate(ring.x + 12, ring.y + 12);
                ctx.rotate(ring.animationFrame);
                ctx.drawImage(images.ring, -12, -12, 24, 24);
                ctx.restore();
            }
        }
    }
    
    // Draw badniks
    for (let badnik of badniks) {
        if (!badnik.destroyed) {
            const currentFrame = Math.floor(badnik.animationFrame) % badnik.frameCount;
            const frameNumber = currentFrame + 1;
            const spriteKey = `badnik${badnik.type}_frame${frameNumber}`;
            const badnikSprite = images[spriteKey];
            
            if (badnikSprite && badnikSprite.complete) {
                ctx.save();
                ctx.translate(badnik.x + badnik.width/2, badnik.y + badnik.height/2);
                
                if (badnik.direction === -1) {
                    ctx.scale(-1, 1);
                }
                
                ctx.drawImage(badnikSprite, -badnik.width/2, -badnik.height/2, badnik.width, badnik.height);
                ctx.restore();
            } else {
                ctx.fillStyle = badnik.type === 1 ? '#FF3300' : '#0033FF';
                ctx.fillRect(badnik.x, badnik.y, badnik.width, badnik.height);
            }
        }
    }
    
    // Draw Sonic
    let sonicSprite;
    
    if (sonic.isHurt) {
        sonicSprite = images.sonicColliding;
    } else if (sonic.animationFrame === 2) {
        sonicSprite = images.sonicSpin;
    } else if (sonic.animationFrame === 0) {
        sonicSprite = images.sonicIdle;
    } else {
        sonicSprite = images.sonicRun;
    }
    
    if (sonicSprite) {
        ctx.save();
        ctx.translate(sonic.x + sonic.width/2, sonic.y + sonic.height/2);
        
        if (sonic.isHurt) {
            const flashRate = Math.floor(sonic.hurtTimer / 8) % 2;
            if (flashRate === 0) {
                ctx.globalAlpha = 0.5;
            }
        }
        
        if (sonic.direction === -1) {
            ctx.scale(-1, 1);
        }
        
        if (sonic.animationFrame === 2 && !sonic.isHurt) {
            ctx.rotate(sonic.spinAnimationFrame);
        }
        
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
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = chargePercent > 0.8 ? '#FF0000' : '#FFFF00';
        ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * chargePercent, barHeight - 4);
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // Draw level end sign
    if (levelEndSign && images.levelEndSign && !levelEndSign.crossed) {
        ctx.drawImage(images.levelEndSign, levelEndSign.x, levelEndSign.y, levelEndSign.width, levelEndSign.height);
    }
    
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

// Start the game
window.addEventListener('load', () => {
    console.log('🎮 Page loaded - Starting immediate audio attempt...');
    
    const immediateSegaAttempt = new Audio('assets/sega.mp3');
    immediateSegaAttempt.volume = 0.8;
    immediateSegaAttempt.preload = 'auto';
    
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
    
    tryPlayImmediate();
    setTimeout(tryPlayImmediate, 100);
    
    loadAssets();
    gameLoop();
});

window.addEventListener('blur', () => {
    // Game continues running
});

window.addEventListener('focus', () => {
    // Resume game if paused
});