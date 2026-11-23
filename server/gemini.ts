import { GoogleGenAI, Type } from '@google/genai';
import type {
  Experiment,
  FeedbackCategory,
  FeedbackItem,
  OverviewSummary,
  ProductFeature,
  SentimentLabel,
} from '../src/types/productpulse.js';
import { analyzeFeedbackLocal, summarizeFeedbackLocal } from './nlp.js';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function analyzeFeedbackWithAi(
  title: string,
  content: string,
  rating?: number
): Promise<{
  sentiment: SentimentLabel;
  sentimentScore: number;
  keywords: string[];
  topics: string[];
  suggestedCategory: FeedbackCategory;
  analysisMethod: 'local-nlp' | 'gemini';
  explanation: string;
}> {
  if (!isGeminiConfigured()) {
    const local = analyzeFeedbackLocal(title, content, rating);
    return {
      sentiment: local.sentiment,
      sentimentScore: local.sentimentScore,
      keywords: local.keywords,
      topics: local.topics,
      suggestedCategory: local.suggestedCategory,
      analysisMethod: 'local-nlp',
      explanation: local.explanation,
    };
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze this customer product feedback item.\nTitle: ${title}\nRating: ${rating ?? 'Not provided'}/5\nBody: ${content}`,
    config: {
      systemInstruction:
        'You are a product analytics classifier. Classify sentiment, score (-1 to 1), extract up to 5 concise keywords, identify up to 3 topics, choose the closest category, and write a transparent 1-2 sentence explanation noting which phrases drove the classification. Never invent customer facts beyond the text.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentiment: {
            type: Type.STRING,
            description: 'One of: positive, neutral, negative',
          },
          sentimentScore: {
            type: Type.NUMBER,
            description: 'Float between -1.0 and 1.0',
          },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          suggestedCategory: {
            type: Type.STRING,
            description:
              'One of: Feature Requests, Bug Reports, Usability Issues, Performance Issues, General Suggestions',
          },
          explanation: {
            type: Type.STRING,
          },
        },
        required: [
          'sentiment',
          'sentimentScore',
          'keywords',
          'topics',
          'suggestedCategory',
          'explanation',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    sentiment?: string;
    sentimentScore?: number;
    keywords?: string[];
    topics?: string[];
    suggestedCategory?: string;
    explanation?: string;
  };

  const validSentiments: SentimentLabel[] = ['positive', 'neutral', 'negative'];
  const sentiment: SentimentLabel = validSentiments.includes(
    parsed.sentiment as SentimentLabel
  )
    ? (parsed.sentiment as SentimentLabel)
    : 'neutral';

  const validCategories: FeedbackCategory[] = [
    'Feature Requests',
    'Bug Reports',
    'Usability Issues',
    'Performance Issues',
    'General Suggestions',
  ];
  const suggestedCategory: FeedbackCategory = validCategories.includes(
    parsed.suggestedCategory as FeedbackCategory
  )
    ? (parsed.suggestedCategory as FeedbackCategory)
    : 'General Suggestions';

  return {
    sentiment,
    sentimentScore: Math.max(
      -1,
      Math.min(1, Number(parsed.sentimentScore ?? 0))
    ),
    keywords: (parsed.keywords ?? []).slice(0, 6),
    topics: (parsed.topics ?? []).slice(0, 3),
    suggestedCategory,
    analysisMethod: 'gemini',
    explanation: `${
      parsed.explanation ?? 'Classified by Gemini.'
    } (AI classification is an automated inference, not a verified customer fact.)`,
  };
}

export type AssistantTaskType =
  | 'summarize_feedback'
  | 'explain_analytics'
  | 'suggest_improvements'
  | 'draft_prd'
  | 'generate_user_stories'
  | 'explain_rice'
  | 'summarize_experiment'
  | 'general';

export interface AssistantContext {
  overview: OverviewSummary;
  feedback: FeedbackItem[];
  features: ProductFeature[];
  experiments: Experiment[];
}

export async function runProductAssistant(
  task: AssistantTaskType,
  prompt: string,
  context: AssistantContext
): Promise<{
  mode: 'gemini' | 'local-fallback';
  modelLabel: string;
  answer: string;
}> {
  if (isGeminiConfigured()) {
    const ai = getGeminiClient();
    const compactContext = {
      dataNotice: context.overview.hasSyntheticData
        ? 'Contains synthetic demonstration metrics; distinguish synthetic data from verified customer outcomes.'
        : 'Live workspace data.',
      kpis: context.overview.kpis,
      topFeaturesByRice: [...context.features]
        .sort((a, b) => b.riceScore - a.riceScore)
        .slice(0, 6)
        .map((f) => ({
          title: f.title,
          reach: f.reach,
          impact: f.impact,
          confidence: f.confidence,
          effort: f.effort,
          riceScore: f.riceScore,
          roadmapStatus: f.roadmapStatus,
          manualPriorityOverride: f.manualPriorityOverride,
          overrideReason: f.overrideReason,
        })),
      recentFeedback: context.feedback.slice(0, 12).map((f) => ({
        title: f.title,
        category: f.category,
        sentiment: f.sentiment,
        rating: f.rating,
        topics: f.topics,
      })),
      experiments: context.experiments.map((e) => ({
        name: e.name,
        status: e.status,
        controlRatePct: e.statistics.controlRate,
        variantRatePct: e.statistics.variantRate,
        pValue: e.statistics.pValue,
        sampleAdequate: e.statistics.sampleAdequate,
        isSignificant: e.statistics.isSignificant,
      })),
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Task type: ${task}\nUser request: ${prompt}\n\nWorkspace Context (JSON):\n${JSON.stringify(
        compactContext,
        null,
        2
      )}`,
      config: {
        systemInstruction:
          'You are ProductPulse AI, an analytical Senior Product Manager assistant. Base every metric, RICE score, feedback theme, and experiment statistic strictly on the provided Workspace Context JSON. Never invent customer quotes, research results, or fake metrics. Explicitly note when underlying workspace metrics are synthetic demonstration data.',
      },
    });

    return {
      mode: 'gemini',
      modelLabel: 'Gemini 4 Hydrogen',
      answer: response.text ?? 'No response returned by Gemini.',
    };
  }

  // Transparent Local Fallback Engine
  return {
    mode: 'local-fallback',
    modelLabel: 'Local Analytical Engine (Fallback — no Gemini API key configured)',
    answer: generateLocalAssistantResponse(task, prompt, context),
  };
}

function generateLocalAssistantResponse(
  task: AssistantTaskType,
  prompt: string,
  context: AssistantContext
): string {
  const { overview, feedback, features, experiments } = context;
  const kpis = overview.kpis;
  const sortedFeatures = [...features].sort((a, b) => b.riceScore - a.riceScore);
  const fbSummary = summarizeFeedbackLocal(feedback);

  switch (task) {
    case 'summarize_feedback': {
      const clusters = fbSummary.recurringComplaints
        .slice(0, 3)
        .map(
          (c) =>
            `- **${c.topic}**: ${c.count} items (avg rating ${c.avgRating}/5) — keywords: ${c.topKeywords.join(', ')}`
        )
        .join('\n');
      const requests =
        fbSummary.topFeatureRequests.length > 0
          ? fbSummary.topFeatureRequests.map((r) => `- ${r}`).join('\n')
          : '- No feature requests currently recorded.';
      return `### Customer Feedback Summary (Local NLP Engine)\n\n${fbSummary.summary}\n\n**Top Recurring Issue Clusters:**\n${clusters || '- None detected'}\n\n**Top Feature Requests:**\n${requests}`;
    }

    case 'explain_analytics': {
      return `### Product Analytics Interpretation\n\n*Note: Current metrics include seeded synthetic demonstration records.*\n\n- **Active Users & Stickiness**: ${kpis.activeUsers.toLocaleString()} daily active users out of ${kpis.totalUsers.toLocaleString()} total accounts (DAU/MAU proxy ratio: **${kpis.dauMauRatio}%**).\n- **Retention & Engagement**: Customer retention stands at **${kpis.customerRetention}%** (${overview.deltas.retentionDelta >= 0 ? '+' : ''}${overview.deltas.retentionDelta} pp vs prior window) with an engagement score of **${kpis.productEngagement}/100**.\n- **Adoption & Conversion**: Feature adoption is **${kpis.featureAdoption}%**, trial-to-paid conversion is **${kpis.conversionRate}%**, and CSAT is **${kpis.customerSatisfaction}/5.0**.\n- **Recommended Diagnostic**: Cross-reference the lowest-rated feedback clusters (${fbSummary.recurringComplaints[0]?.topic ?? 'none'}) against retention cohorts before committing engineering capacity.`;
    }

    case 'explain_rice': {
      const top5 = sortedFeatures
        .slice(0, 5)
        .map(
          (f, idx) =>
            `${idx + 1}. **${f.title}** — RICE **${f.riceScore}** = (${f.reach} × ${f.impact} × ${f.confidence}%) / ${f.effort} mo · Status: ${f.roadmapStatus}${
              f.manualPriorityOverride ? ` · Manual Override Rank #${f.manualPriorityOverride} (${f.overrideReason})` : ''
            }`
        )
        .join('\n');
      return `### RICE Prioritization Breakdown\n\nRICE is calculated as \`(Reach × Impact × Confidence%) / Effort\`:\n\n${top5}\n\nHigh-reach, low-effort initiatives surface at the top. Review manual overrides carefully to ensure strategic dependencies are documented with clear rationale.`;
    }

    case 'summarize_experiment': {
      const expLines = experiments
        .map((e) => {
          const sig = e.statistics.sampleAdequate
            ? e.statistics.isSignificant
              ? `Statistically significant (p=${e.statistics.pValue})`
              : `Not significant (p=${e.statistics.pValue})`
            : 'Insufficient sample size for z-test';
          return `- **${e.name}** (${e.status}): Control ${e.statistics.controlRate}% vs Variant ${e.statistics.variantRate}% (Lift ${e.statistics.absoluteLift >= 0 ? '+' : ''}${e.statistics.absoluteLift} pp) — **${sig}**. ${e.statistics.recommendation}`;
        })
        .join('\n');
      return `### Experimentation Summary\n\n${expLines}`;
    }

    case 'draft_prd': {
      const topFeature = sortedFeatures[0];
      const focusTitle = prompt.trim() || topFeature?.title || 'New Product Initiative';
      return `### Draft PRD Outline: ${focusTitle}\n\n**1. Problem Statement**\nCustomer feedback highlights friction around ${fbSummary.recurringComplaints[0]?.topic ?? 'core workflow speed'}. Current adoption stands at ${kpis.featureAdoption}%.\n\n**2. Target Users & JTBD**\n- Primary: Product Managers and Analysts seeking faster triage and measurable roadmap outcomes.\n\n**3. Proposed Scope (MoSCoW)**\n- **Must Have**: Core workflow implementation, input validation, and instrumentation.\n- **Should Have**: CSV/API export and audit log entries.\n- **Could Have**: Automated digest notifications.\n- **Won't Have (v1)**: Custom BI warehouse connectors.\n\n**4. Success Metrics**\n- Target +4 pp lift in feature adoption and measurable reduction in related support tickets, validated via controlled A/B rollout.`;
    }

    case 'generate_user_stories': {
      const subject = prompt.trim() || sortedFeatures[0]?.title || 'Feedback Triage Workflow';
      return `### Generated User Stories for: ${subject}\n\n1. **Story 1 (Core Workflow)**\n   - *As a* Product Manager, *I want* to filter and group customer feedback by topic and sentiment *so that* I can identify recurring pain points in under 5 minutes.\n   - *Acceptance Criteria*: Filter updates table and charts without page reload; sentiment explanation is inspectable for every item.\n\n2. **Story 2 (Prioritization Link)**\n   - *As a* Product Analyst, *I want* to convert a high-volume feedback cluster into a scored RICE proposal *so that* roadmap priorities trace directly to user demand.\n   - *Acceptance Criteria*: RICE score auto-computes on save; audit log records creator and timestamp.`;
    }

    case 'suggest_improvements':
    default: {
      const topComplaint = fbSummary.recurringComplaints[0];
      const topFeature = sortedFeatures[0];
      return `### Product Recommendations (Grounded in Workspace Data)\n\n1. **Address Top Complaint Cluster**: ${
        topComplaint
          ? `"${topComplaint.topic}" accounts for ${topComplaint.count} issue reports (avg rating ${topComplaint.avgRating}/5). Prioritizing fixes here directly protects retention (${kpis.customerRetention}%).`
          : 'Continue monitoring incoming feedback categories.'
      }\n2. **Advance Highest-RICE Proposal**: ${
        topFeature
          ? `"${topFeature.title}" leads with a RICE score of ${topFeature.riceScore} (${topFeature.roadmapStatus}).`
          : 'Add scored feature proposals in the Prioritization Engine.'
      }\n3. **Experimentation Discipline**: Ensure running tests reach adequate sample power before shipping variants.\n\n*Prompt addressed: "${prompt || 'General workspace briefing'}"*`;
    }
  }
}
