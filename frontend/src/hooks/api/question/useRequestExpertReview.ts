import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QuestionService } from "@/hooks/services/questionService";
import { toast } from "sonner";

const questionService = new QuestionService();

export const useRequestExpertReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionId: string) => questionService.requestExpertReview(questionId),
    onSuccess: (data) => {
      toast.success("Expert review successfully requested!");
      queryClient.invalidateQueries({ queryKey: ["questions_levels"] });
      queryClient.invalidateQueries({ queryKey: ["all-detailed-questions"] });
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      queryClient.invalidateQueries({ queryKey: ["detailed_questions"] });
      queryClient.invalidateQueries({ queryKey: ["question-details", data.questionId] });
      queryClient.invalidateQueries({ queryKey: ["question-full-data", data.questionId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to request expert review");
    },
  });
};
