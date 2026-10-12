// Public privacy policy page for the Fuel Pump Meter Reader automation
// (needed so its Google sign-in app can be published). Plain static page.

export const metadata = {
  title: "Fuel Pump Meter Reader – Privacy Policy",
};

const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "56px 20px 80px", lineHeight: 1.7 };
const h2: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 24, marginTop: 32 };

export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 40, lineHeight: 1.15 }}>
        Fuel Pump Meter Reader — Privacy Policy
      </h1>
      <p style={{ color: "var(--muted)" }}>Last updated: October 12, 2026</p>

      <p>
        Fuel Pump Meter Reader is a private automation built by Lens by AI for a single gas station owner. It reads
        fuel-pump meter photos that the station&apos;s staff upload to Google Drive and records the meter readings in
        the owner&apos;s Google Sheet. It is not a public service and is not offered to other users.
      </p>

      <h2 style={h2}>What Google data it uses</h2>
      <ul>
        <li>
          <strong>Google Drive:</strong> it reads new photos in one specific folder chosen by the owner, and moves
          processed photos into the owner&apos;s &quot;Processed&quot; or &quot;Needs Review&quot; folders.
        </li>
        <li>
          <strong>Google Sheets:</strong> it adds meter readings, upload times and photo links to one spreadsheet
          chosen by the owner.
        </li>
      </ul>
      <p>It does not read email, contacts, or any other files or spreadsheets.</p>

      <h2 style={h2}>How the data is used</h2>
      <p>
        Each meter photo is sent to an AI service (Anthropic&apos;s Claude) only to read the number on the meter. The
        resulting reading is written to the owner&apos;s spreadsheet. Data is used for no other purpose, is not sold,
        and is not used for advertising.
      </p>

      <h2 style={h2}>Where the data is stored</h2>
      <p>
        Photos and readings stay in the owner&apos;s own Google Drive and Google Sheets. The automation runs on the
        owner&apos;s own computer. Its run history is deleted automatically after 7 days.
      </p>

      <h2 style={h2}>Sharing</h2>
      <p>
        Data is not shared with anyone except the AI service named above, which processes each photo to read the
        meter number.
      </p>

      <h2 style={h2}>Removing access</h2>
      <p>
        The owner can remove this automation&apos;s access at any time from their Google Account under Security →
        Third-party apps &amp; services.
      </p>

      <h2 style={h2}>Use of Google user data</h2>
      <p>
        The use of information received from Google APIs adheres to the Google API Services User Data Policy,
        including the Limited Use requirements.
      </p>

      <h2 style={h2}>Contact</h2>
      <p>
        Questions about this policy: Lens by AI —{" "}
        <a href="https://lensbyai.netlify.app" target="_blank" rel="noreferrer">
          lensbyai.netlify.app
        </a>
      </p>
    </main>
  );
}
