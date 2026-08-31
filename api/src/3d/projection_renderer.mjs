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
const VITRUVIAN_TEXTURE_ROOT = "/assets/characters/textures/vitruvian";
const VITRUVIAN_TEXTURES = {
  bodyBase: `${VITRUVIAN_TEXTURE_ROOT}/vit_body_bc.png`,
  bodyNormal: `${VITRUVIAN_TEXTURE_ROOT}/vit_body_n.png`,
  bodyRough: `${VITRUVIAN_TEXTURE_ROOT}/vit_body_rough.png`,
  fabricNormal: `${VITRUVIAN_TEXTURE_ROOT}/vit_fabric_n.png`,
  faceBase: `${VITRUVIAN_TEXTURE_ROOT}/vit_face_bc.png`,
  faceNormal: `${VITRUVIAN_TEXTURE_ROOT}/vit_face_n.png`,
  faceRough: `${VITRUVIAN_TEXTURE_ROOT}/vit_face_rough.png`,
  hairBase: `${VITRUVIAN_TEXTURE_ROOT}/vit_hair_diffuse.png`,
  hairNormal: `${VITRUVIAN_TEXTURE_ROOT}/vit_hair_normal.png`,
  hairOpacity: `${VITRUVIAN_TEXTURE_ROOT}/vit_hair_opacity.png`,
  iris: `${VITRUVIAN_TEXTURE_ROOT}/vit_iris.png`,
  mouth: `${VITRUVIAN_TEXTURE_ROOT}/vit_mouth.png`,
  sclera: `${VITRUVIAN_TEXTURE_ROOT}/vit_sclera.png`
};

const SKIN_TONES = {
  fair: 0xfff2e8,
  light: 0xffe7d8,
  warm: 0xffd5bd,
  tan: 0xe1ad88,
  olive: 0xc7a477,
  brown: 0x9a6b4c,
  deep: 0x704934
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
          if(value?.isTexture && value.dispose && !value.userData?.veilwatchShared) value.dispose();
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
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

    const hemi = new THREE.HemisphereLight(0xf2f6ff, 0x101722, 1.15);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffead6, 3.0);
    key.position.set(2.7, 3.8, 3.2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd6ff, .85);
    fill.position.set(-2.4, 2.1, 2.4);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0x78c9ff, 9, 7, 2);
    rim.position.set(-2.2, 1.9, -1.6);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xffc18a, 4.5, 5, 2);
    warm.position.set(2.1, .5, 1.4);
    this.scene.add(warm);

    this.loader = new GLTFLoader();
    this.loader.register((parser)=>new VRMLoaderPlugin(parser));
    this.textureLoader = new THREE.TextureLoader();
    this.vitruvianTextures = null;
    this._vitruvianTexturePromise = null;
    this.currentObject = null;
    this.currentVrm = null;
    this.mixer = null;
    this.faceMeshes = [];
    this.headBone = null;
    this.headBindInverse = null;
    this.hairAssetRoot = null;
    this.hairBaseTransform = null;
    this.proceduralHairRoot = null;
    this.facialHairRoot = null;
    this._activeFaceWeights = {};
    this._activeHairStyleKey = null;
    this._activeBeardStyleKey = null;
    this.lastUrl = null;
    this.profile = {};
    this.viewName = "body";
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
    this.faceMeshes = [];
    this.headBone = null;
    this.headBindInverse = null;
    this.hairAssetRoot = null;
    this.hairBaseTransform = null;
    this.proceduralHairRoot = null;
    this.facialHairRoot = null;
    this._activeFaceWeights = {};
    this._activeHairStyleKey = null;
    this._activeBeardStyleKey = null;
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

  async ensureVitruvianTextures(){
    if(this.vitruvianTextures) return this.vitruvianTextures;
    if(this._vitruvianTexturePromise) return this._vitruvianTexturePromise;

    const load = async (url, srgb=false)=>{
      const tex = await this.textureLoader.loadAsync(url);
      tex.flipY = false;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() || 1);
      tex.userData.veilwatchShared = true;
      tex.needsUpdate = true;
      return tex;
    };

    this._vitruvianTexturePromise = Promise.all([
      load(VITRUVIAN_TEXTURES.bodyBase, true),
      load(VITRUVIAN_TEXTURES.bodyNormal),
      load(VITRUVIAN_TEXTURES.bodyRough),
      load(VITRUVIAN_TEXTURES.fabricNormal),
      load(VITRUVIAN_TEXTURES.faceBase, true),
      load(VITRUVIAN_TEXTURES.faceNormal),
      load(VITRUVIAN_TEXTURES.faceRough),
      load(VITRUVIAN_TEXTURES.hairBase, true),
      load(VITRUVIAN_TEXTURES.hairNormal),
      load(VITRUVIAN_TEXTURES.hairOpacity),
      load(VITRUVIAN_TEXTURES.iris, true),
      load(VITRUVIAN_TEXTURES.mouth, true),
      load(VITRUVIAN_TEXTURES.sclera, true)
    ]).then(([bodyBase, bodyNormal, bodyRough, fabricNormal, faceBase, faceNormal, faceRough, hairBase, hairNormal, hairOpacity, iris, mouth, sclera])=>{
      this.vitruvianTextures = { bodyBase, bodyNormal, bodyRough, fabricNormal, faceBase, faceNormal, faceRough, hairBase, hairNormal, hairOpacity, iris, mouth, sclera };
      return this.vitruvianTextures;
    }).finally(()=>{
      this._vitruvianTexturePromise = null;
    });

    return this._vitruvianTexturePromise;
  }

  applyVitruvianMaterialMaps(){
    const tx = this.vitruvianTextures;
    if(!tx || !this.currentObject) return;

    this.currentObject.traverse((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{
        if(!mat) return;
        const name = String(mat.name || "");

        if(name === "VitSkin"){
          mat.map = tx.faceBase;
          mat.normalMap = tx.faceNormal;
          mat.roughnessMap = tx.faceRough;
          mat.normalScale?.set?.(.8, .8);
          mat.metalness = 0;
          mat.roughness = .9;
        }else if(name === "VitBody"){
          mat.map = tx.bodyBase;
          mat.normalMap = tx.bodyNormal;
          mat.roughnessMap = tx.bodyRough;
          mat.normalScale?.set?.(.75, .75);
          mat.metalness = 0;
          mat.roughness = .92;
        }else if(name === "VitMouth"){
          mat.map = tx.mouth;
          mat.color.setHex(0xffffff);
          mat.metalness = 0;
          mat.roughness = .85;
        }else if(name.startsWith("VitSclera")){
          mat.map = tx.sclera;
          mat.color.setHex(0xf7f0ea);
          mat.metalness = 0;
          mat.roughness = .28;
        }else if(name.startsWith("VitIris")){
          mat.map = tx.iris;
          mat.color.setHex(0xffffff);
          mat.metalness = 0;
          mat.roughness = .25;
        }else if(name === "VitHair"){
          mat.map = tx.hairBase;
          mat.normalMap = tx.hairNormal;
          mat.alphaMap = tx.hairOpacity;
          mat.color.setHex(0xffffff);
          mat.normalScale?.set?.(.6, .6);
          mat.transparent = false;
          mat.alphaTest = .28;
          mat.depthWrite = true;
          mat.metalness = 0;
          mat.roughness = .72;
          mat.side = THREE.DoubleSide;
        }else if(name === "VitShirt" || name === "VitPants"){
          mat.normalMap = tx.fabricNormal;
          mat.normalScale?.set?.(.18, .18);
          mat.metalness = 0;
          mat.roughness = .94;
        }
        mat.needsUpdate = true;
      });
    });
  }

  colorFromHint(value, fallback){
    try{
      if(value) return new THREE.Color(value);
    }catch(e){}
    return new THREE.Color(fallback);
  }

  disposeDetached(root){
    if(!root) return;
    root.parent?.remove(root);
    disposeObject(root);
  }

  bindWorldAuthoredRootToHead(root){
    if(!root || !this.headBone || !this.headBindInverse) return null;
    root.updateMatrixWorld(true);
    root.applyMatrix4(this.headBindInverse);
    this.headBone.add(root);
    root.updateMatrixWorld(true);
    return root;
  }

  createHairMaterial(color){
    return new THREE.MeshStandardMaterial({
      color,
      roughness:.82,
      metalness:0,
      side:THREE.DoubleSide
    });
  }

  createProceduralHair(styleId, color){
    const group = new THREE.Group();
    group.name = "VeilwatchProceduralHair";
    const mat = this.createHairMaterial(color);

    const add = (geom, pos, scale=[1,1,1], rot=[0,0,0])=>{
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(...pos);
      mesh.scale.set(...scale);
      mesh.rotation.set(...rot);
      group.add(mesh);
      return mesh;
    };

    if(styleId === "buzz"){
      add(new THREE.SphereGeometry(.116, 40, 24, 0, Math.PI*2, 0, Math.PI*.61), [0,1.656,-.018], [1.01,.96,1.02]);
    }else{
      // Close crop: low scalp cap plus a row of subtle top tufts.
      add(new THREE.SphereGeometry(.119, 40, 24, 0, Math.PI*2, 0, Math.PI*.64), [0,1.658,-.018], [1.02,1.00,1.03]);
      const tuftGeo = new THREE.ConeGeometry(.009,.038,8);
      const xs = [-.055,-.028,0,.028,.055];
      xs.forEach((x,i)=>{
        add(tuftGeo.clone(), [x,1.755,-.012 + Math.abs(x)*.18], [1,1 + (i===2?.15:0),1], [0,0,(x/0.055)*-.16]);
      });
    }

    group.userData.veilwatchHairColor = color.getHex();
    return this.bindWorldAuthoredRootToHead(group);
  }

  resetAssetHairTransform(){
    const root = this.hairAssetRoot;
    const base = this.hairBaseTransform;
    if(!root || !base) return;
    root.position.copy(base.position);
    root.quaternion.copy(base.quaternion);
    root.scale.copy(base.scale);
  }

  applyHairStyle(styleDef={}, hairColor){
    if(!this.currentObject || !this.headBone) return;
    const styleId = String(styleDef?.id || "classic_bob");
    const kind = String(styleDef?.kind || "asset");
    const variant = String(styleDef?.variant || "classic");
    const cacheKey = `${styleId}:${hairColor.getHexString()}`;

    if(this.hairAssetRoot){
      this.resetAssetHairTransform();
      this.hairAssetRoot.visible = false;
    }

    if(this.proceduralHairRoot){
      this.disposeDetached(this.proceduralHairRoot);
      this.proceduralHairRoot = null;
    }

    if(kind === "none"){
      this._activeHairStyleKey = cacheKey;
      return;
    }

    if(kind === "procedural"){
      this.proceduralHairRoot = this.createProceduralHair(variant === "buzz" ? "buzz" : "crop", hairColor);
      this._activeHairStyleKey = cacheKey;
      return;
    }

    const root = this.hairAssetRoot;
    if(!root) return;
    root.visible = true;
    const assetTint = hairColor.clone().lerp(new THREE.Color(0xffffff), .20);
    root.traverse((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{ if(mat?.color) mat.color.copy(assetTint); });
    });

    // These are deliberate variants of the CC0 Vitruvian card groom. They give
    // us real modular switching now while preserving the realistic hair cards.
    if(variant === "short"){
      root.scale.multiply(new THREE.Vector3(1.00,.84,1.00));
      root.position.y += .035;
    }else if(variant === "long"){
      root.scale.multiply(new THREE.Vector3(1.02,1.15,1.02));
      root.position.y -= .035;
    }else if(variant === "slicked"){
      root.scale.multiply(new THREE.Vector3(.91,.72,.88));
      root.position.y += .047;
      root.position.z -= .020;
      root.rotation.x -= .055;
    }
    this._activeHairStyleKey = cacheKey;
  }

  seededRandom(seed){
    let x = seed >>> 0;
    return ()=>{
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  createFacialHair(styleDef={}, color){
    const id = String(styleDef?.id || "none");
    if(id === "none") return null;

    const group = new THREE.Group();
    group.name = "VeilwatchFacialHair";
    const rand = this.seededRandom([...id].reduce((a,c)=>a+c.charCodeAt(0), 9117));
    const density = Math.max(.2, Number(styleDef?.density || .5));
    const pts = [];
    const segments = [];

    const addPoint = (x,y,z,len=.006)=>{
      pts.push(x,y,z);
      // Fine hair segment extends slightly outward/downward.
      segments.push(x,y,z, x + (rand()-.5)*.002, y-len*(.65+rand()*.35), z+len*(.25+rand()*.35));
    };

    const beardCount = Math.round(620 * density);
    const moustacheCount = Math.round(230 * density);

    if(id === "stubble" || id === "trimmed" || id === "full"){
      for(let i=0;i<beardCount;i++){
        const x=(rand()-.5)*.155;
        const side=Math.min(1,Math.abs(x)/.078);
        const y=1.505 + rand()*.092;
        const chinBias=Math.max(0,1-Math.abs(y-1.54)/.06);
        const z=.088 - side*.020 + chinBias*.010;
        if(id === "stubble") addPoint(x,y,z,.0035);
        else if(id === "trimmed") addPoint(x,y,z,.009);
        else addPoint(x,y,z,.015 + rand()*.012);
      }
    }

    if(id === "mustache" || id === "goatee" || id === "full"){
      for(let i=0;i<moustacheCount;i++){
        const x=(rand()-.5)*.092;
        const y=1.592 + (rand()-.5)*.022;
        const z=.101 - Math.abs(x)*.08;
        addPoint(x,y,z,id === "mustache"?.009:.010);
      }
    }

    if(id === "goatee"){
      for(let i=0;i<Math.round(330*density);i++){
        const x=(rand()-.5)*.062;
        const y=1.503 + rand()*.075;
        const z=.097 - Math.abs(x)*.08;
        addPoint(x,y,z,.010 + rand()*.008);
      }
    }

    if(!pts.length) return null;

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
    const pointMat = new THREE.PointsMaterial({
      color,
      size:id === "stubble" ? .0021 : .0027,
      transparent:true,
      opacity:id === "stubble" ? .58 : .76,
      sizeAttenuation:true,
      depthWrite:true
    });
    group.add(new THREE.Points(pointGeo,pointMat));

    if(id !== "stubble"){
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(segments,3));
      const lineMat = new THREE.LineBasicMaterial({color,transparent:true,opacity:id === "full"?.72:.62});
      group.add(new THREE.LineSegments(lineGeo,lineMat));
    }

    return this.bindWorldAuthoredRootToHead(group);
  }

  applyFacialHair(styleDef={}, hairColor){
    if(this.facialHairRoot){
      this.disposeDetached(this.facialHairRoot);
      this.facialHairRoot = null;
    }
    if(String(styleDef?.id || "none") === "none") return;
    this.facialHairRoot = this.createFacialHair(styleDef, hairColor);
  }

  applyFacePreset(weights={}){
    const prev = this._activeFaceWeights || {};
    const next = weights && typeof weights === "object" ? weights : {};
    const names = new Set([...Object.keys(prev), ...Object.keys(next)]);
    names.forEach((name)=>this.setFaceMorph(name, Number(next[name] || 0)));
    this._activeFaceWeights = {...next};
  }

  applyAppearance(){
    const appearance = this.profile.appearance || {};
    const hints = this.profile.appearanceRender || {};
    if(!this.currentObject || this.currentObject.userData.isVeilwatchFallback) return;

    const skinTarget = this.colorFromHint(hints.skinHex, colorFor(SKIN_TONES, appearance.skinTone, SKIN_TONES.warm));
    // The photographed Vitruvian albedo already carries skin coloration. Use the
    // selected tone as a controlled tint rather than multiplying by the raw target.
    const skinColor = skinTarget.clone().lerp(new THREE.Color(0xffffff), .22);
    const eyeColor = this.colorFromHint(hints.eyeHex, colorFor(EYE_COLORS, appearance.eyeColor, EYE_COLORS.brown));
    const hairColor = this.colorFromHint(hints.hairHex, colorFor(HAIR_COLORS, appearance.hairColor, HAIR_COLORS.dark_brown));
    const shirtColor = new THREE.Color(colorFor(SHIRT_COLORS, appearance.top, SHIRT_COLORS.t_shirt));
    const pantsColor = new THREE.Color(colorFor(BOTTOM_COLORS, appearance.bottoms, BOTTOM_COLORS.jeans));
    const shoesColor = new THREE.Color(colorFor(SHOE_COLORS, appearance.shoes, SHOE_COLORS.sneakers));
    const outerwear = String(appearance.outerwear || "none").toLowerCase();

    this.currentObject.traverse((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{
        const name = String(mat.name || "");
        if(!mat.color) return;

        if(name === "VitSkin" || name === "VitBody"){
          mat.color.copy(skinColor);
        }else if(name === "VitMouth"){
          mat.color.setHex(0xffffff);
        }else if(name === "VitCaruncle"){
          mat.color.setHex(0xd18c86);
          mat.roughness = .5;
        }else if(name === "VitTearline"){
          mat.color.setHex(0xf0c7c1);
          mat.transparent = true;
          mat.opacity = .5;
          mat.roughness = .08;
        }else if(name.startsWith("VitSclera")){
          mat.color.setHex(0xf7f0ea);
        }else if(name.startsWith("VitIris")){
          mat.color.copy(new THREE.Color(0xffffff).lerp(eyeColor, .38));
        }else if(name.startsWith("VitEyeBack")){
          mat.color.setHex(0x090b10);
        }else if(name.startsWith("VitCornea")){
          mat.color.setHex(0xffffff);
          mat.transparent = true;
          mat.opacity = .06;
          mat.roughness = .025;
          mat.metalness = 0;
          mat.depthWrite = false;
        }else if(name === "VitHair"){
          // Asset hair color is applied again in applyHairStyle after variant transforms.
          mat.color.copy(hairColor);
        }else if(name === "VitShirt"){
          const jacketFactor = outerwear === "none" ? 0 : outerwear.includes("heavy") ? .35 : .2;
          mat.color.copy(shirtColor.clone().lerp(new THREE.Color(0x1e252d), jacketFactor));
        }else if(name === "VitPants"){
          mat.color.copy(pantsColor);
        }else if(name === "VitShoes"){
          mat.color.copy(shoesColor);
          mat.metalness = 0;
          mat.roughness = .78;
        }
        mat.needsUpdate = true;
      });
    });

    this.applyFacePreset(hints.faceWeights || {});
    this.applyHairStyle(hints.hairStyle || {id:appearance.hairStyle || "classic_bob",kind:"asset",variant:"classic"}, hairColor);
    this.applyFacialHair(hints.facialHairStyle || {id:appearance.beardStyle || "none"}, hairColor);
  }

  setFaceMorph(name, value){
    for(const mesh of this.faceMeshes){
      const idx = mesh.morphTargetDictionary?.[name];
      if(idx === undefined || !mesh.morphTargetInfluences) continue;
      mesh.morphTargetInfluences[idx] = value;
    }
  }

  updateFaceLiveness(timeSeconds){
    if(!this.faceMeshes.length) return;

    // Re-apply the selected resting-face baseline before transient motion.
    const base = this._activeFaceWeights || {};
    Object.entries(base).forEach(([name,value])=>this.setFaceMorph(name, Number(value || 0)));

    // Fast natural blink every ~3.2 seconds.
    const bt = (timeSeconds + .6) % 3.2;
    const blink = bt < .16 ? Math.sin((bt / .16) * Math.PI) : 0;
    this.setFaceMorph("Eyes_Closed_Max", Math.max(Number(base.Eyes_Closed_Max || 0), blink));

    // Occasional micro-squint layered on top of the chosen face preset.
    const ft = (timeSeconds + 5.0) % 17.0;
    const squint = ft < 1.1 ? .06 * Math.sin((ft / 1.1) * Math.PI) : 0;
    this.setFaceMorph("Eyes_Squint", Math.max(Number(base.Eyes_Squint || 0), squint));
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
    const distance = Math.max(1.7, (height / 2) / Math.tan(fov / 2) * 1.12);
    this._frameState = { height, targetY, distance };
    this.camera.position.set(0, targetY + height * .04, distance);
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
      this.loader.loadAsync(STANDARD_VITRUVIAN_HAIR),
      this.ensureVitruvianTextures()
    ]);
    if(token !== this._loadToken) return;

    this.clearCurrent();

    const bodyRoot = bodyGltf.scene;
    if(!bodyRoot) throw new Error("Vitruvian body had no scene");
    bodyRoot.name = "VeilwatchVitruvianBody";
    this.stripSceneHelpers(bodyRoot);
    this.tuneMaterials(bodyRoot);

    // The separate head + hair GLBs were exported in the SAME bind-pose world
    // coordinates as the body, but they are not skinned to the body's Mixamo rig.
    // To animate them correctly, rigid-bind each asset to the Mixamo Head bone.
    // The inverse bind matrix cancels the bone's bind-pose transform, so the asset
    // remains exactly where it was authored at rest. When the Head bone animates,
    // the asset follows that delta instead of receiving a second positional offset.
    bodyRoot.updateMatrixWorld(true);

    // GLTFLoader may sanitize punctuation in imported node names (for example
    // `mixamorig:Head` can become `mixamorigHead`). Search both the scene tree
    // and every SkinnedMesh skeleton using punctuation-insensitive names.
    const normalizeBoneName = (value)=>String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const wantedHeadNames = new Set([
      "mixamorighead",
      "head"
    ]);
    const wantedNeckNames = new Set([
      "mixamorigneck",
      "neck"
    ]);
    const discoveredBones = [];
    const seenBones = new Set();
    const rememberBone = (bone)=>{
      if(!bone || seenBones.has(bone)) return;
      seenBones.add(bone);
      discoveredBones.push(bone);
    };

    bodyRoot.traverse((obj)=>{
      if(obj.isBone) rememberBone(obj);
      if(obj.isSkinnedMesh && obj.skeleton?.bones){
        obj.skeleton.bones.forEach(rememberBone);
      }
    });

    const headBone = discoveredBones.find((bone)=>wantedHeadNames.has(normalizeBoneName(bone.name)))
      || discoveredBones.find((bone)=>normalizeBoneName(bone.name).endsWith("head"))
      || discoveredBones.find((bone)=>wantedNeckNames.has(normalizeBoneName(bone.name)))
      || discoveredBones.find((bone)=>normalizeBoneName(bone.name).endsWith("neck"));

    if(!headBone){
      const sample = discoveredBones.slice(0, 12).map((bone)=>bone.name).join(", ");
      throw new Error(`Vitruvian body rig has no head/neck bone. Bones seen: ${sample || "none"}`);
    }
    console.info("Veilwatch Vitruvian head anchor:", headBone.name);
    headBone.updateWorldMatrix(true, false);
    const headBindInverse = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
    this.headBone = headBone;
    this.headBindInverse = headBindInverse.clone();

    const bindWorldAuthoredAssetToHead = (assetRoot, name)=>{
      if(!assetRoot) return null;
      assetRoot.name = name;
      assetRoot.updateMatrixWorld(true);
      // The GLBs' root transforms are authored relative to character/world origin.
      // Pre-multiply by inverse head bind transform before parenting to the bone.
      assetRoot.applyMatrix4(headBindInverse);
      headBone.add(assetRoot);
      assetRoot.updateMatrixWorld(true);
      return assetRoot;
    };

    const headRoot = bindWorldAuthoredAssetToHead(
      headGltf.scene || headGltf.scenes?.[0],
      "VeilwatchVitruvianHead"
    );
    if(headRoot){
      this.tuneMaterials(headRoot);
      headRoot.traverse((obj)=>{
        if(obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences){
          this.faceMeshes.push(obj);
        }
      });
    }

    const hairRoot = bindWorldAuthoredAssetToHead(
      hairGltf.scene || hairGltf.scenes?.[0],
      "VeilwatchVitruvianHair"
    );
    if(hairRoot){
      this.tuneMaterials(hairRoot);
      this.hairAssetRoot = hairRoot;
      this.hairBaseTransform = {
        position: hairRoot.position.clone(),
        quaternion: hairRoot.quaternion.clone(),
        scale: hairRoot.scale.clone()
      };
    }

    this.currentObject = bodyRoot;
    this.world.add(this.currentObject);
    this.applyVitruvianMaterialMaps();

    // Animation is safe again: body is skinned normally, while the separate head
    // and hair follow the animated Head bone from their corrected bind-pose offset.
    this.mixer = null;
    if(bodyGltf.animations?.length){
      this.mixer = new THREE.AnimationMixer(this.currentObject);
      const clip = bodyGltf.animations.find(a=>/^idle$/i.test(a.name))
        || bodyGltf.animations.find(a=>/idle/i.test(a.name))
        || bodyGltf.animations[0];
      if(clip) this.mixer.clipAction(clip).reset().fadeIn(.2).play();
    }

    this.frameObject(this.currentObject);
    this.applyProfile(this.profile);
    this.setView(this.viewName || "body");
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
    this.setView(this.viewName || "body");
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

  setView(viewName){
    if(!this.currentObject) return;
    if(!this._frameState) this.frameObject(this.currentObject);
    const frame = this._frameState;
    if(!frame) return;

    const view = String(viewName || "body").toLowerCase();
    this.viewName = view;
    let targetRatio = .48;
    let distanceScale = 1;
    let cameraLift = .04;

    if(view === "face"){
      targetRatio = .82;
      distanceScale = .50;
      cameraLift = .015;
    }else if(view === "hair"){
      targetRatio = .79;
      distanceScale = .56;
      cameraLift = .02;
    }else if(view === "clothing"){
      targetRatio = .52;
      distanceScale = .82;
      cameraLift = .03;
    }else if(view === "animation"){
      targetRatio = .48;
      distanceScale = 1.03;
      cameraLift = .04;
    }else if(view === "advanced"){
      targetRatio = .48;
      distanceScale = 1;
      cameraLift = .04;
    }

    const targetY = frame.height * targetRatio;
    const distance = Math.max(this.controls.minDistance * 1.05, frame.distance * distanceScale);
    this.controls.target.set(0, targetY, 0);
    this.camera.position.set(0, targetY + frame.height * cameraLift, distance);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  resetCamera(){
    if(!this.currentObject) return;
    this.frameObject(this.currentObject);
    this.setView(this.viewName || "body");
  }

  animate(){
    this._raf = requestAnimationFrame(()=>this.animate());
    const now = performance.now();
    const dt = Math.min((now - this._lastFrameTime) / 1000, .05);
    this._lastFrameTime = now;
    this.controls.update();
    this.mixer?.update(dt);
    this.currentVrm?.update?.(dt);
    this.updateFaceLiveness(now * .001);

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
  version: "0.4.0"
};
window.dispatchEvent(new CustomEvent("veilwatch:projection3d-ready"));
