// Sonic the Hedgehog Game - Complete JavaScript File
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===========================================================================
// LEVEL — FullAssets/Levels-Flattened-Layer/Level-.png
//
// The whole level is one 512x257 painting. Every fact about the ground comes
// from that single image: the terrain is drawn straight from it, and
// GROUND_HEIGHTMAP below was measured off its pixels — one row per image
// column. Each column was scanned upward through the solid terrain mass and
// the surface taken as the top of the grass band capping it; a grass band only
// counts as ground when the dark soil layer sits underneath it, which is what
// separates real terrain from the background ridge, palm trunks, bushes and
// flowers that overhang it. Because collision and rendering read the same
// image, what is drawn and what Sonic stands on cannot disagree.
//
// The art is 512x257 while the canvas is 800x600, so both the image and the
// heightmap are scaled by LEVEL_SCALE, which fills the canvas vertically.
// Heightmap values stay in image rows; getGroundLevel() applies the scale, so
// there is exactly one conversion and the art can never drift from collision.
// ===========================================================================
const LEVEL_IMAGE_WIDTH = 512;
const LEVEL_IMAGE_HEIGHT = 257;
const LEVEL_SCALE = canvas.height / LEVEL_IMAGE_HEIGHT;   // 600 / 257 ≈ 2.335
const LEVEL_WIDTH = LEVEL_IMAGE_WIDTH * LEVEL_SCALE;      // ≈ 1195 world px
const LEVEL_HEIGHT = canvas.height;

// Ground surface in image rows, one entry per image column (measured, not generated).
const GROUND_HEIGHTMAP = [
    129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,
    129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,
    129,129,129,129,129,129,129,129,129,129,129,129,129,130,131,133,191,191,192,192,192,192,192,192,192,192,192,192,192,192,193,193,
    194,194,194,194,194,194,194,194,194,195,195,195,195,195,195,195,196,196,196,197,197,197,197,197,197,197,197,197,197,197,197,197,
    197,198,198,198,198,198,198,198,198,198,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,
    199,199,199,199,199,199,198,198,198,198,198,198,198,198,198,197,197,197,197,197,197,197,197,197,197,197,197,197,197,196,196,196,
    195,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,
    194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,193,193,193,193,193,193,193,193,193,193,193,193,
    129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,
    129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,
    129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,129,128,128,128,128,128,128,128,128,128,128,128,128,128,128,
    128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,
    128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,128,
    191,191,192,192,192,192,192,192,192,192,192,192,192,192,193,193,194,194,194,194,194,194,194,194,194,195,195,195,195,195,195,195,
    196,196,196,197,197,197,197,197,197,197,197,197,197,197,197,197,197,198,198,198,198,198,198,198,198,198,199,199,199,199,199,199,
    199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,199,200
];

// The one place image rows become world pixels. Linear interpolation between
// adjacent columns keeps the surface continuous instead of stair-stepping.
function getGroundLevel(worldX) {
    const column = Math.min(Math.max(worldX / LEVEL_SCALE, 0), LEVEL_IMAGE_WIDTH - 1);
    const index = Math.floor(column);
    const next = Math.min(index + 1, LEVEL_IMAGE_WIDTH - 1);
    const t = column - index;
    return (GROUND_HEIGHTMAP[index] + (GROUND_HEIGHTMAP[next] - GROUND_HEIGHTMAP[index]) * t) * LEVEL_SCALE;
}

// Sprites are authored against the same 512x257 art, so they scale with it.
const spriteSize = (imagePixels) => Math.round(imagePixels * LEVEL_SCALE);

// Asset loading system
const images = {};
let assetsLoaded = 0;
const totalAssets = 13;

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
    // The flattened level painting replaces the old tiled background/terrain art:
    // it is both the terrain graphic and the source of GROUND_HEIGHTMAP.
    level: 'FullAssets/Levels-Flattened-Layer/Level-.png',
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
    x: 80,
    y: 0,
    width: spriteSize(40),
    height: spriteSize(40),
    velocityX: 0,
    velocityY: 0,
    speed: 6,
    jumpPower: 21,
    doubleJumpPower: 26,
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

// Physics constants, sized for a world scaled up by LEVEL_SCALE. A jump rises
// jumpPower^2 / (2 * GRAVITY) ≈ 220px, comfortably more than the ≈163px climb
// from the water pits back up onto the grass ledges.
const GRAVITY = 1.0;
const FRICTION = 0.85;
const TERMINAL_VELOCITY = 28;

// A rise in the ground bigger than this is a wall, not a step Sonic walks up.
const MAX_STEP = 24;

// Game objects
let rings = [];
let badniks = [];
let levelEndSign = null;

const LEVEL_END_X = LEVEL_WIDTH - spriteSize(70);

// Initialize game world
function initializeGame() {
    console.log('Initializing game...');
    
    // Rings ride the measured ground so they hug whatever the art actually does,
    // instead of hanging at coordinates tuned to a level that no longer exists.
    const ringSize = spriteSize(16);
    rings = [];
    for (let x = 150; x < LEVEL_END_X - 60; x += 46) {
        const bob = Math.sin(x / 90) * 30;
        rings.push({
            x: x,
            y: getGroundLevel(x + ringSize / 2) - ringSize - 45 - bob,
            size: ringSize,
            collected: false,
            animationFrame: (x / 46) % Math.PI
        });
    }

    // Arcs of rings tempting a jump across each water pit.
    [{ start: 200, end: 560 }, { start: 1000, end: 1160 }].forEach(gap => {
        const span = gap.end - gap.start;
        for (let i = 0; i <= 6; i++) {
            const t = i / 6;
            const x = gap.start + span * t;
            rings.push({
                x: x,
                y: getGroundLevel(x + ringSize / 2) - ringSize - 60 - Math.sin(t * Math.PI) * 150,
                size: ringSize,
                collected: false,
                animationFrame: i * 0.4
            });
        }
    });

    // Badniks patrol the ledges and pit floors; their y is re-read from the
    // heightmap every frame in update(), so they walk on the drawn ground too.
    const badnikSize = spriteSize(24);
    badniks = [];
    [
        { x: 300, type: 1 }, { x: 460, type: 2 },
        { x: 700, type: 1 }, { x: 880, type: 2 },
        { x: 1000, type: 1 }
    ].forEach(pos => {
        badniks.push({
            x: pos.x,
            y: getGroundLevel(pos.x + badnikSize / 2) - badnikSize,
            width: badnikSize,
            height: badnikSize,
            type: pos.type,
            velocityX: pos.type === 1 ? 1.8 : -1.8,
            direction: pos.type === 1 ? 1 : -1,
            destroyed: false,
            animationFrame: 0,
            animationSpeed: 0.15,
            frameCount: 2,
            patrolDistance: 70,
            startX: pos.x
        });
    });

    // Create level end sign
    const signWidth = spriteSize(40);
    const signHeight = spriteSize(56);
    levelEndSign = {
        x: LEVEL_END_X,
        y: getGroundLevel(LEVEL_END_X + signWidth / 2) - signHeight,
        width: signWidth,
        height: signHeight,
        crossed: false
    };

    // Reset Sonic
    sonic.x = 80;
    sonic.y = getGroundLevel(sonic.x + sonic.width / 2) - sonic.height;
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
    
    // Horizontal movement, then the cliff faces the heightmap describes. A
    // column whose surface sits far above Sonic's feet is a wall he has to jump
    // — without this he would teleport up the ledges the art clearly blocks.
    const previousX = sonic.x;
    sonic.x += sonic.velocityX;

    if (sonic.x < 0) {
        sonic.x = 0;
        sonic.velocityX = 0;
        sonic.isRolling = false;
    } else if (sonic.x > LEVEL_WIDTH - sonic.width) {
        sonic.x = LEVEL_WIDTH - sonic.width;
        sonic.velocityX = 0;
        sonic.isRolling = false;
    }

    if (sonic.y + sonic.height > getGroundLevel(sonic.x + sonic.width / 2) + MAX_STEP) {
        sonic.x = previousX;
        sonic.velocityX = 0;
        sonic.isRolling = false;
    }

    sonic.y += sonic.velocityY;

    // Update hurt state
    if (sonic.isHurt) {
        sonic.hurtTimer--;
        if (sonic.hurtTimer <= 0) {
            sonic.isHurt = false;
        }
    }

    // Ground detection — one velocity-guarded snap onto the measured surface.
    // This is the only ground collision in the game; there are no separate
    // platforms that could sit somewhere the level art does not show.
    sonic.onGround = false;
    const groundLevel = getGroundLevel(sonic.x + sonic.width / 2);

    if (sonic.velocityY >= 0 && sonic.y + sonic.height >= groundLevel) {
        sonic.y = groundLevel - sonic.height;
        sonic.velocityY = 0;
        sonic.onGround = true;
        sonic.canDoubleJump = false;
    }

    // Reset if Sonic somehow ends up below the level
    if (sonic.y > LEVEL_HEIGHT + 100) {
        sonic.x = 80;
        sonic.y = getGroundLevel(sonic.x + sonic.width / 2) - sonic.height;
        sonic.velocityX = 0;
        sonic.velocityY = 0;
        sonic.isSpinDashing = false;
        sonic.isRolling = false;
        sonic.spinDashCharge = 0;
    }

    // Camera follows Sonic, clamped to the level the art actually covers. The
    // level is exactly one canvas tall, so it never scrolls vertically.
    camera.x = Math.min(Math.max(sonic.x - canvas.width / 2, 0), Math.max(0, LEVEL_WIDTH - canvas.width));

    // Badniks walk the same measured surface, and turn at cliffs rather than
    // strolling off into the water.
    for (let badnik of badniks) {
        if (!badnik.destroyed) {
            // Both limits are tested against where the step *would* land, so the
            // badnik turns before stepping out rather than flipping in place.
            const nextX = badnik.x + badnik.velocityX;
            const leavingPatrol = Math.abs(nextX - badnik.startX) > badnik.patrolDistance;
            const leavingGround = Math.abs(getGroundLevel(nextX + badnik.width / 2) -
                                           getGroundLevel(badnik.x + badnik.width / 2)) > MAX_STEP;

            if (leavingPatrol || leavingGround) {
                badnik.velocityX *= -1;
                badnik.direction *= -1;
            } else {
                badnik.x = nextX;
            }

            badnik.y = getGroundLevel(badnik.x + badnik.width / 2) - badnik.height;
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
            if (sonic.x < ring.x + ring.size &&
                sonic.x + sonic.width > ring.x &&
                sonic.y < ring.y + ring.size &&
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

// Traces the collision surface along the top of the terrain. Used as the
// fallback terrain fill when the level art fails to load, and — with G held —
// as an overlay for checking that the surface follows the drawn ground.
function traceGroundPath() {
    ctx.beginPath();
    ctx.moveTo(0, GROUND_HEIGHTMAP[0] * LEVEL_SCALE);
    for (let column = 1; column < LEVEL_IMAGE_WIDTH; column++) {
        ctx.lineTo(column * LEVEL_SCALE, GROUND_HEIGHTMAP[column] * LEVEL_SCALE);
    }
    ctx.lineTo(LEVEL_WIDTH, GROUND_HEIGHTMAP[LEVEL_IMAGE_WIDTH - 1] * LEVEL_SCALE);
}

function drawHeightmapSilhouette() {
    ctx.fillStyle = '#2401b7';
    ctx.fillRect(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);

    ctx.fillStyle = '#3d9b00';
    traceGroundPath();
    ctx.lineTo(LEVEL_WIDTH, LEVEL_HEIGHT);
    ctx.lineTo(0, LEVEL_HEIGHT);
    ctx.closePath();
    ctx.fill();
}

function drawGroundLine() {
    ctx.save();
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 3;
    traceGroundPath();
    ctx.stroke();
    ctx.restore();
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Terrain. The level art is drawn once, whole, scaled by exactly the same
    // LEVEL_SCALE that getGroundLevel() applies to the heightmap read off it —
    // so the ground Sonic collides with is the ground on screen.
    if (images.level) {
        ctx.drawImage(images.level, 0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    } else {
        drawHeightmapSilhouette();
    }

    // Hold G to see the collision surface drawn over the art it was read from.
    if (keys['KeyG']) {
        drawGroundLine();
    }

    // Draw rings
    if (images.ring) {
        for (let ring of rings) {
            if (!ring.collected) {
                const half = ring.size / 2;
                ctx.save();
                ctx.translate(ring.x + half, ring.y + half);
                ctx.rotate(ring.animationFrame);
                ctx.drawImage(images.ring, -half, -half, ring.size, ring.size);
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