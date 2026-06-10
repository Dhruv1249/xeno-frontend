/**
 * Campaign Templates Library Component
 *
 * Implements a preset library displaying pre-configured layouts
 * for standard marketing actions (win-back, flash sale, etc.).
 *
 * Responsibilities:
 * - Render selection list for campaign structures.
 * - Supply initial channel, filter segments, and message scaffold values.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";

export interface CampaignTemplate {
  id: string;
  name: string;
  preset_segment: string;
  channel: "whatsapp" | "sms" | "email" | "rcs";
  tone: "friendly" | "urgent" | "exclusive";
  message_scaffold: string;
  description: string;
}

export const TEMPLATES: CampaignTemplate[] = [
  {
    id: "t1",
    name: "Win-back Offer",
    preset_segment: "Lapsed Shoppers (60+ Days)",
    channel: "whatsapp",
    tone: "urgent",
    message_scaffold: "Hey {{customer_name}}, we haven't seen you in a while! Use code COMEBACK20 for 20% off your next order. Only valid for 48 hours.",
    description: "Re-engage shoppers who haven't ordered in 60+ days with an urgent discount.",
  },
  {
    id: "t2",
    name: "Flash Sale Alert",
    preset_segment: "All Customers",
    channel: "sms",
    tone: "urgent",
    message_scaffold: "Urgent: Xeno Monsoon Flash Sale is live! Get 40% off everything at {{customer_name}}'s nearest store or online. Code: FLASH40. Ends tonight!",
    description: "Broad-scale urgent clearance event broadcasted to all shoppers.",
  },
  {
    id: "t3",
    name: "Loyalty Reward",
    preset_segment: "Champions",
    channel: "whatsapp",
    tone: "exclusive",
    message_scaffold: "Hi {{customer_name}}! As one of our most valued shoppers, we've credited an exclusive ₹500 voucher to your account. Shop our new collection now: xeno.co/exclusive",
    description: "Reward top-tier Champions with an exclusive loyalty credit.",
  },
  {
    id: "t4",
    name: "New Arrival Announcement",
    preset_segment: "Loyal",
    channel: "email",
    tone: "friendly",
    message_scaffold: "Hello {{customer_name}},\n\nOur Autumn collection has just arrived! We think you'll love the new styles we curated. Swing by your local store or shop online today.",
    description: "Friendly update of new merchandise tailored to Loyal customers.",
  },
  {
    id: "t5",
    name: "Birthday Offer",
    preset_segment: "Birthday Month Cohort",
    channel: "whatsapp",
    tone: "friendly",
    message_scaffold: "Happy Birthday {{customer_name}}! 🎂 Celebrate your special month with a complimentary dessert or 15% off your next purchase. Present this message at checkout.",
    description: "Personalized friendly greeting sent to shoppers during their birthday month.",
  },
  {
    id: "t6",
    name: "Reorder Reminder",
    preset_segment: "High frequency, 30+ days",
    channel: "sms",
    tone: "friendly",
    message_scaffold: "Hi {{customer_name}}, running low on your favorites? Reorder today and get free delivery using code REORDER. Click: xeno.co/reorder",
    description: "Friendly replenishment nudge for high-frequency repeat shoppers.",
  },
];

interface TemplateLibraryProps {
  onSelectTemplate: (template: CampaignTemplate) => void;
  selectedTemplateId?: string;
}

/**
 * Grid rendering campaign template cards.
 *
 * @param props Library options including selection callbacks and active templates
 * @returns React element
 */
export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  onSelectTemplate,
  selectedTemplateId,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {TEMPLATES.map((tmpl) => (
        <Card
          key={tmpl.id}
          hoverEffect
          className={`cursor-pointer p-5 flex flex-col justify-between transition-all border
            ${
              selectedTemplateId === tmpl.id
                ? "border-primary/50 shadow-recessed bg-surface"
                : "border-text/5 shadow-extruded"
            }
          `}
          onClick={() => onSelectTemplate(tmpl)}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-primary" />
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-text">
                  {tmpl.name}
                </h3>
              </div>
              <Badge variant="primary" type="recessed" className="text-[9px]">
                {tmpl.channel}
              </Badge>
            </div>
            
            <p className="font-sans text-[11px] text-text-muted leading-relaxed">
              {tmpl.description}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-text/5 flex items-center justify-between">
            <div className="flex gap-1.5">
              <Badge variant="default" type="recessed" className="text-[8px]">
                Target: {tmpl.preset_segment}
              </Badge>
              <Badge
                variant={
                  tmpl.tone === "urgent"
                    ? "danger"
                    : tmpl.tone === "exclusive"
                    ? "primary"
                    : "success"
                }
                type="recessed"
                className="text-[8px]"
              >
                {tmpl.tone}
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
