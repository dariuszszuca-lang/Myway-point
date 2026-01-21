const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Resend API key
const RESEND_API_KEY = "re_Qy8GeLdK_CT2bMkzFoSyFjT1CR4dmazEK";

// Wysyłanie emaila przez Resend
async function sendEmailWithResend(to, subject, html, text) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MyWay Point <rezerwacje@osrodek-myway.pl>",
      to: [to],
      subject: subject,
      html: html,
      text: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${error}`);
  }

  return await response.json();
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

    const html = `
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
    `;

    const text = `
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
    `;

    try {
      const result = await sendEmailWithResend(
        "terapia@osrodek-myway.pl",
        `Nowa rezerwacja - ${session.patientName} u ${session.therapistName}`,
        html,
        text
      );
      console.log("Email wysłany pomyślnie:", result);
      return { success: true, id: result.id };
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

      const text = `
Przypomnienie o rezerwacji

Terapeuta: ${session.therapistName}
Data: ${formatDate(session.date)}
Godzina: ${session.startTime} - ${session.endTime}
Pacjent: ${session.patientName}

MyWay Point
      `;

      const result = await sendEmailWithResend(
        "terapia@osrodek-myway.pl",
        `Przypomnienie - ${session.patientName} u ${session.therapistName}`,
        `<pre>${text}</pre>`,
        text
      );

      return { success: true, message: "Email wysłany", id: result.id };
    } catch (error) {
      console.error("Błąd:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// =======================================================================
// INTEGRACJA MyWay-CRM -> MyWayPoint-Rezerwacje
// Endpoint wywoływany przez MyWay-CRM gdy dodawany jest pacjent z Pakietem 3
// =======================================================================

exports.createPatientFromCRM = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed" });
      return;
    }

    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        totalSessions,
        crmPatientId,
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: firstName, lastName, email",
        });
        return;
      }

      // Check if patient with this email already exists
      const existingPatient = await admin
        .firestore()
        .collection("patients")
        .where("email", "==", email.toLowerCase())
        .get();

      if (!existingPatient.empty) {
        // Patient exists - update with CRM link
        const existingDoc = existingPatient.docs[0];
        await existingDoc.ref.update({
          crmPatientId: crmPatientId || null,
          totalSessions: totalSessions || 20,
          updatedAt: Date.now(),
        });

        console.log("Patient updated from CRM:", existingDoc.id);
        res.status(200).json({
          success: true,
          patientId: existingDoc.id,
          message: "Patient updated",
        });
        return;
      }

      // Create new patient
      const patientData = {
        name: `${firstName} ${lastName}`,
        email: email.toLowerCase(),
        phone: phone || "",
        totalSessions: totalSessions || 20,
        usedSessions: 0,
        sessionsHistory: [],
        notes: `Zaimportowany z MyWay CRM`,
        crmPatientId: crmPatientId || null,
        createdAt: Date.now(),
      };

      const docRef = await admin
        .firestore()
        .collection("patients")
        .add(patientData);

      console.log("New patient created from CRM:", docRef.id, patientData);

      res.status(201).json({
        success: true,
        patientId: docRef.id,
        message: "Patient created",
      });
    } catch (error) {
      console.error("Error creating patient from CRM:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
