import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const CYAN = 0x00e5ff;
const AMBER = 0xffb13b;
const STANDARD_VITRUVIAN_BODY = "/assets/characters/bases/vitruvian_body.glb";
const STANDARD_VITRUVIAN_HEAD = "/assets/characters/bases/vitruvian_head.glb";
const STANDARD_VITRUVIAN_HAIR = "/assets/characters/hair/vitruvian_hair_rigged.glb";
const STANDARD_SENTINELS = new Set(["", "@vitruvian", "bundle:vitruvian", "standard:vitruvian"]);

const SKIN_TONES = {
  fair: 0xf4ddcf,
  light: 0xe0bfa8,
  warm: 0xcf9f7d,
  tan: 0xb77f5f,
  olive: 0x9a7a58,
  brown: 0x7a5036,
  deep: 0x523521
};

const HAIR_COLORS = {
  black: 0x171411,
  dark_brown: 0x34261c,
  brown: 0x5b3b26,
  blonde: 0xcfaf63,
  auburn: 0x7c3d28,
  red: 0x9d4021,
  gray: 0x808188,
  white: 0xe7e7e7
};

const EYE_COLORS = {
  brown: 0x5c3924,
  hazel: 0x7a6432,
  blue: 0x4e86b4,
  green: 0x4e7c56,
  gray: 0x8f97a0,
  amber: 0xaa7b30
};

const SHIRT_COLORS = {
  t_shirt: 0x2f343a,
  long_sleeve: 0x4c5864,
  button_up: 0xb8c7d9,
  hoodie: 0x26444e,
  polo: 0x465156
};

const BOTTOM_COLORS = {
  jeans: 0x2f4f74,
  cargo_pants: 0x5a5d44,
  dress_pants: 0x2d3035,
  joggers: 0x3e4148,
  leggings: 0x1f2023
};

const SHOE_COLORS = {
  sneakers: 0xd6d7da,
  boots: 0x2e241f,
  dress_shoes: 0x161616,
  work_boots: 0x59422b
};

function disposeObject(root){
  root?.traverse?.((obj)=>{
    if(obj.geometry?.dispose) obj.geometry.dispose();
    if(obj.material){
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{
        if(!mat) return;
        Object.values(mat).forEach((value)=>{
          if(value?.isTexture && value.dispose) value.dispose();
        });
        mat.dispose?.();
      });
    }
  });
}

function createHoloMaterial(opacity=.62){
  return new THREE.MeshStandardMaterial({
    color: CYAN,
    emissive: CYAN,
    emissiveIntensity: .42,
    metalness: .12,
    roughness: .4,
    transparent: true,
    opacity,
    side: THREE.DoubleSide
  });
}

function clamp01(n){
  return Math.max(0, Math.min(1, Number(n) || 0));
}

function colorFor(map, key, fallback){
  return map[String(key || "").trim().toLowerCase()] || fallback;
}

function blendHex(baseHex, overlayHex, amount=.18){
  const base = new THREE.Color(baseHex);
  const over = new THREE.Color(overlayHex);
  return base.lerp(over, clamp01(amount));
}

function createProceduralHumanoid(){
  const group = new THREE.Group();
  group.name = "VeilwatchPrototypeHumanoid";

  const bodyMat = createHoloMaterial(.60);
  const jointMat = createHoloMaterial(.72);
  const accentMat = new THREE.MeshStandardMaterial({
    color: AMBER,
    emissive: AMBER,
    emissiveIntensity: .25,
    metalness: .2,
    roughness: .42,
    transparent: true,
    opacity: .55
  });

  const addMesh = (geometry, material, position, rotation=[0,0,0], scale=[1,1,1])=>{
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    group.add(mesh);
    return mesh;
  };

  addMesh(new THREE.SphereGeometry(.145, 28, 20), jointMat, [0, 1.78, 0], [0,0,0], [1, 1.08, .94]);
  addMesh(new THREE.CylinderGeometry(.19, .27, .55, 20), bodyMat, [0, 1.37, 0], [0,0,0], [1.13,1,.72]);
  addMesh(new THREE.CylinderGeometry(.225, .20, .32, 20), bodyMat, [0, 1.00, 0], [0,0,0], [1.08,1,.78]);
  addMesh(new THREE.SphereGeometry(.065, 18, 12), accentMat, [0, 1.43, .205], [0,0,0], [1.5,.6,.35]);

  const upperArm = new THREE.CylinderGeometry(.07, .065, .46, 16);
  const foreArm = new THREE.CylinderGeometry(.062, .052, .42, 16);
  addMesh(upperArm, bodyMat, [-.30, 1.38, 0], [0,0,-.08]);
  addMesh(upperArm.clone(), bodyMat, [.30, 1.38, 0], [0,0,.08]);
  addMesh(foreArm, bodyMat, [-.325, .96, 0], [0,0,-.03]);
  addMesh(foreArm.clone(), bodyMat, [.325, .96, 0], [0,0,.03]);
  addMesh(new THREE.SphereGeometry(.06, 16, 12), jointMat, [-.34, .72, 0], [0,0,0], [.78,1.15,.72]);
  addMesh(new THREE.SphereGeometry(.06, 16, 12), jointMat, [.34, .72, 0], [0,0,0], [.78,1.15,.72]);

  const thigh = new THREE.CylinderGeometry(.105, .085, .55, 18);
  const shin = new THREE.CylinderGeometry(.082, .06, .55, 18);
  addMesh(thigh, bodyMat, [-.13, .66, 0], [0,0,-.015]);
  addMesh(thigh.clone(), bodyMat, [.13, .66, 0], [0,0,.015]);
  addMesh(shin, bodyMat, [-.13, .13, 0], [0,0,.012]);
  addMesh(shin.clone(), bodyMat, [.13, .13, 0], [0,0,-.012]);
  addMesh(new THREE.BoxGeometry(.14,.08,.27), jointMat, [-.13, -.16, .045], [0,0,0]);
  addMesh(new THREE.BoxGeometry(.14,.08,.27), jointMat, [.13, -.16, .045], [0,0,0]);

  group.userData.isVeilwatchFallback = true;
  return group;
}

class ProjectionRenderer {
  constructor(host, options={}){
    if(!host) throw new Error("ProjectionRenderer requires a host element");
    this.host = host;
    this.options = options;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
    this.camera.position.set(0, .94, 4.25);

    this.renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "projection-three-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D character projection");
    this.host.replaceChildren(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.55;
    this.controls.maxDistance = 7.5;
    this.controls.minPolarAngle = Math.PI * .18;
    this.controls.maxPolarAngle = Math.PI * .78;
    this.controls.target.set(0, .85, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const hemi = new THREE.HemisphereLight(0xbcefff, 0x051019, 1.8);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.7, 3.8, 3.2);
    this.scene.add(key);
    const rim = new THREE.PointLight(CYAN, 16, 7, 2);
    rim.position.set(-2.2, 1.7, -1.6);
    this.scene.add(rim);
    const warm = new THREE.PointLight(AMBER, 7, 5, 2);
    warm.position.set(2.1, .5, 1.4);
    this.scene.add(warm);

    this.loader = new GLTFLoader();
    this.loader.register((parser)=>new VRMLoaderPlugin(parser));
    this.currentObject = null;
    this.currentVrm = null;
    this.mixer = null;
    this.lastUrl = null;
    this.profile = {};
    this._loadToken = 0;
    this._lastFrameTime = performance.now();

    this.resizeObserver = new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    this.load("");
    this.animate();
  }

  setStatus(message, kind="info"){
    this.host.dispatchEvent(new CustomEvent("veilwatch:projection-status", {
      bubbles:true,
      detail:{message, kind}
    }));
  }

  resize(){
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  clearCurrent(){
    if(this.currentObject){
      this.world.remove(this.currentObject);
      disposeObject(this.currentObject);
    }
    this.currentObject = null;
    this.currentVrm = null;
    this.mixer = null;
  }

  showPrototype(){
    this.clearCurrent();
    this.currentObject = createProceduralHumanoid();
    this.world.add(this.currentObject);
    this.frameObject(this.currentObject);
    this.applyProfile(this.profile);
    this.setStatus("PROTOTYPE HUMANOID", "prototype");
  }

  stripSceneHelpers(root){
    const toRemove = [];
    root?.traverse?.((obj)=>{
      if(/^Plane(?:\.|$)/i.test(obj.name || "")) toRemove.push(obj);
    });
    toRemove.forEach((obj)=>obj.parent?.remove(obj));
  }

  tuneMaterials(root){
    root?.traverse?.((obj)=>{
      if(!obj.isMesh) return;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{
        if(!mat) return;
        if(!mat.userData.veilwatchBaseColor){
          mat.userData.veilwatchBaseColor = mat.color?.clone?.() || new THREE.Color(0.8,0.8,0.8);
        }
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      });
    });
  }

  applyAppearance(){
    const appearance = this.profile.appearance || {};
    if(!this.currentObject || this.currentObject.userData.isVeilwatchFallback) return;

    const skinColor = blendHex(colorFor(SKIN_TONES, appearance.skinTone, SKIN_TONES.warm), CYAN, .06);
    const hairColor = blendHex(colorFor(HAIR_COLORS, appearance.hairColor, HAIR_COLORS.dark_brown), CYAN, .04);
    const eyeColor = colorFor(EYE_COLORS, appearance.eyeColor, EYE_COLORS.blue);
    const shirtColor = blendHex(colorFor(SHIRT_COLORS, appearance.top, SHIRT_COLORS.t_shirt), CYAN, .05);
    const pantsColor = blendHex(colorFor(BOTTOM_COLORS, appearance.bottoms, BOTTOM_COLORS.jeans), CYAN, .04);
    const shoesColor = blendHex(colorFor(SHOE_COLORS, appearance.shoes, SHOE_COLORS.sneakers), CYAN, .03);
    const outerwear = String(appearance.outerwear || "none").toLowerCase();

    this.currentObject.traverse((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{
        const name = String(mat.name || "");
        if(!mat.color) return;

        if(name === "VitSkin" || name === "VitBody"){
          mat.color.copy(skinColor);
          mat.roughness = .86;
          mat.metalness = .03;
        }else if(name === "VitMouth"){
          mat.color.setHex(0x7a453d);
          mat.roughness = .88;
        }else if(name === "VitCaruncle"){
          mat.color.setHex(0xcf7b75);
        }else if(name === "VitTearline"){
          mat.color.setHex(0xc49d99);
          mat.transparent = true;
          mat.opacity = .92;
        }else if(name.startsWith("VitSclera")){
          mat.color.setHex(0xf1f3f4);
          mat.roughness = .38;
        }else if(name.startsWith("VitIris")){
          mat.color.setHex(eyeColor);
          mat.roughness = .42;
        }else if(name.startsWith("VitEyeBack")){
          mat.color.setHex(0x0d1018);
        }else if(name.startsWith("VitCornea")){
          mat.color.setHex(0xffffff);
          mat.transparent = true;
          mat.opacity = .12;
          mat.roughness = .02;
          mat.metalness = 0;
        }else if(name === "VitHair"){
          mat.color.copy(hairColor);
          mat.roughness = .9;
          mat.metalness = .02;
        }else if(name === "VitShirt"){
          const jacketFactor = outerwear === "none" ? 0 : outerwear.includes("heavy") ? .35 : .2;
          mat.color.copy(shirtColor.clone().lerp(new THREE.Color(0x1e252d), jacketFactor));
          mat.roughness = .92;
        }else if(name === "VitPants"){
          mat.color.copy(pantsColor);
          mat.roughness = .95;
        }else if(name === "VitShoes"){
          mat.color.copy(shoesColor);
          mat.roughness = .82;
        }
      });
    });

    const hairRoot = this.currentObject.getObjectByName("VeilwatchVitruvianHair");
    if(hairRoot){
      const style = String(appearance.hairStyle || "").toLowerCase();
      hairRoot.visible = style !== "bald";
      const scaleAdjust = style === "buzz" ? .93 : 1;
      hairRoot.scale.setScalar(scaleAdjust);
    }
  }

  applyProfile(profile={}){
    this.profile = {...this.profile, ...profile};
    if(!this.currentObject) return;

    const scaleMap = { compact:.88, average:1, tall:1.10, huge:1.22 };
    const scalar = scaleMap[this.profile.scale] || 1;
    this.currentObject.scale.setScalar(scalar);

    const posture = String(this.profile.posture || "neutral");
    this.world.rotation.set(0, 0, 0);
    if(posture === "alert") this.world.rotation.y = THREE.MathUtils.degToRad(5);
    if(posture === "combat") this.world.rotation.y = THREE.MathUtils.degToRad(-12);
    if(posture === "injured") this.world.rotation.z = THREE.MathUtils.degToRad(4);

    this.host.dataset.state = this.profile.signal || "stable";
    this.applyAppearance();
  }

  frameObject(object){
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if(box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, .2);

    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;
    object.updateMatrixWorld(true);

    const targetY = height * .48;
    this.controls.target.set(0, targetY, 0);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(1.7, (height / 2) / Math.tan(fov / 2) * 1.22);
    this.camera.position.set(0, targetY + height * .05, distance);
    this.controls.minDistance = Math.max(.8, distance * .42);
    this.controls.maxDistance = Math.max(5, distance * 2.4);
    this.camera.near = Math.max(.01, distance / 100);
    this.camera.far = Math.max(100, distance * 20);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  async loadVitruvianBundle(token){
    this.setStatus("LOADING STANDARD BODY", "loading");
    const [bodyGltf, headGltf, hairGltf] = await Promise.all([
      this.loader.loadAsync(STANDARD_VITRUVIAN_BODY),
      this.loader.loadAsync(STANDARD_VITRUVIAN_HEAD),
      this.loader.loadAsync(STANDARD_VITRUVIAN_HAIR)
    ]);
    if(token !== this._loadToken) return;

    this.clearCurrent();

    const bodyRoot = bodyGltf.scene;
    if(!bodyRoot) throw new Error("Vitruvian body had no scene");
    bodyRoot.name = "VeilwatchVitruvianBody";
    this.stripSceneHelpers(bodyRoot);
    this.tuneMaterials(bodyRoot);

    const anchor = bodyRoot.getObjectByName("mixamorig:Head")
      || bodyRoot.getObjectByName("Head")
      || bodyRoot.getObjectByName("mixamorig:Neck")
      || bodyRoot;

    const headRoot = headGltf.scene || headGltf.scenes?.[0];
    if(headRoot){
      headRoot.name = "VeilwatchVitruvianHead";
      this.tuneMaterials(headRoot);
      anchor.attach(headRoot);
    }

    const hairRoot = hairGltf.scene || hairGltf.scenes?.[0];
    if(hairRoot){
      hairRoot.name = "VeilwatchVitruvianHair";
      this.tuneMaterials(hairRoot);
      anchor.attach(hairRoot);
    }

    this.currentObject = bodyRoot;
    this.world.add(this.currentObject);

    if(bodyGltf.animations?.length){
      this.mixer = new THREE.AnimationMixer(this.currentObject);
      const clip = bodyGltf.animations.find(a=>/idle/i.test(a.name)) || bodyGltf.animations[0];
      if(clip) this.mixer.clipAction(clip).reset().fadeIn(.15).play();
    }

    this.frameObject(this.currentObject);
    this.applyProfile(this.profile);
    this.setStatus("STANDARD BODY ONLINE", "linked");
  }

  async loadSingleModel(cleanUrl, token){
    this.setStatus("LOADING 3D MODEL", "loading");
    const gltf = await this.loader.loadAsync(cleanUrl);
    if(token !== this._loadToken) return;
    this.clearCurrent();

    const vrm = gltf.userData?.vrm || null;
    if(vrm){
      VRMUtils.rotateVRM0(vrm);
      this.currentVrm = vrm;
      this.currentObject = vrm.scene;
    }else{
      this.currentObject = gltf.scene;
    }

    if(!this.currentObject) throw new Error("Model contained no renderable scene");
    this.tuneMaterials(this.currentObject);
    this.world.add(this.currentObject);

    if(gltf.animations?.length){
      this.mixer = new THREE.AnimationMixer(this.currentObject);
      const clip = gltf.animations.find(a=>/idle/i.test(a.name)) || gltf.animations[0];
      if(clip) this.mixer.clipAction(clip).reset().fadeIn(.15).play();
    }

    this.frameObject(this.currentObject);
    this.applyProfile(this.profile);
    this.setStatus(vrm ? "VRM MODEL ONLINE" : "GLB MODEL ONLINE", "linked");
  }

  async load(url){
    const cleanUrl = String(url || "").trim();
    this.lastUrl = cleanUrl;
    const token = ++this._loadToken;

    try{
      if(STANDARD_SENTINELS.has(cleanUrl.toLowerCase())){
        await this.loadVitruvianBundle(token);
      }else{
        await this.loadSingleModel(cleanUrl, token);
      }
    }catch(err){
      console.error("Veilwatch Projection model load failed:", err);
      if(token !== this._loadToken) return;
      this.showPrototype();
      this.setStatus("MODEL FAILED · PROTOTYPE ACTIVE", "error");
    }
  }

  resetCamera(){
    if(this.currentObject) this.frameObject(this.currentObject);
  }

  animate(){
    this._raf = requestAnimationFrame(()=>this.animate());
    const now = performance.now();
    const dt = Math.min((now - this._lastFrameTime) / 1000, .05);
    this._lastFrameTime = now;
    this.controls.update();
    this.mixer?.update(dt);
    this.currentVrm?.update?.(dt);

    if(this.currentObject?.userData?.isVeilwatchFallback){
      const t = performance.now() * .001;
      this.currentObject.position.y = Math.sin(t * 1.35) * .015;
      this.currentObject.rotation.y += dt * .045;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy(){
    cancelAnimationFrame(this._raf);
    this.resizeObserver?.disconnect();
    this.clearCurrent();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.host.replaceChildren();
  }
}

const instances = new WeakMap();

function createProjectionRenderer(host, options={}){
  if(!host) return null;
  if(instances.has(host)) return instances.get(host);
  const instance = new ProjectionRenderer(host, options);
  instances.set(host, instance);
  return instance;
}

window.VeilwatchProjection3D = {
  create: createProjectionRenderer,
  version: "0.2.0"
};
window.dispatchEvent(new CustomEvent("veilwatch:projection3d-ready"));
