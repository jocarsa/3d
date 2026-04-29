(function () {

  const CONFIG = {
    scene: "body",

    boxSelector: `
      header,nav,main,section,article,aside,footer,
      div,form,figure,blockquote,ul,ol,li,
      img,button,input,textarea,select
    `,

    zSelector: `
      header,nav,main,section,article,aside,footer
    `,

    textSelector: `
      h1,h2,h3,h4,h5,h6,p,span,a,label,figcaption,button,li
    `,

    cameraZ: -180,
    scale: 1,
    autoFitWidth: true,
    perspective: 900,

    rotationStrength: 5,

    depthStep: 22,
    maxDepth: 240,

    thicknessBase: 5,
    thicknessPerDepth: 1.2,
    thicknessStep: 0.55,

    textLayers: 4,
    textStep: 0.28,

    directionStrength: 5,

    fixedZ: 360,
    stickyZ: 300,
    zIndexMultiplier: 0.35,

    touchEnabled: true,
    shadowCullMargin: 300,

    debug: false
  };

  function params() {
    const scripts = document.querySelectorAll("script[src]");
    let src = null;

    for (const s of scripts) {
      if (
        s.src &&
        (
          s.src.includes("3d.js") ||
          s.src.includes("jocarsa-3d")
        )
      ) {
        src = s.src;
        break;
      }
    }

    if (!src) return {};

    try {
      const url = new URL(src, location.href);
      const out = {};

      url.searchParams.forEach((v, k) => {
        if (v === "true") out[k] = true;
        else if (v === "false") out[k] = false;
        else if (v !== "" && !isNaN(+v)) out[k] = +v;
        else out[k] = v;
      });

      return out;
    } catch (_) {
      return {};
    }
  }

  function rgb(color) {
    if (!color) return { r: 160, g: 160, b: 160 };

    const v = color.match(/\d+/g);

    if (!v || v.length < 3) {
      return { r: 160, g: 160, b: 160 };
    }

    return {
      r: +v[0],
      g: +v[1],
      b: +v[2]
    };
  }

  function darken(c, f) {
    return {
      r: Math.max(0, Math.round(c.r * f)),
      g: Math.max(0, Math.round(c.g * f)),
      b: Math.max(0, Math.round(c.b * f))
    };
  }

  function isTransparent(color) {
    if (!color || color === "transparent") return true;
    if (color === "rgba(0, 0, 0, 0)") return true;

    const m = color.match(/[\d.]+/g);

    if (
      m &&
      (
        color.startsWith("rgba") ||
        color.startsWith("hsla")
      )
    ) {
      return +m[m.length - 1] === 0;
    }

    return false;
  }

  function getBackgroundSource() {
    const body = document.body;
    const html = document.documentElement;

    const bs = body ? getComputedStyle(body) : null;
    const hs = html ? getComputedStyle(html) : null;

    if (bs && !isTransparent(bs.backgroundColor)) return bs;
    if (bs && bs.backgroundImage && bs.backgroundImage !== "none") return bs;

    if (hs && !isTransparent(hs.backgroundColor)) return hs;
    if (hs && hs.backgroundImage && hs.backgroundImage !== "none") return hs;

    return bs || hs;
  }

  function copyPageBackground(target) {
    const src = getBackgroundSource();

    if (!src) {
      target.style.background = "#ffffff";
      return;
    }

    target.style.backgroundColor = isTransparent(src.backgroundColor)
      ? "#ffffff"
      : src.backgroundColor;

    target.style.backgroundImage = src.backgroundImage;
    target.style.backgroundSize = src.backgroundSize;
    target.style.backgroundRepeat = src.backgroundRepeat;
    target.style.backgroundPosition = src.backgroundPosition;
    target.style.backgroundAttachment = src.backgroundAttachment;
    target.style.backgroundOrigin = src.backgroundOrigin;
    target.style.backgroundClip = src.backgroundClip;
  }

  function ownBackground(el) {
    const bg = getComputedStyle(el).backgroundColor;

    if (isTransparent(bg)) {
      return {
        transparent: true,
        c: null
      };
    }

    return {
      transparent: false,
      c: rgb(bg)
    };
  }

  function visible(el) {
    const st = getComputedStyle(el);

    if (
      el.offsetParent === null &&
      st.position !== "fixed"
    ) {
      return false;
    }

    const r = el.getBoundingClientRect();

    return r.width > 1 && r.height > 1;
  }

  function depthOf(el, root) {
    let d = 0;
    let p = el.parentElement;

    while (
      p &&
      p !== root &&
      p !== document.documentElement
    ) {
      d++;
      p = p.parentElement;
    }

    return d;
  }

  function hasManualZIndex(el) {
    return getComputedStyle(el).zIndex !== "auto";
  }

  function getNumericZIndex(el) {
    const z = parseInt(getComputedStyle(el).zIndex, 10);
    return isNaN(z) ? 0 : z;
  }

  function buildTextShadow(dx, dy, cfg) {
    const parts = [];

    for (let i = 1; i <= cfg.textLayers; i++) {
      const alpha = Math.max(0, 0.30 - i * 0.045).toFixed(3);

      parts.push(
        `${(dx * i * cfg.textStep).toFixed(2)}px ` +
        `${(dy * i * cfg.textStep).toFixed(2)}px ` +
        `0 rgba(0,0,0,${alpha})`
      );
    }

    parts.push(
      `${(dx * 2).toFixed(2)}px ` +
      `${(dy * 2).toFixed(2)}px ` +
      `6px rgba(0,0,0,.12)`
    );

    return parts.join(",");
  }

  function buildBoxShadow(depth, c, dx, dy, cfg) {
    const layers = Math.round(
      cfg.thicknessBase +
      depth * cfg.thicknessPerDepth
    );

    const parts = [];

    for (let i = 1; i <= layers; i++) {
      const cc = darken(c, 1 - i * 0.022);

      parts.push(
        `${(dx * i * cfg.thicknessStep).toFixed(2)}px ` +
        `${(dy * i * cfg.thicknessStep).toFixed(2)}px ` +
        `0 rgb(${cc.r},${cc.g},${cc.b})`
      );
    }

    parts.push(
      `${(dx * layers * cfg.thicknessStep).toFixed(2)}px ` +
      `${(dy * layers * cfg.thicknessStep).toFixed(2)}px ` +
      `12px rgba(0,0,0,.10)`
    );

    return parts.join(",");
  }

  function shadowDir(rotXDeg, rotYDeg, strength) {
    return {
      dx: -Math.sin(rotYDeg * Math.PI / 180) * strength,
      dy: Math.sin(rotXDeg * Math.PI / 180) * strength
    };
  }

  function measureOriginalWidth() {
    return Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0,
      window.innerWidth
    );
  }

  function createBodyScene(originalWidth) {
    const body = document.body;

    const viewport = document.createElement("div");
    viewport.className = "jocarsa-3d-viewport";

    const scene = document.createElement("div");
    scene.className = "jocarsa-3d-scene";

    viewport.style.setProperty(
      "--jocarsa-original-width",
      originalWidth + "px"
    );

    scene.style.setProperty(
      "--jocarsa-original-width",
      originalWidth + "px"
    );

    copyPageBackground(viewport);

    const nodes = Array.from(body.childNodes);

    body.appendChild(viewport);
    viewport.appendChild(scene);

    nodes.forEach(node => {
      if (node === viewport) return;

      if (
        node.nodeType === 1 &&
        node.tagName &&
        node.tagName.toLowerCase() === "script"
      ) {
        return;
      }

      scene.appendChild(node);
    });

    return {
      viewport,
      scene
    };
  }

  function createElementScene(scene, originalWidth) {
    const viewport = document.createElement("div");
    viewport.className = "jocarsa-3d-viewport";

    viewport.style.setProperty(
      "--jocarsa-original-width",
      originalWidth + "px"
    );

    scene.style.setProperty(
      "--jocarsa-original-width",
      originalWidth + "px"
    );

    copyPageBackground(viewport);

    const parent = scene.parentNode;

    if (!parent) {
      console.warn("Jocarsa3D: scene has no parent node");
      return null;
    }

    parent.insertBefore(viewport, scene);
    viewport.appendChild(scene);

    scene.classList.add("jocarsa-3d-scene");

    return {
      viewport,
      scene
    };
  }

  function init(options) {
    const cfg = Object.assign({}, CONFIG, options || {});

    if (!document.body) {
      console.warn("Jocarsa3D: document.body not ready");
      return;
    }

    if (document.body.dataset.jocarsa3dInitialized === "1") {
      return;
    }

    const originalWidth = measureOriginalWidth();

    let scene = document.querySelector(cfg.scene);

    if (!scene) {
      console.warn(
        "Jocarsa3D: scene not found:",
        cfg.scene,
        "— falling back to body"
      );

      scene = document.body;
    }

    let setup;

    if (scene === document.body) {
      setup = createBodyScene(originalWidth);
      scene = setup.scene;
    } else {
      setup = createElementScene(scene, originalWidth);
      if (!setup) return;
      scene = setup.scene;
    }

    const viewport = setup.viewport;

    document.body.dataset.jocarsa3dInitialized = "1";

    viewport.style.perspective = cfg.perspective + "px";

    document.documentElement.classList.add("jocarsa-3d-html");
    document.body.classList.add("jocarsa-3d-body");

    function syncOrigins() {
      const centerY = window.scrollY + window.innerHeight / 2;

      viewport.style.perspectiveOrigin = `50% ${centerY}px`;
      scene.style.transformOrigin = `50% ${centerY}px`;
    }

    syncOrigins();

    const allBoxCandidates =
      [...scene.querySelectorAll(cfg.boxSelector)]
        .filter(el => !el.closest(".jocarsa-3d-debug"))
        .filter(el => el !== viewport)
        .filter(el => el !== scene);

    const depthMap = new Map();

    allBoxCandidates.forEach(el => {
      depthMap.set(el, depthOf(el, scene));
    });

    const boxes = allBoxCandidates.filter(visible);

    const texts =
      [...scene.querySelectorAll(cfg.textSelector)]
        .filter(visible)
        .filter(el => !el.closest(".jocarsa-3d-debug"));

    boxes.forEach(el => {
      const st = getComputedStyle(el);
      const position = st.position;
      const manualZ = hasManualZIndex(el);
      const numericZ = getNumericZIndex(el);

      el.classList.add("jocarsa-3d-box");

      if (position === "fixed") {
        el.classList.add("jocarsa-3d-fixed");
      }

      if (position === "sticky") {
        el.classList.add("jocarsa-3d-sticky");
      }

      if (manualZ) {
        el.classList.add("jocarsa-3d-manual-z");
      }

      const domDepth = depthMap.get(el) || 0;

      let z = Math.min(
        domDepth * cfg.depthStep,
        cfg.maxDepth
      );

      if (position === "fixed") {
        z =
          cfg.fixedZ +
          Math.max(0, numericZ * cfg.zIndexMultiplier);
      } else if (position === "sticky") {
        z =
          cfg.stickyZ +
          Math.max(0, numericZ * cfg.zIndexMultiplier);
      } else if (manualZ && numericZ > 0) {
        z += Math.min(
          180,
          numericZ * cfg.zIndexMultiplier
        );
      }

      const bg = ownBackground(el);

      el.dataset.jocarsaDepth = domDepth;
      el.dataset.jocarsaTransparent = bg.transparent ? "1" : "0";

      if (!bg.transparent) {
        el.dataset.jocarsaR = bg.c.r;
        el.dataset.jocarsaG = bg.c.g;
        el.dataset.jocarsaB = bg.c.b;
      }

      const shouldLift =
        el.matches(cfg.zSelector) ||
        position === "fixed" ||
        position === "sticky" ||
        manualZ;

      if (shouldLift) {
        el.classList.add("jocarsa-3d-zbox");

        const originalTransform = el.style.transform || "";

        el.style.transform =
          (originalTransform ? originalTransform + " " : "") +
          `translateZ(${z}px)`;
      }

      if (cfg.debug && shouldLift) {
        const label = document.createElement("span");

        label.className = "jocarsa-3d-debug";

        label.textContent =
          `Z ${Math.round(z)} ` +
          `d ${domDepth} ` +
          `pos ${position} ` +
          `z-index ${st.zIndex}`;

        el.appendChild(label);
      }
    });

    texts.forEach(el => {
      el.classList.add("jocarsa-3d-text");
    });

    let rafId = null;

    let lastCX = window.innerWidth / 2;
    let lastCY = window.innerHeight / 2;

    function applyFrame() {
      rafId = null;

      const nx = lastCX / window.innerWidth - 0.5;
      const ny = lastCY / window.innerHeight - 0.5;

      const rotY = nx * cfg.rotationStrength;
      const rotX = -ny * cfg.rotationStrength;

      const fitScale =
        cfg.autoFitWidth
          ? ((cfg.perspective - cfg.cameraZ) / cfg.perspective) * cfg.scale
          : cfg.scale;

      scene.style.transform =
        `translateZ(${cfg.cameraZ}px) ` +
        `scale(${fitScale}) ` +
        `rotateX(${rotX}deg) ` +
        `rotateY(${rotY}deg)`;

      const { dx, dy } =
        shadowDir(rotX, rotY, cfg.directionStrength);

      const bandTop =
        window.scrollY - cfg.shadowCullMargin;

      const bandBottom =
        window.scrollY +
        window.innerHeight +
        cfg.shadowCullMargin;

      boxes.forEach(el => {
        if (el.dataset.jocarsaTransparent === "1") {
          el.style.boxShadow = "";
          return;
        }

        const rect = el.getBoundingClientRect();

        const docTop = rect.top + window.scrollY;
        const docBottom = rect.bottom + window.scrollY;

        if (docBottom < bandTop || docTop > bandBottom) {
          return;
        }

        const depth = +(el.dataset.jocarsaDepth || 0);

        const c = {
          r: +(el.dataset.jocarsaR || 160),
          g: +(el.dataset.jocarsaG || 160),
          b: +(el.dataset.jocarsaB || 160)
        };

        el.style.boxShadow =
          buildBoxShadow(depth, c, dx, dy, cfg);
      });

      const textShadow = buildTextShadow(dx, dy, cfg);

      texts.forEach(el => {
        const rect = el.getBoundingClientRect();

        const docTop = rect.top + window.scrollY;
        const docBottom = rect.bottom + window.scrollY;

        if (docBottom < bandTop || docTop > bandBottom) {
          return;
        }

        el.style.textShadow = textShadow;
      });
    }

    function scheduleFrame(clientX, clientY) {
      if (clientX !== undefined) lastCX = clientX;
      if (clientY !== undefined) lastCY = clientY;

      if (rafId) return;

      rafId = requestAnimationFrame(applyFrame);
    }

    document.addEventListener("mousemove", e => {
      scheduleFrame(e.clientX, e.clientY);
    });

    if (cfg.touchEnabled) {
      document.addEventListener(
        "touchmove",
        e => {
          if (!e.touches.length) return;

          e.preventDefault();

          scheduleFrame(
            e.touches[0].clientX,
            e.touches[0].clientY
          );
        },
        { passive: false }
      );

      document.addEventListener(
        "touchstart",
        e => {
          if (!e.touches.length) return;

          scheduleFrame(
            e.touches[0].clientX,
            e.touches[0].clientY
          );
        },
        { passive: true }
      );
    }

    window.addEventListener(
      "scroll",
      () => {
        syncOrigins();
        scheduleFrame();
      },
      { passive: true }
    );

    window.addEventListener(
      "resize",
      () => {
        syncOrigins();

        scheduleFrame(
          window.innerWidth / 2,
          window.innerHeight / 2
        );
      },
      { passive: true }
    );

    applyFrame();
  }

  window.Jocarsa3D = init;

  function boot() {
    init(params());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
