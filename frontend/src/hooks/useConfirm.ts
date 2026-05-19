import { useState, useCallback, createElement } from "react";
import ConfirmDialog from "../components/ui/ConfirmDialog";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, options, resolve });
    });
  }, []);

  const handleResult = useCallback((result: boolean) => {
    setState((s) => { s?.resolve(result); return null; });
  }, []);

  const dialog = state
    ? createElement(ConfirmDialog, {
        message: state.message,
        title: state.options.title,
        confirmLabel: state.options.confirmLabel,
        danger: state.options.danger ?? true,
        onConfirm: () => handleResult(true),
        onCancel: () => handleResult(false),
      })
    : null;

  return { dialog, confirm };
}
