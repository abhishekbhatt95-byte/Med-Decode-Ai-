import React, { useRef, useEffect } from "react";
import { useAccessibility } from "../context/AccessibilityContext";
import { Type, Eye, Moon } from "lucide-react";

interface AccessibilityPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilityPopover: React.FC<AccessibilityPopoverProps> = ({
  isOpen,
  onClose,
}) => {
  const { largeText, highContrast, darkMode, setLargeText, setHighContrast, setDarkMode } = useAccessibility();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-14 left-4 md:left-6 z-50 w-80 p-6 bg-card border border-border rounded-2xl shadow-xl animate-fade-in text-left text-foreground"
      role="dialog"
      aria-label="Reading Preferences"
    >
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-bold font-serif leading-tight">
            Reading Preferences
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Adjust the display to make it easier for you to read.
          </p>
        </div>

        <hr className="border-border" />

        {/* Text Size */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2.5">
            <Type className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold">Text Size</span>
          </div>
          <select
            value={largeText ? "large" : "normal"}
            onChange={(e) => setLargeText(e.target.value === "large")}
            className="text-xs bg-background border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium text-foreground"
          >
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold">High Contrast</span>
          </div>
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${
              highContrast ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            aria-label="Toggle High Contrast"
            aria-pressed={highContrast}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform ${
                highContrast ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Dark Mode */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2.5">
            <Moon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold">Dark Mode</span>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${
              darkMode ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            aria-label="Toggle Dark Mode"
            aria-pressed={darkMode}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform ${
                darkMode ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
