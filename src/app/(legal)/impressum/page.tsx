import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum – Pilateq',
  description: 'Legal notice for paquita.pilateq.de',
  robots: { index: false },
};

export default function ImpressumPage() {
  return (
    <article className="prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Impressum</h1>
      <p className="text-sm text-[#8b6b5c] mb-10">Legal notice · Angaben gemäß § 5 TMG</p>

      <Section title="Anbieter dieser Plattform">
        <Field label="Unternehmensform">Gesellschaft bürgerlichen Rechts (GbR)</Field>
        <Field label="Name">Paquita Pilates Reformer GbR</Field>
        <Field label="Adresse">
          {/* UPDATE: insert street + city here */}
          [Straße und Hausnummer]<br />
          [PLZ] [Ort]<br />
          Deutschland
        </Field>
        <Field label="E-Mail">
          <a href="mailto:info@paquitapilatesreformer.de" className="text-[#6b3d32] underline underline-offset-2">
            info@paquitapilatesreformer.de
          </a>
        </Field>
        <Field label="Website (Studio)">
          <a href="https://www.paquitapilatesreformer.de" target="_blank" rel="noopener noreferrer" className="text-[#6b3d32] underline underline-offset-2">
            www.paquitapilatesreformer.de
          </a>
        </Field>
        <Field label="Booking-Plattform">
          <a href="https://paquita.pilateq.de" className="text-[#6b3d32] underline underline-offset-2">
            paquita.pilateq.de
          </a>
        </Field>
      </Section>

      <Section title="Steuerliche Angaben">
        <Field label="Steuernummer">93150/09800</Field>
        <Field label="Zuständiges Finanzamt">[Finanzamt eintragen]</Field>
        <p className="text-sm text-[#8b6b5c] mt-2">
          Die GbR übt ausschließlich freiberufliche Tätigkeiten im Sinne des § 18 EStG aus
          (Unterricht / Bewegungspädagogik). Es wird keine Gewerbesteuer erhoben.
          Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).
        </p>
      </Section>

      <Section title="Verantwortliche Personen (§ 55 Abs. 2 RStV)">
        <p className="text-sm text-[#6b3d32]">
          [Name der GbR-Gesellschafter eintragen]<br />
          Anschrift wie oben
        </p>
      </Section>

      <Section title="Haftungshinweis">
        <p className="text-sm text-[#6b3d32] leading-relaxed">
          Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte
          externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber
          verantwortlich.
        </p>
      </Section>

      <Section title="Hinweis zu Online-Streitbeilegung (OS)">
        <p className="text-sm text-[#6b3d32] leading-relaxed">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6b3d32] underline underline-offset-2"
          >
            https://ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor
          einer Verbraucherschlichtungsstelle teilzunehmen.
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
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm font-semibold text-[#8b6b5c] w-44 shrink-0">{label}</span>
      <span className="text-sm text-[#4e2b22] leading-relaxed">{children}</span>
    </div>
  );
}
