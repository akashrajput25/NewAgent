import { useEffect, useRef } from 'react';

const COLORS = [
  '#c084fc',
  '#a855f7',
  '#8b5cf6',
  '#d8b4fe',
  '#7c3aed',
  '#e9d5ff',
  '#9333ea',
  '#6d28d9',
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  pulsePhase: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let mouseX = -9999;
    let mouseY = -9999;
    let isActive = true;

    const particles: Particle[] = [];
    const BASE_COUNT = 100;
    const CONNECT_DIST = 130;
    const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
    const MAX_LINKS = 3;
    const MOUSE_REPEL_RADIUS = 180;
    const MOUSE_REPEL_RADIUS_SQ = MOUSE_REPEL_RADIUS * MOUSE_REPEL_RADIUS;
    const MOUSE_FORCE = 0.8;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParticles() {
      particles.length = 0;
      const count = Math.floor(BASE_COUNT + (w * h) / 25000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          color: pick(COLORS),
          size: Math.random() * 2.5 + 1.5,
          alpha: Math.random() * 0.35 + 0.65,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    function drawParticle(p: Particle, time: number) {
      const pulse = Math.sin(time * 2 + p.pulsePhase) * 0.2 + 1;
      const drawSize = p.size * pulse;

      ctx!.globalAlpha = p.alpha;
      ctx!.fillStyle = p.color;

      // Sharp circle with very subtle glow
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, drawSize, 0, Math.PI * 2);
      ctx!.fill();

      // Tiny center highlight for crispness
      ctx!.globalAlpha = p.alpha * 0.5;
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.arc(p.x - drawSize * 0.2, p.y - drawSize * 0.2, drawSize * 0.3, 0, Math.PI * 2);
      ctx!.fill();
    }

    let raf = 0;
    let frameCount = 0;

    function animate() {
      if (!ctx || !isActive) return;
      frameCount++;
      const time = frameCount * 0.016;

      ctx.clearRect(0, 0, w, h);

      // Update particles
      for (const p of particles) {
        // Gentle random drift
        p.vx += (Math.random() - 0.5) * 0.015;
        p.vy += (Math.random() - 0.5) * 0.015;

        // Soft speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1.2) {
          p.vx = (p.vx / speed) * 1.2;
          p.vy = (p.vy / speed) * 1.2;
        }

        // Mouse repulsion
        const mdx = p.x - mouseX;
        const mdy = p.y - mouseY;
        const mDistSq = mdx * mdx + mdy * mdy;
        if (mDistSq < MOUSE_REPEL_RADIUS_SQ && mDistSq > 0.1) {
          const mDist = Math.sqrt(mDistSq);
          const force = ((MOUSE_REPEL_RADIUS - mDist) / MOUSE_REPEL_RADIUS) * MOUSE_FORCE;
          p.vx += (mdx / mDist) * force;
          p.vy += (mdy / mDist) * force;
        }

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Friction
        p.vx *= 0.995;
        p.vy *= 0.995;

        // Wrap edges with buffer
        const buffer = 20;
        if (p.x < -buffer) p.x = w + buffer;
        if (p.x > w + buffer) p.x = -buffer;
        if (p.y < -buffer) p.y = h + buffer;
        if (p.y > h + buffer) p.y = -buffer;
      }

      // Draw connections first (behind particles)
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        let links = 0;
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONNECT_DIST_SQ) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / CONNECT_DIST) * 0.2;
            ctx.strokeStyle = particles[i].color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            links++;
            if (links >= MAX_LINKS) break;
          }
        }
      }

      // Draw particles on top
      for (const p of particles) {
        drawParticle(p, time);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animate);
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    resize();
    initParticles();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    raf = requestAnimationFrame(animate);

    return () => {
      isActive = false;
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
