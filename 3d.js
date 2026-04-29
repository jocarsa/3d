(function(){

    const DEFAULT_CONFIG = {
        sceneSelector: "body",

        selector: `
            header, nav, main, section, article, aside, footer,
            div, img, h1, h2, h3, h4, h5, h6, p, span,
            ul, ol, li, a, button, input, textarea, select,
            form, label, figure, figcaption, blockquote
        `,

        ignoreSelector: `
            script, style, link, meta, title, br, svg,
            .jocarsa-3d-debug
        `,

        cameraZ: -520,
        scale: 0.68,

        rotationStrength: 14,

        depthStep: 22,
        maxDepth: 280,

        contentDepth: 10,

        thicknessBase: 5,
        thicknessPerDepth: 0.8,
        thicknessStep: 0.55,

        textLayers: 5,
        textStep: 0.32,

        directionStrength: 5,

        debug: true
    };

    function rgbFromCss(color){
        const values = color.match(/\d+/g);

        if(!values){
            return { r:180, g:180, b:180 };
        }

        return {
            r:Number(values[0]),
            g:Number(values[1]),
            b:Number(values[2])
        };
    }

    function darken(rgb, factor){
        return {
            r:Math.max(0, Math.round(rgb.r * factor)),
            g:Math.max(0, Math.round(rgb.g * factor)),
            b:Math.max(0, Math.round(rgb.b * factor))
        };
    }

    function isTextElement(el){
        return [
            "H1","H2","H3","H4","H5","H6",
            "P","SPAN","A","LI","LABEL","BUTTON"
        ].includes(el.tagName);
    }

    function hasVisibleBox(el){
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function naturalDepth(el, root){
        let depth = 0;
        let current = el.parentElement;

        while(current && current !== root && current !== document.body){
            depth++;
            current = current.parentElement;
        }

        return depth;
    }

    function getElementBaseColor(el){
        const style = getComputedStyle(el);

        let color = style.backgroundColor;

        if(
            color === "rgba(0, 0, 0, 0)" ||
            color === "transparent"
        ){
            color = style.color;
        }

        return rgbFromCss(color);
    }

    function createContentWrapper(el){
        if(
            el.children.length === 1 &&
            el.children[0].classList.contains("jocarsa-3d-content")
        ){
            return el.children[0];
        }

        if(["IMG","INPUT","TEXTAREA","SELECT","BUTTON"].includes(el.tagName)){
            return null;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "jocarsa-3d-content";

        while(el.firstChild){
            wrapper.appendChild(el.firstChild);
        }

        el.appendChild(wrapper);

        return wrapper;
    }

    function applyBoxShadow(el, dirX, dirY, config){
        const depth = Number(el.dataset.jocarsaDepth || 0);

        const base = {
            r:Number(el.dataset.jocarsaR),
            g:Number(el.dataset.jocarsaG),
            b:Number(el.dataset.jocarsaB)
        };

        const layers = Math.round(
            config.thicknessBase + depth * config.thicknessPerDepth
        );

        const shadows = [];

        for(let i = 1; i <= layers; i++){
            const color = darken(base, 1 - i * 0.025);

            shadows.push(`
                ${dirX * i * config.thicknessStep}px
                ${dirY * i * config.thicknessStep}px
                0
                rgb(${color.r},${color.g},${color.b})
            `);
        }

        shadows.push(`
            ${dirX * layers * config.thicknessStep}px
            ${dirY * layers * config.thicknessStep}px
            14px
            rgba(0,0,0,.14)
        `);

        el.style.boxShadow = shadows.join(",");
    }

    function applyTextShadow(el, dirX, dirY, config){
        const shadows = [];

        for(let i = 1; i <= config.textLayers; i++){
            shadows.push(`
                ${dirX * i * config.textStep}px
                ${dirY * i * config.textStep}px
                0
                rgba(0,0,0,${0.32 - i * 0.035})
            `);
        }

        shadows.push(`
            ${dirX * 2}px
            ${dirY * 2}px
            6px
            rgba(0,0,0,.18)
        `);

        el.style.textShadow = shadows.join(",");
    }

    window.Jocarsa3D = function(options = {}){

        const config = {
            ...DEFAULT_CONFIG,
            ...options
        };

        const root = document.querySelector(config.sceneSelector);

        if(!root){
            console.warn("Jocarsa3D: no se ha encontrado la escena.");
            return;
        }

        root.classList.add("jocarsa-3d-scene");

        const elements = [...root.querySelectorAll(config.selector)]
            .filter(el => !el.matches(config.ignoreSelector))
            .filter(el => !el.closest(".jocarsa-3d-debug"))
            .filter(hasVisibleBox);

        elements.forEach(el => {

            el.classList.add("jocarsa-3d-element");

            const depth = naturalDepth(el, root);
            const z = Math.min(depth * config.depthStep, config.maxDepth);
            const baseColor = getElementBaseColor(el);

            el.dataset.jocarsaDepth = depth;
            el.dataset.jocarsaZ = z;
            el.dataset.jocarsaR = baseColor.r;
            el.dataset.jocarsaG = baseColor.g;
            el.dataset.jocarsaB = baseColor.b;

            el.style.transform = `translateZ(${z}px)`;

            const wrapper = createContentWrapper(el);

            if(wrapper){
                wrapper.style.transform =
                    `translateZ(${config.contentDepth}px)`;
            }

            if(config.debug){
                const label = document.createElement("div");
                label.className = "jocarsa-3d-debug";
                label.textContent = `Z ${z}px`;
                el.appendChild(label);
            }
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

            elements.forEach(el => {
                applyBoxShadow(el, dirX, dirY, config);

                if(isTextElement(el)){
                    applyTextShadow(el, dirX, dirY, config);
                }
            });
        }

        document.addEventListener("mousemove", update);

        update({
            clientX:innerWidth / 2,
            clientY:innerHeight / 2
        });

        return {
            elements,
            update
        };
    };

})();
