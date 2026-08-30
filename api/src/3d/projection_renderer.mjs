import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const CYAN = 0x00e5ff;
const AMBER = 0xffb13b;

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

  // Feet-to-head height is roughly 1.85 scene units.
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
    this.clock = new THREE.Clock();
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
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
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

  async load(url){
    const cleanUrl = String(url || "").trim();
    this.lastUrl = cleanUrl;
    const token = ++this._loadToken;
    if(!cleanUrl){
      this.showPrototype();
      return;
    }

    this.setStatus("LOADING 3D MODEL", "loading");
    try{
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
      this.world.add(this.currentObject);

      if(gltf.animations?.length){
        this.mixer = new THREE.AnimationMixer(this.currentObject);
        const clip = gltf.animations.find(a=>/idle/i.test(a.name)) || gltf.animations[0];
        this.mixer.clipAction(clip).reset().fadeIn(.15).play();
      }

      this.frameObject(this.currentObject);
      this.applyProfile(this.profile);
      this.setStatus(vrm ? "VRM MODEL ONLINE" : "GLB MODEL ONLINE", "linked");
    }catch(err){
      console.error("Veilwatch Projection model load failed:", err);
      if(token !== this._loadToken) return;
      this.showPrototype();
      this.setStatus("MODEL FAILED · PROTOTYPE ACTIVE", "error");
    }
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
  }

  resetCamera(){
    if(this.currentObject) this.frameObject(this.currentObject);
  }

  animate(){
    this._raf = requestAnimationFrame(()=>this.animate());
    const dt = Math.min(this.clock.getDelta(), .05);
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
  version: "0.1.0"
};
window.dispatchEvent(new CustomEvent("veilwatch:projection3d-ready"));
