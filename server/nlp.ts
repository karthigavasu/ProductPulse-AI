import type {
  FeedbackCategory,
  FeedbackItem,
  SentimentLabel,
} from '../src/types/productpulse.js';

const POSITIVE_WORDS = new Set([
  'love',
  'great',
  'awesome',
  'fast',
  'intuitive',
  'clean',
  'helpful',
  'smooth',
  'reliable',
  'easy',
  'clear',
  'excellent',
  'useful',
  'improved',
  'accurate',
  'seamless',
  'responsive',
  'delightful',
  'saved',
  'efficient',
  'best',
  'good',
  'solid',
  'fantastic',
]);

const NEGATIVE_WORDS = new Set([
  'slow',
  'bug',
  'broken',
  'crash',
  'crashes',
  'confusing',
  'hard',
  'difficult',
  'error',
  'errors',
  'fail',
  'failed',
  'failing',
  'lag',
  'laggy',
  'freeze',
  'freezes',
  'timeout',
  'missing',
  'frustrating',
  'clunky',
  'unclear',
  'bad',
  'worst',
  'terrible',
  'stuck',
  'unable',
  'impossible',
  'bloated',
  'delay',
  'delayed',
  'inconsistent',
  'unusable',
]);

const NEGATIONS = new Set(['not', 'never', "don't", 'doesnt', "doesn't", 'no', 'hardly', 'barely', "can't", 'cannot', "won't"]);
const INTENSIFIERS = new Set(['very', 'extremely', 'super', 'really', 'highly', 'completely', 'totally', 'quite']);

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'was',
  'were', 'are', 'but', 'not', 'you', 'your', 'our', 'we', 'they', 'their',
  'can', 'could', 'would', 'should', 'when', 'where', 'what', 'which', 'who',
  'how', 'all', 'any', 'into', 'out', 'about', 'after', 'before', 'more',
  'less', 'very', 'just', 'like', 'some', 'such', 'than', 'then', 'there',
  'these', 'those', 'will', 'also', 'been', 'being', 'over', 'under', 'only',
  'need', 'want', 'make', 'makes', 'using', 'used', 'user', 'users', 'page',
  'app', 'product', 'feature', 'time', 'much', 'many',
]);

const TOPIC_RULES: Array<{ topic: string; category: FeedbackCategory; terms: string[] }> = [
  {
    topic: 'Performance & Latency',
    category: 'Performance Issues',
    terms: ['slow', 'latency', 'lag', 'laggy', 'timeout', 'load', 'loading', 'freeze', 'memory', 'speed', 'render', 'seconds'],
  },
  {
    topic: 'Bugs & Reliability',
    category: 'Bug Reports',
    terms: ['bug', 'crash', 'crashes', 'error', 'errors', 'broken', 'fail', 'failed', '500', 'exception', 'blank', 'stuck'],
  },
  {
    topic: 'UX & Navigation',
    category: 'Usability Issues',
    terms: ['confusing', 'ux', 'ui', 'navigation', 'onboarding', 'clunky', 'unclear', 'find', 'layout', 'mobile', 'accessible', 'contrast'],
  },
  {
    topic: 'Integrations & Export',
    category: 'Feature Requests',
    terms: ['csv', 'export', 'webhook', 'slack', 'jira', 'api', 'sso', 'saml', 'integration', 'sync', 'import', 'pdf'],
  },
  {
    topic: 'Analytics & Reporting',
    category: 'Feature Requests',
    terms: ['cohort', 'funnel', 'retention', 'chart', 'filter', 'dashboard', 'report', 'segment', 'breakdown', 'date'],
  },
  {
    topic: 'Collaboration & Permissions',
    category: 'General Suggestions',
    terms: ['team', 'role', 'permission', 'share', 'comment', 'notification', 'workspace', 'audit', 'admin'],
  },
];

export interface LocalNlpResult {
  sentiment: SentimentLabel;
  sentimentScore: number;
  confidence: number;
  keywords: string[];
  topics: string[];
  suggestedCategory: FeedbackCategory;
  explanation: string;
}

export function analyzeFeedbackLocal(
  title: string,
  content: string,
  rating?: number
): LocalNlpResult {
  const combined = `${title} ${content}`.toLowerCase();
  const tokens = combined
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let rawScore = 0;
  const matchedPos: string[] = [];
  const matchedNeg: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : '';
    const prev2 = i > 1 ? tokens[i - 2] : '';
    const negated = NEGATIONS.has(prev) || NEGATIONS.has(prev2);
    const boosted = INTENSIFIERS.has(prev) ? 1.5 : 1.0;

    if (POSITIVE_WORDS.has(token)) {
      if (negated) {
        rawScore -= 1 * boosted;
        matchedNeg.push(`${prev} ${token}`.trim());
      } else {
        rawScore += 1 * boosted;
        matchedPos.push(token);
      }
    } else if (NEGATIVE_WORDS.has(token)) {
      if (negated) {
        rawScore += 0.6 * boosted;
        matchedPos.push(`${prev} ${token}`.trim());
      } else {
        rawScore -= 1 * boosted;
        matchedNeg.push(token);
      }
    }
  }

  // Factor explicit numeric rating lightly when text is very short
  let ratingSignal = 0;
  if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
    ratingSignal = (rating - 3) * 0.25;
  }

  const lexicalScore =
    tokens.length > 0 ? rawScore / Math.max(3, Math.sqrt(tokens.length)) : 0;
  const combinedScore = Math.max(-1, Math.min(1, lexicalScore + ratingSignal));
  const roundedScore = Number(combinedScore.toFixed(3));

  let sentiment: SentimentLabel = 'neutral';
  if (roundedScore >= 0.15) sentiment = 'positive';
  else if (roundedScore <= -0.15) sentiment = 'negative';

  // Keyword frequency extraction
  const freq = new Map<string, number>();
  for (const token of tokens) {
    if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  const keywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([word]) => word);

  // Topic & category classification
  const topicMatches: Array<{ topic: string; category: FeedbackCategory; hits: string[] }> = [];
  for (const rule of TOPIC_RULES) {
    const hits = rule.terms.filter((t) => tokens.includes(t));
    if (hits.length > 0) {
      topicMatches.push({ topic: rule.topic, category: rule.category, hits });
    }
  }
  topicMatches.sort((a, b) => b.hits.length - a.hits.length);

  const topics =
    topicMatches.length > 0
      ? topicMatches.slice(0, 3).map((m) => m.topic)
      : ['General Product Feedback'];

  let suggestedCategory: FeedbackCategory = 'General Suggestions';
  if (topicMatches.length > 0) {
    suggestedCategory = topicMatches[0].category;
  } else if (/\b(add|support|allow|please build|wish|request|would love)\b/.test(combined)) {
    suggestedCategory = 'Feature Requests';
  }

  const signalCount = matchedPos.length + matchedNeg.length;
  const confidence = Number(
    Math.min(0.95, 0.48 + signalCount * 0.09 + (topicMatches.length > 0 ? 0.12 : 0)).toFixed(2)
  );

  const explanationParts: string[] = [
    `Local lexicon engine scored ${roundedScore} (${sentiment}).`,
  ];
  if (matchedPos.length > 0) {
    explanationParts.push(`Positive signals: ${Array.from(new Set(matchedPos)).slice(0, 4).join(', ')}.`);
  }
  if (matchedNeg.length > 0) {
    explanationParts.push(`Negative signals: ${Array.from(new Set(matchedNeg)).slice(0, 4).join(', ')}.`);
  }
  if (topicMatches.length > 0) {
    explanationParts.push(
      `Topic rules matched "${topicMatches[0].topic}" via terms [${topicMatches[0].hits.slice(0, 3).join(', ')}].`
    );
  }
  if (typeof rating === 'number') {
    explanationParts.push(`Rating (${rating}/5) contributed a ${ratingSignal >= 0 ? '+' : ''}${ratingSignal.toFixed(2)} prior.`);
  }
  explanationParts.push('Note: Automated NLP inference; validate against customer context.');

  return {
    sentiment,
    sentimentScore: roundedScore,
    confidence,
    keywords,
    topics,
    suggestedCategory,
    explanation: explanationParts.join(' '),
  };
}

export interface RecurringComplaintCluster {
  topic: string;
  count: number;
  avgRating: number;
  topKeywords: string[];
  sampleTitles: string[];
}

export function detectRecurringComplaints(
  items: FeedbackItem[]
): RecurringComplaintCluster[] {
  const negativeOrIssueItems = items.filter(
    (item) =>
      item.sentiment === 'negative' ||
      item.category === 'Bug Reports' ||
      item.category === 'Performance Issues' ||
      item.category === 'Usability Issues'
  );

  const groups = new Map<string, FeedbackItem[]>();
  for (const item of negativeOrIssueItems) {
    const primaryTopic = item.topics[0] ?? item.category;
    const list = groups.get(primaryTopic) ?? [];
    list.push(item);
    groups.set(primaryTopic, list);
  }

  return Array.from(groups.entries())
    .map(([topic, group]) => {
      const kwFreq = new Map<string, number>();
      let ratingSum = 0;
      for (const item of group) {
        ratingSum += item.rating;
        for (const kw of item.keywords) {
          kwFreq.set(kw, (kwFreq.get(kw) ?? 0) + 1);
        }
      }
      const topKeywords = Array.from(kwFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k]) => k);

      return {
        topic,
        count: group.length,
        avgRating: Number((ratingSum / group.length).toFixed(2)),
        topKeywords,
        sampleTitles: group.slice(0, 3).map((g) => g.title),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function summarizeFeedbackLocal(items: FeedbackItem[]): {
  method: 'local-nlp';
  summary: string;
  topFeatureRequests: string[];
  recurringComplaints: RecurringComplaintCluster[];
} {
  if (items.length === 0) {
    return {
      method: 'local-nlp',
      summary: 'No feedback items match the current filter selection.',
      topFeatureRequests: [],
      recurringComplaints: [],
    };
  }

  const pos = items.filter((i) => i.sentiment === 'positive').length;
  const neu = items.filter((i) => i.sentiment === 'neutral').length;
  const neg = items.filter((i) => i.sentiment === 'negative').length;
  const avgRating =
    items.reduce((acc, i) => acc + i.rating, 0) / items.length;

  const recurringComplaints = detectRecurringComplaints(items);
  const topFeatureRequests = items
    .filter((i) => i.category === 'Feature Requests')
    .slice(0, 5)
    .map((i) => i.title);

  const topClusterText =
    recurringComplaints.length > 0
      ? `The largest issue cluster is "${recurringComplaints[0].topic}" (${recurringComplaints[0].count} items, avg rating ${recurringComplaints[0].avgRating}/5).`
      : 'No recurring negative clusters were detected.';

  return {
    method: 'local-nlp',
    summary: `Analyzed ${items.length} feedback items using the local deterministic NLP engine (average rating ${avgRating.toFixed(
      2
    )}/5). Sentiment distribution: ${pos} positive, ${neu} neutral, ${neg} negative. ${topClusterText} Treat automated sentiment/topic tags as triage aids rather than verified customer intent.`,
    topFeatureRequests,
    recurringComplaints,
  };
}
