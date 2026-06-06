import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const stadiumLights = [];

const FIELD_LENGTH = 105;
const FIELD_WIDTH = 68;
const CENTER_CIRCLE_RADIUS = 9.15;
const PENALTY_AREA_DEPTH = 16.5;
const PENALTY_AREA_WIDTH = 40.32;
const GOAL_AREA_DEPTH = 5.5;
const GOAL_AREA_WIDTH = 18.32;
const LINE_THICKNESS = 0.16;
const ASSET_ROOT = '/textures';

const textureLoader = new THREE.TextureLoader();

function loadTexture(path, options = {}) {
    const texture = textureLoader.load(`${ASSET_ROOT}/${path}`);

    if (options.colorSpace) {
        texture.colorSpace = options.colorSpace;
    }

    if (options.repeat) {
        texture.repeat.set(options.repeat.x, options.repeat.y);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    }

    if (options.rotate90) {
        texture.center.set(0.5, 0.5);
        texture.rotation = Math.PI / 2;
    }

    texture.anisotropy = 4;
    return texture;
}

const fieldTextures = {
    map: loadTexture('football-field/floor1.png', {
        colorSpace: THREE.SRGBColorSpace,
        rotate90: true
    }),
    normalMap: loadTexture('football-field/floor_normal.png', { rotate90: true }),
    displacementMap: loadTexture('football-field/floor_hieght.png', { rotate90: true }),
    metalnessMap: loadTexture('football-field/floor_metalness.png', { rotate90: true }),
    roughnessMap: loadTexture('football-field/floor_rough.png', { rotate90: true })
};

const stadiumFloorTextures = {
    map: loadTexture('floor/floor_diff_2k.jpg', {
        colorSpace: THREE.SRGBColorSpace,
        repeat: { x: 10, y: 10 }
    }),
    normalMap: loadTexture('floor/floor_nor_gl_2k.jpg', { repeat: { x: 10, y: 10 } }),
    displacementMap: loadTexture('floor/floor_disp_2k.jpg', { repeat: { x: 10, y: 10 } }),
    armMap: loadTexture('floor/floor_arm_2k.jpg', { repeat: { x: 10, y: 10 } })
};

const wallTextures = [
    loadTexture('walls/wall1.png', { colorSpace: THREE.SRGBColorSpace }),
    loadTexture('walls/wall2.png', { colorSpace: THREE.SRGBColorSpace }),
    loadTexture('walls/wall3.png', { colorSpace: THREE.SRGBColorSpace }),
    loadTexture('walls/wall4.png', { colorSpace: THREE.SRGBColorSpace })
];

function enableShadows(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

function createCanvasTexture(draw, size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function createBallTexture() {
    return createCanvasTexture((ctx, size) => {
        const center = size / 2;
        const radius = size * 0.46;

        const gradient = ctx.createRadialGradient(center * 0.7, center * 0.65, 10, center, center, radius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.72, '#f4f4f4');
        gradient.addColorStop(1, '#c8c8c8');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 9;
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < 6; i += 1) {
            const angle = -Math.PI / 2 + i * Math.PI / 3;
            const x = center + Math.cos(angle) * radius * 0.28;
            const y = center + Math.sin(angle) * radius * 0.28;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();

        for (let i = 0; i < 12; i += 1) {
            const angle = i * Math.PI / 6;
            ctx.beginPath();
            ctx.moveTo(center + Math.cos(angle) * radius * 0.36, center + Math.sin(angle) * radius * 0.36);
            ctx.lineTo(center + Math.cos(angle) * radius * 0.88, center + Math.sin(angle) * radius * 0.88);
            ctx.stroke();
        }

        ctx.lineWidth = 7;
        ctx.strokeStyle = '#1d7cff';
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.72, Math.PI * 0.08, Math.PI * 0.38);
        ctx.stroke();

        ctx.strokeStyle = '#ff3d3d';
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.58, Math.PI * 1.08, Math.PI * 1.43);
        ctx.stroke();

        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(center + radius * 0.52, center - radius * 0.34, radius * 0.055, 0, Math.PI * 2);
        ctx.fill();
    }, 512);
}

function addLinePlane(scene, x1, z1, x2, z2, thickness = LINE_THICKNESS) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.86
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, thickness), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.atan2(dz, dx);
    mesh.position.set((x1 + x2) / 2, 0.045, (z1 + z2) / 2);
    scene.add(mesh);
    return mesh;
}

function addArc(scene, centerX, centerZ, radius, startAngle, endAngle, segments = 64) {
    const points = [];

    for (let i = 0; i <= segments; i += 1) {
        const t = startAngle + (endAngle - startAngle) * (i / segments);
        points.push(new THREE.Vector3(
            centerX + Math.cos(t) * radius,
            0.065,
            centerZ + Math.sin(t) * radius
        ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    return line;
}

function addFieldMarkings(scene) {
    addLinePlane(scene, -FIELD_WIDTH / 2, -FIELD_LENGTH / 2, FIELD_WIDTH / 2, -FIELD_LENGTH / 2);
    addLinePlane(scene, -FIELD_WIDTH / 2, FIELD_LENGTH / 2, FIELD_WIDTH / 2, FIELD_LENGTH / 2);
    addLinePlane(scene, -FIELD_WIDTH / 2, -FIELD_LENGTH / 2, -FIELD_WIDTH / 2, FIELD_LENGTH / 2);
    addLinePlane(scene, FIELD_WIDTH / 2, -FIELD_LENGTH / 2, FIELD_WIDTH / 2, FIELD_LENGTH / 2);
    addLinePlane(scene, -FIELD_WIDTH / 2, 0, FIELD_WIDTH / 2, 0);

    addArc(scene, 0, 0, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2, 96);

    const centerPoint = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.025, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    centerPoint.position.set(0, 0.065, 0);
    scene.add(centerPoint);

    const createPenaltyArea = (goalZ, sign) => {
        const farZ = goalZ + sign * PENALTY_AREA_DEPTH;
        const leftX = -PENALTY_AREA_WIDTH / 2;
        const rightX = PENALTY_AREA_WIDTH / 2;
        addLinePlane(scene, leftX, goalZ, rightX, goalZ);
        addLinePlane(scene, leftX, goalZ, leftX, farZ);
        addLinePlane(scene, rightX, goalZ, rightX, farZ);

        const goalFarZ = goalZ + sign * GOAL_AREA_DEPTH;
        const goalLeftX = -GOAL_AREA_WIDTH / 2;
        const goalRightX = GOAL_AREA_WIDTH / 2;
        addLinePlane(scene, goalLeftX, goalZ, goalRightX, goalZ);
        addLinePlane(scene, goalLeftX, goalZ, goalLeftX, goalFarZ);
        addLinePlane(scene, goalRightX, goalZ, goalRightX, goalFarZ);

        const spotZ = goalZ + sign * 11;
        const dot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.14, 0.025, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        dot.position.set(0, 0.068, spotZ);
        scene.add(dot);

        const arcCenter = spotZ + sign * 3.2;
        if (sign > 0) {
            addArc(scene, 0, arcCenter, CENTER_CIRCLE_RADIUS, Math.PI / 12, Math.PI - Math.PI / 12, 48);
        } else {
            addArc(scene, 0, arcCenter, CENTER_CIRCLE_RADIUS, Math.PI + Math.PI / 12, Math.PI * 2 - Math.PI / 12, 48);
        }
    };

    createPenaltyArea(-FIELD_LENGTH / 2, 1);
    createPenaltyArea(FIELD_LENGTH / 2, -1);

    addArc(scene, -FIELD_WIDTH / 2, -FIELD_LENGTH / 2, 1, 0, Math.PI / 2, 18);
    addArc(scene, FIELD_WIDTH / 2, -FIELD_LENGTH / 2, 1, Math.PI / 2, Math.PI, 18);
    addArc(scene, -FIELD_WIDTH / 2, FIELD_LENGTH / 2, 1, -Math.PI / 2, 0, 18);
    addArc(scene, FIELD_WIDTH / 2, FIELD_LENGTH / 2, 1, Math.PI, Math.PI * 1.5, 18);
}

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111a20);
    scene.fog = new THREE.Fog(0x111a20, 120, 280);

    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const skybox = cubeTextureLoader.load([
        `${ASSET_ROOT}/environmentMap/px.png`,
        `${ASSET_ROOT}/environmentMap/nx.png`,
        `${ASSET_ROOT}/environmentMap/py.png`,
        `${ASSET_ROOT}/environmentMap/ny.png`,
        `${ASSET_ROOT}/environmentMap/pz.png`,
        `${ASSET_ROOT}/environmentMap/nz.png`
    ]);
    skybox.colorSpace = THREE.SRGBColorSpace;
    scene.background = skybox;
    scene.environment = skybox;

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(0, 32, 78);
    camera.lookAt(0, 0, 0);

    const existingCanvas = document.querySelector('canvas[data-football-scene]');
    const renderer = new THREE.WebGLRenderer({
        canvas: existingCanvas || undefined,
        antialias: true
    });

    renderer.domElement.dataset.footballScene = 'true';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    if (!existingCanvas) {
        document.body.appendChild(renderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.82;
    controls.panSpeed = 0.55;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minPolarAngle = Math.PI / 10;
    controls.minDistance = 8;
    controls.maxDistance = 170;
    controls.target.set(0, 1.2, 0);

    return { scene, camera, renderer, controls };
}

export function setupLighting(scene) {
    scene.add(new THREE.HemisphereLight(0xbfdcff, 0x1d271f, 1.3));

    const sun = new THREE.DirectionalLight(0xffffff, 2.15);
    sun.position.set(-38, 74, 42);
    sun.castShadow = true;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 190;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x9fcfff, 0.45);
    fill.position.set(55, 35, -52);
    scene.add(fill);
}

export function createFloor(scene) {
    return createFootballField(scene);
}

export function createFootballField(scene) {
    const fieldMaterial = new THREE.MeshStandardMaterial({
        map: fieldTextures.map,
        normalMap: fieldTextures.normalMap,
        displacementMap: fieldTextures.displacementMap,
        displacementScale: 0.018,
        metalnessMap: fieldTextures.metalnessMap,
        roughnessMap: fieldTextures.roughnessMap,
        metalness: 0.05,
        roughness: 0.78
    });

    const field = new THREE.Mesh(
        new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH, 32, 48),
        fieldMaterial
    );
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    addFieldMarkings(scene);
    return field;
}

export function createGoal(scene, zPosition, rotation = 0) {
    const goalGroup = new THREE.Group();
    goalGroup.position.set(0, 0, zPosition);
    goalGroup.rotation.y = rotation;

    const goalWidth = 7.32;
    const goalHeight = 2.44;
    const goalDepth = 2.25;
    const postRadius = 0.09;

    const postMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.32,
        metalness: 0.38
    });
    const netMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.58
    });

    const makePost = (height) => {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(postRadius, postRadius, height, 24),
            postMaterial
        );
        post.castShadow = true;
        post.receiveShadow = true;
        return post;
    };

    const leftPost = makePost(goalHeight);
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, 0);
    goalGroup.add(leftPost);

    const rightPost = makePost(goalHeight);
    rightPost.position.set(goalWidth / 2, goalHeight / 2, 0);
    goalGroup.add(rightPost);

    const crossbar = makePost(goalWidth);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, 0);
    goalGroup.add(crossbar);

    const backLeft = makePost(goalHeight);
    backLeft.position.set(-goalWidth / 2, goalHeight / 2, -goalDepth);
    goalGroup.add(backLeft);

    const backRight = makePost(goalHeight);
    backRight.position.set(goalWidth / 2, goalHeight / 2, -goalDepth);
    goalGroup.add(backRight);

    const backTop = makePost(goalWidth);
    backTop.rotation.z = Math.PI / 2;
    backTop.position.set(0, goalHeight, -goalDepth);
    goalGroup.add(backTop);

    const leftConnector = makePost(goalDepth);
    leftConnector.rotation.x = Math.PI / 2;
    leftConnector.position.set(-goalWidth / 2, goalHeight, -goalDepth / 2);
    goalGroup.add(leftConnector);

    const rightConnector = makePost(goalDepth);
    rightConnector.rotation.x = Math.PI / 2;
    rightConnector.position.set(goalWidth / 2, goalHeight, -goalDepth / 2);
    goalGroup.add(rightConnector);

    const netGroup = new THREE.Group();
    const divisionsX = 12;
    const divisionsY = 6;
    const divisionsZ = 6;

    for (let i = 0; i <= divisionsX; i += 1) {
        const x = -goalWidth / 2 + (goalWidth / divisionsX) * i;
        netGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, 0.08, -goalDepth),
                new THREE.Vector3(x, goalHeight, -goalDepth)
            ]),
            netMaterial
        ));
        netGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, goalHeight, 0),
                new THREE.Vector3(x, goalHeight, -goalDepth)
            ]),
            netMaterial
        ));
    }

    for (let j = 0; j <= divisionsY; j += 1) {
        const y = (goalHeight / divisionsY) * j;
        netGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-goalWidth / 2, y, -goalDepth),
                new THREE.Vector3(goalWidth / 2, y, -goalDepth)
            ]),
            netMaterial
        ));

        for (const x of [-goalWidth / 2, goalWidth / 2]) {
            netGroup.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, y, 0),
                    new THREE.Vector3(x, y, -goalDepth)
                ]),
                netMaterial
            ));
        }
    }

    for (let k = 0; k <= divisionsZ; k += 1) {
        const z = -(goalDepth / divisionsZ) * k;
        netGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-goalWidth / 2, goalHeight, z),
                new THREE.Vector3(goalWidth / 2, goalHeight, z)
            ]),
            netMaterial
        ));

        for (const x of [-goalWidth / 2, goalWidth / 2]) {
            netGroup.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, 0.08, z),
                    new THREE.Vector3(x, goalHeight, z)
                ]),
                netMaterial
            ));
        }
    }

    goalGroup.add(netGroup);
    scene.add(goalGroup);
    return goalGroup;
}

export function createBallMesh(scene, radius) {
    const ball = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 48, 48),
        new THREE.MeshStandardMaterial({
            map: createBallTexture(),
            roughness: 0.42,
            metalness: 0.03
        })
    );

    ball.castShadow = true;
    ball.receiveShadow = true;
    ball.position.set(0, 5, 0);
    scene.add(ball);
    return ball;
}

export function handleResize(camera, renderer) {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function createStadiumGround(scene) {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 150, 100, 75),
        new THREE.MeshStandardMaterial({
            color: 0x9d9a96,
            roughness: 0.86,
            map: stadiumFloorTextures.map,
            metalnessMap: stadiumFloorTextures.armMap,
            roughnessMap: stadiumFloorTextures.armMap,
            normalMap: stadiumFloorTextures.normalMap,
            displacementMap: stadiumFloorTextures.displacementMap,
            displacementScale: 0.012
        })
    );

    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);
    return ground;
}

export function createLightPole(scene, x, z) {
    const poleGroup = new THREE.Group();
    const metalMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.86,
        roughness: 0.28
    });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 20, 18), metalMaterial);
    pole.position.y = 10;
    poleGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.42, 0.42), metalMaterial);
    arm.position.set(2.5, 19, 0);
    poleGroup.add(arm);

    const lampPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 2.8),
        new THREE.MeshBasicMaterial({
            color: 0xfff3c4,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide
        })
    );
    lampPanel.position.set(5.25, 19, 0);
    poleGroup.add(lampPanel);

    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    scene.add(target);

    const spotlight = new THREE.SpotLight(0xffffff, 340, 150, Math.PI / 5.6, 0.42, 1.35);
    spotlight.position.set(5.25, 19, 0);
    spotlight.target = target;
    spotlight.castShadow = false;
    poleGroup.add(spotlight);

    poleGroup.position.set(x, 0, z);
    poleGroup.lookAt(0, 0, 0);

    lampPanel.lookAt(poleGroup.worldToLocal(new THREE.Vector3(0, 0, 0)));
    enableShadows(poleGroup);
    scene.add(poleGroup);

    stadiumLights.push({ light: spotlight, projector: lampPanel });
    return poleGroup;
}

export function createStand(scene, startX, startZ, rows, cols, rotation = 0) {
    const standGroup = new THREE.Group();
    const seatMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e3a8a,
        roughness: 0.62,
        metalness: 0.04
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.76,
        roughness: 0.32
    });

    const seatSpacing = 2.65;
    const rowSpacing = 3.15;
    const totalWidth = cols * seatSpacing + 2;
    const instanceCount = rows * cols;
    const dummy = new THREE.Object3D();
    const seatMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(2.12, 0.42, 2.05),
        seatMaterial,
        instanceCount
    );
    const backMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(2.12, 1.85, 0.42),
        seatMaterial,
        instanceCount
    );

    seatMesh.castShadow = false;
    seatMesh.receiveShadow = true;
    backMesh.castShadow = false;
    backMesh.receiveShadow = true;

    let instanceIndex = 0;

    for (let row = 0; row < rows; row += 1) {
        const rowHeight = row * 1.05;
        const rowDepth = -row * rowSpacing;

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(totalWidth, 0.3, rowSpacing),
            metalMaterial
        );
        platform.position.set(0, rowHeight - 0.25, rowDepth);
        platform.castShadow = row < 3;
        platform.receiveShadow = true;
        standGroup.add(platform);

        for (let col = 0; col < cols; col += 1) {
            const x = (col - (cols - 1) / 2) * seatSpacing;

            dummy.position.set(x, rowHeight, rowDepth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            seatMesh.setMatrixAt(instanceIndex, dummy.matrix);

            dummy.position.set(x, rowHeight + 1.08, rowDepth - 0.88);
            dummy.updateMatrix();
            backMesh.setMatrixAt(instanceIndex, dummy.matrix);
            instanceIndex += 1;
        }
    }

    standGroup.add(seatMesh, backMesh);
    standGroup.position.set(startX, 0, startZ);
    standGroup.rotation.y = rotation;
    scene.add(standGroup);
    return standGroup;
}

export function createOuterWalls(scene) {
    const wallGroup = new THREE.Group();
    const wallHeight = 12;
    const wallThickness = 2;
    const stadiumWidth = 132;
    const stadiumLength = 174;

    const materials = wallTextures.map((map) => new THREE.MeshStandardMaterial({
        color: 0xd9d9d9,
        roughness: 0.7,
        metalness: 0.18,
        map
    }));

    const northWall = new THREE.Mesh(
        new THREE.BoxGeometry(stadiumWidth + wallThickness * 2, wallHeight, wallThickness),
        materials[0]
    );
    northWall.position.set(0, wallHeight / 2, -stadiumLength / 2 - wallThickness / 2);
    wallGroup.add(northWall);

    const southWall = new THREE.Mesh(
        new THREE.BoxGeometry(stadiumWidth + wallThickness * 2, wallHeight, wallThickness),
        materials[1]
    );
    southWall.position.set(0, wallHeight / 2, stadiumLength / 2 + wallThickness / 2);
    wallGroup.add(southWall);

    const westWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, stadiumLength),
        materials[2]
    );
    westWall.position.set(-stadiumWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
    wallGroup.add(westWall);

    const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, stadiumLength),
        materials[3]
    );
    eastWall.position.set(stadiumWidth / 2 + wallThickness / 2, wallHeight / 2, 0);
    wallGroup.add(eastWall);

    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e3a8a,
        metalness: 0.46,
        roughness: 0.35
    });

    const createEdge = (width, depth, x, z) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.6, depth), edgeMaterial);
        edge.position.set(x, wallHeight + 0.3, z);
        wallGroup.add(edge);
    };

    createEdge(stadiumWidth + wallThickness * 2, 2.5, 0, -stadiumLength / 2 - wallThickness / 2);
    createEdge(stadiumWidth + wallThickness * 2, 2.5, 0, stadiumLength / 2 + wallThickness / 2);
    createEdge(2.5, stadiumLength, -stadiumWidth / 2 - wallThickness / 2, 0);
    createEdge(2.5, stadiumLength, stadiumWidth / 2 + wallThickness / 2, 0);

    enableShadows(wallGroup);
    scene.add(wallGroup);
    return wallGroup;
}

export function createSurroundingArea(scene) {
    const ground = createStadiumGround(scene);

    createStand(scene, 0, -68, 8, 31, 0);
    createStand(scene, 0, 68, 8, 31, Math.PI);
    createStand(scene, -49, 29, 8, 17, Math.PI / 2);
    createStand(scene, 49, -29, 8, 17, -Math.PI / 2);

    createLightPole(scene, 45, -42);
    createLightPole(scene, 45, 42);
    createLightPole(scene, -45, -42);
    createLightPole(scene, -45, 42);
    createOuterWalls(scene);

    return ground;
}

export function createFieldBorder(scene) {
    return createFieldBoundsVisual(scene);
}

export function createFieldBoundsVisual(scene) {
    const boardMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e3a8a,
        roughness: 0.58,
        metalness: 0.18
    });
    const wallHeight = 1.2;
    const wallThickness = 0.12;
    const goalGap = 9.2;

    const addBoard = (x, z, width, depth) => {
        const board = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), boardMaterial);
        board.position.set(x, wallHeight / 2, z);
        board.castShadow = true;
        board.receiveShadow = true;
        scene.add(board);
        return board;
    };

    addBoard(-FIELD_WIDTH / 2, 0, wallThickness, FIELD_LENGTH);
    addBoard(FIELD_WIDTH / 2, 0, wallThickness, FIELD_LENGTH);

    const endBoardWidth = (FIELD_WIDTH - goalGap) / 2;
    const endBoardX = goalGap / 2 + endBoardWidth / 2;
    addBoard(-endBoardX, -FIELD_LENGTH / 2, endBoardWidth, wallThickness);
    addBoard(endBoardX, -FIELD_LENGTH / 2, endBoardWidth, wallThickness);
    addBoard(-endBoardX, FIELD_LENGTH / 2, endBoardWidth, wallThickness);
    addBoard(endBoardX, FIELD_LENGTH / 2, endBoardWidth, wallThickness);
}
