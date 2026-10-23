// Moteur 3D d'Axolo Run (three.js, chargé seulement au lancement du jeu).
// Le monde défile vers la caméra : l'axolotl reste en z = 0 et change de couloir ou saute.
// Décor et poissons : packs CC0 de Quaternius (models/), l'axolotl est modélisé ici.

import * as THREE from '../vendor/three.module.js';

const LANES = [-2.3, 0, 2.3];
const SWIM_Y = 1.0;
const FAR = -130;
const rand = (a, b) => a + Math.random() * (b - a);
// Bonus à attraper : durée en secondes (le bouclier dure jusqu'au prochain choc) ;
// step : secondes gagnées par niveau d'amélioration (5 niveaux, payés en crevettes)
export const POWERS = {
  turbo: { icon: '🚀', name: 'Turbo-bulle', color: '#ffb02e', dur: 6, step: 1, weight: 2 },
  magnet: { icon: '🧲', name: 'Aimant', color: '#ff4d6d', dur: 10, step: 2, weight: 3 },
  fins: { icon: '🦶', name: 'Palmes', color: '#3fd28a', dur: 10, step: 2, weight: 2 },
  x2: { icon: '⭐', name: 'Crevettes ×2', color: '#ffd23f', dur: 15, step: 3, weight: 2 },
  shield: { icon: '🫧', name: 'Bulle-bouclier', color: '#7fe9ff', dur: 0, step: 0, weight: 2 },
};
export const powerDur = (k, levels = {}) => POWERS[k].dur + (levels[k] || 0) * POWERS[k].step;
const TURBO_Y = 5.2;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- textures dessinées ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 8;
  return t;
}
function makeTextures() {
  return {
    sand: canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#e6cf9c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = Math.random() < .5 ? `rgba(160,120,70,${Math.random() * .18})` : `rgba(255,248,220,${Math.random() * .25})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      g.strokeStyle = 'rgba(170,130,80,.18)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 26) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + y) * 6); g.stroke(); }
    }, [10, 60]),
    dot: canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }),
    flame: canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 36, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,220,1)'); r.addColorStop(.25, 'rgba(255,214,90,.95)'); r.addColorStop(.55, 'rgba(255,110,30,.6)'); r.addColorStop(1, 'rgba(220,30,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }),
    spark: canvasTex(64, 64, (g) => {
      g.translate(32, 32); g.fillStyle = 'rgba(255,255,255,1)';
      for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, -30); g.lineTo(4, 0); g.lineTo(0, 30); g.lineTo(-4, 0); g.fill(); }
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 14); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-14, -14, 28, 28);
    }),
    ray: canvasTex(64, 256, (g) => {
      const lg = g.createLinearGradient(0, 0, 0, 256); lg.addColorStop(0, 'rgba(255,255,240,.9)'); lg.addColorStop(1, 'rgba(255,255,240,0)');
      g.fillStyle = lg; g.fillRect(0, 0, 64, 256);
      const sg = g.createLinearGradient(0, 0, 64, 0); sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = sg; g.fillRect(0, 0, 64, 256);
    }),
    shadow: canvasTex(128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(10,40,50,.55)'); r.addColorStop(1, 'rgba(10,40,50,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    }),
  };
}

// ---------- l'axolotl, à ses couleurs et avec ses tenues de la boutique ----------
function buildAxolotl(look) {
  const C = look.colors;
  const skin = (c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .5, sheen: .8, sheenRoughness: .5, sheenColor: new THREE.Color(C.belly), clearcoat: .3, clearcoatRoughness: .5, ...extra });
  const M = {
    main: skin(C.main), belly: skin(C.belly), dark: skin(C.dark),
    gills: skin(C.gills, { emissive: new THREE.Color(C.gills), emissiveIntensity: .3 }),
    gillTip: skin(C.gills, { emissive: new THREE.Color(C.gills), emissiveIntensity: .45 }),
    eye: new THREE.MeshPhysicalMaterial({ color: '#1a1020', roughness: .15, clearcoat: 1 }), white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    blush: new THREE.MeshBasicMaterial({ color: '#ff7aa8', transparent: true, opacity: .55 }), ink: new THREE.MeshBasicMaterial({ color: '#4a1a2e' }),
  };
  const mat = (c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, sheen: .4, ...extra });
  const sph = (r, m, s = [1, 1, 1], p = [0, 0, 0]) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), m); o.scale.set(...s); o.position.set(...p); return o; };
  const box = (w, h, d, m, p) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(...p); return o; };

  const root = new THREE.Group();
  const bob = new THREE.Group(); root.add(bob);
  // Tête (le museau regarde vers -z)
  const head = new THREE.Group(); bob.add(head);
  head.add(sph(.6, M.main, [1.28, .98, 1.08], [0, .1, -.45]));
  head.add(sph(.5, M.belly, [1.1, .62, .95], [0, -.16, -.55]));
  for (const sx of [-1, 1]) {
    head.add(sph(.1, M.eye, [1, 1.12, .9], [sx * .38, .25, -1.04]));
    head.add(sph(.032, M.white, [1, 1, 1], [sx * .38 + .03, .3, -1.12]));
    head.add(sph(.09, M.blush, [1.3, .55, .4], [sx * .55, .04, -.93]));
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.13, .022, 8, 24, Math.PI), M.ink);
  smile.rotation.z = Math.PI; smile.position.set(0, .06, -1.1); smile.scale.set(1.2, .8, 1); head.add(smile);
  // Branchies : 3 plumes de chaque côté
  const gills = [];
  const up = new THREE.Vector3(0, 1, 0);
  const stemGeo = new THREE.CapsuleGeometry(.06, .55, 6, 14);
  const filGeo = new THREE.CapsuleGeometry(.028, .16, 4, 8);
  for (const sx of [-1, 1]) {
    [[.5, .75], [.22, .3], [-.05, -.12]].forEach(([y, dy], k) => {
      const piv = new THREE.Group(); piv.position.set(sx * .66, y + .05, -.25); head.add(piv);
      const g = new THREE.Group(); piv.add(g);
      g.quaternion.setFromUnitVectors(up, new THREE.Vector3(sx, dy, .55).normalize());
      const stem = new THREE.Mesh(stemGeo, M.gills); stem.position.y = .32; g.add(stem);
      for (let i = 0; i < 6; i++) {
        for (const side of [-1, 1]) {
          const f = new THREE.Mesh(filGeo, M.gillTip);
          f.position.set(side * .07, .12 + i * .09, 0); f.rotation.z = -side; f.scale.setScalar(1 - i * .08);
          g.add(f);
        }
      }
      g.add(sph(.07, M.gillTip, [1, 1.2, 1], [0, .64, 0]));
      gills.push({ g, k });
    });
  }
  // Corps en segments qui se chevauchent et ondulent jusqu'à la queue
  const seg1 = new THREE.Group(); seg1.position.set(0, -.05, .1); bob.add(seg1);
  seg1.add(sph(.47, M.main, [1, .84, 1.4], [0, 0, .12]));
  seg1.add(sph(.4, M.belly, [.95, .55, 1.2], [0, -.14, .1]));
  const seg2 = new THREE.Group(); seg2.position.set(0, 0, .46); seg1.add(seg2);
  seg2.add(sph(.36, M.main, [1, .84, 1.5], [0, 0, .1]));
  seg2.add(sph(.2, M.gills, [.18, .9, 2.2], [0, .26, .15]));
  const tail = new THREE.Group(); tail.position.set(0, 0, .36); seg2.add(tail);
  tail.add(sph(.26, M.main, [.78, .92, 2.2], [0, .02, .32]));
  tail.add(sph(.24, M.gillTip, [.1, 1.05, 2.1], [0, .08, .48]));
  // Pattes : petites, potelées
  const legs = [];
  for (const [sx, z, parent] of [[-1, -.05, seg1], [1, -.05, seg1], [-1, .12, seg2], [1, .12, seg2]]) {
    const piv = new THREE.Group(); piv.position.set(sx * .4, -.2, z); parent.add(piv);
    piv.add(sph(.11, M.main, [1, .8, 1.25], [sx * .06, -.06, .04]));
    for (let f = 0; f < 3; f++) piv.add(sph(.04, M.dark, [1, .8, 1.3], [sx * (.1 + f * .02), -.13, -.04 + f * .05]));
    // Palmes (bonus) : cachées tant que le bonus n'est pas actif
    const fin = new THREE.Mesh(new THREE.ConeGeometry(.26, .62, 3), new THREE.MeshStandardMaterial({ color: '#2fd17f', emissive: '#18a85d', emissiveIntensity: .45, roughness: .4 }));
    fin.scale.set(1, 1, .2); fin.rotation.set(Math.PI / 2, 0, sx * .5); fin.position.set(sx * .3, -.16, .28); fin.visible = false; piv.add(fin);
    legs.push({ piv, sx, fin });
  }

  // ---------- tenues ----------
  const eq = look.equipped || {};
  const redCross = (p, s = 1) => { const g = new THREE.Group(); const red = mat('#ff4d6d', { emissive: new THREE.Color('#ff4d6d'), emissiveIntensity: .25 }); g.add(box(.2 * s, .06 * s, .02, red, [0, 0, 0]), box(.06 * s, .2 * s, .02, red, [0, 0, 0])); g.position.set(...p); return g; };
  const top = new THREE.Group(); top.position.set(0, .68, -.5); top.rotation.x = -.18; head.add(top);
  if (eq.head === 'nurse_cap') {
    const white = mat('#ffffff');
    top.add(new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .26, 32), white));
    const brim = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 10, 32), white); brim.rotation.x = Math.PI / 2; brim.position.y = -.12; top.add(brim);
    top.add(redCross([0, .02, -.37]));
    const back = redCross([0, .02, .37]); back.rotation.y = Math.PI; top.add(back);
  } else if (eq.head === 'flowers') {
    [['#ff8fb8', 0], ['#ffd23f', 1.26], ['#a0e7ff', 2.51], ['#ff8fb8', 3.77], ['#ffd23f', 5.03]].forEach(([c, a]) => {
      const f = new THREE.Group(); f.position.set(Math.cos(a) * .42, -.08, Math.sin(a) * .42);
      for (let i = 0; i < 5; i++) { const p = sph(.07, mat(c), [1, .45, 1.6], [Math.cos(i * 1.26) * .08, 0, Math.sin(i * 1.26) * .08]); p.rotation.y = -i * 1.26; f.add(p); }
      f.add(sph(.05, mat('#fff6b0'), [1, .7, 1], [0, .03, 0]));
      top.add(f);
    });
  } else if (eq.head === 'bow') {
    const pink = mat('#ff4f9a');
    const bow = new THREE.Group(); bow.position.set(.38, -.02, .05); bow.rotation.set(0, 0, -.35);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(.16, .32, 16), pink); c.rotation.z = s * Math.PI / 2; c.position.x = s * .17; bow.add(c); }
    bow.add(sph(.08, mat('#ff7ab3'))); top.add(bow);
  } else if (eq.head === 'beanie') {
    const blue = mat('#7c9cff');
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), blue); dome.scale.set(1.12, .9, 1); dome.position.y = -.12; top.add(dome);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.54, .08, 12, 36), mat('#a9bdff')); band.rotation.x = Math.PI / 2; band.position.y = -.12; band.scale.set(1.04, 1, 1); top.add(band);
    top.add(sph(.12, mat('#ffffff'), [1, 1, 1], [0, .36, 0]));
  } else if (eq.head === 'straw_hat') {
    const straw = mat('#f6d27a');
    top.add(new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, .04, 40), straw));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(.36, .42, .3, 32), mat('#f9dc8c')); crown.position.y = .16; top.add(crown);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.425, .425, .08, 32, 1, true), mat('#ff6f9e', { side: THREE.DoubleSide })); ribbon.position.y = .06; top.add(ribbon);
  }
  if (eq.eyes === 'round_glasses' || eq.eyes === 'heart_glasses') {
    const heart = eq.eyes === 'heart_glasses';
    const frame = mat(heart ? '#ff4f9a' : '#3a2a2a', heart ? { emissive: new THREE.Color('#ff4f9a'), emissiveIntensity: .3 } : {});
    for (const sx of [-1, 1]) {
      if (heart) {
        const s = new THREE.Shape(); s.moveTo(0, -.1); s.bezierCurveTo(-.16, .02, -.1, .14, 0, .06); s.bezierCurveTo(.1, .14, .16, .02, 0, -.1);
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: false }), frame); m.position.set(sx * .38, .25, -1.17); m.scale.setScalar(1.3); head.add(m);
      } else {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.14, .02, 8, 28), frame); ring.position.set(sx * .38, .25, -1.13); head.add(ring);
      }
    }
    head.add(box(.3, .025, .025, frame, [0, .27, -1.15]));
  }
  const neck = new THREE.Group(); neck.position.set(0, -.12, -.05); bob.add(neck);
  if (eq.neck === 'scarf') {
    const red = mat('#ff5c7a');
    const s = new THREE.Mesh(new THREE.TorusGeometry(.5, .11, 12, 36), red); s.rotation.x = Math.PI / 2; s.scale.set(1.05, 1, .9); neck.add(s);
    neck.add(box(.16, .4, .06, red, [.25, -.25, -.42]));
  } else if (eq.neck === 'bowtie') {
    const blue = mat('#3b7ddd');
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(.1, .2, 12), blue); c.rotation.z = s * Math.PI / 2; c.position.set(s * .1, -.12, -.5); neck.add(c); }
    neck.add(sph(.05, mat('#5b9bff'), [1, 1, 1], [0, -.12, -.5]));
  } else if (eq.neck === 'stethoscope') {
    const grey = mat('#5b6b7c');
    const t = new THREE.Mesh(new THREE.TorusGeometry(.5, .03, 8, 36, Math.PI * 1.3), grey); t.rotation.set(Math.PI / 2, 0, Math.PI * .85); neck.add(t);
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .04, 20), mat('#d7e0e8')); piece.rotation.x = Math.PI / 2; piece.position.set(.12, -.22, -.5); neck.add(piece);
  }
  if (eq.body === 'nurse_coat') {
    const white = mat('#ffffff');
    seg1.add(sph(.49, white, [1.03, .87, 1.3], [0, .01, .1]));
    const cross = redCross([0, .43, .2], 1.4); cross.rotation.x = -Math.PI / 2; seg1.add(cross);
  }

  root.userData = { bob, head, seg1, seg2, tail, gills, legs };
  return root;
}

function animateAxolotl(t, speedK, ax) {
  const u = ax.userData;
  const w = 7 + speedK * 4;
  u.bob.position.y = Math.sin(t * 2.2) * .08;
  u.head.rotation.y = Math.sin(t * w * .5) * .05;
  u.seg1.rotation.y = Math.sin(t * w - .6) * .16;
  u.seg2.rotation.y = Math.sin(t * w - 1.2) * .28;
  u.tail.rotation.y = Math.sin(t * w - 1.9) * .5;
  for (const { g, k } of u.gills) g.rotation.x = Math.sin(t * 3 + k * .9) * .18 + .1;
  for (const { piv, sx } of u.legs) piv.rotation.x = Math.sin(t * w + (sx > 0 ? 0 : Math.PI)) * .45;
}

// ---------- chargement des modèles (une seule fois par session) ----------
let assets = null;
async function loadAssets() {
  if (assets) return assets;
  const loader = new THREE.GLTFLoader();
  const load = (n) => loader.loadAsync(`models/${n}.glb`);
  const [decor, ...fish] = await Promise.all(['decor', 'fish1', 'fish2', 'fish3', 'whale', 'mantaray', 'dolphin'].map(load));
  assets = { decor, fish: Object.fromEntries(['fish1', 'fish2', 'fish3', 'whale', 'mantaray', 'dolphin'].map((n, i) => [n, fish[i]])) };
  return assets;
}

// ---------- la partie ----------
// host : élément plein écran ; ui : { onReady, onScore(state), onHit(hearts), onEnd(result) }
export async function mount(host, look, ui) {
  const canvas = document.createElement('canvas');
  canvas.className = 'run-canvas';
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const tex = makeTextures();
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color('#1b7aa3'), 0.017);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const shared = { uTime: { value: 0 }, uScroll: { value: 0 } };

  // Ciel sous-marin : dégradé et halo du soleil
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: shared.uTime },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float uTime;
      void main(){
        float h = vP.y;
        vec3 top = vec3(.36,.82,.97); vec3 mid = vec3(.09,.45,.62); vec3 low = vec3(.02,.14,.24);
        vec3 col = mix(mid, top, smoothstep(.05,.75,h));
        col = mix(col, low, smoothstep(.05,-.35,h));
        float sun = pow(max(dot(vP, normalize(vec3(.15,.85,-.5))),0.), 18.);
        float rip = sin(vP.x*40.+uTime*.8)*sin(vP.z*36.-uTime*.6)*.5+.5;
        col += vec3(1.,.97,.85) * sun * (.7 + .3*rip);
        gl_FragColor = vec4(col,1.);
      }`,
  }));
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#bff3ff', '#2a5a4a', 1.1));
  const sun = new THREE.DirectionalLight('#fff3d6', 2.4); sun.position.set(4, 14, -8); scene.add(sun);
  const rim = new THREE.DirectionalLight('#c8f4ff', 1.1); rim.position.set(-6, 5, 10); scene.add(rim);

  // Sable avec les reflets des vagues (caustiques)
  const floorMat = new THREE.MeshStandardMaterial({ map: tex.sand, roughness: .95, color: '#c9e6dc' });
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uScroll = shared.uScroll;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform float uTime; uniform float uScroll;
      float cst(vec2 p){ float c=0.; vec2 q=p; for(int i=0;i<3;i++){ q += vec2(sin(q.y*1.7+uTime*.9), cos(q.x*1.5-uTime*.7))*.45; c += .5/(abs(sin(q.x)+sin(q.y))*3.+.6);} return c; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec2 cp = vec2(vW.x, vW.z - uScroll) * .55;
      totalEmissiveRadiance += vec3(.75,.98,1.) * pow(cst(cp), 2.2) * .14 * smoothstep(60., 5., -vW.z);`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 420), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -170);
  scene.add(floor);

  const blob = (size, op = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex.shadow, transparent: true, depthWrite: false, opacity: op })); m.rotation.x = -Math.PI / 2; m.position.y = .02; return m; };
  const axo = buildAxolotl(look);
  axo.scale.setScalar(.9);
  scene.add(axo);
  const axoShadow = blob(2.4); scene.add(axoShadow);

  // ---------- décor importé et recoloré ----------
  const A = await loadAssets();
  const sway = (m, amp) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = shared.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp0 = modelMatrix * vec4(position,1.);
          float hh = max(position.y, 0.);
          transformed.x += sin(uTime*1.6 + wp0.z*.35 + wp0.x*.2) * ${amp.toFixed(3)} * hh * hh;
          transformed.z += cos(uTime*1.2 + wp0.x*.3) * ${(amp * .6).toFixed(3)} * hh * hh;`);
    };
    m.customProgramCacheKey = () => 'sway' + amp;
  };
  const kinds = {};
  for (const node of A.decor.scene.children) {
    const n = node.clone();
    const sz = new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3());
    n.userData.radius = Math.max(sz.x, sz.z) / 2;
    kinds[node.name] = n;
  }
  const tint = (name, color, o = {}) => kinds[name]?.traverse((m) => {
    if (!m.isMesh) return;
    m.material = m.material.clone();
    if (o.noMap) m.material.map = null;
    m.material.color = new THREE.Color(color);
    if (o.emissive) { m.material.emissive = new THREE.Color(o.emissive); m.material.emissiveIntensity = o.ei ?? .25; }
    m.material.roughness = o.rough ?? .8;
    if (o.sway) sway(m.material, o.sway);
  });
  tint('Grass_Wispy_Tall', '#7fe0a8', { sway: .06 });
  tint('Grass_Common_Tall', '#5fd39a', { sway: .06 });
  tint('Plant_7_Big', '#55c7a0', { sway: .025 });
  tint('Plant_7', '#6fe3b9', { sway: .03 });
  tint('Plant_1_Big', '#43b88f', { sway: .02 });
  tint('Plant_1', '#79e6c0', { sway: .03 });
  tint('Fern_1', '#5ad1b0', { sway: .03 });
  tint('Mushroom_Laetiporus', '#ff7f6e', { noMap: true, emissive: '#ff5a4a', ei: .18, rough: .6 });
  tint('Mushroom_Common', '#c58bff', { noMap: true, emissive: '#9a52ff', ei: .2, rough: .6 });
  tint('Bush_Common_Flowers', '#ff9fc4', { emissive: '#ff4f9a', ei: .12, sway: .01 });
  tint('Flower_3_Group', '#ffd38a', { sway: .04 });
  tint('Flower_4_Group', '#ff9fd8', { sway: .04 });
  for (const r of ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Round_5', 'Pebble_Square_2']) tint(r, '#9fc7d0', { rough: .9 });

  const world = { speed: 0, items: [], decor: [], fish: [], rays: [] };
  const mixers = [];

  function addDecor(z) {
    const side = Math.random() < .5 ? -1 : 1;
    const big = Math.random() < .45;
    const k = pick(big
      ? ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'Plant_7_Big', 'Plant_1_Big', 'Mushroom_Laetiporus', 'Grass_Wispy_Tall', 'Bush_Common_Flowers']
      : ['Grass_Wispy_Tall', 'Grass_Common_Tall', 'Plant_7', 'Plant_1', 'Fern_1', 'Mushroom_Common', 'Flower_3_Group', 'Flower_4_Group', 'Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Round_5', 'Pebble_Square_2', 'Mushroom_Laetiporus']);
    const proto = kinds[k]; if (!proto) return;
    const o = proto.clone();
    const s = k.startsWith('Rock') ? rand(1.4, 3.2) : k.startsWith('Grass') ? rand(2.2, 3.6) : k.startsWith('Pebble') ? rand(1, 2) : rand(1.6, 2.8);
    o.scale.setScalar(s);
    // Le couloir de nage (|x| < 4) reste toujours dégagé
    o.position.set(side * (4.3 + proto.userData.radius * s + (big ? rand(0, 8) : rand(0, 6))), 0, z);
    o.rotation.y = rand(0, Math.PI * 2);
    scene.add(o); world.decor.push(o);
  }
  for (let z = 10; z > -150; z -= 1.15) addDecor(z);
  for (let z = 10; z > -150; z -= 9) addDecor(z);

  const rayMat = new THREE.MeshBasicMaterial({ map: tex.ray, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(2, 5), 46), rayMat.clone());
    m.position.set(rand(-16, 16), 20, rand(-90, -8)); m.rotation.set(0, rand(-.5, .5), rand(-.35, -.2)); m.userData.ph = rand(0, 6);
    scene.add(m); world.rays.push(m);
  }

  // Poissons animés : redimensionnés et tournés pour nager vers -z
  function makeFish(name, length) {
    const g = A.fish[name];
    const obj = THREE.cloneSkinned(g.scene);
    const wrap = new THREE.Group(); wrap.add(obj);
    obj.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); o.material.roughness = .55; } });
    obj.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(obj, true).getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(length / Math.max(size.x, size.z));
    obj.updateMatrixWorld(true);
    obj.position.sub(new THREE.Box3().setFromObject(obj, true).getCenter(new THREE.Vector3()));
    if (size.x > size.z) wrap.rotation.y = Math.PI / 2;
    const mixer = new THREE.AnimationMixer(obj);
    if (g.animations[0]) { const a = mixer.clipAction(g.animations[0]); a.play(); a.time = Math.random() * 2; }
    mixers.push(mixer);
    return wrap;
  }
  for (let i = 0; i < 22; i++) {
    const [n, len] = pick([['fish1', 1.7], ['fish2', 1.5], ['fish3', 1.3], ['dolphin', 3.4]]);
    const f = makeFish(n, len * rand(.8, 1.2));
    f.position.set((Math.random() < .5 ? -1 : 1) * rand(4.5, 13), 0, rand(-140, 10));
    f.userData = { y: rand(1.8, 6.5), ph: rand(0, 6), drift: rand(.55, .8), swim: rand(1, 3) };
    scene.add(f); world.fish.push(f);
  }
  const whale = makeFish('whale', 26); whale.position.set(-34, 0, -95); whale.rotation.y += .5;
  whale.userData = { y: 13, ph: 0, drift: .05, swim: 1.2 }; scene.add(whale); world.fish.push(whale);
  const manta = makeFish('mantaray', 5); manta.position.set(9, 0, -60);
  manta.userData = { y: 9, ph: 1, drift: .3, swim: 2 }; scene.add(manta); world.fish.push(manta);

  // Plancton qui flotte, pour sentir la vitesse
  const PLK = 700;
  const plkGeo = new THREE.BufferGeometry();
  const plkPos = new Float32Array(PLK * 3);
  for (let i = 0; i < PLK; i++) { plkPos[i * 3] = rand(-22, 22); plkPos[i * 3 + 1] = rand(0, 16); plkPos[i * 3 + 2] = rand(-90, 12); }
  plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
  scene.add(new THREE.Points(plkGeo, new THREE.PointsMaterial({ map: tex.dot, size: .16, color: '#d9fbff', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending })));

  // Bulles
  const bubbles = [];
  const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#e8fdff', roughness: 0, transparent: true, opacity: .35, clearcoat: 1, emissive: '#bff6ff', emissiveIntensity: .25 });
  const bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
  function puff(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(bubbleGeo, bubbleMat); b.scale.setScalar(rand(.04, .11));
      b.position.set(x + rand(-.4, .4), y + rand(0, .3), z + rand(-.2, .3)); b.userData.v = rand(1.2, 2.4); b.userData.life = rand(1.2, 2.4);
      scene.add(b); bubbles.push(b);
    }
  }

  // ---------- crevettes et méduses ----------
  const shrimpMat = new THREE.MeshPhysicalMaterial({ color: '#ff8a4c', emissive: '#ff5a2a', emissiveIntensity: .55, roughness: .35, clearcoat: .8 });
  const shrimpRing = new THREE.MeshStandardMaterial({ color: '#ffd2b0', emissive: '#ff8a4c', emissiveIntensity: .3 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#1a1020', roughness: .15, clearcoat: 1 });
  function makeShrimp() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.TorusGeometry(.26, .1, 14, 28, Math.PI * 1.35), shrimpMat); body.rotation.z = .5; g.add(body);
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(.26, .112, 6, 12, .14), shrimpRing); s.rotation.z = 1 + i * .8; g.add(s); }
    const fan = new THREE.Mesh(new THREE.ConeGeometry(.12, .2, 3), shrimpMat); fan.position.set(.2, -.22, 0); fan.rotation.z = 2.2; g.add(fan);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 8), eyeMat); eye.position.set(-.27, .1, .06); g.add(eye);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, color: '#ffb37a', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(1.3, 1.3, 1); g.add(glow);
    g.scale.setScalar(1.15);
    return g;
  }
  const jellyBell = new THREE.MeshPhysicalMaterial({ color: '#d58cff', emissive: '#a24dff', emissiveIntensity: .7, transparent: true, opacity: .78, roughness: .2, clearcoat: 1, side: THREE.DoubleSide });
  const jellyInner = new THREE.MeshBasicMaterial({ color: '#ffd6ff', transparent: true, opacity: .6 });
  const jellyTent = new THREE.MeshBasicMaterial({ color: '#f0b8ff', transparent: true, opacity: .75 });
  function makeJelly() {
    const g = new THREE.Group();
    const bell = new THREE.Mesh(new THREE.SphereGeometry(.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), jellyBell); bell.scale.set(1, .85, 1); g.add(bell);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), jellyInner); inner.position.y = .05; g.add(inner);
    const tents = [];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const pts = Array.from({ length: 6 }, (_, k) => new THREE.Vector3(Math.cos(a) * .45, -k * .32, Math.sin(a) * .45));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .035, 6), jellyTent);
      g.add(tube); tents.push(tube);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, color: '#c77dff', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(3, 3, 1); g.add(glow);
    g.userData.tents = tents;
    return g;
  }

  // Filet de pêche suspendu : on passe dessous en roulade
  const netTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(240,235,215,.95)'; g.lineWidth = 5;
    for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
  }, [2.2, 1.6]);
  const wood = new THREE.MeshStandardMaterial({ color: '#b98a55', roughness: .9 });
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .9 });
  const floatMat = new THREE.MeshStandardMaterial({ color: '#ff7a3d', emissive: '#ff5a1a', emissiveIntensity: .35, roughness: .5 });
  function makeNet() {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 3, 10), wood); post.position.set(sx * 1.05, 1.5, 0); g.add(post); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.3, 10), wood); beam.rotation.z = Math.PI / 2; beam.position.y = 2.9; g.add(beam);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.75, 8, 4), netMat); net.position.y = 2.0; g.add(net);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), floatMat); f.position.set(-.8 + i * .53, 1.13, 0); g.add(f); }
    g.userData.net = net;
    return g;
  }
  // Bouée du record : elle arrive pile à la distance de son meilleur score
  function makeBuoy(meters) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 4.2, 10), new THREE.MeshStandardMaterial({ color: '#ffffff' })); pole.position.y = 2.1; g.add(pole);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.42, .1, 12, 28), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ffffff' : '#ff3d6e', emissive: i % 2 ? '#ffffff' : '#ff3d6e', emissiveIntensity: .4 })); r.rotation.x = Math.PI / 2; r.position.y = .4 + i * .22; g.add(r); }
    const flag = canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#ffd23f'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 22); c.fill();
      c.fillStyle = '#4a2a00'; c.textAlign = 'center'; c.font = '900 44px Nunito, sans-serif'; c.fillText('🏆 RECORD', w / 2, 58); c.font = '800 34px Nunito, sans-serif'; c.fillText(`${meters} m`, w / 2, 102);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flag, depthWrite: false })); sp.scale.set(2.2, 1.1, 1); sp.position.set(-1.1, 4.6, 0); g.add(sp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, color: '#ffd23f', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(5, 5, 1); glow.position.set(-1.1, 4.4, 0); g.add(glow);
    return g;
  }

  // Bonus : bulle de verre lumineuse avec son icône, qui tourne sur elle-même
  const iconTex = {};
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, transparent: true, opacity: .28, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6 });
  function makePower(type) {
    const P = POWERS[type];
    iconTex[type] = iconTex[type] || canvasTex(128, 128, (c) => { c.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(P.icon, 64, 72); });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.62, 28, 20), glassMat));
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex[type], depthWrite: false })); icon.scale.set(.85, .85, 1); g.add(icon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.78, .05, 10, 40), new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 1.2 }));
    g.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, color: P.color, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(3.2, 3.2, 1); g.add(glow);
    g.userData.ring = ring;
    return g;
  }

  function removeItem(it) {
    scene.remove(it);
    if (it.userData.shadow) scene.remove(it.userData.shadow);
  }
  function addRow(z) {
    const free = Math.floor(Math.random() * 3);
    const lanes = [0, 1, 2].filter((l) => l !== free);
    const n = Math.random() < .35 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const l = lanes[i];
      const roll = Math.random();
      if (st.dist > 120 && roll < .3) {
        const n = makeNet(); n.position.set(LANES[l], 0, z);
        n.userData = { ...n.userData, type: 'net', lane: l };
        scene.add(n); world.items.push(n);
      } else if (roll < .65) {
        const r = kinds['Rock_Medium_' + (1 + Math.floor(Math.random() * 3))].clone();
        r.scale.setScalar(rand(.62, .72)); r.rotation.y = rand(0, 6);
        r.position.set(LANES[l], -.05, z);
        r.userData = { type: 'rock', lane: l, h: 1.15 };
        const sh = blob(2.6, .8); sh.position.set(LANES[l], .03, z); r.userData.shadow = sh; scene.add(sh);
        scene.add(r); world.items.push(r);
      } else {
        const j = makeJelly(); j.position.set(LANES[l], 1.5, z);
        j.userData = { ...j.userData, type: 'jelly', lane: l, ph: rand(0, 6) };
        scene.add(j); world.items.push(j);
      }
    }
    // De temps en temps, un bonus devant la ligne de crevettes
    if (st.dist > 60 && st.dist - st.lastPower > 120 && !st.pw.turbo && Math.random() < .35) {
      st.lastPower = st.dist;
      const bag = Object.entries(POWERS).flatMap(([k, v]) => Array(v.weight).fill(k));
      const type = pick(bag);
      const o = makePower(type); o.position.set(LANES[free], SWIM_Y + .35, z - 4.2);
      o.userData = { ...o.userData, type: 'power', power: type, lane: free, ph: rand(0, 6) };
      scene.add(o); world.items.push(o);
    }
    // Une ligne de crevettes dans le couloir libre (parfois en arc, à attraper en sautant)
    const high = Math.random() < .25;
    for (let k = 0; k < 4; k++) {
      const s = makeShrimp();
      s.position.set(LANES[free], high ? SWIM_Y + .4 + Math.sin(k / 3 * Math.PI) * 1.9 : SWIM_Y + .1, z - 2 + k * 1.6);
      s.userData = { type: 'shrimp', lane: free, ph: k };
      scene.add(s); world.items.push(s);
    }
  }

  // ---------- état ----------
  const st = { mode: 'intro', lane: 1, x: 0, y: SWIM_Y, vy: 0, dist: 0, shrimps: 0, hearts: 3, hurt: 0, nextRow: FAR, t: 0, camBlend: 0, shake: 0, roll: 0, dive: false, calm: 0, milestone: 0, buoy: null, recordDone: false, pw: {}, shield: false, inv: 0, lastPower: 0 };
  let bestDist = look.bestDist || 0;
  let levels = look.levels || {};
  let startShield = !!look.startShield;
  // Vitesse selon la distance : monte vite au début puis de plus en plus doucement (15 → 32 au plus)
  const speedAt = (m) => 15 + 17 * (1 - Math.exp(-m / 900));
  // Écart entre deux rangées : toujours environ une seconde pour réagir, même à fond
  const rowGap = (v) => v * (1.12 - .22 * (v - 15) / 17);
  const emit = () => ui.onScore && ui.onScore({
    dist: Math.floor(st.dist), shrimps: st.shrimps, hearts: st.hearts, shield: st.shield,
    powers: Object.entries(st.pw).filter(([, v]) => v > 0).map(([k, v]) => ({ k, left: v, dur: powerDur(k, levels), icon: POWERS[k].icon })),
  });

  function start(best, opts = {}) {
    if (best !== undefined) bestDist = best;
    if (opts.levels) levels = opts.levels;
    if (opts.startShield !== undefined) startShield = opts.startShield;
    for (const it of world.items) removeItem(it);
    world.items = [];
    if (st.buoy) { scene.remove(st.buoy); }
    Object.assign(st, { mode: 'play', lane: 1, x: 0, y: SWIM_Y, vy: 0, dist: 0, shrimps: 0, hearts: 3, hurt: 0, nextRow: FAR, roll: 0, dive: false, calm: 0, milestone: 0, buoy: null, recordDone: false, pw: {}, shield: false, inv: 0, lastPower: 0 });
    st.shield = startShield;
    world.speed = speedAt(0);
    for (let z = -34; z > FAR; z -= rowGap(world.speed)) addRow(z);
    emit();
  }
  const move = (d) => { if (st.mode === 'play') st.lane = Math.max(0, Math.min(2, st.lane + d)); };
  const jump = () => { if (st.mode === 'play' && !st.pw.turbo && st.y <= SWIM_Y + .05) { st.roll = 0; st.vy = st.pw.fins ? 13.5 : 9.5; puff(st.x, st.y, .6, st.pw.fins ? 10 : 5); if (st.pw.fins) wave(st.x); } };
  // Vers le bas : plongeon s'il est en l'air (puis roulade à l'arrivée), sinon roulade
  const down = () => {
    if (st.mode !== 'play' || st.pw.turbo) return;
    if (st.y > SWIM_Y + .05) { st.vy = -24; st.dive = true; } else { st.roll = .7; puff(st.x, .6, .4, 4); }
  };
  let god = false; // tests automatiques uniquement
  // Ramasser un bonus
  function activate(type) {
    const P = POWERS[type];
    if (type === 'shield') st.shield = true; else st.pw[type] = powerDur(type, levels);
    if (type === 'turbo') {
      st.roll = 0; st.dive = false; st.calm = powerDur('turbo', levels) + 1.2;
      // On dégage la piste devant pour décoller tranquille
      for (let i = world.items.length - 1; i >= 0; i--) {
        const it = world.items[i];
        if (it.position.z > -70 && it.userData.type !== 'shrimp') { removeItem(it); world.items.splice(i, 1); }
      }
    }
    puff(st.x, st.y + .4, 0, 12);
    ui.onPower && ui.onPower(type, P);
    emit();
  }

  function hit() {
    if (st.hurt > 0 || god || st.pw.turbo || st.inv > 0) return;
    // La bulle-bouclier encaisse le choc à sa place
    if (st.shield) { st.shield = false; st.inv = 1; st.shake = .25; puff(st.x, st.y + .3, 0, 16); ui.onShield && ui.onShield(); emit(); return; }
    st.hearts--; st.hurt = 1.4; st.shake = .5;
    if (navigator.vibrate) navigator.vibrate(60);
    ui.onHit && ui.onHit(st.hearts);
    emit();
    if (st.hearts <= 0) { st.mode = 'over'; st.roll = 0; st.pw = {}; st.shield = false; ui.onEnd && ui.onEnd({ shrimps: st.shrimps, dist: Math.floor(st.dist) }); }
  }

  // Gestes : glisser pour changer de couloir ou sauter
  let touch = null;
  const onDown = (e) => { touch = { x: e.clientX, y: e.clientY, done: false }; };
  const onMove = (e) => {
    if (!touch || touch.done) return;
    const dx = e.clientX - touch.x; const dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    touch.done = true;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else down();
  };
  const onUp = () => { touch = null; };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowUp' || e.key === ' ') jump();
    else if (e.key === 'ArrowDown') down();
    else return;
    e.preventDefault();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);

  // Bulle-bouclier et lueur du turbo autour de l'axolotl
  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#bff6ff', roughness: 0, transparent: true, opacity: .3, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, depthWrite: false }));
  shieldMesh.visible = false; scene.add(shieldMesh);
  const turboGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, color: '#ffb02e', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  turboGlow.scale.set(2.6, 2.6, 1); turboGlow.visible = false; scene.add(turboGlow);
  let baseFov = 62;
  // Aimant : deux anneaux rouge et bleu qui pulsent
  const magnetFx = new THREE.Group();
  for (const [c, r] of [['#ff3d5a', 1.15], ['#3d8bff', 1.35]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .05, 10, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
    magnetFx.add(ring);
  }
  magnetFx.visible = false; scene.add(magnetFx);
  // ×2 : aura dorée
  const goldAura = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dot, color: '#ffd23f', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  goldAura.scale.set(3.4, 3.4, 1); goldAura.visible = false; scene.add(goldAura);
  // Petites particules (flammes, étincelles, « +2 », ondes) : réserve réutilisée
  const fx = [];
  function particle(map, color, pos, o = {}) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: o.op ?? 1, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending }));
    m.position.copy(pos); m.scale.setScalar(o.s0 ?? .5);
    scene.add(m);
    fx.push({ m, life: o.life ?? .6, max: o.life ?? .6, v: o.v || new THREE.Vector3(), s0: o.s0 ?? .5, s1: o.s1 ?? .1, op: o.op ?? 1, scroll: o.scroll ?? 1, colorTo: o.colorTo });
  }
  const plusTex = canvasTex(128, 64, (c) => { c.font = '900 52px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 8; c.strokeStyle = '#a05a00'; c.strokeText('+2', 64, 34); c.fillStyle = '#ffd23f'; c.fillText('+2', 64, 34); });
  const waveMat = new THREE.MeshBasicMaterial({ color: '#7dffb5', transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  const waves = [];
  function wave(x) {
    const r = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 40), waveMat.clone());
    r.rotation.x = -Math.PI / 2; r.position.set(x, .05, 0); scene.add(r); waves.push({ r, life: .7 });
  }
  const _v = new THREE.Vector3();
  // Bonus qui se termine : l'effet clignote les 2 dernières secondes
  const fading = (k, t) => st.pw[k] > 0 && (st.pw[k] > 2 || Math.floor(t * 8) % 2 === 0);

  // ---------- rendu ----------
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .45, .45, .86));
  composer.addPass(new THREE.OutputPass());
  function resize() {
    const w = host.clientWidth || window.innerWidth; const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; baseFov = w / h < .7 ? 70 : 58; camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const camChase = new THREE.Vector3(); const camLook = new THREE.Vector3(); const look2 = new THREE.Vector3();
  const introPos = new THREE.Vector3(2.2, 1.9, -4.6); const yAxis = new THREE.Vector3(0, 1, 0); const intro = new THREE.Vector3();

  function update(dt) {
    st.t += dt;
    const t = st.t;
    shared.uTime.value = t;
    const playing = st.mode === 'play';
    const sp = playing ? world.speed * (st.pw.turbo ? 1.6 : 1) : st.mode === 'intro' ? 4 : 0;
    // Minuteurs des bonus
    if (playing) {
      for (const k of Object.keys(st.pw)) {
        if (st.pw[k] <= 0) continue;
        st.pw[k] = Math.max(0, st.pw[k] - dt);
        if (!st.pw[k]) { if (k === 'turbo') { st.inv = 1.6; st.vy = 0; } emit(); }
      }
      st.inv = Math.max(0, st.inv - dt);
    }
    if (playing) {
      world.speed = speedAt(st.dist); st.dist += sp * dt * .5;
      // Palier tous les 500 m : annonce et une rangée sans obstacle pour souffler
      const m = Math.floor(st.dist / 500);
      if (m > st.milestone) { st.milestone = m; st.calm = 1.3; ui.onMilestone && ui.onMilestone(m * 500); puff(st.x, st.y + .5, 0, 10); }
      // Bouée du record : posée pour arriver exactement à la distance de son record
      if (bestDist > 60 && !st.buoy && !st.recordDone && bestDist - st.dist < 62 && bestDist > st.dist) {
        st.buoy = makeBuoy(bestDist); st.buoy.position.set(3.75, 0, -(bestDist - st.dist) * 2); scene.add(st.buoy);
      }
      if (!st.recordDone && bestDist > 60 && st.dist >= bestDist) { st.recordDone = true; ui.onRecord && ui.onRecord(); puff(st.x, st.y + .5, 0, 14); }
    }
    if (st.buoy) { st.buoy.position.z += sp * dt; if (st.buoy.position.z > 14) { scene.remove(st.buoy); st.buoy = null; } }
    st.calm = Math.max(0, st.calm - dt);
    const dz = sp * dt;
    shared.uScroll.value -= dz;
    tex.sand.offset.y += dz / 7;

    st.x += (LANES[st.lane] - st.x) * Math.min(1, dt * 12);
    if (st.pw.turbo) {
      // Turbo-bulle : il monte sur son jet de bulles et file au-dessus de tout
      st.y += (TURBO_Y - st.y) * Math.min(1, dt * 4); st.vy = 0;
      puff(st.x + rand(-.2, .2), st.y - .5, .5, 2);
      st.turboShrimp = (st.turboShrimp || 0) - dt;
      if (st.turboShrimp <= 0) {
        st.turboShrimp = .14;
        const s = makeShrimp(); const l = Math.floor(Math.random() * 3);
        s.position.set(LANES[l], TURBO_Y, -45); s.userData = { type: 'shrimp', lane: l, ph: rand(0, 6), sky: true };
        scene.add(s); world.items.push(s);
      }
    } else {
      st.vy -= 26 * dt;
    }
    st.y = Math.max(SWIM_Y, st.y + st.vy * dt);
    if (st.y === SWIM_Y) { if (st.dive) { st.dive = false; st.roll = .7; st.shake = .15; puff(st.x, .5, .3, 6); } st.vy = 0; }
    st.roll = Math.max(0, st.roll - dt);
    // Roulade : il se met en boule, tourne sur lui-même et rase le sable
    const rk = st.roll > 0 ? Math.sin(Math.min(1, (0.7 - st.roll) / .7) * Math.PI) : 0;
    axo.position.set(st.x, st.y - rk * .55, 0);
    axo.scale.set(.9, .9 * (1 - rk * .3), .9 * (1 - rk * .35));
    axo.rotation.z = (LANES[st.lane] - st.x) * -.25;
    axo.rotation.x = st.roll > 0 ? -((0.7 - st.roll) / .7) * Math.PI * 2 : THREE.MathUtils.clamp(-st.vy * .03, -.4, .4);
    axo.visible = !(st.hurt > 0 && Math.floor(t * 14) % 2 === 0);
    if (st.pw.turbo) axo.rotation.x = -.35 + Math.sin(t * 8) * .05;
    shieldMesh.visible = st.shield || st.inv > 0;
    shieldMesh.position.set(st.x, axo.position.y + .05, 0);
    shieldMesh.material.opacity = st.shield ? .3 + Math.sin(t * 5) * .06 : .15 * (Math.floor(t * 10) % 2);
    shieldMesh.rotation.y = t;
    turboGlow.visible = fading('turbo', t);
    turboGlow.position.set(st.x, st.y - .6, .6);
    // Turbo : aura de flammes qui lèche le corps et file vers l'arrière
    if (fading('turbo', t)) {
      for (let i = 0; i < 4; i++) {
        // Sur le pourtour du corps (côtés, dessus, queue), jamais devant le visage
        const side = i % 2 ? 1 : -1;
        _v.set(st.x + side * rand(.55, .95), st.y + rand(-.3, .75), rand(-.2, 1.3));
        particle(tex.flame, i % 3 ? '#ffb347' : '#ff5a1f', _v, { s0: rand(.45, .8), s1: .1, life: rand(.3, .5), op: .85, v: new THREE.Vector3(side * rand(.2, .8), rand(1.2, 2.6), rand(3, 6)), scroll: .2 });
      }
      if (Math.random() < .5) particle(tex.flame, '#ff7a2a', _v.set(st.x + rand(-.3, .3), st.y + .2, rand(1, 1.6)), { s0: rand(.8, 1.1), s1: .2, life: .45, op: .8, v: new THREE.Vector3(0, .8, 5), scroll: .2 });
    }
    // Aimant
    magnetFx.visible = fading('magnet', t);
    if (magnetFx.visible) {
      magnetFx.position.set(st.x, axo.position.y + .1, 0);
      magnetFx.children.forEach((r, i) => { const p = 1 + Math.sin(t * 6 + i * 1.6) * .12; r.scale.setScalar(p); r.rotation.set(Math.PI / 2 + Math.sin(t * 2 + i) * .5, t * (i ? -1.5 : 1.5), 0); });
    }
    // ×2 : aura dorée et étincelles
    goldAura.visible = fading('x2', t);
    if (goldAura.visible) {
      goldAura.position.set(st.x, axo.position.y + .2, 0); goldAura.material.opacity = .4 + Math.sin(t * 6) * .15;
      if (Math.random() < dt * 14) particle(tex.spark, '#ffe27a', _v.set(st.x + rand(-1, 1), axo.position.y + rand(-.4, 1), rand(-.6, .6)), { s0: .5, s1: .05, life: .6, v: new THREE.Vector3(0, .8, 0) });
    }
    // Palmes
    const finsOn = fading('fins', t);
    for (const l of axo.userData.legs) l.fin.visible = finsOn;
    if (st.pw.fins && st.y > SWIM_Y + .3 && Math.random() < dt * 30) puff(st.x + rand(-.3, .3), st.y - .4, .4, 1);
    // Champ de vision élargi pendant le turbo : sensation de vitesse
    const fovT = baseFov + (st.pw.turbo ? 12 : 0);
    if (Math.abs(camera.fov - fovT) > .05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    axo.rotation.y += ((st.mode === 'over' ? Math.PI : 0) - axo.rotation.y) * dt * 3;
    animateAxolotl(t, sp / 30, axo);
    axoShadow.position.set(st.x, .03, .2);
    axoShadow.scale.setScalar(1 - Math.min(.5, (st.y - SWIM_Y) * .15));
    st.hurt = Math.max(0, st.hurt - dt);
    if (Math.random() < dt * 1.5) puff(st.x + (Math.random() < .5 ? -.6 : .6), st.y + .5, -.3, 1);

    for (let i = world.items.length - 1; i >= 0; i--) {
      const it = world.items[i]; const u = it.userData;
      it.position.z += dz;
      if (u.shadow) u.shadow.position.z = it.position.z;
      if (u.type === 'shrimp') {
        it.rotation.y += dt * 3;
        if (!u.sky) it.position.y += Math.sin(t * 3 + u.ph) * .004;
        // Aimant : les crevettes proches filent vers l'axolotl
        if (st.pw.magnet && it.position.z > -22 && it.position.z < 1) {
          const k = Math.min(1, dt * 7);
          it.position.x += (st.x - it.position.x) * k; it.position.y += (st.y - it.position.y) * k; it.position.z += (0 - it.position.z) * k * .6;
          if (Math.random() < dt * 20) particle(tex.spark, Math.random() < .5 ? '#ff6b80' : '#7fb6ff', it.position, { s0: .45, s1: .05, life: .4 });
        }
      }
      if (u.type === 'power') { it.rotation.y += dt * 2; it.position.y = SWIM_Y + .35 + Math.sin(t * 2.5 + u.ph) * .15; u.ring.rotation.x = t * 1.7; }
      if (u.type === 'net') u.net.rotation.x = Math.sin(t * 1.5 + it.position.z * .1) * .08;
      if (u.type === 'jelly') {
        it.position.y = 1.5 + Math.sin(t * 2 + u.ph) * .25;
        const p = 1 + Math.sin(t * 4 + u.ph) * .07; it.children[0].scale.set(p, .85 / p, p);
        u.tents.forEach((tb, k) => { tb.rotation.x = Math.sin(t * 3 + k) * .12; tb.rotation.z = Math.cos(t * 2.5 + k) * .12; });
      }
      if (playing && Math.abs(it.position.z) < 1 && Math.abs(it.position.x - st.x) < 1.1) {
        if (u.type === 'shrimp' && Math.abs(it.position.y - st.y) < 1.1) {
          st.shrimps += st.pw.x2 ? 2 : 1; puff(it.position.x, it.position.y, 0, 4); emit();
          if (st.pw.x2) particle(plusTex, '#ffffff', _v.set(it.position.x, it.position.y + .6, 0), { s0: 1.1, s1: 1.4, life: .8, v: new THREE.Vector3(0, 2.2, 0), normal: true, scroll: 0 });
          removeItem(it); world.items.splice(i, 1); continue;
        }
        if (u.type === 'power' && Math.abs(it.position.y - st.y) < 1.6) {
          removeItem(it); world.items.splice(i, 1); activate(u.power); continue;
        }
        if ((u.type === 'rock' && st.y - SWIM_Y < u.h) || u.type === 'jelly' || (u.type === 'net' && st.roll <= 0)) hit();
      }
      if (it.position.z > 12) { removeItem(it); world.items.splice(i, 1); }
    }
    if (playing) {
      st.nextRow += dz;
      if (st.nextRow - FAR >= rowGap(world.speed)) { if (st.calm <= 0) addRow(FAR); st.nextRow = FAR; }
      if (Math.floor(st.t * 4) !== Math.floor((st.t - dt) * 4)) emit();
    }

    for (const o of world.decor) { o.position.z += dz; if (o.position.z > 14) o.position.z -= 160; }
    for (const r of world.rays) { r.position.z += dz * .15; if (r.position.z > 6) r.position.z -= 100; r.material.opacity = .1 + Math.sin(t * .7 + r.userData.ph) * .06; }
    for (const f of world.fish) {
      f.position.z += dz * f.userData.drift - f.userData.swim * dt;
      f.position.y = f.userData.y + Math.sin(t * .8 + f.userData.ph) * .4;
      if (f.position.z > 20) f.position.z -= 160;
      if (f.position.z < -150) f.position.z += 160;
    }
    const pp = plkGeo.attributes.position;
    for (let i = 0; i < PLK; i++) { let z = pp.array[i * 3 + 2] + dz * .9 + dt * .3; if (z > 12) z -= 102; pp.array[i * 3 + 2] = z; }
    pp.needsUpdate = true;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.position.y += b.userData.v * dt; b.position.z += dz; b.position.x += Math.sin(t * 5 + i) * dt * .2; b.userData.life -= dt;
      if (b.userData.life <= 0) { scene.remove(b); bubbles.splice(i, 1); }
    }
    for (const m of mixers) m.update(dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= dt;
      if (f.life <= 0) { scene.remove(f.m); f.m.material.dispose(); fx.splice(i, 1); continue; }
      const k = 1 - f.life / f.max;
      f.m.position.addScaledVector(f.v, dt); f.m.position.z += dz * f.scroll;
      f.m.scale.setScalar(f.s0 + (f.s1 - f.s0) * k);
      f.m.material.opacity = f.op * (1 - k * k);
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i]; w.life -= dt;
      if (w.life <= 0) { scene.remove(w.r); w.r.geometry.dispose(); w.r.material.dispose(); waves.splice(i, 1); continue; }
      const k = 1 - w.life / .7; w.r.scale.setScalar(1 + k * 4); w.r.material.opacity = .8 * (1 - k);
    }

    // Caméra : de face sur l'écran d'accueil et de fin, derrière l'axolotl en jeu
    st.camBlend += ((playing ? 1 : 0) - st.camBlend) * Math.min(1, dt * 2.2);
    camChase.set(st.x * .55, 3.3 + (st.y - SWIM_Y) * .35, 6.4);
    camLook.set(st.x * .4, 1.3, -7);
    intro.copy(introPos).applyAxisAngle(yAxis, Math.sin(t * .25) * .35); intro.x += st.x;
    camera.position.lerpVectors(intro, camChase, st.camBlend);
    look2.set(st.x, 1.2, -.4).lerp(camLook, st.camBlend);
    if (st.shake > 0) { camera.position.x += rand(-1, 1) * st.shake * .3; camera.position.y += rand(-1, 1) * st.shake * .3; st.shake = Math.max(0, st.shake - dt * 1.5); }
    camera.lookAt(look2);
  }

  let raf = 0; let last = performance.now(); let alive = true;
  function frame(now) {
    if (!alive) return;
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    if (!document.hidden) { update(dt); composer.render(); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame((n) => { last = n; frame(n); });
  // Appli en arrière-plan : la partie se met en pause (pas de chute de vitesse au retour)
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  ui.onReady && ui.onReady();

  return {
    start,
    // Pour les tests automatiques : avance la simulation sans attendre l'affichage
    sim: (sec, invincible = false) => { god = invincible; for (let i = 0; i < sec * 60; i++) update(1 / 60); god = false; },
    act: (a) => ({ left: () => move(-1), right: () => move(1), up: jump, down })[a](),
    power: (type) => activate(type),
    state: () => ({ ...st, speed: world.speed, items: world.items.map((i) => i.userData.type) }),
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      Object.values(tex).forEach((x) => x.dispose());
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
