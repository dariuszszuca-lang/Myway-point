const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Konfiguracja transportera email
function getEmailTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: functions.config().email?.user || process.env.EMAIL_USER,
      pass: functions.config().email?.password || process.env.EMAIL_PASSWORD,
    },
  });
}

// Formatowanie daty do polskiego formatu
function formatDate(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

// Trigger: gdy tworzona jest nowa sesja/rezerwacja
exports.onSessionCreated = functions
  .region("europe-west1")
  .firestore.document("sessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const session = snap.data();
    const sessionId = context.params.sessionId;

    console.log("Nowa rezerwacja:", sessionId, session);

    // Przygotuj email
    const mailOptions = {
      from: '"MyWay Point" <noreply@osrodek-myway.pl>',
      to: "terapia@osrodek-myway.pl",
      subject: `Nowa rezerwacja - ${session.patientName} u ${session.therapistName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Nowa rezerwacja w systemie MyWay Point</h1>
          </div>

          <div style="background: #f8fafc; padding: 25px; border: 1px solid #e2e8f0; border-top: none;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 140px;">Usługa:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Konsultacja Terapeutyczna (${session.therapistName})</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Terapeuta:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${session.therapistName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Data:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${formatDate(session.date)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Godzina:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${session.startTime} - ${session.endTime}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Pacjent:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${session.patientName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">ID rezerwacji:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-family: monospace;">${sessionId.substring(0, 8).toUpperCase()}</td>
              </tr>
              ${session.notes ? `
              <tr>
                <td style="padding: 10px 0; color: #64748b;">Notatki:</td>
                <td style="padding: 10px 0; color: #1e293b;">${session.notes}</td>
              </tr>
              ` : ""}
            </table>
          </div>

          <div style="background: #1e293b; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              Z poważaniem,<br>
              <strong style="color: #fbbf24;">MyWay Point</strong> - System Rezerwacji
            </p>
          </div>
        </div>
      `,
      text: `
Nowa rezerwacja w systemie MyWay Point

Usługa: Konsultacja Terapeutyczna (${session.therapistName})
Terapeuta: ${session.therapistName}
Data: ${formatDate(session.date)}
Godzina: ${session.startTime} - ${session.endTime}
Pacjent: ${session.patientName}
ID rezerwacji: ${sessionId.substring(0, 8).toUpperCase()}
${session.notes ? `Notatki: ${session.notes}` : ""}

Z poważaniem,
MyWay Point
      `,
    };

    try {
      const transporter = getEmailTransporter();
      await transporter.sendMail(mailOptions);
      console.log("Email wysłany pomyślnie dla sesji:", sessionId);
      return { success: true };
    } catch (error) {
      console.error("Błąd wysyłania emaila:", error);
      return { success: false, error: error.message };
    }
  });

// Opcjonalnie: funkcja do ręcznego wysłania powiadomienia
exports.sendSessionNotification = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { sessionId } = data;

    if (!sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Brak sessionId"
      );
    }

    try {
      const sessionDoc = await admin
        .firestore()
        .collection("sessions")
        .doc(sessionId)
        .get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Sesja nie istnieje");
      }

      const session = sessionDoc.data();

      const mailOptions = {
        from: '"MyWay Point" <noreply@osrodek-myway.pl>',
        to: "terapia@osrodek-myway.pl",
        subject: `Przypomnienie - ${session.patientName} u ${session.therapistName}`,
        text: `
Przypomnienie o rezerwacji

Terapeuta: ${session.therapistName}
Data: ${formatDate(session.date)}
Godzina: ${session.startTime} - ${session.endTime}
Pacjent: ${session.patientName}

MyWay Point
        `,
      };

      const transporter = getEmailTransporter();
      await transporter.sendMail(mailOptions);

      return { success: true, message: "Email wysłany" };
    } catch (error) {
      console.error("Błąd:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
