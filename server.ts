import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Flight Search
  app.post('/api/search', async (req, res) => {
    try {
      const { origin, destination, departureDate, returnDate, passengers } = req.body;
      
      const prompt = `Simulate a flight search for ${passengers} passenger(s) from ${origin} to ${destination}. 
Departure Date: ${departureDate}
${returnDate ? `Return Date: ${returnDate}` : 'One Way'}

Provide realistic flight options from Brazilian airlines (Azul, GOL, LATAM). 
For each flight, provide a price in Reais (BRL) and a price in the airline's frequent flyer program miles (TudoAzul, Smiles, LATAM Pass).
Generate 6 to 10 flight options varying by airline, departure times, and direct vs connecting flights.`;

      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            airline: { type: Type.STRING, description: "Azul, GOL, or LATAM" },
            flightNumber: { type: Type.STRING },
            departureTime: { type: Type.STRING, description: "ISO 8601 format time or HH:mm" },
            arrivalTime: { type: Type.STRING, description: "ISO 8601 format time or HH:mm" },
            duration: { type: Type.STRING, description: "e.g., '2h 30m'" },
            stops: { type: Type.INTEGER, description: "0 for direct, 1+ for connections" },
            priceBRL: { type: Type.NUMBER },
            priceMiles: { type: Type.NUMBER },
            milesProgram: { type: Type.STRING, description: "TudoAzul, Smiles, or LATAM Pass" },
            isReturn: { type: Type.BOOLEAN, description: "True if this is part of the return trip." }
          },
          required: ["id", "airline", "flightNumber", "departureTime", "arrivalTime", "duration", "stops", "priceBRL", "priceMiles", "milesProgram", "isReturn"]
        }
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.7,
        }
      });

      const data = JSON.parse(response.text || '[]');
      res.json(data);
    } catch (error) {
      console.error("Search API Error:", error);
      res.status(500).json({ error: "Failed to perform flight search" });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
