require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const { runVerdict } = require("./verdict");
const { transcribeAudio } = require("./voice");
const { loadTTS, generateSpeech } = require("./tts");

const app = express();

const PORT = Number(process.env.PORT) || 4000;

// =====================================================
// API KEYS
// =====================================================
//
// Add this to .env:
//
// API_KEYS=your-secret-key
//
// Multiple keys:
// API_KEYS=key1,key2,key3
//

const API_KEYS = new Set(
  (process.env.API_KEYS || "")
    .split(",")
    .map(key => key.trim())
    .filter(Boolean)
);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(express.static("public"));

// =====================================================
// REQUEST ID
// =====================================================

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader(
    "X-Request-ID",
    requestId
  );

  next();
});

// =====================================================
// API KEY AUTH
// =====================================================

function requireApiKey(req, res, next) {

  if (API_KEYS.size === 0) {

    return res.status(503).json({
      success: false,
      error: "API is not configured. Add API_KEYS to .env.",
      requestId: req.requestId
    });

  }

  const bearerToken =
    (req.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();

  const apiKey =
    req.get("x-api-key") ||
    bearerToken;

  if (
    !apiKey ||
    !API_KEYS.has(apiKey)
  ) {

    return res.status(401).json({
      success: false,
      error: "Invalid or missing API key",
      requestId: req.requestId
    });

  }

  next();
}

// =====================================================
// HEALTH
// =====================================================

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    service: "AI Council",
    status: "online",
    version: "1.0.0",
    requestId: req.requestId
  });

});

// =====================================================
// API INFORMATION
// =====================================================

app.get("/api/v1", (req, res) => {

  res.json({

    success: true,

    name: "AI Council API",

    version: "v1",

    description:
      "Multi-model reasoning followed by Chairman synthesis.",

    authentication:
      "x-api-key or Authorization: Bearer <API_KEY>",

    limits: {
      maxCouncilModels: 4,
      maxQuestionLength: 3000
    },

    endpoints: {

      verdict: {
        method: "POST",
        path: "/api/v1/verdict"
      },

      health: {
        method: "GET",
        path: "/api/health"
      }

    }

  });

});

// =====================================================
// AI COUNCIL API
// =====================================================
//
// POST /api/v1/verdict
//
// Headers:
//
// x-api-key: YOUR_API_KEY
//
// Body:
//
// {
//   "question": "Should I build this startup?",
//   "models": [
//      "...",
//      "..."
//   ]
// }
//
// =====================================================

app.post(
  "/api/v1/verdict",
  requireApiKey,
  async (req, res) => {

    const startedAt = Date.now();

    try {

      const {
        question,
        models
      } = req.body || {};

      // -----------------------------------------------
      // QUESTION VALIDATION
      // -----------------------------------------------

      if (
        typeof question !== "string" ||
        !question.trim()
      ) {

        return res.status(400).json({

          success: false,

          error:
            "question must be a non-empty string",

          requestId:
            req.requestId

        });

      }

      if (question.length > 3000) {

        return res.status(400).json({

          success: false,

          error:
            "question must be 3000 characters or less",

          requestId:
            req.requestId

        });

      }

      // -----------------------------------------------
      // MODEL VALIDATION
      // -----------------------------------------------

      if (
        models !== undefined &&
        !Array.isArray(models)
      ) {

        return res.status(400).json({

          success: false,

          error:
            "models must be an array",

          requestId:
            req.requestId

        });

      }

      // Maximum 4 council models
      const selectedModels =
        Array.isArray(models)
          ? models.slice(0, 4)
          : undefined;

      console.log("");
      console.log("=================================");
      console.log("⚡ AI COUNCIL API REQUEST");
      console.log("=================================");
      console.log(
        "Request ID:",
        req.requestId
      );
      console.log(
        "Question:",
        question.trim()
      );
      console.log(
        "Models:",
        selectedModels || "DEFAULT"
      );
      console.log("=================================");

      // -----------------------------------------------
      // RUN AI COUNCIL
      // -----------------------------------------------

      const result = await runVerdict(
        question.trim(),
        selectedModels
      );

      // -----------------------------------------------
      // RESPONSE
      // -----------------------------------------------

      res.json({

        success: true,

        requestId:
          req.requestId,

        apiVersion: "v1",

        ...result,

        apiResponseTime:
          Date.now() - startedAt

      });

    }

    catch (error) {

      console.error(
        `❌ API verdict [${req.requestId}]`,
        error
      );

      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Internal server error",

        requestId:
          req.requestId

      });

    }

  }
);

// =====================================================
// EXISTING FRONTEND VERDICT ROUTE
// =====================================================
//
// DO NOT REMOVE THIS.
// Your current frontend uses this.
//
// =====================================================

app.post(
  "/api/verdict",
  async (req, res) => {

    try {

      const {
        question,
        models
      } = req.body || {};

      if (
        !question ||
        !question.trim()
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Question is required"

        });

      }

      const result =
        await runVerdict(
          question.trim(),
          models
        );

      res.json({

        success: true,

        ...result

      });

    }

    catch (error) {

      console.error(
        "❌ Verdict error:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Verdict failed"

      });

    }

  }
);

// =====================================================
// VOICE TRANSCRIPTION
// =====================================================

app.post(
  "/api/transcribe",
  async (req, res) => {

    try {

      const chunks = [];

      req.on(
        "data",
        chunk => {
          chunks.push(chunk);
        }
      );

      req.on(
        "end",
        async () => {

          try {

            const audioBuffer =
              Buffer.concat(chunks);

            if (!audioBuffer.length) {

              return res.status(400).json({

                success: false,

                error:
                  "No audio received"

              });

            }

            const result =
              await transcribeAudio(
                audioBuffer
              );

            res.json({

              success: true,

              text:
                result.text

            });

          }

          catch (error) {

            console.error(
              "❌ Transcription error:",
              error
            );

            res.status(500).json({

              success: false,

              error:
                error.message

            });

          }

        }
      );

    }

    catch (error) {

      res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);

// =====================================================
// TEXT TO SPEECH
// =====================================================

app.post(
  "/api/tts",
  async (req, res) => {

    try {

      const {
        text
      } = req.body || {};

      if (
        !text ||
        !text.trim()
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Text is required"

        });

      }

      const startTime =
        Date.now();

      const audioUrl =
        await generateSpeech(
          text.trim()
        );

      res.json({

        success: true,

        audioUrl,

        responseTime:
          Date.now() - startTime

      });

    }

    catch (error) {

      console.error(
        "❌ TTS error:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);

// =====================================================
// 404
// =====================================================

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      error:
        "Endpoint not found",

      path:
        req.path,

      requestId:
        req.requestId

    });

  }
);

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "❌ Unhandled server error:",
      error
    );

    res.status(500).json({

      success: false,

      error:
        "Internal server error",

      requestId:
        req.requestId

    });

  }
);

// =====================================================
// TTS PRELOAD
// =====================================================

console.log(
  "🔊 Starting TTS preload..."
);

loadTTS()
  .then(() => {

    console.log(
      "✅ TTS ready for requests"
    );

  })
  .catch(error => {

    console.error(
      "❌ TTS preload failed:",
      error
    );

  });

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {

    console.log("");
    console.log("=================================");
    console.log("🧑‍⚖️ AI COUNCIL API");
    console.log("=================================");

    console.log(
      `🚀 Server: http://localhost:${PORT}`
    );

    console.log(
      `⚡ API:    POST /api/v1/verdict`
    );

    console.log(
      `📖 Info:   GET  /api/v1`
    );

    console.log(
      `❤️ Health: GET  /api/health`
    );

    console.log(
      `🔐 Keys:   ${API_KEYS.size} configured`
    );

    console.log("=================================");
    console.log("");

  }
);