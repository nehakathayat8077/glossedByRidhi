// Service details power both the services grid and appointment form.
export const services = [
  {
    name: 'Classic Manicure',
    price: 499,
    text: 'Shape, cuticle care and a flawless polish finish.',
    image_url: '/images/designs/design-01.jpg',
  },
  {
    name: 'Gel Nails',
    price: 799,
    text: 'Glossy colour that stays chip-free for weeks.',
    image_url: '/images/designs/design-01.jpg',
  },
  {
    name: 'Nail Extensions',
    price: 1299,
    text: 'Sculpted length in the shape you love.',
    image_url: '/images/designs/design-01.jpg',
  },
  {
    name: 'Custom Nail Art',
    price: 999,
    plus: true,
    text: 'Hand-painted designs made from your idea.',
    image_url: '/images/designs/design-01.jpg',
  },
  {
    name: 'French Tips',
    price: 699,
    text: 'The timeless white edge, done with precision.',
    image_url: '/images/designs/design-01.jpg',
  },
  {
    name: 'Chrome / Glazed',
    price: 899,
    text: 'Mirror shine with a soft pearl glow.',
    image_url: '/images/designs/design-01.jpg',
  },
];

// Categories are used to filter the nail design gallery.
export const cats = [
  'All',
  'Minimal',
  'French',
  'Chrome',
  'Floral',
  'Bridal',
  'Party',
  'Cute',
];

export const designs = [
   {
    id: 'd1',
    name: 'Blush Milk Bath',
    cat: 'Minimal',
    price: 899,
    image_url: '/images/designs/design-01.jpg',
  },
  {
    id: 'd2',
    name: 'Champagne French',
    cat: 'French',
    price: 999,
    image_url: '/images/designs/design-07.jpg',
  },
  {
    id: 'd3',
    name: 'Rose Chrome',
    cat: 'Chrome',
    price: 1099,
    image_url: '/images/designs/design-03.jpg',
    text: 'Mirror rose chrome over a sheer pink base.',
  },
  {
    id: 'd4',
    name: 'Wild Peony',
    cat: 'Floral',
    price: 1199,
    image_url: '/images/designs/design-04.jpg',
    text: 'Hand-painted peonies in burgundy and blush.',
  },
  {
    id: 'd5',
    name: 'Veil & Pearl',
    cat: 'Bridal',
    price: 1499,
    image_url: '/images/designs/design-08.jpg',
    text: 'Soft ivory with pearls and fine lace detail.',
  },
  {
    id: 'd6',
    name: 'Midnight Sparkle',
    cat: 'Party',
    price: 1299,
    image_url: '/images/designs/design-06.jpg',
    text: 'Deep wine base with scattered glitter.',
  },
  {
    id: 'd7',
    name: 'Strawberry Milk',
    cat: 'Cute',
    price: 999,
    image_url: '/images/designs/design-02.jpg',
    text: 'Tiny hearts and cherries on pastel pink.',
  },
  {
    id: 'd8',
    name: 'Nude Lines',
    cat: 'Minimal',
    price: 849,
    image_url: '/images/designs/design-05.jpg',
    text: 'Fine gold lines across a neutral nude.',
  },
];

export const products = [
  {
    id: 'p1',
    name: 'Press-On Nails',
    price: 699,
    old: 899,
    rating: 4.8,
    image_url: '/images/products/product-press-on-nails.jpg',
  },
  {
    id: 'p2',
    name: 'Nail Art Stickers',
    price: 249,
    rating: 4.6,
    image_url: '/images/products/product-nail-stickers.jpg',
  },
  {
    id: 'p3',
    name: 'Nail Care Kit',
    price: 599,
    old: 749,
    rating: 4.7,
    image_url: '/images/products/product-nail-kit.jpg',
  },
  {
    id: 'p4',
    name: 'Cuticle Oil',
    price: 299,
    rating: 4.9,
    image_url: '/images/products/product-cuticle-oil.jpg',
  },
  {
    id: 'p5',
    name: 'Nail File Kit',
    price: 349,
    old: 399,
    rating: 4.5,
    image_url: '/images/products/product-nail-file.jpg',
  },
  {
    id: 'p6',
    name: 'Gift Box',
    price: 1299,
    old: 1599,
    rating: 4.9,
    image_url: '/images/products/product-gift-box.jpg',
  },
];

export const faqs = [
  [
    'Do I need an appointment?',
    'Yes, booking ahead guarantees your slot. Walk-ins depend on availability.',
  ],
  [
    'How long does an appointment take?',
    'Roughly 45 minutes to 2.5 hours, depending on the service.',
  ],
  [
    'Do you offer custom nail designs?',
    'Yes. Share a reference photo and we will recreate it for you.',
  ],
  ['How long do gel nails last?', 'Usually 3 to 4 weeks with good care.'],
  [
    'What is your cancellation policy?',
    'Please cancel at least 24 hours before your slot.',
  ],
];
