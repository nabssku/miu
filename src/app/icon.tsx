import { buildMiuIconImage } from '@/lib/ogRenderer';

export const size = {
  width: 192,
  height: 192
};
export const contentType = 'image/png';

export default function Icon() {
  return buildMiuIconImage(192);
}
