import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Events
} from 'discord.js';
import fetch from 'node-fetch';

const TOKEN = process.env.DISCORD_TOKEN;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const CHANNEL_ID = '1381587397724340365';
const MODEL_VERSION = 'stability-ai/stable-diffusion:latest';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.channel.id !== CHANNEL_ID || message.author.bot) return;
  const prompt = message.content.trim();
  if (!prompt) return;

  const btn = new ButtonBuilder()
    .setCustomId(`generate_${prompt}`)
    .setLabel('🎨 Générer une image')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btn);
  await message.reply({ content: `Prompt : **${prompt}**`, components: [row] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, ...rest] = interaction.customId.split('_');
  const prompt = rest.join('_');
  if (action !== 'generate') return;

  await interaction.deferReply();

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
          .setImage(j.output[j.output.length-1])
          .setColor('Blue');

        const regen = new ButtonBuilder()
          .setCustomId(`generate_${prompt}`)
          .setLabel('🔁 Régénérer')
          .setStyle(ButtonStyle.Secondary);

        const row2 = new ActionRowBuilder().addComponents(regen);
        await interaction.editReply({ embeds: [embed], components: [row2] });
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
});

client.login(TOKEN);
