import {useCallback, useRef, useState} from 'react';
import type {GestureResponderEvent} from 'react-native';

/** Minimum subtitle font size (px). */
export const TRANSCRIPT_FONT_SIZE_MIN = 14;
/** Maximum subtitle font size (px). */
export const TRANSCRIPT_FONT_SIZE_MAX = 48;
/** Default subtitle font size (px). */
export const TRANSCRIPT_FONT_SIZE_DEFAULT = 22;

const LINE_HEIGHT_RATIO = 30 / 22;

function touchDistance(
  a: {pageX: number; pageY: number},
  b: {pageX: number; pageY: number},
): number {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function clampFontSize(size: number): number {
  return Math.min(
    TRANSCRIPT_FONT_SIZE_MAX,
    Math.max(TRANSCRIPT_FONT_SIZE_MIN, size),
  );
}

export type PinchFontSizeResult = {
  fontSize: number;
  lineHeight: number;
  isPinching: boolean;
  onTouchStart: (event: GestureResponderEvent) => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchEnd: (event: GestureResponderEvent) => void;
  onTouchCancel: (event: GestureResponderEvent) => void;
};

export function usePinchFontSize(
  initialSize: number = TRANSCRIPT_FONT_SIZE_DEFAULT,
): PinchFontSizeResult {
  const [fontSize, setFontSize] = useState(() => clampFontSize(initialSize));
  const [isPinching, setIsPinching] = useState(false);
  const pinchRef = useRef<{
    startDistance: number;
    startFontSize: number;
  } | null>(null);

  const endPinch = useCallback(() => {
    pinchRef.current = null;
    setIsPinching(false);
  }, []);

  const onTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const touches = event.nativeEvent.touches;
      if (touches.length < 2) {
        return;
      }

      const distance = touchDistance(touches[0], touches[1]);
      if (distance < 8) {
        return;
      }

      pinchRef.current = {
        startDistance: distance,
        startFontSize: fontSize,
      };
      setIsPinching(true);
    },
    [fontSize],
  );

  const onTouchMove = useCallback((event: GestureResponderEvent) => {
    const pinch = pinchRef.current;
    const touches = event.nativeEvent.touches;
    if (!pinch || touches.length < 2) {
      return;
    }

    const distance = touchDistance(touches[0], touches[1]);
    if (distance < 8 || pinch.startDistance < 8) {
      return;
    }

    const scale = distance / pinch.startDistance;
    setFontSize(clampFontSize(pinch.startFontSize * scale));
  }, []);

  const onTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (event.nativeEvent.touches.length < 2) {
        endPinch();
      }
    },
    [endPinch],
  );

  return {
    fontSize,
    lineHeight: fontSize * LINE_HEIGHT_RATIO,
    isPinching,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: endPinch,
  };
}
