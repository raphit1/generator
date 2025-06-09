import { Client, GatewayIntentBits, Events } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const HF_TOKEN = process.env.HF_TOKEN;
const CHANNEL_ID = '1381587397724340365';  // Ton salon Discord

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ],
});

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.channel.id !== CHANNEL_ID || message.author.bot) return;

  if (message.content.startsWith('!image ')) {
    const prompt = message.content.slice(7).trim();
    if (!prompt) return message.channel.send('❌ Merci de fournir un texte après !image');

    await message.channel.send(`🎨 Génération de l'image pour : "${prompt}" ...`);

    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return message.channel.send(`❌ Erreur API : ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await message.channel.send({
        content: `🖼️ Image générée pour : **${prompt}**`,
        files: [{ attachment: buffer, name: 'image.png' }],
      });
    } catch (error) {
      console.error(error);
      message.channel.send('🚫 Une erreur est survenue lors de la génération.');
    }
  }
});

client.login(TOKEN);
