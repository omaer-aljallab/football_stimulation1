import * as THREE from 'three';
import GUI from 'lil-gui';
import {
    createScene,
    setupLighting,
    createFootballField,
    createGoal,
    createBallMesh,
    handleResize,
    createSurroundingArea,
    createFieldBoundsVisual
} from './scene.js';
import {
    createPhysicsWorld,
    createGroundBody,
    createBallBody,
    createGoalPhysics,
    createSecondGoalPhysics,
    createFieldBounds,
    kickBall,
    resetBall,
    stepPhysics,
    updateContactMaterial,
    updateGravity,
    computeAutoDrag
} from './physics.js';

const FIELD_HALF_WIDTH = 34;
const FIELD_HALF_LENGTH = 52.5;

const { scene, camera, renderer, controls } = createScene();
setupLighting(scene);

const { world, groundMaterial, ballMaterial, ballGroundContact } = createPhysicsWorld();
createGroundBody(world, groundMaterial);

const physicsConfig = {
    strength: 18,
    angle: 18,
    spin: 8,
    aimAngle: 0,
    friction: 0.5,
    restitution: 0.7,
    gravity: 9.81,
    magnus: 0.25,
    rollingResistance: 0.015,
    buoyancy: 0,
    airDensity: 1.225,
    temperature: 15,
    dragCoefficient: 0.25,
    ballRadius: 0.22,
    aerodynamicRadius: 0.11,

    get computedAirDensity() {
        const tempKelvin = this.temperature + 273.15;
        const standardTemp = 288.15;
        return this.airDensity * (standardTemp / tempKelvin);
    }
};

const cameraModeOptions = {
    'حرة': 'free',
    'تتبع': 'follow',
    'علوية': 'top',
    'قريبة': 'ball'
};

const guiState = {
    cameraMode: 'follow',
    computedAirDensity: physicsConfig.computedAirDensity,
    resetBall: () => {
        resetBall(ballBody);
        resetTrail();
    }
};

const guiControllers = {};

function applyPhysicsConfig() {
    updateContactMaterial(ballGroundContact, physicsConfig.friction, physicsConfig.restitution);
    updateGravity(world, physicsConfig.gravity);
}

function refreshComputedDensity() {
    guiState.computedAirDensity = physicsConfig.computedAirDensity;
    guiControllers.computedAirDensity?.updateDisplay();
}

function handleConfigChange(key) {
    if (key === 'airDensity' || key === 'temperature') {
        refreshComputedDensity();
    }

    if (key === 'friction' || key === 'restitution' || key === 'gravity') {
        applyPhysicsConfig();
    }
}

function addConfigControl(folder, key, label, min, max, step, decimals) {
    const controller = folder
        .add(physicsConfig, key, min, max, step)
        .name(label)
        .onChange(() => handleConfigChange(key));

    if (decimals !== undefined) {
        controller.decimals(decimals);
    }

    guiControllers[key] = controller;
    return controller;
}

function isGuiTarget(target) {
    return target instanceof Element && Boolean(target.closest('.lil-gui'));
}

function createSimulationGUI() {
    const gui = new GUI({
        title: 'إعدادات المحاكاة',
        width: 258,
        touchStyles: false
    });
    gui.domElement.classList.add('compact-football-gui');
    gui.domElement.dir = 'ltr';

    const cameraFolder = gui.addFolder('الكاميرا');
    guiControllers.cameraMode = cameraFolder
        .add(guiState, 'cameraMode', cameraModeOptions)
        .name('الوضع')
        .onChange(setCameraMode);

    const kickFolder = gui.addFolder('الركلة');
    addConfigControl(kickFolder, 'strength', 'القوة', 5, 35, 0.5, 1);
    addConfigControl(kickFolder, 'angle', 'الارتفاع', 0, 45, 1, 0);
    addConfigControl(kickFolder, 'spin', 'الدوران', 0, 20, 0.5, 1);
    addConfigControl(kickFolder, 'aimAngle', 'الاتجاه', -45, 45, 1, 0);

    const physicsFolder = gui.addFolder('الفيزياء');
    addConfigControl(physicsFolder, 'friction', 'الاحتكاك', 0, 1, 0.01, 2);
    addConfigControl(physicsFolder, 'restitution', 'الارتداد', 0, 0.9, 0.01, 2);
    addConfigControl(physicsFolder, 'magnus', 'ماغنوس', 0, 1, 0.01, 2);
    addConfigControl(physicsFolder, 'rollingResistance', 'التدحرج', 0, 0.1, 0.001, 3);
    physicsFolder.close();

    const environmentFolder = gui.addFolder('الهواء والجاذبية');
    addConfigControl(environmentFolder, 'gravity', 'الجاذبية', 0, 25, 0.01, 2);
    addConfigControl(environmentFolder, 'airDensity', 'كثافة الهواء', 0.5, 2, 0.005, 3);
    addConfigControl(environmentFolder, 'temperature', 'الحرارة', -20, 40, 1, 0);
    guiControllers.computedAirDensity = environmentFolder
        .add(guiState, 'computedAirDensity')
        .name('الكثافة المحسوبة')
        .decimals(3)
        .listen()
        .disable();
    environmentFolder.close();

    gui.add(guiState, 'resetBall').name('إعادة الكرة');

    return gui;
}

createSurroundingArea(scene);
createFootballField(scene);
createFieldBoundsVisual(scene);
createGoal(scene, -FIELD_HALF_LENGTH, 0);
createGoal(scene, FIELD_HALF_LENGTH, Math.PI);

const ball = createBallMesh(scene, physicsConfig.ballRadius);
const { ballBody } = createBallBody(world, ballMaterial, { x: 0, y: physicsConfig.ballRadius, z: 0 });
createGoalPhysics(world, -FIELD_HALF_LENGTH);
createSecondGoalPhysics(world, FIELD_HALF_LENGTH);
createFieldBounds(world, FIELD_HALF_WIDTH, FIELD_HALF_LENGTH, groundMaterial);

const cameraState = {
    mode: 'follow',
    desiredPosition: new THREE.Vector3(),
    desiredTarget: new THREE.Vector3(),
    lastMoveDirection: new THREE.Vector3(0, 0, -1)
};

function setCameraMode(mode) {
    cameraState.mode = mode;
    guiState.cameraMode = mode;
    guiControllers.cameraMode?.updateDisplay();
    controls.enableRotate = mode === 'free';
    controls.enablePan = mode === 'free';
}

function updateCamera(delta) {
    if (cameraState.mode === 'free') return;

    const horizontalVelocity = new THREE.Vector3(ballBody.velocity.x, 0, ballBody.velocity.z);
    if (horizontalVelocity.lengthSq() > 0.08) {
        cameraState.lastMoveDirection.copy(horizontalVelocity.normalize());
    }

    if (cameraState.mode === 'follow') {
        cameraState.desiredTarget.copy(ballBody.position).add(new THREE.Vector3(0, 1.6, 0));
        cameraState.desiredPosition
            .copy(ballBody.position)
            .addScaledVector(cameraState.lastMoveDirection, -16)
            .add(new THREE.Vector3(0, 7, 0));
    } else if (cameraState.mode === 'top') {
        cameraState.desiredTarget.copy(ballBody.position);
        cameraState.desiredPosition.copy(ballBody.position).add(new THREE.Vector3(0, 58, 0.01));
    } else if (cameraState.mode === 'ball') {
        cameraState.desiredTarget.copy(ballBody.position).addScaledVector(cameraState.lastMoveDirection, 8);
        cameraState.desiredTarget.y += 1.2;
        cameraState.desiredPosition
            .copy(ballBody.position)
            .addScaledVector(cameraState.lastMoveDirection, -5.5)
            .add(new THREE.Vector3(0, 2.4, 0));
    }

    const blend = 1 - Math.exp(-delta * 4.5);
    camera.position.lerp(cameraState.desiredPosition, blend);
    controls.target.lerp(cameraState.desiredTarget, blend);
}

createSimulationGUI();
refreshComputedDensity();
applyPhysicsConfig();
setCameraMode('follow');

const shotDirectionScratch = new THREE.Vector3();
const kickDirectionScratch = new THREE.Vector3();
const indicatorDirectionScratch = new THREE.Vector3();
const trailColor = new THREE.Color();
const trailStartColor = new THREE.Color(0x32f6ff);
const trailEndColor = new THREE.Color(0xffd166);
const trailPoints = [];
const emptyGeometry = new THREE.BufferGeometry();
const trailGlowGeometry = new THREE.BufferGeometry();
const trailCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const trailTubeMaterial = new THREE.MeshBasicMaterial({
    color: 0x28e9ff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const trailGlowMaterial = new THREE.PointsMaterial({
    size: 0.42,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const trajectoryTrail = new THREE.Group();
const trajectoryTube = new THREE.Mesh(emptyGeometry.clone(), trailTubeMaterial);
const trajectoryCore = new THREE.Mesh(emptyGeometry.clone(), trailCoreMaterial);
const trajectoryGlow = new THREE.Points(trailGlowGeometry, trailGlowMaterial);
trajectoryTrail.add(trajectoryTube, trajectoryCore, trajectoryGlow);
trajectoryGlow.visible = false;
trajectoryTrail.visible = false;
scene.add(trajectoryTrail);

const aimMaterial = new THREE.MeshBasicMaterial({
    color: 0x28ffb8,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const aimCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const directionIndicator = new THREE.Group();
const aimArrowGroup = new THREE.Group();
const aimRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.025, 10, 72),
    aimMaterial.clone()
);
aimRing.rotation.x = -Math.PI / 2;

const aimGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 1, 18, 1, true),
    aimMaterial.clone()
);
aimGlow.rotation.z = -Math.PI / 2;

const aimCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 12),
    aimCoreMaterial.clone()
);
aimCore.rotation.z = -Math.PI / 2;

const aimHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.05, 24),
    aimMaterial.clone()
);
aimHead.rotation.z = -Math.PI / 2;

const aimChevrons = [];
for (let i = 0; i < 3; i += 1) {
    const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.45, 3),
        aimCoreMaterial.clone()
    );
    chevron.rotation.z = -Math.PI / 2;
    chevron.rotation.y = Math.PI / 6;
    aimArrowGroup.add(chevron);
    aimChevrons.push(chevron);
}

aimArrowGroup.add(aimGlow, aimCore, aimHead);
directionIndicator.add(aimRing, aimArrowGroup);
scene.add(directionIndicator);

let trailActive = false;
let indicatorPulse = 0;

function getShotDirection(target = shotDirectionScratch) {
    camera.getWorldDirection(target);
    target.y = 0;
    if (target.lengthSq() < 1e-6) {
        target.set(0, 0, -1);
    }
    target.normalize();

    const yaw = THREE.MathUtils.degToRad(physicsConfig.aimAngle);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const x = target.x * cos - target.z * sin;
    const z = target.x * sin + target.z * cos;
    return target.set(x, 0, z).normalize();
}

function rebuildTrailGeometry() {
    const pointCount = trailPoints.length;
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    for (let i = 0; i < pointCount; i += 1) {
        const point = trailPoints[i];
        const offset = i * 3;
        const t = pointCount <= 1 ? 0 : i / (pointCount - 1);
        trailColor.copy(trailStartColor).lerp(trailEndColor, t);

        positions[offset] = point.x;
        positions[offset + 1] = point.y + 0.03;
        positions[offset + 2] = point.z;
        colors[offset] = trailColor.r;
        colors[offset + 1] = trailColor.g;
        colors[offset + 2] = trailColor.b;
    }

    trailGlowGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGlowGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    trailGlowGeometry.computeBoundingSphere();

    const visible = pointCount > 1;
    trajectoryTrail.visible = visible;
    trajectoryGlow.visible = visible;
    trajectoryTube.visible = visible;
    trajectoryCore.visible = visible;

    trajectoryTube.geometry.dispose();
    trajectoryCore.geometry.dispose();

    if (!visible) {
        trajectoryTube.geometry = emptyGeometry.clone();
        trajectoryCore.geometry = emptyGeometry.clone();
        return;
    }

    const curvePoints = trailPoints.map((point) => new THREE.Vector3(point.x, point.y + 0.06, point.z));
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const segments = Math.min(220, Math.max(12, pointCount * 4));
    trajectoryTube.geometry = new THREE.TubeGeometry(curve, segments, 0.12, 12, false);
    trajectoryCore.geometry = new THREE.TubeGeometry(curve, segments, 0.028, 8, false);
}

function startTrail() {
    trailActive = true;
    trailPoints.length = 0;
    trailPoints.push(ballBody.position.clone());
    rebuildTrailGeometry();
}

function resetTrail() {
    trailActive = false;
    trailPoints.length = 0;
    rebuildTrailGeometry();
}

function updateTrail() {
    if (!trailActive) return;

    const lastPoint = trailPoints[trailPoints.length - 1];
    if (!lastPoint || lastPoint.distanceToSquared(ballBody.position) > 0.09) {
        trailPoints.push(ballBody.position.clone());
        if (trailPoints.length > 260) {
            trailPoints.shift();
        }
        rebuildTrailGeometry();
    }
}

function updateDirectionIndicator(delta = 0) {
    const ballIsReady = ballBody.velocity.lengthSq() < 0.03
        && ballBody.position.y <= ballBody.radius + 0.04;
    directionIndicator.visible = ballIsReady;
    if (!ballIsReady) return;

    indicatorPulse += delta;
    const direction = getShotDirection(indicatorDirectionScratch);
    const launchAngleRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(physicsConfig.angle, 0, 55));
    const length = THREE.MathUtils.clamp(3.8 + physicsConfig.strength * 0.12, 4.2, 8.2);
    const headLength = 1.05;
    const shaftLength = Math.max(1.5, length - headLength);
    const pulse = (Math.sin(indicatorPulse * 5.4) + 1) * 0.5;
    const pitchLift = Math.sin(launchAngleRad);
    const horizontalScale = Math.cos(launchAngleRad);
    const shotVector = new THREE.Vector3(
        direction.x * horizontalScale,
        pitchLift,
        direction.z * horizontalScale
    ).normalize();

    directionIndicator.position.copy(ballBody.position);
    directionIndicator.position.y = ballBody.radius + 0.08;
    directionIndicator.rotation.set(0, 0, 0);

    aimArrowGroup.position.set(0, 0.12, 0);
    aimArrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), shotVector);

    aimRing.scale.setScalar(1 + pulse * 0.16);
    aimRing.material.opacity = 0.42 + pulse * 0.28;

    aimGlow.scale.y = shaftLength;
    aimGlow.position.x = shaftLength / 2;
    aimGlow.material.opacity = 0.18 + pulse * 0.12;

    aimCore.scale.y = shaftLength;
    aimCore.position.x = shaftLength / 2;
    aimCore.material.opacity = 0.62 + pulse * 0.26;

    aimHead.position.x = shaftLength + headLength * 0.42;
    aimHead.material.opacity = 0.68 + pulse * 0.22;

    aimChevrons.forEach((chevron, index) => {
        const t = (index + 1) / (aimChevrons.length + 1);
        chevron.position.x = shaftLength * t;
        chevron.position.y = 0;
        chevron.scale.setScalar(0.72 + pulse * 0.18);
        chevron.material.opacity = 0.34 + pulse * 0.24;
    });
}

window.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || isGuiTarget(event.target)) {
        return;
    }

    const rotatedDirection = getShotDirection(kickDirectionScratch);

    kickBall(ballBody, rotatedDirection, {
        strength: physicsConfig.strength,
        angleDeg: physicsConfig.angle,
        spin: physicsConfig.spin,
        curve: physicsConfig.aimAngle / 45
    });
    startTrail();
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') {
        resetBall(ballBody);
        resetTrail();
    } else if (event.key === '1') {
        setCameraMode('free');
    } else if (event.key === '2') {
        setCameraMode('follow');
    } else if (event.key === '3') {
        setCameraMode('top');
    } else if (event.key === '4') {
        setCameraMode('ball');
    }
});

handleResize(camera, renderer);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(Math.max(clock.getDelta(), 1 / 120), 1 / 30);
    const autoDragForce = computeAutoDrag(
        ballBody,
        physicsConfig.computedAirDensity,
        physicsConfig.dragCoefficient,
        physicsConfig.aerodynamicRadius
    );

    stepPhysics(world, ballBody, 1 / 60, delta, 4, {
        ...physicsConfig,
        autoDragForce
    });

    ball.position.copy(ballBody.position);
    ball.quaternion.copy(ballBody.quaternion);
    updateTrail();
    updateDirectionIndicator(delta);

    if (ballBody.position.y < -5) {
        resetBall(ballBody);
        resetTrail();
    }

    updateCamera(delta);
    controls.update();
    renderer.render(scene, camera);
}

animate();
