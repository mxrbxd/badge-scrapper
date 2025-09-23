const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');

// Renk tanımlamaları
const colorsConfig = {
    red: colors.red,
    green: colors.green,
    blue: colors.blue,
    cyan: colors.cyan,
    reset: colors.reset
};

// Yardımcı fonksiyonlar
const saveJson = (data, filename) => {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 4));
        return true;
    } catch (error) {
        console.error(colorsConfig.red(`JSON kaydetme hatası: ${error.message}`));
        return false;
    }
};

const loadJson = (filename) => {
    try {
        if (!fs.existsSync(filename)) {
            return {};
        }
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(colorsConfig.red(`JSON yükleme hatası: ${error.message}`));
        return {};
    }
};

const randomUserAgent = () => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
};

class DiscordScraper {
    constructor() {
        this.BADGES = {
            [1 << 0]: "<:Badge_Discord_Staff:1365704725646807060>",
            [1 << 1]: "<:DiscordPartner:1365700977570742312>",
            [1 << 2]: "<:HypeSquadEvents:1365704359454834770>",
            [1 << 3]: "<:BugHunter1:1365701008184967278>",
            [1 << 9]: "<:86964earlysupporter:1345831325738995848>",
            [1 << 14]: "<:BugHunter2:1365701027830960259>",
            [1 << 17]: "<:dev:1365704127103107112>",
            [1 << 18]: "<:ModeratorProgramsAlumni:1365701046256533525>",
        };

        this.seenUsers = new Set();
        this.lastMessageId = null;
        this.totalProcessed = 0;
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const configPath = path.join(__dirname, 'config.json');
            if (!fs.existsSync(configPath)) {
                throw new Error('config.json dosyası bulunamadı');
            }
            
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            if (!config.token) {
                throw new Error('Token config.json içinde bulunamadı');
            }
            
            if (!config.webhook) {
                throw new Error('Webhook URL config.json içinde bulunamadı');
            }
            
            return config;
        } catch (error) {
            console.error(colorsConfig.red(`Config yükleme hatası: ${error.message}`));
            process.exit(1);
        }
    }

    // Banner fonksiyonu: Düzgün ASCII ve satır başına renkli
    displayBanner() {
        const morbidColors = [
            colors.red, colors.green, colors.yellow, colors.blue, colors.magenta, colors.cyan, colors.white
        ];
        const morbidText = [
            "███████╗ ██████╗██████╗  █████╗ ██████╗ ███████╗██████╗",
            "██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗",
            "███████╗██║     ██████╔╝███████║██████╔╝█████╗  ██████╔╝",
            "╚════██║██║     ██╔══██╗██╔══██║██╔═══╝ ██╔══╝  ██╔══██╗",
            "███████║╚██████╗██║  ██║██║  ██║██║     ███████╗██║  ██║",
            "╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝"
        ];
        morbidText.forEach((line, idx) => {
            const color = morbidColors[idx % morbidColors.length];
            console.log(color(line));
        });
    }

    async getChannelMessages(channelId) {
        const url = `https://discord.com/api/v9/channels/${channelId}/messages`;
        const headers = {
            "Authorization": this.config.token,
            "Content-Type": "application/json",
            "User-Agent": randomUserAgent()
        };

        const params = { limit: 100 };
        if (this.lastMessageId) {
            params.before = this.lastMessageId;
        }

        try {
            const response = await axios.get(url, { headers, params });
            return response.data;
        } catch (error) {
            console.error(colorsConfig.red(`Mesaj alma hatası: ${error.response?.status || error.message}`));
            if (error.response) {
                console.error(colorsConfig.red(`Response: ${JSON.stringify(error.response.data)}`));
            }
            return null;
        }
    }

    async sendToWebhook(content) {
        const webhookData = {
            content: content,
            username: "Morbid Badge Scrapper",
            avatar_url: "https://avatars.githubusercontent.com/u/191013381?v=4"
        };

        try {
            const response = await axios.post(this.config.webhook, webhookData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return { success: true, status: response.status };
        } catch (error) {
            return { 
                success: false, 
                status: error.response?.status || 0,
                error: error.message 
            };
        }
    }

    processUserBadges(author) {
        const username = author.username;
        const flags = author.public_flags || 0;
        
        // Özel badge'leri kontrol et
        let badges = Object.keys(this.BADGES)
            .map(bit => parseInt(bit))
            .filter(bit => flags & bit)
            .map(bit => this.BADGES[bit])
            .join('');

        // Özel badge yoksa username uzunluğuna göre badge ata
        if (!badges) {
            if (username.length === 2) {
                badges = "<:2L:1388122321033629789>";
            } else if (username.length === 3) {
                badges = "<:3L:1388122363953942550>";
            } else {
                badges = "No badge";
            }
        }

        return badges;
    }

    async processMessages(messages) {
        for (const message of messages) {
            const author = message.author;
            const userId = author.id;

            if (this.seenUsers.has(userId)) {
                continue;
            }

            this.seenUsers.add(userId);
            const badges = this.processUserBadges(author);

            // Sadece özel badge'leri veya kısa username'lileri işle
            if (badges === "No badge" && author.username.length > 3) {
                // Rozeti olmayan kullanıcıyı sadece terminale yaz
                console.log(colorsConfig.red(`bu kullanıcıda bulamadık ${userId} - ${author.username}`));
                continue;
            }

            // Rozet bulunduysa terminale bildir (sadece bu satır yeşil olacak)
            console.log(colorsConfig.green(`Rozet Bulundu ${userId} - ${author.username}`));

            // Webhook'a gönderilecek yeni format
            const content = `> ** ${userId} - ${author.username} - <@${userId}> Rozet:** ${badges}`;

            // Webhook'a gönder
            this.sendToWebhook(content);

            // Terminale tekrar log basma!
            // console.log(colorsConfig.green(content)); // <-- Bunu kaldırdık

            this.totalProcessed++;
        }

        this.lastMessageId = messages[messages.length - 1].id;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async run() {
        console.clear();
        this.displayBanner();

        const channelId = await new Promise((resolve) => {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question("Channel ID: ", (answer) => {
                readline.close();
                resolve(answer.trim());
            });
        });

        if (!channelId) {
            console.log(colorsConfig.red('Geçersiz Channel ID'));
            return;
        }

        console.log(colorsConfig.cyan('Scraping başlatılıyor...'));

        while (true) {
            const messages = await this.getChannelMessages(channelId);
            
            if (!messages || messages.length === 0) {
                console.log(colorsConfig.green('Tüm mesajlar işlendi!'));
                break;
            }

            await this.processMessages(messages);
            
            // Küçük bir bekleme süresi ekle
            await this.delay(1000);
        }

        console.log(colorsConfig.green(`\nScraping tamamlandı!`));
        console.log(colorsConfig.cyan(`Toplam işlenen kullanıcı: ${this.totalProcessed}`));
        console.log(colorsConfig.cyan(`Benzersiz kullanıcı sayısı: ${this.seenUsers.size}`));
    }
}

// Hata yakalama
process.on('unhandledRejection', (error) => {
    console.error(colorsConfig.red('İşlenmemiş Promise hatası:'), error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error(colorsConfig.red('Yakalanmamış exception:'), error);
    process.exit(1);
});

// Ana fonksiyon
async function main() {
    try {
        const scraper = new DiscordScraper();
        await scraper.run();
    } catch (error) {
        console.error(colorsConfig.red('Uygulama hatası:'), error);
        process.exit(1);
    }
}

// Uygulamayı başlat
if (require.main === module) {
    main();
}

module.exports = DiscordScraper;