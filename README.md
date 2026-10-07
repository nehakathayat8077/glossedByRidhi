glossedByRidhi 💅

A premium nail-art website for Ridhi, a nail artist. Visitors can browse designs, explore services, shop nail-care products and book an appointment, all from one elegant, mobile-friendly page.

GitHub "About" text: Premium nail-art website built with React, Vite and Framer Motion: designs, services, shop with cart, and appointment booking.

Features
Sticky navbar with blur on scroll, animated mobile menu and live cart count
Hero section with floating image and decorative sparkles
Services list with prices and Book Now buttons
Nail design collection with category filters, favourites and a details modal
Shop with product search, discount badges, ratings and wishlist
Slide-out cart drawer (quantity controls, delivery and total) saved in localStorage
Appointment booking form with validation and a success modal
FAQ accordion, newsletter signup, toast messages and WhatsApp button
Tech stack

React 18, Vite, Framer Motion, Lucide React, React Router, plain CSS with colour variables, Context API and localStorage.

Getting started
bash
npm install
npm run dev

Open the local address Vite prints (usually http://localhost:5173). Build for production with npm run build.

Project structure
src/
  components/   Navbar, Hero, Services, NailDesigns, Shop, CartDrawer, Booking, FAQ, Footer
  context/      CartContext (cart, wishlist, toast)
  data/         data.js (services, designs, products, FAQs)
  styles.css    Design tokens and styles
Customising
Colours: edit the CSS variables at the top of src/styles.css.
Content and prices: edit src/data/data.js.
Images: the img values are placeholders from picsum.photos. Replace them with Ridhi's own photos.
Contact links: replace https://wa.me/910000000000 and https://instagram.com in Navbar.jsx and Footer.jsx.
Connecting a backend later
Bookings: saveBooking() in src/components/Booking.jsx currently writes to localStorage. Replace its body with a Supabase, Firebase or API call.
Checkout: the Checkout button in CartDrawer.jsx is a placeholder for a payment gateway.
Roadmap

Custom design builder, Instagram-style gallery, before/after slider, testimonials carousel, countdown offer banner, contact section, back-to-top button and separate router pages.

License


© 2026 glossedByRidhi. All Rights Reserved.
