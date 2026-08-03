// ===========================================================================
// SEASIDE HILL 26 — the isometric level
//
// Level 1 is a side-scroller whose ground is a heightmap: one y for every x.
// This level is the same idea with one more dimension. Instead of getGroundLevel(x)
// there is levelAt(x, y), a grid of pad heights over open water, drawn in a 2:1
// isometric projection. Everything else carries over — running, jumping, the
// spin dash, rings scattering when you are hit, dying with none left, and
// vaulting off a wall instead of dead-stopping against it.
//
// None of the terrain here is painted art. The map is stamped out of circles
// along a hand-laid spine, so the whole level is geometry.
// ===========================================================================
const Seaside = {
    // --- projection -------------------------------------------------------
    TILE_W: 64,                 // width of one tile diamond
    TILE_H: 32,                 // height of one tile diamond (2:1 isometric)
    LIFT: 26,                   // pixels of elevation per height level
    COLS: 54,                   // enough open sea around the spine for the islands
    ROWS: 54,

    // --- physics ----------------------------------------------------------
    SPEED: 0.14,                // tiles per frame
    GRAVITY: 0.6,
    JUMP: 8,                    // clears about two height levels
    STEP: 10,                   // how far above your feet a lip can be and still be walked onto
    WATER_FALL: -220,           // fall this far below the pads and you are in the drink
    SPRING_LAUNCH: 14,

    SONIC_H: 84,
    SHADOW_W: 42,

    TITLE_TEXT: 'SEASIDE HILL 26',
    TITLE_DURATION: 5 * 60,
    TITLE_FADE: 45,

    // --- palette ----------------------------------------------------------
    WATER: '#1273c4',
    WATER_LIGHT: '#3ea0e8',
    GRASS: ['#46c246', '#37a437'],
    GRASS_EDGE: '#2a7f2a',
    CLIFF: ['#e0a659', '#c0813c'],
    CLIFF_DARK: '#8d5a26',

    // The spine of the level: a run of pads that winds out and back. Each entry
    // is a centre, a radius in tiles, and a height level.
    SPINE: [
        { x: 7,  y: 9,  r: 4.2, z: 0 },
        { x: 15, y: 6,  r: 3.6, z: 1 },
        { x: 23, y: 9,  r: 3.4, z: 1 },
        { x: 29, y: 16, r: 3.8, z: 2 },
        { x: 24, y: 24, r: 3.4, z: 2 },
        { x: 15, y: 27, r: 3.8, z: 3 },
        { x: 18, y: 34, r: 3.4, z: 3 },
        { x: 27, y: 38, r: 4.0, z: 2 },
        { x: 35, y: 33, r: 3.6, z: 1 },
        { x: 39, y: 23, r: 4.6, z: 0 }
    ],

    // Islands off the path, worth a detour for the ring circles on them. Rather
    // than guessing coordinates — the stamped pads are not the neat discs the
    // spine describes — each one is pushed out from its anchor pad until the
    // water gap is right. A running jump crosses 3.7 tiles, so ISLAND_GAP is set
    // just inside that. The last island is deliberately out of reach: too high
    // to jump, so it needs the spring that gets placed at its anchor.
    ISLAND_GAP: 2.4,
    ISLANDS: [
        { anchor: 0, dir: [0, 1],  r: 2.2, dz: 1 },
        { anchor: 3, dir: [1, -1], r: 2.2, dz: 1 },
        { anchor: 6, dir: [0, 1],  r: 2.2, dz: -1 },
        { anchor: 5, dir: [-1, 0], r: 2.4, dz: 3, spring: true }
    ],

    placedIslands: [],

    cells: null,
    rings: [],
    monitors: [],
    springs: [],
    goal: null,
    sonic: null,
    camera: { x: 0, y: 0 },
    titleTimer: 0,
    completeTimer: 0,
    music: null,

    // ----------------------------------------------------------------------
    // Map
    // ----------------------------------------------------------------------
    inBounds(tx, ty) {
        return tx >= 0 && ty >= 0 && tx < this.COLS && ty < this.ROWS;
    },

    // Height level of the pad at a tile, or null where there is only water.
    levelAt(tx, ty) {
        const x = Math.floor(tx), y = Math.floor(ty);
        if (!this.inBounds(x, y)) return null;
        return this.cells[y][x];
    },

    groundZ(tx, ty) {
        const level = this.levelAt(tx, ty);
        return level === null ? null : level * this.LIFT;
    },

    stampDisc(cx, cy, radius, level) {
        const r2 = radius * radius;
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
            for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
                if (!this.inBounds(x, y)) continue;
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                if (dx * dx + dy * dy <= r2) this.cells[y][x] = level;
            }
        }
    },

    buildMap() {
        this.cells = [];
        for (let y = 0; y < this.ROWS; y++) this.cells.push(new Array(this.COLS).fill(null));

        // Walk the spine, stamping overlapping discs so consecutive pads merge
        // into one continuous run. The height steps at the midpoint between
        // waypoints, which leaves a clean lip to hop rather than a ramp.
        for (let i = 0; i < this.SPINE.length - 1; i++) {
            const a = this.SPINE[i], b = this.SPINE[i + 1];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);

            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                this.stampDisc(
                    a.x + (b.x - a.x) * t,
                    a.y + (b.y - a.y) * t,
                    a.r + (b.r - a.r) * t - 1.4,        // the link is narrower than the pads
                    t < 0.5 ? a.z : b.z
                );
            }
            this.stampDisc(a.x, a.y, a.r, a.z);
        }
        const last = this.SPINE[this.SPINE.length - 1];
        this.stampDisc(last.x, last.y, last.r, last.z);

        this.placedIslands = [];
        for (const spec of this.ISLANDS) {
            const island = this.placeIsland(spec);
            if (!island) continue;
            this.stampDisc(island.x, island.y, island.r, island.z);
            this.placedIslands.push(island);
        }
    },

    // Shortest distance from the edge of a disc to any land already stamped.
    gapToLand(cx, cy, radius) {
        let best = Infinity;
        const reach = radius + 8;
        for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
            for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
                if (!this.inBounds(x, y) || this.cells[y][x] === null) continue;
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius;
                if (d < best) best = d;
            }
        }
        return best;
    },

    // Slide the island outward from its anchor pad until the water gap is right.
    placeIsland(spec) {
        const anchor = this.SPINE[spec.anchor];
        const len = Math.hypot(spec.dir[0], spec.dir[1]);
        const ux = spec.dir[0] / len, uy = spec.dir[1] / len;

        for (let d = 1; d < 18; d += 0.1) {
            const cx = anchor.x + ux * d;
            const cy = anchor.y + uy * d;
            if (cx - spec.r < 1 || cy - spec.r < 1 ||
                cx + spec.r > this.COLS - 1 || cy + spec.r > this.ROWS - 1) break;

            if (this.gapToLand(cx, cy, spec.r) >= this.ISLAND_GAP) {
                return {
                    x: cx, y: cy, r: spec.r,
                    z: Math.max(0, anchor.z + spec.dz),
                    anchor: anchor,
                    spring: spec.spring,
                    dir: { x: ux, y: uy }
                };
            }
        }
        return null;
    },

    // ----------------------------------------------------------------------
    // Projection
    // ----------------------------------------------------------------------
    screenX(tx, ty) { return (tx - ty) * (this.TILE_W / 2); },
    screenY(tx, ty, z) { return (tx + ty) * (this.TILE_H / 2) - z; },

    // ----------------------------------------------------------------------
    // Setup
    // ----------------------------------------------------------------------
    init() {
        this.buildMap();

        const start = this.SPINE[0];
        this.sonic = {
            tx: start.x, ty: start.y, z: start.z * this.LIFT,
            vx: 0, vy: 0, vz: 0,
            facing: 1,
            onGround: true,
            radius: 0.42,
            pose: 'idle',
            frame: 0,
            frameTimer: 0,
            charging: false,
            charge: 0,
            rolling: false,
            rollTimer: 0,
            hurtTimer: 0,
            dead: false,
            deadTimer: 0,
            safeX: start.x, safeY: start.y, safeZ: start.z * this.LIFT
        };

        this.rings = [];
        this.monitors = [];
        this.springs = [];
        this.completeTimer = 0;
        this.titleTimer = this.TITLE_DURATION;

        // Rings trail the spine, so the path reads as a route to follow.
        for (let i = 0; i < this.SPINE.length - 1; i++) {
            const a = this.SPINE[i], b = this.SPINE[i + 1];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.9);
            for (let s = 1; s < steps; s++) {
                const t = s / steps;
                const tx = a.x + (b.x - a.x) * t;
                const ty = a.y + (b.y - a.y) * t;
                if (this.levelAt(tx, ty) === null) continue;
                this.rings.push({ tx: tx, ty: ty, z: this.groundZ(tx, ty) + 22, spin: s * 0.5, taken: false });
            }
        }

        // A ring of rings on each outlying island — the reward for going there.
        for (const island of this.placedIslands) {
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 * i) / 8;
                const tx = island.x + Math.cos(a) * (island.r - 1.1);
                const ty = island.y + Math.sin(a) * (island.r - 1.1);
                if (this.levelAt(tx, ty) === null) continue;
                this.rings.push({ tx: tx, ty: ty, z: this.groundZ(tx, ty) + 22, spin: i * 0.4, taken: false });
            }
        }

        // Monitors sit on the pads themselves, nudged off centre.
        for (const spot of [this.SPINE[2], this.SPINE[4], this.SPINE[6], this.SPINE[8]]) {
            const tx = spot.x + 1.2, ty = spot.y - 1.2;
            const z = this.groundZ(tx, ty);
            if (z === null) continue;
            this.monitors.push({ tx: tx, ty: ty, z: z, broken: false, pop: 0 });
        }

        // A spring goes on the anchor pad of any island too high to jump onto,
        // set back just inside its edge and pointing at the island.
        for (const island of this.placedIslands) {
            if (!island.spring) continue;
            for (let d = island.anchor.r; d > 0.5; d -= 0.2) {
                const tx = island.anchor.x + island.dir.x * d;
                const ty = island.anchor.y + island.dir.y * d;
                const z = this.groundZ(tx, ty);
                if (z !== null) { this.springs.push({ tx: tx, ty: ty, z: z, squash: 0 }); break; }
            }
        }

        const end = this.SPINE[this.SPINE.length - 1];
        this.goal = { tx: end.x, ty: end.y, z: end.z * this.LIFT, taken: false };

        if (!this.music) {
            this.music = new Audio('FullAssets/sonic2.MP3');
            this.music.loop = true;
            this.music.volume = 0.35;
        }
        this.music.currentTime = 0;
        this.music.play().catch(() => { /* blocked until the next key press */ });

        this.centreCamera();
    },

    stopMusic() { if (this.music) this.music.pause(); },

    centreCamera() {
        const s = this.sonic;
        this.camera.x = this.screenX(s.tx, s.ty) - canvas.width / 2;
        this.camera.y = this.screenY(s.tx, s.ty, s.z) - canvas.height / 2;
    },

    // ----------------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------------
    update() {
        const s = this.sonic;
        if (this.titleTimer > 0) this.titleTimer--;

        if (this.completeTimer > 0) {
            this.completeTimer--;
            if (this.completeTimer === 0) {
                this.stopMusic();
                currentGameState = 'intro';
                introStartTime = Date.now();
            }
            return;
        }

        if (s.dead) {
            s.vz -= this.GRAVITY;
            s.z += s.vz;
            s.deadTimer--;
            if (s.deadTimer <= 0) this.init();
            return;
        }

        if (s.hurtTimer > 0) s.hurtTimer--;

        gameData.time = Math.floor((Date.now() - gameData.gameStartTime) / 1000);

        this.readInput();
        this.moveSonic();
        this.collect();

        this.camera.x += (this.screenX(s.tx, s.ty) - canvas.width / 2 - this.camera.x) * 0.12;
        this.camera.y += (this.screenY(s.tx, s.ty, s.z) - canvas.height / 2 - this.camera.y) * 0.12;
    },

    readInput() {
        const s = this.sonic;

        // Spin dash: hold down on the ground, release to fire along your facing.
        if (keys['ArrowDown'] && s.onGround && !s.rolling) {
            s.charging = true;
            s.charge = Math.min(s.charge + 2, 100);
            s.vx = 0; s.vy = 0;
            return;
        }
        if (s.charging) {
            s.charging = false;
            s.rolling = true;
            s.rollTimer = 45;
            const power = this.SPEED * (2.2 + (s.charge / 100) * 2.6);
            const dir = s.lastDir || { x: 1, y: 0 };
            s.vx = dir.x * power;
            s.vy = dir.y * power;
            s.charge = 0;
            playSpinDashLaunchSound();
            return;
        }

        if (s.rolling) {
            s.rollTimer--;
            s.vx *= 0.97; s.vy *= 0.97;
            if (s.rollTimer <= 0) s.rolling = false;
        } else {
            // Eight-way running. Screen up moves you away from the camera, which
            // in this projection is diagonally back along both axes at once.
            let ix = 0, iy = 0;
            if (keys['ArrowUp'] || keys['KeyW']) { ix -= 1; iy -= 1; }
            if (keys['ArrowDown'] || keys['KeyS']) { ix += 1; iy += 1; }
            if (keys['ArrowLeft'] || keys['KeyA']) { ix -= 1; iy += 1; }
            if (keys['ArrowRight'] || keys['KeyD']) { ix += 1; iy -= 1; }

            const len = Math.hypot(ix, iy);
            if (len > 0) {
                s.vx = (ix / len) * this.SPEED;
                s.vy = (iy / len) * this.SPEED;
                s.lastDir = { x: ix / len, y: iy / len };
                if (ix - iy !== 0) s.facing = ix - iy > 0 ? 1 : -1;
            } else {
                s.vx *= 0.7; s.vy *= 0.7;
            }
        }

        const jump = ['Space', 'KeyZ'].some(k => keysPressed[k]);
        if (jump && s.onGround) {
            s.vz = this.JUMP;
            s.onGround = false;
            playJumpSound();
        }
    },

    // Can Sonic stand at this spot given how high he currently is?
    canStand(tx, ty, z) {
        const ground = this.groundZ(tx, ty);
        if (ground === null) return true;           // open water: you run off and fall
        return z >= ground - this.STEP;
    },

    moveSonic() {
        const s = this.sonic;

        // Axes are resolved separately so sliding along a wall still works.
        if (!this.tryMove(s, s.vx, 0)) {
            if (s.onGround && Math.abs(s.vx) > 0.02) this.vault();
            s.vx = 0;
        }
        if (!this.tryMove(s, 0, s.vy)) {
            if (s.onGround && Math.abs(s.vy) > 0.02) this.vault();
            s.vy = 0;
        }

        s.vz -= this.GRAVITY;
        s.z += s.vz;

        const ground = this.groundZ(s.tx, s.ty);
        s.onGround = false;

        if (ground !== null && s.vz <= 0 && s.z <= ground) {
            s.z = ground;
            s.vz = 0;
            s.onGround = true;
            s.safeX = s.tx; s.safeY = s.ty; s.safeZ = ground;
        }

        // Off the edge and into the sea.
        if (s.z < this.WATER_FALL) this.drown();

        for (const spring of this.springs) {
            if (s.vz <= 0 && Math.hypot(s.tx - spring.tx, s.ty - spring.ty) < 0.8 &&
                s.z <= spring.z + 14 && s.z > spring.z - 40) {
                s.z = spring.z;
                s.vz = this.SPRING_LAUNCH;
                s.onGround = false;
                spring.squash = 10;
                playSpringSound();
            }
        }
        for (const spring of this.springs) if (spring.squash > 0) spring.squash--;

        this.animate();
    },

    // Level 1's rule, carried over: running into a wall never dead-stops you.
    vault() {
        const s = this.sonic;
        s.vz = this.JUMP;
        s.onGround = false;
        playJumpSound();
    },

    tryMove(s, dx, dy) {
        const nx = s.tx + dx, ny = s.ty + dy;
        if (dx === 0 && dy === 0) return true;
        if (nx < 0.5 || ny < 0.5 || nx > this.COLS - 0.5 || ny > this.ROWS - 0.5) return false;

        // Check the leading edge, not just the centre, so he cannot clip corners.
        const edgeX = nx + Math.sign(dx) * s.radius;
        const edgeY = ny + Math.sign(dy) * s.radius;
        if (!this.canStand(edgeX, edgeY, s.z)) return false;

        s.tx = nx; s.ty = ny;

        // Step up onto a low lip without needing a jump.
        const ground = this.groundZ(nx, ny);
        if (ground !== null && s.onGround && ground > s.z && ground - s.z <= this.STEP) s.z = ground;
        return true;
    },

    drown() {
        const s = this.sonic;
        if (gameData.rings > 0) {
            // The rings go in the water with him rather than bouncing loose —
            // Level 1's scatter physics read the side-on heightmap, which does
            // not exist out here.
            gameData.rings = 0;
            playRingScatterSound();
            playSonicHurtSound();
            s.tx = s.safeX; s.ty = s.safeY; s.z = s.safeZ + 40;
            s.vx = 0; s.vy = 0; s.vz = 0;
            s.hurtTimer = 90;
        } else {
            s.dead = true;
            s.deadTimer = 130;
            s.vz = 9;
            this.stopMusic();
            playSonicDeathSound();
        }
    },

    collect() {
        const s = this.sonic;

        for (const ring of this.rings) {
            if (ring.taken) continue;
            if (Math.hypot(s.tx - ring.tx, s.ty - ring.ty) < 0.7 && Math.abs(s.z - ring.z) < 60) {
                ring.taken = true;
                gameData.rings++;
                playRingSound();
            }
            ring.spin += 0.15;
        }

        for (const monitor of this.monitors) {
            if (monitor.broken) continue;
            if (Math.hypot(s.tx - monitor.tx, s.ty - monitor.ty) < 0.8 &&
                Math.abs(s.z - monitor.z) < 50 && (s.vz < 0 || s.rolling)) {
                monitor.broken = true;
                monitor.pop = 20;
                gameData.rings += 10;
                s.vz = this.JUMP * 0.7;
                playBadnikDestroySound();
            }
        }
        for (const monitor of this.monitors) if (monitor.pop > 0) monitor.pop--;

        if (!this.goal.taken && Math.hypot(s.tx - this.goal.tx, s.ty - this.goal.ty) < 1.4) {
            this.goal.taken = true;
            this.completeTimer = 240;
            playLevelCompleteSound();
        }
    },

    animate() {
        const s = this.sonic;
        const moving = Math.hypot(s.vx, s.vy) > 0.02;

        if (s.dead) s.pose = 'dead';
        else if (s.hurtTimer > 0) s.pose = 'hurt';
        else if (s.charging) s.pose = 'crouch';
        else if (s.rolling) s.pose = 'spin';
        else if (!s.onGround) s.pose = s.vz > 0 ? 'launch' : 'fall';
        else if (moving) s.pose = 'run';
        else s.pose = 'idle';

        if (s.pose === 'run') {
            s.frameTimer++;
            if (s.frameTimer > 5) { s.frame = (s.frame + 1) % 3; s.frameTimer = 0; }
        } else {
            s.frame = 0;
        }
    },

    // ----------------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------------
    render() {
        this.drawWater();

        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        this.drawTerrain();
        this.drawEntities();

        ctx.restore();

        this.drawHud();
        this.drawTitle();
    },

    drawWater() {
        ctx.fillStyle = this.WATER;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Slow bands of lighter water, drifting, to stop it reading as flat paint.
        const t = Date.now() / 1000;
        ctx.fillStyle = this.WATER_LIGHT;
        ctx.globalAlpha = 0.16;
        for (let i = 0; i < 14; i++) {
            const y = ((i * 53 + t * 14 - this.camera.y * 0.25) % (canvas.height + 60)) - 30;
            const w = 90 + Math.sin(t + i) * 50;
            ctx.fillRect(((i * 137 - t * 22) % (canvas.width + 200)) - 100, y, w, 5);
        }
        ctx.globalAlpha = 1;
    },

    // One diamond per tile, plus the two visible side faces wherever the pad
    // drops away. Painted back to front so the near edges overlap the far ones.
    drawTerrain() {
        const halfW = this.TILE_W / 2, halfH = this.TILE_H / 2;

        for (let sum = 0; sum <= (this.COLS + this.ROWS); sum++) {
            for (let ty = 0; ty < this.ROWS; ty++) {
                const tx = sum - ty;
                if (tx < 0 || tx >= this.COLS) continue;

                const level = this.cells[ty][tx];
                if (level === null) continue;

                const z = level * this.LIFT;
                const cx = this.screenX(tx, ty);
                const cy = this.screenY(tx, ty, z);

                if (cx + this.TILE_W < this.camera.x || cx - this.TILE_W > this.camera.x + canvas.width) continue;
                if (cy + 400 < this.camera.y || cy - this.TILE_H > this.camera.y + canvas.height) continue;

                // Side faces, down to whatever is next door (or far into the sea).
                const rightLevel = this.levelAt(tx + 1, ty);
                const leftLevel = this.levelAt(tx, ty + 1);
                const drop = 260;

                if (rightLevel === null || rightLevel < level) {
                    const depth = rightLevel === null ? drop : (level - rightLevel) * this.LIFT;
                    this.face(cx, cy, halfW, halfH, depth, 1, (tx + ty) % 2);
                }
                if (leftLevel === null || leftLevel < level) {
                    const depth = leftLevel === null ? drop : (level - leftLevel) * this.LIFT;
                    this.face(cx, cy, halfW, halfH, depth, -1, (tx + ty) % 2);
                }

                // Grass top.
                ctx.fillStyle = this.GRASS[(tx + ty) % 2];
                ctx.beginPath();
                ctx.moveTo(cx, cy - halfH);
                ctx.lineTo(cx + halfW, cy);
                ctx.lineTo(cx, cy + halfH);
                ctx.lineTo(cx - halfW, cy);
                ctx.closePath();
                ctx.fill();
            }
        }
    },

    face(cx, cy, halfW, halfH, depth, side, checker) {
        ctx.fillStyle = this.CLIFF[checker];
        ctx.beginPath();
        if (side === 1) {
            ctx.moveTo(cx + halfW, cy);
            ctx.lineTo(cx, cy + halfH);
            ctx.lineTo(cx, cy + halfH + depth);
            ctx.lineTo(cx + halfW, cy + depth);
        } else {
            ctx.moveTo(cx - halfW, cy);
            ctx.lineTo(cx, cy + halfH);
            ctx.lineTo(cx, cy + halfH + depth);
            ctx.lineTo(cx - halfW, cy + depth);
        }
        ctx.closePath();
        ctx.fill();

        if (side === -1) {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';     // shade one side so the blocks read
            ctx.fill();
        }
    },

    // Everything that stands on the map, drawn far-to-near so it overlaps right.
    drawEntities() {
        const items = [];
        const s = this.sonic;

        for (const ring of this.rings) if (!ring.taken) items.push({ d: ring.tx + ring.ty, kind: 'ring', o: ring });
        for (const m of this.monitors) if (!m.broken || m.pop > 0) items.push({ d: m.tx + m.ty, kind: 'monitor', o: m });
        for (const sp of this.springs) items.push({ d: sp.tx + sp.ty, kind: 'spring', o: sp });
        if (!this.goal.taken) items.push({ d: this.goal.tx + this.goal.ty, kind: 'goal', o: this.goal });
        items.push({ d: s.tx + s.ty, kind: 'sonic', o: s });

        items.sort((a, b) => a.d - b.d);
        for (const item of items) this[`draw${item.kind[0].toUpperCase()}${item.kind.slice(1)}`](item.o);
    },

    shadow(tx, ty) {
        const ground = this.groundZ(tx, ty);
        if (ground === null) return;
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(this.screenX(tx, ty), this.screenY(tx, ty, ground), this.SHADOW_W / 2, this.SHADOW_W / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawRing(ring) {
        const x = this.screenX(ring.tx, ring.ty);
        const y = this.screenY(ring.tx, ring.ty, ring.z) + Math.sin(ring.spin) * 4;
        if (images.ring) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(Math.cos(ring.spin) || 0.08, 1);
            ctx.drawImage(images.ring, -16, -16, 32, 32);
            ctx.restore();
        } else {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawMonitor(m) {
        const lift = m.broken ? (20 - m.pop) * 3 : 0;
        const x = this.screenX(m.tx, m.ty);
        const y = this.screenY(m.tx, m.ty, m.z) - 16 - lift;
        this.shadow(m.tx, m.ty);
        ctx.save();
        ctx.globalAlpha = m.broken ? m.pop / 20 : 1;
        if (images.monitor) ctx.drawImage(images.monitor, x - 20, y - 20, 40, 40);
        else { ctx.fillStyle = '#c02020'; ctx.fillRect(x - 18, y - 18, 36, 36); }
        ctx.restore();
    },

    drawSpring(spring) {
        const x = this.screenX(spring.tx, spring.ty);
        const y = this.screenY(spring.tx, spring.ty, spring.z);
        const squash = spring.squash / 10;
        if (images.spring) ctx.drawImage(images.spring, x - 22, y - 18 + squash * 8, 44, 22 - squash * 8);
        else { ctx.fillStyle = '#e02020'; ctx.fillRect(x - 20, y - 14, 40, 14); }
    },

    drawGoal(goal) {
        const x = this.screenX(goal.tx, goal.ty);
        const y = this.screenY(goal.tx, goal.ty, goal.z);
        this.shadow(goal.tx, goal.ty);
        const bob = Math.sin(Date.now() / 260) * 5;
        if (images.levelEndSign) ctx.drawImage(images.levelEndSign, x - 34, y - 78 + bob, 68, 68);
        else { ctx.fillStyle = '#fff'; ctx.fillRect(x - 24, y - 70, 48, 48); }
    },

    POSE_SPRITES: {
        idle: 'sonicStanding', run: null, launch: 'sonicLaunching', fall: 'sonicLanding',
        crouch: 'sonicCrouch', spin: 'sonicSpin', hurt: 'sonicColliding', dead: 'sonicDead'
    },
    RUN_FRAMES: ['sonicWalk1', 'sonicWalk2', 'sonicWalk3'],

    drawSonic(s) {
        this.shadow(s.tx, s.ty);

        const key = s.pose === 'run' ? this.RUN_FRAMES[s.frame] : this.POSE_SPRITES[s.pose];
        const sprite = images[key] || images.sonicStanding || images.sonicIdle;
        if (!sprite) return;

        const height = this.SONIC_H;
        const width = sprite.naturalHeight ? height * (sprite.naturalWidth / sprite.naturalHeight) : height;
        const x = this.screenX(s.tx, s.ty);
        const y = this.screenY(s.tx, s.ty, s.z);

        ctx.save();
        ctx.translate(x, y - height / 2);
        if (s.hurtTimer > 0 && Math.floor(s.hurtTimer / 5) % 2 === 0) ctx.globalAlpha = 0.5;
        if (s.rolling) ctx.rotate(Date.now() / 40);
        if (s.facing === -1) ctx.scale(-1, 1);
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
        ctx.restore();

        if (s.charging) {
            const barW = 60, barH = 8;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x - barW / 2, y - height - 18, barW, barH);
            ctx.fillStyle = s.charge > 80 ? '#FF0000' : '#FFFF00';
            ctx.fillRect(x - barW / 2 + 2, y - height - 16, (barW - 4) * (s.charge / 100), barH - 4);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - barW / 2, y - height - 18, barW, barH);
        }
    },

    drawHud() {
        const left = this.rings.filter(r => !r.taken).length;
        ctx.save();
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#001030';
        ctx.fillText(`RINGS LEFT ON THE ISLES: ${left}`, canvas.width - 12, 26);
        ctx.fillStyle = '#eaf6ff';
        ctx.fillText(`RINGS LEFT ON THE ISLES: ${left}`, canvas.width - 13, 25);
        ctx.restore();

        if (this.completeTimer > 0) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 52px Arial';
            ctx.lineWidth = 9;
            ctx.strokeStyle = '#001040';
            ctx.strokeText('ZONE CLEAR', canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = '#ffd83a';
            ctx.fillText('ZONE CLEAR', canvas.width / 2, canvas.height / 2);
            ctx.restore();
        }
    },

    drawTitle() {
        if (this.titleTimer <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.titleTimer / this.TITLE_FADE);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const x = canvas.width / 2, y = canvas.height / 2 - 40;
        ctx.font = 'bold 58px Arial, sans-serif';
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#001040';
        ctx.strokeText(this.TITLE_TEXT, x, y);
        ctx.fillStyle = '#3aa0ff';
        ctx.fillText(this.TITLE_TEXT, x, y);
        ctx.restore();
    }
};
