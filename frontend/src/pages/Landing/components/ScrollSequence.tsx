import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const ScrollSequence: React.FC = () => {
  const { t } = useTranslation();
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [buttonsActive, setButtonsActive] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fallbackImgRef = useRef<HTMLImageElement>(null);

  const FRAME_PATH = "/images/Hero%20section/";
  const FRAME_PREFIX = "ezgif-frame-";
  const FRAME_EXT = ".jpg";
  const FRAME_COUNT = 120;
  const SCROLL_LENGTH_VH = 3;

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const seqRef = useRef({ frame: 0 });

  const [buttonStyles, setButtonStyles] = useState({
    primary: {} as React.CSSProperties,
    secondary: {} as React.CSSProperties,
  });

  const frameSrc = (index: number) => {
    const n = String(index + 1).padStart(3, "0");
    return FRAME_PATH + FRAME_PREFIX + n + FRAME_EXT;
  };

  const drawImageCover = (img: HTMLImageElement, ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;

    const canvasRatio = width / height;
    const imgRatio = iw / ih;

    let sx, sy, sw, sh;

    if (imgRatio > canvasRatio) {
      sh = ih;
      sw = ih * canvasRatio;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      sw = iw;
      sh = iw / canvasRatio;
      sx = 0;
      sy = (ih - sh) / 2;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  };

  const renderFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(seqRef.current.frame)));
    const img = imagesRef.current[idx];
    if (img && img.complete && img.naturalWidth) {
      const rect = canvas.getBoundingClientRect();
      drawImageCover(img, ctx, rect.width, rect.height);
    } else {
      // Progressive fallback: search for closest completed frame to draw
      let fallbackImg = null;
      // Search downwards first (prior frames)
      for (let i = idx; i >= 0; i--) {
        if (imagesRef.current[i] && imagesRef.current[i].complete && imagesRef.current[i].naturalWidth) {
          fallbackImg = imagesRef.current[i];
          break;
        }
      }
      // If not found, search upwards (subsequent frames)
      if (!fallbackImg) {
        for (let i = idx + 1; i < FRAME_COUNT; i++) {
          if (imagesRef.current[i] && imagesRef.current[i].complete && imagesRef.current[i].naturalWidth) {
            fallbackImg = imagesRef.current[i];
            break;
          }
        }
      }
      if (fallbackImg) {
        const rect = canvas.getBoundingClientRect();
        drawImageCover(fallbackImg, ctx, rect.width, rect.height);
      }
    }
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = stage.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame();
    updateButtonPositions();
  };

  const updateButtonPositions = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const imgW = 1280;
    const imgH = 720;
    const imgRatio = imgW / imgH; // 1.7778
    const stageRatio = W / H;

    let renderedW, renderedH, xOffset, yOffset;

    if (stageRatio > imgRatio) {
      // Stage is wider than image (cropped top/bottom)
      renderedW = W;
      renderedH = W / imgRatio;
      xOffset = 0;
      yOffset = (H - renderedH) / 2;
    } else {
      // Stage is taller than image (cropped left/right)
      renderedH = H;
      renderedW = H * imgRatio;
      xOffset = (W - renderedW) / 2;
      yOffset = 0;
    }

    // Button coordinates in percentage of the image (1280x720)
    // Primary: x: 31.875%, y: 48.889%, w: 7.5%, h: 5.556%
    const pX = 0.31875;
    const pY = 0.48889;
    const pW = 0.075;
    const pH = 0.05556;

    // Secondary: x: 40.0%, y: 48.889%, w: 7.188%, h: 5.556%
    const sX = 0.400;
    const sY = 0.48889;
    const sW = 0.07188;
    const sH = 0.05556;

    setButtonStyles({
      primary: {
        position: "absolute",
        left: `${xOffset + pX * renderedW}px`,
        top: `${yOffset + pY * renderedH}px`,
        width: `${pW * renderedW}px`,
        height: `${pH * renderedH}px`,
      },
      secondary: {
        position: "absolute",
        left: `${xOffset + sX * renderedW}px`,
        top: `${yOffset + sY * renderedH}px`,
        width: `${sW * renderedW}px`,
        height: `${sH * renderedH}px`,
      },
    });
  };

  useEffect(() => {
    // 1. Initial source for fallback
    if (fallbackImgRef.current) {
      fallbackImgRef.current.src = frameSrc(0);
    }

    // 2. Preload frames
    let localLoadedCount = 0;
    let localFirstFrameReady = false;

    const INITIAL_LOAD_LIMIT = 25;

    const handleFrameSettled = () => {
      localLoadedCount++;
      setLoadedCount(localLoadedCount);

      if (!localFirstFrameReady && imagesRef.current[0] && imagesRef.current[0].complete) {
        localFirstFrameReady = true;
        resizeCanvas();
      }

      if (localLoadedCount >= INITIAL_LOAD_LIMIT) {
        setIsLoaded(true);
      }
    };

    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.onload = handleFrameSettled;
      img.onerror = handleFrameSettled;
      img.src = frameSrc(i);
      imgs.push(img);
    }
    imagesRef.current = imgs;

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // GSAP and ScrollTrigger setup
  useEffect(() => {
    if (!isLoaded) return;

    // Trigger initial resize to align everything
    resizeCanvas();

    const ctx = gsap.context(() => {
      gsap.to(seqRef.current, {
        frame: FRAME_COUNT - 1,
        ease: "none",
        scrollTrigger: {
          trigger: trackRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.35,
          pin: stageRef.current,
          anticipatePin: 1,
        },
        onUpdate: () => {
          renderFrame();
          const frameIndex = seqRef.current.frame;
          // Active near frame 0 (frames 1-5, so index 0 to 4. We use < 6 to be safe)
          const active = frameIndex < 6;
          setButtonsActive(active);
        },
      });
    });

    ScrollTrigger.addEventListener("refreshInit", resizeCanvas);

    return () => {
      ctx.revert();
      ScrollTrigger.removeEventListener("refreshInit", resizeCanvas);
    };
  }, [isLoaded]);

  const pct = Math.round((loadedCount / FRAME_COUNT) * 100);

  return (
    <div
      ref={trackRef}
      className="relative w-full"
      style={{ height: `${SCROLL_LENGTH_VH * 100}vh` }}
    >
      {/* Screen Reader accessible SEO & screen reader content */}
      <div className="sr-only">
        <h1>{t("landing.headline")}</h1>
        <p>{t("landing.subcopy")}</p>
      </div>

      <div
        ref={stageRef}
        className="relative w-full h-[100vh] overflow-hidden flex items-center justify-center bg-[#0a0a0a]"
      >
        {/* Fallback image (first frame) shown underneath or until fully loaded */}
        {!isLoaded && (
          <img
            ref={fallbackImgRef}
            className="absolute inset-0 w-full h-full object-cover object-center z-1"
            alt=""
          />
        )}

        {/* The main canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block w-full h-full z-0"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Clickable hit areas overlay */}
        {isLoaded && (
          <div 
            className="absolute inset-0 w-full h-full z-10"
            style={{ pointerEvents: buttonsActive ? "auto" : "none" }}
          >
            {/* Primary Button Hit Area */}
            <Link
              to="/upload"
              style={{
                ...buttonStyles.primary,
                opacity: 0,
                cursor: buttonsActive ? "pointer" : "default",
                pointerEvents: buttonsActive ? "auto" : "none",
              }}
              tabIndex={buttonsActive ? 0 : -1}
              aria-label={t("landing.decodeBtn")}
              onClick={(e) => {
                if (!buttonsActive) {
                  e.preventDefault();
                }
              }}
            />

            {/* Secondary Button Hit Area */}
            <a
              href="#interactive-demo"
              style={{
                ...buttonStyles.secondary,
                opacity: 0,
                cursor: buttonsActive ? "pointer" : "default",
                pointerEvents: buttonsActive ? "auto" : "none",
              }}
              tabIndex={buttonsActive ? 0 : -1}
              aria-label={t("landing.demoBtn")}
              onClick={(e) => {
                if (!buttonsActive) {
                  e.preventDefault();
                  return;
                }
                const el = document.getElementById("interactive-demo");
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />
          </div>
        )}

        {/* Loading overlay */}
        {!isLoaded && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-[14px] bg-[#0a0a0a] text-[#eaeaea] font-sans text-[14px] tracking-[0.02em] z-[5] transition-opacity duration-500"
          >
            <div className="w-[160px] h-[3px] bg-white/15 rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-[#eaeaea] rounded-[2px] transition-[width] duration-150 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div>Loading {pct}%</div>
          </div>
        )}
      </div>
    </div>
  );
};
