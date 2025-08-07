// basic scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  powerPreference: "high-performance",
  antialias: false,
  depth: false,
  stencil: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;
document.querySelector(".corridor").appendChild(renderer.domElement);
//  lighting

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 1, 5);
scene.add(fillLight);

// const light1 = new THREE.DirectionalLight(0xffffff, 2, 1);
// light1.position.set(2, 3, 2);
// scene.add(light1);

// const light2 = new THREE.DirectionalLight(0xffffff, 2, 1);
// light2.position.set(-2, 3, -2);
// scene.add(light2);

// camera and movement
const initialAngle = Math.PI / 4;
const radius = 20; // Tăng khoảng cách camera

let currentAngle = initialAngle;
let targetAngle = initialAngle;
let currentY = 0;
let targetY = 0;

// Đặt vị trí ban đầu của camera
camera.position.set(
  radius * Math.cos(initialAngle),
  0,
  radius * Math.sin(initialAngle)
);
camera.lookAt(0, 0, 0);

//  parallax control

let mouseX = 0;
let mouseY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;
document.addEventListener("mousemove", (e) => {
  mouseX = (e.clientX - windowHalfX) / windowHalfX;
  mouseY = (e.clientY - windowHalfY) / windowHalfY;
  targetAngle = initialAngle + -mouseX * 0.35;
  targetY = -mouseY * 1.5;
});

//  model loading and material
const emissiveColors = {
  screen: new THREE.Color(0x00ff00),
  lamp: new THREE.Color(0xffaa00),
  light: new THREE.Color(0xffffff),
  default: new THREE.Color(0xffffff),
};

const loader = new THREE.GLTFLoader();
loader.load("./assets/images/scene.gltf", (gltf) => {
  const model = gltf.scene;
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        let emissiveColor = emissiveColors.default;
        for (const [key, color] of Object.entries(emissiveColors)) {
          if (child.name.toLowerCase().includes(key)) {
            emissiveColor = color;
            break;
          }
        }

        const newMaterial = new THREE.MeshStandardMaterial({
          color: child.material.color,
          map: child.material.map,
          emissive: emissiveColor,
          emissiveIntensity: 0,
          roughness: 5.0,
          metalness: 0.125,
        });

        if (child.material.map) {
          newMaterial.map.encoding = THREE.sRGBEncoding;
          newMaterial.map.flipY = false;
        }

        child.material = newMaterial;
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  scene.add(model);
  document.querySelector(".loading").style.display = "none";
});

//  post processing
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  2.0,
  0.25,
  0.5
);
//  film grain effect

const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 0.015 },
    speed: { value: 2.0 },
    size: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,

  fragmentShader: `
    uniform float time;
    uniform float amount;
    uniform float speed;
    uniform float size;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float random(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }
      void main(){
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 position = vUv;
      position *= size;
      float grain = random(position * time * speed);
      color.rgb += grain * amount;
      gl_FragColor = color;
      }
  `,
};

const filmGrainPass = new THREE.ShaderPass(FilmGrainShader);
filmGrainPass.renderToScreen = true;

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(filmGrainPass);

// animation and render loop

function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function animate() {
  requestAnimationFrame(animate);
  filmGrainPass.uniforms.time.value = performance.now() * 0.001;
  currentAngle = lerp(currentAngle, targetAngle, 0.025);
  currentY = lerp(currentY, targetY, 0.025);

  camera.position.x = radius * Math.cos(currentAngle);
  camera.position.z = radius * Math.sin(currentAngle);
  camera.position.y = lerp(camera.position.y, currentY, 0.05);

  camera.lookAt(0, 0, 0);
  composer.render();
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onWindowResize, false);
animate();
