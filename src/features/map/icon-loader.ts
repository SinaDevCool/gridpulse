import {
GENERATION_TECHNOLOGY_CLASSES,
STORAGE_TECHNOLOGY,
} from "@/features/map/map-visual-registry";

import { type EnergyIconImage } from "./contracts";

export function preloadEnergyIconImages(): Promise<EnergyIconImage[]> {
  const icons = [
    ...GENERATION_TECHNOLOGY_CLASSES.map((item) => [`energy-${item.id}`, item.icon] as const),
    [`energy-${STORAGE_TECHNOLOGY.id}`, STORAGE_TECHNOLOGY.icon] as const,
  ];
  return Promise.all(
    icons.map(
      ([id, src]) =>
        new Promise<EnergyIconImage>((resolve, reject) => {
          const image = new Image(32, 32);
          image.decoding = "async";
          image.onload = () => resolve([id, image] as const);
          image.onerror = () => reject(new Error(`Could not load map icon: ${id}`));
          image.src = src;
        }),
    ),
  );
}
