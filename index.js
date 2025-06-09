import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import axios from 'axios';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HF_TOKEN = process.env.HF_TOKEN;

client.on('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!image')) {
    const prompt = message.content.slice(6).trim();
    if (!prompt) return message.reply("❌ Donne un prompt après `!image`.");

    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2',
        { inputs: prompt },
        {
          headers: { Authorization: `Bearer ${HF_TOKEN}` },
          responseType: 'arraybuffer'
        }
      );

      const buffer = Buffer.from(response.data, 'binary');
      await message.reply({ files: [{ attachment: buffer, name: 'image.png' }] });
    } catch (err) {
      console.error(err);
      message.reply("❌ Une erreur s'est produite.");
    }
  }
});

client.login(DISCORD_TOKEN);
