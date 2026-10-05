import { useState, useMemo } from 'react';
import { Search, Home, MoreVertical, MessageCircle, ChevronLeft, Filter } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/atoms/input';
import { ThreadItem } from './ThreadItem';
import type { Thread } from '../types';
import { Separator } from '@/components/atoms/separator';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { cn } from '@/lib/utils';

interface ThreadSidebarProps {
  threads: Thread[];
  selectedThreadId?: string;
  onThreadSelect: (threadId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
}

export function ThreadSidebar({
  threads,
  selectedThreadId,
  onThreadSelect,
  searchQuery,
  onSearchChange,
  isLoading,
}: ThreadSidebarProps) {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<'all' | 'expert' | 'unread'>('all');

  const displayedThreads = useMemo(() => {
    if (filterTab === 'expert') {
      return threads.filter((t) => t.status === 'Expert Review Required');
    }
    if (filterTab === 'unread') {
      return threads.filter((t) => t.unreadCount && t.unreadCount > 0);
    }
    return threads;
  }, [threads, filterTab]);

  const expertCount = useMemo(
    () => threads.filter((t) => t.status === 'Expert Review Required').length,
    [threads]
  );
  const unreadCount = useMemo(
    () => threads.filter((t) => t.unreadCount && t.unreadCount > 0).length,
    [threads]
  );

  return (
    <div className="flex flex-col h-full border-r border-border bg-card w-80 shrink-0">
      {/* Back navigation */}
      <div className="px-3 pt-3">
        <button
          onClick={() => navigate({ to: '/home' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to home
        </button>
      </div>

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center border border-green-200 dark:border-green-800">
              <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none text-foreground">WhatsApp History</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{threads.length} conversations</p>
            </div>
          </div>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search farmer name, phone, msg..."
            className="pl-8 h-8 text-xs bg-muted/50 rounded-lg"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 pt-1 pb-1">
          <button
            onClick={() => setFilterTab('all')}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded-md transition-colors",
              filterTab === 'all'
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All ({threads.length})
          </button>
          <button
            onClick={() => setFilterTab('expert')}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1",
              filterTab === 'expert'
                ? "bg-amber-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            PAE Review
            {expertCount > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold">
                {expertCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterTab('unread')}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1",
              filterTab === 'unread'
                ? "bg-green-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100 font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <Separator />

      {/* Thread list */}
      <ScrollArea className="flex-1 w-full overflow-hidden">
        <div className="w-full flex flex-col">
          {isLoading ? (
            <div className="flex flex-col">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-3.5 border-b border-border/50 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : displayedThreads.length > 0 ? (
            displayedThreads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isActive={
                  thread.id === selectedThreadId ||
                  thread.phoneNumber === selectedThreadId ||
                  (selectedThreadId ?? '').startsWith(thread.id)
                }
                onClick={() => onThreadSelect(thread.id)}
              />
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium text-xs">
                {threads.length === 0 ? "No WhatsApp conversations yet." : "No matching conversations found."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="mt-2 text-[11px] text-green-600 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
