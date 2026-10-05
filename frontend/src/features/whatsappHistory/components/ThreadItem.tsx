import { formatDistanceToNow } from 'date-fns';
import type { Thread } from '../types';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/utils/formatPhoneNumber';

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}

export function ThreadItem({ thread, isActive, onClick }: ThreadItemProps) {
  const displayName = thread.farmerName || formatPhoneNumber(thread.phoneNumber);
  const showSubPhone = !!thread.farmerName;
  const langCode = thread.language ? thread.language.split('-')[0].toUpperCase() : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col p-3.5 cursor-pointer transition-all border-b border-border/50 hover:bg-accent/40 w-full overflow-hidden",
        isActive && "bg-accent/80 border-l-4 border-l-green-600 shadow-sm"
      )}
    >
      <div className="flex justify-between items-start gap-2 mb-1 w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/60 border border-green-200 dark:border-green-800 flex items-center justify-center shrink-0 text-xs font-semibold text-green-700 dark:text-green-300">
            {thread.farmerName ? thread.farmerName.charAt(0).toUpperCase() : '+'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate text-foreground leading-tight">
                {displayName}
              </span>
              {langCode && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono font-medium shrink-0">
                  {langCode}
                </span>
              )}
            </div>

            {showSubPhone && (
              <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                {formatPhoneNumber(thread.phoneNumber)}
              </span>
            )}
          </div>
        </div>

        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
          {formatDistanceToNow(new Date(thread.lastMessageTimestamp), { addSuffix: true })}
        </span>
      </div>

      <div className="w-full mt-1 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate leading-relaxed flex-1">
          {thread.lastMessage.length > 45 
            ? `${thread.lastMessage.substring(0, 45)}...` 
            : thread.lastMessage}
        </p>

        <div className="flex items-center gap-1.5 shrink-0">
          {thread.status === 'Expert Review Required' && (
            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[9px] font-semibold px-1.5 py-0.5 rounded">
              PAE Review
            </span>
          )}

          {thread.unreadCount && thread.unreadCount > 0 ? (
            <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {thread.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
