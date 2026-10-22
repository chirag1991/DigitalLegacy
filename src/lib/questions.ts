export interface InterviewTopic {
  id: string;
  label: string;
  description: string;
  /** Opening questions. The interviewer asks these first, then follows up. */
  seeds: string[];
}

export const TOPICS: InterviewTopic[] = [
  {
    id: "early-life",
    label: "Early life",
    description: "Childhood, home, parents and growing up.",
    seeds: [
      "Where were you born, and what do you remember about the home you grew up in?",
      "What were your parents like? Is there a moment with them that sums them up?",
      "What did a normal day look like when you were about ten years old?",
      "Who was your closest friend as a child, and what did you get up to together?",
    ],
  },
  {
    id: "family",
    label: "Family",
    description: "Partners, children, siblings and the people closest to you.",
    seeds: [
      "Tell me about the people in your family who matter most to you today.",
      "How did you meet your partner, if you have one? What drew you to them?",
      "What do you hope your children or grandchildren remember about you?",
      "Is there a family tradition you've kept alive, or started yourself?",
    ],
  },
  {
    id: "work",
    label: "Work and purpose",
    description: "Career, craft, and what gave your days meaning.",
    seeds: [
      "What was your first real job, and what did it teach you?",
      "What work are you proudest of, and why?",
      "Was there a turning point where your path changed direction?",
    ],
  },
  {
    id: "values",
    label: "Values and beliefs",
    description: "What you believe, what you stand for, and why.",
    seeds: [
      "What are two or three principles you try to live by?",
      "Has there been a belief you held strongly that you later changed your mind about?",
      "What does a good life mean to you?",
    ],
  },
  {
    id: "personality",
    label: "Humor and personality",
    description: "How you talk, joke, and see the world.",
    seeds: [
      "What's a saying or phrase people would instantly recognize as yours?",
      "What always makes you laugh?",
      "How would your closest friend describe you in three words? Would you agree?",
      "What annoys you more than it probably should?",
    ],
  },
  {
    id: "decisions",
    label: "Decisions and hard times",
    description: "Big choices, setbacks, and how you got through them.",
    seeds: [
      "What's the hardest decision you've ever made? How did you make it?",
      "Tell me about a difficult period in your life and what got you through it.",
      "When you're facing a big choice now, what do you usually do first?",
    ],
  },
  {
    id: "favorites",
    label: "Everyday life and favorites",
    description: "Food, music, places, routines and small joys.",
    seeds: [
      "What's a meal that feels like home to you? Who made it?",
      "What music or songs bring back strong memories, and what are they?",
      "Describe your favorite place in the world.",
      "What does your ideal Sunday look like?",
    ],
  },
  {
    id: "wisdom",
    label: "Advice and messages",
    description: "Lessons learned and words for the people you love.",
    seeds: [
      "What advice would you give your younger self?",
      "What do you want your family to know that you might not say often enough?",
      "If one of your grandchildren were going through heartbreak, what would you tell them?",
      "What are you most grateful for?",
    ],
  },
];

export function getTopic(id: string): InterviewTopic | undefined {
  return TOPICS.find((t) => t.id === id);
}
