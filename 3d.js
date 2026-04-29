(function(){

    const CONFIG = {
        scene: "body",

        boxSelector: `
            header, nav, main, section, article, aside, footer,
            div, form, figure, blockquote, ul, ol, li,
            img, button, input, textarea, select
        `,

        textSelector: `
            h1,h2,h3,h4,h5,h6,p,span,a,label,figcaption,button,li
        `,

        cameraZ: -520,
        scale: 0.66,

        rotationStrength: 15,

        depthStep: 42,
        contentDepth: 24,
        maxDepth: 420,

        thicknessBase: 9,
        thicknessPerDepth: 3,
        thicknessStep: 0.9,

        textLayers: 7,
        textStep: 0.42,

        directionStrength: 5.5,

        debug: false
    };

    function getScriptParams(){
        const script = document.currentScript;
        if(!script) return {};

        const url = new URL(script.src);
        const params = {};

        url.searchParams.forEach((value,key)=>{
            if(value === "true") params[key] = true;
            else if(value === "false") params[key] = false;
            else if(!isNaN(value)) params[key] = Number(value);
            else params[key] = value;
        });

        return params;
    }

    function rgbFromCss(color){
        const v = color.match(/\d+/g);

        if(!v){
            return {r:180,g:180,b:180};
        }

        return {
            r:Number(v[0]),
            g:Number(v[1]),
            b:Number(v[2])
        };
    }

    function darken(rgb,f){
        return {
            r:Math.max(0,Math.round(rgb.r*f)),
            g:Math.max(0,Math.round(rgb.g*f)),
            b:Math.max(0,Math.round(rgb.b*f))
        };
    }

    function getBaseColor(el){
        const st = getComputedStyle(el);
        let color = st.backgroundColor;

        if(color === "rgba(0, 0, 0, 0)" || color === "transparent"){
            color = st.color;
        }

        return rgbFromCss(color);
    }

    function isVisible(el){
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function depthOf(el,root){
        let depth = 0;
        let current = el.parentElement;

        while(current && current !== root && current !== document.body){
            depth++;
            current = current.parentElement;
        }

        return depth;
    }

    function wrapContent(el,config){

        if(["IMG","INPUT","TEXTAREA","SELECT","BUTTON"].includes(el.tagName)){
            return;
        }

        if(
            el.children.length === 1 &&
            el.children[0].classList.contains("jocarsa-3d-content")
        ){
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "jocarsa-3d-content";

        while(el.firstChild){
            wrapper.appendChild(el.firstChild);
        }

        el.appendChild(wrapper);

        wrapper.style.transform =
            `translateZ(${config.contentDepth}px)`;
    }

    function boxShadow(el,dirX,dirY,config){

        const depth = Number(el.dataset.jocarsaDepth || 0);

        const base = {
            r:Number(el.dataset.jocarsaR),
            g:Number(el.dataset.jocarsaG),
            b:Number(el.dataset.jocarsaB)
        };

        const layers =
            config.thicknessBase + depth * config.thicknessPerDepth;

        const shadows = [];

        for(let i=1;i<=layers;i++){
            const c = darken(base,1 - i * 0.025);

            shadows.push(`
                ${dirX * i * config.thicknessStep}px
                ${dirY * i * config.thicknessStep}px
                0
                rgb(${c.r},${c.g},${c.b})
            `);
        }

        shadows.push(`
            ${dirX * layers * config.thicknessStep}px
            ${dirY * layers * config.thicknessStep}px
            16px
            rgba(0,0,0,.16)
        `);

        el.style.boxShadow = shadows.join(",");
    }

    function textShadow(el,dirX,dirY,config){

        const shadows = [];

        for(let i=1;i<=config.textLayers;i++){
            shadows.push(`
                ${dirX * i * config.textStep}px
                ${dirY * i * config.textStep}px
                0
                rgba(0,0,0,${0.36 - i * 0.035})
            `);
        }

        shadows.push(`
            ${dirX * 3}px
            ${dirY * 3}px
            8px
            rgba(0,0,0,.20)
        `);

        el.style.textShadow = shadows.join(",");
    }

    function init(options = {}){

        const config = {
            ...CONFIG,
            ...options
        };

        const root = document.querySelector(config.scene);

        if(!root){
            console.warn("Jocarsa3D: escena no encontrada:",config.scene);
            return;
        }

        root.classList.add("jocarsa-3d-scene");

        const boxes = [...root.querySelectorAll(config.boxSelector)]
            .filter(el => !el.classList.contains("jocarsa-3d-debug"))
            .filter(el => !el.closest(".jocarsa-3d-debug"))
            .filter(isVisible);

        boxes.forEach(el=>{

            el.classList.add("jocarsa-3d-box");

            const depth = depthOf(el,root);
            const z = Math.min(depth * config.depthStep,config.maxDepth);
            const color = getBaseColor(el);

            el.dataset.jocarsaDepth = depth;
            el.dataset.jocarsaZ = z;
            el.dataset.jocarsaR = color.r;
            el.dataset.jocarsaG = color.g;
            el.dataset.jocarsaB = color.b;

            el.style.transform = `translateZ(${z}px)`;

            wrapContent(el,config);

            if(config.debug){
                const label = document.createElement("div");
                label.className = "jocarsa-3d-debug";
                label.textContent = `Z ${z}px`;
                el.appendChild(label);
            }
        });

        const texts = [...root.querySelectorAll(config.textSelector)]
            .filter(isVisible);

        texts.forEach(el=>{
            el.classList.add("jocarsa-3d-text");
        });

        function update(e){

            const x = e.clientX / innerWidth - 0.5;
            const y = e.clientY / innerHeight - 0.5;

            const rotY = x * config.rotationStrength;
            const rotX = -y * config.rotationStrength;

            root.style.transform = `
                translateZ(${config.cameraZ}px)
                scale(${config.scale})
                rotateX(${rotX}deg)
                rotateY(${rotY}deg)
            `;

            const dirX =
                -Math.sin(rotY * Math.PI / 180) *
                config.directionStrength;

            const dirY =
                Math.sin(rotX * Math.PI / 180) *
                config.directionStrength;

            boxes.forEach(el=>boxShadow(el,dirX,dirY,config));
            texts.forEach(el=>textShadow(el,dirX,dirY,config));
        }

        document.addEventListener("mousemove",update);

        update({
            clientX:innerWidth/2,
            clientY:innerHeight/2
        });
    }

    window.Jocarsa3D = init;

    document.addEventListener("DOMContentLoaded",()=>{
        init(getScriptParams());
    });

})();
