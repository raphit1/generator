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
  InteractionType
} from 'discord.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const HF_TOKEN = process.env.HF_TOKEN;
const CHANNEL_ID = '1381587397724340365';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
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

  if (interaction.isButton() && interaction.customId === 'generate_image') {
    const modal = new ModalBuilder().setCustomId('image_prompt').setTitle('Générer une image');

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

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'image_prompt') {
    const prompt = interaction.fields.getTextInputValue('prompt_input');

    await interaction.deferReply();

    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2',
        {
          inputs: prompt,
        },
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            Accept: 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      const buffer = Buffer.from(response.data, 'binary');

      await interaction.editReply({
        content: `🖼️ Prompt : **${prompt}**`,
        files: [{ attachment: buffer, name: 'image.png' }],
      });
    } catch (err) {
      console.error(err?.response?.data || err);
      interaction.editReply('🚫 Une erreur est survenue pendant la génération de l’image.');
    }
  }
});

client.login(TOKEN);
