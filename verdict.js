require("dotenv").config();

const OpenAI = require("openai");

// =================================
// HUGGING FACE CLIENT
// =================================

const hf = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN
});

// =================================
// ALL AVAILABLE COUNCIL MODELS
// USER CAN CHOOSE ANY 4
// =================================

const DEFAULT_MODELS = [

  // ===============================
  // CURRENT MODELS
  // ===============================

  "meta-llama/Llama-3.1-8B-Instruct:novita",

  "deepseek-ai/DeepSeek-V3.1:novita",

  "openai/gpt-oss-120b:groq",

  "google/gemma-3-12b-it:deepinfra",

  // ===============================
  // ADDITIONAL MODELS
  // ===============================

  "Qwen/Qwen3-235B-A22B-Instruct-2507",

  "moonshotai/Kimi-K2-Instruct",

  "mistralai/Mistral-Large-3-675B-Instruct-2512",

  "moonshotai/Kimi-K2-Instruct-0905"

];

// =================================
// CHAIRMAN MODEL
// =================================

const CHAIRMAN_MODEL =
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16:featherless-ai";

// =================================
// MAX MODELS PER VERDICT
// =================================

const MAX_COUNCIL_MODELS = 4;

// =================================
// ASK COUNCIL MODEL
// =================================

async function askModel(model, question) {

  const startTime = Date.now();

  try {

    console.log(
      `🧠 Starting model: ${model}`
    );

    const completion =
      await hf.chat.completions.create({

        model,

        messages: [

          {
            role: "system",

            content: `
You are an independent member of an AI decision council.

Analyze the user's question independently.

Your analysis will be given to a Chairman AI that will compare your reasoning with other council members.

Do NOT try to predict what other models will say.

Focus on:

- facts and evidence
- assumptions
- benefits
- risks
- trade-offs
- practical consequences
- alternative perspectives
- missing information

If the question involves law, policy, science, finance, medicine, or another specialized field, distinguish established facts from uncertainty.

Do not simply answer yes or no.

Provide clear reasoning that another AI can critically evaluate.
`
          },

          {
            role: "user",
            content: question
          }

        ],

        temperature: 0.4,

        max_tokens: 1000

      });

    // =================================
    // EXTRACT RESPONSE
    // =================================

    let answer =
      completion.choices?.[0]?.message?.content ||
      completion.choices?.[0]?.text ||
      "";

    // Handle array content
    if (Array.isArray(answer)) {

      answer =
        answer
          .map(part => {

            if (typeof part === "string") {
              return part;
            }

            return (
              part?.text ||
              part?.content ||
              ""
            );

          })
          .join("\n");

    }

    answer =
      String(answer || "").trim();

    const responseTime =
      Date.now() - startTime;

    console.log(
      `✅ ${model} completed in ${responseTime} ms`
    );

    return {

      model,

      responseTime,

      success: true,

      result: {

        answer,

        key_points: []

      }

    };

  } catch (error) {

    const responseTime =
      Date.now() - startTime;

    console.error(
      `❌ ${model} failed:`,
      error.message
    );

    return {

      model,

      responseTime,

      success: false,

      error:
        error.message,

      result: {

        answer: "",

        key_points: []

      }

    };

  }

}

// =================================
// EXTRACT CHAIRMAN TEXT
// =================================

function extractModelText(completion) {

  const choice =
    completion?.choices?.[0];

  if (!choice) {
    return "";
  }

  const message =
    choice.message || {};

  // ---------------------------------
  // NORMAL CONTENT
  // ---------------------------------

  if (
    typeof message.content === "string" &&
    message.content.trim()
  ) {

    return message.content.trim();

  }

  // ---------------------------------
  // ARRAY CONTENT
  // ---------------------------------

  if (
    Array.isArray(message.content)
  ) {

    const text =
      message.content
        .map(part => {

          if (
            typeof part === "string"
          ) {

            return part;

          }

          return (
            part?.text ||
            part?.content ||
            ""
          );

        })
        .join("\n")
        .trim();

    if (text) {
      return text;
    }

  }

  // ---------------------------------
  // REASONING CONTENT
  // ---------------------------------

  if (
    typeof message.reasoning_content === "string" &&
    message.reasoning_content.trim()
  ) {

    return (
      message.reasoning_content.trim()
    );

  }

  // ---------------------------------
  // REASONING
  // ---------------------------------

  if (
    typeof message.reasoning === "string" &&
    message.reasoning.trim()
  ) {

    return (
      message.reasoning.trim()
    );

  }

  // ---------------------------------
  // CHOICE TEXT
  // ---------------------------------

  if (
    typeof choice.text === "string" &&
    choice.text.trim()
  ) {

    return choice.text.trim();

  }

  // ---------------------------------
  // CHOICE REASONING
  // ---------------------------------

  if (
    typeof choice.reasoning === "string" &&
    choice.reasoning.trim()
  ) {

    return choice.reasoning.trim();

  }

  return "";

}

// =================================
// CHAIRMAN
// =================================

async function chairman(
  question,
  councilResults
) {

  const startTime =
    Date.now();

  try {

    console.log(
      "\n🧑‍⚖️ Chairman analyzing council..."
    );

    // =================================
    // SUCCESSFUL RESPONSES
    // =================================

    const successful =
      councilResults.filter(
        item =>
          item.success &&
          item.result?.answer &&
          item.result.answer.trim()
      );

    if (!successful.length) {

      throw new Error(
        "No usable council responses"
      );

    }

    console.log(
      `🧑‍⚖️ Chairman received ${successful.length} council responses`
    );

    // =================================
    // BUILD COUNCIL TEXT
    // =================================

    const councilText =
      successful
        .map((item, index) => {

          return `
==============================
COUNCIL MEMBER ${index + 1}
MODEL: ${item.model}
==============================

${item.result.answer}

`;

        })
        .join("\n");

    // =================================
    // CHAIRMAN PROMPT
    // =================================

    const chairmanPrompt = `

You are the Chairman of an AI decision-making council.

USER QUESTION:

${question}

Below are independent analyses from several council members.

${councilText}

==================================================
YOUR RESPONSIBILITY
==================================================

You are NOT a simple summarizer.

You must critically compare the council members.

Do not use majority voting.

A position supported by more models is NOT automatically correct.

Evaluate the actual quality of each argument.

==================================================
ANALYZE THE COUNCIL
==================================================

1. AGREEMENTS

Identify important points that multiple council members genuinely agree on.

Do not invent agreements.

If there are no meaningful agreements, say:

None identified.

2. DISAGREEMENTS

Identify meaningful differences between council members.

Look for differences in:

- conclusions
- assumptions
- interpretation of evidence
- risks
- priorities
- trade-offs
- proposed solutions

When possible, mention which models hold the different positions.

Do not invent disagreements.

3. CRITICAL FACTOR

Identify the single most important factor affecting the answer.

4. STRONGEST ARGUMENT

Identify the strongest argument presented by any council member.

Explain why it matters.

5. OVERLOOKED FACTOR

Identify something important that the council failed to adequately consider.

Do not invent an obscure issue simply to fill this section.

6. FINAL VERDICT

Give a direct answer to the user's question.

The verdict must follow from the reasoning.

Do not simply repeat the most common opinion.

7. CONFIDENCE

Give a confidence level from 0 to 100.

Confidence should depend on:

- quality of reasoning
- consistency between models
- evidence available
- uncertainty
- missing information

Do NOT automatically use 50.

8. WHAT WOULD CHANGE YOUR MIND

Identify specific evidence or information that could materially change the verdict.

==================================================
SPECIALIZED TOPICS
==================================================

If the question involves:

- law
- finance
- medicine
- politics
- science
- regulation

distinguish established facts from uncertain claims.

Do not present uncertain claims as established facts.

==================================================
OUTPUT FORMAT
==================================================

Return ONLY the following sections.

SUMMARY:
[Your synthesis]

AGREEMENTS:
- [Agreement 1]
- [Agreement 2]

DISAGREEMENTS:
- [Disagreement 1]
- [Disagreement 2]

CRITICAL FACTOR:
[Most important factor]

STRONGEST ARGUMENT:
[Strongest argument and why]

OVERLOOKED FACTOR:
[Important overlooked consideration]

VERDICT:
[Direct answer to the user's question]

CONFIDENCE:
[Number from 0 to 100]

WHAT WOULD CHANGE MY MIND:
[Specific information that could change the verdict]

Do not return JSON.

Do not use markdown code fences.
`;

    // =================================
    // CALL CHAIRMAN
    // =================================

    console.log(
      "🧑‍⚖️ Sending council analysis to Chairman..."
    );

    const completion =
      await hf.chat.completions.create({

        model:
          CHAIRMAN_MODEL,

        messages: [

          {
            role: "system",

            content: `
You are the Chairman of an AI Council.

You receive multiple independent AI analyses.

Your job is to critically compare them and produce the final structured analysis.

Follow the requested output format exactly.

Do not output JSON.
`
          },

          {
            role: "user",

            content:
              chairmanPrompt
          }

        ],

        temperature: 0.2,

        max_tokens: 1600

      });

    // =================================
    // DEBUG RAW RESPONSE
    // =================================

    console.log(
      "\n🧑‍⚖️ RAW CHAIRMAN RESPONSE:"
    );

    console.log(
      JSON.stringify(
        completion,
        null,
        2
      )
    );

    // =================================
    // EXTRACT RESPONSE
    // =================================

    const raw =
      extractModelText(
        completion
      );

    console.log(
      "\n🧑‍⚖️ CHAIRMAN OUTPUT:"
    );

    console.log(
      raw
    );

    // =================================
    // EMPTY RESPONSE
    // =================================

    if (!raw.trim()) {

      throw new Error(
        "Chairman returned an empty response"
      );

    }

    // =================================
    // SECTION PARSER
    // =================================

    function extractSection(
      text,
      sectionName,
      nextSections
    ) {

      const normalized =
        text
          .replace(
            /\r\n/g,
            "\n"
          )
          .trim();

      const start =
        normalized.indexOf(
          sectionName
        );

      if (
        start === -1
      ) {

        return "";

      }

      const contentStart =
        start +
        sectionName.length;

      let end =
        normalized.length;

      for (
        const nextSection of nextSections
      ) {

        const nextIndex =
          normalized.indexOf(
            nextSection,
            contentStart
          );

        if (
          nextIndex !== -1 &&
          nextIndex < end
        ) {

          end =
            nextIndex;

        }

      }

      return normalized
        .substring(
          contentStart,
          end
        )
        .trim();

    }

    // =================================
    // SECTION NAMES
    // =================================

    const sections = [

      "SUMMARY:",

      "AGREEMENTS:",

      "DISAGREEMENTS:",

      "CRITICAL FACTOR:",

      "STRONGEST ARGUMENT:",

      "OVERLOOKED FACTOR:",

      "VERDICT:",

      "CONFIDENCE:",

      "WHAT WOULD CHANGE MY MIND:"

    ];

    // =================================
    // EXTRACT SECTIONS
    // =================================

    const summary =
      extractSection(
        raw,
        "SUMMARY:",
        sections.slice(1)
      );

    const agreementsText =
      extractSection(
        raw,
        "AGREEMENTS:",
        sections.slice(2)
      );

    const disagreementsText =
      extractSection(
        raw,
        "DISAGREEMENTS:",
        sections.slice(3)
      );

    const criticalFactor =
      extractSection(
        raw,
        "CRITICAL FACTOR:",
        sections.slice(4)
      );

    const strongestArgument =
      extractSection(
        raw,
        "STRONGEST ARGUMENT:",
        sections.slice(5)
      );

    const overlookedFactor =
      extractSection(
        raw,
        "OVERLOOKED FACTOR:",
        sections.slice(6)
      );

    const verdict =
      extractSection(
        raw,
        "VERDICT:",
        sections.slice(7)
      );

    const confidenceText =
      extractSection(
        raw,
        "CONFIDENCE:",
        sections.slice(8)
      );

    const whatWouldChange =
      extractSection(
        raw,
        "WHAT WOULD CHANGE MY MIND:",
        []
      );

    // =================================
    // BULLET LIST PARSER
    // =================================

    function parseBulletList(text) {

      if (!text) {
        return [];
      }

      return text
        .split("\n")
        .map(
          line =>
            line
              .replace(
                /^\s*[-*•]\s*/,
                ""
              )
              .trim()
        )
        .filter(Boolean);

    }

    const agreements =
      parseBulletList(
        agreementsText
      );

    const disagreements =
      parseBulletList(
        disagreementsText
      );

    // =================================
    // CONFIDENCE
    // =================================

    const confidenceMatch =
      confidenceText.match(
        /\b(?:100|[1-9]?\d)\b/
      );

    let confidence =
      confidenceMatch
        ? Number(
            confidenceMatch[0]
          )
        : 50;

    confidence =
      Math.max(
        0,
        Math.min(
          100,
          confidence
        )
      );

    // =================================
    // FALLBACKS
    // =================================

    const finalSummary =
      summary ||
      raw;

    const finalVerdict =
      verdict ||
      raw;

    // =================================
    // RESPONSE TIME
    // =================================

    const responseTime =
      Date.now() -
      startTime;

    console.log(
      `🧑‍⚖️ Chairman completed in ${responseTime} ms`
    );

    // =================================
    // RETURN
    // =================================

    return {

      model:
        CHAIRMAN_MODEL,

      responseTime,

      success: true,

      result: {

        summary:
          finalSummary,

        agreements,

        disagreements,

        critical_factor:
          criticalFactor,

        strongest_argument:
          strongestArgument,

        overlooked_factor:
          overlookedFactor,

        verdict:
          finalVerdict,

        confidence,

        what_would_change_my_mind:
          whatWouldChange

      }

    };

  } catch (error) {

    const responseTime =
      Date.now() -
      startTime;

    console.error(
      "❌ Chairman failed:",
      error.message
    );

    return {

      model:
        CHAIRMAN_MODEL,

      responseTime,

      success: false,

      error:
        error.message,

      result: {

        summary:
          "The Chairman could not complete the analysis.",

        agreements: [],

        disagreements: [],

        critical_factor: "",

        strongest_argument: "",

        overlooked_factor: "",

        verdict:
          "Unable to generate a final verdict.",

        confidence: 0,

        what_would_change_my_mind:
          ""

      }

    };

  }

}

// =================================
// RUN VERDICT
// =================================

async function runVerdict(
  question,
  selectedModels = null
) {

  const totalStartTime =
    Date.now();

  console.log(
    "\n================================="
  );

  console.log(
    "⚡ AI COUNCIL VERDICT"
  );

  console.log(
    "================================="
  );

  // =================================
  // VALIDATE QUESTION
  // =================================

  if (
    !question ||
    !question.trim()
  ) {

    throw new Error(
      "Question is required"
    );

  }

  // =================================
  // SELECT MODELS
  // =================================

  let models;

  if (
    Array.isArray(selectedModels) &&
    selectedModels.length > 0
  ) {

    models =
      [
        ...new Set(

          selectedModels

            .filter(
              model =>
                typeof model === "string" &&
                model.trim()
            )

            .map(
              model =>
                model.trim()
            )

        )
      ]
      .slice(
        0,
        MAX_COUNCIL_MODELS
      );

  } else {

    // IMPORTANT:
    // If frontend sends no selection,
    // use first 4 models.

    models =
      DEFAULT_MODELS.slice(
        0,
        MAX_COUNCIL_MODELS
      );

  }

  // =================================
  // VALIDATE MODELS
  // =================================

  if (
    !models.length
  ) {

    throw new Error(
      "At least one council model is required"
    );

  }

  console.log(
    `🧠 Council models selected: ${models.length}`
  );

  models.forEach(
    (model, index) => {

      console.log(
        `   ${index + 1}. ${model}`
      );

    }
  );

  // =================================
  // RUN COUNCIL IN PARALLEL
  // =================================

  const councilStartTime =
    Date.now();

  const councilResults =
    await Promise.all(

      models.map(
        model =>
          askModel(
            model,
            question
          )
      )

    );

  const councilTime =
    Date.now() -
    councilStartTime;

  // =================================
  // SUCCESS COUNT
  // =================================

  const successfulCount =
    councilResults.filter(
      result =>
        result.success &&
        result.result?.answer
    ).length;

  console.log(
    `⚡ Council completed in ${councilTime} ms`
  );

  console.log(
    `✅ ${successfulCount}/${models.length} models succeeded`
  );

  if (
    successfulCount === 0
  ) {

    throw new Error(
      "All council models failed"
    );

  }

  // =================================
  // CHAIRMAN
  // =================================

  const chairmanStartTime =
    Date.now();

  const chairmanResult =
    await chairman(
      question,
      councilResults
    );

  const chairmanTime =
    Date.now() -
    chairmanStartTime;

  // =================================
  // TOTAL TIME
  // =================================

  const totalTime =
    Date.now() -
    totalStartTime;

  console.log(
    `🧑‍⚖️ Chairman time: ${chairmanTime} ms`
  );

  console.log(
    `🏁 Total time: ${totalTime} ms`
  );

  console.log(
    "=================================\n"
  );

  // =================================
  // RETURN
  // =================================

  return {

    question,

    selectedModels:
      models,

    council:
      councilResults,

    chairman:
      chairmanResult,

    timing: {

      councilTime,

      chairmanTime,

      totalTime

    }

  };

}

// =================================
// EXPORTS
// =================================

module.exports = {

  runVerdict,

  askModel,

  chairman,

  DEFAULT_MODELS,

  CHAIRMAN_MODEL

};