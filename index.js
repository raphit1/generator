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
const MODEL_VERSION = 'stability-ai/stable-diffusion:latest';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // Envoie un message avec le bouton dans le salon au démarrage
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) {
    console.error('Salon non trouvé');
    return;
  }

  // Vérifier s'il y a déjà un message avec ce bouton, sinon en envoyer un
  const sentMessages = await channel.messages.fetch({ limit: 10 });
  if (!sentMessages.some(m => m.author.id === client.user.id)) {
    const btn = new ButtonBuilder()
      .setCustomId('open_modal')
      .setLabel('🎨 Générer une image')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btn);

    await channel.send({ content: 'Clique sur le bouton pour écrire la description de l’image.', components: [row] });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'open_modal') {
      // Créer la modal
      const modal = new ModalBuilder()
        .setCustomId('prompt_modal')
        .setTitle('Génération d\'image');

      const input = new TextInputBuilder()
        .setCustomId('prompt_input')
        .setLabel('Écris ta description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: Un chien astronaute sur la lune')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  } else if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === 'prompt_modal') {
      await interaction.deferReply();

      const prompt = interaction.fields.getTextInputValue('prompt_input');
      if (!prompt) {
        return interaction.editReply('❌ Prompt vide.');
      }

      const countdown = await interaction.channel.send('⏳ Génération : 30 s');
      let seconds = 30;
      const timer = setInterval(() => {
        seconds -= 5;
        countdown.edit(`⏳ Génération : ${seconds}s`);
      }, 5000);

      try {
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
        const pred = await res.json();

        const check = async () => {
          const poll = await fetch(pred.urls.get, {
            headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` }
          });
          const j = await poll.json();
          if (j.status === 'succeeded' && j.output?.length) {
            clearInterval(timer);
            await countdown.delete();

            const embed = new EmbedBuilder()
              .setTitle('🖼️ Image générée')
              .setDescription(`Prompt : **${prompt}**`)
              .setImage(j.output[j.output.length - 1])
              .setColor('Blue');

            await interaction.editReply({ embeds: [embed] });
          } else if (j.status === 'failed') {
            clearInterval(timer);
            await interaction.editReply('❌ Échec de la génération.');
          } else {
            setTimeout(check, 2000);
          }
        };

        check();
      } catch (err) {
        clearInterval(timer);
        console.error(err);
        await interaction.editReply('❌ Erreur lors de l’appel API.');
      }
    }
  }
});

client.login(TOKEN);
