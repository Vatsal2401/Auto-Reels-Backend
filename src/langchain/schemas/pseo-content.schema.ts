import { z } from 'zod';

// TODO: Define full Zod schemas for all 12 playbook types
// Graduation criteria: withStructuredOutput when 3+ real Gemini outputs validate per schema
export const PseoContentSchema = z.record(z.unknown()); // placeholder
