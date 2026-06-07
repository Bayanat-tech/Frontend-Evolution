import { useEffect, useRef, useState } from "react";

export function WmsBootScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 30000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (timedOut) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 520, H = 160;
    const ROAD_Y = 128;
    const WR = 16; // wheel radius
    let wA = 0, bobT = 0, roadOff = 0;
    let rafId: number;

    // ── helpers ──────────────────────────────────────────────────────────────
    function rr(x: number, y: number, w: number, h: number, r: number) {
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.lineTo(x + w - r, y);
      ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx!.lineTo(x + w, y + h - r);
      ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx!.lineTo(x + r, y + h);
      ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx!.lineTo(x, y + r);
      ctx!.quadraticCurveTo(x, y, x + r, y);
      ctx!.closePath();
    }

    function wheel(cx: number, cy: number, angle: number, big = false) {
      const R = big ? WR : WR - 2;
      // Tyre
      ctx!.beginPath(); ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = "#1a1f2e"; ctx!.fill();
      ctx!.strokeStyle = "#0f1117"; ctx!.lineWidth = 1.5; ctx!.stroke();

      // Tyre tread ring
      ctx!.beginPath(); ctx!.arc(cx, cy, R - 3, 0, Math.PI * 2);
      ctx!.strokeStyle = "#2d3548"; ctx!.lineWidth = 2; ctx!.stroke();

      // Rim
      ctx!.beginPath(); ctx!.arc(cx, cy, R - 5, 0, Math.PI * 2);
      ctx!.fillStyle = "#c0c8d8"; ctx!.fill();
      ctx!.strokeStyle = "#8899b0"; ctx!.lineWidth = 1; ctx!.stroke();

      // Hub cap
      ctx!.beginPath(); ctx!.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx!.fillStyle = "#e8edf5"; ctx!.fill();
      ctx!.strokeStyle = "#a0aabb"; ctx!.lineWidth = 0.8; ctx!.stroke();

      // Spokes
      ctx!.strokeStyle = "#8899b0"; ctx!.lineWidth = 1.8; ctx!.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = angle + (i * Math.PI) / 3;
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5);
        ctx!.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
        ctx!.stroke();
      }

      // Lug nuts
      ctx!.fillStyle = "#9aabbd";
      for (let i = 0; i < 6; i++) {
        const a = angle + (i * Math.PI) / 3;
        const nx = cx + Math.cos(a) * (R - 8);
        const ny = cy + Math.sin(a) * (R - 8);
        ctx!.beginPath(); ctx!.arc(nx, ny, 1.8, 0, Math.PI * 2); ctx!.fill();
      }
    }

    function dualWheel(cx: number, cy: number, angle: number) {
      wheel(cx - 4, cy, angle);
      // Inner rim peaking behind
      ctx!.beginPath(); ctx!.arc(cx + 5, cy, WR - 1, 0, Math.PI * 2);
      ctx!.fillStyle = "#111520"; ctx!.fill();
      ctx!.strokeStyle = "#0f1117"; ctx!.lineWidth = 1; ctx!.stroke();
      ctx!.beginPath(); ctx!.arc(cx + 5, cy, WR - 6, 0, Math.PI * 2);
      ctx!.fillStyle = "#b0baca"; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(cx + 5, cy, 4, 0, Math.PI * 2);
      ctx!.fillStyle = "#dde3ed"; ctx!.fill();
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      // ── Road ──────────────────────────────────────────────────────────────
      // Road surface
      ctx!.fillStyle = "#d1d8e4";
      ctx!.fillRect(0, ROAD_Y, W, H - ROAD_Y);

      // Road top edge shadow
      const roadGrad = ctx!.createLinearGradient(0, ROAD_Y, 0, ROAD_Y + 8);
      roadGrad.addColorStop(0, "rgba(0,0,0,0.08)");
      roadGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = roadGrad;
      ctx!.fillRect(0, ROAD_Y, W, 8);

      // Road divider line
      ctx!.strokeStyle = "#b8c2d0"; ctx!.lineWidth = 1.5;
      ctx!.beginPath(); ctx!.moveTo(0, ROAD_Y); ctx!.lineTo(W, ROAD_Y); ctx!.stroke();

      // Dashed centre line
      const dw = 28, gap = 20, tot = dw + gap;
      const off2 = roadOff % tot;
      ctx!.fillStyle = "#a8b4c4";
      for (let x = -tot + off2; x < W + tot; x += tot) {
        rr(x, ROAD_Y + 14, dw, 4, 2); ctx!.fill();
      }

      // ── Vehicle positioning ───────────────────────────────────────────────
      const bob = Math.sin(bobT) * 2;
      const gY = ROAD_Y - WR; // ground contact y
      const tY = gY + bob;    // truck base y (with bob)
      const TX = 18;          // left origin

      // ── TRAILER ───────────────────────────────────────────────────────────
      const trW = 228, trH = 68, trX = TX;
      const trTop = tY - trH;

      // Trailer shadow
      ctx!.fillStyle = "rgba(0,0,0,0.07)";
      ctx!.beginPath();
      ctx!.ellipse(trX + trW / 2, tY + 2, trW / 2, 5, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Trailer body
      rr(trX, trTop, trW, trH, 3);
      ctx!.fillStyle = "#f5f7fb"; ctx!.fill();
      ctx!.strokeStyle = "#b0bccf"; ctx!.lineWidth = 1.5; ctx!.stroke();

      // Trailer roof ridge
      ctx!.strokeStyle = "#c8d3e2"; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.moveTo(trX + 6, trTop + 4); ctx!.lineTo(trX + trW - 6, trTop + 4); ctx!.stroke();

      // Trailer vertical ribs
      ctx!.strokeStyle = "#d8e0ec"; ctx!.lineWidth = 0.8;
      for (let rx = trX + 30; rx < trX + trW - 10; rx += 28) {
        ctx!.beginPath(); ctx!.moveTo(rx, trTop + 5); ctx!.lineTo(rx, tY - 2); ctx!.stroke();
      }

      // Trailer mid horizontal rail
      ctx!.strokeStyle = "#c0cad8"; ctx!.lineWidth = 1.2;
      ctx!.beginPath(); ctx!.moveTo(trX + 2, trTop + trH / 2); ctx!.lineTo(trX + trW - 2, trTop + trH / 2); ctx!.stroke();

      // Trailer rear door details
      // Rear door frame
      ctx!.strokeStyle = "#98a8be"; ctx!.lineWidth = 1.5;
      rr(trX + 3, trTop + 6, 22, trH - 8, 2); ctx!.stroke();
      rr(trX + 3, trTop + 6, 22, (trH - 8) / 2 - 1, 2); ctx!.stroke();
      rr(trX + 3, trTop + (trH - 8) / 2 + 7, 22, (trH - 8) / 2, 2); ctx!.stroke();

      // Rear door hinges
      ctx!.fillStyle = "#8090a8";
      [trTop + 14, trTop + trH / 2, trTop + trH - 12].forEach(hy => {
        ctx!.beginPath(); ctx!.roundRect(trX + 1, hy, 4, 6, 1); ctx!.fill();
      });

      // Rear door handle bar
      ctx!.strokeStyle = "#8090a8"; ctx!.lineWidth = 2; ctx!.lineCap = "round";
      ctx!.beginPath(); ctx!.moveTo(trX + 10, trTop + trH / 2 - 8); ctx!.lineTo(trX + 10, trTop + trH / 2 + 8); ctx!.stroke();

      // ── TRAILER UNDERCARRIAGE ─────────────────────────────────────────────
      // Chassis beams
      ctx!.fillStyle = "#8090a8";
      ctx!.beginPath(); ctx!.roundRect(trX + 30, tY - 10, trW - 60, 5, 1); ctx!.fill();
      ctx!.strokeStyle = "#6070888"; ctx!.lineWidth = 0.8; ctx!.stroke();

      // Landing gear (support legs)
      ctx!.fillStyle = "#909db0";
      ctx!.beginPath(); ctx!.roundRect(trX + 45, tY - 10, 6, 10, 1); ctx!.fill();
      ctx!.beginPath(); ctx!.roundRect(trX + 48, tY, 14, 4, 1); ctx!.fill(); // foot

      // ── TRAILER WHEELS ────────────────────────────────────────────────────
      dualWheel(trX + 60, tY, wA);
      dualWheel(trX + 90, tY, wA);

      // ── COUPLER ───────────────────────────────────────────────────────────
      ctx!.fillStyle = "#5a6880";
      ctx!.beginPath(); ctx!.roundRect(trX + trW - 2, tY - 38, 12, 10, 2); ctx!.fill();
      ctx!.strokeStyle = "#404e60"; ctx!.lineWidth = 1; ctx!.stroke();
      // Pin
      ctx!.fillStyle = "#3a4555";
      ctx!.beginPath(); ctx!.roundRect(trX + trW + 3, tY - 36, 4, 6, 1); ctx!.fill();

      // ── CAB ───────────────────────────────────────────────────────────────
      const cabX = trX + trW + 10;
      const cabW = 178;
      const cabH = 82;
      const cabTop = tY - cabH;

      // Cab shadow
      ctx!.fillStyle = "rgba(0,0,0,0.09)";
      ctx!.beginPath();
      ctx!.ellipse(cabX + cabW / 2, tY + 2, cabW / 2 - 5, 5, 0, 0, Math.PI * 2);
      ctx!.fill();

      // ── Cab main body ─────────────────────────────────────────────────────
      ctx!.beginPath();
      ctx!.moveTo(cabX, tY);
      ctx!.lineTo(cabX, cabTop + 22);
      ctx!.quadraticCurveTo(cabX, cabTop + 8, cabX + 14, cabTop + 2);
      ctx!.lineTo(cabX + 70, cabTop);
      ctx!.lineTo(cabX + cabW - 8, cabTop + 3);
      ctx!.quadraticCurveTo(cabX + cabW, cabTop + 3, cabX + cabW, cabTop + 12);
      ctx!.lineTo(cabX + cabW, tY);
      ctx!.closePath();

      // Cab gradient fill (side light)
      const cabGrad = ctx!.createLinearGradient(cabX, 0, cabX + cabW, 0);
      cabGrad.addColorStop(0, "#003a99");
      cabGrad.addColorStop(0.55, "#0044b0");
      cabGrad.addColorStop(1, "#002d80");
      ctx!.fillStyle = cabGrad; ctx!.fill();
      ctx!.strokeStyle = "#001e5a"; ctx!.lineWidth = 1.5; ctx!.stroke();

      // ── Cab roof panel ────────────────────────────────────────────────────
      ctx!.beginPath();
      ctx!.moveTo(cabX + 2, cabTop + 22);
      ctx!.quadraticCurveTo(cabX + 2, cabTop + 9, cabX + 15, cabTop + 3);
      ctx!.lineTo(cabX + 70, cabTop + 1);
      ctx!.lineTo(cabX + 82, cabTop + 1);
      ctx!.lineTo(cabX + 82, cabTop + 20);
      ctx!.closePath();
      ctx!.fillStyle = "#002880"; ctx!.fill();

      // ── Cab roof spoiler ──────────────────────────────────────────────────
      ctx!.beginPath();
      ctx!.moveTo(cabX + 12, cabTop + 2);
      ctx!.quadraticCurveTo(cabX + 40, cabTop - 14, cabX + 80, cabTop - 2);
      ctx!.lineTo(cabX + 80, cabTop + 1);
      ctx!.lineTo(cabX + 12, cabTop + 3);
      ctx!.closePath();
      ctx!.fillStyle = "#002070"; ctx!.fill();
      ctx!.strokeStyle = "#001550"; ctx!.lineWidth = 1; ctx!.stroke();

      // ── Windshield ────────────────────────────────────────────────────────
      ctx!.beginPath();
      ctx!.moveTo(cabX + 16, cabTop + 22);
      ctx!.lineTo(cabX + 20, cabTop + 4);
      ctx!.lineTo(cabX + 74, cabTop + 2);
      ctx!.lineTo(cabX + 80, cabTop + 22);
      ctx!.closePath();
      ctx!.fillStyle = "#b8d8f8";
      ctx!.strokeStyle = "#7ab0e0"; ctx!.lineWidth = 1.2;
      ctx!.fill(); ctx!.stroke();

      // Windshield centre divider
      ctx!.strokeStyle = "#8ab8e8"; ctx!.lineWidth = 1.2;
      ctx!.beginPath();
      ctx!.moveTo(cabX + 47, cabTop + 2);
      ctx!.lineTo(cabX + 48, cabTop + 22);
      ctx!.stroke();

      // Windshield glare
      ctx!.fillStyle = "rgba(255,255,255,0.22)";
      ctx!.beginPath();
      ctx!.moveTo(cabX + 17, cabTop + 21);
      ctx!.lineTo(cabX + 21, cabTop + 5);
      ctx!.lineTo(cabX + 34, cabTop + 5);
      ctx!.lineTo(cabX + 29, cabTop + 21);
      ctx!.closePath(); ctx!.fill();

      // ── Wiper lines ───────────────────────────────────────────────────────
      ctx!.strokeStyle = "rgba(0,0,0,0.18)"; ctx!.lineWidth = 0.8;
      ctx!.beginPath();
      ctx!.moveTo(cabX + 22, cabTop + 20);
      ctx!.lineTo(cabX + 38, cabTop + 5);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(cabX + 58, cabTop + 20);
      ctx!.lineTo(cabX + 72, cabTop + 5);
      ctx!.stroke();

      // ── Cab driver door ───────────────────────────────────────────────────
      // Door frame
      ctx!.strokeStyle = "rgba(255,255,255,0.18)"; ctx!.lineWidth = 1;
      rr(cabX + 5, cabTop + 26, 48, 30, 3); ctx!.stroke();

      // Door window
      rr(cabX + 7, cabTop + 27, 44, 16, 3);
      ctx!.fillStyle = "rgba(160,200,240,0.35)"; ctx!.fill();
      ctx!.strokeStyle = "rgba(255,255,255,0.2)"; ctx!.lineWidth = 0.8; ctx!.stroke();

      // Door window glare
      ctx!.fillStyle = "rgba(255,255,255,0.12)";
      ctx!.beginPath();
      ctx!.moveTo(cabX + 8, cabTop + 28);
      ctx!.lineTo(cabX + 16, cabTop + 28);
      ctx!.lineTo(cabX + 14, cabTop + 42);
      ctx!.lineTo(cabX + 8, cabTop + 42);
      ctx!.closePath(); ctx!.fill();

      // Door handle
      ctx!.strokeStyle = "rgba(255,255,255,0.6)"; ctx!.lineWidth = 1.8; ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(cabX + 18, cabTop + 50);
      ctx!.lineTo(cabX + 32, cabTop + 50);
      ctx!.stroke();
      ctx!.beginPath(); ctx!.arc(cabX + 18, cabTop + 50, 2, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(255,255,255,0.5)"; ctx!.fill();

      // Door lower body stripe
      ctx!.strokeStyle = "rgba(255,255,255,0.1)"; ctx!.lineWidth = 0.8;
      ctx!.beginPath();
      ctx!.moveTo(cabX + 5, cabTop + 55);
      ctx!.lineTo(cabX + 53, cabTop + 55);
      ctx!.stroke();

      // ── Cab side window (sleeper bump) ────────────────────────────────────
      rr(cabX + 58, cabTop + 26, 36, 22, 4);
      ctx!.fillStyle = "rgba(140,190,230,0.3)"; ctx!.fill();
      ctx!.strokeStyle = "rgba(255,255,255,0.2)"; ctx!.lineWidth = 0.8; ctx!.stroke();

      // Side window glare
      ctx!.fillStyle = "rgba(255,255,255,0.1)";
      ctx!.beginPath();
      ctx!.moveTo(cabX + 60, cabTop + 27);
      ctx!.lineTo(cabX + 68, cabTop + 27);
      ctx!.lineTo(cabX + 66, cabTop + 38);
      ctx!.lineTo(cabX + 60, cabTop + 38);
      ctx!.closePath(); ctx!.fill();

      // ── Cab rear panel / sleeper ───────────────────────────────────────────
      ctx!.strokeStyle = "rgba(0,0,0,0.25)"; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.moveTo(cabX + 98, cabTop + 2); ctx!.lineTo(cabX + 98, tY); ctx!.stroke();

      // ── Air intake grilles ─────────────────────────────────────────────────
      ctx!.fillStyle = "rgba(0,0,0,0.2)";
      for (let gi = 0; gi < 4; gi++) {
        ctx!.beginPath(); ctx!.roundRect(cabX + 100 + gi * 6, cabTop + 30, 4, 22, 1); ctx!.fill();
      }

      // ── Front grille ──────────────────────────────────────────────────────
      const grX = cabX + cabW - 20;
      // Grille box
      rr(grX, tY - 44, 18, 30, 2);
      ctx!.fillStyle = "#001d60"; ctx!.fill();
      ctx!.strokeStyle = "#001040"; ctx!.lineWidth = 1; ctx!.stroke();

      // Grille bars
      ctx!.strokeStyle = "#2040a0"; ctx!.lineWidth = 1.2;
      for (let gi = 0; gi < 5; gi++) {
        ctx!.beginPath();
        ctx!.moveTo(grX + 2, tY - 42 + gi * 6);
        ctx!.lineTo(grX + 16, tY - 42 + gi * 6);
        ctx!.stroke();
      }

      // Bayanat logo area (brand badge)
      rr(cabX + cabW - 15, cabTop + 5, 10, 6, 1);
      ctx!.fillStyle = "#f0c040"; ctx!.fill();

      // ── Headlights ────────────────────────────────────────────────────────
      // Main headlight housing
      rr(cabX + cabW - 4, tY - 46, 5, 10, 1);
      ctx!.fillStyle = "#e8f0ff"; ctx!.fill();
      ctx!.strokeStyle = "#a0b0d0"; ctx!.lineWidth = 0.8; ctx!.stroke();
      // Headlight inner bulb
      ctx!.fillStyle = "rgba(220,240,255,0.9)";
      ctx!.beginPath(); ctx!.ellipse(cabX + cabW - 1, tY - 41, 2.5, 4, 0, 0, Math.PI * 2); ctx!.fill();

      // DRL strip
      ctx!.strokeStyle = "#ffe080"; ctx!.lineWidth = 2; ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(cabX + cabW - 10, tY - 50);
      ctx!.lineTo(cabX + cabW - 2, tY - 50);
      ctx!.stroke();

      // Fog light
      rr(cabX + cabW - 6, tY - 18, 7, 5, 1);
      ctx!.fillStyle = "#fff0a0"; ctx!.fill();

      // Turn signal
      rr(cabX + cabW - 4, tY - 30, 5, 7, 1);
      ctx!.fillStyle = "#ffb020"; ctx!.fill();

      // ── Front bumper ──────────────────────────────────────────────────────
      rr(cabX + cabW - 6, tY - 12, 8, 12, 2);
      ctx!.fillStyle = "#1a2e50"; ctx!.fill();
      ctx!.strokeStyle = "#0f1e38"; ctx!.lineWidth = 1; ctx!.stroke();

      // Bumper chrome strip
      ctx!.strokeStyle = "rgba(255,255,255,0.2)"; ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(cabX + cabW - 6, tY - 8);
      ctx!.lineTo(cabX + cabW + 2, tY - 8);
      ctx!.stroke();

      // ── Exhaust stacks ────────────────────────────────────────────────────
      ctx!.fillStyle = "#7080a0";
      rr(cabX + 22, cabTop - 10, 7, 18, 2); ctx!.fill();
      ctx!.strokeStyle = "#5060808"; ctx!.lineWidth = 0.8; ctx!.stroke();

      // Stack cap
      ctx!.fillStyle = "#909bb8";
      ctx!.beginPath(); ctx!.ellipse(cabX + 25, cabTop - 10, 4.5, 2, 0, 0, Math.PI * 2); ctx!.fill();

      // Smoke puffs (animated via bob)
      const sp = Math.abs(Math.sin(bobT * 1.8));
      ctx!.fillStyle = `rgba(180,190,200,${0.25 * sp})`;
      ctx!.beginPath(); ctx!.arc(cabX + 25, cabTop - 14 - sp * 6, 4 + sp * 3, 0, Math.PI * 2); ctx!.fill();
      ctx!.fillStyle = `rgba(190,198,208,${0.15 * sp})`;
      ctx!.beginPath(); ctx!.arc(cabX + 28, cabTop - 20 - sp * 8, 3 + sp * 2, 0, Math.PI * 2); ctx!.fill();

      // ── Fuel tank ─────────────────────────────────────────────────────────
      rr(cabX + 4, tY - 22, 12, 14, 3);
      ctx!.fillStyle = "#c0c8d8"; ctx!.fill();
      ctx!.strokeStyle = "#8090a8"; ctx!.lineWidth = 1; ctx!.stroke();
      // Tank highlight
      ctx!.strokeStyle = "rgba(255,255,255,0.3)"; ctx!.lineWidth = 0.8;
      ctx!.beginPath(); ctx!.moveTo(cabX + 6, tY - 21); ctx!.lineTo(cabX + 6, tY - 10); ctx!.stroke();

      // ── Cab wheels ────────────────────────────────────────────────────────
      dualWheel(cabX + 26, tY, wA);
      dualWheel(cabX + 62, tY, wA);
      // Rear drive axle (bigger)
      dualWheel(cabX + 120, tY, wA);
      dualWheel(cabX + 148, tY, wA);

      // ── Step plates ───────────────────────────────────────────────────────
      ctx!.fillStyle = "#3050888";
      rr(cabX + 2, tY - 8, 14, 4, 1); ctx!.fill();
      ctx!.strokeStyle = "rgba(255,255,255,0.15)"; ctx!.lineWidth = 0.6;
      // Step grip lines
      for (let si = 3; si < 13; si += 3) {
        ctx!.beginPath(); ctx!.moveTo(cabX + si, tY - 8); ctx!.lineTo(cabX + si, tY - 4); ctx!.stroke();
      }

      // ── Chassis / frame ───────────────────────────────────────────────────
      ctx!.fillStyle = "#5060788";
      rr(cabX, tY - 14, cabW - 8, 6, 1); ctx!.fill();
      ctx!.strokeStyle = "#3545609"; ctx!.lineWidth = 0.8; ctx!.stroke();

      // Frame cross members
      ctx!.fillStyle = "#4a587080";
      for (let fi = 0; fi < 5; fi++) {
        rr(cabX + 80 + fi * 14, tY - 14, 8, 6, 1); ctx!.fill();
      }
    }

    function tick() {
      bobT += 0.045;
      wA += 0.095;
      roadOff += 2.5;
      draw();
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => cancelAnimationFrame(rafId);
  }, [timedOut]);

  // Progress bar
  useEffect(() => {
    if (timedOut) return;
    const el = document.getElementById("wms-bar-fill");
    if (!el) return;
    const steps = [
      { w: "12%", d: 1200 },
      { w: "38%", d: 4000 },
      { w: "60%", d: 9000 },
      { w: "79%", d: 16000 },
      { w: "93%", d: 24000 },
    ];
    const timers = steps.map(({ w, d }) =>
      setTimeout(() => { el.style.width = w; }, d)
    );
    return () => timers.forEach(clearTimeout);
  }, [timedOut]);

  // Dots
  useEffect(() => {
    if (timedOut) return;
    let di = 0;
    const dots = document.querySelectorAll<HTMLElement>(".wms-dot");
    const iv = setInterval(() => {
      dots.forEach((d, i) => {
        d.style.opacity = i === di ? "1" : "0.2";
        d.style.transform = i === di ? "scale(1.2)" : "scale(0.8)";
      });
      di = (di + 1) % 3;
    }, 400);
    return () => clearInterval(iv);
  }, [timedOut]);

  if (timedOut) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "14px",
        background: "var(--bg)"
      }}>
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none"
          stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--danger)" }}>
          Workspace took too long to start
        </p>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
          Something went wrong. Please try refreshing.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "4px", padding: "0 20px", height: "40px",
            borderRadius: "12px", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "8px",
            fontSize: "14px", fontWeight: 700,
            background: "var(--primary)", color: "var(--primary-ink)"
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg)", gap: 0
    }}>
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        style={{ display: "block", marginBottom: "6px" }}
      />
      <p style={{ margin: "0 0 10px", fontSize: "18px", color: "var(--muted)", fontFamily: "var(--app-font-family)" }}>
        Starting secure workspace
      </p>
      <div style={{
        width: "240px", height: "4px", borderRadius: "999px",
        background: "var(--panel-soft)", overflow: "hidden", marginBottom: "12px"
      }}>
        <div
          id="wms-bar-fill"
          style={{
            height: "100%", borderRadius: "999px",
            background: "var(--primary)", width: "0%", transition: "width .6s ease"
          }}
        />
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="wms-dot" style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: "var(--muted)", transition: "opacity .2s, transform .2s"
          }} />
        ))}
      </div>
    </div>
  );
}