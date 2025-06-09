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
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const RANDOM_BASE_KEYWORD = 'nature'; // mot clé large pour images aléatoires
const MAX_PIXABAY_RESULTS = 200;

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 5000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function searchPixabayImages(query, per_page = 3, offset = 0) {
  try {
    const page = Math.floor(offset / per_page) + 1;
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${per_page}&page=${page}`;
    console.log("Appel Pixabay URL:", url);

    const res = await fetchWithTimeout(url, { timeout: 7000 });
    console.log("Status Pixabay:", res.status);

    if (!res.ok) throw new Error(`Pixabay API error: ${res.status}`);

    const data = await res.json();
    console.log("Pixabay data hits:", data.hits.length);
    return data.hits || [];
  } catch(e) {
    console.error("Erreur fetch Pixabay:", e);
    return [];
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getRandomOffset(maxResults, per_page) {
  if (maxResults <= per_page) return 0;
  return Math.floor(Math.random() * Math.floor(maxResults / per_page)) * per_page;
}

async function getRandomImages(per_page = 3) {
  try {
    // Première requête pour connaître totalHits
    const urlTotal = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(RANDOM_BASE_KEYWORD)}&image_type=photo&per_page=3&page=1`;
    console.log("Appel Pixabay totalHits URL:", urlTotal);

    const resTotal = await fetchWithTimeout(urlTotal, { timeout: 7000 });
    if (!resTotal.ok) throw new Error(`Pixabay API error: ${resTotal.status}`);
    const dataTotal = await resTotal.json();
    const totalHits = Math.min(dataTotal.totalHits, MAX_PIXABAY_RESULTS);

    const offset = getRandomOffset(totalHits, per_page);
    console.log(`totalHits: ${totalHits}, offset choisi: ${offset}`);

    const images = await searchPixabayImages(RANDOM_BASE_KEYWORD, per_page, offset);
    return images;
  } catch(e) {
    console.error("Erreur getRandomImages:", e);
    return [];
  }
}

async function createEmbedsFromImages(images, prompt) {
  return images.map(img => new EmbedBuilder()
    .setTitle(`Image pour : ${prompt}`)
    .setURL(img.pageURL)
    .setImage(img.largeImageURL)
    .setFooter({ text: `Photographe: ${img.user}` }));
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.error('Salon introuvable');

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

  } catch(e) {
    console.error("Erreur au démarrage :", e);
  }
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

        const embeds = await createEmbedsFromImages(images, 'aléatoire');
        const regenerateBtn = new ButtonBuilder()
          .setCustomId('regenerate_random')
          .setLabel('🔄 Régénérer aléatoire')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(regenerateBtn);

        await interaction.editReply({ embeds, components: [row] });

        // Nouveau message avec boutons
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
          const embeds = await createEmbedsFromImages(images, 'aléatoire');
          const btn = new ButtonBuilder()
            .setCustomId('regenerate_random')
            .setLabel('🔄 Régénérer aléatoire')
            .setStyle(ButtonStyle.Secondary);
          const row = new ActionRowBuilder().addComponents(btn);

          await interaction.message.edit({ embeds, components: [row] });

        } else {
          const prompt = suffix;
          const images = await searchPixabayImages(prompt, 3);
          if (images.length === 0) {
            return interaction.followUp({ content: `❌ Aucune image trouvée pour : **${prompt}**`, ephemeral: true });
          }
          const embeds = await createEmbedsFromImages(images, prompt);
          const btn = new ButtonBuilder()
            .setCustomId(`regenerate_${prompt}`)
            .setLabel('🔄 Régénérer`)
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
      const images = await searchPixabayImages(prompt, 3);
      if (images.length === 0) {
        return interaction.editReply(`❌ Aucune image trouvée pour : **${prompt}**`);
      }

      const embeds = await createEmbedsFromImages(images, prompt);
      const btn = new ButtonBuilder()
        .setCustomId(`regenerate_${prompt}`)
        .setLabel('🔄 Régénérer')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(btn);

      await interaction.editReply({ embeds, components: [row] });

      // Nouveau message avec boutons
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
      await interaction.editReply('❌ Erreur lors de la recherche d\'images.');
    }
  }
});

client.login(TOKEN);
