/**
 * Campaign Builder Wizard Page
 *
 * Implements the step-by-step Campaign Composer wizard (Template, Audience,
 * Channel, Compose) featuring the AI Pre-send Advisor and message editor.
 *
 * Responsibilities:
 * - Direct users through templates selection.
 * - Call recommendation and draft APIs.
 * - Save and dispatch campaigns.
 */

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateLibrary, CampaignTemplate } from "@/components/campaign/TemplateLibrary";
import { ArrowLeft, Sparkles, AlertCircle, Info, Send, Calendar, ChevronRight, ChevronLeft, Users } from "lucide-react";
import { AIRecommendation } from "@/types";
import { MOCK_TARGET_SEGMENTS } from "@/lib/mockData";

/**
 * Renders the Campaign Creation wizard interface.
 *
 * @returns React page element
 */
function NewCampaignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams ? searchParams.get("draft") : null;
  
  // Wizard steps: 1 (Template), 2 (Audience), 3 (Channel), 4 (Compose)
  const [step, setStep] = useState(1);

  // Campaign Form State
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [segments, setSegments] = useState<{ id: string; name: string; count: number }[]>(MOCK_TARGET_SEGMENTS);
  const [targetSegmentId, setTargetSegmentId] = useState("s1");
  const [targetMode, setTargetMode] = useState<"all" | "segment">("all");
  const [selectedChannel, setSelectedChannel] = useState<"whatsapp" | "sms" | "email" | "rcs">("whatsapp");
  const [messageText, setMessageText] = useState("");
  const [selectedTone, setSelectedTone] = useState<"friendly" | "urgent" | "exclusive">("friendly");
  const [emailSubject, setEmailSubject] = useState("");
  const [manualInstructions, setManualInstructions] = useState("");

  // Load draft campaign details if we are in Edit/Resume mode
  useEffect(() => {
    if (!draftId) return;

    async function fetchDraftDetails() {
      try {
        const res = await fetch(`/api/campaigns/${draftId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            const camp = json.data;
            setCampaignName(camp.name);
            setTargetSegmentId(camp.segment_id);
            setSelectedChannel(camp.channel);
            
            // Extract subject from message_template if channel is email
            if (camp.channel === "email" && camp.message_template.startsWith("Subject: ")) {
              const match = camp.message_template.match(/^Subject:\s*(.*)\n\n([\s\S]*)$/);
              if (match) {
                setEmailSubject(match[1]);
                setMessageText(match[2]);
              } else {
                setMessageText(camp.message_template);
              }
            } else {
              setMessageText(camp.message_template);
            }

            // Determine target mode
            const allSeg = segments.find(s => s.name === "All Shoppers");
            if (allSeg && camp.segment_id === allSeg.id) {
              setTargetMode("all");
            } else {
              setTargetMode("segment");
            }

            // Jump straight to the compose step (step 4) since details are loaded
            setStep(4);
          }
        }
      } catch (err) {
        console.error("Failed to load draft campaign details", err);
      }
    }

    if (segments.length > 0) {
      fetchDraftDetails();
    }
  }, [draftId, segments]);

  // Load real segments from database API
  useEffect(() => {
    async function fetchSegments() {
      try {
        const res = await fetch("/api/segments");
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            let fetchedSegments = json.data;

            // Check if "All Shoppers" is missing
            let allSeg = fetchedSegments.find((s: any) => s.name === "All Shoppers");
            if (!allSeg) {
              const createRes = await fetch("/api/segments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: "All Shoppers",
                  description: "All registered shoppers in the database.",
                  filter_rules: { operator: "AND", rules: [] }
                })
              });
              if (createRes.ok) {
                const createdJson = await createRes.json();
                if (createdJson.data) {
                  fetchedSegments = [createdJson.data, ...fetchedSegments];
                  allSeg = createdJson.data;
                }
              }
            }

            const mapped = fetchedSegments.map((s: any) => ({
              id: s.id,
              name: s.name,
              count: s.customer_count,
            }));
            setSegments(mapped);

            // Default targetSegmentId
            if (mapped.length > 0) {
              const defaultSeg = allSeg ? mapped.find((s: any) => s.id === allSeg.id) : mapped[0];
              if (defaultSeg) {
                setTargetSegmentId(defaultSeg.id);
                setTargetMode("all");
              } else {
                setTargetSegmentId(mapped[0].id);
                setTargetMode("segment");
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load segments", error);
      }
    }
    fetchSegments();
  }, []);

  // AI Recommendation State (Pre-Send Advisor)
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  // AI Message Draft State
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);

  // Update name if template is selected
  const handleSelectTemplate = (tmpl: CampaignTemplate) => {
    setSelectedTemplate(tmpl);
    setCampaignName(`${tmpl.name} Campaign - ${new Date().toLocaleDateString()}`);
    setSelectedChannel(tmpl.channel);
    setMessageText(tmpl.message_scaffold);
    setSelectedTone(tmpl.tone);
    if (tmpl.channel === "email") {
      setEmailSubject("Our New Autumn Collection is Here!");
    } else {
      setEmailSubject("");
    }

    // Set target segment based on template's preset
    const preset = tmpl.preset_segment;
    if (preset) {
      const matched = segments.find(
        (s) => s.name.toLowerCase().includes(preset.toLowerCase())
      );
      if (matched) {
        setTargetSegmentId(matched.id);
        if (matched.name === "All Shoppers") {
          setTargetMode("all");
        } else {
          setTargetMode("segment");
        }
      } else {
        setTargetMode("segment");
      }
    } else {
      setTargetMode("segment");
    }

    setStep(2); // Auto advance to step 2
  };

  // Fetch AI Pre-Send Recommendation
  useEffect(() => {
    if (step === 3) {
      let active = true;
      // Defer state update to next tick to avoid synchronous cascading renders warning
      const timer = setTimeout(() => {
        if (active) setRecommendationLoading(true);
      }, 0);
      
      async function fetchRecommendation() {
        try {
          const res = await fetch("/api/ai/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ segment_id: targetSegmentId, channel: selectedChannel }),
          });
          if (!active) return;
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              setRecommendation(json.data);
            }
          } else {
            // Mock recommendation
            setTimeout(() => {
              if (active) {
                setRecommendation({
                  recommended_channel: selectedChannel,
                  recommended_time: "Tuesday 7–9 PM",
                  reasoning: `Historically, the targeted cohort demonstrates 85% higher conversion on ${selectedChannel === "sms" ? "WhatsApp" : "WhatsApp"} during evening hours compared to SMS.`,
                  risk: "High volume of WhatsApp dispatches in Delhi may trigger local spam rate caps."
                });
              }
            }, 600);
          }
        } catch (error) {
          console.error(error);
        } finally {
          if (active) setRecommendationLoading(false);
        }
      }
      fetchRecommendation();

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [step, targetSegmentId, selectedChannel]);

  // Trigger AI Message Drafting
  const handleAIDraft = async () => {
    setDraftLoading(true);
    try {
      const segName = segments.find(s => s.id === targetSegmentId)?.name || "Shoppers";
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_name: segName,
          channel: selectedChannel,
          tone: selectedTone,
          custom_prompt: manualInstructions
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          if (json.data.draft) {
            setMessageText(json.data.draft);
          }
          if (json.data.subject) {
            setEmailSubject(json.data.subject);
          }
        } else if (json.draft) {
          setMessageText(json.draft);
        }
      } else {
        // Fallback drafts containing customer_name
        setTimeout(() => {
          let draft = "";
          let subject = "";
          if (selectedTone === "urgent") {
            draft = `Hurry {{customer_name}}! 🚨 Limited time offer on your favorite styles. Use code EXPEDITE for free shipping. Ends in 4 hours!`;
            subject = "Urgent: Limited Time Offer Just for You!";
          } else if (selectedTone === "exclusive") {
            draft = `Greetings {{customer_name}} ✨. We've unlocked VIP access for your account. Shop our new limited drop before anyone else: xeno.in/vip`;
            subject = "VIP Access Unlocked - Shop the Drop First";
          } else {
            draft = `Hi {{customer_name}}! Hope your week is going well. We wanted to share some new styles that just landed in our shop. Stop by whenever you have a moment!`;
            subject = "New Arrivals are Here!";
          }
          setMessageText(draft);
          if (selectedChannel === "email") {
            setEmailSubject(subject);
          }
        }, 500);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDraftLoading(false);
    }
  };

  // Dispatch Campaign
  const handleSendCampaign = async (status: "running" | "scheduled") => {
    setSendingCampaign(true);
    try {
      const finalMessageTemplate = selectedChannel === "email"
        ? `Subject: ${emailSubject.trim()}\n\n${messageText}`
        : messageText;

      const payload = {
        name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        segment_id: targetSegmentId,
        channel: selectedChannel,
        message_template: finalMessageTemplate,
        status: status === "running" ? "draft" : "scheduled",
      };

      const url = draftId ? `/api/campaigns/${draftId}` : "/api/campaigns";
      const method = draftId ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const campaignId = json.data.id;

        if (status === "running") {
          // Trigger the actual simulator dispatch
          const sendRes = await fetch(`/api/campaigns/${campaignId}/send`, {
            method: "POST",
          });

          if (!sendRes.ok) {
            const errData = await sendRes.json();
            throw new Error(errData.error || "Failed to dispatch campaign via simulator");
          }
        }

        // Redirect to Campaign Analytics of newly created campaign
        router.push(`/campaigns/${campaignId}`);
      } else {
        // Mock successful save and redirect to mock campaign analytics
        setTimeout(() => {
          router.push(`/campaigns/camp3`);
        }, 800);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed dispatching campaign");
    } finally {
      setSendingCampaign(false);
    }
  };

  const currentSegmentCount = segments.find(s => s.id === targetSegmentId)?.count || 0;

  return (
    <div className="space-y-8 w-full">
      {/* Back button */}
      <div>
        <button onClick={() => router.push("/campaigns")} className="inline-flex items-center gap-2 font-sans font-bold text-xs uppercase tracking-wider text-text-muted hover:text-text cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Campaign Builder
          </span>
          <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
            New Campaign Dispatch
          </h1>
        </div>
      </div>

      {/* Wizard Steps indicator */}
      <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 border-b border-text/10 select-none">
        {[
          { num: 1, label: "Template" },
          { num: 2, label: "Audience" },
          { num: 3, label: "Channel" },
          { num: 4, label: "Compose & Send" }
        ].map((s) => (
          <React.Fragment key={s.num}>
            <div
              className={`
                flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-wider px-3 py-1.5 rounded
                ${
                  step === s.num
                    ? "text-primary border border-primary/20 shadow-recessed"
                    : step > s.num
                    ? "text-success border border-success/10 bg-success/5"
                    : "text-text-muted border border-transparent"
                }
              `}
            >
              <span className="font-mono text-[10px]">{s.num}.</span>
              <span>{s.label}</span>
            </div>
            {s.num < 4 && <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: SELECT TEMPLATE */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-sans font-bold text-sm uppercase tracking-wider text-text">
              Step 1: Pick a Campaign Template scaffold
            </h2>
            <Button variant="default" size="sm" onClick={() => handleSelectTemplate({
              id: "blank", name: "Custom Campaign", preset_segment: "Champions", channel: "whatsapp", tone: "friendly", message_scaffold: "", description: ""
            })}>
              Start Blank
            </Button>
          </div>
          <TemplateLibrary onSelectTemplate={handleSelectTemplate} selectedTemplateId={selectedTemplate?.id} />
        </div>
      )}

      {/* STEP 2: SELECT AUDIENCE */}
      {step === 2 && (
        <Card>
          <CardHeader className="border-b border-text/10 pb-4">
            <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
              Step 2: Target Audience Segment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4 max-w-md">
              <div className="space-y-1">
                <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="ENTER CAMPAIGN TITLE..."
                  className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono tracking-wider shadow-recessed outline-none focus:border-primary"
                />
              </div>

              {/* Target Mode Toggle */}
              <div className="space-y-2">
                <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">
                  Audience Targeting Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetMode("all");
                      const allSeg = segments.find((s) => s.name === "All Shoppers");
                      if (allSeg) setTargetSegmentId(allSeg.id);
                    }}
                    className={`
                      p-3 rounded-lg border font-sans font-bold text-xs uppercase tracking-wider text-center transition-all duration-150 cursor-pointer
                      ${
                        targetMode === "all"
                          ? "text-primary border-primary/45 shadow-recessed"
                          : "text-text-muted border-text/5 shadow-extruded hover:shadow-extruded-hover hover:text-text"
                      }
                    `}
                  >
                    Send to All Shoppers
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetMode("segment");
                      const otherSeg = segments.find((s) => s.name !== "All Shoppers");
                      if (otherSeg) setTargetSegmentId(otherSeg.id);
                    }}
                    className={`
                      p-3 rounded-lg border font-sans font-bold text-xs uppercase tracking-wider text-center transition-all duration-150 cursor-pointer
                      ${
                        targetMode === "segment"
                          ? "text-primary border-primary/45 shadow-recessed"
                          : "text-text-muted border-text/5 shadow-extruded hover:shadow-extruded-hover hover:text-text"
                      }
                    `}
                  >
                    Target Specific Segment
                  </button>
                </div>
              </div>

              {targetMode === "segment" ? (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">
                    Select Target Segment
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={targetSegmentId}
                      onChange={(e) => setTargetSegmentId(e.target.value)}
                      className="flex-1 bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono tracking-wider shadow-extruded cursor-pointer outline-none focus:border-primary"
                    >
                      {segments
                        .filter((s) => s.name !== "All Shoppers")
                        .map((seg) => (
                          <option key={seg.id} value={seg.id}>
                            {seg.name.toUpperCase()} ({seg.count} SHOPPERS)
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => router.push("/segments/new")}
                      className="shrink-0 cursor-pointer"
                    >
                      Create Segment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 p-3.5 bg-primary/5 border border-primary/10 rounded-lg text-xs font-sans text-text-muted">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      Campaign will target the entire customer database. No segment filtering will be applied.
                    </span>
                  </div>
                </div>
              )}

              {/* Shopper count badge */}
              <div className="flex items-center gap-2 bg-surface border border-text/5 p-3.5 rounded-lg shadow-recessed">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-sans font-medium text-xs text-text">
                  Targeting <span className="font-mono font-bold text-primary">{currentSegmentCount}</span> verified shoppers
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-text/5 pt-4 mt-6">
              <Button variant="default" size="sm" onClick={() => setStep(1)} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStep(3)} rightIcon={<ChevronRight className="w-4 h-4" />}>
                Choose Channel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: CHOOSE CHANNEL & VIEW PRE-SEND ADVISOR */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Channel selector */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader className="border-b border-text/10 pb-4">
                <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
                  Step 3: Messaging Channel
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {(["whatsapp", "sms", "email", "rcs"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => {
                        setSelectedChannel(ch);
                        if (ch === "email" && !emailSubject) {
                          setEmailSubject("Exclusive Offer for You!");
                        }
                      }}
                      className={`
                        p-4 rounded-lg border font-sans font-bold text-xs uppercase tracking-wider text-left transition-all duration-150 select-none cursor-pointer
                        ${
                          selectedChannel === ch
                            ? "text-primary border-primary/45 shadow-recessed"
                            : "text-text-muted border-text/5 shadow-extruded hover:shadow-extruded-hover hover:text-text"
                        }
                      `}
                    >
                      <div className="font-mono text-[9px] text-text-muted mb-1">DISPATCH CHANNEL</div>
                      <div>{ch.toUpperCase()}</div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-text/5 pt-4 mt-6">
                  <Button variant="default" size="sm" onClick={() => setStep(2)} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(4)} rightIcon={<ChevronRight className="w-4 h-4" />}>
                    Draft Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pre-Send Advisor Panel */}
          <div className="lg:col-span-5">
            <Card className="border border-primary/20 relative overflow-hidden">
              <CardHeader className="border-b border-text/10 pb-4">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
                    AI Pre-Send Advisor
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 font-sans text-xs">
                {recommendationLoading ? (
                  <div className="space-y-3 py-2 animate-pulse">
                    <div className="h-4 bg-text/10 rounded w-full" />
                    <div className="h-4 bg-text/10 rounded w-5/6" />
                    <div className="h-4 bg-text/10 rounded w-4/5" />
                  </div>
                ) : recommendation ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Recommended Method:</div>
                      <div className="font-mono font-bold text-text uppercase flex items-center gap-2">
                        <Badge variant="primary" type="recessed">{recommendation.recommended_channel}</Badge>
                        <span>at {recommendation.recommended_time}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Advisor Reasoning:</div>
                      <p className="text-text-muted leading-relaxed italic bg-surface border border-text/5 p-2 rounded shadow-recessed">
                        &ldquo;{recommendation.reasoning}&rdquo;
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-danger flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Potential Risk Warning:
                      </div>
                      <p className="text-danger bg-danger/5 border border-danger/10 p-2.5 rounded text-[11px] leading-relaxed">
                        {recommendation.risk}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="italic text-text-muted">Advisor currently offline.</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 4: COMPOSE MESSAGE & DISPATCH */}
      {step === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Message Editor */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader className="border-b border-text/10 pb-4">
                <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
                  Step 4: Message Template Editor
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                          {/* AI Draft Custom Instructions */}
                <div className="space-y-3 bg-surface/50 border border-text/5 p-4 rounded-lg shadow-recessed">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Draft Tone:</span>
                      <select
                        value={selectedTone}
                        onChange={(e) => setSelectedTone(e.target.value as "friendly" | "urgent" | "exclusive")}
                        className="bg-surface border border-text/10 rounded-lg p-1.5 text-xs font-mono tracking-wider shadow-extruded outline-none cursor-pointer"
                      >
                        <option value="friendly">FRIENDLY</option>
                        <option value="urgent">URGENT</option>
                        <option value="exclusive">EXCLUSIVE</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={draftLoading}
                      onClick={handleAIDraft}
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
                    >
                      {draftLoading ? "Drafting..." : "AI Auto Draft"}
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">
                      Manual Copywriting Prompt / Custom Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualInstructions}
                      onChange={(e) => setManualInstructions(e.target.value)}
                      placeholder="e.g. Include details about free shipping, mention Autumn arrivals..."
                      className="w-full bg-surface border border-text/10 rounded-lg p-2 text-xs font-sans tracking-wide shadow-recessed outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Email Subject line (if email channel selected) */}
                {selectedChannel === "email" && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="ENTER EMAIL SUBJECT LINE..."
                      className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono tracking-wider shadow-recessed outline-none focus:border-primary"
                    />
                  </div>
                )}

                {/* Message body textarea */}
                <div className="space-y-1">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">
                    {selectedChannel === "email" ? "Email Body Content" : "Message Template Content"}
                  </label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={selectedChannel === "email" ? "ENTER EMAIL BODY. USE {{customer_name}} AS A PERSONALIZED VARIABLE..." : "ENTER MESSAGE TEMPLATE. USE {{customer_name}} AS A PERSONALIZED VARIABLE..."}
                    rows={6}
                    className="w-full bg-surface border border-text/10 rounded-lg p-3 text-xs font-sans tracking-wide shadow-recessed outline-none focus:border-primary leading-relaxed font-medium"
                  />
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted pt-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>The variable <code className="bg-text/5 font-mono px-1 rounded">{"{{customer_name}}"}</code> will be substituted per recipient at dispatch time.</span>
                  </div>
                </div>
                  
                  <div className="flex justify-between items-center border-t border-text/5 pt-4 mt-6">
                  <Button variant="default" size="sm" onClick={() => setStep(3)} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                    Back
                  </Button>
                  
                  <div className="flex items-center gap-3">
                    <Button variant="default" size="sm" disabled={sendingCampaign} onClick={() => handleSendCampaign("scheduled")}>
                      <Calendar className="w-4 h-4 mr-1" /> Schedule
                    </Button>
                    <Button variant="success" disabled={sendingCampaign} onClick={() => handleSendCampaign("running")}>
                      <Send className="w-4 h-4 mr-1 animate-pulse" /> Dispatch Now
                    </Button>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Quick Preview Card */}
          <div className="lg:col-span-5">
            <Card>
              <CardHeader className="border-b border-text/10 pb-4">
                <CardTitle className="uppercase tracking-widest text-xs font-bold">
                  Live Dispatch Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                  Simulated phone client render:
                </div>
                          {/* Simulated Phone screen / Email preview */}
                <div className="bg-surface border border-text/10 p-4 rounded-xl shadow-recessed relative">
                  {selectedChannel === "email" ? (
                    <div className="space-y-3 font-sans text-xs">
                      {/* Email Headers */}
                      <div className="border-b border-text/5 pb-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[9px] text-text-muted">
                          <span>From: newsletter@xeno.in</span>
                          <span>11:34 AM</span>
                        </div>
                        <div className="text-[10px] font-medium text-text">
                          To: <span className="text-text-muted">aarav.sharma@gmail.com</span>
                        </div>
                        <div className="text-[11px] font-bold text-primary flex items-start gap-1">
                          <span className="text-[9px] text-text-muted uppercase font-mono shrink-0 pt-0.5">Subject:</span>
                          <span>{emailSubject || "Exclusive Offer"}</span>
                        </div>
                      </div>
                      
                      {/* Email Body */}
                      <div className="text-text-muted leading-relaxed whitespace-pre-wrap pt-1 min-h-[80px]">
                        {messageText ? (
                          messageText.replace(/\{\{\s*customer_name\s*\}\}/g, "Aarav Sharma")
                        ) : (
                          <span className="italic text-text-muted">Template body empty...</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 border-b border-text/5 pb-2.5 mb-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-[9px]">X</div>
                        <div>
                          <div className="font-sans font-bold text-[10px] leading-tight">XENO BRAND DISPATCH</div>
                          <div className="font-mono text-[8px] text-text-muted uppercase tracking-wider">via {selectedChannel}</div>
                        </div>
                      </div>
     
                      {/* SMS/WhatsApp style message bubble */}
                      <div className="bg-[#DCF8C6]/15 border border-[#DCF8C6]/50 rounded-lg p-3 max-w-[85%] font-sans text-xs leading-relaxed text-text shadow-extruded">
                        {messageText ? (
                          messageText.replace(/\{\{\s*customer_name\s*\}\}/g, "Aarav Sharma")
                        ) : (
                          <span className="italic text-text-muted">Template empty...</span>
                        )}
                        <div className="text-right text-[8px] text-text-muted mt-1">11:34 AM</div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wraps campaign creation wizard inside Suspense.
 *
 * @returns React page element
 */
export default function NewCampaignPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center min-h-[300px] font-mono text-xs text-text-muted animate-pulse">
        LOADING CAMPAIGN BUILDER...
      </div>
    }>
      <NewCampaignPageContent />
    </Suspense>
  );
}
