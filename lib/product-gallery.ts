import galleryManifestJson from "@/data/product-galleries.json";

export type ProductGalleryShotRole = "hero" | "lifestyle" | "silhouette" | "product-only" | "detail";

export type ProductGallerySpec = {
  batch: string;
  slug: string;
  photoId: string;
  name: string;
  gender: "men" | "women";
  category: string;
  canonical: {
    color: string;
    material: string;
    silhouette: string;
    construction: string;
  };
  shots: Array<{
    role: ProductGalleryShotRole;
    description: string;
  }>;
};

type ProductGalleryManifest = {
  version: string;
  products: ProductGallerySpec[];
};

const manifest = galleryManifestJson as ProductGalleryManifest;

export const PRODUCT_GALLERY_VERSION = manifest.version;
export const PRODUCT_GALLERIES = manifest.products;

const galleryBySlug = new Map<string, ProductGallerySpec>();
const galleryByPhotoId = new Map<string, ProductGallerySpec>();
const galleryImagePaths = new Set<string>();

for (const gallery of PRODUCT_GALLERIES) {
  if (galleryBySlug.has(gallery.slug)) throw new Error(`Duplicate curated gallery slug: ${gallery.slug}`);
  if (galleryByPhotoId.has(gallery.photoId)) throw new Error(`Duplicate curated gallery photo id: ${gallery.photoId}`);
  if (gallery.shots.length !== 5) throw new Error(`${gallery.slug}: curated gallery requires exactly five shots`);
  galleryBySlug.set(gallery.slug, gallery);
  galleryByPhotoId.set(gallery.photoId, gallery);
  for (let imageNumber = 1; imageNumber <= gallery.shots.length; imageNumber++) {
    galleryImagePaths.add(productGalleryImagePath(gallery, imageNumber));
  }
}

export function getProductGalleryBySlug(slug: string) {
  return galleryBySlug.get(slug) ?? null;
}

export function getProductGalleryByPhotoId(photoId: string) {
  return galleryByPhotoId.get(photoId) ?? null;
}

export function productGalleryImagePath(gallery: Pick<ProductGallerySpec, "batch" | "slug">, imageNumber: number) {
  if (!Number.isInteger(imageNumber) || imageNumber < 1 || imageNumber > 5) {
    throw new Error(`Invalid curated gallery image number: ${imageNumber}`);
  }
  return `/products/gallery/${gallery.batch}/${gallery.slug}/${String(imageNumber).padStart(2, "0")}.webp`;
}

export function isProductGalleryImagePath(pathname: string) {
  return galleryImagePaths.has(pathname);
}
