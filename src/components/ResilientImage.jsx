import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import fallbackImage from '../assets/hero-nails.png';

export default function ResilientImage({
  src,
  fallbackSrc,
  fallbackToBundled = true,
  motionProps,
  ...imageProps
}) {
  const sources = [
    ...new Set([src, fallbackSrc, fallbackToBundled ? fallbackImage : null].filter(Boolean)),
  ];
  const sourceKey = sources.join('|');
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourceKey]);

  if (sourceIndex >= sources.length) return null;

  const handleError = () => setSourceIndex((index) => index + 1);

  const Image = motionProps ? motion.img : 'img';

  return <Image {...imageProps} src={sources[sourceIndex]} onError={handleError} {...motionProps} />;
}
