import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  EmbedBuilder
} from 'discord.js';
import fetch from 'node-fetch';

const TOKEN = process.env.DISCORD_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !UNSPLASH_ACCESS_KEY || !CHANNEL_ID) {
  console.error('❌ Variables d\'environnement manquantes (DISCORD_TOKEN, UNSPLASH_ACCESS_KEY, CHANNEL_ID)');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

async function searchUnsplashImages(query, per_page = 3, page = 1) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${per_page}&page=${page}&client_id=${UNSPLASH_ACCESS_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

async function getRandomImages(per_page = 3) {
  // Unsplash ne propose pas d'endpoint "random multiple" directement
  // On fait une recherche aléatoire sur un mot-clé large et on shuffle les résultats

  const broadKeywords = ['nature', 'landscape', 'animal', 'city', 'travel', 'mountain'];
  const randomKeyword = broadKeywords[Math.floor(Math.random() * broadKeywords.length)];
  const images = await searchUnsplashImages(randomKeyword, 30, 1); // récupère 30 images max
  if (images.length === 0) return [];
  // shuffle et prend per_page images
  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }
  return images.slice(0, per_page);
}

function createEmbedsFromImages(images, prompt) {
  return images.map(img => new EmbedBuilder()
    .setTitle(`Image pour : ${prompt}`)
    .setURL(img.links.html)
    .setImage(img.urls.regular)
    .setFooter({ text: `Photographe: ${img.user.name}` }));
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  let channel;
  try {
    channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Salon introuvable avec cet ID:', CHANNEL_ID);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Erreur lors de la récupération du salon:', err);
    process.exit(1);
  }

  const btnRandom = new ButtonBuilder()
    .setCustomId('generate_random')
    .setLabel('🎲 Générer image aléatoire')
    .setStyle(ButtonStyle.Success);

  const btnKeyword = new ButtonBuilder()
    .setCustomId('generate_keyword')
    .setLabel('🔍 Générer par mot-clé')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btnRandom, btnKeyword);

  await channel.send({
    content: 'Choisis une option pour générer des images :',
    components: [row]
  });
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'generate_random') {
      await interaction.deferReply();
      try {
        const images = await getRandomImages(3);
        if (images.length === 0) {
          return interaction.editReply('❌ Pas d\'images aléatoires trouvées, réessaie.');
        }

        const embeds = createEmbedsFromImages(images, 'aléatoire');
        const regenerateBtn = new ButtonBuilder()
          .setCustomId('regenerate_random')
          .setLabel('🔄 Régénérer aléatoire')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(regenerateBtn);

        await interaction.editReply({ embeds, components: [row] });

        // Nouveau message avec boutons de génération
        const channel = await client.channels.fetch(CHANNEL_ID);
        const btnRandom = new ButtonBuilder()
          .setCustomId('generate_random')
          .setLabel('🎲 Générer image aléatoire')
          .setStyle(ButtonStyle.Success);

        const btnKeyword = new ButtonBuilder()
          .setCustomId('generate_keyword')
          .setLabel('🔍 Générer par mot-clé')
          .setStyle(ButtonStyle.Primary);

        const newRow = new ActionRowBuilder().addComponents(btnRandom, btnKeyword);

        await channel.send({
          content: 'Tu veux une autre image ? Choisis ci-dessous :',
          components: [newRow]
        });

      } catch (error) {
        console.error(error);
        await interaction.editReply('❌ Erreur lors de la génération aléatoire.');
      }
    }

    if (interaction.customId === 'generate_keyword') {
      const modal = new ModalBuilder()
        .setCustomId('keyword_modal')
        .setTitle('Générer image par mot-clé');

      const input = new TextInputBuilder()
        .setCustomId('keyword_input')
        .setLabel('Entre un mot-clé')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('ex: chat, désert, galaxie');

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('regenerate_')) {
      await interaction.deferUpdate();

      const suffix = interaction.customId.replace('regenerate_', '');

      try {
        if (suffix === 'random') {
          const images = await getRandomImages(3);
          if (images.length === 0) {
            return interaction.followUp({ content: '❌ Pas d\'images aléatoires trouvées.', ephemeral: true });
          }
          const embeds = createEmbedsFromImages(images, 'aléatoire');
          const btn = new ButtonBuilder()
            .setCustomId('regenerate_random')
            .setLabel('🔄 Régénérer aléatoire')
            .setStyle(ButtonStyle.Secondary);
          const row = new ActionRowBuilder().addComponents(btn);

          await interaction.message.edit({ embeds, components: [row] });

        } else {
          const prompt = suffix;
          const images = await searchUnsplashImages(prompt, 3);
          if (images.length === 0) {
            return interaction.followUp({ content: `❌ Aucune image trouvée pour : **${prompt}**`, ephemeral: true });
          }
          const embeds = createEmbedsFromImages(images, prompt);
          const btn = new ButtonBuilder()
            .setCustomId(`regenerate_${prompt}`)
            .setLabel('🔄 Régénérer')
            .setStyle(ButtonStyle.Secondary);
          const row = new ActionRowBuilder().addComponents(btn);

          await interaction.message.edit({ embeds, components: [row] });
        }

      } catch (error) {
        console.error(error);
        await interaction.followUp({ content: '❌ Erreur lors de la régénération.', ephemeral: true });
      }
    }
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'keyword_modal') {
    const prompt = interaction.fields.getTextInputValue('keyword_input').trim();
    await interaction.deferReply();

    try {
      const images = await searchUnsplashImages(prompt, 3);
      if (images.length === 0) {
        return interaction.editReply(`❌ Aucune image trouvée pour : **${prompt}**`);
      }

      const embeds = createEmbedsFromImages(images, prompt);

      const regenerateBtn = new ButtonBuilder()
        .setCustomId(`regenerate_${prompt}`)
        .setLabel('🔄 Régénérer')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(regenerateBtn);

      await interaction.editReply({ embeds, components: [row] });

    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Erreur lors de la recherche d\'images.');
    }
  }
});

client.login(TOKEN);
