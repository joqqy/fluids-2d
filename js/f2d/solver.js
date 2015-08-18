var F2D = F2D === undefined ? {} : F2D;

(function(F2D) {
    "use strict";

    F2D.Solver = function(grid, windowSize, slabs, slabop) {
        this.grid = grid;
        this.windowSize = windowSize;

        // slabs
        this.velocity = slabs.velocity;
        this.density = slabs.density;
        this.velocityDivergence = slabs.velocityDivergence;
        this.pressure = slabs.pressure;

        // slab operations
        this.advect = slabop.advect;
        this.divergence = slabop.divergence;
        this.jacobi = slabop.jacobi;
        this.gradient = slabop.gradient;
        this.splat = slabop.splat;

        // density color
        this.ink = new THREE.Vector3(0.0, 0.06, 0.19);
    };

    F2D.Solver.prototype = {
        constructor: F2D.Solver,

        step: function(renderer, mouse) {
            // we only want the quantity carried by the velocity field to be
            // affected by the dissipation
            var temp = this.advect.dissipation;
            this.advect.dissipation = 1;
            this.advect.compute(renderer, this.velocity, this.velocity, this.velocity);

            this.advect.dissipation = temp;
            this.advect.compute(renderer, this.velocity, this.density, this.density);

            this.addForces(renderer, mouse);
            this.project(renderer);
        },

        addForces: (function() {
            var point = new THREE.Vector2();
            var force = new THREE.Vector3();
            return function(renderer, mouse) {
                for (var i = 0; i < mouse.motions.length; i++) {
                    var motion = mouse.motions[i];

                    point.set(motion.position.x, this.windowSize.y - motion.position.y);
                    // normalize to [0, 1] and scale to grid size
                    point.x = (point.x / this.windowSize.x) * this.grid.size.x;
                    point.y = (point.y / this.windowSize.y) * this.grid.size.y;

                    if (motion.left) {
                        force.set(
                             motion.drag.x,
                            -motion.drag.y,
                             0
                        );
                        this.splat.compute(
                            renderer,
                            this.velocity,
                            force,
                            point,
                            this.velocity
                        );
                    }

                    if (motion.right) {
                        this.splat.compute(
                            renderer,
                            this.density,
                            this.ink,
                            point,
                            this.density
                        );
                    }
                }
                mouse.motions = [];
            };
        })(),

        // solve poisson equation and subtract pressure gradient
        project: function(renderer) {
            this.divergence.compute(renderer, this.velocity, this.velocityDivergence);

            // 0 is our initial guess for the poisson equation solver
            this.clearSlab(renderer, this.pressure);
            this.jacobi.compute(renderer, this.pressure, this.velocityDivergence, this.pressure);

            this.gradient.compute(renderer, this.pressure, this.velocity, this.velocity);
        },

        clearSlab: function(renderer, slab) {
            renderer.clearTarget(slab.write, true, false, false);
            slab.swap();
        }
    };

    F2D.Solver.make = function(grid, windowSize, shaders) {
        var w = grid.size.x,
            h = grid.size.y;

        var slabs = {
            // vec2
            velocity: F2D.Slab.make(w, h),
            // vec3
            density: F2D.Slab.make(w, h),
            // scalar
            velocityDivergence: F2D.Slab.make(w, h),
            pressure: F2D.Slab.make(w, h)
        };

        var slabop = {
            advect: new F2D.Advect(shaders.advect, grid),
            divergence: new F2D.Divergence(shaders.divergence, grid),
            jacobi: new F2D.Jacobi(shaders.jacobi, grid),
            gradient: new F2D.Gradient(shaders.gradient, grid),
            splat: new F2D.Splat(shaders.splat, grid)
        };

        return new F2D.Solver(grid, windowSize, slabs, slabop);
    };

}(F2D));