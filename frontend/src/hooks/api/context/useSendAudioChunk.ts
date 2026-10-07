import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ContextService } from "../../services/contextService";
import type { SupportedLanguage } from "@/types";

const contextService = new ContextService();

export interface AudioChunkResponse {
  transcript?: string;
  [key: string]: any;
}

export const useSendAudioChunk = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      lang,
    }: {
      file: File | Blob;
      lang: SupportedLanguage;
    }): Promise<AudioChunkResponse> => {
      const result = await contextService.useSendAudioChunk(file, lang);
      return (result as AudioChunkResponse) || { transcript: "" };
    },
    onSuccess: (data) => {
      if (data?.transcript?.trim()) {
        console.log("Chunk transcript received:", data.transcript);
        queryClient.invalidateQueries({ queryKey: ["questions"] });
      }
    },
    onError: (error) => {
      // Do not display raw toast. The VoiceRecorderCard component handles
      // errors cleanly using structured UI state and localized messages.
      console.warn("[VoiceRecorder] Audio chunk processing returned error:", error);
    },
  });
};

