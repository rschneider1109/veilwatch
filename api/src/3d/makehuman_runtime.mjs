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
    this.renderMeshes = [];
    this.boneMap = new Map();
    this.skeleton = null;
    this._boneRoots = [];
    this._applySerial = 0;

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

  _rebuildSkeleton(){
    if(this.skeleton){
      for(const root of this._boneRoots) root.parent?.remove(root);
      this.skeleton.dispose?.();
    }
    this.boneMap.clear();
    this._boneRoots=[];

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
      const matrix=new THREE.Matrix4().compose(head,q,new THREE.Vector3(1,1,1));
      worldMatrices.set(name,matrix);
      const bone=new THREE.Bone(); bone.name=name; this.boneMap.set(name,bone);
    }

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
      if(parent) parent.add(bone); else { this.root.add(bone); this._boneRoots.push(bone); }
    }

    this.root.updateMatrixWorld(true);
    const bones=names.map(n=>this.boneMap.get(n));
    this.skeleton=new THREE.Skeleton(bones);
    for(const mesh of this.renderMeshes){
      // Let Three use the mesh's current world matrix as the bind matrix. This
      // keeps skinning stable after Projection Bay camera framing repositions
      // the character root between proportion edits.
      mesh.bind(this.skeleton);
      mesh.normalizeSkinWeights();
    }
    this.root.updateMatrixWorld(true);
  }

  async applyForge(forge={}, options={}){
    const serial=++this._applySerial;
    this.deformedRaw.set(this.basePositions);
    const contributions=this._forgeContributions(forge);
    const loaded=await Promise.all(contributions.map(async ([rel,weight])=>[await this._loadTarget(rel),weight]));
    if(serial !== this._applySerial) return false;
    for(const [target,weight] of loaded) this._applySparseTarget(target,weight);
    this._transformPositions(forge);
    this._updateGeometries();
    this._rebuildSkeleton();
    this.root.userData.lastForge = {...forge};
    if(options.initial) this.root.updateMatrixWorld(true);
    return true;
  }

  setSkinColor(color){ this.materials.skin.color.copy(color); this.materials.skin.needsUpdate=true; }
  setEyeColor(color){
    // Until iris materials from the asset packs are wired in, use a subtle eye tint.
    this.materials.eye.color.copy(new THREE.Color(0xf1ece4).lerp(color,.12));
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
    this.skeleton?.dispose?.();
    this.targetCache.clear();
  }
}

export async function createMakeHumanRuntime(initialForge={}, options={}){
  const runtime=new MakeHumanRuntime(options);
  await runtime.init(initialForge);
  return runtime;
}
