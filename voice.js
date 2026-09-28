require("dotenv").config();

async function transcribeAudio(audioBuffer) {
  try {
    console.log("🎤 Sending audio directly to Hugging Face...");

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "audio/webm",
        },

        body: audioBuffer,
      }
    );

    const data = await response.json();

    console.log("🤗 HF status:", response.status);
    console.log("📝 HF response:", data);

    if (!response.ok) {
      throw new Error(
        data.error ||
        `Hugging Face request failed with status ${response.status}`
      );
    }

    return data;

  } catch (error) {
    console.error("❌ Whisper error:", error);
    throw error;
  }
}

module.exports = {
  transcribeAudio,
};