import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputRoot = fileURLToPath(new URL('../public/images/', import.meta.url));
const imageModel = 'gpt-image-1';

const assets = [
  {
    path: 'hero-nails.jpg',
    prompt:
      'Premium editorial hero photograph for a luxury nail artist website: elegant hand with glossy blush-pink almond nails and subtle gold details, resting on soft ivory satin, warm natural window light, refined feminine styling, sophisticated rose and cream palette, close-up composition with generous soft negative space, realistic high-end beauty photography, no text, no logo, no watermark.',
  },
  {
    path: 'nail-service.jpg',
    prompt:
      'Luxury nail salon service photograph, close-up of a professional nail artist carefully painting a client’s elegant nude-pink nails, clean hygienic workstation, soft natural light, blush and cream palette, premium editorial beauty photography, realistic hands and polish brush, no text, no logo, no watermark.',
  },
  {
    path: 'nail-products.jpg',
    prompt:
      'Premium nail-care product collection arranged on a warm ivory vanity: tasteful nail polish bottles, cuticle oil and manicure tools with subtle rose-gold accents, refined luxury beauty editorial, soft blush palette, clean balanced still-life composition, realistic product photography, no readable text, no logo, no watermark.',
  },
  {
    path: 'about-ridhi.jpg',
    prompt:
      'Warm professional portrait for an independent premium nail artist brand: friendly South Asian woman nail artist in a clean elegant studio, natural soft window light, understated blush and cream interior, polished but approachable editorial photography, shoulders-up portrait, no text, no logo, no watermark.',
  },
  {
    path: 'designs/pink-gel-nails.jpg',
    prompt:
      'Macro beauty photograph of elegant short almond nails in sheer blush-pink gel with a glossy glass-like finish, soft ivory background, luxury nail-art editorial, realistic skin texture, no text, no logo, no watermark.',
  },
  {
    path: 'designs/french-tip-nails.jpg',
    prompt:
      'Macro beauty photograph of refined almond nails with a sheer nude base and delicate crisp ivory French tips, subtle champagne shimmer, soft cream background, premium bridal nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/chrome-nails.jpg',
    prompt:
      'Macro beauty photograph of rose-chrome glazed almond nails with a luminous pink mirror sheen over a sheer blush base, elegant hand pose, soft neutral background, high-end nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/floral-nail-art.jpg',
    prompt:
      'Macro beauty photograph of hand-painted burgundy and blush peony flowers on elegant nude nails, fine botanical detail, graceful feminine hand pose, soft cream background, premium artisan nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/bridal-nails.jpg',
    prompt:
      'Macro beauty photograph of bridal ivory almond nails with tiny pearl accents and delicate lace-inspired details, elegant soft-focus cream silk background, sophisticated luxury wedding beauty editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/cat-eye-nails.jpg',
    prompt:
      'Macro beauty photograph of deep rose-plum cat-eye gel nails with a fine magnetic velvet light stripe, glossy almond shape, refined low-contrast blush background, luxurious nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/nude-nails.jpg',
    prompt:
      'Macro beauty photograph of minimalist almond nails in a creamy nude polish with delicate fine gold line accents, clean soft beige background, understated luxury nail-art editorial, realistic skin texture, no text, no logo, no watermark.',
  },
  {
    path: 'designs/3d-nail-art.jpg',
    prompt:
      'Macro beauty photograph of elegant blush-pink nails with tiny sculpted three-dimensional floral details and restrained pearl accents, polished artisan finish, soft ivory background, premium nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/red-nail-art.jpg',
    prompt:
      'Macro beauty photograph of elegant short almond nails in rich glossy garnet-red polish with a refined high-shine finish, soft warm cream background, timeless luxury beauty editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/abstract-nails.jpg',
    prompt:
      'Macro beauty photograph of contemporary abstract nail art: flowing fine burgundy, blush and ivory curves on glossy neutral almond nails, tasteful negative space, soft cream background, premium editorial photography, no text, no logo, no watermark.',
  },
  {
    path: 'designs/glitter-nails.jpg',
    prompt:
      'Macro beauty photograph of deep wine-colored almond nails with delicate scattered rose-gold glitter, elegant evening sparkle without excess, soft neutral background, refined luxury nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'designs/pastel-nails.jpg',
    prompt:
      'Macro beauty photograph of playful pastel-pink nails with tiny hand-painted cherry and heart accents, glossy finish, elegant rather than childish, soft blush background, premium nail-art editorial, no text, no logo, no watermark.',
  },
  {
    path: 'products/product-nail-polish.jpg',
    prompt:
      'Single premium glass nail polish bottle in a muted rose-pink shade with a refined black cap, placed on a warm ivory stone surface with a soft blush backdrop, clean luxury e-commerce product photograph, no readable label, no logo, no watermark.',
  },
  {
    path: 'products/product-cuticle-oil.jpg',
    prompt:
      'Elegant clear glass cuticle oil bottle with a precision dropper and subtle botanical detail, arranged on cream stone with a few soft petals, premium clean beauty product photography, warm blush light, no readable label, no logo, no watermark.',
  },
  {
    path: 'products/product-nail-stickers.jpg',
    prompt:
      'Premium sheet of delicate nail-art stickers with tiny gold stars, flowers and hearts on a clean ivory surface, tasteful rose-gold accents, neat luxury e-commerce product flat lay, no text, no logo, no watermark.',
  },
  {
    path: 'products/product-nail-kit.jpg',
    prompt:
      'Curated professional manicure kit neatly arranged in a blush-colored case: quality nail clippers, cuticle pusher, file and buffer, clean ivory studio background, refined premium e-commerce product photography, no text, no logo, no watermark.',
  },
  {
    path: 'products/product-press-on-nails.jpg',
    prompt:
      'A neat set of premium reusable press-on nails in elegant glossy blush-nude almond shape, displayed in a tasteful ivory presentation tray, soft rose lighting, clean luxury e-commerce product photography, no text, no logo, no watermark.',
  },
  {
    path: 'products/product-nail-file.jpg',
    prompt:
      'Elegant professional nail file and mini buffer set in muted blush and cream tones, arranged diagonally on a clean ivory stone surface, premium beauty e-commerce product photograph, no text, no logo, no watermark.',
  },
  {
    path: 'products/product-gift-box.jpg',
    prompt:
      'Beautiful premium nail-care gift box in blush-pink packaging with a satin ribbon, slightly open to reveal a curated manicure set, warm ivory background, refined luxury gift product photography, no text, no logo, no watermark.',
  },
];

async function generateImage(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      prompt,
      size: '1024x1024',
      quality: 'high',
      output_format: 'jpeg',
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    const detail = result.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Image generation failed: ${detail}`);
  }

  const encodedImage = result.data?.[0]?.b64_json;
  if (!encodedImage) {
    throw new Error('Image generation returned no base64 image data.');
  }

  return Buffer.from(encodedImage, 'base64');
}

async function main() {
  let generated = 0;
  let skipped = 0;

  for (const asset of assets) {
    const destination = join(outputRoot, asset.path);
    await mkdir(dirname(destination), { recursive: true });

    try {
      await access(destination);
      skipped += 1;
      console.log(`Skipped existing image ${asset.path}`);
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OPENAI_API_KEY is missing. Add it to .env.local, then run npm run generate-images again.',
        );
      }

      const image = await generateImage(asset.prompt, apiKey);
      await writeFile(destination, image, { flag: 'wx' });
      generated += 1;
      console.log(`Generated ${asset.path}`);
    } catch (error) {
      if (error.code === 'EEXIST') {
        skipped += 1;
        console.log(`Skipped existing image ${asset.path}`);
        continue;
      }
      throw new Error(`Could not create ${asset.path}: ${error.message}`, { cause: error });
    }
  }

  console.log(`Image generation complete: ${generated} generated, ${skipped} existing files skipped.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
