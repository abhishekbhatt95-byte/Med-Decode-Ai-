import React, { useState, useEffect, useRef } from "react";
import { invokeAssistant } from "../services/assistant";
import { useAuth } from "../context/AuthContext";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { motion, AnimatePresence } from "framer-motion";


interface Message {
  sender: "user" | "bot";
  text: string;
}

export const AssistantWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am your MedDecode AI Assistant. Ask me anything about how to use the app, upload documents, view trends, share reports, or daily quotas!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showWidget, setShowWidget] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowWidget(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showWidget) {
      const isShown = localStorage.getItem("meddecode-assistant-tooltip-shown") === "true";
      if (!isShown) {
        const timer = setTimeout(() => {
          setShowTooltip(true);
          const hideTimer = setTimeout(() => {
            setShowTooltip(false);
            localStorage.setItem("meddecode-assistant-tooltip-shown", "true");
          }, 6000);
          return () => clearTimeout(hideTimer);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [showWidget]);

  const handleDismissTooltip = () => {
    setShowTooltip(false);
    localStorage.setItem("meddecode-assistant-tooltip-shown", "true");
  };


  const { isListening, transcript, startListening, stopListening, isSupported: isVoiceSupported } = useVoiceInput();
  const [showVoiceConsent, setShowVoiceConsent] = useState(() => {
    return localStorage.getItem("meddecode-voice-consent") !== "accepted";
  });

  useEffect(() => {
    if (transcript) {
      setInput((prev) => prev + (prev ? " " : "") + transcript);
    }
  }, [transcript]);

  const handleMicClick = () => {
    if (!isVoiceSupported) return;
    if (showVoiceConsent) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const acceptVoiceConsent = () => {
    localStorage.setItem("meddecode-voice-consent", "accepted");
    setShowVoiceConsent(false);
    startListening();
  };

  const handleSpeakText = (text: string) => {
    if (speakingText === text) {
      window.speechSynthesis.cancel();
      setSpeakingText(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingText(null);
    utterance.onerror = () => setSpeakingText(null);
    setSpeakingText(text);
    window.speechSynthesis.speak(utterance);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setLoading(true);

    try {
      const isResultsPage = window.location.pathname === "/results";
      const params = new URLSearchParams(window.location.search);
      const docId = params.get("docId");

      const currentPageContext =
        isResultsPage && docId ? { documentId: docId } : undefined;

      const { data, error } = await invokeAssistant({
        message: userMsg,
        conversationHistory: messages,
        currentPageContext,
      });

      if (error) throw error;

      if (data?.answer) {
        setMessages((prev) => [...prev, { sender: "bot", text: data.answer }]);
      } else {
        throw new Error("No answer returned from assistant.");
      }
    } catch (err: any) {
      console.error("Assistant chat error:", err);
      let errorText = "Sorry, I am having trouble connecting right now. Please try again later.";
      if (err?.message?.includes("limit exceeded") || err?.message?.includes("429")) {
        errorText = "You have reached your daily assistant message limit of 30 messages. Please try again tomorrow.";
      }
      setMessages((prev) => [...prev, { sender: "bot", text: errorText }]);
    } finally {
      setLoading(false);
    }
  };

  // Widget is visible to all users; chat requires auth (handled below)

  return (
    <AnimatePresence>
      {showWidget && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans print:hidden"
        >
          {isOpen && (
            <div className="w-[340px] sm:w-[380px] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-6" style={{ height: user ? '500px' : 'auto' }}>
              <div className="bg-primary text-white p-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <div>
                    <h4 className="font-extrabold text-sm leading-tight">MedDecode Assistant</h4>
                    <span className="text-[10px] text-white/70 font-bold">App Guide & Helper</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:text-white/70 font-extrabold text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {user ? (
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-1.5 ${
                      msg.sender === "user" ? "justify-end flex-row-reverse" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-primary text-white rounded-br-none"
                          : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                    {msg.sender === "bot" && (
                      <button
                        onClick={() => handleSpeakText(msg.text)}
                        className={`p-1.5 rounded-full border text-[10px] cursor-pointer transition-all shrink-0 mt-1 ${
                          speakingText === msg.text
                            ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-500 hover:bg-red-100"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                        }`}
                        title={speakingText === msg.text ? "Stop reading" : "Read aloud"}
                      >
                        {speakingText === msg.text ? "🔇" : "🔊"}
                      </button>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm">
                      <div className="flex gap-1.5 items-center justify-center">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-8 text-center bg-slate-50/50 dark:bg-slate-950/20">
                <span className="text-4xl">🤖</span>
                <p className="font-extrabold text-sm text-slate-800 dark:text-white leading-snug">MedDecode Assistant</p>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Ask questions about your medical reports, prescriptions, and more — in plain language.
                </p>
              </div>
              )}

              {user ? (
              <>
              {showVoiceConsent && (
                <div className="px-3 py-2.5 mx-3 mb-2 bg-primary/5 border border-primary/10 rounded-xl text-[10px] font-semibold text-slate-500 leading-normal flex flex-col gap-2 text-left">
                  <p>🎙️ Voice input uses your browser's built-in speech recognition; audio is not stored by MedDecode AI.</p>
                  <button
                    type="button"
                    onClick={acceptVoiceConsent}
                    className="self-end bg-primary text-white text-[9px] px-2 py-0.5 rounded font-bold"
                  >
                    Enable Voice Input
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-border bg-card flex gap-2 items-center"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about the app..."
                  className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                />
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={loading}
                  className={`p-2 rounded-xl border transition-all shrink-0 flex items-center justify-center cursor-pointer ${
                    !isVoiceSupported
                      ? "bg-slate-100 border-slate-200 text-slate-300 opacity-50 cursor-not-allowed"
                      : isListening
                      ? "bg-red-500 border-red-500 text-white animate-pulse"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                  title={
                    !isVoiceSupported
                      ? "Speech recognition is not supported in this browser."
                      : isListening
                      ? "Stop listening"
                      : "Start voice typing"
                  }
                >
                  {isListening ? "🔴" : "🎙️"}
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="bg-primary hover:bg-primary/90 disabled:bg-slate-300 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm transition-all"
                >
                  Send
                </button>
              </form>
              </>
              ) : (
                <div className="p-5 border-t border-border bg-card flex flex-col items-center gap-3 text-center">
                  <span className="text-3xl">🔐</span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Sign in to chat with the assistant</p>
                  <p className="text-xs text-slate-400 font-semibold">Get personalised answers about your documents, quota, and more.</p>
                  <a
                    href="/auth"
                    className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs px-5 py-2.5 rounded-full shadow-sm transition-all"
                  >
                    Sign In / Sign Up
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="relative flex items-center">
            <AnimatePresence>
              {showTooltip && !isOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.8 }}
                  className="absolute right-16 flex items-center bg-card text-foreground border border-border px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold whitespace-nowrap gap-2 select-none"
                >
                  <span className="text-primary dark:text-primary">✨</span>
                  <span>Need help? Chat with us</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissTooltip();
                    }}
                    className="text-muted-foreground hover:text-foreground ml-1.5 cursor-pointer font-bold text-[10px]"
                    aria-label="Dismiss tooltip"
                  >
                    ✕
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={() => {
                setIsOpen(!isOpen);
                handleDismissTooltip();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="relative w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-primary/30 cursor-pointer group"
              aria-label="Open Assistant Chatbot"
            >
              {/* Pulse Glow Ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-primary/60 opacity-40 blur-md -z-10"
                animate={{
                  scale: [1, 1.25, 1.45, 1],
                  opacity: [0.4, 0.7, 0, 0.4]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              {isOpen ? (
                <span className="text-2xl">💬</span>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-7 h-7 text-white transition-transform duration-300 group-hover:rotate-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Antenna */}
                  <path d="M12 6V2" className="text-primary stroke-primary" strokeWidth="2.5" />
                  <circle cx="12" cy="2" r="1" className="fill-primary stroke-primary" />
                  
                  {/* Head Outline */}
                  <rect x="3" y="6" width="18" height="13" rx="5" />
                  
                  {/* Glowing Eyes */}
                  <circle cx="8.5" cy="12.5" r="1.5" className="fill-white stroke-none" />
                  <circle cx="15.5" cy="12.5" r="1.5" className="fill-white stroke-none" />
                  
                  {/* Mouth */}
                  <path d="M9 16c1.5 1 4.5 1 6 0" />
                  
                  {/* Ears */}
                  <rect x="1" y="10" width="2" height="5" rx="1" className="fill-white stroke-none" />
                  <rect x="21" y="10" width="2" height="5" rx="1" className="fill-white stroke-none" />
                </svg>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

