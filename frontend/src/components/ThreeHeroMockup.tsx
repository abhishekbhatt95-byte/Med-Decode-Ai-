import React, { useEffect, useRef, useState } from "react";

// Helper to check WebGL support
const checkWebGL = () => {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
};

export const ThreeHeroMockup: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useWebGL, setUseWebGL] = useState(true);
  const [loading, setLoading] = useState(true);

  // Card Content Data
  const docData = [
    {
      title: "Prescription Summary",
      lines: [
        "Amoxicillin 500mg (Antibiotic)",
        "Take TDS: Three times daily",
        "Take with food to avoid upset",
        "Complete full 7-day course",
      ],
      badge: "💊 PHARMACY RX",
      color: "#0F6E56", // Brand Teal Accent
      pos: [-1.4, 0.8, 0.4],
      rot: [0.05, 0.1, -0.05],
    },
    {
      title: "Lab Blood Panel",
      lines: [
        "Total Cholesterol: 240 mg/dL (HIGH)",
        "Diagnosis: Hyperlipidemia",
        "LDL: 160 mg/dL (Elevated)",
        "Repeat testing in 3 months",
      ],
      badge: "🔬 BLOOD panel",
      color: "#1e293b", // Navy Accent
      pos: [1.2, 0.6, 0.8],
      rot: [-0.08, -0.12, 0.05],
    },
    {
      title: "Confused Hospital Bill",
      lines: [
        "Emergency Dept visit: $980.00",
        "EOB Denial: Code 99283",
        "Patient Share: $120.00",
        "Appeal recommended",
      ],
      badge: "💵 BILLING CLAIM",
      color: "#dc2626", // Red Accent
      pos: [-0.8, -0.8, -0.2],
      rot: [0.12, -0.05, -0.02],
    },
    {
      title: "Pharmacy Label",
      lines: [
        "Take 1 capsule at bedtime",
        "Do not operate machinery",
        "Refills remaining: 3",
        "Qty: 30 capsules",
      ],
      badge: "🏷️ PHARMACY LABEL",
      color: "#d97706", // Amber Accent
      pos: [0.8, -0.9, 0.2],
      rot: [-0.05, 0.15, -0.08],
    },
    {
      title: "Discharge Summary",
      lines: [
        "Stable vital signs on release",
        "Follow up with primary doc",
        "Low sodium diet recommended",
        "Rest for 5 days post-discharge",
      ],
      badge: "📋 CLINICAL DISCHARGE",
      color: "#7c3aed", // Purple Accent
      pos: [0, 0, 1.2], // Center focus card
      rot: [0.02, -0.02, 0],
    },
  ];

  useEffect(() => {
    // Check WebGL availability
    if (!checkWebGL()) {
      setUseWebGL(false);
      setLoading(false);
      return;
    }

    let active = true;
    let renderer: any;
    let scene: any;
    let camera: any;
    let meshes: any[] = [];
    let animationFrameId: number;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Mouse position trackers for parallax
    let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Map to -1 to 1 range
      mouse.targetX = (x / rect.width) * 2 - 1;
      mouse.targetY = -(y / rect.height) * 2 + 1;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Helper to draw realistic vector document on canvas texture
    const createDocCanvas = (
      title: string,
      lines: string[],
      badgeText: string,
      color: string
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;

      // Card Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 640);

      // Header colored accent strip
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 512, 24);

      // Document Title
      ctx.fillStyle = "#1B2A33"; // Navy
      ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
      ctx.fillText(title, 40, 90);

      // Badge Container
      ctx.fillStyle = color + "1a"; // 10% opacity
      ctx.fillRect(40, 120, 200, 42);
      // Badge Text
      ctx.fillStyle = color;
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      ctx.fillText(badgeText, 55, 147);

      // Content Lines
      ctx.fillStyle = "#475569";
      ctx.font = "500 20px system-ui, -apple-system, sans-serif";
      lines.forEach((line, idx) => {
        // Draw bullet checkmark
        ctx.fillStyle = color;
        ctx.fillText("✓", 40, 220 + idx * 55);
        // Draw line text
        ctx.fillStyle = "#334155";
        ctx.fillText(line, 65, 220 + idx * 55);
      });

      // Decorative medical cross stamp in background
      ctx.strokeStyle = color + "08"; // super light cross
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(380, 440);
      ctx.lineTo(460, 440);
      ctx.moveTo(420, 400);
      ctx.lineTo(420, 480);
      ctx.stroke();

      // Card bottom border line
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(40, 540, 432, 2);

      // Decoded brand sign-off
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
      ctx.fillText("MEDDECODE AI VERIFIED", 40, 580);

      return canvas;
    };

    // Dynamically import Three.js
    import("three").then((THREE) => {
      if (!active) return;
      setLoading(false);

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      // 1. Scene & Camera setup
      scene = new THREE.Scene();
      
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.z = 8;

      // 2. Renderer setup
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // 3. Create meshes
      const geometry = new THREE.PlaneGeometry(2.3, 2.875); // 4:5 Aspect ratio matching canvas

      docData.forEach((doc) => {
        const docCanvas = createDocCanvas(doc.title, doc.lines, doc.badge, doc.color);
        const texture = new THREE.CanvasTexture(docCanvas);
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(doc.pos[0], doc.pos[1], doc.pos[2]);
        mesh.rotation.set(doc.rot[0], doc.rot[1], doc.rot[2]);
        
        // Add basic custom fields for animation offsets
        (mesh as any).originalPos = { x: doc.pos[0], y: doc.pos[1], z: doc.pos[2] };
        (mesh as any).originalRot = { x: doc.rot[0], y: doc.rot[1], z: doc.rot[2] };
        
        scene.add(mesh);
        meshes.push(mesh);
      });

      // 4. Animation Loop
      let clock = new THREE.Clock();

      const animate = () => {
        if (!active) return;
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Smoothly interpolate mouse positions
        if (!prefersReducedMotion) {
          mouse.x += (mouse.targetX - mouse.x) * 0.05;
          mouse.y += (mouse.targetY - mouse.y) * 0.05;
        }

        meshes.forEach((mesh, idx) => {
          // Subtle natural float/bobbing motion
          const floatOffset = Math.sin(elapsedTime * 0.8 + idx * 2) * 0.08;
          mesh.position.y = mesh.originalPos.y + floatOffset;

          // Parallax effect: shift meshes based on mouse coordinate and Z depth
          if (!prefersReducedMotion) {
            const depthFactor = (mesh.position.z + 1.5) * 0.25; // closer objects move more
            mesh.position.x = mesh.originalPos.x + mouse.x * depthFactor;
            mesh.rotation.y = mesh.originalRot.y + mouse.x * 0.08 * depthFactor;
            mesh.rotation.x = mesh.originalRot.x - mouse.y * 0.08 * depthFactor;
          }
        });

        renderer.render(scene, camera);
      };

      animate();

      // Handle Resize
      const handleResize = () => {
        if (!container || !camera || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener("resize", handleResize);

      // Clean up resize inside returning function
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    });

    return () => {
      active = false;
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      
      // Clean up WebGL resources
      if (renderer) {
        renderer.dispose();
      }
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m: any) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      });
    };
  }, []);

  // HTML/CSS fallback if WebGL is unavailable
  if (!useWebGL) {
    return (
      <div className="w-full py-8 flex flex-wrap justify-center gap-6 relative select-none">
        {docData.map((doc, idx) => (
          <div
            key={idx}
            style={{ borderColor: doc.color + "20" }}
            className="w-[240px] bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-lg transform transition-transform hover:-translate-y-2 hover:scale-[1.02] duration-300"
          >
            {/* Top accent bar */}
            <div
              className="h-2 rounded-full mb-4"
              style={{ backgroundColor: doc.color }}
            />
            {/* Title */}
            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-2">
              {doc.title}
            </h4>
            {/* Badge */}
            <span
              style={{ color: doc.color, backgroundColor: doc.color + "15" }}
              className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider mb-4"
            >
              {doc.badge}
            </span>
            {/* Lines */}
            <ul className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {doc.lines.map((line, lIdx) => (
                <li key={lIdx} className="flex items-start gap-1.5">
                  <span style={{ color: doc.color }}>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] md:min-h-[500px] relative flex items-center justify-center"
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-4 border-[#0F6E56] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">
            Loading 3D Workspace...
          </span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full transition-opacity duration-700 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
};
