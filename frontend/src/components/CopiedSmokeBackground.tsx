import { COPIED_SMOKE_BACKGROUND_IMAGE } from '../utils/copiedBottomNav';

export default function CopiedSmokeBackground() {
  return (
    <div className="copied-shared-smoke-bg" aria-hidden="true">
      <div
        className="w-full h-full bg-cover bg-center mix-blend-screen opacity-20"
        style={{
          backgroundImage: `url("${COPIED_SMOKE_BACKGROUND_IMAGE}")`,
          transform: 'translate(3.02564px, 8.79845px) scale(1.1)',
        }}
      />
    </div>
  );
}
