import { useState, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";

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

  useEffect(() => setTempValue(value), [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (tempValue !== value) onSave(tempValue);
  };

  if (isEditing && canEdit) {
    const commonProps = {
      class: className,
      value: tempValue,
      onInput: (e: any) => setTempValue(e.currentTarget.value),
      onBlur: handleSave,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Enter" && type !== "textarea") handleSave();
        if (e.key === "Escape") {
          setTempValue(value);
          setIsEditing(false);
        }
      },
      autoFocus: true,
    };

    return type === "textarea" ? (
      <textarea rows={4} {...commonProps} />
    ) : (
      <input type={type} {...commonProps} />
    );
  }

  return (
    <div
      className={`${className} ${canEdit ? "editable" : ""} ${!value && !children ? "empty" : ""}`}
      onClick={() => canEdit && setIsEditing(true)}
    >
      {children
        ? children
        : value || <span class="italic">{placeholder || "Empty"}</span>}
    </div>
  );
}
