import { buildMiuSocialImage } from '@/lib/ogRenderer';

export const alt =
  'Miu Workspace — Dynamic Ambient Workspace untuk Fokus, Catatan, Kanban & Kalender AI';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return buildMiuSocialImage();
}
