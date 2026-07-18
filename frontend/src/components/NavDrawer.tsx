import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Home, UploadCloud, Activity, User, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AccessibilityPopover } from "./AccessibilityPopover";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

interface NavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isAccessPopoverOpen, setIsAccessPopoverOpen] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 left-0 w-80 bg-card border-r border-border shadow-2xl z-50 flex flex-col p-6 overflow-y-auto text-left"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black font-serif text-base shadow-sm">
                  M
                </span>
                <span className="font-serif font-black text-lg text-foreground tracking-tight">
                  MedDecode
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-full cursor-pointer text-muted-foreground hover:text-foreground transition-all"
                aria-label="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-2">
              <Link
                to="/dashboard"
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-xl font-bold text-sm text-foreground hover:bg-muted active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 font-black" }}
              >
                <Home className="w-5 h-5" />
                <span>{t('nav.dashboard')}</span>
              </Link>
              <Link
                to="/upload"
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-xl font-bold text-sm text-foreground hover:bg-muted active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 font-black" }}
              >
                <UploadCloud className="w-5 h-5" />
                <span>{t('nav.newAnalysis')}</span>
              </Link>
              <Link
                to="/trends"
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-xl font-bold text-sm text-foreground hover:bg-muted active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 font-black" }}
              >
                <Activity className="w-5 h-5" />
                <span>{t('nav.healthTrends')}</span>
              </Link>
              <Link
                to="/profile"
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-xl font-bold text-sm text-foreground hover:bg-muted active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 font-black" }}
              >
                <User className="w-5 h-5" />
                <span>{t('nav.settings')}</span>
              </Link>

              <hr className="border-border my-4" />

              {!user ? (
                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    to="/auth"
                    onClick={onClose}
                    className="flex justify-center items-center bg-secondary text-foreground hover:bg-muted p-3 rounded-xl font-extrabold text-sm transition-all"
                  >
                    {t('nav.signIn')}
                  </Link>
                  <Link
                    to="/auth"
                    onClick={onClose}
                    className="flex justify-center items-center bg-primary text-primary-foreground hover:opacity-95 p-3 rounded-xl font-extrabold text-sm transition-all shadow-sm"
                  >
                    {t('nav.getStarted')}
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 cursor-default">
                  Signed in as <span className="font-semibold text-foreground text-ellipsis overflow-hidden block">{user.email}</span>
                </div>
              )}
            </nav>

            {/* Accessibility Preferences at bottom */}
            <div className="relative mt-auto pt-6 border-t border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground">{t('settings.displaySettings')}</span>
                <p className="text-[10px] text-muted-foreground">{t('settings.accessibilitySub')}</p>
              </div>
              <button
                onClick={() => setIsAccessPopoverOpen(!isAccessPopoverOpen)}
                className="w-9 h-9 rounded-full bg-secondary hover:bg-muted border border-border flex items-center justify-center text-foreground cursor-pointer transition-all shadow-sm"
                aria-label="Open Reading Preferences"
              >
                <Settings className="w-4 h-4" />
              </button>

              <AccessibilityPopover
                isOpen={isAccessPopoverOpen}
                onClose={() => setIsAccessPopoverOpen(false)}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
