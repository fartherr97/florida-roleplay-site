import { createContext } from "react";

/** The toast dispatcher. Split from its provider so fast refresh survives. */
const ToastContext = createContext(null);

export default ToastContext;
