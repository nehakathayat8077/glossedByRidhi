import { motion } from 'framer-motion';
import { useCatalogData } from '../hooks/useCatalogData';
import { loadActiveServices } from '../lib/catalogLoaders';
import ResilientImage from './ResilientImage';

const noFallbackServices = [];

export default function Services() {
  const { items: services, loading } = useCatalogData(
    loadActiveServices,
    noFallbackServices,
    'services',
  );

  return (
    <section id="services" className="sec">
      <div className="wrap">
        <h2>Services made for your hands</h2>

        <div className="grid g3">
          {loading ? (
            <p className="muted" role="status">Loading services…</p>
          ) : services.length === 0 ? (
            <p className="muted">No services are currently available.</p>
          ) : services.map((service, index) => (
            <motion.article
              key={service.id}
              className="card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.07 }}
            >
              <div className="ph">
                {service.image_url && (
                  <ResilientImage
                    loading="lazy"
                    src={service.image_url}
                    fallbackToBundled={false}
                    alt={service.name}
                  />
                )}
              </div>

              <div className="cb">
                <h3>{service.name}</h3>
                {service.description && <p>{service.description}</p>}

                <div className="row sb">
                  <strong>
                    ₹{service.price.toLocaleString('en-IN')}
                  </strong>

                  <button
                    className="btn sm"
                    onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
