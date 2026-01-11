import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.use(cors());
app.use(express.json());

// TEST SERVER
app.get('/', (req, res) => {
  res.send('Groq AI Server OK 🚀');
});

// CHATBOT ENDPOINT
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: 'Pesan kosong' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah Asisten Siaga Bencana BPBD Kabupaten Sukabumi. Jawab singkat, jelas, dan edukatif dalam Bahasa Indonesia.',
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content;

    if (!reply) {
      return res.status(500).json({ error: 'AI tidak merespon' });
    }

    res.json({ reply });
  } catch (error) {
    console.error('SERVER ERROR:', error);
    res.status(500).json({ error: 'Gagal memproses AI' });
  }
});

// RUN SERVER
app.listen(PORT, () => {
  console.log(`✅ Groq AI backend aktif di http://localhost:${PORT}`);
});
