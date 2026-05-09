import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD_H, WORLD_W } from "./useForceSimulation";

type CanvasTransform = {
  translateX: number;
  translateY: number;
  scale: number;
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 3.0;
const ZOOM_FACTOR = 0.1;

type UseCanvasTransformResult = {
  transform: CanvasTransform;
  isPanning: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  handleWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
  handlePointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  screenToGraph: (screenX: number, screenY: number) => { x: number; y: number };
  graphToScreen: (graphX: number, graphY: number) => { x: number; y: number };
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: (nodes: { x: number; y: number }[]) => void;
};

export const useCanvasTransform = (): UseCanvasTransformResult => {
  const [transform, setTransform] = useState<CanvasTransform>({
    translateX: 0,
    translateY: 0,
    scale: 1,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const centeredRef = useRef(false);

  // Fit the fixed world bounds into the viewport once on mount
  useEffect(() => {
    if (centeredRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    centeredRef.current = true;

    const padding = 40;
    const scaleX = (rect.width - padding * 2) / WORLD_W;
    const scaleY = (rect.height - padding * 2) / WORLD_H;
    const scale = Math.min(scaleX, scaleY);

    setTransform({
      scale,
      translateX: rect.width / 2,
      translateY: rect.height / 2,
    });
  });

  // Re-center the graph when the SVG container resizes (e.g. split panel opens)
  const prevSizeRef = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;

      const prev = prevSizeRef.current;
      if (prev && (Math.abs(prev.width - width) > 1 || Math.abs(prev.height - height) > 1)) {
        // Adjust translate so the graph center stays in the center of the new viewport
        setTransform((t) => ({
          ...t,
          translateX: t.translateX + (width - prev.width) / 2,
          translateY: t.translateY + (height - prev.height) / 2,
        }));
      }
      prevSizeRef.current = { width, height };
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const [isPanning, setIsPanning] = useState(false);
  const panState = useRef<{
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);

  const screenToGraph = useCallback(
    (screenX: number, screenY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: screenX, y: screenY };
      const rect = svg.getBoundingClientRect();
      const svgX = screenX - rect.left;
      const svgY = screenY - rect.top;
      return {
        x: (svgX - transform.translateX) / transform.scale,
        y: (svgY - transform.translateY) / transform.scale,
      };
    },
    [transform],
  );

  const graphToScreen = useCallback(
    (graphX: number, graphY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: graphX, y: graphY };
      const rect = svg.getBoundingClientRect();
      return {
        x: graphX * transform.scale + transform.translateX + rect.left,
        y: graphY * transform.scale + transform.translateY + rect.top,
      };
    },
    [transform],
  );

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    setTransform((prev) => {
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = 1 + direction * ZOOM_FACTOR;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      const scaleRatio = nextScale / prev.scale;

      return {
        scale: nextScale,
        translateX: cursorX - (cursorX - prev.translateX) * scaleRatio,
        translateY: cursorY - (cursorY - prev.translateY) * scaleRatio,
      };
    });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      if (e.target !== svgRef.current && (e.target as SVGElement).closest?.(".canvas-node")) {
        return;
      }
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTx: transform.translateX,
        startTy: transform.translateY,
      };
      setIsPanning(true);
      (e.target as SVGSVGElement).setPointerCapture?.(e.pointerId);
    },
    [transform.translateX, transform.translateY],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pan = panState.current;
    if (!pan) return;

    setTransform((prev) => ({
      ...prev,
      translateX: pan.startTx + (e.clientX - pan.startX),
      translateY: pan.startTy + (e.clientY - pan.startY),
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    panState.current = null;
    setIsPanning(false);
  }, []);

  const zoomIn = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setTransform((prev) => {
      const nextScale = Math.min(MAX_SCALE, prev.scale * (1 + ZOOM_FACTOR));
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        translateX: cx - (cx - prev.translateX) * ratio,
        translateY: cy - (cy - prev.translateY) * ratio,
      };
    });
  }, []);

  const zoomOut = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setTransform((prev) => {
      const nextScale = Math.max(MIN_SCALE, prev.scale * (1 - ZOOM_FACTOR));
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        translateX: cx - (cx - prev.translateX) * ratio,
        translateY: cy - (cy - prev.translateY) * ratio,
      };
    });
  }, []);

  const fitAll = useCallback((nodes: { x: number; y: number }[]) => {
    const svg = svgRef.current;
    if (!svg || nodes.length === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }

    const graphW = maxX - minX || 1;
    const graphH = maxY - minY || 1;
    const padding = 80;
    const scaleX = (rect.width - padding * 2) / graphW;
    const scaleY = (rect.height - padding * 2) / graphH;
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_SCALE), MAX_SCALE);
    const centerGx = (minX + maxX) / 2;
    const centerGy = (minY + maxY) / 2;

    setTransform({
      scale,
      translateX: rect.width / 2 - centerGx * scale,
      translateY: rect.height / 2 - centerGy * scale,
    });
  }, []);

  return {
    transform,
    isPanning,
    svgRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    screenToGraph,
    graphToScreen,
    zoomIn,
    zoomOut,
    fitAll,
  };
};
