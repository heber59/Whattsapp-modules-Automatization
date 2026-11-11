'use client';
import Link from 'next/link';
import { usePortal } from './portal';
export default function HomePage() {
  const { t, user, openLogin } = usePortal();
  const launch = <>{user ? <Link className="button-link" href="/flows">{t('Open flow studio', 'Abrir estudio de flujos')} ↗</Link> : <button onClick={() => openLogin('/flows')}>{t('Create your first flow', 'Crea tu primer flujo')} ↗</button>}</>;
  return <main className="portal-home">
    <div className="hero">
      <div className="hero-copy">
        <span className="section-kicker"><span className="green-dot" /> {t('LESS REPETITION. MORE CONNECTION.', 'MENOS REPETICIÓN. MÁS CONEXIÓN.')}</span>
        <h1>{t('A conversation.', 'Una conversación.')}<br /><em>{t('A possibility.', 'Una posibilidad.')}</em></h1>
        <p>{t('Turn everyday WhatsApp conversations into a clearer path for your customers. Design the flow. Keep the human touch.', 'Transforma las conversaciones de WhatsApp en un camino más claro para tus clientes. Diseña el flujo. Conserva el toque humano.')}</p>
        <div className="hero-actions">{launch}<a className="text-link" href="#solutions">{t('Explore the possibilities', 'Explora las posibilidades')} ↓</a></div>
        <div className="hero-note"><span className="tiny-line" /> {t('Made for Colombian businesses. Built around people.', 'Para negocios colombianos. Pensado para las personas.')}</div>
      </div>
      <div className="hero-visual" aria-label={t('Example conversation flow', 'Ejemplo de flujo de conversación')}>
        <div className="visual-top"><span className="green-dot" /> {t('A LITTLE STRUCTURE. A LOT OF POTENTIAL.', 'UN POCO DE ORDEN. MUCHO POTENCIAL.')}</div>
        <div className="visual-grid">
          <div className="mock-node start"><span>01 / {t('START', 'INICIO')}</span><strong>{t('A new hello.', 'Un nuevo hola.')}</strong><small>{t('Every connection starts somewhere.', 'Toda conexión tiene un comienzo.')}</small></div>
          <div className="mock-connector">↓</div>
          <div className="mock-node menu"><span>02 / {t('LET THEM CHOOSE', 'DÉJALOS ELEGIR')}</span><strong>{t('How can we help?', '¿Cómo podemos ayudarte?')}</strong><div className="mock-options"><span>{t('Explore products', 'Ver productos')}</span><span>{t('Talk to us', 'Hablar con nosotros')}</span></div></div>
          <div className="mock-connector">↙ &nbsp; &nbsp; &nbsp; ↘</div>
          <div className="mock-bottom"><div className="mock-node mini"><span>{t('ANSWER', 'RESPONDE')}</span><strong>{t('Right on time.', 'Justo a tiempo.')}</strong></div><div className="mock-node mini"><span>{t('CONNECT', 'CONECTA')}</span><strong>{t('With a person.', 'Con una persona.')}</strong></div></div>
        </div>
        <div className="visual-caption"><span>↳ {t('You build the journey.', 'Tú diseñas el recorrido.')}</span><span>{t('Illustrative flow', 'Flujo ilustrativo')} ◉</span></div>
      </div>
    </div>
    <div className="principles-strip"><span>{t('Designed with intention', 'Diseñado con intención')}</span><strong>{t('Your business.', 'Tu negocio.')}</strong><strong>{t('Your conversations.', 'Tus conversaciones.')}</strong><strong>{t('Your way.', 'A tu manera.')}</strong></div>
    <section id="solutions" className="solutions-section">
      <div className="section-heading"><div><span className="section-kicker">01 / {t('THE POSSIBILITIES', 'LAS POSIBILIDADES')}</span><h2>{t('Less busywork.', 'Menos tareas repetitivas.')}<br />{t('More room to grow.', 'Más espacio para crecer.')}</h2></div><p>{t('A practical foundation for conversations that move your business forward. Here is what we are building.', 'Una base práctica para conversaciones que impulsan tu negocio. Esto es lo que estamos construyendo.')}</p></div>
      <div className="solution-grid">{[
        { icon: '⌘', title: t('Design the conversation', 'Diseña la conversación'), body: t('Build a visual flow, connect each step and test the experience before sharing it.', 'Crea un flujo visual, conecta cada paso y prueba la experiencia antes de compartirla.'), tag: t('Try the flow studio', 'Prueba el estudio'), available: true },
        { icon: '↗', title: t('Give every business a home', 'Un espacio para cada negocio'), body: t('Sign in, create your business and keep access organized around the people who belong there.', 'Ingresa, crea tu negocio y organiza el acceso de las personas que forman parte de él.'), tag: t('Available in your workspace', 'Disponible en tu espacio'), available: true },
        { icon: '◌', title: t('From a message to an order', 'De un mensaje a un pedido'), body: t('Our next chapter: connect WhatsApp, guide product discovery and bring orders into one place.', 'Nuestro próximo capítulo: conectar WhatsApp, guiar la búsqueda de productos y reunir los pedidos.'), tag: t('On our roadmap', 'En nuestra hoja de ruta'), available: false },
      ].map((card, index) => <article className="solution-card" key={index}><div className="card-top"><span className="solution-icon">{card.icon}</span><span>0{index + 1}</span></div><h3>{card.title}</h3><p>{card.body}</p><span className={card.available ? 'availability' : 'availability planned'}><span className="green-dot" />{card.tag}</span></article>)}</div>
    </section>
    <section id="purpose" className="purpose-section"><div><span className="section-kicker">02 / {t('WHO WE ARE HERE FOR', 'PARA QUIÉNES ESTAMOS AQUÍ')}</span><h2>{t('Small businesses.', 'Pequeños negocios.')}<br /><em>{t('Big human energy.', 'Gran energía humana.')}</em></h2></div><div><p>{t('For the neighborhood shop, the growing kitchen and the independent team doing a little bit of everything. Our goal is simple: give your time back, without losing what makes your business yours.', 'Para la tienda del barrio, la cocina que crece y el equipo independiente que hace un poco de todo. Nuestra meta es simple: devolverte tiempo sin perder lo que hace único a tu negocio.')}</p><div className="audience-tags"><span>{t('Local shops', 'Tiendas locales')}</span><span>{t('Food & pickup', 'Comida y recogida')}</span><span>{t('Independent teams', 'Equipos independientes')}</span></div></div></section>
    <section className="portal-cta"><span className="section-kicker">{t('START WITH ONE CONVERSATION', 'EMPIEZA CON UNA CONVERSACIÓN')}</span><h2>{t('Make your next hello count.', 'Haz que tu próximo hola cuente.')}</h2>{launch}<p>{t('A working prototype. A clear ambition. More to come.', 'Un prototipo funcional. Una meta clara. Mucho por venir.')}</p></section>
  </main>;
}
