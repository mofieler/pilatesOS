import type { Metadata } from 'next';
import { STUDIO } from '@/lib/config/studio';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung – Pilateq',
  description: 'Privacy policy for paquita.pilateq.de',
  robots: { index: false },
};

const CONTROLLER = STUDIO.name;
const CONTACT_EMAIL = STUDIO.email;
const PLATFORM_URL = STUDIO.bookingUrl.replace(/^https?:\/\//, '');

export default function DatenschutzPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Datenschutzerklärung</h1>
      <p className="text-sm text-[#8b6b5c] mb-2">
        Privacy Policy · Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
      </p>
      <p className="text-sm text-[#8b6b5c] mb-10">
        Diese Datenschutzerklärung gilt für die Booking-Plattform{' '}
        <strong className="text-[#6b3d32]">{PLATFORM_URL}</strong>.
      </p>

      <Section title="1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)">
        <p>
          {CONTROLLER}<br />
          {STUDIO.address}, {STUDIO.city}, {STUDIO.country}<br />
          E-Mail:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#6b3d32] underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <Section title="2. Welche Daten wir erheben und warum">
        <SubSection title="2.1 Registrierung &amp; Nutzerkonto">
          <p>
            Bei der Registrierung erheben wir: <strong>E-Mail-Adresse</strong>, <strong>Name</strong>{' '}
            (freiwillig) und <strong>Telefonnummer</strong> (freiwillig). Diese Daten sind notwendig,
            um Ihnen ein Nutzerkonto zur Buchung von Kursen bereitzustellen.
          </p>
          <Legal>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) · Speicherdauer:
            bis zur Löschung des Kontos; Finanzdaten nach § 147 AO mindestens 10 Jahre.
          </Legal>
        </SubSection>

        <SubSection title="2.2 Buchungen &amp; Zahlungen">
          <p>
            Beim Buchen eines Kurses oder Kaufen eines Kreditpakets werden folgende Daten verarbeitet:
            gebuchter Kurs, Datum/Uhrzeit, Kredittyp, Zahlungsstatus und Rechnungsnummer.
            Rechnungen werden gemäß § 147 AO zehn Jahre aufbewahrt.
          </p>
          <Legal>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung),
            Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten / Steuerrecht).
          </Legal>
        </SubSection>

        <SubSection title="2.3 E-Mail-Benachrichtigungen">
          <p>
            Wir senden transaktionale E-Mails (Buchungsbestätigung, Stornierung, Rechnungen) über
            den Dienstleister <strong>Resend</strong> (Resend, Inc., USA). Die Übermittlung
            erfolgt auf Grundlage von Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
          </p>
          <Legal>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</Legal>
        </SubSection>

        <SubSection title="2.4 Server-Logs &amp; Sicherheit">
          <p>
            Unser Hosting-Anbieter <strong>Hetzner Online GmbH</strong> (Deutschland) verarbeitet
            technische Zugriffsdaten (IP-Adresse, Zeitstempel, HTTP-Methode) zur Sicherung des
            Betriebs. Diese Daten werden automatisch nach 7 Tagen gelöscht.
          </p>
          <Legal>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
            IT-Sicherheit).
          </Legal>
        </SubSection>

        <SubSection title="2.5 Cookies">
          <p>
            Diese Plattform verwendet ausschließlich <strong>technisch notwendige Cookies</strong>{' '}
            (Session-Cookie für die Anmeldung, CSRF-Schutz). Es werden keine Tracking-, Analyse-
            oder Marketing-Cookies gesetzt. Eine Einwilligung ist daher nicht erforderlich
            (§ 25 Abs. 2 Nr. 2 TDDDG).
          </p>
        </SubSection>
      </Section>

      <Section title="3. Weitergabe an Dritte">
        <p>
          Wir geben Ihre Daten nur weiter, soweit dies zur Vertragserfüllung erforderlich ist
          (z. B. Resend für den E-Mail-Versand) oder gesetzliche Pflichten dies verlangen.
          Ein Verkauf Ihrer Daten findet nicht statt.
        </p>
      </Section>

      <Section title="4. Ihre Rechte (Art. 15–22 DSGVO)">
        <ul className="space-y-2 list-none pl-0">
          {[
            ['Auskunft (Art. 15)', 'Sie können jederzeit Auskunft über Ihre bei uns gespeicherten Daten verlangen.'],
            ['Berichtigung (Art. 16)', 'Unrichtige Daten können Sie über die Profileinstellungen korrigieren oder uns per E-Mail informieren.'],
            ['Löschung (Art. 17)', 'Sie können die Löschung Ihres Kontos beantragen. Buchungs- und Rechnungsdaten unterliegen steuerlichen Aufbewahrungsfristen (§ 147 AO, 10 Jahre).'],
            ['Einschränkung (Art. 18)', 'Sie können die Verarbeitung Ihrer Daten einschränken lassen.'],
            ['Widerspruch (Art. 21)', 'Gegen die Verarbeitung auf Basis berechtigter Interessen können Sie Widerspruch einlegen.'],
            ['Datenübertragbarkeit (Art. 20)', 'Sie können Ihre Daten in einem strukturierten, maschinenlesbaren Format erhalten.'],
            ['Beschwerde (Art. 77)', 'Sie haben das Recht, Beschwerde bei einer Aufsichtsbehörde einzulegen.'],
          ].map(([right, desc]) => (
            <li key={right as string} className="flex gap-3">
              <span className="text-sm font-semibold text-[#8b6b5c] w-52 shrink-0">{right}</span>
              <span className="text-sm text-[#6b3d32]">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Anfragen richten Sie an:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#6b3d32] underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <Section title="5. Änderungen dieser Erklärung">
        <p>
          Wir behalten uns vor, diese Datenschutzerklärung bei Änderungen der Plattform oder der
          Rechtslage anzupassen. Die jeweils aktuelle Version ist auf{' '}
          <strong>{PLATFORM_URL}/datenschutz</strong> abrufbar.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-[#4e2b22] mb-4 pb-2 border-b border-[#ede8e5]">
        {title}
      </h2>
      <div className="space-y-4 text-sm text-[#4e2b22] leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-sm font-semibold text-[#6b3d32] mb-2"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Legal({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[#8b6b5c] bg-[#faf9f7] border border-[#ede8e5] rounded-lg px-3 py-2 mt-2">
      {children}
    </p>
  );
}
