"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({
  images,
  name,
  soldOut,
}: {
  images: { src: string; alt: string }[];
  name: string;
  soldOut: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const current = images[selected];
  if (!current) return null;
  return (
    <div className="min-w-0 space-y-3">
      <div className="relative aspect-[4/5] overflow-hidden bg-overlay">
        <Image
          src={current.src}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        {soldOut && (
          <span className="absolute left-4 top-4 bg-fg px-3 py-2 text-sm font-semibold text-void">
            품절
          </span>
        )}
        <span
          className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white"
          aria-live="polite"
        >
          {selected + 1} / {images.length}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2" aria-label={`${name} 상품 사진`}>
        {images.map((img, index) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setSelected(index)}
            aria-label={`${index + 1}번째 상품 사진`}
            aria-pressed={selected === index}
            className={`relative min-h-11 min-w-0 aspect-[4/5] overflow-hidden border-2 ${selected === index ? "border-fg" : "border-transparent"}`}
          >
            <Image
              src={img.src}
              alt=""
              fill
              sizes="(min-width: 768px) 10vw, 20vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
