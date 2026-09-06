import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const CYAN = 0x00e5ff;
const AMBER = 0xffb13b;
const STANDARD_VITRUVIAN_BODY = "/assets/characters/bases/vitruvian_body.glb";
const STANDARD_VITRUVIAN_HEAD = "/assets/characters/bases/vitruvian_head.glb";
const STANDARD_VITRUVIAN_HAIR = "/assets/characters/hair/vitruvian_hair_rigged.glb";
const VEILWATCH_CUFF_ASSET = "/assets/characters/equipment/veilwatch_projection_cuff_v1.glb";
const ORIGINAL_HAIR_ROOT = "/assets/characters/hair/veilwatch_original";
const ORIGINAL_BROW_ROOT = "/assets/characters/brows/veilwatch_original";
const ORIGINAL_CYBER_ROOT = "/assets/characters/cybernetics/veilwatch_original";
const ORIGINAL_FACIAL_HAIR_ROOT = "/assets/characters/facial_hair/veilwatch_original";
const ANATOMY_ASSETS = {
  penis_testes:"/assets/characters/anatomy/penis_testes_v1.glb",
  vulva:"/assets/characters/anatomy/vulva_v1.glb"
};
const CYBER_ASSET_PATHS = {
  cyber_hand:`${ORIGINAL_CYBER_ROOT}/cyber_hand.glb`,
  cyber_forearm:`${ORIGINAL_CYBER_ROOT}/cyber_forearm.glb`,
  full_cyber_arm:`${ORIGINAL_CYBER_ROOT}/full_cyber_arm.glb`,
  cyber_foot:`${ORIGINAL_CYBER_ROOT}/cyber_foot.glb`,
  cyber_lower_leg:`${ORIGINAL_CYBER_ROOT}/cyber_lower_leg.glb`,
  full_cyber_leg:`${ORIGINAL_CYBER_ROOT}/full_cyber_leg.glb`,
  data_port:`${ORIGINAL_CYBER_ROOT}/neck_port.glb`,
  spinal_interface:`${ORIGINAL_CYBER_ROOT}/neck_port.glb`,
  chest_interface:`${ORIGINAL_CYBER_ROOT}/chest_interface.glb`,
  rib_reinforcement:`${ORIGINAL_CYBER_ROOT}/chest_interface.glb`,
  spine_interface:`${ORIGINAL_CYBER_ROOT}/spine_interface.glb`
};
const HEAD_CYBER_ASSET_PATHS = {
  synthetic_eye:`${ORIGINAL_CYBER_ROOT}/synthetic_eye.glb`,
  camera_eye:`${ORIGINAL_CYBER_ROOT}/camera_eye.glb`,
  neural_port:`${ORIGINAL_CYBER_ROOT}/temple_port.glb`,
  sensor_plate:`${ORIGINAL_CYBER_ROOT}/temple_port.glb`,
  comms_implant:`${ORIGINAL_CYBER_ROOT}/ear_comms.glb`,
  enhanced_hearing:`${ORIGINAL_CYBER_ROOT}/ear_comms.glb`,
  reinforcement_plate:`${ORIGINAL_CYBER_ROOT}/jaw_plate.glb`
};
const FPS_WEAPON_ROOT = "/assets/characters/weapons/fps_cc0";
const LOCAL_WEAPON_ROOT = "/assets/characters/weapons/veilwatch_local";
const QUATERNIUS_ANIMATION_ROOT = "/assets/characters/animations/quaternius";
const QUATERNIUS_UAL1 = `${QUATERNIUS_ANIMATION_ROOT}/UAL1_Standard.glb`;
const QUATERNIUS_UAL2 = `${QUATERNIUS_ANIMATION_ROOT}/UAL2_Standard.glb`;
const FORGE_EXTERNAL_ANIMATION_NAMES = new Set([
  "Idle_Loop", "Idle_Talking_Loop", "Walk_Loop", "Walk_Formal_Loop", "Jog_Fwd_Loop", "Sprint_Loop",
  "Crouch_Idle_Loop", "Crouch_Fwd_Loop", "Jump_Start", "Jump_Loop", "Jump_Land", "Roll",
  "Sitting_Enter", "Sitting_Idle_Loop", "Sitting_Talking_Loop", "Sitting_Exit",
  "Interact", "PickUp_Table", "Fixing_Kneeling", "Driving_Loop", "Push_Loop",
  "Pistol_Idle_Loop", "Pistol_Aim_Neutral", "Pistol_Aim_Up", "Pistol_Aim_Down", "Pistol_Shoot", "Pistol_Reload",
  "Punch_Jab", "Punch_Cross", "Sword_Idle", "Sword_Attack", "Hit_Chest", "Hit_Head",
  "Swim_Idle_Loop", "Swim_Fwd_Loop", "Dance_Loop", "Spell_Simple_Idle_Loop", "Spell_Simple_Shoot", "Death01"
]);
const UAL_TO_VITRUVIAN_BONES = {
  pelvis:"Hips",
  spine01:"Spine", spine02:"Spine1", spine03:"Spine2",
  neck01:"Neck", head:"Head",
  claviclel:"LeftShoulder", upperarml:"LeftArm", lowerarml:"LeftForeArm", handl:"LeftHand",
  clavicler:"RightShoulder", upperarmr:"RightArm", lowerarmr:"RightForeArm", handr:"RightHand",
  thighl:"LeftUpLeg", calfl:"LeftLeg", footl:"LeftFoot", balll:"LeftToeBase",
  thighr:"RightUpLeg", calfr:"RightLeg", footr:"RightFoot", ballr:"RightToeBase",
  thumb01l:"LeftHandThumb1", thumb02l:"LeftHandThumb2", thumb03l:"LeftHandThumb3",
  index01l:"LeftHandIndex1", index02l:"LeftHandIndex2", index03l:"LeftHandIndex3",
  middle01l:"LeftHandMiddle1", middle02l:"LeftHandMiddle2", middle03l:"LeftHandMiddle3",
  ring01l:"LeftHandRing1", ring02l:"LeftHandRing2", ring03l:"LeftHandRing3",
  pinky01l:"LeftHandPinky1", pinky02l:"LeftHandPinky2", pinky03l:"LeftHandPinky3",
  thumb01r:"RightHandThumb1", thumb02r:"RightHandThumb2", thumb03r:"RightHandThumb3",
  index01r:"RightHandIndex1", index02r:"RightHandIndex2", index03r:"RightHandIndex3",
  middle01r:"RightHandMiddle1", middle02r:"RightHandMiddle2", middle03r:"RightHandMiddle3",
  ring01r:"RightHandRing1", ring02r:"RightHandRing2", ring03r:"RightHandRing3",
  pinky01r:"RightHandPinky1", pinky02r:"RightHandPinky2", pinky03r:"RightHandPinky3"
};
const FPS_WEAPON_ASSETS = {
  compact_pistol: "Pistol_Compact_West.glb",
  service_pistol: "Pistol_Full_West.glb",
  heavy_pistol: "Pistol_Full_East.glb",
  machine_pistol: "SMG_Compact_West.glb",
  smg: "SMG_Full_West.glb",
  carbine_rifle: "Rifle_Assault_West.glb",
  assault_rifle: "Rifle_Assault_East.glb",
  battle_rifle: "Rifle_Battle_West.glb",
  dmr: "Rifle_Battle_East.glb",
  sniper_rifle: "Sniper_Rifle_East.glb",
  pump_shotgun: "Shotgun_Pump_West.glb",
  compact_shotgun: "Shotgun_Auto_West.glb",
  hunting_rifle: "Sniper_Rifle_West.glb",
  marksman_rifle: "Sniper_Material_West.glb"
};
const LOCAL_WEAPON_ASSETS = {
  compact_pistol:"compact_pistol.glb", service_pistol:"service_pistol.glb", heavy_pistol:"heavy_pistol.glb", machine_pistol:"machine_pistol.glb", revolver:"revolver.glb",
  smg:"smg.glb", carbine_rifle:"carbine_rifle.glb", assault_rifle:"assault_rifle.glb", battle_rifle:"battle_rifle.glb", dmr:"dmr.glb", sniper_rifle:"sniper_rifle.glb", pump_shotgun:"pump_shotgun.glb", compact_shotgun:"compact_shotgun.glb", hunting_rifle:"hunting_rifle.glb", marksman_rifle:"marksman_rifle.glb",
  taser:"taser.glb", pepper_spray:"pepper_spray.glb", baton:"baton.glb", riot_shield:"riot_shield.glb",
  knife:"knife.glb", crowbar:"crowbar.glb", combat_baton:"combat_baton.glb", hatchet:"hatchet.glb", improvised_weapon:"improvised_weapon.glb",
  breaching_charge:"breaching_charge.glb", grenade:"grenade.glb"
};
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
    this.bodyMorphMeshes = [];
    this.faceMorphMeshes = [];
    this.headAssetRoot = null;
    this.headBone = null;
    this.headBindInverse = null;
    this.hairAssetRoot = null;
    this.hairBaseTransform = null;
    this.customHairRoot = null;
    this._customHairStyleId = null;
    this._hairLoadToken = 0;
    this.irisTexture = null;
    this._irisColorKey = null;
    this.scleraMaskTexture = null;
    this.proceduralHairRoot = null;
    this.facialHairRoot = null;
    this._activeFaceWeights = {};
    this._activeHairStyleKey = null;
    this._activeBeardStyleKey = null;
    this.forgeRoot = null;
    this.forgeVisuals = [];
    this._forgeKey = "";
    this.availableAnimations = [];
    this.activeAnimationName = "";
    this._requestedAnimationName = "";
    this._forgeAnimationPromise = null;
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
    this.bodyMorphMeshes = [];
    this.faceMorphMeshes = [];
    this.headAssetRoot = null;
    this.headBone = null;
    this.headBindInverse = null;
    this.hairAssetRoot = null;
    this.hairBaseTransform = null;
    this.customHairRoot = null;
    this._customHairStyleId = null;
    this._hairLoadToken++;
    if(this.irisTexture){ this.irisTexture.dispose?.(); this.irisTexture = null; }
    this._irisColorKey = null;
    this.proceduralHairRoot = null;
    this.facialHairRoot = null;
    this._activeFaceWeights = {};
    this._activeHairStyleKey = null;
    this._activeBeardStyleKey = null;
    this.forgeRoot = null;
    this.forgeVisuals = [];
    this._forgeKey = "";
    this.availableAnimations = [];
    this.activeAnimationName = "";
    this._requestedAnimationName = "";
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
      // Vitruvian exports Eyeshadow_L/R as separate look-dev cards. Without
      // the original Blender shader they render as bright white strips above
      // the eyes, so keep them hidden until a proper brow/eyeshadow asset is fitted.
      if(/^Eyeshadow(?:_|\.|$)/i.test(String(obj.name || ""))){
        obj.visible = false;
        return;
      }
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
          mat.alphaMap = this.createScleraMaskTexture();
          mat.color.setHex(0xf7f0ea);
          mat.transparent = true;
          mat.alphaTest = .08;
          mat.opacity = 1;
          mat.depthWrite = true;
          mat.depthTest = true;
          mat.metalness = 0;
          mat.roughness = .28;
        }else if(name.startsWith("VitIris")){
          // Veilwatch builds a procedural iris/pupil texture in applyAppearance.
          // The source Vitruvian eye look-dev uses a procedural shader as well;
          // a plain texture+tint leaves the iris/pupil effectively unreadable.
          mat.map = null;
          mat.color.setHex(0xffffff);
          mat.metalness = 0;
          mat.roughness = .32;
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

  createScleraMaskTexture(){
    if(this.scleraMaskTexture) return this.scleraMaskTexture;

    // The Vitruvian GLB exports the iris slightly behind the front of the
    // sclera sphere. The source look-dev relies on an eye shader to reveal
    // that inner iris. In a plain Three.js PBR material the opaque sclera
    // wins the depth test and produces the all-white eyes we were seeing.
    //
    // The sclera UV directly facing the camera is centered at ~(.504,.502).
    // Cut a soft circular aperture there so the authored iris/cornea layers
    // remain visible without moving or deforming the eye geometry.
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const cx = 129;
    const cy = 128;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,256,256);

    const hole = ctx.createRadialGradient(cx,cy,31,cx,cy,40);
    hole.addColorStop(0.00, "rgba(0,0,0,1)");
    hole.addColorStop(0.72, "rgba(0,0,0,1)");
    hole.addColorStop(1.00, "rgba(255,255,255,1)");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(cx,cy,41,0,Math.PI*2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    texture.userData.veilwatchShared = true;
    this.scleraMaskTexture = texture;
    return texture;
  }

  createIrisTexture(color){
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const cx = 128;
    const cy = 128;
    const base = new THREE.Color(color);
    const dark = base.clone().multiplyScalar(.34);
    const mid = base.clone().multiplyScalar(.78);
    const bright = base.clone().lerp(new THREE.Color(0xffffff), .25);
    const css = (c)=>`rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;

    ctx.clearRect(0,0,256,256);
    const iris = ctx.createRadialGradient(cx,cy,16,cx,cy,124);
    iris.addColorStop(0.00, "#08070a");
    iris.addColorStop(0.17, "#09080b");
    iris.addColorStop(0.19, css(dark));
    iris.addColorStop(0.48, css(mid));
    iris.addColorStop(0.76, css(bright));
    iris.addColorStop(0.92, css(base));
    iris.addColorStop(1.00, css(dark.multiplyScalar(.55)));
    ctx.fillStyle = iris;
    ctx.fillRect(0,0,256,256);

    // Deterministic radial fibres so eye colours still retain iris structure.
    ctx.save();
    ctx.translate(cx,cy);
    ctx.globalCompositeOperation = "screen";
    for(let i=0;i<96;i++){
      const a = (i / 96) * Math.PI * 2;
      const wobble = ((i * 37) % 11) / 11;
      const r0 = 29 + wobble * 11;
      const r1 = 101 + ((i * 17) % 19);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*r0, Math.sin(a)*r0);
      ctx.lineTo(Math.cos(a)*r1, Math.sin(a)*r1);
      ctx.strokeStyle = `rgba(255,255,255,${0.025 + (i%5)*0.009})`;
      ctx.lineWidth = .65 + (i%3)*.18;
      ctx.stroke();
    }
    ctx.restore();

    // Hard pupil and a dark limbal ring keep the eyes readable at full-body distance.
    ctx.beginPath();
    ctx.arc(cx,cy,24,0,Math.PI*2);
    ctx.fillStyle = "#07070a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx,cy,120,0,Math.PI*2);
    ctx.strokeStyle = "rgba(12,10,13,.72)";
    ctx.lineWidth = 7;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() || 1);
    texture.needsUpdate = true;
    texture.userData.veilwatchShared = true;
    return texture;
  }

  applyIrisColor(eyeColor){
    if(!this.currentObject) return;
    const key = eyeColor.getHexString();
    if(!this.irisTexture || this._irisColorKey !== key){
      if(this.irisTexture) this.irisTexture.dispose?.();
      this.irisTexture = this.createIrisTexture(eyeColor);
      this._irisColorKey = key;
    }
    this.currentObject.traverse((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat)=>{
        const name = String(mat?.name || "");
        if(!name.startsWith("VitIris")) return;
        mat.map = this.irisTexture;
        mat.color?.setHex?.(0xffffff);
        mat.metalness = 0;
        mat.roughness = .32;
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.depthTest = true;
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

    const cap = ()=>add(new THREE.SphereGeometry(.118, 40, 24, 0, Math.PI*2, 0, Math.PI*.64), [0,1.658,-.018], [1.02,1.00,1.03]);
    if(styleId === "buzz"){
      cap();
    }else if(styleId === "curls"){
      cap();
      for(let i=0;i<30;i++){ const a=(i/30)*Math.PI*2, r=.075+((i%3)*.012); add(new THREE.SphereGeometry(.018,10,8), [Math.cos(a)*r,1.704+(i%5)*.011,-.01+Math.sin(a)*r*.45]); }
    }else if(styleId === "ponytail"){
      cap(); add(new THREE.SphereGeometry(.055,18,14), [0,1.69,-.115],[.85,1.0,.85]); add(new THREE.CylinderGeometry(.026,.018,.23,14), [0,1.56,-.15],[1,1,1],[.18,0,0]);
    }else if(styleId === "bun"){
      cap(); add(new THREE.SphereGeometry(.066,22,16), [0,1.77,-.07],[1,.9,1]);
    }else if(styleId === "long"){
      cap(); [-1,1].forEach(side=>add(new THREE.CylinderGeometry(.036,.045,.45,16), [side*.09,1.51,-.035],[.9,1,.75],[0,0,side*.05]));
    }else if(styleId === "braids" || styleId === "locs"){
      cap(); const n=styleId==='braids'?12:18; for(let i=0;i<n;i++){ const x=((i%(n/2))/(n/2-1)-.5)*.19, back=i>=n/2; add(new THREE.CylinderGeometry(.006,.008,.34,8), [x,1.54,back?-.075:.015],[1,1,1],[back?.08:0,0,0]); }
    }else if(styleId === "side_part" || styleId === "slicked"){
      cap(); const sweep=new THREE.BoxGeometry(.17,.035,.11); add(sweep,[styleId==='side_part'?.025:0,1.756,-.018],[1,1,1],[0,0,styleId==='side_part'?-0.18:0]);
    }else{
      cap(); const tuftGeo = new THREE.ConeGeometry(.009,.038,8); [-.055,-.028,0,.028,.055].forEach((x,i)=>add(tuftGeo.clone(), [x,1.755,-.012 + Math.abs(x)*.18], [1,1 + (i===2?.15:0),1], [0,0,(x/0.055)*-.16]));
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

  tintHairRoot(root, hairColor){
    if(!root) return;
    const tint = hairColor.clone().lerp(new THREE.Color(0xffffff), .08);
    root.traverse((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.forEach((mat)=>{
        if(!mat) return;
        if(mat.color) mat.color.copy(tint);
        mat.metalness=0;
        mat.roughness=Math.max(.62, Number(mat.roughness??.78));
        mat.side=THREE.DoubleSide;
        mat.needsUpdate=true;
      });
    });
  }

  loadCustomHairAsset(styleDef, hairColor, cacheKey){
    const styleId=String(styleDef?.id||"");
    const path=String(styleDef?.path||"").trim();
    if(!styleId || !path) return;
    if(this.customHairRoot && this._customHairStyleId===styleId){
      this.customHairRoot.visible=true;
      this.tintHairRoot(this.customHairRoot,hairColor);
      this._activeHairStyleKey=cacheKey;
      return;
    }
    if(this.customHairRoot){ this.disposeDetached(this.customHairRoot); this.customHairRoot=null; }
    const token=++this._hairLoadToken;
    const generation=this._forgeGeneration||0;
    this.loader.loadAsync(path).then((gltf)=>{
      if(token!==this._hairLoadToken || generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      const root=this.bindWorldAuthoredRootToHead(gltf.scene);
      if(!root){ disposeObject(gltf.scene); return; }
      root.name=`VeilwatchHair_${styleId}`;
      this.tintHairRoot(root,hairColor);
      this.customHairRoot=root;
      this._customHairStyleId=styleId;
      this._activeHairStyleKey=cacheKey;
    }).catch(()=>{
      if(token===this._hairLoadToken && generation===(this._forgeGeneration||0)){
        // Keep the real bundled bob as the visual fallback when an optional
        // installed hairstyle asset fails to load.
        if(this.hairAssetRoot){ this.hairAssetRoot.visible=true; this.tintHairRoot(this.hairAssetRoot,hairColor); }
      }
    });
  }

  applyHairStyle(styleDef={}, hairColor){
    if(!this.currentObject || !this.headBone) return;
    const styleId=String(styleDef?.id||"classic_bob");
    const kind=String(styleDef?.kind||"asset");
    const cacheKey=`${styleId}:${hairColor.getHexString()}`;

    if(this.hairAssetRoot){ this.resetAssetHairTransform(); this.hairAssetRoot.visible=false; }
    if(this.proceduralHairRoot){ this.disposeDetached(this.proceduralHairRoot); this.proceduralHairRoot=null; }
    if(this.customHairRoot){ this.customHairRoot.visible=false; }

    if(kind==="none"){
      this._hairLoadToken++;
      this._activeHairStyleKey=cacheKey;
      return;
    }

    // Separate installed GLB per style. No stretching the bob into unrelated
    // hairstyles. Every option exposed in the manifest has its own mesh.
    if(styleDef?.path){
      this.loadCustomHairAsset(styleDef,hairColor,cacheKey);
      return;
    }

    if(kind==="procedural"){
      this.proceduralHairRoot=this.createProceduralHair(String(styleDef?.variant||styleId),hairColor);
      this._activeHairStyleKey=cacheKey;
      return;
    }

    const root=this.hairAssetRoot;
    if(!root) return;
    root.visible=true;
    this.tintHairRoot(root,hairColor);
    this._activeHairStyleKey=cacheKey;
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
    if(this.facialHairRoot){ this.disposeDetached(this.facialHairRoot); this.facialHairRoot=null; }
    const id=String(styleDef?.id||"none"); if(id==="none") return;
    const path=String(styleDef?.path||"");
    if(styleDef?.kind==="asset" && path){
      const token=this._loadToken, generation=this._forgeGeneration||0;
      this.loader.loadAsync(path).then(gltf=>{
        if(token!==this._loadToken || generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
        gltf.scene.traverse(obj=>{ if(!obj.isMesh||!obj.material)return; const mats=Array.isArray(obj.material)?obj.material:[obj.material]; mats.forEach(mat=>{ if(mat?.color)mat.color.copy(hairColor); if(mat){mat.metalness=0;mat.roughness=.82;mat.needsUpdate=true;} }); });
        const mounted=this.bindWorldAuthoredRootToHead(gltf.scene);
        if(mounted){ mounted.name=`VeilwatchFacialHair_${id}`; this.facialHairRoot=mounted; }
      }).catch(()=>{ if(generation===(this._forgeGeneration||0)) this.facialHairRoot=this.createFacialHair(styleDef,hairColor); });
      return;
    }
    this.facialHairRoot=this.createFacialHair(styleDef,hairColor);
  }

  applyFacePreset(weights={}){
    const prev = this._activeFaceWeights || {};
    const next = weights && typeof weights === "object" ? weights : {};
    const names = new Set([...Object.keys(prev), ...Object.keys(next)]);
    names.forEach((name)=>this.setFaceMorph(name, Number(next[name] || 0)));
    this._activeFaceWeights = {...next};
  }

  boneByName(name){
    const wanted=String(name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    let found=null;
    this.currentObject?.traverse?.((obj)=>{ if(found) return; const n=String(obj.name||"").toLowerCase().replace(/[^a-z0-9]/g,""); if(obj.isBone && (n===wanted || n.endsWith(wanted))) found=obj; });
    return found;
  }

  normalizeRigName(value){
    return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  }

  runtimeMorphFalloff(value,center,width){
    const d=(Number(value)-center)/Math.max(.0001,width);
    return Math.exp(-(d*d));
  }

  ensureRuntimeBodyMorphs(){
    if(!this.currentObject) return;
    this.bodyMorphMeshes=[];
    const supportedMaterials=new Set(["VitBody","VitShirt","VitPants"]);
    const defs=[
      ["vw_mass",(x,y,z)=>{
        const body=this.runtimeMorphFalloff(y,.82,.78);
        return [x*.085*body,0,z*.09*body];
      }],
      ["vw_bodyFat",(x,y,z)=>{
        const torso=this.runtimeMorphFalloff(y,.96,.34);
        const hips=this.runtimeMorphFalloff(y,.72,.27);
        const belly=this.runtimeMorphFalloff(y,.98,.23)*this.runtimeMorphFalloff(x,0,.22);
        return [x*(.075*torso+.055*hips),0,z*(.055*torso+.045*hips)+Math.max(0,.050*belly)];
      }],
      ["vw_muscle",(x,y,z)=>{
        const arm=(Math.abs(x)>.22?1:0)*this.runtimeMorphFalloff(y,1.03,.48);
        const leg=(y<.76?1:0)*this.runtimeMorphFalloff(Math.abs(x),.13,.13);
        const chest=this.runtimeMorphFalloff(y,1.25,.22)*this.runtimeMorphFalloff(x,0,.27);
        const k=.045*arm+.042*leg+.025*chest;
        return [Math.sign(x||1)*k,0,Math.sign(z||.01)*k*.45];
      }],
      ["vw_shoulders",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,1.37,.16)*Math.min(1,Math.abs(x)/.16);
        return [Math.sign(x||1)*.065*w,0,0];
      }],
      ["vw_chestVolume",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,1.25,.18)*this.runtimeMorphFalloff(x,0,.28);
        return [x*.018*w,0,(z>=-.03?.052:.018)*w];
      }],
      ["vw_waist",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,.99,.16)*Math.min(1,Math.abs(x)/.08+.15);
        return [Math.sign(x||1)*.055*w,0,z*.025*w];
      }],
      ["vw_hips",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,.78,.20);
        return [Math.sign(x||1)*.060*w,0,z*.018*w];
      }],
      ["vw_glutes",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,.72,.16)*this.runtimeMorphFalloff(Math.abs(x),.11,.12);
        return [0,0,-.070*w];
      }],
      ["vw_armSize",(x,y,z)=>{
        const w=(Math.abs(x)>.21?1:0)*this.runtimeMorphFalloff(y,1.02,.48);
        return [Math.sign(x||1)*.040*w,0,z*.025*w];
      }],
      ["vw_legSize",(x,y,z)=>{
        const w=(y<.82?1:0)*this.runtimeMorphFalloff(Math.abs(x),.13,.15);
        return [Math.sign(x||1)*.040*w,0,z*.035*w];
      }],
      ["vw_neckSize",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,1.46,.07)*this.runtimeMorphFalloff(x,0,.14);
        return [x*.18*w,0,z*.10*w];
      }],
      ["vw_torsoLength",(x,y,z)=>{
        const w=Math.max(0,Math.min(1,(y-.82)/.63))*this.runtimeMorphFalloff(x,0,.38);
        return [0,.035*w,0];
      }],
      ["vw_armLength",(x,y,z)=>{
        const ax=Math.abs(x), w=Math.max(0,Math.min(1,(ax-.20)/.38))*this.runtimeMorphFalloff(y,1.24,.34);
        return [Math.sign(x||1)*.045*w,0,0];
      }],
      ["vw_legLength",(x,y,z)=>{
        const w=Math.max(0,Math.min(1,(.80-y)/.72));
        return [0,-.045*w,0];
      }],
      ["vw_handSize",(x,y,z)=>{
        const w=Math.max(0,Math.min(1,(Math.abs(x)-.48)/.12))*this.runtimeMorphFalloff(y,1.23,.18);
        return [Math.sign(x||1)*.020*w,(y-1.23)*.08*w,z*.08*w];
      }],
      ["vw_footSize",(x,y,z)=>{
        const w=this.runtimeMorphFalloff(y,.045,.10);
        return [x*.05*w,0,z*.22*w];
      }],
      ["vw_breasts",(x,y,z)=>{
        const left=this.runtimeMorphFalloff(x,-.085,.065);
        const right=this.runtimeMorphFalloff(x,.085,.065);
        const chest=this.runtimeMorphFalloff(y,1.245,.105)*(left+right);
        const front=Math.max(0,1-Math.abs(z-.035)/.15);
        return [Math.sign(x||1)*.010*chest,0,.090*chest*(.45+.55*front)];
      }]
    ];

    this.currentObject.traverse(obj=>{
      if(!obj.isSkinnedMesh || !obj.geometry?.attributes?.position) return;
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      if(!mats.some(mat=>supportedMaterials.has(String(mat?.name||"")))) return;
      const geo=obj.geometry;
      if(!geo.userData.veilwatchRuntimeBodyMorphs){
        // Runtime-generated relative morphs give the web Forge real body-shape
        // variation even though the compact Vitruvian runtime GLB was exported
        // without the source .blend's full body shape-key library.
        const pos=geo.attributes.position;
        geo.morphTargetsRelative=true;
        geo.morphAttributes.position=[];
        for(const [name,fn] of defs){
          const values=new Float32Array(pos.count*3);
          for(let i=0;i<pos.count;i++){
            const [dx,dy,dz]=fn(pos.getX(i),pos.getY(i),pos.getZ(i));
            values[i*3]=dx; values[i*3+1]=dy; values[i*3+2]=dz;
          }
          const attr=new THREE.Float32BufferAttribute(values,3);
          attr.name=name;
          geo.morphAttributes.position.push(attr);
        }
        geo.userData.veilwatchRuntimeBodyMorphs=defs.map(([name])=>name);
      }
      obj.updateMorphTargets();
      const names=geo.userData.veilwatchRuntimeBodyMorphs||[];
      const indices={};
      names.forEach((name,i)=>indices[name]=i);
      obj.userData.veilwatchRuntimeMorphIndices=indices;
      this.bodyMorphMeshes.push(obj);
    });
  }

  applyRuntimeBodyMorphs(f={}){
    if(!this.bodyMorphMeshes?.length) this.ensureRuntimeBodyMorphs();
    const centered=(v)=>THREE.MathUtils.clamp((Number(v??50)-50)/50,-1,1);
    const feminine=f.frame==='feminine';
    const values={
      vw_mass:centered(f.mass),
      vw_bodyFat:centered(f.bodyFat),
      vw_muscle:centered(f.muscle),
      vw_shoulders:THREE.MathUtils.clamp(centered(f.shoulders)+(feminine?-.24:.12),-1,1),
      vw_chestVolume:centered(f.chestVolume)+(f.chest==='pectoral'?.16:0),
      vw_waist:THREE.MathUtils.clamp(centered(f.waist)+(feminine?-.18:.06),-1,1),
      vw_hips:THREE.MathUtils.clamp(centered(f.hips)+(feminine?.28:-.10),-1,1),
      vw_glutes:centered(f.glutes)+(feminine?.10:0),
      vw_armSize:centered(f.armSize),
      vw_legSize:centered(f.legSize),
      vw_neckSize:centered(f.neckSize),
      vw_torsoLength:centered(f.torsoLength),
      vw_armLength:centered(f.armLength),
      vw_legLength:centered(f.legLength),
      vw_handSize:centered(f.handSize),
      vw_footSize:centered(f.footSize),
      vw_breasts:f.chest==='breasts'?THREE.MathUtils.clamp(.14+(Number(f.breastSize??35)/100)*.82+(Number(f.breastProjection??35)/100)*.22,0,1.18):0
    };
    for(const mesh of this.bodyMorphMeshes||[]){
      const indices=mesh.userData.veilwatchRuntimeMorphIndices||{};
      for(const [name,value] of Object.entries(values)){
        const i=indices[name];
        if(i===undefined || !mesh.morphTargetInfluences) continue;
        mesh.morphTargetInfluences[i]=THREE.MathUtils.clamp(Number(value)||0,-1.1,1.2);
      }
    }
  }

  ensureRuntimeFaceMorphs(){
    if(!this.headAssetRoot) return;
    this.faceMorphMeshes=[];
    const fall=(v,c,r)=>Math.max(0,1-Math.abs(v-c)/Math.max(.0001,r));
    const defs=[
      ["vw_faceWidth",(x,y,z)=>{const w=fall(y,1.61,.15)*Math.max(0,1-Math.max(0,-z-.02)/.10);return [Math.sign(x||1)*.018*w,0,0];}],
      ["vw_jawWidth",(x,y,z)=>{const w=fall(y,1.535,.075)*Math.min(1,Math.abs(x)/.025+.15);return [Math.sign(x||1)*.018*w,0,0];}],
      ["vw_jawAngle",(x,y,z)=>{const w=fall(y,1.555,.085)*fall(Math.abs(x),.058,.045);return [Math.sign(x||1)*.012*w,-.005*w,0];}],
      ["vw_chinWidth",(x,y,z)=>{const w=fall(y,1.505,.045)*fall(x,0,.065);return [Math.sign(x||1)*.012*w,0,0];}],
      ["vw_chinProjection",(x,y,z)=>{const w=fall(y,1.505,.050)*fall(x,0,.060)*Math.max(0,(z+.04)/.14);return [0,0,.020*w];}],
      ["vw_cheekboneHeight",(x,y,z)=>{const w=fall(Math.abs(x),.052,.038)*fall(y,1.605,.070)*Math.max(0,(z+.02)/.12);return [0,.013*w,.004*w];}],
      ["vw_cheekboneWidth",(x,y,z)=>{const w=fall(Math.abs(x),.052,.040)*fall(y,1.605,.075)*Math.max(0,(z+.02)/.12);return [Math.sign(x||1)*.014*w,0,.005*w];}],
      ["vw_noseWidth",(x,y,z)=>{const w=fall(x,0,.034)*fall(y,1.615,.080)*Math.max(0,(z-.015)/.10);return [Math.sign(x||1)*.008*w,0,0];}],
      ["vw_noseLength",(x,y,z)=>{const w=fall(x,0,.033)*fall(y,1.605,.075)*Math.max(0,(z-.02)/.10);return [0,-.013*w,.003*w];}],
      ["vw_noseProjection",(x,y,z)=>{const w=fall(x,0,.033)*fall(y,1.615,.075)*Math.max(0,(z-.005)/.11);return [0,0,.018*w];}],
      ["vw_browHeight",(x,y,z)=>{const w=fall(y,1.665,.040)*Math.max(0,(z-.005)/.10);return [0,.010*w,0];}],
      ["vw_lipFullness",(x,y,z)=>{const w=fall(y,1.568,.033)*fall(x,0,.055)*Math.max(0,(z-.005)/.09);return [0,0,.012*w];}],
      ["vw_mouthWidth",(x,y,z)=>{const w=fall(y,1.57,.035)*fall(Math.abs(x),.035,.035)*Math.max(0,(z-.005)/.09);return [Math.sign(x||1)*.009*w,0,0];}],
      ["vw_earSize",(x,y,z)=>{const w=fall(Math.abs(x),.088,.020)*fall(y,1.605,.075);return [Math.sign(x||1)*.006*w,(y-1.605)*.12*w,0];}]
    ];
    this.headAssetRoot.traverse(obj=>{
      if(!obj.isMesh || !obj.geometry?.attributes?.position) return;
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      const names=mats.map(m=>String(m?.name||""));
      if(!names.some(n=>n==="VitSkin" || n==="VitMouth")) return;
      const geo=obj.geometry;
      if(!geo.userData.veilwatchRuntimeFaceMorphs){
        const pos=geo.attributes.position;
        geo.morphTargetsRelative=true;
        geo.morphAttributes ||= {};
        geo.morphAttributes.position ||= [];
        for(const [name,fn] of defs){
          const values=new Float32Array(pos.count*3);
          for(let i=0;i<pos.count;i++){
            const [dx,dy,dz]=fn(pos.getX(i),pos.getY(i),pos.getZ(i));
            values[i*3]=dx; values[i*3+1]=dy; values[i*3+2]=dz;
          }
          const attr=new THREE.Float32BufferAttribute(values,3); attr.name=name; geo.morphAttributes.position.push(attr);
        }
        geo.userData.veilwatchRuntimeFaceMorphs=defs.map(([name])=>name);
      }
      obj.updateMorphTargets();
      const indices={};
      for(const name of geo.userData.veilwatchRuntimeFaceMorphs||[]){ const i=obj.morphTargetDictionary?.[name]; if(i!==undefined) indices[name]=i; }
      obj.userData.veilwatchRuntimeFaceMorphIndices=indices;
      this.faceMorphMeshes.push(obj);
    });
    // Store eye transforms once. All eye layers move/scale together.
    this.headAssetRoot.traverse(obj=>{
      const n=String(obj.name||"");
      if(!/^Eye_[LR]/i.test(n)) return;
      if(!obj.userData.veilwatchEyeBase){ obj.userData.veilwatchEyeBase={position:obj.position.clone(),scale:obj.scale.clone()}; }
    });
  }

  applyRuntimeFaceMorphs(f={}){
    if(!this.faceMorphMeshes?.length) this.ensureRuntimeFaceMorphs();
    const centered=v=>THREE.MathUtils.clamp((Number(v??50)-50)/50,-1,1);
    const values={
      vw_faceWidth:centered(f.faceWidth),vw_jawWidth:centered(f.jawWidth),vw_jawAngle:centered(f.jawAngle),vw_chinWidth:centered(f.chinWidth),vw_chinProjection:centered(f.chinProjection),
      vw_cheekboneHeight:centered(f.cheekboneHeight),vw_cheekboneWidth:centered(f.cheekboneWidth),vw_noseWidth:centered(f.noseWidth),vw_noseLength:centered(f.noseLength),vw_noseProjection:centered(f.noseProjection),
      vw_browHeight:centered(f.browHeight),vw_lipFullness:centered(f.lipFullness),vw_mouthWidth:centered(f.mouthWidth),vw_earSize:centered(f.earSize)
    };
    for(const mesh of this.faceMorphMeshes||[]){
      const idx=mesh.userData.veilwatchRuntimeFaceMorphIndices||{};
      for(const [name,value] of Object.entries(values)){ const i=idx[name]; if(i!==undefined&&mesh.morphTargetInfluences) mesh.morphTargetInfluences[i]=value; }
    }
    const spacing=centered(f.eyeSpacing)*.008, eyeScale=1+centered(f.eyeSize)*.13;
    this.headAssetRoot?.traverse?.(obj=>{
      if(!/^Eye_[LR]/i.test(String(obj.name||"")) || !obj.userData.veilwatchEyeBase) return;
      const base=obj.userData.veilwatchEyeBase; obj.position.copy(base.position); obj.scale.copy(base.scale).multiplyScalar(eyeScale);
      obj.position.x += /^Eye_L/i.test(obj.name)?-spacing:spacing;
    });
  }

  animationTrackNodeName(trackName){
    const raw=String(trackName||"");
    const dot=raw.lastIndexOf(".");
    if(dot<0) return "";
    let node=raw.slice(0,dot);
    const bones=node.match(/bones\[([^\]]+)\]/i);
    if(bones) node=bones[1];
    node=node.split("/").pop().split("|").pop();
    return node.replace(/^Armature[:_]?/i,"");
  }

  retargetQuaterniusClip(clip,sourceRoot){
    if(!clip || !sourceRoot) return null;
    sourceRoot.updateMatrixWorld(true);
    this.currentObject?.updateMatrixWorld?.(true);
    const sourceNodes=new Map();
    sourceRoot.traverse(obj=>{
      const key=this.normalizeRigName(obj.name);
      if(key && !sourceNodes.has(key)) sourceNodes.set(key,obj);
    });

    const tracks=[];
    for(const track of clip.tracks||[]){
      if(!/\.quaternion$/i.test(track.name)) continue;
      const sourceName=this.animationTrackNodeName(track.name);
      const sourceKey=this.normalizeRigName(sourceName);
      const targetShort=UAL_TO_VITRUVIAN_BONES[sourceKey];
      if(!targetShort) continue;
      const sourceNode=sourceNodes.get(sourceKey);
      const targetBone=this.boneByName(targetShort);
      if(!sourceNode || !targetBone) continue;

      const sourceRest=sourceNode.quaternion.clone();
      const sourceRestInv=sourceRest.clone().invert();
      const targetRest=targetBone.quaternion.clone();
      const sourceParentWorld=new THREE.Quaternion();
      const targetParentWorld=new THREE.Quaternion();
      sourceNode.parent?.getWorldQuaternion?.(sourceParentWorld);
      targetBone.parent?.getWorldQuaternion?.(targetParentWorld);
      const frameMap=targetParentWorld.clone().invert().multiply(sourceParentWorld);
      const frameMapInv=frameMap.clone().invert();

      const values=new Float32Array(track.values.length);
      const qAnim=new THREE.Quaternion();
      for(let i=0;i<track.values.length;i+=4){
        qAnim.fromArray(track.values,i);
        const delta=qAnim.clone().multiply(sourceRestInv);
        const mapped=frameMap.clone().multiply(delta).multiply(frameMapInv);
        const qTarget=mapped.multiply(targetRest).normalize();
        qTarget.toArray(values,i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${targetBone.name}.quaternion`,track.times.slice(),values));
    }
    if(!tracks.length) return null;
    return new THREE.AnimationClip(clip.name,clip.duration,tracks);
  }

  async ensureForgeAnimationLibrary(token=this._loadToken){
    if(this._forgeAnimationPromise) return this._forgeAnimationPromise;
    this._forgeAnimationPromise=(async()=>{
      try{
        const results=await Promise.allSettled([this.loader.loadAsync(QUATERNIUS_UAL1),this.loader.loadAsync(QUATERNIUS_UAL2)]);
        if(token!==this._loadToken || !this.currentObject) return;
        const byName=new Map((this.availableAnimations||[]).map(c=>[c.name,c]));
        let count=0;
        for(const result of results){
          if(result.status!=="fulfilled") continue;
          const gltf=result.value, sourceRoot=gltf.scene||gltf.scenes?.[0];
          const wanted=(gltf.animations||[]).filter(c=>FORGE_EXTERNAL_ANIMATION_NAMES.has(c.name));
          for(const clip of wanted){ const retargeted=this.retargetQuaterniusClip(clip,sourceRoot); if(retargeted){byName.set(retargeted.name,retargeted);count++;} }
          disposeObject(sourceRoot);
        }
        this.availableAnimations=[...byName.values()];
        const requested=this.profile?.appearance?.forge?.animation||"Idle";
        this._requestedAnimationName=""; this.applyAnimation(requested,true);
        console.info(`Veilwatch animation library online: ${count} CC0 clips retargeted.`);
      }catch(err){
        console.warn("Veilwatch external animation library unavailable; using native clips:",err?.message||err);
      }finally{ this._forgeAnimationPromise=null; }
    })();
    return this._forgeAnimationPromise;
  }

  clearForgeVisuals(){
    (this.forgeVisuals || []).forEach(root=>{ root?.parent?.remove(root); disposeObject(root); });
    this.forgeVisuals=[];
    if(this.forgeRoot){ this.forgeRoot.parent?.remove(this.forgeRoot); disposeObject(this.forgeRoot); }
    this.forgeRoot=null;
  }

  attachToBone(group,boneName,pos=[0,0,0],rot=[0,0,0]){
    const bone=this.boneByName(boneName); if(!bone) return null;
    group.position.set(...pos); group.rotation.set(...rot); bone.add(group); this.forgeVisuals ||= []; this.forgeVisuals.push(group); return group;
  }

  forgeMat(color,metalness=.05,roughness=.72){ return new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide}); }

  createCuffFallback(side="left"){
    const g=new THREE.Group(); g.name="VeilwatchProjectionCuff";
    const dark=this.forgeMat(0x111820,.65,.3), silver=this.forgeMat(0xaeb8bf,.75,.25), yellow=this.forgeMat(0xe0b51f,.45,.28), glass=this.forgeMat(0x07141c,.72,.12);
    const add=(geo,mat,pos,rot=[0,0,0])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);g.add(m);return m;};
    add(new THREE.CylinderGeometry(.061,.066,.115,24),dark,[0,0,0]);
    add(new THREE.BoxGeometry(.105,.09,.035),silver,[0,.005,.055]);
    add(new THREE.BoxGeometry(.088,.072,.012),glass,[0,.007,.078]);
    add(new THREE.BoxGeometry(.012,.095,.018),yellow,[-.055,.002,.063]); add(new THREE.BoxGeometry(.012,.095,.018),yellow,[.055,.002,.063]);
    add(new THREE.CylinderGeometry(.020,.025,.018,20),glass,[0,-.055,.065],[Math.PI/2,0,0]);
    const bone=side==='right'?'RightForeArm':'LeftForeArm';
    return this.attachToBone(g,bone,[0,.115,0],[0,0,0]);
  }

  createCuff(side="left"){
    const generation=this._forgeGeneration||0;
    const bone=side==='right'?'RightForeArm':'LeftForeArm';
    this.loader.loadAsync(VEILWATCH_CUFF_ASSET).then(gltf=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      const wrapper=new THREE.Group(); wrapper.name="VeilwatchProjectionCuff";
      const model=gltf.scene.clone(true);
      model.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
      // Authored at forearm scale with Y following the forearm. Keep the model's
      // origin at the band center so left/right attachment uses the same transform.
      wrapper.add(model);
      this.attachToBone(wrapper,bone,[0,.115,0],[0,0,0]);
    }).catch(()=>{
      if(generation===(this._forgeGeneration||0)) this.createCuffFallback(side);
    });
    return null;
  }

  weaponCarryTransform(carry){
    const map={
      right_hand:['RightHand',[0,.06,.02],[Math.PI/2,0,0]],
      left_hand:['LeftHand',[0,.06,.02],[Math.PI/2,0,0]],
      right_hip:['RightUpLeg',[0,.06,.08],[0,0,0]],
      left_hip:['LeftUpLeg',[0,.06,.08],[0,0,0]],
      chest:['Spine2',[0,.08,.14],[0,Math.PI/2,0]],
      back:['Spine2',[0,.05,-.17],[0,.25,.15]]
    };
    return map[carry]||map.back;
  }

  weaponTargetLength(id){
    if(/sniper|marksman|dmr|hunting/.test(id)) return .86;
    if(/rifle|shotgun|carbine/.test(id)) return .72;
    if(/smg|machine_pistol/.test(id)) return .42;
    return .24;
  }

  prepareWeaponAsset(scene,id){
    const wrapper=new THREE.Group(); wrapper.name=`VeilwatchWeapon_${id}`;
    const model=scene.clone(true);
    model.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    let box=new THREE.Box3().setFromObject(model);
    const size=new THREE.Vector3(); box.getSize(size);
    const dims=[size.x,size.y,size.z]; const longest=Math.max(...dims,1e-5);
    const scale=this.weaponTargetLength(id)/longest; model.scale.setScalar(scale);
    box=new THREE.Box3().setFromObject(model); const center=new THREE.Vector3(); box.getCenter(center);
    model.position.sub(center);
    // Normalize the longest authored axis toward local Z so the same carry
    // sockets can be used across unrelated source models.
    if(dims[0] >= dims[1] && dims[0] >= dims[2]) model.rotation.y=Math.PI/2;
    else if(dims[1] >= dims[0] && dims[1] >= dims[2]) model.rotation.x=Math.PI/2;
    wrapper.add(model); return wrapper;
  }

  createWeaponFallback(id,carry){
    if(!id || id==='none') return null;
    const g=new THREE.Group(); g.name=`VeilwatchWeapon_${id}_Fallback`;
    const dark=this.forgeMat(0x20252b,.75,.35), metal=this.forgeMat(0x515962,.85,.25), grip=this.forgeMat(0x17191c,.15,.8), accent=this.forgeMat(0x8a949d,.6,.35);
    const add=(geo,mat,pos,rot=[0,0,0])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);g.add(m);};
    const rifle=/rifle|smg|shotgun|carbine|dmr|sniper/.test(id);
    if(id==='riot_shield'){ add(new THREE.BoxGeometry(.34,.50,.035),dark,[0,.15,0]); add(new THREE.BoxGeometry(.18,.08,.025),metal,[0,.27,.025]); }
    else if(id==='grenade'){ add(new THREE.SphereGeometry(.055,16,12),dark,[0,0,0]); add(new THREE.BoxGeometry(.025,.035,.025),metal,[0,.06,0]); }
    else if(id==='breaching_charge'){ add(new THREE.BoxGeometry(.13,.18,.045),dark,[0,0,0]); add(new THREE.BoxGeometry(.07,.035,.012),accent,[0,.035,.03]); }
    else if(id==='pepper_spray'){ add(new THREE.CylinderGeometry(.025,.026,.15,16),dark,[0,0,0]); add(new THREE.BoxGeometry(.035,.025,.035),metal,[0,.085,0]); }
    else if(id==='taser'){ add(new THREE.BoxGeometry(.065,.10,.18),dark,[0,0,-.05]); add(new THREE.BoxGeometry(.05,.14,.055),grip,[0,-.10,0],[.18,0,0]); add(new THREE.BoxGeometry(.035,.03,.025),accent,[0,.04,-.15]); }
    else if(id==='revolver'){ add(new THREE.BoxGeometry(.06,.07,.17),metal,[0,.01,-.06]); add(new THREE.CylinderGeometry(.045,.045,.055,16),dark,[0,.01,-.03],[0,0,Math.PI/2]); add(new THREE.BoxGeometry(.045,.14,.055),grip,[0,-.10,0],[.18,0,0]); }
    else if(/knife/.test(id)){ add(new THREE.ConeGeometry(.025,.23,4),metal,[0,.08,0]); add(new THREE.BoxGeometry(.04,.10,.032),grip,[0,-.08,0]); }
    else if(/hatchet/.test(id)){ add(new THREE.CylinderGeometry(.018,.022,.30,10),grip,[0,.02,0]); add(new THREE.BoxGeometry(.12,.07,.025),metal,[.045,.15,0]); }
    else if(/crowbar/.test(id)){ add(new THREE.CylinderGeometry(.014,.014,.34,10),metal,[0,.02,0]); add(new THREE.TorusGeometry(.045,.014,8,16,Math.PI*.7),metal,[.025,.19,0],[0,0,.6]); }
    else if(/baton/.test(id)){ add(new THREE.CylinderGeometry(.018,.020,.34,12),dark,[0,.02,0]); }
    else if(id==='improvised_weapon'){ add(new THREE.CylinderGeometry(.022,.026,.38,10),metal,[0,.02,0]); add(new THREE.BoxGeometry(.07,.05,.04),dark,[0,.20,0]); }
    else if(rifle){ add(new THREE.BoxGeometry(.07,.08,.58),dark,[0,0,-.1]); add(new THREE.CylinderGeometry(.012,.012,.38,12),metal,[0,.005,-.53],[Math.PI/2,0,0]); add(new THREE.BoxGeometry(.055,.16,.04),grip,[0,-.10,-.05],[.18,0,0]); if(/sniper|dmr|marksman/.test(id)) add(new THREE.CylinderGeometry(.018,.018,.18,16),metal,[0,.065,-.08],[Math.PI/2,0,0]); }
    else { add(new THREE.BoxGeometry(.055,.10,.20),dark,[0,0,-.06]); add(new THREE.BoxGeometry(.045,.14,.055),grip,[0,-.10,0],[.18,0,0]); }
    const [bone,pos,rot]=this.weaponCarryTransform(carry); return this.attachToBone(g,bone,pos,rot);
  }

  createWeapon(id,carry){
    if(!id || id==='none') return null;
    const asset=FPS_WEAPON_ASSETS[id] || LOCAL_WEAPON_ASSETS[id];
    if(!asset) return this.createWeaponFallback(id,carry);
    const generation=this._forgeGeneration||0;
    const root=LOCAL_WEAPON_ASSETS[id] ? LOCAL_WEAPON_ROOT : FPS_WEAPON_ROOT;
    const url=`${root}/${asset}`;
    this.loader.loadAsync(url).then(gltf=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      const g=this.prepareWeaponAsset(gltf.scene,id);
      const [bone,pos,rot]=this.weaponCarryTransform(carry); this.attachToBone(g,bone,pos,rot);
    }).catch(async()=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject) return;
      const local=LOCAL_WEAPON_ASSETS[id];
      if(root===FPS_WEAPON_ROOT && local){
        try{
          const gltf=await this.loader.loadAsync(`${LOCAL_WEAPON_ROOT}/${local}`);
          if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
          const g=this.prepareWeaponAsset(gltf.scene,id);
          const [bone,pos,rot]=this.weaponCarryTransform(carry); this.attachToBone(g,bone,pos,rot); return;
        }catch(e){}
      }
      this.createWeaponFallback(id,carry);
    });
    return null;
  }

  tuneCyberAsset(root){
    root?.traverse?.((obj)=>{
      if(!obj.isMesh || !obj.material) return;
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.forEach((mat)=>{
        if(!mat) return;
        const n=String(mat.name||"").toLowerCase();
        if(n.includes("glow")){
          if(mat.emissive) mat.emissive.setHex(0x36c9ff);
          mat.emissiveIntensity=1.65; mat.roughness=.2;
        }else if(n.includes("metal")){ mat.metalness=.88; mat.roughness=.27; }
        else if(n.includes("ceramic")){ mat.metalness=.12; mat.roughness=.38; }
        else { mat.metalness=Math.max(.35,Number(mat.metalness||0)); mat.roughness=.36; }
        mat.needsUpdate=true;
      });
    });
  }

  createCyberPiece(kind,boneName){
    if(!kind || kind==='none') return null;
    const url=CYBER_ASSET_PATHS[kind];
    if(!url) return this.createCyberPieceFallback(kind,boneName);
    const generation=this._forgeGeneration||0;
    this.loader.loadAsync(url).then((gltf)=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      this.tuneCyberAsset(gltf.scene);
      gltf.scene.name=`Cyber_${kind}`;
      this.attachToBone(gltf.scene,boneName,[0,0,0]);
    }).catch(()=>{ if(generation===(this._forgeGeneration||0)) this.createCyberPieceFallback(kind,boneName); });
    return null;
  }

  createCyberPieceFallback(kind,boneName){
    if(!kind || kind==='none') return null; const g=new THREE.Group(); g.name=`Cyber_${kind}`;
    const metal=this.forgeMat(0x4d5964,.9,.22), dark=this.forgeMat(0x10161b,.65,.35), glow=new THREE.MeshStandardMaterial({color:0x51d6ff,emissive:0x51d6ff,emissiveIntensity:1.2,roughness:.25});
    const len=/leg/.test(kind)?.32:/arm|forearm/.test(kind)?.20:.10;
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.045,.052,len,14),metal); core.position.y=len*.45; g.add(core);
    const plate=new THREE.Mesh(new THREE.BoxGeometry(.07,len*.65,.025),dark); plate.position.set(0,len*.45,.045); g.add(plate);
    const light=new THREE.Mesh(new THREE.BoxGeometry(.012,len*.45,.006),glow); light.position.set(.02,len*.45,.06); g.add(light);
    return this.attachToBone(g,boneName,[0,0,0]);
  }

  createHeadCyberPiece(kind,zone="eye",side="right"){
    if(!kind || kind==='none' || !this.headBone || !this.headBindInverse) return null;
    const url=HEAD_CYBER_ASSET_PATHS[kind];
    // The subtle iris ring is intentionally kept as a lightweight generated
    // overlay because it is a material-level augmentation rather than a full implant.
    if(!url) return this.createHeadCyberPieceFallback(kind,zone,side);
    const generation=this._forgeGeneration||0;
    this.loader.loadAsync(url).then((gltf)=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      const sides=side==='both'?[-1,1]:[side==='left'?-1:1];
      for(const sx of sides){
        const root=gltf.scene.clone(true);
        this.tuneCyberAsset(root);
        if(zone==='eye') root.position.x=sx*.038;
        else if(zone==='temple'){ root.position.x=sx*.103; root.rotation.y=sx*.55; }
        else if(zone==='ear') root.position.x=sx*.112;
        else if(zone==='jaw'){ root.position.x=sx*.078; root.rotation.z=sx*.28; }
        const mounted=this.bindWorldAuthoredRootToHead(root);
        if(mounted){ mounted.name=`CyberHead_${zone}_${kind}_${sx<0?'L':'R'}`; this.forgeVisuals ||= []; this.forgeVisuals.push(mounted); }
      }
    }).catch(()=>{ if(generation===(this._forgeGeneration||0)) this.createHeadCyberPieceFallback(kind,zone,side); });
    return null;
  }

  createHeadCyberPieceFallback(kind,zone="eye",side="right"){
    if(!kind || kind==='none' || !this.headBone || !this.headBindInverse) return null;
    const sides=side==='both'?[-1,1]:[side==='left'?-1:1];
    const root=new THREE.Group(); root.name=`CyberHead_${zone}_${kind}`;
    const metal=this.forgeMat(0x55616c,.9,.22), dark=this.forgeMat(0x111820,.6,.34);
    const glow=new THREE.MeshStandardMaterial({color:0x51d6ff,emissive:0x51d6ff,emissiveIntensity:1.35,roughness:.22,metalness:.45});
    for(const sx of sides){
      if(zone==='eye'){
        const x=sx*.038, y=1.646, z=.125;
        const ring=new THREE.Mesh(new THREE.TorusGeometry(kind==='subtle_iris_ring'?.022:.027,kind==='subtle_iris_ring'?.0025:.005,8,28),kind==='subtle_iris_ring'?glow:metal); ring.position.set(x,y,z); root.add(ring);
        if(kind==='camera_eye'){ const lens=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.009,24),glow); lens.rotation.x=Math.PI/2; lens.position.set(x,y,z+.006); root.add(lens); }
      }else if(zone==='temple'){
        const plate=new THREE.Mesh(new THREE.BoxGeometry(.018,.065,.055),kind==='sensor_plate'?metal:dark); plate.position.set(sx*.103,1.675,.055); plate.rotation.y=sx*.55; root.add(plate);
        const node=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.008,16),glow); node.rotation.z=Math.PI/2; node.position.set(sx*.113,1.68,.075); root.add(node);
      }else if(zone==='ear'){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.027,.006,8,20),metal); ring.rotation.y=Math.PI/2; ring.position.set(sx*.112,1.626,.005); root.add(ring);
        const bud=new THREE.Mesh(new THREE.BoxGeometry(.025,.045,.02),dark); bud.position.set(sx*.118,1.62,.02); root.add(bud);
      }else if(zone==='jaw'){
        const plate=new THREE.Mesh(new THREE.BoxGeometry(.018,.085,.07),metal); plate.position.set(sx*.078,1.555,.058); plate.rotation.z=sx*.28; root.add(plate);
        const strip=new THREE.Mesh(new THREE.BoxGeometry(.005,.045,.008),glow); strip.position.set(sx*.088,1.56,.096); strip.rotation.z=sx*.28; root.add(strip);
      }
    }
    const mounted=this.bindWorldAuthoredRootToHead(root); if(mounted){ this.forgeVisuals ||= []; this.forgeVisuals.push(mounted); } return mounted;
  }

  applyCyberLimb(side,kind,limb="arm"){
    if(!kind || kind==='none') return; const S=side==='left'?'Left':'Right';
    if(limb==='arm'){
      if(kind==='cyber_hand'){ this.createCyberPiece(kind,`${S}Hand`); return; }
      if(kind==='cyber_forearm'){ this.createCyberPiece(kind,`${S}ForeArm`); this.createCyberPiece('cyber_hand',`${S}Hand`); return; }
      this.createCyberPiece('full_cyber_arm',`${S}Arm`); this.createCyberPiece('cyber_forearm',`${S}ForeArm`); this.createCyberPiece('cyber_hand',`${S}Hand`);
    }else{
      if(kind==='cyber_foot'){ this.createCyberPiece(kind,`${S}Foot`); return; }
      if(kind==='cyber_lower_leg'){ this.createCyberPiece(kind,`${S}Leg`); this.createCyberPiece('cyber_foot',`${S}Foot`); return; }
      this.createCyberPiece('full_cyber_leg',`${S}UpLeg`); this.createCyberPiece('cyber_lower_leg',`${S}Leg`); this.createCyberPiece('cyber_foot',`${S}Foot`);
    }
  }

  applyCybernetics(cy={}){
    this.applyCyberLimb('left',cy.leftArm,'arm'); this.applyCyberLimb('right',cy.rightArm,'arm');
    this.applyCyberLimb('left',cy.leftLeg,'leg'); this.applyCyberLimb('right',cy.rightLeg,'leg');
    this.createHeadCyberPiece(cy.eye,'eye',cy.eyeSide||'right');
    this.createHeadCyberPiece(cy.temple,'temple',cy.templeSide||'right');
    this.createHeadCyberPiece(cy.ear,'ear',cy.earSide||'right');
    this.createHeadCyberPiece(cy.jaw,'jaw',cy.jawSide||'right');
    if(cy.neck && cy.neck!=='none') this.createCyberPiece(cy.neck,'Neck');
    if(cy.torso && cy.torso!=='none') this.createCyberPiece(cy.torso,'Spine2');
  }

  createBrowsFallback(style="natural",color=new THREE.Color(0x34261c)){
    if(!this.headBone || !this.headBindInverse) return null;
    const g=new THREE.Group(); g.name="VeilwatchBrowsFallback";
    const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.92});
    const points=[];
    const thick=style==='thick'?4:style==='thin'?1:2;
    const tilt=style==='arched'?.16:style==='soft_arch'?.105:style==='straight'?0:.07;
    for(const side of [-1,1]){
      for(let row=0;row<thick;row++){
        for(let i=0;i<18;i++){
          const t=i/17; const x=side*(.026+t*.058);
          const y=1.681+Math.sin(t*Math.PI)*tilt*.028+(row-(thick-1)/2)*.0012;
          const z=.108;
          points.push(x,y,z, x+side*.004,y+.006,z+.002);
        }
      }
    }
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    g.add(new THREE.LineSegments(geo,mat));
    const mounted=this.bindWorldAuthoredRootToHead(g); if(mounted){ this.forgeVisuals ||= []; this.forgeVisuals.push(mounted); } return mounted;
  }

  createBrows(style="natural",color=new THREE.Color(0x34261c)){
    if(!this.headBone || !this.headBindInverse) return null;
    const safe=['natural','straight','arched','soft_arch','thick','thin'].includes(style)?style:'natural';
    const generation=this._forgeGeneration||0;
    const url=`${ORIGINAL_BROW_ROOT}/${safe}.glb`;
    this.loader.loadAsync(url).then((gltf)=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      gltf.scene.traverse((obj)=>{ if(!obj.isMesh||!obj.material) return; const mats=Array.isArray(obj.material)?obj.material:[obj.material]; mats.forEach(mat=>{if(mat?.color)mat.color.copy(color); if(mat){mat.roughness=.78;mat.metalness=0;}}); });
      const mounted=this.bindWorldAuthoredRootToHead(gltf.scene);
      if(mounted){ mounted.name=`VeilwatchBrows_${safe}`; this.forgeVisuals ||= []; this.forgeVisuals.push(mounted); }
    }).catch(()=>{ if(generation===(this._forgeGeneration||0)) this.createBrowsFallback(safe,color); });
    return null;
  }

  bodySurfaceMesh(){
    let found=null;
    this.currentObject?.traverse?.((obj)=>{
      if(found || !obj.isSkinnedMesh || !obj.geometry?.attributes?.position) return;
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      if(mats.some(mat=>String(mat?.name||"")==="VitBody")) found=obj;
    });
    return found;
  }

  garmentMaterial(color,style="cloth"){
    const c=new THREE.Color(color);
    const leather=/leather/.test(style), rain=/rain|softshell/.test(style), denim=/denim|jeans/.test(style);
    const mat=new THREE.MeshPhysicalMaterial({
      color:c, side:THREE.DoubleSide, metalness:0,
      roughness:leather?.44:rain?.38:denim?.82:.86,
      sheen:leather?.08:.30, sheenRoughness:.78, sheenColor:c.clone().lerp(new THREE.Color(0xffffff),.20),
      clearcoat:leather?.16:rain?.08:0, clearcoatRoughness:.5
    });
    mat.name=`VeilwatchGarment_${style}`;
    return mat;
  }

  createGarmentShell(name,predicate,offset,color,style="cloth"){
    const source=this.bodySurfaceMesh();
    if(!source) return null;
    const src=source.geometry, pos=src.attributes.position, normal=src.attributes.normal;
    if(!pos || !normal) return null;
    const sourceIndex=src.index?.array || null;
    const triCount=sourceIndex ? sourceIndex.length/3 : pos.count/3;
    const mats=Array.isArray(source.material)?source.material:[source.material];
    const bodyMaterialIndices=new Set(mats.map((m,i)=>String(m?.name||"")==="VitBody"?i:-1).filter(i=>i>=0));
    const groups=src.groups||[];
    const allowed=(indexOffset)=>{
      if(!groups.length || mats.length===1) return true;
      const g=groups.find(x=>indexOffset>=x.start && indexOffset<x.start+x.count);
      return !g || bodyMaterialIndices.has(g.materialIndex);
    };
    const keep=[];
    for(let t=0;t<triCount;t++){
      const o=t*3; if(!allowed(o)) continue;
      const ia=sourceIndex?sourceIndex[o]:o, ib=sourceIndex?sourceIndex[o+1]:o+1, ic=sourceIndex?sourceIndex[o+2]:o+2;
      const x=(pos.getX(ia)+pos.getX(ib)+pos.getX(ic))/3;
      const y=(pos.getY(ia)+pos.getY(ib)+pos.getY(ic))/3;
      const z=(pos.getZ(ia)+pos.getZ(ib)+pos.getZ(ic))/3;
      if(predicate(x,y,z)) keep.push(ia,ib,ic);
    }
    if(!keep.length) return null;
    const geo=new THREE.BufferGeometry();
    for(const [key,attr] of Object.entries(src.attributes||{})){
      if(key==='position'){
        const out=attr.clone();
        for(let i=0;i<out.count;i++){
          out.setXYZ(i,attr.getX(i)+normal.getX(i)*offset,attr.getY(i)+normal.getY(i)*offset,attr.getZ(i)+normal.getZ(i)*offset);
        }
        geo.setAttribute(key,out);
      }else geo.setAttribute(key,attr.clone());
    }
    geo.setIndex(keep);
    geo.morphTargetsRelative=src.morphTargetsRelative;
    if(src.morphAttributes?.position?.length){
      geo.morphAttributes.position=src.morphAttributes.position.map(a=>{const c=a.clone();c.name=a.name;return c;});
    }
    geo.computeBoundingSphere();
    const mesh=new THREE.SkinnedMesh(geo,this.garmentMaterial(color,style));
    mesh.name=`VeilwatchGarment_${name}`;
    mesh.position.copy(source.position); mesh.quaternion.copy(source.quaternion); mesh.scale.copy(source.scale);
    mesh.bindMode=source.bindMode;
    mesh.bind(source.skeleton,source.bindMatrix.clone());
    source.parent?.add(mesh);
    mesh.updateMorphTargets();
    if(source.morphTargetDictionary && source.morphTargetInfluences && mesh.morphTargetDictionary){
      for(const [morph,srcIndex] of Object.entries(source.morphTargetDictionary)){
        const dstIndex=mesh.morphTargetDictionary[morph];
        if(dstIndex!==undefined) mesh.morphTargetInfluences[dstIndex]=source.morphTargetInfluences[srcIndex]||0;
      }
    }
    this.forgeVisuals ||= []; this.forgeVisuals.push(mesh);
    return mesh;
  }

  createParametricClothing(cl={}){
    const source=this.bodySurfaceMesh(); if(!source) return false;
    const slotColor=(slot,fallback=cl.color)=>this.clothingColor(cl.colors?.[slot] || fallback || 'charcoal');
    const color=slotColor('top'), baseColor=slotColor('baseLayer'), outerColor=slotColor('outerwear'), bottomsColor=slotColor('bottoms'), onePieceColor=slotColor('onePiece'), shoesColor=slotColor('shoes'), gearColor=slotColor('gear','black'), dark=0x22262b;
    const torso=(minY=.95,maxX=.275)=>(x,y,z)=>y>=minY&&y<=1.49&&Math.abs(x)<=maxX;
    const tee=(minY=.95,sleeve=.41)=>(x,y,z)=>y>=minY&&y<=1.49&&(Math.abs(x)<=.275 || (Math.abs(x)<=sleeve&&y>=1.12));
    const longSleeve=(minY=.94)=>(x,y,z)=>y>=minY&&y<=1.49&&Math.abs(x)<=.525;
    const lower=(minY=.08,maxY=.91)=>(x,y,z)=>y>=minY&&y<=maxY&&Math.abs(x)<=.275;
    const hands=(x,y,z)=>Math.abs(x)>=.50&&Math.abs(x)<=.615&&y>=1.02&&y<=1.34;
    const feet=(x,y,z)=>y>=-.015&&y<=.15&&Math.abs(x)<=.24;
    const pelvis=(minY=.60,maxY=.90)=>(x,y,z)=>y>=minY&&y<=maxY&&Math.abs(x)<=.25;

    const base=String(cl.baseLayer||'none');
    if(base!=='none'){
      if(/briefs/.test(base)) this.createGarmentShell(base,pelvis(base==='boxer_briefs'?.56:.66,.86),.005,baseColor,base);
      else if(/bra/.test(base)) this.createGarmentShell(base,(x,y,z)=>y>=1.14&&y<=1.37&&Math.abs(x)<=.245,.006,baseColor,base);
      else if(/compression_shorts/.test(base)) this.createGarmentShell(base,pelvis(.52,.88),.005,baseColor,base);
      else this.createGarmentShell(base,tee(base==='tank'?1.00:.94,base==='tank'?.29:.50),.005,baseColor,base);
    }

    const top=String(cl.top||'none');
    if(top!=='none'){
      let pred=tee(), off=.010;
      if(/tank|camisole/.test(top)) pred=torso(.96,.27);
      else if(/long_sleeve|henley|button_down|flannel|hoodie|sweater|turtleneck|tactical|combat|scrub|work_shirt/.test(top)) pred=longSleeve(.94);
      if(/jersey|hoodie|sweater/.test(top)) off=.016;
      if(/fitted|compression/.test(top)) off=.006;
      this.createGarmentShell(top,pred,off,color,top);
    }

    const outer=String(cl.outerwear||'none');
    if(outer!=='none'){
      const long=/long_coat|lab_coat|winter_coat/.test(outer);
      const pred=long ? (x,y,z)=>y>=.72&&y<=1.49&&Math.abs(x)<=.53 : longSleeve(.86);
      this.createGarmentShell(outer,pred,/winter|long_coat/.test(outer)?.040:.027,outerColor,outer);
    }

    const bottoms=String(cl.bottoms||'none');
    if(bottoms!=='none'){
      if(/skirt/.test(bottoms)){
        const g=new THREE.Group(),mat=this.garmentMaterial(bottomsColor,bottoms);
        const geo=new THREE.CylinderGeometry(.20,.245,bottoms==='pencil_skirt'?.36:.42,36,1,true);
        const m=new THREE.Mesh(geo,mat); m.position.y=-.13; g.add(m); this.attachToBone(g,'Hips',[0,0,0]);
      }else{
        let min=.08,max=.91,off=.012;
        if(/shorts/.test(bottoms)){min=.53;off=.010;}
        if(/leggings/.test(bottoms)) off=.006;
        if(/relaxed|cargo|sweat|work/.test(bottoms)) off=.020;
        this.createGarmentShell(bottoms,lower(min,max),off,bottomsColor,bottoms);
      }
    }

    const onePiece=String(cl.onePiece||'none');
    if(onePiece!=='none'){
      if(/dress/.test(onePiece)){
        this.createGarmentShell(onePiece,torso(.86,.31),.018,onePieceColor,onePiece);
        const g=new THREE.Group(),mat=this.garmentMaterial(onePieceColor,onePiece);
        const long=/formal|shirt_dress/.test(onePiece), geo=new THREE.CylinderGeometry(.20,long?.31:.27,long?.58:.43,40,1,true);
        const m=new THREE.Mesh(geo,mat);m.position.y=-.22;g.add(m);this.attachToBone(g,'Hips');
      }else{
        this.createGarmentShell(onePiece,(x,y,z)=>y>=.10&&y<=1.49&&Math.abs(x)<=.53,.020,onePieceColor,onePiece);
      }
    }

    const socks=String(cl.socks||'none');
    if(socks!=='none'){
      const high=/compression|thigh_high/.test(socks), boot=/boot_socks/.test(socks);
      const maxY=high?.72:boot?.38:.25;
      this.createGarmentShell(socks,(x,y,z)=>y>=.04&&y<=maxY&&Math.abs(x)<=.22,.004,slotColor('baseLayer','charcoal'),socks);
    }

    const shoes=String(cl.shoes||'none');
    if(shoes!=='none'){
      const high=/boot|high_top|hiking|tactical/.test(shoes);
      this.createGarmentShell(shoes,(x,y,z)=>feet(x,y,z)||(high&&y>.10&&y<.29&&Math.abs(x)<.22),high?.018:.012,/dress/.test(shoes)?0x171717:shoesColor,shoes);
    }
    const gloves=String(cl.gloves||'none');
    if(gloves!=='none') this.createGarmentShell(gloves,hands,/armored/.test(gloves)?.018:.008,/medical/.test(gloves)?0xe8eef0:gearColor,gloves);

    const vest=String(cl.vest||'none');
    if(vest!=='none') this.createGarmentShell(vest,torso(1.00,.29),/plate|armor|rig/.test(vest)?.038:.022,gearColor,vest);
    return true;
  }

  clothingColor(name){
    const map={black:0x181a1d,charcoal:0x30343a,slate:0x59636d,white:0xe7e8e7,cream:0xd8d0bd,navy:0x1e2a42,blue:0x355b82,olive:0x596044,sage:0x7e8d73,tan:0xa98e68,khaki:0x9c9475,brown:0x654a36,burgundy:0x6c2835,red:0x8b3030,mustard:0xaa8532,teal:0x2e6b70}; return map[name]||map.charcoal;
  }

  createClothingExtras(cl={}){
    const color=this.clothingColor(cl.colors?.gear || cl.color), outerColor=this.clothingColor(cl.colors?.outerwear || cl.color), cloth=this.garmentMaterial(color,'accessory'), outerCloth=this.garmentMaterial(outerColor,'outerwear'), dark=this.forgeMat(0x22262b,.18,.72);
    const addBone=(bone,geo,pos=[0,0,0],rot=[0,0,0],mat=cloth)=>{const g=new THREE.Group(),m=new THREE.Mesh(geo,mat);g.add(m);return this.attachToBone(g,bone,pos,rot);};

    const hoodie=[cl.top,cl.outerwear].some(v=>/hoodie/.test(String(v||'')));
    if(hoodie) addBone('Neck',new THREE.TorusGeometry(.092,.021,12,32,Math.PI*1.55),[0,.015,-.025],[Math.PI/2,0,.78],outerCloth);

    if(cl.back && cl.back!=='none'){
      const g=new THREE.Group();
      const big=/tactical|medical|rifle/.test(cl.back), sling=/sling|messenger/.test(cl.back);
      const body=new THREE.Mesh(new THREE.BoxGeometry(big?.27:.22,big?.38:.30,big?.15:.11),dark); body.position.set(0,-.08,-.17); g.add(body);
      const pocket=new THREE.Mesh(new THREE.BoxGeometry(big?.20:.16,.10,.045),cloth); pocket.position.set(0,-.15,-.245); g.add(pocket);
      if(sling){ const strap=new THREE.Mesh(new THREE.TorusGeometry(.23,.008,8,36,Math.PI*1.25),dark); strap.rotation.set(0,.35,.4); strap.position.set(0,.02,-.05); g.add(strap); }
      this.attachToBone(g,'Spine2');
    }

    if(cl.headwear && cl.headwear!=='none'){
      const id=String(cl.headwear), g=new THREE.Group();
      const helmet=/helmet|hard_hat/.test(id);
      if(helmet){
        const shell=new THREE.Mesh(new THREE.SphereGeometry(.128,30,20,0,Math.PI*2,0,Math.PI*.62),dark); shell.position.y=.12; g.add(shell);
        if(/ballistic|tactical/.test(id)){ const rail=new THREE.Mesh(new THREE.BoxGeometry(.19,.018,.018),cloth); rail.position.set(0,.13,.085);g.add(rail); }
      }else if(/beanie|watch_cap/.test(id)){
        const cap=new THREE.Mesh(new THREE.SphereGeometry(.116,28,18,0,Math.PI*2,0,Math.PI*.55),cloth);cap.position.y=.115;g.add(cap);
        const band=new THREE.Mesh(new THREE.TorusGeometry(.105,.012,8,28),cloth);band.rotation.x=Math.PI/2;band.position.y=.095;g.add(band);
      }else{
        const crown=new THREE.Mesh(new THREE.CylinderGeometry(.108,.114,.065,28),cloth);crown.position.y=.115;g.add(crown);
        if(/cap/.test(id)){ const brim=new THREE.Mesh(new THREE.BoxGeometry(.115,.012,.095),cloth);brim.position.set(0,.09,.085);brim.rotation.x=-.08;g.add(brim); }
        if(/boonie/.test(id)){ const brim=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.010,32),cloth);brim.position.y=.085;g.add(brim); }
      }
      this.attachToBone(g,'Head');
    }

    if(cl.eyewear && cl.eyewear!=='none'){
      const id=String(cl.eyewear);
      const g=new THREE.Group(); const frame=this.forgeMat(/sunglasses/.test(id)?0x111318:0x4b535b,.58,.26);
      const lensMat=new THREE.MeshPhysicalMaterial({color:/sunglasses/.test(id)?0x111820:0xbfd8df,transparent:true,opacity:/sunglasses/.test(id)?.72:.24,roughness:.08,metalness:.05,transmission:/sunglasses/.test(id)?.05:.45,side:THREE.DoubleSide});
      [-1,1].forEach(side=>{
        const rim=new THREE.Mesh(new THREE.TorusGeometry(/aviator/.test(id)?.038:.034,.0035,8,24),frame);rim.position.x=side*.041;g.add(rim);
        const lens=new THREE.Mesh(new THREE.CircleGeometry(/aviator/.test(id)?.035:.031,24),lensMat);lens.position.set(side*.041,0,.001);g.add(lens);
      });
      const bridge=new THREE.Mesh(new THREE.BoxGeometry(.025,.004,.005),frame);g.add(bridge);
      g.position.set(0,1.65,.123); const mounted=this.bindWorldAuthoredRootToHead(g); if(mounted){this.forgeVisuals.push(mounted);}
    }

    if(cl.neck && cl.neck!=='none'){
      const id=String(cl.neck);
      if(/scarf|shemagh|gaiter/.test(id)) addBone('Neck',new THREE.TorusGeometry(.075,.022,12,30),[0,-.025,0],[Math.PI/2,0,0],cloth);
      else{
        const g=new THREE.Group(); const chain=this.forgeMat(/dog_tags|medical_id/.test(id)?0x7d858c:0xc2a763,.72,.28);
        const loop=new THREE.Mesh(new THREE.TorusGeometry(.072,.0025,6,40,Math.PI*1.55),chain);loop.rotation.x=Math.PI/2;loop.rotation.z=.8;g.add(loop);
        if(/dog_tags|medical_id|lanyard/.test(id)){ const tag=new THREE.Mesh(new THREE.BoxGeometry(.025,.040,.004),chain);tag.position.set(0,-.075,.035);g.add(tag); }
        this.attachToBone(g,'Neck',[0,-.035,.02]);
      }
    }

    if(cl.belt && cl.belt!=='none'){
      const id=String(cl.belt), g=new THREE.Group();
      const beltMat=this.forgeMat(/tactical|duty|utility/.test(id)?0x20252a:0x4d3323,.25,.62);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.165,.010,10,40),beltMat);ring.rotation.x=Math.PI/2;ring.position.y=.08;g.add(ring);
      const buckle=new THREE.Mesh(new THREE.BoxGeometry(.040,.030,.014),this.forgeMat(0x757c82,.76,.28));buckle.position.set(0,.08,.165);g.add(buckle);
      if(/duty|tactical|utility/.test(id)){ for(const x of [-.10,.10]){const pouch=new THREE.Mesh(new THREE.BoxGeometry(.055,.07,.035),dark);pouch.position.set(x,.075,.155);g.add(pouch);} }
      this.attachToBone(g,'Hips');
    }

    if(/high_vis/.test(String(cl.outerwear||'')) || /high_vis/.test(String(cl.vest||''))){
      const reflective=new THREE.MeshStandardMaterial({color:0xdce4e6,emissive:0x6c7478,emissiveIntensity:.22,roughness:.28,metalness:.1});
      addBone('Spine2',new THREE.BoxGeometry(.30,.018,.012),[0,-.06,.115],[0,0,0],reflective);
      addBone('Spine2',new THREE.BoxGeometry(.30,.018,.012),[0,-.16,.115],[0,0,0],reflective);
    }
  }

  bodyHairColor(f,hairColor){
    const map={black:0x171411,dark_brown:0x34261c,brown:0x5b3b26,blonde:0xb79658,auburn:0x6f3424,red:0x87371e,gray:0x707278};
    if(!f?.bodyHairColor || f.bodyHairColor==='inherit') return hairColor?.clone?.()||new THREE.Color(0x34261c);
    return new THREE.Color(map[f.bodyHairColor]||0x34261c);
  }

  createBodyHair(f={},hairColor){
    const density={none:0,light:.35,moderate:.65,heavy:1}[String(f.bodyHair||'none')]||0;
    if(!density) return;
    const color=this.bodyHairColor(f,hairColor), rand=this.seededRandom(0x51af31 + Math.round(density*100));
    const make=(boneName,count,radius,length,yMin,yMax)=>{
      const pts=[];
      for(let i=0;i<Math.round(count*density);i++){
        const a=rand()*Math.PI*2, r=radius*(.72+rand()*.28), y=yMin+rand()*(yMax-yMin);
        const x=Math.cos(a)*r,z=Math.sin(a)*r; const L=length*(.65+rand()*.7);
        pts.push(x,y,z,x+Math.cos(a)*L*.35,y-L,z+Math.sin(a)*L*.35);
      }
      if(!pts.length)return;
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
      const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.42+.28*density});
      const g=new THREE.Group();g.name=`BodyHair_${boneName}`;g.add(new THREE.LineSegments(geo,mat));this.attachToBone(g,boneName);
    };
    make('Spine2',150,.145,.010,-.18,.13); make('Spine1',95,.12,.009,-.16,.10);
    make('LeftArm',65,.045,.008,.03,.23); make('RightArm',65,.045,.008,.03,.23);
    make('LeftForeArm',55,.038,.007,.03,.20); make('RightForeArm',55,.038,.007,.03,.20);
    make('LeftUpLeg',90,.07,.009,.04,.34); make('RightUpLeg',90,.07,.009,.04,.34);
    make('LeftLeg',70,.055,.008,.03,.28); make('RightLeg',70,.055,.008,.03,.28);
    if(f.showAnatomy) make('Hips',80,.10,.010,-.02,.10);
  }

  createBodyDetails(f={}){
    const tattooMat=new THREE.MeshStandardMaterial({color:0x17212a,transparent:true,opacity:.72,roughness:.88,metalness:0,side:THREE.DoubleSide});
    const scarMat=new THREE.LineBasicMaterial({color:0x7b3f3c,transparent:true,opacity:.72});
    const band=(bone,r=.048,y=.10)=>{const g=new THREE.Group();const m=new THREE.Mesh(new THREE.TorusGeometry(r,.004,8,34),tattooMat);m.rotation.x=Math.PI/2;m.position.y=y;g.add(m);return this.attachToBone(g,bone);};
    const t=String(f.tattoo||'none');
    if(t==='left_sleeve'||t==='both_sleeves'){band('LeftArm');band('LeftForeArm',.041,.11);}
    if(t==='right_sleeve'||t==='both_sleeves'){band('RightArm');band('RightForeArm',.041,.11);}
    if(t==='left_calf')band('LeftLeg',.055,.12); if(t==='right_calf')band('RightLeg',.055,.12);
    if(t==='neck_band')band('Neck',.052,.00);
    if(t==='chest_piece'||t==='back_piece'){
      const g=new THREE.Group();const m=new THREE.Mesh(new THREE.PlaneGeometry(.22,.13),tattooMat);m.position.set(0,-.06,t==='back_piece'?-.125:.125);if(t==='back_piece')m.rotation.y=Math.PI;g.add(m);this.attachToBone(g,'Spine2');
    }
    const scar=(bone,pts)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));const g=new THREE.Group();g.add(new THREE.Line(geo,scarMat));this.attachToBone(g,bone);};
    const sc=String(f.bodyScar||'none');
    if(sc==='chest_scar')scar('Spine2',[-.07,-.05,.13,.08,.04,.13]);
    if(sc==='abdomen_scar')scar('Spine1',[-.06,-.06,.12,.06,.03,.12]);
    if(sc==='left_arm_scar')scar('LeftArm',[0,.05,.048,.01,.20,.048]);
    if(sc==='right_arm_scar')scar('RightArm',[0,.05,.048,-.01,.20,.048]);
    if(sc==='surgical_torso')scar('Spine1',[-.08,0,.12,.08,0,.12]);
  }

  createFaceDetails(f={}){
    if(!this.headBone||!this.headBindInverse)return;
    const metal=this.forgeMat(0xb5bec6,.88,.18), scarMat=new THREE.LineBasicMaterial({color:0x743b3b,transparent:true,opacity:.78});
    const root=new THREE.Group();root.name='VeilwatchFaceDetails';
    const addStud=(x,y,z,r=.004)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),metal);m.position.set(x,y,z);root.add(m);};
    const addRing=(x,y,z,r=.008,rot=[Math.PI/2,0,0])=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,.0018,7,20),metal);m.position.set(x,y,z);m.rotation.set(...rot);root.add(m);};
    const p=String(f.piercing||'none');
    if(p==='left_ear_stud'||p==='both_ear_studs')addStud(-.091,1.606,.015);
    if(p==='right_ear_stud'||p==='both_ear_studs')addStud(.091,1.606,.015);
    if(p==='left_ear_ring')addRing(-.092,1.595,.012,.010,[0,Math.PI/2,0]);
    if(p==='right_ear_ring')addRing(.092,1.595,.012,.010,[0,Math.PI/2,0]);
    if(p==='septum_ring')addRing(0,1.603,.100,.007,[Math.PI/2,0,0]);
    if(p==='nose_stud')addStud(.018,1.615,.103,.0028);
    if(p==='eyebrow_bar'){addStud(.045,1.663,.080,.0027);addStud(.055,1.658,.081,.0027);}
    const scar=(pts)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));root.add(new THREE.Line(geo,scarMat));};
    const sc=String(f.faceScar||'none');
    if(sc==='left_brow_scar')scar([-.055,1.675,.085,-.035,1.650,.091]);
    if(sc==='right_brow_scar')scar([.055,1.675,.085,.035,1.650,.091]);
    if(sc==='left_cheek_scar')scar([-.065,1.615,.093,-.035,1.565,.100]);
    if(sc==='right_cheek_scar')scar([.065,1.615,.093,.035,1.565,.100]);
    if(sc==='nose_bridge_scar')scar([-.010,1.650,.102,.012,1.612,.108]);
    if(sc==='lip_scar')scar([.025,1.586,.103,.016,1.555,.102]);
    if(root.children.length){const mounted=this.bindWorldAuthoredRootToHead(root);if(mounted)this.forgeVisuals.push(mounted);}else disposeObject(root);
  }

  createAnatomyPreview(f={},skinColor=new THREE.Color(0xcc9874)){
    if(!f.showAnatomy) return null;
    const anatomy=String(f.anatomy||"vulva");
    const url=ANATOMY_ASSETS[anatomy];
    if(!url) return null;
    const generation=this._forgeGeneration||0;
    this.loader.loadAsync(url).then(gltf=>{
      if(generation!==(this._forgeGeneration||0) || !this.currentObject){ disposeObject(gltf.scene); return; }
      const root=gltf.scene || gltf.scenes?.[0];
      if(!root) return;
      root.name=`VeilwatchAnatomy_${anatomy}`;
      const detailColor=skinColor.clone().multiplyScalar(.72);
      root.traverse(obj=>{
        if(!obj.isMesh) return;
        obj.castShadow=false; obj.receiveShadow=false;
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        mats.forEach(mat=>{
          if(!mat?.color) return;
          if(/detail/i.test(String(mat.name||""))) mat.color.copy(detailColor);
          else mat.color.copy(skinColor);
          mat.metalness=0; mat.roughness=.72; mat.needsUpdate=true;
        });
        const n=String(obj.name||"").toLowerCase();
        if(anatomy==='penis_testes'){
          const length=.78+(Number(f.penisLength??50)/100)*.50;
          const girth=.78+(Number(f.penisGirth??50)/100)*.46;
          const testes=.82+(Number(f.testesSize??50)/100)*.40;
          if(/shaft|glans/.test(n)) obj.scale.set(girth,girth,length);
          if(/testis|scrotum/.test(n)) obj.scale.setScalar(testes);
        }else{
          const prominence=.76+(Number(f.vulvaProminence??50)/100)*.48;
          obj.scale.z*=prominence;
        }
      });
      this.attachToBone(root,'Hips');
    }).catch(err=>{
      console.warn(`Veilwatch anatomy asset unavailable (${anatomy}):`,err?.message||err);
    });
    return null;
  }

  applyAnimation(name="Idle", force=false){
    if(!this.mixer || !this.availableAnimations?.length) return;
    const requested=String(name||"Idle");
    if(!force && this._requestedAnimationName===requested && this.activeAnimationName) return;
    const clip=this.availableAnimations.find(a=>a.name===requested)
      || this.availableAnimations.find(a=>/^idle$/i.test(a.name))
      || this.availableAnimations.find(a=>/idle/i.test(a.name))
      || this.availableAnimations[0];
    if(!clip) return;
    this.mixer.stopAllAction();
    const action=this.mixer.clipAction(clip).reset().fadeIn(.18);
    if(/death|punch|roll|interact|jump/i.test(clip.name)){
      action.setLoop(THREE.LoopOnce,1);
      action.clampWhenFinished=true;
    }else{
      action.setLoop(THREE.LoopRepeat,Infinity);
      action.clampWhenFinished=false;
    }
    action.play();
    this.activeAnimationName=clip.name;
    this._requestedAnimationName=requested;
  }

  applyFullForge(appearance,hairColor){
    const f=appearance?.forge||{}; if(!this.currentObject || this.currentObject.userData?.isVeilwatchFallback) return;
    const scaleMap={compact:.88,average:1,tall:1.10,huge:1.22}; const base=scaleMap[this.profile.scale]||1;
    const h=.90+(Number(f.height??50)/100)*.20;
    this.currentObject.scale.set(base,base*h,base);
    this.applyRuntimeBodyMorphs(f);
    this.applyRuntimeFaceMorphs(f);
    this._forgeGeneration=(this._forgeGeneration||0)+1;
    this.clearForgeVisuals(); this.forgeRoot=new THREE.Group(); this.forgeRoot.name="VeilwatchForgeRoot"; this.currentObject.add(this.forgeRoot);
    this.createCuff(f.cuffArm||'left');
    this.createBrows(f.browStyle||'natural',hairColor);
    this.createFaceDetails(f);
    this.createBodyHair(f,hairColor);
    this.createBodyDetails(f);
    const cy=f.cybernetics||{}; this.applyCybernetics(cy);
    this.createWeapon(f.weaponPreview||'none',f.weaponCarry||'back');
    const cl=f.clothing||{};
    const parametricClothes=this.createParametricClothing(cl);
    this.createClothingExtras(cl);
    this.createAnatomyPreview(f, this.colorFromHint(this.profile.appearanceRender?.skinHex, 0xcc9874));
    this.currentObject.traverse(obj=>{
      if(!obj.isMesh||!obj.material)return;
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.forEach(mat=>{
        if(mat.name==='VitShirt'){mat.visible=!parametricClothes && cl.top!=='none'; mat.color?.setHex?.(this.clothingColor(cl.color));}
        if(mat.name==='VitPants'){mat.visible=!parametricClothes && cl.bottoms!=='none'; mat.color?.setHex?.(this.clothingColor(cl.color));}
        if(mat.name==='VitShoes'){mat.visible=!parametricClothes && cl.shoes!=='none';}
      });
    });
    this.applyAnimation(f.animation||'Idle');
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
          mat.alphaMap = this.createScleraMaskTexture();
          mat.transparent = true;
          mat.alphaTest = .08;
          mat.opacity = 1;
        }else if(name.startsWith("VitIris")){
          mat.color.setHex(0xffffff);
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

    this.applyIrisColor(eyeColor);
    const expressionScale=THREE.MathUtils.clamp(Number(appearance?.forge?.expressionIntensity??100)/100,0,1);
    const scaledFaceWeights=Object.fromEntries(Object.entries(hints.faceWeights || {}).map(([k,v])=>[k,Number(v||0)*expressionScale]));
    this.applyFacePreset(scaledFaceWeights);
    this.applyHairStyle(hints.hairStyle || {id:appearance.hairStyle || "classic_bob",kind:"asset",variant:"classic"}, hairColor);
    this.applyFacialHair(hints.facialHairStyle || {id:appearance.beardStyle || "none"}, hairColor);
    this.applyFullForge(appearance, hairColor);
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
      this.headAssetRoot = headRoot;
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
    this.ensureRuntimeBodyMorphs();
    this.ensureRuntimeFaceMorphs();

    // Animation is safe again: body is skinned normally, while the separate head
    // and hair follow the animated Head bone from their corrected bind-pose offset.
    this.mixer = null;
    this.availableAnimations = bodyGltf.animations || [];
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
    // Load/retarget the larger CC0 animation library in the background so the
    // body becomes interactive immediately with its native clips.
    void this.ensureForgeAnimationLibrary(token);
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
    }else if(view === "equipment" || view === "cybernetics"){
      targetRatio = .52; distanceScale = .84; cameraLift = .03;
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
    this.irisTexture?.dispose?.();
    this.scleraMaskTexture?.dispose?.();
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
  version: "1.0.0"
};
window.dispatchEvent(new CustomEvent("veilwatch:projection3d-ready"));
