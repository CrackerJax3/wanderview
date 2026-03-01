/**
 * controls.js — First-Person Controls for A-Frame
 * Pointer-lock mouse look + WASD movement with street-level camera.
 */

// FPS Look Controls — pointer lock mouse look
AFRAME.registerComponent('fps-look-controls', {
  schema: {
    sensitivity: { type: 'number', default: 0.002 },
    enabled: { type: 'boolean', default: true },
  },

  init: function () {
    this.pitchObject = new THREE.Object3D();
    this.yawObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);

    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.pitchAngle = 0;
    this.yawAngle = 0;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.isLocked = false;

    // Set up event listeners
    const canvas = this.el.sceneEl.canvas;
    if (canvas) {
      this._setupListeners(canvas);
    } else {
      this.el.sceneEl.addEventListener('loaded', () => {
        this._setupListeners(this.el.sceneEl.canvas);
      });
    }
  },

  _setupListeners: function (canvas) {
    canvas.addEventListener('click', this.onClick);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  },

  onClick: function () {
    if (!this.isLocked && !window._analyzerActive) {
      const canvas = this.el.sceneEl.canvas;
      if (canvas && canvas.requestPointerLock) {
        canvas.requestPointerLock();
      }
    }
  },

  onPointerLockChange: function () {
    const canvas = this.el.sceneEl.canvas;
    this.isLocked = document.pointerLockElement === canvas;
    window.dispatchEvent(new CustomEvent('pointerLockChange', { detail: { locked: this.isLocked } }));
  },

  onMouseMove: function (event) {
    if (!this.isLocked || !this.data.enabled) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.yawAngle -= movementX * this.data.sensitivity;
    this.pitchAngle -= movementY * this.data.sensitivity;

    // Clamp pitch to prevent flipping
    this.pitchAngle = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitchAngle));
  },

  tick: function () {
    if (!this.data.enabled) return;
    this.el.object3D.rotation.set(this.pitchAngle, this.yawAngle, 0, 'YXZ');
  },

  remove: function () {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    if (this.el.sceneEl.canvas) {
      this.el.sceneEl.canvas.removeEventListener('click', this.onClick);
    }
  },
});

// WASD Movement — street-level walking
AFRAME.registerComponent('wasd-movement', {
  schema: {
    speed: { type: 'number', default: 8 },
    fly: { type: 'boolean', default: false },
    sprintMultiplier: { type: 'number', default: 2.0 },
    headBobAmount: { type: 'number', default: 0.04 },
    headBobSpeed: { type: 'number', default: 8 },
  },

  init: function () {
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false, q: false, e: false };
    this.headBobTime = 0;
    this.baseY = 1.6;
    this.isMoving = false;
    this.baseFov = 75;
    this.currentFov = 75;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onWheel = this.onWheel.bind(this);

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('wheel', this.onWheel, { passive: false });
  },

  onKeyDown: function (e) {
    // Don't capture keys when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': this.keys.w = true; break;
      case 'a': case 'arrowleft': this.keys.a = true; break;
      case 's': case 'arrowdown': this.keys.s = true; break;
      case 'd': case 'arrowright': this.keys.d = true; break;
      case 'shift': this.keys.shift = true; break;
      case ' ': this.keys.space = true; break;
      case 'q': this.keys.q = true; break;
      case 'e': this.keys.e = true; break;
    }
  },

  onKeyUp: function (e) {
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': this.keys.w = false; break;
      case 'a': case 'arrowleft': this.keys.a = false; break;
      case 's': case 'arrowdown': this.keys.s = false; break;
      case 'd': case 'arrowright': this.keys.d = false; break;
      case 'shift': this.keys.shift = false; break;
      case ' ': this.keys.space = false; break;
      case 'q': this.keys.q = false; break;
      case 'e': this.keys.e = false; break;
    }
  },

  onWheel: function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    this.currentFov += e.deltaY * 0.05;
    this.currentFov = Math.max(20, Math.min(110, this.currentFov));
    this.el.setAttribute('camera', 'fov', this.currentFov);
  },

  tick: function (time, delta) {
    if (!delta) return;
    const dt = delta / 1000;

    // Vertical movement (Q = down, E = up)
    const moveY = (this.keys.e ? 1 : 0) + (this.keys.q ? -1 : 0);
    if (moveY !== 0) {
      let vertSpeed = this.data.speed;
      if (this.keys.shift) vertSpeed *= this.data.sprintMultiplier;
      this.baseY += moveY * vertSpeed * dt;
      this.baseY = Math.max(0.5, this.baseY);
    }

    // Calculate movement direction
    const moveZ = (this.keys.w ? -1 : 0) + (this.keys.s ? 1 : 0);
    const moveX = (this.keys.a ? -1 : 0) + (this.keys.d ? 1 : 0);

    this.isMoving = moveZ !== 0 || moveX !== 0;

    // Always update heading for minimap/compass, even when not moving
    const cameraEl = this.el;
    const rotation = cameraEl.object3D.rotation;
    if (window.gameEngine) {
      const rig = this.el.parentEl;
      if (rig) {
        const pos = rig.object3D.position;
        const latLng = window.gameEngine.sceneToLatLng(pos.x, pos.z);
        const headingDeg = THREE.MathUtils.radToDeg(-rotation.y) % 360;
        window.gameEngine.updatePosition(latLng.lat, latLng.lng, (headingDeg + 360) % 360);
      }
    }

    if (!this.isMoving) {
      this.headBobTime = 0;
      this.el.object3D.position.y = this.baseY;
      return;
    }

    // Forward/backward based on camera yaw only (not pitch)
    this.direction.set(0, 0, 0);

    // Forward vector (negate Z because camera looks down -Z)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.y);
    if (!this.data.fly) forward.y = 0;
    forward.normalize();

    // Right vector
    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.y);
    if (!this.data.fly) right.y = 0;
    right.normalize();

    this.direction.addScaledVector(forward, -moveZ);
    this.direction.addScaledVector(right, moveX);
    this.direction.normalize();

    // Apply speed
    let speed = this.data.speed;
    if (this.keys.shift) speed *= this.data.sprintMultiplier;

    // Move the rig (parent entity), not the camera itself
    const rig = this.el.parentEl;
    if (!rig) return;

    const pos = rig.object3D.position;
    pos.x += this.direction.x * speed * dt;
    pos.z += this.direction.z * speed * dt;

    // Head bob
    this.headBobTime += dt * this.data.headBobSpeed * (this.keys.shift ? 1.3 : 1);
    const bobOffset = Math.sin(this.headBobTime) * this.data.headBobAmount;
    this.el.object3D.position.y = this.baseY + bobOffset;
  },

  remove: function () {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('wheel', this.onWheel);
  },
});
