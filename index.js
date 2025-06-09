import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType
} from 'discord.js';
import fetch from 'node-fetch';

const TOKEN = process.env.DISCORD_TOKEN;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const CHANNEL_ID = '1381587397724340365';

// Remplace ceci par l'ID exact du modèle Replicate (voir ci-dessous)
const MODEL_VERSION = 'db21e45a8b7e6612b8c3a96ccf5e146758a52f9c7acfa3f89448f6e8bcd3e365';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return console.error('Salon introuvable');

  const messages = await channel.messages.fetch({ limit: 10 });
  if (!messages.some(m => m.author.id === client.user.id)) {
    const button = new ButtonBuilder()
      .setCustomId('open_modal')
      .setLabel('🎨 Générer une image')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({
      content: 'Clique pour décrire ton image IA 👇',
      components: [row]
    });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId === 'open_modal') {
    const modal = new ModalBuilder()
      .setCustomId('prompt_modal')
      .setTitle('Génération d\'image IA');

    const input = new TextInputBuilder()
      .setCustomId('prompt_input')
      .setLabel('Décris ton image')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Ex: Chat samouraï sur une moto en feu');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'prompt_modal') {
    const prompt = interaction.fields.getTextInputValue('prompt_input');
    await interaction.deferReply();

    const countdown = await interaction.channel.send('⏳ Génération : 30s...');
    let seconds = 30;
    const interval = setInterval(() => {
      seconds -= 5;
      if (seconds > 0) countdown.edit(`⏳ Génération : ${seconds}s...`);
    }, 5000);

    try {
      // Lancement de la génération
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: MODEL_VERSION,
          input: { prompt }
        })
      });

      const prediction = await res.json();
      if (!prediction || !prediction.urls || !prediction.urls.get) {
        throw new Error('Prediction API call failed');
      }

      // Attente de la génération
      let output = null;
      let status = prediction.status;
      const start = Date.now();

      while (!output && (Date.now() - start) < 60000) {
        const poll = await fetch(prediction.urls.get, {
          headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` }
        });
        const data = await poll.json();

        status = data.status;
        if (status === 'succeeded') {
          output = data.output;
        } else if (status === 'failed') {
          throw new Error('La génération a échoué.');
        }

        if (!output) await new Promise(r => setTimeout(r, 2000));
      }

      clearInterval(interval);
      await countdown.delete();

      if (!output || !output.length) {
        return await interaction.editReply('❌ Aucun résultat généré.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🖼️ Image générée')
        .setDescription(`Prompt : **${prompt}**`)
        .setImage(output[output.length - 1])
        .setColor('Blue');

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Erreur Replicate:', err);
      clearInterval(interval);
      await interaction.editReply('❌ Une erreur est survenue pendant la génération.');
    }
  }
});

client.login(TOKEN);
