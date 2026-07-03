import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const stadiumLights = [];

const FIELD_LENGTH = 105;
const FIELD_WIDTH = 68;


const textureLoader = new THREE.TextureLoader();

function loadTexture(path, options = {}) {
    const texturePath = path.startsWith('/') ? path : `/textures/${path}`;
    const texture = textureLoader.load(texturePath);

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

const footballTexture=loadTexture('/football.jpg',{colorSpace: THREE.SRGBColorSpace})

function enableShadows(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}


export function createScene() {
    const scene = new THREE.Scene();

    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const skybox = cubeTextureLoader.load([
        `/textures/environmentMap/px.png`,
        `/textures/environmentMap/nx.png`,
        `/textures/environmentMap/py.png`,
        `/textures/environmentMap/ny.png`,
        `/textures/environmentMap/pz.png`,
        `/textures/environmentMap/nz.png`
    ]);
    skybox.colorSpace = THREE.SRGBColorSpace;
    scene.background = skybox;
    scene.environment = skybox;

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(0, 32, 78);
    camera.lookAt(0, 0, 0);

    let existingCanvas = document.querySelector('canvas.threejs');
    if (!existingCanvas) {
        existingCanvas = document.createElement('canvas');
        existingCanvas.className = 'threejs';
        document.body.prepend(existingCanvas);
    }

    const renderer = new THREE.WebGLRenderer({
        canvas: existingCanvas,
        antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;



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

    // const fill = new THREE.DirectionalLight(0x9fcfff, 0.45);
    // fill.position.set(55, 35, -52);
    // scene.add(fill);
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
            map: footballTexture,
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
        new THREE.PlaneGeometry(150, 200, 100, 75),
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
    const axis = new THREE.AxesHelper(5)
    axis.position.set(0, 1, 0)
    scene.add(axis)
    return ground;
}

export function createLightPole(scene, x, z) {
    const poleGroup = new THREE.Group()


    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.8, 20, 16),
        new THREE.MeshStandardMaterial({
            color: '#555',
            metalness: 0.85,
            roughness: 0.28
        })
    )
    pole.position.y = 10
    poleGroup.add(pole)


    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.5, 0.5),
        new THREE.MeshStandardMaterial({
            color: '#777',
            metalness: 0.85,
            roughness: 0.28
        })
    )
    arm.position.set(2, 19, 0)

    poleGroup.add(arm)


    const rectLight = new THREE.RectAreaLight(
        '#ffffff',
        5000,
        1.2,
        0.6
    )
    rectLight.position.set(5, 19, 0)

    rectLight.lookAt(0, 0, 0)



    const projector = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 6),
        new THREE.MeshBasicMaterial({
            color: '#fff7cc',
            side: THREE.DoubleSide,
            transparent: true
        })
    )
    poleGroup.add(rectLight)
    // stadiumLights.push({
    //     light: rectLight,
    //     projector: projector
    // })
    projector.position.copy(rectLight.position)
    projector.lookAt(0, 0, 0)

    poleGroup.add(projector)
    poleGroup.add(rectLight)
    poleGroup.position.set(x, 0, z)
    scene.add(poleGroup)
    enableShadows(poleGroup)
    return poleGroup
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
    const stadiumWidth = 150;
    const stadiumLength = 200;

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

    createStand(scene, -50, 0, 8, 31, Math.PI / 2);
    createStand(scene,50, 0, 8, 31,  -Math.PI / 2);
    createStand(scene, 0,-68, 8, 17,0 );
    createStand(scene, 0, 68, 8, 17, Math.PI);

    const light1 = createLightPole(scene, 45, -42);
    light1.rotation.y = -Math.PI * 3 / 4

    const light2 = createLightPole(scene, 45, 42);
    light2.rotation.y = -Math.PI / 3 * 4
    const light3 = createLightPole(scene, -45, -42);
    light3.rotation.y = -Math.PI / 4
    const light4 = createLightPole(scene, -45, 42);
    light4.rotation.y = Math.PI / 4
    const walls = createOuterWalls(scene);

    return ground;
}



export function createFieldBorder(scene) {
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
