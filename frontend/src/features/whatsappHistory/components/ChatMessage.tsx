import { format } from 'date-fns';
import { useState } from 'react';
import type { Message } from '../types';
import { cn } from '@/lib/utils';
import {
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Terminal,
  Clock,
  Check,
  AlertCircle,
  CheckCheck,
  Award,
  Sparkles,
  Mic,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isExpert = message.role === 'expert';
  const isAssistant = message.role === 'assistant';
  const isOutbound = isAssistant || isExpert;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const isImage =
    message.msgType === 'image' ||
    (message.mediaUrl &&
      (message.mediaUrl.startsWith('data:image') ||
        /\.(jpeg|jpg|png|webp|gif)/i.test(message.mediaUrl)));

  const isAudio =
    message.msgType === 'audio' ||
    message.msgType === 'voice' ||
    (message.mediaUrl &&
      (message.mediaUrl.startsWith('data:audio') ||
        /\.(ogg|opus|mp3|wav|m4a)/i.test(message.mediaUrl)));

  // Clean WhatsApp formatting: *bold*, _italic_, ~strike~
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      // Process bold *text*
      const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);

      return (
        <span key={idx} className="block min-h-[1.25em]">
          {parts.map((part, pIdx) => {
            if (part.startsWith('*') && part.endsWith('*')) {
              return (
                <strong key={pIdx} className="font-semibold">
                  {part.slice(1, -1)}
                </strong>
              );
            }
            if (part.startsWith('_') && part.endsWith('_')) {
              return (
                <em key={pIdx} className="italic opacity-90">
                  {part.slice(1, -1)}
                </em>
              );
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isOutbound ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "flex max-w-[85%] md:max-w-[75%] gap-2.5 items-end",
          isOutbound ? "flex-row" : "flex-row-reverse"
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-1 border shadow-xs",
            isExpert
              ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
              : isAssistant
                ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800"
                : "bg-primary text-primary-foreground border-primary"
          )}
        >
          {isExpert ? (
            <Award size={16} />
          ) : isAssistant ? (
            <Bot size={16} />
          ) : (
            <User size={16} />
          )}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "relative px-4 py-3 rounded-xl shadow-xs text-sm border",
            isExpert
              ? "bg-indigo-50/60 dark:bg-indigo-950/40 text-foreground border-indigo-200 dark:border-indigo-800/60 rounded-bl-xs"
              : isAssistant
                ? "bg-card text-card-foreground border-border rounded-bl-xs"
                : "bg-primary text-primary-foreground border-primary rounded-br-xs"
          )}
        >
          {/* Sender Header / Role Badge */}
          {isExpert ? (
            <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-indigo-200/50 dark:border-indigo-800/50">
              <Award size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                {message.senderName || 'Agricultural Expert (PAE)'}
              </span>
            </div>
          ) : isAssistant ? (
            <div className="flex items-center gap-1.5 mb-1 pb-0.5">
              <Sparkles size={11} className="text-green-600 dark:text-green-400" />
              <span className="text-[10px] font-semibold tracking-wide uppercase text-green-700 dark:text-green-400">
                AgriSeva-AI
              </span>
            </div>
          ) : (
            message.senderName && (
              <div className="text-[10px] font-semibold text-primary-foreground/90 mb-1 text-right">
                {message.senderName}
              </div>
            )
          )}

          {/* Media: Image preview */}
          {isImage && message.mediaUrl && (
            <div className="mb-2.5 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
              <div className="relative group">
                <img
                  src={message.mediaUrl}
                  alt="WhatsApp crop attachment"
                  className="w-full max-h-80 object-cover cursor-pointer hover:opacity-95 transition-all"
                  onClick={() => setIsImageModalOpen(true)}
                />
                <button
                  onClick={() => setIsImageModalOpen(true)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Expand image"
                >
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Media: Voice note / Audio */}
          {isAudio && message.mediaUrl && (
            <div className="mb-2.5 p-2 rounded-lg bg-background/60 border border-border/60">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1.5">
                <Mic size={12} className="text-green-600" />
                <span>Voice Note</span>
              </div>
              <audio controls src={message.mediaUrl} className="w-full h-8" />
            </div>
          )}

          {/* Message Content */}
          <div className="whitespace-pre-wrap break-words leading-relaxed text-[13px]">
            {renderFormattedText(message.content)}
          </div>

          {/* Tool Calls Accordion */}
          {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full group/btn hover:bg-muted/70 px-2 py-1.5 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-muted text-muted-foreground">
                    <Terminal size={12} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover/btn:text-foreground transition-colors">
                    Advisory Trace ({message.toolCalls.length})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp size={14} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="mt-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {message.toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-border bg-background overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border">
                        <span className="text-[11px] font-semibold text-foreground">
                          {tool.name.replace(/_/g, " ")}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">
                          {tool.id?.slice(-6) || "trace"}
                        </span>
                      </div>
                      <div className="p-2 space-y-2">
                        {tool.args && (
                          <pre className="text-[10px] font-mono text-muted-foreground bg-muted/40 p-1.5 rounded overflow-x-auto">
                            {JSON.stringify(tool.args, null, 2)}
                          </pre>
                        )}
                        {tool.response && (
                          <pre className="text-[10px] font-mono text-foreground/80 bg-muted/40 p-1.5 rounded overflow-x-auto max-h-40 overflow-y-auto">
                            {typeof tool.response === "object"
                              ? JSON.stringify(tool.response, null, 2)
                              : String(tool.response)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer: Timestamp and Status */}
          <div
            className={cn(
              "text-[9px] mt-1.5 flex justify-end items-center gap-1 font-medium opacity-75",
              isOutbound ? "text-muted-foreground" : "text-primary-foreground"
            )}
          >
            <span>{format(new Date(message.timestamp), "hh:mm a")}</span>
            {isOutbound && message.status === 'sending' && (
              <Clock size={10} className="animate-pulse" />
            )}
            {isOutbound && message.status === 'error' && (
              <AlertCircle size={10} className="text-destructive" />
            )}
            {isOutbound && !message.status && (
              <CheckCheck size={11} className="text-green-600 dark:text-green-400" />
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Crop Images */}
      {isImageModalOpen && message.mediaUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={message.mediaUrl}
              alt="Expanded crop view"
              className="max-h-[85vh] w-auto rounded-lg shadow-2xl object-contain"
            />
            <p className="text-white text-center text-xs mt-2">Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
