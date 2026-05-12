import type { Metadata } from 'next';
import { STUDIO } from '@/lib/config/studio';

export const metadata: Metadata = {
  title: 'Impressum – Pilateq',
  description: 'Legal notice for paquita.pilateq.de',
  robots: { index: false },
};

export default function ImpressumPage() {
  const bookingDomain = STUDIO.bookingUrl.replace(/^https?:\/\//, '');

  return (
    <article className="prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Impressum</h1>
      <p className="text-sm text-[#8b6b5c] mb-10">Legal notice · Angaben gemäß § 5 TMG</p>

      <Section title="Anbieter dieser Plattform">
        <Field label="Unternehmensform">Gesellschaft bürgerlichen Rechts (GbR)</Field>
        <Field label="Name">{STUDIO.name}</Field>
        <Field label="Adresse">
          {STUDIO.address}<br />
          {STUDIO.city}<br />
          {STUDIO.country}
        </Field>
        {STUDIO.phone && (
          <Field label="Telefon">
            <a href={`tel:${STUDIO.phone.replace(/\s/g, '')}`} className="text-[#6b3d32] underline underline-offset-2">
              {STUDIO.phone}
            </a>
          </Field>
        )}
        <Field label="E-Mail">
          <a href={`mailto:${STUDIO.email}`} className="text-[#6b3d32] underline underline-offset-2">
            {STUDIO.email}
          </a>
        </Field>
        <Field label="Website (Studio)">
          <a href={STUDIO.website} target="_blank" rel="noopener noreferrer" className="text-[#6b3d32] underline underline-offset-2">
            {STUDIO.website.replace(/^https?:\/\//, '')}
          </a>
        </Field>
        <Field label="Booking-Plattform">
          <a href={STUDIO.bookingUrl} className="text-[#6b3d32] underline underline-offset-2">
            {bookingDomain}
          </a>
        </Field>
      </Section>

      <Section title="Steuerliche Angaben">
        <Field label="Steuernummer">{STUDIO.steuernummer}</Field>
        <Field label="Zuständiges Finanzamt">{STUDIO.finanzamt}</Field>
        <p className="text-sm text-[#8b6b5c] mt-2">
          Die GbR übt ausschließlich freiberufliche Tätigkeiten im Sinne des § 18 EStG aus
          (Unterricht / Bewegungspädagogik). Es wird keine Gewerbesteuer erhoben.
          Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).
        </p>
      </Section>

      <Section title="Verantwortliche Personen (§ 55 Abs. 2 RStV)">
        {STUDIO.partners ? (
          <p className="text-sm text-[#6b3d32] whitespace-pre-line">
            {STUDIO.partners}<br />
            Anschrift wie oben
          </p>
        ) : (
          <p className="text-sm text-[#6b3d32]">
            {STUDIO.name}<br />
            {STUDIO.address}, {STUDIO.city}
          </p>
        )}
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
      <h2 className="text-lg font-bold text-[#4e2b22] mb-4 pb-2 border-b border-[#ede8e5]">{title}</h2>
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
