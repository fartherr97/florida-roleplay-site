import { useLocation, useNavigationType, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Direction-aware route transition. Forward navigation (PUSH) slides in from the
 * right, back navigation (POP) from the left. Only the outlet moves — the header
 * and footer stay fixed in place.
 */
export default function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigationType = useNavigationType();
  const back = navigationType === "POP";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: back ? -24 : 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: back ? 24 : -24 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
