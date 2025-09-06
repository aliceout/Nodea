import { useState, useEffect, useMemo } from "react";
import pb from "../services/pocketbase";

export default function useAuth() {
  const [user, setUser] = useState(pb.authStore.model);
  const [loading, setLoading] = useState(false);

  // Abonnement aux changements d'auth (login/logout/refresh)
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.model);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      await pb.collection("users").authWithPassword(email, password);
      setUser(pb.authStore.model);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
  };

  // --- Exposition des champs d’onboarding (lecture) ---
  const onboardingStatus = user?.onboarding_status ?? null;

  // --- Helpers d’update serveur (écriture) ---
  const finishOnboarding = async () => {
    if (!user?.id) return;
    await pb.collection("users").update(user.id, { onboarding_status: "done" });
    setUser(pb.authStore.model);
  };

  const snoozeOnboarding = async (isoDate) => {
    if (!user?.id) return;
    await pb.collection("users").update(user.id, {
      onboarding_status: "needed",
      snooze_until: isoDate || null,
    });
    setUser(pb.authStore.model);
  };

  const updateUserMeta = async (partial) => {
    if (!user?.id) return;
    await pb.collection("users").update(user.id, partial || {});
    setUser(pb.authStore.model);
  };

  // Valeur mémorisée pour éviter des re-renders inutiles
  const auth = useMemo(
    () => ({
      user,
      login,
      logout,
      loading,
      onboardingStatus,
      finishOnboarding,
      snoozeOnboarding,
      updateUserMeta,
    }),
    [user, loading, onboardingStatus]
  );

  return auth;
}
