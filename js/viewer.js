/* ──────────────────────────────────────────────────────────
   viewer.js — Shared Three.js GLB viewer (Sentinel 001 style)
   Exposes window.ModelViewer as a classic-script IIFE.
   Handles Draco-compressed models via DRACOLoader.
────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.163.0';
  var DRACO_PATH = CDN + '/examples/jsm/libs/draco/';

  /* Zoom / spin thresholds */
  var MIN_DISTANCE = 0.4;
  var MAX_DISTANCE = 3.0;
  var DEFAULT_DISTANCE = 1.24; /* ~length of vec(0, 0.3, 1.2) */
  var CLOSE_ZOOM_THRESHOLD = 0.7; /* stop spin when closer than this */

  var THREE, GLTFLoader, DRACOLoader, OrbitControls;
  var renderer, scene, camera, controls, modelGroup, rafId;
  var _canvas = null;
  var _src = null;
  var _loaded = false;
  var _autoSpin = true;
  var _userInteracted = false;
  var _resetBtn = null;
  var _defaultCamPos = null;
  var _defaultTarget = null;

  async function importDeps() {
    if (THREE) return;
    var results = await Promise.all([
      import(CDN + '/build/three.module.js'),
      import(CDN + '/examples/jsm/loaders/GLTFLoader.js'),
      import(CDN + '/examples/jsm/loaders/DRACOLoader.js'),
      import(CDN + '/examples/jsm/controls/OrbitControls.js'),
    ]);
    THREE = results[0];
    GLTFLoader = results[1].GLTFLoader;
    DRACOLoader = results[2].DRACOLoader;
    OrbitControls = results[3].OrbitControls;
  }

  function createResetButton() {
    if (_resetBtn) return;
    _resetBtn = document.createElement('button');
    _resetBtn.textContent = 'Reset View';
    _resetBtn.className = 'viewer-reset-btn';
    _resetBtn.addEventListener('click', resetView);
    _canvas.parentElement.appendChild(_resetBtn);
  }

  function showResetButton() {
    if (!_resetBtn) createResetButton();
    _resetBtn.classList.add('visible');
  }

  function hideResetButton() {
    if (_resetBtn) _resetBtn.classList.remove('visible');
  }

  function resetView() {
    if (!controls || !camera || !_defaultCamPos) return;
    /* Animate camera back to default position */
    var startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    var startTarget = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
    var startTime = performance.now();
    var duration = 400;

    function tick(now) {
      var t = Math.min((now - startTime) / duration, 1);
      /* ease-out cubic */
      var e = 1 - Math.pow(1 - t, 3);
      camera.position.set(
        startPos.x + (_defaultCamPos.x - startPos.x) * e,
        startPos.y + (_defaultCamPos.y - startPos.y) * e,
        startPos.z + (_defaultCamPos.z - startPos.z) * e
      );
      controls.target.set(
        startTarget.x + (_defaultTarget.x - startTarget.x) * e,
        startTarget.y + (_defaultTarget.y - startTarget.y) * e,
        startTarget.z + (_defaultTarget.z - startTarget.z) * e
      );
      controls.update();
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        _autoSpin = true;
        _userInteracted = false;
        hideResetButton();
      }
    }
    requestAnimationFrame(tick);
  }

  function onControlsChange() {
    if (!controls || !camera) return;
    var dist = camera.position.distanceTo(controls.target);

    /* Stop spin when zoomed in close */
    _autoSpin = dist >= CLOSE_ZOOM_THRESHOLD;

    /* Show reset button when user has moved the view */
    if (!_userInteracted) {
      _userInteracted = true;
    }
    showResetButton();
  }

  async function init(canvas) {
    if (renderer) return;
    _canvas = canvas;
    await importDeps();

    renderer = new THREE.WebGLRenderer({ canvas: _canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x080808);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 0.3, 1.2);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.enabled = false;

    controls.addEventListener('change', onControlsChange);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 4);
    scene.add(dir);

    resize();
    animate();
  }

  function resize() {
    if (!renderer || !_canvas) return;
    var container = _canvas.parentElement;
    var w = container.clientWidth || 600;
    var h = container.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (modelGroup && _autoSpin) modelGroup.rotation.y += 0.003;
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function disposeModel() {
    if (modelGroup && scene) {
      scene.remove(modelGroup);
      modelGroup.traverse(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(function (m) { m.dispose(); });
          else c.material.dispose();
        }
      });
      modelGroup = null;
    }
    _loaded = false;
    _src = null;
    _autoSpin = true;
    _userInteracted = false;
    hideResetButton();
  }

  function load(url) {
    return new Promise(function (resolve, reject) {
      if (!renderer) { reject(new Error('Call init() first')); return; }

      disposeModel();

      var dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(DRACO_PATH);

      var loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        url,
        function (gltf) {
          var group = new THREE.Group();
          var root = gltf.scene;

          /* Sentinel 001: dark solid + white wireframe edges */
          var baseMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.4,
            roughness: 0.6,
          });
          var edgeMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            opacity: 0.55,
            transparent: true,
          });

          root.traverse(function (child) {
            if (child.isMesh) {
              child.material = baseMat;
              var edges = new THREE.EdgesGeometry(child.geometry, 20);
              var lines = new THREE.LineSegments(edges, edgeMat);
              child.add(lines);
            }
          });

          group.add(root);

          /* Auto-center and scale to fit */
          var box = new THREE.Box3().setFromObject(group);
          var center = box.getCenter(new THREE.Vector3());
          var size = box.getSize(new THREE.Vector3());
          var maxDim = Math.max(size.x, size.y, size.z);
          var scale = 0.8 / maxDim;
          group.scale.setScalar(scale);
          group.position.sub(center.multiplyScalar(scale));

          scene.add(group);
          modelGroup = group;
          _loaded = true;
          _src = url;
          _autoSpin = true;
          _userInteracted = false;

          /* Store default camera state for reset */
          _defaultCamPos = camera.position.clone();
          _defaultTarget = controls.target.clone();

          controls.enabled = true;
          resize();
          hideResetButton();
          resolve();
        },
        undefined,
        function (err) {
          reject(err);
        }
      );
    });
  }

  function unload() {
    disposeModel();
  }

  function setVisible(visible) {
    if (!_canvas) return;
    if (visible) {
      _canvas.style.visibility = 'visible';
      _canvas.style.pointerEvents = 'auto';
      if (controls) controls.enabled = true;
    } else {
      _canvas.style.visibility = 'hidden';
      _canvas.style.pointerEvents = 'none';
      if (controls) controls.enabled = false;
    }
  }

  window.ModelViewer = {
    init: init,
    load: load,
    unload: unload,
    setVisible: setVisible,
    resize: resize,
    isLoaded: function () { return _loaded; },
    currentSrc: function () { return _src; },
  };
})();
