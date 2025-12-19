import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const PCBViewer = forwardRef(function PCBViewer({ data }, ref) {
  const canvasRef = useRef(null);
  const zoomRef = useRef(1);
  const [renderTick, setRenderTick] = useState(0);

  useImperativeHandle(ref, () => ({
    zoomIn() {
      zoomRef.current = Math.min(8, zoomRef.current * 1.2);
      setRenderTick(t => t + 1);
    },
    zoomOut() {
      zoomRef.current = Math.max(0.2, zoomRef.current / 1.2);
      setRenderTick(t => t + 1);
    },
    resetZoom() {
      zoomRef.current = 1;
      setRenderTick(t => t + 1);
    },
    getZoom() {
      return zoomRef.current;
    }
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    
    const ctx = canvas.getContext('2d');
    const { boundary, pads, routes } = data;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const updateBounds = (x, y) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };

    boundary.forEach(p => updateBounds(p[0], p[1]));
    pads.forEach(p => updateBounds(p.x, p.y));
    const padding = 5;
    minX -= padding; maxX += padding; minY -= padding; maxY += padding;

    const fitScale = Math.min(canvas.clientWidth / (maxX - minX), canvas.clientHeight / (maxY - minY));
    const scale = fitScale * zoomRef.current;
    const toPx = (mm) => Math.floor(mm * scale);
    const toX = (mm) => Math.floor((mm - minX) * scale);
    const toY = (mm) => Math.floor((mm - minY) * scale);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Boundary
    if (boundary.length > 0) {
      ctx.beginPath();
      ctx.moveTo(toX(boundary[0][0]), toY(boundary[0][1]));
      for (let i = 1; i < boundary.length; i++) ctx.lineTo(toX(boundary[i][0]), toY(boundary[i][1]));
      ctx.closePath();
      ctx.fillStyle = "#1e293b"; ctx.fill();
      ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.stroke();
    }

    // Routes
    const drawTrace = (layerName, color) => {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      routes.forEach(route => {
        if (route.failed) return;
        ctx.beginPath(); ctx.strokeStyle = color;
        route.segments.forEach(seg => {
            const isTop = seg.layer === "F.Cu";
            if ((layerName === "Top") === isTop) {
                ctx.lineWidth = Math.max(1, toPx(seg.width));
                ctx.moveTo(toX(seg.start[0]), toY(seg.start[1]));
                ctx.lineTo(toX(seg.end[0]), toY(seg.end[1]));
            }
        });
        ctx.stroke();
      });
    };

    drawTrace("Bottom", "#3b82f6"); // Blue
    drawTrace("Top",    "#ef4444"); // Red

    // Vias
    ctx.fillStyle = "#ffffff";
    routes.forEach(r => !r.failed && r.vias.forEach(v => {
        ctx.beginPath(); ctx.arc(toX(v.at[0]), toY(v.at[1]), toPx(v.size/2), 0, 2*Math.PI); ctx.fill();
    }));

    // Pads
    ctx.fillStyle = "#fbbf24";
    pads.forEach(pad => {
      ctx.beginPath();
      ctx.arc(toX(pad.x), toY(pad.y), toPx(Math.max(pad.size_x, pad.size_y)/2), 0, 2*Math.PI);
      ctx.fill();
    });

  }, [data, renderTick]);

  useEffect(() => {
    const onResize = () => setRenderTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full rounded-lg bg-slate-900 shadow-inner" />;
});

export default PCBViewer;