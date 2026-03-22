import { ChatPromptTemplate } from '@langchain/core/prompts';

export const scriptJsonPromptTemplate = ChatPromptTemplate.fromMessages([
  ['system', '{systemPrompt}'],
  ['human', '{userMessage}'],
]);

export const scriptSimplePromptTemplate = ChatPromptTemplate.fromMessages([['human', '{prompt}']]);
