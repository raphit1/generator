import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
} from 'discord.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const TOKEN = process.env.TOKEN; // ✅ Correction ici
const CHANNEL_ID = '1381587397724340365';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  if (channel) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('generate_image')
        .setLabel('🎨 Générer une image')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: 'Clique sur le bouton pour générer une image :',
      components: [row],
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.channelId !== CHANNEL_ID) return;

  // Si l'utilisateur clique sur le bouton
  if (interaction.isButton() && interaction.customId === 'generate_image') {
    const modal = new ModalBuilder()
      .setCustomId('image_prompt')
      .setTitle('Générer une image');

    const input = new TextInputBuilder()
      .setCustomId('prompt_input')
      .setLabel('Décris ton image')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('ex: chat astronaute sur la lune')
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  // Si l'utilisateur envoie le prompt
  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === 'image_prompt'
  ) {
    const prompt = interaction.fields.getTextInputValue('prompt_input');

    await interaction.deferReply();

    try {
      const res = await axios.get(
        `https://lexica.art/api/v1/search?q=${encodeURIComponent(prompt)}`
      );
      const images = res.data.images;

      if (!images.length) {
        return interaction.editReply('❌ Aucune image trouvée.');
      }

      const img = images[Math.floor(Math.random() * images.length)];

      await interaction.editReply({
        content: `🖼️ Prompt : **${prompt}**`,
        files: [img.src],
      });
    } catch (err) {
      console.error(err);
      interaction.editReply('🚫 Une erreur est survenue.');
    }
  }
});

client.login(TOKEN);
