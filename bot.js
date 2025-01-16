require('dotenv').config();
const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const isValidYouTubeURL = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return regex.test(url);
};

// Middleware for force subscription
bot.use(async (ctx, next) => {
  if (!ctx.message || !ctx.message.chat) return next();

  const user = ctx.message.from.id;
  const chatMember = await ctx.telegram.getChatMember(`@${FORCE_CHANNEL}`, user);

  if (chatMember.status === 'left') {
    return ctx.reply(`You need to join our channel first: https://t.me/${FORCE_CHANNEL}`);
  }

  return next();
});

bot.start((ctx) => ctx.reply('Welcome! Send me a YouTube URL to download the video or audio.'));

bot.on('text', async (ctx) => {
  const videoUrl = ctx.message.text;

  if (!isValidYouTubeURL(videoUrl)) {
    return ctx.reply('Invalid YouTube URL. Please provide a valid link.');
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');

    // Provide format options to user
    ctx.reply(`Downloading "${videoTitle}". Please wait...`);

    const outputPath = path.resolve(__dirname, `${videoTitle}.mp4`);
    const stream = ytdl(videoUrl, { quality: 'highestvideo' });

    ffmpeg(stream)
      .output(outputPath)
      .on('end', () => {
        ctx.replyWithVideo({ source: outputPath }).then(() => {
          fs.unlinkSync(outputPath); // Clean up
        });
      })
      .on('error', (err) => {
        console.error(err);
        ctx.reply('An error occurred during processing. Please try again later.');
      })
      .run();
  } catch (error) {
    console.error('Error fetching video info:', error.message);
    ctx.reply('Failed to process the video. Please try again later.');
  }
});

bot.launch();
console.log('Bot is running...');
