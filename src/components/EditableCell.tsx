import React, { useState, useEffect, useRef } from 'react';

interface EditableCellProps {
  value: string | number;
  onSave: (newValue: string) => void;
  type?: 'text' | 'number';
  className?: string;
  isPercentage?: boolean;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onSave,
  type = 'text',
  className = '',
  isPercentage = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value).replace('%', ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== String(value).replace('%', '')) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      onSave(editValue);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(String(value).replace('%', ''));
    }
  };

  const displayValue = isPercentage ? `${value}%` : value;

  return isEditing ? (
    <input
      ref={inputRef}
      type={type}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`w-full px-2 py-1 border border-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      autoComplete="off"
    />
  ) : (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-indigo-50 px-6 py-4 transition-colors ${className}`}
    >
      {displayValue}
    </div>
  );
};
