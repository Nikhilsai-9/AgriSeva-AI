import { useState, useMemo, useEffect } from 'react';
import { useThreads } from './useThreads';
import { useThreadDetails } from './useThreadDetails';
import { useSendMessage } from './useSendMessage';
import { useSearch, useNavigate } from '@tanstack/react-router';

export function useWhatsAppHistory() {
  const search = useSearch({ from: '/whatsapp-history' });
  const navigate = useNavigate();

  const todayIST = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });

  const rawThreadId = search.threadId ?? '';
  const selectedThreadId = rawThreadId.replace(/"/g, '');

  const [searchQuery, setSearchQuery] = useState('');
  const [lastMessageOverrides, setLastMessageOverrides] = useState<Record<string, string>>({});

  const { data: threads = [], isLoading: isLoadingThreads } = useThreads();

  const selectedThread = useMemo(() => {
    const phoneNumber = selectedThreadId.includes('-')
      ? selectedThreadId.split('-')[0]
      : selectedThreadId;
    return threads.find(
      (t) =>
        t.id === phoneNumber ||
        t.id === selectedThreadId ||
        t.phoneNumber === phoneNumber ||
        t.phoneNumber.replace(/\D/g, '') === phoneNumber.replace(/\D/g, '')
    );
  }, [threads, selectedThreadId]);

  const selectedDate = search.date ?? (selectedThread?.lastMessageDate || todayIST);

  const setSelectedThreadId = (threadId: string) => {
    const thread = threads.find((t) => t.id === threadId || t.phoneNumber === threadId);
    navigate({
      to: '/whatsapp-history',
      search: (prev: Record<string, string>) => ({ 
        ...prev, 
        threadId,
        date: thread?.lastMessageDate || todayIST,
      }),
    });
  };

  const setSelectedDate = (date: string) => {
    navigate({
      to: '/whatsapp-history',
      search: (prev: Record<string, string>) => ({ ...prev, date }),
    });
  };

  const { data: messages = [], isLoading: isLoadingMessages } = useThreadDetails(selectedThreadId, selectedDate);

  // Requirement 15 & 16: Prevent stale cross-user selectedThreadId from persisting across logout/login
  useEffect(() => {
    if (!isLoadingThreads && selectedThreadId && threads.length > 0) {
      const exists = threads.some(
        (t) =>
          t.id === selectedThreadId ||
          t.phoneNumber === selectedThreadId ||
          t.phoneNumber.replace(/\D/g, '') === selectedThreadId.replace(/\D/g, '')
      );
      if (!exists) {
        // Automatically switch to this user's first available thread
        const first = threads[0];
        navigate({
          to: '/whatsapp-history',
          search: (prev: Record<string, string>) => ({
            ...prev,
            threadId: first.id,
            date: first.lastMessageDate || todayIST,
          }),
        });
      }
    } else if (!isLoadingThreads && threads.length === 0 && selectedThreadId) {
      // Clear threadId if this user has 0 conversations
      navigate({
        to: '/whatsapp-history',
        search: (prev: Record<string, string>) => {
          const next = { ...prev };
          delete next.threadId;
          delete next.date;
          return next;
        },
      });
    }
  }, [threads, isLoadingThreads, selectedThreadId, navigate, todayIST]);

  useEffect(() => {
    if (messages.length > 0 && selectedThreadId) {
      const lastMeaningfulMsg = [...messages].reverse().find(m => m.content && m.content.length > 0);
      if (lastMeaningfulMsg) {
        setLastMessageOverrides(prev => ({
          ...prev,
          [selectedThreadId]: lastMeaningfulMsg.content
        }));
      }
    }
  }, [messages, selectedThreadId]);

  const enrichedThreads = useMemo(() => {
    return threads.map(t => ({
      ...t,
      lastMessage: lastMessageOverrides[t.id] || t.lastMessage
    }));
  }, [threads, lastMessageOverrides]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return enrichedThreads;
    return enrichedThreads.filter(t =>
      (t.phoneNumber && t.phoneNumber.toLowerCase().includes(q)) ||
      (t.farmerName && t.farmerName.toLowerCase().includes(q)) ||
      (t.lastMessage && t.lastMessage.toLowerCase().includes(q)) ||
      (t.language && t.language.toLowerCase().includes(q)) ||
      (t.status && t.status.toLowerCase().includes(q))
    );
  }, [enrichedThreads, searchQuery]);


  const sendMessageMutation = useSendMessage(selectedThreadId, selectedThread?.phoneNumber);

  const canSendMessage = useMemo(() => {
    if (!selectedThread?.lastMessageTimestamp) return false;
    const lastMsgDate = new Date(selectedThread.lastMessageTimestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - lastMsgDate.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
  }, [selectedThread]);

  return {
    selectedThreadId,
    setSelectedThreadId,
    selectedDate,
    setSelectedDate,
    searchQuery,
    setSearchQuery,
    threads: filteredThreads,
    messages,
    isLoadingThreads,
    isLoadingMessages,
    selectedThread,
    canSendMessage,
    sendMessage: (content: string) => sendMessageMutation.mutate(content),
    isSending: sendMessageMutation.isPending,
  };
}