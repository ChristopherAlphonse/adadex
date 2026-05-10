const PIXELS_PER_LINE = 36;
const PIXELS_PER_DOM_LINE = 16;
const PIXELS_PER_DOM_PAGE = 160;
export const wheelDeltaToScrollLines = (deltaY, deltaMode) => {
    if (!Number.isFinite(deltaY) || deltaY === 0) {
        return 0;
    }
    const absoluteDelta = Math.abs(deltaY);
    let pixelDelta = absoluteDelta;
    if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
        pixelDelta = absoluteDelta * PIXELS_PER_DOM_LINE;
    }
    else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        pixelDelta = absoluteDelta * PIXELS_PER_DOM_PAGE;
    }
    const lines = Math.max(1, Math.round(pixelDelta / PIXELS_PER_LINE));
    return deltaY > 0 ? lines : -lines;
};
export const shouldUseManualWheelScroll = (activeBuffer) => {
    if (!activeBuffer) {
        return false;
    }
    if (activeBuffer.type === "alternate") {
        return false;
    }
    return (activeBuffer.baseY ?? 0) > 0;
};
export const readViewportY = (activeBuffer) => {
    if (!activeBuffer ||
        typeof activeBuffer.viewportY !== "number" ||
        !Number.isFinite(activeBuffer.viewportY)) {
        return null;
    }
    return activeBuffer.viewportY;
};
