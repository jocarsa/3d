(function(){

const CONFIG = {
    scene:"body",

    boxSelector:`
        header,nav,main,section,article,aside,footer,
        div,form,figure,blockquote,ul,ol,li,
        img,button,input,textarea,select
    `,

    zSelector:`
        header,nav,main,section,article,aside,footer
    `,

    textSelector:`
        h1,h2,h3,h4,h5,h6,p,span,a,label,figcaption,button,li
    `,

    cameraZ:-360,
    scale:0.82,
    perspective:850,

    rotationStrength:16,

    depthStep:24,
    maxDepth:260,

    thicknessBase:6,
    thicknessPerDepth:1.4,
    thicknessStep:0.5,

    textLayers:5,
    textStep:0.3,

    directionStrength:5.5,

    debug:false
};

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
    const v = color.match(/\d+/g);
    if(!v) return {r:180,g:180,b:180};

    return {
        r:Number(v[0]),
        g:Number(v[1]),
        b:Number(v[2])
    };
}

function darken(c,f){
    return {
        r:Math.max(0,Math.round(c.r*f)),
        g:Math.max(0,Math.round(c.g*f)),
        b:Math.max(0,Math.round(c.b*f))
    };
}

function visible(el){
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
}

function depthOf(el,root){
    let d = 0;
    let p = el.parentElement;

    while(p && p !== root && p !== document.body){
        d++;
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

    return rgb(c);
}

function textShadow(el,dx,dy,cfg){
    const shadows = [];

    for(let i=1;i<=cfg.textLayers;i++){
        shadows.push(`
            ${dx*i*cfg.textStep}px
            ${dy*i*cfg.textStep}px
            0
            rgba(0,0,0,${0.34 - i*0.04})
        `);
    }

    shadows.push(`
        ${dx*2}px
        ${dy*2}px
        7px
        rgba(0,0,0,.18)
    `);

    el.style.textShadow = shadows.join(",");
}

function boxShadow(el,dx,dy,cfg){
    const depth = Number(el.dataset.jocarsaDepth || 0);

    const c = {
        r:Number(el.dataset.jocarsaR),
        g:Number(el.dataset.jocarsaG),
        b:Number(el.dataset.jocarsaB)
    };

    const layers = Math.round(
        cfg.thicknessBase + depth * cfg.thicknessPerDepth
    );

    const shadows = [];

    for(let i=1;i<=layers;i++){
        const cc = darken(c,1 - i*0.025);

        shadows.push(`
            ${dx*i*cfg.thicknessStep}px
            ${dy*i*cfg.thicknessStep}px
            0
            rgb(${cc.r},${cc.g},${cc.b})
        `);
    }

    shadows.push(`
        ${dx*layers*cfg.thicknessStep}px
        ${dy*layers*cfg.thicknessStep}px
        14px
        rgba(0,0,0,.14)
    `);

    el.style.boxShadow = shadows.join(",");
}

function init(options = {}){

    const cfg = {...CONFIG,...options};
    const scene = document.querySelector(cfg.scene);

    if(!scene){
        console.warn("Jocarsa3D: escena no encontrada",cfg.scene);
        return;
    }

    const viewport = document.createElement("div");
    viewport.className = "jocarsa-3d-viewport";

    scene.parentNode.insertBefore(viewport,scene);
    viewport.appendChild(scene);

    viewport.style.perspective = cfg.perspective + "px";
    viewport.style.perspectiveOrigin = "50% 50%";

    scene.classList.add("jocarsa-3d-scene");

    const boxes = [...scene.querySelectorAll(cfg.boxSelector)]
        .filter(el=>!el.classList.contains("jocarsa-3d-debug"))
        .filter(el=>!el.closest(".jocarsa-3d-debug"))
        .filter(visible);

    const zBoxes = boxes.filter(el=>el.matches(cfg.zSelector));

    const texts = [...scene.querySelectorAll(cfg.textSelector)]
        .filter(visible);

    boxes.forEach(el=>{

        el.classList.add("jocarsa-3d-box");

        const depth = depthOf(el,scene);
        const z = Math.min(depth * cfg.depthStep,cfg.maxDepth);
        const c = baseColor(el);

        el.dataset.jocarsaDepth = depth;
        el.dataset.jocarsaZ = z;
        el.dataset.jocarsaR = c.r;
        el.dataset.jocarsaG = c.g;
        el.dataset.jocarsaB = c.b;

        if(el.matches(cfg.zSelector)){
            el.classList.add("jocarsa-3d-zbox");
            el.dataset.jocarsaOriginalTransform = el.style.transform || "";
            el.style.transform =
                `${el.dataset.jocarsaOriginalTransform} translateZ(${z}px)`;
        }

        if(cfg.debug && el.matches(cfg.zSelector)){
            const label = document.createElement("span");
            label.className = "jocarsa-3d-debug";
            label.textContent = `Z ${z}px`;
            el.appendChild(label);
        }
    });

    texts.forEach(el=>{
        el.classList.add("jocarsa-3d-text");
    });

    function update(e){

        const x = e.clientX / window.innerWidth - .5;
        const y = e.clientY / window.innerHeight - .5;

        const rotY = x * cfg.rotationStrength;
        const rotX = -y * cfg.rotationStrength;

        scene.style.transform = `
            translateZ(${cfg.cameraZ}px)
            scale(${cfg.scale})
            rotateX(${rotX}deg)
            rotateY(${rotY}deg)
        `;

        const dx =
            -Math.sin(rotY * Math.PI / 180) *
            cfg.directionStrength;

        const dy =
            Math.sin(rotX * Math.PI / 180) *
            cfg.directionStrength;

        boxes.forEach(el=>boxShadow(el,dx,dy,cfg));
        texts.forEach(el=>textShadow(el,dx,dy,cfg));
    }

    document.addEventListener("mousemove",update);

    update({
        clientX:window.innerWidth/2,
        clientY:window.innerHeight/2
    });
}

window.Jocarsa3D = init;

document.addEventListener("DOMContentLoaded",()=>{
    init(params());
});

})();
