import 'dotenv/config';
import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const TOKEN = process.env.DISCORD_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !UNSPLASH_ACCESS_KEY || !CHANNEL_ID) {
  console.error('Variables d\'environnement manquantes');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function getRandomImages(count = 3) {
  // Mots-clés larges pour "random"
  const keywords = ['nature', 'city', 'mountain', 'ocean', 'animal', 'travel'];
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unsplash API error ${res.status}`);

  const data = await res.json();
  const results = data.results || [];

  // Shuffle résultats
  for (let i = results.length -1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [results[i], results[j]] = [results[j], results[i]];
  }

  return results.slice(0, count);
}

function createEmbeds(images, keyword) {
  return images.map(img => new EmbedBuilder()
    .setTitle(`Image : ${keyword}`)
    .setURL(img.links.html)
    .setImage(img.urls.regular)
    .setFooter({ text: `Photographe: ${img.user.name}` }));
}

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) {
    console.error('Salon introuvable');
    process.exit(1);
  }

  const btn = new ButtonBuilder()
    .setCustomId('random_image')
    .setLabel('🎲 Image aléatoire')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btn);

  await channel.send({ content: 'Clique pour générer une image aléatoire', components: [row] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'random_image') {
    await interaction.deferReply();

    try {
      const images = await getRandomImages(3);
      if (images.length === 0) return interaction.editReply('❌ Pas d\'images trouvées.');

      // On prend le mot clé utilisé dans getRandomImages (ici on peut le passer en global)
      // Pour simplifier, on met "aléatoire"
      const embeds = createEmbeds(images, 'aléatoire');

      const btn = new ButtonBuilder()
        .setCustomId('random_image')
        .setLabel('🔄 Régénérer')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(btn);

      await interaction.editReply({ embeds, components: [row] });
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Erreur lors de la récupération des images.');
    }
  }
});

client.login(TOKEN);
