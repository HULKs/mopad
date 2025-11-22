import { useState, useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";

type Option = {
  value: number;
  label: string;
};

type Props = {
  value: number | null;
  options: Option[];
  onSave: (val: number | null) => void;
  canEdit: boolean;
  className?: string;
  placeholder?: string;
};

export function EditableSelect({
  value,
  options,
  onSave,
  canEdit,
  className,
  placeholder = "Unknown",
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null);

  const selectRef = useRef<HTMLSelectElement>(null);
  const isCanceling = useRef(false);

  useEffect(() => {
    setTempValue(value);
    setOptimisticValue(null);
  }, [value]);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (isCanceling.current) {
      isCanceling.current = false;
      return;
    }

    if (tempValue !== value) {
      setOptimisticValue(tempValue);
      onSave(tempValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      isCanceling.current = true;
      setTempValue(value);
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    if (canEdit) {
      isCanceling.current = false;
      setTempValue(optimisticValue !== null ? optimisticValue : value);
      setIsEditing(true);
    }
  };

  if (isEditing && canEdit) {
    return (
      <select
        ref={selectRef}
        class={className}
        value={tempValue === null ? "" : tempValue}
        onInput={(e) => {
          const val = e.currentTarget.value;
          setTempValue(val === "" ? null : parseInt(val, 10));
        }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const displayId = optimisticValue !== null ? optimisticValue : value;
  const displayOption = options.find((o) => o.value === displayId);
  const displayLabel = displayOption ? displayOption.label : null;

  return (
    <div
      className={`${className} ${canEdit ? "editable" : ""} ${
        !displayLabel ? "empty" : ""
      }`}
      onClick={startEditing}
    >
      {displayLabel ? (
        <>at {displayLabel}</>
      ) : (
        <span class="italic">{placeholder}</span>
      )}
    </div>
  );
}
