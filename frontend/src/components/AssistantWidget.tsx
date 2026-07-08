import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../context/AuthContext";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      const { data, error } = await supabase.functions.invoke("assistant", {
        body: {
          message: userMsg,
          conversationHistory: messages,
          currentPageContext,
        },
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

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans print:hidden">
      {isOpen && (
        <div className="w-[340px] sm:w-[380px] h-[500px] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-6">
          <div className="bg-[#004bb3] text-white p-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <h4 className="font-extrabold text-sm leading-tight">MedDecode Assistant</h4>
                <span className="text-[10px] text-blue-200 font-bold">App Guide & Helper</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-blue-100 font-extrabold text-lg p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed shadow-sm ${
                    msg.sender === "user"
                      ? "bg-[#004bb3] text-white rounded-br-none"
                      : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
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

          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-border bg-card flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the app..."
              className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004bb3]/50 text-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-[#004bb3] hover:bg-[#003d99] disabled:bg-slate-300 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#004bb3] hover:bg-[#003d99] text-white rounded-full flex items-center justify-center text-2xl shadow-xl hover:shadow-primary/20 hover:scale-105 transition-all duration-200 cursor-pointer"
        aria-label="Open Assistant Chatbot"
      >
        {isOpen ? "💬" : "🤖"}
      </button>
    </div>
  );
};
