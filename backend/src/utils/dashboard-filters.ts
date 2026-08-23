export function buildBaseQuestionMatch(source?: string,isTrainingQuestion?: boolean) {
  const matchStage: any = {
    $and: [
      {
        isTesting: { $ne: true },
        isTrainingQuestion: isTrainingQuestion === true ? true : { $ne: true },
      },
      {
        status: { $nin: ['non_agri'] }
      }
    ],
  };

  if (source) {
    if (source === 'both') {
      matchStage.source = { $in: ['WHATSAPP', 'AGRISEVA_AI'] };
    } else if (source.includes(',')) {
      const sourcesArray = source.split(',').map(s => {
        const lower = s.trim().toLowerCase();
        return (lower === "annam" || lower === "web application") ? "AGRISEVA_AI" : s.trim().toUpperCase();
      });
      matchStage.source = { $in: sourcesArray };
    } else {
      const lower = source.toLowerCase();
      matchStage.source = 
        (lower === "annam" || lower === "web application") 
          ? "AGRISEVA_AI" 
          : source.toUpperCase();
    }
  }

  return matchStage;
}