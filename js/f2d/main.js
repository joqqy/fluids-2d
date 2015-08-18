(function() {
    "use strict";

    var windowSize = new THREE.Vector2(window.innerWidth, window.innerHeight);

    var renderer = new THREE.WebGLRenderer();
    renderer.autoClear = false;
    renderer.sortObjects = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(windowSize.x, windowSize.y);
    renderer.setClearColor(0x00ff00);
    document.body.appendChild(renderer.domElement);

    var stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = "absolute";
    stats.domElement.style.left = "0px";
    stats.domElement.style.top = "0px";
    document.body.appendChild(stats.domElement);

    var grid = {
        size: new THREE.Vector2(512, 256),
        scale: 1
    };

    var displayScalar, displayVector;
    var displaySettings = {
        slab: "density"
    };

    var solver, gui;

    var mouse = new F2D.Mouse(grid);

    function init(shaders) {
        solver = F2D.Solver.make(grid, windowSize, shaders);

        displayScalar = new F2D.Display(shaders.basic, shaders.displayscalar);
        displayVector = new F2D.Display(shaders.basic, shaders.displayvector);

        gui = new dat.GUI();
        gui.add(displaySettings, "slab", [
            "density",
            "velocity",
            "divergence",
            "pressure"
        ]);

        var advectFolder = gui.addFolder("Advect");
        advectFolder.add(solver.advect, "timestep").min(0).step(0.01);
        advectFolder.add(solver.advect, "dissipation", {
            "none": 1,
            "slow": 0.998,
            "fast": 0.992,
            "very fast": 0.9
        });

        var jacobiFolder = gui.addFolder("Jacobi");
        jacobiFolder.add(solver.jacobi, "iterations", 0, 500, 1);

        // we need a splat color "adapter" since we want values between 0 and
        // 1 but also since dat.GUI requires a JavaScript array over a Three.js
        // vector
        var splatSettings = {
            color: [
                solver.ink.x * 255,
                solver.ink.y * 255,
                solver.ink.z * 255
            ]
        };
        var splatFolder = gui.addFolder("Splat");
        splatFolder.addColor(splatSettings, "color").onChange(function(value) {
            solver.ink.set(value[0] / 255, value[1] / 255, value[2] / 255);
        });
        splatFolder.add(solver.splat, "radius").min(0);

        var gridFolder = gui.addFolder("Grid");
        gridFolder.add(grid, "scale");

        requestAnimationFrame(update);
    }

    function update() {
        stats.begin();

        solver.step(renderer, mouse);
        render();

        stats.end();
        requestAnimationFrame(update);
    }

    function render() {
        var display, read;
        switch (displaySettings.slab) {
        case "velocity":
            display = displayVector;
            display.scale = display.bias = 0.5;
            read = solver.velocity.read;
            break;
        case "density":
            display = displayVector;
            display.scale = 1.0; display.bias = 0.0;
            read = solver.density.read;
            break;
        case "divergence":
            display = displayScalar;
            display.scale = display.bias = 0.5;
            read = solver.velocityDivergence.read;
            break;
        case "pressure":
            display = displayScalar;
            display.scale = display.bias = 0.5;
            read = solver.pressure.read;
            break;
        }
        display.render(renderer, read);
    }

    function resize() {
        windowSize.set(window.innerWidth, window.innerHeight);
        renderer.setSize(windowSize.x, windowSize.y);
    }
    window.onresize = resize;

    var loader = new F2D.FileLoader("shaders", [
        "advect.fs",
        "basic.vs",
        "gradient.fs",
        "jacobi.fs",
        "displayscalar.fs",
        "displayvector.fs",
        "divergence.fs",
        "splat.fs"
    ]);
    loader.run(function(files) {
        // remove file extension before passing shaders to init
        var shaders = {};
        for (var name in files) {
            shaders[name.split(".")[0]] = files[name];
        }
        init(shaders);
    });
}());