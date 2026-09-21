import { useMutation, useQueryClient } from "@tanstack/react-query";
import {toast} from "sonner";
import { ContextService } from "../../services/contextService";

const contextService = new ContextService();

export interface SubmitTranscriptInput {
  transcript: string;
  language?: string;
  submissionId?: string;
  details?: any;
}

export const useSubmitTranscript = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | SubmitTranscriptInput) => {
      try {
        if (typeof input === "string") {
          return await contextService.submitTranscript(input);
        }
        return await contextService.submitTranscript(input.transcript, {
          language: input.language,
          submissionId: input.submissionId,
          details: input.details,
        });
      } catch (error) {
        throw error instanceof Error ? error : new Error("Unknown error");
      }
    },
    onSuccess: () => {
      // Invalidate existing application query keys to ensure real recalculation
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      queryClient.invalidateQueries({ queryKey: ["detailed_questions"] });
      queryClient.invalidateQueries({ queryKey: ["question-status-summary"] });
      queryClient.invalidateQueries({ queryKey: ["queue-details"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["WorkLoad"] });
      queryClient.invalidateQueries({ queryKey: ["Heatmap"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit transcript! Try again.");
      console.error("Failed to submit transcript:", error.message);
    },
  });
};
