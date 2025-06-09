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
  ComponentType
} from 'discord.js';
import fetch from 'node-fetch';

const TOKEN = process.env.DISCORD_TOKEN;
const HF_TOKEN = process.env.HF_TOKEN;
const CHANNEL_ID = '1381587397724340365';

const HF_API_URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Fonction pour générer l'image via HF API
async function generateImage(prompt) {
  const res = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: prompt })
  });

  if (res.status === 503) {
    throw new Error('Le serveur est occupé, réessaie dans quelques instants.');
  }

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Erreur API Hugging Face: ${res.status} ${errTxt}`);
  }

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.error('Salon introuvable');

    const button = new ButtonBuilder()
      .setCustomId('open_modal')
      .setLabel('🎨 Générer une image')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({
      content: 'Clique pour décrire ton image IA 👇',
      components: [row]
    });

  } catch (error) {
    console.error('Erreur lors du fetch du salon :', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  // Ouvrir modal
  if (interaction.isButton() && interaction.customId === 'open_modal') {
    const modal = new ModalBuilder()
      .setCustomId('prompt_modal')
      .setTitle('Génération d\'image IA');

    const input = new TextInputBuilder()
      .setCustomId('prompt_input')
      .setLabel('Décris ton image')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Ex: un chat en armure dans un désert');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // Soumission modal + génération + décompte + bouton régénérer
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'prompt_modal') {
    const prompt = interaction.fields.getTextInputValue('prompt_input');
    await interaction.deferReply();

    try {
      // Envoi message initial avec compte à rebours
      let countdown = 5;
      const countdownMessage = await interaction.editReply(`⏳ Génération dans ${countdown} secondes...`);

      // Décompte
      const interval = setInterval(async () => {
        countdown--;
        if (countdown > 0) {
          await interaction.editReply(`⏳ Génération dans ${countdown} secondes...`);
        } else {
          clearInterval(interval);

          // Génération de l'image
          try {
            const imageBuffer = await generateImage(prompt);

            // Bouton régénérer
            const regenButton = new ButtonBuilder()
              .setCustomId(`regen_${Date.now()}`) // id unique
              .setLabel('🔄 Regénérer')
              .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(regenButton);

            await interaction.editReply({
              content: `🖼️ Image générée pour : **${prompt}**`,
              files: [{ attachment: imageBuffer, name: 'image.png' }],
              components: [row]
            });

          } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Une erreur est survenue lors de la génération.');
          }
        }
      }, 1000);

    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Une erreur est survenue.');
    }
  }

  // Gestion du clic sur bouton "Regénérer"
  if (interaction.isButton() && interaction.customId.startsWith('regen_')) {
    await interaction.deferReply();

    // On récupère le message d'origine pour extraire le prompt
    const message = interaction.message;
    const content = message.content || '';
    const promptMatch = content.match(/\*\*(.+)\*\*/); // Cherche le texte entre ** **

    if (!promptMatch) {
      return interaction.editReply('❌ Impossible de récupérer le prompt.');
    }

    const prompt = promptMatch[1];

    try {
      // Même décompte que précédemment
      let countdown = 5;
      await interaction.editReply(`⏳ Regénération dans ${countdown} secondes...`);

      const interval = setInterval(async () => {
        countdown--;
        if (countdown > 0) {
          await interaction.editReply(`⏳ Regénération dans ${countdown} secondes...`);
        } else {
          clearInterval(interval);

          try {
            const imageBuffer = await generateImage(prompt);

            const regenButton = new ButtonBuilder()
              .setCustomId(`regen_${Date.now()}`)
              .setLabel('🔄 Regénérer')
              .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(regenButton);

            await interaction.editReply({
              content: `🖼️ Image régénérée pour : **${prompt}**`,
              files: [{ attachment: imageBuffer, name: 'image.png' }],
              components: [row]
            });
          } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Une erreur est survenue lors de la régénération.');
          }
        }
      }, 1000);

    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Une erreur est survenue.');
    }
  }
});

client.login(TOKEN);
