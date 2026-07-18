import React from "react";
import { HeroSection } from "./components/HeroSection";
import { FeaturesGrid } from "./components/FeaturesGrid";
import { FAQAccordion } from "./components/FAQAccordion";
import { CTASection } from "./components/CTASection";

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col space-y-0 min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <HeroSection />
      <FeaturesGrid />
      <FAQAccordion />
      <CTASection />
    </div>
  );
};
