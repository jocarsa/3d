(function(){
            // ========== CONFIGURATION with better defaults & fixes ==========
            const CONFIG = {
                scene: "body",                  // root scene element
                boxSelector: `
                    header,nav,main,section,article,aside,footer,
                    div,form,figure,blockquote,ul,ol,li,
                    img,button,input,textarea,select,.card
                `,
                // only structural sections get Z translation (avoid breaking inline elements)
                zSelector: `
                    header,nav,main,section,article,aside,footer,.card,div:not(.no-z)
                `,
                textSelector: `
                    h1,h2,h3,h4,h5,h6,p,span,a,label,figcaption,button,li
                `,
                cameraZ: -380,          // better perspective distance
                scale: 0.92,            // slight zoom out but preserves layout integrity
                perspective: 950,
                rotationStrength: 14,    // subtle rotation
                depthStep: 18,           // depth increment per nesting level
                maxDepth: 220,
                thicknessBase: 4,
                thicknessPerDepth: 1.2,
                thicknessStep: 0.45,
                textLayers: 4,
                textStep: 0.28,
                directionStrength: 5.2,
                debug: false,
                preserveOriginalTransform: true,  // NEW - keep original CSS transforms
                antiFlicker: true                  // NEW - improve stability
            };

            // Helper to parse script parameters
            function params(){
                const s = document.currentScript;
                if(!s) return {};
                const url = new URL(s.src);
                const out = {};
                url.searchParams.forEach((v,k)=>{
                    if(v === "true") out[k] = true;
                    else if(v === "false") out[k] = false;
                    else if(!isNaN(v)) out[k] = Number(v);
                    else out[k] = v;
                });
                return out;
            }

            function rgb(color){
                if(!color) return {r:180,g:180,b:180};
                // handle rgba / rgb / hex conversions more robustly
                let str = color;
                const hexMatch = str.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/);
                if(hexMatch){
                    let hex = hexMatch[1];
                    if(hex.length === 3){
                        hex = hex.split('').map(c=>c+c).join('');
                    }
                    const r = parseInt(hex.substring(0,2),16);
                    const g = parseInt(hex.substring(2,4),16);
                    const b = parseInt(hex.substring(4,6),16);
                    return {r,g,b};
                }
                const v = str.match(/\d+(?:\.\d+)?/g);
                if(!v || v.length < 3) return {r:180,g:180,b:180};
                return {
                    r: Number(v[0]),
                    g: Number(v[1]),
                    b: Number(v[2])
                };
            }

            function darken(c,factor){
                return {
                    r: Math.max(0, Math.min(255, Math.round(c.r * factor))),
                    g: Math.max(0, Math.min(255, Math.round(c.g * factor))),
                    b: Math.max(0, Math.min(255, Math.round(c.b * factor)))
                };
            }

            function visible(el){
                if(!el || el.nodeType !== 1) return false;
                const r = el.getBoundingClientRect();
                // elements with 0 size cause issues — skip them
                return r.width > 0 && r.height > 0 && el.offsetParent !== null;
            }

            function depthOf(el, root){
                let d = 0;
                let p = el.parentElement;
                const limit = root || document.body;
                while(p && p !== limit && p !== document.body && p !== document.documentElement){
                    // count only structural parents (no body limit)
                    if(p.matches && p.matches(CONFIG.zSelector)) d++;
                    p = p.parentElement;
                }
                return d;
            }

            function baseColor(el){
                const st = getComputedStyle(el);
                let c = st.backgroundColor;
                if(c === "rgba(0, 0, 0, 0)" || c === "transparent"){
                    c = st.color;
                }
                // fallback if still weird
                if(!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") c = "#e2e8f0";
                return rgb(c);
            }

            // Enhanced box shadow with will-change and GPU smoothness
            function boxShadow(el, dx, dy, cfg){
                const depth = Number(el.dataset.jocarsaDepth || 0);
                const c = {
                    r: Number(el.dataset.jocarsaR),
                    g: Number(el.dataset.jocarsaG),
                    b: Number(el.dataset.jocarsaB)
                };
                // adaptive layers based on depth
                let layers = Math.max(2, Math.min(28, Math.round(cfg.thicknessBase + depth * cfg.thicknessPerDepth)));
                const shadows = [];
                const step = cfg.thicknessStep;
                for(let i=1; i<=layers; i++){
                    // progressive darkening
                    const factor = 1 - (i / (layers + 3)) * 0.9;
                    const cc = darken(c, Math.max(0.35, factor));
                    shadows.push(`${dx * i * step}px ${dy * i * step}px 0 rgba(${cc.r}, ${cc.g}, ${cc.b}, ${0.88 - i*0.02})`);
                }
                // final blurred shadow for realism
                shadows.push(`${dx * layers * step}px ${dy * layers * step}px 12px rgba(0,0,0,0.2)`);
                el.style.boxShadow = shadows.join(",");
            }

            function textShadow(el, dx, dy, cfg){
                const shadows = [];
                for(let i=1; i<=cfg.textLayers; i++){
                    shadows.push(`${dx * i * cfg.textStep}px ${dy * i * cfg.textStep}px 0 rgba(0,0,0,${0.28 - i*0.03})`);
                }
                shadows.push(`${dx * 2.2}px ${dy * 2.2}px 8px rgba(0,0,0,0.12)`);
                el.style.textShadow = shadows.join(",");
            }

            // Core enhancement: avoid layout displacement by handling Z translation ONLY on block-level-like containers
            function init(options = {}){
                const cfg = {...CONFIG, ...options};
                let scene = document.querySelector(cfg.scene);
                if(!scene){
                    console.warn("Jocarsa3D: scene element not found, fallback to body");
                    scene = document.body;
                }

                // avoid double initialization
                if(scene.classList.contains("jocarsa-3d-scene-init")) return;
                
                // Wrap only if not already wrapped appropriately
                let viewport = scene.parentElement?.classList?.contains("jocarsa-3d-viewport") 
                    ? scene.parentElement 
                    : null;
                
                if(!viewport){
                    viewport = document.createElement("div");
                    viewport.className = "jocarsa-3d-viewport";
                    scene.parentNode.insertBefore(viewport, scene);
                    viewport.appendChild(scene);
                }
                
                viewport.style.perspective = cfg.perspective + "px";
                viewport.style.perspectiveOrigin = "50% 50%";
                viewport.style.overflow = "visible";
                viewport.style.position = "relative";
                
                scene.classList.add("jocarsa-3d-scene");
                scene.classList.add("jocarsa-3d-scene-init");
                // preserve original scene inline style if any
                if(cfg.preserveOriginalTransform && !scene.dataset.jocarsaOriginalTransform){
                    scene.dataset.jocarsaOriginalTransform = scene.style.transform || "";
                }
                
                // Select elements with better filtering to avoid pseudo/fake elements
                let allBoxes = [];
                try{
                    allBoxes = [...scene.querySelectorAll(cfg.boxSelector)]
                        .filter(el => !el.closest?.(".jocarsa-3d-debug"))
                        .filter(el => el.nodeType === 1 && !el.classList?.contains("jocarsa-3d-box-processed"))
                        .filter(visible);
                } catch(e){ console.warn(e); }
                
                const zBoxesRaw = allBoxes.filter(el => {
                    try {
                        return el.matches && el.matches(cfg.zSelector);
                    } catch(e){ return false; }
                });
                
                const texts = allBoxes.filter(el => {
                    try {
                        return el.matches && el.matches(cfg.textSelector);
                    } catch(e){ return false; }
                });
                
                // Process each box: assign depth, colors, but do NOT modify layout positions!
                allBoxes.forEach(el => {
                    if(el.classList.contains("jocarsa-3d-box-processed")) return;
                    el.classList.add("jocarsa-3d-box");
                    const depthVal = depthOf(el, scene);
                    const zVal = Math.min(depthVal * cfg.depthStep, cfg.maxDepth);
                    const col = baseColor(el);
                    
                    el.dataset.jocarsaDepth = depthVal;
                    el.dataset.jocarsaZ = zVal;
                    el.dataset.jocarsaR = col.r;
                    el.dataset.jocarsaG = col.g;
                    el.dataset.jocarsaB = col.b;
                    
                    // apply Z translation only if element is a zSelector and not a small inline element
                    if(zBoxesRaw.includes(el)){
                        el.classList.add("jocarsa-3d-zbox");
                        // store original transform so we can combine with our translateZ
                        if(cfg.preserveOriginalTransform && !el.dataset.jocarsaOriginalTransform){
                            const currentTransform = window.getComputedStyle(el).transform;
                            if(currentTransform && currentTransform !== 'none'){
                                el.dataset.jocarsaOriginalTransform = currentTransform;
                            } else {
                                el.dataset.jocarsaOriginalTransform = "";
                            }
                        }
                        // Combine transforms: Always preserve original CSS layout (like grid/flex none displacement)
                        // Important: Use translateZ but keep original X/Y transforms untouched.
                        let baseTrans = el.dataset.jocarsaOriginalTransform && el.dataset.jocarsaOriginalTransform !== 'none' ? 
                                        el.dataset.jocarsaOriginalTransform : "";
                        if(baseTrans && baseTrans !== 'none'){
                            // merge — we need to combine safely
                            if(baseTrans.includes('matrix') || baseTrans.includes('translate')){
                                el.style.transform = `${baseTrans} translateZ(${zVal}px)`;
                            } else {
                                el.style.transform = `${baseTrans} translateZ(${zVal}px)`;
                            }
                        } else {
                            el.style.transform = `translateZ(${zVal}px)`;
                        }
                        // optional debug label
                        if(cfg.debug){
                            const existingDbg = el.querySelector(".jocarsa-3d-debug");
                            if(!existingDbg){
                                const label = document.createElement("span");
                                label.className = "jocarsa-3d-debug";
                                label.textContent = `Z:${Math.round(zVal)}px`;
                                label.style.pointerEvents = "none";
                                el.appendChild(label);
                            }
                        }
                    }
                    el.classList.add("jocarsa-3d-box-processed");
                });
                
                texts.forEach(el => {
                    if(!el.classList.contains("jocarsa-3d-text")){
                        el.classList.add("jocarsa-3d-text");
                    }
                });
                
                // Mouse move handler creates dynamic shadows & scene rotation without breaking layout.
                let ticking = false;
                let currentRotX = 0, currentRotY = 0;
                
                function updateScene(e){
                    if(ticking && cfg.antiFlicker) return;
                    ticking = true;
                    requestAnimationFrame(() => {
                        const clientX = e.clientX ?? window.innerWidth/2;
                        const clientY = e.clientY ?? window.innerHeight/2;
                        const x = clientX / window.innerWidth - 0.5;
                        const y = clientY / window.innerHeight - 0.5;
                        
                        const rotY = x * cfg.rotationStrength;
                        const rotX = -y * cfg.rotationStrength;
                        currentRotX = rotX;
                        currentRotY = rotY;
                        
                        // apply 3D rotation to scene container - Does NOT affect original layout because 3D transform creates separate stacking context.
                        scene.style.transform = `translateZ(${cfg.cameraZ}px) scale(${cfg.scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
                        scene.style.transformOrigin = "center center";
                        scene.style.willChange = "transform";
                        
                        // compute lighting direction for shadows
                        const dx = -Math.sin(rotY * Math.PI / 180) * cfg.directionStrength;
                        const dy = Math.sin(rotX * Math.PI / 180) * cfg.directionStrength;
                        
                        // update shadows for all boxes and texts efficiently
                        allBoxes.forEach(el => {
                            if(el.isConnected && el.dataset.jocarsaR){
                                boxShadow(el, dx, dy, cfg);
                            }
                        });
                        texts.forEach(el => {
                            if(el.isConnected){
                                textShadow(el, dx, dy, cfg);
                            }
                        });
                        ticking = false;
                    });
                }
                
                // initial update
                updateScene({clientX: window.innerWidth/2, clientY: window.innerHeight/2});
                
                document.addEventListener("mousemove", updateScene);
                window.addEventListener("resize", () => {
                    updateScene({clientX: window.innerWidth/2, clientY: window.innerHeight/2});
                });
                
                // stability fix: recalc shadows when DOM changes (optional)
                const observer = new ResizeObserver(() => {
                    updateScene({clientX: window.innerWidth/2, clientY: window.innerHeight/2});
                });
                observer.observe(scene);
            }
            
            window.Jocarsa3D = init;
            document.addEventListener("DOMContentLoaded", () => {
                const opts = params();
                // override depth styling to avoid breaking existing layout
                init(opts);
            });
        })();
