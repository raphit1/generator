import 'dotenv/config';
import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } from 'discord.js';
import axios from 'axios';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

async function fetchImage(query) {
  const response = await axios.get('https://api.unsplash.com/photos/random', {
    params: { query, orientation: 'landscape' },
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
  });
  return response.data.urls.small;
}

client.on('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!image')) {
    const query = message.content.slice(6).trim();
    if (!query) return message.reply("❌ Donne un mot-clé après `!image`.");

    try {
      const imageUrl = await fetchImage(query);

      // Crée un bouton "Nouvelle image"
      const button = new ButtonBuilder()
        .setCustomId(`newimage_${query}`)
        .setLabel('Nouvelle image')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await message.reply({ content: imageUrl, components: [row] });
    } catch (error) {
      console.error(error);
      message.reply("❌ Impossible de récupérer une image.");
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, query] = interaction.customId.split('_');
  if (action === 'newimage') {
    try {
      await interaction.deferUpdate(); // acknowledge button click to avoid "interaction failed"
      const imageUrl = await fetchImage(query);
      await interaction.editReply({ content: imageUrl });
    } catch (error) {
      console.error(error);
      await interaction.followUp({ content: "❌ Impossible de récupérer une nouvelle image.", ephemeral: true });
    }
  }
});

client.login(DISCORD_TOKEN);
