import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Events,
  EmbedBuilder,
} from 'discord.js';
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

const keywords = ['nature', 'city', 'animal', 'mountain', 'ocean', 'travel'];

async function fetchRandomImages(keyword?: string) {
  const finalKeyword = keyword || keywords[Math.floor(Math.random() * keywords.length)];
  const url = `https://api.unsplash.com/search/photos?query=${finalKeyword}&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error('Erreur API Unsplash:', res.status);
    return { images: [], keyword: finalKeyword };
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) return { images: [], keyword: finalKeyword };

  // Shuffle
  for (let i = data.results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data.results[i], data.results[j]] = [data.results[j], data.results[i]];
  }

  return { images: data.results.slice(0, 3), keyword: finalKeyword };
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased()) throw new Error('Salon introuvable ou non textuel');

    // Créer tous les boutons
    const buttons = keywords.map(k =>
      new ButtonBuilder()
        .setCustomId(`keyword_${k}`)
        .setLabel(k.charAt(0).toUpperCase() + k.slice(1))
        .setStyle(ButtonStyle.Secondary)
    );

    const randomButton = new ButtonBuilder()
      .setCustomId('random_image')
      .setLabel('🎲 Aléatoire')
      .setStyle(ButtonStyle.Primary);

    const rows = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(randomButton),
      ...chunk(buttons, 5).map(group => new ActionRowBuilder<ButtonBuilder>().addComponents(...group)),
    ];

    await channel.send({
      content: '📸 Choisis un mot-clé ou clique sur aléatoire pour générer des images Unsplash !',
      components: rows,
    });
  } catch (e) {
    console.error('Erreur au démarrage:', e);
  }
});

// Gestion des interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId } = interaction;
  await interaction.deferReply();

  try {
    let keyword: string | undefined;

    if (customId.startsWith('keyword_')) {
      keyword = customId.split('_')[1];
    } else if (customId === 'random_image') {
      keyword = undefined;
    } else if (customId.startsWith('regen_')) {
      keyword = customId.split('_')[1] || undefined;
    } else {
      return;
    }

    const { images, keyword: usedKeyword } = await fetchRandomImages(keyword);
    if (images.length === 0) return interaction.editReply('❌ Aucune image trouvée.');

    const embeds = images.map(img =>
      new EmbedBuilder()
        .setTitle('Image aléatoire Unsplash')
        .setURL(img.links.html)
        .setImage(img.urls.regular)
        .setFooter({ text: `Photographe : ${img.user.name}` })
    );

    const regenButton = new ButtonBuilder()
      .setCustomId(`regen_${usedKeyword}`)
      .setLabel('🔄 Régénérer')
      .setStyle(ButtonStyle.Success);

    const regenRow = new ActionRowBuilder<ButtonBuilder>().addComponents(regenButton);

    await interaction.editReply({
      content: `Résultats pour le mot-clé : **${usedKeyword}**`,
      embeds,
      components: [regenRow],
    });

  } catch (e) {
    console.error('Erreur lors de la génération :', e);
    await interaction.editReply('❌ Une erreur est survenue.');
  }
});

client.login(TOKEN);

// 🧩 Fonction utilitaire pour grouper les boutons (car Discord limite à 5 par rangée)
function chunk<T>(arr: T[], size: number): T[][] {
  return arr.reduce((acc, _, i) => {
    if (i % size === 0) acc.push(arr.slice(i, i + size));
    return acc;
  }, [] as T[][]);
}
