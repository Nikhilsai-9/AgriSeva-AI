"use client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import CountUp from "react-countup";
import { TopRightBadge } from "../NewBadge";

interface ResponseAdherenceProps {
  totalWhatsapp: number;
  totalAgriSeva-AI: number;
  answeredWithin120WhatsApp: number;
  answeredWithin120AgriSeva-AI: number;
}

export const ResponseAdherence = ({
  totalWhatsapp,
  totalAgriSeva-AI,
  answeredWithin120WhatsApp,
  answeredWithin120AgriSeva-AI,
}: ResponseAdherenceProps) => {
  // Calculate adherence percentages
  const whatsappAdherence = totalWhatsapp > 0 
    ? (answeredWithin120WhatsApp / totalWhatsapp) * 100 
    : 0;
  
  const agrisevaAdherence = totalAgriSeva-AI > 0 
    ? (answeredWithin120AgriSeva-AI / totalAgriSeva-AI) * 100 
    : 0;

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="text-base">Response Adherence (%)</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Percentage of questions answered within 2 hours
        </p>
        <TopRightBadge label="new" left={0} />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-1)]" />
              <span className="text-sm font-medium">WhatsApp</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">
                <CountUp 
                  end={whatsappAdherence} 
                  duration={2} 
                  decimals={1}
                  preserveValue 
                />%
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {answeredWithin120WhatsApp} of {totalWhatsapp} questions
              </p>
            </div>
          </div>

          {/* AgriSeva-AI */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-2)]" />
              <span className="text-sm font-medium">AgriSeva-AI</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">
                <CountUp 
                  end={agrisevaAdherence} 
                  duration={2} 
                  decimals={1}
                  preserveValue 
                />%
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {answeredWithin120AgriSeva-AI} of {totalAgriSeva-AI} questions
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
