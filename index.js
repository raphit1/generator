import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Events,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import fetch from 'node-fetch';

// ⚙️ Variables d'environnement
const TOKEN = process.env.DISCORD_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !UNSPLASH_ACCESS_KEY || !CHANNEL_ID) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.log({ TOKEN, UNSPLASH_ACCESS_KEY, CHANNEL_ID }); // Pour debug
  process.exit(1);
}

// 📡 Client avec les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const keywords = ['nature', 'city', 'animal', 'mountain', 'ocean', 'travel'];

// 🔁 Découpe les boutons en groupes de 5
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ⏱️ Fetch avec timeout
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (e) {
    console.error('⛔ Timeout ou fetch échoué :', e);
    throw e;
  }
}

// 📷 Récupère des images aléatoires
async function fetchRandomImages(keyword) {
  const finalKeyword = keyword || keywords[Math.floor(Math.random() * keywords.length)];
  const url = `https://api.unsplash.com/search/photos?query=${finalKeyword}&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    console.error('❌ Erreur API Unsplash:', res.status);
    return { images: [], keyword: finalKeyword };
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) return { images: [], keyword: finalKeyword };

  // Mélange
  for (let i = data.results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data.results[i], data.results[j]] = [data.results[j], data.results[i]];
  }

  return { images: data.results.slice(0, 3), keyword: finalKeyword };
}

// 🎛️ Génère tous les boutons initiaux
function getInteractionRows() {
  const randomButton = new ButtonBuilder()
    .setCustomId('random_image')
    .setLabel('🎲 Aléatoire')
    .setStyle(ButtonStyle.Primary);

  const customSearchButton = new ButtonBuilder()
    .setCustomId('custom_search')
    .setLabel('🔍 Rechercher par mot-clé')
    .setStyle(ButtonStyle.Primary);

  const keywordButtons = keywords.map(k =>
    new ButtonBuilder()
      .setCustomId(`keyword_${k}`)
      .setLabel(k.charAt(0).toUpperCase() + k.slice(1))
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [
    new ActionRowBuilder().addComponents(randomButton, customSearchButton),
    ...chunk(keywordButtons, 5).map(group => new ActionRowBuilder().addComponents(...group)),
  ];

  return rows;
}

// 🔌 Connexion
client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased()) throw new Error('❌ Salon introuvable ou non textuel');

    await channel.send({
      content: '📸 Choisis un mot-clé ou tape le tien pour générer des images depuis Unsplash !',
      components: getInteractionRows(),
    });
  } catch (e) {
    console.error('❌ Erreur au démarrage:', e);
  }
});

// 🎯 Gestion des interactions
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      const { customId } = interaction;

      // 🔍 Recherche personnalisée
      if (customId === 'custom_search') {
        const modal = new ModalBuilder()
          .setCustomId('custom_keyword_modal')
          .setTitle('Recherche personnalisée');

        const input = new TextInputBuilder()
          .setCustomId('custom_keyword_input')
          .setLabel('Quel mot-clé veux-tu rechercher ?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: space, flowers, architecture')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 🔁 Aléatoire ou régénération
      if (
        customId === 'random_image' ||
        customId.startsWith('keyword_') ||
        customId.startsWith('regen_')
      ) {
        await interaction.deferReply();

        let keyword;
        if (customId.startsWith('keyword_') || customId.startsWith('regen_')) {
          keyword = customId.split('_')[1];
        }

        const { images, keyword: usedKeyword } = await fetchRandomImages(keyword);
        if (images.length === 0) {
          await interaction.editReply('❌ Aucune image trouvée.');
          return;
        }

        const embeds = images.map(img =>
          new EmbedBuilder()
            .setTitle('Image Unsplash')
            .setURL(img.links.html)
            .setImage(img.urls.regular)
            .setFooter({ text: `Photographe : ${img.user.name}` })
        );

        const regenButton = new ButtonBuilder()
          .setCustomId(`regen_${usedKeyword}`)
          .setLabel('🔄 Régénérer')
          .setStyle(ButtonStyle.Success);

        const backButton = new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔁 Reproposer')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(regenButton, backButton);

        await interaction.editReply({
          content: `Résultats pour : **${usedKeyword}**`,
          embeds,
          components: [row],
        });
      }

      // ↩️ Retour au menu
      if (customId === 'back_to_menu') {
        await interaction.reply({
          content: '📸 Choisis un mot-clé ou tape le tien pour générer des images depuis Unsplash !',
          components: getInteractionRows(),
          ephemeral: true,
        });
      }
    }

    // 📩 Soumission du modal
    if (interaction.isModalSubmit() && interaction.customId === 'custom_keyword_modal') {
      await interaction.deferReply();
      const userInput = interaction.fields.getTextInputValue('custom_keyword_input');

      const { images, keyword: usedKeyword } = await fetchRandomImages(userInput);
      if (images.length === 0) {
        await interaction.editReply('❌ Aucune image trouvée.');
        return;
      }

      const embeds = images.map(img =>
        new EmbedBuilder()
          .setTitle('Image personnalisée Unsplash')
          .setURL(img.links.html)
          .setImage(img.urls.regular)
          .setFooter({ text: `Photographe : ${img.user.name}` })
      );

      const regenButton = new ButtonBuilder()
        .setCustomId(`regen_${usedKeyword}`)
        .setLabel('🔄 Régénérer')
        .setStyle(ButtonStyle.Success);

      const backButton = new ButtonBuilder()
        .setCustomId('back_to_menu')
        .setLabel('🔁 Reproposer')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(regenButton, backButton);

      await interaction.editReply({
        content: `Résultats pour : **${usedKeyword}**`,
        embeds,
        components: [row],
      });
    }
  } catch (e) {
    console.error('❌ Erreur dans InteractionCreate :', e);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ Une erreur est survenue pendant l\'interaction.');
    } else {
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true,
      });
    }
  }
});

// 🔒 Sécurité & logs
client.on('error', console.error);
process.on('unhandledRejection', (reason) => {
  console.error('❌ Rejection non gérée :', reason);
});

client.login(TOKEN);
