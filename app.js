// Load particles config from JSON and initialize
particlesJS.load('particles-js', 'particles-config.json', function() {
  console.log('particles.js loaded');
});

let scene, camera, renderer, macbook, raycaster, mouse, controls;
let mixer, clock, openAction;
let lidIsOpen = false;
let forceOpenLid = false; 

// Zoom control variables
let zoomingIn = false;
let zoomProgress = 0;
const zoomDuration = 2; // seconds

// Camera initial and target positions/lookAt
const initialCameraPos = new THREE.Vector3();
const initialLookAtPos = new THREE.Vector3(0, 0, 0); // initial look at origin

let targetCameraPos = new THREE.Vector3();
let targetLookAtPos = new THREE.Vector3();

init();

async function init() {
  scene = new THREE.Scene();

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(2, 5, 5);
  scene.add(directionalLight);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 40); // initial camera pos higher & farther
  camera.lookAt(initialLookAtPos);

  initialCameraPos.copy(camera.position);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 50;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  clock = new THREE.Clock();

  const loader = new THREE.GLTFLoader();

  try {
    const model = await new Promise((resolve, reject) => {
      loader.load('scene.gltf', resolve, undefined, reject);
    });

    macbook = model.scene;
    macbook.scale.set(120, 120, 120); // bigger scale
    macbook.position.y = -2;

    macbook.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(macbook);

    // Find screen mesh by name (case-insensitive)
    let screenMesh = null;
    macbook.traverse(child => {
      if (child.isMesh && child.name.toLowerCase().includes("screen")) {
        screenMesh = child;
      }
    });

    if (!screenMesh) {
      console.warn("Screen mesh not found by name. Using default target.");
      targetLookAtPos.set(0, 3, 0);
      targetCameraPos.set(0, 10, 12);
    } else {
      // Get world position of screen mesh center
      screenMesh.getWorldPosition(targetLookAtPos);
      // Offset camera position a bit in front and above screen
      targetCameraPos.copy(targetLookAtPos).add(new THREE.Vector3(0, 1, 2));
    }

    mixer = new THREE.AnimationMixer(macbook);
    if (model.animations.length > 0) {
      openAction = mixer.clipAction(model.animations[0]);
      openAction.loop = THREE.LoopOnce;
      openAction.clampWhenFinished = true;
      openAction.paused = true;
      openAction.time = 0;
      openAction.play();
      openAction.paused = true;
    }

    document.getElementById('loading-screen').style.display = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);

    animate();
  } catch (error) {
    console.error('Model load error:', error);
    document.getElementById('loading-screen').innerHTML =
      '<div style="color: white; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">Failed to load model. Please refresh.</div>';
  }
}

function onMouseMove(event) {
  if (!forceOpenLid) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(macbook, true);
    lidIsOpen = intersects.length > 0;
  }
}

function onKeyDown(event) {
  if (event.key === 'Enter' && !zoomingIn) {
    camera.position.copy(initialCameraPos);
    camera.lookAt(initialLookAtPos);
    
    controls.update();
    forceOpenLid = true;
    lidIsOpen = true;
    
    // Force the lid to open immediately
    if (mixer && openAction) {
      openAction.reset();
      openAction.paused = false;
      openAction.play();
      openAction.time = 0;
      openAction.timeScale = 3; // Speed up the animation
    }
    
    zoomingIn = true;
    zoomProgress = 0;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer && openAction) {
    mixer.update(delta);
    
    // When forceOpenLid is true, let the animation play naturally
    if (forceOpenLid) {
      // Don't interfere with the animation, let it play
      if (openAction.time >= openAction.getClip().duration) {
        openAction.paused = true;
      }
    } else {
      // Original mouse hover logic
      if (lidIsOpen) {
        if (openAction.time < 6) {
          openAction.paused = false;
          openAction.time = Math.min(openAction.time + delta * 3, 6);
        }
      } else {
        if (openAction.time > 0) {
          openAction.paused = false;
          openAction.time = Math.max(openAction.time - delta * 3, 0);
        } else {
          openAction.paused = true;
        }
      }
    }
  }

  if (zoomingIn) {
    zoomProgress += delta;
    let t = Math.min(zoomProgress / zoomDuration, 1);

    // Smoothstep easing:
    t = t * t * (3 - 2 * t);

    camera.position.lerpVectors(initialCameraPos, targetCameraPos, t);

    const lookAtPos = new THREE.Vector3().lerpVectors(initialLookAtPos, targetLookAtPos, t);
    camera.lookAt(lookAtPos);

    if (t >= 1) {
      zoomingIn = false;
      window.location.href = 'interactive.html';
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});