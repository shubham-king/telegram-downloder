require('dotenv').config();
const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
ffmpeg.setFfmpegPath(ffmpegPath);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Replace this with your channel username
const REQUIRED_CHANNEL = '@techrove';

bot.start(async (ctx) => {
    const userId = ctx.from.id;

    try {
        const member = await bot.telegram.getChatMember(REQUIRED_CHANNEL, userId);

        if (['creator', 'administrator', 'member'].includes(member.status)) {
            ctx.reply('Welcome! Send me a YouTube link to download videos or audio.');
        } else {
            ctx.reply(
                `You must join our channel [${REQUIRED_CHANNEL}](https://t.me/techrove) to use this bot.`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        ctx.reply(
            `You must join our channel [${REQUIRED_CHANNEL}](https://t.me/techrove) to use this bot.`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    try {
        const member = await bot.telegram.getChatMember(REQUIRED_CHANNEL, userId);

        if (!['creator', 'administrator', 'member'].includes(member.status)) {
            return ctx.reply(
                `You must join our channel [${REQUIRED_CHANNEL}](https://t.me/techrove) to use this bot.`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        return ctx.reply(
            `You must join our channel [${REQUIRED_CHANNEL}](https://t.me/techrove) to use this bot.`,
            { parse_mode: 'Markdown' }
        );
    }

    const url = ctx.message.text;

    if (!ytdl.validateURL(url)) {
        return ctx.reply('Invalid YouTube URL. Please send a valid link.');
    }

    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
    const formatOptions = formats.map((format, index) => `${index + 1}. ${format.qualityLabel} - ${format.container}`).join('\n');

    ctx.session = { url, formats };
    ctx.reply(`Available formats:\n${formatOptions}\n\nReply with the number to select.`);
});

bot.on('text', async (ctx) => {
    const selection = parseInt(ctx.message.text, 10) - 1;
    const format = ctx.session?.formats?.[selection];

    if (!format) {
        return ctx.reply('Invalid selection. Please try again.');
    }

    const outputPath = path.join(tempDir, `output.${format.container}`);
    const stream = ytdl(ctx.session.url, { format });

    ctx.reply('Downloading...');
    stream.pipe(fs.createWriteStream(outputPath));

    stream.on('finish', async () => {
        await ctx.replyWithDocument({ source: outputPath });
        fs.unlinkSync(outputPath);
    });

    stream.on('error', (err) => {
        console.error(err);
        ctx.reply('An error occurred while downloading. Please try again.');
    });
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
