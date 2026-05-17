interface DepthControlProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}

export function DepthControl({ value, onChange, compact = false }: DepthControlProps) {
  return (
    <div className={compact ? "depth-control compact" : "depth-control"}>
      <input
        type="range"
        min="0.5"
        max="20"
        step="0.1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <label>
        <input
          type="number"
          min="0.1"
          max="40"
          step="0.1"
          value={Number(value.toFixed(1))}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>mm</span>
      </label>
    </div>
  );
}
