class StarfieldBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.stars = [];
        this.numStars = 200; // Number of stars
        this.speed = 0.5;
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize stars
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push(this.createStar(true));
        }

        this.animate();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    createStar(randomZ = false) {
        return {
            x: (Math.random() - 0.5) * this.width * 2,
            y: (Math.random() - 0.5) * this.height * 2,
            z: randomZ ? Math.random() * this.width : this.width,
            size: Math.random() * 2
        };
    }

    update() {
        this.ctx.fillStyle = '#09090b'; // Dark background
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw stars
        this.stars.forEach((star, index) => {
            // Move star closer
            star.z -= this.speed * 10;

            // Reset star if it passes screen
            if (star.z <= 0) {
                this.stars[index] = this.createStar();
                this.stars[index].z = this.width;
            }

            // Project 3D coordinates to 2D
            const x = (star.x / star.z) * (this.width / 2) + (this.width / 2);
            const y = (star.y / star.z) * (this.height / 2) + (this.height / 2);

            // Calculate size based on depth
            const size = (1 - star.z / this.width) * 3 * star.size;
            const opacity = (1 - star.z / this.width);

            if (x >= 0 && x <= this.width && y >= 0 && y <= this.height && size > 0) {
                this.ctx.beginPath();
                this.ctx.fillStyle = `rgba(147, 197, 253, ${opacity})`; // Blue-ish white
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();

            }
        });
    }

    animate() {
        this.update();
        requestAnimationFrame(() => this.animate());
    }
}
