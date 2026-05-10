import { motion } from "framer-motion";
import { Boxes, BrainCircuit, Swords } from "lucide-react";
import { ArenaMode } from "../lib/types";

interface ModeSelectorProps {
  mode: ArenaMode;
  onChange: (mode: ArenaMode) => void;
}

const modeOptions = [
  {
    mode: "battle" as const,
    title: "So sánh nhiều nguồn",
    description: "Chạy nhiều mô hình cùng lúc và xem kết quả ngay trên từng khung",
    icon: Swords
  },
  {
    mode: "side-by-side" as const,
    title: "So sánh song song",
    description: "Chọn cố định 2 mô hình để đối chiếu từng câu trả lời",
    icon: Boxes
  },
  {
    mode: "direct" as const,
    title: "Trò chuyện trực tiếp",
    description: "Giữ một mô hình duy nhất và tích lũy ngữ cảnh liên tục",
    icon: BrainCircuit
  }
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      {modeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = option.mode === mode;

        return (
          <button
            key={option.mode}
            type="button"
            className={`mode-card ${isActive ? "active" : ""}`}
            onClick={() => onChange(option.mode)}
          >
            {isActive && (
              <motion.div
                layoutId="mode-card-highlight"
                className="mode-card__highlight"
              />
            )}
            <div className="mode-card__icon">
              <Icon size={18} />
            </div>
            <div className="mode-card__content">
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
