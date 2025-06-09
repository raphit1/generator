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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const keywords = ['nature', 'city', 'mountain', 'ocean', 'forest', 'space', 'animal'];

async function fetchRandomImage(keyword) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unsplash API error ${res.status}`);
  const data = await res.json();
  if (!data.results.length) return null;
  // Choix aléatoire dans les résultats
  const image = data.results[Math.floor(Math.random() * data.results.length)];
  return image;
}

function createEmbed(image, keyword) {
  return new EmbedBuilder()
    .setTitle(`Image pour : ${keyword}`)
    .setURL(image.links.html)
    .setImage(image.urls.regular)
    .setFooter({ text: `Photographe : ${image.user.name}` });
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);

  const btnRandom = new ButtonBuilder()
    .setCustomId('random_image')
    .setLabel('🎲 Image aléatoire')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btnRandom);

  await channel.send({ content: 'Clique sur le bouton pour recevoir une image aléatoire.', components: [row] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'random_image' || interaction.customId.startsWith('regenerate_')) {
    await interaction.deferReply();

    // Si c'est régénérer, on récupère le keyword, sinon on en choisit un nouveau
    const keyword = interaction.customId.startsWith('regenerate_') 
      ? interaction.customId.replace('regenerate_', '') 
      : keywords[Math.floor(Math.random() * keywords.length)];

    try {
      const image = await fetchRandomImage(keyword);
      if (!image) {
        return interaction.editReply(`❌ Pas d'image trouvée pour : ${keyword}`);
      }

      const embed = createEmbed(image, keyword);

      const btnRegenerate = new ButtonBuilder()
        .setCustomId(`regenerate_${keyword}`)
        .setLabel('🔄 Régénérer')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(btnRegenerate);

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Une erreur est survenue lors de la récupération de l\'image.');
    }
  }
});

client.login(TOKEN);
