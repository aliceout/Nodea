/**
 * Loading panel rendered while the api call is in flight
 * (REFACTO-12 split). Tiny on purpose — the round trip is usually
 * sub-second so a long copy would feel anxious.
 */
export default function PendingPanel() {
  return (
    <div className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-ink">
        Validation en cours…
      </h2>
      <p className="text-[13px] text-muted">
        On vérifie ton lien de récupération, deux secondes.
      </p>
    </div>
  );
}
