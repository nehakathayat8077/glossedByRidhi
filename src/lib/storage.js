const publicImagesUrl =
  'https://uqanejmosujpldxepmnl.supabase.co/storage/v1/object/public/images/';

export const storageImageUrl = (objectPath) => `${publicImagesUrl}${objectPath}`;
