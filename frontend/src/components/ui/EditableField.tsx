import { useState, useEffect, useRef } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";

type Props = {
  value: string;
  canEdit: boolean;
  onSave: (val: string) => void;
  type?: "text" | "textarea" | "number" | "datetime-local";
  className?: string;
  placeholder?: string;
  children?: ComponentChildren;
};

export function EditableField({
  value,
  canEdit,
  onSave,
  type = "text",
  className,
  placeholder,
  children,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  // Optimistic state to hold the value immediately after save
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);

  // References for DOM access and state tracking without re-renders
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isCanceling = useRef(false);

  // Sync internal state if prop changes externally (e.g. WebSocket update)
  useEffect(() => {
    setTempValue(value);
    // When the server value updates, we can clear our optimistic override
    // because the UI is now consistent with the server (or the server rejected it).
    setOptimisticValue(null);
  }, [value]);

  // Robust Focus Management
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Automatically select text for easy replacement (except for dates)
      if (
        type !== "datetime-local" &&
        inputRef.current instanceof HTMLInputElement
      ) {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleSave = () => {
    // If we are in the middle of cancelling (Escape), do not save.
    if (isCanceling.current) {
      isCanceling.current = false;
      return;
    }

    if (tempValue !== value) {
      // Optimistic Update: Show new value immediately
      setOptimisticValue(tempValue);
      onSave(tempValue);
      setIsEditing(false);
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (
    e: JSX.TargetedKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter" && type !== "textarea") {
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      isCanceling.current = true;
      setTempValue(value); // Revert input value
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    if (canEdit) {
      isCanceling.current = false;
      // Start editing with the visible value (optimistic or server),
      // so we don't revert to old text if the server is slow.
      setTempValue(optimisticValue !== null ? optimisticValue : value);
      setIsEditing(true);
    }
  };

  if (isEditing && canEdit) {
    const commonProps = {
      ref: inputRef,
      class: className,
      value: tempValue,
      onInput: (e: any) => setTempValue(e.currentTarget.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
    };

    return type === "textarea" ? (
      <textarea rows={4} {...commonProps} />
    ) : (
      <input type={type} {...commonProps} />
    );
  }

  // Determine display value: Optimistic -> Server Value -> Placeholder
  const displayValue = optimisticValue !== null ? optimisticValue : value;

  return (
    <div
      className={`${className} ${canEdit ? "editable" : ""} ${
        !value && !children ? "empty" : ""
      }`}
      onClick={startEditing}
    >
      {children
        ? children
        : displayValue || <span class="italic">{placeholder || "Empty"}</span>}
    </div>
  );
}
