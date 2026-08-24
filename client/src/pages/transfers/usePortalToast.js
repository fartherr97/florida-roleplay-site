import { useContext } from "react";
import ToastContext from "./portalToastContext";

/** `toast(message, 'success' | 'error' | 'info' | 'warning')`. */
export function useToast() {
  return useContext(ToastContext);
}

export default useToast;
