// Load particles config from JSON and initialize
particlesJS.load('particles-js', 'particles-config.json', function () {
  console.log('particles.js loaded');
});

let scene, camera, renderer, macbook, raycaster, mouse, controls;
let mixer, clock, openAction;
let lidIsOpen = false;
let forceOpenLid = false;
let exitTriggered = false;

let zoomingIn = false;
let zoomingOut = false;
let zoomProgress = 0;
const zoomDuration = 2;
const zoomOutDuration = 3;

const urlParams = new URLSearchParams(window.location.search);
let isExitTriggered = urlParams.get('exit') === 'true';

const initialCameraPos = new THREE.Vector3();
const initialLookAtPos = new THREE.Vector3(0, 0, 0);

let targetCameraPos = new THREE.Vector3();
let targetLookAtPos = new THREE.Vector3();
let waitForAnimationBeforeZoom = false;

let zoomOutCameraPos = new THREE.Vector3();
let zoomOutLookAtPos = new THREE.Vector3();

let zoomOutStartCameraPos = new THREE.Vector3();
let zoomOutStartLookAtPos = new THREE.Vector3();

init();

async function init() {
  scene = new THREE.Scene();

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(2, 5, 5);
  scene.add(directionalLight);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 40);
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
    macbook.scale.set(120, 120, 120);
    macbook.position.y = -2;

    macbook.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(macbook);

    targetLookAtPos.set(0, 3, 0);
    targetCameraPos.set(0, 10, 12);

    mixer = new THREE.AnimationMixer(macbook);
    if (model.animations.length > 0) {
      openAction = mixer.clipAction(model.animations[0]);
      openAction.loop = THREE.LoopOnce;
      openAction.clampWhenFinished = true;
      openAction.paused = true;
      openAction.time = 0;
      openAction.play();
      openAction.paused = true;

      // If exit flag is set, start animation from 8.5 seconds
      if (isExitTriggered) {
        console.log('Exit triggered - starting animation from 8.5 seconds');

        // Set camera to the zoom-in end position immediately
        targetLookAtPos.set(-0.03, 10, -15);
        targetCameraPos.set(
          targetLookAtPos.x,
          targetLookAtPos.y + 2.5,
          targetLookAtPos.z + 6
        );

        // Position camera at the zoom-in end position
        camera.position.copy(targetCameraPos);
        camera.lookAt(targetLookAtPos);
        controls.update();

        forceOpenLid = true;
        lidIsOpen = true;
        openAction.reset();
        openAction.paused = false;
        openAction.play();
        openAction.time = 9; 
        openAction.timeScale = 1; 

        zoomOutCameraPos.set(0, 25, 40); // Far away position
        zoomOutLookAtPos.set(0, 10, 0); // Looking at center

        zoomOutStartCameraPos.copy(camera.position);
        zoomOutStartLookAtPos.copy(targetLookAtPos);

        // Start zoom out after a short delay
        setTimeout(() => {
          console.log('Starting zoom out animation from screen position');
          zoomingOut = true;
          zoomProgress = 0;
        }, 1);
      }
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
  if (event.key === 'Enter' && !zoomingIn && !waitForAnimationBeforeZoom && !isExitTriggered) {
    camera.position.copy(initialCameraPos);
    camera.lookAt(initialLookAtPos);
    controls.update();

    forceOpenLid = true;
    lidIsOpen = true;

    if (mixer && openAction) {
      openAction.reset();
      openAction.paused = false;
      openAction.play();
      openAction.time = 0;
      openAction.timeScale = 3;
    }

    waitForAnimationBeforeZoom = true;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer && openAction) {
    mixer.update(delta);

    if (forceOpenLid) {
      if (openAction.time >= openAction.getClip().duration) {
        openAction.paused = true;
      }
    } else {
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

  if (waitForAnimationBeforeZoom && openAction && openAction.time >= 0.5) {
    targetLookAtPos.set(-0.03, 10, -15); // manual coordinates

    targetCameraPos.set(
      targetLookAtPos.x,
      targetLookAtPos.y + 2.5,
      targetLookAtPos.z + 6
    );

    console.log("Zooming manually to:", targetCameraPos, targetLookAtPos);

    zoomingIn = true;
    zoomProgress = 0;
    waitForAnimationBeforeZoom = false;
  }

  if (zoomingIn) {
    zoomProgress += delta;
    let t = Math.min(zoomProgress / zoomDuration, 1);
    t = t * t * (3 - 2 * t); // smoothstep easing

    camera.position.lerpVectors(initialCameraPos, targetCameraPos, t);
    const lookAtPos = new THREE.Vector3().lerpVectors(initialLookAtPos, targetLookAtPos, t);
    camera.lookAt(lookAtPos);

    if (t >= 1) {
      zoomingIn = false;
      window.location.href = 'interactive.html';
    }
  }

  // Handle zoom out animation for exit
  if (zoomingOut) {
    zoomProgress += delta;
    let t = Math.min(zoomProgress / zoomOutDuration, 1);
    t = t * t * (3 - 2 * t); // smoothstep easing

    camera.position.lerpVectors(zoomOutStartCameraPos, zoomOutCameraPos, t);

    const lerpedPos = new THREE.Vector3().lerpVectors(zoomOutStartCameraPos, zoomOutCameraPos, t);
    const lookAtPos = new THREE.Vector3().lerpVectors(zoomOutStartLookAtPos, zoomOutLookAtPos, t);

    let forward = new THREE.Vector3().subVectors(lookAtPos, lerpedPos);
    if (forward.length() < 0.1) {
      forward.set(0, 0, 0);
      forward.applyQuaternion(camera.quaternion);
      forward.multiplyScalar(10);
    }

    const correctedLookAt = new THREE.Vector3().addVectors(lerpedPos, forward);

    camera.position.copy(lerpedPos);
    camera.lookAt(correctedLookAt);

    // Check if both camera zoom-out AND MacBook lid closing animations are complete
    const cameraAnimationComplete = t >= .8;
    const lidAnimationComplete = openAction && openAction.time >= openAction.getClip().duration*.8;
    
    if (cameraAnimationComplete && lidAnimationComplete) {
      zoomingOut = false;
      console.log('Both zoom out and lid closing animations complete clearing URL parameter');
      
      // Clear the URL parameter and reload the page to reset everything
      const url = new URL(window.location);
      url.searchParams.delete('exit');
      window.history.replaceState({}, '', url);
      forceOpenLid = false;
      lidIsOpen = false;
      exitTriggered = false;
      isExitTriggered = false; 
      
      
      camera.position.copy(initialCameraPos);
      camera.lookAt(initialLookAtPos);
      controls.update();
      
      
      if (openAction) {
        openAction.reset();
        openAction.time = 0;
        openAction.paused = true;
        openAction.play();
        openAction.paused = true;
      }
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});