import { useState, useCallback } from "react";

export function useAnimatedClose(onClose: () => void, duration = 220) {
  const [closing, setClosing] = useState(false);
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, duration);
  }, [onClose, duration]);
  return { closing, handleClose };
}
