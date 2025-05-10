"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PM2MonitorAll = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const pm2_1 = __importDefault(require("pm2"));
dotenv_1.default.config();
class PM2MonitorAll {
    constructor(config) {
        this.appsInfo = [];
        this.config = config;
    }
    startMonitoring() {
        // Connessione a PM2 per ottenere la lista di tutte le app in esecuzione
        pm2_1.default.connect((err) => __awaiter(this, void 0, void 0, function* () {
            if (err) {
                console.error("Error connecting to PM2:", err);
                return;
            }
            // Ottiene la lista dei processi in esecuzione
            pm2_1.default.list((listErr, processList) => {
                if (listErr) {
                    console.error("Error listing PM2 processes:", listErr);
                    pm2_1.default.disconnect();
                    return;
                }
                // Memorizza i path dei file di log di errore per ogni app
                processList.forEach((proc) => {
                    if (proc.pm2_env &&
                        proc.pm2_env.pm_out_log_path &&
                        proc.pm2_env.pm_err_log_path &&
                        proc.name !== "pm2-monitor") {
                        this.appsInfo.push({
                            name: proc.name || `app-${proc.pm_id}`,
                            errorLogPath: proc.pm2_env.pm_err_log_path,
                            lastFileSize: 0,
                        });
                    }
                });
                console.log("Monitoring the following PM2 apps:");
                this.appsInfo.forEach((app) => console.log(`- ${app.name} -> ${app.errorLogPath}`));
                // Avvio del monitoraggio a intervalli
                setInterval(() => {
                    this.appsInfo.forEach((appInfo) => {
                        this.checkLogFileForErrors(appInfo);
                    });
                }, this.config.checkIntervalMs);
            });
        }));
    }
    checkLogFileForErrors(appInfo) {
        fs_1.default.stat(appInfo.errorLogPath, (err, stats) => {
            if (err) {
                console.error(`Error reading log stats for ${appInfo.name}:`, err);
                return;
            }
            if (stats.size < appInfo.lastFileSize)
                appInfo.lastFileSize = 0;
            if (stats.size > appInfo.lastFileSize) {
                const readSize = stats.size - appInfo.lastFileSize;
                const buffer = Buffer.alloc(readSize);
                const fileDescriptor = fs_1.default.openSync(appInfo.errorLogPath, "r");
                fs_1.default.readSync(fileDescriptor, buffer, 0, readSize, appInfo.lastFileSize);
                fs_1.default.closeSync(fileDescriptor);
                const newContent = buffer.toString();
                if (/error|exception|failed|unauthorized/i.test(newContent)) {
                    this.sendErrorEmail(appInfo.name, newContent);
                }
                appInfo.lastFileSize = stats.size;
            }
        });
    }
    sendErrorEmail(appName, errorContent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transporter = nodemailer_1.default.createTransport({
                    host: this.config.smtpHost,
                    port: this.config.smtpPort,
                    auth: {
                        user: this.config.smtpUser,
                        pass: this.config.smtpPassword,
                    },
                });
                const mailOptions = {
                    from: this.config.fromEmail,
                    to: this.config.toEmail,
                    subject: `PM2 Log Error Detected in ${appName}`,
                    text: `A new error was detected in the logs of "${appName}":\n\n${errorContent}`,
                };
                yield transporter.sendMail(mailOptions);
                console.log(`Error email sent for ${appName}.`);
            }
            catch (error) {
                console.error("Error sending email:", error);
            }
        });
    }
}
exports.PM2MonitorAll = PM2MonitorAll;
// Esempio di utilizzo
if (require.main === module) {
    const monitorConfig = {
        checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS || "300000"),
        smtpHost: process.env.SMTP_HOST || "",
        smtpPort: parseInt(process.env.SMTP_PORT || "465"),
        smtpUser: process.env.SMTP_USER || "",
        smtpPassword: process.env.SMTP_PASSWORD || "",
        fromEmail: process.env.FROM_EMAIL || "",
        toEmail: process.env.TO_EMAIL || "",
    };
    const pm2MonitorAll = new PM2MonitorAll(monitorConfig);
    pm2MonitorAll.startMonitoring();
}
