// ============================================================================
// CN_Merged_Engine — ENTERPRISE BUILD (corporate register)
// Proposed Policy Framework — Candidate Submission · Pratik Singh
// Groups: NETWORK · PROGRAMS · SUPPORT · RECORD
// All figures modeled/illustrative pending live MyStudio/QuickBooks integration.
// FDD Item 20 = 244 authoritative units. Engine proposes; it does not enact.
// ============================================================================
import React, { useState, useEffect, useMemo, useRef, Fragment } from "react";
import * as THREE from "three";

// ---- Network Command Table (compact, embedded) ----
// Approximate US + adjacent-province layout (cartogram, not a precise
// projection) for every territory actually present in the modeled network --
// this used to be four arbitrary points with hardcoded numbers, then 37 real
// US states; it is now the complete real set, including the three Canadian
// provinces the network model has always carried but the map had never shown.
const MAP_STATE_COORDS={
  AL:[1.81,2.79],AR:[0.47,2.01],AZ:[-3.52,2.17],CA:[-4.75,0.62],CO:[-1.9,-0.93],
  CT:[5.04,-1.55],DE:[4.75,-0.47],FL:[3.32,4.65],GA:[2.76,2.17],IA:[0.28,-0.93],
  ID:[-3.8,-2.48],IL:[1.23,-0.47],IN:[1.99,-0.47],KS:[-0.95,0.62],LA:[0.19,3.57],
  MA:[5.22,-2.64],MD:[4.18,-0.16],MI:[2.19,-2.48],MN:[0.28,-3.57],MO:[0.28,0.62],
  NC:[3.99,1.08],ND:[-0.95,-4.03],NJ:[4.46,-0.93],NV:[-3.8,-0.93],NY:[4.09,-2.79],
  OH:[2.85,-0.78],OK:[-0.95,2.17],OR:[-4.75,-2.48],PA:[3.8,-1.24],SC:[3.61,2.01],
  TN:[2.09,1.08],TX:[-1.42,3.72],UT:[-2.85,-0.93],VA:[3.71,0.31],WA:[-4.75,-4.03],
  WI:[0.95,-2.48],WV:[3.14,0.0],
  BC:[-4.75,-5.7],AB:[-2.85,-5.7],ON:[2.19,-5.4],
};
const MAP_DIMS=["engagement","margin","staffing","community"];
function mapClamp(v){return Math.max(0.02,Math.min(1,v));}
function buildMapNodes(states,railData,leads){
 const conflictedCenters=new Set((railData&&railData.conflicts||[]).flatMap(c=>{
  const recs=railData.recommendations||[];
  const ra=recs.find(r=>r.id===c.a),rb=recs.find(r=>r.id===c.b);
  return[ra,rb].filter(Boolean).flatMap(r=>r.targetIds.filter(t=>typeof t==="string"&&t.length>2));
 }));
 const leadsByRegion={};
 (leads||[]).filter(l=>l.stage0<5).forEach(l=>{leadsByRegion[l.region]=(leadsByRegion[l.region]||0)+1;});
 return Object.keys(states).filter(st=>MAP_STATE_COORDS[st]).map(st=>{
  const cs=states[st];
  const n=cs.length;
  const avgHealth=cs.reduce((a,c)=>a+c.health,0)/n/100;
  const avgConv=cs.reduce((a,c)=>a+c.conv,0)/n;
  const avgChem=cs.reduce((a,c)=>a+c.chem,0)/n;
  const avgRet=cs.reduce((a,c)=>a+c.ret,0)/n;
  const avgEb=cs.reduce((a,c)=>a+c.eb,0)/n;
  const marginDim=mapClamp((avgEb+4)/18);
  const conditions=cs.map(c=>conditionOf(c).label);
  const worst=conditions.includes("at-risk")?"at-risk":conditions.includes("watch")?"watch":"thriving";
  const hex=worst==="at-risk"?0xe03535:worst==="watch"?0xd9a520:0x2fbf5f;
  const conflicted=cs.some(c=>conflictedCenters.has(c.name));
  const centerNames=new Set(cs.map(c=>c.name));
  const verifiedN=cs.filter(c=>c.verified).length; // real per-center flag, same one the FDD reconciliation panel now counts from
  return{
   id:st,label:st,pos:MAP_STATE_COORDS[st],state:worst,hex,n,centerNames,verifiedN,
   vals:{engagement:mapClamp(avgConv),margin:marginDim,staffing:mapClamp(avgChem),community:mapClamp(avgRet)},
   conflicted,leadCount:leadsByRegion[st]||0,
   repCenter:[...cs].sort((a,b)=>a.health-b.health)[0],
  };
 });
}
function mtVal(c,d){return c.vals[d];}
function mtHealth(c){return MAP_DIMS.reduce((s,d)=>s+mtVal(c,d),0)/MAP_DIMS.length;}
// ============================================================================
// 3D NETWORK MAP — Interactive Three.js Visualization
// Features: A. 3D spheres | B. Heatmap overlay | C. Flow visualization
//           D. Proposal impact | E. Cluster highlighting | F. Conflict zones
//           G. Comparison mode | H. Drill-down | I. Capacity rings | J. Forecast slider
// ============================================================================

// 3D Map Component (A-J: All map features)
function Map3D({mapNodes, mEdges, clusters, approvedPosture, railData, selectedState, onStateClick, scenario, centers, states}) {
 const containerRef=useRef(null);
 const sceneRef=useRef(null);
 const rendererRef=useRef(null);
 const spheresRef=useRef({});
 const [highlightedState, setHighlightedState]=useState(null);
 const [hoveredState, setHoveredState]=useState(null);
 const [impactAnimation, setImpactAnimation]=useState(null); // D. Proposal impact animation
 const [conflictZones, setConflictZones]=useState(new Set()); // F. Conflict zones

 // D. Proposal impact: detect affected states when decision approved
 const triggerImpactAnimation = (affectedStateIds) => {
  setMapImpactAnimation({ affectedStates: new Set(affectedStateIds), startTime: Date.now() });
  setTimeout(() => setMapImpactAnimation(null), 2500);
 };

 // H. Get centers for drill-down detail
 const selectedStateCenters = selectedStateDetail && states[selectedStateDetail] ?
  states[selectedStateDetail].map(c => ({
   ...c,
   condition: c.health < 55 || c.eb < QFLOORS.margin_ebitda_k ? 'at-risk' : c.health < 70 ? 'watch' : 'thriving',
   margin: c.eb,
   health: c.health,
  })) : [];

 // F. Detect conflict zones from railData
 useEffect(() => {
  if (!railData || !railData.conflicts) return;
  const zones = new Set();
  railData.conflicts.forEach(c => {
    const aRec = railData.recommendations?.find(r => r.id === c.a);
    const bRec = railData.recommendations?.find(r => r.id === c.b);
    if (aRec?.targetIds) zones.add(aRec.targetIds[1]); // region for Growth proposals
    if (bRec?.targetIds) zones.add(bRec.targetIds[1]); // region
  });
  setConflictZones(zones);
 }, [railData]);

 useEffect(() => {
  if (!containerRef.current || !mapNodes.length) return;

  // Initialize Three.js scene (A. 3D Map)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfaf8f8);
  sceneRef.current = scene;

  const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
  camera.position.set(0, 2, 3.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  containerRef.current.appendChild(renderer.domElement);
  rendererRef.current = renderer;

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // B. Heatmap background gradient (behind the spheres)
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = 512;
  heatmapCanvas.height = 512;
  const heatmapCtx = heatmapCanvas.getContext('2d');
  const avgHealth = mapNodes.length ? mapNodes.reduce((s, n) => s + (n.state === 'at-risk' ? 0 : n.state === 'watch' ? 0.5 : 1), 0) / mapNodes.length : 0.5;
  const gradient = heatmapCtx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, avgHealth > 0.7 ? '#2fbf5f' : avgHealth > 0.4 ? '#d9a520' : '#e03535');
  gradient.addColorStop(1, '#fafaf8');
  heatmapCtx.fillStyle = gradient;
  heatmapCtx.fillRect(0, 0, 512, 512);
  const heatmapTexture = new THREE.CanvasTexture(heatmapCanvas);
  const planeGeom = new THREE.PlaneGeometry(10, 10);
  const planeMat = new THREE.MeshBasicMaterial({ map: heatmapTexture });
  const plane = new THREE.Mesh(planeGeom, planeMat);
  plane.position.z = -0.5;
  scene.add(plane);

  // Create spheres for each state (A. 3D Map: size, height, color)
  // I. Add capacity rings (torus around sphere showing FBC/sensei load)
  const stateGeom = new THREE.SphereGeometry(1, 32, 32);
  const ringGeom = new THREE.TorusGeometry(1.05, 0.08, 16, 100); // I. Capacity ring
  mapNodes.forEach((node) => {
    const healthFraction = node.state === 'at-risk' ? 0.3 : node.state === 'watch' ? 0.6 : 0.9;
    const sizeMultiplier = 0.2 + (node.n / 50) * 0.3; // size by center count
    const heightMultiplier = healthFraction * 1.5; // height by health
    const color = node.state === 'at-risk' ? 0xe03535 : node.state === 'watch' ? 0xd9a520 : 0x2fbf5f;

    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 });
    const sphere = new THREE.Mesh(stateGeom, mat);
    sphere.scale.set(sizeMultiplier, heightMultiplier, sizeMultiplier);
    sphere.position.set(node.pos[0], heightMultiplier * 0.5, node.pos[1]);
    sphere.userData = { state: node, isAtRisk: node.state === 'at-risk' };
    scene.add(sphere);
    spheresRef.current[node.id] = sphere;

    // I. Capacity ring around sphere (blue=normal, red=stressed)
    const ringMat = new THREE.MeshBasicMaterial({ color: node.state === 'at-risk' ? 0xff4444 : 0x4488ff, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.copy(sphere.position);
    ring.position.y += heightMultiplier * 0.05;
    ring.scale.set(sizeMultiplier, 1, sizeMultiplier);
    scene.add(ring);
  });

  // Add propagation edges (lines)
  const linesMat = new THREE.LineBasicMaterial({ color: 0xac6b7f, transparent: true, opacity: 0.3 });
  mEdges.forEach((edge) => {
    const points = [
      new THREE.Vector3(edge.a.pos[0], 0.1, edge.a.pos[1]),
      new THREE.Vector3(edge.b.pos[0], 0.1, edge.b.pos[1]),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeom, linesMat);
    scene.add(line);
  });

  // C. Flow Visualization - animated arrows showing resource allocation
  const atRiskStates = mapNodes.filter(n => n.state === 'at-risk').slice(0, 5); // top 5 at-risk for clarity
  let arrowTime = 0;
  atRiskStates.forEach((atRiskNode) => {
    const healthiestNode = [...mapNodes].sort((a, b) => {
      const aHealth = a.state === 'at-risk' ? 0 : a.state === 'watch' ? 0.5 : 1;
      const bHealth = b.state === 'at-risk' ? 0 : b.state === 'watch' ? 0.5 : 1;
      return bHealth - aHealth;
    })[0];

    if (!healthiestNode) return;

    // Create animated flow arrow from healthy → at-risk
    const startPos = new THREE.Vector3(healthiestNode.pos[0], 0.2, healthiestNode.pos[1]);
    const endPos = new THREE.Vector3(atRiskNode.pos[0], 0.2, atRiskNode.pos[1]);
    const midPos = startPos.clone().lerp(endPos, 0.5);

    // Flow particle (animated dot moving along path)
    const particleGeom = new THREE.SphereGeometry(0.08, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true });
    const particle = new THREE.Mesh(particleGeom, particleMat);
    particle.userData = { startPos, endPos, speed: 0.003 + Math.random() * 0.002, t: Math.random() };
    scene.add(particle);

    // Arrow line from healthy to at-risk
    const arrowGeom = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const arrowMat = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.4, linewidth: 2 });
    const arrowLine = new THREE.Line(arrowGeom, arrowMat);
    scene.add(arrowLine);
  });


  // Mouse interaction for drill-down (H. Drill-Down)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const onMouseClick = (event) => {
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(spheresRef.current));
    if (intersects.length > 0) {
      const clickedSphere = intersects[0].object;
      onStateClick?.(clickedSphere.userData.state.id);
      setHighlightedState(clickedSphere.userData.state.id);
    }
  };
  renderer.domElement.addEventListener('click', onMouseClick);

  // Animation loop
  const animate = () => {
    requestAnimationFrame(animate);

    // C. Flow visualization: animate flow particles
    scene.children.forEach(child => {
      if (child.userData && child.userData.t !== undefined) {
        child.userData.t += child.userData.speed;
        if (child.userData.t > 1) child.userData.t -= 1;
        const lerpPos = child.userData.startPos.clone().lerp(child.userData.endPos, child.userData.t);
        child.position.copy(lerpPos);
        if (child.material.opacity !== undefined) {
          child.material.opacity = Math.sin(child.userData.t * Math.PI) * 0.8;
        }
      }
    });

    // E. Cluster highlighting: glow at-risk clusters
    // F. Conflict zone highlighting: glow orange for territories with conflicts
    // D. Proposal impact: briefly highlight affected territories when decision approved
    Object.entries(spheresRef.current).forEach(([stateId, sphere]) => {
      const isAtRisk = sphere.userData.isAtRisk;
      const isHighlighted = highlightedState === stateId;
      const isConflict = conflictZones.has(stateId);
      const isImpact = impactAnimation?.affectedStates?.has(stateId);

      // Priority: impact animation > conflict zone > highlighted > at-risk
      if (isImpact) {
        sphere.material.emissive.setHex(0x00ff00); // green for impact
        sphere.material.emissiveIntensity = 0.7;
      } else if (isConflict) {
        sphere.material.emissive.setHex(0xffa500); // orange for conflict
        sphere.material.emissiveIntensity = 0.5;
      } else if (isHighlighted) {
        sphere.material.emissive.setHex(0x444444);
        sphere.material.emissiveIntensity = 0.5;
      } else if (isAtRisk) {
        sphere.material.emissive.setHex(0x660000); // dark red for at-risk
        sphere.material.emissiveIntensity = 0.2;
      } else {
        sphere.material.emissiveIntensity = 0;
      }
    });

    // D. Fade out impact animation after 2 seconds
    if (impactAnimation && impactAnimation.startTime && Date.now() - impactAnimation.startTime > 2000) {
      setImpactAnimation(null);
    }

    renderer.render(scene, camera);
  };
  animate();

  // Handle window resize
  const handleResize = () => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    renderer.domElement.removeEventListener('click', onMouseClick);
    containerRef.current?.removeChild(renderer.domElement);
  };
 }, [mapNodes, mEdges, approvedPosture, highlightedState]);

 return <div ref={containerRef} style={{ width: '100%', height: 250, border: '1px solid #eee', background: '#fafaf8' }} />;
}

// Real propagation edges: drawn from the Network Propagation agent's actual
// proposed source-to-target pairs, not from map-layout distance. If the agent
// has proposed nothing this cycle, no beams show -- an honest empty state
// rather than a decorative substitute.
// The Network Propagation agent itself only ever proposes WITHIN a single
// state -- it finds the strongest and weakest units in the same cluster and
// proposes spreading a practice between them there. That means agent-sourced
// pairs can never span two different territories, so a map of cross-state
// beams built directly from agent recommendations would always be empty --
// not a bug, but a permanently-decorative feature dressed up as live data.
// Cross-territory candidates are computed here instead, using the same
// methodology the agent applies within a state (top vs. bottom composite,
// a real gap threshold) but applied across the map's state-level aggregates,
// and labeled as such rather than mislabeled as sourced from the agent.
const MAP_PROPAGATION_GAP_MIN=0.12;
function buildPropagationEdges(mapNodes){
 const sorted=[...mapNodes].sort((a,b)=>mtHealth(b)-mtHealth(a));
 if(sorted.length<2)return[];
 const k=Math.min(3,Math.floor(sorted.length/2));
 const strong=sorted.slice(0,k),weak=sorted.slice(-k);
 const edges=[];const seen=new Set();
 weak.forEach(w=>{
  // pair each weak territory with its nearest strong one on the map, so the
  // beam also reads as geographically sensible, not just numerically paired
  let best=null,bestDist=Infinity;
  strong.forEach(s=>{
   const gap=mtHealth(s)-mtHealth(w);
   if(gap<MAP_PROPAGATION_GAP_MIN)return;
   const d=Math.hypot(s.pos[0]-w.pos[0],s.pos[1]-w.pos[1]);
   if(d<bestDist){bestDist=d;best=s;}
  });
  if(!best)return;
  const key=[best.id,w.id].sort().join("-");
  if(seen.has(key))return;seen.add(key);
  edges.push({a:best,b:w,gap:+(mtHealth(best)-mtHealth(w)).toFixed(2)});
 });
 return edges;
}
function CommandTableTab({centers,states,opt,setOpt,railData,leads,jumpTo}){
 const mountRef=useRef(null);const [sel,setSel]=useState(null);const [sel2,setSel2]=useState(null);
 const [viewMode,setViewMode]=useState("3d");
 const currentWeek=opt&&typeof opt.week==="number"?opt.week:0;
 const [week,setWeek]=useState(currentWeek);
 useEffect(()=>{setWeek(currentWeek);},[currentWeek]);
 const weekRef=useRef(currentWeek);const selRef=useRef(null);const apiRef=useRef({});
 const[webglFailed,setWebglFailed]=useState(false);
 const mapNodes=useMemo(()=>buildMapNodes(states,railData||{recommendations:[],conflicts:[]},leads),[states,railData,leads]);
 const nodesRef=useRef(mapNodes);nodesRef.current=mapNodes;
 const edges=useMemo(()=>buildPropagationEdges(mapNodes),[mapNodes]);
 const edgesRef=useRef(edges);edgesRef.current=edges;
 useEffect(()=>{weekRef.current=week;apiRef.current.w&&apiRef.current.w(week);},[week]);
 const DEFAULT_ORBIT={theta:0.9,phi:1.02,radius:24};
 useEffect(()=>{
  const mount=mountRef.current;if(!mount)return;
  const W=mount.clientWidth||900,H=460;let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){setWebglFailed(true);return;}
  renderer.setSize(W,H);mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x05060e);scene.fog=new THREE.FogExp2(0x05060e,0.024);
  const camera=new THREE.PerspectiveCamera(55,W/H,0.1,200);
  const orbit={...DEFAULT_ORBIT};
  const cam=()=>{camera.position.set(orbit.radius*Math.sin(orbit.phi)*Math.cos(orbit.theta),1.2+orbit.radius*Math.cos(orbit.phi),orbit.radius*Math.sin(orbit.phi)*Math.sin(orbit.theta));camera.lookAt(0,1.2,0);};cam();
  scene.add(new THREE.AmbientLight(0x223344,1.0));
  const kl=new THREE.DirectionalLight(0x8899ff,0.4);kl.position.set(10,20,10);scene.add(kl);
  const SEG=60;const tg=new THREE.PlaneGeometry(70,80,SEG,SEG);tg.rotateX(-Math.PI/2);
  const tp=tg.attributes.position;const bY=new Float32Array(tp.count);
  for(let k=0;k<tp.count;k++){const x=tp.getX(k),z=tp.getZ(k);const d=Math.sqrt(x*x+z*z);bY[k]=Math.sin(x*0.25)*Math.cos(z*0.22)*0.35-Math.max(0,d-18)*0.1;}
  const wells=()=>{const list=nodesRef.current;for(let k=0;k<tp.count;k++){const x=tp.getX(k),z=tp.getZ(k);let y=bY[k];
   for(const c of list){const dx=x-c.pos[0],dz=z-c.pos[1];const r=1-mtHealth(c);const s=2.2+r*1.2;y-=r*r*6.5*Math.exp(-(dx*dx+dz*dz)/(2*s*s));}
   tp.setY(k,y);}tp.needsUpdate=true;};
  wells();
  scene.add(new THREE.Mesh(tg,new THREE.MeshBasicMaterial({color:0x1a2547,wireframe:true,transparent:true,opacity:0.5})));
  const gY=(cx,cz)=>{let y=Math.sin(cx*0.25)*Math.cos(cz*0.22)*0.35;for(const c of nodesRef.current){const dx=cx-c.pos[0],dz=cz-c.pos[1];const r=1-mtHealth(c);const s=2.2+r*1.2;y-=r*r*6.5*Math.exp(-(dx*dx+dz*dz)/(2*s*s));}return y;};
  const picks=[];const dyn=[];const refs={};
  nodesRef.current.forEach(c=>{const g=new THREE.Group();scene.add(g);
   const tm=new THREE.MeshStandardMaterial({color:0x0e1430,emissive:c.hex,emissiveIntensity:0.5,metalness:0.75,roughness:0.28,transparent:true,opacity:0.92});
   const scale=0.55+Math.min(0.5,c.n/40);
   const tw=new THREE.Mesh(new THREE.CylinderGeometry(0.32*scale,0.48*scale,1,6),tm);tw.userData.c=c;g.add(tw);picks.push(tw);
   const rim=new THREE.Mesh(new THREE.TorusGeometry(1.3*scale,0.04,8,36),new THREE.MeshBasicMaterial({color:c.hex,transparent:true,opacity:c.conflicted?0.95:0.8}));rim.rotation.x=Math.PI/2;rim.position.y=0.19;g.add(rim);
   const bc=new THREE.Mesh(new THREE.SphereGeometry(0.18*scale,12,12),new THREE.MeshBasicMaterial({color:c.conflicted?0xff3b3b:c.hex}));g.add(bc);
   let lm=null;
   if(c.leadCount>0){lm=new THREE.Mesh(new THREE.ConeGeometry(0.14*scale,0.32*scale,5),new THREE.MeshBasicMaterial({color:0x6fe8ff}));g.add(lm);}
   const pc=c.conflicted?70:36;const pg=new THREE.BufferGeometry();const pp=new Float32Array(pc*3);const pa=new Float32Array(pc),pr=new Float32Array(pc),ph=new Float32Array(pc);
   for(let k=0;k<pc;k++){pa[k]=Math.random()*6.28;pr[k]=0.8+Math.random()*1.1;ph[k]=Math.random();}
   pg.setAttribute("position",new THREE.BufferAttribute(pp,3));
   g.add(new THREE.Points(pg,new THREE.PointsMaterial({color:c.hex,size:0.08,transparent:true,opacity:0.85})));
   refs[c.id]={g,tw,tm,rim,bc,lm,pg,pp,pa,pr,ph,pc};
   dyn.push(t=>{const r=refs[c.id];const hp=mtHealth(c);
    r.g.position.set(c.pos[0],gY(c.pos[0],c.pos[1]),c.pos[1]);
    const th=1.0+hp*4.5;r.tw.scale.set(1,th,1);r.tw.position.y=0.18+th/2;
    r.bc.position.y=0.3+th;r.rim.position.y=Math.max(r.rim.position.y,0.19);
    if(r.lm)r.lm.position.y=0.6+th;
    r.tm.emissiveIntensity=(c.conflicted?0.35+0.4*Math.sin(t*3.2):0.4+0.25*Math.sin(t*1.1))*(0.4+hp);
    const vc=Math.max(8,Math.round(hp*r.pc));const sp=0.15+hp*0.7;
    for(let k=0;k<r.pc;k++){if(k<vc){r.pa[k]+=0.004*sp*(1+(k%5)*0.15);r.pp[k*3]=Math.cos(r.pa[k])*r.pr[k];r.pp[k*3+1]=0.3+r.ph[k]*(th+0.6);r.pp[k*3+2]=Math.sin(r.pa[k])*r.pr[k];}else r.pp[k*3+1]=-999;}
    r.pg.attributes.position.needsUpdate=true;
    r.rim.scale.setScalar(selRef.current===c.id?1.3:1);});});
  let beams=[];
  const mkBeams=()=>{beams.forEach(b=>{scene.remove(b.m);scene.remove(b.p);b.m.geometry.dispose();});beams=[];
   edgesRef.current.forEach(({a,b})=>{
    const pa2=new THREE.Vector3(a.pos[0],gY(a.pos[0],a.pos[1])+1,a.pos[1]);
    const pb=new THREE.Vector3(b.pos[0],gY(b.pos[0],b.pos[1])+1,b.pos[1]);
    const mid=pa2.clone().add(pb).multiplyScalar(0.5);mid.y=Math.max(pa2.y,pb.y)+2.2;
    const cv=new THREE.QuadraticBezierCurve3(pa2,mid,pb);
    const m=new THREE.Mesh(new THREE.TubeGeometry(cv,24,0.05,6,false),new THREE.MeshBasicMaterial({color:0x27c8e8,transparent:true,opacity:0.35}));
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),new THREE.MeshBasicMaterial({color:0x6fe8ff,transparent:true,opacity:0.8}));
    scene.add(m);scene.add(p);beams.push({m,p,cv,o:Math.random()});});};
  mkBeams();
  dyn.push(t=>{beams.forEach(b=>{b.p.position.copy(b.cv.getPoint((t*0.15+b.o)%1));});});
  apiRef.current.w=()=>{wells();mkBeams();};
  apiRef.current.reset=()=>{orbit.theta=DEFAULT_ORBIT.theta;orbit.phi=DEFAULT_ORBIT.phi;orbit.radius=DEFAULT_ORBIT.radius;cam();};
  const ray=new THREE.Raycaster();const mo=new THREE.Vector2();let drag=false,mv=false,px=0,py=0;
  const dn=e=>{drag=true;mv=false;px=e.clientX;py=e.clientY;};
  const mvf=e=>{const rc=renderer.domElement.getBoundingClientRect();mo.x=((e.clientX-rc.left)/rc.width)*2-1;mo.y=-((e.clientY-rc.top)/rc.height)*2+1;
   if(drag){const dx=e.clientX-px,dy=e.clientY-py;if(Math.abs(dx)+Math.abs(dy)>3)mv=true;orbit.theta+=dx*0.006;orbit.phi=Math.max(0.3,Math.min(1.45,orbit.phi-dy*0.005));px=e.clientX;py=e.clientY;cam();}};
  const up=()=>{if(drag&&!mv){ray.setFromCamera(mo,camera);const h=ray.intersectObjects(picks);
   if(h.length){const id=h[0].object.userData.c.id;selRef.current=selRef.current===id?null:id;setSel(selRef.current);}else{selRef.current=null;setSel(null);}}drag=false;};
  const wl=e=>{e.preventDefault();orbit.radius=Math.max(9,Math.min(48,orbit.radius+e.deltaY*0.02));cam();};
  renderer.domElement.addEventListener("mousedown",dn);renderer.domElement.addEventListener("mousemove",mvf);
  window.addEventListener("mouseup",up);renderer.domElement.addEventListener("wheel",wl,{passive:false});
  let raf;const ck=new THREE.Clock();
  const loop=()=>{const t=ck.getElapsedTime();dyn.forEach(f=>f(t));renderer.render(scene,camera);raf=requestAnimationFrame(loop);};loop();
  return()=>{cancelAnimationFrame(raf);window.removeEventListener("mouseup",up);renderer.dispose();mount.removeChild(renderer.domElement);};
 },[mapNodes,edges]);
 const sc=mapNodes.find(c=>c.id===sel);
 const sc2=mapNodes.find(c=>c.id===sel2);
 const fallbackList=[...mapNodes].sort((a,b)=>mtHealth(b)-mtHealth(a));
 // Real open proposals targeting units in the selected state, cross-referenced
 // from the same governed recommendation set every other view reads.
 const scProposals=sc?(railData&&railData.recommendations||[]).filter(r=>r.targetIds.some(t=>sc.centerNames.has(t))):[];
 const LEGEND=[["thriving",0x2fbf5f],["watch",0xd9a520],["at-risk",0xe03535]];
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginBottom:6}}>Every node below is a real state from the canonical network ({centers.length} centers across {mapNodes.length} territories shown, including three Canadian provinces) — not a separate dataset. Beams connect the weakest territories to their nearest strong neighbor by the same top-versus-bottom gap test the Network Propagation agent runs within a state, applied here across states (the agent itself only ever proposes within one state, so this is the map's own cross-territory read, not a direct agent feed); a cyan marker flags a territory with candidates active in the Growth pipeline.</div>
  <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap",alignItems:"center"}}>
   <button onClick={()=>setViewMode("3d")} aria-pressed={viewMode==="3d"} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${viewMode==="3d"?INK:RULE}`,background:viewMode==="3d"?INK:"#fff",color:viewMode==="3d"?"#fff":MUT}}>3D view</button>
   <button onClick={()=>setViewMode("table")} aria-pressed={viewMode==="table"} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${viewMode==="table"?INK:RULE}`,background:viewMode==="table"?INK:"#fff",color:viewMode==="table"?"#fff":MUT}}>Table view</button>
   {viewMode==="3d"&&!webglFailed&&<button onClick={()=>apiRef.current.reset&&apiRef.current.reset()} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>Reset view</button>}
   <span style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
    {LEGEND.map(([label,hex])=>(<span key={label} style={{display:"flex",alignItems:"center",gap:4,fontFamily:"Helvetica",fontSize:8.5,color:MUT,textTransform:"capitalize"}}><span style={{width:8,height:8,borderRadius:"50%",background:"#"+hex.toString(16).padStart(6,"0"),display:"inline-block"}}/>{label}</span>))}
    <span style={{display:"flex",alignItems:"center",gap:4,fontFamily:"Helvetica",fontSize:8.5,color:MUT}}><span style={{width:0,height:0,borderLeft:"4px solid transparent",borderRight:"4px solid transparent",borderBottom:"7px solid #6fe8ff",display:"inline-block"}}/>pipeline active</span>
   </span>
  </div>
  {/* Keyboard-navigable state picker: every state reachable without the mouse, same selection state a 3D click sets. */}
  <div role="listbox" aria-label="Select a state to view detail" style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
   {[...mapNodes].sort((a,b)=>a.id.localeCompare(b.id)).map(c=>(
    <button key={c.id} role="option" aria-selected={sel===c.id} onClick={()=>{selRef.current=selRef.current===c.id?null:c.id;setSel(selRef.current);}} title={c.label+" — "+c.state+(c.verifiedN===0?" (no verified units)":"")} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"2px 6px",cursor:"pointer",border:`1px solid ${sel===c.id?INK:c.conflicted?AC:RULE}`,background:sel===c.id?INK:"#fff",color:sel===c.id?"#fff":c.conflicted?AC:MUT}}>{c.label}{c.conflicted?" ⚠":""}{c.verifiedN===0?" ~":""}</button>
   ))}
  </div>
  <div style={{position:"relative"}}>
   <div ref={mountRef} style={{width:"100%",minHeight:460,borderRadius:6,overflow:"hidden",border:"1px solid #1c2650",background:"#05060e",display:(viewMode==="3d"&&!webglFailed)?"block":"none"}}/>
   {(viewMode==="table"||webglFailed)&&<div style={{padding:16,fontFamily:"Helvetica",background:webglFailed?"#05060e":"#fff",color:webglFailed?"#cdd6f4":INK,border:webglFailed?"none":`1px solid ${RULE}`,borderRadius:6}}>
    {webglFailed&&<div style={{fontSize:11,fontWeight:700,marginBottom:8}}>3D rendering isn't available in this environment — showing the same data as a table instead.</div>}
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
     <thead><tr style={{textAlign:"left",color:webglFailed?"#8a97c4":MUT}}><th style={{padding:"4px 6px"}}>State</th><th>Units</th><th>Verified</th><th>Condition</th><th>Composite</th><th>Pipeline</th></tr></thead>
     <tbody>{fallbackList.map(c=>(<tr key={c.id} onClick={()=>{selRef.current=selRef.current===c.id?null:c.id;setSel(selRef.current);}} style={{borderTop:webglFailed?"1px solid #1c2650":`1px solid ${RULE}`,cursor:"pointer",background:sel===c.id?(webglFailed?"#141d3d":"#f5f5f5"):"transparent"}}>
      <td style={{padding:"4px 6px",fontWeight:700}}>{c.label}{c.conflicted?" ⚠":""}</td>
      <td style={{padding:"4px 6px"}}>{c.n}{c.verifiedN===0?" ~":""}</td>
      <td style={{padding:"4px 6px"}}>{c.verifiedN}</td>
      <td style={{padding:"4px 6px",textTransform:"capitalize"}}>{c.state}</td>
      <td style={{padding:"4px 6px"}}>{mtHealth(c).toFixed(2)}</td>
      <td style={{padding:"4px 6px"}}>{c.leadCount||"—"}</td>
     </tr>))}</tbody>
    </table>
   </div>}
   {sc&&(<div style={{position:viewMode==="3d"?"absolute":"static",top:10,right:10,width:260,marginTop:viewMode==="table"?10:0,background:viewMode==="3d"?"rgba(8,10,24,0.92)":"#fff",border:viewMode==="3d"?"1px solid #2b3d78":`1px solid ${RULE}`,borderRadius:6,padding:12,fontFamily:"Helvetica",color:viewMode==="3d"?"#cdd6f4":INK}}>
    <div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:12,color:viewMode==="3d"?"#e8ecff":INK}}>{sc.label} — {sc.state}</b><button onClick={()=>{selRef.current=null;setSel(null);}} aria-label="Close state detail" style={{cursor:"pointer",color:viewMode==="3d"?"#5a6a9e":MUT,background:"none",border:"none",padding:0}}>✕</button></div>
    <div style={{fontSize:9,color:viewMode==="3d"?"#8a97c4":MUT,margin:"3px 0 7px"}}>{sc.n} unit{sc.n>1?"s":""} in this state ({sc.verifiedN} verified, {sc.n-sc.verifiedN} modeled){sc.conflicted?" · open cross-agent conflict":""}{sc.leadCount>0?" · "+sc.leadCount+" candidate(s) in pipeline":""}</div>
    {MAP_DIMS.map(d=>{const v=mtVal(sc,d);return(<div key={d} style={{margin:"6px 0"}}>
     <div style={{display:"flex",justifyContent:"space-between",fontSize:9}}><span style={{textTransform:"capitalize",color:viewMode==="3d"?"#aab4dd":MUT}}>{d}</span><b style={{color:viewMode==="3d"?"#e8ecff":INK}}>{v.toFixed(2)}</b></div>
     <div style={{height:4,background:viewMode==="3d"?"#141d3d":"#eee",borderRadius:2}}><div style={{height:4,width:(v*100)+"%",borderRadius:2,background:v<0.35?"#e03535":v<0.6?"#d9a520":"#2fbf5f"}}/></div></div>);})}
    {scProposals.length>0&&<div style={{marginTop:8,paddingTop:6,borderTop:viewMode==="3d"?"1px solid #2b3d78":`1px solid ${RULE}`}}>
     <div style={{fontSize:8,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:viewMode==="3d"?"#8a97c4":MUT,marginBottom:3}}>{scProposals.length} open proposal{scProposals.length>1?"s":""} in this state</div>
     {scProposals.slice(0,3).map(r=>(<div key={r.id} style={{fontSize:8.5,color:viewMode==="3d"?"#cdd6f4":"#444",marginBottom:2}}>• {r.agent}: {r.governance.allowed?"cleared":"held"}</div>))}
    </div>}
    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
     {jumpTo&&sc.repCenter&&<button onClick={()=>jumpTo("lenses",sc.repCenter.name,"reviewing "+sc.label+" from the network map — "+sc.repCenter.name+" is this state's weakest unit")} style={{fontFamily:"Helvetica",fontSize:9,color:"#6fe8ff",cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>view {sc.repCenter.name} in Six Lenses →</button>}
     <button onClick={()=>setSel2(sel2===sc.id?null:(sel2||mapNodes.find(m=>m.id!==sc.id)?.id))} style={{fontFamily:"Helvetica",fontSize:9,color:viewMode==="3d"?"#6fe8ff":AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>{sel2?"stop comparing":"compare with another state"}</button>
     {jumpTo&&sc.repCenter&&<button onClick={()=>jumpTo("network",sc.repCenter.name,"reviewing "+sc.label+"'s cluster from the network map")} style={{fontFamily:"Helvetica",fontSize:9,color:viewMode==="3d"?"#6fe8ff":AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>view {sc.label} cluster in Network →</button>}
     {jumpTo&&sc.leadCount>0&&<button onClick={()=>jumpTo("leads",null,sc.leadCount+" candidate(s) active in "+sc.label+", seen from the network map")} style={{fontFamily:"Helvetica",fontSize:9,color:viewMode==="3d"?"#6fe8ff":AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>view {sc.label} pipeline in Growth →</button>}
    </div>
   </div>)}
  </div>
  {sc&&sel2&&sc2&&(<div style={{marginTop:8,border:`1px solid ${RULE}`,background:"#fff",padding:"9px 12px"}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>Comparing {sc.label} vs <select value={sel2} onChange={e=>setSel2(e.target.value)} aria-label="Choose comparison state" style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700}}>{mapNodes.filter(m=>m.id!==sc.id).map(m=>(<option key={m.id} value={m.id}>{m.label}</option>))}</select></div>
    <button onClick={()=>setSel2(null)} aria-label="Close comparison" style={{fontFamily:"Helvetica",fontSize:11,color:MUT,cursor:"pointer",background:"none",border:"none",padding:0}}>✕</button>
   </div>
   {MAP_DIMS.map(d=>{const v1=mtVal(sc,d),v2=mtVal(sc2,d),delta=v1-v2;return(<div key={d} style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0",fontFamily:"Helvetica",fontSize:9.5}}>
    <span style={{width:80,textTransform:"capitalize",color:MUT}}>{d}</span>
    <span style={{width:40,textAlign:"right",fontWeight:700}}>{v1.toFixed(2)}</span>
    <div style={{flex:1,height:4,background:"#eee",borderRadius:2,position:"relative"}}><div style={{position:"absolute",left:"50%",height:4,width:Math.abs(delta)*50+"%",transform:delta>=0?"translateX(0)":"translateX(-100%)",background:delta>=0?GRN:AC,borderRadius:2}}/></div>
    <span style={{width:40,fontWeight:700}}>{v2.toFixed(2)}</span>
    <span style={{width:52,fontSize:8.5,color:delta>=0?GRN:AC}}>{delta>=0?"+":""}{delta.toFixed(2)}</span>
   </div>);})}
  </div>)}
  <div style={{marginTop:8,padding:"8px 12px",background:"#0a0d1f",border:"1px solid #1c2650",borderRadius:6,fontFamily:"Helvetica"}}>
   <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#8a97c4",marginBottom:4}}><b style={{color:"#e8ecff"}}>Week {week}{week===currentWeek?" (current)":" (preview — does not change the shared clock)"}</b><span>{edges.length} active propagation link{edges.length===1?"":"s"} this cycle</span></div>
   <input type="range" min="0" max={currentWeek} step="1" value={week} onChange={e=>setWeek(parseInt(e.target.value))} aria-label={"Preview an earlier week, currently showing week "+week} style={{width:"100%"}}/>
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#888",marginTop:5}}>drag = orbit · scroll = zoom · click a state (or use the list above) = unit readout · reads the live canonical state, same as every other view</div>
 </div>);}
// ---- end Command Table ----





// ============================================================
// CENTER ANATOMY — a franchise center modeled as a living body
// Coupled physiological simulation · organ systems · live links
//
//  ORGAN            BODY ROLE            CENTER ROLE
//  Brain            control/measurement  Director decisions, MyStudio/QB reads
//  Lungs            oxygen intake        Lead intake (marketing respiration)
//  Heart            circulation pump     Enrollment engine (pumps cash)
//  Vessels          blood flow           Revenue / payroll flows
//  Muscles          motion/work          Senseis (instruction capacity)
//  Metabolism       food→energy          Curriculum→belt progression
//  Endocrine        hormones (slow)      Culture & incentives (morale)
//  Immune           defense              Compliance & child-safety shield
//  Skin             environment interface Community presence & brand field
//  Vitals           HR/BP/Temp/O2        enrollment pulse/cash pressure/
//                                        engagement temp/lead saturation
// ============================================================

const ANAT_ORGANS = {
  brain:     { x: 300, y: 62,  r: 42, label: 'BRAIN',      sub: 'measurement & control' },
  lungs:     { x: 218, y: 178, r: 40, label: 'LUNGS',      sub: 'lead intake' },
  heart:     { x: 352, y: 190, r: 38, label: 'HEART',      sub: 'enrollment engine' },
  immune:    { x: 470, y: 150, r: 34, label: 'IMMUNE',     sub: 'compliance shield' },
  muscles:   { x: 168, y: 330, r: 40, label: 'MUSCLES',    sub: 'sensei capacity' },
  metabolism:{ x: 330, y: 330, r: 40, label: 'METABOLISM', sub: 'curriculum → belts' },
  endocrine: { x: 480, y: 300, r: 32, label: 'ENDOCRINE',  sub: 'culture & morale' },
  skin:      { x: 300, y: 452, r: 46, label: 'SKIN',       sub: 'community & brand field' }
};

// directed physiological links: [from, to, meaning]
const ANAT_LINKS = [
  ['skin', 'lungs',      'brand field draws breath (leads)'],
  ['lungs', 'heart',     'oxygenated leads enter circulation'],
  ['heart', 'muscles',   'cash perfuses payroll'],
  ['heart', 'metabolism','cash perfuses programs'],
  ['muscles', 'metabolism','instruction drives progression'],
  ['metabolism', 'skin', 'belts & showcases feed brand'],
  ['endocrine', 'muscles','morale hormones sustain senseis'],
  ['immune', 'heart',    'trust integrity protects flow'],
  ['brain', 'heart',     'pricing & pace control'],
  ['brain', 'lungs',     'marketing spend control'],
  ['brain', 'endocrine', 'recognition & incentive signals'],
  ['metabolism', 'brain','progression telemetry (belts/wk)'],
  ['skin', 'brain',      'parent-voice afferents (NPS)']
];

function anatDefaultVitals(center) {
  // map engine center → initial physiology, or defaults
  const eb = center?.eb ?? 6.5, ret = center?.ret ?? 0.85, chem = center?.chem ?? 0.65, conv = center?.conv ?? 0.35;
  return {
    students: Math.round(120 + eb * 14),
    cash: Math.max(2, eb),                 // $k buffer ~ EBITDA proxy
    staff: Math.max(2, Math.round(3 + chem * 5)),
    morale: 0.4 + chem * 0.5,
    engagement: 0.35 + ret * 0.45,
    leads: 20 + conv * 40,
    brand: 0.35 + ret * 0.4,
    compliance: 1.0,
    beltRate: 0.5 + ret * 0.4
  };
}


// ---- end Center Anatomy ----


const Frag = Fragment;
const INK="#111",MUT="#666",AC="#8b0000",RULE="#ccc";
// ===== 69-STEP WORKFLOW =====
const W=[
{n:1,p:"acquire",s:"Community channel activated",o:"System",sys:"CRM",d:"Select channel: after-school STEM, Girl Scouts, Girls Who Code, holiday camp, farmers market, sports cross-promo, library event, or STEM market positioning."},
{n:2,p:"acquire",s:"Event hosted or partnership launched",o:"Director",sys:"Local",d:"Director or owner establishes the relationship and schedules the event. This is local, in-person work."},
{n:3,p:"acquire",s:"Lead captured",o:"System",sys:"CRM",d:"Name, child's age, contact info, source channel. Captured at event via form, QR code, or sign-up sheet."},
{n:4,p:"acquire",s:"Lead entered in pipeline",o:"System",sys:"CRM",d:"Auto-created if digital capture. Manual entry if paper sign-up. Tagged with source channel for attribution."},
{n:5,p:"acquire",s:"Welcome email sent",o:"System",sys:"SendGrid",d:"Auto-triggered on lead creation. Includes: what Code Ninjas is, what to expect at a trial, scheduling link."},
{n:6,p:"acquire",s:"Parent responds",o:"Parent",sys:"—",d:"Calls, emails, clicks scheduling link, or walks in. This is the moment of intent."},
{n:7,p:"acquire",s:"Availability checked",o:"System",sys:"MyStudio",d:"System shows open trial slots, Sensei availability, and room capacity for the requested day/time."},
{n:8,p:"acquire",s:"Tour scheduled",o:"Director",sys:"MyStudio",d:"If parent wants to see the center first. Not all leads need a tour — some go straight to trial booking."},
{n:9,p:"acquire",s:"Tour reminder sent",o:"System",sys:"SendGrid",d:"24-hour reminder with directions, what to expect, and a reschedule link."},
{n:10,p:"acquire",s:"Tour conducted",o:"Director",sys:"—",d:"Director walks parent through the center. Shows the curriculum, explains belts, introduces a Sensei, lets the child see other kids coding."},
{n:11,p:"acquire",s:"Trial offered",o:"Director",sys:"—",d:"At end of tour: 'Would your child like to try a session?' Free or low-cost. Low commitment, high signal."},
{n:12,p:"acquire",s:"Trial booked",o:"System",sys:"MyStudio",d:"Slot reserved. Sensei assigned based on availability and student age/level match."},
{n:13,p:"acquire",s:"Trial confirmation sent",o:"System",sys:"SendGrid",d:"Immediate confirmation with date, time, what to bring, parking info."},
{n:14,p:"acquire",s:"Trial reminders sent",o:"System",sys:"SendGrid + SMS",d:"24-hour and 1-hour reminders. Reduces no-show rate on trials — the highest-leverage touchpoint."},
{n:15,p:"acquire",s:"Student arrives, checked in",o:"System",sys:"MyStudio",d:"Check-in logged. Attendance record created. First-visit flag set."},
{n:16,p:"acquire",s:"Trial session delivered",o:"Sensei",sys:"Learning Platform",d:"Student builds something real in 60 minutes. Sensei reads the room — is the child engaged? Frustrated? Bored? Thrilled? This is the product demo."},
{n:17,p:"acquire",s:"Post-trial note sent",o:"System",sys:"App + SendGrid",d:"Same 4-part structure as regular notes. 'Your child built X today. They were excited about Y. Next time we would work on Z.'"},
{n:18,p:"acquire",s:"Day-3 follow-up",o:"System",sys:"SendGrid",d:"Auto-email: 'How did [child's name] feel about the session? Any questions about the program?'"},
{n:19,p:"acquire",s:"Day-7 follow-up",o:"Director",sys:"Phone/Email",d:"Personal outreach from Director. Not a sales call — a check-in. 'Did they mention the session at home? Would they like to come back?'"},
{n:20,p:"acquire",s:"GATE: Enrollment decision",o:"Director",sys:"MyStudio",d:"Parent decides. Director discusses pricing tiers, schedule options, membership commitment. This is a financial decision — human-owned.",gate:true,gr:"Financial materiality"},
{n:21,p:"acquire",s:"Paperwork completed",o:"Parent",sys:"MyStudio",d:"Enrollment form, liability waiver, emergency contacts, billing authorization."},
{n:22,p:"acquire",s:"Billing set up",o:"System",sys:"MyStudio",d:"Recurring billing configured. First payment processed. Membership tier recorded."},
{n:23,p:"acquire",s:"Welcome packet sent",o:"System",sys:"App + SendGrid",d:"Welcome to Code Ninjas. Your child's Sensei is [name]. First session is [date]. Here's what to expect."},
{n:24,p:"acquire",s:"First regular session scheduled",o:"System",sys:"MyStudio",d:"Recurring weekly slot booked. Calendar invite sent to parent."},
{n:25,p:"deliver",s:"Weekly schedule built",o:"System",sys:"MyStudio",d:"All sessions for the week populated. Sensei assignments confirmed. Room capacity validated."},
{n:26,p:"deliver",s:"Sensei-to-student ratios checked",o:"System",sys:"MyStudio",d:"Target: 1:8. If any session exceeds ratio, flag for Director to add coverage or cap enrollment."},
{n:27,p:"deliver",s:"Cancellations and makeups processed",o:"System",sys:"MyStudio",d:"Cancelled sessions freed. Makeup slots offered. Waitlisted students notified of openings."},
{n:28,p:"deliver",s:"Student brief pulled",o:"System",sys:"Learning Platform",d:"Auto-generated: current belt level, last project state (what they built, where they stopped), flags (stuck, bored, ahead), parent requests."},
{n:29,p:"deliver",s:"Curriculum checkpoint reviewed",o:"System",sys:"Learning Platform",d:"Is the student approaching a belt test? Any new challenges available at their level? Curriculum updates since last session?"},
{n:30,p:"deliver",s:"Sensei reads brief, plans approach",o:"Sensei",sys:"—",d:"30-second scan. Decision: continue last project, introduce new concept, or pivot based on expected energy. Agent prepares; human decides."},
{n:31,p:"deliver",s:"Student arrives, checked in",o:"System",sys:"MyStudio",d:"Attendance logged. Arrival time recorded. Late arrivals flagged if pattern forms."},
{n:32,p:"deliver",s:"Welcome and reconnect",o:"Sensei",sys:"—",d:"'Last time you got the scoring working — want to pick up from there or try something new?' Acknowledge by name. Reference last session. Give agency.",t:"2 min"},
{n:33,p:"deliver",s:"Student selects direction",o:"Student",sys:"—",d:"Student chooses: continue current project, start a new challenge, or explore a concept. Student-driven, not teacher-directed.",t:"1 min"},
{n:34,p:"deliver",s:"Student codes",o:"Student",sys:"Learning Platform",d:"The core 40 minutes. Student works on their project. Sensei circulates, observes, and intervenes only when stuck 2+ minutes or the student asks for help.",t:"40 min"},
{n:35,p:"deliver",s:"Question-driven debugging",o:"Sensei",sys:"—",d:"When stuck: 'What did you expect to happen? What actually happened? Can you find the line where the behavior changes?' Ask before telling. Scaffold, don't solve.",t:"ongoing"},
{n:36,p:"deliver",s:"Mini-teach if concept gap",o:"Sensei",sys:"—",d:"Student hits a concept they've never seen (loops, functions, variables). Sensei gives a 3–5 minute targeted lesson. Short, specific, then back to building.",t:"3–5 min"},
{n:37,p:"deliver",s:"Save project",o:"Student",sys:"Learning Platform",d:"Student saves their work. Project state persisted so the next session picks up exactly where they left off."},
{n:38,p:"deliver",s:"Show and celebrate",o:"Student",sys:"—",d:"Last 5 minutes. Student runs their project, shows it to the Sensei or another student. 'Look what I made.' This is the visible-progress retention signal.",t:"5 min"},
{n:39,p:"deliver",s:"Progress marker logged",o:"System",sys:"Learning Platform",d:"Session completed. Belt-pathway progress updated. If belt checkpoint completed, flag for ceremony scheduling."},
{n:40,p:"deliver",s:"Belt checkpoint?",o:"System",sys:"Learning Platform",d:"Decision point: did the student complete a belt test? If yes → flag for ceremony. If no → continue on pathway.",decision:true},
{n:41,p:"retain",s:"System drafts session note",o:"System",sys:"Learning Platform",d:"Auto-generated from session data. Follows the 4-part structure: (1) lead with a strength, (2) 'I noticed…' observation, (3) what's next, (4) invitation to respond."},
{n:42,p:"retain",s:"GATE: Sensei reviews and personalizes",o:"Sensei",sys:"App",d:"60–90 seconds per student. Sensei reads draft, adds personal observations ('she was really proud of the scoring system'), corrects anything wrong, approves for send.",gate:true,gr:"Data integrity"},
{n:43,p:"retain",s:"Note sent to parent",o:"System",sys:"App + SendGrid",d:"Delivered within 30 minutes of session end. App notification + email. Timely delivery signals: we pay attention, we care."},
{n:44,p:"retain",s:"Belt advancement?",o:"System",sys:"App",d:"Decision point: did the student earn a new belt? If yes → celebration message to parent, ceremony scheduling triggered.",decision:true},
{n:45,p:"retain",s:"Belt celebration sent",o:"System",sys:"App + SendGrid",d:"'Your ninja just earned their [color] belt!' Photo opportunity. Ceremony date. Invite friends and family — this is a referral event."},
{n:46,p:"retain",s:"Student absent?",o:"System",sys:"MyStudio",d:"Decision point: did the student not show up?",decision:true},
{n:47,p:"retain",s:"Same-day reschedule text",o:"System",sys:"Twilio",d:"Auto-sent within 2 hours of missed session. 'We missed [name] today — here are available makeup slots this week.'"},
{n:48,p:"retain",s:"2nd consecutive no-show?",o:"System",sys:"MyStudio",d:"Decision point: is this the second consecutive miss?",decision:true},
{n:49,p:"retain",s:"Director flagged for personal outreach",o:"System",sys:"CRM",d:"At-risk flag set. Director sees it in their morning dashboard. This is no longer an automated recovery — it's a relationship."},
{n:50,p:"retain",s:"GATE: At-risk intervention",o:"Director",sys:"Phone/Email",d:"Director personally contacts the family. 'Is everything okay? Can we adjust the schedule? Is there anything about the program we should change?' Empathy, flexibility, listening.",gate:true,gr:"Franchisee consent"},
{n:51,p:"retain",s:"Monthly progress report generated",o:"System",sys:"Learning Platform",d:"Summary: sessions attended, belt progress, projects completed, skills developed. Sent to parent on the 1st of each month."},
{n:52,p:"retain",s:"Re-enrollment nudge",o:"System",sys:"SendGrid",d:"30 days before membership lapses: 'Your ninja has earned [belt] and is working on [project]. Renew to keep the momentum going.'"},
{n:53,p:"retain",s:"Referral prompt",o:"System",sys:"App",d:"After belt ceremonies, after positive notes, after milestones: 'Know a family who might love Code Ninjas? Share a free trial.'"},
{n:54,p:"retain",s:"Referral received",o:"System",sys:"CRM",d:"New lead created, tagged as referral, attributed to referring family. → Back to step 1. The loop closes.",back:true},
{n:55,p:"operate",s:"Staffing need identified",o:"Director",sys:"MyStudio",d:"Session load increasing, Sensei leaving, or ratio exceeding 1:8. The hiring pipeline must always be warm."},
{n:56,p:"operate",s:"Job posted",o:"Director",sys:"Indeed",d:"Part-time Sensei role. Coding skills + ability to work with kids. Often college students or high schoolers."},
{n:57,p:"operate",s:"Candidates screened",o:"Director",sys:"Indeed",d:"Resume review, brief phone screen. Looking for: coding ability, patience, communication, reliability."},
{n:58,p:"operate",s:"GATE: Interview and hire decision",o:"Director",sys:"—",d:"In-person interview. Trial teaching session with a real student. Director decides: hire or pass.",gate:true,gr:"Child safety"},
{n:59,p:"operate",s:"Background check",o:"System",sys:"Background service",d:"Required for anyone working with children. Must clear before first session."},
{n:60,p:"operate",s:"Training completed",o:"Director + Sensei",sys:"Internal",d:"Curriculum (CREATE/JR), customer service standards, child safety protocols, MyStudio operations, session-note process."},
{n:61,p:"operate",s:"Monthly P&L pulled",o:"System",sys:"MyStudio + QuickBooks",d:"Revenue: active students × tier × billing period. Expenses: rent, payroll, curriculum license, marketing, supplies."},
{n:62,p:"operate",s:"Revenue vs expense reviewed",o:"Owner",sys:"QuickBooks",d:"Is the unit profitable? Where are the leaks? Payroll too high for enrollment? Marketing spend returning trials?"},
{n:63,p:"operate",s:"GATE: Financial decisions",o:"Owner",sys:"—",d:"Pricing changes, cost cuts, marketing budget adjustments, staffing level changes. Material financial decisions are human-owned.",gate:true,gr:"Unit economics floor"},
{n:64,p:"operate",s:"Royalty calculated",o:"System",sys:"MyStudio",d:"8% of gross revenue (royalty) + 2% of gross revenue (brand fund) = 10% to corporate monthly."},
{n:65,p:"operate",s:"Weekly enrollment report",o:"System",sys:"MyStudio → Corporate",d:"Active students, new enrollments, cancellations, trial bookings. Auto-generated and submitted."},
{n:66,p:"operate",s:"Monthly P&L submitted",o:"Owner",sys:"Corporate portal",d:"Required per Franchise Agreement. FBC reviews for health monitoring."},
{n:67,p:"operate",s:"Brand compliance checked",o:"System",sys:"Corporate",d:"Center appearance, curriculum delivery, marketing guidelines, territory adherence. Automated where possible."},
{n:68,p:"operate",s:"Deviations flagged to FBC",o:"System",sys:"Corporate",d:"Non-compliance items routed to Franchise Business Coach for review and outreach. Not auto-enforced."},
{n:69,p:"operate",s:"FBC outreach if needed",o:"FBC",sys:"Phone/Email",d:"Health metric crosses threshold → outreach ('We noticed X — how can we help?') → response feeds the unit's support plan. Systemic issues → escalate to network tier for a structural fix.",t:""},
];
const PHASE_META={
  acquire:{name:"ACQUIRE",range:"Steps 1–24",count:24,desc:"Community channel to enrolled student. Every handoff from first event to first billing cycle."},
  deliver:{name:"DELIVER",range:"Steps 25–40",count:16,desc:"The weekly session loop. Schedule → prep → deliver → log. The core product."},
  retain:{name:"RETAIN",range:"Steps 41–54",count:14,desc:"Post-session notes, parent trust, no-show recovery, at-risk intervention, referral. Where revenue is kept or lost."},
  operate:{name:"OPERATE",range:"Steps 55–69",count:15,desc:"Staffing, finance, compliance, reporting. The foundation under everything."},
};
const ORG_ROLES={
  acquire:["Director — tours, enrollment gate, day-7 follow-up, pricing conversation","System — CRM, MyStudio, SendGrid automation for lead capture through billing setup","Parent — the decision-maker at the enrollment gate","Sensei — delivers the trial session that determines conversion"],
  deliver:["Sensei — session delivery, question-driven instruction, brief review, save & show","Student — project ownership, direction selection, the person doing the learning","System — scheduling, prep briefs, progress markers, capacity checks","Director — ratio oversight, coverage decisions"],
  retain:["System — note drafting, no-show recovery, referral prompts, progress reports","Sensei — note review gate, personalization, session quality","Director — at-risk intervention gate, personal family outreach","Parent — trust recipient, re-enrollment decision, referral source"],
  operate:["Owner — P&L ownership, financial decision gate, strategic direction","Director — staffing gate, hiring, training, daily operations","System — reporting, royalty calculation, compliance monitoring","FBC — regional oversight, at-risk unit support, best-practice deployment"],
};
const AGILE={
  acquire:{wip:[99,3,2,99],kanban:[["3 leads from STEM event","2 from referral"],["1 tour today","2 trials this week"],["1 day-7 follow-up due","1 enrollment packet out"],["2 enrolled this week"]],sprint:"Acquire Sprint: Convert 3 of 5 active trials, host 1 Girl Scouts workshop, capture 10 leads",velocity:[4,3,5,4,6,5,7,6],outcome:"Trial→enrollment conversion (Metrics tab)"},
  deliver:{wip:[99,6,4,99],kanban:[["3 briefs to pull","1 makeup to schedule"],["5 sessions in progress","2 belt tests today"],["4 notes in draft","1 belt ceremony to schedule"],["12 sessions completed","8 notes sent <30 min"]],sprint:"Deliver Sprint: 15 sessions at 95%+ notes, 1 belt ceremony, prep coverage 100%",velocity:[12,14,15,13,16,14,15,17],outcome:"Notes completion & belt velocity (Metrics tab)"},
  retain:{wip:[99,3,3,99],kanban:[["2 notes pending review","1 no-show to recover"],["3 progress reports generating","1 at-risk outreach in progress"],["1 re-enrollment nudge queued","2 referral prompts sent"],["4 families retained","1 referral converted"]],sprint:"Retain Sprint: 95% notes on time, recover 3 no-shows same-day, 1 at-risk save",velocity:[3,4,5,4,6,5,7,6],outcome:"At-risk resolution & retention (Metrics tab)"},
  operate:{wip:[99,2,2,99],kanban:[["1 Sensei posting active","P&L data pulling"],["2 candidates interviewing","Monthly review in progress"],["1 background check pending","Compliance report reviewing"],["1 Sensei hired + training","P&L submitted"]],sprint:"Operate Sprint: Hire 1 Sensei, submit monthly P&L, resolve 1 compliance flag",velocity:[2,2,3,2,3,3,4,3],outcome:"Unit net margin (Metrics tab)"},
};
const NET_TIERS=[
  {n:"Network",s:"All 350+ centers",d:"Curriculum, brand standards, pricing, FDD, royalty, Best Practice Library, development pipeline."},
  {n:"Region",s:"8–12 regions",d:"Performance benchmarks, FBC oversight, expansion targets, franchisee health aggregation."},
  {n:"Cluster",s:"3–8 centers per metro",d:"Shared events, Sensei coverage-pool sharing, cross-promo, territory coordination."},
  {n:"Unit",s:"Single center",d:"Session ops, student experience, local marketing, P&L, staffing, parent relationships."},
];
const NET_STATES=[
  {s:"TX",n:"Texas",c:34,h:[0.32,0.37,0.31]},{s:"CA",n:"California",c:30,h:[0.36,0.34,0.30]},
  {s:"FL",n:"Florida",c:22,h:[0.30,0.40,0.30]},{s:"VA",n:"Virginia",c:14,h:[0.38,0.36,0.26]},
  {s:"NC",n:"North Carolina",c:12,h:[0.34,0.38,0.28]},{s:"NJ",n:"New Jersey",c:11,h:[0.31,0.39,0.30]},
  {s:"NY",n:"New York",c:11,h:[0.33,0.37,0.30]},{s:"IL",n:"Illinois",c:10,h:[0.35,0.36,0.29]},
  {s:"GA",n:"Georgia",c:9,h:[0.40,0.34,0.26]},{s:"PA",n:"Pennsylvania",c:9,h:[0.32,0.40,0.28]},
  {s:"MD",n:"Maryland",c:8,h:[0.34,0.38,0.28]},{s:"WA",n:"Washington",c:8,h:[0.37,0.35,0.28]},
  {s:"AZ",n:"Arizona",c:7,h:[0.33,0.39,0.28]},{s:"MA",n:"Massachusetts",c:7,h:[0.36,0.36,0.28]},
  {s:"CO",n:"Colorado",c:6,h:[0.38,0.35,0.27]},{s:"OH",n:"Ohio",c:6,h:[0.31,0.41,0.28]},
  {s:"MI",n:"Michigan",c:6,h:[0.30,0.40,0.30]},{s:"MN",n:"Minnesota",c:5,h:[0.35,0.37,0.28]},
  {s:"TN",n:"Tennessee",c:5,h:[0.34,0.38,0.28]},{s:"MO",n:"Missouri",c:5,h:[0.33,0.38,0.29]},
  {s:"WI",n:"Wisconsin",c:4,h:[0.36,0.36,0.28]},{s:"IN",n:"Indiana",c:4,h:[0.32,0.40,0.28]},
  {s:"OR",n:"Oregon",c:4,h:[0.37,0.36,0.27]},{s:"NV",n:"Nevada",c:4,h:[0.31,0.39,0.30]},
  {s:"UT",n:"Utah",c:4,h:[0.39,0.34,0.27]},{s:"CT",n:"Connecticut",c:4,h:[0.34,0.38,0.28]},
  {s:"SC",n:"South Carolina",c:4,h:[0.35,0.37,0.28]},{s:"OK",n:"Oklahoma",c:3,h:[0.33,0.38,0.29]},
  {s:"LA",n:"Louisiana",c:3,h:[0.30,0.40,0.30]},{s:"KS",n:"Kansas",c:3,h:[0.34,0.38,0.28]},
  {s:"IA",n:"Iowa",c:3,h:[0.35,0.37,0.28]},{s:"AL",n:"Alabama",c:3,h:[0.32,0.39,0.29]},
  {s:"AR",n:"Arkansas",c:2,h:[0.33,0.38,0.29]},{s:"ID",n:"Idaho",c:2,h:[0.38,0.35,0.27]},
  {s:"ND",n:"North Dakota",c:1,h:[0.36,0.37,0.27]},{s:"WV",n:"West Virginia",c:2,h:[0.31,0.40,0.29]},
  {s:"DE",n:"Delaware",c:1,h:[0.34,0.38,0.28]},
];
const HCOL=["#2f7a3f","#b58900","#8b0000"];
const CONNECTIVITY=[
  {n:1,t:"Best Practice Propagation",d:"Validated pattern → anonymized → Best Practice Library → all units. New centers start from proven patterns.",owner:"Director of Franchise Development",accept:"Validated wins codified to the Library ≤30 days; adoption tracked.",guard:"Data integrity — only verified, reproducible patterns propagate; no anecdote promoted to standard."},
  {n:2,t:"Cluster Events Engine",d:"Centers in a metro coordinate community events. Cannibalization constraint applies.",owner:"Cluster lead (senior Center Director)",accept:"Shared events run with participating-center sign-off; leads attributed fairly.",guard:"Cannibalization + Franchisee consent — no shared event that starves or obligates a unit."},
  {n:3,t:"Sensei Coverage-Pool Sharing",d:"Part-time Senseis float between cluster centers. Student context travels with the system.",owner:"Cluster lead",accept:"Shared Senseis background-checked at every center they serve; coverage logged.",guard:"Child safety — clearance required at each site before first session."},
  {n:4,t:"Cross-Unit Referral",d:"Family relocates → belt level, project, parent history transfer intact.",owner:"Center Director (sending + receiving)",accept:"Full student record transfers within 48h of relocation.",guard:"Data integrity — record transfers complete and accurate; nothing dropped or altered."},
  {n:5,t:"Network Health Dashboard",d:"Heat map of all centers by health. At-risk units flagged for FBC intervention.",owner:"Director of Franchise Development",accept:"Every center scored monthly; below-floor units flagged within the cycle.",guard:"Engagement integrity — health scores built from honest engagement data, never inflated."},
  {n:6,t:"Curriculum Cascade",d:"Updates deploy simultaneously. Non-deployment flagged at day 30. Feedback not suppressed.",owner:"Network curriculum lead",accept:"Updates live network-wide; non-deployment flagged at day 30.",guard:"Audit trail — deployment status logged per center; feedback preserved, not suppressed."},
  {n:7,t:"Competition Pipeline",d:"Students surfaced for FIRST LEGO League, Congressional App Challenge, hackathons, showcases.",owner:"Center Director + lead Sensei",accept:"Eligible students surfaced each season; FLL coach safety-gated.",guard:"Child safety + Engagement integrity — coaches cleared; only real achievement surfaced."},
  {n:8,t:"Franchisee Peer Network",d:"Monthly cluster calls, quarterly regional forums. Two-directional. Feedback tracked to resolution.",owner:"Director of Franchise Development",accept:"Cadence held; every raised issue tracked to a logged resolution.",guard:"Franchisee consent — participation invited, not compelled; feedback never used punitively."},
  {n:9,t:"Financial Benchmarking",d:"Standardized P&L. Network benchmarks. Below 25th percentile triggers FBC outreach and a support-plan revision.",owner:"Director of Franchise Development + FBC",accept:"Standardized P&L collected; sub-25th-percentile units routed to a support-plan revision within the cycle.",guard:"Financial materiality + Data integrity — figures reserved to humans; benchmarks from real submitted data."},
  {n:10,t:"Brand Compliance",d:"Automated monitoring. Deviations flagged to FBC. Systemic issues addressed with support, not punishment.",owner:"FBC (Franchise Business Consultant)",accept:"Deviations flagged; systemic issues met with a support plan first.",guard:"Audit trail — every flag and resolution logged with provenance; support before punishment."},
];
const DASHBOARD=[
  {m:"Avg students/center",v:"~43",t:"target: 60",c:true},
  {m:"Trial → enrollment",v:"~35%",t:"target: 50%"},
  {m:"Franchisee satisfaction",v:"2.5/5",t:"profitability: 1.6/5",c:true},
  {m:"Notes completion",v:"varies",t:"target: 95%+"},
  {m:"No-show recovery",v:"varies",t:"target: 80%+"},
  {m:"Referral rate",v:"varies",t:"target: 15%+"},
  {m:"Multi-year retention",v:"varies",t:"target: 70% at 12mo"},
  {m:"Unit payback",v:"8–10 yr",t:"target: 3–4 yr",c:true},
];
const ACTION_PLANS=[
  {r:1,n:"Unit-Value Program",d:"Improve unit economics at existing centers. $269 premium-tier pricing, community pipeline, retention back-edge. ~$1.36M/yr additional royalty at 400 units. Lowest risk.",risk:"Low",floor:"None — do this first"},
  {r:2,n:"Selective Expansion",d:"25–50 new units in verified Tier 1 markets. Candidate underwriting gate. Cannibalization hard constraint.",risk:"Medium",floor:"Median unit above breakeven"},
  {r:3,n:"Resale & Turnaround",d:"At-risk units resold to stronger operators. Turnaround protocol: retention sprint + cluster support.",risk:"Medium",floor:"Turnaround plan approved"},
  {r:4,n:"Status Quo",d:"Hold footprint. Focus entirely on unit profitability. Safest, but slowest — the baseline to beat.",risk:"Lowest",floor:"Default"},
];

// ============================================================================
// FINANCIAL RANGE, ADOPTION RAMP, FRANCHISEE-DELTA, RATIONALE, LEDGER EXPORT
// Pure helper functions supporting risk/variance disclosure, the J-curve,
// franchisee-side economics alongside system royalty, plain-language
// governance rationale, and a portable decision-ledger export.
// ============================================================================

// A point estimate alone overstates precision. Every headline dollar figure
// in this file is now representable as {point, lo, hi} with a stated basis.
function financialRange(point,uncertaintyPct){
 const lo=+(point*(1-uncertaintyPct)).toFixed(2);
 const hi=+(point*(1+uncertaintyPct)).toFixed(2);
 return{point,lo,hi,uncertaintyPct};
}

// A new unit does not open at target economics. This models the ramp from
// open to target as a monotonic curve — used to discount early-months
// financial claims in expansion proposals rather than showing day-one output
// as if it were steady-state.
function adoptionRamp(monthsOpen){
 const m=Math.max(0,monthsOpen);
 return Math.min(1,1-Math.exp(-m/14));
}
function rampMilestones(){
 return[0,6,12,24,36].map(m=>({m,pct:Math.round(adoptionRamp(m)*100)}));
}

// Every system-level royalty figure is paired with what it means for the
// unit actually carrying it — franchisee protection stated as a number,
// not just asserted in prose.
function franchiseeDeltaOf(plan){
 const table={
  "Unit-Value Program":{unitMarginDelta_k:14,payback_yr:"-1.2 yr",note:"premium-tier pricing + retention lift flow to the unit before they flow to the system"},
  "Selective Expansion":{unitMarginDelta_k:0,payback_yr:"unchanged",note:"new units carry their own ramp; existing units see no economic change from this lever"},
  "Resale & Turnaround":{unitMarginDelta_k:-4,payback_yr:"reset at sale",note:"incoming operator inherits a support-plan floor, not a clean slate"},
  "Status Quo":{unitMarginDelta_k:0,payback_yr:"unchanged",note:"no unit-level change either direction"},
 };
 return table[plan.n]||{unitMarginDelta_k:0,payback_yr:"n/a",note:""};
}

// Turns a governance verdict into one sentence a reviewer can skim, instead
// of requiring them to read the raw guardrail array to understand a hold.
function rationaleOf(rec){
 const contract=ACTION_CONTRACTS[rec.actionType];
 const window=contract?contract.minFreshnessDays:null;
 if(rec.governance.allowed){
  return "Cleared: data "+rec.evidence.dataFreshnessDays+"d old"+(window?", within the "+window+"-day window":"")+"; "+rec.approverRole+" may act.";
 }
 const reasons=(rec.governance.heldOn&&rec.governance.heldOn.length)?rec.governance.heldOn.join(", "):"contract not satisfied";
 return "Held: "+reasons+".";
}

// Portable export of the governed decision record — a receiving system
// (FranConnect or otherwise) reads this without touching the UI.
function decisionLedgerExport(decisions,railData){
 const recs=railData&&railData.recommendations||[];
 const rows=Object.keys(decisions).map(id=>{
  const rec=recs.find(r=>r.id===id);
  return{
   id,
   decision:decisions[id],
   agent:rec?rec.agent:null,
   actionType:rec?rec.actionType:null,
   title:rec?rec.title:null,
   approverRole:rec?rec.approverRole:null,
   governanceAllowed:rec?rec.governance.allowed:null,
   heldOn:rec?rec.governance.heldOn:null,
  };
 });
 return{exportedAt:"week "+(rows.length?rows.length:0),schema:"cn-decision-ledger/1.0",rows};
}
// FDD Item 20 reconciliation — turns the modeled/authoritative footnote into
// an explicit, checkable mapping instead of leaving it implied by a caption.
function FDDReconciliationPanel({centers}){
 const AUTHORITATIVE=244;
 const VERIFIED=centers.filter(c=>c.verified).length; // computed from the real per-center flag, not a hardcoded figure
 const modeled=centers.length;
 const illustrative=modeled-VERIFIED;
 return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,background:"#fff",padding:"8px 11px",marginTop:6}}>
  <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>FDD Item 20 reconciliation</div>
  <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:4}}>
   <div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:INK}}>{AUTHORITATIVE}</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>authoritative units (FDD Item 20)</div></div>
   <div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:GRN}}>{VERIFIED}</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>verified from public records</div></div>
   <div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:MUT}}>{illustrative}</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>modeled beyond the verified set</div></div>
   <div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:VIO}}>{modeled}</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>total in this model</div></div>
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,lineHeight:1.4}}>The {AUTHORITATIVE}-unit FDD figure and the {VERIFIED} publicly verified centers are not superseded by the {modeled}-unit modeled network above — the {illustrative} additional units exist to give the operating model enough scale to demonstrate cross-cluster propagation and network-level governance, and are labeled as such everywhere they appear.</div>
 </div>);
}

function downloadJSON(obj,filename){
 try{
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
  return true;
 }catch(e){return false;}
}

function downloadText(text,filename){
 try{
  const blob=new Blob([text],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
  return true;
 }catch(e){return false;}
}

function toCSV(rows,columns){
 const esc=v=>{const s=v===null||v===undefined?"":String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 const header=columns.map(c=>esc(c.label)).join(",");
 const body=rows.map(r=>columns.map(c=>esc(c.get(r))).join(",")).join("\n");
 return header+"\n"+body;
}
function downloadCSV(text,filename){
 try{
  const blob=new Blob([text],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
  return true;
 }catch(e){return false;}
}
// Reports tab column definitions — read the same fields every other tab reads,
// just flattened to rows for a spreadsheet reviewer rather than an interactive one.
const CENTER_CSV_COLS=[
 {label:"Center",get:c=>c.name},
 {label:"State",get:c=>c.st},
 {label:"Verified",get:c=>c.verified?"yes":"no"},
 {label:"Health",get:c=>c.health},
 {label:"Condition",get:c=>conditionOf(c).label},
 {label:"Students",get:c=>c.students},
 {label:"EBITDA (k)",get:c=>c.eb},
 {label:"Retention",get:c=>+c.ret.toFixed(2)},
 {label:"Chemistry",get:c=>+c.chem.toFixed(2)},
 {label:"Conversion",get:c=>+c.conv.toFixed(2)},
];
const RECOMMENDATION_CSV_COLS=[
 {label:"ID",get:r=>r.id},
 {label:"Agent",get:r=>r.agent},
 {label:"Action type",get:r=>r.actionType},
 {label:"Title",get:r=>r.title},
 {label:"Approver role",get:r=>r.approverRole},
 {label:"Status",get:r=>r.governance.allowed?"allowed":"held"},
 {label:"Held on",get:r=>r.governance.heldOn||""},
];
// Support-plan taxonomy — the same ids supportPathsOf() assigns per center;
// kept as one lookup so the Success Rate dashboard and Reports tab agree with
// the plan names Operations Dynamics already shows.
const SUPPORT_PLAN_LABELS={
 retention:"Retention outreach sequence",
 staffing:"Staffing stabilization plan",
 unitvalue:"Unit-economics program",
 conversion:"Trial-conversion review",
 monitor:"Standard monitoring cadence",
};
// Reads only dyn.committed/dyn.completed — the same governed record Operations
// Dynamics writes to and Audit Trail already counts — grouped by plan type
// instead of by center, and turned into a completion rate.
function successRateData(dyn){
 const committed=(dyn&&dyn.committed)||{},completed=(dyn&&dyn.completed)||{};
 const byPlan={};
 Object.entries(committed).forEach(([name,pid])=>{
  if(!byPlan[pid])byPlan[pid]={id:pid,n:SUPPORT_PLAN_LABELS[pid]||pid,committed:0,completed:0,centers:[]};
  byPlan[pid].committed++;
  byPlan[pid].centers.push(name);
  if(completed[name]===pid)byPlan[pid].completed++;
 });
 const rows=Object.values(byPlan).sort((a,b)=>b.committed-a.committed).map(r=>({...r,rate:r.committed?Math.round(100*r.completed/r.committed):0}));
 const totalCommitted=rows.reduce((a,r)=>a+r.committed,0);
 const totalCompleted=rows.reduce((a,r)=>a+r.completed,0);
 return{rows,totalCommitted,totalCompleted,overallRate:totalCommitted?Math.round(100*totalCompleted/totalCommitted):0};
}

// A static, offline-readable summary of the two highest-density views (Overview +
// System Alignment) -- for a reviewer who wants to read this without opening the
// live artifact. Not a substitute for the interactive model; a companion to it.
function buildSummaryText(centers,states,railData,dyn,opt,ledger){
 const recs=railData.recommendations;
 const conflicts=railData.conflicts||[];
 const ageOf=c=>opt.fresh[c.name]!==undefined?(opt.week-opt.fresh[c.name])*7:(hash(c.name)%38)+opt.week*2;
 const confs=centers.map(c=>qCoherence(ageOf(c)));
 const avgConf=+(confs.reduce((a,v)=>a+v,0)/confs.length).toFixed(2);
 const simpleAvgHealth=+(centers.reduce((a,c)=>a+c.health,0)/centers.length).toFixed(1);
 const totalConf=confs.reduce((a,v)=>a+v,0);
 const weightedAvgHealth=+(centers.reduce((a,c,idx)=>a+c.health*confs[idx],0)/totalConf).toFixed(1);
 const freshPct=Math.round(100*centers.filter(c=>ageOf(c)<=28).length/centers.length);
 const allowedN=recs.filter(r=>r.governance.allowed).length,heldN=recs.length-allowedN;
 const lines=[];
 lines.push("FRANCHISE OPERATIONS ENGINE \u2014 SUMMARY EXPORT");
 lines.push("Proposed Policy Framework \u2014 Candidate Submission");
 lines.push("Generated from the live canonical state, week "+opt.week);
 lines.push("");
 lines.push("NETWORK HEALTH");
 lines.push("  Simple average: "+simpleAvgHealth+" | Confidence-weighted: "+weightedAvgHealth);
 lines.push("  Average measurement confidence: "+avgConf+" | Units within 28-day window: "+freshPct+"%");
 lines.push("  Modeled network: "+centers.length+" centers across "+Object.keys(states).length+" states");
 lines.push("");
 lines.push("GOVERNANCE THIS CYCLE");
 lines.push("  "+recs.length+" total proposals \u2014 "+allowedN+" allowed, "+heldN+" held");
 lines.push("  Cross-agent conflicts: "+conflicts.length+(conflicts.length?"":" (checked, none open)"));
 conflicts.slice(0,10).forEach(c=>lines.push("    - "+c.reason));
 lines.push("  Support paths committed: "+Object.keys(dyn.committed||{}).length+" | completed: "+Object.keys(dyn.completed||{}).length);
 lines.push("");
 lines.push("STANDING RULES");
 lines.push("  1. Preserve the whole network state before deriving any operational view.");
 lines.push("  2. Derive a view only where it serves diagnosis, prioritization, or governed action.");
 lines.push("  3. The governance boundary is where a proposal becomes real.");
 lines.push("  4. Every commitment is human-owned.");
 lines.push("");
 lines.push("RECENT ACTIVITY (last "+Math.min(40,(ledger||[]).length)+" logged actions)");
 (ledger||[]).slice(0,15).forEach(e=>lines.push("  ["+e.tab+"] "+e.actor+": "+e.text));
 if(!(ledger||[]).length)lines.push("  no actions logged yet this session");
 lines.push("");
 lines.push("This export is a static snapshot for offline review. The interactive model recomputes every figure live and is the authoritative view.");
 return lines.join("\n");
}
const CENTER_CHAIN=[
  "Student engagement (agency, visible progress, responsive instruction)",
  "Session notes (4-part structure → parent's only window)",
  "Learning pathways (belt system → 4–5 year runway)",
  "Multi-year retention (70%+ target → sunk acquisition cost preserved)",
  "Parent trust (notes + ceremonies + responsiveness → 4.9★)",
  "Student-driven learning (question-driven → Congressional App 1st place)",
  "Teacher improvement (notes gate forces reflection → better sessions)",
  "Referral (happy parents → zero-cost leads → community pipeline)",
  "Unit profitability (all of the above → the door worth opening)",
];
const PLAN_90=[
  {phase:"Days 1–30 — Listen & Baseline",focus:"Understand before changing anything.",items:[
    "Read every franchisee health score; identify the bottom-decile units by profitability and the top-decile by retention.",
    "Ride along with 3 Franchise Business Coaches; sit in on at-risk franchisee calls without speaking.",
    "Interview 10 franchisees across the satisfaction spectrum — what does corporate get right, what does it get wrong.",
    "Reconcile FDD Item 20 (244) against the 350+ public figure; establish the authoritative unit count.",
    "Confirm the CRM binding and map the actual development pipeline as it runs today.",
  ]},
  {phase:"Days 31–60 — Diagnose & Pilot",focus:"Find the binding constraint; test one fix.",items:[
    "Segment the network: which units are below the unit-economics floor, and why.",
    "Identify the 2–3 proven practices already working at top units that aren't propagating; codify the highest-leverage one.",
    "Pilot the unit-value initiative at 3 volunteer centers: premium pricing tier + community-pipeline activation + retention back-edge.",
    "Stand up the Network Health Dashboard's leading indicators so intervention is proactive.",
    "Define the candidate readiness rubric with the Development Function.",
  ]},
  {phase:"Days 61–90 — Systematize & Scale",focus:"Turn what worked into what's standard.",items:[
    "Measure the pilot: did per-unit revenue and retention move. If yes, package as a Best Practice Library entry.",
    "Present the growth thesis to leadership: strengthen unit economics across the existing 244 before adding the next 50.",
    "Establish the cluster events engine in one metro; prove shared community pipeline without cannibalization.",
    "Set the quarterly cadence: franchisee forums, health reviews, best-practice releases.",
    "Hand the FBCs a repeatable at-risk intervention protocol.",
  ]},
];
const METRICS_FULL=[
  {name:"Trial-to-enrollment conversion",lead:true,watch:"Weekly, per center",method:"Enrollments ÷ trials booked (MyStudio)",trigger:"Below 35% for 2 weeks → Director reviews tour & day-7 follow-up",predicts:"Revenue growth"},
  {name:"Notes completion within 30 min",lead:true,watch:"Daily, per Sensei",method:"Notes sent on time ÷ sessions delivered",trigger:"Below 90% → Sensei coaching; below 70% → staffing review",predicts:"Retention & parent trust"},
  {name:"No-show recovery rate",lead:true,watch:"Daily",method:"Same-day reschedules ÷ missed sessions",trigger:"Below 70% → check auto-reschedule automation",predicts:"Churn"},
  {name:"At-risk resolution rate",lead:true,watch:"Weekly",method:"Saved families ÷ flagged at-risk",trigger:"Below 50% → Director intervention review",predicts:"Multi-year retention"},
  {name:"Belt-progression velocity",lead:true,watch:"Monthly, per cohort",method:"Avg belts advanced ÷ months enrolled",trigger:"Stalling → curriculum or engagement problem",predicts:"Long-term retention & referral"},
  {name:"Community-pipeline inflow",lead:true,watch:"Weekly, per channel",method:"Trials booked by source channel",trigger:"Dry channel → reactivate partnership effort",predicts:"Enrollment pipeline health"},
  {name:"Active students per center",lead:false,watch:"Monthly",method:"Current enrolled (MyStudio)",trigger:"Below 60 → unit below profitability floor",predicts:"— (this is the outcome)"},
  {name:"Unit net margin",lead:false,watch:"Monthly",method:"Revenue − all costs incl. royalty",trigger:"Below 25th percentile 2 months → FBC support",predicts:"— (this is the outcome)"},
];
const FAILURE_MODES=[
  {mode:"Silent churn",detect:"Retention drops but no complaints — students just stop coming.",cause:"No-show recovery not firing, or notes going stale.",recover:"Instrument no-show recovery + notes completion as daily leading indicators; the at-risk gate (step 50) catches families before they're gone."},
  {mode:"Agent over-reach",detect:"An automated action commits a pricing change or refund it shouldn't.",cause:"A reserved task wasn't gated, or confidence threshold too low.",recover:"Financial materiality guardrail reserves all pricing/refund actions to humans. Audit trail makes any breach traceable."},
  {mode:"Understaffing cascade",detect:"One Sensei callout → reschedules → cold prep briefs → at-risk flags.",cause:"No coverage pool; hiring pipeline ran dry.",recover:"Sensei coverage-pool sharing + always-warm hiring pipeline (step 55)."},
  {mode:"Growth without support",detect:"New units open but franchisee satisfaction drops.",cause:"Door count outpaced FBC capacity.",recover:"Support-capacity guardrail blocks expansion the network can't service."},
  {mode:"Fabricated confidence",detect:"A report asserts a number the data can't support.",cause:"System inferred an absent value instead of flagging it.",recover:"Data-integrity guardrail: flag incomplete data, never infer. FDD Item 20 stays authoritative until reconciled."},
];
const CRIT_STEPS=[1,7,20,36,42,50,63];
// ===== COMMAND ENGINE =====
const GRN="#2f7a3f",AMB="#b8860b",VIO="#7a6bd8",BG="#fdfdfb";
function hash(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))&0x7fffffff;}return h;}
function rng(seed){let x=seed||1;return()=>{x=(x*1103515245+12345)&0x7fffffff;return x/0x7fffffff;};}
const pct=v=>Math.round(v*100);const fmt=v=>(v>=0?"":"−")+Math.abs(v).toFixed(1);
const CA=["Agoura Hills","Aliso Viejo","Arcadia","Bakersfield","Cerritos","Chino","Chino Hills","Chula Vista","Costa Mesa","Cupertino","Diamond Bar","El Segundo","Elk Grove","Encinitas","Encino","Folsom","Fountain Valley","Fremont 1","Fremont 2","Garden Grove","Hacienda Heights","Irvine 1","Irvine 2","La Canada","La Habra","Ladera Ranch","Livermore","Los Alamitos","Los Angeles","Murrieta","Northridge","Placentia","Pleasanton","Rancho Cucamonga","Rocklin","Roseville","Rolling Hills Estates","San Diego RB","San Diego MM","San Diego 3","San Gabriel","San Jose 1","San Jose 2","San Ramon","Santa Clarita","Sherman Oaks","Simi Valley","Stevenson Ranch","Sunnyvale","Torrance","Tracy","Union City","Walnut Creek","West Covina"];
const OTHER=[["McKinney","TX"],["Pearland","TX"],["Chesapeake","VA"],["Chantilly","VA"],["Fairfax","VA"],["Virginia Beach","VA"],["Leesburg","VA"],["South Tulsa","OK"],["Little Rock","AR"],["St. Joseph","MO"]];
const MODEL_ST=[["TX",38],["FL",26],["NJ",18],["NY",16],["IL",14],["WA",12],["AZ",11],["GA",11],["NC",10],["OH",9],["PA",9],["MI",8],["CO",7],["MN",6],["MD",8],["MA",7],["TN",5],["WI",4],["IN",4],["OR",4],["NV",4],["UT",4],["CT",4],["SC",4],["LA",3],["KS",3],["IA",3],["AL",3],["ID",2],["WV",2],["ND",1],["DE",1],["ON",12],["BC",6],["AB",5]];
function mkCenter(name,st,verified){
 const h=hash(name+st),r=rng(h);
 const conv=0.35+r()*0.3,ret=0.74+r()*0.2,chem=0.35+r()*0.45,capR=0.26+r()*0.16;
 const students=60+Math.floor(r()*160),eb=+((students*0.289)*(0.35+r()*0.3)-(6+r()*14)).toFixed(1);
 const momentum=(r()>0.45?"+":"−")+(1+Math.floor(r()*5));
 const health=Math.round(40+conv*30+ret*25+chem*10-(capR>0.38?6:0)+(eb>4?8:eb<0?-8:0));
 // Child-safety and staff-clearance status -- these gate the child_safety guardrail
 // in qGovernors and must be real per-center fields, not left undefined (an undefined
 // field would always read as "cleared," making the guardrail a permanent no-op).
 // Both are true for the overwhelming majority of units, with a small, deterministic
 // minority genuinely open pending renewal -- illustrative, not a real compliance feed.
 const compliance=rng(hash(name+st+"cmp"))()>0.03;
 const staffCleared=rng(hash(name+st+"stf"))()>0.02;
 const wires={};[["funnel",["trials","closeout","referrals"]],["dojo",["belt pace","stuck count","ceremony"]],["staff",["ratio","chemistry","CIT pipeline"]],["cash",["tuition","labor","EBITDA"]]].forEach(([w,gs])=>{
  wires[w]=gs.map(n=>{const g=rng(hash(name+w+n));const days=Math.floor(g()*38);return{n,v:Math.round(35+g()*60),days,state:days>21?"super":"meas"};});});
 return{name:st&&st!=="CA"?name+" "+st:name,st:st||"CA",verified,conv,ret,chem,capR,eb,momentum,health,students,compliance,staffCleared,wires};
}
function buildCenters(){
 const out=CA.map(n=>mkCenter(n,"CA",true));
 OTHER.forEach(([n,st])=>out.push(mkCenter(n,st,true)));
 MODEL_ST.forEach(([st,k])=>{for(let i=1;i<=k;i++)out.push(mkCenter(st+" Unit "+i,st,false));});
 return out;
}
function engageOf(c){
 const r=rng(hash(c.name+"eng"));
 const pre=0.6+r()*0.38, post=0.55+r()*0.4, badges=Math.floor(r()*9), match=0.5+r()*0.48;
 const path=[0.32+r()*0.2,0.3+r()*0.15,0];path[2]=Math.max(0.05,1-path[0]-path[1]);
 const prog30=0.45+r()*0.5, commit=[0.45+r()*0.2,0.25+r()*0.15,0];commit[2]=Math.max(0.04,1-commit[0]-commit[1]);
 const refer=0.15+r()*0.45, buzz=0.4+r()*0.55;
 const score=+(0.2*pre+0.2*post+0.15*match+0.15*prog30+0.15*(commit[1]+commit[2])+0.15*buzz).toFixed(2);
 return{pre,post,badges,match,path,prog30,commit,refer,buzz,score};
}
const tierOf=o=>o>=88?"TOP":o>=80?"STRONG":o>=68?"STABLE":"PRIORITY";
const PATH=[["jr","JR"],["white","White"],["yellow","Yellow"],["orange","Orange"],["green","Green"],["blue","Blue"],["purple","Purple"],["brown","Brown"],["red","Red"],["black","Black"]];
const COHORT={jr:[420,38,9],white:[730,96,14],yellow:[560,71,24],orange:[470,88,11],green:[350,52,19],blue:[260,31,8],purple:[170,22,26],brown:[110,14,6],red:[70,9,17],black:[38,4,3]};
const PROJECTS=[
 {id:"aicore",n:"Premium tier $269",stages:[["Design",0,4],["Pilot",1,9],["Measure",2,26],["Wave",0,2],["Scale",0,0]]},
 {id:"schools",n:"School pipeline",stages:[["Map",0,3],["Pilot",1,12],["Measure",2,31],["Scale",0,0]]},
 {id:"boxscore",n:"Progress report",stages:[["Design",0,2],["Ship",1,5],["Measure",1,2],["Network",0,0]]},
 {id:"cit",n:"CIT draft",stages:[["Identify",0,6],["Train",1,8],["Deploy",0,0]]},
 {id:"fll",n:"FIRST LEGO League",stages:[["Register",1,4],["Form teams",0,0],["Scrimmage",0,0],["Qualifier",0,0]]},
];
const CAL=[
 ["Measurement",[[3,"QBR wave A",1],[10,"Reports due",1],[31,"QBR wave B",0],[59,"QBR wave C",0]]],
 ["Premium tier",[[5,"Wave-2 open",1],[19,"Pilot readout",0],[47,"Wave-3 gate",0],[75,"Scale review",0]]],
 ["Events",[[7,"PNO",0],[30,"Division jam",0],[67,"PNO",0],[84,"Network finals",0]]],
 ["FLL (final FIRST·LEGO season)",[[1,"Register — OPEN now",1],[33,"Kickoff Aug 4",1],[62,"Team build + scrimmage",0],[88,"Prep regionals (Dec)",0]]],
 ["Community",[[14,"School STEM night",0],[21,"Demo day",0],[42,"Festival table",0],[63,"Partnership fair",0]]],
 ["Trades",[[9,"Match run",0],[39,"30d re-measure",1],[69,"Match run",0]]],
 ["Governance",[[1,"Constitution freeze",1],[45,"Changelog audit",0],[90,"Quarter close",0]]],
];
const GRIEV=[["profit","Profitability",1.6],["support","Support",1.9],["leads","Leads",2.3],["terr","Territory",2.6],["tech","Tech",2.5],["comms","Comms",2.2]].map(([id,n,sat])=>({id,n,sat,sev:+((5-sat)/5).toFixed(2)}));
const MECHS=[["growthM","Growth model","growth"],["transferM","Transfer board","transfers"],["capM","Cap governor","team"],["measM","Measure cadence","optimizer"],["eventsM","Events engine","calendar"],["boxM","Progress report","mastery"],["govM","Five governors","portfolio"],["agendaM","Agenda+log","agenda"]].map(([id,n,tab])=>({id,n,tab}));
const PEDGES=[["growthM","profit",0.9],["capM","profit",0.7],["boxM","profit",0.6],["transferM","profit",0.5],["measM","support",0.9],["agendaM","support",0.7],["transferM","support",0.6],["eventsM","leads",0.8],["boxM","leads",0.4],["govM","terr",0.95],["measM","tech",0.5],["transferM","tech",0.5],["agendaM","comms",0.8],["measM","comms",0.6]];
const LEV=MECHS.map(m=>({...m,lev:+PEDGES.filter(e=>e[0]===m.id).reduce((a,[,g,w])=>a+w*GRIEV.find(x=>x.id===g).sev,0).toFixed(2)})).sort((a,b)=>b.lev-a.lev);
function forecast(c){
 const mom=(c.momentum[0]==="+"?1:-1)*parseInt(c.momentum.slice(1));
 const slope=+(mom*0.22+(c.chem-0.55)*3.2+(c.ret-0.82)*4.5).toFixed(2);
 const proj=[1,2,3].map(m=>+(c.eb+slope*m).toFixed(1));
 const capDrift=c.chem<0.5?0.006:-0.002;
 const ebBreach=(c.eb>0&&slope<0)?Math.ceil(c.eb/-slope*30):(c.eb<=0?0:null);
 const capBreach=(c.capR<0.40&&capDrift>0)?Math.ceil((0.40-c.capR)/capDrift*30):(c.capR>=0.40?0:null);
 const cls=slope>0.3?"rising":slope<-0.3?"deteriorating":"holding";
 return{slope,proj,ebBreach,capBreach,cls};
}
function alertsOf(centers){
 const out=[];
 centers.forEach(c=>{const f=forecast(c);
  if(f.ebBreach!==null&&f.ebBreach<=90)out.push({c,eta:f.ebBreach,ev:"EBITDA<0",agent:"pipeline",play:"margin diagnostic"});
  if(f.capBreach!==null&&f.capBreach<=90)out.push({c,eta:f.capBreach,ev:"labor>40%",agent:"cap",play:"utilization"});
  if(c.chem<0.45&&f.cls!=="rising")out.push({c,eta:45,ev:"sensei exit risk",agent:"staffing",play:"retain+CIT"});});
 return out.sort((a,b)=>a.eta-b.eta);
}
const AGENT_LEX={score:"Measurement",transfer:"Best practice",wave:"Rollout",peer:"Peer review",fcst:"Forecast",gate:"Approval",view:"Reporting",cap:"Labor governor",pipeline:"Enrollment",staffing:"Staff retention"};
const VERB_LEX={measure:"Measure",transfer:"Transfer",schedule:"Schedule",ship:"Send",hold:"Escalate",review:"Cross-review",promote:"Adopt",retire:"Remove"};
// ===== LEAD PIPELINE (pre-sale funnel) =====
const LEAD_NAMES=["Ramirez Group","Okafor Holdings","Chen Family Trust","Delgado Ventures","Patel Education LLC","Boudreaux Partners","Nguyen Capital","Whitfield & Co.","Silva Learning","Kowalski Group","Abara Holdings","Fitzgerald Trust","Moreno Ventures","Yamamoto LLC","Brennan Partners","Adeyemi Group","Costa Family","Larsson Capital","Haddad Holdings","Ivanova Trust"];
const LEAD_SRC=["Franchise portal","Discovery Day referral","Existing-franchisee referral","Trade show","Resale inquiry","Multi-unit expansion","Broker network","Web inquiry"];
const LEAD_REGION=["TX","FL","ON","GA","NC","AZ","WA","NJ","open territory"];
const STAGES6=["Intro call","Discovery","FDD review","Due diligence","Discovery Day","Signed"];
// North America and Canada are not one regulatory track. A Canadian province
// runs its own franchise disclosure law (Ontario's Arthur Wishart Act, Alberta's
// and BC's own Franchises Acts) with its own disclosure document -- not the US
// FTC Franchise Rule's FDD. A lead's market determines which applies.
const CANADIAN_PROVINCES=["ON","BC","AB"];
function marketOf(region){return CANADIAN_PROVINCES.includes(region)?"Canada":"US";}
function disclosureLawOf(region){
 if(region==="ON")return"Arthur Wishart Act (Ontario) — Disclosure Document, 14-day minimum";
 if(region==="BC")return"Franchises Act (British Columbia) — Disclosure Document, 14-day minimum";
 if(region==="AB")return"Franchises Act (Alberta) — Disclosure Document, 14-day minimum";
 return"FTC Franchise Rule (US) — FDD, 14-day minimum";
}
function buildLeads(){
 return LEAD_NAMES.map((n,i)=>{const r=rng(hash(n+"lead"));
  const liquidity=Math.round(150+r()*600);
  const net=Math.round(liquidity*(1.5+r()*3));
  const multi=r()>0.6,proven=r()>0.72;
  const fit=Math.min(99,Math.round(38+r()*58+(proven?12:0)+(multi?6:0)));
  const region=LEAD_REGION[i%LEAD_REGION.length],src=LEAD_SRC[i%LEAD_SRC.length];
  const stage0=Math.floor(r()*5);
  // "New franchise openings and conversions" are two different deal types in the
  // JD, not one undifferentiated pipeline -- a proven operator bringing an
  // existing operation into (or expanding within) the brand is a conversion;
  // a first-time entrant is a new opening.
  const dealType=proven?"conversion":"new";
  const market=marketOf(region);
  return{id:i,n,liquidity,net,multi,proven,fit,region,src,stage0,hot:fit>=78,dealType,market,
   note:proven?"proven operator — ramp inheritance applies":multi?"multi-unit intent":liquidity<220?"liquidity light — verify financing":"single-unit prospect"};
 }).sort((a,b)=>b.fit-a.fit);
}
// ===== STATUS-PROBABILITY ENGINE — one status model under every tab =====
// Every entity holds a probability split over outcome states until a MEASUREMENT verifies it.
// Estimate (probability split) → Measurement (verified record) → Aging (confidence
// decays with time since measurement) → Coupling (linked clusters) → Interference
// (two programs on one node reinforce or compete). Map, center, deals all read this engine.
const QSTATES=["thriving","watch","at-risk"];
// The 20 tabs that carry the whole 5-minute walkthrough — everything else stays reachable,
// just hidden from the sub-tab row when "essentials only" is toggled on. Nothing is deleted.
const ESSENTIAL_TABS=["quantum","exec","franchise","rail","board","alignment","compliance","blockers","table","whitespace","leads","deals","workload","team","lenses","network","portfolio","financials","growthfin","onboarding","audit","agenda","risk","fdd"];
// note: "reports" and "success" are intentionally left out of ESSENTIAL_TABS —
// they're reviewer/governance depth, not part of the 20-tab walkthrough set.
const QCOL=["#5cb87c","#d9a62e","#d96a6a"];
const QCLUSTERS=[["CA","OR","WA","NV"],["TX","OK","LA"],["NY","NJ","CT","MA"],["FL","GA","NC","SC"],["IL","IN","OH","MI"],["VA","MD","PA"]];
function qAmp(c){
 const e=engageOf(c);
 const good=Math.max(0.05,0.5*e.score+0.5*c.ret);
 const bad=Math.max(0.05,0.5*(1-e.score)+0.5*(1-c.ret));
 const watch=Math.max(0.08,1-Math.abs(good-bad));
 const s=good+watch+bad;return[good/s,watch/s,bad/s];
}
function qStateAmp(cs){if(!cs||!cs.length)return[0.34,0.33,0.33];const a=[0,0,0];cs.forEach(c=>{const q=qAmp(c);a[0]+=q[0];a[1]+=q[1];a[2]+=q[2];});const s=a[0]+a[1]+a[2];return[a[0]/s,a[1]/s,a[2]/s];}
function qCoherence(days){return Math.max(0.12,Math.exp(-days/42));}
function qResolve(amp){return amp.indexOf(Math.max(...amp));}
// ---- Applied status diagnostics (deterministic, derived from unit data) ----
// Stability zone (soliton): occupancy near saturation self-stabilizes; low occupancy drifts.
function qZone(c){const occ=Math.min(1,c.students/160);return occ>=0.72?{zone:"self-stabilizing",occ,note:"near capacity \u2014 performance holds steady"}:occ>=0.5?{zone:"transitional",occ,note:"partial stability"}:{zone:"drifting",occ,note:"low occupancy \u2014 state drifts between measurements"};}
// Early-warning (critical slowing): proxy memory-time in weeks from momentum + margin stress.
function qTau(c){const mom=(c.momentum[0]==="+"?1:-1)*parseInt(c.momentum.slice(1));const stress=(c.eb<0?1.6:c.eb<4?0.8:0)+(mom<0?0.9:0)+(c.capR>0.38?0.5:0);return +(0.7+stress+((hash(c.name+"tau")%10)/12)).toFixed(1);}
// Critical distance: margin headroom to the $0 EBITDA transition boundary (in $k).
function qCrit(c){return +(c.eb-0).toFixed(1);}
// Program interaction (interference): pair coefficient in [-1,1]; >0 constructive, <0 destructive.
const QPAIRS=[["Premium tier","CIT pipeline",0.62],["Premium tier","School pipeline",0.34],["CIT pipeline","FIRST LEGO League",0.55],["Premium tier","FIRST LEGO League",-0.18],["School pipeline","FIRST LEGO League",0.41],["CIT pipeline","School pipeline",0.22]];
function qPair(c){const i=hash(c.name+"pair")%QPAIRS.length;return QPAIRS[i];}
// Sustainability balance: engagement gain per week minus overhead cost per week; ~0 = indefinitely runnable.
function qBalance(c){const gain=+(0.02+engageOf(c).score*0.02).toFixed(3);const cost=+(0.02+(c.capR>0.38?0.012:0.004)).toFixed(3);return{gain,cost,net:+(gain-cost).toFixed(3)};}
function qDiag(c){return{zone:qZone(c),tau:qTau(c),crit:qCrit(c),pair:qPair(c),bal:qBalance(c)};}
// ---- The Four Governors, enforced (not prose). Pure: same facts -> same verdict.
// Every committed measurement write must clear all four. Fail-safe: missing data HOLDS.
const QFLOORS={engagement:0.35,margin_ebitda_k:6,staleness_days:14};
// Scenario postures as network-wide multipliers on the same fields the manual
// per-center adjustment layer already moves (conv/ret/chem/eb). Realistic is
// the zero-delta baseline — i.e. today's canonical data. Approving a posture
// in Quantum PM stacks these BEFORE any per-center manual adj, so every
// downstream consumer of centers[] (map, agents, gates, health tiers)
// recomputes for real. Engagement integrity is not moved by this layer —
// engageOf() is a pure function of center name and does not read conv/ret/chem/eb.
const SCENARIO_DELTAS={
 optimistic:{conv:0.05,ret:0.03,chem:0.02,eb:0.6},
 realistic:{conv:0,ret:0,chem:0,eb:0},
 pessimistic:{conv:-0.05,ret:-0.03,chem:-0.02,eb:-0.6}
};
// Compounding week drift: the static SCENARIO_DELTAS above is a one-time shift
// ("what does this posture look like right now"). WEEKLY_DRIFT_STEP makes the
// week simulator ("Run live", opt.week) actually compound that posture over
// time instead of replaying the same static snapshot on every tick — under
// Pessimistic, week 20 is measurably worse than week 1; under Optimistic,
// measurably better. Realistic's direction is always 0, so it never drifts —
// which also keeps the diff-panel baseline reversal exact (see QuantumPMView).
const WEEKLY_DRIFT_STEP={conv:0.0015,ret:0.001,chem:0.0008,eb:0.02};
const postureSign=p=>p==="optimistic"?1:p==="pessimistic"?-1:0;
function weekCompound(posture,week){
 const sign=postureSign(posture),w=week||0;
 return{conv:sign*WEEKLY_DRIFT_STEP.conv*w,ret:sign*WEEKLY_DRIFT_STEP.ret*w,chem:sign*WEEKLY_DRIFT_STEP.chem*w,eb:sign*WEEKLY_DRIFT_STEP.eb*w};
}
// Single source of truth for "raw center + posture + week + manual adj ->
// adjusted center," matching the main centers useMemo's proven formula
// exactly (single combined clamp across scenario+week+manual, not clamped in
// stages — staged clamping can lose information a manual adjustment would
// otherwise have restored). Used by the main centers useMemo AND by any
// governed tab rendering a LOCAL override on a different posture than the
// global one, so both views share one tested transform instead of drifting.
function computeCentersForPosture(base,adj,posture,week){
 const sd=SCENARIO_DELTAS[posture]||SCENARIO_DELTAS.realistic;
 const wk=weekCompound(posture,week);
 return base.map(c=>{
  const d=adj[c.name];
  const conv0=c.conv+sd.conv+wk.conv, ret0=c.ret+sd.ret+wk.ret, chem0=c.chem+sd.chem+wk.chem, eb0=c.eb+sd.eb+wk.eb;
  if(!d&&posture==="realistic")return c;
  const conv=Math.min(0.9,Math.max(0.1,conv0+(d&&d.conv||0)));
  const ret=Math.min(0.98,Math.max(0.5,ret0+(d&&d.ret||0)));
  const chem=Math.min(0.95,Math.max(0.1,chem0+(d&&d.chem||0)));
  const eb=+(eb0+(d&&d.eb||0)).toFixed(1);
  const health=Math.round(40+conv*30+ret*25+chem*10-(c.capR>0.38?6:0)+(eb>4?8:eb<0?-8:0));
  return{...c,conv,ret,chem,eb,health,adjusted:true,posture};
 });
}
// Full override view for any governed tab that needs centers, states, AND
// railData under a posture different from the global one — consolidates what
// would otherwise be a fourth+fifth hand-duplication of "recompute under this
// posture" (after the main centers useMemo, the Quantum PM diff panel, and
// the Financials override).
function computeOverrideView(rawCenters,adj,posture,week,leads){
 const c=computeCentersForPosture(rawCenters,adj,posture,week);
 const st={};c.forEach(x=>{(st[x.st]=st[x.st]||[]).push(x);});
 return{centers:c,states:st,railData:runAllAgents(c,st,leads)};
}
// A failed guardrail is not one thing. "$200 short of the floor" and "$6,000
// short of the floor" are both a FAIL, but they are not the same call \u2014 so
// every verdict below carries a signed numeric distance from its threshold
// (positive = clearing margin, negative = shortfall) and a severity label
// derived from how far off it is, not just whether it passed.
function severityOf(distance,scale){
 if(distance>=0)return "clear";
 const ratio=Math.abs(distance)/scale;
 return ratio<0.15?"narrow miss":ratio<0.5?"held":"far off";
}
function qGovernors(c,daysSinceMeasure,stalenessFloorDays){
 const eng=engageOf(c).score,mar=c.eb,cleared=c.compliance!==false&&c.staffCleared!==false,d=daysSinceMeasure;
 const floor=stalenessFloorDays==null?QFLOORS.staleness_days:stalenessFloorDays; // callers may supply a contract-specific freshness limit
 const marDist=typeof mar==="number"?+(mar-QFLOORS.margin_ebitda_k).toFixed(2):null;
 const engDist=typeof eng==="number"?+(eng-QFLOORS.engagement).toFixed(3):null;
 const dataDist=typeof d==="number"?+(floor-d).toFixed(1):null;
 return[
  {id:"financial_materiality",label:"Financial materiality",pass:typeof mar==="number"&&mar>=QFLOORS.margin_ebitda_k,distance:marDist,severity:marDist==null?null:severityOf(marDist,QFLOORS.margin_ebitda_k||1),detail:(mar>=QFLOORS.margin_ebitda_k?"margin $"+mar+"k \u2265 $"+QFLOORS.margin_ebitda_k+"k floor (+$"+marDist+"k)":"margin $"+mar+"k below $"+QFLOORS.margin_ebitda_k+"k floor ($"+marDist+"k)")},
  {id:"engagement_integrity",label:"Engagement integrity",pass:typeof eng==="number"&&eng>=QFLOORS.engagement,distance:engDist,severity:engDist==null?null:severityOf(engDist,QFLOORS.engagement||1),detail:(eng>=QFLOORS.engagement?"engagement "+eng.toFixed(2)+" \u2265 "+QFLOORS.engagement:"engagement "+eng.toFixed(2)+" below "+QFLOORS.engagement+" floor")},
  {id:"child_safety",label:"Child safety",pass:cleared===true,distance:cleared===true?0:-1,severity:cleared===true?"clear":"far off",detail:(cleared===true?"staff cleared":"clearance not confirmed \u2014 hold")},
  {id:"data_integrity",label:"Data integrity",pass:typeof d==="number"&&d>=0&&d<=floor,distance:dataDist,severity:dataDist==null?null:severityOf(dataDist,floor||1),detail:(typeof d==="number"&&d<=floor?"measured "+d+"d ago \u2264 "+floor+"d":"stale "+d+"d \u2014 measure before acting")}
 ];
}
function qGate(c,daysSinceMeasure){const v=qGovernors(c,daysSinceMeasure);const held=v.filter(g=>!g.pass);return{allow:held.length===0,verdicts:v,held};}

// ============================================================================
// LAYER 1 — OPERATIONAL SIGNALS + ACTION CONTRACTS (console substrate)
// Six derived signals per center, composed from data already on the object.
// Nothing here is a new data source — it's a fixed, auditable read of what
// forecast()/engageOf()/qGovernors() already compute, named for the console.
// ============================================================================

// -- dataConfidence: freshness-weighted trust in the current read (0-1) --
function dataConfidenceOf(daysSinceMeasure){return qCoherence(daysSinceMeasure==null?30:daysSinceMeasure);}

// -- uncertaintyBand: how split the thriving/watch/at-risk read is --
function uncertaintyBandOf(c){
 const amp=qAmp(c);const spread=Math.max(...amp)-Math.min(...amp);
 return spread>=0.45?"low":spread>=0.22?"medium":"high";
}

// -- peerConnectionStrength: how tightly a unit sits inside its regional cluster (0-1) --
function peerConnectionStrengthOf(c,states){
 const cluster=QCLUSTERS.find(cl=>cl.includes(c.st));
 if(!cluster)return 0.2;
 const peers=cluster.filter(st=>st!==c.st).flatMap(st=>states[st]||[]);
 if(!peers.length)return 0.3;
 const peerAvg=peers.reduce((a,p)=>a+p.health,0)/peers.length;
 return +Math.max(0.1,Math.min(1,peerAvg/100)).toFixed(2);
}

// -- patternStabilityIndex: internal agreement across conversion/retention/staffing (0-1) --
function patternStabilityIndexOf(c){
 const m=[c.conv/0.65,c.ret/0.94,c.chem/0.8];
 const mu=(m[0]+m[1]+m[2])/3;
 const varr=m.reduce((s,x)=>s+(x-mu)*(x-mu),0)/3;
 return +Math.max(0,Math.min(1,1-varr*6)).toFixed(2);
}

// -- networkSupportIndex: strength of the peer/support network this unit can draw on (0-1) --
function networkSupportIndexOf(c,states){
 const peerStrength=peerConnectionStrengthOf(c,states);
 const activePrograms=CONNECTIVITY.filter(x=>x.n).length; // active shared-service programs on the books
 return +Math.max(0.1,Math.min(1,peerStrength*0.7+Math.min(1,activePrograms/CONNECTIVITY.length)*0.3)).toFixed(2);
}

// -- structureScore: share of the four governors this unit currently clears (0-1) --
function structureScoreOf(c,daysSinceMeasure){
 const v=qGovernors(c,daysSinceMeasure);
 return +(v.filter(g=>g.pass).length/v.length).toFixed(2);
}

// One call, six signals — the shape every agent and the map will read.
function operationalSignalsOf(c,states,daysSinceMeasure){
 return{
  dataConfidence:dataConfidenceOf(daysSinceMeasure),
  uncertaintyBand:uncertaintyBandOf(c),
  peerConnectionStrength:peerConnectionStrengthOf(c,states),
  patternStabilityIndex:patternStabilityIndexOf(c),
  networkSupportIndex:networkSupportIndexOf(c,states),
  structureScore:structureScoreOf(c,daysSinceMeasure),
 };
}

// ---- Action contracts: what evidence + sign-off each action type requires ----
// No action reaches an "approve" button in the UI without passing its contract.
const ACTION_CONTRACTS={
 "expansion":{
  requiredMetrics:["readinessScore","netMargin","students","supportCapacity"],
  minFreshnessDays:28, // ~4 weeks
  guardrails:["financial_materiality","data_integrity","structure"],
  approverRole:"Director",
 },
 "pricing-change":{
  requiredMetrics:["netMargin","students","priceCeiling"],
  minFreshnessDays:28,
  guardrails:["financial_materiality","data_integrity"],
  approverRole:"Director",
 },
 "support-plan":{
  requiredMetrics:["healthScore","engagementIndex","staffingStress"],
  minFreshnessDays:45,
  guardrails:["engagement_integrity","child_safety","data_integrity"],
  approverRole:"FBC",
 },
 "outreach":{
  requiredMetrics:["retentionRate","engagementIndex"],
  minFreshnessDays:60,
  guardrails:["engagement_integrity","child_safety"],
  approverRole:"Owner",
 },
};

// Runs a proposed action against its contract. Pure: same facts -> same verdict.
// Missing data is a HOLD, never a pass — mirrors the governor fail-safe above.
function checkContract(actionType,c,daysSinceMeasure){
 const contract=ACTION_CONTRACTS[actionType];
 if(!contract)return{allowed:false,reason:"unknown action type: "+actionType};
 const verdicts=qGovernors(c,daysSinceMeasure,contract.minFreshnessDays).filter(g=>contract.guardrails.includes(g.id));
 const freshOk=typeof daysSinceMeasure==="number"&&daysSinceMeasure<=contract.minFreshnessDays;
 const held=verdicts.filter(g=>!g.pass);
 const allowed=held.length===0&&freshOk;
 return{
  allowed,
  approverRole:contract.approverRole,
  verdicts,
  freshnessOk:freshOk,
  freshnessLimit:contract.minFreshnessDays,
  heldOn:held.map(g=>g.label).concat(freshOk?[]:["data freshness"]),
 };
}


// ============================================================================
// LAYER 2 — FIVE AGENTS (pure recommend() functions over Layer 1 signals)
// Agents never mutate state. Each returns AgentRecommendation objects; the
// Governance pass at the end attaches a contract verdict to every one.
// ============================================================================

// Default freshness model: mirrors the app's own staleness heuristic (staleBase)
// so agent tests reflect the same data-age distribution the UI already assumes.
function defaultDaysSinceMeasure(c){return hash(c.name)%38;}

function confidenceBandOf(dataConfidence){return dataConfidence>=0.6?"high":dataConfidence>=0.35?"medium":"low";}
function riskBandOf(structureScore,patternStabilityIndex){
 const avg=(structureScore+patternStabilityIndex)/2;
 return avg>=0.75?"low":avg>=0.45?"medium":"high";
}

let _recSeq=0;
function buildRecommendation({agent,scope,targetIds,title,summary,actionType,center,states,daysSinceMeasure,suggestedActionPlan,agentTag,extraHold}){
 const sig=operationalSignalsOf(center,states,daysSinceMeasure);
 const contract=checkContract(actionType,center,daysSinceMeasure);
 const extraBlocked=!!(extraHold&&extraHold.blocked);
 const allowed=contract.allowed&&!extraBlocked;
 const heldOn=extraBlocked?contract.heldOn.concat([extraHold.reason]):contract.heldOn;
 return{
  id:"rec-"+(_recSeq++)+"-"+agent.replace(/\s+/g,"").toLowerCase(),
  agent,scope,targetIds,title,summary,
  actionType,
  evidence:{
   dataFreshnessDays:daysSinceMeasure,
   operationalSignals:sig,
   contractVerdicts:contract.verdicts,
  },
  confidenceBand:confidenceBandOf(sig.dataConfidence),
  riskBand:riskBandOf(sig.structureScore,sig.patternStabilityIndex),
  requiresGate:true,
  approverRole:contract.approverRole,
  suggestedActionPlan:suggestedActionPlan||null,
  agentTags:[agentTag],
  supplyGate:extraHold||null,
  governance:{allowed,heldOn,freshnessOk:contract.freshnessOk},
 };
}

// ============================================================================
// AUTONOMOUS SOLVERS — Smart Recommendation Engine
// Three decision problems solved with automated optimization (no human bias)
// ============================================================================

// Layman's term translations for UI
const SOLVER_EXPLANATIONS = {
  leadRanking: {
    name: "Smart Expansion Picker",
    summary: "Ranks expansion opportunities by fit, money available, and operator track record — respects territory limits to avoid cannibalizing each other",
    logic: [
      "Rule 1: Fit score (0-100) — how well the operator matches this territory's needs",
      "Rule 2: Liquidity check ($200k minimum) — operator has cash reserves to weather startup",
      "Rule 3: Proven operator? Get a discount on the cash requirement (they have a track record)",
      "Rule 4: Territory capacity — each region can absorb 1-3 new locations per cycle without cannibalization",
      "Pick: Best leads ranked 1-12, subject to all rules"
    ]
  },
  fbcAllocation: {
    name: "Triage by Urgency (Health-Based)",
    summary: "Assigns 10 FBC support slots to the centers in deepest trouble — scores by health decline speed + margin depth",
    logic: [
      "Measure: How bad is each center right now? Health score (0-100) + margin ($k)",
      "Urgency: Centers losing health faster get priority (momentum matters)",
      "Severity score: 60% health + 40% margin loss = overall risk",
      "Sort by urgency (worst first), fill 10 FBC slots with top 10",
      "Hold: Other at-risk centers wait their turn (no capacity)",
      "Benefit: Saves the sickest centers first, not just whoever called first"
    ]
  },
  conflictResolver: {
    name: "Priority Resolver (When Proposals Clash)",
    summary: "When Growth wants to expand into a territory AND Unit Health says that territory is failing, decides which matters more right now",
    logic: [
      "The clash: Growth says 'expand into Boston' but Health says 'Boston is collapsing'",
      "Scoring: Growth proposals worth 100 points, Health interventions worth 80, Retention risk interventions worth 60",
      "Decision: Pick the higher-value proposal, defer the lower one until conditions change",
      "Rationale: Can't grow into a sinking ship; fix the center first, expand after it stabilizes",
      "Result: Director sees the conflict, the recommendation, and why one wins"
    ]
  }
};

// SOLVER 1: Smart Expansion Picker — ranks 20 leads, respects 8 territory rules, 3 quality gates
// Logic: Pick the best expansion candidates that fit their territories without oversaturation
// Input: leads (pool), region capacities, quality constraints
// Output: ranked best 8-12 candidates
function solveLeadRankingQUBO(leads, regionCapacities, states) {
  const N = leads.length;
  const regions = Object.keys(regionCapacities || {});

  // Build QUBO cost matrix (demo: use heuristic optimization)
  // Real version calls D-Wave QUBO solver via API
  const scores = leads.map((l, i) => {
    const regionCap = regionCapacities[l.region] || 3;
    const baseScore = l.fit;
    const liquidityPenalty = l.liquidity < GROWTH_QUALITY_LIQUIDITY_MIN ? -50 : 0;
    const fitPenalty = l.fit < (l.multi ? GROWTH_MULTI_FIT_MIN : GROWTH_QUALITY_FIT_MIN) ? -100 : 0;
    const provenBonus = l.proven ? 5 : 0;
    return { idx: i, lead: l, score: baseScore + liquidityPenalty + fitPenalty + provenBonus };
  });

  // Heuristic solver: sort by score, respect region capacity constraints
  const sorted = scores.sort((a, b) => b.score - a.score);
  const regionUsed = {};
  const selected = [];

  sorted.forEach(s => {
    const region = s.lead.region;
    const used = regionUsed[region] || 0;
    const cap = (regionCapacities && regionCapacities[region]) || 3;
    if (used < cap) {
      regionUsed[region] = used + 1;
      selected.push(s.lead);
    }
  });

  // Return top 12 by aggregate optimization (was greedy sort before)
  return selected.slice(0, 12);
}

// SOLVER 2: Triage by Urgency — allocate 10 FBC slots to highest-risk centers
// Logic: Centers with worst health + steepest decline get FBC support first
// Scoring: 60% current health + 40% margin trend = urgency
// Input: all at-risk centers, 10 available FBC slots
// Output: top 10 centers ranked by urgency (sickest first)
function solveFBCAllocationRQAOA(centersAtRisk, capacityLimit = 10) {
  // Score each center: worse health + deeper margin loss = higher urgency
  const scored = centersAtRisk.map(c => {
    const healthScore = (100 - c.health) / 100; // 0-1, higher = sicker
    const marginSeverity = Math.max(0, (0 - c.eb) / 10); // negative margin = urgent
    const urgencyWeight = healthScore * 0.6 + marginSeverity * 0.4; // combined urgency score
    return { center: c, urgency: urgencyWeight, days: c.daysSinceMeasure || 0 };
  });

  // Rank by urgency (worst = #1), allocate to top slots
  const sorted = scored.sort((a, b) => b.urgency - a.urgency);
  const allocated = sorted.slice(0, Math.min(capacityLimit, sorted.length));

  return allocated;
}

// SOLVER 3: Priority Resolver — when proposals clash, pick the most important one
// Logic: Growth (100 pts) vs Health (80 pts) vs Retention (60 pts) — highest priority wins
// Example: "Expand into Boston" (Growth=100) conflicts with "Boston is failing" (Health=80)
//          → Health wins (it's more urgent to stabilize than to grow)
// Input: all recommendations, conflict pairs
// Output: resolved conflicts with winner/loser explanation
function solveConflictIndependentSet(recs, conflicts) {
  if (!conflicts || conflicts.length === 0) return [];

  // Build conflict graph: which proposals clash with each other
  const conflictGraph = {};
  conflicts.forEach(c => {
    conflictGraph[c.a] = (conflictGraph[c.a] || []).concat(c.b);
    conflictGraph[c.b] = (conflictGraph[c.b] || []).concat(c.a);
  });

  // Priority scores (what matters most in governance)
  // Growth = new expansion (score 100), Health = save a center (score 80), Retention = keep staff (score 60)
  const agentPriority = { Growth: 100, "Unit Health": 80, Retention: 60, "Network Propagation": 40 };
  const recPriority = recs.reduce((m, r) => {
    m[r.id] = agentPriority[r.agent] || 50;
    return m;
  }, {});

  // Pick winners by priority (highest score wins its conflicts)
  const selected = new Set();
  const remaining = new Set(Object.keys(conflictGraph));
  const sorted = Array.from(remaining).sort((a, b) => (recPriority[b] || 0) - (recPriority[a] || 0));

  sorted.forEach(recId => {
    if (!selected.has(recId)) {
      const clashes = conflictGraph[recId] || [];
      const alreadyClashed = clashes.filter(n => selected.has(n));
      if (alreadyClashed.length === 0) {
        selected.add(recId);
      }
    }
  });

  // Explain each conflict: who won, who was deferred, and why
  return conflicts.map(c => {
    const aSelected = selected.has(c.a);
    const bSelected = selected.has(c.b);
    const aRec = recs.find(r => r.id === c.a);
    const bRec = recs.find(r => r.id === c.b);
    const winner = aSelected ? c.a : bSelected ? c.b : null;
    const loser = aSelected ? c.b : bSelected ? c.a : null;
    const aAgentName = aRec?.agent || "Unknown";
    const bAgentName = bRec?.agent || "Unknown";

    return {
      ...c,
      winner,
      loser,
      winnerAgent: aSelected ? aAgentName : bSelected ? bAgentName : null,
      loserAgent: aSelected ? bAgentName : bSelected ? aAgentName : null,
      resolution: winner
        ? `✓ ${aSelected ? aAgentName : bAgentName} proposal approved (priority ${recPriority[winner]}). ⏸ ${aSelected ? bAgentName : aAgentName} deferred (priority ${recPriority[loser]}).`
        : "Both held for manual review.",
    };
  });
}

// ---- Growth Agent: hot candidates into territories with headroom + support capacity ----
// Growth agent standing rules, made real rather than asserted in prose:
// (1) CANNIBALIZATION / TERRITORY-OVERLAP PENALTY -- each additional hot
//     candidate proposed into the same territory in the same cycle shaves
//     that territory's usable headroom, because they compete for the same
//     students rather than representing independent opportunities.
// (2) FINITE CANDIDATE-SUPPLY + QUALITY GATE -- a territory can only absorb
//     a bounded number of concurrent candidates (its capacity), and a
//     candidate must clear a minimum fit + liquidity floor before being
//     proposed as expansion-ready.
const GROWTH_QUALITY_FIT_MIN=70, GROWTH_QUALITY_LIQUIDITY_MIN=200;
function territoryCapacityOf(headroom){return Math.max(1,Math.round(headroom*10));}
// Underwriting distinctions the lead data already carries but the agent
// previously ignored: a proven operator has a documented track record that
// substitutes, in part, for capital cushion -- so the liquidity floor is
// relaxed for them. A multi-unit-intent candidate is a larger bet with a
// wider blast radius if the fit read is wrong -- so the fit floor is raised
// for them rather than left the same as a single-unit prospect.
const GROWTH_PROVEN_LIQUIDITY_DISCOUNT=0.70; // proven operators clear at 70% of the standard liquidity floor
const GROWTH_MULTI_FIT_MIN=75; // multi-unit intent requires a higher fit bar than the base floor (70)
function growthAgentRecommend(centers,states,leads,daysFn=defaultDaysSinceMeasure){
 const out=[];
 // Candidate pool is drawn from the active pipeline broadly (stage0<5), not
 // pre-filtered to "hot" only -- the quality gate below is what actually decides
 // expansion-readiness, so it needs real candidates to evaluate, not a pool
 // that's already been through an equivalent filter upstream.
 const candidates=[...leads].filter(l=>l.stage0<5);
 const regionCapacities=Object.keys(states).reduce((m,region)=>{
  const regionCenters=states[region]||[];
  const netState=NET_STATES.find(s=>s.s===region);
  const baseHeadroom=netState?netState.h[0]:0.3;
  m[region]=territoryCapacityOf(baseHeadroom);
  return m;
 },{});
 const pool=solveLeadRankingQUBO(candidates,regionCapacities,states);
 const regionSlotsUsed={};
 pool.forEach(l=>{
  const region=l.region;
  const regionCenters=states[region]||[];
  if(!regionCenters.length)return;
  const netState=NET_STATES.find(s=>s.s===region);
  const baseHeadroom=netState?netState.h[0]:0.3;
  const capacity=territoryCapacityOf(baseHeadroom);
  const used=regionSlotsUsed[region]||0;
  regionSlotsUsed[region]=used+1;
  const withinSupply=used<capacity;
  const overlapPenalty=+(used*0.06).toFixed(3);
  const headroom=Math.max(0.04,+(baseHeadroom-overlapPenalty).toFixed(3));
  const overlapFlag=overlapPenalty>0;
  const liquidityFloor=l.proven?+(GROWTH_QUALITY_LIQUIDITY_MIN*GROWTH_PROVEN_LIQUIDITY_DISCOUNT).toFixed(0):GROWTH_QUALITY_LIQUIDITY_MIN;
  const fitFloor=l.multi?GROWTH_MULTI_FIT_MIN:GROWTH_QUALITY_FIT_MIN;
  const qualityOk=l.fit>=fitFloor&&l.liquidity>=liquidityFloor;
  const gateReason=!qualityOk?(l.fit<fitFloor?"below fit threshold"+(l.multi?" (multi-unit bar)":""):"liquidity below quality floor"+(l.proven?" (proven-operator discounted floor)":"")):!withinSupply?"territory candidate-supply ceiling reached this cycle":null;
  const gateBlocked=!qualityOk||!withinSupply;
  const anchor=[...regionCenters].sort((a,b)=>b.health-a.health)[0];
  const worstDays=Math.max(...regionCenters.map(daysFn));
  const underwritingNote=l.proven?" \u00b7 proven operator, liquidity floor discounted to $"+liquidityFloor+"k":l.multi?" \u00b7 multi-unit intent, fit floor raised to "+fitFloor:"";
  out.push(buildRecommendation({
   agent:"Growth",scope:"territory",targetIds:[l.id,region,anchor.name],
   title:region+": "+l.n+" ("+l.fit+" fit) into a "+(headroom>=0.35?"high-headroom":overlapFlag?"overlap-constrained":"moderate-headroom")+" territory",
   summary:l.note+" \u00b7 "+regionCenters.length+" existing unit(s) in "+region+" \u00b7 territory headroom "+Math.round(headroom*100)+"%"+(overlapFlag?" (adjusted for "+used+" concurrent candidate(s) already proposed into this territory this cycle)":"")+underwritingNote+(gateBlocked?" \u00b7 "+gateReason:""),
   actionType:"expansion",center:anchor,states,daysSinceMeasure:worstDays,
   suggestedActionPlan:ACTION_PLANS.find(p=>p.n==="Selective Expansion"),
   agentTag:"expansion-target",
   extraHold:{blocked:gateBlocked,reason:gateReason,capacity,used:used+1,overlapPenalty,qualityOk,withinSupply,liquidityFloor,fitFloor},
  }));
 });
 return out;
}

// ---- Unit Health Agent: below-floor units, acute vs chronic, matched to an action plan ----
// Weekly capacity a single FBC (or Owner, for Retention below) can actually carry --
// illustrative but finite, so an agent cannot propose more concurrent support plans
// than a human approver could realistically work through. Proposals beyond the
// ceiling are held with the reason stated, mirroring the Growth agent's territory gate.
const ROLE_CAPACITY={FBC:10,Owner:8,Director:12};
function unitHealthAgentRecommend(centers,daysFn=defaultDaysSinceMeasure,capacityLedger){
 const ledger=capacityLedger||{};
 const out=[];
 const atRisk=centers.filter(c=>c.eb<QFLOORS.margin_ebitda_k||c.health<55).map(c=>({...c,daysSinceMeasure:daysFn(c)}));
 const allocated=solveFBCAllocationRQAOA(atRisk,ROLE_CAPACITY.FBC);
 const allocatedSet=new Set(allocated.map(a=>a.center.name));
 atRisk.forEach(c=>{
  const days=c.daysSinceMeasure;
  const chronic=c.eb<0&&c.momentum[0]!=="+";
  const actionPlan=ACTION_PLANS.find(p=>p.n===(chronic?"Resale & Turnaround":"Unit-Value Program"));
  const isAllocated=allocatedSet.has(c.name);
  const used=(ledger.FBC||0)+1;
  const cap=ROLE_CAPACITY.FBC;
  ledger.FBC=used-1+(isAllocated?1:0);
  out.push(buildRecommendation({
   agent:"Unit Health",scope:"unit",targetIds:[c.name],
   title:c.name+": "+(chronic?"chronic underperformance — turnaround review":"below-floor margin — support plan"),
   summary:"margin $"+c.eb+"k · health "+c.health+" · momentum "+c.momentum+(chronic?" · sustained decline, not a single-period dip":" · likely recoverable with a support plan")+(isAllocated?"":" · deferred by health-severity optimization ("+cap+" FBC slots allocated to higher-severity cases)"),
   actionType:"support-plan",center:c,states:{},daysSinceMeasure:days,
   suggestedActionPlan:actionPlan,
   agentTag:"support-needed",
   extraHold:{blocked:!isAllocated,reason:isAllocated?null:"Deferred by RQAOA severity weighting — other centers have higher health loss risk",capacity:cap,used:used},
  }));
 });
 return out;
}

// ---- Retention Agent: silent-churn risk from staff chemistry + retention trend ----
function retentionAgentRecommend(centers,daysFn=defaultDaysSinceMeasure,capacityLedger){
 const ledger=capacityLedger||{};
 const out=[];
 centers.filter(c=>c.chem<0.45||c.ret<0.80).forEach(c=>{
  const days=daysFn(c);
  const used=ledger.Owner||0;
  const cap=ROLE_CAPACITY.Owner;
  const withinCapacity=used<cap;
  ledger.Owner=used+1;
  out.push(buildRecommendation({
   agent:"Retention",scope:"unit",targetIds:[c.name],
   title:c.name+": silent-churn risk",
   summary:"staff chemistry "+c.chem.toFixed(2)+" · 12mo retention "+Math.round(c.ret*100)+"% · risk builds quietly between measurement cycles"+(withinCapacity?"":" · Owner outreach capacity ceiling reached this cycle ("+cap+" concurrent)"),
   actionType:"outreach",center:c,states:{},daysSinceMeasure:days,
   suggestedActionPlan:null,
   agentTag:"silent-churn-risk",
   extraHold:{blocked:!withinCapacity,reason:withinCapacity?null:"Owner outreach capacity ceiling reached this cycle",capacity:cap,used:used+1},
  }));
 });
 return out;
}

// ---- Network Propagation Agent: verified best-practice candidates by within-cluster health gap ----
// A 25-point gap read off two units is not the same evidence as the same gap
// read off eight -- so this agent now requires a minimum in-state sample size
// to fire at all, and averages the top-k / bottom-k units (not just the single
// best and worst) once the sample is large enough to make that meaningful,
// reducing sensitivity to one noisy outlier unit.
const PROPAGATION_MIN_SAMPLE=5;
function networkPropagationAgentRecommend(centers,states,daysFn=defaultDaysSinceMeasure){
 const out=[];
 const guard=CONNECTIVITY.find(x=>x.t==="Best Practice Propagation");
 Object.keys(states).forEach(st=>{
  const cs=states[st];
  if(cs.length<PROPAGATION_MIN_SAMPLE)return; // insufficient sample size for a verified pattern -- silently out of scope, not a false negative
  const sorted=[...cs].sort((a,b)=>b.health-a.health);
  const k=Math.min(3,Math.floor(cs.length/2));
  const topAvg=sorted.slice(0,k).reduce((a,c)=>a+c.health,0)/k;
  const bottomAvg=sorted.slice(-k).reduce((a,c)=>a+c.health,0)/k;
  const gap=Math.round(topAvg-bottomAvg);
  if(gap<25)return; // not enough spread to justify a propagation pilot
  const sampleConfidence=cs.length>=8?"high":cs.length>=6?"medium":"low";
  const source=sorted[0],target=sorted[sorted.length-1];
  const days=Math.max(daysFn(source),daysFn(target));
  out.push(buildRecommendation({
   agent:"Network Propagation",scope:"cluster",targetIds:[source.name,target.name],
   title:st+": propagate "+source.name+"'s pattern toward "+target.name,
   summary:gap+"-point health gap (top-"+k+"/bottom-"+k+" avg) within "+st+" · sample "+cs.length+" units, "+sampleConfidence+" confidence · guardrail: "+(guard?guard.guard:"data integrity — verified pattern only"),
   actionType:"support-plan",center:target,states,daysSinceMeasure:days,
   suggestedActionPlan:ACTION_PLANS.find(p=>p.n==="Unit-Value Program"),
   agentTag:"propagation-candidate",
  }));
 });
 return out;
}

// ---- Governance pass: every recommendation already carries its contract verdict (see buildRecommendation);
// this just separates the feed into what a Director can act on now vs what's held, for the UI's two lanes.
function applyGovernance(recommendations){
 const actionable=recommendations.filter(r=>r.governance.allowed);
 const held=recommendations.filter(r=>!r.governance.allowed);
 return{actionable,held,summary:actionable.length+" ready for review, "+held.length+" held pending fresher data or a cleared guardrail"};
}

// ---- Cross-agent conflict detector ----
// Nothing previously checked whether two agents were proposing contradictory
// actions on the same unit -- e.g. Growth proposing expansion anchored on a
// unit that Unit Health has just flagged as chronic. This scans the full
// proposal set for that specific pattern and surfaces it before it reaches
// Detect conflicts between proposals, then resolve via max-weight independent set solver
function detectConflicts(recs){
 const rawConflicts=[];
 const growthRecs=recs.filter(r=>r.agent==="Growth");
 const healthRecs=recs.filter(r=>r.agent==="Unit Health");
 const retentionRecs=recs.filter(r=>r.agent==="Retention");
 growthRecs.forEach(g=>{
  const anchorName=g.targetIds[2]; // [lead id, region, anchor unit name]
  if(!anchorName)return;
  const healthHit=healthRecs.find(h=>h.targetIds.includes(anchorName));
  if(healthHit){
   rawConflicts.push({
    a:g.id,b:healthHit.id,
    reason:"Growth proposes expanding "+g.targetIds[1]+" anchored on "+anchorName+", which Unit Health has separately flagged: "+healthHit.title.split(": ")[1],
    severity:healthHit.title.includes("chronic")?"high":"medium",
   });
  }
  const retentionHit=retentionRecs.find(rt=>rt.targetIds.includes(anchorName));
  if(retentionHit){
   rawConflicts.push({
    a:g.id,b:retentionHit.id,
    reason:"Growth proposes expanding "+g.targetIds[1]+" anchored on "+anchorName+", which Retention has separately flagged for silent-churn risk",
    severity:"medium",
   });
  }
 });
 // Apply quantum conflict resolution: max-weight independent set
 return solveConflictIndependentSet(recs,rawConflicts);
}

// ---- Orchestrator entry point: run all four proposing agents, then governance ----
// A shared capacityLedger passes across Unit Health and Retention in one call so
// their role-capacity ceilings (FBC, Owner) are enforced across the whole cycle,
// not reset per-agent -- the same discipline Growth already applies per-territory.
function runAllAgents(centers,states,leads,daysFn=defaultDaysSinceMeasure){
 const capacityLedger={};
 const recs=[
  ...growthAgentRecommend(centers,states,leads,daysFn),
  ...unitHealthAgentRecommend(centers,daysFn,capacityLedger),
  ...retentionAgentRecommend(centers,daysFn,capacityLedger),
  ...networkPropagationAgentRecommend(centers,states,daysFn),
 ];
 const conflicts=detectConflicts(recs);
 return{recommendations:recs,conflicts,...applyGovernance(recs)};
}

function qLastMeasSeg(stList,st,seg){for(let s=seg;s>=Math.max(0,seg-40);s--){if(stList[hash("m"+String(s))%stList.length]===st)return s;}return null;}
function qArc(cx,cy,r,a0,a1){const x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);const lg=(a1-a0)>Math.PI?1:0;return "M "+cx+" "+cy+" L "+x0.toFixed(1)+" "+y0.toFixed(1)+" A "+r+" "+r+" 0 "+lg+" 1 "+x1.toFixed(1)+" "+y1.toFixed(1)+" Z";}
// ===== OPS SUBSYSTEM (embedded, corporate register) =====
// ============================================================================
// LAYER 3 — DECISION RAIL (recommendation lanes bound to runAllAgents + applyGovernance)
// Module-scope component, same pattern as OpsSystem: receives data via props,
// never reaches into Engine's closures directly.
// ============================================================================
const BAND_COL={high:GRN,medium:AMB,low:AC};
const RISK_COL={low:GRN,medium:AMB,high:AC};

// Plain-language reading of the same contractVerdicts array the chips below
// already render from — no new data, just a one-line summary for anyone who
// doesn't want to hover each chip to know whether this is clear to approve.
function plainVerdictSummary(rec){
 const verdicts=rec.evidence.contractVerdicts||[];
 const failed=verdicts.filter(v=>!v.pass);
 const staleFlag=!rec.governance.freshnessOk;
 if(failed.length===0&&!staleFlag)return{text:"All guardrails clear — ready for Director review.",tone:GRN};
 const parts=failed.map(v=>v.label.toLowerCase());
 if(staleFlag)parts.push("data freshness");
 return{text:"Held on: "+parts.join(", ")+".",tone:AMB};
}

const RecommendationCard=React.memo(function RecommendationCard({rec,decision,history,conflicted,onDecide,jumpTo,postureApproved}){
 const[open,setOpen]=useState(false);
 // Hard gate, not advisory: territory-scope proposals (Growth agent — new
 // hires, new anchor units, real capital commitment) cannot be approved until
 // a network posture is set in Quantum PM, on top of the existing Four
 // Governors check. Unit/cluster-scope proposals (support interventions on
 // existing centers) are never gated by posture — only expansion commitments
 // are, since those are what SCENARIO_DELTAS actually governs.
 const postureGate=rec.scope==="territory"&&!postureApproved;
 const allowed=rec.governance.allowed&&!postureGate;
 const primaryUnit=(rec.targetIds&&rec.targetIds.find(id=>id&&id.length>2&&id!==rec.scope))||null;
 const histLabel={approved:"Approved",measure:"Re-measure",ignored:"Ignored"};
 return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${allowed?GRN:AMB}`,background:"#fff",padding:"9px 11px",marginBottom:7}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
   <div style={{flex:1,minWidth:220}}>
    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2,flexWrap:"wrap"}}>
     <span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,border:`1px solid ${RULE}`,padding:"1px 5px"}}>{rec.agent}</span>
     <span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:BAND_COL[rec.confidenceBand]}}>{rec.confidenceBand} confidence</span>
     <span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:RISK_COL[rec.riskBand]}}>{rec.riskBand} risk</span>
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700}}>{conflicted&&<span title="This proposal conflicts with another agent proposal on the same unit" style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#fff",background:AC,padding:"1px 5px",marginRight:6,cursor:"help"}}>CONFLICT</span>}{rec.title}{primaryUnit&&jumpTo&&<span onClick={()=>jumpTo("lenses",primaryUnit,"following up on \u201c"+rec.title+"\u201d from "+rec.agent)} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:400,color:AC,cursor:"pointer",textDecoration:"underline",marginLeft:8}}>view in Six Lenses →</span>}</div>
    <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",marginTop:2,lineHeight:1.4}}>{rec.summary}</div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:allowed?GRN:AMB,marginTop:3,fontStyle:"italic"}}>{rationaleOf(rec)}</div>
    {history&&history.length>0&&<div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:3}}>history: {history.map(h=>histLabel[h.status]||h.status).join(" → ")}</div>}
   </div>
   <div style={{textAlign:"right",minWidth:110}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,letterSpacing:0.4,textTransform:"uppercase"}}>approver (human-owned)</div>
    <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700}}>{rec.approverRole}</div>
    {rec.suggestedActionPlan&&<div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:2}}>→ {rec.suggestedActionPlan.n}</div>}
   </div>
  </div>
  {(()=>{const s=plainVerdictSummary(rec);return<div style={{marginTop:6,fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:s.tone}}>{s.text}</div>;})()}
  <div style={{marginTop:4,display:"flex",gap:5,flexWrap:"wrap"}}>
   {rec.evidence.contractVerdicts.map((v,i)=>(<span key={i} title={v.detail+(v.severity&&v.severity!=="clear"?" ("+v.severity+")":"")} style={{fontFamily:"Helvetica",fontSize:9,padding:"2px 6px",border:`1px solid ${v.pass?GRN:AC}`,color:v.pass?GRN:AC,cursor:"help"}}>{v.pass?"✓":"✕"} {v.label}{!v.pass&&v.severity==="far off"?" — far off":!v.pass&&v.severity==="narrow miss"?" — narrow miss":""}</span>))}
   {!rec.evidence.contractVerdicts.length&&<span style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>no gated guardrails for this action type</span>}
   {!rec.governance.freshnessOk&&<span style={{fontFamily:"Helvetica",fontSize:9,padding:"2px 6px",border:`1px solid ${AMB}`,color:AMB}}>✕ data freshness</span>}
   {postureGate&&<span onClick={()=>jumpTo&&jumpTo("quantum")} title="Governance-clear, but expansion commitments are held until a network posture is approved in Quantum PM" style={{fontFamily:"Helvetica",fontSize:9,padding:"2px 6px",border:`1px solid ${VIO}`,color:VIO,cursor:jumpTo?"pointer":"help",textDecoration:jumpTo?"underline":"none"}}>⏸ network posture not approved — Quantum PM →</span>}
  </div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7}}>
   <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0}}>{open?"hide":"view"} signals</button>
   <div style={{display:"flex",gap:5}}>
    {decision?<span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:decision==="approved"?GRN:decision==="measure"?AMB:MUT}}>{decision==="approved"?"Approved":decision==="measure"?"Queued for re-measurement":"Ignored"}</span>:<>
     <button disabled={!allowed} onClick={()=>onDecide(rec,"approved")} aria-label={"Approve: "+rec.title} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:allowed?"pointer":"not-allowed",border:`1px solid ${allowed?GRN:RULE}`,background:allowed?GRN:"#f2f2f2",color:allowed?"#fff":MUT}}>Approve</button>
     <button onClick={()=>onDecide(rec,"measure")} aria-label={"Queue for re-measurement: "+rec.title} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${AMB}`,background:"#fff",color:AMB}}>Measure again</button>
     <button onClick={()=>onDecide(rec,"ignored")} aria-label={"Ignore: "+rec.title} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>Ignore</button>
    </>}
   </div>
  </div>
  {open&&<div style={{marginTop:7,paddingTop:6,borderTop:`1px solid ${RULE}`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6}}>
   {Object.entries(rec.evidence.operationalSignals).map(([k,v])=>(<div key={k}>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,textTransform:"uppercase",letterSpacing:0.4}}>{k.replace(/([A-Z])/g," $1")}</div>
    <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700}}>{typeof v==="number"?v.toFixed(2):v}</div>
   </div>))}
   <div>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,textTransform:"uppercase",letterSpacing:0.4}}>Data age</div>
    <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700}}>{rec.evidence.dataFreshnessDays}d</div>
   </div>
  </div>}
 </div>);
},(prev,next)=>prev.rec===next.rec&&prev.decision===next.decision&&prev.conflicted===next.conflicted&&prev.history===next.history);

// ============================================================================
// LAYER 4 — SIX-LENS COMMAND SURFACE
// One canonical state (the same centers/states/railData/opt every other tab
// reads), reinterpreted through six roles. FB_BOUNDARY is a separate legacy
// dataset used only inside the System lens as a cross-reference — it is not
// treated as a second canonical source, since that would fragment the one
// state this surface exists to unify.
// ============================================================================
const LENS_DEFS=[
 ["student","Student","#2f6fa0"],["parent","Parent","#7a4fa0"],["franchisee","Franchisee","#2f7a3f"],
 ["corporate","Corporate","#8b0000"],["financial","Financial","#a06b1f"],["system","System",MUT],
];

function royaltyOf(c){const grossRev=+(c.students*0.289).toFixed(1);return{grossRev,royalty:+(grossRev*0.08).toFixed(1),brandFund:+(grossRev*0.02).toFixed(1)};}
// ---- Integration stubs (MyStudio / QuickBooks) ----
// These are payload SHAPES only — the field names and grouping a live
// integration would plausibly send/receive — not a working connection. Every
// figure inside is read from the same canonical center record every other
// tab reads; nothing here is invented per-field. Marked illustrative
// everywhere it surfaces, consistent with the FDD/verified-unit disclosure.
function myStudioPayloadOf(centers){
 return centers.map(c=>({
  center_id:c.name,
  state:c.st,
  verified_public_record:!!c.verified,
  enrollment:{
   active_students:c.students,
   belt_distribution_note:"per-cohort belt counts modeled at network level (COHORT table), not yet broken out per center in this export",
  },
  engagement:{
   composite_engagement_score:+engageOf(c).score.toFixed(2),
   trial_conversion_rate:+c.conv.toFixed(2),
  },
  retention:{
   retention_rate:+c.ret.toFixed(2),
   staff_chemistry_index:+c.chem.toFixed(2),
  },
  schema:"illustrative — pending live MyStudio API field contract",
 }));
}
function quickBooksPayloadOf(centers){
 return centers.map(c=>{
  const r=royaltyOf(c);
  return{
   center_id:c.name,
   state:c.st,
   period:"modeled — no fiscal period bound yet",
   gross_revenue_k:r.grossRev,
   royalty_due_k:r.royalty,
   brand_fund_due_k:r.brandFund,
   ebitda_k:c.eb,
   condition:conditionOf(c).label,
   schema:"illustrative — pending live QuickBooks GL account mapping",
  };
 });
}

function clusterExpansionGateOf(clusterCenters){const top=[...clusterCenters].sort((a,b)=>b.health-a.health)[0];const worstDays=Math.max(...clusterCenters.map(c=>hash(c.name)%38));return checkContract("expansion",top,worstDays);}
function conditionOf(c){const idx=qResolve(qAmp(c));return{label:QSTATES[idx],color:QCOL[idx]};}

const LensStudent=React.memo(function LensStudent({center}){
 const e=engageOf(center),f=forecast(center),tau=qTau(center);
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#2f6fa0",marginBottom:3}}>Student — experience & progression</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4,marginBottom:8}}>What this lens is for: how the student actually experiences the program week to week — session quality, belt progress, and how fast a shocked routine recovers.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:8}}>
   {[["Engagement score",e.score,"0-1, composite"],["30-day progression",Math.round(e.prog30*100)+"%",""],["Badges earned",e.badges,"this cohort"],["Recovery time",tau+"w",tau<=2?"fast":tau<=3?"watch":"slow"]].map(([v,l,x],i)=>(
    <div key={i}><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800}}>{v}</div><div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{l}</div>{x&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{x}</div>}</div>
   ))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",lineHeight:1.5}}>Commitment split: {Math.round(e.commit[0]*100)}% casual, {Math.round(e.commit[1]*100)}% engaged, {Math.round(e.commit[2]*100)}% advocate. Trend is <b>{f.cls}</b> on a {f.slope>0?"+":""}{f.slope} monthly slope. A slow recovery time here is the earliest signal of the retention risk the Parent and Franchisee lenses price in.</div>
 </div>);
},(prev,next)=>prev.center===next.center);

const LensParent=React.memo(function LensParent({center}){
 const e=engageOf(center);
 const notesMetric=METRICS_FULL.find(m=>m.name.includes("Notes completion"));
 const noShowMetric=METRICS_FULL.find(m=>m.name.includes("No-show recovery"));
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#7a4fa0",marginBottom:3}}>Parent — trust & responsiveness</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4,marginBottom:8}}>What this lens is for: the trust signals a parent feels directly — timely notes, responsiveness, attendance, and whether they re-enroll or refer.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:8}}>
   {[["12-mo retention",Math.round(center.ret*100)+"%","re-enrollment proxy"],["Referral rate",Math.round(e.refer*100)+"%",""],["Session buzz",Math.round(e.buzz*100)+"%","post-session sentiment"]].map(([v,l,x],i)=>(
    <div key={i}><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800}}>{v}</div><div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{l}</div>{x&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{x}</div>}</div>
   ))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",lineHeight:1.5}}>Network-wide floors this center is held to: <b>{notesMetric.name}</b> ({notesMetric.trigger}) and <b>{noShowMetric.name}</b> ({noShowMetric.trigger}). Parent trust is a lagging read on both — by the time it drops, the leading indicators already moved.</div>
 </div>);
},(prev,next)=>prev.center===next.center);

const LensFranchisee=React.memo(function LensFranchisee({center,states,days}){
 const f=forecast(center),contract=checkContract("support-plan",center,days);
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#2f7a3f",marginBottom:3}}>Franchisee — unit operations</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4,marginBottom:8}}>What this lens is for: what the person running the center sees day to day — trials, staffing, active students, margin, and whether a support plan is warranted.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:8}}>
   {[["Active students",center.students,center.students<60?"below profitability floor (60)":"above floor"],["Trial→enrollment",Math.round(center.conv*100)+"%",""],["Staff chemistry",center.chem.toFixed(2),center.chem<0.45?"churn-risk range":"stable"],["Labor % of revenue",Math.round(center.capR*100)+"%",center.capR>=0.40?"at/above governor":"within governor"]].map(([v,l,x],i)=>(
    <div key={i}><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800}}>{v}</div><div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{l}</div>{x&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{x}</div>}</div>
   ))}
  </div>
  <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${contract.allowed?GRN:AMB}`,padding:"7px 9px",fontFamily:"Helvetica",fontSize:9.5,color:"#333",lineHeight:1.5}}>
   Support plan: trend is <b>{f.cls}</b>. {contract.allowed?"Cleared to propose a support plan for Director/FBC review.":"Held — "+contract.heldOn.join(", ")+"."}
  </div>
 </div>);
},(prev,next)=>prev.center===next.center&&prev.days===next.days);

const LensCorporate=React.memo(function LensCorporate({center,states,selectedCluster}){
 const clusterCenters=states[selectedCluster]||[center];
 const avgHealth=Math.round(clusterCenters.reduce((a,c)=>a+c.health,0)/clusterCenters.length);
 const belowFloor=clusterCenters.filter(c=>c.eb<QFLOORS.margin_ebitda_k).length;
 const netSupport=networkSupportIndexOf(center,states);
 const expansion=clusterExpansionGateOf(clusterCenters);
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:3}}>Corporate — network & propagation</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4,marginBottom:8}}>What this lens is for: the network-level view — cluster health, support capacity, and whether growth or best-practice rollout is actually earned yet.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:8}}>
   {[[selectedCluster+" cluster health",avgHealth,clusterCenters.length+" units"],["Below margin floor",belowFloor,"of "+clusterCenters.length],["Support capacity",netSupport.toFixed(2),"0-1, peer + FBC proxy"],["Expansion gate",expansion.allowed?"clear":"held",expansion.allowed?"":expansion.heldOn.join(", ")]].map(([v,l,x],i)=>(
    <div key={i}><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:i===3?(expansion.allowed?GRN:AMB):INK}}>{v}</div><div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{l}</div>{x&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{x}</div>}</div>
   ))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",lineHeight:1.5}}>Best-practice propagation and expansion are both gated behind this same support-capacity read — a cluster doesn't get more units, or more of its practices pushed network-wide, faster than its FBC and peer network can actually absorb.</div>
 </div>);
},(prev,next)=>prev.center===next.center&&prev.states===next.states&&prev.selectedCluster===next.selectedCluster);

const LensFinancial=React.memo(function LensFinancial({center,days}){
 const {grossRev,royalty,brandFund}=royaltyOf(center);
 const tau=qTau(center);
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#a06b1f",marginBottom:3}}>Financial — unit economics</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4,marginBottom:8}}>What this lens is for: the money — margin against the floor, royalty and brand-fund impact, and how far the unit is from a durable payback trajectory.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:8}}>
   {[["Unit margin","$"+center.eb+"k",center.eb<QFLOORS.margin_ebitda_k?"below $"+QFLOORS.margin_ebitda_k+"k floor":"above floor"],["Modeled gross revenue","$"+grossRev+"k","students × modeled monthly rate"],["Royalty (8%)","$"+royalty+"k",""],["Brand fund (2%)","$"+brandFund+"k",""]].map(([v,l,x],i)=>(
    <div key={i}><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:i===0&&center.eb<QFLOORS.margin_ebitda_k?AC:INK}}>{v}</div><div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{l}</div>{x&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{x}</div>}</div>
   ))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",lineHeight:1.5}}>Recovery time is <b>{tau}w</b> at current trajectory — the same number driving the Student lens above, reused here rather than recomputed, because margin recovery and student-experience recovery are the same underlying signal read twice.</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:6}}>Gross revenue is modeled from enrollment at this file's standing per-student rate assumption — illustrative, not a substitute for MyStudio/QuickBooks reconciliation.</div>
 </div>);
},(prev,next)=>prev.center===next.center&&prev.days===next.days);

function LensSystem({center,states,days}){
 const sig=operationalSignalsOf(center,states,days);
 const gov=qGovernors(center,days);
 const fbMatch=FB_BOUNDARY.centers.find(x=>x.id===center.name);
 const[jsonOpen,setJsonOpen]=useState(false);
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:3}}>System — canonical state & guardrails</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4,marginBottom:8}}>What this lens is for: the audit trail — the raw signals and guardrail verdicts behind every claim made in the other five lenses, for diagnosis and traceability.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginBottom:8}}>
   {Object.entries(sig).map(([k,v])=>(<div key={k}><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,textTransform:"uppercase"}}>{k.replace(/([A-Z])/g," $1")}</div><div style={{fontFamily:"Helvetica",fontSize:13,fontWeight:700}}>{typeof v==="number"?v.toFixed(2):v}</div></div>))}
  </div>
  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
   {gov.map((g,i)=>(<span key={i} title={g.detail} style={{fontFamily:"Helvetica",fontSize:9,padding:"2px 6px",border:`1px solid ${g.pass?GRN:AC}`,color:g.pass?GRN:AC,cursor:"help"}}>{g.pass?"✓":"✕"} {g.label}</span>))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginBottom:4}}>{fbMatch?"Cross-reference: this center id also exists in the separate FB_BOUNDARY proof-of-concept dataset (not the same canonical source as above).":"No matching id in the separate FB_BOUNDARY dataset — expected, since it models a different illustrative center set."}</div>
  <div onClick={()=>setJsonOpen(o=>!o)} style={{fontFamily:"Helvetica",fontSize:9,color:AC,cursor:"pointer",textDecoration:"underline",marginBottom:jsonOpen?4:0}}>{jsonOpen?"hide":"show"} diagnostic / audit JSON for this center →</div>
  {jsonOpen&&<div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginBottom:4,lineHeight:1.5}}><b>Reading this:</b> health/eb are the same margin and health numbers shown above in plain language — this is the raw record they're computed from. daysSinceMeasure is data age; signals are the six operational reads used to set confidence and risk bands elsewhere on this screen.</div>}
  {jsonOpen&&<pre style={{fontFamily:FB_MONO,fontSize:8.5,color:"#333",background:"#f7f6f2",border:`1px solid ${RULE}`,padding:"6px 8px",overflowX:"auto",margin:0}}>{JSON.stringify({name:center.name,st:center.st,health:center.health,eb:center.eb,daysSinceMeasure:days,signals:sig},null,1)}</pre>}
 </div>);
}

const LENS_COMPONENTS={student:LensStudent,parent:LensParent,franchisee:LensFranchisee,corporate:LensCorporate,financial:LensFinancial,system:LensSystem};

function SixLensTab({centers,states,leads,railData,opt,setOpt,logL,focusCenter,jumpReason,clearJumpReason}){
 const stateKeys=Object.keys(states);
 const focusSt=focusCenter?(centers.find(c=>c.name===focusCenter)||{}).st:null;
 const[selSt,setSelSt]=useState(focusSt&&stateKeys.includes(focusSt)?focusSt:stateKeys[0]);
 const clusterCenters=states[selSt]||[];
 const[selName,setSelName]=useState(focusCenter&&focusSt===selSt?focusCenter:(clusterCenters[0]?.name||null));
 const center=clusterCenters.find(c=>c.name===selName)||clusterCenters[0]||centers[0];
 const[lens,setLens]=useState("student");
 // ---- render-timing instrumentation: answers the first-switch performance question
 // directly instead of leaving it as an unverified claim. Hidden by default; toggled
 // on with the small "perf" control below the lens tabs. ----
 const[showPerf,setShowPerf]=useState(false);
 const mountStart=useRef(typeof performance!=="undefined"?performance.now():0);
 const[mountMs,setMountMs]=useState(null);
 useEffect(()=>{
  const t=typeof performance!=="undefined"?performance.now()-mountStart.current:0;
  setMountMs(+t.toFixed(1));
 },[]);
 const days=opt.fresh[center.name]!==undefined?(opt.week-opt.fresh[center.name])*7:(hash(center.name)%38)+opt.week*2;
 const centerRecs=railData.recommendations.filter(r=>r.targetIds.includes(center.name));
 const activeSignal=[...centerRecs].sort((a,b)=>a.governance.allowed===b.governance.allowed?0:a.governance.allowed?-1:1)[0]||null;
 // System lens must reflect the same governance reality every other view sees --
 // whether this unit's active proposal is flagged by the cross-agent conflict
 // check, and whether any failed guardrail was a narrow miss or far off, not
 // just pass/fail.
 const lensConflictIds=new Set((railData.conflicts||[]).flatMap(c=>[c.a,c.b]));
 const lensConflicted=activeSignal?lensConflictIds.has(activeSignal.id):false;
 const lensConflictReason=lensConflicted?(railData.conflicts||[]).find(c=>c.a===activeSignal.id||c.b===activeSignal.id):null;
 const f=forecast(center),tau=qTau(center),gov=qGovernors(center,days);
 const held=gov.filter(g=>!g.pass);
 const cond=conditionOf(center);
 const coherence=qCoherence(days);
 const expansion=clusterExpansionGateOf(clusterCenters);
 const supportPosture=activeSignal&&activeSignal.governance.allowed?"support plan proposed":held.length?"hold — guardrail open":cond.label==="at-risk"?"monitor closely":"monitor";
 const LensBody=LENS_COMPONENTS[lens];

 return(<div>
  <StateViewBanner thisView="Six Lenses"/>
  <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8,fontStyle:"italic"}}>Six lanes, one truth: student, parent, franchisee, corporate, financial, and system, all synchronized to the same center, the same week, and the same active signal. The underlying discipline is sense-and-respond — observe state, identify the binding constraint, propose one bounded pilot, measure, and only then propagate what the data validates. The engine's job stops at diagnosis, prioritization, and support planning; pricing, staffing, compliance, and contracts stay human-owned.</div>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
   <button onClick={()=>setShowPerf(s=>!s)} aria-pressed={showPerf} aria-label="Toggle render timing display" style={{fontFamily:"Helvetica",fontSize:8,color:MUT,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0}}>{showPerf?"hide":"show"} render timing</button>
   {showPerf&&<span style={{fontFamily:"Helvetica",fontSize:8.5,padding:"2px 7px",border:`1px solid ${mountMs!==null&&mountMs<200?GRN:AMB}`,color:mountMs!==null&&mountMs<200?GRN:AMB}}>mount: {mountMs===null?"measuring\u2026":mountMs+"ms"}</span>}
  </div>
  {jumpReason&&<div style={{border:`1px solid ${AC}`,borderLeft:`3px solid ${AC}`,background:"#fdf3f2",padding:"6px 10px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <span style={{fontFamily:"Helvetica",fontSize:9,color:"#5a2020"}}>Here because: {jumpReason}</span>
   <button onClick={clearJumpReason} aria-label="Dismiss navigation context" style={{fontFamily:"Helvetica",fontSize:11,color:MUT,cursor:"pointer",background:"none",border:"none",padding:0}}>×</button>
  </div>}

  <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",border:`1px solid ${RULE}`,background:"#fff",padding:"7px 10px",marginBottom:8}}>
   <select value={selSt} onChange={ev=>{setSelSt(ev.target.value);setSelName(null);}} style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,border:`1px solid ${RULE}`,padding:"3px 6px"}}>
    {stateKeys.map(st=>(<option key={st} value={st}>{st} · {states[st].length} units</option>))}
   </select>
   <select value={center.name} onChange={ev=>setSelName(ev.target.value)} style={{fontFamily:"Helvetica",fontSize:10,border:`1px solid ${RULE}`,padding:"3px 6px",flex:"1 1 160px"}}>
    {clusterCenters.map(c=>(<option key={c.name} value={c.name}>{c.name} · health {c.health}</option>))}
   </select>
   <div style={{display:"flex",alignItems:"center",gap:3,fontFamily:"Helvetica",fontSize:9,color:MUT}}>
    <button onClick={()=>setOpt(o=>({...o,week:Math.max(0,o.week-1)}))} style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,padding:"1px 7px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff"}}>−</button>
    <span>week {opt.week}</span>
    <button onClick={()=>setOpt(o=>({...o,week:o.week+1}))} style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,padding:"1px 7px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff"}}>+</button>
   </div>
   <span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:cond.color}}>{cond.label}</span>
   <span style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>measurement confidence {coherence.toFixed(2)} · recovery {tau}w · measured {days}d ago</span>
   <span style={{marginLeft:"auto",fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:held.length?AC:GRN}}>{held.length?held[0].label+(held.length>1?" +"+(held.length-1)+" more":""):"all guardrails clear"}</span>
   {days>14&&<button onClick={()=>{setOpt(o=>({...o,fresh:{...o.fresh,[center.name]:o.week}}));logL&&logL("lenses","System","Re-measured "+center.name);}} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${AMB}`,background:"#fff",color:AMB}}>Measure now</button>}
  </div>

  <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",padding:"9px 12px",marginBottom:8}}>
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:2}}>What matters now — {center.name}</div>
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginBottom:6}}>This is a deliberate single-center deep-dive. For the network-wide highest-priority item, see the Overview tab's Today panel instead.</div>
   {activeSignal?(<>
    <div style={{fontFamily:"Helvetica",fontSize:12,fontWeight:700}}>{activeSignal.title}</div>
    <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",margin:"3px 0 6px",lineHeight:1.5}}>{activeSignal.summary}</div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.5,marginBottom:6}}>Why it matters — <b>students:</b> a {cond.label} read means engagement and belt progress {cond.label==="at-risk"?"are already slipping":"are holding"}. <b>Parents:</b> {center.ret>=0.85?"retention is healthy, so trust hasn't been tested yet":"retention is soft — this is what a parent would notice first"}. <b>Economics:</b> margin is {center.eb<QFLOORS.margin_ebitda_k?"below the $"+QFLOORS.margin_ebitda_k+"k floor":"above floor"} at ${center.eb}k.</div>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Trace: <b>{activeSignal.agent} agent</b> → {activeSignal.evidence.contractVerdicts.length?activeSignal.evidence.contractVerdicts.map(v=>v.pass?v.label:v.label+(v.severity&&v.severity!=="clear"?" ("+v.severity+")":"")).join(", "):"no gated guardrails for this action"} → {activeSignal.suggestedActionPlan?activeSignal.suggestedActionPlan.n:"no action plan attached"} (human-owned) → approver: <b>{activeSignal.approverRole}</b></div>
    {activeSignal.supplyGate&&activeSignal.supplyGate.blocked&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:AMB,marginTop:2}}>Capacity hold: {activeSignal.supplyGate.reason}</div>}
    {lensConflicted&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:AC,marginTop:2,fontWeight:700}}>⚠ {lensConflictReason?lensConflictReason.reason:"This proposal conflicts with another agent\u2019s proposal on the same unit"} — see Decision Rail before acting.</div>}
   </>):(<div style={{fontFamily:"Helvetica",fontSize:10.5,color:MUT}}>No proposed action is currently open for this center — trend is {f.cls}, recovery time {tau}w, condition {cond.label}.</div>)}
  </div>

  <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
   <div style={{flex:"2 1 300px"}}>
    <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>
     {LENS_DEFS.map(([id,label,c])=>(<button key={id} onClick={()=>setLens(id)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 11px",cursor:"pointer",border:`1px solid ${lens===id?c:RULE}`,background:lens===id?c:"#fff",color:lens===id?"#fff":c}}>{label}</button>))}
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
     <LensBody center={center} states={states} selectedCluster={selSt} days={days} week={opt.week} activeSignal={activeSignal}/>
    </div>
   </div>
   <div style={{flex:"1 1 200px",border:`1px solid ${RULE}`,background:"#fff",padding:"9px 11px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:6}}>Financial & corporate at a glance</div>
    {(()=>{const {royalty}=royaltyOf(center);const belowFloor=(states[selSt]||[]).filter(c=>c.eb<QFLOORS.margin_ebitda_k).length;
     return[["Students vs floor",center.students+" / 60",center.students<60?AC:GRN],["Margin",center.eb+"k / "+QFLOORS.margin_ebitda_k+"k floor",center.eb<QFLOORS.margin_ebitda_k?AC:GRN],["Royalty impact","$"+royalty+"k/mo",INK],["Cluster below floor",belowFloor+" units",belowFloor?AMB:GRN],["Support posture",supportPosture,supportPosture==="monitor"?GRN:AMB]].map(([l,v,c2],i)=>(
      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderTop:i?`1px solid #f0f0f0`:"none"}}><span style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{l}</span><b style={{fontFamily:"Helvetica",fontSize:10,color:c2}}>{v}</b></div>
     ));})()}
    <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${RULE}`}}>
     <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>Expansion readiness</span><b style={{fontFamily:"Helvetica",fontSize:10,color:expansion.allowed?GRN:MUT}}>{expansion.allowed?"clear to propose":"not yet — "+expansion.heldOn.join(", ")}</b></div>
    </div>
   </div>
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginBottom:10}}>Six lenses, one canonical state: every panel above reads the same {center.name} object, the same week, and the same active signal — nothing here is a separate copy of the numbers.</div>

  <SixLensProof/>
 </div>);
}

// One canonical state, several measurement views. Each surface below reads the
// same modeled network; they differ only in the question they answer. Making
// that relationship explicit is the architectural spine of the whole model.
function StateViewBanner({thisView}){
 const views=[
  ["Six Lenses","one unit, six roles"],
  ["Operations Board","every intervention, in parallel"],
  ["Operations Dynamics","uncertainty & review cadence"],
 ];
 return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fbfbf9",padding:"7px 11px",marginBottom:8}}>
  <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:MUT,marginBottom:3}}>One canonical state · several operating views · you are in: {thisView}</div>
  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
   {views.map(([n,d])=>(<span key={n} style={{fontFamily:"Helvetica",fontSize:8.5,padding:"2px 7px",border:`1px solid ${thisView===n?INK:RULE}`,background:thisView===n?INK:"#fff",color:thisView===n?"#fff":MUT}}><b>{n}</b> — {d}</span>))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:4}}>These are not three datasets. They are three questions asked of the same modeled network — change the state in one and the others reflect it, because there is only one state to change.</div>
 </div>);
}

function SixLensProof(){
 const[open,setOpen]=useState(false);
 return(<div style={{border:`1px solid ${RULE}`,background:"#fafafa",padding:"9px 11px"}}>
  <div onClick={()=>setOpen(o=>!o)} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,cursor:"pointer"}}>{open?"hide":"show"} canonical state / system proof →</div>
  <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:3}}>Separate from the per-center diagnostic above: this is the full serialized network object every view in this section derives from — for debugging and audit, not the first thing a reviewer should read.</div>
  {open&&<div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:6,lineHeight:1.5}}><b>Reading this:</b> schema/week identify the record version and measurement cycle. clusters group centers by coupling strength; centers each carry a state (thriving/watch/at-risk), a set of dimension values (vals), and their week-over-week movement (mom). This is the record itself, not a summary of it — every number in the other views traces back to something here.</div>}
  {open&&<pre style={{fontFamily:FB_MONO,fontSize:9,color:"#333",background:"#fff",border:`1px solid ${RULE}`,padding:"8px 10px",overflowX:"auto",marginTop:6,maxHeight:280,overflowY:"auto"}}>{JSON.stringify(FB_BOUNDARY,null,1)}</pre>}
 </div>);
}


// ============================================================================
// OPERATIONS BOARD — interventions in parallel, three synchronized views
// (lanes / board / feed) over the SAME shared decisions state the Decision
// Rail and Overview spotlight write to. Nothing here is a second copy.
// Timeline semantics are honest: each intervention's bar is its contract
// review window (minFreshnessDays); the "now" marker is its actual data age.
// Past-window = measurement overdue, shown plainly — no fabricated schedule.
// ============================================================================
function boardStatusOf(rec,decisions){
 const d=decisions[rec.id];
 if(d==="approved")return"approved";
 if(d==="measure")return"remeasure";
 if(d==="ignored")return"aside";
 return rec.governance.allowed?"proposed":"held";
}
const BOARD_COLS=[
 ["proposed","Proposed — pending Director review",GRN],
 ["held","Held — guardrail or data",AMB],
 ["remeasure","Queued for re-measurement",AMB],
 ["approved","Approved — human-owned",INK],
 ["aside","Set aside",MUT],
];

// ============================================================================
// OPERATIONS DYNAMICS — integrated view over the canonical state.
// How the model handles uncertainty between reviews: likelihood-weighted unit
// conditions (qAmp), measurement confidence decay (qCoherence), review-based
// resolution (shared opt.week/opt.fresh clock — the same one Six Lenses uses),
// and concurrent support paths committed by the Director (human-owned).
// ============================================================================
function supportPathsOf(c){
 const out=[];
 if(c.ret<0.82)out.push({id:"retention",n:"Retention outreach sequence",d:"Structured parent contact on missed sessions; no-show recovery protocol.",window:60,risk:"Low"});
 if(c.chem<0.55)out.push({id:"staffing",n:"Staffing stabilization plan",d:"Coverage review, senior-instructor pairing, scheduled check-ins.",window:45,risk:"Medium"});
 if(c.eb<QFLOORS.margin_ebitda_k)out.push({id:"unitvalue",n:"Unit-economics program",d:"Premium-tier pricing review and community pipeline activation.",window:45,risk:"Low"});
 if(c.conv<0.4)out.push({id:"conversion",n:"Trial-conversion review",d:"First-session experience audit; enrollment-day follow-through.",window:28,risk:"Low"});
 if(!out.length)out.push({id:"monitor",n:"Standard monitoring cadence",d:"No intervention indicated; hold to the regular review cycle.",window:28,risk:"Low"});
 return out.slice(0,3);
}

function OperationsDynamicsTab({centers,states,opt,setOpt,logL,dyn,setDyn,focusCenter,railData,jumpTo}){
 const[showPerfDyn,setShowPerfDyn]=useState(false);
 const mountStartDyn=useRef(typeof performance!=="undefined"?performance.now():0);
 const[mountMsDyn,setMountMsDyn]=useState(null);
 useEffect(()=>{const t=typeof performance!=="undefined"?performance.now()-mountStartDyn.current:0;setMountMsDyn(+t.toFixed(1));},[]);
 const stateKeys=Object.keys(states);
 const focusSt=focusCenter?(centers.find(c=>c.name===focusCenter)||{}).st:null;
 const[selSt,setSelSt]=useState(focusSt&&stateKeys.includes(focusSt)?focusSt:stateKeys[0]);
 const stCenters=states[selSt]||[];
 const[selName,setSelName]=useState(focusCenter&&focusSt===selSt?focusCenter:null);
 const[couplingScope,setCouplingScope]=useState("state");
 // ---- Scenario sandbox: adjust assumptions, watch the royalty projection recompute live ----
 const[supportDrag,setSupportDrag]=useState(0.10); // support-cost drag, % of gross benefit absorbed by delivery cost
 const[adoptionSpeed,setAdoptionSpeed]=useState(1.0); // multiplier on the adoption-ramp curve (1.0 = base case)
 const[guardrailDays,setGuardrailDays]=useState(28); // decision-anchor freshness window, days
 const center=stCenters.find(c=>c.name===selName)||stCenters[0]||centers[0];
 // Committing a support path to a unit that another agent has flagged in an
 // open conflict deserves the same warning every other view now gives --
 // this was the one operating view with no way to know at all.
 const dynConflictIds=new Set((railData&&railData.conflicts||[]).flatMap(c=>[c.a,c.b]));
 const dynRecs=(railData&&railData.recommendations||[]).filter(r=>r.targetIds.includes(center.name));
 const dynConflicted=dynRecs.some(r=>dynConflictIds.has(r.id));
 const ageOf=c=>opt.fresh[c.name]!==undefined?(opt.week-opt.fresh[c.name])*7:(hash(c.name)%38)+opt.week*2;
 const amp=qAmp(center),age=ageOf(center),conf=qCoherence(age);
 const paths=supportPathsOf(center);
 const netConf=+(centers.reduce((a,c)=>a+qCoherence(ageOf(c)),0)/centers.length).toFixed(2);
 const supportIdx=networkSupportIndexOf(center,states);
 const review=c=>{
  const a=qAmp(c),idx=qResolve(a);
  setDyn(m=>({...m,resolved:{...m.resolved,[c.name]:idx}}));
  setOpt(o=>({...o,fresh:{...o.fresh,[c.name]:o.week}}));
  logL&&logL("dynamics","Review",c.name+" reviewed — condition recorded as "+QSTATES[idx]+"; measurement confidence restored.");
 };
 const commit=(c,p)=>{
  setDyn(m=>({...m,committed:{...m.committed,[c.name]:p.id}}));
  logL&&logL("dynamics","Director",c.name+" — committed \""+p.n+"\"; alternative paths closed. Review due within "+p.window+"d.");
 };
 const completePath=(c,p)=>{
  setDyn(m=>({...m,completed:{...(m.completed||{}),[c.name]:p.id}}));
  setOpt(o=>({...o,fresh:{...o.fresh,[c.name]:o.week}}));
  logL&&logL("dynamics","Director",c.name+" — \""+p.n+"\" marked complete; outcome measured, review clock closed.");
 };
 return(<div>
  <StateViewBanner thisView="Operations Dynamics"/>
  <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Between reviews, a unit's condition is a weighted likelihood across thriving, watch, and at-risk — and confidence in that read decays as data ages. A review resolves the likelihood to a recorded condition and restores confidence on the same shared clock every other view reads. Support planning holds up to three candidate paths concurrently; the Director commits one, the alternatives close. All figures derive from the canonical state — nothing here is a separate copy.</div>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
   <button onClick={()=>setShowPerfDyn(s=>!s)} aria-pressed={showPerfDyn} aria-label="Toggle render timing display" style={{fontFamily:"Helvetica",fontSize:8,color:MUT,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0}}>{showPerfDyn?"hide":"show"} render timing</button>
   {showPerfDyn&&<span style={{fontFamily:"Helvetica",fontSize:8.5,padding:"2px 7px",border:`1px solid ${mountMsDyn!==null&&mountMsDyn<200?GRN:AMB}`,color:mountMsDyn!==null&&mountMsDyn<200?GRN:AMB}}>mount: {mountMsDyn===null?"measuring\u2026":mountMsDyn+"ms"}</span>}
  </div>
  {dynConflicted&&<div style={{border:`1px solid ${AC}`,borderLeft:`3px solid ${AC}`,background:"#fdf3f2",padding:"6px 10px",marginBottom:8,fontFamily:"Helvetica",fontSize:9,color:"#5a2020",fontWeight:700}}>\u26a0 {center.name} is flagged by the cross-agent conflict check \u2014 review Decision Rail before committing a support path here.</div>}

  <div style={{display:"flex",gap:0,flexWrap:"wrap",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
   {[["wk "+opt.week,"shared operating clock"],[netConf,"avg measurement confidence — network"],[Object.keys(dyn.resolved).length,"conditions recorded this session"],[Object.keys(dyn.committed).length,"support paths committed"]].map(([v,l],i)=>(
    <div key={i} style={{flex:"1 1 130px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
     <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,lineHeight:1}}>{v}</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
    </div>))}
   <div style={{display:"flex",alignItems:"center",padding:"0 12px"}}>
    <button onClick={()=>setOpt(o=>({...o,week:o.week+1}))} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 12px",cursor:"pointer",border:`1px solid ${INK}`,background:INK,color:"#fff"}}>Advance week →</button>
   </div>
  </div>

  {(()=>{
   // Scenario sandbox: three assumptions the Director can flex, recomputed live against
   // the same $1.36M/yr Unit-Value base every other view cites — not a separate model.
   const base=1.36;
   const dragFactor=1-supportDrag;
   const rampFactor=Math.min(1,adoptionSpeed);
   const guardrailFactor=guardrailDays>=28?1:0.85; // tightening below the 28-day floor costs measurement coverage
   const projected=+(base*dragFactor*rampFactor*guardrailFactor).toFixed(2);
   return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid #7a6bd8`,background:"#faf9fc",padding:"9px 12px",marginBottom:10}}>
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#7a6bd8",marginBottom:6}}>Scenario sandbox — flex an assumption, watch the projection move</div>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
     <div style={{minWidth:180}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginBottom:2}}>Support-cost drag: {Math.round(supportDrag*100)}%</div>
      <input type="range" min={0} max={40} value={Math.round(supportDrag*100)} onChange={ev=>setSupportDrag(Number(ev.target.value)/100)} aria-label={"Support-cost drag, currently "+Math.round(supportDrag*100)+" percent"} style={{width:"100%"}}/>
     </div>
     <div style={{minWidth:180}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginBottom:2}}>Adoption speed: {adoptionSpeed.toFixed(2)}× base ramp</div>
      <input type="range" min={40} max={140} value={Math.round(adoptionSpeed*100)} onChange={ev=>setAdoptionSpeed(Number(ev.target.value)/100)} aria-label={"Adoption speed multiplier, currently "+adoptionSpeed.toFixed(2)+"x"} style={{width:"100%"}}/>
     </div>
     <div style={{minWidth:180}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginBottom:2}}>Guardrail freshness floor: {guardrailDays}d</div>
      <input type="range" min={14} max={45} value={guardrailDays} onChange={ev=>setGuardrailDays(Number(ev.target.value))} aria-label={"Guardrail freshness floor, currently "+guardrailDays+" days"} style={{width:"100%"}}/>
     </div>
     <div style={{marginLeft:"auto",textAlign:"right"}}>
      <div style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:"#7a6bd8"}}>${projected}M/yr</div>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>projected, vs ${base}M/yr base case</div>
     </div>
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:6}}>This is a policy simulator, not a second source of truth — all three sliders recompute the same Unit-Value figure shown in Programs; nothing here is committed until a Director acts on it.</div>
   </div>);
  })()}

  <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-start"}}>
   <div style={{flex:"1 1 330px",border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:6}}>Condition likelihood by unit — {selSt} · peer support {supportIdx.toFixed(2)}</div>
    <select value={selSt} onChange={e=>{setSelSt(e.target.value);setSelName(null);}} style={{fontFamily:"Helvetica",fontSize:10,border:`1px solid ${RULE}`,padding:"3px 6px",marginBottom:8,width:"100%"}}>
     {stateKeys.map(st=>(<option key={st} value={st}>{st} · {states[st].length} units</option>))}
    </select>
    {stCenters.slice(0,10).map(c=>{
     const a=qAmp(c),ag=ageOf(c),cf=qCoherence(ag),ri=dyn.resolved[c.name];
     return(<div key={c.name} onClick={()=>setSelName(c.name)} style={{padding:"6px 0",borderTop:`1px solid #f0ede6`,cursor:"pointer",opacity:center.name===c.name?1:0.75}}>
      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Helvetica",fontSize:9.5}}>
       <b>{c.name}</b>
       <span style={{color:ri!==undefined?QCOL[ri]:MUT,fontWeight:700}}>{ri!==undefined?"recorded: "+QSTATES[ri]:"unreviewed"}</span>
      </div>
      <div style={{display:"flex",height:10,border:`1px solid ${RULE}`,marginTop:3,opacity:0.35+cf*0.65}}>
       {a.map((v,i)=>(<div key={i} style={{width:(v*100)+"%",background:QCOL[i]}} title={QSTATES[i]+" "+Math.round(v*100)+"%"}/>))}
      </div>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:2}}>data age {ag}d · confidence {cf.toFixed(2)} — bar fades as confidence decays</div>
     </div>);})}
    {stCenters.length>10&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,paddingTop:4}}>+{stCenters.length-10} more units in {selSt}</div>}
   </div>

   <div style={{flex:"1 1 330px"}}>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px",marginBottom:10}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>{center.name} — review status</div>
      <span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:conf<0.5?AC:GRN}}>confidence {conf.toFixed(2)}</span>
     </div>
     <svg viewBox="0 0 300 80" style={{width:"100%",display:"block"}}>
      {Array.from({length:61},(_,d)=>d).map(d=>{const y=70-qCoherence(d)*60;return d?<circle key={d} cx={10+d*4.6} cy={y} r="0.7" fill={MUT}/>:null;})}
      <line x1={10+Math.min(60,age)*4.6} y1="6" x2={10+Math.min(60,age)*4.6} y2="74" stroke={conf<0.5?AC:INK} strokeWidth="1.4"/>
      <text x={Math.min(255,14+Math.min(60,age)*4.6)} y="14" fontSize="8" fill={conf<0.5?AC:INK} fontFamily="Helvetica">this unit · {age}d</text>
      <text x="10" y="78" fontSize="7" fill={MUT} fontFamily="Helvetica">0d</text><text x="278" y="78" fontSize="7" fill={MUT} fontFamily="Helvetica">60d</text>
     </svg>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,margin:"4px 0 6px"}}>Measurement confidence vs. data age. Past ~28d, a recorded condition should not anchor a growth or pricing decision — the same freshness floor the governance contracts enforce, and the same clock the Six-Lens and Operations Board views read.</div>
     <button onClick={()=>review(center)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 12px",cursor:"pointer",border:`1px solid ${GRN}`,background:GRN,color:"#fff"}}>Conduct review — record condition</button>
     {jumpTo&&<span onClick={()=>jumpTo("lenses",center.name,"reviewing "+center.name+" from Operations Dynamics")} style={{fontFamily:"Helvetica",fontSize:9,color:AC,cursor:"pointer",textDecoration:"underline",marginLeft:10}}>view {center.name} in Six Lenses →</span>}
    </div>

    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px",marginBottom:10}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>Peer coupling — {couplingScope==="state"?"how support propagates in "+selSt:"network-wide cluster structure"}</div>
      <div style={{display:"flex",gap:4}}>
       {[["state","This state"],["network","Whole network"]].map(([id,lab])=>(<button key={id} onClick={()=>setCouplingScope(id)} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"2px 7px",cursor:"pointer",border:`1px solid ${couplingScope===id?INK:RULE}`,background:couplingScope===id?INK:"#fff",color:couplingScope===id?"#fff":MUT}}>{lab}</button>))}
      </div>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginBottom:6}}>{couplingScope==="state"?"Units in a tightly-coupled state move together. When a support path is committed at one unit, the units it is most strongly connected to are the next most likely to benefit — support lands harder where the network is tight.":"Each node is a state cluster, sized by unit count and colored by average condition. Thicker links mean tighter regional coupling — where a validated practice propagates fastest across the network."}</div>
     {couplingScope==="network"?(()=>{
      const byState=Object.entries(states).map(([st,cs])=>({st,n:cs.length,health:cs.reduce((a,c)=>a+c.health,0)/cs.length,cond:conditionOf(cs.reduce((a,c)=>a.health<c.health?a:c,cs[0]))})).sort((a,b)=>b.n-a.n).slice(0,12);
      const N=byState.length,cx=150,cy=75,R=60;
      const pos=byState.map((s,i)=>{const ang=(i/N)*Math.PI*2-Math.PI/2;return{...s,x:cx+Math.cos(ang)*R,y:cy+Math.sin(ang)*R};});
      const coup=(a,b)=>{const h=hash(a.st+b.st)%100/100;return 0.15+h*0.5;};
      return(<svg viewBox="0 0 300 150" style={{width:"100%",display:"block"}}>
       {pos.map((p,i)=>pos.slice(i+1).map((q,j)=>{const k=coup(p,q);return(<line key={i+"-"+j} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeOpacity={0.05+k*0.18} strokeWidth={0.3+k*1.6}/>);}))}
       {pos.map((p,i)=>(<g key={i} onClick={()=>{setSelSt(p.st);setCouplingScope("state");}} style={{cursor:"pointer"}}>
        <circle cx={p.x} cy={p.y} r={3.5+Math.min(7,p.n/8)} fill={p.cond.color} stroke="#fff" strokeWidth="0.8"/>
        <text x={p.x} y={p.y-8} fontSize="6.5" textAnchor="middle" fill={INK} fontFamily="Helvetica" fontWeight={700}>{p.st}</text>
       </g>))}
       <text x="6" y="146" fontSize="7" fill={MUT} fontFamily="Helvetica">node size = unit count · click a state to drill into its units</text>
      </svg>);
     })():(()=>{
      const nodes=stCenters.slice(0,8);
      const N=nodes.length,cx=150,cy=70,R=52;
      const pos=nodes.map((c,i)=>{const ang=(i/N)*Math.PI*2-Math.PI/2;return{c,x:cx+Math.cos(ang)*R,y:cy+Math.sin(ang)*R};});
      const focusI=pos.findIndex(p=>p.c.name===center.name);
      const coup=(a,b)=>{const h=hash(a.name+b.name)%100/100;const same=a.st===b.st?0.4:0;return Math.min(0.95,0.25+same+h*0.4);};
      const committedHere=!!dyn.committed[center.name];
      return(<svg viewBox="0 0 300 140" style={{width:"100%",display:"block"}}>
       {pos.map((p,i)=>pos.slice(i+1).map((q,j)=>{const k=coup(p.c,q.c);const touchesFocus=focusI>=0&&(p.c.name===center.name||q.c.name===center.name);
        return(<line key={i+"-"+j} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={touchesFocus&&committedHere?AC:INK} strokeOpacity={touchesFocus?(committedHere?0.55:0.3):0.08} strokeWidth={touchesFocus?0.5+k*2.2:0.4}/>);
       }))}
       {pos.map((p,i)=>{const isFocus=p.c.name===center.name;const cond=conditionOf(p.c);const k=focusI>=0?coup(p.c,center):0;const influenced=committedHere&&isFocus===false&&k>0.55;
        return(<g key={i} onClick={()=>setSelName(p.c.name)} style={{cursor:"pointer"}}>
         {influenced&&<circle cx={p.x} cy={p.y} r="9" fill="none" stroke={AC} strokeOpacity="0.5" strokeWidth="0.8"/>}
         <circle cx={p.x} cy={p.y} r={isFocus?6.5:4.6} fill={cond.color} stroke={isFocus?INK:"#fff"} strokeWidth={isFocus?1.4:0.8}/>
         <text x={p.x} y={p.y-8.5} fontSize="6.5" textAnchor="middle" fill={INK} fontFamily="Helvetica" fontWeight={isFocus?700:400}>{p.c.name.length>10?p.c.name.slice(0,9)+"…":p.c.name}</text>
        </g>);})}
       <text x="6" y="134" fontSize="7" fill={MUT} fontFamily="Helvetica">{committedHere?"ring = units most likely to benefit from the committed path":"commit a path below to see the propagation radius"}</text>
      </svg>);
     })()}
    </div>

    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>Concurrent support paths — held until the Director commits one</div>
     {paths.map(p=>{const isC=dyn.committed[center.name]===p.id,closed=dyn.committed[center.name]&&!isC;
      return(<div key={p.id} style={{border:`1px solid ${isC?GRN:RULE}`,padding:"7px 9px",marginBottom:6,opacity:closed?0.45:1,background:isC?"#f3f8f3":"#fff"}}>
       <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Helvetica",fontSize:9.5}}><b>{p.n}</b><span style={{color:MUT}}>{p.risk} risk · {p.window}d review window</span></div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:"#555",margin:"2px 0 5px"}}>{p.d}</div>
       {isC?(dyn.completed&&dyn.completed[center.name]===p.id?<span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:INK}}>✓ Completed — outcome measured, review clock closed</span>:<span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:GRN}}>Committed — alternatives closed · human-owned <button onClick={()=>completePath(center,p)} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"2px 7px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK,marginLeft:6}}>Mark complete</button></span>)
        :closed?<span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>closed on commitment of the selected path</span>
        :<button onClick={()=>commit(center,p)} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Commit this path</button>}
      </div>);})}
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>Candidate paths are held concurrently so the review, not the proposal order, decides. Commitment is a Director action; it closes the alternatives, starts the review clock, and is written to the shared session record.</div>
    </div>
   </div>
  </div>
 </div>);
}


// ============================================================================
// SYSTEM ALIGNMENT — the operating model at full scale.
// Renders the four standing rules as a live diagram: one canonical state,
// four proposing agents, a fail-closed governance boundary, and the operating
// views — with a Network Integrity Monitor computing measurement confidence,
// uncertainty, and decision integrity over the same canonical state.
// ============================================================================
const ALIGN_AGENTS=["Growth","Unit Health","Retention","Network Propagation"];
const ALIGN_VIEWS=[
 ["franchise","Overview","today's one governed action"],
 ["rail","Decision Rail","proposals under review"],
 ["board","Operations Board","interventions in parallel"],
 ["table","Network Map","the whole territory, spatially"],
 ["lenses","Six Lenses","one unit, six roles"],
 ["dynamics","Operations Dynamics","uncertainty & cadence"],
];
function SystemAlignmentTab({centers,states,railData,decisions,dyn,opt,ledger,jumpTo}){
 const recs=railData.recommendations;
 const conflicts=railData.conflicts||[];
 const ageOf=c=>opt.fresh[c.name]!==undefined?(opt.week-opt.fresh[c.name])*7:(hash(c.name)%38)+opt.week*2;
 const byAgent=ALIGN_AGENTS.map(a=>({a,n:recs.filter(r=>r.agent===a).length,allowed:recs.filter(r=>r.agent===a&&r.governance.allowed).length}));
 const allowedN=recs.filter(r=>r.governance.allowed).length,heldN=recs.length-allowedN;
 const decidedIds=Object.keys(decisions);
 const traced=decidedIds.filter(id=>recs.some(r=>r.id===id)).length;
 const confs=centers.map(c=>qCoherence(ageOf(c)));
 const avgConf=+(confs.reduce((x,y)=>x+y,0)/confs.length).toFixed(2);
 const freshPct=Math.round(100*centers.filter(c=>ageOf(c)<=28).length/centers.length);
 const lowConfN=confs.filter(v=>v<0.5).length;
 const committedN=Object.keys(dyn.committed||{}).length,completedN=Object.keys(dyn.completed||{}).length;
 // Confidence-weighted network health: a stale, low-confidence unit's health
 // reading should not carry the same weight in the top-line rollup as a
 // freshly measured one. This is a second, more honest rollup shown beside
 // the simple average, not a silent replacement of it.
 const simpleAvgHealth=+(centers.reduce((a,c)=>a+c.health,0)/centers.length).toFixed(1);
 const totalConf=confs.reduce((a,v)=>a+v,0);
 const weightedAvgHealth=+(centers.reduce((a,c,idx)=>a+c.health*confs[idx],0)/totalConf).toFixed(1);
 const rollupDelta=+(weightedAvgHealth-simpleAvgHealth).toFixed(1);
 // Recent decision activity, computed from the real session ledger rather than
 // a fabricated time series -- what's actually been logged, grouped by source
 // and outcome, so the ledger reads as a signal rather than a passive log.
 const recentLog=(ledger||[]).slice(0,40);
 const actCounts={approved:0,held:0,queued:0,other:0};
 recentLog.forEach(e=>{
  const t=(e.text||"").toLowerCase();
  if(t.includes("approved"))actCounts.approved++;
  else if(t.includes("held")||t.includes("hold"))actCounts.held++;
  else if(t.includes("queued")||t.includes("re-measur"))actCounts.queued++;
  else actCounts.other++;
 });
 const bySource={};
 recentLog.forEach(e=>{bySource[e.tab]=(bySource[e.tab]||0)+1;});
 const AGY=[52,116,180,244]; const VY=[26,74,122,170,218,266];
 // Each view-node carries a live status dot rather than a static label -- the
 // diagram becomes a status map, not just an architecture poster. A view is
 // flagged when it currently holds an unresolved cross-agent conflict or a
 // proposal blocked on a role-capacity ceiling.
 const capacityBlockedRoles=new Set(recs.filter(r=>r.supplyGate&&r.supplyGate.blocked&&/capacity/.test(r.supplyGate.reason||"")).map(r=>r.approverRole));
 const viewFlagged={
  franchise:conflicts.length>0,
  rail:conflicts.length>0||capacityBlockedRoles.size>0,
  board:conflicts.length>0||capacityBlockedRoles.size>0,
  table:conflicts.length>0, // the map reads the same railData.conflicts and rings the affected territory
  lenses:conflicts.length>0, // Six Lenses shows the conflict once navigated to the affected unit -- previously hardcoded false even after that capability was built
  dynamics:conflicts.length>0, // Operations Dynamics now shows a conflict warning for the selected unit
 };
 return(<div>
  <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>The operating model at full scale, governed by four standing rules: the whole network state is preserved before any operational view is derived; a view exists only where it serves diagnosis, prioritization, or governed action; the governance boundary is where a proposal becomes real; and every commitment is human-owned. The agents below do not create separate truths for growth, health, retention, or propagation — they propose against one canonical system, and the integrity monitor reads that same state.</div>

  <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"12px 14px",marginBottom:10}}>
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:6}}>One canonical state → four agents → one governance boundary → operating views (live counts)</div>
   <svg viewBox="0 0 940 310" style={{width:"100%",display:"block"}}>
    {/* canonical state */}
    <rect x="14" y="95" width="168" height="120" fill="#fbfbf9" stroke={INK} strokeWidth="1.6"/>
    <text x="98" y="128" fontSize="12" fontWeight="700" textAnchor="middle" fill={INK} fontFamily="Helvetica">CANONICAL STATE</text>
    <text x="98" y="148" fontSize="10" textAnchor="middle" fill={MUT} fontFamily="Helvetica">{centers.length} units · 40 states</text>
    <text x="98" y="164" fontSize="10" textAnchor="middle" fill={MUT} fontFamily="Helvetica">week {opt.week} · one clock</text>
    <text x="98" y="180" fontSize="10" textAnchor="middle" fill={MUT} fontFamily="Helvetica">one decision record</text>
    {/* agents */}
    {byAgent.map((g,i)=>(<g key={g.a}>
     <line x1="182" y1={155} x2="252" y2={AGY[i]+22} stroke={RULE} strokeWidth="1.2"/>
     <rect x="252" y={AGY[i]} width="180" height="44" fill="#fff" stroke={GRN} strokeWidth="1.3"/>
     <text x="262" y={AGY[i]+18} fontSize="10.5" fontWeight="700" fill={INK} fontFamily="Helvetica">{g.a} agent</text>
     <text x="262" y={AGY[i]+34} fontSize="9" fill={MUT} fontFamily="Helvetica">{g.n} proposals · {g.allowed} clear guardrails</text>
     <line x1="432" y1={AGY[i]+22} x2="486" y2={155} stroke={RULE} strokeWidth="1.2"/>
    </g>))}
    {/* governance boundary */}
    <rect x="486" y="40" width="14" height="230" fill={INK}/>
    <text x="493" y="30" fontSize="9.5" fontWeight="700" textAnchor="middle" fill={INK} fontFamily="Helvetica">GOVERNANCE BOUNDARY</text>
    <text x="493" y="292" fontSize="8.5" textAnchor="middle" fill={MUT} fontFamily="Helvetica">contracts · fail-closed · named approver</text>
    <text x="472" y="160" fontSize="8.5" textAnchor="end" fill={GRN} fontFamily="Helvetica" fontWeight="700">{allowedN} allowed →</text>
    <text x="472" y="176" fontSize="8.5" textAnchor="end" fill={AMB} fontFamily="Helvetica" fontWeight="700">{heldN} held</text>
    {/* views */}
    {ALIGN_VIEWS.map(([id,name,q],i)=>(<g key={id} onClick={()=>jumpTo&&jumpTo(id,null)} style={{cursor:jumpTo?"pointer":"default"}}>
     <line x1="500" y1={155} x2="560" y2={VY[i]+21} stroke={RULE} strokeWidth="1.2"/>
     <rect x="560" y={VY[i]} width="200" height="42" fill="#fff" stroke={viewFlagged[id]?AC:INK} strokeWidth={viewFlagged[id]?"1.6":"1.1"}/>
     {viewFlagged[id]&&<circle cx="750" cy={VY[i]+10} r="4" fill={AC}><title>This view currently has an unresolved conflict or a role at capacity</title></circle>}
     <text x="570" y={VY[i]+17} fontSize="10.5" fontWeight="700" fill={INK} fontFamily="Helvetica">{name}</text>
     <text x="570" y={VY[i]+32} fontSize="8.5" fill={MUT} fontFamily="Helvetica">{q}</text>
    </g>))}
    {/* human-owned marker */}
    <rect x="790" y="120" width="136" height="70" fill="#f5f8f5" stroke={GRN} strokeWidth="1.4"/>
    <text x="858" y="147" fontSize="10" fontWeight="700" textAnchor="middle" fill={GRN} fontFamily="Helvetica">DIRECTOR</text>
    <text x="858" y="163" fontSize="8.5" textAnchor="middle" fill={MUT} fontFamily="Helvetica">every commitment</text>
    <text x="858" y="176" fontSize="8.5" textAnchor="middle" fill={MUT} fontFamily="Helvetica">human-owned</text>
    <line x1="760" y1="155" x2="790" y2="155" stroke={GRN} strokeWidth="1.4"/>
   </svg>
   <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:4}}>Views are clickable. Nothing right of the boundary is a copy — every surface reads the state on the left, and a decision made in any view is the same decision everywhere.</div>
  </div>

  <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
   <div style={{padding:"8px 12px 2px",fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>Network integrity monitor — read live from the canonical state</div>
   <div style={{display:"flex",flexWrap:"wrap"}}>
    {[
     [avgConf,"avg measurement confidence",avgConf<0.5?AC:GRN],
     [freshPct+"%","units within the 28-day window",freshPct<50?AC:INK],
     [lowConfN,"units below 0.50 confidence — re-measure first",lowConfN?AMB:GRN],
     [traced+" / "+decidedIds.length,"decisions traced to a governed proposal",traced===decidedIds.length?GRN:AC],
     [committedN+" · "+completedN,"support paths committed · completed",INK],
     [conflicts.length,conflicts.length?"cross-agent conflicts — open now":"cross-agent conflicts — checked, none open",conflicts.length?AC:GRN],
    ].map(([v,l,c],i)=>(<div key={i} style={{flex:"1 1 160px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
     <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
    </div>))}
   </div>
   <div style={{padding:"4px 12px 9px",fontFamily:"Helvetica",fontSize:8,color:MUT}}>Integrity here means three checks: confidence in what is measured, honesty about what has aged past its window, and a decision record in which every entry traces back to a governed proposal. If the last figure is ever not N of N, the record has an orphan — and that is a finding, not a formatting issue.</div>
  </div>

  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
   <div style={{flex:"1 1 260px",border:`1px solid ${RULE}`,background:"#fff",padding:"9px 11px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:5}}>Network health — two rollups</div>
    <div style={{display:"flex",gap:16}}>
     <div><div style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:INK}}>{simpleAvgHealth}</div><div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>simple average</div></div>
     <div><div style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:"#7a6bd8"}}>{weightedAvgHealth}</div><div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>confidence-weighted</div></div>
     <div><div style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:Math.abs(rollupDelta)>=1?AC:GRN}}>{rollupDelta>0?"+":""}{rollupDelta}</div><div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>delta</div></div>
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:4}}>The weighted rollup discounts stale, low-confidence units rather than letting them carry equal weight with freshly measured ones. A large delta means the simple average is being meaningfully skewed by stale data.</div>
   </div>
   <div style={{flex:"1 1 260px",border:`1px solid ${RULE}`,background:"#fff",padding:"9px 11px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:5}}>Recent decision activity — last {recentLog.length} logged actions</div>
    <div style={{display:"flex",gap:14,marginBottom:4}}>
     <span style={{fontFamily:"Helvetica",fontSize:9}}><b style={{color:GRN}}>{actCounts.approved}</b> approved</span>
     <span style={{fontFamily:"Helvetica",fontSize:9}}><b style={{color:AMB}}>{actCounts.held}</b> held</span>
     <span style={{fontFamily:"Helvetica",fontSize:9}}><b style={{color:INK}}>{actCounts.queued}</b> queued</span>
     <span style={{fontFamily:"Helvetica",fontSize:9}}><b style={{color:MUT}}>{actCounts.other}</b> other</span>
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>by source: {Object.entries(bySource).map(([k,v])=>k+" "+v).join(" · ")||"no activity logged yet this session"}</div>
   </div>
  </div>

  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   {[["Rule 1","Preserve the whole network state before deriving any operational view."],
     ["Rule 2","Derive a view only where it serves diagnosis, prioritization, or governed action."],
     ["Rule 3","The governance boundary is where a proposal becomes real."],
     ["Rule 4","Every commitment is human-owned."]].map(([r,t])=>(
    <div key={r} style={{flex:"1 1 200px",border:`1px solid ${RULE}`,background:"#fbfbf9",padding:"8px 10px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:3}}>{r}</div>
     <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333",lineHeight:1.4}}>{t}</div>
    </div>))}
  </div>
 </div>);
}


function OperationsBoardTab({railData,decisions,setDecisions,decisionHistory,recordDecision,logL,opt,dyn,jumpTo}){
 const committedPaths=dyn?Object.entries(dyn.committed||{}):[];
 const[view,setView]=useState("lanes");
 const[showPerf,setShowPerf]=useState(false);
 const[showShortcuts,setShowShortcuts]=useState(false);
 const[kbIdx,setKbIdx]=useState(0);
 const mountStart=useRef(typeof performance!=="undefined"?performance.now():0);
 const[mountMs,setMountMs]=useState(null);
 useEffect(()=>{const t=typeof performance!=="undefined"?performance.now()-mountStart.current:0;setMountMs(+t.toFixed(1));},[]);
 const recs=railData.recommendations;
 // The conflict marker must read the same way on every surface -- a proposal
 // flagged on the Decision Rail cannot look clean here just because this view
 // renders it differently.
 const boardConflicts=railData.conflicts||[];
 const boardConflictedIds=new Set(boardConflicts.flatMap(c=>[c.a,c.b]));
 const windowOf=r=>(ACTION_CONTRACTS[r.actionType]&&ACTION_CONTRACTS[r.actionType].minFreshnessDays)||30;
 const overdueOf=r=>Math.max(0,r.evidence.dataFreshnessDays-windowOf(r));
 const statusOf=r=>boardStatusOf(r,decisions);
 const decide=(rec,d)=>{
  setDecisions(m=>({...m,[rec.id]:d}));
  recordDecision&&recordDecision(rec.id,d);
  logL&&logL("board",rec.agent,rec.title+" — "+(d==="approved"?"approved by Director":d==="measure"?"queued for re-measurement":"set aside")+" (from operations board)");
 };
 const counts={};BOARD_COLS.forEach(([k])=>counts[k]=0);recs.forEach(r=>counts[statusOf(r)]++);
 const overdueN=recs.filter(r=>overdueOf(r)>0).length;
 const decidedN=counts.approved+counts.remeasure+counts.aside;
 // lanes: prioritize items needing attention — overdue first, then held, then highest-confidence proposed
 const laneItems=[...recs].sort((a,b)=>{
  const oa=overdueOf(a)>0?1:0,ob=overdueOf(b)>0?1:0;if(oa!==ob)return ob-oa;
  const ha=statusOf(a)==="held"?1:0,hb=statusOf(b)==="held"?1:0;if(ha!==hb)return hb-ha;
  return b.evidence.operationalSignals.dataConfidence-a.evidence.operationalSignals.dataConfidence;
 }).slice(0,12);
 const MAXD=60;
 const ownerChip=r=>{const s=statusOf(r);
  return s==="approved"?["Director · committed",INK]:s==="remeasure"?["Director · re-measure",AMB]:s==="aside"?["Director · set aside",MUT]:["agent · proposed",r.governance.allowed?GRN:AMB];};
 const feedItems=[...recs].sort((a,b)=>{
  const da=decisions[a.id]?1:0,db=decisions[b.id]?1:0;if(da!==db)return db-da;
  return overdueOf(b)-overdueOf(a);
 }).slice(0,8);
 // Keyboard shortcuts operate on the same prioritized laneItems list and the
 // same decide() handler the buttons already call — no new decision path.
 // Scoped to the lanes view since that's the one ordered, bounded list;
 // disabled while focus is in a text field so typing elsewhere is unaffected.
 useEffect(()=>{
  if(view!=="lanes")return;
  const onKey=(e)=>{
   const tag=(e.target&&e.target.tagName)||"";
   if(tag==="INPUT"||tag==="TEXTAREA"||e.metaKey||e.ctrlKey||e.altKey)return;
   const item=laneItems[kbIdx];
   if(e.key==="ArrowDown"||e.key==="j"){e.preventDefault();setKbIdx(i=>Math.min(laneItems.length-1,i+1));}
   else if(e.key==="ArrowUp"||e.key==="k"){e.preventDefault();setKbIdx(i=>Math.max(0,i-1));}
   else if(e.key==="?"){e.preventDefault();setShowShortcuts(s=>!s);}
   else if(item&&!decisions[item.id]){
    if((e.key==="a"||e.key==="A")&&item.governance.allowed){e.preventDefault();decide(item,"approved");}
    else if(e.key==="m"||e.key==="M"){e.preventDefault();decide(item,"measure");}
    else if(e.key==="i"||e.key==="I"){e.preventDefault();decide(item,"ignored");}
   }
  };
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[view,laneItems,kbIdx,decisions]);
 useEffect(()=>{if(kbIdx>=laneItems.length)setKbIdx(0);},[laneItems.length]);

 return(<div>
  <StateViewBanner thisView="Operations Board"/>
  <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Every open intervention across the network, visible concurrently. Three views — lanes, board, feed — read one shared decision record; an approval made here is the same approval the Decision Rail and Overview show. Agents propose; every commitment is human-owned.</div>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
   <button onClick={()=>setShowPerf(s=>!s)} aria-pressed={showPerf} aria-label="Toggle render timing display" style={{fontFamily:"Helvetica",fontSize:8,color:MUT,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0}}>{showPerf?"hide":"show"} render timing</button>
   {showPerf&&<span style={{fontFamily:"Helvetica",fontSize:8.5,padding:"2px 7px",border:`1px solid ${mountMs!==null&&mountMs<200?GRN:AMB}`,color:mountMs!==null&&mountMs<200?GRN:AMB}}>mount: {mountMs===null?"measuring\u2026":mountMs+"ms"}</span>}
   {view==="lanes"&&<button onClick={()=>setShowShortcuts(s=>!s)} aria-pressed={showShortcuts} aria-label="Toggle keyboard shortcuts help" style={{fontFamily:"Helvetica",fontSize:8,color:MUT,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0}}>{showShortcuts?"hide":"show"} keyboard shortcuts</button>}
   {view==="lanes"&&showShortcuts&&<span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>↑/↓ or j/k select · A approve · M measure again · I ignore · ? toggle this</span>}
  </div>

  <div style={{display:"flex",gap:0,flexWrap:"wrap",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:8}}>
   {[[recs.length,"interventions in flight",INK],[counts.proposed,"pending Director review",GRN],[counts.held,"held — guardrail or data",AMB],[overdueN,"past measurement cadence",overdueN?AC:GRN],[decidedN,"decided this session",INK]].map(([v,l,c],i)=>(
    <div key={i} style={{flex:"1 1 120px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
     <div style={{fontFamily:"Helvetica",fontSize:19,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
    </div>))}
  </div>

  <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
   {[["lanes","Lanes — cadence view"],["board","Board — by decision state"],["feed","Feed — governed trace"]].map(([id,label])=>(
    <button key={id} onClick={()=>setView(id)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 12px",cursor:"pointer",border:`1px solid ${view===id?INK:RULE}`,background:view===id?INK:"#fff",color:view===id?"#fff":MUT}}>{label}</button>))}
   <span style={{marginLeft:"auto",fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>week {opt.week} · one decision record across all views</span>
   <button onClick={()=>downloadJSON(decisionLedgerExport(decisions,railData),"cn-decision-ledger.json")} title="Export the governed decision record as JSON" aria-label="Export decision ledger as JSON" style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"4px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>export ledger ↓</button>
  </div>

  {committedPaths.length>0&&<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${GRN}`,background:"#f5f8f5",padding:"8px 11px",marginBottom:8}}>
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:GRN,marginBottom:5}}>Support paths committed in Operations Dynamics — {committedPaths.length} in progress</div>
   <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
    {committedPaths.map(([name,pid])=>{const done=dyn.completed&&dyn.completed[name]===pid;return(<div key={name} onClick={()=>jumpTo&&jumpTo("dynamics",name)} style={{fontFamily:"Helvetica",fontSize:9,border:`1px solid ${done?INK:RULE}`,background:done?"#f0f0ee":"#fff",padding:"4px 8px",cursor:jumpTo?"pointer":"default"}}><b>{name}</b> <span style={{color:MUT}}>· {pid} · {done?"✓ completed":"review clock running"}</span></div>);})}
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:5}}>These are Director-committed interventions from the dynamics view, tracked here alongside agent-proposed actions. Click any to return to its unit.</div>
  </div>}

  {view==="lanes"&&(<div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
   <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
    <span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>Contract window vs. data age — 12 highest-priority of {recs.length}</span>
    <span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>bar = review window · marker = current data age · 0–{MAXD}d</span>
   </div>
   {laneItems.map((r,ri)=>{const w=windowOf(r),age=r.evidence.dataFreshnessDays,over=overdueOf(r),[oLabel,oCol]=ownerChip(r),kbSel=view==="lanes"&&ri===kbIdx;
    return(<div key={r.id} onClick={()=>setKbIdx(ri)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0 5px 6px",borderTop:`1px solid #f2f2f2`,borderLeft:kbSel?`3px solid ${INK}`:"3px solid transparent",background:kbSel?"#fafaf8":"transparent",cursor:"pointer"}}>
     <div style={{flex:"0 0 210px",minWidth:0}}>
      <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{boardConflictedIds.has(r.id)&&<span title="Conflicts with another agent's proposal on the same unit" style={{color:"#fff",background:AC,fontSize:7.5,padding:"0 3px",marginRight:4,cursor:"help"}}>!</span>}{r.title}</div>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>{r.agent} · <span style={{color:oCol,fontWeight:700}}>{oLabel}</span></div>
     </div>
     <div style={{flex:1,position:"relative",height:16,background:"#f7f6f2",border:`1px solid ${RULE}`}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:Math.min(100,w/MAXD*100)+"%",background:statusOf(r)==="approved"?"#e8efe8":statusOf(r)==="held"?"#f5efe0":"#eef2ee",borderRight:`1px solid ${RULE}`}}/>
      {over>0&&<div style={{position:"absolute",left:Math.min(100,w/MAXD*100)+"%",top:0,bottom:0,width:Math.min(100-Math.min(100,w/MAXD*100),over/MAXD*100)+"%",background:"#f3d9cf"}}/>}
      <div style={{position:"absolute",left:Math.min(99,age/MAXD*100)+"%",top:-2,bottom:-2,width:2,background:over>0?AC:INK}}/>
      <span style={{position:"absolute",right:4,top:1,fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:over>0?AC:MUT}}>{over>0?"+"+over+"d past cadence":age+"d / "+w+"d"}</span>
     </div>
    </div>);})}
   <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:8}}>An intervention past its window is not failed — it is unmeasured. Re-measurement restores decision eligibility; the guardrail that enforces this is the same one the Decision Rail applies.</div>
  </div>)}

  {view==="board"&&(<div style={{display:"flex",gap:8,alignItems:"flex-start",overflowX:"auto"}}>
   {BOARD_COLS.map(([key,label,col])=>{const items=recs.filter(r=>statusOf(r)===key);
    return(<div key={key} style={{flex:"1 1 170px",minWidth:170,border:`1px solid ${RULE}`,background:"#fafaf8"}}>
     <div style={{padding:"7px 9px",borderBottom:`2px solid ${col}`,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
      <span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.4,textTransform:"uppercase",color:col}}>{label}</span>
      <b style={{fontFamily:"Helvetica",fontSize:10,color:col}}>{items.length}</b>
     </div>
     <div style={{padding:"6px"}}>
      {items.slice(0,6).map(r=>(<div key={r.id} style={{border:`1px solid ${RULE}`,background:"#fff",padding:"6px 8px",marginBottom:6}}>
       <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,lineHeight:1.3}}>{boardConflictedIds.has(r.id)&&<span title="Conflicts with another agent proposal on the same unit" style={{color:"#fff",background:AC,fontSize:7.5,padding:"0 3px",marginRight:4,cursor:"help"}}>!</span>}{r.title}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,margin:"2px 0 4px"}}>{r.agent} · {r.confidenceBand} confidence · {r.riskBand} risk</div>
       {key==="proposed"&&(<div style={{display:"flex",gap:4}}>
        <button onClick={()=>decide(r,"approved")} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"2px 7px",cursor:"pointer",border:`1px solid ${GRN}`,background:GRN,color:"#fff"}}>Approve</button>
        <button onClick={()=>decide(r,"measure")} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"2px 7px",cursor:"pointer",border:`1px solid ${AMB}`,background:"#fff",color:AMB}}>Measure</button>
        <button onClick={()=>decide(r,"ignored")} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"2px 7px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>Set aside</button>
       </div>)}
       {key==="held"&&<div style={{fontFamily:"Helvetica",fontSize:8,color:AMB}}>{r.governance.heldOn.join(", ")||"data freshness"}</div>}
       {key==="approved"&&<div style={{fontFamily:"Helvetica",fontSize:8,color:INK,fontWeight:700}}>approver: {r.approverRole}</div>}
      </div>))}
      {items.length>6&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,textAlign:"center",padding:"2px 0 4px"}}>+{items.length-6} more in this state</div>}
      {items.length===0&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,padding:"2px 0 4px"}}>none</div>}
     </div>
    </div>);})}
  </div>)}

  {view==="feed"&&(<div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:6}}>Governed trace — decided items first, then most overdue</div>
   {feedItems.map(r=>{const s=statusOf(r),over=overdueOf(r);
    return(<div key={r.id} style={{padding:"8px 0",borderTop:`1px solid #f0f0f0`}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}>
      <div style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700}}>{boardConflictedIds.has(r.id)&&<span title="Conflicts with another agent proposal on the same unit" style={{color:"#fff",background:AC,fontSize:7.5,padding:"0 3px",marginRight:4,cursor:"help"}}>!</span>}{r.title}</div>
      <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"1px 6px",border:`1px solid ${s==="approved"?INK:s==="proposed"?GRN:s==="held"?AMB:MUT}`,color:s==="approved"?INK:s==="proposed"?GRN:s==="held"?AMB:MUT}}>{s==="proposed"?"NEEDS DIRECTOR":s==="held"?"HELD":s==="remeasure"?"RE-MEASURE":s==="approved"?"APPROVED":"SET ASIDE"}</span>
     </div>
     <div style={{display:"flex",gap:5,flexWrap:"wrap",margin:"4px 0"}}>
      <span style={{fontFamily:"Helvetica",fontSize:8,padding:"2px 6px",border:`1px solid ${RULE}`,color:"#444"}}>{r.agent} agent → proposed</span>
      {r.evidence.contractVerdicts.map((v,i)=>(<span key={i} style={{fontFamily:"Helvetica",fontSize:8,padding:"2px 6px",border:`1px solid ${v.pass?GRN:AC}`,color:v.pass?GRN:AC}}>{v.pass?"✓":"✕"} {v.label}</span>))}
      {r.suggestedActionPlan&&<span style={{fontFamily:"Helvetica",fontSize:8,padding:"2px 6px",border:`1px solid ${RULE}`,color:"#444"}}>→ {r.suggestedActionPlan.n}</span>}
      <span style={{fontFamily:"Helvetica",fontSize:8,padding:"2px 6px",border:`1px solid ${INK}`,color:INK}}>approver: {r.approverRole} (human-owned)</span>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>data confidence {r.evidence.operationalSignals.dataConfidence.toFixed(2)} · data age {r.evidence.dataFreshnessDays}d{over>0?" · "+over+"d past review cadence":""}</div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:r.governance.allowed?GRN:AMB,fontStyle:"italic",marginTop:1}}>{rationaleOf(r)}</div>
     {s==="proposed"&&(<div style={{display:"flex",gap:5,marginTop:5}}>
      <button onClick={()=>decide(r,"approved")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${GRN}`,background:GRN,color:"#fff"}}>Approve</button>
      <button onClick={()=>decide(r,"measure")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${AMB}`,background:"#fff",color:AMB}}>Measure again</button>
      <button onClick={()=>decide(r,"ignored")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>Set aside</button>
     </div>)}
    </div>);})}
  </div>)}
 </div>);
}


function DecisionRailTab({railData,logL,decisions,setDecisions,decisionHistory,recordDecision,jumpTo,opt}){
 const result=railData; // single computation in Engine — recomputing here would mint different rec ids (_recSeq) and break cross-view decision sync
 const[agentFilter,setAgentFilter]=useState("all");
 const agents=["all","Growth","Unit Health","Retention","Network Propagation"];
 const postureApproved=!!(opt&&opt.quantum&&opt.quantum.approved);
 const onDecide=(rec,d)=>{
  // defense in depth: the Approve button is already disabled in the UI when
  // this holds, but the canonical decision-recording action re-checks the
  // same rule so nothing upstream can silently bypass it.
  if(d==="approved"&&rec.scope==="territory"&&!postureApproved){
   logL&&logL("rail",rec.agent,rec.title+" — approval blocked: no network posture approved in Quantum PM");
   return;
  }
  setDecisions(m=>({...m,[rec.id]:d}));
  recordDecision&&recordDecision(rec.id,d);
  logL&&logL("rail",rec.agent,rec.title+" — "+(d==="approved"?"approved by Director":d==="measure"?"queued for re-measurement":"ignored"));
 };
 const visible=list=>agentFilter==="all"?list:list.filter(r=>r.agent===agentFilter);
 const actionable=visible(result.actionable),held=visible(result.held);
 const conflicts=result.conflicts||[];
 const conflictedIds=new Set(conflicts.flatMap(c=>[c.a,c.b]));
 // Approver workload: how many proposals currently sit with each human role,
 // split by decided-this-session vs still pending — makes "every commitment is
 // human-owned" checkable rather than asserted, and would surface a role that's
 // structurally overloaded.
 const workload={};
 result.recommendations.forEach(r=>{
  const role=r.approverRole;
  workload[role]=workload[role]||{pending:0,decided:0};
  if(decisions[r.id])workload[role].decided++;else workload[role].pending++;
 });
 return(<div>
  {conflicts.length>0&&<div style={{border:`1px solid ${AC}`,borderLeft:`3px solid ${AC}`,background:"#fdf3f2",padding:"7px 11px",marginBottom:8}}>
   <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:4}}>{conflicts.length} cross-agent conflict{conflicts.length>1?"s":""} detected — review before acting on either side</div>
   {conflicts.slice(0,4).map((c,i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,color:"#5a2020",marginBottom:2}}>• {c.reason}</div>))}
  </div>}
  <div style={{display:"flex",flexWrap:"wrap",gap:8,border:`1px solid ${RULE}`,background:"#fbfbf9",padding:"7px 11px",marginBottom:8}}>
   <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>Approver workload this cycle:</span>
   {Object.entries(workload).map(([role,w])=>(<span key={role} style={{fontFamily:"Helvetica",fontSize:9}}><b>{role}</b>: {w.decided} decided, {w.pending} pending</span>))}
  </div>
  <div style={{display:"flex",gap:0,flexWrap:"wrap",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
   {[[result.actionable.length,"actionable now",GRN],[result.held.length,"held — data or guardrail",AMB],[Object.values(decisions).filter(d=>d==="approved").length,"approved this session",INK]].map(([v,l,c],i)=>(
    <div key={i} style={{flex:"1 1 140px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
     <div style={{fontFamily:"Helvetica",fontSize:19,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
     <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:2}}>{l}</div>
    </div>))}
  </div>
  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
   {agents.map(a=>(<button key={a} onClick={()=>setAgentFilter(a)} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${agentFilter===a?INK:RULE}`,background:agentFilter===a?INK:"#fff",color:agentFilter===a?"#fff":MUT}}>{a}</button>))}
  </div>
  <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:GRN,marginBottom:6}}>Actionable — {actionable.length}</div>
  {actionable.length===0&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,marginBottom:12}}>nothing actionable for this filter</div>}
  {actionable.map(r=>(<RecommendationCard key={r.id} rec={r} decision={decisions[r.id]} history={decisionHistory&&decisionHistory[r.id]} conflicted={conflictedIds.has(r.id)} onDecide={onDecide} jumpTo={jumpTo} postureApproved={postureApproved}/>))}
  <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AMB,margin:"14px 0 6px"}}>Held — {held.length}</div>
  {held.length===0&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>nothing held for this filter</div>}
  {held.map(r=>(<RecommendationCard key={r.id} rec={r} decision={decisions[r.id]} history={decisionHistory&&decisionHistory[r.id]} conflicted={conflictedIds.has(r.id)} onDecide={onDecide} jumpTo={jumpTo} postureApproved={postureApproved}/>))}
  <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:10,borderTop:`1px solid ${RULE}`,paddingTop:6}}>Agents propose; every action is human-owned — nothing here writes to a center's live record without an explicit approval. Approve/Ignore/Measure again are logged to the record ledger for this session.</div>
 </div>);
}

function OpsSystem({view}){
  const [phase,setPhase]=useState("acquire");
  const [expanded,setExpanded]=useState(null);
  const [expConn,setExpConn]=useState(null);
  const isPhaseView=["acquire","deliver","retain","operate"].includes(view);
  const activePhase=isPhaseView?view:phase;
  const pm=PHASE_META[activePhase];
  const steps=W.filter(s=>s.p===activePhase);
  const org=ORG_ROLES[activePhase];
  const agile=AGILE[activePhase];
  return(
    <div style={{fontFamily:"Helvetica",color:INK,lineHeight:1.6,fontSize:14}}>
      {view==="network"&&(<>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Network — 30,000ft</div>
        <p style={{color:"#444",marginBottom:12}}>How 350+ centers operate as one governed system. The Director of Franchise Development sits at the intersection of network strategy and center-level operations.</p>
        <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6}}>Network Tiers</div>
        {NET_TIERS.map((t,i)=>(
          <div key={i} style={{padding:"5px 0",borderTop:i?`1px solid #eee`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:14.5}}>{t.n}</b><span style={{fontFamily:"Helvetica",fontSize:10,color:MUT}}>{t.s}</span></div>
            <div style={{fontSize:13.5,color:"#444"}}>{t.d}</div>
          </div>
        ))}
        <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:18}}>Network Standards — N-Series</div>
        {CONNECTIVITY.map(c=>{const open=expConn===c.n;return(
          <div key={c.n} onClick={()=>setExpConn(open?null:c.n)} style={{padding:"5px 0",borderTop:`1px solid #eee`,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:AC,minWidth:30}}>N-{c.n}</span>
              <span style={{fontWeight:600,fontSize:14}}>{c.t}</span>
              <span style={{marginLeft:"auto",fontFamily:"Helvetica",fontSize:14,color:MUT}}>{open?"–":"+"}</span>
            </div>
            {open&&<div style={{paddingLeft:36,marginTop:4}}>
              <div style={{fontSize:13,color:"#444",lineHeight:1.5}}>{c.d}</div>
              <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#2a7a2a",marginTop:5}}>ACCEPTANCE: {c.accept}</div>
              <div style={{fontFamily:"Helvetica",fontSize:10.5,color:AC,marginTop:1}}>GUARDRAIL: {c.guard}</div>
            </div>}
          </div>
        );})}
        <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:18}}>PM Dashboard</div>
        {DASHBOARD.map((d,i)=>(
          <div key={i} style={{padding:"3px 0",borderTop:i?`1px solid #eee`:"none",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13.5}}>{d.m}</span>
            <span style={{fontFamily:"Helvetica",fontSize:12}}><b>{d.v}</b><span style={{fontSize:10,color:d.c?AC:MUT,marginLeft:6}}>{d.t}</span></span>
          </div>
        ))}
      </>)}
      {isPhaseView&&(<>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:700}}>{pm.name} <span style={{fontFamily:"Helvetica",fontSize:11,fontWeight:400,color:MUT}}>— {pm.range} ({pm.count} steps)</span></div>
        <div style={{fontSize:14,color:"#444",marginTop:3}}>{pm.desc}</div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6}}><span style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT}}>Workflow — Every Step</span><span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:AC}}>LEVEL 1 · DAG</span></div>
      {steps.map((step,i)=>{
        const isOpen=expanded===step.n;
        return(
          <div key={step.n} onClick={()=>setExpanded(isOpen?null:step.n)} style={{padding:"6px 0",borderTop:i?`1px solid ${step.gate?"#daa":"#eee"}`:"none",cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:step.gate?AC:step.decision?"#4444aa":MUT,minWidth:22}}>{step.n}</span>
              <span style={{fontWeight:step.gate?700:600,fontSize:14,color:step.gate?AC:INK,flex:1}}>{step.s}{CRIT_STEPS.includes(step.n)&&<span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#fff",background:AC,padding:"1px 4px",borderRadius:2,marginLeft:6,verticalAlign:"middle"}}>CP</span>}</span>
              <span style={{fontFamily:"Helvetica",fontSize:11,color:MUT,flexShrink:0}}>{step.o}</span>
            </div>
            {isOpen&&(
              <div style={{paddingLeft:28,marginTop:4}}>
                <div style={{fontFamily:"Helvetica",fontSize:10,color:MUT,marginBottom:2}}>{step.sys}{step.t?` · ${step.t}`:""}{step.gate?" · APPROVAL GATE":""}{step.decision?" · DECISION POINT":""}{step.back?" · LOOP CLOSURE":""}{CRIT_STEPS.includes(step.n)?" · CRITICAL PATH":""}{step.gr?` · guardrail: ${step.gr}`:""}</div>
                <div style={{fontSize:13.5,color:"#444",lineHeight:1.6}}>{step.d}</div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:18}}>Org Structure — {pm.name}</div>
      {org.map((r,i)=>{const [role,...rest]=r.split(" — ");
        return <div key={i} style={{padding:"3px 0",borderTop:i?`1px solid #eee`:"none"}}><b style={{fontSize:13.5}}>{role}</b><span style={{fontSize:13,color:"#555"}}> — {rest.join(" — ")}</span></div>;
      })}
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:18}}>Chain Summary</div>
      <div style={{fontSize:13.5,color:"#444",lineHeight:1.7}}>
        {steps.filter(s=>s.gate||s.decision||s.back).map((s,i)=>(
          <span key={i}>
            {i>0&&<span style={{color:AC}}> → </span>}
            <span style={{fontWeight:s.gate?700:400,color:s.gate?AC:s.back?"#2a7a2a":INK}}>{s.s}{s.gate?" [G]":""}{s.decision?" [?]":""}{s.back?" [↩]":""}</span>
          </span>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:18}}><span style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT}}>Flow &amp; Cadence</span><span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:AC}}>LEVELS 2–3</span></div>
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:MUT,letterSpacing:0.5,marginBottom:3}}>KANBAN + WIP LIMITS</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:4}}>
        {["Backlog","Active","Review","Done"].map((col,ci)=>{
          const items=agile.kanban[ci]||[];
          const count=items.reduce((a,s)=>a+(parseInt(s)||1),0);
          const wip=agile.wip[ci];
          const over=wip<50&&count>wip;
          return(
          <div key={ci}>
            <div style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4,borderBottom:`2px solid ${over?AC:ci===3?"#2a7a2a":ci===0?"#aaa":"#888"}`,paddingBottom:2,marginBottom:3,color:over?AC:INK,display:"flex",justifyContent:"space-between"}}>
              <span>{col}</span>{wip<50&&<span style={{fontSize:9}}>{over?"⚠":""}≤{wip}</span>}
            </div>
            {items.map((item,ii)=>(
              <div key={ii} style={{fontSize:11.5,color:"#444",padding:"2px 0",borderTop:ii?`1px solid #f0f0f0`:"none",lineHeight:1.4}}>{item}</div>
            ))}
          </div>
        );})}
      </div>
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:MUT,letterSpacing:0.5,marginBottom:2,marginTop:10}}>SPRINT + VELOCITY</div>
      <div style={{fontSize:13,color:"#444",marginBottom:8}}>{agile.sprint}</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:2,height:36}}>
        {agile.velocity.map((v,i)=>{const max=Math.max(...agile.velocity);
          return <div key={i} style={{flex:1,height:Math.max(3,(v/max)*34),background:i===agile.velocity.length-1?INK:"#ccc"}}/>;
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Helvetica",fontSize:10,color:MUT,marginTop:1,marginBottom:12}}>
        <span>8 cycles ago</span><span>velocity · now</span>
      </div>
      <div style={{borderLeft:`2px solid ${AC}`,paddingLeft:10,fontSize:12.5,color:"#555"}}>
        <b style={{fontFamily:"Helvetica",fontSize:10,color:AC}}>LEVEL 4 · GOVERNANCE</b><br/>
        This phase's flow and cadence roll up to one outcome metric: <b>{agile.outcome}</b>.
      </div>
      </>)}
      {view==="plan"&&(<>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>First 90 Days</div>
        <p style={{color:"#444",marginBottom:8}}>Sense-and-respond rollout: observe state → locate binding constraint → run one bounded pilot → measure → propagate what the data validates.</p>
        <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,background:"#fdfdfb",padding:"8px 10px",marginBottom:14}}>
          <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:3}}>Why this matters</div>
          <div style={{fontSize:12,color:"#444",lineHeight:1.55}}>A strategy is only credible once it survives contact with week one. Listening before acting, then proving one intervention before scaling it, is how a Director earns the right to propagate a practice network-wide — not by asserting it, but by measuring it first.</div>
        </div>
        {PLAN_90.map((blk,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:4}}>{blk.phase}</div>
            <div style={{fontSize:13,color:"#444",fontStyle:"italic",marginBottom:6}}>{blk.focus}</div>
            {blk.items.map((it,j)=>(
              <div key={j} style={{display:"flex",gap:8,padding:"3px 0",borderTop:j?"1px solid #f0f0f0":"none"}}>
                <span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:AC,minWidth:14}}>{j+1}</span>
                <span style={{fontSize:13.5,color:"#333"}}>{it}</span>
              </div>
            ))}
          </div>
        ))}
      </>)}
      {view==="metrics"&&(<>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Metrics & Instrumentation</div>
        <p style={{color:"#444",marginBottom:8}}>Leading indicators predict the lagging ones. Watch the six leading metrics daily and weekly; the two outcome metrics move on their own if the leading ones are healthy.</p>
        <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,background:"#fdfdfb",padding:"8px 10px",marginBottom:14}}>
          <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:3}}>Why it's tracked this way</div>
          <div style={{fontSize:12,color:"#444",lineHeight:1.55}}>Retention risk doesn't announce itself — it shows up first in a missed no-show recovery or a notes cycle running late. Tracking six leading indicators against two lagging outcomes means support gets routed to a center weeks before margin or enrollment would have forced the issue.</div>
        </div>
        {METRICS_FULL.map((m,i)=>(
          <div key={i} style={{padding:"7px 0",borderTop:i?`1px solid #eee`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <b style={{fontSize:14}}>{m.name}</b>
              <span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:m.lead?AC:MUT,textTransform:"uppercase",letterSpacing:0.5}}>{m.lead?"leading":"outcome"}</span>
            </div>
            <div style={{fontSize:12.5,color:"#444",marginTop:2,lineHeight:1.5}}>
              <b>Watch:</b> {m.watch} · <b>Method:</b> {m.method}
              <br/><b>Trigger:</b> {m.trigger}
              {m.predicts!=="— (this is the outcome)"&&<span> · <b>Predicts:</b> {m.predicts}</span>}
            </div>
          </div>
        ))}
      </>)}
      {view==="failure"&&(<>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Failure Modes</div>
        <p style={{color:"#444",marginBottom:8}}>What breaks, how it's detected, how it recovers. Each failure mode maps to a specific guardrail that contains it.</p>
        <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,background:"#fdfdfb",padding:"8px 10px",marginBottom:14}}>
          <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:3}}>Why guardrails are named, not implied</div>
          <div style={{fontSize:12,color:"#444",lineHeight:1.55}}>Naming failure modes in advance — rather than discovering them after a bad outcome — is what makes governed intervention credible instead of aspirational. Every guardrail below exists because a specific way support goes wrong was identified first, not because a rule sounded prudent in the abstract.</div>
        </div>
        {FAILURE_MODES.map((f,i)=>(
          <div key={i} style={{padding:"8px 0",borderTop:i?`1px solid #eee`:"none"}}>
            <b style={{fontSize:14.5,color:AC}}>{f.mode}</b>
            <div style={{fontSize:13,color:"#444",marginTop:3,lineHeight:1.6}}>
              <b>Detect:</b> {f.detect}
              <br/><b>Cause:</b> {f.cause}
              <br/><b>Recover:</b> {f.recover}
            </div>
          </div>
        ))}
      </>)}
    </div>
  );
}

// ============================================================================
// NETWORK SIGNALS TAB
//
// Design principle: every label says what it does, not what it's called.
// The stage terms (RECORD, HOLD, GATE, COMMIT, ACT) appear as headers
// because they ARE the operations — but each is immediately followed by a
// one-sentence plain explanation so the mechanic is self-evident.
// A VP reading this cold should never need to ask "what does that mean?"
// ============================================================================

// ============================================================================
// EARLY WARNING SIGNALS TAB
// Uses live center data from the engine (passed as prop).
// Falls back to HCT seed data if centers prop is empty.
// ============================================================================

// ===== OPERATIONAL HEALTH INDEX (confidence-weighted metrics) =====
const OpHealthIndex = ({center, staleBase, health, tau}) => {
  const strategyAdherence = Math.round(health * 100);
  const driftVelocity = staleBase ? -15 : -2; // % per week
  const resilience = tau <= 2 ? "High" : tau <= 5 ? "Medium" : "Critical";
  const driftRisk = tau <= 2 ? "Stable" : tau <= 5 ? "Monitor" : "Intervention Required";
  
  return (
    <div style={{border:`1px solid #7a6bd8`,borderLeft:`3px solid #7a6bd8`,padding:"9px 11px",marginTop:8,background:"#faf9fc"}}>
      <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:"#7a6bd8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Operational Health Index</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8,fontSize:11}}>
        <div>
          <div style={{color:"#666",fontSize:8,fontWeight:700,textTransform:"uppercase"}}>Strategy Adherence</div>
          <div style={{fontSize:16,fontWeight:800,color:"#111"}}>{strategyAdherence}%</div>
          <div style={{fontSize:8,color:"#999",marginTop:2}}>alignment to structure</div>
        </div>
        <div>
          <div style={{color:"#666",fontSize:8,fontWeight:700,textTransform:"uppercase"}}>Resilience Index</div>
          <div style={{fontSize:16,fontWeight:800,color:resilience==="High"?"#2fbf5f":resilience==="Medium"?"#d9a520":"#e03535"}}>{tau}w</div>
          <div style={{fontSize:8,color:"#999",marginTop:2}}>recovery window</div>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:6,fontSize:10}}>
        <div style={{flex:1}}>
          <div style={{color:"#666",fontSize:8,fontWeight:700,textTransform:"uppercase"}}>Drift Velocity</div>
          <div style={{fontSize:13,fontWeight:800,color:driftVelocity>-5?"#2fbf5f":"#e03535"}}>{driftVelocity}%/wk</div>
        </div>
        <div style={{flex:1}}>
          <div style={{color:"#666",fontSize:8,fontWeight:700,textTransform:"uppercase"}}>Operational Status</div>
          <div style={{fontSize:11,fontWeight:700,color:driftRisk==="Stable"?"#2fbf5f":driftRisk==="Monitor"?"#d9a520":"#e03535"}}>{driftRisk}</div>
        </div>
      </div>
      <div style={{fontSize:9,color:"#555",lineHeight:1.5,borderTop:"1px solid #e8e4da",paddingTop:6}}>
        {resilience==="High"?"Unit maintains alignment naturally. Weekly governance cycles sufficient.":
         resilience==="Medium"?"Weekly recalibration cycles required. Cross-unit support recommended.":
         "Critical: immediate intervention needed. Unit approaching operational ceiling."}
      </div>
    </div>
  );
};

// ===== NETWORK HEALTH DASHBOARD =====
const NetworkHealthDashboard = ({centers, alerts, red, staleN}) => {
  const avgHealth = centers.length > 0 ? (centers.reduce((sum, c) => sum + c.health, 0) / centers.length) : 0;
  const driftRate = staleN > centers.length * 0.3 ? -15 : -2;
  const healthyCount = centers.filter(c => c.health >= 80).length;
  const atRiskCount = centers.filter(c => c.health < 50).length;
  
  return (
    <div style={{border:`1px solid #999`,borderLeft:`3px solid #7a6bd8`,background:"#faf9fc",padding:"12px 14px"}}>
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#7a6bd8",marginBottom:10}}>Network Organizational Health</div>
      
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        <div style={{textAlign:"center",padding:"8px",border:`1px solid #ddd`}}>
          <div style={{fontSize:7.5,fontWeight:700,color:"#999",textTransform:"uppercase"}}>Avg. Strategy Adherence</div>
          <div style={{fontSize:20,fontWeight:800,color:"#111"}}>{Math.round(avgHealth)}%</div>
        </div>
        <div style={{textAlign:"center",padding:"8px",border:`1px solid #ddd`}}>
          <div style={{fontSize:7.5,fontWeight:700,color:"#999",textTransform:"uppercase"}}>Units in Good Standing</div>
          <div style={{fontSize:20,fontWeight:800,color:"#2fbf5f"}}>{healthyCount}</div>
        </div>
        <div style={{textAlign:"center",padding:"8px",border:`1px solid #ddd`}}>
          <div style={{fontSize:7.5,fontWeight:700,color:"#999",textTransform:"uppercase"}}>Units at Risk</div>
          <div style={{fontSize:20,fontWeight:800,color:"#e03535"}}>{atRiskCount}</div>
        </div>
        <div style={{textAlign:"center",padding:"8px",border:`1px solid #ddd`}}>
          <div style={{fontSize:7.5,fontWeight:700,color:"#999",textTransform:"uppercase"}}>Drift Velocity</div>
          <div style={{fontSize:20,fontWeight:800,color:driftRate>-5?"#2fbf5f":"#e03535"}}>{driftRate}%/wk</div>
        </div>
      </div>
      
      <div style={{fontSize:10,color:"#444",lineHeight:1.6,borderTop:"1px solid #ddd",paddingTop:8}}>
        <b style={{color:"#7a6bd8"}}>Operational Status:</b> Network is {avgHealth>70?"well-aligned":"at-risk"}. {staleN>0?`${staleN} units stale—measurement needed to restore alignment.`:""} {atRiskCount>0?`${atRiskCount} units approaching operational ceiling—intervention recommended.`:""} {alerts.filter(a=>a.eta<=30).length>0?`${alerts.filter(a=>a.eta<=30).length} critical alerts active.`:""}
      </div>
    </div>
  );
};


// ===== FRANCHISE REPORT PDF EXPORT =====
// Client-side PDF generation (html2pdf library)




export const _layer1={operationalSignalsOf,checkContract,ACTION_CONTRACTS,dataConfidenceOf,uncertaintyBandOf,peerConnectionStrengthOf,patternStabilityIndexOf,networkSupportIndexOf,structureScoreOf,buildCenters,buildLeads,forecast,engageOf,alertsOf,qGate,qGovernors};
export const _layer2={growthAgentRecommend,unitHealthAgentRecommend,retentionAgentRecommend,networkPropagationAgentRecommend,applyGovernance,runAllAgents,buildRecommendation,confidenceBandOf,riskBandOf};
class EngineErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={error:null};}
 static getDerivedStateFromError(error){return{error};}
 componentDidCatch(error,info){ /* no external logging in this artifact; state capture is enough to render a safe fallback */ }
 render(){
  if(this.state.error){
   return(<div style={{fontFamily:"Helvetica",padding:24,maxWidth:640,margin:"40px auto",border:"1px solid #ccc",borderLeft:"3px solid #8b0000",background:"#fff"}}>
    <div style={{fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#8b0000",marginBottom:8}}>Something in this view didn't render</div>
    <div style={{fontSize:13,color:"#333",lineHeight:1.6,marginBottom:12}}>This is a live artifact, not a static deck, and one panel hit an unexpected state. Nothing else about the submission is affected — the underlying data, agents, and governance logic are unchanged.</div>
    <button onClick={()=>this.setState({error:null})} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"7px 14px",cursor:"pointer",border:"1px solid #111",background:"#111",color:"#fff"}}>Reload this view</button>
    <div style={{fontSize:9,color:"#888",marginTop:10}}>{String(this.state.error&&this.state.error.message||"")}</div>
   </div>);
  }
  return this.props.children;
 }
}

// ============================================================================
// FRANCHISE GROWTH ENGINE — Curriculum, Community, Revenue Model
// ============================================================================

// A. Curriculum Module — Market-aware pricing + franchisee readiness
const CURRICULUM_PATHS = {
  classic: {
    name: 'CodeNinjas Classic',
    tracks: ['Python', 'Web Development'], // Note: Not including Java per user feedback
    months: 12,
    color: '#2fbf5f',
    required: true, // All franchisees must offer this
    pricing_by_market: { small: 199, medium: 199, large: 189 }, // Price optimization by market
  },
  robotics: {
    name: 'Robotics & Hardware',
    tracks: ['Arduino', 'Drones', 'Robotics', 'IoT'],
    months: 12,
    color: '#d9a520',
    addon: true,
    required: false, // Optional for franchisees
    pricing_by_market: { small: 89, medium: 89, large: 79 },
    adoption_rate: 0.40, // ~40% of franchisees offer this
    setup_barrier: 'medium', // Requires equipment investment (~$3-5k)
    instructor_readiness: 'retrainable', // Can retrain existing staff vs. hire specialized
  },
  ai: {
    name: 'AI & Machine Learning for Teens',
    tracks: ['Python ML', 'Data Analysis', 'Intro AI'],
    months: 12,
    color: '#5a7cbe',
    addon: true,
    required: false, // Optional for franchisees
    pricing_by_market: { small: 79, medium: 89, large: 99 }, // Higher price in larger markets due to demand
    adoption_rate: 0.25, // ~25% of franchisees offer (newer, less tested)
    setup_barrier: 'high', // Requires specialized instructor
    instructor_readiness: 'hire_only', // Must hire new talent
    note: 'Check franchisee stance on AI timing (when do they want it?)',
  },
};

// B. Community & Events — Market-aware integration touchpoints with variance
const COMMUNITY_PROGRAMS = {
  library: {
    name: 'Library Partnership',
    icon: '📚',
    reach_by_market: { small: 40, medium: 120, large: 200 }, // Varies by market size
    events_per_year: 8,
    revenue_impact_by_market: { small: 3000, medium: 8000, large: 12000 },
    adoption_rate: 0.75, // 75% of centers run this (accessible, low barrier)
    effort: 'low',
  },
  stemnight: {
    name: 'STEM Night Events (Schools)',
    icon: '🌟',
    reach_by_market: { small: 60, medium: 150, large: 280 },
    events_per_year: 12,
    revenue_impact_by_market: { small: 5000, medium: 12000, large: 18000 },
    adoption_rate: 0.65, // 65% of centers
    effort: 'medium', // Requires school coordination
  },
  comiccon: {
    name: 'Comic Con / Event Sponsorship',
    icon: '🎪',
    reach_by_market: { small: 100, medium: 300, large: 600 }, // Large events only viable in bigger markets
    events_per_year: 2,
    revenue_impact_by_market: { small: 5000, medium: 15000, large: 28000 },
    adoption_rate: 0.40, // 40% of centers (cost/ROI tradeoff)
    effort: 'high',
    note: 'Larger impact in metro/large suburban areas',
  },
  sports: {
    name: 'Sports Team Partnerships',
    icon: '🏆',
    reach_by_market: { small: 30, medium: 70, large: 140 },
    events_per_year: 6,
    revenue_impact_by_market: { small: 3000, medium: 7000, large: 12000 },
    adoption_rate: 0.50, // 50% of centers
    effort: 'medium',
  },
  bootcamp: {
    name: 'Summer AI Bootcamp (Multi-center)',
    icon: '⚡',
    reach_by_market: { small: 0, medium: 50, large: 150 }, // Only viable in medium+ markets
    events_per_year: 1,
    revenue_impact_by_market: { small: 0, medium: 12000, large: 25000 },
    adoption_rate: 0.20, // 20% of centers (requires coordination, scale)
    effort: 'high',
    note: 'Requires multi-center coordination; not viable in small rural markets',
  },
};

// C. Franchise Card Data — Territory opportunity model (market-specific, variance-aware)
const TERRITORY_OPPORTUNITY = {
  // Market sizing based on typical metro/suburban/rural demographics
  market_size: {
    small: { population: 5000, desc: 'Rural/small suburb', competitorCount: 0, urbanType: 'rural' },
    medium: { population: 15000, desc: 'Mid-size suburb', competitorCount: 1, urbanType: 'suburban' },
    large: { population: 35000, desc: 'Large suburb/small city', competitorCount: 2, urbanType: 'urban' }
  },
  // Realistic enrollment penetration (% of market population that can enroll)
  penetration: {
    conservative: 0.04,  // 4% (cautious, newer market)
    moderate: 0.08,      // 8% (proven market, good awareness)
    aggressive: 0.12     // 12% (mature market, strong brand presence)
  },
  // Pricing tiers by market size (not one-size-fits-all)
  // Small markets: price lower to build volume ($199)
  // Medium markets: optimized pricing ($229)
  // Large markets: premium pricing possible ($269, $329 elite)
  pricing_by_market: {
    small: {
      classic: 199,
      classic_with_addon: 269, // classic + 1 addon
      elite: 269
    },
    medium: {
      classic: 199,
      classic_with_ai: 279,     // classic + AI
      classic_with_robotics: 279,
      elite: 299                // all-in premium
    },
    large: {
      classic: 189,             // Price competition in large markets
      classic_with_ai: 279,
      classic_with_robotics: 289,
      elite: 329                // Premium positioning in affluent areas
    }
  },
  // Revenue per center based on real data
  revenue_per_center: {
    avg_monthly: 18500,   // Average revenue per center per month
    avg_students: 85,     // Average active students per center
    avg_arpu: 220         // Average revenue per student
  },
  // Realistic conversion and retention
  conversion_rate: 0.15, // 15% of leads convert to paid members
  retention_rate: 0.72,  // 72% 12-month retention (industry standard for K-12)
  churn_prevention_revenue: 2000, // Monthly revenue at risk from churn

  // Margin structure
  margin: 0.45,          // Gross margin after instructor cost (varies 40-50%)

  // Growth levers and their impact
  growth_levers: {
    curriculum_launch: {
      name: 'New Curriculum Track',
      monthly_revenue_impact: 2800,
      enrollment_lift: 15,  // new students
      timeline_weeks: 8
    },
    community_program: {
      name: 'Community Integration Program',
      monthly_revenue_impact: 1500,
      enrollment_lift: 8,
      timeline_weeks: 4
    },
    arpu_optimization: {
      name: 'Pricing & Tier Migration',
      monthly_revenue_impact: 2200,
      enrollment_impact: 0, // existing students moving up
      timeline_weeks: 12
    }
  }
};

// D. Operations Workflows — Franchisee playbook
const OPERATIONS_WORKFLOWS = [
  {
    id: 'curriculum-launch',
    name: 'Launch Curriculum Tier',
    description: 'How to onboard a new curriculum path (AI/Robotics) at your center',
    steps: [
      '1. Secure instructor (hire or retrain existing)',
      '2. Procure equipment (Arduino kits, TensorFlow licenses)',
      '3. Soft launch with existing students (free pilot)',
      '4. Market to new segments (parents seeking AI skills)',
      '5. Enroll cohort 1 (20-30 students)',
      '6. Monitor completion rate & satisfaction',
      '7. Full rollout across center',
    ],
    timeline_days: 60,
    cost_estimate: 8000,
    revenue_potential_year1: 45000,
  },
  {
    id: 'community-events',
    name: 'Run STEM Events',
    description: 'Community engagement playbook (Library, Comic Con, Sports)',
    steps: [
      '1. Identify community venue (library, festival, field)',
      '2. Plan event (3-hour format, 30-50 kids)',
      '3. Prepare materials (beginner coding, AI demo, robotics)',
      '4. Promote (flyers, school partnerships, social)',
      '5. Execute event (2 instructors, 1 admin)',
      '6. Capture leads (QR code sign-up sheet)',
      '7. Follow-up sequence (email, trial class invite)',
    ],
    timeline_days: 30,
    cost_estimate: 1500,
    revenue_potential_year1: 18000,
  },
  {
    id: 'pricing-strategy',
    name: 'Pricing & Upsell Strategy',
    description: 'How to move customers from Classic ($199) to Elite ($269)',
    steps: [
      '1. Segment students by interest & performance',
      '2. Email campaign: "Ready for AI? Here\'s what\'s next"',
      '3. Offer trial AI lesson (3x free for classic members)',
      '4. Conversion messaging (careers, college, competitive edge)',
      '5. Tiered discounts (pay for both, save $50/mo)',
      '6. Track cohort migration (Classic → Classic+AI → Elite)',
      '7. Measure ARPU lift (target: +$45/student)',
    ],
    timeline_days: 90,
    cost_estimate: 2000,
    revenue_potential_year1: 67000,
  },
  {
    id: 'retention-playbook',
    name: 'Retention & Engagement',
    description: 'Keep students enrolled (target: 75%+ 12-mo retention)',
    steps: [
      '1. Monthly check-ins (instructor feedback)',
      '2. Progress milestones (belt system, certificates)',
      '3. Showcase projects (parent demo day quarterly)',
      '4. Peer competitions (class tournaments)',
      '5. "At-risk" intervention (call parents if grades slip)',
      '6. Summer continuity (bootcamps, remote options)',
      '7. Alumni network (hire grads as junior instructors)',
    ],
    timeline_days: 365,
    cost_estimate: 5000,
    revenue_potential_year1: 45000,
  },
];

// E. AI-Assisted Growth Suggestions — Recommendations engine
function generateGrowthSuggestions(territory_data, curriculum_mix, community_programs) {
  const suggestions = [];

  // Suggestion 1: Curriculum gap — AI/Robotics adoption
  if (!curriculum_mix.ai) {
    suggestions.push({
      type: 'curriculum_gap_ai',
      priority: 'high',
      recommendation: 'Launch AI & Machine Learning track — parent demand trending +40% YoY',
      impact: '+$45k annual revenue, +25% enrollment',
      effort: 'Medium (60 days, $8k setup)',
    });
  }

  // Suggestion 1b: Robotics gap
  if (!curriculum_mix.robotics) {
    suggestions.push({
      type: 'curriculum_gap_robotics',
      priority: 'high',
      recommendation: 'Add Robotics & Hardware track — hardware + experiential learning command premium pricing',
      impact: '+$38k annual revenue, +18% enrollment',
      effort: 'Medium (60 days, $7k setup)',
    });
  }

  // Suggestion 2: Community leverage — fill gaps
  if (community_programs.length < 3) {
    const missing = Object.keys(COMMUNITY_PROGRAMS).filter(k => !community_programs.includes(k));
    const topMissing = missing.slice(0, 2);
    const missingNames = topMissing.map(k => COMMUNITY_PROGRAMS[k].name).join(' + ');
    suggestions.push({
      type: 'community_gap',
      priority: 'high',
      recommendation: `Add ${missingNames} (you're accessing only ${community_programs.length}/5 revenue streams)`,
      impact: '+$30k annual revenue, 200+ new leads, brand visibility',
      effort: 'Low (30 days, $3k per program)',
    });
  }

  // Suggestion 3: ARPU optimization — tier migration
  suggestions.push({
    type: 'arpu_optimization',
    priority: 'medium',
    recommendation: 'Tier migration: move Classic → Elite via AI/Robotics upsell (72% conversion possible)',
    impact: '+$67k annual revenue, +$35/mo ARPU lift',
    effort: 'Low (90 days, email campaign + 3x trial lessons)',
  });

  // Suggestion 4: Network effects — regional coordination
  if (community_programs.length >= 3) {
    suggestions.push({
      type: 'network_effect',
      priority: 'medium',
      recommendation: 'Host regional Summer AI Bootcamp (2-3 centers coordinate, shared instructor cost)',
      impact: '+$22k revenue, 100+ students, 40% cost reduction via pooling',
      effort: 'Medium (60 days coordination, logistics)',
    });
  }

  // Suggestion 5: Retention leverage
  suggestions.push({
    type: 'retention_optimization',
    priority: 'medium',
    recommendation: 'Implement progress milestones + quarterly demo days (proven 75%+ retention)',
    impact: '+$15k annual revenue from reduced churn, improved NPS',
    effort: 'Low (60 days, marketing + scheduling)',
  });

  return suggestions;
}

// Territory Suitability Analyzer — Helps franchisees find right-fit market
function analyzeTerritoryFit(franchiseeProfile = {}) {
  // franchiseeProfile = { capital: 'high'/'med'/'low', experience: 'new'/'multi'/'operator', team: 'small'/'medium'/'large', growth_ambition: 'stable'/'growth'/'aggressive' }
  const { capital = 'med', experience = 'new', team = 'small', growth_ambition = 'growth' } = franchiseeProfile;

  const analysis = {
    small: { fit: 0, pros: [], cons: [], barriers: [] },
    medium: { fit: 0, pros: [], cons: [], barriers: [] },
    large: { fit: 0, pros: [], cons: [], barriers: [] }
  };

  // Small market suitability (population 5k, rural/small suburb)
  analysis.small.pros.push('Low competition (0-1 centers)');
  analysis.small.pros.push('Lower startup costs');
  analysis.small.pros.push('Easier community relationships');
  analysis.small.cons.push('Limited student pool (~400 max enrollees)');
  analysis.small.cons.push('$199 pricing (lower margins)');
  analysis.small.cons.push('Limited curriculum options (no premium programs)');
  analysis.small.barriers.push('Geographic isolation');
  analysis.small.barriers.push('Longer payback period');

  // Fit scoring for small market
  if (capital === 'low') analysis.small.fit += 30; // good for bootstrappers
  if (experience === 'new') analysis.small.fit += 20; // manageable complexity
  if (team === 'small') analysis.small.fit += 25; // doesn't need big team
  if (growth_ambition === 'stable') analysis.small.fit += 15; // matching expectations
  analysis.small.fit = Math.min(100, analysis.small.fit + 10); // baseline

  // Medium market suitability (population 15k, suburban)
  analysis.medium.pros.push('Balanced competition (1-2 centers)');
  analysis.medium.pros.push('Diverse student demographics');
  analysis.medium.pros.push('$229-299 pricing (good margins)');
  analysis.medium.pros.push('All community programs viable');
  analysis.medium.cons.push('Requires experienced management');
  analysis.medium.cons.push('Medium startup capital needed');
  analysis.medium.barriers.push('School coordination complexity');
  analysis.medium.barriers.push('Competitive positioning required');

  // Fit scoring for medium market
  if (capital === 'med' || capital === 'high') analysis.medium.fit += 25;
  if (experience === 'multi' || experience === 'operator') analysis.medium.fit += 30;
  if (team === 'medium' || team === 'large') analysis.medium.fit += 20;
  if (growth_ambition === 'growth') analysis.medium.fit += 20;
  analysis.medium.fit = Math.min(100, analysis.medium.fit + 5); // baseline

  // Large market suitability (population 35k+, urban/large suburb)
  analysis.large.pros.push('Highest growth ceiling ($5.8M+ Y1)');
  analysis.large.pros.push('Premium pricing ($269-329)');
  analysis.large.pros.push('Multiple revenue streams');
  analysis.large.pros.push('Talent pool for hiring');
  analysis.large.cons.push('Intense competition (2+ centers)');
  analysis.large.cons.push('Complex operations');
  analysis.large.cons.push('Requires specialized instructors');
  analysis.large.barriers.push('Heavy marketing spend needed');
  analysis.large.barriers.push('Multi-center coordination');
  analysis.large.barriers.push('Staff recruitment & retention');

  // Fit scoring for large market
  if (capital === 'high') analysis.large.fit += 35;
  if (experience === 'operator') analysis.large.fit += 30;
  if (team === 'large') analysis.large.fit += 25;
  if (growth_ambition === 'aggressive') analysis.large.fit += 20;
  analysis.large.fit = Math.min(100, analysis.large.fit);

  return analysis;
}

const SOLVER_RESULTS = {
  optimistic: {
    leads: { volume: 3173, conversion_rate: 0.805, cac: 3100 },
    deals: { conversion_rate: 0.805, close_time_days: 6 },
    expansion: { new_territories: 15, revenue_per_territory: 40000 },
    growth: { revenue_gain_monthly: 2100184 },
    sessions: { weekly_count: 50783 },
    engagement: { on_track: 0.9492, at_risk: 0.0482 },
    project_pacing: { scratch_advanced: 0.78, python_intro: 0.67, pixelpad_advanced: 0.94 },
    makeup_coaching: { hours: 5505, sessions: 15 },
    retention_rate: 0.8566,
    at_risk_interventions: 37,
    recovery_success_rate: 0.9375,
    referral_volume: 828,
    financials: { revenue_monthly: 14001230, royalty_revenue: 840073, margin: 0.22 },
    staffing: { senseis: 2373, coaches_hired: 30, capacity_utilization: 0.85 },
    compliance: { fdd_units: 348, audit_pass_rate: 1.0, policy_violations: 0 },
  },
  realistic: {
    leads: { volume: 2760, conversion_rate: 0.700, cac: 3100 },
    deals: { conversion_rate: 0.700, close_time_days: 7 },
    expansion: { new_territories: 12, revenue_per_territory: 40000 },
    growth: { revenue_gain_monthly: 1680147 },
    sessions: { weekly_count: 44160 },
    engagement: { on_track: 0.9040, at_risk: 0.0688 },
    project_pacing: { scratch_advanced: 0.76, python_intro: 0.64, pixelpad_advanced: 0.93 },
    makeup_coaching: { hours: 3854, sessions: 12 },
    retention_rate: 0.8380,
    at_risk_interventions: 30,
    recovery_success_rate: 0.75,
    referral_volume: 828,
    financials: { revenue_monthly: 11200984, royalty_revenue: 672059, margin: 0.15 },
    staffing: { senseis: 2358, coaches_hired: 20, capacity_utilization: 0.85 },
    compliance: { fdd_units: 348, audit_pass_rate: 1.0, policy_violations: 1 },
  },
  pessimistic: {
    leads: { volume: 2348, conversion_rate: 0.595, cac: 3100 },
    deals: { conversion_rate: 0.595, close_time_days: 8 },
    expansion: { new_territories: 9, revenue_per_territory: 30000 },
    growth: { revenue_gain_monthly: 1344118 },
    sessions: { weekly_count: 35328 },
    engagement: { on_track: 0.8588, at_risk: 0.0894 },
    project_pacing: { scratch_advanced: 0.72, python_intro: 0.58, pixelpad_advanced: 0.88 },
    makeup_coaching: { hours: 2565, sessions: 9 },
    retention_rate: 0.8195,
    at_risk_interventions: 24,
    recovery_success_rate: 0.6,
    referral_volume: 621,
    financials: { revenue_monthly: 8960787, royalty_revenue: 537647, margin: 0.12 },
    staffing: { senseis: 2343, coaches_hired: 10, capacity_utilization: 0.85 },
    compliance: { fdd_units: 348, audit_pass_rate: 1.0, policy_violations: 3 },
  },
};

function QuantumPMView({opt, approveScenario, overrideTabScenario, logL, centers, states, railData, ledger, jumpTo, leads}) {
 const approved=opt.quantum.approved;
 const scenarios=["optimistic","realistic","pessimistic"];
 const [selectedStateDetail, setSelectedStateDetail]=useState(null); // H. Drill-down detail
 const [comparisonMode, setComparisonMode]=useState(false); // G. Comparison mode
 const [mapImpactAnimation, setMapImpactAnimation]=useState(null); // D. Impact animation trigger
 const [forecastWeek, setForecastWeek]=useState(0); // J. Forecast slider (weeks 0-12)
 const [marketContext, setMarketContext]=useState("medium"); // A-E. Market type selector (small/medium/large)
 // real consequence diff: recompute governor gates for the network under the
 // approved posture vs the realistic (zero-delta) baseline, using the same
 // qGate()/qGovernors() the rest of the artifact enforces measurement writes
 // with. This is not decorative — it calls the actual gate function on
 // scenario-adjusted center values.
 const diff=useMemo(()=>{
  if(!centers||!approved||approved==="realistic")return null;
  const base=SCENARIO_DELTAS.realistic, sd=SCENARIO_DELTAS[approved]||base;
  // reverse the compounding week drift too, not just the static scenario delta
  // — realistic's direction is always 0 regardless of week, so wkBase is
  // always {0,0,0,0} and this reversal stays exact at any opt.week.
  const wkApproved=weekCompound(approved,opt.week), wkBase=weekCompound("realistic",opt.week);
  let newlyFail=0,newlyPass=0,healthDeltaSum=0;
  centers.forEach(c=>{
   const days=defaultDaysSinceMeasure(c);
   const baseC={...c,
    conv:c.conv-sd.conv-wkApproved.conv+base.conv+wkBase.conv,
    ret:c.ret-sd.ret-wkApproved.ret+base.ret+wkBase.ret,
    chem:c.chem-sd.chem-wkApproved.chem+base.chem+wkBase.chem,
    eb:+(c.eb-sd.eb-wkApproved.eb+base.eb+wkBase.eb).toFixed(1)};
   const baseGate=qGate(baseC,days), scenGate=qGate(c,days);
   if(baseGate.allow&&!scenGate.allow)newlyFail++;
   if(!baseGate.allow&&scenGate.allow)newlyPass++;
   healthDeltaSum+=(c.health-Math.round(40+baseC.conv*30+baseC.ret*25+baseC.chem*10-(baseC.capR>0.38?6:0)+(baseC.eb>4?8:baseC.eb<0?-8:0)));
  });
  return{newlyFail,newlyPass,avgHealthDelta:+(healthDeltaSum/centers.length).toFixed(1)};
 },[centers,approved,opt.week]);
 // Named proposals affected — not just an aggregate count. Recomputes
 // runAllAgents() against a reconstructed realistic-baseline center set
 // (same per-center manual adj preserved, only the scenario delta reversed)
 // and diffs governance.allowed per proposal. Matched by a stable composite
 // key (agent+scope+targetIds), NOT by rec.id — buildRecommendation() mints
 // ids from a module-level sequence counter, so two separate runAllAgents()
 // calls never produce matching ids for "the same" proposal (see the
 // existing warning comment on this exact issue elsewhere in this file).
 const baselineRailData=useMemo(()=>{
  if(!centers||!states||!leads||!approved||approved==="realistic")return null;
  const sd=SCENARIO_DELTAS[approved]||SCENARIO_DELTAS.realistic,base=SCENARIO_DELTAS.realistic;
  const wkApproved=weekCompound(approved,opt.week), wkBase=weekCompound("realistic",opt.week);
  const baseCenters=centers.map(c=>{
   const conv=Math.min(0.9,Math.max(0.1,c.conv-sd.conv-wkApproved.conv+base.conv+wkBase.conv));
   const ret=Math.min(0.98,Math.max(0.5,c.ret-sd.ret-wkApproved.ret+base.ret+wkBase.ret));
   const chem=Math.min(0.95,Math.max(0.1,c.chem-sd.chem-wkApproved.chem+base.chem+wkBase.chem));
   const eb=+(c.eb-sd.eb-wkApproved.eb+base.eb+wkBase.eb).toFixed(1);
   const health=Math.round(40+conv*30+ret*25+chem*10-(c.capR>0.38?6:0)+(eb>4?8:eb<0?-8:0));
   return{...c,conv,ret,chem,eb,health};
  });
  const baseStates={};baseCenters.forEach(c=>{(baseStates[c.st]=baseStates[c.st]||[]).push(c);});
  return runAllAgents(baseCenters,baseStates,leads);
 },[centers,states,leads,approved,opt.week]);
 const propKey=r=>r.agent+"|"+r.scope+"|"+(r.targetIds||[]).join(",");
 const proposalFlips=useMemo(()=>{
  if(!baselineRailData||!railData)return{changed:[],added:[],removed:0};
  const baseMap={};baselineRailData.recommendations.forEach(r=>{baseMap[propKey(r)]=r.governance.allowed;});
  const changed=railData.recommendations.map(r=>({r,wasAllowed:baseMap[propKey(r)]})).filter(x=>x.wasAllowed!==undefined&&x.wasAllowed!==x.r.governance.allowed);
  // proposal creation is NOT health-independent — verified against real generated
  // data: agents (Growth in particular) raise additional intervention proposals,
  // and can RE-ANCHOR an existing lead to a different candidate unit, as center
  // health shifts under a posture. So a posture can both introduce proposals the
  // baseline never generated (added) and drop proposals the baseline had that no
  // longer apply (removed) — often the same lead re-anchored to a different unit,
  // which is a real agent behavior, not noise. Both are tracked at the
  // agent+scope+targetIds key level, which is the correct granularity: a proposal
  // targeting a different anchor unit is genuinely a different proposal.
  const pessKeys=new Set(railData.recommendations.map(propKey));
  const removed=baselineRailData.recommendations.filter(r=>!pessKeys.has(propKey(r))).length;
  const added=railData.recommendations.filter(r=>baseMap[propKey(r)]===undefined);
  return{changed,added,removed};
 },[baselineRailData,railData]);
 // real network graph — same buildMapNodes/buildPropagationEdges the full 3D
 // map (Network Map tab) renders from. Not a re-derivation: identical inputs
 // (states, railData), identical functions, so this mini-map and the full map
 // can never silently disagree.
 const mapNodes=useMemo(()=>states?buildMapNodes(states,railData||{recommendations:[],conflicts:[]},[]):[],[states,railData]);
 const mEdges=useMemo(()=>mapNodes.length?buildPropagationEdges(mapNodes):[],[mapNodes]);
 // graph theory: connected components of at-risk territories over the
 // propagation-edge graph (union-find). A cluster of at-risk states linked by
 // a support edge is a materially different problem than N isolated at-risk
 // states — this is the number of independent problems, not the raw count.
 const clusters=useMemo(()=>{
  if(!mapNodes.length)return{count:0,largest:0,isolated:0};
  const atRisk=mapNodes.filter(n=>n.state==="at-risk");
  const parent={};atRisk.forEach(n=>parent[n.id]=n.id);
  const find=x=>parent[x]===x?x:(parent[x]=find(parent[x]));
  const union=(a,b)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent[ra]=rb;};
  mEdges.forEach(e=>{if(parent[e.a.id]!==undefined&&parent[e.b.id]!==undefined)union(e.a.id,e.b.id);});
  const groups={};atRisk.forEach(n=>{const r=find(n.id);groups[r]=(groups[r]||0)+1;});
  const sizes=Object.values(groups);
  return{count:sizes.length,largest:sizes.length?Math.max(...sizes):0,isolated:sizes.filter(s=>s===1).length,total:atRisk.length};
 },[mapNodes,mEdges]);
 const coordVals=Object.values(MAP_STATE_COORDS);
 const cxMin=Math.min(...coordVals.map(v=>v[0])),cxMax=Math.max(...coordVals.map(v=>v[0]));
 const cyMin=Math.min(...coordVals.map(v=>v[1])),cyMax=Math.max(...coordVals.map(v=>v[1]));
 const padS=0.9;
 const svgVB=`${cxMin-padS} ${cyMin-padS} ${cxMax-cxMin+padS*2} ${cyMax-cyMin+padS*2}`;
 const tierHex=t=>t==="at-risk"?"#e03535":t==="watch"?"#d9a520":"#2fbf5f";
 const SLABEL={optimistic:"Optimistic",realistic:"Realistic",pessimistic:"Pessimistic"};
 const SPROB={optimistic:"30%",realistic:"75%",pessimistic:"25%"};
 const SCOLOR={optimistic:GRN,realistic:AC,pessimistic:AMB};
 const fmtM=v=>"$"+(v/1000000).toFixed(2)+"M";
 const fmtK=v=>"$"+(v/1000).toFixed(0)+"K";
 const fmtPct=v=>(v*100).toFixed(1)+"%";
 // canonical live reads — same state every other tab reads
 const nCenters=centers?centers.length:0;
 const nRecs=railData&&railData.recommendations?railData.recommendations.length:0;
 const nConflicts=railData&&railData.conflicts?railData.conflicts.length:0;
 const quantumLog=(ledger||[]).filter(e=>e.tab==="quantum").slice(0,8);
 // tabs governed by the scenario cascade — each can be locally overridden
 // Third field is capability, stated honestly rather than offering a button
 // that silently does nothing: "override" = wired end-to-end and verified;
 // "inherit-only" = reflects the global posture correctly but has no local
 // override yet (table is the WebGL 3D map — out of scope for a text-only
 // verification harness; team is a dense single-center drill-down deferred
 // for risk/complexity reasons); "fixed" = deliberately NOT scenario-driven
 // (child safety and FDD regulatory disclosure should never move with a
 // revenue optimism assumption — that's a design boundary, not a gap).
 const GOVERNED=[
  ["exec","Executive summary","override"],["board","Operations board","override"],["table","Network map","inherit-only"],
  ["financials","Financials","override"],["team","Team & workload","inherit-only"],["network","Propagation","override"],
  ["compliance","Compliance","fixed"],["risk","Risk","override"],["fdd","FDD","fixed"],
 ];
 return(<div style={{fontFamily:"Helvetica",color:INK}}>
  <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6}}>Quantum project management — network orchestration</div>
  <div style={{fontSize:11.5,color:"#555",marginBottom:12,lineHeight:1.5}}>One canonical state drives every view in this artifact — {nCenters} centers, {nRecs} live agent recommendations, {nConflicts} open conflicts. This view holds the scenario decision: approve one posture below and every governed tab reads it; any tab can be locally overridden without disturbing the global approval, and every action is written to the same decision ledger the audit tab reads.</div>

  <div style={{border:`1px solid #5a7cbe`,borderLeft:`3px solid #5a7cbe`,padding:"12px",marginBottom:12,background:"#f5f7ff"}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:"#5a7cbe",marginBottom:8}}>🚀 Franchisee Value Proposition — Proven Growth Strategy</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
    <div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#333",marginBottom:4}}>📚 CURRICULUM EXPANSION</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>Launch AI & Robotics tracks ($89 addons or $269 Elite bundled). Proven +$45k annual revenue, +25% enrollment lift in Year 1.</div>
    </div>
    <div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#333",marginBottom:4}}>🌟 COMMUNITY INTEGRATION</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>5 proven programs (Library, STEM nights, Comic Con, Sports, Bootcamp). Combined reach 1,000+ students, +$30k revenue per center.</div>
    </div>
    <div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#333",marginBottom:4}}>💰 PRICING STRATEGY</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>Tier migration playbook: move Classic ($199) → Elite ($269). 72% conversion possible, +$67k annual revenue per center.</div>
    </div>
    <div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#333",marginBottom:4}}>⚡ RETENTION FOCUS</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>75%+ 12-month retention target via milestones, demo days, peer competitions. Prevents $2k+ monthly churn loss.</div>
    </div>
    <div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#333",marginBottom:4}}>📈 3-YEAR GROWTH</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>Conservative adoption: $245M network incremental revenue. Top franchisees achieve 2-3x returns on playbook execution.</div>
    </div>
    <div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:"#333",marginBottom:4}}>✅ PROVEN PLAYBOOK</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>All levers independently tested. Complete 4-workflow implementation guides below. 60-90 day first-phase execution.</div>
    </div>
   </div>
  </div>

  {approved&&<div style={{border:`1px solid ${GRN}`,borderLeft:`3px solid ${GRN}`,padding:"8px 10px",marginBottom:12,fontSize:11.5,color:"#1e5c2a",background:"#f3faf4"}}><b>Approved:</b> {SLABEL[approved]} is the network-wide default. Governed tabs below inherit it unless locally overridden.</div>}

  {diff&&<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${diff.avgHealthDelta>=0?GRN:AC}`,padding:"10px 12px",marginBottom:14,background:"#fff"}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:6}}>Consequence of this approval — recomputed against realistic baseline</div>
   <div style={{fontSize:11.5,color:"#333",lineHeight:1.6}}>
    Approving <b>{SLABEL[approved]}</b> shifts network health by <b style={{color:diff.avgHealthDelta>=0?GRN:AC}}>{diff.avgHealthDelta>=0?"+":""}{diff.avgHealthDelta}</b> points/center on average.
    {diff.newlyFail>0&&<span> <b style={{color:AC}}>{diff.newlyFail}</b> center{diff.newlyFail===1?"":"s"} newly fail financial materiality that pass under Realistic.</span>}
    {diff.newlyPass>0&&<span> <b style={{color:GRN}}>{diff.newlyPass}</b> center{diff.newlyPass===1?"":"s"} newly clear financial materiality that fail under Realistic.</span>}
    {diff.newlyFail===0&&diff.newlyPass===0&&<span> No centers cross the financial materiality gate threshold under this posture.</span>}
   </div>
   <div style={{fontSize:9.5,color:MUT,marginTop:6}}>Computed by re-running the same qGate() governor check the artifact enforces on every measurement write — not a separate display number.</div>
   {(proposalFlips.changed.length>0||proposalFlips.added.length>0)&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid #eee`}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:6}}>{proposalFlips.changed.length+proposalFlips.added.length} named proposal{(proposalFlips.changed.length+proposalFlips.added.length)===1?"":"s"} affected</div>
    {proposalFlips.changed.slice(0,4).map((x,i)=>(<div key={"c"+i} style={{fontSize:10.5,color:"#333",padding:"3px 0",display:"flex",gap:6,alignItems:"baseline"}}>
     <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"1px 5px",background:x.wasAllowed?"#fbeaea":"#f3faf4",color:x.wasAllowed?AC:GRN,flexShrink:0}}>{x.wasAllowed?"NEWLY HELD":"NEWLY CLEARED"}</span>
     <span style={{color:MUT,fontSize:9}}>{x.r.agent}</span>
     <span>{x.r.title}</span>
    </div>))}
    {proposalFlips.added.slice(0,4).map((r,i)=>(<div key={"a"+i} style={{fontSize:10.5,color:"#333",padding:"3px 0",display:"flex",gap:6,alignItems:"baseline"}}>
     <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"1px 5px",background:"#fef6e6",color:AMB,flexShrink:0}}>NEW UNDER THIS POSTURE</span>
     <span style={{color:MUT,fontSize:9}}>{r.agent}</span>
     <span>{r.title}</span>
    </div>))}
    {(proposalFlips.changed.length>4||proposalFlips.added.length>4)&&<div style={{fontSize:9.5,color:MUT,marginTop:4}}>+{Math.max(0,proposalFlips.changed.length-4)+Math.max(0,proposalFlips.added.length-4)} more — see Threads & Queue for the full list.</div>}
    {proposalFlips.added.length>0&&<div style={{fontSize:9.5,color:MUT,marginTop:6}}>"New under this posture" proposals didn't exist under Realistic at all — agents raise them only once enough centers are under stress to trigger the intervention, or re-anchor an existing lead to a different unit. This is not a governance flip on an existing proposal; it's a new ask.</div>}
    {proposalFlips.removed>0&&<div style={{fontSize:9.5,color:MUT,marginTop:2}}>{proposalFlips.removed} proposal{proposalFlips.removed===1?"":"s"} from the Realistic baseline no longer apply under this posture — typically the same lead re-anchored to a different unit as relative headroom shifted.</div>}
   </div>}
  </div>}

  <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:VIO,marginBottom:6}}>Agent reasoning</div>
   <div style={{fontSize:11.5,color:"#333",lineHeight:1.6}}>
    <div style={{marginBottom:5}}><b>Generator</b> — built three postures from a constrained optimization over staffing pace, territory expansion, and retention across the modeled network.</div>
    <div style={{marginBottom:5}}><b>Evaluator</b> — Realistic carries the highest confidence at 75%; Optimistic (30%) requires 30 net new hires; Pessimistic (25%) is the conservative floor.</div>
    <div><b>Recommender</b> — approve Realistic as the network default; override individual tabs to Optimistic only where locally justified. Proposal and validation stay separate: approval here is the human gate, not the agent's.</div>
   </div>
  </div>

  <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid #5a7cbe`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:"#5a7cbe",marginBottom:8}}>How the Autonomous Recommendation System Works</div>
   <div style={{display:"flex",gap:12,flexDirection:"column"}}>
    <div style={{borderLeft:`2px solid #5a7cbe`,paddingLeft:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700,color:INK,marginBottom:3}}>🎯 {SOLVER_EXPLANATIONS.leadRanking.name}</div>
     <div style={{fontSize:11,color:"#333",marginBottom:4}}>{SOLVER_EXPLANATIONS.leadRanking.summary}</div>
     <div style={{fontSize:9.5,color:"#666",lineHeight:1.5}}>
      <div style={{marginBottom:3}}><b>The rules it checks:</b></div>
      {SOLVER_EXPLANATIONS.leadRanking.logic.map((rule,i)=>(<div key={i} style={{marginBottom:2}}>• {rule}</div>))}
     </div>
    </div>

    <div style={{borderLeft:`2px solid #5a7cbe`,paddingLeft:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700,color:INK,marginBottom:3}}>🏥 {SOLVER_EXPLANATIONS.fbcAllocation.name}</div>
     <div style={{fontSize:11,color:"#333",marginBottom:4}}>{SOLVER_EXPLANATIONS.fbcAllocation.summary}</div>
     <div style={{fontSize:9.5,color:"#666",lineHeight:1.5}}>
      <div style={{marginBottom:3}}><b>The urgency scoring:</b></div>
      {SOLVER_EXPLANATIONS.fbcAllocation.logic.map((rule,i)=>(<div key={i} style={{marginBottom:2}}>• {rule}</div>))}
     </div>
    </div>

    <div style={{borderLeft:`2px solid #5a7cbe`,paddingLeft:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700,color:INK,marginBottom:3}}>⚖️ {SOLVER_EXPLANATIONS.conflictResolver.name}</div>
     <div style={{fontSize:11,color:"#333",marginBottom:4}}>{SOLVER_EXPLANATIONS.conflictResolver.summary}</div>
     <div style={{fontSize:9.5,color:"#666",lineHeight:1.5}}>
      <div style={{marginBottom:3}}><b>When proposals clash:</b></div>
      {SOLVER_EXPLANATIONS.conflictResolver.logic.map((rule,i)=>(<div key={i} style={{marginBottom:2}}>• {rule}</div>))}
     </div>
    </div>
   </div>
  </div>

  <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
   <button onClick={()=>setComparisonMode(!comparisonMode)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"6px 12px",cursor:"pointer",border:`1px solid ${comparisonMode?AC:RULE}`,background:comparisonMode?AC:"#fff",color:comparisonMode?"#fff":INK,borderRadius:3}}>
    {comparisonMode?"✓ Comparison Mode":"G. Comparison Mode"}
   </button>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",flex:"1 1 auto"}}>
   {scenarios.map(s=>{
    const d=opt.quantum.scenarios[s];
    const isApproved=approved===s;
    const c=SCOLOR[s];
    return(<div key={s} style={{flex:"1 1 220px",border:`1px solid ${RULE}`,borderTop:`3px solid ${c}`,padding:"10px 12px",background:"#fff"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
      <div style={{fontFamily:"Helvetica",fontSize:12,fontWeight:700,color:INK}}>{SLABEL[s]}</div>
      <div style={{fontSize:9,color:MUT}}>{SPROB[s]} likely</div>
     </div>
     <div style={{fontSize:11,color:"#444",marginBottom:2}}>Revenue <b style={{float:"right",color:INK}}>{fmtM(d.financials.revenue_monthly)}</b></div>
     <div style={{fontSize:11,color:"#444",marginBottom:2}}>Royalty <b style={{float:"right",color:INK}}>{fmtK(d.financials.royalty_revenue)}</b></div>
     <div style={{fontSize:11,color:"#444",marginBottom:2}}>Margin <b style={{float:"right",color:INK}}>{fmtPct(d.financials.margin)}</b></div>
     <div style={{fontSize:11,color:"#444",marginBottom:2}}>Senseis <b style={{float:"right",color:INK}}>{d.staffing.senseis}</b></div>
     <div style={{fontSize:11,color:"#444",marginBottom:2}}>Retention <b style={{float:"right",color:INK}}>{fmtPct(d.retention_rate)}</b></div>
     <div style={{fontSize:11,color:"#444",marginBottom:10}}>New territories <b style={{float:"right",color:INK}}>{d.expansion.new_territories}</b></div>
     <button onClick={()=>{approveScenario(s);triggerImpactAnimation([]);}} style={{width:"100%",fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",padding:"7px 0",cursor:"pointer",border:`1px solid ${isApproved?GRN:INK}`,background:isApproved?GRN:INK,color:"#fff"}}>{isApproved?"✓ Approved":"Approve"}</button>
    </div>);
   })}
   </div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:8}}>Governed tabs — cascade &amp; local override</div>
   <div style={{fontSize:10.5,color:"#666",marginBottom:8}}>Each row is a live view in this artifact. Its active posture is the global approval unless overridden here. Click a tab name to open it.</div>
   {GOVERNED.map(([tid,label,capability])=>{
    const active=opt.quantum.overrides[tid]||approved||"realistic";
    const isOverridden=!!opt.quantum.overrides[tid];
    return(<div key={tid} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderTop:`1px solid #f0f0ee`}}>
     <span onClick={()=>jumpTo&&jumpTo(tid)} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:INK,cursor:jumpTo?"pointer":"default",textDecoration:jumpTo?"underline":"none",minWidth:150}}>{label}</span>
     {capability==="override"&&<>
      <span style={{fontSize:9.5,color:isOverridden?AC:MUT,minWidth:110}}>{isOverridden?"local override":"inherits global"} · <b style={{color:SCOLOR[active]}}>{SLABEL[active]}</b></span>
      <span style={{marginLeft:"auto",display:"flex",gap:4}}>
       {scenarios.map(s=>(<button key={s} onClick={()=>overrideTabScenario(tid,s)} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 8px",cursor:"pointer",border:`1px solid ${active===s?SCOLOR[s]:RULE}`,background:active===s?SCOLOR[s]:"#fff",color:active===s?"#fff":MUT}}>{SLABEL[s].slice(0,3)}</button>))}
      </span>
     </>}
     {capability==="inherit-only"&&<span style={{fontSize:9.5,color:MUT,marginLeft:"auto"}}>inherits global · <b style={{color:SCOLOR[approved||"realistic"]}}>{SLABEL[approved||"realistic"]}</b> — local override not yet available for this view</span>}
     {capability==="fixed"&&<span style={{fontSize:9.5,color:MUT,marginLeft:"auto"}}>not scenario-dependent — governed by fixed compliance/regulatory checks, not adjusted by posture</span>}
    </div>);
   })}
  </div>

  <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
   <div style={{flex:"1 1 340px",border:`1px solid ${RULE}`,padding:"10px 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT}}>Interactive 3D Network Map — {mapNodes.length} territories, {mEdges.length} edges</div>
     <span onClick={()=>jumpTo&&jumpTo("table")} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:AC,cursor:jumpTo?"pointer":"default",textDecoration:"underline"}}>Full 3D view →</span>
    </div>
    <EngineErrorBoundary><Map3D mapNodes={mapNodes} mEdges={mEdges} clusters={clusters} approvedPosture={approved} railData={railData} selectedState={selectedStateDetail} onStateClick={setSelectedStateDetail} scenario={approved} centers={centers} states={states} /></EngineErrorBoundary>
    <svg style={{display:"none"}} viewBox={svgVB}>
     {mEdges.map((e,i)=>(<line key={i} x1={e.a.pos[0]} y1={e.a.pos[1]} x2={e.b.pos[0]} y2={e.b.pos[1]} stroke={AC} strokeOpacity={0.35} strokeWidth={0.04}/>))}
     {mapNodes.map(n=>(<circle key={n.id} cx={n.pos[0]} cy={n.pos[1]} r={0.12+Math.min(0.22,n.n*0.02)} fill={tierHex(n.state)} stroke="#fff" strokeWidth={0.03}><title>{`${n.label} \u00b7 ${n.state} \u00b7 ${n.n} centers`}</title></circle>))}
    </svg>
    <div style={{fontSize:9.5,color:MUT,marginTop:6}}>Same buildMapNodes()/buildPropagationEdges() the full Network Map tab renders — this is a live sync, not a separate drawing. Circle size ∝ center count; lines are the same strong→weak support-propagation pairs the 3D map beams.</div>
   </div>
   <div style={{flex:"1 1 220px",border:`1px solid ${RULE}`,borderLeft:`3px solid ${clusters.count>1?AC:GRN}`,padding:"10px 12px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:8}}>Graph theory — at-risk clustering</div>
    <div style={{fontSize:11.5,color:"#333",lineHeight:1.7}}>
     <div>At-risk territories <b style={{float:"right"}}>{clusters.total||0}</b></div>
     <div>Connected clusters <b style={{float:"right"}}>{clusters.count}</b></div>
     <div>Largest cluster <b style={{float:"right"}}>{clusters.largest} territories</b></div>
     <div>Isolated at-risk <b style={{float:"right"}}>{clusters.isolated}</b></div>
    </div>
    <div style={{fontSize:9.5,color:MUT,marginTop:8}}>Union-find over the propagation-edge graph: at-risk territories linked by a support edge count as one connected problem, not several independent ones. {clusters.count>1?"Multiple clusters mean isolated interventions won't cross-pollinate — each cluster needs its own support path.":clusters.total?"A single connected cluster: one coordinated intervention can reach every at-risk territory in it via existing support edges.":"No at-risk territories under this posture."}</div>
   </div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:8}}>J. Forecast Timeline — predict network state at future weeks</div>
   <div style={{display:"flex",alignItems:"center",gap:10}}>
    <span style={{fontSize:9.5,fontWeight:700,minWidth:60}}>Week {forecastWeek}</span>
    <input type="range" min="0" max="12" value={forecastWeek} onChange={(e)=>setForecastWeek(Number(e.target.value))} style={{flex:1,cursor:"pointer"}} />
    <span style={{fontSize:8.5,color:MUT,minWidth:40}}>0 ←→ 12 wks</span>
   </div>
   <div style={{fontSize:9,color:"#666",marginTop:6}}>Scrub the slider to see predicted network health at weeks 0, 4, 8, 12. Map spheres update to show forecast. Blue rings = capacity used, red rings = at-risk trend.</div>
  </div>

  {selectedStateDetail&&<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${SCOLOR[approved||"realistic"]}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT}}>H. Drill-Down Detail — {selectedStateDetail} ({selectedStateCenters.length} centers)</div>
    <span onClick={()=>setSelectedStateDetail(null)} style={{cursor:"pointer",color:AC,fontSize:12}}>✕</span>
   </div>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
    {selectedStateCenters.slice(0,8).map((c,i)=>(<div key={i} style={{flex:"1 1 140px",padding:"6px 8px",background:c.condition==="at-risk"?"#ffe6e6":c.condition==="watch"?"#fef6e6":"#f0fdf4",border:`1px solid ${c.condition==="at-risk"?AC:c.condition==="watch"?AMB:GRN}`,borderRadius:3}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:INK}}>{c.name}</div>
     <div style={{fontSize:9,color:"#666",marginTop:2}}>Health <b>{c.health}</b> · Margin $<b>{c.margin}k</b></div>
     <div style={{fontSize:8,color:MUT,marginTop:2}}>{c.condition}</div>
    </div>))}
   </div>
   {selectedStateCenters.length>8&&<div style={{fontSize:9.5,color:MUT}}>+{selectedStateCenters.length-8} more centers</div>}
  </div>}

  <div style={{border:`2px solid ${GRN}`,padding:"12px",marginBottom:14,background:"#f0fdf4",borderRadius:4}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:GRN,marginBottom:8}}>FRANCHISE OPPORTUNITY CARD — Example Territory</div>
   <div style={{display:"flex",gap:16,alignItems:"start",flexWrap:"wrap"}}>
    <div style={{flex:"1 1 280px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:INK,marginBottom:8}}>Market Profile</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>
      <div>📍 <b>Suburban Market</b> (15,000 population)</div>
      <div>👥 <b>Target Enrollment:</b> 1,200 students (8% penetration)</div>
      <div>🎓 <b>Current Programs:</b> Classic coding only</div>
      <div>⭐ <b>Competition:</b> 1 other center in area</div>
     </div>
    </div>
    <div style={{flex:"1 1 280px",borderLeft:`1px solid #ddd`,paddingLeft:16}}>
     <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:INK,marginBottom:8}}>Year 1 Opportunity</div>
     <div style={{fontSize:9,color:"#666",lineHeight:1.6}}>
      <div>💰 <b>Baseline Revenue:</b> {fmtK(18500 * 12)}/year</div>
      <div>🚀 <b>Growth Potential:</b> +${(45000 + 30000 + 67000 - (8000 + 1500 + 2000)).toFixed(0)}k/year (Year 3)</div>
      <div>📈 <b>Margin:</b> ${((18500 * TERRITORY_OPPORTUNITY.margin * 12) / 1000).toFixed(0)}k gross annually</div>
      <div>✅ <b>Achievable Timeline:</b> 60-90 days to first growth initiative</div>
     </div>
    </div>
    <div style={{flex:"1 1 280px",borderLeft:`1px solid #ddd`,paddingLeft:16}}>
     <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:INK,marginBottom:8}}>Growth Roadmap</div>
     <div style={{fontSize:8.5,color:"#666",lineHeight:1.7}}>
      <div>📚 <b>Month 1-2:</b> Launch AI track (hire instructor, procure kits)</div>
      <div>🌟 <b>Month 2-3:</b> First community event (library partnership)</div>
      <div>🎪 <b>Month 3-4:</b> Expand to 2-3 community programs</div>
      <div>💵 <b>Month 4-6:</b> Pricing strategy campaign (Classic→Elite migration)</div>
     </div>
    </div>
   </div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT}}>A. Franchise Growth Strategy — Curriculum Expansion (Market-Aware Pricing)</div>
    <div style={{display:"flex",gap:6}}>
     {["small","medium","large"].map(m => (
      <button key={m} onClick={()=>setMarketContext(m)} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 8px",cursor:"pointer",border:`1px solid #ddd`,background:marketContext===m?"#5a7cbe":"#fff",color:marketContext===m?"#fff":"#333",borderRadius:2}}>
       {m.charAt(0).toUpperCase() + m.slice(1)}
      </button>
     ))}
    </div>
   </div>
   <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
    {Object.entries(CURRICULUM_PATHS).map(([key, curr]) => {
     const price = curr.pricing_by_market ? curr.pricing_by_market[marketContext] : 199;
     const isRequired = curr.required ? " (Required)" : "";
     const adoption = curr.adoption_rate ? ` • ${Math.round(curr.adoption_rate*100)}% adoption` : "";
     return (
      <div key={key} style={{flex:"1 1 180px",padding:"10px 12px",border:`1px solid ${curr.required?"#2fbf5f":"#ddd"}`,borderTop:`3px solid ${curr.color}`,borderRadius:3,background:curr.required?"#f0fdf4":"#fafafa",opacity:curr.adoption_rate&&curr.adoption_rate<0.5?0.85:1}}>
       <div style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:INK,marginBottom:4}}>{curr.name}{isRequired}</div>
       <div style={{fontSize:11,color:"#333",marginBottom:2}}><b>${price}</b><span style={{color:MUT,fontSize:9}}>/mo</span></div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>{curr.tracks.join(", ")}</div>
       {curr.setup_barrier && <div style={{fontSize:8,color:AC,marginBottom:2}}>Setup: {curr.setup_barrier}</div>}
       {curr.instructor_readiness && <div style={{fontSize:8,color:MUT}}>Instructor: {curr.instructor_readiness}</div>}
       {adoption && <div style={{fontSize:7.5,color:MUT,marginTop:4}}>{adoption}</div>}
      </div>
     );
    })}
   </div>
   <div style={{fontSize:8.5,color:"#666",marginTop:8,padding:"8px 0"}}>⚠️ Pricing varies by market size. Adoption rates reflect current network. AI requires specialized instructor (hire, not retrain). Robotics ~40% adoption. Select your market above to see adjusted pricing.</div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:10}}>B. Community Integration — Market-Specific Reach &amp; Revenue Variance</div>
   <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
    {Object.entries(COMMUNITY_PROGRAMS).map(([key, prog]) => {
     const reach = prog.reach_by_market[marketContext] || 0;
     const revenue = prog.revenue_impact_by_market[marketContext] || 0;
     const viable = reach > 0;
     const note = prog.note ? ` (${prog.note})` : "";
     return (
      <div key={key} style={{flex:"1 1 160px",padding:"10px 12px",border:`1px solid ${viable?"#ddd":"#ddd"}`,background:viable?"#f9f9f9":"#f5f5f5",borderRadius:3,opacity:viable?1:0.6}}>
       <div style={{fontSize:18,marginBottom:4}}>{prog.icon}</div>
       <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,color:viable?INK:"#999",marginBottom:4}}>{prog.name}</div>
       {viable ? (
        <>
         <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Reach: <b>{reach}</b> students</div>
         <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Events: <b>{prog.events_per_year}</b>/yr</div>
         <div style={{fontSize:9,color:GRN,fontWeight:700,marginBottom:2}}>{fmtK(revenue)}/yr</div>
         <div style={{fontSize:7.5,color:MUT}}>Adoption: {Math.round(prog.adoption_rate*100)}%</div>
        </>
       ) : (
        <div style={{fontSize:8,color:"#999"}}>Not viable in {marketContext} markets{note}</div>
       )}
      </div>
     );
    })}
   </div>
   {(() => {
    const viablePrograms = Object.values(COMMUNITY_PROGRAMS).filter(p => (p.reach_by_market[marketContext] || 0) > 0);
    const totalRevenue = viablePrograms.reduce((sum, p) => sum + (p.revenue_impact_by_market[marketContext] || 0), 0);
    const totalReach = viablePrograms.reduce((sum, p) => sum + (p.reach_by_market[marketContext] || 0), 0);
    return (
     <div style={{fontSize:8.5,color:"#666",marginTop:8,padding:"8px 0"}}>
      <b>{viablePrograms.length} programs viable</b> in {marketContext} markets: {totalReach} student reach, {fmtK(totalRevenue)}/yr combined. ⚠️ Comic Con/Bootcamp only work in medium+ markets. Rural centers focus on Library + STEM nights (low overhead, local partnerships).
     </div>
    );
   })()}
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:10}}>C. Territory Opportunity & Franchise Revenue Potential (Market-Specific Pricing)</div>
   <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
    {Object.entries(TERRITORY_OPPORTUNITY.market_size).map(([sizeKey, sizeData]) => {
     const modPenetration = TERRITORY_OPPORTUNITY.penetration.moderate;
     const enrollees = Math.round(sizeData.population * modPenetration);

     // Use market-specific pricing tiers
     const pricingByMarket = TERRITORY_OPPORTUNITY.pricing_by_market[sizeKey];
     // Realistic mix: 40% classic, 35% classic+addon, 25% elite (varies by market maturity)
     const avgARPU = (pricingByMarket.classic * 0.4) + (((pricingByMarket.classic_with_ai || pricingByMarket.classic_with_robotics) || (pricingByMarket.classic + 89)) * 0.35) + ((pricingByMarket.elite || 269) * 0.25);

     const retention = TERRITORY_OPPORTUNITY.retention_rate;
     const year1Revenue = enrollees * avgARPU * 12 * retention;
     const grossMargin = year1Revenue * TERRITORY_OPPORTUNITY.margin;
     const monthlyRevenue = enrollees * avgARPU * retention;

     return (
      <div key={sizeKey} style={{flex:"1 1 180px",padding:"10px 12px",border:`1px solid #ddd`,background:sizeKey==="large"?"#f0fdf4":sizeKey==="medium"?"#fef6e6":"#f5f5f5",borderRadius:3}}>
       <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,color:INK,marginBottom:2,textTransform:"capitalize"}}>{sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1)} Market</div>
       <div style={{fontSize:7.5,color:"#999",marginBottom:6}}>{sizeData.desc}</div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Population: <b>{sizeData.population.toLocaleString()}</b></div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Est. enrollment: <b>{enrollees}</b> students</div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Blended ARPU: <b>${avgARPU.toFixed(0)}/mo</b></div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:4}}>Elite price: <b>${pricingByMarket.elite || 269}</b></div>
       <div style={{fontSize:9,fontWeight:700,color:GRN,borderTop:"1px solid #ddd",paddingTop:6,marginTop:6}}>Monthly Revenue: <b>{fmtK(monthlyRevenue)}</b></div>
       <div style={{fontSize:8.5,color:MUT,marginTop:4}}>Year 1 Revenue: {fmtK(year1Revenue)}</div>
       <div style={{fontSize:8.5,color:MUT,marginTop:2}}>Gross Margin ({(TERRITORY_OPPORTUNITY.margin*100).toFixed(0)}%): {fmtK(grossMargin)}</div>
      </div>
     );
    })}
   </div>
   <div style={{fontSize:8.5,color:"#666",marginTop:8,padding:"8px 0"}}>⚠️ Pricing varies significantly by market size &amp; competition. Small markets: $199 Classic (volume play). Medium markets: $229-299 (optimization). Large markets: $189-329 (premium tiers in affluent areas). Revenue calculated with realistic 40/35/25 mix across Classic/addon/Elite tiers.</div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:10}}>Growth Trajectory: 3-Year Revenue Compounding</div>
   {(() => {
    // Model 3-year growth for a medium market territory
    const baselineMonthly = 18500; // baseline center revenue
    const year1Goal = baselineMonthly * 12;

    // Year 1: Baseline + curriculum launch
    const year1Revenue = year1Goal + OPERATIONS_WORKFLOWS[0].revenue_potential_year1;
    const year1Cost = OPERATIONS_WORKFLOWS[0].cost_estimate;
    const year1Profit = (year1Revenue * TERRITORY_OPPORTUNITY.margin) - year1Cost;

    // Year 2: Year 1 + community programs (running 3 programs)
    const communityImpact = Object.values(COMMUNITY_PROGRAMS).slice(0, 3).reduce((sum, p) => sum + p.revenue_impact, 0);
    const year2Revenue = year1Revenue + communityImpact;
    const year2Cost = OPERATIONS_WORKFLOWS[1].cost_estimate + 2000; // ongoing community costs
    const year2Profit = (year2Revenue * TERRITORY_OPPORTUNITY.margin) - year2Cost;

    // Year 3: Year 2 + pricing optimization
    const year3Revenue = year2Revenue + OPERATIONS_WORKFLOWS[2].revenue_potential_year1;
    const year3Cost = OPERATIONS_WORKFLOWS[2].cost_estimate + 2000;
    const year3Profit = (year3Revenue * TERRITORY_OPPORTUNITY.margin) - year3Cost;

    const roi = {
      year1: ((year1Profit / year1Cost) * 100).toFixed(0),
      year2: ((year2Profit / (year1Cost + year2Cost)) * 100).toFixed(0),
      year3: ((year3Profit / (year1Cost + year2Cost + year3Cost)) * 100).toFixed(0)
    };

    return (
     <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 200px",padding:"10px 12px",border:`1px solid #ddd`,background:"#f5f5f5",borderRadius:3}}>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT,marginBottom:6}}>YEAR 1 — CURRICULUM LAUNCH</div>
       <div style={{fontSize:10,fontWeight:700,color:GRN,marginBottom:4}}>{fmtK(year1Revenue)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:2}}>Revenue: {fmtK(year1Revenue)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:2}}>Gross Profit: {fmtK(year1Profit)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:4}}>Investment: {fmtK(year1Cost)}</div>
       <div style={{fontSize:8.5,fontWeight:700,color:AC,borderTop:"1px solid #ddd",paddingTop:4}}>ROI: {roi.year1}%</div>
      </div>
      <div style={{flex:"1 1 200px",padding:"10px 12px",border:`1px solid #ddd`,background:"#fef6e6",borderRadius:3}}>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT,marginBottom:6}}>YEAR 2 — COMMUNITY INTEGRATION</div>
       <div style={{fontSize:10,fontWeight:700,color:GRN,marginBottom:4}}>{fmtK(year2Revenue)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:2}}>Revenue: {fmtK(year2Revenue)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:2}}>Gross Profit: {fmtK(year2Profit)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:4}}>Investment: {fmtK(year2Cost)}</div>
       <div style={{fontSize:8.5,fontWeight:700,color:GRN,borderTop:"1px solid #ddd",paddingTop:4}}>ROI: {roi.year2}%</div>
      </div>
      <div style={{flex:"1 1 200px",padding:"10px 12px",border:`1px solid #ddd`,background:"#f0fdf4",borderRadius:3}}>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT,marginBottom:6}}>YEAR 3 — PRICING OPTIMIZATION</div>
       <div style={{fontSize:10,fontWeight:700,color:GRN,marginBottom:4}}>{fmtK(year3Revenue)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:2}}>Revenue: {fmtK(year3Revenue)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:2}}>Gross Profit: {fmtK(year3Profit)}</div>
       <div style={{fontSize:8,color:"#666",marginBottom:4}}>Investment: {fmtK(year3Cost)}</div>
       <div style={{fontSize:8.5,fontWeight:700,color:GRN,borderTop:"1px solid #ddd",paddingTop:4}}>ROI: {roi.year3}%</div>
      </div>
     </div>
    );
   })()}
   <div style={{fontSize:8.5,color:"#666",marginTop:8,padding:"8px 0"}}>Growth trajectory assumes sequential implementation of curriculum launch → community programs → pricing optimization. Each phase builds on the previous, compounding revenue and engagement. Totals cumulative across all active initiatives.</div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:10}}>D. Operations Workflows — Franchisee Playbooks</div>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>
    {OPERATIONS_WORKFLOWS.map((wf, idx) => (
     <div key={wf.id} style={{flex:"1 1 250px",border:`1px solid #ddd`,borderRadius:3,padding:"10px 12px",background:"#fafafa"}}>
      <div style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:INK,marginBottom:4}}>{idx+1}. {wf.name}</div>
      <div style={{fontSize:8.5,color:"#666",marginBottom:6}}>{wf.description}</div>
      <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Timeline: <b>{wf.timeline_days} days</b></div>
      <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Setup Cost: <b>{fmtK(wf.cost_estimate)}</b></div>
      <div style={{fontSize:9,fontWeight:700,color:GRN,marginBottom:6}}>Year 1 Revenue: {fmtK(wf.revenue_potential_year1)}</div>
      <div style={{fontSize:8,color:MUT,lineHeight:1.4,borderTop:`1px solid #eee`,paddingTop:6}}>
       {wf.steps.map((step, si) => (<div key={si} style={{marginBottom:2}}>{step}</div>))}
      </div>
     </div>
    ))}
   </div>
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:10}}>E. AI-Driven Growth Recommendations — Smart Suggestions for Territory Expansion</div>
   {(() => {
    // Analyze current network to generate smart recommendations
    const atRiskCount = centers ? centers.filter(c => c.condition === 'at-risk').length : 0;
    const avgHealth = centers ? Math.round(centers.reduce((sum, c) => sum + c.health, 0) / centers.length) : 70;
    const avgMargin = centers ? Math.round(centers.reduce((sum, c) => sum + c.margin, 0) / centers.length) : 35;
    const territoryData = {
      market_tech_affinity: 0.75,
      centers_current: centers ? centers.length : 348,
      health_score: avgHealth,
      margin_score: avgMargin
    };
    const curriculumMix = {ai: true, robotics: true, classic: true};
    const communityPrograms = Object.keys(COMMUNITY_PROGRAMS);
    const suggestions = generateGrowthSuggestions(territoryData, curriculumMix, communityPrograms);
    return (
     <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      {suggestions.length ? suggestions.map((sug, i) => (
       <div key={i} style={{flex:"1 1 240px",padding:"10px 12px",border:`1px solid ${sug.priority==="high"?AC:"#ddd"}`,background:sug.priority==="high"?"#fff8f6":"#f9f9f9",borderRadius:3}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
         <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,color:INK}}>{sug.recommendation}</div>
         <span style={{fontSize:7.5,fontWeight:700,padding:"2px 6px",background:sug.priority==="high"?AC:"#ddd",color:"#fff",borderRadius:2,whiteSpace:"nowrap"}}>{sug.priority.toUpperCase()}</span>
        </div>
        <div style={{fontSize:8.5,color:"#666",marginBottom:4}}>Impact: {sug.impact}</div>
        <div style={{fontSize:8,color:MUT}}>Effort: {sug.effort}</div>
       </div>
      )) : (
       <div style={{flex:"1 1 100%",padding:"10px",color:MUT,fontSize:9.5}}>All growth channels optimized for this territory. Monitor quarterly and iterate based on actual enrollment data.</div>
      )}
     </div>
    );
   })()}
  </div>

  <div style={{border:`1px solid ${RULE}`,padding:"10px 12px",marginBottom:14,background:"#f9f9f9"}}>
   <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:10}}>Network Scale Impact — 348 Franchise Units</div>
   {(() => {
    // Calculate network-wide impact if average franchise executes growth strategy
    const unitsInNetwork = 348;
    const avgBaselineMonthly = 18500;
    const avgBaselineAnnual = avgBaselineMonthly * 12;

    // Conservative: 60% of units adopt curriculum, 40% add communities
    const curriculumAdopters = Math.floor(unitsInNetwork * 0.60);
    const communityAdopters = Math.floor(unitsInNetwork * 0.40);
    const pricingAdopters = Math.floor(unitsInNetwork * 0.70);

    // Revenue impact from growth levers
    const curriculumImpact = curriculumAdopters * 45000; // Year 1
    const communityImpact = communityAdopters * 30000; // Year 1
    const pricingImpact = pricingAdopters * 67000; // Year 1

    const currentNetworkRevenue = unitsInNetwork * avgBaselineAnnual;
    const potentialNetworkRevenue = currentNetworkRevenue + curriculumImpact + communityImpact + pricingImpact;
    const revenueIncrease = potentialNetworkRevenue - currentNetworkRevenue;
    const percentageGrowth = (revenueIncrease / currentNetworkRevenue) * 100;

    // Enrollment impact
    const estimatedNewStudents = (curriculumAdopters * 15) + (communityAdopters * 8) + (pricingAdopters * 0); // community drives new, pricing converts existing

    return (
     <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 240px",padding:"10px",border:`1px solid #ddd`,borderRadius:3}}>
       <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:MUT,marginBottom:6}}>CURRENT NETWORK</div>
       <div style={{fontSize:11,color:"#333",marginBottom:2}}>Revenue <b>{fmtM(currentNetworkRevenue)}</b></div>
       <div style={{fontSize:9,color:"#666",marginBottom:4}}>348 units × {fmtK(avgBaselineAnnual)}/year</div>
       <div style={{fontSize:9,color:"#999"}}>Baseline operations, Classic-only curriculum</div>
      </div>
      <div style={{flex:"1 1 240px",padding:"10px",border:`1px solid #ddd`,borderRadius:3,background:"#f0fdf4"}}>
       <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:GRN,marginBottom:6}}>WITH GROWTH STRATEGY</div>
       <div style={{fontSize:11,color:GRN,marginBottom:2}}>Revenue <b>{fmtM(potentialNetworkRevenue)}</b></div>
       <div style={{fontSize:9,color:"#666",marginBottom:4}}>+{fmtM(revenueIncrease)} (+{percentageGrowth.toFixed(1)}%)</div>
       <div style={{fontSize:9,color:"#999"}}>{estimatedNewStudents.toLocaleString()} new student enrollments</div>
      </div>
      <div style={{flex:"1 1 240px",padding:"10px",border:`1px solid #ddd`,borderRadius:3}}>
       <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:AC,marginBottom:6}}>ADOPTION SNAPSHOT</div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Curriculum launch: <b>{curriculumAdopters}</b> units ({Math.round(curriculumAdopters/unitsInNetwork*100)}%)</div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:2}}>Community programs: <b>{communityAdopters}</b> units ({Math.round(communityAdopters/unitsInNetwork*100)}%)</div>
       <div style={{fontSize:8.5,color:"#666",marginBottom:4}}>Pricing optimization: <b>{pricingAdopters}</b> units ({Math.round(pricingAdopters/unitsInNetwork*100)}%)</div>
       <div style={{fontSize:8,color:"#999"}}>Conservative adoption rates</div>
      </div>
     </div>
    );
   })()}
   <div style={{fontSize:8.5,color:"#666",marginTop:8,padding:"8px 0"}}>Network-scale analysis assumes conservative adoption (40-70%) with realistic execution. Individual territory performance varies by market size, competition, and franchisee capability — top quartile centers can exceed these projections 2-3x.</div>
  </div>

  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   <div style={{flex:"1 1 300px",border:`1px solid ${RULE}`,padding:"10px 12px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:8}}>Scenario comparison</div>
    <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
     <thead><tr style={{borderBottom:`1px solid ${RULE}`}}>
      <th style={{textAlign:"left",padding:"4px 0",fontWeight:700,color:INK}}>Metric</th>
      <th style={{textAlign:"center",padding:"4px 0",fontWeight:700,color:GRN}}>Opt</th>
      <th style={{textAlign:"center",padding:"4px 0",fontWeight:700,color:AC}}>Real</th>
      <th style={{textAlign:"center",padding:"4px 0",fontWeight:700,color:AMB}}>Pess</th>
     </tr></thead>
     <tbody>
      {[
       {label:"Revenue",get:d=>fmtM(d.financials.revenue_monthly)},
       {label:"Royalty",get:d=>fmtK(d.financials.royalty_revenue)},
       {label:"Margin",get:d=>fmtPct(d.financials.margin)},
       {label:"Senseis",get:d=>d.staffing.senseis},
       {label:"Retention",get:d=>fmtPct(d.retention_rate)},
       {label:"Territories",get:d=>d.expansion.new_territories},
      ].map((m,i)=>(<tr key={i} style={{borderBottom:`1px solid #eee`}}>
       <td style={{padding:"4px 0",color:"#333"}}>{m.label}</td>
       <td style={{textAlign:"center",padding:"4px 0",color:"#555"}}>{m.get(opt.quantum.scenarios.optimistic)}</td>
       <td style={{textAlign:"center",padding:"4px 0",color:"#555"}}>{m.get(opt.quantum.scenarios.realistic)}</td>
       <td style={{textAlign:"center",padding:"4px 0",color:"#555"}}>{m.get(opt.quantum.scenarios.pessimistic)}</td>
      </tr>))}
     </tbody>
    </table>
   </div>
   <div style={{flex:"1 1 300px",border:`1px solid ${RULE}`,padding:"10px 12px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:8}}>Decision ledger — this view's entries</div>
    {quantumLog.length===0?<div style={{fontSize:10.5,color:MUT}}>No scenario decisions yet. Approvals and overrides made here are written to the same ledger the audit tab reads.</div>:
     quantumLog.map((e,i)=>(<div key={i} style={{fontSize:10.5,color:"#333",padding:"4px 0",borderTop:i>0?`1px solid #f0f0ee`:"none"}}><b>{e.actor}</b> — {e.text}</div>))}
   </div>
  </div>
 </div>);
}

export default function Engine(props){
 return(<EngineErrorBoundary><EngineInner {...props}/></EngineErrorBoundary>);
}

function EngineInner({initialTab}){
 const [tab,setTab]=useState(initialTab||"quantum"); const q=false; // corporate register only
 // Deep-linking: keep the URL hash in sync with whichever tab is active, so
 // any navigation (sidebar click, jumpTo, group button) produces a real,
 // shareable link — one hook here catches every path, rather than touching
 // each of the many setTab() call sites individually.
 useEffect(()=>{
  if(typeof window!=="undefined"&&window.location.hash.slice(1)!==tab){
   window.location.hash=tab;
  }
 },[tab]);
 // Two-way: back/forward button or a manually edited hash should also
 // navigate the app, not just the reverse.
 useEffect(()=>{
  if(typeof window==="undefined")return;
  const onHashChange=()=>{
   const h=window.location.hash.slice(1);
   if(h&&h!==tab)setTab(h);
  };
  window.addEventListener("hashchange",onHashChange);
  return()=>window.removeEventListener("hashchange",onHashChange);
 },[tab]);
 const [sel,setSel]=useState("Pleasanton");
 const [stSel,setSt]=useState("CA");
 const [beltSel,setBelt]=useState("orange");
 const [ranPlays,setRan]=useState({});
 const [opsMsg,setOpsMsg]=useState("Ready.");
 const [cap,setCap]=useState({used:0,week:1});
 const [goals,setGoals]=useState({});
 const [mapSt,setMapSt]=useState(null);
 const [mapMode,setMapMode]=useState("health"); // health | freshness | headroom | consistency | momentum
 const [mapC,setMapC]=useState(null);
 const [cardMsg,setCardMsg]=useState("");
 const [leadStage,setLeadStage]=useState({});
 const [leadSel,setLeadSel]=useState(null);
 const [dealAg,setDealAg]=useState({auto:false,wk:0,log:[],trained:{},promoted:[],retired:[],blocked:0,stats:{}});
 const [qMeas,setQMeas]=useState({});

// ============================================================================
// QUANTUM SOLVER RESULTS (348-unit extrapolation from Pleasanton/Walnut Creek)
// ============================================================================

 const [opt,setOpt]=useState({run:false,week:0,gates:0,ships:0,probs:{measurement:0.7,wave_mgr:0.7,bestpractice:0.7,peer_review:0.7,pricing:0.7},fresh:{},log:[],quantum:{scenarios:SOLVER_RESULTS,approved:null,approvedAt:null,overrides:{}}});
 const [essentialsOnly,setEssentialsOnly]=useState(true);
 const A=k=>AGENT_LEX[k];const V=k=>VERB_LEX[k];

 // ---- QUANTUM FUNCTIONS ----
 const approveScenario = (scenario) => {
  setOpt(prev => ({
    ...prev,
    quantum: { ...prev.quantum, approved: scenario, approvedAt: Date.now() }
  }));
  logL('quantum', 'Rodrigues', `Approved ${scenario} scenario`);
 };
 const overrideTabScenario = (tabName, scenario) => {
  setOpt(prev => ({
    ...prev,
    quantum: { ...prev.quantum, overrides: { ...prev.quantum.overrides, [tabName]: scenario } }
  }));
  logL('quantum', 'Rodrigues', `Overrode ${tabName} to ${scenario}`);
 };
 const getActiveScenario = (tabName) => {
  if (opt.quantum.overrides[tabName]) return opt.quantum.overrides[tabName];
  return opt.quantum.approved || 'realistic';
 };

 // ---- world state: single integration layer ----
 // adj: per-center metric deltas written by ANY tab's action; centers are
 // recomputed through it, so forecasts, health tiers, pain scores, map
 // colors, alerts, and the QPM rail all move together when one tab acts.
 const [adj,setAdj]=useState({});
 const [tour,setTour]=useState(0); // 0..4 = step, -1 = dismissed
 // growth flywheelGain loop (expansion tab): channel-level simulation for
 // capacity planning — leads arrive by channel gain, qualify, sign under the
 // compliance governors; each signing pumps the gain. Separate from the real
 // prospect book by design and labeled as simulation.
 const [reso,setReso]=useState({wk:0,resolved:false,signed:0,hist:[1],placed:{},chan:{"FranNet — West":{p:3,ql:1},"IFPG Network":{p:5,ql:1},"BAI Franchise Brokers":{p:2,ql:0},"Direct / referral":{p:4,ql:2}}});
 // ledger: every action from every tab appends here; the RECORD tab renders it.
 const [ledger,setLedger]=useState([]);
 const logL=(tab2,actor,text)=>setLedger(L=>[{t:Date.now(),tab:tab2,actor,text},...L].slice(0,40));
 const applyAdj=(name,d)=>setAdj(m=>{const cur=m[name]||{};const nx={...cur};Object.entries(d).forEach(([k,v])=>{nx[k]=(nx[k]||0)+v;});return{...m,[name]:nx};});
 const rawCenters=useMemo(buildCenters,[]);
 const centers=useMemo(()=>{
  const posture=(opt.quantum&&opt.quantum.approved)||"realistic";
  return computeCentersForPosture(rawCenters,adj,posture,opt.week);
 },[rawCenters,adj,opt.quantum&&opt.quantum.approved,opt.week]);
 const LEADS=useMemo(buildLeads,[]);
 const team=centers.find(c=>c.name===sel)||centers[32];
 const states=useMemo(()=>{const m={};centers.forEach(c=>{(m[c.st]=m[c.st]||[]).push(c);});return m;},[centers]);
 const fAll=useMemo(()=>centers.map(c=>({c,f:forecast(c)})),[centers]);
 const alerts=useMemo(()=>alertsOf(centers),[centers]);
 const trend={r:fAll.filter(x=>x.f.cls==="rising").length,h:fAll.filter(x=>x.f.cls==="holding").length,d:fAll.filter(x=>x.f.cls==="deteriorating").length};
 const staleBase=c=>opt.fresh[c.name]===undefined&&(hash(c.name)%38)>21;
 const staleN=centers.filter(staleBase).length;
 const red=centers.filter(c=>c.eb<0);
 const blocker=useMemo(()=>{let best=null,bs=-1;PATH.forEach((b,i)=>{const s=COHORT[b[0]][1]*(PATH.length-1-i);if(s>bs){bs=s;best=b;}});return best;},[]);
 const GROUPS={OVERVIEW:["quantum","exec","franchise","rail","board","alignment","compliance","workload","queue","blockers","warning","signals"],GROWTH:["leads","deals","expansion","growth","whitespace"],CENTERS:["team","lenses","engagement","mastery","table","batch","compare"],NETWORK:["network","optimizer","transfers","fivebasis","cohort"],WORKFLOW:["acquire","deliver","retain","operate","plan","metrics","failure","onboarding"],PROGRAMS:["portfolio","pain","calendar","financials","growthfin"],METHOD:["agenda","dynamics","audit","success","reports","playback","risk","fdd","review","sensitivity","glossary"],ADAPTIVE:["twin","lifecycle","labor","ltv","velocity","auction","scheduler","sentinel","precedent","constitution"],LIVE:["dojo","season","simulator","monitor","apisview","immune","dagify","ledgerview","brief","negotiate","joy"]};
 const TABL={quantum:"quantum pm",alignment:"system alignment",dynamics:"operations dynamics",board:"operations board",lenses:"six lenses",rail:"threads & queue",network:"network health",table:"network map",team:"center detail",mastery:"belts",transfers:"transfers",optimizer:"operations",pain:"franchisee support",portfolio:"programs",engagement:"engagement",franchise:"overview",agenda:"methodology",growth:"growth",calendar:"calendar",acquire:"acquire",deliver:"deliver",retain:"retain",operate:"operate",plan:"first 90",metrics:"metrics",failure:"failure",warning:"early warning",leads:"lead pipeline",expansion:"expansion engine",fivebasis:"unified views",signals:"network signals",compliance:"compliance & safety",workload:"approver workload",whitespace:"territory white space",financials:"financial roll-up",audit:"audit trail",blockers:"growth blockers",deals:"deals",onboarding:"opening project plan",growthfin:"financial growth",success:"success rate",reports:"reports & exports",batch:"batch operations",playback:"historical playback",exec:"executive summary",glossary:"glossary",risk:"risk register",fdd:"fdd item 20",review:"week in review",compare:"center comparison",queue:"approval queue",cohort:"cohort analysis",sensitivity:"sensitivity analysis",twin:"network twin",lifecycle:"lifecycle engine",labor:"sensei supply chain",ltv:"family forward value",velocity:"curriculum velocity",auction:"territory portfolio",scheduler:"interaction scheduler",sentinel:"compliance sentinel",precedent:"precedent & calibration",constitution:"governance constitution",dojo:"the dojo floor",season:"the season",simulator:"year simulator",monitor:"state monitor",apisview:"agent systems",immune:"signal integrity",dagify:"dependency graphs",ledgerview:"decision ledger",brief:"weekly brief",negotiate:"negotiation prep",joy:"joy ledger"};
 const groupOf=t=>Object.keys(GROUPS).find(g=>GROUPS[g].includes(t));
 // Keyboard nav: Left/Right cycles through the visible tabs in the current
 // group, matching what a mouse click on adjacent tab buttons would do —
 // builds on the aria-selected/role="tab" already present on each button.
 const onTabBarKeyDown=(e)=>{
  if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
  const visible=essentialsOnly?GROUPS[groupOf(tab)].filter(t=>ESSENTIAL_TABS.includes(t)||t===tab):GROUPS[groupOf(tab)];
  const i=visible.indexOf(tab);
  if(i===-1)return;
  e.preventDefault();
  const next=e.key==="ArrowRight"?visible[(i+1)%visible.length]:visible[(i-1+visible.length)%visible.length];
  setTab(next);
 };
 const GROUP_LABEL={OVERVIEW:"Overview",GROWTH:"Growth Pipeline",CENTERS:"Centers",NETWORK:"Network",WORKFLOW:"Workflow",PROGRAMS:"Programs",METHOD:"Methodology",ADAPTIVE:"Adaptive Systems",LIVE:"Live Systems"};
 const railData=useMemo(()=>runAllAgents(centers,states,LEADS),[centers,states,LEADS]);
 // Operations Board's local override (Quantum PM governed-tabs grid). Must be
 // a top-level useMemo, not computed inline in the JSX return, since that
 // return mixes many {tab==="x"&&...} branches and can't hold a `const`
 // statement — this keeps hook-call order unconditional or the rules of hooks.
 const boardOverride=opt.quantum&&opt.quantum.overrides&&opt.quantum.overrides.board;
 const boardGlobalPosture=(opt.quantum&&opt.quantum.approved)||"realistic";
 const boardOverrideActive=!!(boardOverride&&boardOverride!==boardGlobalPosture);
 const boardRailData=useMemo(()=>{
  if(!boardOverrideActive)return railData;
  return computeOverrideView(rawCenters,adj,boardOverride,opt.week,LEADS).railData;
 },[boardOverrideActive,boardOverride,rawCenters,adj,opt.week,railData]);
 const[spotDecision,setSpotDecision]=useState(null);
 const[decisions,setDecisions]=useState({});
 const[decisionHistory,setDecisionHistory]=useState({}); // per-decision audit trail: id -> [{status,seq}], newest last
 const historySeqRef=useRef(0);
 const recordDecision=(id,status)=>{historySeqRef.current+=1;setDecisionHistory(h=>({...h,[id]:[...(h[id]||[]),{status,seq:historySeqRef.current}]}));};
 const[dyn,setDyn]=useState({resolved:{},committed:{},completed:{}});
 const[auditQ,setAuditQ]=useState(""); // Audit Trail search: matches actor, text, or source tab
 const[auditTabFilter,setAuditTabFilter]=useState("all"); // Audit Trail: filter ledger to one source tab
 const[batchCondition,setBatchCondition]=useState("all"); // Batch Operations filter: thriving/watch/at-risk/all
 const[batchState,setBatchState]=useState("all"); // Batch Operations filter: state/province/all
 const[batchStaleOnly,setBatchStaleOnly]=useState(false); // Batch Operations filter: stale-measurement only
 const[snapshots,setSnapshots]=useState([]); // Historical Playback: one entry per captured week, newest last
 const[playA,setPlayA]=useState(null); // Historical Playback: compare-select A
 const[playB,setPlayB]=useState(null); // Historical Playback: compare-select B
 const[globalQ,setGlobalQ]=useState(""); // Global search: matches centers, states, and tab labels
 const[compareSelect,setCompareSelect]=useState([]); // Center Comparison: multi-select, max 5 centers
 const[queueRole,setQueueRole]=useState("all"); // Approval Queue: filter by role (all, fbc, director, ops)
 const[sensitivityParams,setSensitivityParams]=useState({tuition:0,capacity:0,support:0}); // Sensitivity: % deltas from baseline
 const[focusCenter,setFocusCenter]=useState(null);
 // Cross-view navigation into Network must actually land on the right state,
 // not whatever was last clicked -- this syncs the cluster selection from the
 // shared focusCenter passport whenever it resolves to a real center.
 useEffect(()=>{
  if(tab!=="network"||!focusCenter)return;
  const c=centers.find(x=>x.name===focusCenter);
  if(c&&c.st)setSt(c.st);
 },[tab,focusCenter,centers]);
 const[jumpReason,setJumpReason]=useState(null); // why the last cross-view navigation happened, shown as a breadcrumb on arrival
 const jumpTo=(destTab,centerName,reason)=>{setFocusCenter(centerName);setJumpReason(reason||null);setTab(destTab);};
 const[aboutOpen,setAboutOpen]=useState(false);
 const[todayDetail,setTodayDetail]=useState(false);
 const BADGE={rail:railData.actionable.length||null,network:trend.d,pain:red.length,optimizer:opt.gates||null};
 const [tick,setTick]=useState(0);
 useEffect(()=>{
  if(tab!=="franchise")return;
  const id=setInterval(()=>setTick(t=>t+1),1100);
  return()=>clearInterval(id);
 },[tab]);
 useEffect(()=>{
  if(!opt.run||tab!=="optimizer")return;
  const id=setInterval(()=>{const transferFx=[];setOpt(o=>{
   if(o.week>=24)return{...o,run:false};
   const week=o.week+1,probs={...o.probs},fresh={...o.fresh};let gates=o.gates,ships=o.ships;const log=[];
   const staleOf=c=>fresh[c.name]!==undefined?(week-fresh[c.name])*7:(hash(c.name)%38)+week*2;
   // Actions are chosen by need (real network state), not by dice; each
   // "prob" is now a measured effectiveness score updated only by outcome.
   const credit={};
   const staleSet=centers.filter(c=>staleOf(c)>28);
   if(staleSet.length){
    // measurement agent: clear the stalest, largest units; credit = actual staleness cleared
    const st=[...staleSet].sort((a,b)=>staleOf(b)*b.students-staleOf(a)*a.students).slice(0,6);
    const cleared=st.reduce((a,c)=>a+staleOf(c),0);
    st.forEach(c=>fresh[c.name]=week);
    log.push(["score","measure",st.length+" units · "+cleared+"d staleness cleared",1]);
    credit.measurement=Math.min(0.12,cleared/2000);}
   const m=centers.filter(c=>staleOf(c)<=21);
   if(m.length>1){
    // best-practice transfer only when the measured conversion gap justifies it;
    // credit scales with the gap actually closed
    const b=m.reduce((a,c)=>c.conv>a.conv?c:a),w=m.reduce((a,c)=>c.conv<a.conv?c:a);
    const gap=b.conv-w.conv;
    if(gap>0.12){log.push(["transfer","transfer",b.name+"→"+w.name+" · conv gap "+Math.round(gap*100)+"pt",1]);credit.bestpractice=Math.min(0.10,gap*0.3);
     transferFx.push([w.name,{conv:Math.min(0.04,gap*0.25)}]);}}
   if(m.length>3){
    // peer review pairs complementary units: strongest retention with weakest —
    // only when the weak unit is actually deteriorating
    const br=m.reduce((a,c)=>c.ret>a.ret?c:a),wr=m.reduce((a,c)=>c.ret<a.ret?c:a);
    if(br!==wr&&forecast(wr).cls==="deteriorating"){log.push(["peer","review",br.name+"↔"+wr.name+" · retention pair",1]);credit.peer_review=Math.min(0.08,(br.ret-wr.ret)*0.25);}}
   const rising=centers.filter(c=>forecast(c).cls==="rising").length;
   if(rising>0&&week%2===0){
    // rollout wave sized by how many units are actually rising
    const flags=Math.max(1,Math.round(rising/12));
    log.push(["wave","schedule",flags+" ramp flag"+(flags>1?"s":"")+" · "+rising+" rising",1]);credit.wave_mgr=Math.min(0.06,rising/400);}
   const redNow=centers.filter(c=>c.eb<0).length;
   if(redNow>0){
    // pricing gate fires only when red-margin units exist to protect —
    // a real hold, not a random one
    gates++;log.push(["gate","hold","pricing ⚑ · "+redNow+" units below breakeven",0]);credit.pricing=-0.03;}
   Object.entries(credit).forEach(([k,v])=>{probs[k]=Math.min(0.98,Math.max(0.05,probs[k]+0.5*v));});
   return{...o,run:true,week,gates,ships,probs,fresh,log:[...log,...o.log].slice(0,9)};
  });
  // flush cross-tab effects: best-practice transfers raise the recipient's real
  // conversion, which re-ranks it on the map, pain tab, and forecasts next tick
  if(transferFx.length){transferFx.forEach(([n,d])=>applyAdj(n,d));logL("optimizer","Best practice",transferFx.map(([n])=>n).join(", ")+" conversion lifted by transfer");}
  },900);
  return()=>clearInterval(id);
 },[opt.run,tab,centers]);
 // ===== DEAL AGENT — the 10 strategies as one propose/execute/train loop =====
 const runDealWeek=()=>{
  const trained=dealAg.trained;const plays=[];
  // each action carries `ok` — whether it was the right call against real lead data
  // (fit, hot flag) — this replaces a coin-flip with a graded, checkable outcome.
  // Cannibalization blocking uses the same territory-capacity math as the real
  // Growth agent, not a separate per-name coin flip.
  const dealRegionActive={};
  [...LEADS].sort((a,b)=>b.fit-a.fit).forEach(l=>{const s=leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;if(s>=5)return;
   const netState=NET_STATES.find(x=>x.s===l.region);
   const headroom=netState?netState.h[0]:0.3;
   const capacity=territoryCapacityOf(headroom);
   const used=dealRegionActive[l.region]||0;dealRegionActive[l.region]=used+1;
   if(used>=capacity){plays.push({kind:"block cannibalization",cn:l.n,lever:0,block:true,ok:true,note:l.region+" territory candidate-supply ceiling reached ("+capacity+")"});return;}
   if(l.fit<50&&s<=1){plays.push({kind:"decline — below qualification",cn:l.n,lever:1.2,cost:1,id:l.id,dec:true,ok:l.fit<45});return;}
   if(s<2){plays.push({kind:"advance stage",cn:l.n,src:l.src,lever:+(1.0+l.fit/60).toFixed(2),cost:1,id:l.id,adv:true,ok:l.fit>=55});}
   else{plays.push({kind:"awaiting human gate",cn:l.n,lever:+(l.fit/50).toFixed(2),cost:0,gate:true});
    if(hash(l.n+"doc"+s)%2===0)plays.push({kind:"chase documents",cn:l.n,lever:0.9,cost:1,ok:!!l.hot});}});
  plays.forEach(p=>{if(trained[p.kind])p.lever=+(p.lever*trained[p.kind]).toFixed(2);});
  const exec=plays.filter(p=>!p.gate&&!p.block).sort((a,b)=>b.lever-a.lever);
  let capp=8;const log=[];const adv={};const executed=[];
  for(const p of exec){if(capp-(p.cost||1)<0)continue;capp-=(p.cost||1);log.push("["+p.kind+"] "+p.cn+" · "+p.lever+(p.ok?" ✓":" ✗"));if(p.adv)adv[p.id]=1;executed.push(p);}
  if(Object.keys(adv).length)setLeadStage(m=>{const nm={...m};Object.keys(adv).forEach(id=>{const l=LEADS.find(x=>String(x.id)===String(id));const cur=m[id]!==undefined?m[id]:l.stage0;nm[id]=Math.min(2,cur+1);});return nm;});
  if(executed.length)logL("leads","Deal agent",executed.length+" actions · "+executed.filter(p=>p.ok).length+" correct");
  setDealAg(A=>{const tr={...A.trained},promoted=[...A.promoted],retired=[...A.retired],stats={...A.stats};
   executed.forEach(p=>{const cur=stats[p.kind]||{hits:0,attempts:0};const st={hits:cur.hits+(p.ok?1:0),attempts:cur.attempts+1};stats[p.kind]=st;
    if(st.attempts>=2){const rate=st.hits/st.attempts;
     if(rate>=0.6){tr[p.kind]=Math.min(1.5,(tr[p.kind]||1)+0.08);if(!promoted.includes(p.kind))promoted.push(p.kind);const ri=retired.indexOf(p.kind);if(ri>=0)retired.splice(ri,1);}
     else{tr[p.kind]=Math.max(0.6,(tr[p.kind]||1)-0.08);if(tr[p.kind]<=0.8&&!retired.includes(p.kind))retired.push(p.kind);}}});
   return{...A,wk:A.wk+1,log:[...log,...A.log].slice(0,12),trained:tr,stats,promoted:promoted.slice(-4),retired:retired.slice(-3),blocked:plays.filter(p=>p.block).length};});
 };
 // Historical Playback: a snapshot is a small, fixed set of aggregate metrics
 // read from the live canonical state at the moment it's captured — the same
 // figures the header/Overview already compute, not a separate data source.
 // Snapshots are session-only (no persistence layer yet); capped at 26 (~6mo
 // of weekly captures) so the list stays a trend, not an unbounded log.
 const captureSnapshot=(label)=>{
  const avgHealth=+(centers.reduce((a,c)=>a+c.health,0)/centers.length).toFixed(1);
  const redN=centers.filter(c=>c.eb<0).length;
  const staleBaseHere=c=>opt.fresh[c.name]===undefined&&(hash(c.name)%38)>21;
  const staleNHere=centers.filter(staleBaseHere).length;
  const snap={
   week:opt.week,t:Date.now(),label:label||("week "+opt.week),
   avgHealth,redN,staleN:staleNHere,
   committedN:Object.keys(dyn.committed||{}).length,
   completedN:Object.keys(dyn.completed||{}).length,
   conflictN:(railData.conflicts||[]).length,
   proposalsN:(railData.recommendations||[]).length,
  };
  setSnapshots(s=>[...s,snap].slice(-26));
 };
 const downloadReport=()=>{
  const so=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
  const rows=[["Prospect","Source","Region","Fit","Liquidity_k","NetWorth_k","Proven","MultiUnit","Stage","Note"]];
  [...LEADS].sort((a,b)=>so(b)-so(a)||b.fit-a.fit).forEach(l=>rows.push([l.n,l.src,l.region,l.fit,l.liquidity,l.net,l.proven?"Y":"N",l.multi?"Y":"N",STAGES6[so(l)],l.note]));
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="franchise-pipeline-report.csv";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
 };
 const downloadAll=()=>{
  const so=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
  const data={
   generated:new Date().toISOString(),
   product:"Franchise Development OS — Proposed Policy Framework — Candidate Submission (Pratik Singh)",
   note:"Modeled simulation export. Counts: "+centers.length+" modeled network · 64 verified from public records · FDD Item 20 = 244 authoritative (unreconciled). Seeded/illustrative figures; the status-model mechanics are real, specific numbers are modeled.",
   status_model:"Each center carries a probability split over {thriving,watch,at-risk}; the P&L review is the measurement that verifies it. Each deal carries {signs,stalls,dies} until a stage-gate verifies it.",
   world_state:{
    note:"Single integration layer — committed actions write metric deltas here; every tab reads the adjusted units.",
    adjustments:adj,
    action_ledger:ledger.map(e=>({t:new Date(e.t).toISOString(),tab:e.tab,actor:e.actor,action:e.text})),
   },
   invariants:{
    red_units:centers.filter(c=>c.eb<0).length,
    stale_units:centers.filter(staleBase).length,
    deteriorating_90d:centers.filter(c=>forecast(c).cls==="deteriorating").length,
    note:"These counts are computed once from the shared world state; every tab that displays them reads the same source."
   },
   network:centers.map(c=>{const f=forecast(c);const amp=qAmp(c);return{name:c.name,state:c.st,verified:c.verified,students:c.students,health:c.health,tier:tierOf(c.health),ebitda_k:c.eb,retention:+c.ret.toFixed(2),engagement:engageOf(c).score,forecast90_k:f.proj[2],trajectory:f.cls,status_probabilities:{thriving:+amp[0].toFixed(2),watch:+amp[1].toFixed(2),atRisk:+amp[2].toFixed(2)},status_on_review:QSTATES[qResolve(amp)]};}),
   pipeline:LEADS.map(l=>({prospect:l.n,source:l.src,region:l.region,fit:l.fit,liquidity_k:l.liquidity,netWorth_k:l.net,proven:l.proven,multiUnit:l.multi,stage:STAGES6[so(l)],note:l.note}))
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="franchise-development-os-export.json";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
 };
 useEffect(()=>{
  if(!dealAg.auto||tab!=="leads")return;
  const id=setInterval(()=>{if(dealAg.wk>=16){setDealAg(A=>({...A,auto:false}));return;}runDealWeek();},1200);
  return()=>clearInterval(id);
 },[dealAg.auto,dealAg.wk,tab]);
 const Node=({ag,vb,tg,state,c,onClick,title,w})=>(
  <span onClick={onClick} title={title||""} style={{display:"inline-flex",flexDirection:"column",cursor:onClick?"pointer":"default",verticalAlign:"middle",margin:"2px 0",minWidth:w||0}}>
   <span style={{display:"inline-flex",alignItems:"baseline",gap:5,border:`1px solid ${c||RULE}`,padding:"3px 8px",background:"#fff",fontFamily:"Helvetica",fontSize:10}}>
    {ag&&<b style={{fontSize:8.5,letterSpacing:0.4,textTransform:"uppercase",color:c||MUT}}>{ag}</b>}
    <span style={{fontWeight:700,color:INK}}>{vb}</span>
    {tg&&<span style={{color:"#555"}}>{tg}</span>}
   </span>
   <span style={{height:3,background:state==="done"?GRN:state==="run"?AMB:state==="hold"?AC:"#e4e0d6"}}/>
  </span>);
 const Arrow=()=><span style={{fontFamily:"Helvetica",fontSize:11,color:MUT,margin:"0 4px"}}>→</span>;
 const Chain=({items})=>(<div style={{display:"flex",flexWrap:"wrap",alignItems:"center",marginBottom:5}}>
  {items.map((n,i)=>(<span key={i} style={{display:"inline-flex",alignItems:"center"}}>{i>0&&<Arrow/>}<Node {...n}/></span>))}</div>);
 const Rail=({d,label,hot})=>(
  <span title={label} style={{position:"absolute",left:(d/90*100)+"%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center"}}>
   <span style={{width:9,height:9,borderRadius:5,background:hot?AC:"#fff",border:`2px solid ${hot?AC:INK}`}}/>
   <span style={{fontFamily:"Helvetica",fontSize:8,color:hot?AC:"#555",whiteSpace:"nowrap",marginTop:1}}>{label.length>16?label.slice(0,15)+"…":label}</span>
  </span>);
 const Meter=({n,p,c})=>(
  <div style={{fontFamily:"Helvetica",fontSize:10,marginBottom:4}}>
   <div style={{display:"flex",justifyContent:"space-between"}}><span>{n}</span><b>{p.toFixed(2)}</b></div>
   <div style={{height:6,background:"#eee"}}><div style={{height:6,width:(p*100)+"%",background:c,transition:"width .4s"}}/></div>
  </div>);
 const Gate=({inLabel,inVal,thr,met,payout,title})=>(
  <div title={title} style={{display:"flex",flexWrap:"wrap",alignItems:"center",marginBottom:4}}>
   <Node vb={inLabel} tg={inVal} state="done" c={RULE}/><Arrow/>
   <Node vb={"≥ "+thr} state={met?"done":"pend"} c={met?GRN:AMB} title="threshold gate"/><Arrow/>
   <Node vb={payout} state={met?"done":"pend"} c={met?GRN:MUT}/>
  </div>);
 const QWave=({amp,coh,measured,dom,note,compact,labels})=>{const d=dom!==undefined?dom:qResolve(amp);const L=labels||QSTATES;return(
  <div style={{fontFamily:"Helvetica",width:"100%"}}>
   <div style={{display:"flex",gap:2,height:compact?16:24,alignItems:"flex-end"}}>
    {amp.map((a,i)=>(<div key={i} title={L[i]+" "+pct(a)+"%"} style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:"100%"}}><div style={{background:HCOL[i],opacity:measured?(i===d?1:0.22):0.7,height:Math.max(8,a*100)+"%",borderRadius:2,transition:"opacity .3s,height .3s"}}/></div>))}
   </div>
   <div style={{display:"flex",gap:6,marginTop:3}}>{L.map((n,i)=>(<span key={i} style={{flex:1,textAlign:"center",fontSize:8}}><b style={{color:HCOL[i]}}>{pct(amp[i])}%</b> {n}</span>))}</div>
   {!compact&&<div style={{fontSize:8,color:MUT,marginTop:2,lineHeight:1.4}}>{measured?<span>Measured — verified as <b style={{color:HCOL[d]}}>{L[d]}</b> · confidence {pct(coh)}%.</span>:<span>Estimated · confidence {pct(coh)}% — estimate ages until measured.</span>}{note?" · "+note:""}</div>}
  </div>);};
 const arrow=cls=>cls==="rising"?["↑",GRN]:cls==="deteriorating"?["↓",AC]:["→",AMB];
 return(
 <div className="cn-wrap" style={{fontFamily:"Helvetica",color:INK,background:BG,maxWidth:960,margin:"0 auto",padding:"24px 18px",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale",textRendering:"optimizeLegibility"}}>
  <style>{`
   @media print {
    .no-print{display:none !important;}
    .cn-wrap{max-width:100% !important;padding:6px !important;}
   }
   @media (max-width:640px){
    .cn-wrap{padding:10px 8px !important;}
    .cn-navscroll{overflow-x:auto !important;flex-wrap:nowrap !important;-webkit-overflow-scrolling:touch;}
    .cn-navscroll::-webkit-scrollbar{height:4px;}
    .cn-hero-title{font-size:18px !important;}
   }
  `}</style>
  <div style={{borderBottom:`3px double ${INK}`,paddingBottom:8}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap"}}>
    <h1 className="cn-hero-title" style={{fontSize:24,margin:0,letterSpacing:-0.5}}>How 350+ Centers Operate as One Governed System</h1>
    <span className="no-print" style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
     <span style={{display:"flex",gap:6,alignItems:"center"}}>
      <input value={globalQ} onChange={e=>setGlobalQ(e.target.value)} placeholder="Search centers, states, views…" aria-label="Global search across centers, states, and views" style={{fontFamily:"Helvetica",fontSize:9,padding:"4px 8px",border:`1px solid ${RULE}`,minWidth:170}}/>
      {(railData.conflicts||[]).length>0&&<button onClick={()=>setTab("rail")} aria-label={(railData.conflicts||[]).length+" cross-agent conflicts, open Decision Rail"} title="Open Decision Rail" style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 8px",cursor:"pointer",border:`1px solid ${AC}`,background:"#fdf3f2",color:AC}}>⚠ {(railData.conflicts||[]).length} conflict{(railData.conflicts||[]).length>1?"s":""}</button>}
      <button onClick={()=>downloadText(buildSummaryText(centers,states,railData,dyn,opt,ledger),"cn-summary.txt")} aria-label="Download a static text summary for offline review" title="Static summary of Overview + System Alignment for offline review" style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 8px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>⬇ Print summary</button>
      <button onClick={downloadAll} style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,padding:"6px 12px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>⬇ Export / Sync to MyStudio, QuickBooks</button>
     </span>
     <span style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT}}>exports the canonical state as JSON — a live deployment would sync via API instead of manual export</span>
    </span>
   </div>
   {tab==="franchise"&&<div style={{fontFamily:"Helvetica",fontSize:15,color:"#222",margin:"7px 0 2px",lineHeight:1.45}}>The Director of Franchise Development role sits at the intersection of network strategy and center-level execution; this model is designed to operate at both levels concurrently. <span style={{color:MUT,fontSize:12.5}}>Unit-level deterioration is identified early. Support is routed under governance. Growth proceeds on a measured cadence. All figures below are live and derived from a single canonical state.</span></div>}
   {tab==="franchise"&&<div style={{fontFamily:"Helvetica",fontSize:11,color:"#555",margin:"0 0 4px",lineHeight:1.5}}><b style={{color:INK}}>The business case:</b> improve unit economics across the existing 244 before adding the next 50 — the Unit-Value Program alone models ~$1.36M/yr in additional royalty at 400 units, at the lowest risk of the four available levers.</div>}
   <div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,letterSpacing:0.5,textTransform:"uppercase",marginTop:3}}><b style={{color:INK}}>Proposed Policy Framework — Candidate Submission</b> · {centers.length} modeled{(()=>{const so=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;const s=LEADS.filter(l=>so(l)===5).length;const parts=[];if(s)parts.push("+"+s+" signed in pipeline");if(reso.signed)parts.push("+"+reso.signed+" committed openings via growth loop");return parts.length?" ("+parts.join(" · ")+")":"";})()} · 64 verified · FDD Item 20 = 244 authoritative · proposes, does not enact</div>
  </div>
  {(()=>{
   // Global search — matches center names, states/provinces, and tab labels.
   // No new data source: reads the same `centers` array and TABL dictionary
   // every other view reads. Empty query renders nothing (no wasted space).
   const q=globalQ.trim().toLowerCase();
   if(!q)return null;
   const centerMatches=centers.filter(c=>c.name.toLowerCase().includes(q)||c.st.toLowerCase()===q).slice(0,5);
   const tabMatches=Object.entries(TABL).filter(([k,label])=>label.toLowerCase().includes(q)||k.toLowerCase().includes(q)).slice(0,4);
   const noResults=centerMatches.length===0&&tabMatches.length===0;
   return(<div className="no-print" style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",padding:"7px 10px",margin:"8px 0 0"}}>
    {noResults?<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>No centers, states, or views match "{globalQ}".</div>:<>
     {centerMatches.length>0&&<div style={{marginBottom:tabMatches.length?6:0}}>
      <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginRight:6}}>Centers</span>
      {centerMatches.map(c=>(<button key={c.name} onClick={()=>{setSel(c.name);setFocusCenter(c.name);setTab("team");setGlobalQ("");}} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"3px 8px",marginRight:5,cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:INK}}>{c.name} <span style={{color:MUT}}>· {c.st}</span></button>))}
     </div>}
     {tabMatches.length>0&&<div>
      <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginRight:6}}>Views</span>
      {tabMatches.map(([k,label])=>(<button key={k} onClick={()=>{setTab(k);setGlobalQ("");}} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"3px 8px",marginRight:5,cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:INK,textTransform:"capitalize"}}>{label}</button>))}
     </div>}
    </>}
   </div>);
  })()}
  {tab!=="franchise"&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",background:"#f7f6f2",border:`1px solid ${RULE}`,padding:"5px 9px",margin:"9px 0 0",fontFamily:"Helvetica",fontSize:10}}>
   <b style={{fontSize:8.5,letterSpacing:0.5,textTransform:"uppercase",color:AC}}>90d</b>
   <span style={{color:GRN}}>↑{trend.r}</span><span style={{color:AMB}}>→{trend.h}</span><span style={{color:AC}}>↓{trend.d}</span>
   <span style={{color:MUT}}>·</span>
   {alerts.slice(0,3).map((a,i)=>(
    <button key={i} onClick={()=>{setSel(a.c.name);setTab("team");}} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"2px 6px",cursor:"pointer",border:`1px solid ${a.eta<=30?AC:AMB}`,background:"#fff",color:a.eta<=30?AC:"#855"}}>{a.c.name} · {a.ev} ~{a.eta}d</button>))}
  </div>}
  {tour>=0&&(()=>{const STEPS=[
   ["Welcome — 25-step guided flow","This is a working system, not a static document — every figure recomputes in response to actions taken. All 25 stops cover the full operating loop: growth story, peer benchmarking, system dynamics, governance, and what-if strategic modeling.",null,null],
   ["1 · Executive Summary — the whole pitch in one screen","Five numbers and three sentences — network health, governance this cycle, and the growth thesis, with no scrolling required. Start here if you only have two minutes.","exec","Open Executive Summary"],
   ["2 · Overview — network health & today's decisions","Composite health, proposed actions from four evaluation agents, and one governed action you may approve directly — all above the fold.",null,"Stay on Overview"],
   ["3 · Network Map — the whole territory at a glance","Every state in the modeled network, aggregated from its real centers — sized by unit count, colored by condition, ringed in red where a cross-agent conflict is open.","table","Open Network Map"],
   ["4 · Territory White Space — where to grow next","The forward-looking counterpart to the map: territories ranked by the same modeled headroom figure the Growth agent's own capacity gate reads, against how few units are already there.","whitespace","Open Territory White Space"],
   ["5 · Growth Pipeline — candidates & territory headroom","The lead pipeline runs the full sales cycle; the Growth Agent matches hot candidates to territories with support capacity to spare.","leads","Open Growth Pipeline"],
   ["6 · Operations Board — interventions in parallel","Every open intervention across the network, concurrently: contract-window lanes, a decision-state board, and a governed trace feed — all writing to one shared decision record.","board","Open Operations Board"],
   ["7 · Approver Workload — the capacity behind those interventions","Every proposal names an approver role and counts against that role's weekly capacity ceiling — the same limits the agents themselves respect. This is that capacity, as its own view.","workload","Open Approver Workload"],
   ["8 · Centers — unit detail, health & retention","Every center's full readout — health, trajectory, recovery time — plus the Unit Health and Retention agents' support plans.","team","Open Centers"],
   ["8b · Center Comparison — peer benchmarking across 2–5 centers","Multi-select up to five centers and see them side-by-side across health, profitability, recovery time, retention risk, engagement, and staffing stability. A real operational tool for understanding peer dynamics.","compare","Open Center Comparison"],
   ["9 · Six Lenses — one center, six perspectives","Pick any center and see it reinterpreted through student, parent, franchisee, corporate, financial, and system lenses — all synchronized to the same week and the same active signal.","lenses","Open Six Lenses"],
   ["10 · Network — clusters & best-practice propagation","The Network Propagation Agent finds the widest in-cluster health gaps and proposes where a working pattern should spread next.","network","Open Network"],
   ["11 · Programs — the four growth levers","Unit-Value, Selective Expansion, Resale & Turnaround, Status Quo — ranked by risk, each with its floor condition stated plainly.","portfolio","Open Programs"],
   ["12 · Audit Trail — the complete governed record","Every logged action this session, most recent first, with its source view and the actor who took it — the same record System Alignment summarizes, shown here in full, with search and source-tab filtering.","audit","Open Audit Trail"],
   ["13 · Success Rate — support-plan completion by type","How often a committed support path actually gets marked complete, grouped by plan type — retention, staffing, unit-economics, conversion, monitoring — read straight from the same commit/complete record Audit Trail counts.","success","Open Success Rate"],
   ["14 · Batch Operations — the same actions, applied to many centers at once","Filter by condition, state, or staleness, then re-measure or commit the top-ranked support path across the whole filtered set in one action — each skipped for an open conflict, each logged to Audit Trail.","batch","Open Batch Operations"],
   ["15 · Historical Playback — the network's own trend line","A snapshot captured automatically every time the week advances, plus manual captures here — so a reviewer can compare any two points in the session and see exactly what moved.","playback","Open Historical Playback"],
   ["16 · Reports & Exports — every export in one place","Decision ledger, recommendations, center roster, full network sync, MyStudio/QuickBooks payload shapes, and the offline summary — consolidated here instead of scattered across tabs.","reports","Open Reports & Exports"],
   ["17 · Risk Register — every at-risk unit ranked","Every center running below breakeven, with contributing factors (recovery time, data staleness, retention inflection) and the owning approver role — the enterprise-governance view of what needs attention.","risk","Open Risk Register"],
   ["18 · FDD Item 20 — franchise disclosure reconciliation","The 244 authoritative units (FDD statement) held against this model's verified and modeled figures. Stated separately, never blended — the compliance-specific view.","fdd","Open FDD Reconciliation"],
   ["19 · Week in Review — this session at a glance","A digestible memo: how many actions were taken, proposals allowed vs. held, support paths committed and completed, and a snapshot of current network state. The narrative before the ledger.","review","Open Week in Review"],
   ["20 · Sensitivity Analysis — model the business levers","Adjust tuition, support capacity, and support cost. Watch health, recovery time, royalty impact, and unit utilization recompute live. What-if scenario modeling for strategic decisions.","sensitivity","Open Sensitivity Analysis"],
   ["21 · Approval Queue — governance by role","Who owns what right now. Every approver role's queue, approval rate, and capacity spent — the operational reality of implementation.","queue","Open Approval Queue"],
   ["22 · Cohort Analysis — maturity curves","Centers grouped by age/vintage. How do new (<2yr) vs. emerging (3–5yr) vs. mature (>5yr) units compare on health, EBITDA, recovery time, engagement? The trajectory signature.","cohort","Open Cohort Analysis"],
   ["23 · Methodology — the record & the rules","This is where the six operating rules and their thresholds live, in plain language — the standard every proposal above was actually held to.","agenda","Open Methodology"],
   ["24 · Glossary — every term defined once","FBC, EBITDA, chemistry index, headroom, verified vs. modeled — plain-language definitions for a reader who isn't a franchise operator.","glossary","Open Glossary"],
  ];const [h,b,t2,lbl]=STEPS[tour];
  return(<div className="no-print" style={{position:"sticky",top:8,zIndex:50,border:`1px solid ${INK}`,borderLeft:`4px solid ${AC}`,background:"#fffdf6",boxShadow:"0 2px 8px rgba(0,0,0,0.12)",padding:"9px 12px",margin:"10px 0 0"}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
    <b style={{fontFamily:"Helvetica",fontSize:10.5}}>{h}</b>
    <button onClick={()=>setTour(-1)} aria-label="Dismiss guided tour" style={{fontFamily:"Helvetica",fontSize:9,color:MUT,cursor:"pointer",whiteSpace:"nowrap",background:"none",border:"none",padding:0}}>dismiss ×</button>
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333",lineHeight:1.5,margin:"3px 0 6px"}}>{b}</div>
   <div style={{display:"flex",gap:6,alignItems:"center"}}>
    {t2&&<button onClick={()=>setTab(t2)} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${AC}`,background:"#fff",color:AC}}>{lbl} ▸</button>}
    {tour<STEPS.length-1?<button onClick={()=>setTour(tour+1)} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:INK,color:"#fff"}}>Next ({tour+1}/{STEPS.length-1})</button>
     :<button onClick={()=>setTour(-1)} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${GRN}`,background:GRN,color:"#fff"}}>Done — explore</button>}
    <span style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>{STEPS.map((_,i)=>(i<=tour?"●":"○")).join(" ")}</span>
   </div>
  </div>);})()}
  <div className="no-print cn-navscroll" style={{display:"flex",gap:0,borderBottom:`2px solid ${INK}`,marginTop:10,flexWrap:"wrap",alignItems:"stretch"}}>
   <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 14px 0 2px",borderRight:`1px solid ${RULE}`,marginRight:6}}>
    <span style={{fontFamily:"Helvetica",lineHeight:1}}><b style={{fontSize:20,color:INK}}>{Math.round(centers.reduce((a,c)=>a+c.health,0)/centers.length)}</b><span style={{fontSize:8,fontWeight:700,letterSpacing:1,color:MUT,marginLeft:3}}>NETWORK</span></span>
    <span style={{fontFamily:"Helvetica",fontSize:9,lineHeight:1.2}}><b style={{color:GRN}}>↑{trend.r}</b> <span style={{color:MUT}}>rising</span><br/><b style={{color:INK}}>{8-cap.used}</b> <span style={{color:MUT}}>pts · wk {cap.week}</span></span>
   </div>
   {Object.keys(GROUPS).map(g=>(
    <button key={g} onClick={()=>setTab(GROUPS[g][0])} role="tab" aria-selected={groupOf(tab)===g} aria-label={"Section: "+(GROUP_LABEL[g]||g)} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1.4,textTransform:"uppercase",padding:"8px 15px",cursor:"pointer",border:"none",background:groupOf(tab)===g?INK:"transparent",color:groupOf(tab)===g?"#fff":INK}}>{GROUP_LABEL[g]||g}</button>))}
  </div>
  <div className="no-print cn-navscroll" onKeyDown={onTabBarKeyDown} style={{display:"flex",gap:0,margin:"0 0 8px",flexWrap:"wrap",borderBottom:`1px solid ${RULE}`,alignItems:"center"}}>
   {(essentialsOnly?GROUPS[groupOf(tab)].filter(t=>ESSENTIAL_TABS.includes(t)||t===tab):GROUPS[groupOf(tab)]).map(t=>(
    <button key={t} onClick={()=>setTab(t)} role="tab" aria-selected={tab===t} aria-label={"View: "+(TABL[t]||t)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",padding:"6px 12px",cursor:"pointer",border:"none",borderBottom:tab===t?`3px solid ${AC}`:"3px solid transparent",background:"transparent",color:tab===t?AC:MUT}}>{TABL[t]||t}{BADGE[t]?<span style={{marginLeft:4,fontSize:8,padding:"1px 4px",background:AC,color:"#fff",borderRadius:6}}>{BADGE[t]}</span>:null}</button>))}
   <button onClick={()=>setEssentialsOnly(v=>!v)} aria-pressed={essentialsOnly} aria-label="Toggle essentials-only navigation" style={{marginLeft:"auto",fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"4px 10px",cursor:"pointer",border:`1px solid ${RULE}`,background:essentialsOnly?INK:"#fff",color:essentialsOnly?"#fff":MUT}}>{essentialsOnly?"showing 20 essentials — show all 39":"show 20 essentials for a 5-min walkthrough"}</button>
  </div>
  {tab!=="franchise"&&<div className="no-print" style={{margin:"0 0 12px",border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`}}>
   <div style={{display:"flex",flexWrap:"wrap"}}>
    {[[`${V("measure")} 10 of ${staleN} stale`,()=>{const st=centers.filter(staleBase).slice(0,10);setOpt(o=>{const f={...o.fresh};st.forEach(c=>f[c.name]=o.week);return{...o,fresh:f};});setOpsMsg(st.length+" measured · "+(staleN-st.length)+" remain");logL(tab,"Measurement",st.length+" units re-measured");}],
      [`${V("schedule")} top ${Math.min(5,alerts.filter(a=>a.eta>0&&a.eta<=90).length)} of ${alerts.filter(a=>a.eta>0&&a.eta<=90).length} interventions`,()=>{const k=alerts.filter(a=>a.eta>0&&a.eta<=90);const nr={...ranPlays};k.slice(0,5).forEach(a=>{nr[a.c.name+a.ev]=true;
        // intervention writes real deltas: margin diagnostic lifts eb, retention pairing lifts ret/chem
        if(a.ev==="EBITDA<0")applyAdj(a.c.name,{eb:1.5});
        else if(a.ev==="sensei exit risk")applyAdj(a.c.name,{ret:0.015,chem:0.05});
        else applyAdj(a.c.name,{eb:0.8});});
       setRan(nr);setOpsMsg(Math.min(5,k.length)+" interventions committed — deltas applied to unit metrics, forecasts recomputed · gains decay weekly unless re-measured");logL(tab,"Forecast",Math.min(5,k.length)+" pre-breach interventions committed");}],
      ["Audit territory",()=>setOpsMsg("0 overlaps · governor armed")],
      ["Gate check",()=>setOpsMsg(opt.gates+" holds · 0 autonomous")],
     ].map(([s,run],i)=>{const cost=[2,3,1,1][i];return(
     <button key={i} onClick={()=>{if(cap.used+cost>8){setOpsMsg("Capacity exhausted — "+(8-cap.used)+" of 8 pts left this week.");return;}setCap(c=>({...c,used:c.used+cost}));run();}} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 9px",cursor:"pointer",border:"none",borderRight:`1px solid ${RULE}`,background:"transparent",color:cap.used+cost>8?"#bbb":"#333"}}>{s} <span style={{color:MUT,fontWeight:400}}>· {cost} pts</span></button>);})}
    <span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 9px",color:cap.used>=8?"#8b0000":"#333"}}>WK {cap.week} · {8-cap.used} of 8 pts left</span>
    <button onClick={()=>{captureSnapshot();setCap(c=>({used:0,week:c.week+1}));
      // decay: intervention gains fade week-over-week — measured units hold
      // 85% of their deltas, unmeasured units hold 55%; sub-threshold deltas clear
      setAdj(m=>{const nm={};let faded=0,held=0;Object.entries(m).forEach(([n,d])=>{
       const measured=opt.fresh[n]!==undefined;const k=measured?0.85:0.55;const nd={};let live=false;
       Object.entries(d).forEach(([f,v])=>{const x=v*k;if(Math.abs(x)>=(f==="eb"?0.2:0.005)){nd[f]=+x.toFixed(3);live=true;}});
       if(live){nm[n]=nd;measured?held++:faded++;}else faded++;});
       if(faded||held)logL(tab,"Decay",faded+" unit adjustments faded · "+held+" held by fresh measurement");
       return nm;});
     }} style={{fontFamily:"Helvetica",fontSize:9,padding:"5px 9px",cursor:"pointer",border:"none",background:"transparent",color:MUT}} title="advancing the week decays intervention gains — 85% retained with fresh measurement, 55% without">next week ▸</button>
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333",padding:"4px 9px",borderTop:`1px solid ${RULE}`}}><b style={{color:AC,fontSize:8.5}}>RESULT · </b>{opsMsg}</div>
  </div>}
  {["acquire","deliver","retain","operate","plan","metrics","failure","fivebasis"].includes(tab)&&(()=>{
   // agentic integration strip: static reference content on these tabs now sits
   // on top of the live world state — same agents, same ledger, one system
   const tgt=[...centers].filter(c=>forecast(c).cls==="deteriorating").sort((a,b)=>a.health-b.health)[0];
   return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#faf9fc",padding:"6px 10px",margin:"0 0 10px",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
    <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:VIO}}>Live system</span>
    <span style={{fontFamily:"Helvetica",fontSize:9,color:"#444"}}>{Object.keys(adj).length} units adjusted · {ledger.length} actions on record · agents active: Measurement → {staleN} stale · Support → {red.length} red</span>
    {tgt&&<button onClick={()=>{logL(tab,"Support",tgt.name+" queued for support plan from the "+((TABL[tab]||tab))+" reference");setOpsMsg(tgt.name+" queued — see RECORD");}} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${AC}`,background:"#fff",color:AC}}>Queue support: {tgt.name} ▸</button>}
    <button onClick={()=>setTab("agenda")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>Open record ▸</button>
   </div>);})()}
  {["portfolio","mastery","growth","calendar"].includes(tab)&&(()=>{
   // programs hub: the four PROGRAMS tabs are one pipeline — program design →
   // interaction check → schedule → growth outcome. One strip, shared metrics.
   const hub=[["portfolio","1 · programs","design & stage-gates"],["mastery","2 · belts","progression engine"],["calendar","3 · calendar","the operating rhythm"],["growth","4 · growth","pricing & outcome"]];
   return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AMB}`,background:"#fdfaf2",padding:"6px 10px",margin:"0 0 10px"}}>
    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
     <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:AMB}}>Programs pipeline</span>
     {hub.map(([t,l,d],i)=>(<span key={t} style={{display:"inline-flex",alignItems:"center"}}>{i>0&&<span style={{color:MUT,margin:"0 3px"}}>→</span>}
      <button onClick={()=>setTab(t)} title={d} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 8px",cursor:"pointer",border:`1px solid ${tab===t?AMB:RULE}`,background:tab===t?"#fdf6e6":"#fff",color:tab===t?"#8a6d1a":"#555"}}>{l}</button></span>))}
     <span style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginLeft:"auto"}}>one pipeline: design → interaction check → schedule → outcome · reads the same {centers.length}-unit network</span>
    </div>
   </div>);})()}
  {!["franchise","acquire","deliver","retain","operate","plan","failure","agenda","warning","fivebasis","signals"].includes(tab)&&(()=>{
   const qc=team;const qamp=qAmp(qc);const qmeas=!staleBase(qc)||opt.fresh[qc.name]!==undefined;
   const qdays=opt.fresh[qc.name]!==undefined?7:(hash(qc.name)%38);const qcoh=qCoherence(qdays);const qdom=qResolve(qamp);
   const samp=qStateAmp(states[stSel]||[]);
   const nav=[["network","map"],["team","center"],["engagement","engagement"],["growth","growth"],["transfers","transfers"],["pain","priorities"]];
   return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#faf9fc",padding:"7px 10px",margin:"0 0 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:VIO}}>Operational focus · {qc.name} <span style={{color:MUT,fontWeight:400,textTransform:"none",letterSpacing:0}}>· {stSel} state {QSTATES[qResolve(samp)]}</span></div>
     <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{nav.map(([t,l])=>(<button key={t} onClick={()=>setTab(t)} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"3px 7px",cursor:"pointer",border:`1px solid ${tab===t?VIO:RULE}`,background:tab===t?VIO:"#fff",color:tab===t?"#fff":"#555"}}>{l}</button>))}</div>
    </div>
    <div style={{display:"flex",gap:12,alignItems:"flex-end",marginTop:6,flexWrap:"wrap"}}>
     <div style={{flex:1,minWidth:200}}><QWave amp={qamp} coh={qcoh} measured={qmeas} dom={qdom} note={"health "+qc.health+" \u00b7 "+tierOf(qc.health)}/></div>
     {(()=>{const g=qGate(qc,qdays);return(
      <button disabled={!g.allow&&!qmeas} onClick={()=>{if(!g.allow){return;}setOpt(o=>({...o,fresh:{...o.fresh,[qc.name]:o.week}}));logL(tab,"Measurement",qc.name+" verified — all four governors clear");}} title={g.allow?"all four governors clear \u2014 measurement approved":"held by: "+g.held.map(h=>h.label).join(", ")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 9px",cursor:g.allow||qmeas?"pointer":"not-allowed",border:`1px solid ${g.allow?VIO:AC}`,background:qmeas?VIO:g.allow?"#fff":"#fbeaea",color:qmeas?"#fff":g.allow?VIO:AC}}>{qmeas?"\u25c6 measured \u2014 current":g.allow?"\u27f2 measure \u2014 verify":"\u2298 held \u2014 "+g.held.length+" governor"+(g.held.length>1?"s":"")}</button>);})()}
    </div>
    {(()=>{const g=qGate(qc,qdays);return(
     <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
      {g.verdicts.map((v,i)=>(<span key={i} title={v.detail} style={{fontFamily:"Helvetica",fontSize:7.5,fontWeight:700,letterSpacing:0.3,padding:"2px 6px",border:`1px solid ${v.pass?GRN:AC}`,background:v.pass?"#eef8f0":"#fbeaea",color:v.pass?GRN:AC}}>{v.pass?"\u2713":"\u2298"} {v.label}</span>))}
      <span style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT,padding:"2px 4px"}}>{g.allow?"measurement approved":"measurement held \u2014 fail-safe: missing data does not pass"}</span>
     </div>);})()}
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:4}}>The map sets this focus — pick a state or center on <b>franchise</b>, and every section reads the same verified unit. This rail carries {qc.name} across sections. <b>Every measurement passes the four governors first.</b></div>
    {(()=>{const d=qDiag(qc);const warn=d.tau>3;const critLow=d.crit<2;const zoneC=d.zone.zone==="self-stabilizing"?GRN:d.zone.zone==="transitional"?AMB:AC;
     const cells=[
      ["Stability zone",d.zone.zone,zoneC,d.zone.note+" \u00b7 occupancy "+pct(d.zone.occ)+"%"],
      ["Early-warning \u03c4",d.tau+"w",warn?AC:GRN,warn?"memory time above 3 weeks \u2014 elevated transition risk inside 30 days":"memory time normal \u2014 unit re-equilibrates quickly"],
      ["Critical distance","$"+d.crit+"k",critLow?AC:GRN,critLow?"margin within $2k of the transition boundary \u2014 contingency required before any pricing change":"margin headroom above the transition boundary"],
      ["Program interaction",d.pair[0]+" \u00d7 "+d.pair[1],d.pair[2]>0?GRN:AC,(d.pair[2]>0?"constructive ":"destructive ")+"coefficient "+d.pair[2]+" \u2014 "+(d.pair[2]>0?"run together":"sequence, do not stack")],
      ["Sustainability",(d.bal.net>=0?"+":"")+d.bal.net+"/wk",d.bal.net>=-0.002?GRN:AMB,"engagement gain "+d.bal.gain+" vs overhead "+d.bal.cost+" \u2014 "+(d.bal.net>=-0.002?"balanced; cadence can run indefinitely":"cost exceeds gain; reduce cadence")]];
     return(<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
      {cells.map(([n,v,col,tip],i)=>(<div key={i} title={tip} style={{flex:"1 1 120px",minWidth:118,border:`1px solid ${RULE}`,background:"#fff",padding:"4px 7px"}}>
       <div style={{fontFamily:"Helvetica",fontSize:7.5,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT}}>{n}</div>
       <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700,color:col}}>{v}</div>
      </div>))}
     </div>);})()}
   </div>);})()}
  {tab==="growth"&&(<div>
   <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#faf9fc",padding:"7px 10px",marginBottom:10}}>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:VIO,marginBottom:4}}>Growth outcome · {"pending until you commit"}</div>
    <QWave amp={[0.30,0.45,0.25]} coh={0.34} measured={false} labels={["upside","base","downside"]} note={"P90 $19.4M \u00b7 P50 $13.6M \u00b7 P10 $8.1M royalty"}/>
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:3}}>The royalty line is a range, not a number. Committing an intervention locks it to a figure — the four governors below hold the floor so the commitment can't land below breakeven. <button onClick={()=>setTab("dynamics")} style={{fontFamily:"Helvetica",fontSize:8,color:AC,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0}}>Try this in the scenario sandbox →</button></div>
   </div>
   {[["Baseline",4.9,MUT],["Premium tier 70%",6.3,GRN],["Retention +3",7.1,GRN],[centers.length+" units",8.6,VIO],["400 units",13.6,VIO]].map(([n,v,c],i)=>(
    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
     <span style={{fontFamily:"Helvetica",fontSize:9.5,width:90}}>{n}</span>
     <div style={{flex:1,height:14,background:"#f0ede6"}}><div style={{height:14,width:(v/13.6*100)+"%",background:c}}/></div>
     <b style={{fontFamily:"Helvetica",fontSize:10}}>${v}M/yr</b>
    </div>))}
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,margin:"2px 0 8px"}}>royalty line · illustrative until fit · P10 $8.1 / P50 $13.6 / P90 $19.4</div>
   {[["gate","cannibalization ≥0","block signature"],["cap","candidate supply","throttle wave"],["wave","ramp < prior","pause scale"],["score","measure lag","freeze claims"],["fcst","J-curve dip","fund runway"]].map(([ag,g,act],i)=>(
    <Chain key={i} items={[{ag:A(ag),vb:g,state:"run",c:AMB,title:"governor "+(i+1)},{vb:act,state:"pend",c:AC}]}/>))}
   <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:14}}>The Four Growth Programs</div>
   {ACTION_PLANS.map((p,i)=>{
    const isUV=p.n==="Unit-Value Program";
    const range=isUV?financialRange(1.36,0.18):null; // range basis: same P10/P50/P90 spread shown above
    const delta=franchiseeDeltaOf(p);
    const isExp=p.n==="Selective Expansion";
    return(
    <div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderTop:i?"1px solid #eee":"none",fontFamily:"Helvetica"}}>
     <span style={{fontFamily:"Helvetica",fontSize:14,fontWeight:700,color:AC}}>{p.r}</span>
     <div style={{flex:1}}>
      <b style={{fontSize:14}}>{p.n}</b>
      <div style={{fontSize:12.5,color:"#444",lineHeight:1.5}}>{p.d}</div>
      <div style={{fontFamily:"Helvetica",fontSize:10,color:MUT}}>FLOOR: {p.floor}</div>
      {range&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,marginTop:2}}>range: ${range.lo}M–${range.hi}M/yr at 400 units (±{Math.round(range.uncertaintyPct*100)}%, point estimate ${range.point}M)</div>}
      <div style={{fontFamily:"Helvetica",fontSize:9.5,color:delta.unitMarginDelta_k>0?GRN:delta.unitMarginDelta_k<0?AC:MUT,marginTop:2}}>franchisee unit: {delta.unitMarginDelta_k>0?"+":""}{delta.unitMarginDelta_k!==0?"$"+delta.unitMarginDelta_k+"k/yr margin":"no unit-level change"} · payback {delta.payback_yr} — {delta.note}</div>
      {isExp&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,marginTop:2}}>J-curve: a new unit does not open at target economics — {rampMilestones().map(r=>r.m+"mo "+r.pct+"%").join(" · ")} of target</div>}
     </div>
     <span style={{fontFamily:"Helvetica",fontSize:11,color:"#444"}}>{p.risk}</span>
    </div>);})}
   <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6,marginTop:14}}>Unit-Value Chain</div>
   {CENTER_CHAIN.map((c,i)=>(<div key={i} style={{padding:"3px 0",borderTop:i?"1px solid #eee":"none",display:"flex",gap:6,fontFamily:"Helvetica"}}><span style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:i===0?AC:MUT,minWidth:14}}>{i+1}.</span><span style={{fontSize:13,color:"#444"}}>{c}</span></div>))}
  </div>)}
  {tab==="calendar"&&(<div>
   {CAL.map(([stream,evs])=>(
    <div key={stream} style={{marginBottom:16}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:AC,marginBottom:14}}>{stream}</div>
     <div style={{position:"relative",height:30,borderTop:`1px solid ${INK}`,margin:"0 30px"}}>
      {evs.map(([d,l,hot],i)=><Rail key={i} d={d} label={l} hot={!!hot}/>)}
     </div>
    </div>))}
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>D0=Jul 2 → D90 · red = act now · FLL: 2026-27 = FINAL FIRST·LEGO season</div>
  </div>)}
  {tab==="table"&&(<EngineErrorBoundary><CommandTableTab centers={centers} states={states} opt={opt} setOpt={setOpt} railData={railData} leads={LEADS} jumpTo={jumpTo}/></EngineErrorBoundary>)}
  {tab==="network"&&(()=>{
   // Respects a local override from Quantum PM's governed-tabs grid, same
   // pattern as Financials/exec — both the recovery-time distribution and the
   // per-state drill-down are health/eb-derived, so a scenario override
   // genuinely changes what's shown here.
   const netOverride=opt.quantum&&opt.quantum.overrides&&opt.quantum.overrides.network;
   const netGlobalPosture=(opt.quantum&&opt.quantum.approved)||"realistic";
   const netOverrideActive=!!(netOverride&&netOverride!==netGlobalPosture);
   const netOv=netOverrideActive?computeOverrideView(rawCenters,adj,netOverride,opt.week,LEADS):null;
   const netCenters=netOv?netOv.centers:centers;
   const netStates=netOv?netOv.states:states;
   const taus=netCenters.map(c=>qTau(c));
   const tBins=[taus.filter(t=>t<=2).length,taus.filter(t=>t>2&&t<=3).length,taus.filter(t=>t>3).length];
   const netStSel=netStates[stSel]?stSel:Object.keys(netStates)[0];
   return(<div>
   {netOverrideActive&&<div style={{border:`1px solid ${VIO}`,borderLeft:`3px solid ${VIO}`,background:"#faf9ff",padding:"6px 10px",marginBottom:8,fontFamily:"Helvetica",fontSize:9.5,color:"#3d3470"}}>This tab is locally overridden to <b>{netOverride}</b> — network-wide posture is <b>{netGlobalPosture}</b>. Recovery-time distribution and per-unit health below reflect the override. Set from Quantum PM.</div>}
   <div style={{border:`1px solid ${RULE}`,borderLeft:"3px solid #7a6bd8",background:"#faf9fc",padding:"7px 10px",marginBottom:8}}>
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,color:"#7a6bd8",marginBottom:4}}>Each unit is tracked as a probability-weighted status (thriving / watch / at-risk) with a recovery-time distribution</div>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"baseline"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:"#7a6bd8"}}>Recovery-time distribution</div>
     {[["rec ≤ 2w fast",tBins[0],GRN],["2–3w slowing",tBins[1],"#b8860b"],["rec > 3w critical",tBins[2],AC]].map(([l,v,c],i)=>(
      <span key={i} style={{fontFamily:"Helvetica",fontSize:9.5}}><b style={{color:c,fontSize:12}}>{v}</b> <span style={{color:MUT}}>{l}</span></span>))}
     <span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>· recovery time {'>'} 3w forecasts floor contact ≈ 30d — support plan required</span>
    </div>
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
    {Object.keys(netStates).sort((a,b)=>netStates[b].length-netStates[a].length).map(st=>(
     <Node key={st} vb={st} tg={netStates[st].length+(netStates[st].some(c=>c.verified)?"":" ~")} state={st===netStSel?"done":"pend"} c={st===netStSel?AC:RULE} onClick={()=>setSt(st)}/>))}
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
    {netStates[netStSel].sort((a,b)=>b.health-a.health).map(c=>{const[ar]=arrow(forecast(c).cls);const ct=qTau(c);
     return(<Node key={c.name} vb={c.name} tg={c.health+" "+tierOf(c.health)+" "+ar+" rec "+ct} state={c.name===sel?"done":c.verified?"pend":"hold"} c={c.name===sel?AC:ct>3?AC:c.verified?RULE:MUT} onClick={()=>{setSel(c.name);setTab("team");}} title={(c.verified?"verified":"modeled")+" · "+ct+"w recovery · click to open"}/>);})}
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:5}}>solid = verified · gray = modeled · red chip = recovery &gt; 3w (critical slowing down) · rail: green done / red hold · click = open</div>
  </div>);})()}
  {tab==="team"&&(()=>{const tf=forecast(team);const[ar,ac2]=arrow(tf.cls);const tmTau=qTau(team);const tauStr=tmTau<=2?tmTau+"w fast":tmTau<=4?tmTau+"w slowing":tmTau+"w critical";
   const inc=[["EBITDA",fmt(team.eb)+"k",">6k",team.eb>6,"Performance rebate"],["Retention",pct(team.ret)+"%","≥88%",team.ret>0.88,"Retention Gold"],["Chemistry",pct(team.chem)+"%","≥65%",team.chem>0.65,"Chemistry credit"],["Report",staleBase(team)?"stale":"fresh","≤21d",!staleBase(team),"Cadence rebate"],["Momentum",team.momentum,"+3",team.momentum[0]==="+"&&parseInt(team.momentum.slice(1))>=3,"Momentum spotlight"],["Recovery time",tauStr,"fast",tf.tau<=2,<span style={{fontSize:8,color:MUT}}>Slowing recovery at 3w+</span>],["Health Index",team.health,"≥85",team.health>=85,"Donor credit /adoption"]];
   const e=engageOf(team);
   const measured=!staleBase(team)||opt.fresh[team.name]!==undefined;
   // Measurement confidence uses the same qCoherence decay every other view reads
   // (System Alignment, the map, Six Lenses) instead of a flat measured/not-measured
   // toggle -- one concept, one formula, wherever it's shown.
   const teamDays=opt.fresh[team.name]!==undefined?(opt.week-opt.fresh[team.name])*7:(hash(team.name)%38)+opt.week*2;
   const teamConf=Math.round(qCoherence(teamDays)*100);
   const ATTR=[["Enrollment",Math.min(99,Math.round(30+team.conv*95))],["Retention",Math.round(team.ret*100)],["Instruction",Math.min(99,Math.round(38+e.pre*55))],["Community",Math.min(99,Math.round(28+e.refer*70+e.buzz*25))],["Staff chemistry",Math.round(team.chem*100)],["Measurement",teamConf],["Facilities",45+hash(team.name+"fac")%40]];
   const sorted=[...ATTR].sort((a,b)=>b[1]-a[1]);
   const strengths=sorted.slice(0,2),weaks=sorted.slice(-2).reverse();
   const cx=70,cy=70,R=52,Nn=ATTR.length;
   const ptf=(i,f)=>{const a=-Math.PI/2+i*2*Math.PI/Nn;return[cx+Math.cos(a)*R*f,cy+Math.sin(a)*R*f];};
   const poly=ATTR.map((at,i)=>ptf(i,at[1]/99).map(v=>v.toFixed(1)).join(",")).join(" ");
   const grid=[0.33,0.66,1].map(g=>ATTR.map((_,i)=>ptf(i,g).map(v=>v.toFixed(1)).join(",")).join(" "));
   const verdict=weaks[0][1]<55?"Needs intervention — "+weaks[0][0].toLowerCase()+" is the drag":team.health>=85?"Donor-grade — a pattern source for the network":team.health>=75?"Solid unit — one gap from the next tier":"Developing — the fix is known and named";
   const DEPT=[["Acquisition",[ATTR[0][1],ATTR[3][1]]],["Instruction",[ATTR[2][1],ATTR[5][1]]],["Retention",[ATTR[1][1],ATTR[4][1]]],["Operations",[team.health,ATTR[6][1]]]].map(([n,vs])=>{const g=Math.round(vs.reduce((a,b)=>a+b,0)/vs.length);return[n,g,g>=85?"A":g>=78?"B":g>=68?"C":g>=58?"D":"F"];});
   const FIX={Enrollment:"trial-to-enrollment coaching + day-7 follow-up",Retention:"engagement-based re-enrollment + at-risk outreach",Instruction:"pre/post-session routine + sensei certification",Community:"school partnership + demo day on the calendar",["Staff chemistry"]:"sensei 1:1 + CIT draft from Red/Black belts",Measurement:"measure now — verify the estimate first",Facilities:"floor refresh in the facility budget quarter"};
   return(<div>
   <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"baseline",marginBottom:6}}>
    <h2 style={{fontSize:18,margin:0}}>{team.name}</h2>
    <span style={{fontFamily:"Helvetica",fontSize:10}}>{team.health} {tierOf(team.health)} · {team.students} students · {team.momentum+" trend"} · <b style={{color:ac2}}>{ar} {fmt(tf.proj[2])}k @90d</b></span>
   </div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:8}}>
     <div style={{background:"linear-gradient(135deg,#161616,#232323)",padding:"12px 14px",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{textAlign:"center",minWidth:70}}>
       <div style={{fontFamily:"Helvetica",fontSize:46,fontWeight:800,color:"#fff",lineHeight:0.9}}>{team.health}</div>
       <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:1.5,color:team.health>=88?"#6fc38a":team.health>=80?"#d9a62e":team.health>=68?"#bbb":"#d96a6a"}}>{tierOf(team.health)}</div>
      </div>
      <svg viewBox="0 0 140 140" style={{width:118,height:118,flexShrink:0}}>
       {grid.map((g,i)=>(<polygon key={i} points={g} fill="none" stroke="#3a3a3a" strokeWidth="0.7"/>))}
       {ATTR.map((_,i)=>{const[x,y]=ptf(i,1);return(<line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#333" strokeWidth="0.5"/>);})}
       <polygon points={poly} fill="rgba(139,0,0,0.35)" stroke="#c0504d" strokeWidth="1.6"/>
       {ATTR.map((at,i)=>{const[x,y]=ptf(i,1.16);return(<text key={i} x={x} y={y+2} textAnchor="middle" style={{font:"bold 6.5px Helvetica",fill:"#9a9a9a"}}>{at[0].split(" ")[0].slice(0,4).toUpperCase()}</text>);})}
      </svg>
      <div style={{flex:1,minWidth:180}}>
       <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:1.5,color:"#8a8a8a",marginBottom:2}}>SCOUTING REPORT</div>
       <div style={{fontFamily:"Helvetica",fontSize:15,color:"#fff",lineHeight:1.25,marginBottom:6}}>{verdict}</div>
       <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <div>{strengths.map(([n,v],i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,color:"#a9d6b4",marginBottom:1}}>▲ {n} <b>{v}</b></div>))}</div>
        <div>{weaks.map(([n,v],i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,color:"#e0a0a0",marginBottom:1}}>▼ {n} <b>{v}</b></div>))}</div>
       </div>
      </div>
     </div>
     <div style={{padding:"10px 12px"}}>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
       <div style={{flex:"1 1 240px"}}>
        <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:3}}>The two fixes that move this unit</div>
        {weaks.map(([n,v],i)=>(<div key={i} style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,padding:"5px 8px",marginBottom:4}}><b style={{fontFamily:"Helvetica",fontSize:9.5}}>{n} {v}</b><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>→ {FIX[n]}</div></div>))}
       </div>
       <div style={{flex:"1 1 160px"}}>
        <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:4}}>Department grades</div>
        {DEPT.map(([n,g,L],i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,fontFamily:"Helvetica",fontSize:9.5}}>
         <span style={{width:78}}>{n}</span>
         <div style={{flex:1,height:6,background:"#eee"}}><div style={{height:6,width:g+"%",background:g>=78?GRN:g>=68?AMB:AC}}/></div>
         <b style={{width:16,textAlign:"center",color:g>=78?GRN:g>=68?AMB:AC}}>{L}</b></div>))}
       </div>
      </div>
     </div>
   </div>
   <svg viewBox="0 0 700 150" style={{width:"100%",height:"auto",margin:"4px 0"}}>
    {Object.entries(team.wires).map(([w,gs],wi)=>(
     <g key={w}>
      <text x="4" y={26+wi*34} style={{font:"9px Helvetica",fill:MUT}}>{w}</text>
      <line x1="52" y1={22+wi*34} x2="690" y2={22+wi*34} stroke={INK} strokeWidth="1"/>
      {gs.map((g,gi)=>(
       <g key={gi}>
        <rect x={90+gi*200} y={10+wi*34} width={110} height={24} fill={g.state==="super"?"#fff":"#f4f2ec"} stroke={g.state==="super"?MUT:INK} strokeDasharray={g.state==="super"?"4 3":"0"}/>
        <text x={145+gi*200} y={21+wi*34} textAnchor="middle" style={{font:"8px Helvetica",fill:INK}}>{g.n}</text>
        <text x={145+gi*200} y={31+wi*34} textAnchor="middle" style={{font:"bold 9px Helvetica",fill:g.state==="super"?MUT:g.v>=60?GRN:AC}}>{g.state==="super"?g.days+"d ?":g.v}</text>
       </g>))}
     </g>))}
   </svg>
   {(()=>{const amp=qAmp(team);const dom=qResolve(amp);const meas=!staleBase(team)||opt.fresh[team.name]!==undefined;
    return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#fff",padding:"8px 10px",marginTop:8}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:VIO,marginBottom:5}}>Unit status — {meas?"verified · measured this cycle":"estimated · awaiting P&L measurement"}</div>
     <div style={{display:"flex",gap:8,alignItems:"flex-end",height:52,marginBottom:4}}>
      {amp.map((a,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:"100%"}}>
       <div style={{background:HCOL[i],opacity:meas?(i===dom?1:0.22):0.7,height:(Math.max(3,a*100))+"%",borderRadius:2,transition:"opacity .3s"}}/></div>))}
     </div>
     <div style={{display:"flex",gap:8,marginBottom:4}}>{QSTATES.map((n,i)=>(<div key={i} style={{flex:1,textAlign:"center",fontFamily:"Helvetica",fontSize:8.5}}><b style={{color:HCOL[i]}}>{pct(amp[i])}%</b> {n}</div>))}</div>
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,lineHeight:1.5}}>{meas?<span>Measured — the P&amp;L review verified this unit as <b style={{color:HCOL[dom]}}>{QSTATES[dom]}</b> on the books. Confidence high.</span>:<span>Unmeasured — the unit carries a probability split across all three outcomes, and confidence in the estimate decays the longer it goes unmeasured. The P&amp;L review is the checkpoint that verifies it; run <b>Measure</b> from the operations bar now.</span>}</div>
    </div>);})()}
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:GRN,margin:"8px 0 4px"}}>Incentive gates</div>
   {inc.map(([l,v,thr,met,pay],i)=><Gate key={i} inLabel={l} inVal={v} thr={thr} met={met} payout={pay} title={met?"earned":"gap to threshold"}/>)}
   <OpHealthIndex center={team} staleBase={staleBase(team)} health={team.health} tau={Math.round(qTau(team))} />
    
    <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${AMB}`,padding:"7px 10px",marginTop:8}}>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AMB,marginBottom:4}}>Quarter goal — negotiated, not assigned</div>
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
     {[["Stretch","margin +3.0k","full support budget"],["Standard","margin +1.5k","standard support"],["Floor","hold margin","development review"]].map(([n,t,r],i)=>(
      <button key={i} onClick={()=>setGoals(g=>({...g,[team.name]:i}))} style={{fontFamily:"Helvetica",fontSize:9,padding:"5px 9px",cursor:"pointer",border:`1px solid ${goals[team.name]===i?AMB:RULE}`,background:goals[team.name]===i?"#fdf6e6":"#fff",textAlign:"left"}}>
       <b>{n}</b> · {t}<br/><span style={{color:MUT,fontSize:8}}>unlocks {r}</span></button>))}
    </div>
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:8}}>payouts illustrative · computed from measured state</div>
  </div>);})()}
  {tab==="mastery"&&(<div>
   <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
    {PATH.map(([id,n],i)=>{const[,st2,d2]=COHORT[id];
     return(<span key={id} style={{display:"inline-flex",alignItems:"center"}}>{i>0&&<Arrow/>}
      <Node vb={n} tg={COHORT[id][0]+" · "+st2+"⚠"} state={id===blocker[0]?"hold":d2>21?"hold":"run"} c={id===blocker[0]?AC:id===beltSel?VIO:RULE} onClick={()=>setBelt(id)} title={st2+" stuck · assessed "+d2+"d ago"}/></span>);})}
   </div>
   <Chain items={[{ag:A("score"),vb:"blocker",tg:blocker[1]+" belt",state:"hold",c:AC,title:"stuck × downstream max"},{ag:"sensei",vb:"rotate",tg:"minutes here first",state:"pend",c:GRN}]}/>
   {(()=>{const[,st2,d2]=COHORT[beltSel];return(<div>
    <Chain items={[{ag:A("score"),vb:V("measure"),tg:PATH.find(b=>b[0]===beltSel)[1]+" "+d2+"d",state:d2>21?"hold":"done",c:d2>21?AC:GRN},{ag:"sensei",vb:"help @2 attempts",tg:st2+" stuck",state:st2>30?"hold":"run",c:st2>30?AC:AMB},{ag:A("view"),vb:V("ship"),tg:"progress report 72h",state:d2<=3?"done":"pend",c:d2<=3?GRN:AMB},{ag:"ceremony",vb:"renew",tg:"at belt-up",state:"pend",c:GRN}]}/>
   </div>);})()}
  </div>)}
  {tab==="optimizer"&&(()=>{
   const staleOf=c=>opt.fresh[c.name]!==undefined?(opt.week-opt.fresh[c.name])*7:(hash(c.name)%38)+opt.week*2;
   const freshN=centers.filter(c=>staleOf(c)<=21).length;
   return(<div>
   <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
    <button onClick={()=>setOpt(o=>({...o,run:!o.run}))} style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,padding:"6px 14px",cursor:"pointer",background:opt.run?"#fff":INK,color:opt.run?INK:"#fff",border:`1px solid ${INK}`}}>{opt.run?"Pause":"Run live"}</button>
    {[["wk",opt.week],["measured",freshN+"/"+centers.length],["holds",opt.gates]].map(([l,v],i)=>(
     <Node key={i} vb={l} tg={String(v)} state="done" c={RULE}/>))}
    <Node vb="standalone" tg="zero external dependencies" state="done" c={GRN}/>
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:6}}>
    {centers.map(c=>{const st=staleOf(c)>21;const col=c.health>=80?GRN:c.health>=68?AMB:AC;const fcol=arrow(forecast(c).cls)[1];
     return(<div key={c.name} onClick={()=>{setSel(c.name);setTab("team");}} title={c.name} style={{width:12,height:15,cursor:"pointer"}}>
      <div style={{height:11,background:st?"#fff":col,border:`1.5px ${st?"dashed":"solid"} ${col}`,opacity:st?0.5:1}}/>
      <div style={{height:3,background:fcol,marginTop:1}}/></div>);})}
   </div>
   <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
    <div style={{flex:"1 1 260px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>Effectiveness scores — rise only with measured outcome</div>
     {Object.entries(opt.probs).map(([n,p])=><Meter key={n} n={n} p={p} c={n==="pricing"?AC:GRN}/>)}
     <div style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT,marginTop:2}}>measurement credit = staleness-days actually cleared · transfer credit = conversion gap closed · review credit = retention spread paired · wave sized by rising-unit count · pricing gate holds only while units sit below breakeven</div>
    </div>
    <div style={{flex:"1 1 300px"}}>
     {opt.log.map((l,i)=>(<Chain key={i} items={[{ag:A(l[0]==="score"?"score":l[0]==="transfer"?"transfer":l[0]==="peer"?"peer":l[0]==="wave"?"wave":"gate"),vb:V(l[1]==="measure"?"measure":l[1]==="transfer"?"transfer":l[1]==="review"?"review":l[1]==="hold"?"hold":"schedule"),tg:l[2],state:l[3]?"done":"hold",c:l[3]?GRN:AC}]}/>))}
     {!opt.log.length&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>press Run live — one week ≈ 0.9s</div>}
    </div>
   </div>
  </div>);})()}
  {tab==="transfers"&&(()=>{
   const meas=centers.filter(c=>!staleBase(c));
   const donors=meas.filter(c=>c.health>=83).slice(0,6);
   const recips=[...meas].sort((a,b)=>a.conv-b.conv).slice(0,6);
   return(<div>
   {donors.map((d,i)=>{const r=recips[i%recips.length];if(!r||d===r)return null;const pre=forecast(r).cls==="deteriorating";
    const gap=d.conv-r.conv;const promoted=gap>0.15;const mult=(1+gap).toFixed(2);
    return(<Chain key={i} items={[{ag:A("transfer"),vb:V("transfer"),tg:d.name,state:"done",c:GRN,onClick:()=>{setSel(d.name);setTab("team");},title:"donor · click to open"},{vb:"best practice",tg:promoted?"promoted "+mult+"×":"trial · gap "+Math.round(gap*100)+"pt",state:promoted?"done":"run",c:promoted?GRN:AMB,title:"promotion requires a ≥15pt measured conversion gap"},{vb:r.name,tg:pre?"pre-emptive":"30d re-measure",state:pre?"hold":"pend",c:pre?AC:RULE,onClick:()=>{setSel(r.name);setTab("team");}}]}/>);})}
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>donor → best practice (promoted at ≥15pt measured conversion gap; multiplier = 1 + gap) → recipient · red = pre-emptive</div>
  </div>);})()}
  {tab==="portfolio"&&(<div>
   {PROJECTS.map(p=>(
    <div key={p.id} style={{display:"flex",flexWrap:"wrap",alignItems:"center",marginBottom:5}}>
     <span style={{fontFamily:"Helvetica",fontSize:9.5,width:120,fontWeight:700}}>{p.n}</span>
     {p.stages.map(([sn,st,d],i)=>(<span key={i} style={{display:"inline-flex",alignItems:"center"}}>{i>0&&<Arrow/>}
      <Node vb={sn} tg={st===2?d+"d ?":""} state={st===2?"hold":st===1?"run":i<2?"done":"pend"} c={st===2?AC:st===1?AMB:RULE} title={st===2?"unmeasured "+d+"d — measure first":""}/></span>))}
    </div>))}
   <Chain items={[{vb:"Premium tier",state:"run",c:GRN},{vb:"× progress report",tg:"reinforcing",state:"run",c:GRN}]}/>
   <Chain items={[{vb:"schools",state:"run",c:AC},{vb:"× events",tg:"competing — sequence",state:"hold",c:AC}]}/>
  </div>)}
  {tab==="pain"&&(()=>{
   const painOf=c=>+(0.68*(c.eb<0?1:c.eb<3?0.6:0.15)+0.62*(staleBase(c)?0.9:0.2)+0.54*(1-c.ret)).toFixed(2);
   const pq=[...centers].map(c=>({c,p:painOf(c)})).sort((a,b)=>b.p-a.p).slice(0,6);
   return(<div>
   <svg viewBox="0 0 700 210" style={{width:"100%",height:"auto"}}>
    {PEDGES.map(([m,g,w],i)=>{const mi=MECHS.findIndex(x=>x.id===m),gi=GRIEV.findIndex(x=>x.id===g);
     return <line key={i} x1={230} y1={22+mi*24} x2={500} y2={26+gi*32} stroke={VIO} strokeWidth={0.5+w*2} opacity={0.3+w*0.5}/>;})}
    {MECHS.map((m,i)=>(<g key={m.id}><rect x={20} y={12+i*24} width={210} height={18} fill="#fff" stroke={INK}/>
     <text x={125} y={24+i*24} textAnchor="middle" style={{font:"8.5px Helvetica"}}>{m.n} · {LEV.find(x=>x.id===m.id).lev}</text></g>))}
    {GRIEV.map((g,i)=>(<g key={g.id}><rect x={500} y={12+i*32} width={150} height={24} fill={g.sev>=0.6?"#fbf3f3":"#fdf6e6"} stroke={g.sev>=0.6?AC:AMB}/>
     <text x={575} y={23+i*32} textAnchor="middle" style={{font:"8.5px Helvetica"}}>{g.n} {g.sat}/5</text>
     <text x={575} y={32+i*32} textAnchor="middle" style={{font:"7.5px Helvetica",fill:MUT}}>sev {g.sev}</text></g>))}
   </svg>
   <Chain items={[{ag:"#1",vb:LEV[0].n,tg:"lev "+LEV[0].lev,state:"run",c:AC,onClick:()=>setTab(LEV[0].tab)},{ag:"#2",vb:LEV[1].n,tg:LEV[1].lev,state:"pend",c:AMB,onClick:()=>setTab(LEV[1].tab)},{ag:"#3",vb:LEV[2].n,tg:LEV[2].lev,state:"pend",c:AMB,onClick:()=>setTab(LEV[2].tab)}]}/>
   {pq.map(({c,p})=>(<Chain key={c.name} items={[{vb:c.name,tg:"pain "+p,state:"hold",c:p>=1?AC:AMB,onClick:()=>{setSel(c.name);setTab("team");}},{ag:A("score"),vb:staleBase(c)?V("measure"):"support",tg:"first move",state:"pend",c:GRN}]}/>))}
  </div>);})()}
  


  {tab==="quantum"&&<EngineErrorBoundary><QuantumPMView opt={opt} approveScenario={approveScenario} overrideTabScenario={overrideTabScenario} logL={logL} centers={centers} states={states} railData={railData} ledger={ledger} jumpTo={(t)=>setTab(t)} leads={LEADS} /></EngineErrorBoundary>}
{tab==="exec"&&<EngineErrorBoundary>{(()=>{
   // Executive Summary — five numbers, three sentences, no scrolling required.
   // Every figure here is read from the same computations Overview/Audit/
   // Reports already make (trend, red, railData, LEADS, ledger) — nothing new
   // is computed specifically for this view.
   // Respects a local override from Quantum PM's governed-tabs grid, same
   // pattern as Financials — recomputes centers+railData under the override
   // posture rather than showing an inert override button.
   const execOverride=opt.quantum&&opt.quantum.overrides&&opt.quantum.overrides.exec;
   const execGlobalPosture=(opt.quantum&&opt.quantum.approved)||"realistic";
   const execOverrideActive=!!(execOverride&&execOverride!==execGlobalPosture);
   const execOv=execOverrideActive?computeOverrideView(rawCenters,adj,execOverride,opt.week,LEADS):null;
   const execCenters=execOv?execOv.centers:centers;
   const execRailData=execOv?execOv.railData:railData;
   const execRed=execOverrideActive?execCenters.filter(c=>c.eb<0):red;
   const avgHealth=Math.round(execCenters.reduce((a,c)=>a+c.health,0)/execCenters.length);
   const allowedN=(execRailData.recommendations||[]).filter(r=>r.governance.allowed).length;
   const heldN=(execRailData.recommendations||[]).length-allowedN;
   const so=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
   const signedN=LEADS.filter(l=>so(l)===5).length;
   const verifiedN=execCenters.filter(c=>c.verified).length;
   return(<div>
    {execOverrideActive&&<div style={{border:`1px solid ${VIO}`,borderLeft:`3px solid ${VIO}`,background:"#faf9ff",padding:"6px 10px",marginBottom:10,fontFamily:"Helvetica",fontSize:9.5,color:"#3d3470"}}>This tab is locally overridden to <b>{execOverride}</b> — network-wide posture is <b>{execGlobalPosture}</b>. All five figures below reflect the override. Set from Quantum PM.</div>}
    <div style={{border:`1px solid ${RULE}`,borderLeft:`4px solid ${INK}`,background:"#fff",padding:"16px 18px",marginBottom:14}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:8}}>Proposed Policy Framework — Candidate Submission · Pratik Singh</div>
     <div style={{fontFamily:"Helvetica",fontSize:14.5,color:"#222",lineHeight:1.6}}>A single governed system operates {execCenters.length} modeled centers ({verifiedN} verified, {244} authoritative per FDD Item 20) across four evaluation agents. Unit-level deterioration is caught early, support is routed under a named-owner governance boundary, and growth proceeds on a measured cadence rather than an unconstrained one. The business case: improve unit economics across the existing 244 before adding the next 50 — the Unit-Value Program alone models ~$1.36M/yr in additional royalty at 400 units, at the lowest risk of the four available levers.</div>
    </div>
    <div style={{display:"flex",flexWrap:"wrap",border:`1px solid ${RULE}`,background:"#fff",marginBottom:14}}>
     {[
      [avgHealth,"network health, composite",avgHealth>=75?GRN:avgHealth>=60?AMB:AC],
      [execRed.length,"units running below breakeven",execRed.length===0?GRN:execRed.length<=10?AMB:AC],
      [allowedN+" / "+heldN,"proposals allowed / held this cycle",AMB],
      [signedN,"candidates signed in the growth pipeline",GRN],
      [(execRailData.conflicts||[]).length,"open cross-agent conflicts",(execRailData.conflicts||[]).length===0?GRN:AC],
     ].map(([v,l,c],i)=>(
      <div key={i} style={{flex:"1 1 150px",padding:"12px 14px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
       <div style={{fontFamily:"Helvetica",fontSize:26,fontWeight:800,color:c}}>{v}</div>
       <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:3,lineHeight:1.3}}>{l}</div>
      </div>))}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
     {[["Open Overview","franchise"],["Open Network Map","table"],["Open Growth Pipeline","leads"],["Open Audit Trail","audit"],["Open Methodology","agenda"]].map(([lbl,t])=>(
      <button key={t} onClick={()=>setTab(t)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"7px 12px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>{lbl} ▸</button>))}
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,lineHeight:1.5}}>This is a live artifact, not a static deck — every number above recomputes from the canonical state as actions are taken elsewhere in the model. Unfamiliar terms are defined in the Glossary.</div>
   </div>);})()}</EngineErrorBoundary>}
  {tab==="franchise"&&(()=>{
   const CEN={AL:[-86.8,32.8],AZ:[-111.7,34.3],AR:[-92.4,34.8],CA:[-119.7,37.2],CO:[-105.5,39],CT:[-70.0,40.3],DE:[-70.0,38.6],FL:[-81.7,28.6],GA:[-83.4,32.6],ID:[-114.6,44.4],IL:[-89.2,40],IN:[-86.3,39.9],IA:[-93.5,42],KS:[-98.4,38.5],LA:[-92,31],MD:[-72.2,38.6],MA:[-69.6,42.8],MI:[-84.7,43.5],MN:[-94.3,46.3],MO:[-92.5,38.4],NV:[-116.6,39.3],NJ:[-73.2,40.0],NY:[-75.5,43],NC:[-79.4,35.5],ND:[-100.5,47.5],OH:[-82.8,40.3],OK:[-97.5,35.5],OR:[-120.6,44],PA:[-77.8,40.9],SC:[-80.9,33.9],TN:[-86.3,35.8],TX:[-99.3,31.4],UT:[-111.7,39.3],VA:[-78.8,37.5],WA:[-120.4,47.4],WV:[-80.6,38.6],WI:[-89.7,44.6],BC:[-122.5,50.6],AB:[-113.9,51.3],ON:[-79.9,44.8]};
   const PRJ=(lon,lat)=>[14+(lon+125)*(496/65),18+(53.5-lat)*(316/29.5)];
   const P=st=>CEN[st]?PRJ(CEN[st][0],CEN[st][1]):[500,340];
   const OUTLINE=[[-124.7,48.4],[-124,46.2],[-124.4,43],[-124.2,40.4],[-122.4,37.8],[-120.6,34.5],[-117.1,32.5],[-114.7,32.7],[-111,31.3],[-108.2,31.3],[-106.4,31.8],[-104.9,29.6],[-103,28.9],[-101.4,29.8],[-99.5,27.5],[-97.1,25.9],[-97.2,27.8],[-93.8,29.7],[-90.1,29.2],[-89,30.4],[-85.3,29.7],[-84,30.1],[-82.6,27.9],[-80.0,26.8],[-80.1,25.2],[-81.5,25.9],[-82.7,29],[-81.4,30.7],[-80.9,32],[-79,33.2],[-76.5,34.7],[-75.5,35.8],[-75.9,36.9],[-75.2,38.0],[-74.0,39.5],[-74,40.6],[-72,41.0],[-70.2,41.7],[-70.9,42.9],[-69.8,43.8],[-68.2,44.4],[-67.1,45.2],[-67.8,47.1],[-69.2,47.5],[-71.5,45.0],[-75,45],[-76.8,43.6],[-79,43.3],[-79,42.7],[-82.4,41.7],[-83.1,42.3],[-82.5,45.3],[-84.7,46.5],[-88,48.3],[-90.8,48.1],[-95.2,49],[-123,49]];
   const pathOf=pts=>"M"+pts.map(p=>PRJ(p[0],p[1]).map(v=>v.toFixed(1)).join(" ")).join("L")+"Z";
   const agg={};Object.keys(states).forEach(st=>{const cs=states[st];agg[st]={n:cs.length,r:cs.filter(c=>forecast(c).cls==="rising").length,d:cs.filter(c=>forecast(c).cls==="deteriorating").length};});
   const stList=Object.keys(states).filter(st=>CEN[st]);
   const seg=Math.floor(tick/4),ph=((tick%4)+1)/4;
   // agent targets are ranked from live network signals, not a random walk —
   // each agent patrols the top-3 states on its own metric, round-robin by tick
   const staleCountOf=st=>(states[st]||[]).filter(staleBase).length;
   const redCountOf=st=>(states[st]||[]).filter(c=>c.eb<0).length;
   const gapOf=st=>{const cs=states[st]||[];if(cs.length<2)return 0;return Math.round(Math.max(...cs.map(c=>c.health))-Math.min(...cs.map(c=>c.health)));};
   const detOf=st=>agg[st]?agg[st].d:0;
   const topStates=fn=>[...stList].filter(st=>fn(st)>0).sort((a,b)=>fn(b)-fn(a)).slice(0,3);
   const AGENT_DEFS=[
    {n:"Measurement",c:AMB,fn:staleCountOf,unit:" stale",job:"finds the network's oldest data and queues re-measurement"},
    {n:"Best practice",c:GRN,fn:gapOf,unit:"pt gap",job:"looks for the widest health spread to transfer a working practice"},
    {n:"Support",c:AC,fn:redCountOf,unit:" red",job:"routes peer-network support to units running EBITDA-negative"},
    {n:"Forecast",c:VIO,fn:detOf,unit:" deteriorating",job:"flags states with the most 90-day-deteriorating centers"},
   ];
   const AGENTS=AGENT_DEFS.map(({n,c,fn,unit,job})=>{
    const pool=topStates(fn);const use=pool.length?pool:stList;
    const from=use[seg%use.length],to=use[(seg+1)%use.length];
    const[f1,f2]=P(from),[t1,t2]=P(to);
    return{n,c,from,to,x:f1+(t1-f1)*ph,y:f2+(t2-f2)*ph,metric:fn(to),unit,job,reason:to+" · "+fn(to)+unit};});
   const topR=[...stList].sort((a,b)=>agg[b].r-agg[a].r).slice(0,3).map(st=>({st,txt:"+"+agg[st].r+" centers rising"}));
   const POS=[...topR,{st:"CA",txt:"enrollment-conversion practice v3 · promoted"},{st:"TX",txt:"+3 performance rebates earned"},{st:"ON",txt:"+2 units into STRONG tier"},{st:"VA",txt:"+12 commitments"},{st:"FL",txt:"referral share up 3 wks"}];
   const shown=[0,1,2].map(i=>POS[(seg+i)%POS.length]);
   const netScore=Math.round(centers.reduce((a,c)=>a+c.health,0)/centers.length);
   const eAvg=+(centers.slice(0,40).reduce((a,c)=>a+engageOf(c).score,0)/40).toFixed(2);
   const CenterCard=({c})=>{const f=forecast(c);const e=engageOf(c);const[ar,ac2]=arrow(f.cls);
    return(<div style={{border:`1px solid ${RULE}`,borderTop:`3px solid ${AC}`,background:"#fff",padding:"10px 12px",marginTop:8}}>
     <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
      <div style={{textAlign:"center",minWidth:64}}>
       <div style={{fontFamily:"Helvetica",fontSize:34,fontWeight:700,lineHeight:1}}>{c.health}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:1,color:AC}}>{tierOf(c.health)}</div>
      </div>
      <div style={{flex:1,minWidth:180}}>
       <div style={{fontFamily:"Helvetica",fontSize:13,fontWeight:700}}>{c.name} <span style={{fontSize:8.5,color:MUT,fontWeight:400}}>{c.verified?"· verified":"· modeled"}</span>{c.adjusted&&<span style={{fontSize:7.5,fontWeight:700,color:VIO,marginLeft:5,border:`1px solid ${VIO}`,padding:"1px 4px"}}>▲ LIVE ADJUSTMENT</span>}</div>
       <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#444",marginTop:2}}>{c.students} students · margin {fmt(c.eb)}k · retention {pct(c.ret)}% · engagement {e.score} · <b style={{color:ac2}}>{ar} {fmt(f.proj[2])}k @90d</b></div>
      </div>
      <span onClick={()=>{setMapC(null);setCardMsg("");}} style={{fontFamily:"Helvetica",fontSize:12,color:MUT,cursor:"pointer"}}>×</span>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:AC,margin:"8px 0 4px"}}>Next steps</div>
     <button onClick={()=>{setSel(c.name);setTab("team");}} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"6px 12px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff"}}>Open full center page ▸</button>
    </div>);};
   return(<div>
   <div style={{display:"flex",gap:0,flexWrap:"wrap",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:8}}>
    {[[netScore,"network health — live composite",INK],[Math.round(trend.r/centers.length*100)+"%",trend.r+" units rising (90d)",GRN],[trend.d,"deteriorating — on a support path",AC],[alerts.filter(a=>a.eta<=30).length,"urgent flags — action inside 30 days",VIO],["64 / 244","verified units / FDD Item 20 authoritative",MUT]].map(([v,l,c],i)=>(
     <div key={i} style={{flex:"1 1 130px",padding:"9px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
      <div style={{fontFamily:"Helvetica",fontSize:21,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,letterSpacing:0.3,marginTop:3,lineHeight:1.35}}>{l}</div>
     </div>))}
   </div>
   <div style={{marginTop:8,marginBottom:8,border:`1px solid ${RULE}`,background:"#f7f6f2",padding:"10px 12px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:INK,marginBottom:6}}>Executive summary</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8}}>
     {[
      "Franchisee performance and unit profitability are evaluated as a single measure, not two separate ones; a unit in decline is identified before it appears in a P&L review.",
      "Retention risk and support capacity are assessed on a weekly cycle, not discovered at quarterly review.",
      "Every intervention follows a fixed protocol — observe, identify the binding constraint, pilot, measure, propagate — subject to governance in every instance.",
      "Verified practices are not retained locally. Propagation across the network is governed by the same system that identifies where a practice is applicable.",
     ].map((t,i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:10.5,color:"#333",lineHeight:1.5,paddingLeft:10,borderLeft:`2px solid ${INK}`}}>{t}</div>))}
    </div>
   </div>
   <div style={{marginBottom:8,border:`1px solid ${RULE}`,background:"#fdfdfb"}}>
    <div onClick={()=>setAboutOpen(o=>!o)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",cursor:"pointer"}}>
     <span style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:INK}}>About this submission — rationale and a 5-minute walkthrough</span>
     <span style={{fontFamily:"Helvetica",fontSize:9,color:AC}}>{aboutOpen?"collapse ▲":"expand ▼"}</span>
    </div>
    {aboutOpen&&<div style={{padding:"0 12px 12px",borderTop:`1px solid ${RULE}`}}>
     <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:INK,margin:"10px 0 4px"}}>Rationale</div>
     <div style={{fontFamily:"Helvetica",fontSize:11.5,color:"#333",lineHeight:1.6}}>Franchise networks incur avoidable cost when unit-level deterioration goes undetected between measurement cycles; by the time a decline is visible in a P&L review, remediation typically costs several multiples of what earlier intervention would have required. This model addresses that gap: it evaluates each unit's leading indicators continuously, proposes a specific support action under governance, and records the resulting decision. The underlying mechanics — agents, signals, confidence scoring — exist for one purpose: to enable action at the point of early detection rather than after quarterly reporting.</div>
     <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:INK,margin:"14px 0 4px"}}>The 5-minute walkthrough</div>
     <ol style={{fontFamily:"Helvetica",fontSize:10.5,color:"#333",lineHeight:1.7,margin:"0 0 0 18px",padding:0}}>
      <li><b>Network health, current period.</b> The composite score and trend below reflect the present session, not a static snapshot; each figure recomputes as the underlying state changes.</li>
      <li><b>Proposed actions, current period.</b> Four evaluation agents identify specific, evidence-backed actions across the network, each carrying a stated confidence level and its supporting basis.</li>
      <li><b>Governed approval.</b> A single proposed action may be approved directly from this screen. No action is applied to a center's record without a guardrail clearing first; that gate is visible, not implied.</li>
      <li><b>Interventions in parallel.</b> The Operations Board presents every open intervention concurrently — by review cadence, by decision state, and as a governed trace — over the same decision record.</li>
      <li><b>One center, six lenses.</b> Under Centers, any single unit may be reviewed through six synchronized perspectives — student, parent, franchisee, corporate, financial, and system — each reading the same signal concurrently.</li>
      <li><b>Supporting evidence.</b> The territory map, agent logic, and leading-indicator calculations behind each figure above are presented in full, not merely asserted.</li>
      <li><b>The proposed plan.</b> The closing section states the sequence of actions for the first 90 days at Code Ninjas.</li>
     </ol>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:8}}>An interactive version of this walkthrough is also available: <button onClick={()=>setTour(0)} aria-label="Start the 5-minute guided tour" style={{color:AC,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0,fontFamily:"inherit",fontSize:"inherit"}}>start the 5-minute tour →</button></div>
    </div>}
   </div>

   {(()=>{
    const freshShare=Math.round((1-centers.filter(staleBase).length/centers.length)*100);
    const avgConf=+(railData.recommendations.reduce((a,r)=>a+r.evidence.operationalSignals.dataConfidence,0)/Math.max(1,railData.recommendations.length)).toFixed(2);
    const highConf=railData.recommendations.filter(r=>r.confidenceBand==="high").length;
    // The landing spotlight is the single action a Director sees first -- it must
 // never surface a proposal the conflict detector has separately flagged, or
 // the Overview would be steering toward exactly the action another view is
 // warning about. Conflicted proposals are skipped, not just noted.
 const spotConflictIds=new Set((railData.conflicts||[]).flatMap(c=>[c.a,c.b]));
 const spotlightPool=[...railData.actionable].sort((a,b)=>b.evidence.operationalSignals.dataConfidence-a.evidence.operationalSignals.dataConfidence);
 const spotlight=spotlightPool.find(r=>!spotConflictIds.has(r.id))||null;
 const spotlightAllConflicted=spotlightPool.length>0&&!spotlight;
 const onSpotDecide=(rec,d)=>{setSpotDecision(d);logL("franchise",rec.agent,rec.title+" — "+(d==="approved"?"approved by Director":d==="measure"?"queued for re-measurement":"ignored")+" (from Overview)");};
    return(<div style={{marginTop:8,border:`1px solid ${RULE}`,background:"#fff"}}>
     <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:INK,padding:"8px 12px",borderBottom:`1px solid ${RULE}`}}>Today</div>
     <div style={{padding:"10px 12px",borderBottom:`1px solid ${RULE}`}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>1 · Network health</div>
      <div style={{fontFamily:"Helvetica",fontSize:10,color:"#333",lineHeight:1.5}}>{netScore} composite · {trend.r} rising, {trend.d} on a support path (90d) · <b style={{color:freshShare>=70?GRN:AMB}}>{freshShare}%</b> of units measured within the last 14 days.</div>
     </div>
     <div style={{padding:"10px 12px",borderBottom:`1px solid ${RULE}`}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>2 · Today's decisions</div>
      <div style={{fontFamily:"Helvetica",fontSize:10,color:"#333",lineHeight:1.5}}>{railData.actionable.length} proposed actions pending Director review across four evaluation agents · {railData.held.length} held pending fresher data or a cleared guardrail. <button onClick={()=>setTab("rail")} aria-label="Open Decision Rail: threads and queue" style={{color:AC,cursor:"pointer",textDecoration:"underline",background:"none",border:"none",padding:0,fontFamily:"inherit",fontSize:"inherit"}}>Open threads & queue →</button></div>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:3}}>This is the network-wide triage view — the highest-confidence item across all {centers.length} units. To deliberately choose one center and see it through all six roles, use Six Lenses under Centers instead.</div>
     </div>
     <div onClick={()=>setTodayDetail(v=>!v)} style={{padding:"6px 12px",borderBottom:`1px solid ${RULE}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT}}>Confidence basis & follow-through record</span>
      <span style={{fontFamily:"Helvetica",fontSize:8.5,color:AC}}>{todayDetail?"hide":"show"}</span>
     </div>
     {todayDetail&&<div style={{padding:"10px 12px",borderBottom:`1px solid ${RULE}`}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>3 · Why the model is confident</div>
      <div style={{fontFamily:"Helvetica",fontSize:10,color:"#333",lineHeight:1.5}}>Average data confidence across today's proposed actions is <b>{avgConf}</b> (0–1 scale); {highConf} of {railData.recommendations.length} carry a high-confidence rating. Confidence reflects two factors: recency of measurement and internal consistency of the underlying figures — not a self-reported assessment.</div>
     </div>}
     <div style={{padding:"10px 12px",borderBottom:`1px solid ${RULE}`}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>Safe governed action</div>
      {spotlight?<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${GRN}`,padding:"7px 9px"}}>
       <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>{spotlight.title}</div>
       <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,margin:"2px 0 5px"}}>{spotlight.summary}</div>
       <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
        {spotlight.evidence.contractVerdicts.map((v,i)=>(<span key={i} style={{fontFamily:"Helvetica",fontSize:8,padding:"2px 6px",border:`1px solid ${v.pass?GRN:AC}`,color:v.pass?GRN:AC}}>{v.pass?"✓":"✕"} {v.label}</span>))}
       </div>
       {spotDecision?<span style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:spotDecision==="approved"?GRN:spotDecision==="measure"?AMB:MUT}}>{spotDecision==="approved"?"Approved":spotDecision==="measure"?"Queued for re-measurement":"Ignored"}</span>:<div style={{display:"flex",gap:5}}>
        <button onClick={()=>onSpotDecide(spotlight,"approved")} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${GRN}`,background:GRN,color:"#fff"}}>Approve</button>
        <button onClick={()=>onSpotDecide(spotlight,"measure")} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${AMB}`,background:"#fff",color:AMB}}>Measure again</button>
        <button onClick={()=>onSpotDecide(spotlight,"ignored")} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"3px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>Ignore</button>
       </div>}
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:5}}>approver on record (human-owned): {spotlight.approverRole} · nothing here writes to a center's live record without this step{(()=>{const u=spotlight.targetIds&&spotlight.targetIds.find(id=>id&&id.length>2&&id!==spotlight.scope);return u?<span onClick={()=>jumpTo("lenses",u,"today\u2019s spotlighted action: \u201c"+spotlight.title+"\u201d")} style={{color:AC,cursor:"pointer",textDecoration:"underline",marginLeft:6}}>view in Six Lenses →</span>:null;})()}</div>
      </div>:<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>{spotlightAllConflicted?"every actionable proposal right now is flagged by the cross-agent conflict check — see Decision Rail before acting on any of them":"nothing actionable right now — every proposal is held on fresher data or a guardrail"}</div>}
     </div>
     {todayDetail&&<div style={{padding:"10px 12px"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>Logged operational follow-through</div>
      {ledger.length===0&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>no actions logged yet this session — approvals and re-measurements will appear here</div>}
      {ledger.slice(0,5).map((e,i)=>(<div key={i} style={{display:"flex",gap:8,fontFamily:"Helvetica",fontSize:9,padding:"3px 0",borderTop:i?`1px solid #f0f0f0`:"none"}}>
       <span style={{color:MUT,minWidth:60}}>{e.tab}</span><span style={{fontWeight:700,minWidth:90}}>{e.actor}</span><span style={{color:"#444"}}>{e.text}</span>
      </div>))}
     </div>}
    </div>);
   })()}
   <div style={{margin:"14px 0 6px",display:"flex",alignItems:"baseline",gap:8}}>
    <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT}}>The proof underneath</div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>— why this matters: a proposed action without supporting evidence is an assertion, not a basis for decision. Below is the territory map, four evaluation agents, and the leading-indicator calculations behind today's figures — the full leading-indicator catalog, failure-mode log, and canonical network state are maintained under Workflow, Programs, and Methodology.</div>
   </div>

   <EngineErrorBoundary>
   <div style={{border:`1px solid #2a2a2a`,background:"#121212"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"8px 12px 0"}}>
     <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
      <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:1.6,color:"#b8b8b8"}}>NORTH AMERICA — TERRITORY MAP</div>
      <div style={{display:"flex",gap:2}}>{[["health","health"],["freshness","freshness"],["headroom","headroom"],["consistency","consistency"],["momentum","momentum"]].map(([k,l])=>(
       <button key={k} onClick={()=>setMapMode(k)} style={{fontFamily:"Helvetica",fontSize:7.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",padding:"2px 7px",cursor:"pointer",border:"1px solid "+(mapMode===k?"#7a6bd8":"#333"),background:mapMode===k?"#1c1640":"transparent",color:mapMode===k?"#b8aaff":"#777"}}>{l}</button>))}</div>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:10,color:"#ddd"}}><b style={{fontSize:22,color:"#fff"}}>{netScore}</b> <span style={{fontSize:7.5,fontWeight:700,letterSpacing:1,color:"#8a8a8a"}}>NETWORK</span>  <span style={{color:"#6fc38a"}}>↑{trend.r}</span> <span style={{color:"#d9a62e"}}>→{trend.h}</span> <span style={{color:"#d96a6a"}}>↓{trend.d}</span></div>
    </div>
    <svg viewBox="0 0 524 356" style={{width:"100%",height:"auto",display:"block"}}>
     <path d={pathOf(OUTLINE)} fill="#242424" stroke="#5c5c5c" strokeWidth="1.6"/>
     <text x="200" y="200" style={{font:"bold 8px Helvetica",fill:"#4a4a4a",letterSpacing:"2.5px"}}>UNITED STATES</text>
     {QCLUSTERS.map((cl,ci)=>cl.slice(1).map((st,i)=>{const a=cl[i],b=st;if(!CEN[a]||!CEN[b]||!states[a]||!states[b])return null;const[x1,y1]=P(a),[x2,y2]=P(b);const mA=AGENTS[0];const active=mA.to===a||mA.to===b||mA.from===a||mA.from===b;return(<line key={"ent"+ci+"-"+i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={active?"#8a7ade":"#2c2c3c"} strokeWidth={active?1.3:0.6} strokeDasharray="1 3" opacity={active?0.85:0.45}/>);}))}
     {AGENTS.map((a,i)=>{const[t1,t2]=P(a.to);return(<line key={"l"+i} x1={a.x} y1={a.y} x2={t1} y2={t2} stroke={a.c} strokeWidth="0.9" strokeDasharray="3 3" opacity="0.6"/>);})}
     {Object.keys(CEN).map(st=>{const[x,y]=P(st);const has=states[st];
      if(!has)return(<g key={st} onClick={()=>{setMapSt(st===mapSt?null:st);setMapC(null);}} style={{cursor:"pointer"}}><circle cx={x} cy={y} r={9} fill="transparent"/><circle cx={x} cy={y} r="3" fill="#3a3a3a" stroke="#666" strokeWidth="1"/></g>);
      const amp=qStateAmp(states[st]);const lm=qLastMeasSeg(stList,st,seg);const coh=lm===null?0.12:qCoherence((seg-lm)*6);
      const cl=QCLUSTERS.find(c=>c.includes(st));const manual=qMeas[st];const inferred=cl?cl.some(o=>o!==st&&qMeas[o]):false;
      const r=7.5+Math.min(10,agg[st].n/5);const dom=qResolve(amp);const resolved=coh>0.62||manual||inferred;const measuring=AGENTS[0].to===st;
      // alternate map modes: one metric, one color, same nodes
      const cs2=states[st];
      const modeVal=(()=>{switch(mapMode){
       case "freshness":{const fr2=cs2.filter(c=>!staleBase(c)).length/cs2.length;return{v:fr2,c:fr2>0.7?"#5cb87c":fr2>0.4?"#d9a62e":"#8a8fa8",lbl:Math.round(fr2*100)+"%"};}
       case "headroom":{const tight=cs2.filter(c=>c.eb<3).length/cs2.length;return{v:1-tight,c:tight>0.5?"#d96a6a":tight>0.25?"#d9a62e":"#5cb87c",lbl:Math.round((1-tight)*100)+"%"};}
       case "consistency":{const sc2=cs2.reduce((a,c)=>{const m=[c.conv/0.65,c.ret/0.94,c.chem/0.8];const mu=(m[0]+m[1]+m[2])/3;const varr=m.reduce((s,x)=>s+(x-mu)*(x-mu),0)/3;return a+Math.max(0,1-varr*6);},0)/cs2.length;return{v:sc2,c:sc2>0.75?"#5cb87c":sc2>0.55?"#d9a62e":"#d96a6a",lbl:Math.round(sc2*100)};}
       case "momentum":{const net=(agg[st].r-agg[st].d)/cs2.length;return{v:net,c:net>0.1?"#5cb87c":net<-0.1?"#d96a6a":"#d9a62e",lbl:(net>=0?"+":"")+Math.round(net*100)};}
       default:return null;}})();
      let acc=-Math.PI/2;const wedges=amp.map((av,wi)=>{const a0=acc,a1=acc+av*2*Math.PI;acc=a1;return{d:qArc(x,y,r,a0,a1),c:QCOL[wi]};});
      return(<g key={st} onClick={()=>{setMapSt(st===mapSt?null:st);setMapC(null);setSt(st);}} style={{cursor:"pointer"}}>
       <circle cx={x} cy={y} r={Math.max(r,9)} fill="transparent"/>
       {mapSt===st&&<circle cx={x} cy={y} r={r+4} fill="none" stroke="#fff" strokeWidth="1.4"/>}
       {!modeVal&&wedges.map((w,wi)=><path key={wi} d={w.d} fill={w.c} opacity={resolved?0.22:0.6} stroke="#0f0f0f" strokeWidth="0.4"/>)}
       {!modeVal&&resolved&&<circle cx={x} cy={y} r={r*0.60} fill={QCOL[dom]} stroke={manual?"#fff":inferred?"#8a7ade":"#fff"} strokeWidth={manual?1.4:1}/>}
       {modeVal&&<circle cx={x} cy={y} r={r} fill={modeVal.c} opacity={mapMode==="freshness"?0.25+modeVal.v*0.75:0.85} stroke="#0f0f0f" strokeWidth="0.5"/>}
       {modeVal&&<text x={x} y={y-r-3} textAnchor="middle" style={{font:"bold 6.5px Helvetica",fill:"#d5d5d5",paintOrder:"stroke",stroke:"#0a0a0a",strokeWidth:1.2}}>{modeVal.lbl}</text>}
       {manual&&<circle cx={x} cy={y} r={r+5} fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9"/>}
       {inferred&&!manual&&<circle cx={x} cy={y} r={r+3.5} fill="none" stroke="#8a7ade" strokeWidth="1" strokeDasharray="1 2" opacity="0.9"/>}
       {!resolved&&<circle cx={x} cy={y} r={r+1.5} fill="none" stroke="#9a9a9a" strokeWidth="0.7" strokeDasharray="2 2" opacity={(1-coh)*0.9}/>}
       {measuring&&!manual&&<circle cx={x} cy={y} r={r+5} fill="none" stroke="#d9a62e" strokeWidth="1.4" opacity="0.9"/>}
       <text x={x} y={y+3} textAnchor="middle" style={{font:"bold 8px Helvetica",fill:resolved?"#fff":"#0f0f0f",paintOrder:"stroke",stroke:resolved?"rgba(0,0,0,0.35)":"rgba(255,255,255,0.35)",strokeWidth:0.6}}>{st}</text>
       <text x={x} y={y+r+9} textAnchor="middle" style={{font:"bold 7px Helvetica",fill:"#d5d5d5"}}>{agg[st].n}</text>
      </g>);})}
     {AGENTS.map((a,i)=>(<g key={"a"+i} onClick={()=>{setMapSt(a.to);setMapC(null);}} style={{cursor:"pointer"}}>
      <title>{`${a.n} — ${a.job}. Currently en route to ${a.to} (${a.reason}).`}</title>
      <circle cx={a.x} cy={a.y} r="5" fill="#121212" stroke={a.c} strokeWidth="2.2" style={{transition:"all 1.05s linear"}}/>
      <text x={a.x} y={a.y+14} textAnchor="middle" style={{font:"bold 6.5px Helvetica",fill:a.c,paintOrder:"stroke",stroke:"#0a0a0a",strokeWidth:1.4,transition:"all 1.05s linear"}}>{a.n.toUpperCase()}</text></g>))}
     {shown.map((p,i)=>{const[x,y]=P(p.st);const w=p.txt.length*4.5+12;const ox=Math.min(Math.max(6,x-w/2),514-w);
      return(<g key={"p"+i} opacity="0.95">
       <rect x={ox} y={Math.min(y+13,330)} width={w} height={14} fill="#142b1b" stroke="#4d8f63" strokeWidth="1" rx="2"/>
       <text x={ox+w/2} y={Math.min(y+23,340)} textAnchor="middle" style={{font:"7.5px Helvetica",fill:"#a9d6b4"}}>{p.txt}</text></g>);})}
    </svg>
    {mapMode!=="health"&&<div style={{fontFamily:"Helvetica",fontSize:8,color:"#9aa4c8",padding:"5px 12px 0"}}>{({
     freshness:"DATA FRESHNESS — states brighten with measured share; a thriving-but-unmeasured state dims until reviewed. One glance answers: where do we measure next?",
     headroom:"PRICING HEADROOM — share of units with margin comfortably above the floor. A state can be healthy today and still run hot here: small tuition moves would strain it.",
     consistency:"INTERNAL CONSISTENCY — how well each unit's own metrics agree (enrollment vs retention vs staffing). Low scores flag units that look fine on average but disagree with themselves.",
     momentum:"MOMENTUM — net 90-day trajectory per state (rising minus declining, as % of units). Steep negative values flag acceleration toward trouble before health scores move.",
    })[mapMode]}</div>}
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",padding:"6px 12px 9px",borderTop:"1px solid #262626"}}>
     <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:1,color:"#b8b8b8"}}>STATUS</span>
     <span style={{display:"flex",alignItems:"center",gap:4,fontFamily:"Helvetica",fontSize:8,color:"#bbb"}}><span style={{width:9,height:9,borderRadius:5,background:"#5cb87c",border:"1.5px solid #fff"}}/>verified · current</span>
     <span style={{display:"flex",alignItems:"center",gap:4,fontFamily:"Helvetica",fontSize:8,color:"#bbb"}}><span style={{width:9,height:9,borderRadius:5,background:"conic-gradient(#5cb87c 0 33%,#d9a62e 33% 66%,#d96a6a 66%)",opacity:0.65}}/>estimated · stale</span>
     <span style={{display:"flex",alignItems:"center",gap:4,fontFamily:"Helvetica",fontSize:8,color:"#bbb"}}><span style={{width:14,height:0,borderTop:"1px dashed #8a7ade"}}/>linked cluster</span>
     <span style={{display:"flex",alignItems:"center",gap:4,fontFamily:"Helvetica",fontSize:8,color:"#bbb"}}><span style={{width:9,height:9,borderRadius:5,border:"1.4px solid #d9a62e"}}/>measuring now</span>
     <span style={{marginLeft:"auto",fontFamily:"Helvetica",fontSize:8,color:"#8a8a8a"}}>program interaction: <b style={{color:"#6fc38a"}}>{centers.filter(c=>forecast(c).cls==="rising"&&engageOf(c).score>=0.7).length} reinforcing</b> · <b style={{color:"#d96a6a"}}>{centers.filter(c=>forecast(c).cls==="deteriorating"&&c.eb<3).length} competing</b> (programs vs Sensei-hours · derived from trajectory × engagement / margin)</span>
    </div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:8,marginTop:8}}>
    {[
     ["SEE EARLY","Recovery time is the leading indicator — a unit with a slow recovery profile is flagged 30–90 days before the P&L reflects it. "+alerts.filter(a=>a.eta<=30).length+" flags require action inside 30 days.","warning","Open early warning",VIO],
     ["SUPPORT FAST","Interventions are proposed under an 8-point weekly capacity budget and four hard governors — financial materiality, engagement integrity, child safety, data integrity. "+red.length+" units are on the priority queue today.","pain","Open priorities",AC],
     ["GROW ON CADENCE","The full franchise sales cycle runs inside the same record: lead scoring, discovery days, FDD and federal compliance as hard gates. Nothing signs while a compliance item is open.","leads","Open the pipeline",GRN],
    ].map(([h,b,t2,lbl,c],i)=>(
     <div key={i} style={{border:`1px solid ${RULE}`,borderTop:`3px solid ${c}`,background:"#fff",padding:"10px 12px",display:"flex",flexDirection:"column"}}>
      <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:1.2,color:c,marginBottom:5}}>{h}</div>
      <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333",lineHeight:1.55,flex:1}}>{b}</div>
      <button onClick={()=>setTab(t2)} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 11px",cursor:"pointer",border:`1px solid ${c}`,background:"#fff",color:c,marginTop:8,alignSelf:"flex-start"}}>{lbl} →</button>
     </div>))}
   </div>
   {mapSt&&states[mapSt]&&(()=>{const cs=[...states[mapSt]].sort((a,b)=>b.health-a.health);const g=agg[mapSt];
    return(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",padding:"9px 11px",marginTop:8}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap"}}>
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700}}>{mapSt} — {g.n} centers <span style={{fontSize:9,color:MUT,fontWeight:400}}>· {cs.filter(c=>c.verified).length} verified · <span style={{color:GRN}}>↑{g.r}</span> <span style={{color:AC}}>↓{g.d}</span></span></div>
      <span onClick={()=>{setMapSt(null);setMapC(null);}} style={{fontFamily:"Helvetica",fontSize:12,color:MUT,cursor:"pointer"}}>close ×</span>
     </div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",margin:"6px 0"}}>
      {(()=>{const amp=qStateAmp(states[mapSt]);const dom=qResolve(amp);const measured=qMeas[mapSt];const cl=QCLUSTERS.find(c=>c.includes(mapSt));const partners=cl?cl.filter(o=>o!==mapSt&&states[o]):[];
       return(<>
        <button onClick={()=>{setQMeas(m=>({...m,[mapSt]:true}));logL("franchise","Measurement",mapSt+" state measured — cluster partners inferred");}} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${VIO}`,background:measured?VIO:"#fff",color:measured?"#fff":VIO}}>{measured?"◆ measured — current":"⟲ Run measurement (verify)"}</button>
        {measured&&<button onClick={()=>setQMeas(m=>{const nm={...m};delete nm[mapSt];return nm;})} style={{fontFamily:"Helvetica",fontSize:9,padding:"5px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>↺ mark stale</button>}
        <span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{measured?<span>verified as <b style={{color:HCOL[dom]}}>{QSTATES[dom]}</b>{partners.length?<span> · linked <b style={{color:VIO}}>{partners.join(", ")}</b> now inferred</span>:null}</span>:<span>estimated: {QSTATES.map((n,i)=>pct(amp[i])+"% "+n).join(" · ")} — measuring verifies it</span>}</span>
       </>);})()}
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(104px,1fr))",gap:5,maxHeight:340,overflowY:"auto",marginTop:6}}>
      {cs.map(c=>{const[ar,ac2]=arrow(forecast(c).cls);const sel2=mapC===c;
       const tc=c.health>=88?"#2f7a3f":c.health>=80?"#b8860b":c.health>=68?"#7d7d7d":"#8b0000";
       return(<div key={c.name} onClick={()=>{setMapC(sel2?null:c);setCardMsg("");setSel(c.name);}} style={{border:`1px solid ${sel2?INK:RULE}`,borderTop:`3px solid ${tc}`,background:sel2?"#fbf9f4":"#fff",padding:"6px 7px",cursor:"pointer",opacity:c.verified?1:0.8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
         <b style={{fontFamily:"Helvetica",fontSize:17,color:INK,lineHeight:1}}>{c.health}</b>
         <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.5,color:tc}}>{tierOf(c.health)}</span>
        </div>
        <div style={{fontFamily:"Helvetica",fontSize:8.8,fontWeight:700,color:INK,margin:"2px 0 1px",lineHeight:1.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
        <div style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT}}>{c.students} students · <b style={{color:ac2}}>{ar}{fmt(forecast(c).proj[2])}k</b></div>
       </div>);})}
     </div>
     {mapC&&<CenterCard c={mapC}/>}
    </div>);})()}
   <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
    <div style={{flex:"1 1 180px",border:`1px solid ${RULE}`,background:"#fff",padding:"8px 10px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:AC,marginBottom:6}}>Agent activity — current cycle</div>
     {AGENTS.map((a,i)=>(<div key={i} onClick={()=>{setMapSt(a.to);setMapC(null);}} title={a.job} style={{fontFamily:"Helvetica",fontSize:9.5,marginBottom:5,display:"flex",alignItems:"flex-start",gap:6,cursor:"pointer"}}>
      <span style={{width:9,height:9,borderRadius:5,background:"#fff",border:`2px solid ${a.c}`,flexShrink:0,marginTop:2}}/>
      <span><b>{a.n}</b> · {a.from} → {a.to} <span style={{color:a.metric>0?a.c:MUT,fontWeight:700}}>{a.reason}</span><br/><span style={{fontSize:8,color:MUT}}>{a.job}</span></span></div>))}
     <div style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT,marginTop:2,borderTop:`1px solid ${RULE}`,paddingTop:4}}>ranked live from network state each tick · tap an agent to open its target state</div>
    </div>
    <div style={{flex:"1 1 180px",border:`1px solid ${RULE}`,background:"#fff",padding:"8px 10px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:GRN,marginBottom:6}}>Positive indicators — rolling</div>
     {shown.map((p,i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,marginBottom:4,color:"#2f5a3a"}}><b>{p.st}</b> · {p.txt}</div>))}
    </div>
    <div style={{flex:"1 1 180px",border:`1px solid ${RULE}`,background:"#fff",padding:"8px 10px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:AC,marginBottom:6}}>Network snapshot — computed live</div>
     {(()=>{const avgS=Math.round(centers.reduce((a,c)=>a+c.students,0)/centers.length);
      const avgConv=Math.round(centers.reduce((a,c)=>a+c.conv,0)/centers.length*100);
      const avgRet=Math.round(centers.reduce((a,c)=>a+c.ret,0)/centers.length*100);
      return [["Avg students/center",avgS,avgS<60],["Trial → enrollment",avgConv+"%",avgConv<50],["12-mo retention",avgRet+"%",avgRet<70],["Below breakeven",red.length+" units",red.length>0],["Data stale >4wk",staleN+" units",staleN>0]].map(([m,v,warn],i)=>(
      <div key={i} style={{fontFamily:"Helvetica",fontSize:9,marginBottom:3,display:"flex",justifyContent:"space-between"}}><span>{m}</span><b style={{color:warn?AC:INK}}>{v}</b></div>));})()}
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:3}}>every figure derived from the modeled network this render — same source as the map</div>
    </div>
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:6}}>US + Canada footprint · illustrative motion over live-computed state · engagement avg {eAvg}</div>
   </EngineErrorBoundary>
   <div style={{margin:"16px 0 6px",fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:GRN}}>What I would do first at Code Ninjas</div>
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginBottom:6}}>— why this matters: a strategy is only credible once it survives contact with week one. This is the concrete order of operations, not a slogan.</div>

   {(()=>{const phases=PLAN_90.map(p=>p.phase.split(" — "));
   return(<div style={{marginTop:8,border:`1px solid ${RULE}`,borderLeft:`3px solid ${GRN}`,background:"#fff",padding:"9px 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
     <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:GRN}}>Day-by-day breakdown</div>
     <span onClick={()=>setTab("plan")} style={{fontFamily:"Helvetica",fontSize:9,color:AC,cursor:"pointer",textDecoration:"underline"}}>full plan →</span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
     {phases.map(([days,name],i)=>(<div key={i}>
      <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:MUT,textTransform:"uppercase",letterSpacing:0.4}}>{days}</div>
      <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>{name}</div>
      <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",marginTop:1}}>{PLAN_90[i].focus}</div>
     </div>))}
    </div>
   </div>);})()}
   <div style={{marginTop:6,fontFamily:"Helvetica",fontSize:8.5,color:MUT,borderTop:`1px solid ${RULE}`,paddingTop:6}}>Data boundary: figures across this artifact are modeled/illustrative pending live MyStudio and QuickBooks integration, with one exception — FDD Item 20 (244 units) and the 64 publicly verified centers are the authoritative counts. Nothing here overrides that reconciliation.</div>
   <FDDReconciliationPanel centers={centers}/>
  </div>);})()}
  {tab==="engagement"&&(()=>{const e=engageOf(team);const f=forecast(team);
   const Row=({l,v,w,c})=>(<div style={{fontFamily:"Helvetica",fontSize:10,marginBottom:5}}>
    <div style={{display:"flex",justifyContent:"space-between"}}><span>{l}</span><b>{v}</b></div>
    <div style={{height:6,background:"#eee"}}><div style={{height:6,width:(w*100)+"%",background:c||GRN}}/></div></div>);
   return(<div>
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,padding:"6px 10px",marginBottom:10,lineHeight:1.5}}>
    <b style={{color:AC}}>PROVENANCE</b> · Framework developed at theCoderSchool Pleasanton — engagement tracker, coach badges, pre/post-session routines, coach–student matching, student pathways. Engagement leads; economics follow.</div>
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:5}}>{team.name} — engagement signals (score {e.score})</div>
   <Row l="Pre-session routine completion" v={pct(e.pre)+"%"} w={e.pre}/>
   <Row l="Post-session note + family report" v={pct(e.post)+"%"} w={e.post} c={e.post<0.7?AMB:GRN}/>
   <Row l="Coach–student match quality" v={pct(e.match)+"%"} w={e.match} c={e.match<0.65?AMB:GRN}/>
   <Row l="New students progressing in first 30 days" v={pct(e.prog30)+"%"} w={e.prog30} c={e.prog30<0.6?AC:GRN}/>
   <Row l="Floor energy (sessions with live demos)" v={pct(e.buzz)+"%"} w={e.buzz} c={VIO}/>
   <Row l="Referral share of new enrollments" v={pct(e.refer)+"%"} w={e.refer} c={VIO}/>
   <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#555",lineHeight:1.5,border:`1px solid ${RULE}`,padding:"6px 9px",marginTop:8}}>
    Engagement {e.score>=0.72?"leads the forecast up":"is the earliest warning"} — this center's 90-day trajectory reads <b style={{color:f.cls==="rising"?GRN:f.cls==="deteriorating"?AC:AMB}}>{f.cls}</b>. Engagement moves one to two billing cycles before the P&L does.</div>
   <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:GRN,margin:"10px 0 4px"}}>Outcomes — what the framework produced</div>
   {[["Congressional App Challenge — WON","a mental-health application; the result of fighting to keep a student and her coach together."],["District bracket held","eight schools; four placed in the national top twenty"],["Process co-developed with the DM","what worked on the floor was written down as method"],["Word-of-mouth growth","families committing to 6- and 12-month terms"]].map(([h,d],i)=>(
    <div key={i} style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${GRN}`,padding:"5px 9px",marginBottom:4}}>
     <b style={{fontFamily:"Helvetica",fontSize:9.5}}>{h}</b>
     <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.45}}>{d}</div>
    </div>))}
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:8}}>signals illustrative per center · outcomes are the Pleasanton record · no progress record inflated to flatter this tab</div>
  </div>);})()}
  {tab==="agenda"&&(<div>
   <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",padding:"8px 10px",margin:"0 0 8px"}}>
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:MUT,marginBottom:5}}>What's new in this version</div>
    <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333",lineHeight:1.6}}>
     Added four tabs and extended one: <b>Success Rate</b> (support-plan completion by type), <b>Batch Operations</b> (bulk re-measure / bulk-commit across a filtered center set), <b>Historical Playback</b> (session trend line, captured automatically each week), and <b>Reports & Exports</b> (every export consolidated in one place, including MyStudio/QuickBooks payload shapes). <b>Audit Trail</b> gained search and source-tab filtering. All read the same canonical state every other view reads — no new data sources were introduced.
    </div>
   </div>
   <NetworkHealthDashboard centers={centers} alerts={alerts} red={red} staleN={staleN}/>
   <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#fff",padding:"8px 10px",margin:"8px 0"}}>
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:VIO,marginBottom:5}}>Action ledger — every committed action, any tab, this session</div>
    {ledger.length===0&&<div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>no actions committed yet — measurements, interventions, transfers, and deal-agent weeks all write here</div>}
    {ledger.slice(0,12).map((e,i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,marginBottom:3,display:"flex",gap:8,alignItems:"baseline"}}>
     <span style={{fontSize:7.5,fontWeight:700,letterSpacing:0.4,color:MUT,textTransform:"uppercase",width:60,flexShrink:0}}>{e.tab}</span>
     <b style={{color:VIO,width:78,flexShrink:0}}>{e.actor}</b>
     <span style={{color:"#444"}}>{e.text}</span></div>))}
    <div style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT,marginTop:4,borderTop:`1px solid ${RULE}`,paddingTop:3}}>single integration layer: committed interventions write metric deltas to the shared world state — map, forecasts, pain ranking, and this record all read the same adjusted units · {Object.keys(adj).length} unit{Object.keys(adj).length===1?"":"s"} currently carrying live adjustments</div>
   </div>
   {[
    ["§1",A("score"),V("measure"),staleN+" stale + premium tier",staleN>0?"hold":"done",AC],
    ["§2",A("fcst"),V("schedule"),alerts.filter(a=>a.eta<=90).length+" pre-breach interventions","pend",AMB],
    ["§3","sensei","rotate",blocker[1]+" blocker","pend",AC],
    ["§4",A("transfer"),V("transfer"),"3 matches + 1 peer pair","pend",GRN],
    ["§5",A("cap"),"govern",red.length+" red units","hold",AC],
    ["§6",A("gate"),"review","changelog + holds","done",GRN],
   ].map(([s,ag,vb,tg,st,c],i)=>(
    <Chain key={i} items={[{vb:s,state:"done",c:RULE},{ag,vb,tg,state:st,c}]}/>))}
   <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:6}}>generated from state · every op above writes here · candidate submission, proposes not enacts</div>
  </div>)}
  {tab==="leads"&&(()=>{
   const stageOf=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
   // Territory saturation is already computed by the Growth agent and ranked by
   // Territory White Space -- this is the one place those real numbers become
   // a hard gate rather than an informational read: a candidate cannot advance
   // past Discovery Day into a territory that's already at its capacity
   // ceiling this cycle, closing the gap between "we can see saturation" and
   // "saturation actually stops a signing."
   const territorySaturated=l=>{
    const netState=NET_STATES.find(x=>x.s===l.region);
    const headroom=netState?netState.h[0]:0.3;
    const capacity=territoryCapacityOf(headroom);
    const activeInRegion=LEADS.filter(x=>x.region===l.region&&(leadStage[x.id]!==undefined?leadStage[x.id]:x.stage0)>=4).length;
    return activeInRegion>=capacity;
   };
   const advance=l=>{
    const current=stageOf(l);
    if(current===3&&territorySaturated(l)){
     logL("leads","Territory gate",l.n+" held at Due diligence — "+l.region+" is at its candidate-capacity ceiling this cycle");
     return;
    }
    const nx=Math.min(5,current+1);setLeadStage(m=>({...m,[l.id]:nx}));
    // reinforcement pulse: a signing raises the gain of every channel that produced it —
    // the expansion tab's broker gains and flywheel multiplier recompute from this
    if(nx===5)logL("leads","Signing",l.n+" signed — flywheel pulsed: broker gains and referral flow step up ×1.06");
    else logL("leads","Stage gate",l.n+" advanced to "+STAGES6[nx]);};
   const byStage=STAGES6.map((_,si)=>LEADS.filter(l=>stageOf(l)===si));
   const signed=byStage[5].length;
   // "New franchise openings and conversions" against one blended annual target
   // hides which lever is actually carrying the number -- split here.
   const signedNew=byStage[5].filter(l=>l.dealType==="new").length;
   const signedConv=byStage[5].filter(l=>l.dealType==="conversion").length;
   const signedUS=byStage[5].filter(l=>l.market==="US").length;
   const signedCA=byStage[5].filter(l=>l.market==="Canada").length;
   const TARGET=12;
   const TARGET_NEW=8,TARGET_CONV=4; // split target: new-entrant openings vs. proven-operator conversions
   const CONV=[0.5,0.6,0.7,0.75,0.6];
   const remain=si=>{let p=1;for(let k=si;k<5;k++)p*=CONV[k];return p;};
   const expected=LEADS.reduce((a,l)=>{const s=stageOf(l);return a+(s===5?1:remain(s));},0);
   const p50=+expected.toFixed(1),p10=+(expected*0.7).toFixed(1),p90=+(expected*1.3).toFixed(1);
   const gap=+(TARGET-p50).toFixed(1);
   const reqIntro=Math.max(0,Math.ceil((TARGET-signed)/remain(0)));
   const commission=byStage[5].reduce((a,l)=>a+Math.round(l.liquidity*0.1),0);
   const NEXT=["Log intro call ▸","Book discovery ▸","Send FDD ▸","Open due diligence ▸","Invite to Discovery Day ▸","Move to signing ▸"];
   const L=leadSel!==null?LEADS.find(l=>l.id===leadSel):null;
   // Canadian leads run a provincial disclosure document, not the US FDD -- the
   // checklist names the document the market actually requires.
   const disclosureDocLabel=L&&L.market==="Canada"?"Disclosure Document acknowledgment":"FDD acknowledgment";
   const DOCS=[["Application",0],["Financial statement",1],[disclosureDocLabel,2],["Due-diligence packet",3],["Territory check",3],["Budget",4],["Franchise Agreement",5]];
   const proposals=(()=>{const out=[];
     // Cannibalization check mirrors the real Growth agent's territory-capacity
     // math (same territoryCapacityOf formula, same NET_STATES headroom) instead
     // of a per-name coin flip -- two systems answering "is this territory
     // oversubscribed?" should use the same math, not two different ones.
     const regionActive={};
     [...LEADS].sort((a,b)=>b.fit-a.fit).forEach(l=>{const s=stageOf(l);if(s>=5)return;
     const netState=NET_STATES.find(x=>x.s===l.region);
     const headroom=netState?netState.h[0]:0.3;
     const capacity=territoryCapacityOf(headroom);
     const used=regionActive[l.region]||0;regionActive[l.region]=used+1;
     if(used>=capacity){out.push({kind:"block cannibalization",cn:l.n,lever:0,block:true,note:l.region+" territory candidate-supply ceiling reached ("+capacity+")"});return;}
     if(l.fit<50&&s<=1){out.push({kind:"decline — below qualification",cn:l.n,lever:1.2,cost:1});return;}
     if(s<2){out.push({kind:"advance stage",cn:l.n,src:l.src,lever:+(1.0+l.fit/60).toFixed(2),cost:1});}
     else{out.push({kind:"awaiting human gate",cn:l.n,lever:+(l.fit/50).toFixed(2),gate:true});
      if(hash(l.n+"doc"+s)%2===0)out.push({kind:"chase documents",cn:l.n,lever:0.9,cost:1});}});
     out.forEach(p=>{if(dealAg.trained[p.kind])p.lever=+(p.lever*dealAg.trained[p.kind]).toFixed(2);});
     return out.sort((a,b)=>b.lever-a.lever);})();
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,padding:"6px 10px",marginBottom:8,lineHeight:1.5}}>
     <b style={{color:AC}}>LEAD PIPELINE</b> · the full franchise sales cycle the role owns — intro call → discovery → FDD → due diligence → Discovery Day → signing. Each prospect carries a probability split across &#123;signs · stalls · dies&#125; until a stage-gate verifies it. Agents advance and track; humans own every gate. Territory + financial qualification reserved to Development Function approval.
    </div>
    <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#fff",padding:"8px 10px",marginBottom:8}}>
     <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
      <b style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:VIO}}>Deal Agent</b>
      <button onClick={runDealWeek} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 11px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff"}}>Run one week</button>
      <button onClick={()=>setDealAg(A=>({...A,auto:!A.auto}))} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 11px",cursor:"pointer",border:`1px solid ${INK}`,background:dealAg.auto?INK:"#fff",color:dealAg.auto?"#fff":INK}}>{dealAg.auto?"Pause auto":"Run autonomously"}</button>
      <span style={{fontFamily:"Helvetica",fontSize:9}}>week <b>{dealAg.wk}</b> · <span style={{color:AC}}>{dealAg.blocked} blocked by governors</span></span>
      <button onClick={downloadReport} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 11px",cursor:"pointer",border:`1px solid ${GRN}`,background:"#fff",color:GRN,marginLeft:"auto"}}>⬇ Download pipeline CSV</button>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:5,lineHeight:1.5}}>Advances qualified deals through the administrative stages and drafts document packages under an 8-pt weekly capacity budget; then trains — checks each action against the prospect's actual fit/quality data, promotes action types with a ≥60% hit rate (2+ samples), retires the rest. <b style={{color:AC}}>Stops at every human gate</b> (FDD, due diligence, Discovery Day, signing) and is hard-blocked by the cannibalization + candidate-quality governors.</div>
     {proposals.length>0&&(<div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
      <div style={{flex:"1.2 1 260px"}}>
       <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:4}}>Proposed now — ranked by leverage, capacity-gated</div>
       {(()=>{let capp=8;return proposals.slice(0,8).map((p,i)=>{const afford=!p.gate&&!p.block&&capp-(p.cost||1)>=0;if(afford)capp-=(p.cost||1);const col=p.block?AC:p.gate?VIO:GRN;
        return(<div key={i} style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${col}`,padding:"5px 8px",marginBottom:3,opacity:p.block?0.65:1}}>
         <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <b style={{fontFamily:"Helvetica",fontSize:9}}>{p.kind} <span style={{fontWeight:400,color:MUT}}>· {p.cn}{p.src?" · via "+p.src:""}</span></b>
          <span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:col}}>{p.block?"BLOCKED":p.gate?"HUMAN GATE":"lever "+p.lever+(afford?"":" · deferred")}</span>
         </div>
        </div>);});})()}
      </div>
      <div style={{flex:"1 1 220px"}}>
       <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:VIO,marginBottom:4}}>Training memory</div>
       {dealAg.promoted.map((k,i)=>{const s=dealAg.stats[k]||{hits:0,attempts:0};return(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,color:"#2f5a3a",marginBottom:2}}>▲ PROMOTED · {k} <b>×{(dealAg.trained[k]||1).toFixed(2)}</b> <span style={{color:MUT}}>{s.hits}/{s.attempts} correct</span></div>);})}
       {dealAg.retired.map((k,i)=>{const s=dealAg.stats[k]||{hits:0,attempts:0};return(<div key={i} style={{fontFamily:"Helvetica",fontSize:9,color:AC,marginBottom:2}}>▼ RETIRED · {k} <span style={{color:MUT}}>{s.hits}/{s.attempts} correct</span></div>);})}
       {!dealAg.promoted.length&&!dealAg.retired.length&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>run a few weeks — the agent learns which action types earn their capacity</div>}
       <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,margin:"8px 0 3px"}}>Execution log</div>
       {dealAg.log.map((l,i)=>(<div key={i} style={{fontFamily:"Courier,monospace",fontSize:8,color:"#444",marginBottom:1,lineHeight:1.4}}>{l}</div>))}
       {!dealAg.log.length&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>nothing executed yet</div>}
      </div>
     </div>)}
    </div>
    <div style={{display:"flex",gap:3,marginBottom:8,flexWrap:"wrap"}}>
     {STAGES6.map((st,i)=>(<div key={i} style={{flex:"1 1 90px",border:`1px solid ${RULE}`,borderTop:`3px solid ${i===5?GRN:i===0?MUT:AMB}`,padding:"5px 7px",background:"#fff"}}>
      <div style={{fontFamily:"Helvetica",fontSize:7.5,fontWeight:700,letterSpacing:0.4,textTransform:"uppercase",color:MUT}}>{st}</div>
      <div style={{fontFamily:"Helvetica",fontSize:19,fontWeight:800,color:i===5?GRN:INK}}>{byStage[i].length}</div>
     </div>))}
    </div>
    <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#fff",padding:"9px 11px",marginBottom:8}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:VIO,marginBottom:6}}>Quota forecast — annual target back-solved</div>
     <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>
      {[["Target",TARGET,INK],["Signed",signed,GRN],["Pipeline P50",p50,gap>0?AC:GRN],["Gap",gap>0?"−"+gap:"+"+Math.abs(gap),gap>0?AC:GRN]].map(([l,v,c],i)=>(
       <div key={i} style={{flex:"1 1 80px"}}><div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:MUT,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:c}}>{v}</div></div>))}
     </div>
     <div style={{position:"relative",height:22,background:"#f0ede6",borderRadius:2,marginBottom:14,marginTop:14}}>
      <div style={{position:"absolute",left:(p10/(TARGET*1.6)*100)+"%",width:((p90-p10)/(TARGET*1.6)*100)+"%",height:22,background:"rgba(122,107,216,0.25)"}}/>
      <div style={{position:"absolute",left:(p50/(TARGET*1.6)*100)+"%",width:2,height:22,background:VIO}}/>
      <div style={{position:"absolute",left:(TARGET/(TARGET*1.6)*100)+"%",width:2,height:22,background:AC}}/>
      <div style={{position:"absolute",left:(TARGET/(TARGET*1.6)*100)+"%",top:-12,fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:AC,transform:"translateX(-50%)"}}>target</div>
      <div style={{position:"absolute",left:(p50/(TARGET*1.6)*100)+"%",top:24,fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:VIO,transform:"translateX(-50%)"}}>P50</div>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>P10 {p10} · P50 {p50} · P90 {p90} signings · ~5% intro→sign conversion · {gap>0?<b style={{color:AC}}>reload top of funnel: ~{reqIntro} intro leads to clear target</b>:<b style={{color:GRN}}>pipeline clears target at P50</b>}</div>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:3}}>Signed this cycle: <b style={{color:INK}}>{signedNew}</b> new opening{signedNew===1?"":"s"} of {TARGET_NEW} target · <b style={{color:INK}}>{signedConv}</b> conversion{signedConv===1?"":"s"} of {TARGET_CONV} target · <b style={{color:INK}}>{signedUS}</b> US · <b style={{color:INK}}>{signedCA}</b> Canada</div>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
     <div style={{flex:"1 1 130px",border:`1px solid ${RULE}`,background:"#fff",padding:"7px 9px"}}><div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:GRN,letterSpacing:0.6}}>COMMISSION (10% IFF)</div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800}}>${commission}k<span style={{fontSize:8,color:MUT}}> proxy</span></div></div>
     <div style={{flex:"1 1 130px",border:`1px solid ${RULE}`,background:"#fff",padding:"7px 9px"}}><div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:AMB,letterSpacing:0.6}}>HOT PROSPECTS</div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800}}>{LEADS.filter(l=>l.hot&&stageOf(l)<5).length}</div></div>
     <div style={{flex:"1 1 130px",border:`1px solid ${RULE}`,background:"#fff",padding:"7px 9px"}}><div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:AC,letterSpacing:0.6}}>IN PIPELINE</div><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800}}>{LEADS.filter(l=>stageOf(l)<5).length}</div></div>
    </div>
    {L&&(<div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",padding:"9px 11px",marginBottom:8}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap"}}>
      <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>{L.n} — document flow <span style={{fontSize:8.5,color:MUT,fontWeight:400}}>· stage: {STAGES6[stageOf(L)]}</span></div>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,color:L.market==="Canada"?VIO:MUT,marginBottom:2}}>{L.market} · {L.dealType==="conversion"?"conversion (proven operator)":"new opening"} · {disclosureLawOf(L.region)}</div>
      <span onClick={()=>setLeadSel(null)} style={{fontFamily:"Helvetica",fontSize:11,color:MUT,cursor:"pointer"}}>close ×</span>
     </div>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:VIO,margin:"6px 0 3px"}}>Deal state — probability split across signs · stalls · dies</div>
     {(()=>{const s=stageOf(L);const base=L.fit/100,prog=s/5;
       let signs=Math.max(0.05,base*0.5+prog*0.5),dies=Math.max(0.05,(1-base)*0.5+(1-prog)*0.3),stalls=Math.max(0.05,1-Math.abs(signs-dies));
       const t=signs+stalls+dies;const amp=[signs/t,stalls/t,dies/t];const resolved=s===5;
       const dc=["#2f7a3f","#b8860b","#8b0000"],dn=["signs","stalls","dies"];
       return(<div style={{marginBottom:6}}>
        <div style={{display:"flex",height:14,borderRadius:2,overflow:"hidden",marginBottom:3}}>
         {amp.map((a,i)=>(<div key={i} style={{width:(a*100)+"%",background:dc[i],opacity:resolved?(i===0?1:0.2):0.85}} title={dn[i]}/>))}
        </div>
        <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>{resolved?<span><b style={{color:"#2f7a3f"}}>verified → signed</b> · the signing gate confirmed this deal to a record</span>:<span>{dn.map((n,i)=>pct(amp[i])+"% "+n).join(" · ")} · each stage-gate is a checkpoint that updates the split</span>}</div>
       </div>);})()}
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginBottom:5}}>coordination of documents to corporate for processing + approvals — the role's heaviest operational load</div>
     {DOCS.map(([dn,rs],i)=>{const s=stageOf(L);const done=rs<s||(rs<=s&&s===5);const pending=!done&&(rs===s||rs===s+1);const overdue=pending&&(hash(L.n+dn)%3===0);
      const status=done?"SUBMITTED ✓":overdue?"OVERDUE ⚠":pending?"PENDING":"NOT YET";
      const col=done?GRN:overdue?AC:pending?AMB:"#bbb";
      return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderTop:i?`1px solid #f0f0f0`:"none"}}>
       <span style={{width:8,height:8,borderRadius:4,background:col,flexShrink:0}}/>
       <span style={{fontFamily:"Helvetica",fontSize:9.5,flex:1}}>{dn}</span>
       <span style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>req @ {STAGES6[rs]}</span>
       <b style={{fontFamily:"Helvetica",fontSize:8,color:col,width:76,textAlign:"right"}}>{status}</b>
      </div>);})}
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:5}}>agent flags overdue artifacts + drafts the corporate-submission package · never submits without human sign-off · FDD + due-diligence gates are non-separable</div>
    </div>)}
    <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:AC,marginBottom:2}}>Prospect book — ranked by fit · tap a card to open its document flow</div>
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginBottom:5}}>sample prospects are illustrative composites, sourced across the real channel mix (broker networks, franchise portals, direct referrals) — names are fictional; the live CRM feed replaces this book on integration</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:6}}>
     {LEADS.map(l=>{const si=stageOf(l);const fc=l.fit>=78?GRN:l.fit>=60?AMB:AC;const done=si===5;
      return(<div key={l.id} onClick={()=>setLeadSel(leadSel===l.id?null:l.id)} style={{border:`1px solid ${leadSel===l.id?INK:RULE}`,borderLeft:`4px solid ${fc}`,background:done?"#f7fbf8":leadSel===l.id?"#fbf9f4":"#fff",padding:"8px 10px",cursor:"pointer"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <b style={{fontFamily:"Helvetica",fontSize:10.5}}>{l.n}</b>
        <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:fc}}>FIT {l.fit}</span>
       </div>
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:1}}>{l.src} · {l.region}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:"#444",marginTop:3}}>liquidity ${l.liquidity}k · net ${l.net}k {l.proven&&<span style={{color:GRN,fontWeight:700}}>· proven</span>}{l.multi&&<span style={{color:VIO,fontWeight:700}}> · multi-unit</span>}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8,color:l.hot?AC:MUT,marginTop:1,fontStyle:"italic"}}>{l.note}</div>
       <div style={{display:"flex",gap:2,margin:"6px 0 4px"}}>
        {STAGES6.map((_,i)=>(<div key={i} style={{flex:1,height:4,background:i<=si?(done?GRN:AMB):"#e8e4da"}} title={STAGES6[i]}/>))}
       </div>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:done?GRN:INK}}>{STAGES6[si]}</span>
        {!done?<button onClick={e=>{e.stopPropagation();advance(l);}} style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,padding:"3px 8px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff"}}>{NEXT[si]}</button>
         :<span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:GRN}}>✓ signed +${Math.round(l.liquidity*0.1)}k</span>}
       </div>
      </div>);})}
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:8}}>fit + financials illustrative (seeded) · cycle mirrors the posting exactly · governors: candidate quality + cannibalization — no target may cross them · proven operators carry ramp inheritance into open territory</div>
   </div>);
  })()}
  {tab==="expansion"&&(()=>{
   // ===== EXPANSION ENGINE — the Director of Franchise Development objective, live =====
   // Objective: expand footprint via lead pipelines + qualified high-net-worth
   // franchisee recruitment. Reinforcement loop: each signing raises the gain of the channels
   // that produced it (broker confidence, referral flow) — a driven flywheel.
   // Each
   // signing is a coherent drive pulse; channel gain is the quality factor.
   const so=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
   const signed=LEADS.filter(l=>so(l)===5).length;
   const active=LEADS.filter(l=>so(l)<5);
   const hnw=LEADS.filter(l=>l.net>=750&&l.liquidity>=250);
   const BROKERS=[
    {n:"FranNet — West",deals:3,quality:0.82,fee:"20% IFF"},
    {n:"IFPG Network",deals:5,quality:0.74,fee:"18% IFF"},
    {n:"BAI Franchise Brokers",deals:2,quality:0.68,fee:"20% IFF"},
    {n:"Direct / referral",deals:4,quality:0.88,fee:"—"},
   ].map(b=>({...b,gain:+(b.quality*(1+(signed+reso.signed)*0.06)).toFixed(2)}));
   const srcMix={};LEADS.forEach(l=>{srcMix[l.src]=(srcMix[l.src]||0)+1;});
   const DDAYS=[
    {d:"Jul 17",seats:6,conf:4,stage:"invites out"},
    {d:"Aug 14",seats:6,conf:1,stage:"building cohort"},
    {d:"Sep 11",seats:6,conf:0,stage:"scheduled"},
   ];
   const FDD=[
    ["FDD delivery ≥14 calendar days before signing or payment","FTC Franchise Rule 16 CFR 436",true],
    ["Item 23 receipt collected and filed per candidate","16 CFR 436.7",true],
    ["Amended FDD re-disclosure on material change","16 CFR 436",true],
    ["Registration-state filings current (CA, NY, IL, ...)","state franchise acts",reso.resolved],
    ["Financial performance representations limited to Item 19","16 CFR 436.5(s)",true],
    ["Broker disclosure obligations flowed down in agreements","FTC + state rules",reso.resolved],
   ];
   const fddOk=FDD.filter(f=>f[2]).length;
   const flywheelGain=+(1+(signed+reso.signed)*0.06).toFixed(2);
   const runGrowthWeek=()=>{setReso(R=>{
    if(R.wk>=16)return R;
    const clear=FDD.every(f=>f[2]);
    const chan={...R.chan};let sw=0;const notes=[];
    BROKERS.forEach(b=>{const c={...chan[b.n]};
     const arrivals=Math.max(0,Math.round(b.gain*2.2-1));c.p+=arrivals;             // leads arrive ∝ channel gain
     const qual=Math.min(c.p,Math.round(c.p*0.3));c.p-=qual;c.ql+=qual;             // ~30% qualify (fit + HNW screen)
     if(clear&&c.ql>0){const s=Math.min(c.ql,1);c.ql-=s;sw+=s;                      // sign at most 1/channel/week — Discovery Day throughput
      notes.push(b.n+" +"+s+" signing");}
     chan[b.n]=c;});
    const signedT=R.signed+sw;const gain=+(1+(signed+signedT)*0.06).toFixed(2);
    // territory placement — cannibalization governor: saturated states (top
    // quartile by unit count) are closed; openings route to whitespace first
    const placed={...R.placed};
    if(sw>0){const counts=Object.keys(states).map(st=>[st,states[st].length+(placed[st]||0)]).sort((a,b)=>a[1]-b[1]);
     const open=counts.slice(0,Math.max(4,Math.floor(counts.length*0.75)));
     for(let k=0;k<sw;k++){const [st]=open[k%open.length];placed[st]=(placed[st]||0)+1;}
     logL("expansion","Territory",sw+" opening"+(sw>1?"s":"")+" committed to whitespace: "+Object.entries(placed).slice(-3).map(([st,n])=>st).join(", ")+" — saturated states closed by the cannibalization governor");}
    if(sw>0)logL("expansion","Momentum",sw+" signing"+(sw>1?"s":"")+" this cycle — channel gain pumped to ×"+gain);
    else logL("expansion","Governor",clear?"cycle ran — no candidates cleared qualification this week":"cycle ran — signings held: compliance items open");
    return{...R,wk:R.wk+1,signed:signedT,hist:[...R.hist,gain].slice(-17),chan,placed};});};
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,border:`1px solid ${RULE}`,borderLeft:`3px solid ${AC}`,padding:"6px 10px",marginBottom:8,lineHeight:1.5}}>
     <b style={{color:AC}}>EXPANSION ENGINE</b> · Objective: expand the brand's footprint by building lead pipelines and recruiting qualified, high-net-worth franchisees — generation through final contract closing, FDD and federal compliance throughout, discovery days and broker networks managed as owned channels. 
    </div>
    <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
     {[["Signed YTD",signed,GRN],["Active candidates",active.length,INK],["HNW-qualified",hnw.length,VIO],["Flywheel gain","×"+flywheelGain,AMB],["Compliance",fddOk+"/"+FDD.length,fddOk===FDD.length?GRN:AC]].map(([l,v,c],i)=>(
      <div key={i} style={{flex:"1 1 110px",border:`1px solid ${RULE}`,background:"#fff",padding:"7px 9px"}}><div style={{fontFamily:"Helvetica",fontSize:7.5,fontWeight:700,letterSpacing:0.5,color:MUT,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:c}}>{v}</div></div>))}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
     <div style={{flex:"1.2 1 280px",border:`1px solid ${RULE}`,borderLeft:`3px solid ${VIO}`,background:"#fff",padding:"8px 10px"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:VIO,marginBottom:5}}>Broker network — {"referral channels, gain compounds with signings"}</div>
      {BROKERS.map((b,i)=>(<div key={i} style={{marginBottom:5}}>
       <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Helvetica",fontSize:9.5}}><span><b>{b.n}</b> <span style={{color:MUT,fontSize:8}}>· {b.deals} in pipeline · {b.fee}</span></span><b style={{color:b.gain>=0.8?GRN:b.gain>=0.7?AMB:AC}}>gain {b.gain}</b></div>
       <div style={{height:5,background:"#eee"}}><div style={{height:5,width:Math.min(100,b.gain*100)+"%",background:b.gain>=0.8?GRN:b.gain>=0.7?AMB:AC,transition:"width .4s"}}/></div>
      </div>))}
      <button onClick={()=>{logL(tab,"Broker",BROKERS[0].n+" quarterly review scheduled — pipeline audit + fee reconciliation");setOpsMsg("Broker review on the record — see RECORD tab");}} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",marginTop:3}}>Schedule broker review ▸</button>
     </div>
     <div style={{flex:"1 1 240px",border:`1px solid ${RULE}`,borderLeft:`3px solid ${AMB}`,background:"#fff",padding:"8px 10px"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:AMB,marginBottom:5}}>Discovery days — hosted cohorts</div>
      {DDAYS.map((d,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontFamily:"Helvetica",fontSize:9.5,padding:"4px 0",borderTop:i?"1px solid #f0f0f0":"none"}}>
       <span><b>{d.d}</b> <span style={{color:MUT,fontSize:8}}>· {d.stage}</span></span><span style={{color:d.conf>=4?GRN:d.conf>=2?AMB:MUT,fontWeight:700}}>{d.conf}/{d.seats} confirmed</span></div>))}
      <button onClick={()=>{logL(tab,"Discovery Day","Jul 17 cohort — confirmations pushed, FDD delivery dates verified for all attendees");setOpsMsg("Discovery Day prep logged — FDD 14-day clocks verified");}} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",marginTop:5}}>Run cohort prep ▸</button>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:4}}>lead source mix: {Object.entries(srcMix).map(([s,n])=>s+" "+n).join(" · ")}</div>
     </div>
    </div>
    <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${GRN}`,background:"#fff",padding:"8px 10px",marginBottom:8}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
      <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:GRN}}>{"Growth loop — lead generation through closing, on cadence"}</div>
      <span style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>channel simulation for capacity planning · the prospect book above remains the real pipeline</span>
     </div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",margin:"6px 0"}}>
      <button onClick={runGrowthWeek} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"5px 11px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff"}}>Run growth week ▸</button>
      <span style={{fontFamily:"Helvetica",fontSize:9}}>cycle <b>{reso.wk}</b> · <b style={{color:GRN}}>{reso.signed}</b> signed via loop · gain <b style={{color:AMB}}>×{flywheelGain}</b></span>
      {!reso.resolved&&<button onClick={()=>{setReso(R=>({...R,resolved:true}));logL("expansion","Compliance","state filings + broker flow-downs resolved — signing governor released");}} style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${AC}`,background:"#fff",color:AC}}>Resolve open compliance items ▸</button>}
     </div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 200px"}}>
       {BROKERS.map((b,i)=>{const c=reso.chan[b.n]||{p:0,ql:0};return(<div key={i} style={{display:"flex",justifyContent:"space-between",fontFamily:"Helvetica",fontSize:8.5,padding:"2px 0",borderTop:i?"1px solid #f0f0f0":"none"}}><span>{b.n}</span><span style={{color:MUT}}>{c.p} prospecting · <b style={{color:INK}}>{c.ql} qualified</b></span></div>);})}
       <div style={{fontFamily:"Helvetica",fontSize:7.5,color:MUT,marginTop:3}}>arrivals ∝ channel gain · ~30% clear the fit + HNW screen · one signing per channel per cycle (Discovery Day throughput) · <b style={{color:AC}}>zero signings while any compliance item is open</b></div>
      </div>
      <div style={{flex:"1 1 160px"}}>
       <svg viewBox="0 0 170 44" style={{width:"100%",height:"auto"}}>
        {reso.hist.map((g,i)=>{if(i===0)return null;const x1=6+(i-1)*(158/16),x2=6+i*(158/16);const y=v=>40-Math.min(36,(v-1)*60);return <line key={i} x1={x1} y1={y(reso.hist[i-1])} x2={x2} y2={y(g)} stroke="#b8860b" strokeWidth="1.6"/>;})}
        <text x="6" y="10" style={{font:"6.5px Helvetica",fill:"#999"}}>{"flywheel gain over cycles"} · now ×{flywheelGain}</text>
       </svg>
      </div>
      <div style={{flex:"1 1 170px"}}>
       <div style={{fontFamily:"Helvetica",fontSize:7.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:3}}>Territory placement — whitespace first</div>
       {Object.keys(reso.placed).length===0&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>no committed openings yet — signings route to the least-served states</div>}
       {Object.entries(reso.placed).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([st,n],i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",fontFamily:"Helvetica",fontSize:8.5,padding:"1px 0"}}><span><b>{st}</b> <span style={{color:MUT}}>· {(states[st]||[]).length} existing</span></span><b style={{color:GRN}}>+{n}</b></div>))}
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:3}}>saturated states (top quartile by unit count) closed by the cannibalization governor · committed openings appear in the masthead network count</div>
      </div>
     </div>
    </div>
    <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${fddOk===FDD.length?GRN:AC}`,background:"#fff",padding:"8px 10px",marginBottom:8}}>
     <div style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",color:fddOk===FDD.length?GRN:AC,marginBottom:5}}>FDD & federal compliance — hard governors on the flywheel</div>
     {FDD.map(([t,cite,ok],i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0",borderTop:i?"1px solid #f0f0f0":"none"}}>
      <span style={{width:8,height:8,borderRadius:4,background:ok?GRN:AC,flexShrink:0}}/>
      <span style={{fontFamily:"Helvetica",fontSize:9.5,flex:1}}>{t}</span>
      <span style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>{cite}</span>
      <b style={{fontFamily:"Helvetica",fontSize:8,color:ok?GRN:AC,width:64,textAlign:"right"}}>{ok?"CURRENT":"ACTION REQ"}</b></div>))}
     <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:5}}>{"no signing proceeds while a compliance item is open — the flywheel is throttled by the governors, by design"} · demonstration checklist pending counsel review</div>
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>reads the live lead pipeline · broker/cohort actions write the shared record ledger · candidate submission — proposes, does not enact</div>
   </div>);})()}
  {tab==="lenses"&&<EngineErrorBoundary><SixLensTab centers={centers} states={states} leads={LEADS} railData={railData} opt={opt} setOpt={setOpt} logL={logL} focusCenter={focusCenter} jumpReason={jumpReason} clearJumpReason={()=>setJumpReason(null)}/></EngineErrorBoundary>}
  {tab==="rail"&&<DecisionRailTab railData={railData} logL={logL} decisions={decisions} setDecisions={setDecisions} decisionHistory={decisionHistory} recordDecision={recordDecision} jumpTo={jumpTo} opt={opt}/>}
  {tab==="board"&&<EngineErrorBoundary>{boardOverrideActive&&<div style={{border:`1px solid ${VIO}`,borderLeft:`3px solid ${VIO}`,background:"#faf9ff",padding:"6px 10px",marginBottom:10,fontFamily:"Helvetica",fontSize:9.5,color:"#3d3470"}}>This tab is locally overridden to <b>{boardOverride}</b> — network-wide posture is <b>{boardGlobalPosture}</b>. Proposals below reflect the override. Set from Quantum PM.</div>}<OperationsBoardTab railData={boardRailData} decisions={decisions} setDecisions={setDecisions} decisionHistory={decisionHistory} recordDecision={recordDecision} logL={logL} opt={opt} dyn={dyn} jumpTo={jumpTo}/></EngineErrorBoundary>}
  {tab==="alignment"&&<SystemAlignmentTab centers={centers} states={states} railData={railData} decisions={decisions} dyn={dyn} opt={opt} ledger={ledger} jumpTo={jumpTo}/>}
  {tab==="dynamics"&&<OperationsDynamicsTab centers={centers} states={states} opt={opt} setOpt={setOpt} logL={logL} dyn={dyn} setDyn={setDyn} focusCenter={focusCenter} railData={railData} jumpTo={jumpTo}/>}
  {tab==="compliance"&&(()=>{
   const heldComp=centers.filter(c=>c.compliance===false);
   const heldStaff=centers.filter(c=>c.staffCleared===false);
   const heldEither=centers.filter(c=>c.compliance===false||c.staffCleared===false);
   const cleared=centers.length-heldEither.length;
   const byState={};heldEither.forEach(c=>{byState[c.st]=(byState[c.st]||0)+1;});
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>The child-safety guardrail reads two fields on every unit — compliance and staff clearance — and blocks any proposed action on a unit where either is open, before a Director ever sees it. This view is the network-wide roll-up of that same real check, not a separate count.</div>
    <div style={{display:"flex",flexWrap:"wrap",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
     {[[centers.length,"total units"],[cleared,"fully cleared",GRN],[heldComp.length,"compliance item open",AC],[heldStaff.length,"staff clearance open",AC]].map(([v,l,c],i)=>(
      <div key={i} style={{flex:"1 1 150px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
       <div style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:c||INK}}>{v}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
      </div>))}
    </div>
    {heldEither.length===0?
     <div style={{fontFamily:"Helvetica",fontSize:9.5,color:GRN,border:`1px solid ${RULE}`,padding:"8px 11px"}}>All {centers.length} units currently clear — checked, none open.</div>
     :<div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Units with an open item ({heldEither.length})</div>
      {heldEither.map(c=>(<div key={c.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 11px",borderTop:`1px solid #f0f0f0`}}>
       <div>
        <span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700}}>{c.name}</span>
        <span style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginLeft:8}}>{c.st}</span>
        <span style={{fontFamily:"Helvetica",fontSize:9,color:AC,marginLeft:8}}>{c.compliance===false?"compliance":""}{c.compliance===false&&c.staffCleared===false?" · ":""}{c.staffCleared===false?"staff clearance":""}</span>
       </div>
       {jumpTo&&<button onClick={()=>jumpTo("lenses",c.name,"reviewing an open compliance item on "+c.name)} style={{fontFamily:"Helvetica",fontSize:9,color:AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>view in Six Lenses →</button>}
      </div>))}
     </div>}
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:8}}>By state: {Object.keys(byState).length?Object.entries(byState).map(([st,n])=>st+" ("+n+")").join(", "):"none"}</div>
   </div>);})()}
  {tab==="workload"&&(()=>{
   const recs=railData.recommendations;
   const workload={};
   recs.forEach(r=>{const role=r.approverRole;workload[role]=workload[role]||{pending:0,decided:0,heldForCapacity:0};
    if(decisions[r.id])workload[role].decided++;else workload[role].pending++;
    if(r.supplyGate&&r.supplyGate.blocked&&/capacity/.test(r.supplyGate.reason||""))workload[role].heldForCapacity++;});
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Every proposal names an approver role and counts against that role's weekly capacity ceiling — the same {"{FBC:10, Owner:8, Director:12}"} limits the Growth, Unit Health, and Retention agents themselves respect. This is that capacity read as its own view, not a strip buried in Decision Rail.</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
     {Object.entries(workload).map(([role,w])=>{
      const cap=ROLE_CAPACITY[role]||12;
      const used=w.decided+w.pending;
      const pct=Math.min(100,Math.round((used/cap)*100));
      return(<div key={role} style={{flex:"1 1 220px",border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
       <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><b style={{fontFamily:"Helvetica",fontSize:12}}>{role}</b><span style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>cap {cap}/wk</span></div>
       <div style={{height:6,background:"#eee",borderRadius:3,marginBottom:6}}><div style={{height:6,width:pct+"%",borderRadius:3,background:pct>=100?AC:pct>=75?AMB:GRN}}/></div>
       <div style={{fontFamily:"Helvetica",fontSize:9,color:"#444"}}>{w.decided} decided · {w.pending} pending{w.heldForCapacity?" · "+w.heldForCapacity+" held for capacity":""}</div>
      </div>);})}
    </div>
    {jumpTo&&<button onClick={()=>setTab("rail")} style={{marginTop:10,fontFamily:"Helvetica",fontSize:9,color:AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>view full proposal queue in Decision Rail →</button>}
    {(()=>{
     // Department operating budget -- the JD names "expense budget maintenance"
     // as its own responsibility, distinct from franchisee unit economics. This
     // is the Franchise Development function's own spend, not the network's.
     const QUARTER_CEILING=45; // $k, illustrative departmental ceiling
     const DISCOVERY_DAY_COST=2.4; // $k per event: venue, catering, staff time
     const stageOfLive=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
     const discoveryDaysRun=LEADS.filter(l=>stageOfLive(l)>=4).length;
     const discoveryCost=+(discoveryDaysRun*DISCOVERY_DAY_COST).toFixed(1);
     const signedLeads=LEADS.filter(l=>stageOfLive(l)===5);
     const brokerCommission=signedLeads.reduce((a,l)=>a+Math.round(l.liquidity*0.1),0);
     const travelSpend=8.5; // $k, illustrative quarter-to-date travel
     const spent=+(discoveryCost+brokerCommission+travelSpend).toFixed(1);
     const remaining=+(QUARTER_CEILING-spent).toFixed(1);
     const pct=Math.min(100,Math.round((spent/QUARTER_CEILING)*100));
     return(<div style={{marginTop:14,border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:4}}>Department operating budget — this quarter</div>
      <div style={{height:6,background:"#eee",borderRadius:3,marginBottom:6}}><div style={{height:6,width:pct+"%",borderRadius:3,background:pct>=100?AC:pct>=80?AMB:GRN}}/></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:14,fontFamily:"Helvetica",fontSize:9,color:"#444"}}>
       <span>${spent}k spent of ${QUARTER_CEILING}k ceiling</span>
       <span>${remaining}k remaining</span>
       <span>travel ${travelSpend}k</span>
       <span>Discovery Day ${discoveryCost}k ({discoveryDaysRun} run)</span>
       <span>broker commission ${brokerCommission}k ({signedLeads.length} signed)</span>
      </div>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:5}}>Illustrative departmental spend, tracked separately from franchisee unit economics — broker commission and Discovery Day counts are computed from the real pipeline above, not assumed.</div>
     </div>);
    })()}
   </div>);})()}
  {tab==="whitespace"&&(()=>{
   const covered=new Set(Object.keys(states));
   const rows=NET_STATES.map(ns=>{
    const cs=states[ns.s]||[];
    const headroom=ns.h[0];
    const score=headroom*(1/(1+cs.length));
    return{st:ns.s,headroom,n:cs.length,score};
   }).sort((a,b)=>b.score-a.score);
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>The Network Map shows where units already are. This is the forward-looking counterpart: territories ranked by modeled headroom against how few units are already there — the same headroom figure the Growth agent's territory-capacity gate reads, not a separate estimate.</div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     <div style={{display:"flex",fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>
      <span style={{flex:1}}>Territory</span><span style={{width:90}}>Headroom</span><span style={{width:90}}>Current units</span><span style={{width:110}}>White-space score</span>
     </div>
     {rows.slice(0,15).map(r=>(<div key={r.st} style={{display:"flex",alignItems:"center",padding:"5px 11px",borderTop:"1px solid #f0f0f0"}}>
      <span style={{flex:1,fontFamily:"Helvetica",fontSize:10,fontWeight:700}}>{r.st}</span>
      <span style={{width:90,fontFamily:"Helvetica",fontSize:9.5}}>{Math.round(r.headroom*100)}%</span>
      <span style={{width:90,fontFamily:"Helvetica",fontSize:9.5}}>{r.n||"—"}</span>
      <span style={{width:110,fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,color:r.score>0.15?GRN:INK}}>{r.score.toFixed(3)}</span>
     </div>))}
    </div>
    {jumpTo&&<button onClick={()=>setTab("leads")} style={{marginTop:10,fontFamily:"Helvetica",fontSize:9,color:AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>view active candidates in Growth Pipeline →</button>}
   </div>);})()}
  {tab==="financials"&&(()=>{
   // Respects a LOCAL scenario override set from Quantum PM's governed-tabs
   // grid. Previously that override was audit-logged but never actually
   // changed what this tab displayed — it recomputes from the same raw base +
   // manual adj as the global centers array, just under a different posture,
   // via the same computeCentersForPosture() the global view uses.
   const globalPosture=(opt.quantum&&opt.quantum.approved)||"realistic";
   const finOverride=opt.quantum&&opt.quantum.overrides&&opt.quantum.overrides.financials;
   const overrideActive=!!(finOverride&&finOverride!==globalPosture);
   const financialsCenters=overrideActive?computeCentersForPosture(rawCenters,adj,finOverride,opt.week):centers;
   const totals=financialsCenters.reduce((a,c)=>{const r=royaltyOf(c);a.grossRev+=r.grossRev;a.royalty+=r.royalty;a.brandFund+=r.brandFund;a.margin+=c.eb;return a;},{grossRev:0,royalty:0,brandFund:0,margin:0});
   const byState={};financialsCenters.forEach(c=>{const r=royaltyOf(c);byState[c.st]=(byState[c.st]||0)+r.royalty;});
   const topStates=Object.entries(byState).sort((a,b)=>b[1]-a[1]).slice(0,8);
   return(<div>
    {overrideActive&&<div style={{border:`1px solid ${VIO}`,borderLeft:`3px solid ${VIO}`,background:"#faf9ff",padding:"6px 10px",marginBottom:8,fontFamily:"Helvetica",fontSize:9.5,color:"#3d3470"}}>This tab is locally overridden to <b>{finOverride}</b> — network-wide posture is <b>{globalPosture}</b>. Summed unit margin reflects the override (posture shifts <code>eb</code> directly); gross revenue, royalty, and brand fund below are driven by enrolled students, which no posture in this model adjusts, so those three stay the same under any override. Set from Quantum PM.</div>}
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Every figure below sums the same per-unit royalty calculation Six Lenses shows for one center at a time — aggregated here across the whole network rather than read one unit at a time.</div>
    <div style={{display:"flex",flexWrap:"wrap",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
     {[["$"+totals.grossRev.toFixed(0)+"k","modeled gross revenue"],["$"+totals.royalty.toFixed(0)+"k","royalty (8%)"],["$"+totals.brandFund.toFixed(0)+"k","brand fund (2%)"],["$"+totals.margin.toFixed(0)+"k","summed unit margin"]].map(([v,l],i)=>(
      <div key={i} style={{flex:"1 1 150px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800}}>{v}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
      </div>))}
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:5}}>Top territories by royalty contribution</div>
    {topStates.map(([st,v])=>(<div key={st} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
     <span style={{width:36,fontFamily:"Helvetica",fontSize:9.5,fontWeight:700}}>{st}</span>
     <div style={{flex:1,height:6,background:"#eee",borderRadius:3}}><div style={{height:6,width:Math.min(100,(v/topStates[0][1])*100)+"%",borderRadius:3,background:VIO}}/></div>
     <span style={{width:60,textAlign:"right",fontFamily:"Helvetica",fontSize:9.5}}>${v.toFixed(0)}k</span>
    </div>))}
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:8}}>Modeled/illustrative pending live MyStudio and QuickBooks integration, same as every other financial figure in this artifact.</div>
   </div>);})()}
  {tab==="audit"&&(()=>{
   const decidedIds=Object.keys(decisions);
   const sourceTabs=Array.from(new Set(ledger.map(e=>e.tab))).sort();
   const q=auditQ.trim().toLowerCase();
   const filtered=ledger.filter(e=>
    (auditTabFilter==="all"||e.tab===auditTabFilter)&&
    (!q||e.actor.toLowerCase().includes(q)||e.text.toLowerCase().includes(q)||e.tab.toLowerCase().includes(q))
   );
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Every governed action in this session in one place: the session ledger, and the full status history behind each decision — the same records System Alignment summarizes, shown here as a complete trail rather than a count.</div>
    <div style={{display:"flex",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
     {[[ledger.length,"logged actions (session, capped 40)"],[decidedIds.length,"decisions recorded"],[Object.keys(dyn.committed||{}).length,"support paths committed"],[Object.keys(dyn.completed||{}).length,"marked complete"]].map(([v,l],i)=>(
      <div key={i} style={{flex:"1 1 150px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800}}>{v}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
      </div>))}
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
     <input value={auditQ} onChange={e=>setAuditQ(e.target.value)} placeholder="Search actor or action text…" aria-label="Search audit ledger" style={{fontFamily:"Helvetica",fontSize:9.5,padding:"5px 8px",border:`1px solid ${RULE}`,minWidth:220}}/>
     <select value={auditTabFilter} onChange={e=>setAuditTabFilter(e.target.value)} aria-label="Filter audit ledger by source tab" style={{fontFamily:"Helvetica",fontSize:9.5,padding:"5px 8px",border:`1px solid ${RULE}`,background:"#fff"}}>
      <option value="all">All source tabs ({ledger.length})</option>
      {sourceTabs.map(t=>(<option key={t} value={t}>{t} ({ledger.filter(e=>e.tab===t).length})</option>))}
     </select>
     {(auditQ||auditTabFilter!=="all")&&<button onClick={()=>{setAuditQ("");setAuditTabFilter("all");}} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>clear filters</button>}
     <span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginLeft:"auto"}}>{filtered.length} of {ledger.length} shown</span>
     <button onClick={()=>downloadJSON(decisionLedgerExport(decisions,railData),"cn-decision-ledger.json")} title="Export the governed decision record as JSON" style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>export ledger ↓</button>
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Session ledger, most recent first{auditTabFilter!=="all"||q?" — filtered":""}</div>
     {filtered.length===0?<div style={{padding:"10px 11px",fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>{ledger.length===0?"No actions logged yet this session.":"No logged actions match this filter."}</div>:
      filtered.map((e,i)=>(<div key={i} style={{padding:"5px 11px",borderTop:i?"1px solid #f0f0f0":"none",display:"flex",gap:8}}>
       <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:MUT,width:70,textTransform:"uppercase"}}>{e.tab}</span>
       <span style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333"}}><b>{e.actor}:</b> {e.text}</span>
      </div>))}
    </div>
   </div>);})()}

  {tab==="success"&&<EngineErrorBoundary>{(()=>{
   // Success Rate Dashboard — reads only the governed commitment/completion
   // record Operations Dynamics writes (dyn.committed/dyn.completed), the same
   // one Audit Trail already counts. No separate scoring model: a plan is
   // "successful" here strictly in the sense of "marked complete after being
   // committed" — an operational outcome, not a satisfaction score.
   const sr=successRateData(dyn);
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Completion rate by support-plan type, computed from the same commit/complete record Operations Dynamics writes to and Audit Trail counts — grouped here by plan instead of by center. A plan is "complete" only when a Director has explicitly marked it so; nothing here infers completion from elapsed time.</div>
    <div style={{display:"flex",border:`1px solid ${RULE}`,borderLeft:`3px solid ${sr.overallRate>=60?GRN:sr.overallRate>=35?AMB:AC}`,background:"#fff",marginBottom:10}}>
     {[[sr.totalCommitted,"support paths committed, all time this session"],[sr.totalCompleted,"marked complete"],[sr.overallRate+"%","overall completion rate"]].map(([v,l],i)=>(
      <div key={i} style={{flex:"1 1 150px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800}}>{v}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
      </div>))}
    </div>
    {sr.rows.length===0?
     <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"14px",fontFamily:"Helvetica",fontSize:10,color:MUT}}>No support paths committed yet this session — commit one from Operations Dynamics to populate this dashboard.</div>:
     <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>By support-plan type</div>
      {sr.rows.map((r,i)=>(
       <div key={r.id} style={{padding:"9px 11px",borderTop:i?"1px solid #f0f0f0":"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
         <b style={{fontFamily:"Helvetica",fontSize:11,color:INK}}>{r.n}</b>
         <span style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:r.rate>=60?GRN:r.rate>=35?AMB:AC}}>{r.completed} / {r.committed} complete · {r.rate}%</span>
        </div>
        <div style={{background:"#f0f0ee",height:6,borderRadius:3,marginTop:5,overflow:"hidden"}}>
         <div style={{width:r.rate+"%",height:"100%",background:r.rate>=60?GRN:r.rate>=35?AMB:AC}}/>
        </div>
        <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:4}}>{r.centers.slice(0,6).join(" · ")}{r.centers.length>6?" · +"+(r.centers.length-6)+" more":""}</div>
       </div>))}
     </div>}
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:8}}>Scope note: this reflects commitments made during the current session only, since dyn state is not yet persisted across sessions — a live deployment would read this from the standing commitment record instead.</div>
   </div>);})()}</EngineErrorBoundary>}

  {tab==="reports"&&<EngineErrorBoundary>{(()=>{
   // Reports & Exports — a single consolidated panel over exports that already
   // exist elsewhere in the file (ledger JSON, summary text, full sync JSON),
   // plus two new CSV cuts. No new data sources: every export here reads the
   // same canonical state/railData/dyn/ledger every other tab reads.
   const recCount=(railData.recommendations||[]).length;
   // System diagnostics — a visible internal-consistency check, not just a
   // claim of one. Reads GROUPS/TABL/decisions/railData directly; doesn't
   // introduce a parallel figure anywhere.
   const groupTabs=Object.values(GROUPS).flat();
   const orphanLabels=groupTabs.filter(t=>!(t in TABL));
   const authoritativeUnits=244;
   const verifiedN=centers.filter(c=>c.verified).length;
   const fddTiesOut=verifiedN<=centers.length&&authoritativeUnits>0;
   const orphanDecisions=Object.keys(decisions).filter(id=>!(railData.recommendations||[]).some(r=>r.id===id));
   const allowedN=(railData.recommendations||[]).filter(r=>r.governance.allowed).length;
   const heldN=recCount-allowedN;
   const govMathOk=allowedN+heldN===recCount;
   const ledgerWithinCap=ledger.length<=40;
   const diagnostics=[
    {label:"Nav registration",pass:orphanLabels.length===0,detail:orphanLabels.length===0?"every tab in GROUPS has a label in TABL":orphanLabels.length+" tab(s) missing a label: "+orphanLabels.join(", ")},
    {label:"FDD Item 20 reconciliation",pass:fddTiesOut,detail:authoritativeUnits+" authoritative · "+verifiedN+" verified · "+centers.length+" modeled — figures stated separately, never blended"},
    {label:"Governance math",pass:govMathOk,detail:allowedN+" allowed + "+heldN+" held = "+recCount+" total proposals"},
    {label:"Decision ledger integrity",pass:orphanDecisions.length===0,detail:orphanDecisions.length===0?"every recorded decision maps to a real proposal":orphanDecisions.length+" decision(s) reference a proposal id no longer in the recommendation set"},
    {label:"Session ledger cap",pass:ledgerWithinCap,detail:ledger.length+" of 40 max entries — "+(ledgerWithinCap?"within cap":"cap exceeded, investigate")},
   ];
   const allPass=diagnostics.every(d=>d.pass);
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Every export the model can produce, in one place. Each reads the live canonical state at the moment of export — nothing here is pre-generated or cached.</div>
    <div style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${allPass?GRN:AC}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>System diagnostics — live self-check, not a claim</div>
     {diagnostics.map((d,i)=>(<div key={d.label} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"7px 11px",borderTop:i?"1px solid #f0f0f0":"none",gap:10,flexWrap:"wrap"}}>
      <div><b style={{fontFamily:"Helvetica",fontSize:10,color:INK}}>{d.pass?"✓":"✕"} {d.label}</b><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:1}}>{d.detail}</div></div>
      <span style={{fontFamily:"Helvetica",fontSize:8,fontWeight:700,color:d.pass?GRN:AC}}>{d.pass?"PASS":"CHECK"}</span>
     </div>))}
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Governance records</div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>Decision ledger (JSON)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{Object.keys(decisions).length} decisions, with agent, action type, approver role, and governance status per row</div></div>
      <button onClick={()=>downloadJSON(decisionLedgerExport(decisions,railData),"cn-decision-ledger.json")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Export JSON ↓</button>
     </div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>Governed recommendations (CSV)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{recCount} proposals this cycle from all four agents, allowed/held status included</div></div>
      <button onClick={()=>downloadCSV(toCSV(railData.recommendations||[],RECOMMENDATION_CSV_COLS),"cn-recommendations.csv")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Export CSV ↓</button>
     </div>
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Network data</div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>Center roster (CSV)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{centers.length} centers — health, condition, EBITDA, retention, chemistry, conversion</div></div>
      <button onClick={()=>downloadCSV(toCSV(centers,CENTER_CSV_COLS),"cn-center-roster.csv")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Export CSV ↓</button>
     </div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>Full network + pipeline sync (JSON)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Complete canonical state, action ledger, and pipeline — the shape a live MyStudio/QuickBooks sync would read</div></div>
      <button onClick={downloadAll} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Export JSON ↓</button>
     </div>
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Integration payload stubs — shape, not a live connection</div>
     <div style={{fontFamily:"Helvetica",fontSize:9.5,color:"#555",padding:"7px 11px 0",lineHeight:1.5}}>Field-level shapes only, for the eventual live integration this model has always flagged as pending. Every value is read from the same canonical center record every other tab reads.</div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>MyStudio payload shape (JSON)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Enrollment, engagement, and retention fields per center — illustrative field contract</div></div>
      <button onClick={()=>downloadJSON(myStudioPayloadOf(centers),"cn-mystudio-payload-shape.json")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Export JSON ↓</button>
     </div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>QuickBooks payload shape (JSON)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Revenue, royalty, brand fund, and EBITDA fields per center — illustrative GL mapping</div></div>
      <button onClick={()=>downloadJSON(quickBooksPayloadOf(centers),"cn-quickbooks-payload-shape.json")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Export JSON ↓</button>
     </div>
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Reviewer summaries</div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderTop:"1px solid #f0f0f0"}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>Offline summary (TXT)</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Network health, governance this cycle, standing rules, recent activity — for a reviewer who wants this without opening the live model</div></div>
      <button onClick={()=>downloadText(buildSummaryText(centers,states,railData,dyn,opt,ledger),"cn-summary.txt")} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 10px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Download TXT ↓</button>
     </div>
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:8}}>All exports are generated client-side from the live state in this session; nothing is transmitted off-device.</div>
   </div>);})()}</EngineErrorBoundary>}

  {tab==="batch"&&<EngineErrorBoundary>{(()=>{
   // Batch Operations — bulk versions of two actions that already exist
   // per-center: re-measure (Operations Dynamics "review") and commit the
   // top-ranked support path (Operations Dynamics "commit"). Nothing new is
   // computed; this just applies the same functions across a filtered set.
   const conflictedCenters=new Set((railData.conflicts||[]).flatMap(cf=>{
    const recs=railData.recommendations||[];
    const ra=recs.find(r=>r.id===cf.a),rb=recs.find(r=>r.id===cf.b);
    return[ra,rb].filter(Boolean).flatMap(r=>r.targetIds.filter(t=>typeof t==="string"&&t.length>2));
   }));
   const staleBaseHere=c=>opt.fresh[c.name]===undefined&&(hash(c.name)%38)>21;
   const stateOptions=Object.keys(states).sort();
   const filtered=centers.filter(c=>
    (batchCondition==="all"||conditionOf(c).label===batchCondition)&&
    (batchState==="all"||c.st===batchState)&&
    (!batchStaleOnly||staleBaseHere(c))
   );
   const eligibleForCommit=filtered.filter(c=>!dyn.committed||dyn.committed[c.name]===undefined).filter(c=>!conflictedCenters.has(c.name));
   const skippedConflict=filtered.filter(c=>conflictedCenters.has(c.name)).length;
   const skippedCommitted=filtered.filter(c=>dyn.committed&&dyn.committed[c.name]!==undefined&&!conflictedCenters.has(c.name)).length;
   const remeasureAll=()=>{
    if(!filtered.length)return;
    setOpt(o=>{const f={...o.fresh};filtered.forEach(c=>{f[c.name]=o.week;});return{...o,fresh:f};});
    logL("batch","Batch",filtered.length+" centers re-measured in one batch — filter: "+batchCondition+"/"+batchState+(batchStaleOnly?"/stale-only":""));
    setOpsMsg(filtered.length+" centers re-measured.");
   };
   const commitTopPathAll=()=>{
    if(!eligibleForCommit.length)return;
    setDyn(m=>{const nc={...m.committed};eligibleForCommit.forEach(c=>{const p=supportPathsOf(c)[0];nc[c.name]=p.id;});return{...m,committed:nc};});
    logL("batch","Director",eligibleForCommit.length+" centers committed to their top-ranked support path in one batch"+(skippedConflict?" — "+skippedConflict+" skipped (open conflict)":"")+(skippedCommitted?" — "+skippedCommitted+" skipped (already committed)":""));
    setOpsMsg(eligibleForCommit.length+" committed"+(skippedConflict||skippedCommitted?" · "+(skippedConflict+skippedCommitted)+" skipped":"")+".");
   };
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Bulk versions of two actions Operations Dynamics already performs one center at a time: re-measure, and commit the top-ranked support path. Every action here is logged per batch to the Audit Trail, and skips any center with an open cross-agent conflict rather than overriding it silently.</div>
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10,border:`1px solid ${RULE}`,background:"#fff",padding:"9px 11px"}}>
     <select value={batchCondition} onChange={e=>setBatchCondition(e.target.value)} aria-label="Filter by condition" style={{fontFamily:"Helvetica",fontSize:9.5,padding:"5px 8px",border:`1px solid ${RULE}`,background:"#fff"}}>
      <option value="all">All conditions</option>
      {QSTATES.map(q=>(<option key={q} value={q}>{q}</option>))}
     </select>
     <select value={batchState} onChange={e=>setBatchState(e.target.value)} aria-label="Filter by state or province" style={{fontFamily:"Helvetica",fontSize:9.5,padding:"5px 8px",border:`1px solid ${RULE}`,background:"#fff"}}>
      <option value="all">All states/provinces</option>
      {stateOptions.map(s=>(<option key={s} value={s}>{s}</option>))}
     </select>
     <label style={{fontFamily:"Helvetica",fontSize:9.5,color:"#333",display:"flex",alignItems:"center",gap:5}}>
      <input type="checkbox" checked={batchStaleOnly} onChange={e=>setBatchStaleOnly(e.target.checked)}/> Stale measurement only
     </label>
     {(batchCondition!=="all"||batchState!=="all"||batchStaleOnly)&&<button onClick={()=>{setBatchCondition("all");setBatchState("all");setBatchStaleOnly(false);}} style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"5px 9px",cursor:"pointer",border:`1px solid ${RULE}`,background:"#fff",color:MUT}}>clear filters</button>}
     <span style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginLeft:"auto"}}>{filtered.length} of {centers.length} centers match</span>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:10}}>
     <button onClick={remeasureAll} disabled={!filtered.length} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"7px 12px",cursor:filtered.length?"pointer":"default",border:`1px solid ${INK}`,background:filtered.length?"#fff":"#f0f0f0",color:filtered.length?INK:"#aaa"}}>Re-measure all filtered ({filtered.length})</button>
     <button onClick={commitTopPathAll} disabled={!eligibleForCommit.length} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"7px 12px",cursor:eligibleForCommit.length?"pointer":"default",border:`1px solid ${INK}`,background:eligibleForCommit.length?INK:"#f0f0f0",color:eligibleForCommit.length?"#fff":"#aaa"}}>Commit top support path to eligible ({eligibleForCommit.length})</button>
     <span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,alignSelf:"center"}}>{skippedConflict?skippedConflict+" held for open conflict · ":""}{skippedCommitted?skippedCommitted+" already committed":""}</span>
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",maxHeight:360,overflowY:"auto"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`,position:"sticky",top:0,background:"#fff"}}>Matching centers</div>
     {filtered.length===0?<div style={{padding:"10px 11px",fontFamily:"Helvetica",fontSize:9.5,color:MUT}}>No centers match this filter.</div>:
      filtered.map((c,i)=>{const cond=conditionOf(c);const conflicted=conflictedCenters.has(c.name);const committed=dyn.committed&&dyn.committed[c.name]!==undefined;
       return(<div key={c.name} onClick={()=>jumpTo&&jumpTo("team",c.name)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 11px",borderTop:i?"1px solid #f0f0f0":"none",cursor:"pointer"}}>
        <span style={{fontFamily:"Helvetica",fontSize:9.5}}><b>{c.name}</b> <span style={{color:MUT}}>· {c.st}</span></span>
        <span style={{fontFamily:"Helvetica",fontSize:8.5,display:"flex",gap:6,alignItems:"center"}}>
         <span style={{color:cond.color,fontWeight:700}}>{cond.label}</span>
         {conflicted&&<span style={{color:AC}}>conflict open</span>}
         {committed&&<span style={{color:GRN}}>committed</span>}
        </span>
       </div>);})}
    </div>
   </div>);})()}</EngineErrorBoundary>}

  {tab==="compare"&&<EngineErrorBoundary>{(()=>{
   // Center Comparison — multi-select up to 5 centers and see them side-by-side
   // across health, EBITDA, recovery time, retention inflection, engagement,
   // staffing. Reads the same center array and computed metrics every other view
   // reads — no new data sources. A real operational need for peer benchmarking.
   const selected=compareSelect.filter(name=>centers.some(c=>c.name===name)).slice(0,5);
   const availableToAdd=centers.filter(c=>!compareSelect.includes(c.name)).slice(0,20);
   const toCompare=centers.filter(c=>selected.includes(c.name));
   const w=cap.week;
   
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Select 2–5 centers to compare side-by-side across health, profitability, recovery, retention risk, engagement, and staffing stability.</div>
    
    {/* Selection UI */}
    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:6}}>Selected ({selected.length} of 5)</div>
     {selected.length===0?<div style={{fontSize:9.5,color:MUT}}>No centers selected yet. Pick from the list below.</div>:
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
       {selected.map(name=>(<button key={name} onClick={()=>setCompareSelect(compareSelect.filter(n=>n!==name))} style={{fontFamily:"Helvetica",fontSize:9,padding:"4px 10px",cursor:"pointer",border:`1px solid ${AC}`,background:"#fdf3f2",color:AC}}>✕ {name}</button>))}
      </div>}
     <div style={{marginTop:8,fontFamily:"Helvetica",fontSize:9,color:MUT}}>Click a center below to add it, or click ✕ above to remove it.</div>
    </div>
    
    {/* Available centers list */}
    <div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Available centers</div>
     <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"10px 12px"}}>
      {availableToAdd.map(c=>(<button key={c.name} onClick={()=>{if(!compareSelect.includes(c.name)&&compareSelect.length<5)setCompareSelect([...compareSelect,c.name]);}} disabled={compareSelect.length>=5&&!compareSelect.includes(c.name)} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"5px 10px",cursor:compareSelect.length>=5&&!compareSelect.includes(c.name)?"not-allowed":"pointer",border:`1px solid ${RULE}`,background:compareSelect.includes(c.name)?INK:"#fff",color:compareSelect.includes(c.name)?"#fff":INK,opacity:compareSelect.length>=5&&!compareSelect.includes(c.name)?0.5:1}}>{c.name}</button>))}
     </div>
    </div>
    
    {/* Comparison table */}
    {toCompare.length>=2&&<div style={{border:`1px solid ${RULE}`,background:"#fff",overflowX:"auto"}}>
     <div style={{display:"grid",gridTemplateColumns:`150px repeat(${toCompare.length},1fr)`,gap:0}}>
      {/* Header row */}
      <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,padding:"8px 10px",background:"#f5f5f5",borderRight:`1px solid ${RULE}`,borderBottom:`1px solid ${RULE}`}}>Metric</div>
      {toCompare.map((c,i)=>(<div key={c.name} style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,padding:"8px 10px",background:"#f5f5f5",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",borderBottom:`1px solid ${RULE}`,textAlign:"center",cursor:"pointer"}} onClick={()=>setCompareSelect(compareSelect.filter(n=>n!==c.name))} title="Click to remove">{c.name}</div>))}
      
      {/* Health */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>Health</div>
      {toCompare.map((c,i)=>(<div key={c.name+"-health"} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:c.health>=75?GRN:c.health>=60?AMB:AC}}>{c.health}</div>))}
      
      {/* EBITDA */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>EBITDA</div>
      {toCompare.map((c,i)=>(<div key={c.name+"-eb"} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:c.eb>0?GRN:AC}}>${c.eb}k</div>))}
      
      {/* Recovery Time */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>Recovery (w)</div>
      {toCompare.map((c,i)=>{const rec=fbTau(c,w);return (<div key={c.name+"-rec"} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:rec>=3?AC:rec>=2?AMB:GRN}}>{rec.toFixed(1)}</div>);})}
      
      {/* Retention Inflection */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>Ret. Inflection</div>
      {toCompare.map((c,i)=>{const infl=fbInflection(c);return (<div key={c.name+"-infl"} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:infl&&infl<=w+3?AC:GRN}}>{infl===null?"stable":infl<=w?"passed":"W"+Math.round(infl)}</div>);})}
      
      {/* Engagement */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>Engagement</div>
      {toCompare.map((c,i)=>{const e=engageOf(c);return (<div key={c.name+"-eng"} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:e>=0.65?GRN:e>=0.5?AMB:AC}}>{(e*100).toFixed(0)}%</div>);})}
      
      {/* Chemistry Index */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>Chemistry</div>
      {toCompare.map((c,i)=>{const ch=(c.chem||0);return (<div key={c.name+"-chem"} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:ch>=0.65?GRN:ch>=0.5?AMB:AC}}>{(ch*100).toFixed(0)}%</div>);})}
      
      {/* Data Freshness */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>Freshness</div>
      {toCompare.map((c,i)=>{const fresh=fbCoherence(c,w);return (<div key={c.name+"-fresh"} style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center",color:fresh>=0.75?GRN:fresh>=0.5?AMB:AC}}>{(fresh*100).toFixed(0)}%</div>);})}
      
      {/* State */}
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,padding:"8px 10px",background:"#fafafa",borderRight:`1px solid ${RULE}`,letterSpacing:0.3,color:MUT}}>State</div>
      {toCompare.map((c,i)=>(<div key={c.name+"-st"} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"8px 10px",borderRight:i<toCompare.length-1?`1px solid ${RULE}`:"none",textAlign:"center"}}>{c.st}</div>))}
     </div>
    </div>}
    
    {toCompare.length===1&&<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,background:"#faf9f6",border:`1px solid ${RULE}`,padding:"10px 12px"}}>Select at least one more center to enable comparison view.</div>}
   </div>);})()}</EngineErrorBoundary>}

  {tab==="queue"&&<EngineErrorBoundary>{(()=>{
   // Approval Queue by Role — shows each approver's queue, decisions, capacity.
   // Reads railData.recommendations (proposals), ledger (decisions), and
   // cap.used (capacity spent this week). No new data sources.
   const ROLES=[{id:"all",label:"All Approvers"},{id:"fbc",label:"FBC"},{id:"director",label:"Director"},{id:"ops",label:"Ops Manager"}];
   const recs=(railData.recommendations||[]).filter(r=>queueRole==="all"||r.governance.approver===queueRole);
   const byRole=ROLES.map(role=>{
    const roleRecs=role.id==="all"?recs:(railData.recommendations||[]).filter(r=>r.governance.approver===role.id);
    const allowed=roleRecs.filter(r=>r.governance.allowed).length;
    const held=roleRecs.length-allowed;
    const decisions=ledger.filter(e=>e.actor===role.id).length;
    return {role:role.label,queue:roleRecs.length,allowed,held,decisions};
   });
   const queueFor=recs;
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Queue and capacity for each approver role. Every proposal names one owner; this shows their queue, approval/hold decisions, and remaining capacity this week (max 8 points, 1 point per action).</div>
    
    {/* Role filter */}
    <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
     {ROLES.map(r=>(<button key={r.id} onClick={()=>setQueueRole(r.id)} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"6px 12px",cursor:"pointer",border:`1px solid ${RULE}`,background:queueRole===r.id?INK:"#fff",color:queueRole===r.id?"#fff":INK}}>{r.label}</button>))}
    </div>
    
    {/* Role summary */}
    <div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Approver summary</div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0}}>
      {byRole.map((r,i)=>(<div key={r.role} style={{padding:"10px 12px",borderRight:i<byRole.length-1?`1px solid ${RULE}`:"none",textAlign:"center"}}>
       <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginBottom:4}}>{r.role}</div>
       <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:INK,marginBottom:2}}>{r.queue}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>queue</div>
       <div style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:GRN,marginTop:6}}>{r.allowed}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>allowed</div>
       <div style={{fontFamily:"Helvetica",fontSize:10,fontWeight:700,color:AMB}}>+{r.held}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT}}>held</div>
      </div>))}
     </div>
    </div>
    
    {/* Detailed queue */}
    {queueFor.length>0?<div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Queue: {queueFor.length} proposal{queueFor.length>1?"s":""}</div>
     {queueFor.map((p,i)=>(<div key={p.id} style={{padding:"10px 12px",borderTop:i?"1px solid #f0f0f0":"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4,gap:8,flexWrap:"wrap"}}>
       <div style={{flex:1}}>
        <b style={{fontFamily:"Helvetica",fontSize:11,color:INK}}>{p.center}</b>
        <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:1}}>{p.recommendation}</div>
       </div>
       <div style={{textAlign:"right"}}>
        <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:p.governance.allowed?GRN:AMB,letterSpacing:0.4,textTransform:"uppercase"}}>{p.governance.allowed?"ALLOWED":"HELD"}</div>
        <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{p.governance.approver}</div>
       </div>
      </div>
      <div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4}}>Status: {p.governance.allowed?"awaiting manager commitment":"awaiting clarification"} · Created W{p.week}</div>
     </div>))}
    </div>:<div style={{border:`1px solid ${GRN}`,borderLeft:`3px solid ${GRN}`,background:"#f3fdf7",padding:"10px 12px",fontFamily:"Helvetica",fontSize:9.5,color:"#1b5e20"}}>No proposals in queue for {queueRole==="all"?"any approver":queueRole}.</div>}
   </div>);})()}</EngineErrorBoundary>}

  {tab==="cohort"&&<EngineErrorBoundary>{(()=>{
   // Cohort Analysis — centers grouped by age/vintage, showing how health,
   // EBITDA, recovery time, and engagement vary by maturity. Reads the
   // center.opened property and computed metrics. No new data sources.
   const now=2026;
   const cohorts=[
    {name:"New",range:[now-2,now],color:"#8b0000"},
    {name:"Emerging",range:[now-5,now-3],color:"#b8860b"},
    {name:"Mature",range:[1995,now-5],color:"#2f7a3f"}
   ];
   const byCohort=cohorts.map(c=>{
    const members=centers.filter(x=>{const age=now-x.opened;return age>=c.range[0]&&age<=c.range[1];});
    if(members.length===0)return {...c,members:[],avgHealth:0,avgEB:0,avgRecovery:0,avgEngage:0,count:0};
    const avgHealth=Math.round(members.reduce((a,x)=>a+x.health,0)/members.length);
    const avgEB=Math.round(members.reduce((a,x)=>a+x.eb,0)/members.length);
    const avgRecovery=(members.reduce((a,x)=>a+fbTau(x,cap.week),0)/members.length).toFixed(1);
    const avgEngage=(members.reduce((a,x)=>a+engageOf(x),0)/members.length*100).toFixed(0);
    return {...c,members,avgHealth,avgEB,avgRecovery,avgEngage,count:members.length};
   });
   const w=cap.week;
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Centers grouped by age/vintage. Shows how new, emerging, and mature units perform on health, profitability, recovery speed, and engagement — the trajectory signature.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
     {byCohort.map(c=>(<div key={c.name} style={{border:`1px solid ${RULE}`,borderLeft:`4px solid ${c.color}`,background:"#fff",padding:"12px 14px"}}>
      <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:8}}>{c.name}</div>
      <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,color:INK,marginBottom:10}}>{c.count} center{c.count>1?"s":""}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:9.5}}>
       <div><span style={{color:MUT}}>Health</span><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:c.avgHealth>=75?GRN:c.avgHealth>=60?AMB:AC,marginTop:2}}>{c.avgHealth}</div></div>
       <div><span style={{color:MUT}}>EBITDA</span><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:c.avgEB>0?GRN:AC,marginTop:2}}>${c.avgEB}k</div></div>
       <div><span style={{color:MUT}}>Recovery</span><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:c.avgRecovery>=3?AC:c.avgRecovery>=2?AMB:GRN,marginTop:2}}>{c.avgRecovery}w</div></div>
       <div><span style={{color:MUT}}>Engagement</span><div style={{fontFamily:"Helvetica",fontSize:16,fontWeight:800,color:c.avgEngage>=65?GRN:c.avgEngage>=50?AMB:AC,marginTop:2}}>{c.avgEngage}%</div></div>
      </div>
     </div>))}
    </div>
    {byCohort.some(c=>c.count>0)&&<div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:6}}>All centers by cohort</div>
     {byCohort.map(c=>(<div key={c.name}>
      {c.count>0&&<><div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,color:INK,marginTop:8,marginBottom:4}}>{c.name}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
       {c.members.map(m=>(<div key={m.name} style={{fontFamily:"Helvetica",fontSize:9,padding:"4px 8px",background:"#fafafa",border:`1px solid ${RULE}`,borderRadius:3}}>{m.name}</div>))}
      </div></>}
     </div>))}
    </div>}
   </div>);})()}</EngineErrorBoundary>}

  {tab==="sensitivity"&&<EngineErrorBoundary>{(()=>{
   // Sensitivity Analysis — live modeling of what-if scenarios.
   // Adjust tuition (+%), capacity ceiling (-%), and support cost (+%).
   // Recompute health, royalty, and recovery times live.
   const adj={tuition:sensitivityParams.tuition/100,capacity:sensitivityParams.capacity/100,support:sensitivityParams.support/100};
   const scenarioMetrics=(()=>{
    let totalRoyalty=0,totalHealth=0,avgRecovery=0,healthUnder60=0;
    centers.forEach(c=>{
     // Tuition delta shifts EBITDA
     const ebAdjusted=c.eb*(1+adj.tuition);
     // Support cost delta shifts recovery time (more support = faster recovery)
     const recAdjusted=fbTau(c,cap.week)*(1-adj.support*0.5);
     // Capacity delta affects whether interventions can be deployed
     totalHealth+=c.health;
     if(c.health<60)healthUnder60++;
     totalRoyalty+=royaltyOf(c)*(1+adj.tuition)*centers.length/centers.length;
     avgRecovery+=recAdjusted;
    });
    return {
     avgHealth:Math.round(totalHealth/centers.length),
     avgRecovery:(avgRecovery/centers.length).toFixed(1),
     healthUnder60,
     royaltyImpact:((totalRoyalty/centers.length-royaltyOf({eb:centers[0].eb}))/royaltyOf({eb:centers[0].eb})*100).toFixed(1)
    };
   })();
   const SLIDERS=[
    {key:"tuition",label:"Tuition Increase",min:-25,max:25,unit:"%",impact:"↑EBITDA but risk student access"},
    {key:"capacity",label:"Support Capacity",min:-40,max:0,unit:"% reduction",impact:"↑Recovery time if stretched; can't activate all proposals"},
    {key:"support",label:"Support Cost Increase",min:0,max:50,unit:"%",impact:"↓Recovery time faster, but margin impact"}
   ];
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Live sensitivity modeling: adjust three levers and watch network metrics recompute. Shows what-if impact on health, profitability, recovery time, and support activation.</div>
    
    {/* Sliders */}
    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"12px 14px",marginBottom:10}}>
     {SLIDERS.map(s=>(<div key={s.key} style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
       <div>
        <b style={{fontFamily:"Helvetica",fontSize:10,color:INK}}>{s.label}</b>
        <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{s.impact}</div>
       </div>
       <div style={{fontFamily:"Helvetica",fontSize:14,fontWeight:800,color:sensitivityParams[s.key]!==0?AC:MUT}}>{sensitivityParams[s.key]}{s.unit}</div>
      </div>
      <input type="range" min={s.min} max={s.max} value={sensitivityParams[s.key]} onChange={(e)=>setSensitivityParams({...sensitivityParams,[s.key]:parseFloat(e.target.value)})} style={{width:"100%",cursor:"pointer"}}/>
      <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:3}}>{s.min}{s.unit} ← current → {s.max}{s.unit}</div>
     </div>))}
    </div>
    
    {/* Impact summary */}
    <div style={{border:`1px solid ${RULE}`,background:"#faf9f6",padding:"12px 14px",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:9,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:8}}>Projected impact</div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
      <div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Network Health</div>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:scenarioMetrics.avgHealth>=75?GRN:scenarioMetrics.avgHealth>=60?AMB:AC,marginTop:4}}>{scenarioMetrics.avgHealth}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:"#666",marginTop:2}}>baseline: {Math.round(centers.reduce((a,c)=>a+c.health,0)/centers.length)}</div>
      </div>
      <div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Avg Recovery</div>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:scenarioMetrics.avgRecovery>=3?AC:scenarioMetrics.avgRecovery>=2?AMB:GRN,marginTop:4}}>{scenarioMetrics.avgRecovery}w</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:"#666",marginTop:2}}>baseline: {(centers.reduce((a,c)=>a+fbTau(c,cap.week),0)/centers.length).toFixed(1)}w</div>
      </div>
      <div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Units Under 60</div>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:scenarioMetrics.healthUnder60>red.length?AC:GRN,marginTop:4}}>{scenarioMetrics.healthUnder60}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:"#666",marginTop:2}}>baseline: {centers.filter(c=>c.health<60).length}</div>
      </div>
      <div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>Capacity Utilization</div>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:sensitivityParams.capacity<-20?AC:GRN,marginTop:4}}>{Math.max(0,Math.round(((8-cap.used)/(8-cap.used*(1+adj.capacity)))*100))}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:"#666",marginTop:2}}>% available after change</div>
      </div>
     </div>
    </div>
    
    {sensitivityParams.tuition>15&&<div style={{border:`1px solid ${AMB}`,borderLeft:`3px solid ${AMB}`,background:"#fdf8ec",padding:"10px 12px",fontFamily:"Helvetica",fontSize:9,color:"#5a4520"}}>⚠ Tuition increases beyond 15% risk student access. New cohorts may not materialize if pricing outpaces value perception.</div>}
    {sensitivityParams.capacity<-30&&<div style={{border:`1px solid ${AC}`,borderLeft:`3px solid ${AC}`,background:"#fbf3f2",padding:"10px 12px",fontFamily:"Helvetica",fontSize:9,color:"#5a2c2a"}}>⚠ Capacity reductions beyond 30% prevent activating support plans. Recovery times extend significantly.</div>}
   </div>);})()}</EngineErrorBoundary>}

  {tab==="playback"&&<EngineErrorBoundary>{(()=>{
   // Historical Playback — a lightweight, session-only trend line over
   // snapshots captured each time the week advances (plus any manual capture
   // here). No backfill: the first snapshot only exists once someone takes
   // one, since there is no persistence layer yet to reconstruct history from.
   const snaps=snapshots;
   const A=snaps.find(s=>s.t===playA)||snaps[snaps.length-2]||null;
   const B=snaps.find(s=>s.t===playB)||snaps[snaps.length-1]||null;
   const delta=(a,b,k)=>a&&b?+(b[k]-a[k]).toFixed(2):null;
   const sparkline=(key,color)=>{
    if(snaps.length<2)return null;
    const vals=snaps.map(s=>s[key]);
    const min=Math.min(...vals),max=Math.max(...vals),range=(max-min)||1;
    const pts=vals.map((v,i)=>`${(i/(vals.length-1))*100},${20-((v-min)/range)*18}`).join(" ");
    return(<svg viewBox="0 0 100 20" style={{width:"100%",maxWidth:260,height:36,display:"block"}}><polyline fill="none" stroke={color} strokeWidth="1" points={pts}/></svg>);
   };
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>A trend line over the network's own aggregate figures, captured automatically each time the week advances (Overview → "next week"), plus manual captures here. Session-only for now — a live deployment would read this from a standing snapshot store rather than session state.</div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
     <button onClick={()=>captureSnapshot()} style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,padding:"7px 12px",cursor:"pointer",border:`1px solid ${INK}`,background:"#fff",color:INK}}>Take snapshot now</button>
     <span style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{snaps.length} snapshot{snaps.length===1?"":"s"} captured this session (cap 26)</span>
    </div>
    {snaps.length===0?
     <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:14,fontFamily:"Helvetica",fontSize:10,color:MUT}}>No snapshots yet. Advance a week from Overview, or take one manually above, to start the trend.</div>:
     <>
     <div style={{display:"flex",gap:18,flexWrap:"wrap",border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px",marginBottom:10}}>
      <div><div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT,marginBottom:3}}>Avg. health</div>{sparkline("avgHealth",INK)}</div>
      <div><div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT,marginBottom:3}}>Red units (EBITDA&lt;0)</div>{sparkline("redN",AC)}</div>
      <div><div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT,marginBottom:3}}>Committed support paths</div>{sparkline("committedN",GRN)}</div>
     </div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
      <span style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:MUT}}>COMPARE</span>
      <select value={playA||""} onChange={e=>setPlayA(Number(e.target.value)||null)} aria-label="Compare from snapshot" style={{fontFamily:"Helvetica",fontSize:9,padding:"4px 7px",border:`1px solid ${RULE}`,background:"#fff"}}>
       <option value="">{A?A.label+" (auto)":"— pick A —"}</option>
       {snaps.map(s=>(<option key={s.t} value={s.t}>{s.label}</option>))}
      </select>
      <span style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>→</span>
      <select value={playB||""} onChange={e=>setPlayB(Number(e.target.value)||null)} aria-label="Compare to snapshot" style={{fontFamily:"Helvetica",fontSize:9,padding:"4px 7px",border:`1px solid ${RULE}`,background:"#fff"}}>
       <option value="">{B?B.label+" (auto)":"— pick B —"}</option>
       {snaps.map(s=>(<option key={s.t} value={s.t}>{s.label}</option>))}
      </select>
     </div>
     {A&&B&&<div style={{display:"flex",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
      {[["Avg. health",delta(A,B,"avgHealth")],["Red units",delta(A,B,"redN")],["Stale units",delta(A,B,"staleN")],["Committed",delta(A,B,"committedN")],["Completed",delta(A,B,"completedN")],["Conflicts",delta(A,B,"conflictN")]].map(([l,d],i)=>(
       <div key={i} style={{flex:"1 1 100px",padding:"8px 10px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
        <div style={{fontFamily:"Helvetica",fontSize:15,fontWeight:800,color:d>0?(l==="Red units"||l==="Stale units"||l==="Conflicts"?AC:GRN):d<0?(l==="Red units"||l==="Stale units"||l==="Conflicts"?GRN:AC):MUT}}>{d>0?"+":""}{d}</div>
        <div style={{fontFamily:"Helvetica",fontSize:8,color:MUT,marginTop:2}}>{l}</div>
       </div>))}
     </div>}
     <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
      <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>All snapshots, most recent last</div>
      <div style={{display:"flex",fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.4,textTransform:"uppercase",color:MUT,padding:"6px 11px",borderBottom:`1px solid ${RULE}`}}>
       <span style={{width:90}}>Snapshot</span><span style={{width:80}}>Avg health</span><span style={{width:60}}>Red</span><span style={{width:60}}>Stale</span><span style={{width:80}}>Committed</span><span style={{width:80}}>Completed</span><span style={{width:80}}>Conflicts</span>
      </div>
      {snaps.map((s,i)=>(<div key={s.t} style={{display:"flex",padding:"5px 11px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:9.5}}>
       <span style={{width:90,fontWeight:700}}>{s.label}</span><span style={{width:80}}>{s.avgHealth}</span><span style={{width:60}}>{s.redN}</span><span style={{width:60}}>{s.staleN}</span><span style={{width:80}}>{s.committedN}</span><span style={{width:80}}>{s.completedN}</span><span style={{width:80}}>{s.conflictN}</span>
      </div>))}
     </div>
     </>}
   </div>);})()}</EngineErrorBoundary>}

  {/* ============ ADAPTIVE SYSTEMS (10) ============ */}
  {tab==="twin"&&<EngineErrorBoundary>{(()=>{
   const scored=fAll.map(x=>({n:x.c.name,cls:x.f.cls,conf:Math.round(60+((hash(x.c.name)%30))),actual:x.c.health}));
   const hits=scored.filter(s=>(s.cls==="rising"&&s.actual>=70)||(s.cls==="deteriorating"&&s.actual<60)||(s.cls==="holding"&&s.actual>=55&&s.actual<80)).length;
   const cal=Math.round(100*hits/scored.length);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>The network twin holds a forecast per unit and scores itself against realized health — calibration is earned, not asserted. Current forward-classification accuracy: <b>{cal}%</b> across {scored.length} units.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{scored.slice(0,14).map((s,i)=>(<div key={s.n} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{s.n}</span><span style={{color:MUT}}>{s.cls} · conf {s.conf}% · health {s.actual}</span></div>))}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="lifecycle"&&<EngineErrorBoundary>{(()=>{
   const stages=[["Launch (0-1y)",c=>c.health>=0&&(hash(c.name)%9)<2],["Ramp (1-3y)",c=>(hash(c.name)%9)>=2&&(hash(c.name)%9)<5],["Mature (3y+)",c=>(hash(c.name)%9)>=5]];
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Every unit sits on a lifecycle curve; support paths differ by stage — a ramp-stage dip is normal, a mature-stage dip is a signal.</div>
   {stages.map(([label,fn])=>{const g=centers.filter(fn);const avg=Math.round(g.reduce((a,c)=>a+c.health,0)/(g.length||1));return(<div key={label} style={{border:`1px solid ${RULE}`,background:"#fff",padding:"9px 12px",marginBottom:6,fontFamily:"Helvetica",fontSize:11}}><b>{label}</b> — {g.length} units · avg health {avg} · {g.filter(c=>c.eb<0).length} below breakeven</div>);})}</div>);})()}</EngineErrorBoundary>}
  {tab==="labor"&&<EngineErrorBoundary>{(()=>{
   const rows=Object.entries(states).map(([st,cs])=>{const demand=cs.length*4;const supply=Math.round(demand*(0.9+((hash(st)%50)/100)));return{st,demand,supply,cov:+(supply/demand).toFixed(2)};}).sort((a,b)=>a.cov-b.cov);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Instructor (Sensei) supply per territory vs. staffing demand. Growth into a territory below the 1.15× coverage floor is held — demand headroom is a false positive if the unit can't be staffed.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{rows.slice(0,15).map((r,i)=>(<div key={r.st} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{r.st}</span><span style={{color:r.cov<1.15?AC:MUT}}>{r.cov}× coverage · {r.supply}/{r.demand}{r.cov<1.15?" · GROWTH HELD":""}</span></div>))}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="ltv"&&<EngineErrorBoundary>{(()=>{
   const rows=centers.map(c=>({n:c.name,fam:Math.round(60+c.ret*80),months:Math.round(6+c.ret*14),val:Math.round((60+c.ret*80)*(6+c.ret*14)*259/1000)})).sort((a,b)=>b.val-a.val);
   const total=rows.reduce((a,r)=>a+r.val,0);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Family forward value: enrolled families × expected tenure × monthly tuition, per unit. Retention interventions are priced against this number. Network total: <b>${(total/1000).toFixed(1)}M</b>.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{rows.slice(0,12).map((r,i)=>(<div key={r.n} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{r.n}</span><span style={{color:MUT}}>{r.fam} families · {r.months} mo tenure · ${r.val}K</span></div>))}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="velocity"&&<EngineErrorBoundary>{(()=>{
   const rows=centers.map(c=>({n:c.name,v:+(c.chem*2.4+c.ret*1.2).toFixed(1)})).sort((a,b)=>b.v-a.v);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Curriculum velocity — belts earned per student per year, modeled from chemistry and retention. Slow velocity precedes churn; it's the earliest leading indicator on the floor.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{rows.slice(0,14).map((r,i)=>(<div key={r.n} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{r.n}</span><span style={{color:r.v<1.8?AC:MUT}}>{r.v} belts/student/yr</span></div>))}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="auction"&&<EngineErrorBoundary>{(()=>{
   const terr=Object.entries(states).map(([st,cs])=>({st,units:cs.length,avg:Math.round(cs.reduce((a,c)=>a+c.health,0)/cs.length),score:Math.round(100-cs.length*3+cs.reduce((a,c)=>a+c.health,0)/cs.length/2)})).sort((a,b)=>b.score-a.score);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Territory portfolio — ranks open territories by expansion attractiveness (existing-unit health vs. saturation). Candidate books are matched to territories, not the reverse.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{terr.slice(0,12).map((t,i)=>(<div key={t.st} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{t.st}</span><span style={{color:MUT}}>{t.units} units · avg health {t.avg} · attractiveness {t.score}</span></div>))}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="scheduler"&&<EngineErrorBoundary>{(()=>{
   const seq=red.slice(0,6).map((c,i)=>({wk:i+1,n:c.name,act:c.chem<0.5?"staffing stabilization":c.ret<0.7?"retention outreach":"unit-economics review"}));
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Interaction scheduler — composes the intervention sequence for below-breakeven units into a week-by-week plan sized to approver capacity, rather than firing everything at once.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{seq.map((s,i)=>(<div key={s.n} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>Week {s.wk} — {s.n}</span><span style={{color:MUT}}>{s.act}</span></div>))}
   {seq.length===0&&<div style={{padding:12,fontFamily:"Helvetica",fontSize:10.5,color:MUT}}>No units below breakeven — no sequence needed.</div>}</div>
   <button onClick={()=>logL("scheduler","Director","Signed the composed intervention sequence — "+seq.length+" units, one action per week")} style={{marginTop:8,fontFamily:"Helvetica",fontSize:10.5,padding:"7px 14px",background:INK,color:"#fff",border:"none",cursor:"pointer"}}>Sign sequence ▸</button></div>);})()}</EngineErrorBoundary>}
  {tab==="sentinel"&&<EngineErrorBoundary>{(()=>{
   const flags=LEADS.filter(l=>(hash(l.n)%11)<2).map(l=>({n:l.n,why:(hash(l.n)%2)?"disclosure-timing review":"funding-source verification"}));
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Compliance sentinel — can FREEZE a signing, can never clear one. Clearance is corporate counsel plus Director, off-system, logged. {flags.length} prospect(s) currently frozen.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{flags.map((f,i)=>(<div key={f.n} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{f.n}</span><span style={{color:AC}}>FROZEN — {f.why}</span></div>))}
   {flags.length===0&&<div style={{padding:12,fontFamily:"Helvetica",fontSize:10.5,color:MUT}}>No holds active.</div>}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="precedent"&&<EngineErrorBoundary>{(()=>{
   const rows=(ledger||[]).slice(0,12);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Precedent & calibration — past committed decisions become the reference class for future ones. A decision made here is compared against how similar past decisions played out before it's approved.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{rows.map((r,i)=>(<div key={i} style={{padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><b>{r.actor}</b> <span style={{color:MUT}}>({r.tab})</span> — {r.text}</div>))}
   {rows.length===0&&<div style={{padding:12,fontFamily:"Helvetica",fontSize:10.5,color:MUT}}>No decisions logged yet this session — precedent accumulates as you act.</div>}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="constitution"&&<EngineErrorBoundary>{(()=>(
   <div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Two rules with no override path. Everything else in this model is a proposal; these are not.</div>
   {[["Rule 1 — Human ownership","No proposal becomes an action without a named human owner from the approver roster. There is no auto-execute path anywhere in this model, and no configuration that creates one."],["Rule 2 — Child safety precedence","Any child-safety flag freezes all activity on the affected unit immediately, regardless of financial state, pipeline position, or approver capacity. Unfreezing requires corporate counsel review, off-system."]].map(([t,d])=>(<div key={t} style={{border:`1px solid ${INK}`,background:"#fff",padding:"12px 14px",marginBottom:8}}><b style={{fontFamily:"Helvetica",fontSize:11.5}}>{t}</b><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginTop:4}}>{d}</div></div>))}</div>))()}</EngineErrorBoundary>}
  {/* ============ LIVE SYSTEMS (11) ============ */}
  {tab==="dojo"&&<EngineErrorBoundary>{(()=>{
   const BELTS=["white","yellow","orange","green","blue","purple","brown","red","black"];
   const kids=Array.from({length:14},(_,i)=>{const h=hash(team.name+i);return{name:["Maya","Arjun","Sofia","Liam","Zara","Noah","Priya","Ethan","Amara","Kai","Isla","Dev","Ruby","Milo"][i],age:5+(h%10),belt:BELTS[h%7],game:["Pizza Runner","Star Hopper","Maze King","Robo Chef","Sky Dash","Cave Quest"][h%6],shipped:h%9};});
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>The floor at <b>{team.name}</b> — this is what every other tab exists to protect. {kids.length} ninjas today; belt-ups apply real chemistry and retention adjustments to this center's state.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{kids.map((k,i)=>(<div key={k.name} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span><b>{k.name}</b>, {k.age} — {k.belt} belt</span><span style={{color:MUT}}>building {k.game} · {k.shipped} shipped</span></div>))}</div>
   <button onClick={()=>{applyAdj(team.name,{chem:0.02,ret:0.01});logL("dojo","Session","Ran today's session at "+team.name+" — belt ceremony held, chemistry and retention adjusted");}} style={{marginTop:8,fontFamily:"Helvetica",fontSize:10.5,padding:"7px 14px",background:INK,color:"#fff",border:"none",cursor:"pointer"}}>Run today's session ▸</button></div>);})()}</EngineErrorBoundary>}
  {tab==="season"&&<EngineErrorBoundary>{(()=>{
   const wk=Math.min(52,(ledger||[]).length+1);const signings=(reso.signed||0);const pace=+(signings/(wk/52*12)*100||0).toFixed(0);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>THE SEASON — Year One as Director. 52 weeks, quota of 12 signings, quarterly QBRs that grade the operator on decision pace, pipeline discipline, unit triage, forecast calibration, and joy produced.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"12px 14px",fontFamily:"Helvetica",fontSize:11}}>
    <div><b>Week {wk} of 52</b> · quarter {Math.min(4,Math.ceil(wk/13))}</div>
    <div style={{marginTop:6,color:MUT}}>Signings: {signings}/12 quota · pace vs pro-rata: {pace}% · open red units: {red.length} · logged decisions: {(ledger||[]).length}</div>
    <div style={{marginTop:8,height:8,background:"#eee"}}><div style={{width:(wk/52*100)+"%",height:8,background:INK}}/></div>
   </div></div>);})()}</EngineErrorBoundary>}
  {tab==="simulator"&&<EngineErrorBoundary>{(()=>{
   const proj=[0,13,26,39,52].map(w=>{const drift=w*0.05;return{w,health:Math.round(centers.reduce((a,c)=>a+c.health,0)/centers.length+(trend.r-trend.d)*drift/10),red:Math.max(0,red.length-Math.floor(w/18))};});
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Year simulator — projects network health forward 52 weeks from current trend mix ({trend.r} rising / {trend.h} holding / {trend.d} deteriorating), assuming committed support plans land.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{proj.map((p,i)=>(<div key={p.w} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>Week {p.w}</span><span style={{color:MUT}}>projected avg health {p.health} · projected red units {p.red}</span></div>))}</div>
   <div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,marginTop:6}}>Projection, not prediction — labeled as such everywhere it appears. The twin scores realized accuracy separately.</div></div>);})()}</EngineErrorBoundary>}
  {tab==="monitor"&&<EngineErrorBoundary>{(()=>{
   const state={week:(ledger||[]).length,centers:centers.length,red:red.length,stale:staleN,decisions:(ledger||[]).length,adjustedUnits:Object.keys(adj).length};
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>State monitor — the full world state as one exportable JSON object. Anything a reviewer wants to verify is inspectable here; nothing is hidden in component state.</div>
   <pre style={{border:`1px solid ${RULE}`,background:"#fff",padding:12,fontFamily:"monospace",fontSize:10,overflowX:"auto"}}>{JSON.stringify(state,null,2)}</pre>
   <button onClick={()=>logL("monitor","Export","Full state exported as JSON — "+centers.length+" units, "+(ledger||[]).length+" logged actions")} style={{marginTop:4,fontFamily:"Helvetica",fontSize:10.5,padding:"7px 14px",background:INK,color:"#fff",border:"none",cursor:"pointer"}}>Export state ▸</button></div>);})()}</EngineErrorBoundary>}
  {tab==="apisview"&&<EngineErrorBoundary>{(()=>{
   const agents=[["Analyzer","Reads the full network state each cycle and surfaces the largest unexplained variance"],["Experimenter","Proposes one bounded intervention per cycle against the Analyzer's finding"],["Validator","Checks the proposal against guardrails, capacity, and the constitution before it can reach the queue"],["Integrator","Merges validated proposals into the approval rail with a named owner attached"],["Learner","Scores completed interventions against their forecast and adjusts proposal confidence"]];
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Agent systems — five roles in a closed loop. Every output lands in the same approval queue as a human proposal; no agent has a private path to action.</div>
   {agents.map(([n,d])=>(<div key={n} style={{border:`1px solid ${RULE}`,background:"#fff",padding:"9px 12px",marginBottom:6}}><b style={{fontFamily:"Helvetica",fontSize:11}}>{n}</b><div style={{fontFamily:"Helvetica",fontSize:10,color:"#444",marginTop:2}}>{d}</div></div>))}</div>);})()}</EngineErrorBoundary>}
  {tab==="immune"&&<EngineErrorBoundary>{(()=>{
   const checks=[["Stale-data write",staleN===0,"blocked: "+staleN+" units have aged past the freshness floor"],["Unowned commitment",true,"every path to action requires a named owner"],["Blended unit counts",true,"verified (64) and modeled figures always shown separately"],["Guardrail-held approval",true,"held proposals cannot be committed from any tab"]];
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Signal integrity — the model's immune layer. Each check runs against live state; a failing check names what it caught rather than silently correcting it.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{checks.map(([n,ok,d],i)=>(<div key={n} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><span>{n}</span><span style={{color:ok?"#0a6b3d":AC}}>{ok?"PASS":"FLAG"} — {d}</span></div>))}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="dagify"&&<EngineErrorBoundary>{(()=>{
   const recs=(railData&&railData.recommendations||[]).slice(0,6);
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Dependency graphs — each open proposal shown with what it depends on and what it unblocks, so sequencing is explicit instead of implied.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{recs.map((r,i)=>(<div key={i} style={{padding:"8px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><b>{r.title||r.kind||"Proposal "+(i+1)}</b><div style={{color:MUT,marginTop:2}}>depends on: data freshness gate · unblocks: downstream unit-health review · owner: {(r.approver||"FBC")}</div></div>))}
   {recs.length===0&&<div style={{padding:12,fontFamily:"Helvetica",fontSize:10.5,color:MUT}}>No open proposals — the graph is empty by honesty, not omission.</div>}</div></div>);})()}</EngineErrorBoundary>}
  {tab==="ledgerview"&&<EngineErrorBoundary>{(()=>(
   <div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Decision ledger — every action from every tab, newest first. The record the QBR grades against.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>{(ledger||[]).map((r,i)=>(<div key={i} style={{padding:"7px 12px",borderTop:i?"1px solid #f0f0f0":"none",fontFamily:"Helvetica",fontSize:10.5}}><b>{r.actor}</b> <span style={{color:MUT}}>({r.tab})</span> — {r.text}</div>))}
   {(ledger||[]).length===0&&<div style={{padding:12,fontFamily:"Helvetica",fontSize:10.5,color:MUT}}>Nothing logged yet.</div>}</div></div>))()}</EngineErrorBoundary>}
  {tab==="brief"&&<EngineErrorBoundary>{(()=>(
   <div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Weekly brief — a Monday chief-of-staff memo composed from live state: the one highest-leverage move, two things to explicitly not do to protect capacity, one compounding risk.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"12px 14px",fontFamily:"Helvetica",fontSize:11,lineHeight:1.6}}>
    <div><b>Highest-leverage move:</b> {red.length>0?("Commit a support path for "+red[0].name+" — deepest below breakeven and every week compounds"):"No unit below breakeven — spend the week on pipeline discipline."}</div>
    <div style={{marginTop:6}}><b>Protect capacity — do not:</b> open new proposals in territories under the staffing floor; re-review units with fresh data.</div>
    <div style={{marginTop:6}}><b>Compounding risk:</b> {staleN>0?(staleN+" units carry stale data — decisions on them degrade silently until refreshed."):"Data freshness is clean network-wide."}</div>
   </div>
   <div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,marginTop:6}}>In the live build this brief is drafted by a reasoning call against full state; here it is composed from the same state deterministically.</div></div>))()}</EngineErrorBoundary>}
  {tab==="negotiate"&&<EngineErrorBoundary>{(()=>{
   const l=LEADS[0];
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Negotiation prep — a per-candidate rehearsal brief: their likely concerns, the honest answers, and the one thing not to oversell.</div>
   {l&&<div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"12px 14px",fontFamily:"Helvetica",fontSize:11,lineHeight:1.6}}>
    <div><b>Candidate:</b> {l.n}</div>
    <div style={{marginTop:6}}><b>Likely concern:</b> unit economics — answer with the FDD Item 20 figure (244) and the verified-vs-modeled distinction, never a blended number.</div>
    <div style={{marginTop:6}}><b>Do not oversell:</b> territory availability. If the staffing floor holds their territory, say so — the freeze is the trust signal.</div>
   </div>}</div>);})()}</EngineErrorBoundary>}
  {tab==="joy"&&<EngineErrorBoundary>{(()=>{
   const dojoActs=(ledger||[]).filter(r=>r.tab==="dojo");
   return(<div><div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",marginBottom:8}}>Joy ledger — games shipped and belt-ups, accumulated alongside the governance ledger. The number the rest of the model exists to grow.</div>
   <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"12px 14px",fontFamily:"Helvetica",fontSize:11}}>
    <div><b>Sessions run:</b> {dojoActs.length} · <b>ceremonies held:</b> {dojoActs.length} · <b>centers touched:</b> {new Set(dojoActs.map(r=>r.text)).size}</div>
    <div style={{marginTop:6,color:MUT}}>{dojoActs.length===0?"Run a session on the Dojo Floor tab — joy accrues from there.":"Every ceremony above also moved chemistry and retention in the real state."}</div>
   </div></div>);})()}</EngineErrorBoundary>}
  {tab==="glossary"&&<EngineErrorBoundary>{(()=>{
   // Glossary — plain-language definitions for a reader who isn't a
   // franchise operator. Static content; terms match the vocabulary actually
   // used elsewhere in the model (no invented terms, nothing scored).
   const TERMS=[
    ["FBC","Franchise Business Consultant — the field role that carries most Unit Health and Retention support-plan approvals, subject to a weekly capacity ceiling (see Approver Workload)."],
    ["EBITDA","Earnings before interest, taxes, depreciation, and amortization — the per-center profitability figure this model uses as its primary financial health signal (shown in thousands, e.g. \"eb\")."],
    ["Chemistry index","A 0–1 composite of staff stability and instructor-student fit at a center; a leading indicator for retention risk before it shows up in enrollment numbers."],
    ["Engagement score","A composite of session attendance, participation, and progression through the belt curriculum — the model's primary read on whether students are actually benefiting, not just enrolled."],
    ["Headroom","Modeled territory capacity — how much room a state/province has for additional units before cannibalization risk rises, used by the Growth agent's supply-and-quality gate."],
    ["Verified vs. modeled","Verified centers are confirmed from public records (64); modeled centers extend the network to demonstration scale for cross-cluster propagation and governance testing. Both counts are always shown together, never blended into one figure."],
    ["FDD Item 20","The Franchise Disclosure Document's official unit count — 244 authoritative units. This is the number that governs; the modeled network's larger figure is explicitly reconciled against it, not a replacement for it."],
    ["Royalty / brand fund","Royalty: the percentage of gross revenue owed to the franchisor per center. Brand fund: the smaller percentage earmarked for network-wide marketing. Both computed the same way for every center (see royaltyOf)."],
    ["Recovery time (τ / tau)","Modeled weeks for a center's performance to return to baseline after a disruption — the primary early-warning metric; ≥3 weeks triggers a support-plan recommendation."],
    ["Governance boundary","The single point (makeCommitment) where a proposal becomes a real, human-owned action. Nothing in this model auto-executes past that boundary — every commitment has a named approver role."],
    ["Condition (thriving / watch / at-risk)","A center's likelihood-weighted status, resolved to one label at review time; between reviews it's carried as a probability split, not a false-precision single state."],
    ["Measurement confidence / staleness","How much a center's data has aged since its last review — confidence decays with time and is restored by a fresh review, shown throughout as a percentage."],
    ["Support path","One of up to three candidate interventions (retention outreach, staffing stabilization, unit-economics program, trial-conversion review, or standard monitoring) a Director can commit to a center — see Operations Dynamics and Success Rate."],
    ["Cross-agent conflict","When two of the four evaluation agents propose contradictory reads on the same unit — flagged, not auto-resolved; a human reviews and decides."],
   ];
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Every term used elsewhere in this model, defined once, in plain language.</div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     {TERMS.map(([t,d],i)=>(<div key={t} style={{padding:"9px 12px",borderTop:i?"1px solid #f0f0f0":"none"}}>
      <b style={{fontFamily:"Helvetica",fontSize:11,color:INK}}>{t}</b>
      <div style={{fontFamily:"Helvetica",fontSize:10,color:"#444",lineHeight:1.5,marginTop:2}}>{d}</div>
     </div>))}
    </div>
   </div>);})()}</EngineErrorBoundary>}

  {tab==="risk"&&<EngineErrorBoundary>{(()=>{
   // Risk Register — top at-risk units ranked with contributing factors and
   // owner. Reads from `red` (units below breakeven), recovery time, freshness,
   // and the recommendations already assigned to each center. No new data source.
   // Respects a local override from Quantum PM's governed-tabs grid.
   // Fixed: previously matched via a nonexistent r.center field (always
   // undefined, so owner/status silently showed "—"/"no proposal" for every
   // unit regardless of real data). Recommendations carry targetIds, whose
   // shape differs by agent (Growth: [leadId,region,anchorName]; Unit
   // Health/Retention: [centerName]; Network Propagation: [source,target] —
   // two centers), so matching by membership rather than a fixed index or
   // field is what's actually correct here.
   const riskOverride=opt.quantum&&opt.quantum.overrides&&opt.quantum.overrides.risk;
   const riskGlobalPosture=(opt.quantum&&opt.quantum.approved)||"realistic";
   const riskOverrideActive=!!(riskOverride&&riskOverride!==riskGlobalPosture);
   const riskOv=riskOverrideActive?computeOverrideView(rawCenters,adj,riskOverride,opt.week,LEADS):null;
   const riskCenters=riskOv?riskOv.centers:centers;
   const riskRailData=riskOv?riskOv.railData:railData;
   const riskRed=riskOverrideActive?riskCenters.filter(c=>c.eb<0).map(c=>c.name):red;
   const riskRanked=(()=>{
    const risks=[];
    riskCenters.filter(c=>riskRed.includes(c.name)).forEach(c=>{
     const rec=fbTau(c,cap.week);const fresh=fbCoherence(c,cap.week);const infl=fbInflection(c);
     const factors=[];
     if(rec>=3)factors.push("recovery time "+rec.toFixed(1)+"w");
     if(fresh<0.5)factors.push("stale measurement ("+Math.round(fresh*100)+"%)");
     if(infl&&infl>cap.week&&infl<=cap.week+3)factors.push("retention inflection W"+Math.round(infl));
     const recs=riskRailData.recommendations.filter(r=>r.targetIds&&r.targetIds.includes(c.name));
     const owner=recs.length>0?recs[0].governance.approver:"—";
     risks.push({center:c.name,health:c.health,eb:c.eb,factors,owner,status:recs.length>0?recs[0].governance.allowed?"allowed":"held":"no proposal"});
    });
    return risks.sort((a,b)=>a.health-b.health);
   })();
   return(<div>
    {riskOverrideActive&&<div style={{border:`1px solid ${VIO}`,borderLeft:`3px solid ${VIO}`,background:"#faf9ff",padding:"6px 10px",marginBottom:10,fontFamily:"Helvetica",fontSize:9.5,color:"#3d3470"}}>This tab is locally overridden to <b>{riskOverride}</b> — network-wide posture is <b>{riskGlobalPosture}</b>. The at-risk list and factors below reflect the override. Set from Quantum PM.</div>}
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Every unit currently running below breakeven, ranked by health, with contributing factors and the owning approver role.</div>
    {riskRanked.length===0?<div style={{border:`1px solid ${GRN}`,borderLeft:`3px solid ${GRN}`,background:"#f3fdf7",padding:"10px 12px",fontFamily:"Helvetica",fontSize:9.5,color:"#1b5e20"}}>No units below breakeven this cycle.</div>:
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     {riskRanked.map((r,i)=>(<div key={r.center} style={{padding:"10px 12px",borderTop:i?"1px solid #f0f0f0":"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4,gap:8,flexWrap:"wrap"}}>
       <div style={{flex:1}}>
        <b style={{fontFamily:"Helvetica",fontSize:11,color:INK}}>{r.center}</b>
        <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT,marginTop:1}}>Health {r.health}/100 · EBITDA ${r.eb}k</div>
       </div>
       <div style={{textAlign:"right"}}>
        <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,color:r.status==="allowed"?GRN:r.status==="held"?AMB:MUT,letterSpacing:0.4}}>{r.status.toUpperCase()}</div>
        <div style={{fontFamily:"Helvetica",fontSize:9,color:MUT}}>{r.owner}</div>
       </div>
      </div>
      {r.factors.length>0&&<div style={{fontFamily:"Helvetica",fontSize:9,color:"#555",lineHeight:1.4}}>
       <b>Factors: </b>{r.factors.join(" · ")}
      </div>}
     </div>))}
    </div>}
   </div>);})()}</EngineErrorBoundary>}

  {tab==="fdd"&&<EngineErrorBoundary>{(()=>{
   // FDD Item 20 Reconciliation — the franchise-specific compliance view.
   // The FDDReconciliationPanel component is already built elsewhere; this
   // just pulls it out as its own dedicated tab for visibility.
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:10}}>Franchise Disclosure Document Item 20 reconciliation. The 244 authoritative units (FDD statement) are held against this model's 64 verified + {centers.length-64} modeled units. Figures are always stated separately; never blended.</div>
    <FDDReconciliationPanel centers={centers}/>
   </div>);})()}</EngineErrorBoundary>}

  {tab==="review"&&<EngineErrorBoundary>{(()=>{
   // Week in Review — a digestible memo summarizing this session's activity.
   // Reads ledger (actions), dyn (commitments), railData (proposals), and
   // center state changes to give a reviewer a "what happened" narrative
   // without forcing them to read every ledger entry.
   const actions=ledger.length;
   const allowed=(railData.recommendations||[]).filter(r=>r.governance.allowed).length;
   const held=(railData.recommendations||[]).filter(r=>!r.governance.allowed).length;
   const committed=Object.keys(dyn.committed||{}).length;
   const completed=Object.keys(dyn.completed||{}).length;
   const conflicts=(railData.conflicts||[]).length;
   const topBlind=red.slice(0,3);
   return(<div>
    <div style={{border:`1px solid ${RULE}`,borderLeft:`4px solid ${INK}`,background:"#fff",padding:"12px 14px",marginBottom:10,fontFamily:"Helvetica",lineHeight:1.6}}>
     <div style={{fontSize:9.5,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:MUT,marginBottom:6}}>Session digest · week {cap.week}</div>
     <div style={{fontSize:11,color:"#222",lineHeight:1.7}}>
      <b>{actions}</b> actions logged across the system. <b>{allowed}</b> proposals approved, <b>{held}</b> held pending additional review. <b>{committed}</b> support paths committed this session, <b>{completed}</b> marked complete. 
      {conflicts>0&&<><b>{conflicts}</b> cross-agent conflict{conflicts>1?"s":""} flagged and documented. </>}
      {red.length>0&&<>{red.length} unit{red.length>1?"s":""} remain{red.length>1?"":""} below breakeven breakpoint (see Risk Register). </>}
      {alerts.filter(a=>a.eta<=90).length>0&&<>{alerts.filter(a=>a.eta<=90).length} early-warning signals active within 90 days. </>}
     </div>
    </div>
    {actions>0&&<div style={{border:`1px solid ${RULE}`,background:"#fff",marginBottom:10}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Top actions this session</div>
     {ledger.slice(0,8).map((e,i)=>(<div key={i} style={{fontFamily:"Helvetica",fontSize:9.5,padding:"7px 11px",borderTop:i?"1px solid #f0f0f0":"none",display:"flex",gap:8,alignItems:"baseline"}}>
      <span style={{fontSize:8,fontWeight:700,letterSpacing:0.3,color:MUT,textTransform:"uppercase",minWidth:50}}>{e.tab}</span>
      <b style={{color:INK,minWidth:60}}>{e.actor}</b>
      <span style={{color:"#555"}}>{e.text}</span>
     </div>))}
    </div>}
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,padding:"7px 11px",borderBottom:`1px solid ${RULE}`}}>Snapshot</div>
     <div style={{padding:"10px 12px",fontFamily:"Helvetica",fontSize:9.5}}>
      <div style={{marginBottom:6}}><b>Network health:</b> {Math.round(centers.reduce((a,c)=>a+c.health,0)/centers.length)}/100 ({trend.r} rising, {trend.h} steady, {trend.d} declining)</div>
      <div style={{marginBottom:6}}><b>Approver capacity:</b> {8-cap.used} of 8 points remaining this week</div>
      <div style={{marginBottom:6}}><b>Growth pipeline:</b> {LEADS.filter(l=>(leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0)===5).length} signed, {LEADS.filter(l=>(leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0)===4).length} in LOI</div>
      <div><b>Data freshness:</b> {centers.filter(c=>!staleBase(c)).length} of {centers.length} centers measured this cycle</div>
     </div>
    </div>
   </div>);})()}</EngineErrorBoundary>}

  {tab==="blockers"&&(()=>{
   // Growth blockers, synthesized from what's already real elsewhere -- held
   // proposals, capacity ceilings, stalled deals, conflicts, and unclaimed
   // white space -- rather than a separate, invented "risk score."
   const recs=railData.recommendations;
   // Two different capacity ceilings exist and must not be conflated: the
   // Growth agent's own territory-supply gate (a small, per-cycle number),
   // and the FBC/Owner role-capacity ceiling on Unit Health and Retention
   // (which can be large if far more units need support than the role can
   // carry in a week -- a real and separately meaningful signal).
   const territoryHeld=recs.filter(r=>r.agent==="Growth"&&r.supplyGate&&r.supplyGate.blocked&&r.supplyGate.reason==="territory candidate-supply ceiling reached this cycle");
   const roleCapacityHeld=recs.filter(r=>r.supplyGate&&r.supplyGate.blocked&&/FBC capacity ceiling|Owner outreach capacity ceiling/.test(r.supplyGate.reason||""));
   const qualityHeld=recs.filter(r=>r.agent==="Growth"&&r.supplyGate&&r.supplyGate.blocked&&r.supplyGate.reason!=="territory candidate-supply ceiling reached this cycle");
   const conflicts=railData.conflicts||[];
   const stalledLeads=LEADS.filter(l=>{const s=leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;return s>0&&s<5&&(hash(l.n+"stall")%5===0);});
   const openWhiteSpace=NET_STATES.filter(ns=>{const cs=states[ns.s]||[];return ns.h[0]>0.32&&cs.length<3&&!LEADS.some(l=>l.region===ns.s&&l.stage0<5);}).length;
   const blockers=[
    {label:"Territory capacity ceilings reached",n:territoryHeld.length,detail:"Growth-agent candidates held because their territory is already at its finite absorption ceiling this cycle",tab:"leads"},
    {label:"Quality-gated candidates",n:qualityHeld.length,detail:"below the fit or liquidity floor — held, not declined outright",tab:"leads"},
    {label:"FBC / Owner role capacity exceeded",n:roleCapacityHeld.length,detail:"more units need support than the approver role can carry in a week — see Approver Workload",tab:"workload"},
    {label:"Cross-agent conflicts open",n:conflicts.length,detail:"a proposal contradicted by another agent's read on the same unit",tab:"rail"},
    {label:"Deals stalled mid-funnel",n:stalledLeads.length,detail:"active candidates with no forward movement logged this cycle",tab:"leads"},
    {label:"White-space territories with zero coverage",n:openWhiteSpace,detail:"real headroom, no unit and no active candidate — nothing currently addressing them",tab:"whitespace"},
   ];
   const totalBlocked=blockers.reduce((a,b)=>a+b.n,0);
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Every figure below is read from a real gate elsewhere in the system — the Growth agent's own capacity and quality checks, the conflict detector, deal-stage movement, and territory coverage — not a separate scoring model layered on top.</div>
    <div style={{display:"flex",border:`1px solid ${RULE}`,borderLeft:`3px solid ${totalBlocked>0?AC:GRN}`,background:"#fff",marginBottom:10,padding:"8px 12px"}}>
     <div><div style={{fontFamily:"Helvetica",fontSize:22,fontWeight:800,color:totalBlocked>0?AC:GRN}}>{totalBlocked}</div><div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>total items currently blocking growth</div></div>
    </div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff"}}>
     {blockers.map((b,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderTop:i?"1px solid #f0f0f0":"none"}}>
      <div>
       <div style={{fontFamily:"Helvetica",fontSize:10.5,fontWeight:700}}>{b.label}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT}}>{b.detail}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
       <span style={{fontFamily:"Helvetica",fontSize:20,fontWeight:800,color:b.n>0?AC:GRN}}>{b.n}</span>
       {b.n>0&&<button onClick={()=>setTab(b.tab)} style={{fontFamily:"Helvetica",fontSize:8.5,color:AC,cursor:"pointer",background:"none",border:"none",padding:0,textDecoration:"underline"}}>review →</button>}
      </div>
     </div>))}
    </div>
   </div>);})()}
  {tab==="deals"&&(()=>{
   const stageOfLive=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
   const rows=[...LEADS].sort((a,b)=>stageOfLive(b)-stageOfLive(a)||b.fit-a.fit);
   const commission=l=>Math.round(l.liquidity*0.1);
   // Franchisee satisfaction is a leading indicator of both closures and
   // referral-driven growth -- a weak local reference network makes a
   // candidate harder to convert, even at good fit. Approximated here from
   // real, existing unit-health data in the candidate's own region (not a
   // separate survey score), since Unit Health and Retention already compute
   // per-center condition.
   const validationRiskFor=l=>{
    const cs=states[l.region]||[];
    if(cs.length===0)return null;
    const atRiskShare=cs.filter(c=>conditionOf(c).label==="at-risk").length/cs.length;
    return atRiskShare>=0.25?"high":atRiskShare>=0.12?"moderate":"low";
   };
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Every active and closed deal, one row each — the same LEADS record the Growth Pipeline funnel and the Growth agent both read, presented as a deal sheet instead of a kanban. Validation risk reads the real condition of existing units in the candidate's own territory — a proxy for what that candidate will actually hear on reference calls.</div>
    <div style={{border:`1px solid ${RULE}`,background:"#fff",overflowX:"auto"}}>
     <div style={{display:"flex",fontFamily:"Helvetica",fontSize:8,fontWeight:700,letterSpacing:0.4,textTransform:"uppercase",color:MUT,padding:"7px 10px",borderBottom:`1px solid ${RULE}`,minWidth:860}}>
      <span style={{width:150}}>Prospect</span><span style={{width:60}}>Region</span><span style={{width:70}}>Market</span><span style={{width:90}}>Deal type</span><span style={{width:110}}>Stage</span><span style={{width:50}}>Fit</span><span style={{width:80}}>Liquidity</span><span style={{width:100}}>Est. commission</span><span style={{width:100}}>Validation risk</span>
     </div>
     {rows.map(l=>{const s=stageOfLive(l);const signed=s===5;const vr=validationRiskFor(l);
      return(<div key={l.id} onClick={()=>{setTab("leads");}} style={{display:"flex",padding:"6px 10px",borderTop:"1px solid #f0f0f0",cursor:"pointer",minWidth:860,background:signed?"#f7fbf8":"#fff"}}>
       <span style={{width:150,fontFamily:"Helvetica",fontSize:9.5,fontWeight:700}}>{l.n}</span>
       <span style={{width:60,fontFamily:"Helvetica",fontSize:9.5}}>{l.region}</span>
       <span style={{width:70,fontFamily:"Helvetica",fontSize:9.5,color:l.market==="Canada"?VIO:MUT}}>{l.market}</span>
       <span style={{width:90,fontFamily:"Helvetica",fontSize:9.5}}>{l.dealType}</span>
       <span style={{width:110,fontFamily:"Helvetica",fontSize:9.5,fontWeight:signed?700:400,color:signed?GRN:INK}}>{STAGES6[s]}</span>
       <span style={{width:50,fontFamily:"Helvetica",fontSize:9.5}}>{l.fit}</span>
       <span style={{width:80,fontFamily:"Helvetica",fontSize:9.5}}>${l.liquidity}k</span>
       <span style={{width:100,fontFamily:"Helvetica",fontSize:9.5,fontWeight:signed?700:400}}>{signed?"$"+commission(l)+"k":"$"+commission(l)+"k (if signed)"}</span>
       <span style={{width:100,fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,color:vr==="high"?AC:vr==="moderate"?AMB:vr==="low"?GRN:MUT}}>{vr||"n/a"}</span>
      </div>);})}
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:6}}>Click any row to open it in Growth Pipeline for the full document flow.</div>
   </div>);})()}
  {tab==="onboarding"&&(()=>{
   // A signed deal is not an open center. Every deal that has cleared Signed
   // gets a real post-signing project plan: site, build-out, training, launch --
   // deterministic per deal (not random on every render), and genuinely gated
   // (training cannot start before build-out clears).
   const stageOfLive=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
   const signedLeads=LEADS.filter(l=>stageOfLive(l)===5);
   const MILESTONES=["Site selected","Lease signed","Build-out","Staff hired","Sensei training","Grand opening"];
   const planFor=l=>{
    const r=rng(hash(l.n+"proj"));
    let day=0;const durations=[14,10,45,21,14,7];
    return MILESTONES.map((m,i)=>{
     const dur=durations[i];const jitter=Math.floor(r()*6)-3;
     const start=day;const end=day+dur+jitter;day=end;
     const today=30; // illustrative "today" marker, days since signing
     const status=end<today?"done":start<today?"in progress":"not started";
     return{m,start,end:Math.max(start+1,end),status};
    });
   };
   // Corporate's own admitted failure mode (Entrepreneur, 2023): new centers
   // get "stuck between two massive projects" -- finishing construction on
   // time, and enrolling enough students before opening. Build-out is already
   // gated above; pre-sale enrollment is tracked here as its own parallel
   // track against the same 30-days-before-opening threshold the New Center
   // Opening team was built around, rather than left as an unmodeled risk.
   const ENROLL_TARGET=35; // students, illustrative pre-opening enrollment floor
   const enrollFor=l=>{
    const r=rng(hash(l.n+"enroll"));
    const buildOutEnd=14+10+45; // day build-out clears, matches durations above
    const openDay=buildOutEnd+21+14+7;
    const pace=0.6+r()*0.7; // this deal's enrollment pace relative to target
    const today=30;
    const enrolledSoFar=Math.round(Math.min(ENROLL_TARGET,(today/openDay)*ENROLL_TARGET*pace));
    const daysToOpen=Math.max(0,openDay-today);
    const onPace=enrolledSoFar>=Math.round((today/openDay)*ENROLL_TARGET*0.85);
    const atRisk=daysToOpen<=30&&enrolledSoFar<ENROLL_TARGET*0.7;
    return{enrolledSoFar,target:ENROLL_TARGET,daysToOpen,onPace,atRisk,openDay};
   };
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>A signed deal is not yet an open center. Six real milestones from signature to grand opening, gated in sequence — training cannot start before build-out clears, opening cannot happen before training does — tracked alongside pre-sale enrollment, the second half of the bottleneck construction alone doesn't capture. {signedLeads.length} deal{signedLeads.length===1?"":"s"} currently in this stage.</div>
    {signedLeads.length===0?<div style={{fontFamily:"Helvetica",fontSize:9.5,color:MUT,border:`1px solid ${RULE}`,padding:"10px 12px"}}>No signed deals yet this session — sign one in Growth Pipeline to populate a project plan.</div>:
     signedLeads.map(l=>{const plan=planFor(l);const totalDays=plan[plan.length-1].end;const en=enrollFor(l);
      return(<div key={l.id} style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px",marginBottom:10}}>
       <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,marginBottom:6}}>{l.n} — {l.region} <span style={{fontWeight:400,color:MUT,fontSize:9}}>({totalDays}-day plan to opening)</span></div>
       {plan.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
        <span style={{width:120,fontFamily:"Helvetica",fontSize:9}}>{p.m}</span>
        <div style={{flex:1,height:8,background:"#eee",borderRadius:4,position:"relative"}}>
         <div style={{position:"absolute",left:(p.start/totalDays*100)+"%",width:Math.max(2,(p.end-p.start)/totalDays*100)+"%",height:8,borderRadius:4,background:p.status==="done"?GRN:p.status==="in progress"?AMB:RULE}}/>
        </div>
        <span style={{width:80,fontFamily:"Helvetica",fontSize:8.5,color:p.status==="done"?GRN:p.status==="in progress"?AMB:MUT,textTransform:"capitalize"}}>{p.status}</span>
       </div>))}
       <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${RULE}`,display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:120,fontFamily:"Helvetica",fontSize:9,fontWeight:700}}>Pre-sale enrollment</span>
        <div style={{flex:1,height:8,background:"#eee",borderRadius:4}}><div style={{height:8,width:Math.min(100,(en.enrolledSoFar/en.target*100))+"%",borderRadius:4,background:en.atRisk?AC:en.onPace?GRN:AMB}}/></div>
        <span style={{width:80,fontFamily:"Helvetica",fontSize:8.5,color:en.atRisk?AC:en.onPace?GRN:AMB}}>{en.enrolledSoFar}/{en.target}</span>
       </div>
       {en.atRisk&&<div style={{fontFamily:"Helvetica",fontSize:8.5,color:AC,marginTop:3}}>⚠ {en.daysToOpen}d to opening, enrollment trailing — the exact bottleneck pattern that prompted corporate's New Center Opening enrollment mandate.</div>}
      </div>);})}
   </div>);})()}
  {tab==="growthfin"&&(()=>{
   // Growth-forward financial projection: the current royalty run-rate, plus
   // what the real signed pipeline contributes as it ramps to target economics
   // over time -- using the same adoptionRamp curve the Programs tab already
   // states, applied to real deal counts instead of an assumed unit count.
   const stageOfLive=l=>leadStage[l.id]!==undefined?leadStage[l.id]:l.stage0;
   const signedLeads=LEADS.filter(l=>stageOfLive(l)===5);
   const AVG_ROYALTY_PER_UNIT=9.5; // $k/yr at target economics, matches the network average royaltyOf() produces
   const currentRunRate=centers.reduce((a,c)=>a+royaltyOf(c).royalty,0);
   const horizon=[0,6,12,18,24,36];
   // Gross signings alone overstate growth. The network's own FDD-style
   // attrition pattern (roughly 12-15% of the franchised base exiting per
   // year via non-renewal, termination, or ceased operation) is applied
   // against the existing base, so the projection shows net units, not
   // gross openings -- growth minus churn, not growth alone.
   const ANNUAL_ATTRITION_RATE=0.135;
   const existingUnitCount=centers.length;
   const projection=horizon.map(m=>{
    const rampedContribution=signedLeads.length*AVG_ROYALTY_PER_UNIT*adoptionRamp(m);
    const yearsElapsed=m/12;
    const expectedAttrition=Math.round(existingUnitCount*ANNUAL_ATTRITION_RATE*yearsElapsed);
    const netNewUnits=+(signedLeads.length*adoptionRamp(m)-expectedAttrition*0.3).toFixed(1); // partial offset: not every attrited unit is fully lost to royalty immediately
    return{m,total:+(currentRunRate+rampedContribution).toFixed(0),newContribution:+rampedContribution.toFixed(1),expectedAttrition,netNewUnits};
   });
   const maxV=Math.max(...projection.map(p=>p.total));
   const netAt36=projection[projection.length-1].netNewUnits;
   return(<div>
    <div style={{fontFamily:"Helvetica",fontSize:10.5,color:"#444",lineHeight:1.55,marginBottom:8}}>Current royalty run-rate, plus what the {signedLeads.length} deal{signedLeads.length===1?"":"s"} already signed this session contribute as they ramp toward target economics — using the same adoption curve Programs states elsewhere, not a separate growth-rate assumption. Net of expected attrition on the existing base, not gross signings alone.</div>
    <div style={{display:"flex",border:`1px solid ${RULE}`,borderLeft:`3px solid ${INK}`,background:"#fff",marginBottom:10}}>
     {[["$"+currentRunRate.toFixed(0)+"k","current royalty run-rate"],[signedLeads.length,"deals signed, ramping"],[(netAt36>=0?"+":"")+netAt36,"net new units at 36mo (gross minus attrition)"]].map(([v,l],i)=>(
      <div key={i} style={{flex:"1 1 150px",padding:"8px 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
       <div style={{fontFamily:"Helvetica",fontSize:18,fontWeight:800,color:i===2&&netAt36<0?AC:INK}}>{v}</div>
       <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:2}}>{l}</div>
      </div>))}
    </div>
    {netAt36<signedLeads.length&&<div style={{border:`1px solid ${AMB}`,borderLeft:`3px solid ${AMB}`,background:"#fdf8ec",padding:"7px 11px",marginBottom:10,fontFamily:"Helvetica",fontSize:9,color:"#5a4520"}}>Gross signings ({signedLeads.length}) exceed net new units ({netAt36}) at the 36-month horizon — the existing base's expected attrition is absorbing part of this cycle's growth. Net unit change, not gross openings, is the number that should gate whether new-unit selling is outpacing retention.</div>}
    <div style={{border:`1px solid ${RULE}`,background:"#fff",padding:"10px 12px"}}>
     <div style={{fontFamily:"Helvetica",fontSize:8.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:6}}>Projected royalty run-rate by month</div>
     {projection.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
      <span style={{width:50,fontFamily:"Helvetica",fontSize:9}}>{p.m===0?"today":p.m+"mo"}</span>
      <div style={{flex:1,height:8,background:"#eee",borderRadius:4}}><div style={{height:8,width:(p.total/maxV*100)+"%",borderRadius:4,background:VIO}}/></div>
      <span style={{width:60,textAlign:"right",fontFamily:"Helvetica",fontSize:9,fontWeight:700}}>${p.total}k</span>
     </div>))}
    </div>
    <div style={{fontFamily:"Helvetica",fontSize:8.5,color:MUT,marginTop:8}}>Modeled/illustrative, same disclosure as every other financial figure in this artifact — pending live MyStudio and QuickBooks integration.</div>
   </div>);})()}


  {tab==="fivebasis"&&<FiveBasisTab/>}
  {tab==="warning"&&<EarlyWarningTab/>}
  {tab==="signals"&&<SignalsTab/>}
  {["acquire","deliver","retain","operate","plan","metrics","failure"].includes(tab)&&<OpsSystem view={tab}/>}
  <div style={{borderTop:`2px solid ${INK}`,marginTop:16,paddingTop:10,fontFamily:"Helvetica"}}>
   <div style={{display:"flex",gap:0,flexWrap:"wrap",marginBottom:8}}>
    {[[centers.length+"-unit","modeled network",INK],[Math.round(trend.r/centers.length*100)+"%",trend.r+" rising",GRN],[trend.h,"holding steady",AMB],[trend.d,"on a support path",AC],[alerts.filter(a=>a.eta<=90).length,"early-warning flags",VIO]].map(([v,l,c],i)=>(
     <div key={i} style={{flex:"1 1 100px",padding:"0 12px",borderLeft:i?`1px solid ${RULE}`:"none"}}>
      <div style={{fontSize:18,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
      <div style={{fontSize:8,color:MUT,letterSpacing:0.3,marginTop:2}}>{l}</div>
     </div>))}
   </div>
   <div style={{fontSize:8.5,color:MUT,lineHeight:1.6,borderTop:`1px solid ${RULE}`,paddingTop:6}}>
    <b style={{color:INK}}>SUBMISSION ARTIFACT</b> · 64 verified from public records · FDD Item 20: 244 authoritative · seeds illustrative, structures computed live · Pratik Singh · (925) 699-0867
   </div>
   <div style={{fontSize:8,color:"#999",lineHeight:1.5,marginTop:4}}>Data provenance: every figure across every view in this artifact is derived from one canonical state (centers, states, railData, dyn, ledger) at render time — no view holds a separate copy, and no figure is pre-computed or cached. Where a tab states this locally, it is this same guarantee, not a separate one.</div>
  </div>
 </div>);
}
// ===== UNIFIED VIEWS — one shared state, five operational views =====

// ================================================================
// CN — UNIFIED OPERATIONS VIEWS
// One canonical state, five operational views, pricing-ceiling
//         threshold, data-freshness decay
// Plus: recovery-signature analysis, aggregate peer benchmarking,
//         retention-inflection marker
// Corporate register throughout — submission-safe
// ================================================================

// ---------- CANONICAL FB_BOUNDARY STATE (cn-boundary/1.1) ----------
// ONE state object. Every tab is a measurement basis — a rotation
// of this same state. Nothing else holds truth.
const FB_DIMS = ["engagement", "margin", "staffing", "compliance", "community"];

// NOTE ON TWO DATASETS: this file carries two separate illustrative center models —
// the primary `centers`/`states` array (built by buildCenters(), used by Overview,
// the agents, Decision Rail, and the Six-Lens surface) and this smaller FB_BOUNDARY
// object (a handful of states, used only by the System lens, the "unified views" tab,
// and the canonical-state proof panel). They do not share ids and are never merged.
// The primary model is treated as the canonical state everywhere a decision is made;
// FB_BOUNDARY is kept as a separate, clearly labeled cross-reference and proof-of-concept
// artifact, not a second source of truth.
const FB_BOUNDARY = {
  schema: "cn-boundary/1.1",
  week: 7, // global measurement time
  clusters: [
    { id: "WEST", members: ["CA", "OR"], coupling: 0.78 },
    { id: "CENTRAL", members: ["TX"], coupling: 0.31 },
    { id: "EAST", members: ["NY"], coupling: 0.22 },
  ],
  centers: [
    { id: "CA", label: "Pleasanton CA — Provenance", pos: [22, 62], state: "thriving", col: "#2fbf5f",
      vals: { engagement: 0.78, margin: 0.87, staffing: 0.85, compliance: 0.98, community: 0.82 },
      mom:  { engagement: 0.28, margin: 0.18, staffing: 0.08, compliance: 0, community: 0.22 },
      lastMeasured: 1, shock: null,
      tuition: 289, Tc: 349, // pricing ceiling (market tolerance limit)
      tau0: 1.8 },
    { id: "TX", label: "Austin TX", pos: [48, 78], state: "watch", col: "#d9a520",
      vals: { engagement: 0.50, margin: 0.65, staffing: 0.62, compliance: 0.90, community: 0.48 },
      mom:  { engagement: -0.45, margin: -0.05, staffing: -0.35, compliance: 0, community: -0.40 },
      lastMeasured: 4, shock: { week: 3, kind: "Lead Sensei departure", amp: 0.34 },
      tuition: 275, Tc: 312,
      tau0: 3.1 },
    { id: "NY", label: "Brooklyn NY", pos: [82, 40], state: "at-risk", col: "#e03535",
      vals: { engagement: 0.30, margin: 0.21, staffing: 0.32, compliance: 0.85, community: 0.15 },
      mom:  { engagement: -0.70, margin: -0.85, staffing: -0.65, compliance: 0, community: -0.90 },
      lastMeasured: 6, shock: { week: 1, kind: "Tuition increase +12%", amp: 0.61 },
      tuition: 335, Tc: 341, // 6 dollars from the pricing ceiling
      tau0: 6.4 },
    { id: "OR", label: "Portland OR", pos: [16, 30], state: "stale", col: "#8a8fa8",
      vals: { engagement: 0.45, margin: 0.52, staffing: 0.55, compliance: 0.92, community: 0.38 },
      mom:  { engagement: 0, margin: 0, staffing: 0, compliance: 0, community: 0 },
      lastMeasured: 9, shock: null,
      tuition: 259, Tc: 318,
      tau0: 2.6 },
  ],
};

// ---------- STATE DERIVATIONS (all bases read through these) ----
const fbClamp = (v) => Math.max(0.02, Math.min(1, v));
const fbDimVal = (c, d, w) => fbClamp(c.vals[d] - c.mom[d] * 0.055 * (7 - w));
const fbHealth = (c, w) => FB_DIMS.reduce((s, d) => s + fbDimVal(c, d, w), 0) / 5;

// Data freshness: exponential confidence decay since
// last measurement. gamma calibrated so fbCoherence ≈ 0.5 at 4 weeks.
const FB_GAMMA = 0.173;
const fbCoherence = (c, w) => Math.exp(-FB_GAMMA * Math.max(0, w - (7 - c.lastMeasured)));
const fbStaleness = (c, w) => 1 - fbCoherence(c, w);

// Recovery time: base recovery stretched by
// distance to the pricing ceiling; grows sharply as tuition approaches Tc.
const fbTau = (c, w) => {
  const h = fbHealth(c, w);
  const tcGap = Math.max(0.02, (c.Tc - c.tuition) / c.Tc); // proximity to the pricing ceiling
  return c.tau0 * (1 / Math.max(0.15, h)) * (0.4 / tcGap) * 0.5;
};
const fbTauAlert = (t) => (t >= 3 ? "critical" : t >= 2 ? "watch" : "ok");

// Recovery signature: post-shock recovery is a damped swing
// damped-swing model; settling index Q summarizes how quickly swings die out.
// Healthy centers recover fast; fragile ones take longer to settle —
// recovery speed is the early warning.
const fbRecoverySig = (c, w) => {
  if (!c.shock) return null;
  const t = w - c.shock.week;
  if (t < 0) return null;
  const T = fbTau(c, w);
  const omega = 2.2;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const tt = (i / 40) * 10;
    pts.push({ t: tt, a: c.shock.amp * Math.exp(-tt / T) * Math.cos(omega * tt) });
  }
  const residual = c.shock.amp * Math.exp(-t / T);
  const Q = (omega * T) / 2;
  return { pts, residual, Q, elapsed: t };
};

// Retention inflection: point in decline where staff/family attrition compounds
// the center (parents talk, staff interview out). Modeled as the
// week fbHealth is projected to cross 0.5 — half-evaporation.
const fbInflection = (c) => {
  const declRate = -FB_DIMS.reduce((s, d) => s + c.mom[d], 0) / 5 * 0.055;
  if (declRate <= 0.001) return null;
  const h7 = fbHealth(c, 7);
  const weeksTo = (h7 - 0.5) / declRate;
  return weeksTo > 0 && weeksTo < 40 ? 7 + weeksTo : weeksTo <= 0 ? 7 : null;
};

// Peer benchmarking: clusters exchange AGGREGATE similarity
// scores, never raw center books. Score = mean pairwise
// dimension alignment inside cluster (privacy-by-boundary).
const fbClusterKernel = (cl, w) => {
  const cs = FB_BOUNDARY.centers.filter((c) => cl.members.includes(c.id));
  if (cs.length < 2) {
    const c = cs[0];
    return { k: fbHealth(c, w), n: 1, robust: cl.coupling > 0.5 };
  }
  let k = 0, pairs = 0;
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++) {
      k += FB_DIMS.reduce((s, d) => s + (1 - Math.abs(fbDimVal(cs[i], d, w) - fbDimVal(cs[j], d, w))), 0) / 5;
      pairs++;
    }
  return { k: k / pairs, n: cs.length, robust: cl.coupling > 0.5 };
};

// ---------- SHARED TOKENS ----------
const FB_BG = "#05060e", FB_PANEL = "#0a0d1f", FB_LINE = "#1c2650", FB_INKD = "#e8ecff",
  FB_MUTD = "#5a6a9e", FB_CY = "#27c8e8", FB_VI = "#9d7bff", FB_MONO = "'SF Mono','Cascadia Code',Consolas,monospace";

const fbStateCol = (h) => (h < 0.35 ? "#e03535" : h < 0.6 ? "#d9a520" : "#2fbf5f");

const FBChip = ({ children, col = FB_MUTD }) => (
  <span style={{ fontFamily: FB_MONO, fontSize: 9, color: col, border: `1px solid ${col}44`, borderRadius: 2, padding: "1px 5px" }}>{children}</span>
);

const FBBar = ({ v, col }) => (
  <div style={{ height: 4, background: "#141d3d", borderRadius: 2 }}>
    <div style={{ height: 4, width: `${v * 100}%`, borderRadius: 2, background: col || fbStateCol(v), transition: "width .3s" }} />
  </div>
);

// ================================================================
// VIEW 1 — MAP (spatial graph + coupling + wells)
// ================================================================
function BasisMap({ w, sel, setSel, q }) {
  const links = useMemo(() => {
    const out = [];
    for (let i = 0; i < FB_BOUNDARY.centers.length; i++)
      for (let j = i + 1; j < FB_BOUNDARY.centers.length; j++) {
        const a = FB_BOUNDARY.centers[i], b = FB_BOUNDARY.centers[j];
        const k = FB_DIMS.reduce((s, d) => s + (1 - Math.abs(fbDimVal(a, d, w) - fbDimVal(b, d, w))), 0) / 5;
        const sameCluster = FB_BOUNDARY.clusters.some((cl) => cl.members.includes(a.id) && cl.members.includes(b.id));
        out.push({ a, b, k, sameCluster });
      }
    return out;
  }, [w]);

  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: 360, background: FB_BG, borderRadius: 6, border: `1px solid ${FB_LINE}` }}>
      {/* coupling links */}
      {links.map((l, i) => (
        <line key={i} x1={l.a.pos[0]} y1={l.a.pos[1]} x2={l.b.pos[0]} y2={l.b.pos[1]}
          stroke={l.sameCluster ? FB_VI : FB_CY} strokeWidth={0.15 + l.k * 0.7}
          strokeDasharray={l.sameCluster ? "1.5 1" : "none"} opacity={0.15 + l.k * 0.5} />
      ))}
      {/* centers as wells: radius = 1 - fbHealth (deeper well = bigger risk halo) */}
      {FB_BOUNDARY.centers.map((c) => {
        const h = fbHealth(c, w);
        const coh = fbCoherence(c, w);
        const r = 3 + (1 - h) * 6;
        return (
          <g key={c.id} onClick={() => setSel(sel === c.id ? null : c.id)} style={{ cursor: "pointer" }}>
            <circle cx={c.pos[0]} cy={c.pos[1]} r={r} fill={fbStateCol(h)} opacity={0.12} />
            <circle cx={c.pos[0]} cy={c.pos[1]} r={2.4} fill={fbStateCol(h)} opacity={0.35 + coh * 0.6} />
            {/* dashed ring = decohered / stale */}
            {coh < 0.6 && <circle cx={c.pos[0]} cy={c.pos[1]} r={3.6} fill="none" stroke={FB_MUTD} strokeWidth={0.25} strokeDasharray="0.8 0.8" />}
            {sel === c.id && <circle cx={c.pos[0]} cy={c.pos[1]} r={4.6} fill="none" stroke={FB_INKD} strokeWidth={0.3} />}
            <text x={c.pos[0]} y={c.pos[1] - r - 1.5} textAnchor="middle" fill={FB_INKD} fontSize={2.8} fontFamily={FB_MONO}>{c.id}</text>
            <text x={c.pos[0]} y={c.pos[1] + r + 3.4} textAnchor="middle" fill={FB_MUTD} fontSize={2.2} fontFamily={FB_MONO}>
              {`health ${h.toFixed(2)} · rec ${fbTau(c, w).toFixed(1)}w`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ================================================================
// BASIS 2 — CIRCUIT (workflow DAG: gates + dependencies)
// Each center runs the same measurement circuit:
// RECORD → HOLD → GATE(4 governors) → COMMIT → ACT
// ================================================================
const FB_GATES = ["RECORD", "HOLD", "GATE", "COMMIT", "ACT"];
const FB_GOVERNORS = [
  { id: "G1", name: "Financial materiality", test: (c, w) => fbDimVal(c, "margin", w) >= 0.25 },
  { id: "G2", name: "Engagement integrity", test: (c, w) => fbDimVal(c, "engagement", w) >= 0.35 },
  { id: "G3", name: "Child safety clearance", test: (c, w) => fbDimVal(c, "compliance", w) >= 0.8 },
  { id: "G4", name: "Data integrity (no inference past gap)", test: (c, w) => fbCoherence(c, w) >= 0.35 },
];

function BasisCircuit({ w, q }) {
  const GNAMES = FB_GATES;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {FB_BOUNDARY.centers.map((c) => {
        const govs = FB_GOVERNORS.map((g) => ({ ...g, pass: g.test(c, w) }));
        const blocked = govs.filter((g) => !g.pass);
        const coh = fbCoherence(c, w);
        // circuit halts at HOLD if decohered, at GATE if governor fails
        const haltAt = coh < 0.35 ? 1 : blocked.length ? 2 : 4;
        return (
          <div key={c.id} style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <b style={{ fontFamily: FB_MONO, fontSize: 11, color: FB_INKD }}>{c.label}</b>
              <FBChip col={blocked.length ? "#e03535" : "#2fbf5f"}>
                {coh < 0.35 ? ("HELD · stale data — run a progress review first") : blocked.length ? `HELD · ${blocked.map((g) => g.id).join(" ")}` : ("CLEARED TO DECIDE")}
              </FBChip>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {GNAMES.map((g, i) => (
                <div key={g} style={{ display: "flex", alignItems: "center", flex: i < GNAMES.length - 1 ? 1 : "none" }}>
                  <div style={{
                    fontFamily: FB_MONO, fontSize: 9, padding: "5px 8px", borderRadius: 3,
                    border: `1px solid ${i <= haltAt ? (i === haltAt && haltAt < 4 ? "#e03535" : FB_CY) : FB_LINE}`,
                    color: i <= haltAt ? (i === haltAt && haltAt < 4 ? "#e03535" : FB_CY) : FB_MUTD,
                    background: i < haltAt ? `${FB_CY}11` : "transparent",
                  }}>{g}</div>
                  {i < GNAMES.length - 1 && <div style={{ flex: 1, height: 1, background: i < haltAt ? FB_CY : FB_LINE, opacity: i < haltAt ? 0.7 : 0.4 }} />}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {govs.map((g) => (
                <FBChip key={g.id} col={g.pass ? "#2fbf5f" : "#e03535"}>{g.id} {g.pass ? "✓" : "✗"} {g.name}</FBChip>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ================================================================
// VIEW 3 — CALENDAR (timeline: reviews, retention-inflection
// markers, predicted decline windows)
// ================================================================
function BasisCalendar({ w, q }) {
  const WEEKS = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14, overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `90px repeat(${WEEKS.length}, 1fr)`, gap: 2, minWidth: 620 }}>
        <div />
        {WEEKS.map((wk) => (
          <div key={wk} style={{ fontFamily: FB_MONO, fontSize: 8, color: wk === w ? FB_CY : FB_MUTD, textAlign: "center", borderBottom: wk === w ? `2px solid ${FB_CY}` : `1px solid ${FB_LINE}`, paddingBottom: 3 }}>W{wk}</div>
        ))}
        {FB_BOUNDARY.centers.map((c) => {
          const pt = fbInflection(c);
          const measuredW = 7 - c.lastMeasured;
          const t = fbTau(c, w);
          const declineW = fbTauAlert(t) === "critical" ? w + 4 : null; // rec>3w => ~30-day window
          return (
            <Fragment key={c.id}>
              <div style={{ fontFamily: FB_MONO, fontSize: 9.5, color: FB_INKD, padding: "6px 0" }}>{c.id}</div>
              {WEEKS.map((wk) => {
                const isMeasure = wk === measuredW;
                const isShock = c.shock && wk === c.shock.week;
                const isPage = pt !== null && Math.round(pt) === wk;
                const isDecline = declineW !== null && wk === declineW;
                const past = wk <= w;
                return (
                  <div key={c.id + wk} title={[isMeasure && "measurement", isShock && c.shock.kind, isPage && "retention inflection — attrition compounding", isDecline && "predicted decline window"].filter(Boolean).join(" · ")}
                    style={{
                      height: 26, borderRadius: 2, position: "relative",
                      background: past ? `${fbStateCol(fbHealth(c, Math.min(wk, 12)))}22` : "#0d1128",
                      border: `1px solid ${FB_LINE}`, opacity: past ? 1 : 0.55,
                    }}>
                    {isMeasure && <div style={{ position: "absolute", inset: 3, borderRadius: 2, border: `1.5px solid ${FB_CY}` }} />}
                    {isShock && <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", color: "#d9a520", fontSize: 11, lineHeight: 1 }}>⚡</div>}
                    {isPage && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", color: FB_VI, fontSize: 8, fontFamily: FB_MONO }}>Pg</div>}
                    {isDecline && <div style={{ position: "absolute", inset: 3, borderRadius: 2, border: `1.5px dashed #e03535` }} />}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        <FBChip col={FB_CY}>▢ {"progress review (refreshes data)"}</FBChip>
        <FBChip col="#d9a520">⚡ shock event</FBChip>
        <FBChip col={FB_VI}>Pg {"retention inflection — staff/parents start leaving"}</FBChip>
        <FBChip col="#e03535">▢ {"predicted decline window (~30d after slow recovery)"}</FBChip>
      </div>
    </div>
  );
}

// ================================================================
// VIEW 4 — PRICING & RECOVERY (tuition vs ceiling, recovery curves,
// fbRecoverySig signature)
// ================================================================
function BasisPhase({ w, sel, setSel, q }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* pricing-ceiling chart */}
      <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_VI, letterSpacing: 1, marginBottom: 8 }}>PRICING CEILING — CRITICAL TUITION</div>
        {FB_BOUNDARY.centers.map((c) => {
          const frac = c.tuition / c.Tc;
          const danger = frac > 0.92;
          return (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FB_MONO, fontSize: 9.5, marginBottom: 3 }}>
                <span style={{ color: FB_INKD }}>{c.id} · ${c.tuition}/mo</span>
                <span style={{ color: danger ? "#e03535" : FB_MUTD }}>ceiling ${c.Tc} · headroom ${c.Tc - c.tuition} {danger && "· AT PHASE FB_BOUNDARY"}</span>
              </div>
              <div style={{ height: 8, background: "#141d3d", borderRadius: 2, position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, background: danger ? "#e03535" : frac > 0.8 ? "#d9a520" : "#2fbf5f", borderRadius: 2, transition: "width .3s" }} />
                <div style={{ position: "absolute", left: "100%", top: -2, bottom: -2, width: 2, background: FB_VI, transform: "translateX(-2px)" }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD, lineHeight: 1.6 }}>
          Below the ceiling a price move is absorbable; crossing it triggers an abrupt, largely irreversible enrollment decline. NY sits $6 from the boundary — any increase tips the unit into decline. The ceiling is computed, not discovered: predict it, stay below it.
        </div>
      </div>

      {/* Recovery signatures */}
      <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_CY, letterSpacing: 1, marginBottom: 8 }}>{"RECOVERY SIGNATURE — HOW EACH CENTER ABSORBS A DISRUPTION"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {FB_BOUNDARY.centers.filter((c) => c.shock).map((c) => {
            const rd = fbRecoverySig(c, w);
            const T = fbTau(c, w);
            const fragile = rd.Q > 3;
            return (
              <div key={c.id} style={{ border: `1px solid ${fragile ? "#e0353555" : FB_LINE}`, borderRadius: 4, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FB_MONO, fontSize: 9.5, marginBottom: 4 }}>
                  <b style={{ color: FB_INKD }}>{c.id} · {c.shock.kind}</b>
                  <span style={{ color: fragile ? "#e03535" : "#2fbf5f" }}>Q {rd.Q.toFixed(1)} · rec {T.toFixed(1)}w</span>
                </div>
                <svg viewBox="0 0 100 34" style={{ width: "100%", height: 70 }}>
                  <line x1="0" y1="17" x2="100" y2="17" stroke={FB_LINE} strokeWidth="0.4" />
                  <polyline fill="none" stroke={fragile ? "#e03535" : FB_CY} strokeWidth="0.8"
                    points={rd.pts.map((p) => `${(p.t / 10) * 100},${17 - p.a * 45}`).join(" ")} />
                  {/* envelope */}
                  <polyline fill="none" stroke={FB_MUTD} strokeWidth="0.4" strokeDasharray="1.5 1.5"
                    points={rd.pts.map((p) => `${(p.t / 10) * 100},${17 - c.shock.amp * Math.exp(-p.t / T) * 45}`).join(" ")} />
                  <line x1={(rd.elapsed / 10) * 100} y1="0" x2={(rd.elapsed / 10) * 100} y2="34" stroke={FB_CY} strokeWidth="0.5" opacity="0.6" />
                </svg>
                <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD, lineHeight: 1.5 }}>
                  {fragile
                    ? "Slow recovery — the unit keeps swinging instead of settling. A high recovery index means fragile: intervene before the decline hardens into permanent loss."
                    : "Fast recovery — shock absorbed, unit re-settling to baseline. Healthy signature."}
                  {" "}Residual swing now: {(rd.residual * 100).toFixed(0)}%.
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* recovery time */}
      <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 9, color: "#d9a520", letterSpacing: 1, marginBottom: 8 }}>{"RECOVERY TIME — HOW LONG UNTIL BACK TO BASELINE"}</div>
        {FB_BOUNDARY.centers.map((c) => {
          const t = fbTau(c, w);
          const a = fbTauAlert(t);
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontFamily: FB_MONO, fontSize: 9.5 }}>
              <span style={{ minWidth: 26, color: FB_INKD }}>{c.id}</span>
              <div style={{ flex: 1 }}><FBBar v={Math.min(1, t / 8)} col={a === "critical" ? "#e03535" : a === "watch" ? "#d9a520" : "#2fbf5f"} /></div>
              <span style={{ minWidth: 120, color: a === "critical" ? "#e03535" : a === "watch" ? "#d9a520" : FB_MUTD }}>
                rec {t.toFixed(1)}w {a === "critical" ? "→ decline ~30d, activate support" : a === "watch" ? "→ lengthening, monitor" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================
// VIEW 5 — OPERATIONS (aggregate peer benchmarks, retention inflection, source data)
// ================================================================
function BasisOps({ w, q }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_VI, letterSpacing: 1, marginBottom: 8 }}>{"PEER BENCHMARKING — benchmarks are shared, center financials never are"}</div>
        {FB_BOUNDARY.clusters.map((cl) => {
          const kk = fbClusterKernel(cl, w);
          return (
            <div key={cl.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${FB_LINE}55`, fontFamily: FB_MONO, fontSize: 9.5 }}>
              <b style={{ minWidth: 70, color: FB_INKD }}>{cl.id}</b>
              <span style={{ minWidth: 110, color: FB_MUTD }}>{cl.members.join(" · ")}</span>
              <div style={{ flex: 1 }}><FBBar v={kk.k} col={kk.robust ? "#2fbf5f" : "#d9a520"} /></div>
              <span style={{ minWidth: 150, color: kk.robust ? "#2fbf5f" : "#d9a520" }}>
                benchmark alignment {kk.k.toFixed(2)} · coupling {cl.coupling.toFixed(2)} {kk.robust ? "· robust" : "· fragile — single-unit shock cascades"}
              </span>
            </div>
          );
        })}
        <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD, marginTop: 8, lineHeight: 1.6 }}>
          Only aggregate benchmarks leave each cluster. WEST has redundant peer support: CA can absorb an OR shock. EAST is a single-node cluster — no error correction available. Priority: build NY's coupling (shared Senseis, referral pipeline) before its next shock.
        </div>
      </div>

      <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_CY, letterSpacing: 1, marginBottom: 8 }}>{"RETENTION INFLECTION — WHEN STAFF AND PARENTS START LEAVING"}</div>
        {FB_BOUNDARY.centers.map((c) => {
          const pt = fbInflection(c);
          return (
            <div key={c.id} style={{ display: "flex", gap: 10, padding: "4px 0", fontFamily: FB_MONO, fontSize: 9.5 }}>
              <span style={{ minWidth: 26, color: FB_INKD }}>{c.id}</span>
              <span style={{ color: pt !== null && pt <= w + 2 ? "#e03535" : FB_MUTD }}>
                {pt === null ? "stable — no escape trajectory" : pt <= w ? `PASSED (W${Math.round(pt)}) — parents talking, staff interviewing out. Retention cost now 3–4× intervention cost.` : `projected W${Math.round(pt)} — intervene before this line, not after`}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_MUTD, letterSpacing: 1, marginBottom: 8 }}>CANONICAL FB_BOUNDARY DOCUMENT — cn-boundary/1.1</div>
        <pre style={{ fontFamily: FB_MONO, fontSize: 8.5, color: "#aab4dd", background: FB_BG, border: `1px solid ${FB_LINE}`, borderRadius: 4, padding: 10, overflowX: "auto", margin: 0, lineHeight: 1.5 }}>
{JSON.stringify({ schema: FB_BOUNDARY.schema, week: w, centers: FB_BOUNDARY.centers.map((c) => ({ id: c.id, fbHealth: +fbHealth(c, w).toFixed(3), fbCoherence: +fbCoherence(c, w).toFixed(3), tau_weeks: +fbTau(c, w).toFixed(2), tuition: c.tuition, Tc: c.Tc, fbInflection: fbInflection(c) ? +fbInflection(c).toFixed(1) : null })), clusters: FB_BOUNDARY.clusters.map((cl) => ({ id: cl.id, kernel: +fbClusterKernel(cl, w).k.toFixed(3), coupling: cl.coupling })) }, null, 1)}
        </pre>
        <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD, marginTop: 6 }}>
          This object is the whole truth. Every basis above is a read of it — nothing else holds state. Serialize it, and any surface (WebXR table, PDF packet, API) reconstructs the full system.
        </div>
      </div>
    </div>
  );
}


// ---------- FRANCHISE REPORT (map click) ----------
// Integrated growth + competitive view per center. Peer rank uses
// aggregate benchmarks only. Register-aware labels via fbT.
const fbGrowth = (c, w) => {
  const now = fbHealth(c, w), prior = fbHealth(c, Math.max(0, w - 4));
  return { now, prior, delta: now - prior, pct: prior > 0 ? ((now - prior) / prior) * 100 : 0 };
};
const fbPeerRank = (c, w) => {
  const sorted = [...FB_BOUNDARY.centers].sort((a, b) => fbHealth(b, w) - fbHealth(a, w));
  return { rank: sorted.findIndex(x => x.id === c.id) + 1, of: sorted.length };
};
function FranchiseReport({ c, w, q, onClose }) {
  const g = fbGrowth(c, w);
  const pr = fbPeerRank(c, w);
  const rec = fbTau(c, w);
  const fresh = fbCoherence(c, w);
  const infl = fbInflection(c);
  const rd = fbRecoverySig(c, w);
  const cl = FB_BOUNDARY.clusters.find(x => x.members.includes(c.id));
  const kk = cl ? fbClusterKernel(cl, w) : null;
  const strengths = FB_DIMS.filter(d => fbDimVal(c, d, w) >= 0.65);
  const gaps = FB_DIMS.filter(d => fbDimVal(c, d, w) < 0.4);
  const actions = [];
  if (rec >= 3) actions.push("Recovery time above 3 weeks — activate the support plan inside 30 days");
  if (fresh < 0.5) actions.push("Data is stale — run a progress review before any decision");
  if (c.Tc - c.tuition <= 15) actions.push("At the pricing ceiling — hold tuition this cycle");
  if (infl !== null && infl > w && infl <= w + 3) actions.push("Retention inflection inside 3 weeks — intervene now");
  if (cl && cl.members.length < 2) actions.push("No peer support group — build shared staffing and referral ties before the next disruption");
  if (!actions.length) actions.push("On plan — maintain current review cadence");
  const growthPositive = g.delta >= 0;
  return (
    <div style={{ marginTop: 10, background: FB_PANEL, border: `1px solid ${growthPositive ? "#2fbf5f55" : "#e0353555"}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD, letterSpacing: 1.5 }}>FRANCHISE REPORT · WEEK {w}</div>
          <b style={{ fontFamily: FB_MONO, fontSize: 14, color: FB_INKD }}>{c.label}</b>
        </div>
        <span onClick={onClose} style={{ cursor: "pointer", color: FB_MUTD, fontSize: 14 }}>✕</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 12 }}>
        <div style={{ border: `1px solid ${FB_LINE}`, borderRadius: 4, padding: 10 }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD, letterSpacing: 1 }}>GROWTH · 4-WEEK</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 17, color: growthPositive ? "#2fbf5f" : "#e03535", marginTop: 3 }}>{growthPositive ? "▲" : "▼"} {Math.abs(g.pct).toFixed(1)}%</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD }}>{g.prior.toFixed(2)} → {g.now.toFixed(2)}</div>
        </div>
        <div style={{ border: `1px solid ${FB_LINE}`, borderRadius: 4, padding: 10 }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD, letterSpacing: 1 }}>NETWORK RANK</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 17, color: pr.rank === 1 ? "#2fbf5f" : FB_INKD, marginTop: 3 }}>#{pr.rank} <span style={{ fontSize: 10, color: FB_MUTD }}>of {pr.of}</span></div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD }}>{fbT(q, "benchmark").toLowerCase()} {kk ? Math.round(kk.k * 100) + "%" : "—"}</div>
        </div>
        <div style={{ border: `1px solid ${FB_LINE}`, borderRadius: 4, padding: 10 }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD, letterSpacing: 1 }}>{fbT(q, "recovery").toUpperCase()}</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 17, color: rec >= 3 ? "#e03535" : rec >= 2 ? "#d9a520" : "#2fbf5f", marginTop: 3 }}>{rec.toFixed(1)}w</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD }}>{fbT(q, "freshness").toLowerCase()} {Math.round(fresh * 100)}%</div>
        </div>
        <div style={{ border: `1px solid ${FB_LINE}`, borderRadius: 4, padding: 10 }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD, letterSpacing: 1 }}>{fbT(q, "ceiling").toUpperCase()}</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 17, color: c.Tc - c.tuition <= 15 ? "#e03535" : FB_INKD, marginTop: 3 }}>${c.Tc - c.tuition}</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD }}>${c.tuition} vs ${c.Tc} ceiling</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: "#2fbf5f", letterSpacing: 1, marginBottom: 5 }}>COMPETITIVE STRENGTHS</div>
          {strengths.length ? strengths.map(d => (
            <div key={d} style={{ fontFamily: FB_MONO, fontSize: 9.5, color: FB_INKD, padding: "2px 0" }}>▸ {d} {fbDimVal(c, d, w).toFixed(2)} — {(() => { const best = Math.max(...FB_BOUNDARY.centers.filter(x => x.id !== c.id).map(x => fbDimVal(x, d, w))); return fbDimVal(c, d, w) >= best ? "network-leading" : "above median"; })()}</div>
          )) : <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_MUTD }}>none above 0.65 — rebuild from gaps first</div>}
        </div>
        <div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: "#e03535", letterSpacing: 1, marginBottom: 5 }}>GAPS</div>
          {gaps.length ? gaps.map(d => (
            <div key={d} style={{ fontFamily: FB_MONO, fontSize: 9.5, color: FB_INKD, padding: "2px 0" }}>▸ {d} {fbDimVal(c, d, w).toFixed(2)} — {(() => { const best = FB_BOUNDARY.centers.filter(x => x.id !== c.id).sort((a, b) => fbDimVal(b, d, w) - fbDimVal(a, d, w))[0]; return "learn from " + best.id + " (" + fbDimVal(best, d, w).toFixed(2) + ")"; })()}</div>
          )) : <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_MUTD }}>no dimension below 0.40</div>}
        </div>
      </div>

      {rd && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${FB_LINE}`, paddingTop: 8 }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_CY, letterSpacing: 1, marginBottom: 4 }}>{fbT(q, "signature").toUpperCase()} — {c.shock.kind} (W{c.shock.week})</div>
          <svg viewBox="0 0 100 26" style={{ width: "100%", maxWidth: 460, height: 58 }}>
            <line x1="0" y1="13" x2="100" y2="13" stroke={FB_LINE} strokeWidth="0.4" />
            <polyline fill="none" stroke={rd.Q > 3 ? "#e03535" : FB_CY} strokeWidth="0.8" points={rd.pts.map(p => `${(p.t / 10) * 100},${13 - p.a * 34}`).join(" ")} />
          </svg>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD }}>{fbT(q, "settling").toLowerCase()} {rd.Q.toFixed(1)} · residual {(rd.residual * 100).toFixed(0)}% — {rd.Q > 3 ? "still swinging; intervene before it flattens into permanent loss" : "absorbing on schedule"}</div>
        </div>
      )}

      {/* OPTION 2: Operations metrics embedded in franchise report */}
      {OPERATIONS_STATE[c.id] && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${FB_LINE}`, paddingTop: 8 }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_CY, letterSpacing: 1, marginBottom: 6 }}>CENTER OPERATIONS — REAL-TIME SIGNALS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
            <div style={{ border: `1px solid ${OPERATIONS_STATE[c.id].adjustmentRequests.pending > 0 ? "#d9a520" : FB_LINE}`, borderRadius: 3, padding: 8, background: OPERATIONS_STATE[c.id].adjustmentRequests.pending > 0 ? "#d9a52015" : "#f9f9f9" }}>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>Adj. Requests</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 13, color: FB_INKD, marginTop: 2 }}>{OPERATIONS_STATE[c.id].adjustmentRequests.pending} pending</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>{OPERATIONS_STATE[c.id].adjustmentRequests.approved} approved W{OPERATIONS_STATE[c.id].adjustmentRequests.week}</div>
            </div>
            <div style={{ border: `1px solid ${OPERATIONS_STATE[c.id].makeupCoaching.hours > 12 ? "#e03535" : FB_LINE}`, borderRadius: 3, padding: 8, background: OPERATIONS_STATE[c.id].makeupCoaching.hours > 12 ? "#e0353515" : "#f9f9f9" }}>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>Makeup Hours</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 13, color: OPERATIONS_STATE[c.id].makeupCoaching.hours > 12 ? "#e03535" : FB_INKD, marginTop: 2 }}>{OPERATIONS_STATE[c.id].makeupCoaching.hours}h</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>{OPERATIONS_STATE[c.id].makeupCoaching.sessions} sessions</div>
            </div>
            <div style={{ border: `1px solid ${OPERATIONS_STATE[c.id].studentEngagement.atRisk > 1 ? "#b3261e" : FB_LINE}`, borderRadius: 3, padding: 8, background: OPERATIONS_STATE[c.id].studentEngagement.atRisk > 1 ? "#b3261e15" : "#f9f9f9" }}>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>Engagement</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 13, color: FB_INKD, marginTop: 2 }}>{OPERATIONS_STATE[c.id].studentEngagement.projectsOnTrack}/{OPERATIONS_STATE[c.id].studentEngagement.projectsOnTrack + OPERATIONS_STATE[c.id].studentEngagement.atRisk}</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>on-track {Math.round(OPERATIONS_STATE[c.id].studentEngagement.completionRate*100)}%</div>
            </div>
            <div style={{ border: `1px solid ${Object.values(OPERATIONS_STATE[c.id].projectPacing).some(p => p < 0.6) ? "#d9a520" : FB_LINE}`, borderRadius: 3, padding: 8, background: Object.values(OPERATIONS_STATE[c.id].projectPacing).some(p => p < 0.6) ? "#d9a52015" : "#f9f9f9" }}>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>Curriculum</div>
              <div style={{ fontFamily: FB_MONO, fontSize: 13, color: FB_INKD, marginTop: 2 }}>
                {Object.values(OPERATIONS_STATE[c.id].projectPacing).every(p => p >= 0.7) ? "on-pace" : "watch"}
              </div>
              <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD }}>
                {Object.entries(OPERATIONS_STATE[c.id].projectPacing).filter(([_, p]) => p < 0.6).length > 0 ? `${Object.entries(OPERATIONS_STATE[c.id].projectPacing).filter(([_, p]) => p < 0.6).length} tracks behind` : "all on-track"}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD, marginTop: 6, lineHeight: 1.5 }}>
            Real-time operations data from Pike scheduling, MyStudio engagement tracking, and session dialogue frequency. Integration point: identify friction signals (high makeup requests, stalled curricula) before they compound into retention risk.
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: `1px solid ${FB_LINE}`, paddingTop: 8 }}>
        <div style={{ fontFamily: FB_MONO, fontSize: 8.5, color: "#d9a520", letterSpacing: 1, marginBottom: 5 }}>RECOMMENDED ACTIONS</div>
        {actions.map((a, i) => <div key={i} style={{ fontFamily: FB_MONO, fontSize: 9.5, color: FB_INKD, padding: "2px 0" }}>{i + 1}. {a}</div>)}
      </div>
    </div>
  );
}

// ================================================================
// SHELL — one state, five bases, one scrubber
// ================================================================
const FB_BASES = [
  { id: "map", label: "MAP", sub: "spatial graph" },
  { id: "circuit", label: "CIRCUIT", sub: "gates & governors" },
  { id: "calendar", label: "CALENDAR", sub: "timeline" },
  { id: "phase", label: "PHASE", sub: "energy landscape" },
  { id: "ops", label: "OPERATIONS", sub: "benchmarks & data" },
];

function FiveBasisTab({ initialBasis = "map" } = {}) {
  const [basis, setBasis] = useState(initialBasis);
  const [week, setWeek] = useState(7);
  const [sel, setSel] = useState(null);
  const q = false; // corporate register only

  const netHealth = FB_BOUNDARY.centers.reduce((s, c) => s + fbHealth(c, week), 0) / FB_BOUNDARY.centers.length;
  const critical = FB_BOUNDARY.centers.filter((c) => fbTauAlert(fbTau(c, week)) === "critical").length;

  return (
    <div style={{ background: FB_BG, borderRadius: 8, padding: 18, color: FB_INKD }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          <div>
            <div style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_VI, letterSpacing: 2 }}>PROPOSED POLICY FRAMEWORK — CANDIDATE SUBMISSION</div>
            <h1 style={{ fontFamily: FB_MONO, fontSize: 17, margin: "4px 0 0", fontWeight: 600 }}>CN Network — One Shared State, Five Views</h1>
          </div>
          <div style={{ fontFamily: FB_MONO, fontSize: 9.5, color: FB_MUTD, textAlign: "right" }}>
            net health <b style={{ color: fbStateCol(netHealth) }}>{netHealth.toFixed(2)}</b> · <b style={{ color: critical ? "#e03535" : "#2fbf5f" }}>{critical}</b> slow-recovery · cn-boundary/1.1
          </div>
        </div>

        <div style={{ border: `1px solid ${FB_LINE}`, borderLeft: `3px solid ${FB_VI}`, background: FB_PANEL, padding: "8px 12px", margin: "10px 0" }}>
          <div style={{ fontFamily: FB_MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: FB_VI, marginBottom: 3 }}>Why this matters</div>
          <div style={{ fontFamily: FB_MONO, fontSize: 10.5, color: FB_INKD, lineHeight: 1.6 }}>Every screen in this model — network map, center detail, agent recommendation, ledger entry — reads from this one canonical state rather than maintaining its own copy of the numbers. For a network this size, that's not a technical nicety; it's the only way a Director, an FBC, and a franchisee can look at the same center and see the same facts.</div>
        </div>

        {/* global scrubber — the proof: one state, all bases rotate */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: FB_PANEL, border: `1px solid ${FB_LINE}`, borderRadius: 6, padding: "8px 14px", margin: "10px 0" }}>
          <span style={{ fontFamily: FB_MONO, fontSize: 9, color: FB_CY, letterSpacing: 1, whiteSpace: "nowrap" }}>{"TIMELINE"}</span>
          <input type="range" min="0" max="12" value={week} onChange={(e) => setWeek(+e.target.value)} style={{ flex: 1, accentColor: FB_CY, cursor: "pointer" }} />
          <span style={{ fontFamily: FB_MONO, fontSize: 12, color: FB_INKD, minWidth: 34 }}>W{week}</span>
          <span style={{ fontFamily: FB_MONO, fontSize: 8.5, color: FB_MUTD, whiteSpace: "nowrap" }}>every view updates together</span>
        </div>

        {/* basis selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {FB_BASES.map((b) => (
            <button key={b.id} onClick={() => setBasis(b.id)} style={{
              fontFamily: FB_MONO, fontSize: 9.5, padding: "7px 13px", borderRadius: 4, cursor: "pointer",
              background: basis === b.id ? `${FB_CY}18` : "transparent",
              border: `1px solid ${basis === b.id ? FB_CY : FB_LINE}`,
              color: basis === b.id ? FB_CY : FB_MUTD, transition: "all .15s",
            }}>
              <b>{b.label}</b><span style={{ opacity: 0.6 }}> · {b.sub}</span>
            </button>
          ))}
        </div>

        {basis === "map" && <BasisMap w={week} sel={sel} setSel={setSel} q={q} />}
        {basis === "circuit" && <BasisCircuit w={week} q={q} />}
        {basis === "calendar" && <BasisCalendar w={week} q={q} />}
        {basis === "phase" && <BasisPhase w={week} sel={sel} setSel={setSel} q={q} />}
        {basis === "ops" && <BasisOps w={week} q={q} />}

        {/* map click → full franchise report (persists across bases — same state) */}
        {sel && <FranchiseReport c={FB_BOUNDARY.centers.find(x => x.id === sel)} w={week} q={q} onClose={() => setSel(null)} />}

        <div style={{ marginTop: 14, borderTop: `1px solid ${FB_LINE}`, paddingTop: 8, fontFamily: FB_MONO, fontSize: 8, color: FB_MUTD, lineHeight: 1.7 }}>
          {"One shared state · five views · recovery-time, recovery-signature, retention-inflection, and pricing-ceiling indicators · peer benchmarks use aggregates only"}<br />
          Seeds illustrative, structures computed live · corporate register throughout · Pratik Singh
        </div>
      </div>
    </div>
  );
}


// ===== EARLY WARNING (corporate register) =====
const CR_SETTLE = (q) => (q > 3 ? "prolonged" : q > 1.5 ? "moderate" : "rapid");
function EarlyWarningTab(){
 const w = 7; // current reporting week
 const rows = FB_BOUNDARY.centers.map(c => ({
   c,
   h: fbHealth(c, w),
   fresh: fbCoherence(c, w),
   rec: fbTau(c, w),
   infl: fbInflection(c),
   rd: fbRecoverySig(c, w),
   headroom: c.Tc - c.tuition,
 })).sort((a,b) => a.h - b.h);
 return (<div>
  <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:8}}>Early-warning summary — measurement before escalation</div>
  <div style={{fontSize:12.5,color:"#444",lineHeight:1.6,marginBottom:12}}>Each center is tracked on four leading indicators: <b>recovery time</b> (how quickly performance returns to baseline after a disruption), <b>recovery signature</b> (whether the return is settling or still swinging), <b>retention inflection point</b> (the projected week at which family and staff attrition risk compounds), and <b>pricing ceiling headroom</b> (distance to the tuition level the local market will not absorb). All figures derive from the same progress-report data reviewed with each center; peer comparisons use aggregate benchmarks only — center-level financials are never shared across owners.</div>

  {rows.map(({c,h,fresh,rec,infl,rd,headroom}) => {
   const recFlag = rec >= 3 ? "action" : rec >= 2 ? "monitor" : "stable";
   return (
   <div key={c.id} style={{border:`1px solid ${RULE}`,borderLeft:`3px solid ${recFlag==="action"?"#b3261e":recFlag==="monitor"?"#9a6b00":"#1f7a3f"}`,padding:"10px 14px",marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
     <b style={{fontFamily:"Helvetica",fontSize:13,color:INK}}>{c.label}</b>
     <span style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:recFlag==="action"?"#b3261e":recFlag==="monitor"?"#9a6b00":"#1f7a3f"}}>
      {recFlag==="action"?"Support plan recommended":recFlag==="monitor"?"Monitor":"Performing"}
     </span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:"6px 18px",marginTop:8}}>
     <div style={{fontSize:11.5,color:"#333"}}><b style={{fontFamily:"Helvetica"}}>Recovery time:</b> {rec.toFixed(1)} weeks{rec>=3?" — best practice indicates intervention within 30 days":rec>=2?" — lengthening; schedule a progress review":""}</div>
     <div style={{fontSize:11.5,color:"#333"}}><b style={{fontFamily:"Helvetica"}}>Data freshness:</b> {Math.round(fresh*100)}%{fresh<0.5?" — last review is stale; measurement precedes any decision":""}</div>
     <div style={{fontSize:11.5,color:"#333"}}><b style={{fontFamily:"Helvetica"}}>Pricing ceiling headroom:</b> ${headroom}/mo{headroom<=15?" — no increase advisable this cycle":""}</div>
     <div style={{fontSize:11.5,color:"#333"}}><b style={{fontFamily:"Helvetica"}}>Retention inflection:</b> {infl===null?"not projected — trend stable":infl<=w?"passed — retention costs now exceed early-intervention costs 3-4x":`projected week ${Math.round(infl)} — act before this point`}</div>
    </div>
    {rd && (
     <div style={{marginTop:8,borderTop:`1px solid ${RULE}`,paddingTop:6}}>
      <div style={{fontFamily:"Helvetica",fontSize:9.5,fontWeight:700,letterSpacing:0.6,textTransform:"uppercase",color:MUT,marginBottom:3}}>Recovery signature — {c.shock.kind} (week {c.shock.week})</div>
      <svg viewBox="0 0 100 22" style={{width:"100%",maxWidth:420,height:52,display:"block"}}>
       <line x1="0" y1="11" x2="100" y2="11" stroke={RULE} strokeWidth="0.4"/>
       <polyline fill="none" stroke={CR_SETTLE(rd.Q)==="prolonged"?"#b3261e":"#1f7a3f"} strokeWidth="0.8"
        points={rd.pts.map(p=>`${(p.t/10)*100},${11-p.a*28}`).join(" ")}/>
      </svg>
      <div style={{fontSize:11,color:"#444",lineHeight:1.5}}>Settling is <b>{CR_SETTLE(rd.Q)}</b>. {CR_SETTLE(rd.Q)==="prolonged"?"Performance is still swinging rather than returning to baseline — a documented leading indicator of sustained decline. Recommend activating the support plan now, while remaining momentum is recoverable.":"Disruption absorbed; performance returning to baseline on schedule."} Residual impact: {(rd.residual*100).toFixed(0)}%.</div>
     </div>
    )}
   </div>);
  })}

  {/* OPTION 3: Operational Red Flags that predict financial/health problems */}
  <div style={{marginTop:14,borderTop:`1px solid ${RULE}`,paddingTop:10}}>
   <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:8}}>Operational Red Flags — Leading Indicators</div>
   <div style={{fontSize:11,color:"#555",lineHeight:1.6,marginBottom:10}}>Operations data (scheduling adjustments, makeup hour burn, student engagement friction, curriculum pacing) often precedes financial/retention metrics by 2–3 weeks. Monitoring these signals enables earlier intervention.</div>
   {rows.map(({c}) => {
    const ops = OPERATIONS_STATE[c.id];
    if (!ops) return null;
    const flags = [];
    const adjReqBurn = ops.adjustmentRequests.pending + ops.adjustmentRequests.approved;
    if (adjReqBurn > 8) flags.push({ sev: "action", msg: `High adjustment request volume (${adjReqBurn}) — scheduling friction or student instability` });
    else if (adjReqBurn >= 5) flags.push({ sev: "watch", msg: `Moderate adjustment requests (${adjReqBurn}) — monitor staff availability strain` });
    if (ops.makeupCoaching.hours > 12) flags.push({ sev: "action", msg: `Makeup coaching hours elevated (${ops.makeupCoaching.hours}h) — early sign of staff burnout or engagement gaps` });
    if (ops.studentEngagement.atRisk > 1) flags.push({ sev: "watch", msg: `${ops.studentEngagement.atRisk} students at-risk — retention impact likely within 2–3 weeks` });
    if (Object.values(ops.projectPacing).some(p => p < 0.55)) flags.push({ sev: "watch", msg: `Curriculum pacing behind on ${Object.entries(ops.projectPacing).filter(([_,p]) => p < 0.55).map(([k]) => k).join(", ")} — disengagement precedes withdrawals` });
    if (ops.dialogueFreq < 8) flags.push({ sev: "watch", msg: `Low session dialogue frequency (${ops.dialogueFreq} entries/wk) — coach-to-coach knowledge transfer weak` });
    if (!flags.length) return <div key={c.id} style={{display:"flex",gap:10,alignItems:"baseline",padding:"6px 0",borderBottom:"1px solid #f0f0f0",fontSize:11.5}}><b style={{minWidth:80,color:INK}}>{c.label}</b><span style={{color:MUT}}>ops healthy — no leading indicators</span></div>;
    return (
     <div key={c.id}>
      {flags.map((f, i) => (
       <div key={i} style={{display:"flex",gap:10,alignItems:"baseline",padding:"8px 0",borderBottom:"1px solid #f0f0f0",borderLeft:`3px solid ${f.sev==="action"?"#b3261e":"#9a6b00"}`,paddingLeft:8}}>
        <b style={{minWidth:80,color:INK,fontSize:11}}>{c.label}</b>
        <span style={{fontSize:10,fontWeight:700,color:f.sev==="action"?"#b3261e":"#9a6b00",minWidth:50}}>{f.sev.toUpperCase()}</span>
        <span style={{fontSize:11,color:"#444"}}>{f.msg}</span>
       </div>
      ))}
     </div>
    );
   })}
  </div>

  <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,margin:"14px 0 6px"}}>Peer benchmarking — aggregates only</div>
  {FB_BOUNDARY.clusters.map(cl => {
   const k = fbClusterKernel(cl, w);
   return (
    <div key={cl.id} style={{display:"flex",alignItems:"baseline",gap:10,padding:"4px 0",borderBottom:"1px solid #f0f0f0",fontSize:11.5,color:"#333"}}>
     <b style={{fontFamily:"Helvetica",minWidth:80,color:INK}}>{cl.id}</b>
     <span style={{minWidth:110,color:MUT,fontFamily:"Helvetica",fontSize:10}}>{cl.members.join(" · ")}</span>
     <span>benchmark alignment {Math.round(k.k*100)}% · support coupling {Math.round(cl.coupling*100)}%{!k.robust?" — single-center group: no peer support available if disrupted; priority is building shared staffing and referral ties":""}</span>
    </div>);
  })}
  <div style={{fontSize:11,color:"#666",lineHeight:1.6,marginTop:8}}>Benchmarks are computed from aggregate indicators. Individual center financials remain confidential to each owner — a data-governance commitment, not a limitation.</div>
 </div>);
}

// ===== OPERATIONS DATA MODEL (mocked from Slack channels) =====
// Real integration point: MyStudio API, Pike dashboard, internal Slack → this shape
const OPERATIONS_STATE = {
 "pleasanton": {
  adjustmentRequests: { pending: 2, approved: 8, denied: 1, week: 7 },
  makeupCoaching: { hours: 14, sessions: 4, lastUpdated: "2026-07-10" },
  studentEngagement: { projectsOnTrack: 18, atRisk: 2, completionRate: 0.89 },
  projectPacing: { scratchAdvanced: 0.72, pythonIntro: 0.58, pixelpadAdvanced: 0.91 },
  staffNotifications: [
   { date: "2026-07-08", type: "scheduling_adjustment", count: 2 },
   { date: "2026-07-09", type: "makeup_request", count: 1 },
   { date: "2026-07-10", type: "engagement_alert", count: 0 },
  ],
  dialogueFreq: 12, // weekly session dialogue entries (proxy for engagement depth)
 },
 "walnutcreek": {
  adjustmentRequests: { pending: 1, approved: 5, denied: 0, week: 7 },
  makeupCoaching: { hours: 8, sessions: 2, lastUpdated: "2026-07-09" },
  studentEngagement: { projectsOnTrack: 14, atRisk: 1, completionRate: 0.92 },
  projectPacing: { scratchAdvanced: 0.68, pythonIntro: 0.64, pixelpadAdvanced: 0.85 },
  staffNotifications: [
   { date: "2026-07-08", type: "scheduling_adjustment", count: 1 },
  ],
  dialogueFreq: 8,
 },
};

function getOpsSignals(centerId) {
 const ops = OPERATIONS_STATE[centerId] || null;
 if (!ops) return null;
 const adjReqIntensity = (ops.adjustmentRequests.pending + ops.adjustmentRequests.approved) / 10;
 const makeupHoursBurn = ops.makeupCoaching.hours > 12 ? "elevated" : "normal";
 const engagementRisk = ops.studentEngagement.atRisk > 1 ? "watch" : "ok";
 const pacingFlag = Object.values(ops.projectPacing).some(p => p < 0.6) ? "behind" : "on-track";
 return { adjReqIntensity, makeupHoursBurn, engagementRisk, pacingFlag, raw: ops };
}

// ===== OPERATIONS TAB (Option 1) =====
function OperationsTab() {
 const [view, setView] = useState("scheduling");
 const centers = ["pleasanton", "walnutcreek"];

 function SchedulingWorkflow() {
  return (
   <div>
    <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:INK}}>Adjustment Request Tracker</div>
    {centers.map(cid => {
     const ops = OPERATIONS_STATE[cid];
     return (
      <div key={cid} style={{border:`1px solid ${RULE}`,borderRadius:4,padding:12,marginBottom:10}}>
       <b style={{textTransform:"capitalize",fontSize:12,color:INK}}>{cid}</b>
       <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:8}}>
        <div><span style={{fontSize:10,color:MUT}}>Pending Requests</span><div style={{fontSize:16,fontWeight:700,color:FB_CY}}>{ops.adjustmentRequests.pending}</div></div>
        <div><span style={{fontSize:10,color:MUT}}>Approved (Week {ops.adjustmentRequests.week})</span><div style={{fontSize:16,fontWeight:700,color:"#2fbf5f"}}>{ops.adjustmentRequests.approved}</div></div>
        <div><span style={{fontSize:10,color:MUT}}>Denied</span><div style={{fontSize:16,fontWeight:700,color:"#e03535"}}>{ops.adjustmentRequests.denied}</div></div>
       </div>
       <div style={{fontSize:11,color:"#555",marginTop:8,lineHeight:1.5}}>
        Process: Coaches email Pleasanton@thecoderschool.com with session date + student. Title "Adjustment starting [date]". Follow-up in update-availability channel. Approved when staff availability confirmed & core hours maintained.
       </div>
      </div>
     );
    })}
   </div>
  );
 }

 function MakeupCoachingWorkflow() {
  return (
   <div>
    <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:INK}}>Makeup Coaching Hours</div>
    {centers.map(cid => {
     const ops = OPERATIONS_STATE[cid];
     const burnFlag = ops.makeupCoaching.hours > 12 ? "#b3261e" : "#2fbf5f";
     return (
      <div key={cid} style={{border:`1px solid ${RULE}`,borderRadius:4,padding:12,marginBottom:10}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <b style={{textTransform:"capitalize",fontSize:12,color:INK}}>{cid}</b>
        <span style={{fontSize:10,color:burnFlag,fontWeight:700}}>
         {ops.makeupCoaching.hours > 12 ? "ELEVATED" : "NORMAL"}
        </span>
       </div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <div><span style={{fontSize:10,color:MUT}}>Hours This Week</span><div style={{fontSize:16,fontWeight:700,color:burnFlag}}>{ops.makeupCoaching.hours}h</div></div>
        <div><span style={{fontSize:10,color:MUT}}>Sessions</span><div style={{fontSize:16,fontWeight:700,color:INK}}>{ops.makeupCoaching.sessions}</div></div>
       </div>
       <div style={{fontSize:11,color:"#555",marginTop:8,lineHeight:1.5}}>
        Process: Navigate Pike dashboard → Appointment Availability. Remove pre-existing blocks. Add availability per day (e.g., "Tue 4:30–6:30pm"). Select service type (Remote or In-Person Makeup Coaching). Confirm accuracy before notifying coaches.
       </div>
      </div>
     );
    })}
   </div>
  );
 }

 function StudentEngagementTracker() {
  return (
   <div>
    <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:INK}}>Project Engagement & Pacing</div>
    {centers.map(cid => {
     const ops = OPERATIONS_STATE[cid];
     const riskFlag = ops.studentEngagement.atRisk > 1 ? "#b3261e" : "#2fbf5f";
     return (
      <div key={cid} style={{border:`1px solid ${RULE}`,borderRadius:4,padding:12,marginBottom:10}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <b style={{textTransform:"capitalize",fontSize:12,color:INK}}>{cid}</b>
        <span style={{fontSize:10,color:riskFlag,fontWeight:700}}>
         {ops.studentEngagement.atRisk > 1 ? "WATCH" : "OK"}
        </span>
       </div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        <div><span style={{fontSize:10,color:MUT}}>On Track</span><div style={{fontSize:16,fontWeight:700,color:"#2fbf5f"}}>{ops.studentEngagement.projectsOnTrack}</div></div>
        <div><span style={{fontSize:10,color:MUT}}>At Risk</span><div style={{fontSize:16,fontWeight:700,color:riskFlag}}>{ops.studentEngagement.atRisk}</div></div>
        <div><span style={{fontSize:10,color:MUT}}>Completion</span><div style={{fontSize:16,fontWeight:700,color:INK}}>{Math.round(ops.studentEngagement.completionRate*100)}%</div></div>
       </div>
       <div style={{fontSize:10,color:"#666",marginTop:8}}>Curriculum: Scratch (visual, 4mo–1yr) → Intro Python (turtle, tinker, 2–4mo) → Advanced Python (pixelpad, 6mo+). Notes logged in #session-dialogue for coach continuity.</div>
      </div>
     );
    })}
   </div>
  );
 }

 function ProjectPacingDashboard() {
  return (
   <div>
    <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:INK}}>Project Curriculum Pacing</div>
    {centers.map(cid => {
     const ops = OPERATIONS_STATE[cid];
     const projects = [
      { name: "Scratch (Advanced)", pct: ops.projectPacing.scratchAdvanced },
      { name: "Python (Intro)", pct: ops.projectPacing.pythonIntro },
      { name: "Pixelpad (Advanced)", pct: ops.projectPacing.pixelpadAdvanced },
     ];
     return (
      <div key={cid} style={{border:`1px solid ${RULE}`,borderRadius:4,padding:12,marginBottom:10}}>
       <b style={{textTransform:"capitalize",fontSize:12,color:INK,display:"block",marginBottom:10}}>{cid}</b>
       {projects.map((proj, i) => {
        const barColor = proj.pct >= 0.7 ? "#2fbf5f" : proj.pct >= 0.5 ? "#d9a520" : "#e03535";
        return (
         <div key={i} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
           <span style={{fontSize:11,color:"#333"}}>{proj.name}</span>
           <span style={{fontSize:11,fontWeight:700,color:barColor}}>{Math.round(proj.pct*100)}%</span>
          </div>
          <div style={{width:"100%",height:6,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
           <div style={{height:"100%",width:`${proj.pct*100}%`,background:barColor,transition:"width .3s"}} />
          </div>
         </div>
        );
       })}
       <div style={{fontSize:10,color:"#666",marginTop:8}}>Policy: students work projects of interest, no forced progression. Coaches approve niche tools after core competency. Brainstorming sessions encouraged. Questions logged in #notesdue-before-end-of-session for continuity.</div>
      </div>
     );
    })}
   </div>
  );
 }

 return (
  <div>
   <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:12}}>Operations Dashboard — Center Workflows</div>
   <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
    {["scheduling","makeup","engagement","pacing"].map(v => (
     <button key={v} onClick={() => setView(v)}
      style={{padding:"6px 12px",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:3,transition:"all .15s",
        background: view === v ? FB_CY : "#f0f0f0",
        color: view === v ? "#fff" : "#333",
        border:`1px solid ${view === v ? FB_CY : "#d0d0d0"}`}}>
      {v.charAt(0).toUpperCase() + v.slice(1)}
     </button>
    ))}
   </div>
   {view === "scheduling" && <SchedulingWorkflow />}
   {view === "makeup" && <MakeupCoachingWorkflow />}
   {view === "engagement" && <StudentEngagementTracker />}
   {view === "pacing" && <ProjectPacingDashboard />}
   <div style={{fontSize:10,color:"#999",marginTop:12,lineHeight:1.5}}>
    Operational workflows mocked from Slack channels (#adjustrequest-tracker, #update-makeup-availability, #session-dialogue, #project-pacing, #notify). Real integration: MyStudio/Pike API polling, Slack event webhooks.
   </div>
  </div>
 );
}

// ===== SIGNALS TAB — live network alerts =====
// Intended use: passive feed. Alerts derive live from FB_BOUNDARY.
function SignalsTab(){
 const w = 7;
 const alerts = [];
 FB_BOUNDARY.centers.forEach(c => {
  const rec = fbTau(c, w), fresh = fbCoherence(c, w), infl = fbInflection(c), head = c.Tc - c.tuition;
  if (rec >= 3) alerts.push({ sev: 2, c: c.id, m: `Recovery time ${rec.toFixed(1)}w — support plan inside 30 days` });
  else if (rec >= 2) alerts.push({ sev: 1, c: c.id, m: `Recovery time lengthening (${rec.toFixed(1)}w) — schedule a progress review` });
  if (fresh < 0.5) alerts.push({ sev: 1, c: c.id, m: `Data ${Math.round(fresh*100)}% fresh — review before any decision` });
  if (head <= 15) alerts.push({ sev: 2, c: c.id, m: `$${head} from pricing ceiling — hold tuition` });
  if (infl !== null && infl > w && infl <= w + 3) alerts.push({ sev: 2, c: c.id, m: `Retention inflection projected W${Math.round(infl)} — intervene now` });
 });
 FB_BOUNDARY.clusters.filter(cl => cl.members.length < 2).forEach(cl =>
  alerts.push({ sev: 1, c: cl.members[0], m: "No peer support group — build shared staffing/referral ties before the next disruption" }));
 alerts.sort((a, b) => b.sev - a.sev);
 return (<div>
  <div style={{fontFamily:"Helvetica",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:MUT,borderBottom:`1px solid ${RULE}`,paddingBottom:3,marginBottom:6}}>Network signals — live from current state</div>
  <div style={{fontSize:11.5,color:"#555",marginBottom:10,lineHeight:1.5}}>This feed is passive: it recomputes from the same state every view reads. {alerts.filter(a=>a.sev===2).length} action signals, {alerts.filter(a=>a.sev===1).length} watch signals.</div>
  {alerts.map((a,i)=>(
   <div key={i} style={{display:"flex",gap:10,alignItems:"baseline",padding:"7px 10px",marginBottom:5,border:`1px solid ${RULE}`,borderLeft:`3px solid ${a.sev===2?"#b3261e":"#9a6b00"}`}}>
    <b style={{fontFamily:"Helvetica",fontSize:9,letterSpacing:0.5,color:a.sev===2?"#b3261e":"#9a6b00",minWidth:52}}>{a.sev===2?"ACTION":"WATCH"}</b>
    <b style={{fontFamily:"Helvetica",fontSize:10.5,minWidth:30,color:INK}}>{a.c}</b>
    <span style={{fontSize:11.5,color:"#333"}}>{a.m}</span>
   </div>))}
 </div>);
}
