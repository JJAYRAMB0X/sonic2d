// Sonic the Hedgehog Game - Complete JavaScript File
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===========================================================================
// LEVEL — three paintings from FullAssets/Levels-Flattened-Layer/ chained into
// one continuous side-scroller:
//
//   Level-.png                        grass ledges over water pits
//   Level-2.png                       a short flat run under the palms
//   Level-3.png                       a long, gently rolling jungle run
//   Level-With_Loop.png               a slope down to the lake, then the loop
//   Level-With_Spikes-Springboard.png stepped blocks, waterfall, high towers
//
// Every fact about the ground comes from those images. The terrain is drawn
// from them directly, and LEVEL_HEIGHTMAPS (level-heightmaps.js) was measured
// off their pixels — one row per image column. Because collision and rendering
// read the same picture through the same scale, what is drawn and what Sonic
// stands on cannot disagree.
//
// The three were drawn at very different resolutions (512x257 up to 1808x1288),
// so a shared scale would make Sonic a giant in one segment and an ant in the
// next. Each is instead scaled by its own measured grass-band thickness, so one
// band is LEVEL_TILE tall everywhere and terrain reads at a consistent size.
//
// Segments are then laid end to end, and each is nudged vertically so the ground
// where it starts meets the ground where the previous one ended. Every join
// comes out flush to within a pixel.
//
// The loop painting carries a lot of sky above its ground, so matching its seam
// pushes it above the others; the whole layout is shifted down afterwards to
// keep the world's top edge at zero.
// ===========================================================================
const LEVEL_TILE = 40;              // world pixels per source grass band
const LEVEL_ASSET_DIR = 'FullAssets/Levels-Flattened-Layer/';

// The paintings themselves, each measured once.
const LEVEL_ART = {
    levelA: { file: 'Level-.png',                        imageWidth: 512,  imageHeight: 257,  band: 17 },
    level2: { file: 'Level-2.png',                       imageWidth: 419,  imageHeight: 350,  band: 41 },
    level3: { file: 'Level-3.png',                       imageWidth: 1808, imageHeight: 1288, band: 93 },
    loop:   { file: 'Level-With_Loop.png',               imageWidth: 530,  imageHeight: 359,  band: 17 },
    spikes: { file: 'Level-With_Spikes-Springboard.png', imageWidth: 875,  imageHeight: 428,  band: 31 }
};

// The route through them. A painting may appear as often as it likes — each
// entry becomes its own segment, sharing the art and heightmap but placed at its
// own spot in the chain. The order avoids putting a painting next to itself, and
// finishes on Level-2, whose flat field is the arena for a boss.
//
// The drifts very nearly cancel over a pass (levelA +167, loop +125, spikes -283,
// level3 -30, level2 +9 = -12), so the world stays level however long it runs
// rather than sliding steadily downhill.
const LEVEL_ORDER = [
    'levelA', 'level3', 'loop', 'spikes', 'level2',
    'levelA', 'loop', 'level3', 'spikes', 'level2',
    'levelA', 'level3', 'loop', 'spikes', 'level2'
];

const LEVEL_SEGMENTS = [];

// Lay the segments out: scale each by its own grass band, place it after the
// previous one, and shift it vertically so the ground flows across the seam.
function buildLevel() {
    let x = 0;
    let previousGroundY = null;
    const seen = {};

    for (const art of LEVEL_ORDER) {
        seen[art] = (seen[art] || 0) + 1;
        const source = LEVEL_ART[art];
        const heightmap = LEVEL_HEIGHTMAPS[art];
        const scale = LEVEL_TILE / source.band;

        const segment = {
            art: art,
            id: `${art}#${seen[art]}`,
            heightmap: heightmap,
            scale: scale,
            width: source.imageWidth * scale,
            height: source.imageHeight * scale,
            x: x,
            y: previousGroundY === null ? 0 : previousGroundY - heightmap[0] * scale
        };

        LEVEL_SEGMENTS.push(segment);
        previousGroundY = segment.y + heightmap[heightmap.length - 1] * scale;
        x += segment.width;
    }

    // Matching seams can drive a tall painting above the origin; slide the whole
    // chain back down so world coordinates stay positive.
    const highest = Math.min(...LEVEL_SEGMENTS.map(s => s.y));
    for (const segment of LEVEL_SEGMENTS) segment.y -= highest;

    return x;
}

const LEVEL_WIDTH = buildLevel();
const LEVEL_BOTTOM = Math.max(...LEVEL_SEGMENTS.map(s => s.y + s.height));
const LAST_SEGMENT = LEVEL_SEGMENTS[LEVEL_SEGMENTS.length - 1];

function segmentAt(worldX) {
    for (let i = LEVEL_SEGMENTS.length - 1; i > 0; i--) {
        if (worldX >= LEVEL_SEGMENTS[i].x) return LEVEL_SEGMENTS[i];
    }
    return LEVEL_SEGMENTS[0];
}

// The one place image rows become world pixels. Linear interpolation between
// adjacent columns keeps the surface continuous instead of stair-stepping.
function getGroundLevel(worldX) {
    const segment = segmentAt(worldX);
    const map = segment.heightmap;
    const column = Math.min(Math.max((worldX - segment.x) / segment.scale, 0), map.length - 1);
    const index = Math.floor(column);
    const next = Math.min(index + 1, map.length - 1);
    const t = column - index;
    return (map[index] + (map[next] - map[index]) * t) * segment.scale + segment.y;
}

// Sprites are sized in tiles so they match the terrain in every segment.
const worldSize = (tiles) => Math.round(tiles * LEVEL_TILE);

// Asset loading system
const images = {};
let assetsLoaded = 0;
const totalAssets = 24;

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

function playSpringSound() {
    playSound(784, 0.06, 'square', 0.18);
    setTimeout(() => playSound(1175, 0.06, 'square', 0.15), 30);
    setTimeout(() => playSound(1568, 0.14, 'square', 0.12), 60);
}

function playSonicHurtSound() {
    playSound(523, 0.08, 'square', 0.2);
    setTimeout(() => playSound(466, 0.08, 'square', 0.18), 50);
    setTimeout(() => playSound(392, 0.12, 'square', 0.15), 100);
}

// A bright shower that falls away, so you hear the rings leave rather than a
// single blip. Pitches slide down as they scatter.
function playRingScatterSound() {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            playSound(1760 - i * 110, 0.05, 'sine', 0.11 - i * 0.008);
            playSound(2640 - i * 150, 0.03, 'triangle', 0.05);
        }, i * 35);
    }
}

function playSonicDeathSound() {
    playSound(392, 0.18, 'square', 0.2);
    setTimeout(() => playSound(330, 0.18, 'square', 0.18), 140);
    setTimeout(() => playSound(262, 0.3, 'square', 0.16), 300);
    setTimeout(() => playSound(196, 0.5, 'sawtooth', 0.14), 520);
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

// Gameplay music. Deliberately outside the asset counter: nothing waits on it,
// and it only starts once the player leaves the title screen — which is also
// the key press browsers require before they will let audio play at all.
const music = new Audio('FullAssets/sonic1.MP3');
music.loop = true;
music.volume = 0.35;
music.preload = 'auto';

function startMusic() {
    if (sounds.segaAudio) sounds.segaAudio.pause();   // don't talk over the jingle's tail
    music.currentTime = 0;
    music.play().catch(err => console.log('Music blocked until interaction:', err));
}

// Asset file paths
const assetPaths = {
    sonicIdle: 'assets/sonic_idle.png',
    sonicRun: 'assets/sonic_run.png',
    sonicSpin: 'assets/Sonic-Spin.png',
    sonicColliding: 'assets/Sonic-Colliding.png',
    sonicLaunching: 'FullAssets/Sonic-Poses/Sonic-Launching.png',
    sonicLanding: 'FullAssets/Sonic-Poses/Sonic-Landing.png',
    sonicBalancing: 'FullAssets/Sonic-Poses/Sonic-Balancing.png',
    sonicCrouch: 'FullAssets/Sonic-Poses/Sonic-Crouch.png',
    sonicDead: 'assets/Sonic-Dead.png',
    ring: 'assets/Ring.png',
    spring: 'FullAssets/Accessories/Spring.png',
    plane: 'FullAssets/Accessories/Soni-Tails-Plane.png',
    loadingScreen: 'assets/LoadingScreen.png',
    levelEndSign: 'assets/Level-End-Sign1.png',
    badnik1_frame1: 'assets/badnik1_frame1.png',
    badnik1_frame2: 'assets/badnik1_frame2.png',
    badnik2_frame1: 'assets/badnik2_frame1.png',
    badnik2_frame2: 'assets/badnik2_frame2.png',
    segaAudio: 'assets/sega.mp3'
};

// The level paintings are both the terrain graphics and the source of the
// heightmaps. Loaded once per painting, however many segments reuse it.
for (const [art, source] of Object.entries(LEVEL_ART)) {
    assetPaths[art] = LEVEL_ASSET_DIR + source.file;
}

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
                // Playback is driven by the timer set up on page load, so this
                // copy is only here for startMusic() to silence.
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

    // Numpad 0 sits right beside the arrow cluster, so the whole game can be
    // played one-handed. T does the same thing for anyone without a numpad.
    if (currentGameState === 'playing' && (e.code === 'KeyT' || e.code === 'Numpad0')) {
        setPlaneMode(!planeMode);
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
    width: worldSize(2.4),
    height: worldSize(2.4),
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
    invulnerabilityTime: 120,
    launchTimer: 0,
    landTimer: 0,
    pose: 'idle',
    onLoop: null,
    loopBlocked: null,
    spriteAngle: 0,
    isDead: false,
    deathTimer: 0
};

// Which sprite each pose draws with. Rising and falling get their own poses, so
// a jump reads as launch -> descend -> touchdown instead of running in mid-air.
const POSE_SPRITES = {
    hurt: 'sonicColliding',
    spin: 'sonicSpin',
    launch: 'sonicLaunching',
    fall: 'sonicLanding',
    land: 'sonicLanding',
    balance: 'sonicBalancing',
    crouch: 'sonicCrouch',
    dead: 'sonicDead',
    run: 'sonicRun',
    idle: 'sonicIdle'
};

// Per-pose size trim, applied on top of the hitbox height. Some poses read far
// bigger than the others at matched height and need pulling back.
const POSE_SCALE = {
    hurt: 0.75,
    spin: 0.8
};

const LANDING_HOLD = 9;     // frames the touchdown pose stays up

// How far ahead of Sonic's feet to sample the ground, and how far it has to
// fall away over that distance before he is standing on a lip.
const EDGE_LOOK = 46;
const EDGE_DROP = 70;

// True when the ground ahead of the way Sonic is facing drops out from under
// him — the lip of a ledge, or the point where two very different ground
// angles meet. The heightmap already knows exactly where those are.
function isOnEdge() {
    const centerX = sonic.x + sonic.width / 2;
    const ahead = centerX + EDGE_LOOK * sonic.direction;
    if (ahead < 0 || ahead > LEVEL_WIDTH) return false;
    return getGroundLevel(ahead) - getGroundLevel(centerX) > EDGE_DROP;
}

function choosePose() {
    if (sonic.isDead) return 'dead';
    if (sonic.onLoop) return 'crouch';          // tucked low, riding the rail
    if (sonic.isHurt) return 'hurt';
    if (sonic.isSpinDashing || sonic.isRolling) return 'spin';
    if (!sonic.onGround) return sonic.velocityY < 0 ? 'launch' : 'fall';
    if (sonic.landTimer > 0) return 'land';
    if (Math.abs(sonic.velocityX) < 0.5 && isOnEdge()) return 'balance';
    return sonic.animationFrame === 1 ? 'run' : 'idle';
}

// Physics constants, sized for a world where one tile is LEVEL_TILE. A jump
// rises jumpPower^2 / (2 * GRAVITY) ≈ 220px, which clears every climb on the
// route: the ≈163px out of the water pits and the ≈122px block steps later on.
// The only rise taller than that is the tower past the goal.
const GRAVITY = 1.0;
const FRICTION = 0.85;
const TERMINAL_VELOCITY = 28;

// A rise in the ground bigger than this is a wall, not a step Sonic walks up.
const MAX_STEP = 24;

// Spin dash launch speeds, across the whole charge range, wound up by this much.
const SPIN_DASH_BOOST = 1.7;

// ---------------------------------------------------------------------------
// TORNADO MODE (press T)
//
// Swaps Sonic for the Tornado biplane and turns the level into a flying stage.
// The plane ignores terrain completely — no gravity, no ground, no walls, no
// spikes, no springs — and is held in only by the edges of the level. It still
// collects rings, and it destroys any badnik it touches without being hurt.
// The art has the plane facing left, so it is mirrored to fly right.
// ---------------------------------------------------------------------------
const SONIC_SIZE = sonic.width;
const PLANE_WIDTH = worldSize(4);
const PLANE_HEIGHT = Math.round(PLANE_WIDTH * 260 / 380);   // keep the art's aspect
const PLANE_SPEED = 5;
const PLANE_CLIMB = 4.5;

let planeMode = false;

// Swap the player's body around its own centre, so the switch happens where the
// player already is instead of jerking them somewhere else.
function setPlaneMode(on) {
    if (on === planeMode) return;

    const centerX = sonic.x + sonic.width / 2;
    const centerY = sonic.y + sonic.height / 2;

    planeMode = on;
    sonic.width = on ? PLANE_WIDTH : SONIC_SIZE;
    sonic.height = on ? PLANE_HEIGHT : SONIC_SIZE;
    sonic.x = centerX - sonic.width / 2;
    sonic.y = centerY - sonic.height / 2;

    sonic.velocityX = 0;
    sonic.velocityY = 0;
    sonic.onGround = false;
    sonic.isRolling = false;
    sonic.isSpinDashing = false;
    sonic.spinDashCharge = 0;
    sonic.launchTimer = 0;
    // The hurt timer only ticks on foot, so clear it rather than leave Sonic
    // stuck mid-flinch for the whole flight.
    sonic.isHurt = false;
    sonic.hurtTimer = 0;
    sonic.onLoop = null;
    sonic.spriteAngle = 0;
    stopChargingSound();

    console.log(on ? '✈️ Tornado mode' : '🏃 Back on foot');
}

// Constant cruise. Left and right turn the plane around — it then flies that
// way at the same speed — while up and down point the nose.
function updatePlane() {
    if (keys['ArrowLeft'] || keys['KeyA']) sonic.direction = -1;
    if (keys['ArrowRight'] || keys['KeyD']) sonic.direction = 1;
    sonic.velocityX = PLANE_SPEED * sonic.direction;

    let climb = 0;
    if (keys['ArrowUp'] || keys['KeyW']) climb -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) climb += 1;
    sonic.velocityY = climb * PLANE_CLIMB;

    sonic.x += sonic.velocityX;
    sonic.y += sonic.velocityY;

    // Nothing stops the plane except the edges of the level itself.
    sonic.x = Math.min(Math.max(sonic.x, 0), LEVEL_WIDTH - sonic.width);
    sonic.y = Math.min(Math.max(sonic.y, 0), LEVEL_BOTTOM - sonic.height);
}

// Game objects
let rings = [];
let badniks = [];
let levelEndSign = null;

// The goal is at the far end of the last painting, on Level-2's flat field.
const LEVEL_END_X = LAST_SEGMENT.x + LAST_SEGMENT.width - worldSize(4);

const SPRING_SPRITE_SIZE = { width: worldSize(1.4), height: worldSize(0.8) };

// ---------------------------------------------------------------------------
// Things that belong to a painting rather than to a place in the level. Boxes
// are given in that painting's own image pixels, so every time the painting
// appears in LEVEL_ORDER it brings its spikes, springs and loop along with it.
// ---------------------------------------------------------------------------
const ART_FEATURES = {
    spikes: {
        // The row of spikes at the foot of the waterfall. These hurt however you
        // touch them — rolling through does not save you.
        hazards: [{ x: 197, y: 322, width: 88, height: 34 }],
        springs: [
            // The red springboard painted into the art, pointing up and right.
            // Launch is capped by headroom: 20 puts the apex just under the top
            // of the view, which is as high as Sonic can go and stay on screen.
            { x: 598, y: 176, width: 61, height: 19, launch: 20, push: 14 },
            // Ours, on the ledge above the spike pit. Angled forward on purpose:
            // a purely vertical bounce would drop a slow-moving Sonic straight
            // into the spikes, whereas the push clears them at any speed.
            { groundX: 148, launch: 20, push: 8, sprite: 'spring' },
            // At the foot of the tower this painting ends on. That tower is a
            // 394px wall in its last 55px — fine when the painting was last in
            // the chain, impassable now that the level carries on past it. The
            // bounce is straight up so Sonic rises against the face and slides
            // over the top rather than being thrown into it.
            { groundX: 1020, launch: 30, push: 0, sprite: 'spring' }
        ],
        badniks: [168, 338, 868],
        ringArcs: [[198, 438], [638, 818]]
    },
    loop: {
        // Fitted to the two parts of the drawing that can be measured cleanly:
        // the inner ceiling, whose highest point sits at image x 388 y 123, and
        // the floor at y 298 — centre (386, 210), radius 88.
        loops: [{ cx: 386, cy: 210, radius: 88 }],
        // The flat top of the loop block: solid, but far above the ground the
        // heightmap describes. One-way, landed on from above only.
        platforms: [{ x: 258, y: 105, width: 262, height: 10 }],
        badniks: [320, 1150],
        ringArcs: [[640, 1060]]
    },
    levelA: {
        badniks: [300, 460, 800],
        ringArcs: [[200, 560], [1000, 1160]]
    },
    level3: {
        badniks: [145, 445, 695],
        ringArcs: [[245, 545]]
    },
    level2: {
        badniks: [200],
        ringArcs: []
    }
};

const featuresFor = (segment) => ART_FEATURES[segment.art] || {};

// Image pixels of a segment's painting -> world box, through that segment's own
// scale: the same one the terrain is drawn with, so it stays pinned to the art.
function fromArt(segment, box) {
    return {
        x: segment.x + box.x * segment.scale,
        y: segment.y + box.y * segment.scale,
        width: box.width * segment.scale,
        height: box.height * segment.scale
    };
}

const HAZARDS = [];
const SPRINGS = [];
const LOOPS = [];
const PLATFORMS = [];

for (const segment of LEVEL_SEGMENTS) {
    const features = featuresFor(segment);

    for (const box of features.hazards || []) HAZARDS.push(fromArt(segment, box));
    for (const box of features.platforms || []) PLATFORMS.push(fromArt(segment, box));

    for (const circle of features.loops || []) {
        LOOPS.push({
            cx: segment.x + circle.cx * segment.scale,
            cy: segment.y + circle.cy * segment.scale,
            radius: circle.radius * segment.scale
        });
    }

    for (const spring of features.springs || []) {
        // Two kinds: one traced off the painting in image pixels, and one we
        // place ourselves at a world offset and drop onto the ground.
        const placed = spring.groundX !== undefined
            ? {
                x: segment.x + spring.groundX,
                y: 0,
                width: SPRING_SPRITE_SIZE.width,
                height: SPRING_SPRITE_SIZE.height
            }
            : fromArt(segment, spring);

        placed.launch = spring.launch;
        placed.push = spring.push;
        placed.sprite = spring.sprite;
        SPRINGS.push(placed);
    }
}

for (const spring of SPRINGS) {
    if (spring.sprite) spring.y = getGroundLevel(spring.x + spring.width / 2) - spring.height;
}

// ---------------------------------------------------------------------------
// THE LOOP
//
// This is the one thing the heightmap genuinely cannot describe. getGroundLevel
// returns a single y for each x, so it can express a hill or a cliff but never a
// surface that turns vertical (infinite slope) and then inverts — which is most
// of a loop. It also cannot hold two surfaces at the same x, and a loop needs
// both a floor and a ceiling.
//
// So the loop is not terrain at all: it is a circle Sonic latches onto and rides
// on rails. Arriving at the bottom with enough speed attaches him; he then runs
// the full 360 with his feet on the inside of the circle and his sprite rotating
// with the track, and is released at the bottom facing the way he came in.
//
// The circle is placed by hand from the art. It cannot be fitted from the
// pixels: where the loop meets the ground the drawing flattens out into the
// shaded rim, so the measured boundary there is a shallow bowl rather than an
// arc, and a least-squares fit swings between radius 88 and 126 depending on
// which columns you feed it.
// ---------------------------------------------------------------------------
// Below this Sonic cannot hold the inside of the loop and simply runs past it.
// A plain run (speed 6) just makes it; walking out of a spin dash flies round.
const LOOP_MIN_SPEED = 5;

// The rail is ridden faster than Sonic runs, so a lap is a quick whip round
// rather than a slow crawl. He is released at the speed he arrived with, so the
// boost does not leak into the rest of the level's pacing.
const LOOP_RIDE_SPEED = [14, 28];       // min, max

// A visible rail, drawn on the circle Sonic actually rides.
const RAIL_THICKNESS = Math.round(worldSize(2.4) * 0.2);
const RAIL_COLOR = '#39FF14';

const overlaps = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

// Sonic's feet ride the inside of the circle, so his body sits one half-height
// in from it, and the sprite turns with the track: at the bottom he is upright,
// on the right wall his feet point right, at the top he is upside down.
function placeOnLoop() {
    const ride = sonic.onLoop;
    const bodyRadius = ride.loop.radius - sonic.height / 2;
    sonic.x = ride.loop.cx + Math.cos(ride.angle) * bodyRadius - sonic.width / 2;
    sonic.y = ride.loop.cy + Math.sin(ride.angle) * bodyRadius - sonic.height / 2;
    sonic.spriteAngle = ride.angle - Math.PI / 2;
}

// Attach when Sonic crosses the foot of a loop on the ground with enough speed.
function tryEnterLoop() {
    const centerX = sonic.x + sonic.width / 2;

    // A ride ends at the foot of the circle, right back inside the entry zone,
    // so the loop that just released him stays blocked until he has actually
    // left its span. Otherwise he would spin round it forever.
    if (sonic.loopBlocked && Math.abs(centerX - sonic.loopBlocked.cx) > sonic.loopBlocked.radius) {
        sonic.loopBlocked = null;
    }

    if (sonic.onLoop || !sonic.onGround) return;

    const speed = Math.abs(sonic.velocityX);
    if (speed < LOOP_MIN_SPEED) return;

    const feet = sonic.y + sonic.height;

    for (const loop of LOOPS) {
        if (loop === sonic.loopBlocked) continue;
        if (Math.abs(centerX - loop.cx) > loop.radius * 0.75) continue;
        if (Math.abs(feet - (loop.cy + loop.radius)) > loop.radius * 0.5) continue;

        sonic.onLoop = {
            loop: loop,
            angle: Math.PI / 2,                 // the foot of the circle
            travelled: 0,
            speed: Math.min(Math.max(speed * 2, LOOP_RIDE_SPEED[0]), LOOP_RIDE_SPEED[1]),
            exitSpeed: speed,
            direction: sonic.velocityX >= 0 ? 1 : -1
        };
        sonic.direction = sonic.onLoop.direction;
        sonic.onGround = true;
        sonic.velocityY = 0;
        placeOnLoop();
        return;
    }
}

// On rails: the player's speed drives the angle, and gravity is ignored until
// the circle is finished. Real centripetal physics would need an entry speed of
// about 28 to hold a loop this size, which nothing in the game can reach.
function updateLoopRide() {
    const ride = sonic.onLoop;
    const step = ride.speed / ride.loop.radius;

    ride.angle -= step * ride.direction;
    ride.travelled += step;

    if (ride.travelled >= Math.PI * 2) {
        sonic.velocityX = ride.exitSpeed * ride.direction;
        sonic.velocityY = 0;
        sonic.spriteAngle = 0;
        sonic.loopBlocked = ride.loop;
        sonic.onLoop = null;
        return;
    }

    placeOnLoop();
    sonic.velocityX = ride.exitSpeed * ride.direction;
    sonic.onGround = true;
}

// Rings knocked loose by a hit. They burst out, bounce off the measured ground
// and can be grabbed back — the ones that stop rolling stay lying where the hit
// happened until they time out.
let lostRings = [];

const LOST_RING_LIMIT = 24;         // how many are drawn, however many were lost
const LOST_RING_LIFE = 420;         // ~7 seconds before they wink out
const LOST_RING_BLINK = 90;         // frames of blinking before that
const LOST_RING_ARM = 40;           // frames before Sonic can pick them back up

function scatterLostRings(count, centerX, centerY) {
    const size = worldSize(1);
    const shown = Math.min(count, LOST_RING_LIMIT);

    for (let i = 0; i < shown; i++) {
        // Fan them right round, with alternating rings thrown harder so the
        // burst has two rows to it rather than one flat ring.
        const angle = (Math.PI * 2 * i) / shown;
        const power = (i % 2 === 0 ? 7 : 4.5);

        lostRings.push({
            x: centerX - size / 2,
            y: centerY - size / 2,
            velocityX: Math.cos(angle) * power,
            velocityY: Math.sin(angle) * power - 3,     // biased upward
            size: size,
            life: LOST_RING_LIFE,
            arm: LOST_RING_ARM,
            animationFrame: Math.random() * Math.PI
        });
    }
}

function updateLostRings() {
    for (const ring of lostRings) {
        ring.velocityY += GRAVITY * 0.5;
        ring.x += ring.velocityX;
        ring.y += ring.velocityY;

        const ground = getGroundLevel(ring.x + ring.size / 2);
        if (ring.velocityY > 0 && ring.y + ring.size >= ground) {
            ring.y = ground - ring.size;
            ring.velocityY *= -0.55;                     // bounce, losing height
            ring.velocityX *= 0.8;
            if (Math.abs(ring.velocityY) < 1.5) {        // came to rest
                ring.velocityY = 0;
                ring.velocityX = 0;
            }
        }

        ring.animationFrame += 0.2;
        if (ring.arm > 0) ring.arm--;
        ring.life--;

        // Only the arming delay gates a pickup. Gating on the hurt flash too
        // would lock them away for the full 120-frame invulnerability.
        if (ring.arm === 0 && !sonic.isDead &&
            sonic.x < ring.x + ring.size && sonic.x + sonic.width > ring.x &&
            sonic.y < ring.y + ring.size && sonic.y + sonic.height > ring.y) {
            ring.life = 0;
            gameData.rings++;
            playRingSound();
        }
    }

    lostRings = lostRings.filter(ring => ring.life > 0);
}

// Shared by badniks and spikes so a hit costs the same either way. With no rings
// left to lose there is nothing to cushion the hit, and Sonic dies.
function hurtSonic(knockbackDirection) {
    sonic.onLoop = null;                        // knocked off the track
    sonic.spriteAngle = 0;

    if (gameData.rings <= 0) {
        killSonic();
        return;
    }

    console.log('Sonic hurt - rings scattered!');
    scatterLostRings(gameData.rings, sonic.x + sonic.width / 2, sonic.y + sonic.height / 2);
    gameData.rings = 0;
    playRingScatterSound();

    sonic.isHurt = true;
    sonic.hurtTimer = sonic.invulnerabilityTime;
    sonic.isSpinDashing = false;
    sonic.isRolling = false;
    sonic.velocityX = knockbackDirection * 8;
    sonic.velocityY = -6;

    playSonicHurtSound();
}

// Death: the hop, then a fall clean through the floor, then back to the start
// of the level with the music from the top.
function killSonic() {
    console.log('Sonic died');
    sonic.isDead = true;
    sonic.deathTimer = 160;
    sonic.velocityX = 0;
    sonic.velocityY = -15;
    sonic.isHurt = false;
    sonic.hurtTimer = 0;
    sonic.isSpinDashing = false;
    sonic.isRolling = false;
    sonic.spinDashCharge = 0;
    sonic.onGround = false;
    stopChargingSound();
    music.pause();
    playSonicDeathSound();
}

function updateDeath() {
    sonic.velocityY += GRAVITY;
    sonic.y += sonic.velocityY;                 // no ground to catch him
    sonic.deathTimer--;

    if (sonic.deathTimer <= 0 || sonic.y > LEVEL_BOTTOM + 200) {
        initializeGame();
    }
}

// Initialize game world
function initializeGame() {
    console.log('Initializing game...');
    
    // Rings ride the measured ground, so they hug whatever the art actually does
    // rather than hanging at hand-tuned coordinates.
    const ringSize = worldSize(1);
    rings = [];
    const addRing = (x, y, phase) => rings.push({
        x: x, y: y, size: ringSize, collected: false, animationFrame: phase
    });

    for (let x = 150; x < LEVEL_END_X - 60; x += 55) {
        const bob = Math.sin(x / 110) * 30;
        addRing(x, getGroundLevel(x + ringSize / 2) - ringSize - 45 - bob, (x / 55) % Math.PI);
    }

    // Arcs tempting a jump over the water pits, the jungle dip, the inside of
    // the loop and the climb into the block towers. Each painting carries its
    // own arcs, so they repeat wherever that painting appears.
    for (const segment of LEVEL_SEGMENTS) {
        for (const [from, to] of featuresFor(segment).ringArcs || []) {
            const start = segment.x + from;
            const span = to - from;
            for (let i = 0; i <= 6; i++) {
                const t = i / 6;
                const x = start + span * t;
                addRing(x, getGroundLevel(x + ringSize / 2) - ringSize - 60 - Math.sin(t * Math.PI) * 150, i * 0.4);
            }
        }
    }

    // Badniks patrol the ledges and pit floors; their y is re-read from the
    // heightmap every frame in update(), so they walk on the drawn ground too.
    const badnikSize = worldSize(1.5);
    badniks = [];
    const badnikSpots = [];
    let badnikIndex = 0;
    for (const segment of LEVEL_SEGMENTS) {
        for (const offset of featuresFor(segment).badniks || []) {
            badnikSpots.push({ x: segment.x + offset, type: (badnikIndex++ % 2) + 1 });
        }
    }

    badnikSpots.forEach(pos => {
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
    const signWidth = worldSize(2.5);
    const signHeight = worldSize(3.5);
    levelEndSign = {
        x: LEVEL_END_X,
        y: getGroundLevel(LEVEL_END_X + signWidth / 2) - signHeight,
        width: signWidth,
        height: signHeight,
        crossed: false
    };

    // Reset Sonic — back on foot, whatever the player was flying a moment ago
    setPlaneMode(false);
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
    sonic.launchTimer = 0;
    sonic.landTimer = 0;
    sonic.pose = 'idle';
    sonic.onLoop = null;
    sonic.loopBlocked = null;
    sonic.spriteAngle = 0;
    sonic.isDead = false;
    sonic.deathTimer = 0;
    lostRings = [];

    // Reset game state
    gameData.rings = 0;
    gameData.time = 0;
    gameData.gameStartTime = Date.now();

    startMusic();
    
    console.log('Game initialized with', rings.length, 'rings and', badniks.length, 'badniks!');
}

// Everything that applies only when Sonic is on foot: input, gravity, terrain,
// springs and spikes. Tornado mode replaces the whole lot with updatePlane().
function updateOnFoot() {
    // Riding a loop overrides everything else until the circle is finished.
    if (sonic.onLoop) {
        updateLoopRide();
        Object.keys(keysPressed).forEach(key => { keysPressed[key] = false; });
        return;
    }

    // Spin Dash. Charging works in mid-air too, so a dash can be wound up on the
    // way down from a jump. In the air Sonic keeps his momentum while charging —
    // only a charge on the ground plants him. The launch always waits until he
    // has landed, so releasing early just means he fires the moment he touches
    // down rather than throwing him sideways out of the sky.
    if (keys['ArrowDown'] && !sonic.isRolling) {
        sonic.isSpinDashing = true;
        startChargingSound();                   // no-ops if already running
        if (sonic.onGround) sonic.velocityX = 0;

        if (sonic.spinDashCharge < sonic.spinDashMaxCharge) {
            sonic.spinDashCharge += 2;
        }

        sonic.spinAnimationFrame += 0.5;
        sonic.animationFrame = 2;
    }
    else if (sonic.isSpinDashing && sonic.onGround) {
        stopChargingSound();

        // The charge still scales the launch; the whole range is just wound up
        // by SPIN_DASH_BOOST, because 8..23 did not cover enough ground to be
        // worth stopping for. Rolling friction is unchanged, so a full charge
        // now carries roughly 70% further as well as starting faster.
        const launchSpeed = ((sonic.spinDashCharge / sonic.spinDashMaxCharge) * 15 + 8) * SPIN_DASH_BOOST;
        sonic.velocityX = launchSpeed * sonic.direction;
        sonic.isSpinDashing = false;
        sonic.isRolling = true;
        sonic.spinDashCharge = 0;
        playSpinDashLaunchSound();
    }
    else if (sonic.isSpinDashing) {
        // Released while still falling: keep the charge but drop the whine. The
        // dash fires on the frame he touches down.
        stopChargingSound();
        sonic.spinAnimationFrame += 0.5;
    }
    else if (!sonic.isSpinDashing) {
        if (sonic.isRolling && Math.abs(sonic.velocityX) < 3) {
            sonic.isRolling = false;
        }
        
        // A spring launch owns Sonic's horizontal speed for a moment. Without
        // this, holding a direction key would overwrite the push on the very
        // next frame and the arc would collapse back to running pace.
        const steerable = !sonic.isRolling && sonic.launchTimer <= 0;

        if (keys['ArrowLeft'] || keys['KeyA']) {
            if (steerable) {
                sonic.velocityX = -sonic.speed;
                sonic.direction = -1;
            }
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            if (steerable) {
                sonic.velocityX = sonic.speed;
                sonic.direction = 1;
            }
        } else if (steerable) {
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
    const previousFeet = sonic.y + sonic.height;
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

    if (sonic.launchTimer > 0) sonic.launchTimer--;
    if (sonic.landTimer > 0) sonic.landTimer--;

    // Ground detection — one velocity-guarded snap onto the measured surface.
    // This is the only ground collision in the game; there are no separate
    // platforms that could sit somewhere the level art does not show.
    const wasOnGround = sonic.onGround;
    sonic.onGround = false;
    const groundLevel = getGroundLevel(sonic.x + sonic.width / 2);

    if (sonic.velocityY >= 0 && sonic.y + sonic.height >= groundLevel) {
        sonic.y = groundLevel - sonic.height;
        sonic.velocityY = 0;
        sonic.onGround = true;
        sonic.canDoubleJump = false;

        // Only the moment of touchdown starts the landing pose, not every frame
        // spent standing still on the ground.
        if (!wasOnGround) sonic.landTimer = LANDING_HOLD;
    }

    // One-way platforms: land on the top of the loop block if his feet crossed
    // it on the way down. Rising through it from below is free.
    if (sonic.velocityY >= 0) {
        for (const platform of PLATFORMS) {
            if (sonic.x + sonic.width <= platform.x || sonic.x >= platform.x + platform.width) continue;
            if (previousFeet > platform.y + 2) continue;
            if (sonic.y + sonic.height < platform.y) continue;

            sonic.y = platform.y - sonic.height;
            sonic.velocityY = 0;
            sonic.onGround = true;
            sonic.canDoubleJump = false;
            if (!wasOnGround) sonic.landTimer = LANDING_HOLD;
        }
    }

    tryEnterLoop();

    // Springs. Checked after the ground snap so landing on one overrides the
    // landing: come down on it and you go straight back up, harder than a jump.
    for (const spring of SPRINGS) {
        if (sonic.velocityY >= 0 && overlaps(sonic, spring)) {
            sonic.y = spring.y - sonic.height;
            sonic.velocityY = -spring.launch;
            sonic.onGround = false;
            sonic.canDoubleJump = false;
            sonic.isSpinDashing = false;
            sonic.spinDashCharge = 0;

            if (spring.push) {
                sonic.velocityX = spring.push;      // both springs throw Sonic to the right
                sonic.direction = 1;
                sonic.isRolling = false;
                sonic.launchTimer = 20;
            }

            playSpringSound();
        }
    }

    // Spikes. Unlike badniks these cannot be beaten by rolling into them.
    if (!sonic.isHurt) {
        for (const hazard of HAZARDS) {
            if (overlaps(sonic, hazard)) {
                hurtSonic(sonic.x + sonic.width / 2 < hazard.x + hazard.width / 2 ? -1 : 1);
                break;
            }
        }
    }

    // Reset if Sonic somehow ends up below the level
    if (sonic.y > LEVEL_BOTTOM + 100) {
        sonic.x = 80;
        sonic.y = getGroundLevel(sonic.x + sonic.width / 2) - sonic.height;
        sonic.velocityX = 0;
        sonic.velocityY = 0;
        sonic.isSpinDashing = false;
        sonic.isRolling = false;
        sonic.spinDashCharge = 0;
        sonic.launchTimer = 0;
    }
}

// Main game update loop
function update() {
    if (sonic.isDead) {
        updateDeath();
        Object.keys(keysPressed).forEach(key => { keysPressed[key] = false; });
    } else if (planeMode) {
        updatePlane();
        Object.keys(keysPressed).forEach(key => { keysPressed[key] = false; });
    } else {
        updateOnFoot();
    }

    updateLostRings();

    // Camera follows Sonic, clamped to what the paintings actually cover. The
    // chained level is only a little taller than the canvas, so the vertical
    // follow is a slight drift rather than real vertical scrolling.
    camera.x = Math.min(Math.max(sonic.x - canvas.width / 2, 0), Math.max(0, LEVEL_WIDTH - canvas.width));
    camera.y = Math.min(Math.max(sonic.y + sonic.height / 2 - canvas.height / 2, 0),
                        Math.max(0, LEVEL_BOTTOM - canvas.height));

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
    if (!sonic.isHurt && !sonic.isDead) {
        for (let badnik of badniks) {
            if (!badnik.destroyed) {
                if (sonic.x < badnik.x + badnik.width &&
                    sonic.x + sonic.width > badnik.x &&
                    sonic.y < badnik.y + badnik.height &&
                    sonic.y + sonic.height > badnik.y) {
                    
                    console.log('COLLISION!');

                    // The Tornado just flattens whatever it flies into.
                    const isJumpingOnTop = !planeMode && sonic.velocityY > 0 && sonic.y < badnik.y;
                    const isSpinDashing = sonic.isRolling || sonic.isSpinDashing;

                    if (planeMode || isJumpingOnTop || isSpinDashing) {
                        badnik.destroyed = true;
                        playBadnikDestroySound();
                        console.log('Badnik destroyed!');
                        
                        if (isJumpingOnTop) {
                            sonic.velocityY = -12;
                        }
                    } else {
                        hurtSonic(sonic.x < badnik.x ? -1 : 1);
                    }
                }
            }
        }
    }
    
    // Ring collection
    for (let ring of rings) {
        if (!ring.collected) {
            if (!sonic.isDead &&
                sonic.x < ring.x + ring.size &&
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
    
    // Check level end sign. Passing the post is what counts, at any height —
    // otherwise a springboard flight sails straight over the goal.
    if (levelEndSign && !levelEndSign.crossed && !sonic.isDead &&
        sonic.x + sonic.width / 2 > levelEndSign.x + levelEndSign.width / 2) {

        levelEndSign.crossed = true;
        playLevelCompleteSound();
        
        setTimeout(() => {
            initializeGame();
        }, 1500);
    }
    
    // Sonic animation (the plane has a single frame, so skip it while flying)
    if (planeMode) {
        // nothing to cycle
    } else if (sonic.isSpinDashing || sonic.isRolling) {
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

    if (!planeMode) sonic.pose = choosePose();

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

const SKY_COLOR = '#1810bb';       // sampled from the paintings
const UNDERGROUND_COLOR = '#7a3405';

// Traces the collision surface across every segment, for the G overlay.
function traceGroundPath() {
    ctx.beginPath();
    let started = false;
    for (const segment of LEVEL_SEGMENTS) {
        if (segment.x + segment.width < camera.x || segment.x > camera.x + canvas.width) continue;
        const map = segment.heightmap;
        for (let column = 0; column < map.length; column++) {
            const x = segment.x + column * segment.scale;
            const y = map[column] * segment.scale + segment.y;
            if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
        }
    }
    ctx.lineTo(LEVEL_WIDTH, getGroundLevel(LEVEL_WIDTH));
}

// The rail Sonic actually rides, drawn on the very circle the ride uses — so
// what you see is the track, not an illustration of it.
function drawLoopRails() {
    ctx.save();
    ctx.lineCap = 'round';

    for (const loop of LOOPS) {
        if (loop.cx + loop.radius < camera.x || loop.cx - loop.radius > camera.x + canvas.width) continue;

        ctx.strokeStyle = 'rgba(0, 60, 0, 0.55)';       // seat it against the art
        ctx.lineWidth = RAIL_THICKNESS + 6;
        ctx.beginPath();
        ctx.arc(loop.cx, loop.cy, loop.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = RAIL_COLOR;
        ctx.lineWidth = RAIL_THICKNESS;
        ctx.beginPath();
        ctx.arc(loop.cx, loop.cy, loop.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

// Stand-in terrain for a segment whose painting failed to load: the same
// heightmap, filled in as a solid silhouette so the level is still playable.
function drawSegmentSilhouette(segment) {
    const map = segment.heightmap;
    ctx.fillStyle = '#3d9b00';
    ctx.beginPath();
    ctx.moveTo(segment.x, map[0] * segment.scale + segment.y);
    for (let column = 1; column < map.length; column++) {
        ctx.lineTo(segment.x + column * segment.scale, map[column] * segment.scale + segment.y);
    }
    ctx.lineTo(segment.x + segment.width, LEVEL_BOTTOM);
    ctx.lineTo(segment.x, LEVEL_BOTTOM);
    ctx.closePath();
    ctx.fill();
}

function drawGroundLine() {
    ctx.save();
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 3;
    traceGroundPath();
    ctx.stroke();

    // Boxes for the things measured off the art, so their fit can be checked
    // against what is painted underneath them.
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FF2222';
    for (const hazard of HAZARDS) ctx.strokeRect(hazard.x, hazard.y, hazard.width, hazard.height);
    ctx.strokeStyle = '#22FF88';
    for (const spring of SPRINGS) ctx.strokeRect(spring.x, spring.y, spring.width, spring.height);
    ctx.restore();
}

// Only the spring we add needs drawing; the springboard is already painted into
// Level-With_Spikes-Springboard.png.
function drawSprings() {
    for (const spring of SPRINGS) {
        if (!spring.sprite) continue;
        const art = images[spring.sprite];
        if (art) {
            ctx.drawImage(art, spring.x, spring.y, spring.width, spring.height);
        } else {
            ctx.fillStyle = '#e02020';
            ctx.fillRect(spring.x, spring.y, spring.width, spring.height);
        }
    }
}

function renderGame() {
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Terrain. Each painting is drawn whole at its own placement and scale — the
    // very same scale getGroundLevel() applies to the heightmap read off it — so
    // the ground Sonic collides with is the ground on screen. Segments are not
    // all the same height, so each gets a skirt of dirt below it to cover the
    // gap rather than showing sky under the ground.
    for (const segment of LEVEL_SEGMENTS) {
        if (segment.x + segment.width < camera.x || segment.x > camera.x + canvas.width) continue;

        const bottom = segment.y + segment.height;
        if (bottom < LEVEL_BOTTOM) {
            ctx.fillStyle = UNDERGROUND_COLOR;
            ctx.fillRect(segment.x, bottom, segment.width, LEVEL_BOTTOM - bottom);
        }

        const art = images[segment.art];
        if (art) {
            // Level-3 is a high-resolution painting being scaled down, where
            // nearest-neighbour just throws pixels away; the other two are chunky
            // pixel art being scaled up, where smoothing would blur them.
            ctx.imageSmoothingEnabled = segment.scale < 1;
            ctx.drawImage(art, segment.x, segment.y, segment.width, segment.height);
        } else {
            drawSegmentSilhouette(segment);
        }
    }
    ctx.imageSmoothingEnabled = false;

    drawLoopRails();
    drawSprings();

    // Hold G to see the collision surface drawn over the art it was read from.
    if (keys['KeyG']) {
        drawGroundLine();
    }

    // Draw rings. The level carries a few hundred of them now, so skip the ones
    // off the sides of the view rather than transforming every single one.
    if (images.ring) {
        const viewLeft = camera.x - 80;
        const viewRight = camera.x + canvas.width + 80;
        for (let ring of rings) {
            if (ring.x < viewLeft || ring.x > viewRight) continue;
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

    // Draw the rings knocked loose by a hit, blinking as they run out of time
    if (images.ring) {
        for (const ring of lostRings) {
            if (ring.life < LOST_RING_BLINK && Math.floor(ring.life / 4) % 2 === 0) continue;

            const half = ring.size / 2;
            ctx.save();
            ctx.translate(ring.x + half, ring.y + half);
            ctx.rotate(ring.animationFrame);
            ctx.drawImage(images.ring, -half, -half, ring.size, ring.size);
            ctx.restore();
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
    
    // Draw the player — the Tornado in plane mode, Sonic otherwise
    if (planeMode) {
        drawPlane();
    } else {
        drawSonic();
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

function drawSonic() {
    const sprite = images[POSE_SPRITES[sonic.pose] || 'sonicIdle'] || images.sonicIdle;
    if (!sprite) return;

    // The poses are drawn at wildly different aspects (0.63 for the launch,
    // 1.42 for the sprawl), so match the hitbox height and let the width follow
    // the art. Squeezing them all into a square box distorts every one of them.
    const drawHeight = sonic.height * (POSE_SCALE[sonic.pose] || 1);
    const drawWidth = sprite.naturalHeight
        ? drawHeight * (sprite.naturalWidth / sprite.naturalHeight)
        : sonic.width;

    ctx.save();
    ctx.translate(sonic.x + sonic.width / 2, sonic.y + sonic.height / 2);

    if (sonic.isHurt) {
        const flashRate = Math.floor(sonic.hurtTimer / 8) % 2;
        if (flashRate === 0) {
            ctx.globalAlpha = 0.5;
        }
    }

    // Rotation has to come before the mirror. The other way round, a leftward
    // loop ride would turn the wrong way, because mirroring reverses the sense
    // of the angle as well as the sprite.
    if (sonic.onLoop) {
        ctx.rotate(sonic.spriteAngle);          // turn with the track
    } else if (sonic.pose === 'spin') {
        ctx.rotate(sonic.spinAnimationFrame);
    }

    if (sonic.direction === -1) {
        ctx.scale(-1, 1);
    }

    ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
}

// The Tornado art faces left, so flying left needs no mirror and flying right
// does. The nose tips with the climb, and the tilt flips with the heading so the
// plane leans into the dive whichever way it is pointed.
function drawPlane() {
    const art = images.plane;
    ctx.save();
    ctx.translate(sonic.x + sonic.width / 2, sonic.y + sonic.height / 2);
    ctx.rotate((sonic.velocityY / PLANE_CLIMB) * 0.18 * sonic.direction);
    if (sonic.direction === 1) ctx.scale(-1, 1);

    if (art) {
        ctx.drawImage(art, -sonic.width / 2, -sonic.height / 2, sonic.width, sonic.height);
    } else {
        ctx.fillStyle = '#d02020';
        ctx.fillRect(-sonic.width / 2, -sonic.height / 2, sonic.width, sonic.height);
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

// Delay before the Sega jingle fires on its own, with no click needed.
const SEGA_DELAY = 2000;

// Start the game
window.addEventListener('load', () => {
    console.log('🎮 Page loaded - Sega jingle queued for 2s');

    const segaJingle = new Audio('assets/sega.mp3');
    segaJingle.volume = 0.8;
    segaJingle.preload = 'auto';

    const playSega = () => {
        segaJingle.currentTime = 0;
        const playPromise = segaJingle.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('🔊 Sega jingle playing on its own');
                    window.immediateAudio = null;
                })
                .catch(() => {
                    // Browsers refuse autoplay until the page has been
                    // interacted with, so keep it armed for the first key or
                    // click instead of dropping it.
                    console.log('🔊 Autoplay blocked - will fire on first key or click');
                    window.immediateAudio = segaJingle;
                });
        }
    };

    setTimeout(playSega, SEGA_DELAY);

    loadAssets();
    gameLoop();
});

window.addEventListener('blur', () => {
    // Game continues running
});

window.addEventListener('focus', () => {
    // Resume game if paused
});