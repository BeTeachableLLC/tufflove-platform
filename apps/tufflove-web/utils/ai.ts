import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummary(text: string) {
  if (!text) return "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert business assistant. Summarize the user's meeting notes into a concise paragraph, followed by a bulleted list of Action Items."
        },
        { role: "user", content: text },
      ],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error);
    return "Summary could not be generated.";
  }
}
