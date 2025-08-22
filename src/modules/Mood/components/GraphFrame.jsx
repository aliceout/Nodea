// src/modules/Mood/components/RotatedFrame.jsx
import { useEffect, useRef, useState } from "react";

/**
 * Desktop : pas de rotation (le chart remplit 100% du parent).
 * Mobile (≤768px) :
 *  - on calcule la TAILLE DU CONTENEUR (pas le viewport)
 *  - on fixe la taille VISIBLE du chart après rotation :
 *       visibleWidth  = h * mobileWidthPct
 *       visibleHeight = w * mobileHeightPct
 *  - on prépare le bloc AVANT rotation en "swappant" :
 *       preRotateWidth  = visibleHeight
 *       preRotateHeight = visibleWidth
 *  - on fait rotate(90deg) translateY(-100%) avec origin-top-left
 *  - on centre en posant left/top = (container - visible)/2
 */
export default function RotatedFrame({
  children,
  mobileWidthPct = 1,
  mobileHeightPct = 1,
}) {
  const hostRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 }); // taille exacte du conteneur

  // Breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Taille du conteneur (strictement)
  useEffect(() => {
    const measure = () => {
      if (!hostRef.current) return;
      const r = hostRef.current.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      console.log("Measure container:", { w, h });
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    hostRef.current && ro.observe(hostRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const { w, h } = box;
  console.log("Render:", { w, h, isMobile });

  if (!w || !h)
    return <div ref={hostRef} className="w-full h-full overflow-hidden" />;

  if (!isMobile) {
    // Desktop : pas de rotation
    return (
      <div ref={hostRef} className="relative w-full h-full overflow-hidden">
        <div className="absolute inset-0">
          <div style={{ width: "100%", height: "100%" }}>{children}</div>
        </div>
      </div>
    );
  }

  // ------ Mobile : calculs précis ------
  // Dimensions VUES après rotation (paysage sur mobile tenu en portrait)
  const visibleWidth = h * mobileWidthPct; // doit s'inscrire dans h
  const visibleHeight = w * mobileHeightPct; // doit s'inscrire dans w

  // Dimensions AVANT rotation (swap)
  const preRotateWidth = visibleHeight; // deviendra la HAUTEUR visible
  const preRotateHeight = visibleWidth; // deviendra la LARGEUR visible


  console.log("Mobile calc:", {
    container: { w, h },
    visible: { width: visibleWidth, height: visibleHeight },
    preRotate: { width: preRotateWidth, height: preRotateHeight },
  });

  return (
    <div ref={hostRef} className="relative w-full h-full overflow-hidden">
      {/* Ce bloc est dimensionné AVANT rotation.
          Après rotate(90deg) translateY(-100%), sa boîte visible = (visibleWidth x visibleHeight). */}
      <div
        className="absolute"
        style={{
          // on positionne le coin haut-gauche du bloc ROTATÉ
          width: preRotateHeight,
          height: preRotateWidth,
          transformOrigin: "top left",
          transform: "rotate(90deg) translateY(-100%)",
          // pas de scale → pas de "zoom" parasite
        }}
      >
        <div style={{ width: "100%", height: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
