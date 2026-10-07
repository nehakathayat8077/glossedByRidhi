import { motion } from 'framer-motion';
import { services } from '../data/data';

export default function Services() {
  return (
    <section id="services" className="sec">
      <div className="wrap">
        <h2>Services made for your hands</h2>

        <div className="grid g3">
          {services.map((service, index) => (
            <motion.article
              key={service.name}
              className="card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.07 }}
            >
              <div className="ph">
                <img loading="lazy" src={service.img} alt={service.name} />
              </div>

              <div className="cb">
                <h3>{service.name}</h3>
                <p>{service.text}</p>

                <div className="row sb">
                  <strong>
                    ₹{service.price.toLocaleString('en-IN')}
                    {service.plus && '+'}
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
