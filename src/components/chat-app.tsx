"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { AnswerContent } from "@/components/answer-content";
import { EvidenceStack } from "@/components/evidence-stack";
import { EXAMPLE_PROMPTS } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import {
  acceptDisclaimer,
  clearMessages,
  hasAcceptedDisclaimer,
  loadMessages,
  saveMessages,
} from "@/lib/session";

export function ChatApp() {
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(loadMessages());
    setAccepted(hasAcceptedDisclaimer());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveMessages(messages);
  }, [messages, ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLoading(true);
    setInput("");

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      setMessages((prev) => [...prev, data.message as ChatMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function onAcceptDisclaimer() {
    acceptDisclaimer();
    setAccepted(true);
  }

  function onNewConversation() {
    clearMessages();
    setMessages([]);
    setError(null);
    setInput("");
  }

  if (!ready) {
    return <div className="shell shell--loading" aria-hidden />;
  }

  if (!accepted) {
    return (
      <div className="shell">
        <div className="disclaimer-panel animate-rise">
          <p className="eyebrow">Before you ask</p>
          <h1 className="disclaimer-panel__title">Ask Prophetic Traditions</h1>
          <p className="disclaimer-panel__lede">
            Search the six canonical hadith collections — Bukhārī, Muslim, Abū
            Dāwūd, Tirmidhī, Nasāʾī, and Ibn Mājah — with cited Arabic and
            English evidence.
          </p>
          <ul className="disclaimer-panel__list">
            <li>Answers come from retrieved hadith text only (AI-assisted search).</li>
            <li>This is not fatwā. Legal questions belong with a qualified scholar.</li>
            <li>Verify every citation on sunnah.com before teaching others.</li>
          </ul>
          <button type="button" className="btn btn--primary" onClick={onAcceptDisclaimer}>
            I understand — begin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="masthead animate-rise">
        <div>
          <p className="eyebrow">Kutub al-Sittah · cited search</p>
          <h1 className="masthead__title">Ask Prophetic Traditions</h1>
          <p className="masthead__tagline">
            Search the six canonical hadith collections — cited, bilingual, not
            fatwā.
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onNewConversation}>
          New conversation
        </button>
      </header>

      {messages.length === 0 ? (
        <section className="prompt-deck animate-rise" style={{ animationDelay: "80ms" }}>
          <p className="prompt-deck__label">Try a question</p>
          <div className="prompt-deck__grid">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="prompt-chip"
                onClick={() => void sendMessage(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="transcript" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`turn turn--${message.role} animate-rise`}
            style={{ animationDelay: `${Math.min(index, 4) * 60}ms` }}
          >
            <p className="turn__label">{message.role === "user" ? "You" : "Answer"}</p>
            {message.role === "assistant" ? (
              <>
                <AnswerContent content={message.content} sources={message.sources} />
                {message.sources?.length ? (
                  <EvidenceStack
                    content={message.content}
                    sources={message.sources}
                  />
                ) : null}
              </>
            ) : (
              <p className="turn__body">{message.content}</p>
            )}
          </div>
        ))}

        {loading ? (
          <div className="turn turn--assistant turn--pending animate-rise">
            <p className="turn__label">Answer</p>
            <p className="searching">
              <span className="searching__dot" />
              Searching the six books…
            </p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </section>

      <form className="composer animate-rise" onSubmit={onSubmit}>
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <textarea
          id="question"
          ref={inputRef}
          className="composer__input"
          rows={3}
          placeholder="Ask about a theme, narrator, or teaching in the Six Books…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
        />
        <div className="composer__bar">
          <p className="composer__hint">Shift+Enter for a new line · not legal advice</p>
          <button type="submit" className="btn btn--primary" disabled={loading || !input.trim()}>
            {loading ? "Searching…" : "Ask"}
          </button>
        </div>
        {error ? <p className="composer__error">{error}</p> : null}
      </form>

      <footer className="site-footer">
        <p>
          AI-assisted search over Kutub al-Sittah. Always verify hadith on{" "}
          <a href="https://sunnah.com" target="_blank" rel="noopener noreferrer">
            sunnah.com
          </a>
          . Not a substitute for scholarly guidance.
        </p>
      </footer>
    </div>
  );
}
