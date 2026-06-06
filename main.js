import * as THREE from 'three';
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

const uiElements = {
    kickStrength: document.getElementById('kickStrength'),
    launchAngle: document.getElementById('launchAngle'),
    spin: document.getElementById('spin'),
    aimAngle: document.getElementById('aimAngle'),
    friction: document.getElementById('friction'),
    restitution: document.getElementById('restitution'),
    gravity: document.getElementById('gravity'),
    airDensity: document.getElementById('airDensity'),
    temperature: document.getElementById('temperature'),
    magnus: document.getElementById('magnus'),
    rollingResistance: document.getElementById('rollingResistance'),
    kickStrengthValue: document.getElementById('kickStrengthValue'),
    launchAngleValue: document.getElementById('launchAngleValue'),
    spinValue: document.getElementById('spinValue'),
    aimAngleValue: document.getElementById('aimAngleValue'),
    frictionValue: document.getElementById('frictionValue'),
    restitutionValue: document.getElementById('restitutionValue'),
    gravityValue: document.getElementById('gravityValue'),
    airDensityValue: document.getElementById('airDensityValue'),
    temperatureValue: document.getElementById('temperatureValue'),
    computedDensityValue: document.getElementById('computedDensityValue'),
    magnusValue: document.getElementById('magnusValue'),
    rollingResistanceValue: document.getElementById('rollingResistanceValue'),
    resetBallBtn: document.getElementById('resetBallBtn'),
    controlsPanel: document.getElementById('controlsPanel'),
    cameraFreeBtn: document.getElementById('cameraFreeBtn'),
    cameraFollowBtn: document.getElementById('cameraFollowBtn'),
    cameraTopBtn: document.getElementById('cameraTopBtn'),
    cameraBallBtn: document.getElementById('cameraBallBtn')
};

function updateUIValue(element, displayElement, value, formatter = (v) => v) {
    element.value = value;
    displayElement.textContent = formatter(value);
}

function applyPhysicsConfig() {
    updateContactMaterial(ballGroundContact, physicsConfig.friction, physicsConfig.restitution);
    updateGravity(world, physicsConfig.gravity);
}

function updateComputedDensityDisplay() {
    uiElements.computedDensityValue.textContent = physicsConfig.computedAirDensity.toFixed(3);
}

function updateFromSlider(element, key, displayElement, formatter = (v) => v) {
    element.addEventListener('input', (event) => {
        physicsConfig[key] = Number(event.target.value);
        displayElement.textContent = formatter(physicsConfig[key]);

        if (key === 'airDensity' || key === 'temperature') {
            updateComputedDensityDisplay();
        }

        if (key === 'friction' || key === 'restitution' || key === 'gravity') {
            applyPhysicsConfig();
        }
    });
}

updateUIValue(uiElements.kickStrength, uiElements.kickStrengthValue, physicsConfig.strength);
updateUIValue(uiElements.launchAngle, uiElements.launchAngleValue, physicsConfig.angle, (v) => `${v}°`);
updateUIValue(uiElements.spin, uiElements.spinValue, physicsConfig.spin);
updateUIValue(uiElements.aimAngle, uiElements.aimAngleValue, physicsConfig.aimAngle, (v) => `${v}°`);
updateUIValue(uiElements.friction, uiElements.frictionValue, physicsConfig.friction, (v) => v.toFixed(2));
updateUIValue(uiElements.restitution, uiElements.restitutionValue, physicsConfig.restitution, (v) => v.toFixed(2));
updateUIValue(uiElements.gravity, uiElements.gravityValue, physicsConfig.gravity, (v) => `${v.toFixed(2)} m/s^2`);
updateUIValue(uiElements.airDensity, uiElements.airDensityValue, physicsConfig.airDensity, (v) => `${v.toFixed(3)} kg/m³`);
updateUIValue(uiElements.temperature, uiElements.temperatureValue, physicsConfig.temperature, (v) => `${v}°C`);
updateUIValue(uiElements.magnus, uiElements.magnusValue, physicsConfig.magnus, (v) => v.toFixed(2));
updateUIValue(uiElements.rollingResistance, uiElements.rollingResistanceValue, physicsConfig.rollingResistance, (v) => v.toFixed(3));
updateComputedDensityDisplay();

updateFromSlider(uiElements.kickStrength, 'strength', uiElements.kickStrengthValue);
updateFromSlider(uiElements.launchAngle, 'angle', uiElements.launchAngleValue, (v) => `${v}°`);
updateFromSlider(uiElements.spin, 'spin', uiElements.spinValue);
updateFromSlider(uiElements.aimAngle, 'aimAngle', uiElements.aimAngleValue, (v) => `${v}°`);
updateFromSlider(uiElements.friction, 'friction', uiElements.frictionValue, (v) => v.toFixed(2));
updateFromSlider(uiElements.restitution, 'restitution', uiElements.restitutionValue, (v) => v.toFixed(2));
updateFromSlider(uiElements.gravity, 'gravity', uiElements.gravityValue, (v) => `${v.toFixed(2)} m/s^2`);
updateFromSlider(uiElements.airDensity, 'airDensity', uiElements.airDensityValue, (v) => `${v.toFixed(3)} kg/m³`);
updateFromSlider(uiElements.temperature, 'temperature', uiElements.temperatureValue, (v) => `${v}°C`);
updateFromSlider(uiElements.magnus, 'magnus', uiElements.magnusValue, (v) => v.toFixed(2));
updateFromSlider(uiElements.rollingResistance, 'rollingResistance', uiElements.rollingResistanceValue, (v) => v.toFixed(3));
applyPhysicsConfig();

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

const cameraButtons = {
    free: uiElements.cameraFreeBtn,
    follow: uiElements.cameraFollowBtn,
    top: uiElements.cameraTopBtn,
    ball: uiElements.cameraBallBtn
};

function setCameraMode(mode) {
    cameraState.mode = mode;
    controls.enableRotate = mode === 'free';
    controls.enablePan = mode === 'free';

    Object.entries(cameraButtons).forEach(([key, button]) => {
        button.classList.toggle('active', key === mode);
    });
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

setCameraMode('follow');

Object.entries(cameraButtons).forEach(([mode, button]) => {
    button.addEventListener('click', () => setCameraMode(mode));
});

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
    if (event.button !== 0 || uiElements.controlsPanel.contains(event.target)) {
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

uiElements.resetBallBtn.addEventListener('click', () => {
    resetBall(ballBody);
    resetTrail();
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
