/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InterviewQuestion } from '../types';

export const INTERVIEW_ROLES = [
  'Frontend Developer',
  'Digital Marketing',
  'Data Analyst',
  'Data Scientist',
  'UI/UX Engineer'
] as const;

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 1,
    text: 'Please introduce yourself and explain why this role is a good match for your experience.',
    category: 'Introduction',
    suggestedDuration: 120
  },
  {
    id: 2,
    text: 'Describe one role-relevant problem you solved recently. What approach did you use?',
    category: 'Role Depth',
    suggestedDuration: 120
  },
  {
    id: 3,
    text: 'Tell us about a time you received difficult feedback. How did you respond?',
    category: 'Communication',
    suggestedDuration: 120
  },
  {
    id: 4,
    text: 'How do you decide priorities when quality, time, and stakeholder expectations conflict?',
    category: 'Judgment',
    suggestedDuration: 120
  },
  {
    id: 5,
    text: 'What would you want to improve in your first three months in this position?',
    category: 'Growth',
    suggestedDuration: 120
  }
];

const ROLE_FALLBACK_QUESTIONS: Record<string, string[]> = {
  'Frontend Developer': [
    'Explain your strongest frontend project and the main technologies you used.',
    'How do you manage state, API calls, and error handling in a modern frontend app?',
    'Describe how you would improve performance for a slow React page.',
    'How do you make UI components accessible and responsive across devices?',
    'Tell us about a frontend bug you solved and how you verified the fix.'
  ],
  'Digital Marketing': [
    'Describe a campaign you managed and the channels you used.',
    'How do you decide which audience segment to target for a new product?',
    'Which metrics do you track to judge campaign performance and why?',
    'How would you improve a campaign with high clicks but low conversions?',
    'Tell us about a marketing experiment you ran and what you learned.'
  ],
  'Data Analyst': [
    'Describe a data analysis project where your insight changed a decision.',
    'How do you clean messy data before analysis?',
    'Which SQL or dashboard techniques do you use most often?',
    'How do you validate that your analysis is accurate?',
    'Explain a time you communicated complex data to a non-technical audience.'
  ],
  'Data Scientist': [
    'Describe a machine learning or statistical project you worked on.',
    'How do you choose features and evaluate model performance?',
    'What steps do you take to avoid overfitting or data leakage?',
    'How would you explain a model result to a business stakeholder?',
    'Tell us about a model or analysis that failed and how you improved it.'
  ],
  'UI/UX Engineer': [
    'Walk through a product experience you designed or improved.',
    'How do you turn user research into interface decisions?',
    'How do you balance usability, visual design, and technical constraints?',
    'Describe how you validate a design before handing it to engineering.',
    'Tell us about a UX issue you found and how you measured the improvement.'
  ]
};

export function getRoleFallbackQuestion(role: string, questionNumber: number): InterviewQuestion {
  const text = ROLE_FALLBACK_QUESTIONS[role]?.[questionNumber - 1] || INTERVIEW_QUESTIONS[questionNumber - 1]?.text || INTERVIEW_QUESTIONS[0].text;
  return {
    id: questionNumber,
    text,
    category: `${role} fallback question`,
    suggestedDuration: 120
  };
}
