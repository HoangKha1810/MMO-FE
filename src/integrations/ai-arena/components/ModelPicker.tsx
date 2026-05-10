import type { CSSProperties } from "react";
import { Gauge } from "lucide-react";
import { ArenaMode, ArenaPreferences, ModelInfo } from "../lib/types";
import { groupModelsByProvider } from "../lib/utils";

interface ModelPickerProps {
  mode: ArenaMode;
  models: ModelInfo[];
  preferences: ArenaPreferences;
  onModelChange: (
    key: "directModelId" | "leftModelId" | "rightModelId",
    value: string
  ) => void;
  onBattleToggle: (modelId: string) => void;
}

export function ModelPicker({
  mode,
  models,
  preferences,
  onModelChange,
  onBattleToggle
}: ModelPickerProps) {
  const availableModels = models.filter((model) => model.available);
  const groupedModels = groupModelsByProvider(availableModels);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="section-label">Chọn mô hình</p>
          <h2>Bộ điều khiển phiên chat</h2>
        </div>
        <div className="panel__badge">
          <Gauge size={14} />
          {availableModels.length} mô hình đang hoạt động
        </div>
      </div>

      {mode === "direct" && (
        <label className="field">
          <span>Mô hình trò chuyện trực tiếp</span>
          <select
            value={preferences.directModelId}
            onChange={(event) => onModelChange("directModelId", event.target.value)}
          >
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <optgroup key={provider} label={provider}>
                {providerModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}

      {mode === "side-by-side" && (
        <div className="double-field">
          <label className="field">
            <span>Mô hình bên trái</span>
            <select
              value={preferences.leftModelId}
              onChange={(event) => onModelChange("leftModelId", event.target.value)}
            >
              {Object.entries(groupedModels).map(([provider, providerModels]) => (
                <optgroup key={provider} label={provider}>
                  {providerModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Mô hình bên phải</span>
            <select
              value={preferences.rightModelId}
              onChange={(event) => onModelChange("rightModelId", event.target.value)}
            >
              {Object.entries(groupedModels).map(([provider, providerModels]) => (
                <optgroup key={provider} label={provider}>
                  {providerModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      )}

      {mode === "battle" && (
        <div className="battle-pool">
          <div className="field-heading">
            <span>Nhóm mô hình để đấu</span>
            <small>
              Chọn từ 2 mô hình trở lên. Nếu để ít hơn 2, hệ thống sẽ lấy từ toàn bộ
              mô hình đang online.
            </small>
          </div>
          <div className="chip-grid">
            {availableModels.map((model) => {
              const active = preferences.battlePoolIds.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`model-chip ${active ? "active" : ""}`}
                  onClick={() => onBattleToggle(model.id)}
                  style={{ "--chip-accent": model.accent } as CSSProperties}
                >
                  <strong>{model.label}</strong>
                  <span>{model.providerLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

