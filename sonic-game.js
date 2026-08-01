// Sonic the Hedgehog Game - Complete JavaScript File
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Asset loading system
const images = {};
let assetsLoaded = 0;
const totalAssets = 15;

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
    level1: 'FullAssets/Levels-Flattened-Layer/Level-.png',
    level2: 'FullAssets/Levels-Flattened-Layer/Level-2.png',
    level3: 'FullAssets/Levels-Flattened-Layer/Level-3.png',
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
let badniks = [];
let levelEndSign = null;

// GROUND HEIGHTMAPS
// Ground height read directly from the level art, one measured value per
// pixel column — no formulas, no synthetic curves. Extracted offline from
// FullAssets/Levels-Flattened-Layer/*.png by scanning each column bottom-up
// for the top of the grass/dirt mass connected to the ground, then a light
// median filter to drop single-column noise (anti-aliasing, thin decorative
// sprites like tree trunks) while preserving genuine terrain features.
// This same array drives both collision (getGroundLevel) and rendering
// (the level image is drawn as-is), so art and collision cannot disagree.
const HEIGHTMAP_LEVEL1 = [198,198,198,198,198,198,198,198,198,198,198,198,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,196,196,196,196,196,196,196,195,195,195,195,195,195,195,195,195,194,194,194,194,194,194,194,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,194,194,194,194,194,194,194,194,195,195,195,195,195,195,195,195,195,196,196,196,196,196,196,196,196,196,196,196,196,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,196,196,196,196,196,196,196,196,196,196,196,196,196,195,195,195,195,195,195,195,195,194,194,194,194,194,194,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,194,194,194,194,194,194,194,194,194,194,194,194,195,195,195,195,195,195,195,195,195,195,196,196,196,196,196,196,196,196,196,197,197,197,197,197,197,197,197,197,197,197,197,197,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,196,196,196,196,196,196,196,195,195,195,195,195,195,195,195,195,194,194,194,194,194,194,194,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,193,193,193,193,193,193,193,193,193,193,193,193,193,193,193,194,194,194,194,194,194,194,194,195,195,195,195,195,195,195,195,195,196,196,196,196,196,196,196,196,196,196,196,196,196,197,197,197,197,197,197,197,197,197,197,197,197,197,197,197,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198,198];
const HEIGHTMAP_LEVEL2 = [181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,181,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,181,181,181,181,181,181,181,181,181,181,181,183,183,183,183,183,183,183,183,183,188,188,188,188,188,189,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,191,191,191,189,189,189,189,189,189,189,184,183,183,183,183,183,183,183,183,183,183,181,181,181,181,181,181,181,181,181,181,181,180,180,180,180,180,180,180,180,180,180,180,181,181,181,181,181,181,181,181,183,183,183,183,183,183,183,183,183,183,183,183,183,183,183,183,183,184,188,188,188,188,189,192,192,192,194,195,195,195,195,195,195,195,195,195,195,195,195,195,194,194,194,194,194,194,194,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,194,194,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,194,192,192,192,191,191,191,189,189,189,189,183,183,183,183,181,181,181,181,181,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,180,181,181,181,181,183,183,183,183,183,183,183,183,183,183,183,183,183,183,183,184,184,184,184,184,184,188,188,188,188,188,188,188,188,189,189,189,189,194,189,194,194];
const HEIGHTMAP_LEVEL3 = [1203,1204,1204,1205,1205,1205,1205,1205,1205,1207,1207,1207,1207,1210,1210,1210,1210,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1211,1211,1211,1211,1211,1216,1217,1218,1219,1223,1223,1224,1224,1224,1224,1224,1224,1224,1224,1224,1223,1223,1223,1219,1218,1217,1217,1217,1216,1210,1209,1207,1206,1206,1206,1205,1205,1205,1202,1202,1202,1202,1202,1205,1206,1207,1207,1208,1209,1210,1210,1211,1211,1211,1211,1211,1211,1212,1212,1212,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1217,1228,1231,1237,1237,1237,1237,1238,1238,1239,1239,1239,1240,1240,1241,1241,1246,1248,1248,1248,1248,1248,1248,1249,1251,1252,1252,1256,1257,1257,1269,1269,1269,1269,1269,1269,1269,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1270,1269,1268,1268,1268,1268,1268,1268,1262,1262,1262,1261,1261,1261,1261,1260,1260,1259,1259,1259,1259,1259,1259,1258,1258,1258,1258,1256,1256,1256,1255,1255,1254,1253,1253,1252,1246,1244,1243,1241,1234,1234,1234,1234,1233,1233,1233,1216,1216,1216,1215,1214,1214,1212,1211,1211,1211,1211,1211,1211,1211,1211,1210,1210,1210,1209,1209,1208,1208,1208,1208,1208,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1208,1209,1210,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1212,1212,1212,1212,1212,1212,1212,1212,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1212,1212,1212,1212,1212,1212,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1210,1209,1208,1208,1208,1208,1208,1208,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1207,1208,1208,1208,1208,1208,1208,1208,1208,1208,1208,1208,1211,1211,1212,1212,1213,1213,1214,1216,1217,1219,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1216,1216,1216,1214,1214,1209,1206,1206,1206,1206,1205,1204,1203,1203,1203,1203,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1203,1203,1203,1203,1204,1204,1206,1208,1209,1210,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1211,1211,1211,1210,1210,1210,1210,1210,1210,1210,1210,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1209,1210,1210,1210,1210,1210,1210,1211,1212,1212,1212,1220,1222,1222,1226,1226,1226,1226,1238,1238,1240,1242,1243,1244,1245,1246,1247,1255,1255,1255,1256,1256,1256,1256,1256,1256,1256,1257,1259,1260,1260,1260,1260,1260,1260,1260,1261,1261,1261,1262,1262,1263,1265,1265,1266,1266,1266,1266,1266,1266,1266,1266,1266,1267,1267,1268,1268,1268,1268,1268,1268,1268,1268,1268,1268,1267,1267,1267,1267,1267,1267,1267,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1266,1264,1262,1262,1261,1261,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1260,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1259,1258,1258,1258,1258,1258,1257,1255,1255,1254,1254,1254,1254,1254,1254,1254,1252,1251,1251,1248,1248,1247,1247,1245,1244,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1235,1234,1232,1230,1229,1228,1227,1225,1224,1224,1224,1224,1224,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1223,1222,1222,1221,1221,1220,1220,1220,1215,1215,1215,1215,1214,1214,1213,1213,1205,1202,1202,1201,1200,1200,1200,1200,1200,1200,1200,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1200,1200,1200,1200,1200,1200,1200,1200,1201,1201,1202,1202,1205,1206,1206,1206,1206,1206,1206,1206,1206,1206,1211,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1213,1213,1213,1213,1213,1213,1212,1206,1206,1206,1205,1205,1200,1200,1199,1199,1199,1199,1199,1199,1199,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1199,1199,1199,1199,1199,1199,1199,1200,1200,1221,1226,1227,1228,1228,1231,1231,1231,1231,1231,1231,1231,1231,1230,1228,1228,1228,1212,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1205,1207,1208,1209,1209,1210,1212,1214,1214,1214,1214,1213,1212,1212,1211,1211,1210,1209,1209,1208,1208,1207,1205,1204,1204,1204,1204,1204,1204,1204,1204,1203,1203,1203,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1203,1203,1204,1204,1204,1204,1204,1205,1207,1208,1208,1209,1209,1210,1211,1211,1211,1211,1211,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1212,1211,1211,1211,1211,1211,1211,1211,1210,1210,1209,1206,1205,1205,1201,1201,1201,1201,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1200,1200,1200,1200,1200,1200,1200,1200,1201,1201,1201,1201,1204,1205,1205,1206,1207,1209,1209,1209,1209,1209,1207,1207,1207,1206,1206,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1206,1206,1206,1206,1206,1206,1206,1206,1206,1205,1205,1205,1204,1204,1204,1203,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1199,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1200,1203,1203,1203,1203,1204,1204,1204,1204,1204,1204,1204,1204,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1211,1212,1212,1212,1212,1211,1211,1211,1211,1211,1211,1211,1211,1211,1210,1210,1210,1209,1209,1208,1207,1207,1206,1206,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1205,1206,1206,1207,1207,1208,1209,1209,1210,1210,1210,1210,1212,1213,1214,1214,1214,1214,1214,1216,1216,1216,1216,1216,1216,1216,1217,1218,1218,1218,1219,1232,1233,1243,1244,1244,1244,1245,1245,1246,1250,1252,1252,1253,1257,1257,1257,1260,1261,1261,1261,1261,1262,1262,1262,1262,1263,1264,1265,1265,1266,1266,1266,1266,1266,1267,1269,1269,1269,1269,1269,1270,1270,1270,1271,1271,1271,1271,1271,1271,1271,1270,1270,1270,1269,1269,1269,1269,1268,1268,1267,1266,1266,1267,1268,1268,1269,1269,1269,1269,1270,1271,1271,1271,1272,1272,1272,1272,1272,1272,1272,1272,1272,1272,1272,1272,1272,1272,1272,1271,1271,1270,1270,1270,1270,1270,1270,1269,1269,1268,1268,1268,1268,1268,1267,1266,1266,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1264,1263,1263,1262,1262,1262,1262,1262,1262,1262,1261,1261,1261,1261,1260,1260,1259,1258,1257,1257,1255,1250,1250,1249,1249,1242,1240,1235,1234,1234,1225,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1223,1223,1222,1222,1222,1222,1216,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1204,1205,1205,1205,1204,1204,1204,1204,1204,1203,1203,1203,1203,1203,1201,1201,1201,1201,1201,1201,1201,1201,1201,1201,1201,1199,1199,1199,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1198,1199,1200,1200,1200,1200,1200,1200,1201,1201,1201,1201,1201,1201,1201,1201,1201,1202,1203,1203,1203,1204,1204,1204,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1210,1211,1211,1211,1211,1223,1223,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1224,1236,1237,1238,1245,1248,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1262,1259,1259,1259,1259,1259,1258,1258,1258,1258,1258,1256,1256,1256,1255,1255,1255,1255,1255,1252,1250,1248,1247,1245,1244,1219,1219,1218,1218,1218,1217,1215,1215,1214,1212,1212,1211,1211,1210,1209,1208,1206,1205,1204,1204,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1202,1203,1204,1204,1205,1206,1211,1212,1212,1212,1212,1212,1212,1212,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1213,1214,1214,1214,1214,1216,1216,1223,1223,1225,1225,1230,1230,1230,1230,1230,1230,1230,1230,1230,1230,1230,1230,1230,1230];

const LEVELS = [
    { imageKey: 'level1', width: 512, height: 257, heightmap: HEIGHTMAP_LEVEL1 },
    { imageKey: 'level2', width: 419, height: 350, heightmap: HEIGHTMAP_LEVEL2 },
    { imageKey: 'level3', width: 1808, height: 1288, heightmap: HEIGHTMAP_LEVEL3 }
];
let currentLevelIndex = 0;

function getCurrentLevel() {
    return LEVELS[currentLevelIndex];
}

// Real-pixel-data lookup — one measured height per column, direct index, no interpolation.
function getGroundLevel(level, x) {
    const xi = Math.max(0, Math.min(Math.round(x), level.heightmap.length - 1));
    return level.heightmap[xi];
}

// Max height Sonic can walk up without jumping. A rise in the art bigger
// than this is a real wall — movement into it is blocked rather than
// auto-snapped, so climbing it requires an actual jump. Set above the
// small natural undulation left in the measured ground (grass/bush texture,
// a couple dozen pixels at most) so normal walking stays smooth and only
// genuine architectural rises/cliffs register as walls.
const STEP_THRESHOLD = 28;

// Initialize game world
function initializeGame() {
    const level = getCurrentLevel();
    console.log(`Initializing game on level ${currentLevelIndex + 1} (${level.width}x${level.height})...`);

    // Rings — spaced across the level, floating a bit above the real ground at each x
    rings = [];
    const ringSpacing = 70;
    const ringMargin = 80;
    for (let x = ringMargin; x < level.width - ringMargin; x += ringSpacing) {
        const jitterX = x + (Math.random() * 20 - 10);
        const groundY = getGroundLevel(level, jitterX);
        rings.push({
            x: jitterX,
            y: groundY - 40 - Math.random() * 40,
            collected: false,
            animationFrame: Math.random() * Math.PI
        });
    }

    // Badniks — patrol on the real ground, spaced across the level
    badniks = [];
    const badnikSpacing = Math.max(220, Math.floor(level.width / 6));
    let typeToggle = 1;
    for (let x = 200; x < level.width - 150; x += badnikSpacing) {
        const groundY = getGroundLevel(level, x);
        badniks.push({
            x,
            y: groundY - 32,
            width: 32,
            height: 32,
            type: typeToggle,
            velocityX: typeToggle === 1 ? 1.5 : -1.5,
            direction: typeToggle === 1 ? 1 : -1,
            destroyed: false,
            animationFrame: 0,
            animationSpeed: 0.15,
            frameCount: 2,
            patrolDistance: 80,
            startX: x
        });
        typeToggle = typeToggle === 1 ? 2 : 1;
    }

    // Level end sign near the right edge, resting on the real ground
    const signX = level.width - 120;
    levelEndSign = {
        x: signX,
        y: getGroundLevel(level, signX + 40) - 96,
        width: 80,
        height: 96,
        crossed: false
    };

    // Reset Sonic at the left edge, standing on the real ground
    const spawnX = Math.min(60, level.width - sonic.width - 10);
    sonic.x = spawnX;
    sonic.y = getGroundLevel(level, spawnX + sonic.width / 2) - sonic.height;
    sonic.velocityX = 0;
    sonic.velocityY = 0;
    sonic.isSpinDashing = false;
    sonic.isRolling = false;
    sonic.spinDashCharge = 0;
    sonic.canDoubleJump = false;
    sonic.lastJumpTime = 0;
    sonic.isHurt = false;
    sonic.hurtTimer = 0;

    camera.x = 0;
    camera.y = 0;

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

    const level = getCurrentLevel();

    // Horizontal wall collision — a rise in the terrain itself (not just
    // Sonic's current height, which swings wildly over a normal jump arc)
    // bigger than a walkable step is a real wall: block movement into it
    // instead of auto-snapping up. Comparing the ground at his current
    // column to the ground ahead means this only engages near an actual
    // cliff/step in the art, never mid-jump over ordinary ground. Once his
    // feet have risen above the far column's height, he's cleared it and
    // may pass over.
    if (sonic.velocityX !== 0) {
        const dir = sonic.velocityX > 0 ? 1 : -1;
        const leadingX = dir > 0
            ? sonic.x + sonic.width + sonic.velocityX
            : sonic.x + sonic.velocityX;
        const groundHere = getGroundLevel(level, sonic.x + sonic.width / 2);
        const groundAhead = getGroundLevel(level, leadingX);
        const feetY = sonic.y + sonic.height;
        if (groundHere - groundAhead > STEP_THRESHOLD && feetY > groundAhead) {
            sonic.velocityX = 0;
        }
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

    // Ground detection — single velocity-guarded snap against the real heightmap
    sonic.onGround = false;
    const sonicCenterX = sonic.x + sonic.width / 2;
    const groundLevel = getGroundLevel(level, sonicCenterX);

    if (sonic.velocityY >= 0 && sonic.y + sonic.height >= groundLevel) {
        sonic.y = groundLevel - sonic.height;
        sonic.velocityY = 0;
        sonic.onGround = true;
        sonic.canDoubleJump = false;
    }

    // Keep Sonic within the level's horizontal bounds
    if (sonic.x < 0) {
        sonic.x = 0;
        sonic.velocityX = 0;
        sonic.isRolling = false;
    }
    if (sonic.x + sonic.width > level.width) {
        sonic.x = level.width - sonic.width;
        sonic.velocityX = 0;
    }

    // Reset if Sonic falls off the bottom of the level (a real pit/gap in the art)
    if (sonic.y > level.height + 100) {
        const spawnX = Math.min(60, level.width - sonic.width - 10);
        sonic.x = spawnX;
        sonic.y = getGroundLevel(level, spawnX + sonic.width / 2) - sonic.height;
        sonic.velocityX = 0;
        sonic.velocityY = 0;
        sonic.isSpinDashing = false;
        sonic.isRolling = false;
        sonic.spinDashCharge = 0;
    }

    // Camera follows Sonic, clamped to the level's actual bounds (both axes)
    camera.x = sonic.x + sonic.width / 2 - canvas.width / 2;
    camera.x = Math.max(0, Math.min(camera.x, Math.max(0, level.width - canvas.width)));
    camera.y = sonic.y + sonic.height / 2 - canvas.height / 2;
    camera.y = Math.max(0, Math.min(camera.y, Math.max(0, level.height - canvas.height)));
    
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
            currentLevelIndex = (currentLevelIndex + 1) % LEVELS.length;
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
    
    // Draw level art — the same image the heightmap was measured from, at
    // native resolution, so what's drawn and what Sonic collides with are
    // always the same data.
    const level = getCurrentLevel();
    const levelImage = images[level.imageKey];
    if (levelImage) {
        ctx.drawImage(levelImage, 0, 0, level.width, level.height);
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