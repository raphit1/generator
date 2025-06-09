import 'dotenv/config';
import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const TOKEN = process.env.DISCORD_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !UNSPLASH_ACCESS_KEY || !CHANNEL_ID) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function fetchRandomImages() {
  const keywords = ['nature', 'city', 'animal', 'mountain', 'ocean', 'travel'];
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];

  const url = `https://api.unsplash.com/search/photos?query=${keyword}&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Erreur API Unsplash:', res.status);
    return [];
  }
  const data = await res.json();
  if (!data.results || data.results.length === 0) return [];

  // Shuffle
  for (let i = data.results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data.results[i], data.results[j]] = [data.results[j], data.results[i]];
  }

  return data.results.slice(0, 3);
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) throw new Error('Salon introuvable');

    const button = new ButtonBuilder()
      .setCustomId('random_image')
      .setLabel('🎲 Générer image aléatoire')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({ content: 'Clique sur le bouton pour générer des images aléatoires Unsplash !', components: [row] });
  } catch (e) {
    console.error('Erreur au démarrage:', e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'random_image') return;

  await interaction.deferReply();

  try {
    const images = await fetchRandomImages();
    if (images.length === 0) return interaction.editReply('❌ Pas d\'images trouvées.');

    const embeds = images.map(img =>
      new EmbedBuilder()
        .setTitle('Image aléatoire Unsplash')
        .setURL(img.links.html)
        .setImage(img.urls.regular)
        .setFooter({ text: `Photographe : ${img.user.name}` })
    );

    await interaction.editReply({ embeds });
  } catch (e) {
    console.error('Erreur lors de la génération :', e);
    await interaction.editReply('❌ Une erreur est survenue.');
  }
});

client.login(TOKEN);
