/* BodyMap 3D mannequin — three.js (UMD global THREE) */
(function () {
  const HOTSPOTS = {
    head:      { pos: [0, 1.52, 0.19] },
    neck:      { pos: [0, 1.2, -0.09] },
    shoulder:  { pos: [0.44, 1.0, 0.06] },
    chest:     { pos: [0, 0.9, 0.21] },
    upperBack: { pos: [0, 0.92, -0.2] },
    abdomen:   { pos: [0, 0.38, 0.2] },
    lowerBack: { pos: [0, 0.36, -0.19] },
    knee:      { pos: [0.17, -0.7, 0.11] },
  };

  function haloTexture(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},0.95)`);
    gr.addColorStop(0.25, `rgba(${rgb},0.55)`);
    gr.addColorStop(0.6, `rgba(${rgb},0.12)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  }
  function ringTexture(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = `rgba(${rgb},0.9)`; g.lineWidth = 5;
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    return new THREE.CanvasTexture(c);
  }
  function shadowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(20,90,120,0.28)'); gr.addColorStop(1, 'rgba(20,90,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function createBody(container, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    const cam = { y: 0.05, dist: 7.0, ty: 0.05, tdist: 7.0 };

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe6f0, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fd6e0, 0.9); rim.position.set(-3, 2, -4); scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0x9fe8ff, 0.5); rim2.position.set(3, 1, -3); scene.add(rim2);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f6f9, roughness: 0.38, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.35,
      sheen: 1, sheenColor: new THREE.Color(0x8fe3ec), sheenRoughness: 0.5,
    });
    const jointMat = new THREE.MeshPhysicalMaterial({ color: 0xd3eef4, roughness: 0.45, clearcoat: 0.4 });

    const root = new THREE.Group(); scene.add(root);
    const body = new THREE.Group(); root.add(body);
    const parts = {};

    function cap(name, r, len, x, y, z, rz, sx, sz, mat) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 12, 28), mat || bodyMat);
      m.position.set(x, y, z); m.rotation.z = rz || 0;
      m.scale.set(sx || 1, 1, sz || 1);
      m.name = name; body.add(m); parts[name] = m; return m;
    }
    function sph(name, r, x, y, z, sx, sy, sz, mat) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 28), mat || bodyMat);
      m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1);
      m.name = name; body.add(m); parts[name] = m; return m;
    }

    sph('head', 0.2, 0, 1.47, 0, 0.88, 1.08, 0.98);
    cap('neck', 0.075, 0.14, 0, 1.2, -0.01, 0, 1, 1, jointMat);
    cap('torso', 0.27, 0.42, 0, 0.8, 0, 0, 1.32, 0.72);
    cap('waist', 0.22, 0.14, 0, 0.42, 0, 0, 1.2, 0.74);
    cap('pelvis', 0.25, 0.06, 0, 0.16, 0, 0, 1.25, 0.78);
    [1, -1].forEach(s => {
      sph('sh' + s, 0.1, 0.4 * s, 1.0, 0, 1, 1, 1, jointMat);
      cap('uarm' + s, 0.072, 0.4, 0.47 * s, 0.73, 0, 0.1 * s);
      sph('elb' + s, 0.066, 0.515 * s, 0.47, 0, 1, 1, 1, jointMat);
      cap('farm' + s, 0.06, 0.38, 0.555 * s, 0.22, 0.02, 0.07 * s);
      sph('hand' + s, 0.07, 0.585 * s, -0.06, 0.03, 0.7, 1.35, 0.5);
      cap('thigh' + s, 0.115, 0.55, 0.16 * s, -0.25, 0, -0.03 * s);
      sph('knee' + s, 0.095, 0.17 * s, -0.66, 0.01, 1, 1, 1, jointMat);
      cap('shin' + s, 0.085, 0.56, 0.175 * s, -1.03, 0, 0.01 * s);
      cap('foot' + s, 0.06, 0.14, 0.18 * s, -1.4, 0.07, 0, 1, 1).rotation.x = Math.PI / 2;
    });

    // floor shadow
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.48; root.add(shadow);

    // hotspots
    const halo = haloTexture('255,138,101');
    const haloSel = haloTexture('255,98,82');
    const ring = ringTexture('255,122,89');
    const spots = {};
    const hitMeshes = [];
    Object.keys(HOTSPOTS).forEach(id => {
      const g = new THREE.Group();
      g.position.fromArray(HOTSPOTS[id].pos);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 16),
        new THREE.MeshBasicMaterial({ color: 0xff7a59 }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false }));
      glow.scale.set(0.26, 0.26, 1);
      const rg = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring, transparent: true, depthWrite: false, opacity: 0 }));
      rg.scale.set(0.2, 0.2, 1);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData.spot = id; hitMeshes.push(hit);
      g.add(glow, rg, core, hit);
      body.add(g);
      spots[id] = { g, core, glow, rg, phase: Math.random() * 6, sel: 0, pop: 0 };
    });

    let selected = null, active = true, dimOthers = false;
    let rotY = 0, rotTarget = 0, dragging = false, lastX = 0, downX = 0, downY = 0, vel = 0, lastInteract = 0;
    const genderTarget = { v: 0 }; let genderV = 0;

    function setGender(g) { genderTarget.v = g === 'female' ? 1 : 0; }
    function applyGender(v) {
      parts.torso.scale.x = 1.32 - 0.12 * v;
      parts.torso.scale.z = 0.72 + 0.04 * v;
      parts.waist.scale.x = 1.2 - 0.2 * v;
      parts.pelvis.scale.x = 1.25 + 0.16 * v;
      [1, -1].forEach(s => {
        parts['sh' + s].position.x = (0.4 - 0.04 * v) * s;
        parts['uarm' + s].position.x = (0.47 - 0.04 * v) * s;
        parts['elb' + s].position.x = (0.515 - 0.035 * v) * s;
        parts['farm' + s].position.x = (0.555 - 0.03 * v) * s;
        parts['hand' + s].position.x = (0.585 - 0.025 * v) * s;
        parts['thigh' + s].scale.x = 1 + 0.12 * v;
      });
      parts.head.scale.y = 1.08 + 0.03 * v;
    }

    // interaction
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const el = renderer.domElement;
    function pick(cx, cy) {
      const r = el.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const bodyMeshes = Object.values(parts);
      const hitsB = ray.intersectObjects(bodyMeshes, false);
      const hitsS = ray.intersectObjects(hitMeshes, false);
      if (hitsS.length && (!hitsB.length || hitsS[0].distance < hitsB[0].distance + 0.12)) return hitsS[0].object.userData.spot;
      if (hitsB.length) {
        const p = body.worldToLocal(hitsB[0].point.clone());
        let best = null, bd = 0.42;
        Object.keys(HOTSPOTS).forEach(id => {
          const hp = new THREE.Vector3().fromArray(HOTSPOTS[id].pos);
          // prefer same side (front/back)
          const d = hp.distanceTo(p) + (Math.sign(hp.z) !== Math.sign(p.z) && Math.abs(hp.z) > 0.12 ? 0.18 : 0);
          if (d < bd) { bd = d; best = id; }
        });
        return best;
      }
      return null;
    }
    el.addEventListener('pointerdown', e => {
      dragging = true; lastX = downX = e.clientX; downY = e.clientY; vel = 0;
      el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; lastInteract = performance.now();
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) {
        if (active) el.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - lastX; lastX = e.clientX;
      vel = dx * 0.012; rotTarget += vel; lastInteract = performance.now();
    });
    el.addEventListener('pointerup', e => {
      dragging = false; el.style.cursor = 'grab';
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && active) {
        const id = pick(e.clientX, e.clientY);
        if (id && opts.onSelect) opts.onSelect(id);
      }
    });

    function setView(v) {
      const base = v === 'back' ? Math.PI : 0;
      const k = Math.round((rotTarget - base) / (Math.PI * 2));
      rotTarget = base + k * Math.PI * 2; lastInteract = performance.now();
    }
    function faceRegion(id) {
      if (!id) return;
      const z = HOTSPOTS[id].pos[2];
      setView(z < -0.05 ? 'back' : 'front');
    }
    function focus(id, mode) {
      if (!id || mode === 'full') { cam.ty = 0.05; cam.tdist = 7.0; return; }
      cam.ty = HOTSPOTS[id].pos[1] * 0.9; cam.tdist = 3.1;
    }
    function setSelected(id) { selected = id; if (id && spots[id]) spots[id].pop = 1; }
    function setActive(a) { active = a; }
    function setDim(d) { dimOthers = d; }
    function setDark(d) {
      bodyMat.color.set(d ? 0x9cc9d8 : 0xe8f6f9);
      bodyMat.sheenColor.set(d ? 0x43d1e0 : 0x8fe3ec);
      jointMat.color.set(d ? 0x86b7c8 : 0xd3eef4);
      shadow.material.opacity = d ? 0.5 : 1;
    }

    let W = 0, H = 0, raf;
    const clock = new THREE.Clock();
    function tick() {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;
      const w = container.clientWidth, h = container.clientHeight;
      if (w !== W || h !== H) { W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); }
      if (!W || !H) return;
      if (!dragging) { rotTarget += vel; vel *= 0.92; }
      // gentle idle sway
      const idle = performance.now() - lastInteract > 4000 && !selected;
      rotY += (rotTarget + (idle ? Math.sin(t * 0.5) * 0.35 : 0) - rotY) * 0.1;
      root.rotation.y = rotY;
      root.position.y = Math.sin(t * 1.2) * 0.012;
      genderV += (genderTarget.v - genderV) * 0.12; applyGender(genderV);
      cam.y += (cam.ty - cam.y) * 0.08; cam.dist += (cam.tdist - cam.dist) * 0.08;
      camera.position.set(0, cam.y + 0.15, cam.dist); camera.lookAt(0, cam.y, 0);

      Object.keys(spots).forEach(id => {
        const s = spots[id];
        const isSel = id === selected;
        s.sel += ((isSel ? 1 : 0) - s.sel) * 0.12;
        s.pop *= 0.94;
        const pulse = (Math.sin(t * 3 + s.phase) + 1) / 2;
        const vis = dimOthers && !isSel ? 0.25 : 1;
        const sc = (0.22 + pulse * 0.08) * (1 + s.sel * 0.7 + s.pop * 0.8);
        s.glow.scale.set(sc, sc, 1);
        s.glow.material.map = isSel ? haloSel : halo;
        s.glow.material.opacity = (0.65 + pulse * 0.35) * vis;
        s.core.scale.setScalar((1 + s.sel * 0.5) * (dimOthers && !isSel ? 0.7 : 1));
        s.core.material.opacity = vis; s.core.material.transparent = vis < 1;
        // expanding ring
        const rp = ((t * 0.9 + s.phase) % 1.6) / 1.6;
        const rs = 0.1 + rp * (0.34 + s.sel * 0.3);
        s.rg.scale.set(rs, rs, 1);
        s.rg.material.opacity = (1 - rp) * 0.7 * vis * (active || isSel ? 1 : 0.4);
      });
      renderer.render(scene, camera);
    }
    tick();

    return { setView, setGender, setSelected, setActive, setDim, setDark, focus, faceRegion,
      dispose() { cancelAnimationFrame(raf); renderer.dispose(); el.remove(); } };
  }

  window.BodyMap3D = { createBody, HOTSPOTS };
})();
