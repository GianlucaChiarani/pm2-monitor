import dotenv from "dotenv";
import fs from "fs";
import nodemailer from "nodemailer";
import pm2 from "pm2";

dotenv.config();

interface LogMonitorConfig {
  checkIntervalMs: number; // Intervallo di monitoraggio in ms (es. 5 min => 5 * 60 * 1000)
  smtpHost: string; // Host SMTP
  smtpPort: number; // Porta SMTP
  smtpUser: string; // Utente SMTP
  smtpPassword: string; // Password SMTP
  fromEmail: string; // Email mittente
  toEmail: string; // Email destinatario
}

interface AppLogInfo {
  name: string;
  errorLogPath: string;
  lastFileSize: number;
}

export class PM2MonitorAll {
  private config: LogMonitorConfig;
  private appsInfo: AppLogInfo[] = [];

  constructor(config: LogMonitorConfig) {
    this.config = config;
  }

  public startMonitoring(): void {
    // Connessione a PM2 per ottenere la lista di tutte le app in esecuzione
    pm2.connect(async (err) => {
      if (err) {
        console.error("Error connecting to PM2:", err);
        return;
      }

      // Ottiene la lista dei processi in esecuzione
      pm2.list((listErr, processList) => {
        if (listErr) {
          console.error("Error listing PM2 processes:", listErr);
          pm2.disconnect();
          return;
        }

        // Memorizza i path dei file di log di errore per ogni app
        processList.forEach((proc) => {
          if (
            proc.pm2_env &&
            proc.pm2_env.pm_out_log_path &&
            proc.pm2_env.pm_err_log_path &&
            proc.name !== "pm2-monitor"
          ) {
            this.appsInfo.push({
              name: proc.name || `app-${proc.pm_id}`,
              errorLogPath: proc.pm2_env.pm_err_log_path,
              lastFileSize: 0,
            });
          }
        });

        console.log("Monitoring the following PM2 apps:");
        this.appsInfo.forEach((app) =>
          console.log(`- ${app.name} -> ${app.errorLogPath}`)
        );

        // Avvio del monitoraggio a intervalli
        setInterval(() => {
          this.appsInfo.forEach((appInfo) => {
            this.checkLogFileForErrors(appInfo);
          });
        }, this.config.checkIntervalMs);
      });
    });
  }

  private checkLogFileForErrors(appInfo: AppLogInfo): void {
    fs.stat(appInfo.errorLogPath, (err, stats) => {
      if (err) {
        console.error(`Error reading log stats for ${appInfo.name}:`, err);
        return;
      }

      if (stats.size < appInfo.lastFileSize) appInfo.lastFileSize = 0;

      if (stats.size > appInfo.lastFileSize) {
        const readSize = stats.size - appInfo.lastFileSize;
        const buffer = Buffer.alloc(readSize);

        const fileDescriptor = fs.openSync(appInfo.errorLogPath, "r");
        fs.readSync(fileDescriptor, buffer, 0, readSize, appInfo.lastFileSize);
        fs.closeSync(fileDescriptor);

        const newContent = buffer.toString();
        if (/error|exception|fail|failed|unauthorized/i.test(newContent)) {
          this.sendErrorEmail(appInfo.name, newContent);
        }

        appInfo.lastFileSize = stats.size;
      }
    });
  }

  private async sendErrorEmail(
    appName: string,
    errorContent: string
  ): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
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

      await transporter.sendMail(mailOptions);
      console.log(`Error email sent for ${appName}.`);
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }
}

// Esempio di utilizzo
if (require.main === module) {
  const monitorConfig: LogMonitorConfig = {
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
