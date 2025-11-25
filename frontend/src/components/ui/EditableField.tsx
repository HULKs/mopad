import { useState, useEffect, useRef } from "preact/hooks";
import type {
  ComponentChildren,
  RefObject,
  TargetedEvent,
  TargetedKeyboardEvent,
} from "preact";

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

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isCanceling = useRef(false);

  useEffect(() => {
    setTempValue(value);
    setOptimisticValue(null);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (
        type !== "datetime-local" &&
        inputRef.current instanceof HTMLInputElement
      ) {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleSave = () => {
    if (isCanceling.current) {
      isCanceling.current = false;
      return;
    }

    if (tempValue !== value) {
      setOptimisticValue(tempValue);
      onSave(tempValue);
      setIsEditing(false);
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (
    e: TargetedKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter" && type !== "textarea") {
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
    const commonProps = {
      class: className,
      value: tempValue,
      onInput: (e: TargetedEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setTempValue(e.currentTarget.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
    };

    return type === "textarea" ? (
      <textarea
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        rows={4}
        {...commonProps}
      />
    ) : (
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type={type}
        {...commonProps}
      />
    );
  }

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
