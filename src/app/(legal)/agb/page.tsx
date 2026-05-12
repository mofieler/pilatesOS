import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AGB – Pilateq',
  description: 'Allgemeine Geschäftsbedingungen für paquita.pilateq.de',
  robots: { index: false },
};

export default function AGBPage() {
  return (
    <article className="prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Allgemeine Geschäftsbedingungen</h1>
      <p className="text-sm text-[#8b6b5c] mb-10">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

      <Section title="§ 1 Geltungsbereich">
        <p>
          Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge, die über die
          Buchungsplattform <strong>paquita.pilateq.de</strong> zwischen der
          <strong> Paquita Pilates Reformer GbR</strong> (im Folgenden „Studio") und dem
          Nutzer (im Folgenden „Kunde") geschlossen werden.
        </p>
        <p>
          Mit der Registrierung und Nutzung der Plattform erkennt der Kunde diese AGB ausdrücklich an.
        </p>
      </Section>

      <Section title="§ 2 Leistungen des Studios">
        <p>
          Das Studio bietet Pilates-Gruppenkurse, Einzelstunden und ergänzende Wellness-Leistungen
          an. Die Buchung erfolgt ausschließlich über die Plattform und ist nur mit einem ausreichenden
          Guthaben an Credits möglich.
        </p>
        <p>
          Der Inhalt und die Verfügbarkeit der Kurse können sich ändern. Das Studio behält sich vor,
          Kurse aus organisatorischen Gründen zu verschieben oder abzusagen. In diesem Fall werden die
          bezahlten Credits vollständig erstattet.
        </p>
      </Section>

      <Section title="§ 3 Vertragsschluss und Credit-Pakete">
        <p>
          Mit Klick auf den Button <em>„Zahlungspflichtig bestellen"</em> gibt der Kunde ein
          verbindliches Angebot zum Kauf des ausgewählten Credit-Pakets ab. Der Vertrag kommt mit
          der Bestätigungs-E-Mail des Studios zustande, welche zusätzlich die Rechnung im PDF-Format
          enthält.
        </p>
        <p>
          Credits sind <strong>nicht übertragbar</strong> und gelten ausschließlich für den
          Kursbetrieb der Paquita Pilates Reformer GbR. Die Gültigkeitsdauer ergibt sich aus dem
          jeweiligen Paket.
        </p>
      </Section>

      <Section title="§ 4 Preise und Zahlung">
        <p>
          Es gelten die auf der Buchungsseite zum Zeitpunkt der Bestellung angegebenen Preise. Alle
          Preise sind Endpreise; es wird keine Umsatzsteuer gemäß § 19 UStG (Kleinunternehmerregelung)
          ausgewiesen.
        </p>
        <p>
          Bei <strong>Bezahlung im Studio</strong> ist der Rechnungsbetrag innerhalb von
          <strong> 14 Tagen </strong>nach Rechnungsstellung persönlich im Studio zu begleichen. Die
          Credits werden unmittelbar nach Bestellung gutgeschrieben, damit der Kunde sofort buchen
          kann.
        </p>
        <p>
          Bei Zahlungsverzug behält sich das Studio vor, weitere Buchungen oder Käufe zu sperren, bis
          die offene Rechnung beglichen wurde.
        </p>
      </Section>

      <Section title="§ 5 Stornierung von Buchungen">
        <p>
          Bis <strong>24 Stunden</strong> vor Kursbeginn kann eine Buchung kostenfrei storniert
          werden; die Credits werden in voller Höhe gutgeschrieben.
        </p>
        <p>
          Bei späterer Stornierung verfallen die Credits. Eine einmalige Kulanzregelung
          („First-Time Mercy") wird automatisch beim ersten verspäteten Storno angewendet.
        </p>
      </Section>

      <Section title="§ 6 Pflichten des Kunden">
        <p>
          Der Kunde verpflichtet sich, wahrheitsgemäße Angaben bei der Registrierung zu machen und
          sein Konto vor unbefugtem Zugriff zu schützen. Die Teilnahme an Kursen erfolgt auf eigene
          Verantwortung; vor der ersten Buchung ist der digitale Haftungsausschluss zu unterzeichnen.
        </p>
      </Section>

      <Section title="§ 7 Haftung">
        <p>
          Das Studio haftet uneingeschränkt für Schäden aus Verletzung des Lebens, des Körpers oder
          der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung beruhen.
          Im Übrigen ist die Haftung auf Vorsatz und grobe Fahrlässigkeit beschränkt.
        </p>
      </Section>

      <Section title="§ 8 Widerrufsrecht">
        <p>
          Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Einzelheiten zum Widerrufsrecht
          sowie zum Erlöschen des Widerrufsrechts bei sofortiger Bereitstellung digitaler Leistungen
          finden Sie in unserer{' '}
          <a href="/widerrufsrecht" className="text-[#6b3d32] underline underline-offset-2">
            Widerrufsbelehrung
          </a>.
        </p>
      </Section>

      <Section title="§ 9 Datenschutz">
        <p>
          Die Erhebung und Verarbeitung personenbezogener Daten erfolgt nach den Vorgaben der
          Datenschutz-Grundverordnung (DSGVO). Einzelheiten regelt unsere{' '}
          <a href="/datenschutz" className="text-[#6b3d32] underline underline-offset-2">
            Datenschutzerklärung
          </a>.
        </p>
      </Section>

      <Section title="§ 10 Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
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
      <div className="space-y-3 text-sm text-[#4e2b22] leading-relaxed">{children}</div>
    </section>
  );
}
