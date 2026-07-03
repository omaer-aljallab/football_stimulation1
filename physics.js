import * as THREE from 'three';

const DEFAULT_GRAVITY = 9.81;
const FIELD_HALF_WIDTH = 34;
const FIELD_HALF_LENGTH = 52.5;
const BALL_MASS = 0.43;
const BALL_RADIUS = 0.22;
const AERODYNAMIC_RADIUS = 0.11;
const BALL_VOLUME = (4 / 3) * Math.PI * AERODYNAMIC_RADIUS ** 3;
const BALL_INERTIA_FACTOR = 2 / 5;
const STOP_SPEED = 0.035;
const RESTING_VERTICAL_SPEED = 0.35;
const MAX_KICK_BACKSPIN = 55;
const MAX_KICK_SIDESPIN = 45;
const GOAL_WIDTH = 7.32;
const GOAL_HEIGHT = 2.44;
const GOAL_DEPTH = 2.25;
const AIR_SPIN_DAMPING = 0.05;
const GROUND_SPIN_DAMPING = 1.25;
const MAX_KICK_ANGULAR_SPEED = 70;
const IMPACT_LINEAR_SIDE = 0.42;
const IMPACT_LINEAR_LIFT = 0.88;
const IMPACT_SPIN_TRANSFER = 0.2;

const scratchForce = new THREE.Vector3();
const scratchVector = new THREE.Vector3();
const scratchNormal = new THREE.Vector3();
const scratchImpulse = new THREE.Vector3();
const scratchPosition = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3(0, 1, 0);
const scratchContact = new THREE.Vector3();
const scratchLaunch = new THREE.Vector3();
const NORMAL_POS_X = new THREE.Vector3(1, 0, 0);
const NORMAL_NEG_X = new THREE.Vector3(-1, 0, 0);
const NORMAL_POS_Z = new THREE.Vector3(0, 0, 1);
const NORMAL_NEG_Z = new THREE.Vector3(0, 0, -1);

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function makeMaterial(friction = 0.5, restitution = 0.7) {
    return { friction, restitution };
}

function getHorizontalSpeed(body) {
    return Math.hypot(body.velocity.x, body.velocity.z);
}

function isFiniteVector(vector) {
    return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function getBallInertia(body) {
    return body.inertia || BALL_INERTIA_FACTOR * body.mass * body.radius ** 2;
}

function clampImpactPoint(point = {}) {
    let x = clamp(Number(point.x ?? 0), -0.92, 0.92);
    let y = clamp(Number(point.y ?? 0), -0.92, 0.92);
    const length = Math.hypot(x, y);

    if (length > 0.92) {
        x = x / length * 0.92;
        y = y / length * 0.92;
    }

    return { x, y };
}

export function computeImpactLaunchDirection(direction, impactPoint = {}, target = scratchLaunch) {
    const horizontalDirection = target.set(direction.x, 0, direction.z);
    if (horizontalDirection.lengthSq() < 1e-6) {
        horizontalDirection.set(0, 0, -1);
    }
    horizontalDirection.normalize();

    const impact = clampImpactPoint(impactPoint);
    scratchRight.set(-horizontalDirection.z, 0, horizontalDirection.x).normalize();

    return target
        .copy(horizontalDirection)
        .addScaledVector(scratchRight, -impact.x * IMPACT_LINEAR_SIDE)
        .addScaledVector(scratchUp, -impact.y * IMPACT_LINEAR_LIFT)
        .normalize();
}

function getAirDensity(config) {
    return Number(config.computedAirDensity ?? config.airDensity ?? 1.225);
}

function getGravity(world, config = {}) {
    const candidate = Number(config.gravity ?? Math.abs(world?.gravity?.y ?? DEFAULT_GRAVITY));
    return clamp(Number.isFinite(candidate) ? candidate : DEFAULT_GRAVITY, 0, 35);
}

function isInsideGoalMouth(body) {
    return Math.abs(body.position.x) <= GOAL_WIDTH / 2 - body.radius * 0.2
        && body.position.y <= GOAL_HEIGHT - body.radius * 0.15;
}

function resolvePlaneCollision(body, normal, distanceToPlane, contactMaterial) {
    const penetration = body.radius - distanceToPlane;
    if (penetration <= 0) return;

    body.position.addScaledVector(normal, penetration + 0.0005);

    const normalVelocity = body.velocity.dot(normal);
    if (normalVelocity < 0) {
        const restitution = clamp(contactMaterial.restitution, 0, 0.9);
        body.velocity.addScaledVector(normal, -(1 + restitution) * normalVelocity);
    }

    const tangentVelocity = scratchVector.copy(body.velocity).addScaledVector(normal, -body.velocity.dot(normal));
    const tangentSpeed = tangentVelocity.length();
    if (tangentSpeed > 0.0001) {
        const frictionDrop = clamp(contactMaterial.friction, 0, 1) * 0.12;
        body.velocity.addScaledVector(tangentVelocity, -Math.min(frictionDrop, 1));
    }
}

function resolveGroundCollision(body, contactMaterial) {
    if (body.position.y >= body.radius) return;

    body.position.y = body.radius;

    if (body.velocity.y < -RESTING_VERTICAL_SPEED) {
        body.velocity.y = -body.velocity.y * clamp(contactMaterial.restitution, 0, 0.82);
    } else if (body.velocity.y < 0) {
        body.velocity.y = 0;
    }

}

function applyGroundContact(body, contactMaterial, dt, rollingResistance = 0.015, gravity = DEFAULT_GRAVITY) {
    if (!isOnGround(body, body.radius, 0.015) || body.velocity.y > 0.2) return;

    const friction = clamp(contactMaterial.friction, 0, 1);
    const radius = body.radius;
    const inertia = getBallInertia(body);

    const slipX = body.velocity.x + body.angularVelocity.z * radius;
    const slipZ = body.velocity.z - body.angularVelocity.x * radius;
    const slipSpeed = Math.hypot(slipX, slipZ);

    if (slipSpeed > 0.001 && friction > 0) {
        const effectiveMassInv = 1 / body.mass + radius ** 2 / inertia;
        const desiredImpulse = slipSpeed / effectiveMassInv;
        const maxImpulse = friction * body.mass * gravity * dt;
        const impulseMagnitude = Math.min(desiredImpulse, maxImpulse);

        scratchImpulse.set(
            -slipX / slipSpeed * impulseMagnitude,
            0,
            -slipZ / slipSpeed * impulseMagnitude
        );

        body.velocity.x += scratchImpulse.x / body.mass;
        body.velocity.z += scratchImpulse.z / body.mass;
        body.angularVelocity.x += (-radius * scratchImpulse.z) / inertia;
        body.angularVelocity.z += (radius * scratchImpulse.x) / inertia;
    }

    const speed = getHorizontalSpeed(body);
    const resistance = clamp(Number(rollingResistance), 0, 0.2);
    if (speed > 0.0001 && resistance > 0) {
        const drop = Math.min(speed, resistance * gravity * dt * (1 + friction * 0.35));
        body.velocity.x -= (body.velocity.x / speed) * drop;
        body.velocity.z -= (body.velocity.z / speed) * drop;
    }

    const updatedSpeed = getHorizontalSpeed(body);
    if (updatedSpeed < STOP_SPEED && slipSpeed < STOP_SPEED * 1.8 && Math.abs(body.velocity.y) < 0.02) {
        body.velocity.x = 0;
        body.velocity.z = 0;
        body.angularVelocity.x = 0;
        body.angularVelocity.z = 0;
    }

    const groundDamping = Math.exp(-(GROUND_SPIN_DAMPING * friction + resistance * 8) * dt);
    body.angularVelocity.y *= groundDamping;
}

function resolveVerticalPostCollision(body, post, contactMaterial) {
    const travelX = body.position.x - body.previousPosition.x;
    const travelY = body.position.y - body.previousPosition.y;
    const travelZ = body.position.z - body.previousPosition.z;
    const travelLengthSq = travelX ** 2 + travelZ ** 2;
    let closestX = body.position.x;
    let closestY = body.position.y;
    let closestZ = body.position.z;

    if (travelLengthSq > 1e-8) {
        const t = clamp(
            ((post.x - body.previousPosition.x) * travelX + (post.z - body.previousPosition.z) * travelZ) / travelLengthSq,
            0,
            1
        );
        closestX = body.previousPosition.x + travelX * t;
        closestY = body.previousPosition.y + travelY * t;
        closestZ = body.previousPosition.z + travelZ * t;
    }

    if (closestY > post.height + body.radius || closestY < -body.radius) return;

    const dx = closestX - post.x;
    const dz = closestZ - post.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = body.radius + post.radius;
    if (distance <= 0.0001 || distance >= minDistance) return;

    const normal = scratchNormal.set(dx / distance, 0, dz / distance);
    body.position.x = closestX + normal.x * (minDistance + 0.0005);
    body.position.z = closestZ + normal.z * (minDistance + 0.0005);

    const normalVelocity = body.velocity.dot(normal);
    if (normalVelocity < 0) {
        body.velocity.addScaledVector(normal, -(1 + clamp(contactMaterial.restitution, 0, 0.9)) * normalVelocity);
        body.velocity.multiplyScalar(1 - clamp(contactMaterial.friction, 0, 1) * 0.04);
    }
}

function resolveCrossbarCollision(body, bar, contactMaterial) {
    const testPoints = [
        body.position,
        scratchPosition.copy(body.previousPosition).lerp(body.position, 0.5)
    ];

    for (const point of testPoints) {
        const closestX = clamp(point.x, bar.minX, bar.maxX);
        const closestY = clamp(point.y, bar.y - bar.radius, bar.y + bar.radius);
        const closestZ = bar.z;

        const offset = scratchForce.set(
            point.x - closestX,
            point.y - closestY,
            point.z - closestZ
        );
        const distance = offset.length();
        const minDistance = body.radius + bar.radius;
        if (distance <= 0.0001 || distance >= minDistance) continue;

        const normal = offset.multiplyScalar(1 / distance);
        body.position.copy(point).addScaledVector(normal, minDistance + 0.0005);

        const normalVelocity = body.velocity.dot(normal);
        if (normalVelocity < 0) {
            body.velocity.addScaledVector(normal, -(1 + clamp(contactMaterial.restitution, 0, 0.9)) * normalVelocity);
            body.velocity.multiplyScalar(1 - clamp(contactMaterial.friction, 0, 1) * 0.04);
        }
        return;
    }
}

function resolveGoalBackCollision(body, collider) {
    if (Math.abs(body.position.x) > collider.halfWidth + body.radius || body.position.y > collider.height + body.radius) {
        return;
    }

    const normal = collider.side < 0 ? NORMAL_POS_Z : NORMAL_NEG_Z;
    const distanceToPlane = collider.side < 0
        ? body.position.z - collider.z
        : collider.z - body.position.z;
    resolvePlaneCollision(body, normal, distanceToPlane, collider.material);
}

function resolveGoalSideCollision(body, collider) {
    if (body.position.y > collider.height + body.radius) return;
    if (body.position.z < collider.minZ - body.radius || body.position.z > collider.maxZ + body.radius) return;

    const isLeftSide = collider.x < 0;
    const normal = isLeftSide ? NORMAL_POS_X : NORMAL_NEG_X;
    const distanceToPlane = isLeftSide
        ? body.position.x - collider.x
        : collider.x - body.position.x;
    resolvePlaneCollision(body, normal, distanceToPlane, collider.material);
}

function updateBallRotation(body, dt) {
    if (isOnGround(body, body.radius, 0.025)) {
        const dx = body.position.x - body.previousPosition.x;
        const dz = body.position.z - body.previousPosition.z;
        const distance = Math.hypot(dx, dz);

        if (distance > 0.00001) {
            const rollingAxis = scratchVector.set(dz, 0, -dx).normalize();
            const rollingRotation = new THREE.Quaternion().setFromAxisAngle(rollingAxis, distance / body.radius);
            body.quaternion.premultiply(rollingRotation).normalize();
        }

        if (Math.abs(body.angularVelocity.y) > 0.0001) {
            const yawRotation = new THREE.Quaternion().setFromAxisAngle(scratchNormal.set(0, 1, 0), body.angularVelocity.y * dt);
            body.quaternion.premultiply(yawRotation).normalize();
        }

        return;
    }

    const angularSpeed = body.angularVelocity.length();
    if (angularSpeed < 0.0001) return;

    const deltaRotation = new THREE.Quaternion().setFromAxisAngle(
        scratchVector.copy(body.angularVelocity).normalize(),
        angularSpeed * dt
    );
    body.quaternion.premultiply(deltaRotation).normalize();
}

export function createPhysicsWorld() {
    const groundMaterial = makeMaterial(0.5, 0.7);
    const ballMaterial = makeMaterial(0.5, 0.7);
    const ballGroundContact = makeMaterial(0.5, 0.7);

    const world = {
        gravity: new THREE.Vector3(0, -DEFAULT_GRAVITY, 0),
        colliders: [],
        contactMaterial: ballGroundContact,
        groundMaterial,
        ballMaterial,
        ballGroundContact
    };

    return {
        world,
        groundMaterial,
        ballMaterial,
        ballGroundContact
    };
}

export function updateContactMaterial(contactMaterial, friction, restitution) {
    contactMaterial.friction = clamp(Number(friction), 0, 1);
    contactMaterial.restitution = clamp(Number(restitution), 0, 0.9);
}

export function computeAirDrag(body, dragCoefficient = 0.25, airDensity = 1.225, radius = AERODYNAMIC_RADIUS) {
    return computeAutoDrag(body, airDensity, dragCoefficient, radius);
}

export function computeAutoDrag(body, airDensity = 1.225, dragCoefficient = 0.25, ballRadius = AERODYNAMIC_RADIUS) {
    const density = Number(airDensity);
    const coefficient = clamp(Number(dragCoefficient), 0, 1.5);
    const radius = Number(ballRadius ?? body?.aerodynamicRadius ?? AERODYNAMIC_RADIUS);
    if (!body || body.mass <= 0 || coefficient <= 0 || density <= 0 || radius <= 0) return null;

    const speed = body.velocity.length();
    if (speed < 0.03) return null;

    const area = Math.PI * radius ** 2;
    const magnitude = 0.5 * density * coefficient * area * speed ** 2;
    return body.velocity.clone().multiplyScalar(-magnitude / speed);
}

export function updateGravity(world, gravity = DEFAULT_GRAVITY) {
    const gravityValue = clamp(Number(gravity), 0, 35);
    if (world?.gravity) {
        world.gravity.set(0, -gravityValue, 0);
    }
    return gravityValue;
}

export function computeMagnusForce(body, magnusCoefficient = 0.25, airDensity = 1.225, aerodynamicRadius = AERODYNAMIC_RADIUS) {
    const coefficient = clamp(Number(magnusCoefficient), 0, 1.5);
    const density = Number(airDensity);
    const radius = Number(aerodynamicRadius ?? body?.aerodynamicRadius ?? AERODYNAMIC_RADIUS);
    if (!body || coefficient <= 0 || density <= 0 || radius <= 0) return null;

    const speed = body.velocity.length();
    const spinSpeed = body.angularVelocity.length();
    if (speed < 0.25 || spinSpeed < 0.25) return null;

    const area = Math.PI * radius ** 2;
    const spinRatio = clamp((radius * spinSpeed) / speed, 0, 1.4);
    const liftCoefficient = clamp(1.15 * spinRatio, 0, 0.42) * coefficient;
    const direction = body.velocity.clone().cross(body.angularVelocity);
    if (direction.lengthSq() < 1e-8) return null;

    const magnitude = 0.5 * density * area * liftCoefficient * speed ** 2;
    return direction.normalize().multiplyScalar(magnitude);
}

export function computeBuoyancy(body, buoyancyCoefficient = 1, airDensity = 1.225, gravity = DEFAULT_GRAVITY) {
    if (!body || buoyancyCoefficient <= 0) return null;
    return new THREE.Vector3(0, airDensity * BALL_VOLUME * gravity * buoyancyCoefficient, 0);
}

export function isOnGround(body, radius = BALL_RADIUS, threshold = 0.02) {
    return body.position.y <= radius + threshold;
}

export function computeRollingResistance(body, rollingResistance = 0.015, gravity = DEFAULT_GRAVITY) {
    if (!body || rollingResistance <= 0 || !isOnGround(body)) return null;

    const speed = getHorizontalSpeed(body);
    if (speed < STOP_SPEED) return null;

    const normalForce = body.mass * gravity;
    const magnitude = clamp(Number(rollingResistance), 0, 0.2) * normalForce;
    return new THREE.Vector3(
        -body.velocity.x / speed * magnitude,
        0,
        -body.velocity.z / speed * magnitude
    );
}

export function createGroundBody(world) {
    world.ground = { type: 'ground', y: 0 };
    return world.ground;
}

export function createBallBody(world, ballMaterial, position = { x: 0, y: BALL_RADIUS, z: 0 }) {
    const initialY = Math.max(Number(position.y ?? BALL_RADIUS), BALL_RADIUS);
    const ballBody = {
        mass: BALL_MASS,
        radius: BALL_RADIUS,
        aerodynamicRadius: AERODYNAMIC_RADIUS,
        position: new THREE.Vector3(position.x, initialY, position.z),
        previousPosition: new THREE.Vector3(position.x, initialY, position.z),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        force: new THREE.Vector3(),
        torque: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        inertia: BALL_INERTIA_FACTOR * BALL_MASS * BALL_RADIUS ** 2,
        material: ballMaterial,
        wakeUp() {}
    };

    world.ball = ballBody;
    return { ballBody, ballRadius: BALL_RADIUS };
}

export function createFieldBounds(world, halfWidth = FIELD_HALF_WIDTH, halfLength = FIELD_HALF_LENGTH) {
    world.bounds = { halfWidth, halfLength };
    return world.bounds;
}

function addGoalColliders(world, zPosition = -FIELD_HALF_LENGTH) {
    const postRadius = 0.1;
    const halfWidth = GOAL_WIDTH / 2;
    const side = zPosition < 0 ? -1 : 1;
    const backZ = zPosition + side * GOAL_DEPTH;
    const minZ = Math.min(zPosition, backZ);
    const maxZ = Math.max(zPosition, backZ);
    const netMaterial = makeMaterial(0.82, 0.12);

    const colliders = [
        { type: 'post', x: -halfWidth, z: zPosition, radius: postRadius, height: GOAL_HEIGHT },
        { type: 'post', x: halfWidth, z: zPosition, radius: postRadius, height: GOAL_HEIGHT },
        {
            type: 'crossbar',
            minX: -halfWidth,
            maxX: halfWidth,
            y: GOAL_HEIGHT,
            z: zPosition,
            radius: postRadius
        },
        {
            type: 'goalBack',
            z: backZ,
            side,
            halfWidth,
            height: GOAL_HEIGHT,
            material: netMaterial
        },
        {
            type: 'goalSide',
            x: -halfWidth,
            minZ,
            maxZ,
            height: GOAL_HEIGHT,
            material: netMaterial
        },
        {
            type: 'goalSide',
            x: halfWidth,
            minZ,
            maxZ,
            height: GOAL_HEIGHT,
            material: netMaterial
        }
    ];

    world.colliders.push(...colliders);
    return colliders;
}

export function createGoalPhysics(world, zPosition = -FIELD_HALF_LENGTH) {
    return addGoalColliders(world, zPosition);
}

export function createSecondGoalPhysics(world, zPosition = FIELD_HALF_LENGTH) {
    return addGoalColliders(world, zPosition);
}

export function kickBall(ballBody, direction, options = {}) {
    const strength = clamp(Number(options.strength ?? 18), 0, 42);
    const impact = clampImpactPoint(options.impactPoint);

    const horizontalDirection = new THREE.Vector3(direction.x, 0, direction.z);
    if (horizontalDirection.lengthSq() < 1e-6) {
        horizontalDirection.set(0, 0, -1);
    }
    horizontalDirection.normalize();
    scratchRight.set(-horizontalDirection.z, 0, horizontalDirection.x).normalize();
    computeImpactLaunchDirection(horizontalDirection, impact, scratchLaunch);

    ballBody.position.y = Math.max(ballBody.position.y, ballBody.radius + 0.01);
    ballBody.velocity.copy(scratchLaunch).multiplyScalar(strength);

    const surfaceDepth = Math.sqrt(Math.max(0.08, 1 - impact.x ** 2 - impact.y ** 2));
    scratchContact
        .copy(horizontalDirection).multiplyScalar(-surfaceDepth * ballBody.radius)
        .addScaledVector(scratchRight, impact.x * ballBody.radius)
        .addScaledVector(scratchUp, impact.y * ballBody.radius);

    scratchImpulse.copy(scratchLaunch).multiplyScalar(ballBody.mass * strength);
    ballBody.angularVelocity
        .copy(scratchContact)
        .cross(scratchImpulse)
        .multiplyScalar(IMPACT_SPIN_TRANSFER / getBallInertia(ballBody));

    const angularSpeed = ballBody.angularVelocity.length();
    if (angularSpeed > MAX_KICK_ANGULAR_SPEED) {
        ballBody.angularVelocity.multiplyScalar(MAX_KICK_ANGULAR_SPEED / angularSpeed);
    }

    ballBody.wakeUp();
}

export function resetBall(ballBody) {
    ballBody.position.set(0, ballBody.radius, 0);
    ballBody.previousPosition.copy(ballBody.position);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.force.set(0, 0, 0);
    ballBody.torque.set(0, 0, 0);
    ballBody.quaternion.identity();
    ballBody.wakeUp();
}

function applyForces(world, body, config) {
    const gravity = getGravity(world, config);
    body.force.set(0, -body.mass * gravity, 0);
    const airDensity = getAirDensity(config);
    const aerodynamicRadius = Number(config.aerodynamicRadius ?? body.aerodynamicRadius ?? AERODYNAMIC_RADIUS);

    if (config.autoDragForce) {
        body.force.add(config.autoDragForce);
    } else {
        const drag = computeAutoDrag(body, airDensity, config.dragCoefficient, aerodynamicRadius);
        if (drag) body.force.add(drag);
    }

    const magnus = computeMagnusForce(body, config.magnus, airDensity, aerodynamicRadius);
    if (magnus) body.force.add(magnus);

    if (config.buoyancy > 0) {
        const buoyancy = computeBuoyancy(body, config.buoyancy, airDensity, gravity);
        if (buoyancy) body.force.add(buoyancy);
    }
}

function resolveCollisions(world, body) {
    const contact = world.contactMaterial;
    resolveGroundCollision(body, contact);

    const bounds = world.bounds || { halfWidth: FIELD_HALF_WIDTH, halfLength: FIELD_HALF_LENGTH };
    resolvePlaneCollision(body, NORMAL_POS_X, body.position.x + bounds.halfWidth, contact);
    resolvePlaneCollision(body, NORMAL_NEG_X, bounds.halfWidth - body.position.x, contact);

    if (!isInsideGoalMouth(body)) {
        resolvePlaneCollision(body, NORMAL_POS_Z, body.position.z + bounds.halfLength, contact);
        resolvePlaneCollision(body, NORMAL_NEG_Z, bounds.halfLength - body.position.z, contact);
    }

    world.colliders.forEach((collider) => {
        if (collider.type === 'post') {
            resolveVerticalPostCollision(body, collider, contact);
        } else if (collider.type === 'crossbar') {
            resolveCrossbarCollision(body, collider, contact);
        } else if (collider.type === 'goalBack') {
            resolveGoalBackCollision(body, collider);
        } else if (collider.type === 'goalSide') {
            resolveGoalSideCollision(body, collider);
        }
    });
}

function enforceRolling(body, dt, rollingResistance) {
    if (!isOnGround(body)) return;

    const horizontalSpeed = getHorizontalSpeed(body);
    if (horizontalSpeed < STOP_SPEED) {
        body.velocity.x = 0;
        body.velocity.z = 0;
        body.angularVelocity.multiplyScalar(0.5);
        return;
    }

    const targetAngular = scratchVector.set(
        body.velocity.z / body.radius,
        body.angularVelocity.y,
        -body.velocity.x / body.radius
    );
    const slipX = body.velocity.x + body.angularVelocity.z * body.radius;
    const slipZ = body.velocity.z - body.angularVelocity.x * body.radius;
    const slipSpeed = Math.hypot(slipX, slipZ);
    const slipRatio = clamp(slipSpeed / Math.max(horizontalSpeed, 0.001), 0, 1);
    const blend = clamp((10 + rollingResistance * 45) * dt * (1.15 - slipRatio * 0.35), 0.08, 0.72);
    body.angularVelocity.lerp(targetAngular, blend);
}

function applySpinDamping(body, dt, config) {
    const airDensity = getAirDensity(config);
    const speed = body.velocity.length();
    const airDamping = Math.exp(-(AIR_SPIN_DAMPING + speed * 0.003 * airDensity) * dt);
    body.angularVelocity.multiplyScalar(airDamping);
}

export function stepPhysics(world, ballBody, timeStep = 1 / 60, deltaTime = timeStep, maxSubSteps = 4, config = {}) {
    if (!ballBody) return;

    const totalDelta = clamp(deltaTime, 1 / 120, 1 / 24);
    const steps = Math.max(1, Math.min(maxSubSteps, Math.ceil(totalDelta / timeStep)));
    const dt = totalDelta / steps;
    const gravity = getGravity(world, config);

    for (let i = 0; i < steps; i += 1) {
        ballBody.previousPosition.copy(ballBody.position);
        applyForces(world, ballBody, config);

        if (!isFiniteVector(ballBody.force)) {
            ballBody.force.set(0, -ballBody.mass * gravity, 0);
        }

        ballBody.velocity.addScaledVector(ballBody.force, dt / ballBody.mass);
        ballBody.velocity.multiplyScalar(Math.max(0, 1 - 0.002 * dt));
        applySpinDamping(ballBody, dt, config);

        ballBody.position.addScaledVector(ballBody.velocity, dt);
        resolveCollisions(world, ballBody);
        applyGroundContact(ballBody, world.contactMaterial, dt, Number(config.rollingResistance ?? 0.015), gravity);
        enforceRolling(ballBody, dt, Number(config.rollingResistance ?? 0.015));
        updateBallRotation(ballBody, dt);
    }
}
