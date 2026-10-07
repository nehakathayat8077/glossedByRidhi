import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { faqs } from '../data/data';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="sec">
      <div className="wrap narrow">
        <h2>Questions, answered</h2>

        {faqs.map(([question, answer], index) => (
          <div key={question} className="faq">
            <button onClick={() => setOpenIndex(openIndex === index ? -1 : index)}>
              {question}
              <Plus
                size={18}
                style={{
                  transform: openIndex === index ? 'rotate(45deg)' : 'none',
                  transition: '.3s',
                }}
              />
            </button>

            <AnimatePresence>
              {openIndex === index && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  {answer}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
