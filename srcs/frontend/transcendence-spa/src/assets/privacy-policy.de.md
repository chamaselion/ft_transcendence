# Datenschutzerklärung

**Version 1.0 · Zuletzt aktualisiert: 21.10.2026**

## 1. Verantwortlicher

**Trans Edit** („der Dienst“, „wir“, „uns“) wird betrieben von **einem 42-Team unter der Leitung von bszikora**, ansässig in der **Weipertstraße 8-10, 74076 Heilbronn, Deutschland**. Für alle Fragen zum Datenschutz erreichen Sie uns unter **afelger@student.42heilbronn.de**.

## 2. Welche personenbezogenen Daten wir erheben

Wir erheben und verarbeiten ausschließlich diejenigen Daten, die für die Bereitstellung unseres kollaborativen Dokumenteneditors zwingend erforderlich sind:

- **Kontoinformationen:** Benutzername (`login`), E-Mail-Adresse, gesalzener und gehashter Passwortwert (`bcryptjs`) sowie die zugewiesene Benutzerrolle (`user` oder `admin`).
- **OAuth-2.0-Identitäten:** Wenn Sie sich über GitHub oder 42 anmelden oder Ihr Konto verknüpfen, speichern wir den Namen des Anbieters, Ihre Anbieter-Benutzer-ID, den Status der E-Mail-Verifizierung sowie die Profilbild-URL.
- **Profilbild:** Ein optionales, von Ihnen hochgeladenes Profilbild, das auf ein 256×256-WebP-Bild ohne EXIF-Metadaten normalisiert und in unserem isolierten S3-kompatiblen Objektspeicher (`user-icons`) abgelegt wird.
- **Dokumente & Kollaborationsdaten:** Dokumenttitel, blockstrukturierte Inhalte, Eigentümerschaft, Freigabeberechtigungen (`viewer` oder `editor`) sowie temporäre Echtzeit-Blocksperren.
- **Authentifizierungs- & Sicherheitsprotokolle:** Aktive Sitzungstoken (`auth_sessions`) mit Anmelde- und Ablaufzeitstempeln, gehashte Einmal-Bestätigungscodes (`one_time_challenges`), OAuth-CSRF-Status-Token (`oauth_state_intents`) sowie DSGVO-Audit-Protokolle (`gdpr_audit_events`).

## 3. Wie und warum wir Ihre Daten verarbeiten (Rechtsgrundlagen)

Gemäß Art. 6 Abs. 1 der EU-Datenschutz-Grundverordnung (DSGVO) verarbeiten wir Ihre Daten auf folgenden Rechtsgrundlagen:

- **Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):** Zur Registrierung und Authentifizierung Ihres Kontos, zur Zustellung von 2FA-Bestätigungscodes, zum Speichern und Synchronisieren Ihrer Dokumente in Echtzeit, zur Verwaltung von Freigabeberechtigungen sowie zur Bearbeitung von Ihnen ausgelöster KI-Ausarbeitungs- und Übersetzungsanfragen.
- **Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO):** Zur Absicherung unserer Infrastruktur, zur Durchsetzung von Ratenbegrenzungen (Rate Limits), zur Verhinderung unbefugter Zugriffe oder Missbrauch sowie zur Wahrung der Sitzungsintegrität.
- **Rechtliche Verpflichtungen (Art. 6 Abs. 1 lit. c DSGVO):** Zur Erfüllung gesetzlicher Betroffenenrechte (Auskunft, Datenübertragbarkeit, Löschung) und zur Führung eines Prüfpfads über DSGVO-Vorgänge.

## 4. Was wir nicht tun

- Wir verkaufen, vermieten oder handeln **nicht** mit Ihren personenbezogenen Daten.
- Wir verwenden Ihre personenbezogenen Daten oder Dokumentinhalte **nicht** zum Trainieren von KI-Modellen.
- Wir setzen **keine** Werbe-, Analyse- oder Tracking-Cookies von Drittanbietern ein.

## 5. Cookies und lokaler Speicher

Im Einklang mit der EU-Richtlinie 2002/58/EG (ePrivacy) und Art. 6 DSGVO verwenden wir ausschließlich technisch notwendige Erstanbieter-Speicherelemente:

- **`token` (HTTP-only, Secure, SameSite=Strict Cookie):** Speichert Ihre authentifizierte JWT-Sitzung für bis zu 7 Tage.
- **`app-theme` (Local Storage):** Speichert Ihre gewählte Designeinstellung (heller oder dunkler Modus).
- **`app-locale` (Local Storage):** Speichert Ihre gewählte Oberflächen- und Übersetzungssprache (`en`, `de`, `hu`).
- **`cookie-consent` (Local Storage):** Speichert Ihre Bestätigung des Cookie-Hinweises.

## 6. Datenweitergabe und Auftragsverarbeiter

Ihre Daten werden innerhalb unseres containerisierten Stacks (PostgreSQL-Datenbank und RustFS-S3-Objektspeicher) gehostet. Externe Auftragsverarbeiter werden nur dann eingesetzt, wenn sie ausdrücklich konfiguriert und durch Ihre Aktion ausgelöst werden:

- **SMTP-E-Mail-Anbieter:** Zustellung von Einmalcodes für Anmeldung, Passwortzurücksetzung und DSGVO-Bestätigungen.
- **OAuth-2.0-Anbieter (GitHub, 42):** Wird nur verwendet, wenn Sie sich aktiv für die Anmeldung oder Verknüpfung über diese Anbieter entscheiden.
- **KI-Inferenzanbieter (OpenAI, DeepSeek oder Anthropic):** Wenn Sie eine KI-Blockausarbeitung oder Sprachübersetzung auslösen, wird der betreffende Blocktext ausschließlich zur Erzeugung der Antwort an den konfigurierten Anbieter übermittelt.

## 7. Speicherdauer und Löschung

Wir speichern Ihre personenbezogenen Daten für die Dauer Ihres aktiven Kontos. Wenn Sie Ihr Konto über **Benutzereinstellungen → Konto löschen** (bestätigt per E-Mail-OTP) löschen, werden Ihr Benutzerdatensatz, Ihre Dokumente, Freigaben, Sitzungen, OAuth-Verknüpfungen und Ihr hochgeladenes Profilbild über `ON DELETE CASCADE`-Datenbankregeln sowie S3-Objektlöschung unwiderruflich entfernt.

## 8. Ihre Rechte nach der DSGVO (Artikel 15–22)

Sie haben folgende Rechte:

- **Auskunft & Datenübertragbarkeit (Art. 15 & 20):** Exportieren Sie jederzeit eine vollständige, maschinenlesbare Kopie Ihrer personenbezogenen Daten im **JSON**- oder **CSV**-Format direkt unter **Benutzereinstellungen → Datenschutz & DSGVO**.
- **Berichtigung (Art. 16):** Aktualisieren Sie Ihren Benutzernamen, Ihre E-Mail-Adresse, Ihr Passwort oder Ihr Profilbild jederzeit in den **Benutzereinstellungen**.
- **Löschung / „Recht auf Vergessenwerden“ (Art. 17):** Löschen Sie Ihr Konto und alle zugehörigen Daten dauerhaft in den **Benutzereinstellungen**.
- **Einschränkung, Widerspruch & Beschwerde (Art. 18, 21, 77):** Kontaktieren Sie uns unter **afelger@student.42heilbronn.de** oder reichen Sie eine Beschwerde bei Ihrer zuständigen Datenschutz-Aufsichtsbehörde ein.

