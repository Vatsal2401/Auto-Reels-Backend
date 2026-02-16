# Using AI to Get the Best Input for the Remotion Graphic Motion Engine

The graphic motion pipeline turns a **script** and options into a **timeline** that Remotion renders. The more structured and intentional the **input**, the better the output. AI is used in one place to produce that input: **scene planning**.

---

## Flow

1. **Input**: `script` (raw copy or prompt) + `templateStyle`, `format`, etc.
2. **AI (Scene Planner)**: Gemini plans scenes and, when the prompt is followed, returns **Remotion-optimal fields** per scene.
3. **Engines**: Layout, template, rhythm, and transition engines use that plan (and rule-based hints) to build the payload.
4. **Output**: `graphicMotionTimeline` with scenes that have labels, subheadlines, author lines, and template types.

---

## What the AI Should Return (Scene Planner)

The scene planner prompt asks the model to return, **per scene**, optional fields that map directly to Remotion templates:

| Field | Used by | Purpose |
|-------|--------|--------|
| **label** | title-card, feature-highlight | Short uppercase label (e.g. "INTRODUCTION", "FEATURE") |
| **subHeadline** | title-card | One line under the main headline (tagline or clarification) |
| **supportingText** | feature-highlight | One line of supporting copy under the feature statement |
| **authorLine** | quote-card | Speaker or attribution for quote-style scenes |
| **suggestedTemplateType** | template engine | Hint: title-card \| quote-card \| feature-highlight \| impact-full-bleed |

The model still returns **text** (main headline/quote), **sceneType**, **emphasisLevel**, **importanceScore**, and optionally **visualTreatment**. Adding the fields above gives the Remotion engine the right copy for each template slot.

---

## How to Get the Best Results

1. **Write scripts that have clear beats**  
   Short sentences or phrases per “slide” work better than one long paragraph. The AI will split into scenes; clear structure helps it assign labels and template types.

2. **Let the AI suggest template types**  
   When the script has an obvious quote, one-word punch, or intro/cta, the model can set `suggestedTemplateType` and `authorLine` (for quotes). The template engine uses these when not overridden by variety rules (no two consecutive same template).

3. **Use a single, clear script or prompt**  
   One cohesive script (e.g. “Three benefits of X”, “Quote from founder”, “One word CTA”) yields better scene plans than vague or mixed instructions.

4. **Optional: pre-structure for key scenes**  
   If you have a fixed intro/outro, you can still send a script; the AI can set `label: "INTRODUCTION"` / `"CALL TO ACTION"` and appropriate `suggestedTemplateType` for first/last scenes.

---

## Fallbacks

- If **GEMINI_API_KEY** is missing or the call fails, the scene planner falls back to the script processor: scenes get basic `sceneType` and a simple **label** for first/last (e.g. "INTRODUCTION", "CALL TO ACTION").
- If the AI does not return **label** / **subHeadline** / **supportingText** / **authorLine**, the kinetic-typography service still builds a valid timeline using rule-based **deriveLabel** and leaves those slots empty where not provided.
- **suggestedTemplateType** is optional; the template engine chooses a type from content and variety rules when not set.

---

## Summary

**Best input for the Remotion engine** = one clear script plus (optionally) templateStyle/format. The AI scene planner then:

- Splits the script into scenes.
- Optionally fills **label**, **subHeadline**, **supportingText**, **authorLine**, and **suggestedTemplateType** per scene.

That structured plan is passed through enhancement and engines into **graphicMotionTimeline**, so Remotion can render title cards, quote cards, feature highlights, and impact full-bleeds with the right copy in each slot.
