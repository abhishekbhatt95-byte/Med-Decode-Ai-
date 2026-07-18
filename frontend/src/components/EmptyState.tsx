import React from "react";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="w-full border-2 border-dashed border-border rounded-3xl p-8 md:p-12 flex flex-col items-center text-center bg-card/20 max-w-3xl mx-auto my-6 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 font-serif">
        {title}
      </h3>
      <p className="text-sm md:text-base text-muted-foreground max-w-md mb-6 font-medium leading-relaxed">
        {description}
      </p>
      <button
        onClick={onAction}
        className="bg-primary text-primary-foreground font-black px-6 py-3 rounded-full text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center gap-2"
      >
        {actionLabel}
      </button>
    </div>
  );
};
