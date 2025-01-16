require('dotenv').config();
const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
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
    // Fetch video info using yt-dlp
    const downloadCommand = `yt-dlp -f bestvideo+bestaudio --merge-output-format mp4 -o "${path.resolve(__dirname, '%(title)s.%(ext)s')}" ${videoUrl}`;

    exec(downloadCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return ctx.reply('Failed to download the video. Please try again later.');
      }

      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);

      const videoFilePath = path.resolve(__dirname, `${stdout.trim()}`);

      // Send the downloaded video to the user
      ctx.replyWithVideo({ source: videoFilePath }).then(() => {
        // Clean up the file after sending it
        fs.unlinkSync(videoFilePath);
      }).catch((err) => {
        console.error('Error sending video:', err);
        ctx.reply('Failed to send the video. Please try again later.');
      });
    });
  } catch (error) {
    console.error('Error fetching video info:', error.message);
    ctx.reply('Failed to process the video. Please try again later.');
  }
});

bot.launch();
console.log('Bot is running...');
