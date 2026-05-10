import { motion } from "framer-motion";

export function BackgroundDecor() {
  return (
    <div className="background-decor" aria-hidden="true">
      <div className="background-grid" />
      <motion.div
        className="orb orb-blue"
        animate={{ x: [0, 24, -12, 0], y: [0, -18, 14, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="orb orb-cyan"
        animate={{ x: [0, -22, 14, 0], y: [0, 16, -12, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="orb orb-green"
        animate={{ x: [0, -8, 20, 0], y: [0, -14, 10, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
