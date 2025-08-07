// ===== SCENE SETUP =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); // Xám đen nhẹ thay vì trắng

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  powerPreference: "high-performance",
  antialias: true,
  depth: true,
  stencil: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Tone mapping tự nhiên hơn
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector(".corridor").appendChild(renderer.domElement);

// ===== LIGHTING (ĐIỀU CHỈNH ĐỂ GIỮ MÀU GỐC) =====
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Giảm từ 0.5
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.6); // Giảm từ 0.5
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.2); // Giảm từ 0.5
fillLight.position.set(-5, 3, 5);
scene.add(fillLight);

// XÓA 2 light có intensity = 2 (quá mạnh, làm model bị trắng bệt)
// const light1 = new THREE.DirectionalLight(0xffffff, 2, 1);
// const light2 = new THREE.DirectionalLight(0xffffff, 2, 1);

// ===== CAMERA MOVEMENT =====
const initialAngle = Math.PI / 4;
const radius = Math.sqrt(50);

let currentAngle = initialAngle;
let targetAngle = initialAngle;
let currentY = 0;
let targetY = 0;

camera.position.set(5, 0, 5);
camera.lookAt(0, 0, 0);

// ===== MOUSE CONTROLS =====
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

// ===== MODEL LOADING - GIỮ NGUYÊN MÀU GỐC =====
const emissiveColors = {
  screen: new THREE.Color(0x00ff00),
  lamp: new THREE.Color(0xffaa00),
  light: new THREE.Color(0xffffff),
};

const loader = new THREE.GLTFLoader();

// Thay đổi path này thành path thực tế của bạn
const modelPath = "./assets/images/scene.gltf"; // Hoặc URL trực tiếp từ Sketchfab

loader.load(
  modelPath,
  (gltf) => {
    const model = gltf.scene;

    console.log("Model loaded successfully!");

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          console.log(`Processing: ${child.name}`);
          console.log("Original material:", child.material);

          // ===== GIẢI PHÁP: GIỮ NGUYÊN MATERIAL GỐC =====

          // Chỉ fix texture encoding
          if (child.material.map) {
            child.material.map.encoding = THREE.sRGBEncoding;
            child.material.map.flipY = false;
          }

          // Chỉ thêm emissive cho objects đặc biệt
          const objectName = child.name.toLowerCase();

          if (objectName.includes("screen")) {
            // Glow effect cho màn hình
            child.material.emissive = emissiveColors.screen;
            child.material.emissiveIntensity = 0.3;
          } else if (
            objectName.includes("lamp") ||
            objectName.includes("light")
          ) {
            // Glow effect cho đèn
            child.material.emissive = emissiveColors.lamp;
            child.material.emissiveIntensity = 0.2;
          } else if (objectName.includes("bulb")) {
            // Glow effect cho bóng đèn
            child.material.emissive = emissiveColors.light;
            child.material.emissiveIntensity = 0.4;
          }

          // KHÔNG tạo material mới - giữ nguyên material gốc từ GLTF
          // Điều này giữ lại tất cả: color, normalMap, roughnessMap, etc.
        }
      }
    });

    // Center model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    scene.add(model);

    // Ẩn loading
    document.querySelector(".loading").style.display = "none";

    console.log("Model added to scene!");
  },
  // Progress callback
  (progress) => {
    console.log(
      "Loading progress:",
      (progress.loaded / progress.total) * 100 + "%"
    );
  },
  // Error callback
  (error) => {
    console.error("Error loading model:", error);
    document.querySelector(".loading").innerHTML =
      "Error loading model. Check console for details.";
  }
);

// ===== POST PROCESSING =====
const renderScene = new THREE.RenderPass(scene, camera);

const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, // Strength
  0.4, // Radius
  0.85 // Threshold
);

// ===== FILM GRAIN SHADER =====
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 0.08 },
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

// ===== CONTROLS =====
const controls = {
  exposure: document.getElementById("exposure"),
  bloom: document.getElementById("bloom"),
  grain: document.getElementById("grain"),
  ambient: document.getElementById("ambient"),
};

controls.exposure.addEventListener("input", (e) => {
  renderer.toneMappingExposure = parseFloat(e.target.value);
});

controls.bloom.addEventListener("input", (e) => {
  bloomPass.strength = parseFloat(e.target.value);
});

controls.grain.addEventListener("input", (e) => {
  filmGrainPass.uniforms.amount.value = parseFloat(e.target.value);
});

controls.ambient.addEventListener("input", (e) => {
  ambientLight.intensity = parseFloat(e.target.value);
});

// ===== ANIMATION LOOP =====
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function animate() {
  requestAnimationFrame(animate);

  // Update film grain
  filmGrainPass.uniforms.time.value = performance.now() * 0.001;

  // Smooth camera movement
  currentAngle = lerp(currentAngle, targetAngle, 0.025);
  currentY = lerp(currentY, targetY, 0.025);

  camera.position.x = radius * Math.cos(currentAngle);
  camera.position.z = radius * Math.sin(currentAngle);
  camera.position.y = lerp(camera.position.y, currentY, 0.05);

  camera.lookAt(0, 0, 0);

  // Render
  composer.render();
}

// ===== RESIZE HANDLER =====
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize, false);

// ===== START ANIMATION =====
animate();

// ===== DEBUG INFO =====
console.log("Three.js Scene initialized!");
console.log("Waiting for model to load...");

// Keyboard controls
document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "r":
    case "R":
      // Reset camera
      currentAngle = initialAngle;
      targetAngle = initialAngle;
      currentY = 0;
      targetY = 0;
      break;
    case " ":
      e.preventDefault();
      // Toggle controls visibility
      const controlsDiv = document.querySelector(".controls");
      controlsDiv.style.display =
        controlsDiv.style.display === "none" ? "block" : "none";
      break;
  }
});
