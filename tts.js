const fs = require("fs");
const path = require("path");

let tts = null;
let loadingPromise = null;

// =================================
// LOAD KOKORO
// =================================

async function loadTTS() {
  // Already loaded
  if (tts) {
    return tts;
  }

  // Already loading — wait for the same promise
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log("🔊 Loading Kokoro TTS...");

    const { KokoroTTS } = await import("kokoro-js");

    const model = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      {
        dtype: "q8",
        device: "cpu"
      }
    );

    tts = model;

    console.log("✅ Kokoro TTS loaded");

    return tts;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

// =================================
// GENERATE SPEECH
// =================================

async function generateSpeech(text) {
  if (!text || !text.trim()) {
    throw new Error("No text provided for TTS");
  }

  const model = await loadTTS();

  console.log("🔊 Generating speech...");

  const audio = await model.generate(text, {
    voice: "af_heart"
  });

  const outputDir = path.join(
    __dirname,
    "public",
    "audio"
  );

  fs.mkdirSync(outputDir, {
    recursive: true
  });

  const filename = `chairman-${Date.now()}.wav`;

  const filePath = path.join(
    outputDir,
    filename
  );

  audio.save(filePath);

  console.log("✅ Audio saved:", filename);

  return `/audio/${filename}`;
}

// =================================
// EXPORTS
// =================================

module.exports = {
  loadTTS,
  generateSpeech
};