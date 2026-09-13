import * as THREE from "three";

const RUNTIME_ROOT = "/assets/characters/makehuman/runtime";
const BASE_SCALE = 0.1;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

async function fetchText(url){
  const res = await fetch(url, { cache:"force-cache" });
  if(!res.ok) throw new Error(`MakeHuman fetch failed ${res.status}: ${url}`);
  return res.text();
}

async function fetchJson(url){
  const res = await fetch(url, { cache:"force-cache" });
  if(!res.ok) throw new Error(`MakeHuman fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function fetchGzipText(url){
  const res = await fetch(url, { cache:"force-cache" });
  if(!res.ok) throw new Error(`MakeHuman fetch failed ${res.status}: ${url}`);
  if(typeof DecompressionStream !== "function"){
    throw new Error("This browser does not support DecompressionStream for MakeHuman runtime data.");
  }
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

function parseObj(text){
  const positions = [];
  const uvs = [];
  const groups = new Map();
  let group = "default";

  const groupFaces = (name)=>{
    if(!groups.has(name)) groups.set(name, []);
    return groups.get(name);
  };

  for(const raw of text.split(/\r?\n/)){
    const line = raw.trim();
    if(!line || line.startsWith("#")) continue;
    if(line.startsWith("v ")){
      const p = line.split(/\s+/);
      positions.push(Number(p[1]), Number(p[2]), Number(p[3]));
      continue;
    }
    if(line.startsWith("vt ")){
      const p = line.split(/\s+/);
      uvs.push(Number(p[1]), Number(p[2]));
      continue;
    }
    if(line.startsWith("g ")){
      group = line.slice(2).trim() || "default";
      continue;
    }
    if(line.startsWith("f ")){
      const parts = line.slice(2).trim().split(/\s+/).map((token)=>{
        const [v, vt] = token.split("/");
        return { v: Number(v) - 1, vt: vt ? Number(vt) - 1 : -1 };
      });
      if(parts.length < 3) continue;
      const dest = groupFaces(group);
      for(let i=1; i<parts.length-1; i++) dest.push(parts[0], parts[i], parts[i+1]);
    }
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    groups
  };
}

function parseTarget(text){
  const indices = [];
  const deltas = [];
  for(const raw of text.split(/\r?\n/)){
    const line = raw.trim();
    if(!line || line.startsWith("#")) continue;
    const p = line.split(/\s+/);
    if(p.length < 4) continue;
    indices.push(Number(p[0]));
    deltas.push(Number(p[1]), Number(p[2]), Number(p[3]));
  }
  return { indices:new Uint32Array(indices), deltas:new Float32Array(deltas) };
}

function expandRanges(ranges=[]){
  const out = [];
  for(const item of ranges){
    if(Array.isArray(item)){
      const a = Number(item[0]);
      const b = Number(item[1] ?? item[0]);
      for(let i=a; i<=b; i++) out.push(i);
    }else if(Number.isFinite(Number(item))){
      out.push(Number(item));
    }
  }
  return out;
}

function axisWeights(value){
  const x = THREE.MathUtils.clamp(Number(value ?? 50), 0, 100) / 100;
  if(x <= .5) return [1 - x * 2, x * 2, 0];
  return [0, 2 - x * 2, x * 2 - 1];
}

function ageWeights(age){
  const map = {
    "18_25":0,
    "25_35":.12,
    "35_45":.32,
    "45_60":.62,
    "60_plus":1
  };
  const t = THREE.MathUtils.clamp(map[String(age || "25_35")] ?? .12, 0, 1);
  return [1-t, t];
}

function centeredPair(value){
  const x = THREE.MathUtils.clamp(Number(value ?? 50), 0, 100);
  if(Math.abs(x - 50) < .001) return null;
  return { side:x < 50 ? 0 : 1, weight:Math.abs(x - 50) / 50 };
}

function rgbMaterial(name, color, options={}){
  const mat = new THREE.MeshStandardMaterial({
    name,
    color,
    roughness:options.roughness ?? .72,
    metalness:0,
    side:THREE.DoubleSide,
    transparent:!!options.transparent,
    opacity:options.opacity ?? 1,
    alphaTest:options.alphaTest ?? 0
  });
  mat.userData.veilwatchMakeHuman = true;
  return mat;
}

export class MakeHumanRuntime {
  constructor(options={}){
    this.options = options;
    this.root = new THREE.Group();
    this.root.name = "VeilwatchMakeHumanHM08";
    this.root.userData.makeHumanRuntime = true;
    this.root.userData.foundation = "MakeHuman HM08 / MPFB 2.0.17";

    this.basePositions = null;
    this.deformedRaw = null;
    this.transformed = null;
    this.uvs = null;
    this.groups = null;
    this.vertexGroups = null;
    this.rig = null;
    this.weightData = null;
    this.targetManifest = null;
    this.targetCache = new Map();

    // MakeHuman facial expression / lip-sync targets. The compressed source
    // pack is loaded once and only a tiny LRU of parsed sparse targets is kept.
    this.facialCatalog = null;
    this._facialCatalogPromise = null;
    this._facialPack = null;
    this._facialPackPromise = null;
    this._facialTargetCache = new Map();

    this.renderMeshes = [];
    this.boneMap = new Map();
    this.skeleton = null;
    this._boneRoots = [];
    this.boneNames = [];
    this.boneIndexByName = new Map();
    this.vertexInfluences = null;
    this._transformMeta = { minY:0, heightScale:1, massScale:1 };
    this._applySerial = 0;

    // Native MakeHuman asset runtime. Only currently selected assets are kept
    // as Three.js objects. Pack JSON is held in a tiny LRU so long sessions do
    // not accumulate hundreds of meshes/textures in memory.
    this.nativeAssets = new Map();
    this.nativeCatalog = null;
    this._nativeCatalogPromise = null;
    this._nativePackCache = new Map();
    this._nativeLoadSerial = 0;
    this.hiddenBodyVertices = new Set();

    // Surface textures are separate from mesh assets so changing skin/eyes never
    // rebuilds geometry. Only the active textures are retained on GPU.
    this.surfaceCatalog = null;
    this._surfaceCatalogPromise = null;
    this._surfacePackCache = new Map();
    this._surfaceLoadSerial = { skin:0, eye:0 };
    this.activeSurfaces = { skin:null, eye:null };
    this._skinTint = new THREE.Color(0xcc9874);
    this._eyeTint = new THREE.Color(0x5c3924);

    this.materials = {
      skin:rgbMaterial("MHBody", 0xcc9874, {roughness:.76}),
      eye:rgbMaterial("MHEyes", 0xe8e2d8, {roughness:.2}),
      teeth:rgbMaterial("MHTeeth", 0xf1eee7, {roughness:.35}),
      tongue:rgbMaterial("MHTongue", 0xa95f66, {roughness:.62}),
      lashes:rgbMaterial("MHLashes", 0x2a1c18, {roughness:.82, transparent:true, opacity:.92})
    };
  }

  async init(initialForge={}){
    const [objText, vertexGroups, rig, weightsText, targetManifest] = await Promise.all([
      fetchText(`${RUNTIME_ROOT}/base.obj`),
      fetchJson(`${RUNTIME_ROOT}/basemesh_vertex_groups.json`),
      fetchJson(`${RUNTIME_ROOT}/rig.mixamo.json`),
      fetchGzipText(`${RUNTIME_ROOT}/weights.mixamo.json.gz`),
      fetchJson(`${RUNTIME_ROOT}/target_manifest.json`)
    ]);

    const parsed = parseObj(objText);
    this.basePositions = parsed.positions;
    this.deformedRaw = new Float32Array(parsed.positions.length);
    this.transformed = new Float32Array(parsed.positions.length);
    this.uvs = parsed.uvs;
    this.groups = parsed.groups;
    this.vertexGroups = vertexGroups;
    this.rig = rig;
    this.weightData = JSON.parse(weightsText);
    this.targetManifest = targetManifest;

    this._buildRenderMeshes();
    this._prepareVertexWeights();
    await this.applyForge(initialForge, { initial:true });
    return this.root;
  }

  _groupEntries(matcher){
    const out = [];
    for(const [name, entries] of this.groups.entries()){
      if(matcher(name)) out.push(...entries);
    }
    return out;
  }

  _buildRenderMesh(name, matcher, material){
    const entries = this._groupEntries(matcher);
    if(!entries.length) return null;
    const positions = new Float32Array(entries.length * 3);
    const normals = new Float32Array(entries.length * 3);
    const uvs = new Float32Array(entries.length * 2);
    const sourceIndices = new Uint32Array(entries.length);

    for(let i=0; i<entries.length; i++){
      const ref = entries[i];
      sourceIndices[i] = ref.v;
      if(ref.vt >= 0){
        uvs[i*2] = this.uvs[ref.vt*2] ?? 0;
        uvs[i*2+1] = 1 - (this.uvs[ref.vt*2+1] ?? 0);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.sourceIndices = sourceIndices;
    mesh.userData.sourceGroupEntries = entries;
    this.renderMeshes.push(mesh);
    this.root.add(mesh);
    return mesh;
  }

  _buildRenderMeshes(){
    this._buildRenderMesh("MakeHumanBody", n=>n === "body", this.materials.skin);
    this._buildRenderMesh("MakeHumanEyes", n=>n === "helper-l-eye" || n === "helper-r-eye", this.materials.eye);
    this._buildRenderMesh("MakeHumanTeeth", n=>n === "helper-upper-teeth" || n === "helper-lower-teeth", this.materials.teeth);
    this._buildRenderMesh("MakeHumanTongue", n=>n === "helper-tongue", this.materials.tongue);
    this._buildRenderMesh("MakeHumanEyelashes", n=>/^helper-[lr]-eyelashes/.test(n), this.materials.lashes);
  }

  _prepareVertexWeights(){
    const boneNames = Object.keys(this.rig?.bones || {});
    const boneIndex = new Map(boneNames.map((name, index)=>[name,index]));
    this.boneNames = boneNames.slice();
    this.boneIndexByName = boneIndex;
    const vertexCount = this.basePositions.length / 3;
    const influences = Array.from({length:vertexCount}, ()=>[]);

    for(const [name, values] of Object.entries(this.weightData?.weights || {})){
      const bi = boneIndex.get(name);
      if(bi === undefined) continue;
      for(const item of values || []){
        const vi = Number(item[0]);
        const w = Number(item[1]);
        if(vi >= 0 && vi < vertexCount && w > 0) influences[vi].push([bi,w]);
      }
    }

    this.vertexInfluences = influences;
    const hipsIndex = boneIndex.get("mixamorig:Hips") ?? 0;
    for(const mesh of this.renderMeshes){
      const src = mesh.userData.sourceIndices;
      const skinIndex = new Uint16Array(src.length * 4);
      const skinWeight = new Float32Array(src.length * 4);
      for(let i=0; i<src.length; i++){
        const list = (influences[src[i]] || []).sort((a,b)=>b[1]-a[1]).slice(0,4);
        if(!list.length) list.push([hipsIndex,1]);
        let total = list.reduce((s,x)=>s+x[1],0) || 1;
        for(let j=0; j<4; j++){
          const item = list[j];
          skinIndex[i*4+j] = item ? item[0] : 0;
          skinWeight[i*4+j] = item ? item[1]/total : 0;
        }
      }
      mesh.geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex,4));
      mesh.geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight,4));
    }
  }

  async _loadTarget(rel){
    if(this.targetCache.has(rel)) return this.targetCache.get(rel);
    const promise = fetchGzipText(`${RUNTIME_ROOT}/targets/${rel}`).then(parseTarget);
    this.targetCache.set(rel, promise);
    return promise;
  }

  _addPair(contributions, pairKey, value, multiplier=1){
    const pair = centeredPair(value);
    const files = this.targetManifest?.pairs?.[pairKey];
    if(!pair || !files) return;
    contributions.push([files[pair.side], pair.weight * multiplier]);
  }

  _macroContributions(f){
    const out = [];
    const gender = String(f.frame || "masculine") === "feminine" ? "female" : "male";
    const ages = ["young","old"];
    const muscles = ["minmuscle","averagemuscle","maxmuscle"];
    const weights = ["minweight","averageweight","maxweight"];
    const aw = ageWeights(f.age);
    const mw = axisWeights(f.muscle);
    const ww = axisWeights(f.bodyFat);
    const pattern = this.targetManifest.macro.pattern;

    for(let ai=0; ai<2; ai++) for(let mi=0; mi<3; mi++) for(let wi=0; wi<3; wi++){
      const weight = aw[ai] * mw[mi] * ww[wi];
      if(weight < .0001) continue;
      const rel = pattern
        .replace("{gender}", gender)
        .replace("{age}", ages[ai])
        .replace("{muscle}", muscles[mi])
        .replace("{weight}", weights[wi]);
      out.push([rel, weight]);
    }
    return out;
  }

  _forgeContributions(f){
    const out = this._macroContributions(f);
    for(const key of ["shoulders","chestVolume","waist","hips","glutes","armSize","legSize","neckSize","torsoLength","faceWidth","jawWidth","jawAngle","chinWidth","chinProjection","noseWidth","noseLength","noseProjection","browHeight","mouthWidth","breastProjection"]){
      this._addPair(out,key,f[key]);
    }
    for(const key of ["armLengthUpper","armLengthLower"]) this._addPair(out,key,f.armLength);
    for(const key of ["legLengthUpper","legLengthLower"]) this._addPair(out,key,f.legLength);
    for(const key of ["handSizeLeft","handSizeRight"]) this._addPair(out,key,f.handSize);
    for(const key of ["footSizeLeft","footSizeRight"]) this._addPair(out,key,f.footSize);
    for(const key of ["cheekHeightLeft","cheekHeightRight"]) this._addPair(out,key,f.cheekboneHeight);
    for(const key of ["cheekWidthLeft","cheekWidthRight"]) this._addPair(out,key,f.cheekboneWidth);
    for(const key of ["eyeSpacingLeft","eyeSpacingRight"]) this._addPair(out,key,f.eyeSpacing);
    for(const key of ["eyeSizeLeft","eyeSizeRight"]) this._addPair(out,key,f.eyeSize);
    for(const key of ["lipFullnessUpper","lipFullnessLower"]) this._addPair(out,key,f.lipFullness);
    for(const key of ["earSizeLeft","earSizeRight"]) this._addPair(out,key,f.earSize);

    if(String(f.frame || "masculine") === "feminine" && String(f.chest || "pectoral") === "breasts"){
      const pair = centeredPair(f.breastSize);
      if(pair){
        const aw = ageWeights(f.age);
        for(let ai=0; ai<2; ai++){
          if(aw[ai] < .0001) continue;
          const age = ai === 0 ? "young" : "old";
          const files = this.targetManifest?.breastCup?.[age];
          if(files) out.push([files[pair.side], pair.weight * aw[ai]]);
        }
      }
    }

    if(String(f.anatomy || "") === "penis_testes"){
      this._addPair(out,"penisLength",f.penisLength);
      this._addPair(out,"penisGirth",f.penisGirth);
      this._addPair(out,"testesSize",f.testesSize);
    }else{
      this._addPair(out,"vulvaProminence",f.vulvaProminence);
    }
    return out;
  }

  _applySparseTarget(target, weight){
    const p = this.deformedRaw;
    for(let i=0; i<target.indices.length; i++){
      const vi = target.indices[i] * 3;
      const di = i * 3;
      p[vi] += target.deltas[di] * weight;
      p[vi+1] += target.deltas[di+1] * weight;
      p[vi+2] += target.deltas[di+2] * weight;
    }
  }

  _transformPositions(f){
    const p = this.deformedRaw;
    const out = this.transformed;
    const end = Number(this.targetManifest?.bodyVertexRange?.[1] ?? 13379);
    let minY = Infinity;
    for(let vi=0; vi<=end; vi++) minY = Math.min(minY, p[vi*3+1]);
    if(!Number.isFinite(minY)) minY = 0;

    const heightScale = .90 + THREE.MathUtils.clamp(Number(f.height ?? 50),0,100) / 100 * .20;
    const massScale = .94 + THREE.MathUtils.clamp(Number(f.mass ?? 50),0,100) / 100 * .12;
    this._transformMeta = { minY, heightScale, massScale };
    for(let i=0; i<p.length; i+=3){
      out[i] = p[i] * BASE_SCALE * massScale;
      out[i+1] = (p[i+1] - minY) * BASE_SCALE * heightScale;
      out[i+2] = p[i+2] * BASE_SCALE * massScale;
    }
  }

  _calculateSourceNormals(){
    const count = this.transformed.length / 3;
    const normals = new Float32Array(count * 3);
    const addTri = (a,b,c)=>{
      const p=this.transformed;
      const ai=a*3, bi=b*3, ci=c*3;
      const abx=p[bi]-p[ai], aby=p[bi+1]-p[ai+1], abz=p[bi+2]-p[ai+2];
      const acx=p[ci]-p[ai], acy=p[ci+1]-p[ai+1], acz=p[ci+2]-p[ai+2];
      const nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
      for(const idx of [ai,bi,ci]){ normals[idx]+=nx; normals[idx+1]+=ny; normals[idx+2]+=nz; }
    };
    for(const mesh of this.renderMeshes){
      const entries = mesh.userData.sourceGroupEntries;
      for(let i=0; i<entries.length; i+=3) addTri(entries[i].v,entries[i+1].v,entries[i+2].v);
    }
    for(let i=0; i<normals.length; i+=3){
      const len=Math.hypot(normals[i],normals[i+1],normals[i+2]) || 1;
      normals[i]/=len; normals[i+1]/=len; normals[i+2]/=len;
    }
    return normals;
  }

  _updateGeometries(){
    const sourceNormals = this._calculateSourceNormals();
    for(const mesh of this.renderMeshes){
      const src = mesh.userData.sourceIndices;
      const pos = mesh.geometry.getAttribute("position");
      const nor = mesh.geometry.getAttribute("normal");
      for(let i=0; i<src.length; i++){
        const s=src[i]*3, d=i*3;
        pos.array[d]=this.transformed[s]; pos.array[d+1]=this.transformed[s+1]; pos.array[d+2]=this.transformed[s+2];
        nor.array[d]=sourceNormals[s]; nor.array[d+1]=sourceNormals[s+1]; nor.array[d+2]=sourceNormals[s+2];
      }
      if(mesh.name === "MakeHumanBody" && this.hiddenBodyVertices?.size){
        // Collapse covered triangles in place instead of throwing them to a huge
        // negative coordinate. That keeps bounding boxes sane for camera framing.
        for(let i=0;i<src.length;i+=3){
          if(this.hiddenBodyVertices.has(src[i]) || this.hiddenBodyVertices.has(src[i+1]) || this.hiddenBodyVertices.has(src[i+2])){
            const anchor=i*3, ax=pos.array[anchor], ay=pos.array[anchor+1], az=pos.array[anchor+2];
            for(let j=0;j<3;j++){
              const d=(i+j)*3; pos.array[d]=ax; pos.array[d+1]=ay; pos.array[d+2]=az;
              nor.array[d]=0; nor.array[d+1]=1; nor.array[d+2]=0;
            }
          }
        }
      }
      pos.needsUpdate=true; nor.needsUpdate=true;
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
    }
  }

  _meanGroup(name){
    const ranges = this.vertexGroups?.[name] || [];
    let x=0,y=0,z=0,count=0;
    for(const item of ranges){
      const a=Array.isArray(item)?Number(item[0]):Number(item);
      const b=Array.isArray(item)?Number(item[1]??item[0]):Number(item);
      for(let vi=a; vi<=b; vi++){
        const i=vi*3;
        x+=this.transformed[i]; y+=this.transformed[i+1]; z+=this.transformed[i+2]; count++;
      }
    }
    return count ? new THREE.Vector3(x/count,y/count,z/count) : null;
  }

  _strategyPoint(spec){
    if(spec?.strategy === "CUBE"){
      const p=this._meanGroup(spec.cube_name);
      if(p) return p;
    }
    if(spec?.strategy === "MEAN" && Array.isArray(spec.vertex_indices)){
      let x=0,y=0,z=0,count=0;
      for(const vi of spec.vertex_indices){
        const i=Number(vi)*3;
        if(i < 0 || i+2 >= this.transformed.length) continue;
        x+=this.transformed[i];y+=this.transformed[i+1];z+=this.transformed[i+2];count++;
      }
      if(count) return new THREE.Vector3(x/count,y/count,z/count);
    }
    const d=spec?.default_position;
    if(Array.isArray(d) && d.length>=3){
      // MPFB defaults are Blender coordinates (X, depth-Y, vertical-Z).
      return new THREE.Vector3(Number(d[0]), Number(d[2]), -Number(d[1]));
    }
    return new THREE.Vector3();
  }

  _safeBoneName(name){
    return String(name || "bone").replace(/[^A-Za-z0-9_-]/g, "_");
  }

  _rebuildSkeleton(){
    const definitions=this.rig?.bones || {};
    const names=Object.keys(definitions);
    const worldMatrices=new Map();

    for(const name of names){
      const def=definitions[name];
      const head=this._strategyPoint(def.head);
      const tail=this._strategyPoint(def.tail);
      const dir=tail.clone().sub(head);
      if(dir.lengthSq()<1e-9) dir.set(0,1,0); else dir.normalize();
      const qAlign=new THREE.Quaternion().setFromUnitVectors(Y_AXIS,dir);
      const qRoll=new THREE.Quaternion().setFromAxisAngle(Y_AXIS,Number(def.roll||0));
      const q=qAlign.multiply(qRoll);
      worldMatrices.set(name,new THREE.Matrix4().compose(head,q,new THREE.Vector3(1,1,1)));
    }

    // Build the bone hierarchy once. Reusing the same Bone and Skeleton objects
    // is important for long-running Projection Bay sessions: it prevents every
    // slider movement from orphaning AnimationMixer bindings and old skeletons.
    if(!this.skeleton){
      this.boneMap.clear();
      this._boneRoots=[];
      for(const name of names){
        const bone=new THREE.Bone();
        bone.name=this._safeBoneName(name);
        bone.userData.makeHumanBoneName=name;
        this.boneMap.set(name,bone);
      }
      for(const name of names){
        const def=definitions[name];
        const bone=this.boneMap.get(name);
        const parent=this.boneMap.get(String(def.parent||""));
        if(parent) parent.add(bone);
        else { this.root.add(bone); this._boneRoots.push(bone); }
      }
      this.skeleton=new THREE.Skeleton(names.map(n=>this.boneMap.get(n)));
    }

    // Update the existing hierarchy to the freshly morphed MakeHuman rest pose.
    for(const name of names){
      const def=definitions[name];
      const bone=this.boneMap.get(name);
      const parentName=String(def.parent||"");
      const parent=this.boneMap.get(parentName);
      const world=worldMatrices.get(name);
      const local=parent
        ? new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(worldMatrices.get(parentName)).invert(),world)
        : world.clone();
      local.decompose(bone.position,bone.quaternion,bone.scale);
      bone.userData.makeHumanRestQuaternion = [bone.quaternion.x,bone.quaternion.y,bone.quaternion.z,bone.quaternion.w];
    }

    this.root.updateMatrixWorld(true);
    this.skeleton.calculateInverses();
    for(const bone of this.boneMap.values()){
      const q=new THREE.Quaternion();
      bone.getWorldQuaternion(q);
      bone.userData.makeHumanRestWorldQuaternion=[q.x,q.y,q.z,q.w];
    }

    for(const mesh of this.renderMeshes){
      if(mesh.skeleton!==this.skeleton){
        mesh.bind(this.skeleton);
        mesh.normalizeSkinWeights();
      }
    }
    this.root.updateMatrixWorld(true);
  }

  transformRawPoint(x,y,z,target=new THREE.Vector3()){
    const t=this._transformMeta || {minY:0,heightScale:1,massScale:1};
    return target.set(
      Number(x||0) * BASE_SCALE * t.massScale,
      (Number(y||0) - t.minY) * BASE_SCALE * t.heightScale,
      Number(z||0) * BASE_SCALE * t.massScale
    );
  }

  getVertexInfluences(index){
    return this.vertexInfluences?.[Number(index)] || [];
  }

  getBoneIndex(name){
    return this.boneIndexByName.get(name);
  }

  async loadFacialCatalog(){
    if(this.facialCatalog) return this.facialCatalog;
    if(this._facialCatalogPromise) return this._facialCatalogPromise;
    this._facialCatalogPromise=fetch(`${RUNTIME_ROOT}/../facial/catalog.json`,{cache:"force-cache"})
      .then(r=>{if(!r.ok)throw new Error(`Facial catalog ${r.status}`);return r.json();})
      .then(data=>{this.facialCatalog=data;return data;})
      .finally(()=>{this._facialCatalogPromise=null;});
    return this._facialCatalogPromise;
  }

  async _loadFacialPack(){
    if(this._facialPack) return this._facialPack;
    if(this._facialPackPromise) return this._facialPackPromise;
    this._facialPackPromise=this._fetchGzipJson(`${RUNTIME_ROOT}/../facial/facial_targets.vwpack.json.gz`)
      .then(data=>{this._facialPack=data?.targets||{};return this._facialPack;})
      .finally(()=>{this._facialPackPromise=null;});
    return this._facialPackPromise;
  }

  async _loadFacialTarget(id){
    id=String(id||"");
    if(!id || id==="none") return null;
    if(this._facialTargetCache.has(id)){
      const cached=this._facialTargetCache.get(id);
      this._facialTargetCache.delete(id); this._facialTargetCache.set(id,cached);
      return cached;
    }
    const pack=await this._loadFacialPack();
    const text=pack?.[id];
    if(typeof text!=="string") throw new Error(`Unknown MakeHuman facial target: ${id}`);
    const parsed=parseTarget(text);
    this._facialTargetCache.set(id,parsed);
    while(this._facialTargetCache.size>4){
      const first=this._facialTargetCache.keys().next().value;
      this._facialTargetCache.delete(first);
    }
    return parsed;
  }

  async _facialContributions(forge={}){
    const rows=[];
    const expression=String(forge.expressionUnit||"none");
    const viseme=String(forge.visemePreview||"none");
    const expressionWeight=THREE.MathUtils.clamp(Number(forge.expressionIntensity??100),0,100)/100;
    const visemeWeight=THREE.MathUtils.clamp(Number(forge.visemeIntensity??100),0,100)/100;
    if(expression!=="none" && expressionWeight>.0001) rows.push([expression,expressionWeight]);
    if(viseme!=="none" && visemeWeight>.0001) rows.push([viseme,visemeWeight]);
    return Promise.all(rows.map(async ([id,weight])=>[await this._loadFacialTarget(id),weight]));
  }

  async applyForge(forge={}, options={}){
    const serial=++this._applySerial;
    this.deformedRaw.set(this.basePositions);
    const contributions=this._forgeContributions(forge);
    const loaded=await Promise.all(contributions.map(async ([rel,weight])=>[await this._loadTarget(rel),weight]));
    const facialLoaded=await this._facialContributions(forge);
    if(serial !== this._applySerial) return false;
    for(const [target,weight] of loaded) this._applySparseTarget(target,weight);
    for(const [target,weight] of facialLoaded){ if(target) this._applySparseTarget(target,weight); }
    this._transformPositions(forge);
    this._updateGeometries();
    this._rebuildSkeleton();
    this.refitNativeAssets();
    this.root.userData.lastForge = {...forge};
    if(options.initial) this.root.updateMatrixWorld(true);
    return true;
  }

  async _fetchGzipJson(url){
    const res=await fetch(url,{cache:"force-cache"});
    if(!res.ok) throw new Error(`MakeHuman asset fetch failed ${res.status}: ${url}`);
    if(typeof DecompressionStream!=="function") throw new Error("Browser does not support gzip asset packs.");
    const stream=res.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  }

  async loadNativeCatalog(){
    if(this.nativeCatalog) return this.nativeCatalog;
    if(this._nativeCatalogPromise) return this._nativeCatalogPromise;
    this._nativeCatalogPromise=fetch(`${RUNTIME_ROOT}/../library/catalog.json`,{cache:"force-cache"})
      .then(r=>{ if(!r.ok) throw new Error(`Native catalog ${r.status}`); return r.json(); })
      .then(data=>{ this.nativeCatalog=data; return data; })
      .finally(()=>{ this._nativeCatalogPromise=null; });
    return this._nativeCatalogPromise;
  }

  async _loadNativePack(file){
    if(this._nativePackCache.has(file)){
      const cached=this._nativePackCache.get(file);
      this._nativePackCache.delete(file); this._nativePackCache.set(file,cached);
      return cached;
    }
    const data=await this._fetchGzipJson(`${RUNTIME_ROOT}/../library/packs/${file}`);
    const map=new Map((data.assets||[]).map(a=>[a.id,a]));
    this._nativePackCache.set(file,map);
    // Keep only one decompressed source pack. Active meshes retain only the
    // mapping data they need, so browsing large hair packs cannot grow the heap
    // without bound during a long Projection Bay session.
    while(this._nativePackCache.size>1){
      const first=this._nativePackCache.keys().next().value;
      this._nativePackCache.delete(first);
    }
    return map;
  }

  async _nativeAssetData(id){
    const catalog=await this.loadNativeCatalog();
    const row=catalog?.assets?.[id];
    if(!row) throw new Error(`Unknown MakeHuman asset: ${id}`);
    const pack=await this._loadNativePack(row.pack);
    const data=pack.get(id);
    if(!data) throw new Error(`Asset ${id} missing from ${row.pack}`);
    return data;
  }

  _nativeScale(meta={}){
    const p=this.deformedRaw;
    const axis=(spec,axisIndex)=>{
      if(!Array.isArray(spec)||spec.length<3) return 1;
      const a=Number(spec[0])*3+axisIndex,b=Number(spec[1])*3+axisIndex,den=Math.abs(Number(spec[2]))||1;
      if(a<0||b<0||a>=p.length||b>=p.length) return 1;
      return Math.abs(p[a]-p[b])/den;
    };
    return {x:axis(meta.x_scale,0),y:axis(meta.y_scale,1),z:axis(meta.z_scale,2)};
  }

  _fitNativeVertex(asset,index,target=new THREE.Vector3()){
    const p=this.deformedRaw, sc=this._nativeScale(asset.mhclo||{});
    if(asset.mappingIndices && asset.mappingValues){
      const io=index*3, vo=index*6;
      if(io+2>=asset.mappingIndices.length || vo+5>=asset.mappingValues.length) return target.set(0,0,0);
      const a=asset.mappingIndices[io]*3,b=asset.mappingIndices[io+1]*3,c=asset.mappingIndices[io+2]*3;
      const w0=asset.mappingValues[vo],w1=asset.mappingValues[vo+1],w2=asset.mappingValues[vo+2];
      const ox=asset.mappingValues[vo+3],oy=asset.mappingValues[vo+4],oz=asset.mappingValues[vo+5];
      const x=w0*p[a]+w1*p[b]+w2*p[c]+ox*sc.x;
      const y=w0*p[a+1]+w1*p[b+1]+w2*p[c+1]+oy*sc.y;
      const z=w0*p[a+2]+w1*p[b+2]+w2*p[c+2]+oz*sc.z;
      return this.transformRawPoint(x,y,z,target);
    }
    const m=asset.mapping?.[index];
    if(!m) return target.set(0,0,0);
    const i0=m[0]*3,i1=m[1]*3,i2=m[2]*3;
    const x=m[3]*p[i0]+m[4]*p[i1]+m[5]*p[i2]+m[6]*sc.x;
    const y=m[3]*p[i0+1]+m[4]*p[i1+1]+m[5]*p[i2+1]+m[7]*sc.y;
    const z=m[3]*p[i0+2]+m[4]*p[i1+2]+m[5]*p[i2+2]+m[8]*sc.z;
    return this.transformRawPoint(x,y,z,target);
  }

  _nativeVertexSkin(asset,index){
    const m=asset.mapping?.[index];
    const totals=new Map();
    if(m){
      for(let k=0;k<3;k++){
        const bw=Number(m[3+k]||0);
        if(bw<=0) continue;
        for(const [bi,w] of this.getVertexInfluences(m[k])) totals.set(bi,(totals.get(bi)||0)+bw*w);
      }
    }
    let rows=[...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
    if(!rows.length) rows=[[this.getBoneIndex("mixamorig:Hips")??0,1]];
    const sum=rows.reduce((a,x)=>a+x[1],0)||1;
    return rows.map(([i,w])=>[i,w/sum]);
  }

  async _textureFromEmbedded(tex,slot){
    if(!tex?.data) return null;
    const binary=atob(tex.data); const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:tex.mime||"image/webp"}));
    try{
      const texture=await new THREE.TextureLoader().loadAsync(url);
      texture.flipY=false;
      if(slot==="diffuse") texture.colorSpace=THREE.SRGBColorSpace;
      texture.needsUpdate=true;
      return texture;
    }finally{ URL.revokeObjectURL(url); }
  }

  async _nativeMaterial(asset,tint){
    const m=asset.material||{};
    const dc=Array.isArray(m.diffuseColor)?m.diffuseColor:[.8,.8,.8];
    const color=new THREE.Color(dc[0]??.8,dc[1]??.8,dc[2]??.8);
    if(tint) color.multiply(tint);
    const material=new THREE.MeshStandardMaterial({
      color,roughness:.72,metalness:Math.max(0,Math.min(1,Number(m.metallic||0))),
      transparent:!!m.transparent || Number(m.opacity??1)<.999,opacity:Number(m.opacity??1),
      side:THREE.DoubleSide,alphaTest:(!!m.transparent?0.08:0)
    });
    material.name=`MHNative_${asset.id}`; material.userData.veilwatchNativeAsset=true;
    const diffuse=await this._textureFromEmbedded(asset.textures?.diffuse,"diffuse");
    if(diffuse){ material.map=diffuse; material.needsUpdate=true; }
    return material;
  }

  async _createNativeAssetMesh(asset,tint){
    const tri=asset.geometry?.triangles||[], uvs=asset.geometry?.uvs||[];

    // OBJ faces carry separate position/UV indices. Deduplicate each (v,vt)
    // pair instead of expanding every triangle corner into a new vertex. This is
    // a major memory reduction for high-poly MakeHuman hairstyles.
    const pairToIndex=new Map();
    const positions=[], texcoords=[], skinIndices=[], skinWeights=[], sourceRefs=[], indices=[];
    const cachePos=new Map(), cacheSkin=new Map();
    for(let c=0;c<Math.floor(tri.length/2);c++){
      const vi=Number(tri[c*2]), ti=Number(tri[c*2+1]);
      const key=`${vi}/${ti}`;
      let outIndex=pairToIndex.get(key);
      if(outIndex===undefined){
        outIndex=sourceRefs.length; pairToIndex.set(key,outIndex); sourceRefs.push(vi);
        let v=cachePos.get(vi); if(!v){v=this._fitNativeVertex(asset,vi,new THREE.Vector3());cachePos.set(vi,v);}
        positions.push(v.x,v.y,v.z);
        texcoords.push(ti>=0?(uvs[ti*2]??0):0,ti>=0?(uvs[ti*2+1]??0):0);
        let sk=cacheSkin.get(vi); if(!sk){sk=this._nativeVertexSkin(asset,vi);cacheSkin.set(vi,sk);}
        for(let j=0;j<4;j++){skinIndices.push(sk[j]?.[0]??0);skinWeights.push(sk[j]?.[1]??0);}
      }
      indices.push(outIndex);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(texcoords,2));
    geometry.setAttribute("skinIndex",new THREE.BufferAttribute(new Uint16Array(skinIndices),4));
    geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(skinWeights,4));
    geometry.setIndex(new THREE.BufferAttribute(sourceRefs.length>65535?new Uint32Array(indices):new Uint16Array(indices),1));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material=await this._nativeMaterial(asset,tint);
    const mesh=new THREE.SkinnedMesh(geometry,material); mesh.name=`MHNative_${asset.id}`; mesh.frustumCulled=false;
    mesh.userData.nativeVertexRefs=new Uint32Array(sourceRefs);
    mesh.bind(this.skeleton); mesh.normalizeSkinWeights();
    return mesh;
  }

  _disposeNativeRoot(root){
    root?.traverse?.(obj=>{
      obj.geometry?.dispose?.();
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const mat of mats){ if(!mat) continue; for(const v of Object.values(mat)){if(v?.isTexture)v.dispose?.();} mat.dispose?.(); }
    });
    root?.parent?.remove(root);
  }

  _refreshNativeBodyMask(){
    const next=new Set();
    for(const row of this.nativeAssets.values()) for(const vi of row.asset?.delete||[]) next.add(Number(vi));
    this.hiddenBodyVertices=next;
    this._updateGeometries();
  }

  _compactNativeAsset(asset){
    const rows=asset.mapping||[];
    const mappingIndices=new Int32Array(rows.length*3);
    const mappingValues=new Float32Array(rows.length*6);
    for(let i=0;i<rows.length;i++){
      const m=rows[i]||[]; const io=i*3, vo=i*6;
      mappingIndices[io]=Number(m[0]||0); mappingIndices[io+1]=Number(m[1]||0); mappingIndices[io+2]=Number(m[2]||0);
      for(let j=0;j<6;j++) mappingValues[vo+j]=Number(m[3+j]||0);
    }
    return {
      id:asset.id,
      mappingIndices,
      mappingValues,
      mhclo:asset.mhclo||{},
      delete:new Uint32Array(asset.delete||[]),
      material:asset.material||{}
    };
  }

  _updateNativeTint(row,tint){
    if(!row?.mesh?.material) return;
    const m=row.asset?.material||{};
    const dc=Array.isArray(m.diffuseColor)?m.diffuseColor:[.8,.8,.8];
    const c=new THREE.Color(dc[0]??.8,dc[1]??.8,dc[2]??.8);
    if(tint) c.multiply(new THREE.Color(tint));
    const mats=Array.isArray(row.mesh.material)?row.mesh.material:[row.mesh.material];
    for(const mat of mats){if(mat?.color){mat.color.copy(c);mat.needsUpdate=true;}}
    row.tint=tint||null;
  }

  async setNativeAssets(requests=[]){
    const serial=++this._nativeLoadSerial;
    const desired=new Map((requests||[]).filter(r=>r?.slot&&r?.id).map(r=>[r.slot,r]));
    for(const [slot,row] of [...this.nativeAssets.entries()]){
      const d=desired.get(slot);
      if(!d || d.id!==row.id){ this._disposeNativeRoot(row.root); this.nativeAssets.delete(slot); }
    }
    for(const [slot,req] of desired.entries()){
      const existing=this.nativeAssets.get(slot);
      if(existing?.id===req.id){ this._updateNativeTint(existing,req.tint); continue; }
      try{
        const asset=await this._nativeAssetData(req.id);
        if(serial!==this._nativeLoadSerial) return false;
        const tint=req.tint?new THREE.Color(req.tint):null;
        const mesh=await this._createNativeAssetMesh(asset,tint);
        if(serial!==this._nativeLoadSerial){ this._disposeNativeRoot(mesh); return false; }
        const root=new THREE.Group(); root.name=`MHNativeSlot_${slot}`; root.add(mesh); this.root.add(root);
        // Keep only refit data after the mesh is built. Geometry/UV/base64 texture
        // payloads belong to the temporary pack cache and may be garbage collected.
        const activeAsset=this._compactNativeAsset(asset);
        const row={id:req.id,asset:activeAsset,root,mesh,tint:req.tint||null};
        this.nativeAssets.set(slot,row);
      }catch(err){ console.warn(`MakeHuman native asset failed (${slot}:${req.id}):`,err?.message||err); }
    }
    const helperLashes=this.renderMeshes.find(m=>m.name==="MakeHumanEyelashes");
    if(helperLashes) helperLashes.visible=!desired.has("eyelashes");
    this._refreshNativeBodyMask();
    return serial===this._nativeLoadSerial;
  }

  refitNativeAssets(){
    for(const row of this.nativeAssets.values()){
      const mesh=row.mesh, asset=row.asset; if(!mesh?.geometry||!asset) continue;
      const refs=mesh.userData.nativeVertexRefs||[]; const pos=mesh.geometry.getAttribute("position");
      const cache=new Map();
      for(let c=0;c<refs.length;c++){
        const vi=refs[c]; let v=cache.get(vi); if(!v){v=this._fitNativeVertex(asset,vi,new THREE.Vector3());cache.set(vi,v);}
        pos.array[c*3]=v.x;pos.array[c*3+1]=v.y;pos.array[c*3+2]=v.z;
      }
      pos.needsUpdate=true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
      if(mesh.skeleton!==this.skeleton) mesh.bind(this.skeleton,new THREE.Matrix4());
    }
    if(this.hiddenBodyVertices?.size) this._updateGeometries();
  }

  clearNativeAssets(){
    this._nativeLoadSerial++;
    for(const row of this.nativeAssets.values()) this._disposeNativeRoot(row.root);
    this.nativeAssets.clear(); this.hiddenBodyVertices.clear(); this._nativePackCache.clear();
  }

  async loadSurfaceCatalog(){
    if(this.surfaceCatalog) return this.surfaceCatalog;
    if(this._surfaceCatalogPromise) return this._surfaceCatalogPromise;
    this._surfaceCatalogPromise=fetch(`${RUNTIME_ROOT}/../surfaces/catalog.json`,{cache:"force-cache"})
      .then(r=>{if(!r.ok)throw new Error(`Surface catalog ${r.status}`);return r.json();})
      .then(data=>{this.surfaceCatalog=data;return data;})
      .finally(()=>{this._surfaceCatalogPromise=null;});
    return this._surfaceCatalogPromise;
  }

  async _surfaceData(id){
    const catalog=await this.loadSurfaceCatalog();
    const row=catalog?.surfaces?.[id];
    if(!row) throw new Error(`Unknown MakeHuman surface: ${id}`);
    let pack=this._surfacePackCache.get(row.pack);
    if(!pack){
      const data=await this._fetchGzipJson(`${RUNTIME_ROOT}/../surfaces/packs/${row.pack}`);
      pack=new Map((data.surfaces||[]).map(x=>[x.id,x]));
      this._surfacePackCache.clear();
      this._surfacePackCache.set(row.pack,pack);
    }
    const surface=pack.get(id);
    if(!surface) throw new Error(`Surface ${id} missing from ${row.pack}`);
    return surface;
  }

  _disposeSurfaceTextures(material){
    if(!material) return;
    for(const key of ["map","normalMap","bumpMap","roughnessMap","aoMap","alphaMap"]){
      const tex=material[key];
      if(tex?.userData?.veilwatchSurfaceTexture) tex.dispose?.();
      if(tex?.userData?.veilwatchSurfaceTexture) material[key]=null;
    }
  }

  async setSurface(kind,id,tint=null){
    kind=kind==="eye"?"eye":"skin";
    const material=kind==="eye"?this.materials.eye:this.materials.skin;
    if(id && this.activeSurfaces[kind]===id){
      if(kind==="skin") this.setSkinColor(tint||this._skinTint); else this.setEyeColor(tint||this._eyeTint);
      return true;
    }
    const serial=++this._surfaceLoadSerial[kind];
    if(!id || id==="none"){
      this._disposeSurfaceTextures(material);
      this.activeSurfaces[kind]=null;
      if(kind==="skin") this.setSkinColor(tint||this._skinTint); else this.setEyeColor(tint||this._eyeTint);
      material.needsUpdate=true;
      return true;
    }
    try{
      const surface=await this._surfaceData(id);
      const built={};
      for(const [slot,key] of [["diffuse","map"],["normal","normalMap"],["bump","bumpMap"],["roughness","roughnessMap"],["ao","aoMap"],["alpha","alphaMap"]]){
        const tex=await this._textureFromEmbedded(surface.textures?.[slot],slot);
        if(tex){tex.userData.veilwatchSurfaceTexture=true;built[key]=tex;}
      }
      if(serial!==this._surfaceLoadSerial[kind]){for(const tex of Object.values(built))tex.dispose?.();return false;}
      this._disposeSurfaceTextures(material);
      Object.assign(material,built);
      const dc=surface.material?.diffuseColor;
      const base=Array.isArray(dc)?new THREE.Color(dc[0]??1,dc[1]??1,dc[2]??1):new THREE.Color(0xffffff);
      const wanted=tint?new THREE.Color(tint):(kind==="skin"?this._skinTint:this._eyeTint);
      // Preserve photographed/material coloration while letting Veilwatch's color
      // swatches gently bias the result instead of repainting the texture.
      material.userData.veilwatchSurfaceBaseColor=base.clone();
      material.color.copy(base.clone().lerp(wanted,kind==="skin"?.16:.08));
      material.roughness=kind==="eye"?.20:Math.max(.38,Math.min(.9,1-Number(surface.material?.shininess??.5)*.35));
      material.metalness=0;
      material.transparent=!!surface.material?.transparent || Number(surface.material?.opacity??1)<.999;
      material.opacity=Number(surface.material?.opacity??1);
      material.alphaTest=material.alphaMap?.isTexture?.08:0;
      material.needsUpdate=true;
      this.activeSurfaces[kind]=id;
      return true;
    }catch(err){
      console.warn(`MakeHuman ${kind} surface failed (${id}):`,err?.message||err);
      return false;
    }
  }

  setSkinColor(color){
    this._skinTint.copy(color instanceof THREE.Color?color:new THREE.Color(color));
    if(this.materials.skin.map){
      const base=this.materials.skin.userData?.veilwatchSurfaceBaseColor?.clone?.()||new THREE.Color(0xffffff);
      this.materials.skin.color.copy(base.lerp(this._skinTint,.16));
    }else this.materials.skin.color.copy(this._skinTint);
    this.materials.skin.needsUpdate=true;
  }
  setEyeColor(color){
    this._eyeTint.copy(color instanceof THREE.Color?color:new THREE.Color(color));
    if(this.materials.eye.map){
      const base=this.materials.eye.userData?.veilwatchSurfaceBaseColor?.clone?.()||new THREE.Color(0xffffff);
      this.materials.eye.color.copy(base.lerp(this._eyeTint,.08));
    }else this.materials.eye.color.copy(new THREE.Color(0xf1ece4).lerp(this._eyeTint,.12));
    this.materials.eye.needsUpdate=true;
  }

  getBone(name){
    const wanted=String(name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    for(const [boneName,bone] of this.boneMap.entries()){
      const normalized=boneName.toLowerCase().replace(/[^a-z0-9]/g,"");
      if(normalized===wanted || normalized.endsWith(wanted)) return bone;
    }
    return null;
  }

  dispose(){
    this.clearNativeAssets();
    this._disposeSurfaceTextures(this.materials.skin);
    this._disposeSurfaceTextures(this.materials.eye);
    this._surfacePackCache.clear();
    this.surfaceCatalog=null;
    this.skeleton?.dispose?.();
    this.targetCache.clear();
    this._facialTargetCache.clear();
    this._facialPack=null;
    this.facialCatalog=null;
    this._nativePackCache.clear();
  }
}

export async function createMakeHumanRuntime(initialForge={}, options={}){
  const runtime=new MakeHumanRuntime(options);
  await runtime.init(initialForge);
  return runtime;
}
