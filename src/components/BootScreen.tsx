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

    const W = 320, H = 100;
    const ROAD_Y = 72;
    const WR = 11;
    let wA = 0, bobT = 0, roadOff = 0;
    let rafId: number;

    function wheel(x: number, y: number, a: number) {
      ctx!.save(); ctx!.translate(x, y);
      ctx!.beginPath(); ctx!.arc(0, 0, WR, 0, Math.PI * 2);
      ctx!.fillStyle = "#1e293b"; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(0, 0, WR - 3, 0, Math.PI * 2);
      ctx!.fillStyle = "#2d3f55"; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(0, 0, 4, 0, Math.PI * 2);
      ctx!.fillStyle = "#64748b"; ctx!.fill();
      ctx!.strokeStyle = "#64748b"; ctx!.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const r = a + i * (Math.PI / 2);
        ctx!.beginPath();
        ctx!.moveTo(Math.cos(r) * 4.5, Math.sin(r) * 4.5);
        ctx!.lineTo(Math.cos(r) * (WR - 2), Math.sin(r) * (WR - 2));
        ctx!.stroke();
      }
      ctx!.restore();
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      // Road
      ctx!.fillStyle = "#e5e7eb";
      ctx!.fillRect(0, ROAD_Y, W, H - ROAD_Y);
      ctx!.strokeStyle = "#c8d0dc"; ctx!.lineWidth = 1.5;
      ctx!.beginPath(); ctx!.moveTo(0, ROAD_Y); ctx!.lineTo(W, ROAD_Y); ctx!.stroke();

      // Road dashes
      const dw = 22, gap = 22, tot = dw + gap;
      const off2 = roadOff % tot;
      ctx!.fillStyle = "#9ca3af";
      for (let x = -tot + off2; x < W + tot; x += tot) {
        ctx!.beginPath(); ctx!.roundRect(x, ROAD_Y + 10, dw, 4, 2); ctx!.fill();
      }

      const bob = Math.sin(bobT) * 2.5;
      const gY = ROAD_Y - WR;
      const tY = gY + bob;
      const TX = 20;

      // Wheels
      wheel(TX + 22, tY, wA);
      wheel(TX + 38, tY, wA);
      wheel(TX + 196, tY, wA);

      // Trailer body
      ctx!.fillStyle = "#f1f5f9";
      ctx!.strokeStyle = "#cbd5e1"; ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.roundRect(TX, tY - 40, 155, 40, [0, 0, 3, 3]);
      ctx!.fill(); ctx!.stroke();

      // Trailer divider line
      ctx!.strokeStyle = "#dde3ec"; ctx!.lineWidth = 0.8; ctx!.setLineDash([4, 3]);
      ctx!.beginPath(); ctx!.moveTo(TX + 77, tY - 40); ctx!.lineTo(TX + 77, tY); ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.strokeStyle = "#dde3ec"; ctx!.lineWidth = 0.75;
      ctx!.beginPath(); ctx!.moveTo(TX, tY - 20); ctx!.lineTo(TX + 155, tY - 20); ctx!.stroke();

      // Trailer door handles
      ctx!.fillStyle = "#94a3b8";
      ctx!.beginPath(); ctx!.roundRect(TX + 1, tY - 33, 3, 8, 1.5); ctx!.fill();
      ctx!.beginPath(); ctx!.roundRect(TX + 151, tY - 33, 3, 8, 1.5); ctx!.fill();

      // Cab shape
      const cabX = TX + 157;
      const cabW = 105;
      const cabH = 52;
      const cabTop = tY - cabH;

      ctx!.beginPath();
      ctx!.moveTo(cabX, tY);
      ctx!.lineTo(cabX, cabTop + 14);
      ctx!.quadraticCurveTo(cabX, cabTop + 6, cabX + 10, cabTop + 2);
      ctx!.lineTo(cabX + 55, cabTop);
      ctx!.lineTo(cabX + cabW - 4, cabTop + 4);
      ctx!.quadraticCurveTo(cabX + cabW, cabTop + 4, cabX + cabW, cabTop + 10);
      ctx!.lineTo(cabX + cabW, tY);
      ctx!.closePath();
      ctx!.fillStyle = "#003285"; ctx!.fill();
      ctx!.strokeStyle = "#001e52"; ctx!.lineWidth = 1.2; ctx!.stroke();

      // Cab roof dark strip
      ctx!.beginPath();
      ctx!.moveTo(cabX + 2, tY - cabH + 16);
      ctx!.lineTo(cabX + 2, tY - cabH + 14);
      ctx!.quadraticCurveTo(cabX + 2, tY - cabH + 6, cabX + 12, tY - cabH + 3);
      ctx!.lineTo(cabX + 55, tY - cabH + 1);
      ctx!.lineTo(cabX + 70, tY - cabH + 1);
      ctx!.lineTo(cabX + 70, tY - cabH + 16);
      ctx!.closePath();
      ctx!.fillStyle = "#002570"; ctx!.fill();

      // Windshield
      ctx!.beginPath();
      ctx!.moveTo(cabX + 12, tY - cabH + 18);
      ctx!.lineTo(cabX + 18, tY - cabH + 3);
      ctx!.lineTo(cabX + 62, tY - cabH + 1);
      ctx!.lineTo(cabX + 66, tY - cabH + 18);
      ctx!.closePath();
      ctx!.fillStyle = "#bfdbfe";
      ctx!.strokeStyle = "#93c5fd"; ctx!.lineWidth = 1;
      ctx!.fill(); ctx!.stroke();

      // Windshield glare
      ctx!.fillStyle = "rgba(255,255,255,0.18)";
      ctx!.beginPath();
      ctx!.moveTo(cabX + 14, tY - cabH + 17);
      ctx!.lineTo(cabX + 19, tY - cabH + 3);
      ctx!.lineTo(cabX + 27, tY - cabH + 3);
      ctx!.lineTo(cabX + 22, tY - cabH + 17);
      ctx!.closePath(); ctx!.fill();

      // Cab door outline
      ctx!.strokeStyle = "rgba(255,255,255,0.25)"; ctx!.lineWidth = 0.7;
      ctx!.beginPath(); ctx!.roundRect(cabX + 3, tY - 28, 36, 14, 2); ctx!.stroke();

      // Door handle
      ctx!.strokeStyle = "rgba(255,255,255,0.5)"; ctx!.lineWidth = 1.3; ctx!.lineCap = "round";
      ctx!.beginPath(); ctx!.moveTo(cabX + 12, tY - 21); ctx!.lineTo(cabX + 22, tY - 21); ctx!.stroke();

      // Side window
      ctx!.fillStyle = "rgba(255,255,255,0.12)";
      ctx!.beginPath(); ctx!.roundRect(cabX + 72, tY - 38, 28, 22, 3); ctx!.fill();

      // Headlights
      ctx!.fillStyle = "#fbbf24";
      ctx!.beginPath(); ctx!.roundRect(cabX + cabW - 6, tY - 34, 7, 7, [0, 2, 2, 0]); ctx!.fill();
      ctx!.fillStyle = "#f97316"; ctx!.globalAlpha = 0.7;
      ctx!.beginPath(); ctx!.roundRect(cabX + cabW - 6, tY - 22, 7, 6, [0, 2, 2, 0]); ctx!.fill();
      ctx!.globalAlpha = 1;

      // Bumper
      ctx!.fillStyle = "#1e3a5f";
      ctx!.beginPath(); ctx!.roundRect(cabX + cabW - 3, tY - 10, 5, 10, [0, 2, 2, 0]); ctx!.fill();

      // Coupler
      ctx!.fillStyle = "#475569";
      ctx!.beginPath(); ctx!.roundRect(TX + 153, tY - 27, 8, 7, 2); ctx!.fill();

      // Exhaust pipe
      ctx!.fillStyle = "#64748b";
      ctx!.beginPath(); ctx!.roundRect(cabX + 18, tY - cabH - 2, 5, 10, 2); ctx!.fill();

      // Exhaust stack light
      ctx!.fillStyle = "rgba(200,210,220,0.7)";
      ctx!.beginPath(); ctx!.arc(cabX + 22, tY - cabH - 4, 3, 0, Math.PI * 2); ctx!.fill();
    }

    function tick() {
      bobT += 0.055;
      wA += 0.11;
      roadOff += 2;
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
        width={320}
        height={100}
        style={{ display: "block", marginBottom: "6px" }}
      />
      {/* <p style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: 700, color: "var(--text)", fontFamily: "var(--app-font-family)" }}>
        Bayanat WMS
      </p> */}
      <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--muted)", fontFamily: "var(--app-font-family)" }}>
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