import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <span className="eyebrow">Whattsapp Automatization</span>
      <h1>Your orders, organized.</h1>
      <p>We are building a way to manage WhatsApp orders through configurable
        conversations, with human support whenever it is needed.</p>
      <div className="status">Project in development</div>
      <section aria-labelledby="next-step">
        <h2 id="next-step">Try a conversation flow</h2>
        <p>Build a conversation, connect its steps, and try each reply in the customer preview.
</p>
        <Link className="button-link" href="/flows">Open flow playground</Link>
      </section>
    </main>
  );
}
